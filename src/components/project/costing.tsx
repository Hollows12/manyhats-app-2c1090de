import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ESTIMATE_CATEGORIES, formatMoney } from "@/lib/manyhats";
import { useMemo } from "react";

export function ProjectCosting({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const costs = useQuery({
    queryKey: ["job-costs", projectId],
    queryFn: async () => (await supabase.from("job_costs").select("*").eq("project_id", projectId)).data ?? [],
  });
  const map = useMemo(() => {
    const m = new Map<string, { estimated: number; actual: number }>();
    for (const c of costs.data ?? []) m.set(c.category, { estimated: Number(c.estimated), actual: Number(c.actual) });
    return m;
  }, [costs.data]);

  const upsert = useMutation({
    mutationFn: async ({ category, field, value }: { category: string; field: "estimated" | "actual"; value: number }) => {
      const existing = map.get(category) ?? { estimated: 0, actual: 0 };
      const next = { ...existing, [field]: value };
      await supabase.from("job_costs").upsert(
        { project_id: projectId, category: category as any, estimated: next.estimated, actual: next.actual },
        { onConflict: "project_id,category" },
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-costs", projectId] }),
  });

  const totalEst = Array.from(map.values()).reduce((s, c) => s + c.estimated, 0);
  const totalAct = Array.from(map.values()).reduce((s, c) => s + c.actual, 0);
  const variance = totalEst - totalAct;
  const margin = totalAct > 0 ? ((totalEst - totalAct) / totalEst) * 100 : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <Card>
        <CardHeader><CardTitle className="text-sm">Estimated vs Actual</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b"><th className="text-left py-2">Category</th><th className="text-right">Estimated</th><th className="text-right">Actual</th><th className="text-right">Variance</th></tr>
              </thead>
              <tbody className="divide-y">
                {ESTIMATE_CATEGORIES.map(([v, label]) => {
                  const c = map.get(v) ?? { estimated: 0, actual: 0 };
                  const vr = c.estimated - c.actual;
                  return (
                    <tr key={v}>
                      <td className="py-2">{label}</td>
                      <td className="text-right">
                        <Input type="number" defaultValue={c.estimated} onBlur={(e) => upsert.mutate({ category: v, field: "estimated", value: Number(e.target.value) })} className="ml-auto h-8 w-28 text-right" />
                      </td>
                      <td className="text-right">
                        <Input type="number" defaultValue={c.actual} onBlur={(e) => upsert.mutate({ category: v, field: "actual", value: Number(e.target.value) })} className="ml-auto h-8 w-28 text-right" />
                      </td>
                      <td className={`text-right tabular-nums font-semibold ${vr < 0 ? "text-destructive" : "text-emerald-700"}`}>{formatMoney(vr)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Variance summary</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Estimated</span><span className="tabular-nums">{formatMoney(totalEst)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Actual</span><span className="tabular-nums">{formatMoney(totalAct)}</span></div>
          <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">Variance</span><span className={`tabular-nums font-semibold ${variance < 0 ? "text-destructive" : "text-emerald-700"}`}>{formatMoney(variance)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Margin</span><span className="tabular-nums font-semibold">{margin.toFixed(1)}%</span></div>
        </CardContent>
      </Card>
    </div>
  );
}
