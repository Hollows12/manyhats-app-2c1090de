import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/manyhats";
import { generateInvoiceNumber } from "@/lib/finance";

type LineDraft = {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number; // 0..1
};

export function GenerateInvoiceDialog({
  projectId, proposal, disabled, onCreated,
}: {
  projectId: string;
  proposal: any | null;
  disabled?: boolean;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [taxPct, setTaxPct] = useState(0);

  // Load full context (project + client + latest estimate w/ items)
  const ctx = useQuery({
    enabled: open && !!proposal,
    queryKey: ["invoice-gen-context", projectId, proposal?.id],
    queryFn: async () => {
      const [{ data: project }, { data: estimate }] = await Promise.all([
        supabase
          .from("projects")
          .select("*, clients(*)")
          .eq("id", projectId)
          .maybeSingle(),
        supabase
          .from("estimates")
          .select("*, estimate_line_items(*)")
          .eq("project_id", projectId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return { project, estimate };
    },
  });

  // Hydrate drafts once ctx arrives
  useEffect(() => {
    if (!open || !ctx.data) return;
    const est = ctx.data.estimate;
    const items: any[] = est?.estimate_line_items ?? [];
    const rate = Number(est?.tax_pct ?? 0) / 100;
    setTaxPct(Number(est?.tax_pct ?? 0));

    if (items.length > 0) {
      setLines(
        items
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((li) => ({
            description: li.description,
            quantity: Number(li.quantity ?? 1),
            unit_price: Number(li.unit_cost ?? 0),
            tax_rate: rate,
          })),
      );
    } else {
      // Fall back to proposal's selected option as a single line
      const opt = (proposal?.proposal_options ?? []).find((o: any) => o.is_selected)
        ?? proposal?.proposal_options?.[0];
      const price = Number(opt?.price ?? proposal?.total ?? 0);
      setLines([{
        description: opt?.title ?? proposal?.title ?? "Contracted work",
        quantity: 1,
        unit_price: price,
        tax_rate: rate,
      }]);
    }

    // Default due date = today + 30 days
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setDueDate(d.toISOString().slice(0, 10));

    // Prefill notes with customer + job address
    const p = ctx.data.project;
    const c = p?.clients;
    const addr = [p?.job_address, [p?.city, p?.state, p?.zip].filter(Boolean).join(", ")]
      .filter(Boolean).join(" · ");
    const bill = c
      ? `Bill to: ${c.name}${c.email ? " <" + c.email + ">" : ""}${c.phone ? " · " + c.phone : ""}`
      : "";
    setNotes([bill, addr ? "Job site: " + addr : "", proposal?.title ? "Ref: " + proposal.title : ""]
      .filter(Boolean).join("\n"));
  }, [open, ctx.data, proposal]);

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.quantity * l.unit_price, 0),
    [lines],
  );
  const tax = useMemo(
    () => lines.reduce((s, l) => s + l.quantity * l.unit_price * l.tax_rate, 0),
    [lines],
  );
  const total = subtotal + tax;

  const create = useMutation({
    mutationFn: async () => {
      if (!proposal) throw new Error("No approved proposal available.");
      if (lines.length === 0) throw new Error("Add at least one line item.");
      const seq = Math.floor(Math.random() * 9000) + 1000;
      const { data: inv, error } = await supabase.from("invoices").insert({
        project_id: projectId,
        proposal_id: proposal.id,
        estimate_id: ctx.data?.estimate?.id ?? null,
        invoice_number: generateInvoiceNumber(seq),
        subtotal,
        tax,
        total,
        status: "draft",
        due_date: dueDate || null,
        notes: notes || null,
        is_final: false,
      }).select().single();
      if (error) throw error;

      const rows = lines.map((l, i) => ({
        invoice_id: inv.id,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        line_total: l.quantity * l.unit_price,
        tax_rate: l.tax_rate,
        sort_order: i + 1,
      }));
      const { error: liErr } = await supabase.from("invoice_line_items").insert(rows);
      if (liErr) throw liErr;
      return inv;
    },
    onSuccess: () => {
      toast.success("Invoice generated from proposal.");
      setOpen(false);
      onCreated();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const client = ctx.data?.project?.clients;
  const project = ctx.data?.project;
  const hasEstimate = !!ctx.data?.estimate;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}
        disabled={disabled || !proposal}>
        <Sparkles className="mr-1 h-3 w-3" />Generate from proposal
      </Button>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gold" />
            Generate invoice from approved proposal
          </DialogTitle>
          <DialogDescription>
            Line items, tax, and customer details are imported automatically. Review and edit before creating.
          </DialogDescription>
        </DialogHeader>

        {ctx.isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* Customer / project summary */}
            <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Customer</Badge>
                <span className="font-semibold">{client?.name ?? "—"}</span>
                {client?.email && <span className="text-muted-foreground">{client.email}</span>}
                {client?.phone && <span className="text-muted-foreground">· {client.phone}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Project</Badge>
                <span className="font-semibold">{project?.name}</span>
                {project?.job_address && <span className="text-muted-foreground">{project.job_address}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Proposal</Badge>
                <span className="font-semibold">{proposal?.title ?? proposal?.id?.slice(0, 8)}</span>
                <Badge variant="outline" className="capitalize">{proposal?.status}</Badge>
                {hasEstimate ? (
                  <Badge variant="outline">Estimate imported ({lines.length} line{lines.length === 1 ? "" : "s"})</Badge>
                ) : (
                  <Badge variant="outline">No estimate — using proposal price</Badge>
                )}
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Line items</Label>
                <Button size="sm" variant="ghost" onClick={() =>
                  setLines((ls) => [...ls, { description: "", quantity: 1, unit_price: 0, tax_rate: taxPct / 100 }])
                }>+ Add line</Button>
              </div>
              <div className="space-y-2">
                {lines.map((l, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <Input className="col-span-6" value={l.description}
                      onChange={(e) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} />
                    <Input className="col-span-2 tabular-nums" type="number" step="0.01" value={l.quantity}
                      onChange={(e) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, quantity: Number(e.target.value) } : x))} />
                    <Input className="col-span-3 tabular-nums" type="number" step="0.01" value={l.unit_price}
                      onChange={(e) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, unit_price: Number(e.target.value) } : x))} />
                    <Button size="sm" variant="ghost" className="col-span-1"
                      onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}>×</Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Tax + due date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tax rate (%)</Label>
                <Input type="number" step="0.01" value={taxPct}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setTaxPct(v);
                    setLines((ls) => ls.map((x) => ({ ...x, tax_rate: v / 100 })));
                  }} />
              </div>
              <div>
                <Label className="text-xs">Due date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {/* Totals */}
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
              <Row label="Subtotal" value={subtotal} />
              <Row label={`Tax (${taxPct}%)`} value={tax} />
              <div className="border-t pt-1">
                <Row label="Total" value={total} bold />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || ctx.isLoading}>
            {create.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
            Create invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{formatMoney(value)}</span>
    </div>
  );
}
