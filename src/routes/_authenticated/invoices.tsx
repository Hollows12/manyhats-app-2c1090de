import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney, formatDate } from "@/lib/manyhats";
import { INVOICE_STATUS_META } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/invoices")({
  component: InvoicesPage,
});

function InvoicesPage() {
  const list = useQuery({
    queryKey: ["invoices-list"],
    queryFn: async () =>
      (await supabase
        .from("invoices")
        .select("*, projects(id, name, clients(name))")
        .order("invoice_date", { ascending: false })).data ?? [],
  });
  const totals = (list.data ?? []).reduce(
    (acc, i: any) => {
      acc.total += Number(i.total);
      acc.outstanding += Number(i.balance_due);
      if (i.status === "paid") acc.paid += Number(i.total);
      return acc;
    },
    { total: 0, paid: 0, outstanding: 0 },
  );

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Receipt className="h-7 w-7 text-gold" />Invoices
        </h1>
        <p className="text-sm text-muted-foreground">Every invoice across every project.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Sum label="Total Invoiced" value={totals.total} />
        <Sum label="Paid" value={totals.paid} tone="emerald" />
        <Sum label="Outstanding" value={totals.outstanding} tone="amber" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(list.data ?? []).map((i: any) => {
          const meta = INVOICE_STATUS_META[i.status] ?? INVOICE_STATUS_META.draft;
          return (
            <Link key={i.id} to="/projects/$id" params={{ id: i.projects.id }}>
              <Card className="hover:border-gold transition-all">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{i.invoice_number}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>{meta.label}</span>
                  </div>
                  <div className="font-semibold text-sm">{i.projects?.name}</div>
                  <div className="text-xs text-muted-foreground">{i.projects?.clients?.name}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(i.invoice_date)}</div>
                  <div className="flex items-baseline justify-between pt-2">
                    <span className="font-display text-lg font-bold text-navy tabular-nums">{formatMoney(Number(i.total))}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">Bal {formatMoney(Number(i.balance_due))}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {(list.data ?? []).length === 0 && (
          <div className="md:col-span-3 rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            No invoices yet. Open a project's Financial tab to generate one from an approved proposal.
          </div>
        )}
      </div>
    </div>
  );
}

function Sum({ label, value, tone }: { label: string; value: number; tone?: string }) {
  const t = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-navy";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`font-display text-2xl font-bold tabular-nums ${t}`}>{formatMoney(value)}</div>
      </CardContent>
    </Card>
  );
}
