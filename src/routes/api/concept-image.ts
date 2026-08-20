import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const RequestBody = z.object({ id: z.string().uuid() }).strict();

export function resolveConceptGenerationProfile(title: string) {
  const normalized = title.toLowerCase();
  if (normalized.includes("walkthrough")) {
    return {
      entitlement: "walkthrough_3d",
      outputKind: "walkthrough_preview",
      instruction: "Create an ultra-realistic four-panel architectural 3D walkthrough storyboard showing a logical path through the proposed space. Maintain identical geometry, materials, lighting, scale, and camera-height continuity across panels. Label it Conceptual walkthrough preview.",
    };
  }
  if (normalized.includes("concept plan") || normalized.includes("blueprint")) {
    return {
      entitlement: "concept_plans",
      outputKind: "concept_plan",
      instruction: "Create a clean preliminary architectural concept-plan sheet using only supplied measurements and constraints. Include an orthographic floor plan, supported dimension callouts, material legend, north arrow, code-review notes, and a title block labeled NOT FOR CONSTRUCTION. Do not invent dimensions, code compliance, or sealed engineering details.",
    };
  }
  return {
    entitlement: "shared_vision_rendering",
    outputKind: "rendering",
    instruction: "Create an ultra-realistic architectural construction visualization in natural daylight with physically plausible materials, scale, shadows, and site conditions. Preserve every stated measurement, constraint, and must-keep item.",
  };
}

export function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

export const Route = createFileRoute("/api/concept-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = bearerToken(request);
        if (!token) return new Response("Unauthorized", { status: 401 });

        const parsed = RequestBody.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Invalid concept id", { status: 400 });
        const { id } = parsed.data;

        const supabaseUrl = process.env.SUPABASE_URL;
        const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!supabaseUrl || !publishableKey) {
          return new Response("Server authentication is not configured", { status: 500 });
        }

        const userClient = createClient<Database>(supabaseUrl, publishableKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: claimsError } = await userClient.auth.getClaims(token);
        if (claimsError || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { getAiRuntimeConfig } = await import("@/lib/ai-gateway.server");
        let ai;
        try {
          ai = getAiRuntimeConfig();
        } catch (error) {
          return new Response(
            error instanceof Error ? error.message : "AI provider is not configured",
            { status: 500 },
          );
        }

        // Resolve the concept through the caller's RLS-scoped client first. The
        // service-role client is used only after tenant authorization succeeds.
        const { data: authorizedConcept, error: authorizationError } = await userClient
          .from("concept_requests")
          .select("*")
          .eq("id", id)
          .single();
        if (authorizationError || !authorizedConcept) {
          return new Response("Concept not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const concept = authorizedConcept;
        const profile = resolveConceptGenerationProfile(concept.title);

        // Enforce the exact paid deliverable boundary on the server. UI gating
        // is advisory only; direct API callers must pass this check as well.
        const entitlementResponse = await fetch(
          `${supabaseUrl}/rest/v1/rpc/has_entitlement`,
          {
            method: "POST",
            headers: {
              apikey: publishableKey,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ _feature_key: profile.entitlement }),
          },
        );
        if (!entitlementResponse.ok) {
          console.error("Entitlement check failed", entitlementResponse.status);
          return new Response("Unable to verify feature access", { status: 503 });
        }
        if ((await entitlementResponse.json()) !== true) {
          return new Response(
            `${profile.entitlement.replaceAll("_", " ")} subscription required`,
            { status: 403 },
          );
        }

        const prompt = [
          concept.prompt,
          concept.must_keep ? `Must keep: ${concept.must_keep}` : "",
          concept.requested_changes ? `Requested changes: ${concept.requested_changes}` : "",
          profile.instruction,
        ]
          .filter(Boolean)
          .join("\n\n");

        const upstream = await fetch(`${ai.baseURL}/images/generations`, {
          method: "POST",
          headers: {
            ...ai.headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: ai.imageModel,
            prompt,
            n: 1,
          }),
        });
        if (!upstream.ok) {
          const text = await upstream.text();
          console.error("AI image error", upstream.status, text);
          return new Response(text || "Image generation failed", { status: upstream.status });
        }
        const json = (await upstream.json()) as {
          data?: Array<{ b64_json?: string; url?: string }>;
        };
        const item = json.data?.[0];
        if (!item) return new Response("No image returned", { status: 500 });

        let buf: ArrayBuffer;
        if (item.b64_json) {
          const bin = atob(item.b64_json);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          buf = bytes.buffer;
        } else if (item.url) {
          const r = await fetch(item.url);
          buf = await r.arrayBuffer();
        } else {
          return new Response("Unsupported image payload", { status: 500 });
        }

        const path = `${concept.project_id}/${id}-${Date.now()}.png`;
        const { error: upErr } = await supabaseAdmin.storage.from("concepts").upload(path, buf, {
          contentType: "image/png",
          upsert: true,
        });
        if (upErr) return new Response(upErr.message, { status: 500 });

        await supabaseAdmin
          .from("concept_requests")
          .update({
            status: "generated",
            generated_image_path: path,
          })
          .eq("id", id);

        return Response.json({ storage_path: path, output_kind: profile.outputKind });
      },
    },
  },
});
