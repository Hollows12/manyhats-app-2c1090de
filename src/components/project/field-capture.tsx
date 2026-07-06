import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Camera, Trash2, Ruler, Check, Upload, AlertTriangle, Eye, EyeOff, FileImage, Layers } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { PHOTO_TAGS } from "@/lib/manyhats";

const UNIT_OPTIONS = ["ea", "lf", "sf", "sy", "cy", "in", "ft", "yd", "lb", "ton", "hr", "day", "ls"];
const PHASES = ["before", "during", "after", "damage", "material", "receipt", "other"];

type BulkCategory =
  | "project" | "before" | "during" | "after"
  | "proposal" | "damage" | "material" | "receipts";

const BULK_CATEGORIES: { value: BulkCategory; label: string; hint: string }[] = [
  { value: "project", label: "Project (general)", hint: "General project photos, internal only." },
  { value: "before", label: "Before", hint: "Existing conditions before work begins." },
  { value: "during", label: "During (progress)", hint: "Work in progress photos." },
  { value: "after", label: "After (finished)", hint: "Completed work photos." },
  { value: "proposal", label: "Proposal (client-facing)", hint: "Included on proposals, visible to client." },
  { value: "damage", label: "Damage", hint: "Damage documentation." },
  { value: "material", label: "Material", hint: "Materials on site or delivered." },
  { value: "receipts", label: "Receipts", hint: "Uploaded to Receipts (edit vendor/amount after)." },
];

function bulkMetaFor(cat: BulkCategory) {
  switch (cat) {
    case "before":   return { phase: "before" as const,   tags: ["Before"],       proposal_include: false, is_client_facing: false };
    case "during":   return { phase: "during" as const,   tags: ["Progress"],     proposal_include: false, is_client_facing: false };
    case "after":    return { phase: "after" as const,    tags: ["Finished"],     proposal_include: true,  is_client_facing: true  };
    case "proposal": return { phase: null,                tags: ["Reference"],    proposal_include: true,  is_client_facing: true  };
    case "damage":   return { phase: "damage" as const,   tags: ["Damage"],       proposal_include: false, is_client_facing: false };
    case "material": return { phase: "material" as const, tags: [],               proposal_include: false, is_client_facing: false };
    case "project":
    default:         return { phase: null,                tags: [],               proposal_include: false, is_client_facing: false };
  }
}

export function ProjectFieldCapture({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-6">
      <PhotosSection projectId={projectId} />
      <MeasurementsSection projectId={projectId} />
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

  async function getGps(): Promise<{ lat?: number; lng?: number }> {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) return resolve({});
      const timer = setTimeout(() => resolve({}), 2500);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => { clearTimeout(timer); resolve({}); },
        { enableHighAccuracy: false, timeout: 2000 },
      );
    });
  }

  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      const { data: { user } } = await supabase.auth.getUser();
      const gps = await getGps();
      for (const file of Array.from(files)) {
        const path = `${projectId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("field-photos").upload(path, file);
        if (upErr) throw upErr;
        const { error } = await supabase.from("project_photos").insert({
          project_id: projectId, storage_path: path, is_real_site_photo: true, uploaded_by: user?.id,
          gps_lat: gps.lat ?? null, gps_lng: gps.lng ?? null, captured_at: new Date().toISOString(),
        } as any);
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

  const updateMeta = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      await (supabase as any).from("project_photos").update(patch).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photos", projectId] }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="font-display flex items-center gap-2"><Camera className="h-5 w-5 text-gold"/>Photos</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Real site photos. Tag, caption, attach to proposals.</p>
        </div>
        <div className="flex items-center gap-2">
          <BulkUploadDialog projectId={projectId} onDone={() => {
            qc.invalidateQueries({ queryKey: ["photos", projectId] });
            qc.invalidateQueries({ queryKey: ["receipts", projectId] });
          }} />
          <label className="cursor-pointer">
            <input type="file" multiple accept="image/*" capture="environment" className="hidden"
              onChange={(e) => e.target.files && upload.mutate(e.target.files)} />
            <Button asChild size="sm" variant="outline" disabled={upload.isPending}>
              <span><Upload className="mr-1 h-4 w-4"/>{upload.isPending ? "Uploading…" : "Quick upload"}</span>
            </Button>
          </label>
        </div>
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
                onMeta={(patch: Record<string, any>) => updateMeta.mutate({ id: p.id, patch })}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PhotoCard({ photo, getUrl, onDelete, onToggleTag, onMeta }: any) {
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
      <div className="absolute left-1 top-1 flex flex-col gap-1">
        {photo.proposal_include && <Badge className="border-0 bg-gold text-gold-foreground text-[9px]"><FileImage className="mr-0.5 h-2.5 w-2.5"/>Proposal</Badge>}
        {photo.is_client_facing ? (
          <Badge className="border-0 bg-emerald-600 text-white text-[9px]"><Eye className="mr-0.5 h-2.5 w-2.5"/>Client</Badge>
        ) : (
          <Badge variant="outline" className="text-[9px] bg-background/80"><EyeOff className="mr-0.5 h-2.5 w-2.5"/>Internal</Badge>
        )}
      </div>
      <div className="p-2 bg-card space-y-2">
        <div className="flex gap-1">
          <Select value={photo.phase ?? ""} onValueChange={(v) => onMeta({ phase: v || null })}>
            <SelectTrigger className="h-6 text-[10px]"><SelectValue placeholder="Phase"/></SelectTrigger>
            <SelectContent>{PHASES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => onMeta({ proposal_include: !photo.proposal_include })}
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${photo.proposal_include ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground"}`}
          >Proposal</button>
          <button
            onClick={() => onMeta({ is_client_facing: !photo.is_client_facing })}
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${photo.is_client_facing ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}
          >Client</button>
        </div>
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

