import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PROJECT_TYPE_LABEL, formatMoney } from "@/lib/manyhats";

export const Route = createFileRoute("/_authenticated/knowledge-base")({
  component: KnowledgePage,
});

function KnowledgePage() {
  const [search, setSearch] = useState("");
  const list = useQuery({
    queryKey: ["kb"],
    queryFn: async () => (await supabase.from("knowledge_entries").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const filtered = (list.data ?? []).filter((e: any) => !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.lessons_learned?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2"><BookOpen className="h-7 w-7 text-gold"/>Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">Past project intelligence. Powers smarter bids on the next job.</p>
        </div>
        <Input placeholder="Search projects, lessons…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((e: any) => (
          <Card key={e.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{e.title}</div>
                <Badge variant="outline">{PROJECT_TYPE_LABEL[e.project_type]}</Badge>
              </div>
              {e.final_scope && <p className="text-xs text-muted-foreground">{e.final_scope}</p>}
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div><div className="text-muted-foreground">Estimated</div><div className="font-semibold">{formatMoney(e.estimated_total)}</div></div>
                <div><div className="text-muted-foreground">Actual</div><div className="font-semibold">{formatMoney(e.actual_total)}</div></div>
                <div><div className="text-muted-foreground">Hours</div><div className="font-semibold">{e.labor_hours ?? "—"}</div></div>
                <div><div className="text-muted-foreground">Margin</div><div className="font-semibold">{e.margin_pct ? `${e.margin_pct}%` : "—"}</div></div>
              </div>
              {e.lessons_learned && (
                <div className="border-t pt-2"><div className="text-[10px] uppercase tracking-widest text-muted-foreground">Lessons learned</div><p className="text-xs mt-1">{e.lessons_learned}</p></div>
              )}
              {e.tags?.length > 0 && <div className="flex flex-wrap gap-1">{e.tags.map((t: string) => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{t}</span>)}</div>}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <div className="md:col-span-2 rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">No entries yet. Complete a job and add its lessons.</div>}
      </div>
    </div>
  );
}
