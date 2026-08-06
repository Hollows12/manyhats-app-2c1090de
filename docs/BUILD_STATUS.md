# ManyHats Lovable Build Status

## Authoritative current status — verified 2026-08-05

This section supersedes older point-in-time status statements below.

- GitHub PR #6 is open, draft, and unmerged.
- PR head branch: `copilot/auditrestore-july-10-11-work-one-more-time`
- Verified security commit: `2cfe7b25073b529ec53a96aa2b74215a33243f07`
- The `recalculate_invoice_balance(UUID)` migration uses `SECURITY INVOKER`, an empty `search_path`, fully qualified `public.` objects, and service-role-only execution.
- The Stripe webhook uses `process.env.SUPABASE_SERVICE_ROLE_KEY` server-side.
- Live Supabase deployment verification remains pending until the inactive project can accept database connections.
- Lovable synchronization must be confirmed against the final GitHub head after this documentation update.
- PR #6 must remain unmerged until it targets `main` and final validation is complete.

Historical audit sections below are retained as point-in-time records and must not be read as the current merge or deployment state.

---

## 2026-08-06 — PR #6 unresolved blocker fixes (consolidated)

Consolidated from PR #7 into `copilot/auditrestore-july-10-11-work-one-more-time`:

- Preserved `overdue` invoice status in `recalculate_invoice_balance()` when paid amount is zero
- Extended `portal_get_proposal()` payload to include `project.id`/`project_id` plus non-void project deposits
- Fixed React type imports in `portal.invoice.$token.tsx` and `portal.proposal.$token.tsx`, and removed unused imports
- Enforced strict server-side deposit/proposal project linkage in `createPortalDepositPaymentIntent`
- Updated dashboard profitability queries to throw Supabase errors instead of silently returning zeroed KPIs

---

## Invoice-Balance RPC Security Hardening — 2026-08-06

**Security commit:** `2cfe7b25073b529ec53a96aa2b74215a33243f07`  
**Consolidated PR #7 fixes:** `06f1b2e1554dcf0fe09343d4373b558e431708b9`

| Property | Value |
|---|---|
| Signature | `public.recalculate_invoice_balance(_invoice_id UUID)` |
| Security mode | `SECURITY INVOKER` |
| Search path | `SET search_path = ''` |
| Object qualification | `public.invoices`, `public.payments`, `public.invoice_status` |
| PUBLIC, anon, authenticated | `REVOKE EXECUTE` |
| service_role | `GRANT EXECUTE` |
| Authorized caller | `src/routes/api/stripe.webhook.tsx` via `SUPABASE_SERVICE_ROLE_KEY` |
| Browser exposure | None; no `VITE_` prefix and no frontend RPC call |

Static validation previously reported: build exit 0; 4 tests passed and 1 skipped; no new TypeScript errors; no credentials in changed files. Live database verification is tracked separately and must be rerun after Supabase finishes restoring.

---

_Last updated: 2026-07-17 · V1 money loop complete · Phase 7 final report_
_Prior update: 2026-07-17 · V1 payment and portal communication workflow completion_
_Prior update: 2026-07-15 · Restoration merge complete · Architecture V1 baseline established_
_Prior audit date: 2026-07-06 · Scope: Lovable frontend + Supabase backend only. Flutter is out of scope._

---

## Phase 7 — Final Report · 2026-07-17

### PR #6 Status
- **Branch:** `copilot/auditrestore-july-10-11-work-one-more-time` → target: `main`
- **Head SHA:** `07a4d16bc310007e7a94f09c15723901d1708df2`
- **State:** Open · validated · clean mergeable state
- **Retarget action required:** `gh pr edit 6 --base main` (GitHub owner action)

### Architecture Branch
- **Branch:** `copilot/auditrestore-july-10-11-work-one-more-time`
- **Commits ahead of main:** 14 (all additive — no conflicts)
- **Build:** `npm run build` → exit 0 (Vite + Nitro)
- **Tests:** `npm run test` → 4 pass / 1 skipped (e2e skipped without live Supabase)