function BulkUploadDialog({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<BulkCategory>("project");
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(0);

  function reset() {
    setFiles([]); setCaption(""); setProgress(0); setDone(0); setCategory("project");
  }

  async function handleUpload() {
    if (files.length === 0) { toast.error("Select at least one file."); return; }
    setBusy(true); setProgress(0); setDone(0);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const meta = bulkMetaFor(category);
      let ok = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        if (category === "receipts") {
          const path = `receipts/${projectId}/${Date.now()}-${i}-${safe}`;
          const { error: upErr } = await supabase.storage.from("field-photos").upload(path, file);
          if (upErr) throw upErr;
          const { error } = await (supabase as any).from("receipts").insert({
            project_id: projectId, uploaded_by: user?.id, storage_path: path,
            vendor: null, amount: 0, category: "material",
            purchased_at: new Date().toISOString().slice(0, 10),
            notes: caption || null,
          });
          if (error) throw error;
        } else {
          const path = `${projectId}/${Date.now()}-${i}-${safe}`;
          const { error: upErr } = await supabase.storage.from("field-photos").upload(path, file);
          if (upErr) throw upErr;
          const { error } = await supabase.from("project_photos").insert({
            project_id: projectId,
            storage_path: path,
            is_real_site_photo: true,
            uploaded_by: user?.id,
            captured_at: new Date().toISOString(),
            caption: caption || null,
            phase: meta.phase,
            tags: meta.tags,
            proposal_include: meta.proposal_include,
            is_client_facing: meta.is_client_facing,
          } as any);
          if (error) throw error;
        }
        ok++;
        setDone(ok);
        setProgress(Math.round((ok / files.length) * 100));
      }
      toast.success(`Uploaded ${ok} ${category === "receipts" ? "receipt(s)" : "photo(s)"}.`);
      onDone();
      setOpen(false);
      reset();
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const hint = BULK_CATEGORIES.find((c) => c.value === category)?.hint;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { setOpen(v); if (!v) reset(); } }}>
      <DialogTrigger asChild>
        <Button size="sm"><Layers className="mr-1 h-4 w-4"/>Bulk upload</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Bulk upload</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as BulkCategory)}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                {BULK_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
          </div>
          <div>
            <Label className="text-xs">Files</Label>
            <Input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && (
              <p className="mt-1 text-[11px] text-muted-foreground">{files.length} file(s) selected</p>
            )}
          </div>
          <div>
            <Label className="text-xs">Caption / note (applied to all)</Label>
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Optional" />
          </div>
          {busy && (
            <div className="space-y-1">
              <Progress value={progress} />
              <p className="text-[11px] text-muted-foreground">{done} / {files.length} uploaded</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { if (!busy) { setOpen(false); reset(); } }} disabled={busy}>Cancel</Button>
          <Button onClick={handleUpload} disabled={busy || files.length === 0}>
            <Upload className="mr-1 h-4 w-4"/>
            {busy ? `Uploading ${done}/${files.length}…` : `Upload ${files.length || ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


