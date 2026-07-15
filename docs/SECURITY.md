# ManyHats Pro — Security Architecture

> **Version:** V1 Baseline · 2026-07-15  
> Describes the implemented security model. No planned or aspirational features.

---

## Security Model Overview

ManyHats Pro uses a **defense-in-depth** model with three security layers:

1. **Authentication** — Supabase Auth (JWT-based)
2. **Authorization** — Row Level Security (RLS) on every table
3. **Server function middleware** — `requireSupabaseAuth` for sensitive server-side operations

---

## Authentication

### Supabase Auth
- **Provider:** Supabase Auth with email/password + Google OAuth
- **Token type:** JWT (HS256 signed by Supabase)
- **Token storage:** Browser localStorage (Supabase client default)
- **Session management:** Auto-refresh via `@supabase/supabase-js`

### Browser Client (`src/integrations/supabase/client.ts`)
- Uses **publishable anon key** (safe for browser exposure — no privileged access)
- All queries run with the user's JWT → RLS policies apply
- Auth state managed via `supabase.auth.onAuthStateChange`

### Server Admin Client (`src/integrations/supabase/client.server.ts`)
- Uses **service role key** from `process.env.SUPABASE_SERVICE_ROLE_KEY`
- Bypasses RLS — **only used in trusted server-side operations**
- Loaded lazily via Proxy — never in client bundle
- Only imported from `.server.ts` files and server function handlers

### Middleware: `requireSupabaseAuth`
Located in `src/integrations/supabase/auth-middleware.ts`:

```mermaid
flowchart LR
    REQ[Incoming Request] --> HDR{Authorization\nheader present?}
    HDR -->|No| ERR1[401: No authorization header]
    HDR -->|Yes| BEARER{Starts with\n'Bearer '?}
    BEARER -->|No| ERR2[401: Only ******
    BEARER -->|Yes| EXTRACT[Extract JWT]
    EXTRACT --> VALIDATE[supabase.auth.getClaims token]
    VALIDATE -->|invalid| ERR3[401: Invalid token]
    VALIDATE -->|valid| NEXT[next with context:\n{ supabase, userId, claims }]
```

Used on all sensitive server functions in `src/lib/firecrawl/pricing.functions.ts`, `src/lib/voice.functions.ts`, `src/lib/schema-check/schema.functions.ts`.

**Known gap:** `src/lib/scope-writer.functions.ts` does not use `requireSupabaseAuth` — it validates `LOVABLE_API_KEY` but does not verify a Supabase user JWT. This is a pre-existing technical debt item.

---

## Role-Based Access Control

### Roles (`app_role` enum)

| Role | Description | Access Level |
|------|-------------|-------------|
| `admin` | Company administrator | Full platform access + user management |
| `crew` | Field crew / staff | Full project access, no user management |
| `client` | Client portal user | Own project data only (read) |

### Helper Functions (SECURITY DEFINER)

```sql
-- Returns true if user has the specified role
has_role(user_id UUID, role app_role) → BOOLEAN

-- Returns true if user is admin or crew
is_staff(user_id UUID) → BOOLEAN
```

Both functions are:
- `SECURITY DEFINER` — run as the function owner (superuser context)
- `STABLE` — safe for query planning
- Revoked from `PUBLIC`, `anon`, `authenticated` — called only internally by RLS policies

### `useRole` hook (`src/hooks/use-auth.ts`)
Client-side role check for UI-level gating (show/hide menu items). **Not a security boundary** — all actual security enforcement is in RLS and server middleware.

---

## Row Level Security (RLS)

Every table has RLS enabled. Summary of policy patterns:

### Staff Full Access Pattern
```sql
-- Most tables use this pattern
CREATE POLICY "staff_all" ON public.table_name FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
```

Tables using this pattern: `projects`, `clients`, `estimates`, `proposals`, `invoices`, `payments`, `change_orders`, `job_tasks`, `job_costs`, `receipts`, `daily_logs`, `concept_requests`, `client_file_shares`, `voice_notes`, `project_photos`, `measurements`, and more.

### Client Read Access Pattern
```sql
-- Client can read their own project
CREATE POLICY "projects_client_read" ON public.projects FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.client_id = projects.client_id
  ));
```

### Admin-Only Write Pattern
```sql
-- Suppliers and materials: staff read, admin write
CREATE POLICY "staff read suppliers" ON public.suppliers FOR SELECT
  USING (public.is_staff(auth.uid()));
CREATE POLICY "admin write suppliers" ON public.suppliers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
```

### User Self-Management Pattern
```sql
-- Profiles: users manage only their own
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
```

### RLS Policy Table

| Table | Staff | Admin only write | Client read | Other |
|-------|-------|-----------------|-------------|-------|
| user_roles | read own + admin | admin all | — | — |
| profiles | staff read | — | self read/write | — |
| clients | all | — | self (via auth_user_id) | — |
| projects | all | — | self (via profiles.client_id) | — |
| project_photos | all | — | — | — |
| estimates | all | — | — | — |
| proposals | all | — | — | client read via proposal_client_read |
| proposal_signatures | all | — | client insert | — |
| invoices | all | — | — | — |
| payments | all | — | — | — |
| suppliers | read | all | — | — |
| materials | read | all | — | — |
| material_prices | read | all | — | — |
| client_file_shares | all | — | — | public via RPC |
| activity_logs | all | — | — | — |

---

## Portal Security (Public Routes)

The three portal routes (`/portal/proposal/:token`, `/portal/invoice/:token`, `/portal/client-file/:token`) are **publicly accessible** but security is enforced via:

### Proposal Portal
- Token is a UUID stored in `proposals.portal_token`
- `portal_get_proposal(token)` RPC only returns data if token is valid and not expired
- No internal cost data, AI draft history, or staff notes returned
- Client signature → `portal_accept_proposal()` — only writes to `proposal_signatures` scoped to the token

### Invoice Portal
- Token in `invoices.portal_token`
- `portal_get_invoice(token)` — public read by token
- `portal_mark_invoice_viewed(token)` — records view timestamp

### Client File Portal
Two-factor access:
1. **URL token** — shared via link
2. **Email PIN** — 4-digit code, bcrypt hashed (`pgcrypto.crypt`)

Security controls:
- Max 5 PIN attempts before `pin_locked_until` lockout
- All accesses logged in `client_file_share_views` with IP + user agent
- Shares expire (configurable days)
- Staff can revoke any share at any time (`revoke_client_file_share`)
- PIN rotation available (`rotate_client_file_share_pin`)

---

## Storage Security

```
Storage bucket: field-photos
Policy "fp_staff_all":
  FOR ALL TO authenticated
  USING (bucket_id = 'field-photos' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'field-photos' AND public.is_staff(auth.uid()))

Storage bucket: concepts
Policy "cp_staff_all": same pattern

Storage bucket: proposals-pdf
Policy "pp_staff_all": same pattern
```

All storage buckets are **private** (no public access). Staff-only access via Supabase Storage RLS. Clients access proposal PDFs through the server-generated presigned URL in the proposal portal.

---

## Tenant Isolation

ManyHats Pro is currently single-tenant (one company: ManyHats Construction LLC). All data in the database belongs to one organization.

The role hierarchy (`admin` → `crew` → `client`) provides within-tenant access control:
- Staff see all company data
- Clients see only their own project data

**Future Roadmap:** Multi-tenant isolation (separate company_id per record, company-scoped RLS) when the platform expands to serve multiple contractor companies.

---

## Secret Management

| Secret | Storage | Access |
|--------|---------|--------|
| `SUPABASE_URL` | `.env` + server env | Public — safe in browser |
| `SUPABASE_PUBLISHABLE_KEY` | `.env` + server env | Public — anon key, intended for browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Server env only | Never in client bundle; `.server.ts` only |
| `LOVABLE_API_KEY` | Server env only | AI Gateway calls; server functions only |
| `FIRECRAWL_API_KEY` | Server env only | `src/lib/firecrawl/client.server.ts` only |

**No secrets are hardcoded in source code.** All secrets are environment variables.

---

## Audit Logging

### `activity_logs` table
- Records all significant staff actions
- Fields: `actor_id`, `project_id`, `action`, `entity_type`, `entity_id`, `metadata JSONB`, `is_client_visible`
- `notify_staff()` RPC inserts into `notifications` for real-time staff alerts

### `audit_trails` table
- Immutable append-only audit records
- Used for compliance-sensitive operations (proposal acceptance, payment recording)

### `client_file_share_views` table
- Every client file portal access logged with `viewed_at`, `ip_address`, `user_agent`
- Staff can review access history

### `error_logs` table
- Application errors captured by `src/lib/error-capture.ts`
- Viewable at `/admin/logs`

---

## Known Security Gaps (Technical Debt)

| Gap | Risk | Mitigation | Recommended Fix |
|-----|------|-----------|----------------|
| ~~`scope-writer.functions.ts` has no `requireSupabaseAuth`~~ **Fixed** | ~~AI calls accessible without Supabase user verification~~ | Fixed: `requireSupabaseAuth` middleware added | ✅ Resolved — commit on `copilot/auditrestore-july-10-11-work-one-more-time` |
| No `password_hibp_enabled` on Supabase Auth | Weak/breached passwords accepted | Supabase default policy still applies | Enable HIBP in Supabase Auth settings |
| Client portal PIN sent via manual email | PIN transmission not audited | Share is time-limited and revocable | Implement automated email via app email infra |
| No rate limiting on portal token endpoints | Token enumeration possible | UUIDs are not enumerable | Add edge-level rate limiting |

### Security fix log

#### 2026-07-15 — scope-writer authorization gap closed

**What changed:** `src/lib/scope-writer.functions.ts` — added `.middleware([requireSupabaseAuth])` to the `writeScope` server function.

**Why:** The `writeScope` function was validating `LOVABLE_API_KEY` (confirming the call came from a trusted server context) but was not verifying that the caller held a valid Supabase JWT. Any request with the correct server-side key could invoke the AI scope writer without an authenticated session. All other AI-backed server functions (`transcribeVoiceNote`, `generateConceptImage`, `enrichMaterialPrice`) already required `requireSupabaseAuth`. This one-line middleware addition brings scope-writer in line with the existing security model.

**What did NOT change:** RLS policies, tenant isolation, database schema, and all other server functions are unchanged. The fix is additive — it adds a pre-condition guard, not a redesign.
