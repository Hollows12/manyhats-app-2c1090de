# V1 Contractor Workflow Completion Plan

**Branch:** `feature/v1-contractor-workflow-completion`  
**Base:** `main` at `53ea2994567c26cc9956235fcdc6a53cfb0cf815` (post-restoration)  
**Author:** ManyHats Platform  
**Date:** 2026-07-12  
**Status:** Active planning document — reviewed before implementation begins

---

## Core Product Rule

> **Capture Once. Use Everywhere.**

Information collected through Shared Vision must flow automatically into estimates, proposals,
project execution, change orders, invoices, the client portal, closeout, and business
intelligence. No duplicate data-entry systems where project information already exists.

---

## Architecture Constraints

All work in this branch must preserve:

- Lovable React/TypeScript frontend
- TanStack Router file-based routing (`src/routes/`)
- TanStack Query for server state (`useQuery`, `useMutation`)
- Supabase PostgreSQL with existing schema
- Supabase Auth with existing session handling
- Supabase Storage for files and photos
- Existing RLS policies — no bypasses
- Multi-tenant company isolation
- Generated Supabase types (`src/integrations/supabase/types.ts`)
- Existing CRM, project, estimate, proposal, and portal structure
- Existing naming and folder conventions

Do not:

- Rewrite the application
- Copy Flutter screens into the React app
- Add speculative migrations
- Duplicate tables
- Bypass RLS
- Expose service-role keys in the frontend
- Add Stripe or third-party payment connectors before schema wiring is complete
- Begin Sentinel Septic work in this branch

---

## Pre-Existing Cleanup Items (Track Separately)

Do not mix these into workflow implementation:

| Issue | Files | Action |
|---|---|---|
| 9 TypeScript errors — missing `search` on auth redirects | 6 files | Dedicated PR: add `search: {}` |
| ~3,902 Prettier violations | Codebase-wide | Dedicated PR: `npm run lint -- --fix` |
| 1 skipped E2E test | `auth.e2e.test.ts` | Configure Supabase credentials in CI |
| 1 low-severity npm advisory | `package-lock.json` | `npm audit fix` maintenance PR |

---

## Workflow Stages

---

### Stage 1 — Shared Vision

**Objective:** Capture the complete project intelligence layer from the first conversation.

#### Existing Implementation

- **Route:** `src/routes/_authenticated/projects.$id.tsx` (241 lines)
- **Table:** `public.projects` — `summary`, `budget_min`, `budget_max`, `desired_timeline`, `site_notes`, `measurement_notes`, `project_type`, `status`, `job_address`, `city`, `state`, `zip`, `county`
- **UI:** Tabbed Overview form with editable Shared Vision fields, dirty-state detection, save mutation

#### Missing Frontend Functionality

- No structured client goals / priority capture form
- No inspiration / reference links or mood board attachment
- No risk and constraint fields visible in the UI
- No inclusions / exclusions capture
- No `desired_timeline` connected to any scheduling UI
- No "readiness" indicator or checklist

#### Missing Backend Functionality

- `projects` table does not have columns for: `client_goals`, `priorities`, `inclusions`, `exclusions`, `risks`, `constraints`, `warranty_expectations`, `project_readiness`
- No migration required yet — assess at schema contract review

#### Missing Client-Portal Functionality

- Client portal (`portal.client-file.$token.tsx`) shows project name and address but not the full Shared Vision summary
- Client cannot review or confirm Shared Vision content before estimate

#### Dependencies

- None — this is the foundation stage

#### Security Requirements

- RLS policy `projects_staff_all` (authenticated staff) and `projects_client_read` (client read-only) already enforced
- No portal mutations on `projects` table — portal is read-only

#### Validation Requirements

- `npx tsc --noEmit` must show no new errors in changed files
- `npm run build` must pass
- `npm run test` must maintain 4/4 passing

#### Definition of Done

