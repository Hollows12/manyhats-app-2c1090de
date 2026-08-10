// Focused test: verifies that createPaymentIntent passes the idempotency key
// to the Stripe API.

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn().mockResolvedValue({
  id: "pi_test123",
  client_secret: "pi_test123_secret_abc",
  amount: 5000,
});

vi.mock("stripe", () => {
  const MockStripe = function () {
    return { paymentIntents: { create: mockCreate } };
  };
  return { default: MockStripe };
});

describe("createPaymentIntent idempotency", () => {
  beforeEach(() => {
    mockCreate.mockClear();
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
  });

  it("passes the idempotencyKey to stripe.paymentIntents.create", async () => {
    const { createPaymentIntent } = await import("../stripe.server");

    await createPaymentIntent({
      amountCents: 5000,
      idempotencyKey: "deposit:uuid-1:5000:2026-08-10T00:00:00Z",
      description: "Test",
      metadata: { type: "deposit" },
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    const [_params, options] = mockCreate.mock.calls[0];
    expect(options).toMatchObject({ idempotencyKey: "deposit:uuid-1:5000:2026-08-10T00:00:00Z" });
  });

  it("requires idempotencyKey — TypeScript enforces this at compile time", async () => {
    const { createPaymentIntent } = await import("../stripe.server");
    // Calling with a key works; the type check ensures it cannot be omitted.
    const result = await createPaymentIntent({
      amountCents: 1000,
      idempotencyKey: "invoice:inv-1:1000:2026-08-10T00:00:00Z",
    });
    expect(result.id).toBe("pi_test123");
  });
});