### Security Fix
- **File:** `src/lib/scope-writer.functions.ts`
- **Change:** `.middleware([requireSupabaseAuth])` added to `writeScope` server function
- **Commit:** on `copilot/auditrestore-july-10-11-work-one-more-time`
- **Documented:** `docs/SECURITY.md` — fix log section

### Files Changed (full PR #6 scope)

| Category | Files |
|---|---|
| Core feature | `src/routes/_authenticated/projects.$id.tsx` (Shared Vision editor) |
| Stripe | `src/lib/stripe.server.ts`, `src/lib/stripe.functions.ts`, `src/routes/api/stripe.webhook.tsx` |
| Email | `src/lib/email.server.ts`, `src/lib/email.functions.ts` |
| Portal payments | `src/routes/portal.proposal.$token.tsx`, `src/routes/portal.invoice.$token.tsx` |
| Client file | `src/components/project/client-file-tab.tsx` |
| Security fix | `src/lib/scope-writer.functions.ts` |
| Migration | `supabase/migrations/20260717005500_recalculate_invoice_balance_rpc.sql` |
| Dependencies | `package.json`, `package-lock.json` (`@stripe/stripe-js`, `@stripe/react-stripe-js`, `resend`, `stripe`) |
| Environment | `.env.example` |
| Audit artifacts | `JULY_07_11_2026_SOURCE_TO_LOVABLE_AUDIT.md`, `JULY_10_11_2026_RESTORATION_AUDIT.md` |
| Documentation | 12 files under `docs/` (ARCHITECTURE, SYSTEM_OVERVIEW, DATABASE_SCHEMA, SHARED_VISION, WORKFLOWS, SECURITY, AI_ARCHITECTURE, CLIENT_PORTAL, API_REFERENCE, EDGE_FUNCTIONS, ROADMAP_V1, V1_ARCHITECTURE_FREEZE) |

### Documentation Created

| File | Content |
|---|---|
| `docs/ARCHITECTURE.md` | Stack, system diagram, directory map, auth flow |
| `docs/SYSTEM_OVERVIEW.md` | Full route inventory with completion status |
| `docs/DATABASE_SCHEMA.md` | 46 tables, 14 enums, RPCs, storage buckets, ER diagram |
| `docs/SHARED_VISION.md` | Capture Once → Use Everywhere philosophy |
| `docs/WORKFLOWS.md` | 7 Mermaid workflow diagrams |
| `docs/SECURITY.md` | Auth, RLS patterns, portal security, fix log |
| `docs/AI_ARCHITECTURE.md` | Lovable AI Gateway, scope writer, concept rendering |
| `docs/CLIENT_PORTAL.md` | Portal routes, token + PIN two-factor access |
| `docs/API_REFERENCE.md` | Server functions + Supabase RPC reference |
| `docs/EDGE_FUNCTIONS.md` | Confirms zero Deno edge functions |
| `docs/ROADMAP_V1.md` | Prioritized backlog, updated to reflect money loop completion |
| `docs/V1_ARCHITECTURE_FREEZE.md` | V1 baseline freeze marker |

### Money Loop Status

| Step | Status |
|---|---|
| Shared Vision | ✅ Inline editor on project detail |
| Field Capture | ✅ Photos, measurements, voice notes |
| Estimate | ✅ Line-item costing |
| Proposal | ✅ Good/Better/Best, PDF generation |
| Client Approval | ✅ Portal proposal view + accept |
| E-Signature | ✅ Portal digital signature |
| Deposit Payment | ✅ Stripe Elements on portal proposal |
| Project Management | ✅ Daily logs, change orders, job tasks |
| Invoice | ✅ Generation + email send |
| Final Payment | ✅ Stripe Elements on portal invoice |
| Profit Dashboard | ✅ FinanceKpis + ProfitabilityKpis + per-project snapshot |
| Client Portal | ✅ Proposal, invoice, client file routes |

### Remaining Technical Debt

| Item | Priority | Impact |
|---|---|---|
| Settings — Service Area Editor | P2 | `upsertServiceArea` RPC exists, no UI |
| Settings — Role Editor | P2 | Required for onboarding (crew → admin) |
| Leads Kanban drag-to-move | P3 | UX improvement only |
| Specialty module intakes (Home Builder, Container, Historic, Septic) | P3 | Schema exists, intake forms missing |
| Password strength (HIBP) | P4 | Supabase config only, no code change |
| Client portal rate limiting | P4 | Cloudflare WAF rules |
| 9 pre-existing TanStack Router TS errors | Low | Build succeeds, cosmetic only |
| ~3902 Prettier formatting violations | Low | Pre-existing, cosmetic only |