- Contractor can capture all Shared Vision fields from the project overview tab
- Shared Vision data displays correctly in the client portal
- Budget and timeline fields surface in estimate and proposal creation
- No duplicate capture forms elsewhere in the app

#### Status: **Functional but incomplete**

---

### Stage 2 — Estimate

**Objective:** Build a priced estimate directly from Shared Vision data without re-entering project information.

#### Existing Implementation

- **Component:** `src/components/project/estimate.tsx` (434 lines)
- **Tables:** `public.estimates` — `project_id`, `status`, `markup_pct`, `contingency_pct`, `tax_pct`, `grand_total`; `public.estimate_line_items` — `estimate_id`, `category`, `description`, `quantity`, `unit`, `unit_cost`, `total`, `sort_order`
- **AI Integration:** `recommendEstimate` and `reviewRecommendation` server functions wired to AI pricing recommendations
- **RPC:** `ai_estimate_recommendations` table — AI-generated line items with `pending`/`accepted`/`dismissed` statuses
- **Existing UI:** Create estimate, add/edit/delete line items by category, markup/contingency/tax controls, subtotal/grand total calculation, AI recommendation acceptance

#### Missing Frontend Functionality

- Estimate does not pre-populate description or scope from `projects.summary` (Shared Vision)
- No `budget_min`/`budget_max` comparison — estimate total not compared against client budget
- No print/PDF export from within the estimate tab
- Line items lack a `notes` field visible in the UI
- No "approve estimate internally" workflow step before creating a proposal

#### Missing Backend Functionality

- `estimates` table lacks: `internal_approved_at`, `internal_approved_by`
- `estimate_line_items` lacks: `notes` field (assess — may exist in types already)
- No migration required — confirm before adding

#### Missing Client-Portal Functionality

- Client file portal shows estimate list with `grand_total` and `status` but no line items or breakdown

#### Dependencies

- Stage 1 (Shared Vision) — budget and scope context

#### Security Requirements

- `estimates_staff_all` RLS confirmed in migration
- AI recommendation server function must not expose service-role key to client

#### Definition of Done

- Shared Vision `summary` and `budget` values are visible alongside the estimate editor
- Estimate total is compared to `budget_min`/`budget_max` with a visual indicator
- Contractor can mark an estimate internally approved before promoting to proposal
- Client portal shows estimate summary with total and status

#### Status: **Functional but incomplete**

---

### Stage 3 — Vision Proposal

**Objective:** Generate a professional proposal directly from the approved estimate and Shared Vision data, without re-entering scope or pricing.

#### Existing Implementation

- **Component:** `src/components/project/proposal.tsx` (341 lines)
- **Route:** `src/routes/_authenticated/proposals.tsx` (57 lines — list view)
- **Tables:** `public.proposals` — `project_id`, `proposal_number`, `status`, `scope_of_work`, `inclusions`, `exclusions`, `payment_terms`, `warranty_length`, `warranty_notes`, `sent_at`, `approved_at`, `portal_token`; `public.proposal_options` — alternate pricing options
- **AI Integration:** `writeScope` server function (AI scope writing from rough notes)
- **RPC:** `send_proposal`, `ensure_proposal_portal_token`, `revoke_proposal_portal_token`
- **PDF:** `src/routes/api/proposals.$id.pdf.tsx` — PDF generation via React PDF
- **Existing UI:** Create proposal, edit scope/inclusions/exclusions/payment terms, AI scope writer, send (portal token generation), PDF download link, status display

#### Missing Frontend Functionality

- Proposal editor does not pull `summary`, `budget`, `timeline`, `inclusions`, `exclusions` from Shared Vision automatically
- No "convert estimate to proposal" button that pre-fills line-item pricing in the proposal
- No proposal version history
- No internal review/approval step before sending
- Proposal list (`proposals.tsx`) lacks search, filter by status, and date range

#### Missing Backend Functionality

- No `proposal_versions` table for immutable snapshots (required per ADR-007)
- No trigger to snapshot the proposal at `approved_at`

