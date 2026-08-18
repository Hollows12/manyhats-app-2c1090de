import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkles, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { CONCEPT_DISCLAIMER } from "@/lib/manyhats";

export function ProjectConcepts({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["concepts", projectId],
    queryFn: async () => (await supabase.from("concept_requests").select("*").eq("project_id", projectId).order("created_at", { ascending: false })).data ?? [],
  });
  const [open, setOpen] = useState(false);

  const create = useMutation({
    mutationFn: async (vals: any) => { await supabase.from("concept_requests").insert({ ...vals, project_id: projectId }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["concepts", projectId] }); setOpen(false); toast.success("Concept request saved."); },
  });

  return (
    <div className="space-y-4">
      <Card className="border-gold/40 bg-gold/5">
        <CardContent className="p-4 text-xs text-foreground/80">
          <strong>Important:</strong> {CONCEPT_DISCLAIMER}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4"/>New concept request</Button></DialogTrigger>
          <ConceptDialog onSubmit={(v) => create.mutate(v)} />
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(list.data ?? []).map((c: any) => <ConceptCard key={c.id} concept={c} />)}
        {(list.data ?? []).length === 0 && (
          <div className="md:col-span-2 rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            No concept requests yet. Create one to capture must-keep / requested-changes for client-facing renderings.
          </div>
        )}
      </div>
    </div>
  );
}

function ConceptCard({ concept }: { concept: any }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  if (concept.generated_image_path && !imgUrl) {
    supabase.storage.from("concepts").createSignedUrl(concept.generated_image_path, 3600).then(({ data }) => {
      if (data?.signedUrl) setImgUrl(data.signedUrl);
    });
  }

  async function generate() {
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Your session expired. Please sign in again.");
      const r = await fetch("/api/concept-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id: concept.id }),
      });
      if (!r.ok) throw new Error(await r.text());
      const { storage_path } = await r.json();
      const { data } = await supabase.storage.from("concepts").createSignedUrl(storage_path, 3600);
      setImgUrl(data?.signedUrl ?? null);
      qc.invalidateQueries({ queryKey: ["concepts", concept.project_id] });
      toast.success("Concept generated.");
    } catch (e: any) {
      toast.error(e.message ?? "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  const approve = useMutation({
    mutationFn: async () => { await supabase.from("concept_requests").update({ approved_for_proposal: !concept.approved_for_proposal }).eq("id", concept.id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["concepts", concept.project_id] }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-base font-display">{concept.title}</CardTitle>
          <div className="flex gap-1">
            <Badge variant="outline">{concept.status}</Badge>
            {concept.approved_for_proposal && <Badge className="bg-emerald-100 text-emerald-900 border-0">Approved</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {imgUrl ? (
          <div className="relative">
            <img src={imgUrl} alt={concept.title} className="w-full rounded border"/>
            <div className="absolute bottom-1 left-1 right-1 rounded bg-black/60 px-2 py-1 text-[9px] text-white uppercase tracking-widest text-center">
              Conceptual rendering only
            </div>
          </div>
        ) : (
          <div className="aspect-video flex items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
            Not generated yet
          </div>
        )}
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Must keep</div>
          <p className="text-xs">{concept.must_keep || "—"}</p>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Requested changes</div>
          <p className="text-xs">{concept.requested_changes || "—"}</p>
        </div>
        <div className="flex gap-2 pt-2 border-t">
          <Button size="sm" onClick={generate} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <Sparkles className="mr-1 h-3 w-3"/>}
            {imgUrl ? "Regenerate" : "Generate"}
          </Button>
          {imgUrl && (
            <Button size="sm" variant="outline" onClick={() => approve.mutate()}>
              {concept.approved_for_proposal ? "Unapprove" : "Approve for proposal"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ConceptDialog({ onSubmit }: { onSubmit: (v: any) => void }) {
  const [form, setForm] = useState({ title: "", prompt: "", must_keep: "", requested_changes: "" });
  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>New concept request</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, status: "ready_to_generate" }); }} className="space-y-3">
        <div className="space-y-1"><Label className="text-xs">Title</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}/></div>
        <div className="space-y-1"><Label className="text-xs">Prompt</Label><Textarea required rows={3} value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} placeholder="Describe the rendering you want generated."/></div>
        <div className="space-y-1"><Label className="text-xs">Must keep</Label><Textarea rows={2} value={form.must_keep} onChange={(e) => setForm({ ...form, must_keep: e.target.value })} placeholder="Cabin location, driveway, grade, container orientation…"/></div>
        <div className="space-y-1"><Label className="text-xs">Requested changes</Label><Textarea rows={2} value={form.requested_changes} onChange={(e) => setForm({ ...form, requested_changes: e.target.value })} placeholder="Add lean-to roof, charcoal paint, signage…"/></div>
        <DialogFooter><Button type="submit">Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
