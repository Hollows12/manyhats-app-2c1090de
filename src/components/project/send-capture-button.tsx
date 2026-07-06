import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, Loader2, Sparkles } from "lucide-react";
import { sendCaptureToTarget } from "@/lib/capture-router.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

type Target =
  | "estimate_notes"
  | "proposal_scope_of_work"
  | "proposal_existing_conditions"
  | "proposal_executive_summary"
  | "proposal_recommendation";

const OPTIONS: {
  value: Target; label: string; hint: string; defaultPolish: boolean;
}[] = [
  { value: "estimate_notes",                label: "Estimate notes",                 hint: "Internal — appends raw capture to the latest estimate's notes.",   defaultPolish: false },
  { value: "proposal_scope_of_work",        label: "Proposal · Scope of work",       hint: "Contractor-grade scope wording, appended to the proposal.",         defaultPolish: true  },
  { value: "proposal_existing_conditions",  label: "Proposal · Existing conditions", hint: "What we observed on site — client-facing.",                         defaultPolish: true  },
  { value: "proposal_executive_summary",    label: "Proposal · Executive summary",   hint: "Client-facing overview at the top of the proposal.",                defaultPolish: true  },
  { value: "proposal_recommendation",       label: "Proposal · Recommendation",      hint: "Client-facing recommendation section.",                             defaultPolish: true  },
];

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
  const [target, setTarget] = useState<Target>("proposal_scope_of_work");
  const [polish, setPolish] = useState(true);
  const [busy, setBusy] = useState(false);
  const sendFn = useServerFn(sendCaptureToTarget);

  const opt = OPTIONS.find((o) => o.value === target)!;

  function onTargetChange(v: string) {
    const next = v as Target;
    setTarget(next);
    const o = OPTIONS.find((x) => x.value === next);
    if (o) setPolish(o.defaultPolish);
  }

  async function submit() {
    setBusy(true);
    try {
      const r = await sendFn({
        data: {
          project_id: projectId,
          photo_ids: source.photo_ids ?? [],
          voice_note_ids: source.voice_note_ids ?? [],
          target,
          polish,
        },
      });
      toast.success(`Sent to ${r.target}${r.polished ? " (client-ready)" : ""}.`);
      qc.invalidateQueries({ queryKey: ["proposal", projectId] });
      qc.invalidateQueries({ queryKey: ["estimate", projectId] });
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }}>
      <DialogTrigger asChild>
        <Button size={size} variant={variant} title="Send this capture to estimate/proposal">
          <Send className={iconOnly ? "h-3 w-3" : "mr-1 h-3 w-3"} />
          {!iconOnly && label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Send className="h-4 w-4 text-gold" /> Send capture to…
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Destination</Label>
            <Select value={target} onValueChange={onTargetChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
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
          <p className="text-[11px] text-muted-foreground">
            Content is <strong>appended</strong> to the destination with a timestamped divider.
            Nothing is overwritten. AI polish never invents measurements, quantities, or pricing.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
            {busy ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
