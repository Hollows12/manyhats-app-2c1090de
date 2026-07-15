# ManyHats Pro — V1 Roadmap

> **Version:** V1 Baseline · 2026-07-15  
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
6. Collect a deposit *(payment via Stripe — 🔲)*
7. Manage active construction ✅
8. Generate an invoice ✅ (schema+UI) *(email delivery — 🔲)*
9. Receive final payment *(Stripe — 🔲)*
10. Close out the job with a profit snapshot ✅ *(dashboard KPI — 🔲)*
11. Give the client their Universal Client File ✅

---

## Priority 1 — Close the Money Loop

These are blockers for the core contractor workflow:

### 🔲 Stripe Payment Integration
- Connect Stripe/Paddle via Lovable connector
- Wire deposit payment to proposal portal
- Wire final payment to invoice portal
- Record payments in `payments` table (method: `stripe`)
- **Files to create:** `src/lib/stripe.server.ts`, webhook route
- **Unblocks:** Online payment collection, deposit workflow

### 🔲 Email Infrastructure
- Configure email sending domain in Supabase Auth settings
- Set up transactional email (invitation emails, proposal send, invoice send)
- **Blocks:** Proposal "Send" button generating real email
- **Blocks:** Client file share PIN delivery
- **Files to update:** `src/components/project/proposal.tsx` (send button → email)
- **Note:** `sent_at` fields already exist on `proposals` and `invoices`

### 🔲 Dashboard Revenue/Profit KPIs
- Add tiles: open proposals value, month revenue (invoiced/paid), overdue invoices
- `project_profit_snapshot()` RPC exists — needs dashboard integration
- **File to update:** `src/routes/_authenticated/dashboard.tsx`

---

## Priority 2 — Fix Incomplete Features

### 🔲 Invoice "Send" Button
- `invoices.sent_at` field exists
- Portal token generation exists
- Missing: UI button + email dispatch
- **File:** `src/components/project/financial.tsx`

### 🔲 Proposal "Send" Button  
- Portal token generation exists
- `proposals.sent_at` field exists
- Missing: actual email delivery (pending email infra)
- **File:** `src/components/project/proposal.tsx`

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

### 🔲 `scope-writer.functions.ts` Auth Middleware
- Add `requireSupabaseAuth` to `writeScope` server function
- Currently only validates `LOVABLE_API_KEY`
- **File:** `src/lib/scope-writer.functions.ts`

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
