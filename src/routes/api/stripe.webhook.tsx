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

  // Handle invoice payment
  if (meta.type === "invoice_payment" || meta.type === "portal_invoice_payment") {
    const invoiceId = meta.invoice_id;
    if (!invoiceId) return;

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

    // Recalculate invoice balance via the dedicated RPC
    const invokeRpc = supabase.rpc as unknown as (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>;
    const { error: rpcErr } = await invokeRpc("recalculate_invoice_balance", {
      _invoice_id: invoiceId,
    });
    if (rpcErr) {
      throw rpcErr;
    }

    console.log(`[Stripe webhook] Recorded payment ${intent.id} for invoice ${invoiceId}`);
  }

  // Handle deposit payment
  if (meta.type === "deposit") {
    const depositId = meta.deposit_id;
    if (!depositId) return;

    // Idempotency: mark paid only if not already paid
    const { error: depositError } = await supabase
      .from("deposits")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", depositId)
      .neq("status", "paid");
    if (depositError) throw depositError;

    console.log(`[Stripe webhook] Recorded deposit payment ${intent.id} for deposit ${depositId}`);
  }
}
