import { useState } from "react";
import { Loader2, Send, Sparkles, FileText, MapPin, Camera } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export type PreviewPhoto = { id: string; url: string; caption?: string | null };

export interface PreviewSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "Client portal", "Job file for John Smith", "Estimate v2 to client@site.com" */
  destination: string;
  /** Kind label shown in the header, e.g. "Estimate", "Proposal", "Capture" */
  kind: string;
  /** Raw / original human-entered content */
  originalContent: string;
  /** AI-polished content (optional). If provided, a Polished tab is available. */
  polishedContent?: string | null;
  /** Photos to be included */
  photos?: PreviewPhoto[];
  /** Text of the confirm button, default "Send". */
  confirmLabel?: string;
  /** Called with `usePolished` flag when the user confirms. */
  onConfirm: (opts: { usePolished: boolean }) => Promise<void> | void;
}

export function PreviewSendDialog({
  open, onOpenChange, destination, kind, originalContent,
  polishedContent, photos = [], confirmLabel = "Send", onConfirm,
}: PreviewSendDialogProps) {
  const hasPolished = !!polishedContent && polishedContent.trim().length > 0;
  const [tab, setTab] = useState<"original" | "polished">(hasPolished ? "polished" : "original");
  const [sending, setSending] = useState(false);

  async function handleConfirm() {
    setSending(true);
    try {
      await onConfirm({ usePolished: tab === "polished" && hasPolished });
      onOpenChange(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <FileText className="h-4 w-4 text-gold" /> Preview {kind.toLowerCase()} before sending
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-xs">
            <MapPin className="h-3 w-3" /> <span className="font-medium text-foreground">{destination}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "original" | "polished")}>
            <TabsList>
              <TabsTrigger value="original">Original</TabsTrigger>
              {hasPolished && (
                <TabsTrigger value="polished">
                  <Sparkles className="mr-1 h-3 w-3" /> AI polished
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="original" className="mt-3">
              <ContentBox text={originalContent} />
            </TabsContent>
            {hasPolished && (
              <TabsContent value="polished" className="mt-3">
                <ContentBox text={polishedContent!} />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  AI-polished for tone only. It won't invent measurements, quantities,
                  pricing, materials, warranties, or scope beyond what you captured.
                </p>
              </TabsContent>
            )}
          </Tabs>

          {photos.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Camera className="h-3 w-3" /> Photos <Badge variant="outline">{photos.length}</Badge>
              </div>
              <ScrollArea className="h-32 rounded-md border">
                <div className="flex gap-2 p-2">
                  {photos.map((p) => (
                    <figure key={p.id} className="w-24 shrink-0">
                      <img
                        src={p.url}
                        alt={p.caption ?? ""}
                        className="h-20 w-24 rounded object-cover"
                      />
                      {p.caption && (
                        <figcaption className="mt-1 truncate text-[10px] text-muted-foreground">
                          {p.caption}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={sending} className="bg-gold text-gold-foreground hover:bg-gold/90">
            {sending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContentBox({ text }: { text: string }) {
  return (
    <div className="max-h-64 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
      {text?.trim() ? text : <span className="italic text-muted-foreground">(no content)</span>}
    </div>
  );
}