#### Missing Client-Portal Functionality

- Proposal portal exists (`portal.proposal.$token.tsx` — 401 lines) and is functional
- Missing: revision request workflow from client

#### Dependencies

- Stage 1 (Shared Vision) — scope context
- Stage 2 (Estimate) — pricing data

#### Security Requirements

- Portal token must be required for all unauthenticated proposal access
- `send_proposal` RPC validates staff authorization
- Snapshot at acceptance must be immutable (RLS: no UPDATE after `approved_at` is set)

#### Definition of Done

- Shared Vision fields pre-populate the proposal scope section
- Estimate totals are available in the proposal editor without re-entry
- Accepted proposal creates an immutable snapshot
- PDF generation includes all required fields
- Client portal delivery confirmed working end-to-end

#### Status: **Functional but incomplete**

---

### Stage 4 — Client Review

**Objective:** Deliver the proposal to the client through a secure, branded portal where they can review all details without creating an account.

#### Existing Implementation

- **Route:** `src/routes/portal.proposal.$token.tsx` (401 lines)
- **RPC:** `portal_get_proposal`, `portal_mark_proposal_viewed`
- **Features:** Token-authenticated portal page, full proposal display (scope, inclusions, exclusions, payment terms, warranty), view tracking, acceptance UI

#### Missing Frontend Functionality

- No revision request button for client to comment or request changes
- No proposal comparison if multiple options are presented (`proposal_options` table exists but UI is thin)
- Mobile experience not fully verified

#### Missing Backend Functionality

- No `portal_request_revision` RPC
- `proposal_options` table exists but is not surfaced in the portal

#### Missing Client-Portal Functionality

- Client cannot initiate a revision request
- Client cannot download the proposal as PDF from the portal (only accessible contractor-side)

#### Dependencies

- Stage 3 (Proposal) — sent proposal with portal token

#### Security Requirements

- Token must be single-use or time-scoped (current: token is reusable until revoked)
- `portal_get_proposal` returns only proposal fields, not internal cost data
- RLS confirmed: portal RPC uses `security definer` with token validation

#### Definition of Done

- Client can access proposal by URL with no account required
- Proposal PDF is downloadable from the portal
- View tracking is confirmed logging to `portal_mark_proposal_viewed`
- Revision request path is available

#### Status: **Functional but incomplete**

---

### Stage 5 — Approval and E-Signature

**Objective:** Client accepts the proposal with a legally binding electronic signature. Accepted state triggers project activation.

#### Existing Implementation

- **Table:** `public.proposal_signatures` — `proposal_id`, `signer_name`, `signer_email`, `signer_phone`, `signature_data`, `signed_at`, `terms_accepted`, `signature_kind`
- **RPC:** `portal_accept_proposal` — accepts proposal, records signature, marks `proposals.approved_at`
- **Trigger:** `on_proposal_signature_insert` — fires on signature insert
- **Portal UI:** Typed signature display (`src/routes/portal.proposal.$token.tsx` lines 224–316), terms acceptance checkbox, accept button, success state

#### Missing Frontend Functionality

- No drawn/canvas signature mode (only typed name currently)
- Contractor-side cannot view signature record inline in the proposal tab
- No "re-send" flow if client needs a new link

#### Missing Backend Functionality

- No immutable snapshot of accepted proposal body (ADR-007 requirement)
- `on_proposal_signature_insert` trigger action needs audit

#### Missing Client-Portal Functionality

- After acceptance, portal shows a static confirmation — no "download signed copy" button

#### Dependencies

- Stage 4 (Client Review) — portal token and proposal in sent state

#### Security Requirements

- `portal_accept_proposal` must validate token, check proposal status is `sent`, and be idempotent
- Accepted record must not be modifiable by staff after `approved_at` is set
- Signature data must be stored server-side only (no client localStorage)

#### Definition of Done

