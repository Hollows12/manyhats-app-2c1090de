import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { Camera, Trash2, Ruler, Check, Upload, AlertTriangle, Eye, EyeOff, FileImage, Layers, X, Loader2, CircleAlert, Ban, RotateCw } from "lucide-react";
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
import { SendCaptureButton } from "@/components/project/send-capture-button";

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
                projectId={projectId}
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

function PhotoCard({ projectId, photo, getUrl, onDelete, onToggleTag, onMeta }: any) {
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
        <div className="pt-1">
          <SendCaptureButton projectId={projectId} source={{ photo_ids: [photo.id] }} label="Send to estimate / proposal" size="sm" variant="outline" />
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

type FileStatus = "pending" | "uploading" | "done" | "error" | "canceled";
type FileState = { status: FileStatus; percent: number; error?: string };

function BulkUploadDialog({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<BulkCategory>("project");
  const [files, setFiles] = useState<File[]>([]);
  const [states, setStates] = useState<FileState[]>([]);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const cancelRef = useRef(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  function addFiles(incoming: File[]) {
    const isReceipts = category === "receipts";
    const filtered = incoming.filter((f) =>
      isReceipts ? (f.type.startsWith("image/") || f.type === "application/pdf") : f.type.startsWith("image/"),
    );
    if (filtered.length === 0) { toast.error("No supported files found."); return; }
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
      const merged = [...prev];
      for (const f of filtered) {
        const key = `${f.name}-${f.size}-${f.lastModified}`;
        if (!seen.has(key)) { seen.add(key); merged.push(f); }
      }
      setStates(merged.map((_, i) => states[i] ?? { status: "pending", percent: 0 }));
      return merged;
    });
  }

  function reset() {
    setFiles([]); setStates([]); setCaption(""); setCategory("project"); setDragOver(false);
    cancelRef.current = false; xhrRef.current = null;
  }

  function updateState(i: number, patch: Partial<FileState>) {
    setStates((prev) => {
      const next = prev.slice();
      next[i] = { ...(next[i] ?? { status: "pending", percent: 0 }), ...patch };
      return next;
    });
  }

  function uploadWithProgress(signedUrl: string, file: File, onPercent: (p: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open("PUT", signedUrl, true);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onPercent(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        xhrRef.current = null;
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => { xhrRef.current = null; reject(new Error("Network error")); };
      xhr.onabort = () => { xhrRef.current = null; reject(new Error("__CANCELED__")); };
      xhr.send(file);
    });
  }

  function handleCancel() {
    cancelRef.current = true;
    xhrRef.current?.abort();
  }

  async function handleUpload(targetIndexes?: number[]) {
    if (files.length === 0) { toast.error("Select at least one file."); return; }
    const indexes = (targetIndexes && targetIndexes.length > 0)
      ? targetIndexes.filter((i) => i >= 0 && i < files.length)
      : files.map((_, i) => i);
    if (indexes.length === 0) return;
    const isRetry = !!targetIndexes;
    setBusy(true);
    cancelRef.current = false;
    // Reset only the files we're about to (re)upload, keep others as-is.
    setStates((prev) => {
      const next = prev.length === files.length ? prev.slice() : files.map(() => ({ status: "pending" as FileStatus, percent: 0 }));
      for (const i of indexes) next[i] = { status: "pending", percent: 0 };
      return next;
    });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const meta = bulkMetaFor(category);
      let ok = 0;
      for (const i of indexes) {
        if (cancelRef.current) { updateState(i, { status: "canceled" }); continue; }
        const file = files[i];
        const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const isReceipt = category === "receipts";
        const path = isReceipt
          ? `receipts/${projectId}/${Date.now()}-${i}-${safe}`
          : `${projectId}/${Date.now()}-${i}-${safe}`;
        updateState(i, { status: "uploading", percent: 0, error: undefined });
        try {
          const { data: signed, error: signErr } = await supabase.storage
            .from("field-photos")
            .createSignedUploadUrl(path);
          if (signErr || !signed) throw new Error(signErr?.message ?? "Could not sign upload URL");
          await uploadWithProgress(signed.signedUrl, file, (p) => updateState(i, { percent: p }));

          if (isReceipt) {
            const { error } = await (supabase as any).from("receipts").insert({
              project_id: projectId, uploaded_by: user?.id, storage_path: path,
              vendor: null, amount: 0, category: "material",
              purchased_at: new Date().toISOString().slice(0, 10),
              notes: caption || null,
            });
            if (error) throw error;
          } else {
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
          updateState(i, { status: "done", percent: 100 });
          ok++;
        } catch (err: any) {
          if (err?.message === "__CANCELED__" || cancelRef.current) {
            updateState(i, { status: "canceled" });
          } else {
            updateState(i, { status: "error", error: err?.message ?? "Failed" });
          }
        }
      }
      const failed = indexes.length - ok;
      const noun = category === "receipts" ? "receipt(s)" : "photo(s)";
      if (cancelRef.current) {
        toast.message(`Canceled. ${ok} uploaded, ${failed} skipped.`);
      } else if (failed === 0) {
        toast.success(isRetry ? `Retried ${ok} ${noun} successfully.` : `Uploaded ${ok} ${noun}.`);
      } else {
        toast.warning(`${isRetry ? "Retried" : "Uploaded"} ${ok}, ${failed} failed.`);
      }
      onDone();
      // Only auto-close on a full initial upload with no failures.
      if (!isRetry && !cancelRef.current && failed === 0) { setOpen(false); reset(); }
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
      cancelRef.current = false;
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
            <label
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!busy) setDragOver(true); }}
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); if (!busy) setDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
              onDrop={(e) => {
                e.preventDefault(); e.stopPropagation(); setDragOver(false);
                if (busy) return;
                const dropped = Array.from(e.dataTransfer.files ?? []);
                if (dropped.length) addFiles(dropped);
              }}
              className={`mt-1 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors ${
                dragOver ? "border-gold bg-gold/10" : "border-border bg-muted/30 hover:bg-muted/50"
              } ${busy ? "pointer-events-none opacity-50" : ""}`}
            >
              <Upload className="h-5 w-5 text-muted-foreground" />
              <div className="text-xs font-medium">
                {dragOver ? "Drop files to add" : "Drag & drop files here, or click to browse"}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {category === "receipts" ? "Images or PDF" : "Images"} · multiple files supported
              </div>
              <input
                type="file"
                multiple
                accept={category === "receipts" ? "image/*,application/pdf" : "image/*"}
                className="hidden"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  if (picked.length) addFiles(picked);
                  e.target.value = "";
                }}
              />
            </label>
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">{files.length} file(s) selected</p>
                  <button
                    type="button"
                    onClick={() => setFiles([])}
                    disabled={busy}
                    className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                </div>
                <ul className="max-h-40 overflow-y-auto rounded-md border border-border bg-background/50 p-1 text-[11px]">
                  {files.map((f, i) => {
                    const s = states[i] ?? { status: "pending" as FileStatus, percent: 0 };
                    return (
                      <li key={`${f.name}-${i}`} className="flex items-center gap-2 px-1 py-1">
                        <div className="flex-shrink-0">
                          {s.status === "done" && <Check className="h-3 w-3 text-emerald-600" />}
                          {s.status === "uploading" && <Loader2 className="h-3 w-3 animate-spin text-gold" />}
                          {s.status === "error" && <CircleAlert className="h-3 w-3 text-destructive" />}
                          {s.status === "canceled" && <Ban className="h-3 w-3 text-muted-foreground" />}
                          {s.status === "pending" && <div className="h-3 w-3 rounded-full border border-muted-foreground/40" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{f.name}</span>
                            <span className="tabular-nums text-muted-foreground">
                              {s.status === "done" ? "100%"
                                : s.status === "error" ? "Failed"
                                : s.status === "canceled" ? "Canceled"
                                : s.status === "uploading" ? `${s.percent}%`
                                : "—"}
                            </span>
                          </div>
                          {(s.status === "uploading" || s.status === "done") && (
                            <Progress value={s.percent} className="mt-1 h-1" />
                          )}
                          {s.status === "error" && s.error && (
                            <p className="mt-0.5 text-[10px] text-destructive truncate">{s.error}</p>
                          )}
                        </div>
                        {!busy && s.status === "error" && (
                          <button
                            type="button"
                            onClick={() => handleUpload([i])}
                            className="text-muted-foreground hover:text-gold"
                            aria-label={`Retry ${f.name}`}
                            title="Retry this file"
                          >
                            <RotateCw className="h-3 w-3" />
                          </button>
                        )}
                        {!busy && (
                          <button
                            type="button"
                            onClick={() => {
                              setFiles((prev) => prev.filter((_, idx) => idx !== i));
                              setStates((prev) => prev.filter((_, idx) => idx !== i));
                            }}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${f.name}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Caption / note (applied to all)</Label>
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Optional" disabled={busy} />
          </div>
          {busy && (() => {
            const doneCount = states.filter((s) => s.status === "done").length;
            const totalPercent = files.length === 0
              ? 0
              : Math.round(states.reduce((sum, s) => sum + (s?.percent ?? 0), 0) / files.length);
            return (
              <div className="space-y-1 rounded-md border border-border bg-muted/30 p-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold uppercase tracking-wider">Overall</span>
                  <span className="tabular-nums text-muted-foreground">
                    {doneCount} / {files.length} · {totalPercent}%
                  </span>
                </div>
                <Progress value={totalPercent} />
              </div>
            );
          })()}
        </div>
        <DialogFooter>
          {busy ? (
            <Button variant="destructive" onClick={handleCancel}>
              <X className="mr-1 h-4 w-4" />Cancel upload
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Close</Button>
              <Button onClick={() => handleUpload()} disabled={files.length === 0}>
                <Upload className="mr-1 h-4 w-4"/>
                Upload {files.length || ""}
              </Button>
            </>
          )}
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}


