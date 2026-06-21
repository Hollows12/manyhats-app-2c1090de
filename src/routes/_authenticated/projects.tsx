import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Briefcase, Search } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { PROJECT_STATUS_OPTIONS, PROJECT_TYPE_GROUPS, PROJECT_TYPE_LABEL, formatDate } from "@/lib/manyhats";

export const Route = createFileRoute("/_authenticated/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("*, clients(name)")
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });
  const clients = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => (await supabase.from("clients").select("id, name").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (vals: any) => {
      const { data, error } = await supabase.from("projects").insert(vals).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); toast.success("Project created."); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = (projects.data ?? []).filter((p: any) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.clients?.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground">Every job, one record — from lead to closeout.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="w-56 pl-8" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {PROJECT_STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4"/>New project</Button></DialogTrigger>
            <ProjectDialog clients={clients.data ?? []} onSubmit={(v) => create.mutate(v)} busy={create.isPending} />
          </Dialog>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No projects match"
          description="Adjust filters or create a new project."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p: any) => (
            <Link key={p.id} to="/projects/$id" params={{ id: p.id }}>
              <Card className="h-full transition-all hover:border-gold hover:shadow-md">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-display text-base font-semibold truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.clients?.name}</div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <div>{PROJECT_TYPE_LABEL[p.project_type]}</div>
                    {p.city && <div>{[p.city, p.state, p.county && `${p.county} Co.`].filter(Boolean).join(" · ")}</div>}
                  </div>
                  {p.summary && <p className="text-xs text-muted-foreground line-clamp-2">{p.summary}</p>}
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Updated {formatDate(p.updated_at)}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectDialog({ clients, onSubmit, busy }: { clients: any[]; onSubmit: (v: any) => void; busy: boolean }) {
  const [form, setForm] = useState<any>({
    name: "", client_id: "", project_type: "other", status: "lead",
    job_address: "", city: "", state: "", zip: "", county: "",
    summary: "", budget_min: "", budget_max: "", desired_timeline: "",
  });
  return (
    <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            ...form,
            budget_min: form.budget_min ? Number(form.budget_min) : null,
            budget_max: form.budget_max ? Number(form.budget_max) : null,
          });
        }}
      >
        <div className="space-y-1">
          <Label className="text-xs">Project name</Label>
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Client</Label>
            <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })} required>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROJECT_STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Project type</Label>
          <Select value={form.project_type} onValueChange={(v) => setForm({ ...form, project_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROJECT_TYPE_GROUPS.map((g) => (
                <SelectGroup key={g.label}>
                  <SelectLabel>{g.label}</SelectLabel>
                  {g.types.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Job address</Label>
          <Input value={form.job_address} onChange={(e) => setForm({ ...form, job_address: e.target.value })} />
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1"><Label className="text-xs">City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">State</Label><Input maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">ZIP</Label><Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">County</Label><Input value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} /></div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Summary</Label>
          <Textarea rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1"><Label className="text-xs">Budget min</Label><Input type="number" value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Budget max</Label><Input type="number" value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Timeline</Label><Input value={form.desired_timeline} onChange={(e) => setForm({ ...form, desired_timeline: e.target.value })} placeholder="e.g. Spring 2026" /></div>
        </div>
        <DialogFooter><Button type="submit" disabled={busy}>Create project</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
