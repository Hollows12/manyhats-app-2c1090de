export const DEFAULT_EMPLOYEE_HOURLY_PAY = 25;

export type PricingInputs = {
  materialCost: number;
  laborHours: number;
  hourlyPay?: number | null;
  laborBurdenPct: number;
  otherCost: number;
  overheadPct: number;
  targetMarginPct: number;
  promotionDiscountPct?: number;
};

export type PricingEconomics = {
  hourlyPay: number;
  directLaborCost: number;
  burdenedLaborCost: number;
  directCost: number;
  overheadCost: number;
  costBasis: number;
  priceBeforePromotion: number;
  promotionDiscount: number;
  clientPrice: number;
  grossProfit: number;
  achievedMarginPct: number;
};

function finiteNonnegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative number`);
  }
  return value;
}

function boundedPct(value: number, label: string, max = 100) {
  finiteNonnegative(value, label);
  if (value > max) throw new Error(`${label} must be at most ${max}%`);
  return value;
}

export function calculatePricingEconomics(
  input: PricingInputs,
): PricingEconomics {
  const materialCost = finiteNonnegative(input.materialCost, "Material cost");
  const laborHours = finiteNonnegative(input.laborHours, "Labor hours");
  const otherCost = finiteNonnegative(input.otherCost, "Other cost");
  const hourlyPay =
    input.hourlyPay == null
      ? DEFAULT_EMPLOYEE_HOURLY_PAY
      : finiteNonnegative(input.hourlyPay, "Hourly pay");
  const laborBurdenPct = boundedPct(
    input.laborBurdenPct,
    "Labor burden",
    200,
  );
  const overheadPct = boundedPct(input.overheadPct, "Overhead");
  const targetMarginPct = boundedPct(
    input.targetMarginPct,
    "Target margin",
    95,
  );
  const promotionDiscountPct = boundedPct(
    input.promotionDiscountPct ?? 0,
    "Promotion discount",
  );

  const directLaborCost = laborHours * hourlyPay;
  const burdenedLaborCost =
    directLaborCost * (1 + laborBurdenPct / 100);
  const directCost = materialCost + burdenedLaborCost + otherCost;
  const overheadCost = directCost * (overheadPct / 100);
  const costBasis = directCost + overheadCost;
  const priceBeforePromotion =
    costBasis === 0 ? 0 : costBasis / (1 - targetMarginPct / 100);
  const promotionDiscount =
    priceBeforePromotion * (promotionDiscountPct / 100);
  const clientPrice = Math.max(0, priceBeforePromotion - promotionDiscount);
  const grossProfit = clientPrice - costBasis;
  const achievedMarginPct =
    clientPrice === 0 ? 0 : (grossProfit / clientPrice) * 100;

  return {
    hourlyPay,
    directLaborCost,
    burdenedLaborCost,
    directCost,
    overheadCost,
    costBasis,
    priceBeforePromotion,
    promotionDiscount,
    clientPrice,
    grossProfit,
    achievedMarginPct,
  };
}

export type PricingTier = {
  tier: "Competitive" | "Recommended" | "Premium";
  targetMarginPct: number;
  isRecommended: boolean;
  economics: PricingEconomics;
};

export function buildThreePricingTiers(
  input: Omit<PricingInputs, "targetMarginPct">,
): PricingTier[] {
  return [
    {
      tier: "Competitive",
      targetMarginPct: 12,
      isRecommended: false,
      economics: calculatePricingEconomics({
        ...input,
        targetMarginPct: 12,
      }),
    },
    {
      tier: "Recommended",
      targetMarginPct: 20,
      isRecommended: true,
      economics: calculatePricingEconomics({
        ...input,
        targetMarginPct: 20,
      }),
    },
    {
      tier: "Premium",
      targetMarginPct: 30,
      isRecommended: false,
      economics: calculatePricingEconomics({
        ...input,
        targetMarginPct: 30,
      }),
    },
  ];
}
