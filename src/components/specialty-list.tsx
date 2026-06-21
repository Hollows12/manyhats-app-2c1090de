import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { PROJECT_TYPE_LABEL, HOME_TYPES, CONTAINER_TYPES, HISTORIC_TYPES, SEPTIC_TYPES } from "@/lib/manyhats";
import { Home, Container, Landmark, Droplets } from "lucide-react";

export function SpecialtyList({ title, subtitle, icon: Icon, allowedTypes }: { title: string; subtitle: string; icon: LucideIcon; allowedTypes: Set<string> }) {
  const list = useQuery({
    queryKey: ["specialty", title],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*, clients(name)").in("project_type", Array.from(allowedTypes) as any).order("updated_at", { ascending: false });
      return data ?? [];
    },
  });
  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2"><Icon className="h-7 w-7 text-gold"/>{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(list.data ?? []).map((p: any) => (
          <Link key={p.id} to="/projects/$id" params={{ id: p.id }}>
            <Card className="hover:border-gold transition-all">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold truncate">{p.name}</div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="text-xs text-muted-foreground">{p.clients?.name} · {PROJECT_TYPE_LABEL[p.project_type]}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {(list.data ?? []).length === 0 && (
          <div className="md:col-span-3 rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            No projects yet in this module.
          </div>
        )}
      </div>
    </div>
  );
}

export const HomeBuilderRoute = createFileRoute("/_authenticated/home-builder")({
  component: () => <SpecialtyList title="Home Builder Pro" subtitle="Custom homes, additions, barndominiums, garages." icon={Home} allowedTypes={HOME_TYPES} />,
});
