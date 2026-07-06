import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  DollarSign, FileText, Receipt, TrendingUp, Plus, Trash2,
  Printer, Ban, Wallet, Percent, AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatMoney, formatDate } from "@/lib/manyhats";
import {
  INVOICE_STATUS_META, DEPOSIT_STATUS_META, PAYMENT_METHODS,
  generateInvoiceNumber, type ProfitSnapshot,
} from "@/lib/finance";

export function ProjectFinancial({ projectId }: { projectId: string }) {
  const qc = useQueryClient();

  const snapshot = useQuery({
    queryKey: ["project-profit-snapshot", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("project_profit_snapshot", { _project_id: projectId });
      if (error) throw error;
      return data as unknown as ProfitSnapshot;
    },
  });

  const invoices = useQuery({
    queryKey: ["project-invoices", projectId],
    queryFn: async () =>
      (await supabase
        .from("invoices")
        .select("*, invoice_line_items(*), payments(*)")
        .eq("project_id", projectId)
        .order("invoice_date", { ascending: false })).data ?? [],
  });

  const deposits = useQuery({
    queryKey: ["project-deposits", projectId],
    queryFn: async () =>
      (await supabase.from("deposits").select("*").eq("project_id", projectId).order("created_at")).data ?? [],
  });

  const progress = useQuery({
    queryKey: ["project-progress-billings", projectId],
    queryFn: async () =>
      (await supabase.from("progress_billings").select("*").eq("project_id", projectId).order("billing_number")).data ?? [],
  });

  const acceptedProposal = useQuery({
    queryKey: ["project-accepted-proposal", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("proposals")
        .select("*, proposal_options(*)")
        .eq("project_id", projectId)
        .in("status", ["approved"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["project-invoices", projectId] });
    qc.invalidateQueries({ queryKey: ["project-profit-snapshot", projectId] });
    qc.invalidateQueries({ queryKey: ["project-deposits", projectId] });
    qc.invalidateQueries({ queryKey: ["project-progress-billings", projectId] });
  }

  const snap = snapshot.data;
  const outstanding = (snap?.invoiced_revenue ?? 0) - (snap?.paid_revenue ?? 0);

  return (
    <div className="space-y-6">
      {/* KPI STRIP */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={FileText} label="Approved Revenue" value={formatMoney(snap?.approved_revenue ?? 0)} tone="navy" />
        <Kpi icon={Receipt} label="Invoiced" value={formatMoney(snap?.invoiced_revenue ?? 0)} tone="sky" />
        <Kpi icon={Wallet} label="Paid" value={formatMoney(snap?.paid_revenue ?? 0)} tone="emerald" />
        <Kpi icon={AlertCircle} label="Outstanding" value={formatMoney(outstanding)} tone={outstanding > 0 ? "amber" : "slate"} />
      </div>

      {/* PROFIT PANEL */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-gold" />
            Real-Time Profit
          </CardTitle>
          <Badge variant="outline" className="tabular-nums">
            <Percent className="mr-1 h-3 w-3" />
            {(snap?.profit_margin_pct ?? 0).toFixed(1)}% margin
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <ProfitTile label="Estimated Cost" value={snap?.estimated_cost ?? 0} muted />
            <ProfitTile label="Actual Cost" value={snap?.actual_cost ?? 0} muted />
            <ProfitTile label="Gross Profit" value={snap?.gross_profit ?? 0} highlight />
            <ProfitTile label="Net Profit (paid)" value={snap?.net_profit ?? 0} highlight />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Variance (approved − estimate, cost adjusted)</span>
            <span className={`tabular-nums font-semibold ${(snap?.variance ?? 0) < 0 ? "text-destructive" : "text-emerald-700"}`}>
              {formatMoney(snap?.variance ?? 0)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* DEPOSITS */}
      <DepositsSection projectId={projectId} proposalId={acceptedProposal.data?.id ?? null}
        deposits={deposits.data ?? []} onChanged={invalidateAll} />

      {/* INVOICES */}
      <InvoicesSection projectId={projectId} proposal={acceptedProposal.data}
        invoices={invoices.data ?? []} onChanged={invalidateAll} />

      {/* PROGRESS BILLINGS */}
      <ProgressBillingsSection projectId={projectId} items={progress.data ?? []} onChanged={invalidateAll} />
    </div>
  );
}

/* -------------------- Sections -------------------- */

function DepositsSection({ projectId, proposalId, deposits, onChanged }: {
  projectId: string; proposalId: string | null; deposits: any[]; onChanged: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [pct, setPct] = useState("");
  const [open, setOpen] = useState(false);

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("deposits").insert({
        project_id: projectId,
        proposal_id: proposalId,
        amount: Number(amount) || 0,
        percentage: pct ? Number(pct) : null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deposit added."); setOpen(false); setAmount(""); setPct(""); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deposits").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deposit marked paid."); onChanged(); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { await supabase.from("deposits").delete().eq("id", id); },
    onSuccess: onChanged,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm"><DollarSign className="h-4 w-4 text-gold" />Deposits</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-1 h-3 w-3" />Add deposit</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New deposit</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
              <div><Label>Percentage (optional)</Label><Input type="number" value={pct} onChange={(e) => setPct(e.target.value)} /></div>
            </div>
            <DialogFooter><Button onClick={() => add.mutate()} disabled={add.isPending}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {deposits.length === 0 ? (
          <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">No deposits yet.</div>
        ) : (
          <div className="divide-y text-sm">
            {deposits.map((d) => {
              const meta = DEPOSIT_STATUS_META[d.status] ?? DEPOSIT_STATUS_META.pending;
              return (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                    <span className="tabular-nums font-semibold">{formatMoney(Number(d.amount))}</span>
                    {d.percentage != null && <span className="text-xs text-muted-foreground">({d.percentage}%)</span>}
                    {d.paid_at && <span className="text-xs text-muted-foreground">Paid {formatDate(d.paid_at)}</span>}
                  </div>
                  <div className="flex gap-1">
                    {d.status !== "paid" && (
                      <Button size="sm" variant="outline" onClick={() => markPaid.mutate(d.id)}>Mark paid</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(d.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InvoicesSection({ projectId, proposal, invoices, onChanged }: {
  projectId: string; proposal: any; invoices: any[]; onChanged: () => void;
}) {
  const generateFromProposal = useMutation({
    mutationFn: async () => {
      if (!proposal) throw new Error("Approve a proposal before generating an invoice.");
      const selected = (proposal.proposal_options ?? []).find((o: any) => o.is_selected)
        ?? proposal.proposal_options?.[0];
      const total = Number(selected?.price ?? 0);
      const seq = Math.floor(Math.random() * 9000) + 1000;
      const { data: inv, error } = await supabase.from("invoices").insert({
        project_id: projectId,
        proposal_id: proposal.id,
        invoice_number: generateInvoiceNumber(seq),
        subtotal: total,
        tax: 0,
        total,
        status: "draft",
        is_final: false,
      }).select().single();
      if (error) throw error;
      // Copy proposal scope as a single line item
      if (selected) {
        await supabase.from("invoice_line_items").insert({
          invoice_id: inv.id,
          description: selected.title ?? "Contracted work",
          quantity: 1,
          unit_price: total,
          line_total: total,
          sort_order: 1,
        });
      }
      return inv;
    },
    onSuccess: () => { toast.success("Invoice generated from proposal."); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  const createBlank = useMutation({
    mutationFn: async () => {
      const seq = Math.floor(Math.random() * 9000) + 1000;
      const { error } = await supabase.from("invoices").insert({
        project_id: projectId,
        invoice_number: generateInvoiceNumber(seq),
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Blank invoice created."); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm"><Receipt className="h-4 w-4 text-gold" />Invoices</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => generateFromProposal.mutate()}
            disabled={!proposal || generateFromProposal.isPending}>
            <FileText className="mr-1 h-3 w-3" />From proposal
          </Button>
          <Button size="sm" variant="ghost" onClick={() => createBlank.mutate()}>
            <Plus className="mr-1 h-3 w-3" />Blank
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
            No invoices yet. {proposal ? "Generate one from the approved proposal above." : "Approve a proposal to generate an invoice automatically."}
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv) => (
              <InvoiceCard key={inv.id} invoice={inv} onChanged={onChanged} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InvoiceCard({ invoice, onChanged }: { invoice: any; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const meta = INVOICE_STATUS_META[invoice.status] ?? INVOICE_STATUS_META.draft;
  const paid = (invoice.payments ?? []).filter((p: any) => !p.is_void).reduce((s: number, p: any) => s + Number(p.amount), 0);

  const voidInv = useMutation({
    mutationFn: async () => {
      await supabase.from("invoices").update({ status: "void" }).eq("id", invoice.id);
    },
    onSuccess: () => { toast.success("Invoice voided."); onChanged(); },
  });

  const remove = useMutation({
    mutationFn: async () => { await supabase.from("invoices").delete().eq("id", invoice.id); },
    onSuccess: () => { toast.success("Invoice deleted."); onChanged(); },
  });

  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${meta.color}`}>{meta.label}</span>
          <button className="text-sm font-semibold hover:underline" onClick={() => setOpen((o) => !o)}>
            {invoice.invoice_number}
          </button>
          <span className="text-xs text-muted-foreground">{formatDate(invoice.invoice_date)}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-xs">
            <div className="tabular-nums font-semibold">{formatMoney(Number(invoice.total))}</div>
            <div className="text-muted-foreground">Balance: <span className="tabular-nums font-semibold">{formatMoney(Number(invoice.balance_due))}</span></div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setPayOpen(true)} disabled={invoice.status === "void" || Number(invoice.balance_due) <= 0}>
            <Wallet className="mr-1 h-3 w-3" />Record payment
          </Button>
          <Button size="sm" variant="ghost" onClick={() => window.print()}>
            <Printer className="h-3 w-3" />
          </Button>
          {invoice.status !== "void" && (
            <Button size="sm" variant="ghost" onClick={() => voidInv.mutate()}><Ban className="h-3 w-3" /></Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => remove.mutate()}><Trash2 className="h-3 w-3" /></Button>
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-3 border-t pt-3">
          <InvoiceLineItems invoice={invoice} onChanged={onChanged} />
          {(invoice.payments ?? []).length > 0 && (
            <div className="rounded-md bg-muted/30 p-2 text-xs">
              <div className="mb-1 font-semibold">Payments</div>
              {invoice.payments.map((p: any) => (
                <PaymentRow key={p.id} payment={p} onChanged={onChanged} />
              ))}
              <div className="mt-1 flex justify-between border-t pt-1">
                <span>Total paid</span>
                <span className="tabular-nums font-semibold">{formatMoney(paid)}</span>
              </div>
            </div>
          )}
        </div>
      )}
      <RecordPaymentDialog open={payOpen} onOpenChange={setPayOpen} invoiceId={invoice.id}
        balanceDue={Number(invoice.balance_due)} onChanged={onChanged} />
    </div>
  );
}

function InvoiceLineItems({ invoice, onChanged }: { invoice: any; onChanged: () => void }) {
  const qc = useQueryClient();
  const items: any[] = invoice.invoice_line_items ?? [];

  const recompute = async (invoiceId: string) => {
    const { data } = await supabase.from("invoice_line_items").select("line_total,tax_rate,quantity,unit_price").eq("invoice_id", invoiceId);
    const subtotal = (data ?? []).reduce((s, r) => s + Number(r.quantity) * Number(r.unit_price), 0);
    const tax = (data ?? []).reduce((s, r) => s + Number(r.quantity) * Number(r.unit_price) * Number(r.tax_rate ?? 0), 0);
    await supabase.from("invoices").update({ subtotal, tax, total: subtotal + tax }).eq("id", invoiceId);
  };

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("invoice_line_items").insert({
        invoice_id: invoice.id,
        description: "New line item",
        quantity: 1,
        unit_price: 0,
        line_total: 0,
        sort_order: items.length + 1,
      });
      if (error) throw error;
      await recompute(invoice.id);
    },
    onSuccess: onChanged,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      if (patch.quantity != null || patch.unit_price != null || patch.tax_rate != null) {
        const row = items.find((r) => r.id === id);
        const q = Number(patch.quantity ?? row.quantity);
        const u = Number(patch.unit_price ?? row.unit_price);
        patch.line_total = q * u;
      }
      await supabase.from("invoice_line_items").update(patch).eq("id", id);
      await recompute(invoice.id);
    },
    onSuccess: onChanged,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("invoice_line_items").delete().eq("id", id);
      await recompute(invoice.id);
    },
    onSuccess: onChanged,
  });

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b"><th className="text-left py-1">Description</th><th className="text-right">Qty</th><th className="text-right">Unit</th><th className="text-right">Total</th><th></th></tr>
          </thead>
          <tbody className="divide-y">
            {items.sort((a, b) => a.sort_order - b.sort_order).map((r) => (
              <tr key={r.id}>
                <td className="py-1"><Input defaultValue={r.description} className="h-7 text-xs" onBlur={(e) => update.mutate({ id: r.id, patch: { description: e.target.value } })} /></td>
                <td><Input type="number" defaultValue={r.quantity} className="h-7 w-16 text-right text-xs" onBlur={(e) => update.mutate({ id: r.id, patch: { quantity: Number(e.target.value) } })} /></td>
                <td><Input type="number" defaultValue={r.unit_price} className="h-7 w-24 text-right text-xs" onBlur={(e) => update.mutate({ id: r.id, patch: { unit_price: Number(e.target.value) } })} /></td>
                <td className="text-right tabular-nums font-semibold">{formatMoney(Number(r.line_total))}</td>
                <td><Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)}><Trash2 className="h-3 w-3" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button size="sm" variant="ghost" className="mt-2" onClick={() => add.mutate()}>
        <Plus className="mr-1 h-3 w-3" />Add line
      </Button>
    </div>
  );
}

function PaymentRow({ payment, onChanged }: { payment: any; onChanged: () => void }) {
  const voidPay = useMutation({
    mutationFn: async () => {
      await supabase.from("payments").update({ is_void: true, voided_at: new Date().toISOString() }).eq("id", payment.id);
    },
    onSuccess: () => { toast.success("Payment voided."); onChanged(); },
  });
  const method = PAYMENT_METHODS.find((m) => m.value === payment.payment_method)?.label ?? payment.payment_method;
  return (
    <div className={`flex items-center justify-between py-0.5 ${payment.is_void ? "opacity-50 line-through" : ""}`}>
      <span>{formatDate(payment.payment_date)} · {method}{payment.reference_number ? ` · ${payment.reference_number}` : ""}</span>
      <span className="flex items-center gap-2">
        <span className="tabular-nums font-semibold">{formatMoney(Number(payment.amount))}</span>
        {!payment.is_void && <Button size="sm" variant="ghost" onClick={() => voidPay.mutate()}><Ban className="h-3 w-3" /></Button>}
      </span>
    </div>
  );
}

function RecordPaymentDialog({ open, onOpenChange, invoiceId, balanceDue, onChanged }: {
  open: boolean; onOpenChange: (o: boolean) => void; invoiceId: string; balanceDue: number; onChanged: () => void;
}) {
  const [amount, setAmount] = useState(String(balanceDue));
  const [method, setMethod] = useState("check");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const record = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("payments").insert({
        invoice_id: invoiceId,
        payment_date: date,
        payment_method: method as any,
        reference_number: reference || null,
        amount: Number(amount),
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Payment recorded."); onChanged(); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <div>
            <Label>Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Reference #</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Check #, txn ID, …" /></div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => record.mutate()} disabled={record.isPending || !Number(amount)}>Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProgressBillingsSection({ projectId, items, onChanged }: {
  projectId: string; items: any[]; onChanged: () => void;
}) {
  const add = useMutation({
    mutationFn: async () => {
      const nextNumber = items.length + 1;
      const { error } = await supabase.from("progress_billings").insert({
        project_id: projectId,
        billing_number: nextNumber,
        percent_complete: 0,
        amount_due: 0,
        retainage: 0,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: onChanged,
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      await supabase.from("progress_billings").update(patch).eq("id", id);
    },
    onSuccess: onChanged,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { await supabase.from("progress_billings").delete().eq("id", id); },
    onSuccess: onChanged,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm"><Percent className="h-4 w-4 text-gold" />Progress Billing</CardTitle>
        <Button size="sm" variant="outline" onClick={() => add.mutate()}><Plus className="mr-1 h-3 w-3" />Add draw</Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
            Use progress billing for phased projects — track percent complete and retainage per draw.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b"><th className="text-left py-2">Draw</th><th className="text-right">% Complete</th><th className="text-right">Amount Due</th><th className="text-right">Retainage</th><th className="text-right">Status</th><th></th></tr>
              </thead>
              <tbody className="divide-y">
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 font-semibold">#{r.billing_number}</td>
                    <td className="text-right"><Input type="number" defaultValue={r.percent_complete} className="ml-auto h-7 w-20 text-right text-xs" onBlur={(e) => update.mutate({ id: r.id, patch: { percent_complete: Number(e.target.value) } })} /></td>
                    <td className="text-right"><Input type="number" defaultValue={r.amount_due} className="ml-auto h-7 w-28 text-right text-xs" onBlur={(e) => update.mutate({ id: r.id, patch: { amount_due: Number(e.target.value) } })} /></td>
                    <td className="text-right"><Input type="number" defaultValue={r.retainage} className="ml-auto h-7 w-24 text-right text-xs" onBlur={(e) => update.mutate({ id: r.id, patch: { retainage: Number(e.target.value) } })} /></td>
                    <td className="text-right">
                      <Select value={r.status} onValueChange={(v) => update.mutate({ id: r.id, patch: { status: v } })}>
                        <SelectTrigger className="ml-auto h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["draft", "pending_approval", "approved", "invoiced", "paid", "void"].map((s) => (
                            <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td><Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)}><Trash2 className="h-3 w-3" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------- Tiny components -------------------- */

function Kpi({ icon: Icon, label, value, tone }: any) {
  const tones: Record<string, string> = {
    navy: "text-navy", sky: "text-sky-700", emerald: "text-emerald-700",
    amber: "text-amber-700", slate: "text-slate-700",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3 w-3" />{label}</div>
        <div className={`font-display text-2xl font-bold tabular-nums ${tones[tone] ?? ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function ProfitTile({ label, value, muted, highlight }: { label: string; value: number; muted?: boolean; highlight?: boolean }) {
  const positive = value >= 0;
  return (
    <div className={`rounded-md border p-3 ${highlight ? "border-gold/40 bg-gold/5" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-lg font-bold tabular-nums ${muted ? "text-slate-700" : positive ? "text-emerald-700" : "text-destructive"}`}>
        {formatMoney(value)}
      </div>
    </div>
  );
}
