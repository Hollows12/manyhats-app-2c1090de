import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/field-capture")({
  component: FieldCapturePage,
});

function FieldCapturePage() {
  const projects = useQuery({
    queryKey: ["fc-projects"],
    queryFn: async () => (await supabase.from("projects").select("id, name, status, project_type, clients(name)").order("updated_at", { ascending: false })).data ?? [],
  });

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Field Capture</h1>
        <p className="text-sm text-muted-foreground">Open a project to capture photos and measurements from the field.</p>
      </div>
      {(projects.data ?? []).length === 0 ? (
        <EmptyState icon={Camera} title="No projects yet" description="Create a project first." action={<Button asChild><Link to="/projects">Go to projects</Link></Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projects.data!.map((p: any) => (
            <Link key={p.id} to="/projects/$id" params={{ id: p.id }}>
              <Card className="hover:border-gold hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.clients?.name}</div>
                  <div className="mt-2 text-xs flex items-center gap-1 text-gold"><Camera className="h-3 w-3"/>Open field capture →</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
