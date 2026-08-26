export const leadStates = [
  "new", "contacted", "awaiting_information", "appointment_requested", "estimate_being_prepared",
  "estimate_sent", "follow_up_active", "question_received", "accepted", "declined", "no_response",
  "opted_out", "converted_to_project", "closed", "archived",
] as const;
export type LeadState = (typeof leadStates)[number];

export const terminalAutomationStates = new Set<LeadState>([
  "question_received", "accepted", "declined", "opted_out", "converted_to_project", "closed", "archived",
]);

const transitions: Record<LeadState, readonly LeadState[]> = {
  new: ["contacted", "awaiting_information", "appointment_requested", "declined", "opted_out", "closed", "archived"],
  contacted: ["awaiting_information", "appointment_requested", "estimate_being_prepared", "question_received", "declined", "no_response", "opted_out", "closed"],
  awaiting_information: ["contacted", "appointment_requested", "estimate_being_prepared", "question_received", "no_response", "opted_out", "closed"],
  appointment_requested: ["contacted", "estimate_being_prepared", "question_received", "declined", "opted_out", "closed"],
  estimate_being_prepared: ["estimate_sent", "question_received", "declined", "opted_out", "closed"],
  estimate_sent: ["follow_up_active", "question_received", "accepted", "declined", "no_response", "opted_out", "closed"],
  follow_up_active: ["question_received", "accepted", "declined", "no_response", "opted_out", "converted_to_project", "closed"],
  question_received: ["contacted", "awaiting_information", "appointment_requested", "estimate_being_prepared", "estimate_sent", "accepted", "declined", "opted_out", "closed"],
  accepted: ["converted_to_project", "closed"],
  declined: ["contacted", "closed", "archived"],
  no_response: ["contacted", "follow_up_active", "question_received", "closed", "archived"],
  opted_out: [], converted_to_project: ["closed", "archived"], closed: ["archived"], archived: [],
};

export function canTransition(from: LeadState, to: LeadState): boolean {
  return transitions[from].includes(to);
}
