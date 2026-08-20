import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Download, Sparkles, Loader2, Plus, Link2, RefreshCw, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { generateProposalNumber, formatMoney } from "@/lib/manyhats";
import { useServerFn } from "@tanstack/react-start";
import { writeScope } from "@/lib/scope-writer.functions";
import { calculatePricingEconomics } from "@/lib/estimate-pricing";
import { openStaffProposalPdf } from "@/lib/proposal-pdf.client";

export function ProjectProposal({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const proposal = useQuery({
    queryKey: ["proposal", projectId],
    queryFn: async () => (await supabase.from("proposals").select("*, proposal_options(*)").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle()).data,
  });
  const measurementsCount = useQuery({
    queryKey: ["measurements-confirmed-count", projectId],
    queryFn: async () => {
      const { count } = await supabase.from("measurements").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("is_confirmed", true);
      return count ?? 0;
    },
  });
  const pendingRecs = useQuery({
    queryKey: ["ai-recs-pending", projectId],
    queryFn: async () => {
      const { count } = await supabase.from("ai_estimate_recommendations").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "pending");
      return count ?? 0;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const seq = Math.floor(Math.random() * 900) + 100;
      const { data, error } = await supabase.from("proposals").insert({
        project_id: projectId,
        proposal_number: generateProposalNumber(seq),
        status: "draft",
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposal", projectId] }),
    onError: (e) => toast.error(e.message),
  });

  if (proposal.isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!proposal.data) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-4">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground"/>
          <div className="text-sm text-muted-foreground">No proposal yet for this project.</div>
          <Button onClick={() => create.mutate()}>Create proposal</Button>
        </CardContent>
      </Card>
    );
  }
  return <ProposalEditor proposal={proposal.data} confirmedCount={measurementsCount.data ?? 0} pendingRecCount={pendingRecs.data ?? 0} />;
}

function ProposalEditor({ proposal, confirmedCount, pendingRecCount }: { proposal: any; confirmedCount: number; pendingRecCount: number }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(proposal);
  const writeScopeFn = useServerFn(writeScope);
  const [aiBusy, setAiBusy] = useState(false);
  const [roughNotes, setRoughNotes] = useState("");
  const crewRates = useQuery({
    queryKey: ["crew-labor-rates"],
    queryFn: async () =>
      (
        await (supabase as any)
          .from("crew_labor_rates")
          .select("*")
          .eq("active", true)
          .order("employee_name")
      ).data ?? [],
  });
  const averageCrewPay =
    (crewRates.data?.length ?? 0) === 0
      ? 25
      : crewRates.data.reduce(
          (sum: number, rate: any) => sum + Number(rate.hourly_pay),
          0,
        ) / crewRates.data.length;
  const [tone, setTone] = useState<"professional" | "board_ready" | "grant_friendly">("professional");

  const save = useMutation({
    mutationFn: async () => {
      const nextStatus = form.status ?? proposal.status;
      const promoting = nextStatus !== "draft" && proposal.status === "draft";
      if (promoting && pendingRecCount > 0) {
        throw new Error(`Blocked: ${pendingRecCount} AI recommendation${pendingRecCount === 1 ? "" : "s"} still pending contractor review.`);
      }
      const { error } = await supabase.from("proposals").update({
        executive_summary: form.executive_summary, existing_conditions: form.existing_conditions,
        scope_of_work: form.scope_of_work, recommendation: form.recommendation,
        timeline: form.timeline, warranty_length: form.warranty_length,
        warranty_notes: form.warranty_notes, exclusions: form.exclusions,
        payment_terms: form.payment_terms, grant_friendly: form.grant_friendly,
        status: nextStatus,
      }).eq("id", proposal.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["proposal", proposal.project_id] }); toast.success("Saved."); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const addOption = useMutation({
    mutationFn: async ({ tier, price }: { tier: string; price: number }) => {
      await supabase.from("proposal_options").insert({ proposal_id: proposal.id, tier, title: `${tier} package`, price, sort_order: (proposal.proposal_options?.length ?? 0) + 1 });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposal", proposal.project_id] }),
  });

  async function runAi() {
    if (!roughNotes.trim()) { toast.error("Add some rough notes first."); return; }
    setAiBusy(true);
    try {
      const result = await writeScopeFn({ data: { rough_notes: roughNotes, tone } });
      setForm({
        ...form,
        executive_summary: result.executive_summary,
        existing_conditions: result.existing_conditions,
        scope_of_work: result.scope_of_work,
        recommendation: result.recommendation,
        warranty_notes: result.warranty,
        exclusions: result.exclusions,
      });
      toast.success("AI scope draft loaded into the form. Review and Save.");
    } catch (e: any) {
      toast.error(e.message ?? "AI generation failed");
    } finally {
      setAiBusy(false);
    }
  }

  const canMarkReady = confirmedCount > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="font-display flex items-center gap-3">
              <FileText className="h-5 w-5 text-gold"/>
              {proposal.proposal_number}
              <Badge variant="outline">{proposal.status}</Badge>
            </CardTitle>
            {!canMarkReady && (
              <p className="text-xs text-amber-700 mt-1">⚠ No confirmed measurements yet. Final pricing requires at least one confirmed measurement.</p>
            )}
            {pendingRecCount > 0 && (
              <p className="text-xs text-amber-700 mt-1">⚠ {pendingRecCount} AI recommendation{pendingRecCount === 1 ? "" : "s"} pending contractor approval. Review in the Estimate tab before sending.</p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <SendProposalButton proposalId={proposal.id} status={proposal.status} />
            <ClientLinkButtons proposalId={proposal.id} hasToken={!!proposal.portal_token} />
            <Button variant="outline" size="sm" onClick={() => openStaffProposalPdf(proposal.id).catch((error) => toast.error(error.message))}>
              <Download className="mr-1 h-4 w-4"/> PDF
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AI Scope Writer */}
          <details className="rounded-md border border-gold/40 bg-gold/5 p-3">
            <summary className="cursor-pointer text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-gold"/>AI Scope Writer</summary>
            <div className="mt-3 space-y-2">
              <Textarea rows={4} placeholder="Paste rough notes from the field. The AI will draft the executive summary, scope, conditions, recommendation, warranty, and exclusions in contractor-grade wording." value={roughNotes} onChange={(e) => setRoughNotes(e.target.value)} />
              <div className="flex items-center gap-2">
                <Select value={tone} onValueChange={(v) => setTone(v as any)}>
                  <SelectTrigger className="w-48"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="board_ready">Board-ready</SelectItem>
                    <SelectItem value="grant_friendly">Grant-friendly</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={runAi} disabled={aiBusy} size="sm">
                  {aiBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : <Sparkles className="mr-1 h-4 w-4"/>}
                  Generate
                </Button>
              </div>
            </div>
          </details>

          <Field label="Executive summary" value={form.executive_summary} onChange={(v) => setForm({ ...form, executive_summary: v })} />
          <Field label="Existing conditions" value={form.existing_conditions} onChange={(v) => setForm({ ...form, existing_conditions: v })} />
          <Field label="Scope of work" value={form.scope_of_work} onChange={(v) => setForm({ ...form, scope_of_work: v })} rows={5}/>
          <Field label="Recommendation" value={form.recommendation} onChange={(v) => setForm({ ...form, recommendation: v })} />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Timeline" value={form.timeline} onChange={(v) => setForm({ ...form, timeline: v })} rows={2}/>
            <Field label="Warranty length" value={form.warranty_length} onChange={(v) => setForm({ ...form, warranty_length: v })} rows={2}/>
          </div>
          <Field label="Warranty notes" value={form.warranty_notes} onChange={(v) => setForm({ ...form, warranty_notes: v })} />
          <Field label="Exclusions" value={form.exclusions} onChange={(v) => setForm({ ...form, exclusions: v })} />
          <Field label="Payment terms" value={form.payment_terms} onChange={(v) => setForm({ ...form, payment_terms: v })} />
          <div className="flex items-center gap-2">
            <Switch checked={form.grant_friendly} onCheckedChange={(v) => setForm({ ...form, grant_friendly: v })} id="gf" />
            <Label htmlFor="gf" className="text-xs">Grant / donation-friendly wording</Label>
          </div>
        </CardContent>
      </Card>

      <CrewLaborRatesPanel rates={crewRates.data ?? []} />

      {/* Options */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Good / Better / Best options</CardTitle>
          <div className="flex gap-1">
            {["Good", "Better", "Best"].map((t) => (
              <Button key={t} variant="outline" size="sm" onClick={() => addOption.mutate({ tier: t, price: 0 })}>
                <Plus className="mr-1 h-3 w-3"/>{t}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {(proposal.proposal_options ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((o: any) => (
              <ProposalOptionCard
                key={o.id}
                option={o}
                averageCrewPay={averageCrewPay}
              />
            ))}
            {(proposal.proposal_options ?? []).length === 0 && (
              <div className="md:col-span-3 rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                Add Good / Better / Best option cards above.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CrewLaborRatesPanel({ rates }: { rates: any[] }) {
  const qc = useQueryClient();
  const [employeeName, setEmployeeName] = useState("");
  const [hourlyPay, setHourlyPay] = useState("25");
  const [burdenPct, setBurdenPct] = useState("20");

  const addRate = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session expired. Sign in again.");
      const { error } = await (supabase as any)
        .from("crew_labor_rates")
        .insert({
          employee_name: employeeName.trim(),
          hourly_pay: Number(hourlyPay),
          labor_burden_pct: Number(burdenPct),
          created_by: user.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      setEmployeeName("");
      setHourlyPay("25");
      qc.invalidateQueries({ queryKey: ["crew-labor-rates"] });
      toast.success("Employee labor rate saved.");
    },
    onError: (error: any) => toast.error(error.message),
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("crew_labor_rates")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["crew-labor-rates"] }),
    onError: (error: any) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Contractor-only employee labor rates</CardTitle>
        <p className="text-xs text-muted-foreground">
          Enter each employee's actual hourly pay. If no active rate exists, pricing uses the $25/hour planning fallback.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="grid gap-2 sm:grid-cols-[1fr_130px_130px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            addRate.mutate();
          }}
        >
          <Input required value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} placeholder="Employee or crew name" />
          <Input required type="number" min="0" step="0.01" value={hourlyPay} onChange={(event) => setHourlyPay(event.target.value)} placeholder="Hourly pay" />
          <Input required type="number" min="0" max="200" step="1" value={burdenPct} onChange={(event) => setBurdenPct(event.target.value)} placeholder="Burden %" />
          <Button type="submit" disabled={addRate.isPending}>Add rate</Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {rates.map((rate) => (
            <Badge key={rate.id} variant="outline" className="gap-1 py-1">
              {rate.employee_name} · {formatMoney(Number(rate.hourly_pay))}/hr · {Number(rate.labor_burden_pct)}% burden
              <button type="button" onClick={() => deactivate.mutate(rate.id)} aria-label={`Deactivate ${rate.employee_name}`}>×</button>
            </Badge>
          ))}
          {rates.length === 0 && (
            <span className="text-xs text-muted-foreground">
              No employee rates entered—$25/hour fallback is active.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProposalOptionCard({
  option,
  averageCrewPay,
}: {
  option: any;
  averageCrewPay: number;
}) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState({
    title: option.title,
    description: option.description ?? "",
    price: String(option.price),
    is_recommended: option.is_recommended,
    estimated_material_cost: String(option.estimated_material_cost ?? 0),
    estimated_labor_hours: String(option.estimated_labor_hours ?? 0),
    labor_cost_rate: String(option.labor_cost_rate ?? 25),
    labor_burden_pct: String(option.labor_burden_pct ?? 20),
    estimated_other_cost: String(option.estimated_other_cost ?? 0),
    overhead_pct: String(option.overhead_pct ?? 10),
    target_margin_pct: String(option.target_margin_pct ?? 20),
    promotion_label: option.promotion_label ?? "",
    promotion_discount_pct: String(option.promotion_discount_pct ?? 0),
    estimated_days: String(option.estimated_days ?? ""),
    pricing_source_summary: option.pricing_source_summary ?? "",
  });

  const economics = calculatePricingEconomics({
    materialCost: Number(edit.estimated_material_cost) || 0,
    laborHours: Number(edit.estimated_labor_hours) || 0,
    hourlyPay:
      edit.labor_cost_rate.trim() === ""
        ? null
        : Number(edit.labor_cost_rate),
    laborBurdenPct: Number(edit.labor_burden_pct) || 0,
    otherCost: Number(edit.estimated_other_cost) || 0,
    overheadPct: Number(edit.overhead_pct) || 0,
    targetMarginPct: Number(edit.target_margin_pct) || 0,
    promotionDiscountPct: Number(edit.promotion_discount_pct) || 0,
  });

  const applyCalculatedPrice = () =>
    setEdit({
      ...edit,
      price: economics.clientPrice.toFixed(2),
    });

  const save = useMutation({
    mutationFn: async () => {
      await (supabase as any)
        .from("proposal_options")
        .update({
          title: edit.title,
          description: edit.description,
          price: Number(edit.price),
          is_recommended: edit.is_recommended,
          estimated_material_cost: Number(edit.estimated_material_cost) || 0,
          estimated_labor_hours: Number(edit.estimated_labor_hours) || 0,
          labor_cost_rate:
            edit.labor_cost_rate.trim() === ""
              ? 25
              : Number(edit.labor_cost_rate),
          labor_burden_pct: Number(edit.labor_burden_pct) || 0,
          estimated_other_cost: Number(edit.estimated_other_cost) || 0,
          overhead_pct: Number(edit.overhead_pct) || 0,
          target_margin_pct: Number(edit.target_margin_pct) || 0,
          promotion_label: edit.promotion_label.trim() || null,
          promotion_discount_pct:
            Number(edit.promotion_discount_pct) || 0,
          estimated_days:
            edit.estimated_days.trim() === ""
              ? null
              : Number(edit.estimated_days),
          pricing_source_summary:
            edit.pricing_source_summary.trim() || null,
          pricing_checked_at: new Date().toISOString(),
        })
        .eq("id", option.id);
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["proposal", option.proposal_id] }),
  });
  const del = useMutation({
    mutationFn: async () => { await supabase.from("proposal_options").delete().eq("id", option.id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposal", option.proposal_id] }),
  });
  return (
    <div className={`rounded-md border p-3 space-y-2 ${edit.is_recommended ? "border-gold ring-gold" : ""}`}>
      <Badge variant="outline" className="border-gold text-gold-foreground bg-gold/10">{option.tier}</Badge>
      <Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className="font-semibold"/>
      <Textarea rows={3} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} placeholder="What's included"/>
      <Input type="number" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} />
      <div className="text-lg font-display font-bold tabular-nums text-navy">{formatMoney(Number(edit.price))}</div>

      <details className="rounded-md border bg-muted/20 p-2">
        <summary className="cursor-pointer text-xs font-semibold">
          Contractor-only costs, labor & margin
        </summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <InternalNumber label="Materials" value={edit.estimated_material_cost} onChange={(value) => setEdit({ ...edit, estimated_material_cost: value })} prefix="$" />
          <InternalNumber label="Other direct costs" value={edit.estimated_other_cost} onChange={(value) => setEdit({ ...edit, estimated_other_cost: value })} prefix="$" />
          <InternalNumber label="Labor hours" value={edit.estimated_labor_hours} onChange={(value) => setEdit({ ...edit, estimated_labor_hours: value })} />
          <div>
            <InternalNumber label="Employee pay / hr" value={edit.labor_cost_rate} onChange={(value) => setEdit({ ...edit, labor_cost_rate: value })} prefix="$" hint="$25 fallback" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 h-6 px-1 text-[10px]"
              onClick={() =>
                setEdit({
                  ...edit,
                  labor_cost_rate: averageCrewPay.toFixed(2),
                })
              }
            >
              Use active crew average · {formatMoney(averageCrewPay)}/hr
            </Button>
          </div>
          <InternalNumber label="Labor burden" value={edit.labor_burden_pct} onChange={(value) => setEdit({ ...edit, labor_burden_pct: value })} suffix="%" />
          <InternalNumber label="Overhead" value={edit.overhead_pct} onChange={(value) => setEdit({ ...edit, overhead_pct: value })} suffix="%" />
          <InternalNumber label="Target margin" value={edit.target_margin_pct} onChange={(value) => setEdit({ ...edit, target_margin_pct: value })} suffix="%" />
          <InternalNumber label="Promotion discount" value={edit.promotion_discount_pct} onChange={(value) => setEdit({ ...edit, promotion_discount_pct: value })} suffix="%" />
          <InternalNumber label="Estimated work days" value={edit.estimated_days} onChange={(value) => setEdit({ ...edit, estimated_days: value })} />
          <div className="space-y-1">
            <Label className="text-[11px]">Promotion label</Label>
            <Input value={edit.promotion_label} onChange={(e) => setEdit({ ...edit, promotion_label: e.target.value })} placeholder="10% veteran metal-roof special" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-[11px]">Pricing sources</Label>
            <Input value={edit.pricing_source_summary} onChange={(e) => setEdit({ ...edit, pricing_source_summary: e.target.value })} placeholder="Local supplier quotes, contractor history, market range, national benchmark" />
          </div>
        </div>
        <div className="mt-3 grid gap-1 rounded bg-background p-2 text-xs">
          <CostRow label="Burdened labor" value={economics.burdenedLaborCost} />
          <CostRow label="Cost + overhead" value={economics.costBasis} />
          <CostRow label="Price before promotion" value={economics.priceBeforePromotion} />
          <CostRow label="Promotion impact" value={-economics.promotionDiscount} />
          <CostRow label="Projected gross profit" value={economics.grossProfit} />
          <div className="flex justify-between font-semibold">
            <span>Achieved margin</span>
            <span className={economics.achievedMarginPct < 10 ? "text-destructive" : "text-emerald-700"}>
              {economics.achievedMarginPct.toFixed(1)}%
            </span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={applyCalculatedPrice}>
            Apply calculated client price {formatMoney(economics.clientPrice)}
          </Button>
        </div>
      </details>

      <div className="flex items-center gap-2">
        <Switch checked={edit.is_recommended} onCheckedChange={(v) => setEdit({ ...edit, is_recommended: v })} id={`r-${option.id}`} />
        <Label htmlFor={`r-${option.id}`} className="text-xs">Recommended</Label>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => save.mutate()}>Save</Button>
        <Button size="sm" variant="ghost" onClick={() => del.mutate()}>Delete</Button>
      </div>
    </div>
  );
}

function InternalNumber({
  label,
  value,
  onChange,
  prefix,
  suffix,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}{hint ? ` · ${hint}` : ""}</Label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
        <Input type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{formatMoney(value)}</span>
    </div>
  );
}

function Field({ label, value, onChange, rows = 3 }: { label: string; value: any; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Textarea rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SendProposalButton({ proposalId, status }: { proposalId: string; status: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("send_proposal", { _proposal_id: proposalId });
      if (error) throw error;
      const r = data as any;
      if (r?.error) throw new Error(r.error);
      const url = `${window.location.origin}/portal/proposal/${r.token}`;
      await navigator.clipboard.writeText(url);

      // Attempt email delivery (requires RESEND_API_KEY to be configured)
      try {
        const { sendProposalEmailFn } = await import("@/lib/email.functions");
        await sendProposalEmailFn({ data: { proposal_id: proposalId } });
        toast.success("Proposal sent by email. Client link also copied.");
      } catch (emailErr: any) {
        const msg: string = emailErr?.message ?? "";
        if (msg.includes("RESEND_API_KEY")) {
          toast.success("Proposal marked sent. Client link copied. (Email not configured — set RESEND_API_KEY to enable email delivery.)");
        } else {
          toast.success("Proposal marked sent. Client link copied.");
          console.warn("[proposal send] Email delivery failed:", msg);
        }
      }

      qc.invalidateQueries({ queryKey: ["proposal"] });
    } catch (e: any) {
      toast.error(e.message ?? "Could not send");
    } finally { setBusy(false); }
  }
  const sent = status !== "draft";
  return (
    <Button size="sm" variant={sent ? "outline" : "default"} disabled={busy} onClick={send}>
      <Send className="mr-1 h-4 w-4"/>{sent ? "Resend link" : "Send proposal"}
    </Button>
  );
}

function ClientLinkButtons({ proposalId, hasToken }: { proposalId: string; hasToken: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function ensure(rotate: boolean) {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("ensure_proposal_portal_token", {
        _proposal_id: proposalId,
        _rotate: rotate,
      });
      if (error) throw error;
      const r = data as any;
      if (r?.error) throw new Error(r.error);
      const url = `${window.location.origin}/portal/proposal/${r.token}`;
      await navigator.clipboard.writeText(url);
      toast.success(rotate ? "New client link copied." : "Client link copied to clipboard.");
    } catch (e: any) {
      toast.error(e.message ?? "Could not create client link");
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    setBusy(true);
    try {
      const { error } = await (supabase.rpc as any)("revoke_proposal_portal_token", { _proposal_id: proposalId });
      if (error) throw error;
      toast.success("Client link revoked.");
      qc.invalidateQueries({ queryKey: ["proposal"] });
    } catch (e: any) { toast.error(e.message ?? "Could not revoke"); }
    finally { setBusy(false); }
  }
  return (
    <>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => ensure(false)}>
        <Link2 className="mr-1 h-4 w-4"/> Copy link
      </Button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => ensure(true)} title="Rotate link (invalidates old URL)">
        <RefreshCw className="h-4 w-4"/>
      </Button>
      {hasToken && (
        <Button variant="ghost" size="sm" disabled={busy} onClick={revoke} title="Revoke link">
          <XCircle className="h-4 w-4 text-destructive"/>
        </Button>
      )}
    </>
  );
}
