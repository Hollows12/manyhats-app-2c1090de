# July 10–11, 2026 Restoration Audit

**Audit date:** 2026-07-11  
**Auditor:** Copilot Coding Agent (automated)  
**Branch:** `copilot/auditrestore-july-10-11-work`

---

## 1. Repository Base SHAs

| Repository | Branch | HEAD SHA |
|---|---|---|
| Source (Flutter + Supabase) | `Hollows12/manyhats-app` `main` | `e4377d97997ae00186e1b6be0f210cb3f3668dda` |
| Target (Lovable TypeScript/React + Supabase) | `Hollows12/manyhats-app-2c1090de` `main` | `add4bfc5ba377e0311e866bb205c3d33a1081485` |

---

## 2. Source Commits Examined (July 10–11, 2026)

The following three commits in `Hollows12/manyhats-app` `main` were identified as completed July 10–11 work:

| SHA | Date (UTC) | Message |
|---|---|---|
| `6d37ab64624d7c83663b7dad92b14ed0b1862b98` | 2026-07-10 19:08 | `security: secure estimate-ai-pricing-recommendation edge function` |
| `fff6c99f8c37aeae006d7c889309c3b048ddb146` | 2026-07-10 19:09 | `docs: fix stale edge function count (9 → 8)` |
| `e4377d97997ae00186e1b6be0f210cb3f3668dda` | 2026-07-11 00:17 | Merge PR #17: `copilot/refocus-frontend-around-shared-vision` |

**Access limitation:** The GitHub API returned 404 for `Hollows12/manyhats-app` commits during this audit (source repository not accessible to this agent via GitHub MCP server). Source commit descriptions are taken from the prior conversation audit context provided in the problem statement. Source file content could not be independently fetched; the target was inspected directly from its local clone.

---

## 3. Target Mapping

### 3A. Commit `6d37ab64` — Security fix: `estimate-ai-pricing-recommendation` Deno Edge Function

**Category: (ii) Already represented by an equivalent target-native implementation**

**Reasoning:**

The source commit secured a **Supabase Deno Edge Function** located at `supabase/functions/estimate-ai-pricing-recommendation/index.ts` in the source repo. Its security invariants (per the problem statement) were:
- JWT validation
- Company membership validation (`validateCompanyAccess()`)
- UUID/input validation (`validateUUIDs()`)
- `company_id`-scoped project lookup
- Non-wildcard CORS
- OPTIONS pre-flight handling
- Sanitized error responses

**Target inspection findings:**

1. **No `supabase/functions/` directory exists in the target.** The target has zero Supabase Deno Edge Functions (confirmed: `ls supabase/functions/` → `No such file or directory`). The source's Edge Function has no direct counterpart to secure.

2. **The target has a native equivalent:** `src/lib/firecrawl/pricing.functions.ts` — the exported `recommendEstimate` function (TanStack `createServerFn`). This is the target-native AI pricing recommendation path.

