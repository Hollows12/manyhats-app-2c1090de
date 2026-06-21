import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/_authenticated/job-management")({
  component: JobMgmtPage,
});

function JobMgmtPage() {
  const list = useQuery({
    queryKey: ["jm-projects"],
    queryFn: async () => (await supabase.from("projects").select("*, clients(name)").in("status", ["approved", "active", "waiting_on_client", "waiting_on_materials"]).order("updated_at", { ascending: false })).data ?? [],
  });
  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2"><ClipboardList className="h-7 w-7 text-gold"/>Job Management</h1>
        <p className="text-sm text-muted-foreground">Active jobs. Open any job to log daily progress, tasks, and change orders.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(list.data ?? []).map((p: any) => (
          <Link key={p.id} to="/projects/$id" params={{ id: p.id }}>
            <Card className="hover:border-gold transition-all">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between"><div className="font-semibold">{p.name}</div><StatusBadge status={p.status}/></div>
                <div className="text-xs text-muted-foreground">{p.clients?.name}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {(list.data ?? []).length === 0 && <div className="md:col-span-3 rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">No active jobs.</div>}
      </div>
    </div>
  );
}
