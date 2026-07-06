import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/manyhats";

export const Route = createFileRoute("/_authenticated/proposals")({
  component: ProposalsPage,
});

function ProposalsPage() {
  const list = useQuery({
    queryKey: ["proposals-list"],
    queryFn: async () => (await supabase.from("proposals").select("*, projects(id, name, clients(name))").order("created_at", { ascending: false })).data ?? [],
  });
  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Proposals</h1>
        <p className="text-sm text-muted-foreground">Every proposal. Export PDF, send, track approval.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(list.data ?? []).map((p: any) => (
          <Card key={p.id} className="hover:border-gold transition-all">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs"><FileText className="h-3 w-3 text-gold"/>{p.proposal_number}</div>
                <Badge variant="outline">{p.status}</Badge>
              </div>
              <Link to="/projects/$id" params={{ id: p.projects.id }} className="block">
                <div className="font-semibold">{p.projects?.name}</div>
                <div className="text-xs text-muted-foreground">{p.projects?.clients?.name}</div>
              </Link>
              <div className="text-xs text-muted-foreground">Created {formatDate(p.created_at)}</div>
              {p.invoice_number && (
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary">Invoice</Badge>
                  <span className="font-mono">{p.invoice_number}</span>
                  {p.invoice_status && <Badge variant="outline" className="capitalize">{p.invoice_status}</Badge>}
                </div>
              )}
              <Button asChild size="sm" variant="outline" className="w-full">
                <a href={`/api/proposals/${p.id}/pdf`} target="_blank" rel="noreferrer"><Download className="mr-1 h-3 w-3"/>PDF</a>
              </Button>
            </CardContent>
          </Card>
        ))}
        {(list.data ?? []).length === 0 && (
          <div className="md:col-span-3 rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">No proposals yet.</div>
        )}
      </div>
    </div>
  );
}
