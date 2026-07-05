import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Trash2, Calculator, Sparkles, Loader2, Check, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ESTIMATE_CATEGORIES, formatMoney } from "@/lib/manyhats";
import { useServerFn } from "@tanstack/react-start";
import { recommendEstimate, reviewRecommendation } from "@/lib/firecrawl/pricing.functions";

export function ProjectEstimate({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const estimate = useQuery({
    queryKey: ["estimate", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("estimates")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("estimates")
        .insert({ project_id: projectId, status: "draft" })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estimate", projectId] }),
  });

  if (estimate.isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!estimate.data) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-4">
          <Calculator className="mx-auto h-8 w-8 text-muted-foreground"/>
          <div className="text-sm text-muted-foreground">No estimate yet for this project.</div>
          <Button onClick={() => create.mutate()}>Create estimate</Button>
        </CardContent>
      </Card>
    );
  }
  return <EstimateEditor estimate={estimate.data} />;
}

function EstimateEditor({ estimate }: { estimate: any }) {
  const qc = useQueryClient();
  const lines = useQuery({
    queryKey: ["estimate-lines", estimate.id],
    queryFn: async () => (await supabase.from("estimate_line_items").select("*").eq("estimate_id", estimate.id).order("sort_order")).data ?? [],
  });

  const subtotal = useMemo(() => (lines.data ?? []).reduce((s: number, l: any) => s + Number(l.total ?? 0), 0), [lines.data]);
  const markup = subtotal * (Number(estimate.markup_pct) / 100);
  const contingency = subtotal * (Number(estimate.contingency_pct) / 100);
  const tax = (subtotal + markup + contingency) * (Number(estimate.tax_pct) / 100);
  const grand = subtotal + markup + contingency + tax;

  const [form, setForm] = useState({ category: "labor", description: "", quantity: "1", unit: "ea", unit_cost: "" });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("estimate_line_items").insert({
        estimate_id: estimate.id,
        category: form.category as any,
        description: form.description,
        quantity: Number(form.quantity),
        unit: form.unit,
        unit_cost: Number(form.unit_cost),
        sort_order: (lines.data?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estimate-lines", estimate.id] }); setForm({ ...form, description: "", quantity: "1", unit_cost: "" }); },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { await supabase.from("estimate_line_items").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estimate-lines", estimate.id] }),
  });

  const updatePct = useMutation({
    mutationFn: async (vals: any) => {
      await supabase.from("estimates").update(vals).eq("id", estimate.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estimate", estimate.project_id] }),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">


      <Card>
        <CardHeader>
          <CardTitle className="font-display">Estimate {estimate.estimate_number || estimate.id.slice(0, 8)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
                className="grid gap-2 rounded-md border p-3 md:grid-cols-[110px_2fr_70px_80px_100px_auto] md:items-end">
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{ESTIMATE_CATEGORIES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Description</Label><Input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/></div>
            <div><Label className="text-xs">Qty</Label><Input required type="number" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}/></div>
            <div><Label className="text-xs">Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}/></div>
            <div><Label className="text-xs">Unit cost</Label><Input required type="number" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}/></div>
            <Button type="submit" disabled={add.isPending}><Plus className="h-4 w-4"/></Button>
          </form>

          {(lines.data ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">No line items.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase">
                  <tr className="border-b"><th className="py-2 text-left">Category</th><th className="text-left">Description</th><th className="text-right">Qty</th><th>Unit</th><th className="text-right">Unit cost</th><th className="text-right">Total</th><th/></tr>
                </thead>
                <tbody className="divide-y">
                  {lines.data!.map((l: any) => (
                    <tr key={l.id}>
                      <td className="py-2 pr-2"><span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">{l.category}</span></td>
                      <td className="pr-2">{l.description}</td>
                      <td className="text-right tabular-nums">{l.quantity}</td>
                      <td className="text-center text-xs text-muted-foreground">{l.unit}</td>
                      <td className="text-right tabular-nums">{formatMoney(Number(l.unit_cost))}</td>
                      <td className="text-right tabular-nums font-semibold">{formatMoney(Number(l.total))}</td>
                      <td><Button size="sm" variant="ghost" onClick={() => remove.mutate(l.id)}><Trash2 className="h-3 w-3"/></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="self-start">
        <CardHeader><CardTitle className="text-sm">Totals</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Subtotal" value={subtotal} />
          <PctRow label="Markup" value={estimate.markup_pct} amount={markup}
                  onChange={(v) => updatePct.mutate({ markup_pct: v })} />
          <PctRow label="Contingency" value={estimate.contingency_pct} amount={contingency}
                  onChange={(v) => updatePct.mutate({ contingency_pct: v })} />
          <PctRow label="Tax" value={estimate.tax_pct} amount={tax}
                  onChange={(v) => updatePct.mutate({ tax_pct: v })} />
          <div className="border-t pt-3 flex items-end justify-between">
            <div className="text-xs text-muted-foreground uppercase tracking-widest">Grand Total</div>
            <div className="font-display text-2xl font-bold tabular-nums text-navy">{formatMoney(grand)}</div>
          </div>
        </CardContent>
      </Card>
      </div>
      <AISuggestionsPanel projectId={estimate.project_id} estimateId={estimate.id} existingLineCount={lines.data?.length ?? 0} />
    </div>
  );
}


function Row({ label, value }: { label: string; value: number }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="tabular-nums">{formatMoney(value)}</span></div>;
}
function PctRow({ label, value, amount, onChange }: { label: string; value: number; amount: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Input type="number" step="0.1" value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-7 w-16 text-right" />
        <span className="text-xs text-muted-foreground">%</span>
        <span className="tabular-nums w-20 text-right">{formatMoney(amount)}</span>
      </div>
    </div>
  );
}
