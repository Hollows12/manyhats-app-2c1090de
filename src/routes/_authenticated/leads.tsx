import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { PROJECT_TYPE_LABEL } from "@/lib/manyhats";

export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsPage,
});

const COLUMNS = [
  { value: "lead", label: "Lead" },
  { value: "site_visit_scheduled", label: "Site Visit" },
  { value: "field_capture", label: "Field Capture" },
  { value: "estimating", label: "Estimating" },
  { value: "proposal_draft", label: "Proposal Draft" },
  { value: "proposal_sent", label: "Proposal Sent" },
];

function LeadsPage() {
  const projects = useQuery({
    queryKey: ["leads"],
    queryFn: async () => (await supabase.from("projects").select("*, clients(name)").in("status", COLUMNS.map((c) => c.value)).order("updated_at", { ascending: false })).data ?? [],
  });

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Leads</h1>
        <p className="text-sm text-muted-foreground">Pipeline kanban — from cold lead to sent proposal.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {COLUMNS.map((col) => {
          const items = (projects.data ?? []).filter((p: any) => p.status === col.value);
          return (
            <Card key={col.value} className="bg-muted/20">
              <CardHeader className="py-3">
                <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                  {col.label}<span className="font-bold text-foreground">{items.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {items.map((p: any) => (
                  <Link key={p.id} to="/projects/$id" params={{ id: p.id }} className="block rounded border bg-card p-2 text-xs hover:border-gold">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="truncate text-muted-foreground">{p.clients?.name}</div>
                    <div className="mt-1 truncate text-[10px] text-muted-foreground">{PROJECT_TYPE_LABEL[p.project_type]}</div>
                  </Link>
                ))}
                {items.length === 0 && <div className="text-center text-[10px] text-muted-foreground py-2">—</div>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
