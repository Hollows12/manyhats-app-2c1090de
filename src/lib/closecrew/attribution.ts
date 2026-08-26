export type RevenueEvidence = {
  amount: number;
  classification: "attributed" | "estimated" | "confirmed";
  evidenceId: string;
};

export function summarizeRecoveredRevenue(rows: readonly RevenueEvidence[]) {
  const unique = new Map<string, RevenueEvidence>();
  for (const row of rows) {
    if (!Number.isFinite(row.amount) || row.amount < 0) throw new Error("Invalid revenue amount");
    unique.set(`${row.classification}:${row.evidenceId}`, row);
  }
  return [...unique.values()].reduce((totals, row) => {
    totals[row.classification] += row.amount;
    return totals;
  }, { attributed: 0, estimated: 0, confirmed: 0 });
}
