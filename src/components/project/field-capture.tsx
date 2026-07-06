import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Camera, Trash2, Ruler, Check, Upload, AlertTriangle, Eye, EyeOff, FileImage } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PHOTO_TAGS } from "@/lib/manyhats";

const UNIT_OPTIONS = ["ea", "lf", "sf", "sy", "cy", "in", "ft", "yd", "lb", "ton", "hr", "day", "ls"];
const PHASES = ["before", "during", "after", "damage", "material", "receipt", "other"];

export function ProjectFieldCapture({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-6">
      <PhotosSection projectId={projectId} />
      <MeasurementsSection projectId={projectId} />
      <div className="grid gap-4 md:grid-cols-2">
        <PlaceholderCard icon={Mic} title="Voice notes" body="Record voice notes from the field and convert them to scope language. Coming soon." />
        <PlaceholderCard icon={Box} title="LiDAR scans" body="iPhone LiDAR / ARKit / WebXR scan import. Coming soon." />
      </div>
    </div>
  );
}

function PhotosSection({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const photos = useQuery({
    queryKey: ["photos", projectId],
    queryFn: async () => (await supabase.from("project_photos").select("*").eq("project_id", projectId).order("created_at", { ascending: false })).data ?? [],
  });

  const [signed, setSigned] = useState<Record<string, string>>({});
  async function getSignedUrl(path: string) {
    if (signed[path]) return signed[path];
    const { data } = await supabase.storage.from("field-photos").createSignedUrl(path, 3600);
    if (data?.signedUrl) { setSigned((s) => ({ ...s, [path]: data.signedUrl })); return data.signedUrl; }
    return null;
  }

  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      const { data: { user } } = await supabase.auth.getUser();
      for (const file of Array.from(files)) {
        const path = `${projectId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("field-photos").upload(path, file);
        if (upErr) throw upErr;
        const { error } = await supabase.from("project_photos").insert({
          project_id: projectId, storage_path: path, is_real_site_photo: true, uploaded_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["photos", projectId] }); toast.success("Photos uploaded."); },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (photo: any) => {
      await supabase.storage.from("field-photos").remove([photo.storage_path]);
      await supabase.from("project_photos").delete().eq("id", photo.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photos", projectId] }),
  });

  const toggleTag = useMutation({
    mutationFn: async ({ id, tags }: { id: string; tags: string[] }) => {
      await supabase.from("project_photos").update({ tags }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photos", projectId] }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="font-display flex items-center gap-2"><Camera className="h-5 w-5 text-gold"/>Photos</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Real site photos. Tag, caption, attach to proposals.</p>
        </div>
        <label className="cursor-pointer">
          <input type="file" multiple accept="image/*" capture="environment" className="hidden"
            onChange={(e) => e.target.files && upload.mutate(e.target.files)} />
          <Button asChild size="sm" disabled={upload.isPending}>
            <span><Upload className="mr-1 h-4 w-4"/>{upload.isPending ? "Uploading…" : "Upload"}</span>
          </Button>
        </label>
      </CardHeader>
      <CardContent>
        {(photos.data ?? []).length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            No photos yet. Upload from phone or computer.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {photos.data!.map((p: any) => (
              <PhotoCard
                key={p.id}
                photo={p}
                getUrl={getSignedUrl}
                onDelete={() => remove.mutate(p)}
                onToggleTag={(t: string) => toggleTag.mutate({ id: p.id, tags: p.tags.includes(t) ? p.tags.filter((x: string) => x !== t) : [...p.tags, t] })}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PhotoCard({ photo, getUrl, onDelete, onToggleTag }: any) {
  const [url, setUrl] = useState<string | null>(null);
  if (!url) getUrl(photo.storage_path).then(setUrl);
  return (
    <div className="group relative overflow-hidden rounded-md border border-border bg-muted">
      <div className="aspect-square bg-muted">
        {url ? <img src={url} alt={photo.caption ?? ""} className="h-full w-full object-cover" /> : <div className="h-full" />}
      </div>
      <button onClick={onDelete} className="absolute right-1 top-1 hidden rounded bg-destructive/90 p-1 text-destructive-foreground group-hover:block">
        <Trash2 className="h-3 w-3"/>
      </button>
      <div className="p-2 bg-card">
        <div className="flex flex-wrap gap-1">
          {PHOTO_TAGS.map((t) => (
            <button
              key={t}
              onClick={() => onToggleTag(t)}
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider transition-colors ${photo.tags.includes(t) ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MeasurementsSection({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["measurements", projectId],
    queryFn: async () => (await supabase.from("measurements").select("*").eq("project_id", projectId).order("created_at", { ascending: false })).data ?? [],
  });
  const [form, setForm] = useState({ description: "", quantity: "", unit: "ea", notes: "", is_confirmed: false });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("measurements").insert({
        project_id: projectId, description: form.description, quantity: Number(form.quantity) || 0,
        unit: form.unit, notes: form.notes || null, is_confirmed: form.is_confirmed,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["measurements", projectId] }); setForm({ description: "", quantity: "", unit: "ea", notes: "", is_confirmed: false }); toast.success("Measurement added."); },
  });

  const toggleConfirm = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      await supabase.from("measurements").update({ is_confirmed: val }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["measurements", projectId] }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { await supabase.from("measurements").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["measurements", projectId] }),
  });

  const confirmedCount = (list.data ?? []).filter((m: any) => m.is_confirmed).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2"><Ruler className="h-5 w-5 text-gold"/>Measurements</CardTitle>
        <p className="text-xs text-muted-foreground">
          Final proposal pricing requires <strong>confirmed</strong> measurements. {confirmedCount} confirmed.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
          className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-[1.5fr_80px_100px_1fr_auto_auto] md:items-end"
        >
          <div><Label className="text-xs">Description</Label><Input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. CMU foundation length"/></div>
          <div><Label className="text-xs">Qty</Label><Input type="number" step="0.01" required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}/></div>
          <div>
            <Label className="text-xs">Unit</Label>
            <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{UNIT_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}/></div>
          <div className="flex items-center gap-2 pb-2">
            <Switch checked={form.is_confirmed} onCheckedChange={(v) => setForm({ ...form, is_confirmed: v })} id="conf"/>
            <Label htmlFor="conf" className="text-xs">Confirmed</Label>
          </div>
          <Button type="submit" disabled={add.isPending}>Add</Button>
        </form>

        {(list.data ?? []).length === 0 ? (
          <div className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">No measurements yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {list.data!.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 py-2 text-sm">
                <button onClick={() => toggleConfirm.mutate({ id: m.id, val: !m.is_confirmed })}>
                  {m.is_confirmed
                    ? <Badge className="bg-emerald-100 text-emerald-900 border-0"><Check className="mr-1 h-3 w-3"/>Confirmed</Badge>
                    : <Badge variant="outline" className="border-amber-400 text-amber-700"><AlertTriangle className="mr-1 h-3 w-3"/>Unconfirmed</Badge>}
                </button>
                <div className="flex-1">
                  <div className="font-medium">{m.description}</div>
                  {m.notes && <div className="text-xs text-muted-foreground">{m.notes}</div>}
                </div>
                <div className="tabular-nums font-semibold">{m.quantity} <span className="text-xs text-muted-foreground">{m.unit}</span></div>
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(m.id)}><Trash2 className="h-3 w-3"/></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlaceholderCard({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Icon className="h-4 w-4 text-gold"/>{title}</CardTitle></CardHeader>
      <CardContent><p className="text-xs text-muted-foreground">{body}</p></CardContent>
    </Card>
  );
}
