# JULY 07–11, 2026 Source-to-Lovable Audit

- **Target repository:** `Hollows12/manyhats-app-2c1090de`
- **Target baseline SHA:** `add4bfc5ba377e0311e866bb205c3d33a1081485`
- **Target working branch:** `audit/restore-july-10-11-work` lineage (current head branch is `copilot/auditrestore-july-10-11-work-another-one`)
- **Source repository (requested):** `Hollows12/manyhats-app`
- **Source audited main SHA (requested):** `e4377d97997ae00186e1b6be0f210cb3f3668dda`
- **Audit timestamp basis:** UTC, 2026-07-07 through 2026-07-11 inclusive

## Scope and evidence boundaries

This audit uses **repository code as source of truth** for completion status.

Direct GitHub API access to `Hollows12/manyhats-app` returned 404/permission errors in this environment, so I could not independently fetch every source commit diff/file during July 7–11. Where source details are unavailable, evidence is explicitly labeled as:
- problem statement conversation context;
- target-repo docs/plans/comments available locally (`SYNC_RUNBOOK_2026_07_10.md`, `.lovable/plan.md`);
- target PR metadata available in this repo (`PR #2`, `PR #3`, `PR #4`).

Because of that blocker, this remains an evidence-based reconciliation against observable artifacts, not a cryptographic full source export.

## Source commit/file inventory status (requested vs observable)

Requested: inspect every source commit/file for 2026-07-07..2026-07-11.

Observed source commit evidence available in this environment:

| SHA | Date (UTC) | Message | Evidence source |
|---|---|---|---|
| `6d37ab64624d7c83663b7dad92b14ed0b1862b98` | 2026-07-10 19:08 | `security: secure estimate-ai-pricing-recommendation edge function` | problem statement context |
| `fff6c99f8c37aeae006d7c889309c3b048ddb146` | 2026-07-10 19:09 | `docs: fix stale edge function count (9 → 8)` | problem statement context |
| `e4377d97997ae00186e1b6be0f210cb3f3668dda` | 2026-07-11 00:17 | merge PR #17 (Flutter shared-vision frontend refocus) | problem statement context |

Additionally, `SYNC_RUNBOOK_2026_07_10.md` references July 7–10 sync intent and example cherry-picks (including security-themed commits), but it is a plan/runbook artifact, not proof that those exact source diffs were ported.

---

## Comment/Plan-to-Code Reconciliation

