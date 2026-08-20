import { describe, expect, it } from "vitest";
import { assertStripeBinding } from "./stripe.webhook";

const attempt = {
  intent_id: "pi_expected",
  target_type: "invoice",
  target_id: "invoice-1",
  expected_amount_cents: 12500,
  currency: "usd",
};

describe("Stripe payment binding", () => {
  it("accepts the exact application-bound intent", () => {
    expect(() => assertStripeBinding({ id: "pi_expected", amount: 12500, currency: "usd" }, attempt, "invoice", "invoice-1", 12500)).not.toThrow();
  });

  it.each([
    [{ id: "pi_other", amount: 12500, currency: "usd" }, "Unbound Stripe intent"],
    [{ id: "pi_expected", amount: 1, currency: "usd" }, "Stripe amount mismatch"],
    [{ id: "pi_expected", amount: 12500, currency: "eur" }, "Unexpected invoice currency"],
  ])("rejects mismatched payment integrity", (intent, message) => {
    expect(() => assertStripeBinding(intent, attempt, "invoice", "invoice-1", 12500)).toThrow(message);
  });
});