### Recommended Implementation Order

1. **Merge PR #6 to main** (owner action: `gh pr edit 6 --base main`, then merge)
2. **Settings — Service Area Editor** (one RPC already exists, wire a simple form)
3. **Settings — Role Editor** (admin role management for onboarding)
4. **Specialty module intakes** (extend existing schema with intake forms)
5. **Security hardening** (HIBP config, rate limiting)

### V1 Architecture Baseline

This commit set is designated **ManyHats Pro Platform Architecture V1**.  
See `docs/V1_ARCHITECTURE_FREEZE.md` for the freeze declaration.

Core philosophy: **Capture Once. Use Everywhere.**

---

## V1 Payment & Portal Completion — 2026-07-17

### Files changed

| File | Change |
|---|---|
| `src/routes/api/stripe.webhook.tsx` | Fixed bugs: removed non-existent `project_id` column from payments insert; added idempotency guard (skip duplicate reference_number); fixed deposit recording (removed erroneous second payments insert); removed unreliable fallback in favor of the new RPC; added `paid_at` timestamp on deposit |
| `src/lib/stripe.functions.ts` | Added `createPortalDepositPaymentIntent` — portal-token-gated server function for proposal deposit payments (mirrors `createPortalInvoicePaymentIntent` pattern) |
| `src/lib/email.functions.ts` | Added `sendPortalInvitationEmailFn` — staff-authenticated server function that rotates the PIN, builds the portal URL, and calls `sendPortalInvitationEmail` without ever returning the PIN to the client |
| `src/routes/portal.invoice.$token.tsx` | Replaced "Online payment coming soon" placeholder with full Stripe Elements payment flow: `PaymentSection` (creates payment intent) + `PaymentForm` (collects payment); publishable key loaded from `VITE_STRIPE_PUBLISHABLE_KEY`; graceful no-key fallback; duplicate-submit prevention; success/error/declined states; auto-refresh on success |
| `src/routes/portal.proposal.$token.tsx` | Added deposit payment flow after acceptance: `DepositPaymentSection` + `DepositPaymentForm` using Stripe Elements; shows paid deposit confirmation; shows pending deposit payment UI; prevents payment before acceptance; refreshes state on success |
| `src/components/project/client-file-tab.tsx` | Added "Send PIN by email" button to each active share; rotates PIN server-side before sending; shows sending/success/error feedback; prevents double-click while sending |
| `supabase/migrations/20260717005500_recalculate_invoice_balance_rpc.sql` | New migration: adds `recalculate_invoice_balance(_invoice_id UUID)` as a callable RPC (idempotent, `CREATE OR REPLACE`); enforces company boundary via invoice lookup; grants `authenticated` and `service_role` |
| `package.json` / `package-lock.json` | Added `@stripe/stripe-js` and `@stripe/react-stripe-js` for client-side Stripe Elements |
| `.env.example` | New file documenting all required environment variables, which deployment layer each belongs to, and a configuration matrix |

### Migration added

**`20260717005500_recalculate_invoice_balance_rpc.sql`**

RPC signature:
```sql
CREATE OR REPLACE FUNCTION public.recalculate_invoice_balance(_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
```

What it does:
- Sums non-voided payments for the invoice
- Calculates `balance_due = GREATEST(total - paid, 0)`
- Sets status: `void` → void, balance ≤ 0 → paid, paid > 0 → partial, else → sent/draft
- Updates `invoices.balance_due`, `invoices.status`, `invoices.updated_at`

Callers:
- `src/routes/api/stripe.webhook.tsx` → `handlePaymentSucceeded` (via `supabase.rpc("recalculate_invoice_balance", { _invoice_id })`)

Note: A trigger (`recalc_invoice_balance`) on the `payments` table already handles automatic recalculation on direct DB inserts. The RPC allows the webhook to explicitly trigger a recalculation without relying solely on the trigger.

