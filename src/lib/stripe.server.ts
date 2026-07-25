// Stripe server-side client.
// Import only from .server.ts files or server function handlers.
// Never import in client-side code.

import Stripe from "stripe";

export function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY — configure in server environment");
  return new Stripe(key, { apiVersion: "2025-06-30.basil" });
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("Missing STRIPE_WEBHOOK_SECRET — configure in server environment");
  return secret;
}

export interface CreatePaymentIntentOptions {
  amountCents: number;
  currency?: string;
  metadata?: Record<string, string>;
  description?: string;
}

export async function createPaymentIntent(
  opts: CreatePaymentIntentOptions,
): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeClient();
  return stripe.paymentIntents.create({
    amount: opts.amountCents,
    currency: opts.currency ?? "usd",
    automatic_payment_methods: { enabled: true },
    metadata: opts.metadata ?? {},
    description: opts.description,
  });
}

export async function retrievePaymentIntent(intentId: string): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeClient();
  return stripe.paymentIntents.retrieve(intentId);
}

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  secret: string,
): Stripe.Event {
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
