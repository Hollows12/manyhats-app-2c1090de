import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users, Briefcase, FileText, Camera, Calculator, Sparkles, ClipboardList,
  TrendingUp, BookOpen, Home, Container, Landmark, Droplets, Inbox, ArrowRight,
  Receipt, Wallet, DollarSign, AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { PROJECT_STATUS_OPTIONS, PROJECT_TYPE_LABEL, formatDate, formatMoney } from "@/lib/manyhats";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const counts = useQuery({
    queryKey: ["dash", "counts"],
    queryFn: async () => {
      const [clients, projects, estimates, proposals, photos, concepts] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("status"),
        supabase.from("estimates").select("id", { count: "exact", head: true }),
        supabase.from("proposals").select("id", { count: "exact", head: true }),
        supabase.from("project_photos").select("id", { count: "exact", head: true }),
        supabase.from("concept_requests").select("id", { count: "exact", head: true }),
      ]);
      const statusCounts: Record<string, number> = {};
      for (const s of PROJECT_STATUS_OPTIONS) statusCounts[s.value] = 0;
      for (const p of projects.data ?? []) statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;
      return {
        clients: clients.count ?? 0,
        projects: projects.data?.length ?? 0,
        estimates: estimates.count ?? 0,
        proposals: proposals.count ?? 0,
        photos: photos.count ?? 0,
        concepts: concepts.count ?? 0,
        statusCounts,
      };
    },
  });

  const recent = useQuery({
    queryKey: ["dash", "recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, status, project_type, updated_at, client_id, clients(name)")
        .order("updated_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const moduleCards = [
    { to: "/leads", icon: Inbox, title: "Leads", desc: "New opportunities" },
    { to: "/clients", icon: Users, title: "Clients", desc: "CRM and history" },
    { to: "/projects", icon: Briefcase, title: "Projects", desc: "Every job, one record" },
    { to: "/field-capture", icon: Camera, title: "Field Capture", desc: "Photos, measurements" },
    { to: "/estimates", icon: Calculator, title: "Estimates", desc: "Line-item costing" },
    { to: "/proposals", icon: FileText, title: "Proposals", desc: "Good / Better / Best" },
    { to: "/concept-studio", icon: Sparkles, title: "Concept Studio", desc: "AI renderings" },
    { to: "/home-builder", icon: Home, title: "Home Builder Pro", desc: "Custom homes" },
    { to: "/container-builds", icon: Container, title: "Container Pro", desc: "Container builds" },
    { to: "/historic", icon: Landmark, title: "Historic Pro", desc: "Restoration" },
    { to: "/septic", icon: Droplets, title: "Sentinel Septic", desc: "Septic systems" },
    { to: "/job-management", icon: ClipboardList, title: "Job Management", desc: "Daily logs, COs" },
    { to: "/job-costing", icon: TrendingUp, title: "Job Costing", desc: "Estimated vs actual" },
    { to: "/knowledge-base", icon: BookOpen, title: "Knowledge Base", desc: "Past project intel" },
  ] as const;

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Command Center</h1>
        <p className="text-sm text-muted-foreground">
          Pipeline at a glance for ManyHats Construction.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Clients" value={counts.data?.clients} />
        <Metric label="Projects" value={counts.data?.projects} />
        <Metric label="Estimates" value={counts.data?.estimates} />
        <Metric label="Proposals" value={counts.data?.proposals} />
        <Metric label="Photos" value={counts.data?.photos} />
        <Metric label="Concepts" value={counts.data?.concepts} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Recent Projects</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to="/projects">All <ArrowRight className="ml-1 h-3 w-3"/></Link></Button>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {(recent.data ?? []).map((p: any) => (
                <Link
                  key={p.id}
                  to="/projects/$id"
                  params={{ id: p.id }}
                  className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-muted/40 -mx-2 px-2 rounded"
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.clients?.name ?? "—"} · {PROJECT_TYPE_LABEL[p.project_type] ?? p.project_type}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={p.status} />
                    <span className="text-xs text-muted-foreground hidden sm:inline">{formatDate(p.updated_at)}</span>
                  </div>
                </Link>
              ))}
              {(recent.data ?? []).length === 0 && (
                <div className="py-10 text-center text-sm text-muted-foreground">No projects yet.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-display">Pipeline</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {PROJECT_STATUS_OPTIONS.map((s) => {
              const c = counts.data?.statusCounts[s.value] ?? 0;
              return (
                <div key={s.value} className="flex items-center justify-between text-sm py-1">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-semibold tabular-nums">{c}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold mb-4">All Modules</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {moduleCards.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className="group rounded-lg border border-border bg-card p-4 transition-all hover:border-gold hover:shadow-md"
            >
              <m.icon className="h-5 w-5 text-gold" />
              <div className="mt-3 font-semibold text-sm">{m.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{m.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="mt-1 font-display text-3xl font-bold tabular-nums">
          {value ?? <span className="text-muted-foreground/40">—</span>}
        </div>
      </CardContent>
    </Card>
  );
}
