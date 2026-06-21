import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/manyhats";

export const Route = createFileRoute("/_authenticated/job-costing")({
  component: JobCostingPage,
});

function JobCostingPage() {
  const list = useQuery({
    queryKey: ["jc-projects"],
    queryFn: async () => {
      const { data: projects } = await supabase.from("projects").select("*, clients(name), job_costs(estimated, actual)").order("updated_at", { ascending: false });
      return projects ?? [];
    },
  });
  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2"><TrendingUp className="h-7 w-7 text-gold"/>Job Costing</h1>
        <p className="text-sm text-muted-foreground">Estimated vs actual across every project.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(list.data ?? []).map((p: any) => {
          const est = (p.job_costs ?? []).reduce((s: number, c: any) => s + Number(c.estimated), 0);
          const act = (p.job_costs ?? []).reduce((s: number, c: any) => s + Number(c.actual), 0);
          const vr = est - act;
          return (
            <Link key={p.id} to="/projects/$id" params={{ id: p.id }}>
              <Card className="hover:border-gold transition-all">
                <CardContent className="p-4 space-y-2">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.clients?.name}</div>
                  <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                    <div><div className="text-muted-foreground">Est</div><div className="font-semibold tabular-nums">{formatMoney(est)}</div></div>
                    <div><div className="text-muted-foreground">Act</div><div className="font-semibold tabular-nums">{formatMoney(act)}</div></div>
                    <div><div className="text-muted-foreground">Var</div><div className={`font-semibold tabular-nums ${vr < 0 ? "text-destructive" : "text-emerald-700"}`}>{formatMoney(vr)}</div></div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
