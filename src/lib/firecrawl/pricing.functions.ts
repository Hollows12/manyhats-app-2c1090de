import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------- Service area ----------------

const ServiceAreaInput = z.object({
  zip: z.string().min(3).max(10),
  radius_mi: z.number().int().min(1).max(500).default(40),
  is_primary: z.boolean().default(true),
});

export const upsertServiceArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ServiceAreaInput.parse(d))
  .handler(async ({ data, context }) => {
    if (data.is_primary) {
      await context.supabase
        .from("contractor_service_areas")
        .update({ is_primary: false })
        .eq("contractor_id", context.userId);
    }
    const { data: row, error } = await context.supabase
      .from("contractor_service_areas")
      .insert({
        contractor_id: context.userId,
        zip: data.zip,
        radius_mi: data.radius_mi,
        is_primary: data.is_primary,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------------- Supplier discovery ----------------

const DiscoverInput = z.object({
  zip: z.string().min(3).max(10),
  category: z.string().min(2).max(80),
  limit: z.number().int().min(1).max(20).default(10),
});

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const discoverSuppliersByZip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DiscoverInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { firecrawlSearch, normalizeSearchResults } = await import("./client.server");

    const query = `${data.category} suppliers near ${data.zip}`;
    const job = await context.supabase
      .from("firecrawl_jobs")
      .insert({
        kind: "supplier_discovery",
        target: query,
        status: "running",
        started_at: new Date().toISOString(),
        triggered_by: context.userId,
      })
      .select()
      .single();

    try {
      const res = await firecrawlSearch(query, { limit: data.limit });
      const items = normalizeSearchResults(res);

      const rows = items.map((it) => ({
        name: (it.title ?? new URL(it.url).hostname).slice(0, 200),
        website: it.url,
        categories: [data.category],
        zip: data.zip,
        source_url: it.url,
        last_updated: new Date().toISOString(),
      }));

      const inserted: any[] = [];
      for (const r of rows) {
        const { data: existing } = await context.supabase
          .from("suppliers")
          .select("id")
          .eq("website", r.website)
          .maybeSingle();
        if (existing) {
          await context.supabase
            .from("suppliers")
            .update({ last_updated: r.last_updated, zip: r.zip })
            .eq("id", existing.id);
          inserted.push({ id: existing.id, ...r, updated: true });
        } else {
          const { data: ins, error } = await context.supabase
            .from("suppliers")
            .insert(r)
            .select()
            .single();
          if (!error && ins) inserted.push(ins);
        }
      }

      await context.supabase
        .from("firecrawl_jobs")
        .update({
          status: "succeeded",
          finished_at: new Date().toISOString(),
          result_summary: { found: items.length, saved: inserted.length },
        })
        .eq("id", job.data?.id);

      return { found: items.length, saved: inserted.length, suppliers: inserted };
    } catch (e: any) {
      await context.supabase
        .from("firecrawl_jobs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error: String(e?.message ?? e),
        })
        .eq("id", job.data?.id);
      throw e;
    }
  });

// ---------------- Material enrichment ----------------

const EnrichInput = z.object({ url: z.string().url() });

export const enrichMaterialFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EnrichInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { firecrawlScrape } = await import("./client.server");

    const job = await context.supabase
      .from("firecrawl_jobs")
      .insert({
        kind: "material_enrichment",
        target: data.url,
        status: "running",
        started_at: new Date().toISOString(),
        triggered_by: context.userId,
      })
      .select()
      .single();

    try {
      const res = await firecrawlScrape(data.url, {
        formats: [
          "markdown",
          "summary",
          {
            type: "json",
            prompt:
              "Extract product info: name, manufacturer, description, coverage, yield, weight, dimensions, colors[], compatible_with[], warranty, upc, sku, image_url, price (number), unit (string like 'each'|'sq ft'|'lb'|'gal'), availability. Only include fields explicitly present.",
          },
        ],
        onlyMainContent: true,
      });

      const j = res.data?.json ?? res.json ?? {};
      const md = res.data?.metadata ?? res.metadata ?? {};

      const name = (j.name || md.title || "Unknown product").toString().slice(0, 200);

      const { data: mat, error: matErr } = await context.supabase
        .from("materials")
        .insert({
          name,
          manufacturer: j.manufacturer ?? null,
          description: j.description ?? md.description ?? null,
          coverage: j.coverage ?? null,
          yield: j.yield ?? null,
          weight: j.weight ?? null,
          dimensions: j.dimensions ?? null,
          colors: Array.isArray(j.colors) ? j.colors : [],
          compatible_with: Array.isArray(j.compatible_with) ? j.compatible_with : [],
          warranty: j.warranty ?? null,
          image_url: j.image_url ?? null,
          upc: j.upc ?? null,
          sku: j.sku ?? null,
          spec: j,
          source_url: data.url,
        })
        .select()
        .single();
      if (matErr) throw new Error(matErr.message);

      let price_saved = false;
      if (typeof j.price === "number" && j.price > 0 && j.unit) {
        await context.supabase.from("material_prices").insert({
          material_id: mat.id,
          price: j.price,
          unit: String(j.unit).slice(0, 40),
          availability: j.availability ?? null,
          product_url: data.url,
          source: "firecrawl",
          price_confidence: 0.6,
        });
        price_saved = true;
      }

      await context.supabase
        .from("firecrawl_jobs")
        .update({
          status: "succeeded",
          finished_at: new Date().toISOString(),
          result_summary: { material_id: mat.id, price_saved },
        })
        .eq("id", job.data?.id);

      return { material: mat, price_saved };
    } catch (e: any) {
      await context.supabase
        .from("firecrawl_jobs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error: String(e?.message ?? e),
        })
        .eq("id", job.data?.id);
      throw e;
    }
  });