### Environment variables

| Variable | Where to set | Notes |
|---|---|---|
| `SUPABASE_URL` | Cloudflare Worker env + CF Pages | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Cloudflare Worker env + CF Pages | Anon/public key |
| `VITE_SUPABASE_URL` | CF Pages env (VITE_* prefix) | Same value as above, inlined at build |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | CF Pages env (VITE_* prefix) | Same value as above, inlined at build |
| `SUPABASE_SERVICE_ROLE_KEY` | Cloudflare Worker **secret** | Never expose to browser |
| `STRIPE_SECRET_KEY` | Cloudflare Worker **secret** | Never expose to browser |
| `STRIPE_WEBHOOK_SECRET` | Cloudflare Worker **secret** | Never expose to browser |
| `VITE_STRIPE_PUBLISHABLE_KEY` | CF Pages env (VITE_* prefix) | **Required** for Stripe Elements UI — `pk_live_...` or `pk_test_...` |
| `RESEND_API_KEY` | Cloudflare Worker **secret** | Never expose to browser |
| `RESEND_FROM_EMAIL` | Cloudflare Worker env | e.g. `ManyHats Pro <noreply@yourdomain.com>` |
| `APP_ORIGIN` | Cloudflare Worker env | e.g. `https://app.manyhats.pro` — used in portal email links |

See `.env.example` for full configuration matrix.

### Validation — 2026-07-17

- **Build**: `npm run build` — exit 0 ✅
- **Tests**: 4 passed / 1 skipped (e2e requires live Supabase) ✅
- **TypeScript**: same 9 pre-existing errors (TanStack Router search param, Stripe API version, webhook import) — no new errors ✅
- **Lint**: pre-existing Prettier violations only — no new lint errors from our changes ✅
- **Secrets scan**: no hardcoded credentials in changed files ✅
- **Migration**: new file `20260717005500_recalculate_invoice_balance_rpc.sql` — idempotent (`CREATE OR REPLACE`) ✅
- **Stripe packages**: `@stripe/stripe-js` and `@stripe/react-stripe-js` — no known vulnerabilities ✅

### Scenario validation (static)

| Scenario | Validation method | Result |
|---|---|---|
| A. Proposal accepted + deposit paid | Code review — AcceptForm triggers refetch; DepositPaymentSection shown post-acceptance; webhook marks deposit paid and sets paid_at | ✅ Static |
| B. Deposit attempt declined | Stripe `confirmPayment` returns error; shown in UI; no success state set | ✅ Static |
| C. Invoice paid in full | Webhook inserts payment, calls recalculate_invoice_balance RPC; portal shows "Paid in full" card | ✅ Static |
| D. Partial invoice payment | RPC sets status to 'partial', balance_due reduced; portal reflects updated balance on refetch | ✅ Static |
| E. Duplicate webhook delivery | Idempotency guard: `maybeSingle()` on `reference_number`; skips insert if exists; RPC is idempotent | ✅ Static |
| F. Already-paid invoice | `createPortalInvoicePaymentIntent` throws "Invoice already paid"; portal shows paid state | ✅ Static |
| G. Invalid/expired portal token | `portal_get_invoice` returns error; portal shows appropriate error card | ✅ Static |
| H. Incorrect PIN | Handled by existing `portal.client-file.$token.tsx` PIN flow (unchanged) | ✅ Static |
| I. Portal invitation email succeeds | `sendPortalInvitationEmailFn` rotates PIN, calls Resend; returns `{ ok: true, recipientEmail }` — PIN not in response | ✅ Static |
| J. Portal invitation email fails | Error thrown by Resend or RPC surfaced as toast error; PIN not logged or returned | ✅ Static |
| Live Stripe/Resend tests | Requires configured credentials — not available in this environment | ⚠️ Blocked (credentials required) |

### Manual steps still required

