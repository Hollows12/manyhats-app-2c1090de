// ManyHats Construction LLC — brand and domain constants.

export const COMPANY = {
  name: "ManyHats Construction LLC",
  owner: "Mike Canter",
  ownerTitle: "CEO & Owner",
  phone: "740-600-1374",
  tagline: "Veteran-Owned Contractor",
  specialties: "Heavy Civil · Concrete · Masonry · Utilities · Historic Restoration",
} as const;

export const PROJECT_STATUS_OPTIONS = [
  { value: "lead", label: "Lead", color: "bg-slate-200 text-slate-800" },
  { value: "site_visit_scheduled", label: "Site Visit Scheduled", color: "bg-sky-100 text-sky-900" },
  { value: "field_capture", label: "Field Capture", color: "bg-amber-100 text-amber-900" },
  { value: "estimating", label: "Estimating", color: "bg-amber-100 text-amber-900" },
  { value: "proposal_draft", label: "Proposal Draft", color: "bg-indigo-100 text-indigo-900" },
  { value: "proposal_sent", label: "Proposal Sent", color: "bg-indigo-200 text-indigo-900" },
  { value: "approved", label: "Approved", color: "bg-emerald-100 text-emerald-900" },
  { value: "active", label: "Active", color: "bg-emerald-200 text-emerald-900" },
  { value: "waiting_on_client", label: "Waiting on Client", color: "bg-orange-100 text-orange-900" },
  { value: "waiting_on_materials", label: "Waiting on Materials", color: "bg-orange-100 text-orange-900" },
  { value: "complete", label: "Complete", color: "bg-emerald-700 text-white" },
  { value: "lost", label: "Lost", color: "bg-slate-300 text-slate-700" },
] as const;

export type ProjectStatus = (typeof PROJECT_STATUS_OPTIONS)[number]["value"];

export const PROJECT_TYPE_GROUPS = [
  {
    label: "Residential",
    types: [
      ["custom_home", "Custom Home"],
      ["spec_home", "Spec Home"],
      ["barndominium", "Barndominium"],
      ["pole_barn_home", "Pole Barn Home"],
      ["addition", "Addition"],
      ["garage", "Garage"],
      ["basement_finish", "Basement Finish"],
      ["whole_home_remodel", "Whole Home Remodel"],
      ["kitchen_remodel", "Kitchen Remodel"],
      ["bathroom_remodel", "Bathroom Remodel"],
      ["outdoor_living", "Outdoor Living"],
    ],
  },
  {
    label: "Site & Civil",
    types: [
      ["excavation", "Excavation"],
      ["site_development", "Site Development"],
      ["foundation", "Foundation"],
      ["retaining_wall", "Retaining Wall"],
      ["utilities", "Utilities"],
      ["septic_install", "Septic Install"],
      ["septic_repair", "Septic Repair"],
      ["driveway", "Driveway"],
      ["drainage", "Drainage"],
      ["stormwater", "Stormwater"],
    ],
  },
  {
    label: "Concrete & Masonry",
    types: [
      ["decorative_concrete", "Decorative Concrete"],
      ["stamped_concrete", "Stamped Concrete"],
      ["concrete_flatwork", "Concrete Flatwork"],
      ["cmu_block", "CMU Block"],
      ["masonry_restoration", "Masonry Restoration"],
      ["historic_restoration", "Historic Restoration"],
      ["chimney_repair", "Chimney Repair"],
      ["stone_veneer", "Stone Veneer"],
    ],
  },
  {
    label: "Commercial",
    types: [
      ["commercial_buildout", "Commercial Build-Out"],
      ["office_renovation", "Office Renovation"],
      ["retail_buildout", "Retail Build-Out"],
      ["restaurant_buildout", "Restaurant Build-Out"],
      ["museum_theater_church", "Museum / Theater / Church Restoration"],
    ],
  },
  {
    label: "Specialty",
    types: [
      ["container_airbnb", "Shipping Container Airbnb"],
      ["container_home", "Shipping Container Home"],
      ["container_game_room", "Container Game Room"],
      ["container_theater_room", "Container Theater Room"],
      ["hunting_cabin", "Hunting Cabin"],
      ["short_term_rental", "Short-Term Rental Development"],
      ["other", "Other"],
    ],
  },
] as const;

export const PROJECT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  PROJECT_TYPE_GROUPS.flatMap((g) => g.types.map(([v, l]) => [v, l])),
);

export const HOME_TYPES = new Set([
  "custom_home", "spec_home", "barndominium", "pole_barn_home", "addition",
  "garage", "whole_home_remodel",
]);
export const CONTAINER_TYPES = new Set([
  "container_airbnb", "container_home", "container_game_room",
  "container_theater_room", "hunting_cabin", "short_term_rental",
]);
export const HISTORIC_TYPES = new Set([
  "historic_restoration", "masonry_restoration", "chimney_repair", "museum_theater_church",
]);
export const SEPTIC_TYPES = new Set(["septic_install", "septic_repair"]);

export const ESTIMATE_CATEGORIES = [
  ["labor", "Labor"],
  ["material", "Material"],
  ["equipment", "Equipment"],
  ["subcontractor", "Subcontractor"],
  ["fuel_travel", "Fuel & Travel"],
  ["permit", "Permit"],
  ["disposal", "Disposal"],
  ["contingency", "Contingency"],
  ["markup", "Markup"],
  ["other", "Other"],
] as const;

export const PHOTO_TAGS = [
  "Before", "Existing Conditions", "Damage", "Measurements",
  "Progress", "Finished", "Reference", "Branding", "Concept Source", "Final Work",
] as const;

export const CONCEPT_DISCLAIMER =
  "Conceptual rendering only. Final layout, measurements, structural details, permits, and pricing require confirmed site measurements and approval.";

export function generateProposalNumber(seq: number): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const num = String(seq).padStart(3, "0");
  return `MH-${yy}-${mm}${dd}-${num}`;
}

export function formatMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