// ---------------- Knowledge import ----------------

const KnowledgeInput = z.object({
  url: z.string().url(),
  kind: z.enum(["install", "spec", "sds", "warranty", "practice", "safety", "other"]).default("other"),
  tags: z.array(z.string()).default([]),
});

export const importKnowledgeDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => KnowledgeInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { firecrawlScrape } = await import("./client.server");

    const job = await context.supabase
      .from("firecrawl_jobs")
      .insert({
        kind: "knowledge_import",
        target: data.url,
        status: "running",
        started_at: new Date().toISOString(),
        triggered_by: context.userId,
      })
      .select()
      .single();

    try {
      const res = await firecrawlScrape(data.url, {
        formats: ["markdown", "summary"],
        onlyMainContent: true,
      });
      const md = res.data?.markdown ?? res.markdown ?? "";
      const summary = res.data?.summary ?? res.summary ?? null;
      const meta = res.data?.metadata ?? res.metadata ?? {};

      const { data: doc, error } = await context.supabase
        .from("knowledge_docs")
        .insert({
          title: (meta.title ?? data.url).toString().slice(0, 250),
          kind: data.kind,
          body_md: md,
          summary,
          source_url: data.url,
          tags: data.tags,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);

      await context.supabase
        .from("firecrawl_jobs")
        .update({
          status: "succeeded",
          finished_at: new Date().toISOString(),
          result_summary: { doc_id: doc.id },
        })
        .eq("id", job.data?.id);

      return doc;
    } catch (e: any) {
      await context.supabase
        .from("firecrawl_jobs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error: String(e?.message ?? e),
        })
        .eq("id", job.data?.id);
      throw e;
    }
  });

// ---------------- AI Smart Pricing recommendation (advisory) ----------------

const RecommendInput = z.object({ project_id: z.string().uuid() });

const RecommendationSchema = z.object({
  materials: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    unit: z.string(),
    estimated_unit_cost: z.number().nullable().optional(),
    notes: z.string().optional(),
  })),
  labor_hours: z.number(),
  equipment: z.array(z.string()).default([]),
  travel_mi: z.number().default(0),
  waste_pct: z.number().default(10),
  contingency_pct: z.number().default(10),
  markup_pct: z.number().default(20),
  margin_pct: z.number().default(15),
  price_range: z.object({ low: z.number(), high: z.number() }),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  disclaimers: z.array(z.string()).default([]),
});

export const recommendEstimate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RecommendInput.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { data: project, error: pErr } = await context.supabase
      .from("projects")
      .select("*, clients(name, city, state, zip)")
      .eq("id", data.project_id)
      .single();
    if (pErr) throw new Error(pErr.message);

    const [{ data: measurements }, { data: photos }, { data: prices }] = await Promise.all([
      context.supabase.from("measurements").select("*").eq("project_id", data.project_id),
      context.supabase.from("project_photos").select("id, tags").eq("project_id", data.project_id),
      context.supabase.from("material_prices").select("price, unit, material_id, retrieved_at, materials(name)").order("retrieved_at", { ascending: false }).limit(50),
    ]);

    const { generateText, Output } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("../ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const system = `You are the Smart Pricing engine for ManyHats Construction (veteran-owned).
Produce an ADVISORY estimate recommendation. The contractor will review, approve, or reject before any client sees pricing.
NEVER invent measurements. If measurements are missing, lower confidence and add a disclaimer.
Cite public reference prices when using them; otherwise mark cost as null.`;

    const prompt = `Project: ${JSON.stringify({
      name: project.name,
      type: project.project_type,
      status: project.project_status,
      description: project.description,
      city: project.clients?.city,
      state: project.clients?.state,
      zip: project.clients?.zip,
      measurements: (measurements ?? []).map((m: any) => ({ label: m.label, value: m.value, unit: m.unit, confirmed: m.is_confirmed })),
      photo_count: photos?.length ?? 0,
    }, null, 2)}

Recent cached material prices (advisory only):
${JSON.stringify((prices ?? []).slice(0, 20), null, 2)}

Return a structured recommendation.`;

    const { experimental_output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      prompt,
      experimental_output: Output.object({ schema: RecommendationSchema }),
    });

    const { data: rec, error: rErr } = await context.supabase
      .from("ai_estimate_recommendations")
      .insert({
        project_id: data.project_id,
        payload: experimental_output as any,
        status: "pending",
        confidence: experimental_output.confidence,
      })
      .select()
      .single();
    if (rErr) throw new Error(rErr.message);

    return rec;
  });

const ReviewInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  notes: z.string().optional(),
});

export const reviewRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReviewInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ai_estimate_recommendations")
      .update({
        status: data.status,
        notes: data.notes ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------------- Public read helpers ----------------

export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("suppliers")
      .select("*")
      .order("is_favorite", { ascending: false })
      .order("last_updated", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listMaterials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("materials")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listFirecrawlJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("firecrawl_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyServiceArea = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contractor_service_areas")
      .select("*")
      .eq("contractor_id", context.userId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });
