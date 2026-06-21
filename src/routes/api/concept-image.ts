import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/concept-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { id } = (await request.json()) as { id: string };
        if (!id) return new Response("Missing id", { status: 400 });
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: concept, error } = await supabaseAdmin
          .from("concept_requests").select("*").eq("id", id).single();
        if (error || !concept) return new Response("Concept not found", { status: 404 });

        const prompt = [
          concept.prompt,
          concept.must_keep ? `Must keep: ${concept.must_keep}` : "",
          concept.requested_changes ? `Requested changes: ${concept.requested_changes}` : "",
          "Photorealistic architectural / construction concept rendering. Daylight. Clean composition.",
        ].filter(Boolean).join("\n\n");

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: {
            "Lovable-API-Key": key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-pro-image-preview",
            prompt,
            n: 1,
          }),
        });
        if (!upstream.ok) {
          const text = await upstream.text();
          console.error("AI image error", upstream.status, text);
          return new Response(text || "Image generation failed", { status: upstream.status });
        }
        const json = (await upstream.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
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
          contentType: "image/png", upsert: true,
        });
        if (upErr) return new Response(upErr.message, { status: 500 });

        await supabaseAdmin.from("concept_requests").update({
          status: "generated", generated_image_path: path,
        }).eq("id", id);

        return Response.json({ storage_path: path });
      },
    },
  },
});