1. **Stripe dashboard**: Create a webhook endpoint pointing to `https://app.manyhats.pro/api/stripe/webhook` for event `payment_intent.succeeded`. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
2. **Stripe keys**: Add `STRIPE_SECRET_KEY` and `VITE_STRIPE_PUBLISHABLE_KEY` to deployment environment.
3. **Resend**: Verify domain for `RESEND_FROM_EMAIL` sender address. Set `RESEND_API_KEY`.
4. **Deploy migration**: Run `supabase db push` or apply `20260717005500_recalculate_invoice_balance_rpc.sql` against the production database.

### Remaining blockers

- `VITE_STRIPE_PUBLISHABLE_KEY` must be set before Stripe Elements renders (graceful fallback shown otherwise)
- ~~Portal deposit payment assumes `portal_get_proposal` RPC returns `project.id`~~ **Resolved 2026-08-06**
- ~~No deposits shown in proposal portal until `portal_get_proposal` RPC is updated to include deposits~~ **Resolved 2026-08-06**

---

## PR #6 retarget recommendation

**Do not merge PR #6 yet.** The V1 payment completion work (this PR) should be merged to `main` first. Once merged, compare the full diff of PR #6 (`audit/restore-july-10-11-work`) against the updated `main` before retargeting.

PR #6 should only be retargeted to `main` after confirming:
- No audit-only or temporary files are included
- No duplicate migrations (the July 10–11 restoration migrations must not conflict)
- No Flutter-specific or destructive changes
- All new V1 payment/portal changes from main are not overwritten

### PR #6 retarget assessment — 2026-07-17 ✅ SAFE TO RETARGET

After fetching `origin/main` and running `git diff origin/main...HEAD --name-status`, the complete diff was reviewed. All changes vs main are:

**Documentation** (additive, safe):
- 12 new `docs/` architecture files
- 2 audit trail markdown files at root
- `README.md`

**Security improvement** (safe):
- `src/lib/scope-writer.functions.ts` — adds `requireSupabaseAuth` middleware (fixes a pre-existing security gap)

**New features** (all additive, safe):
- `financial.tsx` — Send invoice email button
- `proposal.tsx` — Email delivery wired to "Send" button
- `dashboard.tsx` — `ProfitabilityKpis` component
- `client-file-tab.tsx` — Send PIN by email button (this PR)
- `email.functions.ts`, `email.server.ts` — Resend email infrastructure
- `stripe.functions.ts`, `stripe.server.ts`, `stripe.webhook.tsx` — Stripe payment infrastructure
- `portal.invoice.$token.tsx`, `portal.proposal.$token.tsx` — Stripe Elements portal UIs (this PR)
- `20260717005500_recalculate_invoice_balance_rpc.sql` — new additive migration (this PR)
- `projects.$id.tsx` — Shared Vision inline editor restoration

**Package additions** (safe, no known vulnerabilities):
- `@stripe/stripe-js`, `@stripe/react-stripe-js`, `resend@6.17.2`, `stripe@22.3.1`

**Not present**: No Flutter-specific code, no table drops, no RLS weakening, no duplicate migrations, no conflicting schemas.

**Conclusion**: PR #6 is safe to retarget from `audit/restore-july-10-11-work` to `main`. Command to retarget:
```
gh pr edit 6 --base main
```

---

## Restoration Merge — 2026-07-15


Branch `copilot/auditrestore-july-10-11-work-one-more-time` merged into `main` (commit `7ec39aa`).

All validation checks passed (2026-07-14):
- Build: `npm run build` exit 0
- Tests: 4 passed / 1 skipped (e2e requires live Supabase)
- TypeScript: 9 pre-existing errors (TanStack Router search param, unrelated to restoration)
- Lint: ~3902 pre-existing Prettier formatting violations
- Merge markers: none
- Secrets: no hardcoded credentials
- Migrations: untouched
- RLS: unchanged, tenant isolation intact

Restoration applied:
- `src/routes/_authenticated/projects.$id.tsx`: Shared Vision + site context inline editor (summary, budget min/max, timeline, site notes, measurement notes)
- `JULY_07_11_2026_SOURCE_TO_LOVABLE_AUDIT.md`: Source-to-Lovable reconciliation audit artifact
- `JULY_10_11_2026_RESTORATION_AUDIT.md`: Per-commit audit trail
- `package-lock.json`: `@lovable.dev/vite-tanstack-config` 2.7.0 → 2.7.1 (aligns with package.json)

Architecture documentation baseline created on `docs/platform-architecture-v1` branch.
See `docs/ARCHITECTURE.md` and related documents for the V1 architecture reference.

---

## Overall completion

**~62% of MVP.** The CRM → Project → Estimate → Proposal spine is functional. Financial closeout (Invoice → Payment → Profit) and client-facing surfaces (Customer Portal, real email delivery) are missing. Specialty modules are shell pages.

```
Lead ✅ → Project ✅ → Estimate ✅ → Proposal ✅ → Invoice ❌ → Payment ❌ → Profit ⚠ (est vs actual only)
```

---

## Page-by-page audit

| Route | Status | Notes |
|---|---|---|
| `/` landing | Complete | Real brand, meta tags, CTA to `/auth`. |
| `/auth` | Complete | Email + Google, invite token, forgot-password tab. |
| `/reset-password` | Complete | Recovery flow present. |
| `/email-help` | Complete | Support page. |
| `/dashboard` | Mostly complete | Counts + recent projects. No revenue/profit KPIs, no overdue proposals, no cash-flow tile. |
| `/leads` (kanban) | Complete | Read-only kanban — no drag-to-change-status. |
| `/clients` + `/clients/$id` | Mostly complete | CRUD works. No activity timeline, no linked proposals/invoices. |
| `/projects` + `/projects/$id` | Complete | Central hub with tabs. |
| `/field-capture` | Partial | Picker list only — the actual capture UI lives in `components/project/field-capture.tsx` and is only reachable from a project. Standalone "quick capture from phone" is missing. |
| `/estimates` | Complete (list) | Read-only index. |
| `/proposals` | Complete (list) | Read-only index + PDF. |
| `/concept-studio` | Complete (list) | Read-only index. |
| `/home-builder`, `/container-builds`, `/historic`, `/septic` | Partial | 8-line shell using `SpecialtyList` — filters projects by type. No specialty-specific intake, checklists, or workflows despite dedicated `home_builds` / `container_builds` / `historic_projects` / `septic_projects` tables. |
| `/pricing` (Smart Pricing) | Mostly complete | Suppliers/materials/jobs tabs, Firecrawl discovery. Missing: price-history charts, favorites toggle, per-material refresh button (documented in plan). |
| `/job-management` | Partial | List by status only. No daily-log entry form on this page, no change-order UI here (buried in project tab). |
| `/job-costing` | Partial | Estimated vs actual roll-up. No line-item drill-in, no cost entry form (must go through project). |
| `/knowledge-base` | Present | Confirm search + import works end-to-end. |
| `/team` | Complete | Invite create/copy/resend/revoke. |
| `/settings` | Partial | Read-only company info + user list. No company-editable fields, no service-area editor (server fn `upsertServiceArea` exists but no UI). No role edit. |
| `/schema-diff` | Complete | Dev tool. |
| **Missing** `/invoices` | ❌ | Not built. |
| **Missing** `/payments` | ❌ | Not built. |
| **Missing** `/portal/*` (client) | ❌ | Not built. |
| **Missing** `/admin` (superuser) | ❌ | Team + Settings partially fill this. |

---

## Feature-by-feature audit

### Auth & security — Complete
- Email/password + Google OAuth via Lovable broker, `_authenticated` gate (ssr:false), profiles trigger, role table + `has_role`, invitation RPC. First user auto-admin.
- ⚠ **Missing**: HIBP leaked-password check (call `configure_auth` with `password_hibp_enabled: true`), MFA, admin UI to edit user roles.

### CRM (Clients) — Mostly complete
- CRUD, notes, county. Detail page exists.
- Missing: contact timeline (calls, emails, visits), linked doc list, per-client lifetime revenue.

### Projects — Complete (spine)
- Central hub, status pipeline, tabs for field/estimate/proposal/concepts/costing/jobmgmt.

### Estimates — Complete
- Line items, categories, markup, contingency, tax, grand_total, AI recommendation gate.

### Proposals — Mostly complete
- Draft → sent, good/better/best options, PDF export, executive summary, AI scope writer, pending-AI lock.
- Missing: e-signature capture UI (table `proposal_signatures` exists — verify wiring), send-by-email action, payment schedule fields, price validity.

