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

const Input = z.object({
  project_id: z.string().uuid(),
  photo_ids: z.array(z.string().uuid()).default([]),
  voice_note_ids: z.array(z.string().uuid()).default([]),
  target: Target,
  polish: z.boolean().default(false),
});

const TARGET_LABEL: Record<TargetT, string> = {
  estimate_notes: "Estimate notes",
  proposal_scope_of_work: "Proposal · Scope of work",
  proposal_existing_conditions: "Proposal · Existing conditions",
  proposal_executive_summary: "Proposal · Executive summary",
  proposal_recommendation: "Proposal · Recommendation",
};

/**
 * Route captured field content (photo captions + voice transcripts) into a
 * project's estimate notes or a proposal section. Optionally AI-polish it
 * into client-ready contractor-grade wording. Always APPENDS with a
 * timestamped divider — never overwrites.
 */
export const sendCaptureToTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.photo_ids.length === 0 && data.voice_note_ids.length === 0) {
      throw new Error("Select at least one photo or voice note.");
    }

    // --- Gather source content ---
    const photoLines: string[] = [];
    if (data.photo_ids.length) {
      const { data: photos, error } = await supabase
        .from("project_photos")
        .select("id, caption, phase, tags, captured_at")
        .in("id", data.photo_ids)
        .eq("project_id", data.project_id);
      if (error) throw new Error(error.message);
      for (const p of photos ?? []) {
        const tagBits = [
          p.phase ? `[${p.phase}]` : null,
          (p.tags ?? []).length ? `[${(p.tags ?? []).join(", ")}]` : null,
        ].filter(Boolean).join(" ");
        const cap = (p.caption ?? "").trim() || "(no caption)";
        photoLines.push(`Photo${tagBits ? " " + tagBits : ""}: ${cap}`);
      }
    }

    const voiceLines: string[] = [];
    if (data.voice_note_ids.length) {
      const { data: notes, error } = await supabase
        .from("voice_notes")
        .select("id, transcript, summary, scope_notes")
        .in("id", data.voice_note_ids)
        .eq("project_id", data.project_id);
      if (error) throw new Error(error.message);
      for (const n of notes ?? []) {
        const chosen =
          (n.scope_notes && n.scope_notes.trim()) ||
          (n.summary && n.summary.trim()) ||
          (n.transcript && n.transcript.trim()) ||
          "";
        if (chosen) voiceLines.push(`Voice note:\n${chosen}`);
      }
    }

    const rawText = [...photoLines, ...voiceLines].join("\n\n").trim();
    if (!rawText) {
      throw new Error(
        "Selected items had no captured text yet. Add captions or wait for transcription to finish.",
      );
    }

    // --- Optional AI polish for client-ready wording ---
    let bodyText = rawText;
    let polishedNote = "";
    if (data.polish) {
      const key = process.env.LOVABLE_API_KEY;
      if (!key) throw new Error("Missing LOVABLE_API_KEY");
      const label = TARGET_LABEL[data.target];
      const system = `You are the proposal writer for ManyHats Construction LLC (veteran-owned; Mike Canter, CEO; 740-600-1374).
Convert raw field capture (photo tags + captions, voice transcripts, scope notes) into a client-ready "${label}" section.
Rules:
- Contractor-grade, protective wording.
- Never invent dimensions, measurements, quantities, brand names, or pricing.
- Do not promise anything not supported by the field notes.
- Plain text only — no markdown headers, no code fences.
- Keep it tight: 3–6 sentences, or short bullet lines if the section reads better as a list.`;
      const chatRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
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
      const j = (await chatRes.json()) as any;
      const polished = String(j?.choices?.[0]?.message?.content ?? "").trim();
      if (polished) {
        bodyText = polished;
        polishedNote = " · AI polished";
      }
    }

    // --- Write to destination (append, never overwrite) ---
    const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
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
      const next = `${(est.notes ?? "").trim()}${divider}${bodyText}`.trim();
      const { error } = await supabase.from("estimates").update({ notes: next }).eq("id", est.id);
      if (error) throw new Error(error.message);
      return { ok: true, target: TARGET_LABEL[data.target], polished: data.polish };
    }

    // Proposal targets
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

    const existing = String(((prop as any)[col] as string | null | undefined) ?? "").trim();
    const next = `${existing}${divider}${bodyText}`.trim();
    const { error } = await (supabase as any)
      .from("proposals")
      .update({ [col]: next })
      .eq("id", (prop as any).id);
    if (error) throw new Error(error.message);

    return { ok: true, target: TARGET_LABEL[data.target], polished: data.polish };
  });