- Client can accept proposal with electronic signature via portal
- Contractor sees acceptance confirmation and signature record in the project
- Accepted proposal body is snapshotted (immutable)
- Signed copy is downloadable by both contractor and client

#### Status: **Functional but incomplete**

---

### Stage 6 — Project Execution

**Objective:** Track active project work — scheduling, tasks, crew assignments, milestones, and status updates — using data already captured.

#### Existing Implementation

- **Component:** `src/components/project/job-mgmt.tsx` (125 lines) — daily logs and change orders
- **Tables:** `public.daily_logs`, `public.job_tasks`, `public.job_costs`, `public.material_costs`
- **Route:** `src/routes/_authenticated/job-management.tsx`
- **Project status tracking:** `projects.status` enum (`lead`, `active`, `completed`, `cancelled`)

#### Missing Frontend Functionality

- No scheduling calendar or timeline view
- No task assignment or crew management UI
- No milestone tracking tied to proposal scope
- No photo documentation integration in the daily log entry
- `job-mgmt.tsx` is thin (125 lines) — change orders section is minimal (see Stage 7)
- No "activate project" action when proposal is accepted

#### Missing Backend Functionality

- No `project_milestones` table (scope items from proposal could become milestones)
- No scheduling table
- No automatic status transition from `lead` → `active` on proposal acceptance

#### Missing Client-Portal Functionality

- Client portal does not show active project status or milestone progress
- Client cannot see daily log summaries

#### Dependencies

- Stage 5 (Approval) — project must be accepted before entering execution

#### Security Requirements

- Daily logs: staff-write, client-read (portal)
- Task and crew data: staff-only
- Job costs: staff-only, never exposed to portal

#### Definition of Done

- Project status transitions automatically or manually to `active` on proposal acceptance
- Contractor can log daily progress with optional photos
- Basic task list is viewable per project
- Client portal shows project status and phase

#### Status: **Shell**

---

### Stage 7 — Change Orders

**Objective:** Document, price, and get client approval for scope changes during project execution — without re-entering project information.

#### Existing Implementation

- **Table:** `public.change_orders` — `project_id`, `number`, `description`, `reason`, `price_change`, `timeline_change_days`, `status` (`pending`, `approved`, `rejected`), `client_signature`, `approved_at`, `created_by`
- **Component:** Change orders section inside `src/components/project/job-mgmt.tsx` (minimal)
- **Client file portal:** `portal.client-file.$token.tsx` reads `change_orders` array in type definition

#### Missing Frontend Functionality

- No dedicated change order creation form with line-item detail
- No change order portal delivery (send to client for approval)
- No change order portal view (`portal.change-order.$token.tsx` does not exist)
- No automatic invoice impact when a change order is approved
- No immutable snapshot on approval

#### Missing Backend Functionality

- No `change_order_portal_token` column or token management
- No `portal_accept_change_order` RPC
- No trigger to update invoice or project total on CO approval

#### Missing Client-Portal Functionality

- Change orders appear in client file portal list view only
- Client cannot approve/reject change orders through the portal

#### Dependencies

- Stage 6 (Project Execution) — active project required

#### Security Requirements

- Change order portal token required (same pattern as proposal)
- Approved change order body must be snapshotted (ADR-007)
- `price_change` must be validated server-side before invoice impact

#### Definition of Done

- Contractor can create a change order with description, reason, and price/timeline impact
- Client can review and approve/reject via portal
- Approved change order updates project financial totals
- Approved CO body is snapshotted and immutable

#### Status: **Shell** (table exists, no usable UI or portal delivery)

---

### Stage 8 — Invoice

**Objective:** Generate accurate invoices from estimate, proposal, and change order data without re-entering amounts.

#### Existing Implementation

- **Component:** `src/components/project/financial.tsx` (622 lines) — profit KPIs, invoice list, invoice creation via dialog
- **Component:** `src/components/project/generate-invoice-dialog.tsx` (288 lines)
- **Route:** `src/routes/_authenticated/invoices.tsx` (88 lines) — global invoice list
- **Tables:** `public.invoices`, `public.invoice_line_items`, `public.deposits`, `public.progress_billings`
- **RPC:** `recalc_invoice_balance`, `sync_invoice_balance_from_total`, `ensure_invoice_portal_token`, `portal_get_invoice`, `portal_mark_invoice_viewed`
- **Trigger:** `on_payment_insert` — updates invoice balance on payment
- **Portal:** `src/routes/portal.invoice.$token.tsx` (194 lines)

#### Missing Frontend Functionality

- Invoice creation does not pull line items from approved proposal or accepted change orders
- No "deposit invoice" or "milestone billing" creation flow (tables exist but UI is minimal)
- Invoice portal does not support online payment (no Stripe integration wired)
- No invoice PDF generation (only proposal has PDF)
- No recurring invoice or retainage tracking

#### Missing Backend Functionality

- No automatic invoice generation on proposal acceptance
- No Stripe webhook handler for payment confirmation
- `sync_invoice_backrefs` RPC needs audit

#### Missing Client-Portal Functionality

- Client can view invoice via portal token (`portal.invoice.$token.tsx`) — read only
- No payment button — Stripe not yet wired
- No PDF download from portal

#### Dependencies

- Stage 5 (Approved proposal) — invoice must reference a project with an accepted proposal
- Stage 7 (Change orders) — approved COs must be reflected in invoice

#### Security Requirements

- Invoice portal is read-only for client
- Payment confirmation must be verified server-side (Stripe webhook)
- Paid invoices must not be silently modified (ADR-007)
- Service-role key used only in Edge Functions, never in frontend

#### Definition of Done

- Invoice can be generated from approved proposal line items in one action
- Approved change orders populate as additional line items
- Client portal shows invoice with full breakdown
- Payment recording updates balance in real time
- Paid invoice is marked immutable

#### Status: **Functional but incomplete**

---

### Stage 9 — Payment

**Objective:** Record and reconcile payments against invoices. Stripe integration for online payment.

#### Existing Implementation

- **Route:** `src/routes/_authenticated/payments.tsx` (79 lines) — global payment list with totals
- **Table:** `public.payments` — `invoice_id`, `amount`, `payment_date`, `method`, `reference`, `notes`, `is_void`
- **Trigger:** `on_payment_insert` — recalculates invoice balance
- **Payment methods:** `stripe`, `check`, `cash`, `ach`, `card`, `other` (in `src/lib/finance.ts`)

#### Missing Frontend Functionality

- No "record payment" form within the invoice detail (contractor must navigate to financial tab)
- No Stripe payment link generation
- No payment void workflow in the UI (column exists in table)
- No reconciliation view

#### Missing Backend Functionality

- No Stripe Edge Function for payment session creation
- No Stripe webhook Edge Function for payment confirmation
- No `stripe_payment_intent_id` column on `payments` table (assess whether needed)

#### Missing Client-Portal Functionality

- Invoice portal has no "Pay Now" button
- Stripe integration not started

#### Dependencies

- Stage 8 (Invoice) — payment must reference a valid invoice

#### Security Requirements

- Stripe secret key must live in Edge Function environment only
- Webhook signature verification required
- Client payment session must not expose internal invoice data beyond amount and reference

#### Definition of Done

- Contractor can record manual payments against any invoice
- Client can pay online via Stripe through the invoice portal
- Payment confirmation updates invoice balance in real time (server-side verified)
- Payment receipt is downloadable from the client portal

#### Status: **Shell** (table and payment method constants exist; Stripe not wired)

---

### Stage 10 — Project Closeout

**Objective:** Formally close a project, deliver final documentation to the client, and record warranty terms.

#### Existing Implementation

- Project `status` enum includes `completed`
- Client file portal (`portal.client-file.$token.tsx` — 325 lines) aggregates project photos, proposals, invoices, and payments
- `proposals` table has `warranty_length`, `warranty_notes`

