import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CONCEPT_DISCLAIMER } from "@/lib/manyhats";

export const Route = createFileRoute("/_authenticated/concept-studio")({
  component: ConceptStudio,
});

function ConceptStudio() {
  const list = useQuery({
    queryKey: ["concepts-all"],
    queryFn: async () => (await supabase.from("concept_requests").select("*, projects(id, name, clients(name))").order("created_at", { ascending: false })).data ?? [],
  });
  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2"><Sparkles className="h-7 w-7 text-gold"/>Concept Studio</h1>
        <p className="text-sm text-muted-foreground">AI-generated concept renderings, anchored to real measurements and must-keep rules.</p>
      </div>
      <Card className="border-gold/40 bg-gold/5"><CardContent className="p-4 text-xs">{CONCEPT_DISCLAIMER}</CardContent></Card>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(list.data ?? []).map((c: any) => (
          <Link key={c.id} to="/projects/$id" params={{ id: c.projects.id }}>
            <Card className="hover:border-gold transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold truncate">{c.title}</div>
                  <Badge variant="outline">{c.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground truncate mt-1">{c.projects?.name}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {(list.data ?? []).length === 0 && (
          <div className="md:col-span-3 rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            No concepts yet. Open a project and use the Concept Studio tab.
          </div>
        )}
      </div>
    </div>
  );
}
