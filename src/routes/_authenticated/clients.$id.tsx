import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Phone, Mail, MapPin, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { PROJECT_TYPE_LABEL, formatDate } from "@/lib/manyhats";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const client = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const projects = useQuery({
    queryKey: ["client-projects", id],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").eq("client_id", id).order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  if (client.isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!client.data) return <div className="p-8">Client not found.</div>;
  const c = client.data;

  return (
    <div className="space-y-6 p-6 md:p-8">
      <Button asChild variant="ghost" size="sm"><Link to="/clients"><ArrowLeft className="mr-1 h-3 w-3"/> Back to clients</Link></Button>
      <div>
        <h1 className="font-display text-3xl font-bold">{c.name}</h1>
        {c.notes && <p className="mt-2 text-sm text-muted-foreground max-w-2xl">{c.notes}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Contact</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {c.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-gold"/> {c.phone}</div>}
            {c.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-gold"/> {c.email}</div>}
            {(c.address || c.city) && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-gold mt-0.5"/>
                <div>
                  {c.address && <div>{c.address}</div>}
                  <div>{[c.city, c.state, c.zip].filter(Boolean).join(", ")}</div>
                  {c.county && <div className="text-muted-foreground text-xs">{c.county} County</div>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Projects ({projects.data?.length ?? 0})</CardTitle>
            <Button asChild size="sm"><Link to="/projects">New project →</Link></Button>
          </CardHeader>
          <CardContent>
            {(projects.data ?? []).length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No projects yet for this client.</div>
            ) : (
              <div className="divide-y divide-border">
                {projects.data!.map((p: any) => (
                  <Link
                    key={p.id}
                    to="/projects/$id"
                    params={{ id: p.id }}
                    className="flex items-center justify-between py-3 -mx-2 px-2 rounded hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-semibold">
                        <Briefcase className="h-3.5 w-3.5 text-gold"/> {p.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {PROJECT_TYPE_LABEL[p.project_type]} · Updated {formatDate(p.updated_at)}
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
