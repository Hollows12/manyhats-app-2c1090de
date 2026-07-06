import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, Loader2, Sparkles, ImageIcon, Mic, RefreshCw } from "lucide-react";
import { generateCapturePreview, sendCaptureToTarget } from "@/lib/capture-router.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Target =
  | "estimate_notes"
  | "proposal_scope_of_work"
  | "proposal_existing_conditions"
  | "proposal_executive_summary"
  | "proposal_recommendation";

const OPTIONS: {
  value: Target;
  label: string;
  hint: string;
  defaultPolish: boolean;
}[] = [
  {
    value: "estimate_notes",
    label: "Estimate notes",
    hint: "Internal — appends raw capture to the latest estimate's notes.",
    defaultPolish: false,
  },
  {
    value: "proposal_scope_of_work",
    label: "Proposal · Scope of work",
    hint: "Contractor-grade scope wording, appended to the proposal.",
    defaultPolish: true,
  },
  {
    value: "proposal_existing_conditions",
    label: "Proposal · Existing conditions",
    hint: "What we observed on site — client-facing.",
    defaultPolish: true,
  },
  {
    value: "proposal_executive_summary",
    label: "Proposal · Executive summary",
    hint: "Client-facing overview at the top of the proposal.",
    defaultPolish: true,
  },
  {
    value: "proposal_recommendation",
    label: "Proposal · Recommendation",
    hint: "Client-facing recommendation section.",
    defaultPolish: true,
  },
];

type PreviewData = {
  target: Target;
  targetLabel: string;
  polish: boolean;
  generatedAt: string;
  originalText: string;
  clientReadyText: string | null;
  previewText: string;
  photos: Array<{
    id: string;
    caption: string | null;
    phase: string | null;
    tags: string[];
    captured_at: string | null;
    signed_url: string | null;
  }>;
  voiceNotes: Array<{
    id: string;
    summary: string | null;
    transcript: string | null;
    scope_notes: string | null;
    created_at: string | null;
    duration_seconds: number | null;
    signed_url: string | null;
  }>;
};

function cacheKey(target: Target, polish: boolean, photoIds: string[], voiceNoteIds: string[]) {
  return [
    target,
    polish ? "1" : "0",
    [...photoIds].sort().join(","),
    [...voiceNoteIds].sort().join(","),
  ].join("|");
}

