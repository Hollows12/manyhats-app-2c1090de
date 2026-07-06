import { useQuery } from "@tanstack/react-query";
import { Activity, FileText, Wallet, Ban, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/manyhats";
import { PAYMENT_METHODS } from "@/lib/finance";

type TimelineEvent = {
  id: string;
  at: string;
  kind: "invoice_created" | "payment_recorded" | "payment_voided";
  title: string;
  detail?: string;
  amount?: number;
  meta?: string;
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
      const [inv, pay] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, invoice_number, total, created_at, proposal_id, estimate_id, proposals(proposal_number, title), estimates(estimate_number)")
          .eq("project_id", projectId),
        supabase
          .from("payments")
          .select("id, amount, payment_date, method, reference_number, is_void, created_at, voided_at, invoice_id, invoices!inner(invoice_number, project_id)")
          .eq("invoices.project_id", projectId),
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
        events.push({
          id: `pay-${p.id}`,
          at: p.payment_date ?? p.created_at,
          kind: p.is_void ? "payment_voided" : "payment_recorded",
          title: p.is_void
            ? `Payment voided on ${inum}`
            : `Payment recorded on ${inum}`,
          detail: `${methodLabel(p.method)}${p.reference_number ? ` · Ref ${p.reference_number}` : ""}`,
          amount: Number(p.amount ?? 0),
        });
      }

      return events.sort((a, b) => +new Date(b.at) - +new Date(a.at));
    },
  });

  const events = q.data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4 text-gold" />
          Activity Timeline
        </CardTitle>
        <Badge variant="outline" className="tabular-nums">{events.length} event{events.length === 1 ? "" : "s"}</Badge>
      </CardHeader>
      <CardContent>
        {q.isLoading ? (
          <div className="text-xs text-muted-foreground">Loading activity…</div>
        ) : events.length === 0 ? (
          <div className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
            No financial activity yet. Generate an invoice or record a payment to start the log.
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

const ICONS = {
  invoice_created: { icon: Sparkles, dot: "bg-sky-600" },
  payment_recorded: { icon: Wallet, dot: "bg-emerald-600" },
  payment_voided: { icon: Ban, dot: "bg-slate-500" },
} satisfies Record<TimelineEvent["kind"], { icon: typeof FileText; dot: string }>;
