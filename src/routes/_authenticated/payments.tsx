import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney, formatDate } from "@/lib/manyhats";
import { PAYMENT_METHODS } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
});

function PaymentsPage() {
  const list = useQuery({
    queryKey: ["payments-list"],
    queryFn: async () =>
      (await supabase
        .from("payments")
        .select("*, invoices(invoice_number, projects(id, name, clients(name)))")
        .order("payment_date", { ascending: false })).data ?? [],
  });

  const total = (list.data ?? []).filter((p: any) => !p.is_void).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const label = (m: string) => PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m;

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Wallet className="h-7 w-7 text-gold" />Payments
        </h1>
        <p className="text-sm text-muted-foreground">Cash coming in, across every invoice.</p>
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Total received</div>
          <div className="font-display text-3xl font-bold text-emerald-700 tabular-nums">{formatMoney(total)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-muted/30">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Invoice</th>
                <th className="text-left px-3 py-2">Project</th>
                <th className="text-left px-3 py-2">Method</th>
                <th className="text-left px-3 py-2">Ref</th>
                <th className="text-right px-3 py-2">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(list.data ?? []).map((p: any) => (
                <tr key={p.id} className={p.is_void ? "opacity-40 line-through" : ""}>
                  <td className="px-3 py-2">{formatDate(p.payment_date)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.invoices?.invoice_number}</td>
                  <td className="px-3 py-2">
                    {p.invoices?.projects?.id ? (
                      <Link to="/projects/$id" params={{ id: p.invoices.projects.id }} className="hover:underline">
                        {p.invoices.projects.name}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">{label(p.payment_method)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{p.reference_number ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMoney(Number(p.amount))}</td>
                </tr>
              ))}
              {(list.data ?? []).length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No payments recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
