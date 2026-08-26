import { describe, expect, it } from "vitest";
import { classifyComplianceKeyword, isWithinHours, maySend, normalizeE164 } from "../compliance";
import { canTransition, terminalAutomationStates } from "../state-machine";
import { summarizeRecoveredRevenue } from "../attribution";

describe("CloseCrew compliance", () => {
  it.each(["STOP", "unsubscribe!", " Quit "])("recognizes opt-out %s", (value) => expect(classifyComplianceKeyword(value)).toBe("stop"));
  it.each(["HELP", "Info"])("recognizes help %s", (value) => expect(classifyComplianceKeyword(value)).toBe("help"));
  it("normalizes US telephone numbers", () => expect(normalizeE164("(740) 555-1212")).toBe("+17405551212"));
  it("handles overnight quiet hours", () => {
    const quiet = { days: [1], start: 20 * 60, end: 8 * 60 };
    expect(isWithinHours({ day: 1, minutes: 21 * 60 }, quiet)).toBe(true);
    expect(isWithinHours({ day: 1, minutes: 12 * 60 }, quiet)).toBe(false);
  });
  it("fails closed on missing entitlement and every suppression control", () => {
    const base = { entitled: true, rolloutReady: true, suppressed: false, consent: "consented" as const, isBusinessCall: true, isEmergencyOrProhibited: false, inQuietHours: false, rateLimited: false, templateApproved: true };
    expect(maySend({ ...base, entitled: false }).allowed).toBe(false);
    expect(maySend({ ...base, suppressed: true }).reason).toBe("suppressed");
    expect(maySend({ ...base, inQuietHours: true }).reason).toBe("quiet_hours");
    expect(maySend({ ...base, rateLimited: true }).reason).toBe("rate_limited");
  });
});

describe("CloseCrew workflow", () => {
  it("enforces valid transitions", () => {
    expect(canTransition("new", "contacted")).toBe(true);
    expect(canTransition("new", "accepted")).toBe(false);
    expect(canTransition("opted_out", "contacted")).toBe(false);
  });
  it("stops automation for customer and project outcomes", () => {
    expect(terminalAutomationStates.has("question_received")).toBe(true);
    expect(terminalAutomationStates.has("converted_to_project")).toBe(true);
  });
  it("separates and deduplicates recovered revenue evidence", () => {
    expect(summarizeRecoveredRevenue([
      { classification: "attributed", amount: 1000, evidenceId: "lead-1" },
      { classification: "estimated", amount: 800, evidenceId: "estimate-1" },
      { classification: "confirmed", amount: 250, evidenceId: "deposit-1" },
      { classification: "confirmed", amount: 250, evidenceId: "deposit-1" },
    ])).toEqual({ attributed: 1000, estimated: 800, confirmed: 250 });
  });
});