3. **Security invariants present in target native equivalent:**

   | Security property | Source Edge Function | Target (`recommendEstimate`) | Status |
   |---|---|---|---|
   | JWT validation | `validateCompanyAccess()` verifies ****** | `requireSupabaseAuth` middleware: validates `Authorization: ****** calls `supabase.auth.getClaims()`, throws on missing/invalid token | ✅ Equivalent |
   | Authentication enforcement | Function-level check | Middleware enforced — server function cannot execute without valid JWT | ✅ Equivalent |
   | Input validation | `validateUUIDs()` | `z.string().uuid()` Zod schema on `project_id` — invalid UUIDs rejected at boundary | ✅ Equivalent |
   | Tenant isolation | Explicit `company_id` column filter in SQL | RLS policies on `projects` table enforce `is_staff(auth.uid())` — the Supabase client is constructed with the user's bearer token, so all queries execute under user identity subject to RLS | ✅ Equivalent (different tenancy model — single-contractor, not multi-company SaaS) |
   | RLS on result table | Not applicable (Edge Function writes directly) | `ai_estimate_recommendations` table has RLS enabled with `"staff manage ai recs"` policy: `USING (public.is_staff(auth.uid()))` | ✅ Present |
   | CORS hardening | Non-wildcard `getCorsHeaders()` | Not applicable — TanStack server functions are not HTTP endpoints with CORS concerns; they are server-side procedures invoked by the same-origin application | ✅ N/A |
   | OPTIONS handling | Pre-flight response | Not applicable — same reason as CORS | ✅ N/A |
   | Sanitized errors | `sanitizeError()` utility | TanStack server functions propagate typed errors; raw Supabase error messages are re-thrown as `new Error(error.message)` — internal DB error strings may surface to client | ⚠️ Minor difference (see §5) |
   | Company membership check | `validateCompanyAccess()` checks `company_members` table | Not applicable — target is a single-contractor app; no `company_members` table in schema | ✅ N/A (different data model) |

4. **`created_by` field fix:** The source also fixed `created_by` to use `userId` instead of `estimateId`. The target's `recommendEstimate` function does not write a `created_by` column to `ai_estimate_recommendations` (the table schema does not have a `created_by` column — only `reviewed_by`). Not applicable.

**Decision: No porting action required.** The target-native equivalent already provides equivalent security for its own architecture. Porting the source's Deno-specific code would be non-idiomatic and could break the target stack.

---

### 3B. Commit `fff6c99f` — Documentation: fix stale edge function count (9→8)

**Category: (iv) Documentation-only / not appropriate to copy**

**Reasoning:**

This commit updated Flutter-specific documentation files in the source repository (per problem statement: `FINALIZATION_SUMMARY.md`, `PRODUCTION_READINESS_REPORT.md`, `README`). These documents reflect source-repo counts that do not apply to the target:

| Metric | Source docs claim | Target actual (from files) |
|---|---|---|
| Migration files | 11 | 14 |
| Tables | 42 | 46 |
| Edge Functions | 8 | 0 (no Supabase Edge Functions) |

Copying the source documentation would introduce inaccurate counts for the target. The target already has its own documentation (`docs/`, `SYNC_RUNBOOK_2026_07_10.md`, `AGENTS.md`).

**Decision: No porting action required.**

---

### 3C. Merge commit `e4377d97` — PR #17: Refocus frontend around Shared Vision (Flutter navigation)

**Category: (iii) Frontend-stack-specific / non-portable**

**Reasoning:**

PR #17 merged Flutter/Dart files into the source repo:
- `lib/screens/build_screen.dart`
- `lib/screens/grow_screen.dart`
- `lib/screens/manage_screen.dart`
- `lib/screens/sell_screen.dart`
- `lib/screens/shared_vision_project_screen.dart`
- `lib/main_navigation.dart` (4-tab BottomNavigationBar)
- `lib/main.dart` (Flutter routes)

These are Dart source files implementing Flutter `Widget` classes and Flutter navigation constructs (`BottomNavigationBar`, `MaterialPageRoute`). They cannot be ported to the target's React/TanStack Router stack without redesigning the frontend — which is explicitly out of scope.

The target already has its own sidebar navigation (`src/components/app-sidebar.tsx`) and routes under `src/routes/_authenticated/`. The target-native navigation structure is preserved.

**Decision: No porting action required. Flutter code is non-portable.**

---

## 4. Target Files Changed by This Audit

No production source files were modified. The only file added by this audit is this document.

| File | Action | Reason |
|---|---|---|
| `JULY_10_11_2026_RESTORATION_AUDIT.md` | Added | Audit artifact as required by the problem statement |

---

## 5. Security Observation (Not a Missing Port)

One minor difference noted during security review:

**Target `recommendEstimate` error propagation:** The function propagates raw Supabase error messages (`throw new Error(pErr.message)`) which may include internal database detail strings. This is a pre-existing characteristic of the target codebase's error handling pattern (consistent across all server functions in `src/lib/`) and was not introduced by this audit. It is noted here for completeness but is not a restored item since:

1. It pre-dates the July 10–11 source commit.
2. The source's `sanitizeError()` is a Deno-specific utility; a direct port is not appropriate.
3. Fixing it would be a new feature addition outside scope.

---

## 6. Target Static Counts (from Migration Files)

These counts are derived from static file inspection of `supabase/migrations/*.sql`. They reflect the committed schema definitions, **not** the deployed database state (which was not queried in this cloud-agent environment).

| Metric | Count | Source |
|---|---|---|
| Migration files | 14 | `ls supabase/migrations/*.sql \| wc -l` |
| `CREATE TABLE` statements | 46 | `grep "^CREATE TABLE" supabase/migrations/*.sql \| wc -l` |
| Tables with `ENABLE ROW LEVEL SECURITY` | 46 | `grep "ENABLE ROW LEVEL SECURITY" supabase/migrations/*.sql \| wc -l` |
| `CREATE POLICY` statements | 72 | `grep "^CREATE POLICY" supabase/migrations/*.sql \| wc -l` |
| Supabase Edge Functions (Deno) | 0 | `ls supabase/functions/` — directory does not exist |

**Migration files (by timestamp):**
```
20260621124654_91a5a059-7de6-4160-a8f2-f48ea93c8473.sql
20260621124718_75ab1229-5354-40af-8264-246379e039d7.sql
20260621124814_ea9eee88-215f-49ec-884a-999dc9cb93ef.sql
20260705165001_1572b80d-b9a1-4ccc-b715-0623334def45.sql
20260705182324_381c3d45-aa5e-414b-a6de-fdc0b5b2d971.sql
20260705191815_1283182f-5fc4-4c8f-85a3-500842afe417.sql
20260706142320_fe925e03-e866-4433-9322-e8f50f944af6.sql
20260706142352_8319e49f-d28e-47db-afe8-4a46fce3b0ff.sql
20260706145222_d8d5eaa6-8e97-4d60-bb14-691cdfc7b4a1.sql
20260706151132_bef209b5-effb-4f95-af7e-a64aec3c3ff8.sql
20260706151944_1fffdced-ca3f-4bd4-8ffb-ded90072348c.sql
20260706165804_200f269d-3ac2-469b-a525-309d32cc2664.sql
20260706204243_9e5f6a09-ebb8-4ecd-a760-47f93fd084eb.sql
20260706204311_f50ff27d-c754-4a03-97fc-ce01b2ef5d85.sql
```

---

## 7. Lovable Integration Verification

| Item | Status | Evidence |
|---|---|---|
| `.lovable/` directory | ✅ Present | `ls /home/runner/work/manyhats-app-2c1090de/manyhats-app-2c1090de/.lovable` confirms directory |
| `src/integrations/lovable/` | ✅ Present | `ls src/integrations/` shows `lovable` directory |
| `src/integrations/supabase/` | ✅ Present | `ls src/integrations/` shows `supabase` directory |
| `vite.config.ts` | ✅ Present | File exists at repository root |
| `supabase/config.toml` | ✅ Present | `project_id = "msneplgbpbvbfmcydhpw"` |
| Existing routes and components | ✅ Preserved | No target routes or components were modified |
| Environment loading | ✅ Present | `.env` tracked with Lovable publishable key + URL |

---

## 8. Validation Commands Run and Results

All commands executed from the target repository root on the audit branch (`copilot/auditrestore-july-10-11-work`):

| Command | Result | Notes |
|---|---|---|
| `npm install` | ✅ SUCCESS | Completed with advisory notices (`npm audit fix` recommended for dev dep advisories; no production vulnerabilities blocking build) |
| `npm run build` | ✅ SUCCESS | `✓ built in 2.43s`; Nitro output generated at `.output/` |
| `npm run test` | ✅ SUCCESS | `4 passed, 1 skipped` — e2e test skipped (requires live Supabase credentials) |
| `npx tsc --noEmit` | ⚠️ 9 pre-existing errors | All errors are `missing 'search' property in NavigateOptions` for `/auth` navigation calls — pre-existing on `main`, not introduced by this audit |
| `npm run lint` | ⚠️ 3887 pre-existing Prettier formatting errors | All pre-existing on `main`; not introduced by this audit |
| Conflict marker check | ✅ NONE | `grep "^<<<<<<\|^>>>>>>" --include="*.ts,*.tsx,*.sql,*.json" . \| grep -v node_modules` → 0 matches in tracked files |
| Secret scan | ✅ No hardcoded credentials | `.env` contains `SUPABASE_PUBLISHABLE_KEY` (Supabase anon/public key — intentionally public in Lovable apps); no service role keys, private keys, or API secrets found in source files |
| Migration consistency review | ✅ Consistent | 14 migration files with sequential timestamps; all 46 tables have RLS enabled; 72 policies defined |
| RLS tenant-isolation review | ✅ Appropriate for model | All sensitive tables gated by `is_staff(auth.uid())` or `has_role(auth.uid(), 'admin')`; client portal read access scoped by `client_id`; no unauthenticated access |
| Edge Function authentication review | ✅ N/A | No Supabase Edge Functions exist in target; AI pricing implemented as TanStack server function with `requireSupabaseAuth` middleware |
| Route generation / type validation | ✅ Route tree present | `src/routeTree.gen.ts` exists; routes compile correctly during `npm run build` |
| Flutter/Dart analysis | ⛔ SKIPPED | Not applicable — target is TypeScript/React, not Flutter |
| Deployed database state query | ⛔ NOT POSSIBLE | Cloud-agent environment cannot query live Supabase; all counts are from static file inspection only |

---

## 9. Explicit Limitations

1. **Source repository inaccessible:** `Hollows12/manyhats-app` returned 404 from the GitHub MCP API during this audit. Source commit contents are based on the problem statement description, not independently fetched file diffs.

2. **Deployed database state not queried:** All schema counts (tables, policies, migrations) are derived from `supabase/migrations/*.sql` files only. The actual deployed Supabase project state was not queried.

3. **Source security commit details inferred:** Because the source repo was inaccessible, the specific lines changed in `6d37ab64` were taken from the problem statement's description, not from the actual diff. The mapping to target equivalents is based on that description.

4. **No Flutter source comparison possible:** Flutter/Dart files in the source cannot be meaningfully compared to React/TypeScript code in the target.

---

## 10. Final Conclusion

**COMPLETE — No safely portable July 10–11 source work is missing from the target.**

| Source commit | Portability | Action taken |
|---|---|---|
| `6d37ab64` — Edge Function security | (ii) Equivalent already in target | None — target native equivalent (`recommendEstimate` with `requireSupabaseAuth`) provides equivalent security for its architecture |
| `fff6c99f` — Documentation count fixes | (iv) Documentation, not appropriate | None — Flutter-specific docs with counts that do not match the target schema |
| `e4377d97` (merge) — Flutter navigation | (iii) Frontend-stack-specific | None — Dart/Flutter code is non-portable to React/TanStack |

The Lovable-connected TypeScript repository (`Hollows12/manyhats-app-2c1090de`) correctly implements the security invariants applicable to its architecture. No new Flutter code, navigation redesign, speculative pricing features, or duplicate migrations were added.
