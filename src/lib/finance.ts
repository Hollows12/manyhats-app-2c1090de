// Financial engine helpers — invoice/payment shared logic.

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "ach", label: "ACH / Bank Transfer" },
  { value: "credit_card", label: "Credit Card" },
  { value: "stripe", label: "Stripe" },
  { value: "quickbooks", label: "QuickBooks Sync" },
  { value: "other", label: "Other" },
] as const;

export const INVOICE_STATUS_META: Record<
  string,
  { label: string; color: string }
> = {
  draft: { label: "Draft", color: "bg-slate-100 text-slate-800" },
  sent: { label: "Sent", color: "bg-sky-100 text-sky-900" },
  partial: { label: "Partial", color: "bg-amber-100 text-amber-900" },
  paid: { label: "Paid", color: "bg-emerald-100 text-emerald-900" },
  overdue: { label: "Overdue", color: "bg-red-100 text-red-900" },
  void: { label: "Void", color: "bg-slate-200 text-slate-500" },
};

export const DEPOSIT_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-900" },
  invoiced: { label: "Invoiced", color: "bg-sky-100 text-sky-900" },
  paid: { label: "Paid", color: "bg-emerald-100 text-emerald-900" },
  waived: { label: "Waived", color: "bg-slate-100 text-slate-700" },
  void: { label: "Void", color: "bg-slate-200 text-slate-500" },
};

export function generateInvoiceNumber(seq: number): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `INV-${yy}${mm}${dd}-${String(seq).padStart(4, "0")}`;
}

export type ProfitSnapshot = {
  estimated_revenue: number;
  approved_revenue: number;
  invoiced_revenue: number;
  paid_revenue: number;
  outstanding_balance: number;
  estimated_cost: number;
  actual_cost: number;
  gross_profit: number;
  net_profit: number;
  profit_margin_pct: number;
  variance: number;
  error?: string;
};
