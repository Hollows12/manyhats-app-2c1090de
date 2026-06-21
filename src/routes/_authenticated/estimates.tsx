import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney, formatDate } from "@/lib/manyhats";

export const Route = createFileRoute("/_authenticated/estimates")({
  component: () => (
    <ListByProject queryKey="estimates-list" table="estimates" icon={Calculator}
      title="Estimates" subtitle="Open a project to build or edit its estimate." />
  ),
});

function ListByProject({ queryKey, table, icon: Icon, title, subtitle }: any) {
  const list = useQuery({
    queryKey: [queryKey],
    queryFn: async () => (await supabase.from(table).select("*, projects(id, name, clients(name))").order("updated_at", { ascending: false })).data ?? [],
  });
  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(list.data ?? []).map((e: any) => (
          <Link key={e.id} to="/projects/$id" params={{ id: e.projects.id }}>
            <Card className="hover:border-gold transition-all">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3 w-3 text-gold"/>{e.estimate_number ?? e.id.slice(0, 8)}</div>
                <div className="font-semibold">{e.projects?.name}</div>
                <div className="text-xs text-muted-foreground">{e.projects?.clients?.name}</div>
                <div className="text-xs text-muted-foreground">Updated {formatDate(e.updated_at)}</div>
                <div className="font-display text-lg font-bold text-navy mt-2">{formatMoney(Number(e.grand_total))}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {(list.data ?? []).length === 0 && (
          <div className="md:col-span-3 rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">No {title.toLowerCase()} yet.</div>
        )}
      </div>
    </div>
  );
}
