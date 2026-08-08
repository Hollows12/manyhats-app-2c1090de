import { beforeEach, describe, expect, it, vi } from "vitest";

const createPaymentIntentMock = vi.fn();
const retrievePaymentIntentMock = vi.fn();
const constructWebhookEventMock = vi.fn();

vi.mock("stripe", () => {
  const StripeMock = vi.fn(function StripeMock() {
    return {
      paymentIntents: {
        create: createPaymentIntentMock,
        retrieve: retrievePaymentIntentMock,
      },
      webhooks: {
        constructEvent: constructWebhookEventMock,
      },
    };
  });

  return {
    default: StripeMock,
  };
});

import { createPaymentIntent } from "@/lib/stripe.server";

describe("createPaymentIntent", () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    createPaymentIntentMock.mockReset();
    retrievePaymentIntentMock.mockReset();
    constructWebhookEventMock.mockReset();
  });

  it("passes Stripe idempotencyKey through request options", async () => {
    createPaymentIntentMock.mockResolvedValue({ id: "pi_123", client_secret: "secret_123" });

    await createPaymentIntent({
      amountCents: 5000,
      idempotencyKey: "manyhats_test_key",
      description: "Invoice payment",
      metadata: { invoice_id: "invoice-1" },
    });

    expect(createPaymentIntentMock).toHaveBeenCalledTimes(1);
    expect(createPaymentIntentMock).toHaveBeenCalledWith(
      {
        amount: 5000,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: { invoice_id: "invoice-1" },
        description: "Invoice payment",
      },
      { idempotencyKey: "manyhats_test_key" },
    );
  });
});