| Requirement name | Original evidence/source | Expected behavior | Target files examined | Database support | Frontend support | Backend/Edge support | Authentication + RLS support | Current status | Action taken | Exact files changed | Validation performed | Remaining dependency / deferral reason |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Secure AI estimate pricing call path | Source commit `6d37ab64...` described in problem statement; prior audit context | Authenticated, validated, tenant-safe AI pricing recommendation path | `src/lib/firecrawl/pricing.functions.ts`, `src/lib/auth-middleware.ts`, `supabase/migrations/20260705182324_...sql`, `src/integrations/supabase/types.ts` | `ai_estimate_recommendations` table + RLS present | Estimate UI invokes recommendation + review | No `supabase/functions/estimate-ai-pricing-recommendation` in target; target uses TanStack server function | `requireSupabaseAuth` middleware + staff RLS policies | fully implemented and connected | Verified target-native equivalent; no unsafe Deno port | none | `npm run test`, `npm run build`, static code/RLS review | Source Deno function diff cannot be directly fetched here; exact line-by-line invariant parity remains unverifiable |
| Correct docs vs real implementation | Source commit `fff6c99f...` in problem statement (docs count correction) | Docs should match real target code, not planned work | `JULY_10_11_2026_RESTORATION_AUDIT.md`, `SYNC_RUNBOOK_2026_07_10.md`, code/migrations in `src/` and `supabase/migrations/` | Target schema is migration-backed; no duplicate objects added | N/A | N/A | N/A | partially implemented | Replaced with evidence-based July 7–11 audit doc grounded in target code checks | `JULY_07_11_2026_SOURCE_TO_LOVABLE_AUDIT.md` | Baseline checks + file inspections listed below | Full source repo docs from 7/7–7/11 remain inaccessible in this environment |
| Flutter SELL/BUILD/MANAGE/GROW navigation refocus | Source merge commit `e4377d97...` description in problem statement | Equivalent workflow support in target-native architecture only | `src/components/app-sidebar.tsx`, `src/routes/_authenticated/*.tsx`, `src/routes/_authenticated/projects.$id.tsx` | Existing target schema already supports project workflow | Existing tabs/routes support project lifecycle | No Flutter runtime in target | Existing authenticated route guards + RLS-backed data calls | not applicable to Lovable | Explicitly rejected Flutter code port | none | Build/tests and route inspection | Flutter widgets/routes are stack-incompatible and out of scope |
| Shared Vision record per project (schema-supported fields) | Problem statement requirement; source conversation references shared-vision refocus | Project detail should load/edit/save shared-vision-like fields actually present in target schema | `src/routes/_authenticated/projects.$id.tsx`, `src/routes/_authenticated/projects.tsx`, `supabase/migrations/20260621124654_...sql`, `src/integrations/supabase/types.ts` | `projects` has `summary`, `budget_min/max`, `desired_timeline`, `site_notes`, `measurement_notes`, timestamps | Added editable overview form in project detail and save flow | Existing Supabase client update path; no new function | Existing project RLS policies enforced | fully implemented and connected | Implemented narrow target-native connection for existing fields | `src/routes/_authenticated/projects.$id.tsx` | `npm run test`, `npm run build` | No dedicated separate `shared_vision` table in target; unsupported fields (e.g., separate inspiration/priorities columns) remain schema-limited |
| Capture once → proposal/client-file reuse | Problem statement requirement + local code inspection | Stored project/site/proposal data should be reused downstream without duplicate architecture | `src/components/project/proposal.tsx`, `src/components/project/client-file-tab.tsx`, `src/routes/portal.client-file.$token.tsx`, `supabase/migrations/20260706204243_...sql` | Proposal + portal RPC schema exists | Proposal and client-file tabs connected in project detail | Portal data returned via SQL RPC | Authenticated staff actions + portal token+PIN controls | partially implemented | Verified existing reuse paths; no broad automation rewrite | none | Static flow inspection + build/tests | Further auto-propagation beyond current architecture would be broad speculative change |
| Vision Proposal status | Problem statement requirement | Determine doc-only vs partial vs connected implementation | `src/components/project/proposal.tsx`, `src/routes/portal.proposal.$token.tsx`, migrations for proposal portal RPC | Proposal schema and options tables exist | Proposal editor + send/link/portal present | RPC/token workflow present | Staff auth + portal token controls present | fully implemented and connected | Verified connected workflow; no architecture fork | none | Build/tests + source inspection | None for current architecture |
| Universal Client File status | Problem statement requirement | Determine whether real implementation exists with access controls | `src/components/project/client-file-tab.tsx`, `src/routes/portal.client-file.$token.tsx`, `supabase/migrations/20260706204243_...sql`, `20260706204311_...sql` | `client_file_shares` and audit tables + functions exist | Project tab issues links/PIN; portal route renders data | SQL functions handle verification/read/share lifecycle | Auth/RLS + function grants/revokes present | fully implemented and connected | Verified implementation is real (not docs-only) | none | Build/tests + migration/function inspection | None for current architecture |
| AI workflow standard (invocation path, auth, validation, safe secrets) | Problem statement requirement + local code inspection | Any AI call must be server-side authenticated/validated with safe env handling | `src/lib/firecrawl/pricing.functions.ts`, `src/lib/scope-writer.functions.ts`, `src/lib/ai-gateway.server.ts`, UI call-sites in estimate/proposal tabs | AI rec persistence table exists with RLS | UI invokes server fns and handles result/error states | Server functions run with env access; no client secret embedding | `requireSupabaseAuth` used for pricing flow; proposal scope-writer currently lacks auth middleware | partially implemented | No broad auth redesign added in this pass; documented as remaining gap | none | Build/tests + call-path inspection | Scope-writer auth hardening is a separate change candidate beyond July 7–11 restoration evidence |

---

## Implemented narrow restoration/connection in this pass

### Project detail “Shared vision + site context” editor (target-native)

Implemented a narrow, schema-safe improvement in `src/routes/_authenticated/projects.$id.tsx`:
- Added editable overview fields for existing `projects` columns (`summary`, `budget_min`, `budget_max`, `desired_timeline`, `site_notes`, `measurement_notes`).
- Added save mutation with query invalidation.
- Kept architecture intact (no new table, migration, route, or service).

This closes a real connection gap for schema-supported Shared Vision data on the live project-detail workflow.

---

## Validation run (this pass)

From repository root `/home/runner/work/manyhats-app-2c1090de/manyhats-app-2c1090de`:

- `npm ci` ✅
- `npm run test` ✅ (4 passed, 1 skipped)
- `npm run build` ✅
- `npm run lint` ⚠️ pre-existing formatting violations (3887 issues)
- `npx tsc --noEmit` ⚠️ pre-existing `/auth` route `search` typing errors

CI/build investigation via GitHub Actions MCP:
- listed workflow runs (`list_workflow_runs`)
- inspected failed run `29147834726` metadata
- retrieved failed logs summary (`failed_jobs: 0`, no failed jobs surfaced for that run)

---

## Security/DB guardrails check

- No migration edits to previously-applied files.
- No new DB objects created.
- Existing RLS/auth model preserved.
- No service-role secrets added to client code.
- Shared-vision connection change reuses existing authenticated Supabase access patterns.

---

## Final status

**INCOMPLETE — REVIEW REQUIRED**

Reason:
- The target-native, schema-safe shared-vision connection gap was implemented.
- But full July 7–11 source commit/file completeness cannot be proven in this environment due direct source-repo access failure (`404/permission`).
- Remaining work to reach strict “COMPLETE” is an environment with readable access to `Hollows12/manyhats-app` commit diffs/files for 2026-07-07..2026-07-11.
