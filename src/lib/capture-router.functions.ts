import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Target = z.enum([
  "estimate_notes",
  "proposal_scope_of_work",
  "proposal_existing_conditions",
  "proposal_executive_summary",
  "proposal_recommendation",
]);
type TargetT = z.infer<typeof Target>;

const SourceInput = z.object({
  project_id: z.string().uuid(),
  photo_ids: z.array(z.string().uuid()).default([]),
  voice_note_ids: z.array(z.string().uuid()).default([]),
});

const PreviewInput = SourceInput.extend({
  target: Target,
  polish: z.boolean().default(false),
});

const SendInput = PreviewInput.extend({
  body_text: z.string().trim().min(1, "Preview text is required."),
});

const TARGET_LABEL: Record<TargetT, string> = {
  estimate_notes: "Estimate notes",
  proposal_scope_of_work: "Proposal · Scope of work",
  proposal_existing_conditions: "Proposal · Existing conditions",
  proposal_executive_summary: "Proposal · Executive summary",
  proposal_recommendation: "Proposal · Recommendation",
};

type SupabaseError = { message: string };
type PhotoRow = {
  id: string;
  caption: string | null;
  phase: string | null;
  tags: string[] | null;
  captured_at: string | null;
  storage_path: string | null;
};
type VoiceRow = {
  id: string;
  transcript: string | null;
  summary: string | null;
  scope_notes: string | null;
  created_at: string | null;
  duration_seconds: number | null;
  storage_path: string | null;
};
type EstimateRow = { id: string; notes: string | null };
type ProposalRow = {
  id: string;
  scope_of_work?: string | null;
  existing_conditions?: string | null;
  executive_summary?: string | null;
  recommendation?: string | null;
};
type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (
        column: string,
        values: string[],
      ) => {
        eq: (
          column: string,
          value: string,
        ) => Promise<{ data: unknown[] | null; error: SupabaseError | null }>;
      };
      eq: (
        column: string,
        value: string,
      ) => {
        order: (
          column: string,
          opts: { ascending: boolean },
        ) => {
          limit: (value: number) => {
            maybeSingle: () => Promise<{ data: unknown | null; error: SupabaseError | null }>;
          };
        };
      };
    };
    update: (value: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: SupabaseError | null }>;
    };
  };
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        expiresIn: number,
      ) => Promise<{ data: { signedUrl?: string } | null }>;
    };
  };
};

async function retrieveCaptureContent(supabase: SupabaseLike, data: z.infer<typeof SourceInput>) {
  if (data.photo_ids.length === 0 && data.voice_note_ids.length === 0) {
    throw new Error("Select at least one photo or voice note.");
  }

  let photos: PhotoRow[] = [];
  if (data.photo_ids.length) {
    const { data: rows, error } = await supabase
      .from("project_photos")
      .select("id, caption, phase, tags, captured_at, storage_path")
      .in("id", data.photo_ids)
      .eq("project_id", data.project_id);
    if (error) throw new Error(error.message);
    photos = (rows ?? []) as PhotoRow[];
  }

  let notes: VoiceRow[] = [];
  if (data.voice_note_ids.length) {
    const { data: rows, error } = await supabase
      .from("voice_notes")
      .select("id, transcript, summary, scope_notes, created_at, duration_seconds, storage_path")
      .in("id", data.voice_note_ids)
      .eq("project_id", data.project_id);
    if (error) throw new Error(error.message);
    notes = (rows ?? []) as VoiceRow[];
  }

  const photoLines: string[] = [];
  for (const p of photos) {
    const tagBits = [
      p.phase ? `[${p.phase}]` : null,
      (p.tags ?? []).length ? `[${(p.tags ?? []).join(", ")}]` : null,
    ]
      .filter(Boolean)
      .join(" ");
    const cap = (p.caption ?? "").trim() || "(no caption)";
    photoLines.push(`Photo${tagBits ? ` ${tagBits}` : ""}: ${cap}`);
  }

  const voiceLines: string[] = [];
  for (const n of notes) {
    const chosen =
      (n.scope_notes && n.scope_notes.trim()) ||
      (n.summary && n.summary.trim()) ||
      (n.transcript && n.transcript.trim()) ||
      "";
    if (chosen) voiceLines.push(`Voice note:\n${chosen}`);
  }

  const rawText = [...photoLines, ...voiceLines].join("\n\n").trim();
  if (!rawText) {
    throw new Error(
      "Selected items had no captured text yet. Add captions or wait for transcription to finish.",
    );
  }

  const photoPathToUrl: Record<string, string> = {};
  for (const p of photos) {
    if (!p.storage_path) continue;
    const { data: signed } = await supabase.storage
      .from("field-photos")
      .createSignedUrl(p.storage_path, 1800);
    if (signed?.signedUrl) photoPathToUrl[p.storage_path] = signed.signedUrl;
  }

  const voicePathToUrl: Record<string, string> = {};
  for (const n of notes) {
    if (!n.storage_path) continue;
    const { data: signed } = await supabase.storage
      .from("field-photos")
      .createSignedUrl(n.storage_path, 1800);
    if (signed?.signedUrl) voicePathToUrl[n.storage_path] = signed.signedUrl;
  }

  return {
    rawText,
    photos: photos.map((p) => ({
      id: p.id as string,
      caption: p.caption as string | null,
      phase: p.phase as string | null,
      tags: (p.tags ?? []) as string[],
      captured_at: p.captured_at as string | null,
      signed_url: (p.storage_path ? photoPathToUrl[p.storage_path] : null) ?? null,
    })),
    voiceNotes: notes.map((n) => ({
      id: n.id as string,
      summary: n.summary as string | null,
      transcript: n.transcript as string | null,
      scope_notes: n.scope_notes as string | null,
      created_at: n.created_at as string | null,
      duration_seconds: n.duration_seconds as number | null,
      signed_url: (n.storage_path ? voicePathToUrl[n.storage_path] : null) ?? null,
    })),
  };
}