#### Missing Frontend Functionality

- No closeout checklist or workflow step
- No "mark project complete" UI action
- No warranty card or warranty terms delivery to client
- No closeout documentation upload
- No final walkthrough record

#### Missing Backend Functionality

- No `project_closeouts` table
- No warranty records table
- No closeout trigger that generates warranty record from proposal warranty terms
- No status transition guard (e.g., can't close a project with open invoices)

#### Missing Client-Portal Functionality

- Client does not receive a formal closeout notification
- Warranty terms are visible in proposal but not surfaced as a standalone record post-closeout

#### Dependencies

- Stage 8 and 9 (Invoices and Payments) — all invoices must be paid or closed before closeout

#### Security Requirements

- Closeout record must be immutable once confirmed
- Warranty record accessible to client via portal

#### Definition of Done

- Contractor can initiate closeout checklist
- System validates all invoices are resolved before allowing final close
- Warranty record is created from proposal warranty terms
- Client receives closeout notification with warranty terms via portal

#### Status: **Missing**

---

### Stage 11 — Client Portal

**Objective:** Provide the client with a unified, branded, secure view of their entire project file — without requiring a login account.

#### Existing Implementation

- **Route:** `src/routes/portal.client-file.$token.tsx` (325 lines)
- **Route:** `src/routes/portal.proposal.$token.tsx` (401 lines)
- **Route:** `src/routes/portal.invoice.$token.tsx` (194 lines)
- **Tables:** `public.client_file_shares`, `public.client_file_share_views`
- **RPC:** `create_client_file_share`, `rotate_client_file_share_pin`, `revoke_client_file_share`, `portal_verify_client_file_pin`
- **Features:** PIN-protected client file portal, project summary, photo gallery, proposals, invoices, payments, change orders (list), signatures

#### Missing Frontend Functionality

- No mobile-optimized layout verification
- No Stripe payment button in invoice portal
- Change orders visible in list only — no approval UI from portal
- No project timeline or milestone progress view
- No warranty / closeout section (depends on Stage 10)
- No message or contact-contractor button

#### Missing Backend Functionality

- PIN verification is session-persisted via `localStorage` (security review needed for expiry)
- No client notification system (email/SMS on new proposal, invoice, change order)

#### Missing Client-Portal Functionality

- No unified notification of new items (relies on contractor manually sharing links)

#### Dependencies

- All upstream stages — portal aggregates data from all stages

#### Security Requirements

- Portal token + PIN required for all access
- No `service_role` queries from portal routes
- Internal cost data (`job_costs`, `receipts`, `profit_snapshot`) never exposed
- Client sees only their own project data (RLS via portal RPCs)

#### Definition of Done

- Client can access complete project file from a single URL
- All available documents (proposals, invoices, change orders) are accessible from one portal
- Payment is possible from the portal (Stripe)
- Warranty terms are visible after closeout
- Portal is mobile-friendly

#### Status: **Functional but incomplete**

---

### Stage 12 — Profit and Business Intelligence

**Objective:** Give the contractor a real-time and historical view of company financial health derived from all project data.

#### Existing Implementation

- **Component:** `src/components/project/financial.tsx` (622 lines) — per-project KPIs: approved revenue, invoiced, paid, gross profit, net profit, margin %, outstanding balance
- **Route:** `src/routes/_authenticated/job-costing.tsx` — cross-project estimated vs actual cost variance
- **RPC:** `project_profit_snapshot` — returns `approved_revenue`, `invoiced_revenue`, `paid_revenue`, `gross_profit`, `net_profit`, `profit_margin_pct` per project
- **Dashboard:** `src/routes/_authenticated/dashboard.tsx` exists (content to verify)

#### Missing Frontend Functionality

- No company-wide revenue and profit dashboard
- No date-range filtering (YTD, quarter, custom)
- No project type breakdown
- No client revenue concentration view
- No outstanding receivables aging report
- No cost category breakdown across projects
- No chart visualizations (no chart library integrated)

#### Missing Backend Functionality

- No `company_profit_summary` RPC or view
- No scheduled snapshot for historical BI
- No export (CSV/PDF) for financial reports

#### Dependencies

- All upstream stages — BI reads from all completed stages

#### Security Requirements

- BI data is staff-only — never exposed to portal
- Multi-tenant isolation: queries scoped to `company_id` via existing RLS

#### Definition of Done

- Contractor can view company-wide revenue, profit, and outstanding balances on the dashboard
- Charts show monthly/quarterly trends
- Outstanding receivables aging is visible
- Data is accurate per project and totalled correctly
- All queries respect tenant isolation

#### Status: **Shell** (per-project RPC exists; no company dashboard)

---

## Implementation Sequence

The stages above are listed in dependency order. The recommended implementation sequence is:

| Priority | Stage | Rationale |
|---|---|---|
| **1** | Stage 1 — Shared Vision completeness | Foundation — all other stages read from it |
| **2** | Stage 2 — Estimate → Shared Vision pre-fill | Capture Once, Use Everywhere for budget/scope |
| **3** | Stage 3 — Proposal → Estimate integration | Proposal must pull from estimate without re-entry |
| **4** | Stage 4 + 5 — Client Review and E-Signature | Acceptance triggers all downstream stages |
| **5** | Stage 6 — Project Execution basics | Task and status tracking for active projects |
| **6** | Stage 7 — Change Orders | Field reality changes must flow into invoices |
| **7** | Stage 8 — Invoice from proposal + COs | Revenue recognition from accepted data |
| **8** | Stage 9 — Payment (manual first, Stripe second) | Manual payment before Stripe integration |
| **9** | Stage 10 — Closeout and Warranty | Close the loop on the project lifecycle |
| **10** | Stage 11 — Client Portal completeness | Unify all portal gaps |
| **11** | Stage 12 — BI Dashboard | Build on completed transactional data |

---

## Recommended First Implementation Milestone

### Milestone 1: Estimate ↔ Shared Vision Integration

**Why first:** The Estimate tab already exists and is functional. The gap is that it ignores
available Shared Vision data. Connecting them is the clearest demonstration of
"Capture Once, Use Everywhere" and unblocks downstream proposal pre-fill.

**Scope:**

1. Display `projects.summary`, `budget_min`, `budget_max`, and `desired_timeline` alongside
   the estimate editor (read-only sidebar panel — no new tables needed)
2. Add a visual indicator when `estimate.grand_total` exceeds `budget_max`
3. Add "mark internally approved" action on the estimate (may require a migration for
   `internal_approved_at`/`internal_approved_by` — confirm before adding)

**Validation required:**
- `npx tsc --noEmit` — no new errors
- `npm run build` — must pass
- `npm run test` — must maintain 4/4 passing

**Definition of done for this milestone:**
- Shared Vision budget is visible while building the estimate
- Budget overrun is flagged visually
- Contractor can signal "ready for proposal" on the estimate

---

## Decisions Requiring Mike Canter's Review

1. **Proposal immutable snapshot mechanism:** Should the proposal body be snapshotted to a `proposal_versions` table on acceptance, or should `proposals` rows be locked via RLS trigger? Decision affects migration scope.

2. **Change order portal delivery:** Should change orders use the same token pattern as proposals (individual `portal_token` per change order), or should all COs be accessible via the client file portal PIN?

3. **Stripe integration timing:** Should Stripe be wired in Stage 9 (this branch) or deferred to a `feature/stripe-payments` branch after the workflow is complete?

4. **Scheduling:** Is a lightweight task/milestone list sufficient for V1, or is a calendar scheduler required before beta?

5. **Client notification system:** Should email/SMS notifications (new proposal, invoice, CO) be built before beta, and if so, via Supabase Edge Functions or a third-party service?
