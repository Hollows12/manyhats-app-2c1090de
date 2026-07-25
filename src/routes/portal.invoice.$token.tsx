import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { AlertCircle, CheckCircle2, FileText, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney, formatDate } from "@/lib/manyhats";
import { INVOICE_STATUS_META } from "@/lib/finance";
import { createPortalInvoicePaymentIntent } from "@/lib/stripe.functions";

// ---------------------------------------------------------------------------
// Stripe publishable key — must be set in VITE_STRIPE_PUBLISHABLE_KEY env var
// ---------------------------------------------------------------------------
const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null;

type Payload = {
  invoice: {
    id: string;
    invoice_number: string;
    invoice_date: string;
    due_date?: string | null;
    subtotal: number;
    tax: number;
    total: number;
    balance_due: number;
    status: string;
    notes?: string | null;
    sent_at?: string | null;
    viewed_at?: string | null;
  };
  line_items: Array<{
    id: string;
    description: string;
    quantity: number;
    unit: string | null;
    unit_price: number;
    line_total: number;
    sort_order: number;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    payment_date: string;
    method: string | null;
    reference: string | null;
  }>;
  project: { name: string; address?: string | null; city_state_zip?: string | null };
  client_name?: string | null;
  error?: string;
};

export const Route = createFileRoute("/portal/invoice/$token")({
  head: () => ({
    meta: [
      { title: "Invoice — Customer Portal" },
      { name: "description", content: "View your invoice and payment status." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalInvoicePage,
  errorComponent: ({ error }) => (
    <Shell>
      <ErrorBox title="Something went wrong" body={error.message} />
    </Shell>
  ),
  notFoundComponent: () => (
    <Shell>
      <ErrorBox title="Invoice not found" body="This link is invalid or has been revoked." />
    </Shell>
  ),
});

function PortalInvoicePage() {
  const { token } = Route.useParams();

  useEffect(() => {
    // Fire-and-forget: mark as viewed
    (supabase.rpc as any)("portal_mark_invoice_viewed", { _token: token }).then(() => {});
  }, [token]);

  const q = useQuery({
    queryKey: ["portal-invoice", token],
    queryFn: async (): Promise<Payload> => {
      const { data, error } = await (supabase.rpc as any)("portal_get_invoice", { _token: token });
      if (error) throw error;
      return data as Payload;
    },
  });

  if (q.isLoading) {
    return (
      <Shell>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading invoice…
        </div>
      </Shell>
    );
  }

  const payload = q.data;
  if (!payload || payload.error) {
    const map: Record<string, { title: string; body: string }> = {
      not_found: { title: "Invoice not found", body: "This link is invalid or has been revoked." },
      expired: { title: "Link expired", body: "Please contact your contractor for a fresh link." },
      invalid_token: { title: "Invalid link", body: "This URL is malformed." },
    };
    const m = map[payload?.error ?? ""] ?? {
      title: "Unavailable",
      body: "This invoice isn't available right now.",
    };
    return (
      <Shell>
        <ErrorBox title={m.title} body={m.body} />
      </Shell>
    );
  }

  const { invoice, line_items, payments, project, client_name } = payload;
  const meta = INVOICE_STATUS_META[invoice.status] ?? { label: invoice.status, color: "" };
  const paidTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
  const isPaid = Number(invoice.balance_due) <= 0 && invoice.status !== "void";

  return (
    <Shell>
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">
            <FileText className="mr-1 h-3 w-3" />
            {invoice.invoice_number}
          </Badge>
          <Badge variant={isPaid ? "default" : "outline"} className="capitalize">
            {meta.label}
          </Badge>
          {invoice.sent_at && <span>Sent {formatDate(invoice.sent_at)}</span>}
          {invoice.due_date && <span>· Due {formatDate(invoice.due_date)}</span>}
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold">{project.name}</h1>
        {client_name && <p className="text-sm text-muted-foreground">Billed to {client_name}</p>}
        {(project.address || project.city_state_zip) && (
          <p className="text-xs text-muted-foreground">
            {[project.address, project.city_state_zip].filter(Boolean).join(" · ")}
          </p>
        )}
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Line items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {line_items.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground">No line items.</div>
            ) : (
              <div className="divide-y">
                {line_items.map((li) => (
                  <div
                    key={li.id}
                    className="grid grid-cols-12 items-start gap-2 px-4 py-2 text-sm"
                  >
                    <div className="col-span-7">
                      <div>{li.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {Number(li.quantity)} {li.unit ?? ""} × {formatMoney(Number(li.unit_price))}
                      </div>
                    </div>
                    <div className="col-span-5 text-right tabular-nums font-semibold">
                      {formatMoney(Number(li.line_total))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t px-4 py-3 space-y-1 text-sm">
              <Row label="Subtotal" value={formatMoney(Number(invoice.subtotal))} />
              {Number(invoice.tax) > 0 && (
                <Row label="Tax" value={formatMoney(Number(invoice.tax))} />
              )}
              <Row label="Total" value={formatMoney(Number(invoice.total))} bold />
              {paidTotal > 0 && (
                <Row label="Paid" value={`− ${formatMoney(paidTotal)}`} tone="emerald" />
              )}
              <Row
                label="Balance due"
                value={formatMoney(Number(invoice.balance_due))}
                bold
                tone={Number(invoice.balance_due) > 0 ? "amber" : "emerald"}
              />
            </div>
            {invoice.notes && (
              <div className="border-t px-4 py-3 text-xs text-muted-foreground whitespace-pre-wrap">
                {invoice.notes}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Payments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {payments.length === 0 && (
                <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
              )}
              {payments.map((p) => (
                <div key={p.id} className="rounded-md border p-2 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span>{formatMoney(Number(p.amount))}</span>
                    <span className="text-muted-foreground">{formatDate(p.payment_date)}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {p.method ?? "—"}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {isPaid && (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="flex items-center gap-2 py-4 text-sm text-emerald-800">
                <CheckCircle2 className="h-5 w-5" /> Paid in full. Thank you!
              </CardContent>
            </Card>
          )}

          {!isPaid && invoice.status !== "void" && (
            <PaymentSection
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoice_number}
              balanceDue={Number(invoice.balance_due)}
              portalToken={token}
              onSuccess={() => q.refetch()}
            />
          )}
        </div>
      </div>

      <p className="pt-4 text-center text-[11px] text-muted-foreground">
        <ShieldCheck className="inline h-3 w-3 mr-1" /> Secure link. Do not share this URL — anyone
        with it can view this invoice.
      </p>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Payment section — shown when balance is due
// ---------------------------------------------------------------------------

type PaymentSectionProps = {
  invoiceId: string;
  invoiceNumber: string;
  balanceDue: number;
  portalToken: string;
  onSuccess: () => void;
};

function PaymentSection({
  invoiceId,
  invoiceNumber,
  balanceDue,
  portalToken,
  onSuccess,
}: PaymentSectionProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    if (!stripePromise) {
      setCreateError("Online payment is not configured. Please contact your contractor.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const result = await createPortalInvoicePaymentIntent({
        data: { invoice_id: invoiceId, portal_token: portalToken },
      });
      setClientSecret(result.clientSecret!);
    } catch (e: any) {
      setCreateError(e.message ?? "Could not initialize payment");
    } finally {
      setCreating(false);
    }
  }, [invoiceId, portalToken]);

  if (!stripePromise) {
    return (
      <Card>
        <CardContent className="py-4 text-xs text-muted-foreground space-y-2">
          <div className="font-semibold text-foreground">Pay online</div>
          <div>
            Online payment is not currently available. Please contact your contractor to arrange
            payment for the remaining balance of <strong>{formatMoney(balanceDue)}</strong>.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!clientSecret) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Pay online
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            Balance due:{" "}
            <span className="font-semibold tabular-nums text-amber-700">
              {formatMoney(balanceDue)}
            </span>
          </div>
          {createError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{createError}</span>
            </div>
          )}
          <Button onClick={handleCreate} disabled={creating} className="w-full">
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Pay {formatMoney(balanceDue)} now
          </Button>
          <p className="text-[11px] text-muted-foreground">
            You will be charged {formatMoney(balanceDue)} for invoice {invoiceNumber}.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
      <PaymentForm
        balanceDue={balanceDue}
        invoiceNumber={invoiceNumber}
        onSuccess={onSuccess}
        onCancel={() => setClientSecret(null)}
      />
    </Elements>
  );
}

type PaymentFormProps = {
  balanceDue: number;
  invoiceNumber: string;
  onSuccess: () => void;
  onCancel: () => void;
};

function PaymentForm({ balanceDue, invoiceNumber, onSuccess, onCancel }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    setError(null);

    const { error: submitErr } = await elements.submit();
    if (submitErr) {
      setError(submitErr.message ?? "Form error");
      setSubmitting(false);
      return;
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error: confirmErr } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${origin}${window.location.pathname}?paid=1` },
      redirect: "if_required",
    });

    if (confirmErr) {
      setError(confirmErr.message ?? "Payment failed");
      setSubmitting(false);
    } else {
      setSucceeded(true);
      toast.success("Payment successful! Thank you.");
      setTimeout(onSuccess, 1500);
    }
  };

  if (succeeded) {
    return (
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="flex items-center gap-2 py-6 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5" /> Payment received! Refreshing your invoice…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          Pay {formatMoney(balanceDue)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-xs text-muted-foreground">
            Paying balance due for invoice <span className="font-mono">{invoiceNumber}</span>
          </div>
          <PaymentElement />
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={!stripe || !elements || submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {submitting ? "Processing…" : `Pay ${formatMoney(balanceDue)}`}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            <ShieldCheck className="inline h-3 w-3 mr-1" /> Payments are processed securely by
            Stripe.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "emerald" | "amber";
}) {
  const t = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "";
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""} ${t}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-8 md:py-12 space-y-6">{children}</div>
    </div>
  );
}

function ErrorBox({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardContent className="py-8 text-center space-y-2">
        <AlertCircle className="mx-auto h-8 w-8 text-amber-600" />
        <div className="font-display text-lg font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">{body}</div>
      </CardContent>
    </Card>
  );
}