async function formatCaptureWithAi(rawText: string, target: TargetT) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const label = TARGET_LABEL[target];
  const system = `You are the proposal writer for ManyHats Construction LLC (veteran-owned; Mike Canter, CEO; 740-600-1374).
Convert raw field capture (photo tags + captions, voice transcripts, scope notes) into a client-ready "${label}" section.
Rules:
- Improve grammar, readability, contractor wording, and paragraph organization.
- Never invent dimensions, measurements, quantities, brand names, pricing, materials, warranties, or scope details.
- Do not promise anything not supported by the field notes.
- Plain text only — no markdown headers, no code fences.
- Keep it tight: 3–6 sentences, or short bullet lines if the section reads better as a list.`;

  const chatRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Section: ${label}\n\nRaw field capture:\n\n${rawText}` },
      ],
    }),
  });
  if (!chatRes.ok) {
    const errText = await chatRes.text().catch(() => "");
    throw new Error(`AI polish failed (${chatRes.status}): ${errText.slice(0, 200)}`);
  }

  const json = (await chatRes.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return String(json.choices?.[0]?.message?.content ?? "").trim();
}

async function appendCaptureToTarget(
  supabase: SupabaseLike,
  data: z.infer<typeof SendInput>,
  bodyText: string,
) {
  const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
  const polishedNote = data.polish ? " · AI polished" : "";
  const divider = `\n\n--- From field capture · ${stamp}${polishedNote} ---\n`;

  if (data.target === "estimate_notes") {
    const { data: est, error: qErr } = await supabase
      .from("estimates")
      .select("id, notes")
      .eq("project_id", data.project_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (qErr) throw new Error(qErr.message);
    if (!est) throw new Error("No estimate on this project yet. Create one first, then send.");
    const estimate = est as EstimateRow;

    const next = `${(estimate.notes ?? "").trim()}${divider}${bodyText}`.trim();
    const { error } = await supabase
      .from("estimates")
      .update({ notes: next })
      .eq("id", estimate.id);
    if (error) throw new Error(error.message);
    return;
  }

  const col = data.target.replace(/^proposal_/, "") as
    | "scope_of_work"
    | "existing_conditions"
    | "executive_summary"
    | "recommendation";

  const { data: prop, error: pErr } = await supabase
    .from("proposals")
    .select(`id, ${col}`)
    .eq("project_id", data.project_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!prop) throw new Error("No proposal on this project yet. Create one first, then send.");
  const proposal = prop as ProposalRow;

  const existing = String(proposal[col] ?? "").trim();
  const next = `${existing}${divider}${bodyText}`.trim();
  const { error } = await supabase
    .from("proposals")
    .update({ [col]: next })
    .eq("id", proposal.id);
  if (error) throw new Error(error.message);
}

export const generateCapturePreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PreviewInput.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;

    const source = await retrieveCaptureContent(supabase, data);

    let clientReadyText: string | null = null;
    if (data.polish) {
      clientReadyText = await formatCaptureWithAi(source.rawText, data.target);
    }

    return {
      target: data.target,
      targetLabel: TARGET_LABEL[data.target],
      polish: data.polish,
      generatedAt: new Date().toISOString(),
      originalText: source.rawText,
      clientReadyText,
      previewText: clientReadyText || source.rawText,
      photos: source.photos,
      voiceNotes: source.voiceNotes,
    };
  });

export const sendCaptureToTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SendInput.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;

    // Validate selected capture source before append.
    await retrieveCaptureContent(supabase, data);

    await appendCaptureToTarget(supabase, data, data.body_text.trim());
    return { ok: true, target: TARGET_LABEL[data.target], polished: data.polish };
  });
