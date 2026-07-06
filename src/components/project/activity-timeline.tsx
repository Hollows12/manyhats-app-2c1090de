import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, FileText, Wallet, Ban, Sparkles, DollarSign, Layers, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/manyhats";
import { PAYMENT_METHODS, DEPOSIT_STATUS_META } from "@/lib/finance";

type EventKind =
  | "invoice_created"
  | "payment_recorded"
  | "payment_voided"
  | "deposit_recorded"
  | "deposit_paid"
  | "deposit_voided"
  | "progress_billing_recorded"
  | "progress_billing_approved"
  | "progress_billing_voided";

type TimelineEvent = {
  id: string;
  at: string;
  kind: EventKind;
  title: string;
  detail?: string;
  amount?: number;
};

function formatAt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

const methodLabel = (m?: string | null) =>
  PAYMENT_METHODS.find((p) => p.value === m)?.label ?? m ?? "—";

export function ActivityTimeline({ projectId }: { projectId: string }) {
  const q = useQuery({
    queryKey: ["project-activity-timeline", projectId],
    queryFn: async (): Promise<TimelineEvent[]> => {
      const [inv, pay, dep, pb] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, invoice_number, total, created_at, proposal_id, estimate_id, proposals(proposal_number, title), estimates(estimate_number)")
          .eq("project_id", projectId),
        supabase
          .from("payments")
          .select("id, amount, payment_date, method, reference_number, is_void, created_at, voided_at, invoice_id, invoices!inner(invoice_number, project_id)")
          .eq("invoices.project_id", projectId),
        supabase
          .from("deposits")
          .select("id, amount, percentage, status, paid_at, created_at, updated_at, proposals(proposal_number)")
          .eq("project_id", projectId),
        supabase
          .from("progress_billings")
          .select("id, billing_number, percent_complete, amount_due, retainage, status, approved_at, created_at, updated_at, invoices(invoice_number)")
          .eq("project_id", projectId),
      ]);

      const events: TimelineEvent[] = [];

      for (const i of (inv.data ?? []) as any[]) {
        const source =
          i.proposals?.proposal_number
            ? `proposal ${i.proposals.proposal_number}${i.proposals.title ? ` — ${i.proposals.title}` : ""}`
            : i.estimates?.estimate_number
              ? `estimate ${i.estimates.estimate_number}`
              : null;
        events.push({
          id: `inv-${i.id}`,
          at: i.created_at,
          kind: "invoice_created",
          title: `Invoice ${i.invoice_number} generated`,
          detail: source ? `From ${source}` : "Manual invoice",
          amount: Number(i.total ?? 0),
        });
      }

      for (const p of (pay.data ?? []) as any[]) {
        const inum = p.invoices?.invoice_number ?? "—";
        const when = p.is_void ? (p.voided_at ?? p.updated_at ?? p.created_at) : (p.payment_date ?? p.created_at);
        events.push({
          id: `pay-${p.id}`,
          at: when,
          kind: p.is_void ? "payment_voided" : "payment_recorded",
          title: p.is_void
            ? `Payment voided on ${inum}`
            : `Payment recorded on ${inum}`,
          detail: `${methodLabel(p.method)}${p.reference_number ? ` · Ref ${p.reference_number}` : ""}`,
          amount: Number(p.amount ?? 0),
        });
      }

      for (const d of (dep.data ?? []) as any[]) {
        const src = d.proposals?.proposal_number ? ` · proposal ${d.proposals.proposal_number}` : "";
        const pctLabel = d.percentage != null ? ` (${Number(d.percentage)}%)` : "";
        events.push({
          id: `dep-created-${d.id}`,
          at: d.created_at,
          kind: "deposit_recorded",
          title: `Deposit recorded${pctLabel}`,
          detail: `Status: ${DEPOSIT_STATUS_META[d.status]?.label ?? d.status}${src}`,
          amount: Number(d.amount ?? 0),
        });
        if (d.status === "paid" && d.paid_at) {
          events.push({
            id: `dep-paid-${d.id}`,
            at: d.paid_at,
            kind: "deposit_paid",
            title: `Deposit marked paid`,
            detail: `Received${src}`,
            amount: Number(d.amount ?? 0),
          });
        }
        if (d.status === "void") {
          events.push({
            id: `dep-void-${d.id}`,
            at: d.updated_at ?? d.created_at,
            kind: "deposit_voided",
            title: `Deposit voided`,
            detail: src ? `Voided${src}` : "Voided",
            amount: Number(d.amount ?? 0),
          });
        }
      }

      for (const b of (pb.data ?? []) as any[]) {
        const inv = b.invoices?.invoice_number ? ` · invoice ${b.invoices.invoice_number}` : "";
        const pct = `${Number(b.percent_complete ?? 0)}% complete`;
        const ret = Number(b.retainage ?? 0) > 0 ? ` · retainage ${formatMoney(Number(b.retainage))}` : "";
        events.push({
          id: `pb-created-${b.id}`,
          at: b.created_at,
          kind: "progress_billing_recorded",
          title: `Progress billing #${b.billing_number} recorded`,
          detail: `${pct}${ret}${inv}`,
          amount: Number(b.amount_due ?? 0),
        });
        if (b.status === "approved" && b.approved_at) {
          events.push({
            id: `pb-approved-${b.id}`,
            at: b.approved_at,
            kind: "progress_billing_approved",
            title: `Progress billing #${b.billing_number} approved`,
            detail: `${pct}${inv}`,
            amount: Number(b.amount_due ?? 0),
          });
        }
        if (b.status === "void") {
          events.push({
            id: `pb-void-${b.id}`,
            at: b.updated_at ?? b.created_at,
            kind: "progress_billing_voided",
            title: `Progress billing #${b.billing_number} voided`,
            detail: `${pct}${inv}`,
            amount: Number(b.amount_due ?? 0),
          });
        }
      }

      return events.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    },
  });

  const allEvents = q.data ?? [];
  const [filter, setFilter] = useState<FilterKey>("all");

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: allEvents.length, invoices: 0, payments: 0, deposits: 0, progress: 0 };
    for (const e of allEvents) c[categoryOf(e.kind)]++;
    return c;
  }, [allEvents]);

  const events = filter === "all" ? allEvents : allEvents.filter((e) => categoryOf(e.kind) === filter);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4 text-gold" />
          Activity Timeline
        </CardTitle>
        <Badge variant="outline" className="tabular-nums">{events.length} of {allEvents.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              className="h-7 px-2 text-xs"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="ml-1.5 rounded bg-background/20 px-1 text-[10px] tabular-nums">
                {counts[f.key]}
              </span>
            </Button>
          ))}
        </div>

        {q.isLoading ? (
          <div className="text-xs text-muted-foreground">Loading activity…</div>
        ) : events.length === 0 ? (
          <div className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
            {allEvents.length === 0
              ? "No financial activity yet. Generate an invoice or record a payment to start the log."
              : "No events match this filter."}
          </div>
        ) : (
          <ol className="relative border-l border-muted pl-5 space-y-4">
            {events.map((e) => {
              const meta = ICONS[e.kind];
              return (
                <li key={e.id} className="relative">
                  <span className={`absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-background ${meta.dot}`}>
                    <meta.icon className="h-3 w-3 text-white" />
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-sm font-medium">{e.title}</span>
                    {typeof e.amount === "number" && e.amount > 0 && (
                      <span className={`tabular-nums text-sm font-semibold ${e.kind === "payment_voided" ? "line-through text-muted-foreground" : "text-navy"}`}>
                        {formatMoney(e.amount)}
                      </span>
                    )}
                  </div>
                  {e.detail && (
                    <div className="text-xs text-muted-foreground">{e.detail}</div>
                  )}
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground/80 mt-0.5">
                    {formatAt(e.at)}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

type FilterKey = "all" | "invoices" | "payments" | "deposits" | "progress";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "invoices", label: "Invoices" },
  { key: "payments", label: "Payments" },
  { key: "deposits", label: "Deposits" },
  { key: "progress", label: "Progress" },
];

function categoryOf(kind: EventKind): Exclude<FilterKey, "all"> {
  if (kind.startsWith("invoice")) return "invoices";
  if (kind.startsWith("payment")) return "payments";
  if (kind.startsWith("deposit")) return "deposits";
  return "progress";
}

const ICONS = {
  invoice_created: { icon: Sparkles, dot: "bg-sky-600" },
  payment_recorded: { icon: Wallet, dot: "bg-emerald-600" },
  payment_voided: { icon: Ban, dot: "bg-slate-500" },
  deposit_recorded: { icon: DollarSign, dot: "bg-amber-600" },
  deposit_paid: { icon: CheckCircle2, dot: "bg-emerald-700" },
  deposit_voided: { icon: Ban, dot: "bg-slate-500" },
  progress_billing_recorded: { icon: Layers, dot: "bg-indigo-600" },
  progress_billing_approved: { icon: CheckCircle2, dot: "bg-emerald-700" },
  progress_billing_voided: { icon: Ban, dot: "bg-slate-500" },
} satisfies Record<TimelineEvent["kind"], { icon: typeof FileText; dot: string }>;
