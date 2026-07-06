import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { Mic, Square, Loader2, Sparkles, Trash2, Play } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { transcribeVoiceNote } from "@/lib/voice.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SendCaptureButton } from "@/components/project/send-capture-button";

export function ProjectVoiceNotes({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const transcribeFn = useServerFn(transcribeVoiceNote);
  const notes = useQuery({
    queryKey: ["voice-notes", projectId],
    queryFn: async () =>
      (
        await supabase
          .from("voice_notes")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  const upload = useMutation({
    mutationFn: async ({ blob, mime, seconds }: { blob: Blob; mime: string; seconds: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = mime.includes("mp4") ? "mp4" : mime.includes("webm") ? "webm" : "wav";
      const path = `voice/${projectId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("field-photos").upload(path, blob, { contentType: mime });
      if (upErr) throw upErr;
      const { data: inserted, error } = await supabase
        .from("voice_notes")
        .insert({
          project_id: projectId,
          storage_path: path,
          created_by: user?.id,
          duration_seconds: seconds,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      return inserted.id as string;
    },
    onSuccess: async (id) => {
      qc.invalidateQueries({ queryKey: ["voice-notes", projectId] });
      toast.success("Voice note saved. Transcribing…");
      try {
        await transcribeFn({ data: { voice_note_id: id } });
        qc.invalidateQueries({ queryKey: ["voice-notes", projectId] });
        toast.success("Transcript ready.");
      } catch (e: any) {
        toast.error(`Transcription failed: ${e.message}`);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (n: any) => {
      await supabase.storage.from("field-photos").remove([n.storage_path]);
      await supabase.from("voice_notes").delete().eq("id", n.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["voice-notes", projectId] }),
  });

  const retranscribe = useMutation({
    mutationFn: async (id: string) => transcribeFn({ data: { voice_note_id: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["voice-notes", projectId] });
      toast.success("Transcript refreshed.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const seconds = Math.round((Date.now() - startRef.current) / 1000);
        if (blob.size < 2048) {
          toast.error("Recording too short — try again.");
          return;
        }
        upload.mutate({ blob, mime, seconds });
      };
      startRef.current = Date.now();
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch (e: any) {
      toast.error(`Mic access denied: ${e.message}`);
    }
  }

  function stopRecording() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="font-display flex items-center gap-2">
            <Mic className="h-5 w-5 text-gold" />
            Voice notes
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Record from the field. AI transcribes and drafts scope notes automatically.
          </p>
        </div>
        {recording ? (
          <Button size="lg" variant="destructive" onClick={stopRecording}>
            <Square className="mr-1 h-4 w-4" /> Stop {formatDur(elapsed)}
          </Button>
        ) : (
          <Button size="lg" onClick={startRecording} disabled={upload.isPending}>
            {upload.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Mic className="mr-1 h-4 w-4" />}
            {upload.isPending ? "Uploading…" : "Record"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {(notes.data ?? []).length === 0 ? (
          <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
            No voice notes yet. Tap Record to capture one from the field.
          </div>
        ) : (
          <div className="space-y-3">
            {notes.data!.map((n: any) => (
              <VoiceRow
                key={n.id}
                projectId={projectId}
                note={n}
                onDelete={() => remove.mutate(n)}
                onRetranscribe={() => retranscribe.mutate(n.id)}
                busy={retranscribe.isPending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VoiceRow({ projectId, note, onDelete, onRetranscribe, busy }: any) {
  const [url, setUrl] = useState<string | null>(null);
  async function playAudio() {
    if (url) return;
    const { data } = await supabase.storage.from("field-photos").createSignedUrl(note.storage_path, 600);
    if (data?.signedUrl) setUrl(data.signedUrl);
  }
  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {new Date(note.created_at).toLocaleString()}
            </Badge>
            {note.duration_seconds ? (
              <span className="text-xs text-muted-foreground">{formatDur(note.duration_seconds)}</span>
            ) : null}
          </div>
          {note.summary ? (
            <p className="mt-2 text-sm font-medium">{note.summary}</p>
          ) : note.transcript ? null : (
            <p className="mt-2 text-xs text-muted-foreground italic">Transcribing…</p>
          )}
          {note.transcript && (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-muted-foreground">Transcript</summary>
              <p className="mt-1 whitespace-pre-wrap text-xs">{note.transcript}</p>
            </details>
          )}
          {note.scope_notes && (
            <div className="mt-2 rounded bg-muted p-2">
              <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gold">
                <Sparkles className="h-3 w-3" /> Scope draft
              </div>
              <p className="whitespace-pre-wrap text-xs">{note.scope_notes}</p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          {url ? (
            <audio controls src={url} className="h-8 w-32" />
          ) : (
            <Button variant="ghost" size="sm" onClick={playAudio}>
              <Play className="h-3 w-3" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onRetranscribe} disabled={busy}>
            <Sparkles className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
          <SendCaptureButton
            projectId={projectId}
            source={{ voice_note_ids: [note.id] }}
            label="Send"
            size="sm"
            variant="outline"
          />
        </div>
      </div>
    </div>
  );
}

function formatDur(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
