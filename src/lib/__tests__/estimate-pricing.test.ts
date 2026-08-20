import { describe, expect, it } from "vitest";
import {
  buildThreePricingTiers,
  calculatePricingEconomics,
  DEFAULT_EMPLOYEE_HOURLY_PAY,
} from "../estimate-pricing";

describe("estimate pricing economics", () => {
  it("uses the $25 employee-pay fallback when no rate is entered", () => {
    const result = calculatePricingEconomics({
      materialCost: 1000,
      laborHours: 10,
      laborBurdenPct: 20,
      otherCost: 200,
      overheadPct: 10,
      targetMarginPct: 20,
    });
    expect(result.hourlyPay).toBe(DEFAULT_EMPLOYEE_HOURLY_PAY);
    expect(result.directLaborCost).toBe(250);
    expect(result.burdenedLaborCost).toBe(300);
    expect(result.costBasis).toBe(1650);
    expect(result.clientPrice).toBe(2062.5);
    expect(result.achievedMarginPct).toBeCloseTo(20);
  });

  it("shows how a promotion reduces achieved margin", () => {
    const withoutPromotion = calculatePricingEconomics({
      materialCost: 5000,
      laborHours: 100,
      hourlyPay: 30,
      laborBurdenPct: 25,
      otherCost: 1000,
      overheadPct: 10,
      targetMarginPct: 20,
    });
    const withPromotion = calculatePricingEconomics({
      materialCost: 5000,
      laborHours: 100,
      hourlyPay: 30,
      laborBurdenPct: 25,
      otherCost: 1000,
      overheadPct: 10,
      targetMarginPct: 20,
      promotionDiscountPct: 10,
    });
    expect(withPromotion.clientPrice).toBeLessThan(
      withoutPromotion.clientPrice,
    );
    expect(withPromotion.achievedMarginPct).toBeLessThan(
      withoutPromotion.achievedMarginPct,
    );
  });

  it("builds competitive, recommended, and premium choices", () => {
    const tiers = buildThreePricingTiers({
      materialCost: 1000,
      laborHours: 20,
      hourlyPay: 25,
      laborBurdenPct: 20,
      otherCost: 300,
      overheadPct: 10,
      promotionDiscountPct: 0,
    });
    expect(tiers.map((tier) => tier.tier)).toEqual([
      "Competitive",
      "Recommended",
      "Premium",
    ]);
    expect(tiers[1].isRecommended).toBe(true);
    expect(tiers[0].economics.clientPrice).toBeLessThan(
      tiers[1].economics.clientPrice,
    );
    expect(tiers[1].economics.clientPrice).toBeLessThan(
      tiers[2].economics.clientPrice,
    );
  });

  it("rejects invalid margins and negative costs", () => {
    expect(() =>
      calculatePricingEconomics({
        materialCost: -1,
        laborHours: 1,
        laborBurdenPct: 0,
        otherCost: 0,
        overheadPct: 0,
        targetMarginPct: 20,
      }),
    ).toThrow("Material cost");
    expect(() =>
      calculatePricingEconomics({
        materialCost: 1,
        laborHours: 1,
        laborBurdenPct: 0,
        otherCost: 0,
        overheadPct: 0,
        targetMarginPct: 96,
      }),
    ).toThrow("Target margin");
  });
});
