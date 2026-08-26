export type SuppressionReason = "stop" | "blocked" | "wrong_number" | "reassigned" | "complaint" | "manual" | "prohibited_category";

const STOP_WORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);
const HELP_WORDS = new Set(["help", "info"]);

export function classifyComplianceKeyword(body: string): "stop" | "help" | null {
  const keyword = body.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (STOP_WORDS.has(keyword)) return "stop";
  if (HELP_WORDS.has(keyword)) return "help";
  return null;
}

export function normalizeE164(raw: string, defaultCountryCode = "1"): string {
  const digits = raw.replace(/\D/g, "");
  const normalized = digits.length === 10 ? `${defaultCountryCode}${digits}` : digits;
  if (!/^[1-9]\d{7,14}$/.test(normalized)) throw new Error("Invalid telephone number");
  return `+${normalized}`;
}

export type LocalTime = { day: number; minutes: number };
export type Hours = { days: number[]; start: number; end: number };

export function isWithinHours(local: LocalTime, hours: Hours): boolean {
  if (!hours.days.includes(local.day)) return false;
  return hours.start <= hours.end
    ? local.minutes >= hours.start && local.minutes < hours.end
    : local.minutes >= hours.start || local.minutes < hours.end;
}

export function maySend(params: {
  entitled: boolean;
  rolloutReady: boolean;
  suppressed: boolean;
  consent: "unknown" | "consented" | "opted_out" | "wrong_number" | "reassigned" | "blocked";
  isBusinessCall: boolean;
  isEmergencyOrProhibited: boolean;
  inQuietHours: boolean;
  rateLimited: boolean;
  templateApproved: boolean;
}): { allowed: boolean; reason?: string } {
  if (!params.entitled || !params.rolloutReady) return { allowed: false, reason: "feature_unavailable" };
  if (!params.isBusinessCall) return { allowed: false, reason: "ineligible_call" };
  if (params.suppressed || ["opted_out", "wrong_number", "reassigned", "blocked"].includes(params.consent)) return { allowed: false, reason: "suppressed" };
  if (params.isEmergencyOrProhibited) return { allowed: false, reason: "excluded_category" };
  if (params.inQuietHours) return { allowed: false, reason: "quiet_hours" };
  if (params.rateLimited) return { allowed: false, reason: "rate_limited" };
  if (!params.templateApproved) return { allowed: false, reason: "template_not_approved" };
  return { allowed: true };
}
