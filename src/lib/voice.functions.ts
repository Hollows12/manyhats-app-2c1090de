import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TranscribeInput = z.object({
  voice_note_id: z.string().uuid(),
});

/**
 * Transcribe + summarize a voice note stored in the `field-photos` bucket
 * (path `voice/<project>/<file>`). Uses Lovable AI STT + a follow-up
 * summarization pass. Writes transcript + summary back to voice_notes.
 */
export const transcribeVoiceNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TranscribeInput.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { supabase } = context;
    const { data: note, error: noteErr } = await supabase
      .from("voice_notes")
      .select("id, storage_path, project_id")
      .eq("id", data.voice_note_id)
      .single();
    if (noteErr || !note || !note.storage_path) throw new Error("Voice note not found");
    const storagePath: string = note.storage_path;

    // Download audio (bucket 'field-photos', or fallback voice-notes)
    const bucket = "field-photos";
    const { data: signed } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 300);
    if (!signed?.signedUrl) throw new Error("Could not sign audio URL");
    const audioRes = await fetch(signed.signedUrl);
    if (!audioRes.ok) throw new Error("Could not fetch audio");
    const audioBlob = await audioRes.blob();

    // 1. STT
    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    const ext = storagePath.split(".").pop() || "webm";
    form.append("file", audioBlob, `voice.${ext}`);
    const sttRes = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!sttRes.ok) {
      throw new Error(`Transcription failed: ${sttRes.status} ${await sttRes.text().catch(() => "")}`);
    }
    const sttJson = (await sttRes.json()) as { text?: string };
    const transcript = (sttJson.text ?? "").trim();

    // 2. Summarize + scope draft (single chat call, returns JSON)
    let summary = "";
    let scope_notes = "";
    if (transcript.length > 5) {
      const chatRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You convert a contractor's raw voice note from the field into structured project notes for ManyHats Construction LLC. Return JSON: { \"summary\": string (2-3 sentences), \"scope_notes\": string (clean bullet-style scope language, one item per line, contractor-grade, no pricing). Never invent measurements.",
            },
            { role: "user", content: `Field voice note transcript:\n\n${transcript}` },
          ],
        }),
      });
      if (chatRes.ok) {
        const j = (await chatRes.json()) as any;
        try {
          const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
          summary = String(parsed.summary ?? "");
          scope_notes = String(parsed.scope_notes ?? "");
        } catch { /* ignore */ }
      }
    }

    await supabase
      .from("voice_notes")
      .update({ transcript, summary, scope_notes })
      .eq("id", note.id);

    return { transcript, summary, scope_notes };
  });