export function SendCaptureButton({
  projectId,
  source,
  label = "Send to…",
  size = "sm",
  variant = "outline",
  iconOnly = false,
}: {
  projectId: string;
  source: { photo_ids?: string[]; voice_note_ids?: string[] };
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
  iconOnly?: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"setup" | "preview">("setup");
  const [target, setTarget] = useState<Target>("proposal_scope_of_work");
  const [polish, setPolish] = useState(true);
  const [photoIds, setPhotoIds] = useState<string[]>(source.photo_ids ?? []);
  const [voiceNoteIds, setVoiceNoteIds] = useState<string[]>(source.voice_note_ids ?? []);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewText, setPreviewText] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const cacheRef = useRef<Record<string, { preview: PreviewData; editedText: string }>>({});

  const sendFn = useServerFn(sendCaptureToTarget);
  const previewFn = useServerFn(generateCapturePreview);

  const opt = OPTIONS.find((o) => o.value === target)!;
  const activeKey = useMemo(
    () => cacheKey(target, polish, photoIds, voiceNoteIds),
    [target, polish, photoIds, voiceNoteIds],
  );

  function onTargetChange(v: string) {
    const next = v as Target;
    setTarget(next);
    const o = OPTIONS.find((x) => x.value === next);
    if (o) setPolish(o.defaultPolish);
  }

  async function loadPreview(args?: {
    nextTarget?: Target;
    nextPolish?: boolean;
    nextPhotoIds?: string[];
    nextVoiceNoteIds?: string[];
    forceRegenerate?: boolean;
  }) {
    const nextTarget = args?.nextTarget ?? target;
    const nextPolish = args?.nextPolish ?? polish;
    const nextPhotoIds = args?.nextPhotoIds ?? photoIds;
    const nextVoiceNoteIds = args?.nextVoiceNoteIds ?? voiceNoteIds;
    const forceRegenerate = args?.forceRegenerate ?? false;

    if (nextPhotoIds.length === 0 && nextVoiceNoteIds.length === 0) {
      toast.error("Select at least one photo or voice note.");
      return;
    }

    const key = cacheKey(nextTarget, nextPolish, nextPhotoIds, nextVoiceNoteIds);
    const cached = cacheRef.current[key];
    if (cached && !forceRegenerate) {
      setPreview(cached.preview);
      setPreviewText(cached.editedText);
      setStep("preview");
      return;
    }

    setLoadingPreview(true);
    try {
      const result = (await previewFn({
        data: {
          project_id: projectId,
          photo_ids: nextPhotoIds,
          voice_note_ids: nextVoiceNoteIds,
          target: nextTarget,
          polish: nextPolish,
        },
      })) as PreviewData;

      setPreview(result);
      setPreviewText(result.previewText);
      cacheRef.current[key] = { preview: result, editedText: result.previewText };
      setStep("preview");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setLoadingPreview(false);
    }
  }

  function rememberDraft() {
    if (!preview) return;
    cacheRef.current[activeKey] = { preview, editedText: previewText };
  }

  async function togglePolishInPreview(next: boolean) {
    setPolish(next);
    await loadPreview({ nextPolish: next });
  }

  async function removePhoto(id: string) {
    const next = photoIds.filter((x) => x !== id);
    setPhotoIds(next);
    if (step === "preview") await loadPreview({ nextPhotoIds: next });
  }

  async function removeVoiceNote(id: string) {
    const next = voiceNoteIds.filter((x) => x !== id);
    setVoiceNoteIds(next);
    if (step === "preview") await loadPreview({ nextVoiceNoteIds: next });
  }

  async function submit() {
    if (!previewText.trim()) {
      toast.error("Preview text cannot be empty.");
      return;
    }

    setSending(true);
    try {
      const r = await sendFn({
        data: {
          project_id: projectId,
          photo_ids: photoIds,
          voice_note_ids: voiceNoteIds,
          target,
          polish,
          body_text: previewText,
        },
      });

      toast.success(`Sent to ${r.target}${r.polished ? " (client-ready)" : ""}.`);
      qc.invalidateQueries({ queryKey: ["proposal", projectId] });
      qc.invalidateQueries({ queryKey: ["estimate", projectId] });
      setOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  const busy = loadingPreview || sending;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        <Button size={size} variant={variant} title="Send this capture to estimate/proposal">
          <Send className={iconOnly ? "h-3 w-3" : "mr-1 h-3 w-3"} />
          {!iconOnly && label}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[92vh] w-[95vw] max-w-3xl overflow-hidden p-0 sm:w-full">
        <DialogHeader className="bg-navy px-4 py-3 text-ivory">
          <DialogTitle className="font-display flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-gold" />
            Preview Before Send
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
          {step === "setup" ? (
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Destination</Label>
                <Select value={target} onValueChange={onTargetChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-muted-foreground">{opt.hint}</p>
              </div>

              <div className="flex items-center gap-2 rounded-md border p-2">
                <Switch id="polish-toggle" checked={polish} onCheckedChange={setPolish} />
                <Label htmlFor="polish-toggle" className="text-xs flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-gold" /> AI polish (client-ready wording)
                </Label>
              </div>

              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                No database writes happen until you press Send.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Destination
                  </p>
                  <p className="text-sm font-medium">{preview?.targetLabel ?? opt.label}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Timestamp
                  </p>
                  <p className="text-sm font-medium">
                    {preview?.generatedAt ? new Date(preview.generatedAt).toLocaleString() : "—"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
                <Switch
                  id="preview-polish-toggle"
                  checked={polish}
                  onCheckedChange={(v) => {
                    void togglePolishInPreview(v);
                  }}
                  disabled={loadingPreview}
                />
                <Label htmlFor="preview-polish-toggle" className="text-xs flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-gold" /> AI Polish {polish ? "ON" : "OFF"}
                </Label>
                {polish ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadPreview({ forceRegenerate: true })}
                    disabled={loadingPreview}
                  >
                    {loadingPreview ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-3 w-3" />
                    )}
                    Regenerate
                  </Button>
                ) : null}
              </div>

              {loadingPreview && !preview ? (
                <div className="flex items-center justify-center rounded-md border py-10 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating preview…
                </div>
              ) : null}

              {preview ? (
                <>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Original captured content
                    </p>
                    <Textarea
                      value={preview.originalText}
                      readOnly
                      className="min-h-[130px] text-xs"
                    />
                  </div>

                  {polish ? (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Client-ready version
                      </p>
                      <Textarea
                        value={preview.clientReadyText ?? ""}
                        readOnly
                        className="min-h-[130px] text-xs"
                      />
                    </div>
                  ) : null}

                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Edit before send
                    </p>
                    <Textarea
                      value={previewText}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setPreviewText(nextValue);
                        if (preview) {
                          cacheRef.current[activeKey] = { preview, editedText: nextValue };
                        }
                      }}
                      className="min-h-[130px] text-sm"
                      disabled={loadingPreview}
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Attached photos
                    </p>
                    {preview.photos.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No photos attached.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {preview.photos.map((p) => (
                          <div key={p.id} className="rounded-md border p-2">
                            {p.signed_url ? (
                              <img
                                src={p.signed_url}
                                alt={p.caption ?? "Attached photo"}
                                className="mb-2 h-28 w-full rounded object-cover"
                              />
                            ) : (
                              <div className="mb-2 flex h-28 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                                <ImageIcon className="mr-1 h-3 w-3" /> Image unavailable
                              </div>
                            )}
                            <p className="line-clamp-2 text-xs">{p.caption || "(no caption)"}</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="mt-1"
                              onClick={() => {
                                void removePhoto(p.id);
                              }}
                              disabled={loadingPreview}
                            >
                              Remove photo
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Attached voice notes
                    </p>
                    {preview.voiceNotes.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No voice notes attached.</p>
                    ) : (
                      <div className="space-y-2">
                        {preview.voiceNotes.map((n) => (
                          <div key={n.id} className="rounded-md border p-2">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mic className="h-3 w-3 text-gold" />
                              {n.created_at
                                ? new Date(n.created_at).toLocaleString()
                                : "Voice note"}
                              {n.duration_seconds ? (
                                <Badge variant="outline" className="ml-1 text-[10px]">
                                  {formatDur(n.duration_seconds)}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-xs">
                              {n.scope_notes || n.summary || n.transcript || "(no text yet)"}
                            </p>
                            {n.signed_url ? (
                              <audio controls src={n.signed_url} className="mt-2 h-8 w-full" />
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="mt-1"
                              onClick={() => {
                                void removeVoiceNote(n.id);
                              }}
                              disabled={loadingPreview}
                            >
                              Remove voice note
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter className="border-t px-4 py-3">
          {step === "setup" ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={() => loadPreview()} disabled={busy}>
                {loadingPreview ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1 h-4 w-4" />
                )}
                Preview Before Send
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("setup")} disabled={busy}>
                ← Back
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  rememberDraft();
                  setOpen(false);
                  toast.success("Draft saved.");
                }}
                disabled={busy}
              >
                Save Draft
              </Button>
              <Button onClick={submit} disabled={busy || !previewText.trim()}>
                {sending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1 h-4 w-4" />
                )}
                Send to Proposal / Estimate
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatDur(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
