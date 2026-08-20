// Stripe webhook handler — records confirmed payments in the database.
// Route: POST /api/stripe/webhook

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const sig = request.headers.get("stripe-signature") ?? "";

        const { constructWebhookEvent, getStripeWebhookSecret } =
          await import("@/lib/stripe.server");

        let event;
        try {
          event = constructWebhookEvent(body, sig, getStripeWebhookSecret());
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Invalid webhook signature";
          console.error("[Stripe webhook] signature verification failed:", message);
          return new Response(`Webhook Error: ${message}`, { status: 400 });
        }

        if (event.type === "payment_intent.succeeded") {
          try {
            await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Payment processing failed";
            console.error("[Stripe webhook] payment processing failed:", message);
            return new Response("Webhook processing failed", { status: 500 });
          }
        }

        return Response.json({ received: true });
      },
    },
  },
});

async function handlePaymentSucceeded(intent: Stripe.PaymentIntent) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createClient<Database>(url, key);
  const meta = intent.metadata ?? {};
  const amountDollars = intent.amount / 100;
  const { data: attempt, error: attemptError } = await (supabase as any)
    .from("stripe_payment_attempts")
    .select("intent_id, target_type, target_id, expected_amount_cents, currency, processed_at")
    .eq("intent_id", intent.id)
    .single();
  if (attemptError || !attempt) throw new Error("Unknown Stripe payment intent");

  // Handle invoice payment
  if (meta.type === "invoice_payment" || meta.type === "portal_invoice_payment") {
    const invoiceId = meta.invoice_id;
    if (!invoiceId) return;

    const { data: invoice, error: invoiceError } = await (supabase as any)
      .from("invoices")
      .select("id, balance_due")
      .eq("id", invoiceId)
      .single();
    if (invoiceError || !invoice) throw new Error("Stripe invoice target not found");
    assertStripeBinding(intent, attempt, "invoice", invoiceId, Math.round(Number(invoice.balance_due) * 100));

    const { error: insertError } = await supabase.from("payments").insert({
      invoice_id: invoiceId,
      amount: amountDollars,
      payment_date: new Date().toISOString().slice(0, 10),
      payment_method: "stripe",
      reference_number: intent.id,
      notes: "Stripe online payment",
    });
    if (insertError) {
      // 23505 = unique_violation — payment already recorded, treat as success
      if (insertError.code === "23505") {
        console.log(
          `[Stripe webhook] Duplicate payment ${intent.id} for invoice ${invoiceId} — already recorded`,
        );
        return;
      }
      throw insertError;
    }

    console.log(`[Stripe webhook] Recorded payment ${intent.id} for invoice ${invoiceId}`);
  }

  // Handle deposit payment
  if (meta.type === "deposit") {
    const depositId = meta.deposit_id;
    if (!depositId) return;

    const { data: deposit, error: depositLookupError } = await (supabase as any)
      .from("deposits")
      .select("id, amount")
      .eq("id", depositId)
      .single();
    if (depositLookupError || !deposit) throw new Error("Stripe deposit target not found");
    assertStripeBinding(intent, attempt, "deposit", depositId, Math.round(Number(deposit.amount) * 100));

    // Idempotency: mark paid only if not already paid
    const { error: depositError } = await supabase
      .from("deposits")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", depositId)
      .neq("status", "paid");
    if (depositError) throw depositError;

    console.log(`[Stripe webhook] Recorded deposit payment ${intent.id} for deposit ${depositId}`);
  }

  await (supabase as any)
    .from("stripe_payment_attempts")
    .update({ processed_at: new Date().toISOString() })
    .eq("intent_id", intent.id);
}

export function assertStripeBinding(
  intent: Pick<Stripe.PaymentIntent, "id" | "amount" | "currency">,
  attempt: { intent_id: string; target_type: string; target_id: string; expected_amount_cents: number; currency: string },
  target: "invoice" | "deposit",
  targetId: string,
  authoritativeAmountCents: number,
) {
  if (intent.currency.toLowerCase() !== attempt.currency) throw new Error(`Unexpected ${target} currency`);
  if (attempt.intent_id !== intent.id || attempt.target_type !== target || attempt.target_id !== targetId) {
    throw new Error(`Unbound Stripe intent for ${target}`);
  }
  if (attempt.expected_amount_cents !== intent.amount || authoritativeAmountCents !== intent.amount) {
    throw new Error(`Stripe amount mismatch for ${target}`);
  }
}
