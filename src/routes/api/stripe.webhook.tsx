// Stripe webhook handler — records confirmed payments in the database.
// Route: POST /api/stripe/webhook

import { createAPIFileRoute } from "@tanstack/react-start/api";
import { getWebRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const APIRoute = createAPIFileRoute("/api/stripe/webhook")({
  POST: async () => {
    const req = getWebRequest();
    if (!req) return new Response("No request", { status: 500 });

    const body = await req.text();
    const sig = req.headers.get("stripe-signature") ?? "";

    const { constructWebhookEvent, getStripeWebhookSecret } = await import(
      "@/lib/stripe.server"
    );

    let event;
    try {
      event = constructWebhookEvent(body, sig, getStripeWebhookSecret());
    } catch (err: any) {
      console.error("[Stripe webhook] signature verification failed:", err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    if (event.type === "payment_intent.succeeded") {
      await handlePaymentSucceeded(event.data.object as any);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
});

async function handlePaymentSucceeded(intent: {
  id: string;
  amount: number;
  metadata: Record<string, string>;
}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[Stripe webhook] Missing Supabase environment variables");
    return;
  }

  const supabase = createClient<Database>(url, key);
  const meta = intent.metadata ?? {};
  const amountDollars = intent.amount / 100;

  // Handle invoice payment
  if (meta.type === "invoice_payment" || meta.type === "portal_invoice_payment") {
    const invoiceId = meta.invoice_id;
    if (!invoiceId) return;

    // Idempotency: skip if a payment with this Stripe intent ID already exists
    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("invoice_id", invoiceId)
      .eq("reference_number", intent.id)
      .maybeSingle();
    if (!existing) {
      // payments.project_id does not exist; derive it from the invoice FK
      await supabase.from("payments").insert({
        invoice_id: invoiceId,
        amount: amountDollars,
        payment_date: new Date().toISOString().slice(0, 10),
        payment_method: "stripe" as any,
        reference_number: intent.id,
        notes: "Stripe online payment",
      } as any);
    }

    // Recalculate invoice balance via the dedicated RPC
    const { error: rpcErr } = await (supabase.rpc as any)("recalculate_invoice_balance", {
      _invoice_id: invoiceId,
    });
    if (rpcErr) {
      console.error(`[Stripe webhook] recalculate_invoice_balance failed:`, rpcErr.message);
    }

    console.log(`[Stripe webhook] Recorded payment ${intent.id} for invoice ${invoiceId}`);
  }

  // Handle deposit payment
  if (meta.type === "deposit") {
    const depositId = meta.deposit_id;
    if (!depositId) return;

    // Idempotency: mark paid only if not already paid
    await supabase
      .from("deposits")
      .update({ status: "paid" as any, paid_at: new Date().toISOString() } as any)
      .eq("id", depositId)
      .neq("status" as any, "paid");

    console.log(`[Stripe webhook] Recorded deposit payment ${intent.id} for deposit ${depositId}`);
  }
}