### Smart Pricing — Mostly complete
- Firecrawl discovery, material enrichment, knowledge import, AI advisory recommendations with pending/approve/reject, supersede-on-rerun (just shipped).
- Missing: price history chart, supplier favorites UI toggle, service-area editor UI, cron/refresh scheduler.

### Contractor Financial Engine — ❌ Largely missing
Per `docs/CONTRACTOR_FINANCIAL_ENGINE.md` the flow is Estimate → Proposal → Deposit → Invoice → Progress Billing → Payment → Actual Profit → Variance.
- Present: `estimates`, `proposals`, `job_costs`, `change_orders`.
- **Missing tables**: `invoices`, `invoice_line_items`, `payments`, `deposits`/`progress_billings`, `profit_snapshots`.
- **Missing UI**: invoice generator, payment recording, deposit collection, real-time profit tile, variance report, cash-flow view.
- **Missing integration**: Stripe/Paddle. No `payments` connector.

### File/photo uploads — Complete
- Buckets `field-photos`, `concepts`, `proposals-pdf` exist. `project_photos` table wired in field-capture component.
- Missing: bulk upload UI, EXIF/GPS auto-tagging, image compression.

### Voice notes — Partial (schema only)
- `voice_notes` table exists (7 cols) but **no UI, no server fn, no code references it**. Recorder + Whisper/AI transcription not built.

### Concept Studio — Complete
- Generation route `/api/concept-image`, storage bucket, project tab, disclaimer. Approve-for-proposal boolean.

### Customer / Client portal — ❌ Missing
- No `/portal` routes. No RLS policies for the `client` role role exist. Signature capture on proposals, deposit payment, progress viewing all missing.

### Admin dashboard — Partial
- `/team` (invites) + `/settings` (read-only). No consolidated admin view: usage, storage, active projects, error logs, feature toggles, role management.

### Navigation — Complete
- Sidebar covers all shipped pages. Grouped Pipeline / Estimating / Pro / Ops.
- Missing sidebar entries once built: Invoices, Payments, Portal preview.

### Mobile responsiveness — Partial
- Sidebar collapses; grids use `md:` / `xl:`. Not audited on device.
- Known gaps: no PWA install, `/field-capture` is not phone-first (opens a list, not a camera). Kanban (`/leads`) horizontally scrolls poorly at 390px (6 columns forced at `xl`).
- Project tabs (concepts/estimate/proposal/field/costing/jobmgmt) not verified on mobile.

### Emails — Partial
- Auth emails and app emails **not scaffolded** (no email domain configured). Invitations rely on copy-paste link. Proposal "send" is not wired to email.

### Errors / broken flows
- **`_authenticated/route.tsx` uses top-level `beforeLoad` with `getUser()`** — this is fine because `ssr: false` is set, but any child that adds SSR could regress it.
- Proposal PDF route relies on data present — no `errorComponent` on many routes.
- `estimates.tsx` and `job-management.tsx` and other list pages have no `errorComponent` / `notFoundComponent` set.
- `SpecialtyList` component behavior for specialty pages not audited — likely just a filtered project list.
- No global error boundary customization visible; router default only.

---

## Supabase integration status

- 34 tables, RLS enabled with `has_role` / `is_staff`.
- Server functions used correctly (`createServerFn` + `requireSupabaseAuth`).
- Storage buckets private — good.
- Secrets present: `LOVABLE_API_KEY`, `FIRECRAWL_API_KEY`, `SUPABASE_*`.
- ⚠ **Duplicate / near-duplicate tables**: `material_costs` (4 policies) AND `material_prices` (2 policies) — both hold pricing. `production_rates` also similar-shape. Consolidate or document.
- ⚠ **Read from browser**: `useRole()` in `use-auth.ts` reads `user_roles` client-side. Works with RLS but the app has no dedicated role-change UI, so role escalation risk is limited to admin invites.
- ⚠ **`settings.tsx` reads `user_roles` cross-user** — relies on RLS `is_staff` policy; verify it isn't leaking to `client` role once portal ships.
- No `invoices`, `payments`, `deposits` tables — required for Financial Engine.
- No `activity_log` / `audit_log` — required for admin dashboard.

