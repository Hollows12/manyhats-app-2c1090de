# ManyHats Pro — V1 Roadmap

> **Version:** V1 Baseline · Updated 2026-07-17  
> This document tracks remaining work to reach V1 completion.  
> Items marked ✅ are complete. Items marked 🔲 are remaining work.

---

## V1 Definition

V1 is complete when a contractor can:

1. Capture a lead ✅
2. Conduct a site visit and capture field data ✅
3. Build an estimate ✅
4. Generate and send a proposal for client signature ✅
5. Receive client signature digitally ✅
6. Collect a deposit via Stripe ✅ *(portal deposit payment flow — 2026-07-17)*
7. Manage active construction ✅
8. Generate and email an invoice ✅ *(send button + email delivery — 2026-07-17)*
9. Receive final payment via Stripe ✅ *(portal invoice payment flow — 2026-07-17)*
10. Close out the job with a profit snapshot ✅ *(dashboard KPIs + project snapshot — 2026-07-17)*
11. Give the client their Universal Client File ✅

**The V1 contractor money loop is complete.**

---

## Priority 1 — Close the Money Loop ✅ COMPLETE

All money loop items are now implemented as of 2026-07-17.

### ✅ Stripe Payment Integration
- `src/lib/stripe.server.ts` — Stripe API wrapper
- `src/lib/stripe.functions.ts` — server functions: deposit intent, invoice intent, portal deposit intent
- `src/routes/api/stripe.webhook.tsx` — webhook handler (payment_intent.succeeded)
- `src/routes/portal.proposal.$token.tsx` — deposit payment UI (Stripe Elements)
- `src/routes/portal.invoice.$token.tsx` — invoice payment UI (Stripe Elements)
- Payments recorded in `payments` table (method: `stripe`)

### ✅ Email Infrastructure
- `src/lib/email.server.ts` — Resend API wrapper (proposal, invoice, portal invitation templates)
- `src/lib/email.functions.ts` — server functions: proposal email, invoice email, portal invitation
- `src/components/project/proposal.tsx` — Send Proposal button wired to `sendProposalEmailFn`
- `src/components/project/financial.tsx` — Send Invoice button wired to `sendInvoiceEmailFn`
- `src/components/project/client-file-tab.tsx` — Send PIN by Email button wired to `sendPortalInvitationEmailFn`
- Portal PIN rotated server-side before sending (PIN never returned to client)

### ✅ Dashboard Revenue/Profit KPIs
- `FinanceKpis` — month revenue, month collected, deposits pending, overdue invoices
- `ProfitabilityKpis` — invoiced total, collected, gross profit, net profit, margin %, proposal conversion
- `PortalKpis` — active shares, proposals sent, invoices sent
- `project_profit_snapshot()` RPC integrated in `src/components/project/financial.tsx` (per-project)

---

## Priority 2 — Fix Incomplete Features

### ✅ Invoice "Send" Button — COMPLETE
- `SendInvoiceButton` in `src/components/project/financial.tsx` calls `sendInvoiceEmailFn`
- Updates `invoices.sent_at`, shows resend state

### ✅ Proposal "Send" Button — COMPLETE
- `SendProposalButton` in `src/components/project/proposal.tsx` calls `sendProposalEmailFn`
- Updates `proposals.sent_at`, shows resend state

### 🔲 Settings — Service Area Editor
- `upsertServiceArea` server function already exists in `pricing.functions.ts`
- No UI wired on `/settings` or `/pricing` to edit service area
- **File:** `src/routes/_authenticated/settings.tsx`

### 🔲 Settings — Role Editor
- No role change UI on `/settings` or `/team`
- Required for real onboarding (change crew to admin, etc.)
- **Files:** `src/routes/_authenticated/settings.tsx` or `team.tsx`

### 🔲 Leads Kanban — Drag-to-Move
- Cards are clickable but not draggable
- Status change requires opening project
- **File:** `src/routes/_authenticated/leads.tsx`

### 🔲 Job Costing — Line Item Drill-In
- Current view: estimated vs actual roll-up only
- Missing: cost entry form, line-level drill-in
- **Files:** `src/routes/_authenticated/job-costing.tsx`, `src/components/project/costing.tsx`

### 🔲 Field Capture — Standalone Mobile
- `/field-capture/:projectId` exists as project-linked
- Missing: phone-first standalone capture flow with offline queue
- **File:** `src/routes/_authenticated/field-capture.$projectId.tsx` (enhancement)

---

## Priority 3 — Specialty Modules

Currently shell pages (`SpecialtyList` component — shows filtered projects only).

### 🔲 Home Builder Pro (`/home-builder`)
- `home_builds` table exists (linked to `projects`)
- Missing: intake form (foundation type, square footage, selections)
- Feeds: estimate + proposal with home-specific fields

### 🔲 Container Build Pro (`/container-builds`)
- `container_builds` table exists
- Missing: container-specific intake (container size, modifications, delivery)

### 🔲 Historic Restoration Pro (`/historic`)
- `historic_projects` table exists
- Missing: historic-specific intake (building age, materials, preservation requirements)
- Tone: grant_friendly AI scope writer most relevant here

### 🔲 Sentinel Septic Pro (`/septic`)
- `septic_projects` table exists
- Missing: septic-specific intake (system type, soil tests, permit requirements)

---

## Priority 4 — Security Hardening

### ✅ `scope-writer.functions.ts` Auth Middleware — COMPLETE
- `requireSupabaseAuth` added to `writeScope` server function (2026-07-15)
- Documented in `docs/SECURITY.md` fix log

### 🔲 Password Strength (HIBP)
- Enable `password_hibp_enabled` in Supabase Auth settings
- No code change required — Supabase config only

### 🔲 Client Portal Rate Limiting
- Add edge-level rate limiting on portal token endpoints
- Prevents token enumeration / brute force at URL level
- Consider Cloudflare WAF rules

---

## Priority 5 — Polish & UX

### 🔲 Error Boundaries on Authenticated Routes
- Add `errorComponent` + `notFoundComponent` to each route with a loader/query
- Currently falls back to generic error

### 🔲 Mobile Field Capture UX
- Fix `/leads` 6-column kanban on mobile (horizontal scroll snap on `<md`)
- Phone-first layout for field capture form

### 🔲 Clients `$id` — Activity Timeline + Linked Documents
- Client detail shows basic info
- Missing: linked proposals list, invoice history, payment history

---

## Technical Debt (Non-Blocking)

| Item | Location | Impact |
|------|----------|--------|
| 9 TanStack Router TS errors (`search` param on `/auth` links) | Multiple route files | Low — build succeeds |
| ~3902 Prettier formatting violations | All source files | Low — cosmetic only |
| `material_costs` vs `material_prices` table overlap | Schema | Low — clarify which to use |
| `voice_notes` schema exists but recording + transcription is UI-only | `voice-recorder.tsx` | Medium — feature partially complete |
| No `pg_cron` for scheduled price refresh | Supabase | Medium — Firecrawl runs on-demand only |
| `lidar_scans` table exists, no UI | `lidar_scans` migration | Low — future capability |

---

## Architecture Decisions for Future Work

**Do not:**
- Add a second backend (no Express, no Next.js API routes, no Firebase)
- Port Flutter code to the frontend
- Add Supabase Edge Functions unless there is a specific technical requirement
- Redesign existing working features (spine is intact — extend it)

**Do:**
- Use TanStack server functions for new server-side logic
- Use Supabase migrations for all schema changes
- Use Supabase RPCs for complex data operations
- Use `requireSupabaseAuth` on all new server functions
- Prioritize the money loop (Invoice → Payment → Profit) before new specialty modules
