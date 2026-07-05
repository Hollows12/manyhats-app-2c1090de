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

// ---------------- AI Suggestions (Smart Pricing) ----------------

type RecMaterial = { name: string; quantity: number; unit: string; estimated_unit_cost?: number | null; notes?: string };
type RecPayload = {
  materials: RecMaterial[];
  labor_hours: number;
  equipment?: string[];
  travel_mi?: number;
  waste_pct?: number;
  contingency_pct?: number;
  markup_pct?: number;
  margin_pct?: number;
  price_range: { low: number; high: number };
  confidence: number;
  reasoning: string;
  disclaimers?: string[];
  applied_indexes?: number[];
};

function AISuggestionsPanel({ projectId, estimateId, existingLineCount }: { projectId: string; estimateId: string; existingLineCount: number }) {
  const qc = useQueryClient();
  const runRecommend = useServerFn(recommendEstimate);
  const runReview = useServerFn(reviewRecommendation);

  const rec = useQuery({
    queryKey: ["ai-rec", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_estimate_recommendations")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const generate = useMutation({
    mutationFn: () => runRecommend({ data: { project_id: projectId } }),
    onSuccess: () => { toast.success("AI recommendation generated. Review below."); qc.invalidateQueries({ queryKey: ["ai-rec", projectId] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const review = useMutation({
    mutationFn: (vars: { status: "approved" | "rejected"; notes?: string }) => runReview({ data: { id: rec.data!.id, ...vars } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-rec", projectId] }),
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const payload: RecPayload | null = rec.data?.payload as any ?? null;
  const applied = new Set<number>((payload?.applied_indexes ?? []) as number[]);

  const applyMaterial = useMutation({
    mutationFn: async ({ index, mat }: { index: number; mat: RecMaterial & { unit_cost: number; description: string } }) => {
      const { error } = await supabase.from("estimate_line_items").insert({
        estimate_id: estimateId,
        category: "material" as any,
        description: mat.description,
        quantity: mat.quantity,
        unit: mat.unit,
        unit_cost: mat.unit_cost,
        sort_order: existingLineCount + 1,
      });
      if (error) throw new Error(error.message);
      const next = Array.from(new Set([...(payload?.applied_indexes ?? []), index]));
      await supabase.from("ai_estimate_recommendations")
        .update({ payload: { ...(payload as any), applied_indexes: next } })
        .eq("id", rec.data!.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimate-lines", estimateId] });
      qc.invalidateQueries({ queryKey: ["ai-rec", projectId] });
      toast.success("Added to estimate.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const applyLabor = useMutation({
    mutationFn: async ({ hours, rate }: { hours: number; rate: number }) => {
      const { error } = await supabase.from("estimate_line_items").insert({
        estimate_id: estimateId,
        category: "labor" as any,
        description: `Labor (AI recommended)`,
        quantity: hours,
        unit: "hr",
        unit_cost: rate,
        sort_order: existingLineCount + 1,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estimate-lines", estimateId] });
      toast.success("Labor added.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <Card className="border-gold/40">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold"/>
          AI Suggestions (advisory — contractor approval required)
          {rec.data && <Badge variant="outline">{rec.data.status}</Badge>}
          {payload && <Badge variant="outline">confidence {(payload.confidence * 100).toFixed(0)}%</Badge>}
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => generate.mutate()} disabled={generate.isPending} title="Regenerate advisory recommendations from the current project scope, measurements, and cached pricing. Any prior pending suggestions are superseded; the proposal draft lock stays in effect until you review the new set.">
            {generate.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : <Sparkles className="mr-1 h-4 w-4"/>}
            {rec.data ? "Re-run AI recommendations" : "Generate AI recommendations"}
          </Button>

          {rec.data && rec.data.status === "pending" && (
            <>
              <Button size="sm" variant="outline" onClick={() => review.mutate({ status: "approved" })}>
                <Check className="mr-1 h-4 w-4"/>Approve all
              </Button>
              <Button size="sm" variant="ghost" onClick={() => review.mutate({ status: "rejected" })}>
                <X className="mr-1 h-4 w-4"/>Reject
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!rec.data && (
          <div className="rounded-md border border-dashed py-6 text-center text-muted-foreground">
            No AI recommendation yet. Generate one from the current project measurements, photos, and cached pricing.
          </div>
        )}
        {payload && (
          <>
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="text-xs uppercase text-muted-foreground mb-1">Reasoning</div>
              <p className="whitespace-pre-wrap text-sm">{payload.reasoning}</p>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <Stat label="Price range" value={`${formatMoney(payload.price_range.low)} – ${formatMoney(payload.price_range.high)}`} />
                <Stat label="Labor hrs" value={String(payload.labor_hours)} />
                <Stat label="Waste %" value={String(payload.waste_pct ?? 10)} />
                <Stat label="Markup %" value={String(payload.markup_pct ?? 20)} />
              </div>
              {(payload.disclaimers ?? []).length > 0 && (
                <ul className="mt-2 text-xs text-amber-700 list-disc pl-4">
                  {payload.disclaimers!.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              )}
            </div>

            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Materials</div>
              <div className="space-y-2">
                {payload.materials.map((m, i) => (
                  <MaterialRow key={i} idx={i} m={m} applied={applied.has(i)}
                    disabled={rec.data?.status === "rejected"}
                    onApply={(edited) => applyMaterial.mutate({ index: i, mat: edited })} />
                ))}
              </div>
            </div>

            <div className="rounded-md border p-3 flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Labor</div>
                <div className="text-sm">{payload.labor_hours} hrs recommended</div>
              </div>
              <LaborApply hours={payload.labor_hours} onApply={(rate) => applyLabor.mutate({ hours: payload.labor_hours, rate })} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded bg-background border px-2 py-1"><div className="text-[10px] text-muted-foreground uppercase">{label}</div><div className="font-semibold tabular-nums">{value}</div></div>;
}

function MaterialRow({ idx, m, applied, disabled, onApply }: { idx: number; m: RecMaterial; applied: boolean; disabled: boolean; onApply: (edited: RecMaterial & { unit_cost: number; description: string }) => void }) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(m.name);
  const [qty, setQty] = useState(String(m.quantity));
  const [unit, setUnit] = useState(m.unit);
  const [cost, setCost] = useState(String(m.estimated_unit_cost ?? ""));

  return (
    <div className={`rounded-md border p-2 ${applied ? "bg-emerald-50 border-emerald-300" : ""}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          {editing ? (
            <div className="grid gap-2 md:grid-cols-[2fr_60px_60px_100px]">
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
              <Input type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} />
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
              <Input type="number" step="0.01" placeholder="unit cost" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
          ) : (
            <>
              <div className="font-medium">{m.name} <span className="text-xs text-muted-foreground">· {m.quantity} {m.unit}</span></div>
              {m.notes && <div className="text-xs text-muted-foreground">{m.notes}</div>}
              <div className="text-xs">Suggested cost: {m.estimated_unit_cost != null ? formatMoney(m.estimated_unit_cost) : <em className="text-amber-700">no public price — enter manually</em>}</div>
            </>
          )}
        </div>
        <div className="flex gap-1">
          {applied ? (
            <Badge className="bg-emerald-600">Applied</Badge>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)} disabled={disabled}>
                <Pencil className="h-3 w-3"/>
              </Button>
              <Button size="sm" disabled={disabled || !cost} onClick={() => onApply({
                ...m,
                description: desc || m.name,
                quantity: Number(qty),
                unit: unit || m.unit,
                unit_cost: Number(cost),
              })}>
                <Check className="mr-1 h-3 w-3"/>Add
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LaborApply({ hours, onApply }: { hours: number; onApply: (rate: number) => void }) {
  const [rate, setRate] = useState("65");
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs">Rate $/hr</Label>
      <Input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} className="h-8 w-24"/>
      <Button size="sm" onClick={() => onApply(Number(rate))} disabled={!rate || !hours}>
        <Check className="mr-1 h-3 w-3"/>Add labor
      </Button>
    </div>
  );
}