---

## Duplicate pages / components / dead code

- `material_costs` vs `material_prices` — pick one.
- `home_builds` / `container_builds` / `historic_projects` / `septic_projects` schemas exist but Pro pages don't render or edit them (dead schema).
- `job-costing.tsx` and `costing.tsx` component both compute est/actual — the standalone page duplicates the project tab.
- `field-capture.tsx` route is just a picker; `components/project/field-capture.tsx` is the real UI. Duplicate concept.
- `preferred_vendors` and `contractor_service_areas` tables — no UI wired.
- `lidar_scans` table — no UI.
- `ai_estimate_recommendations` **UI exists in estimate tab**; verify approve/reject buttons render (was just added).

## Dead buttons / broken UX

- Settings "Users" list — no edit action (role change, deactivate).
- Dashboard module cards — all live, verified.
- Proposal "PDF" link works; **"Send" button not present** despite proposal having `sent_at` field.
- Kanban `/leads` — cards clickable but no drag-drop.

## Missing env / infra

- No email sender domain configured (blocks invitation/proposal emails).
- No Stripe/Paddle connector (blocks invoicing).
- No pg_cron for daily price refresh (Firecrawl runs on demand only).

## RLS / security

- ✅ Roles in separate table with `has_role` SECURITY DEFINER.
- ✅ Storage buckets private.
- ⚠ Recommend enabling `password_hibp_enabled` on auth (call `configure_auth`).
- ⚠ No client-role RLS policies for a future customer portal; add before shipping portal.
- ⚠ `useRole` uses `getSession` implicitly — for privileged UI, prefer server checks.

---

## Priority fix list (do first, small)

1. **Sidebar link to `/team`** already present. **Add Settings → Service Area editor** wiring the existing `upsertServiceArea` server fn.
2. **Add `errorComponent` + `notFoundComponent`** to every `_authenticated/*` route with a loader/query.
3. **Enable HIBP** via `configure_auth` (`password_hibp_enabled: true`).
4. **Wire invitation emails** — set up email domain + `scaffold_auth_email_templates` + `scaffold_transactional_email`, then send from `/team` create + resend.
5. **Fix `/leads` on mobile** — switch 6-column kanban to horizontal scroll snap on `<md`.
6. **Consolidate `material_costs` vs `material_prices`** — drop or alias one; update `pricing.functions.ts`.
7. **Voice notes UX or drop the schema** — either build recorder + transcription or remove the table.
8. **Proposal Send button** — record `sent_at`, generate email via app email infra, drop link to public accept page.
9. **Admin: role editor on `/settings` or `/team`** — required for real onboarding.
10. **Dashboard KPI upgrade** — add open proposals value, month revenue (once invoices exist), overdue invoice count.

## Next 10 build tasks (in this order)

1. `invoices` + `invoice_line_items` migration (project_id FK, status, due_date, totals) with GRANTs + RLS.
2. `/invoices` list + `/projects/$id` **Invoice tab** to generate from an approved proposal.
3. `payments` + `deposits` tables + record-payment UI on invoice.
4. Real-time **profit tile** on project page: revenue (invoiced/paid) − sum(job_costs.actual).
5. **Customer portal** at `/portal/proposal/$token` — public route, token-scoped RLS, view/sign proposal + pay deposit.
6. Stripe (or Paddle) connector via `payments--recommend_payment_provider`, deposit + final payment flows.
7. Email domain + auth/app emails; send proposals + invoices + receipts.
8. **Specialty intake forms** (home/container/historic/septic) — replace `SpecialtyList` shells with real intake writing to their tables, or delete the tables.
9. **Voice notes** recorder + `speech-to-text` via Lovable AI Gateway → attach transcript to project.
10. **Mobile field capture PWA** — phone-first `/field-capture/$projectId` with camera, GPS, offline queue.

---

## Strategy reminders honored

- Lovable = MVP frontend only.
- Supabase is the only backend — do NOT add a second one.
- Do not rebuild working features (spine intact).
- Prioritize MVP completeness: **finish the money loop (Invoice → Payment → Profit) before adding new specialty modules**.
