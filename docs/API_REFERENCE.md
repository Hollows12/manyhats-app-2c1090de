# ManyHats Pro — API Reference

> **Version:** V1 Baseline · 2026-07-15  
> Documents all server functions and Supabase RPC endpoints.

---

## Architecture Overview

ManyHats Pro uses two API patterns:

1. **TanStack Start Server Functions** — TypeScript functions running in the Nitro/Cloudflare server, called from the browser via `fetch`. All sensitive operations use `requireSupabaseAuth` middleware.

2. **Supabase RPC Functions** — PostgreSQL functions called via `supabase.rpc()` from either the browser client (with RLS) or the server admin client. Portal RPCs are public (`SECURITY DEFINER`).

---

## Server Functions (TanStack Start)

All server functions are created with `createServerFn` from `@tanstack/react-start`.

Authentication pattern:
```typescript
createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])  // validates JWT, injects context
  .inputValidator((data) => Schema.parse(data))
  .handler(async ({ data, context }) => {
    // context.supabase  — authenticated Supabase client (RLS enforced)
    // context.userId    — authenticated user UUID
    // context.claims    — full JWT claims
  })
```

---

### Pricing & Firecrawl (`src/lib/firecrawl/pricing.functions.ts`)

All endpoints require `requireSupabaseAuth`. Admin-only endpoints additionally call `requireAdmin(context)`.

#### `upsertServiceArea` — POST
Sets the contractor's primary service area.

**Auth:** `requireSupabaseAuth` (any staff)  
**Input:**
```typescript
{
  zip: string          // 3–10 chars
  radius_mi: number    // 1–500, default 40
  is_primary: boolean  // default true
}
```
**Returns:** Inserted `contractor_service_areas` row

---

#### `discoverSuppliersByZip` — POST
Runs Firecrawl to discover suppliers in a ZIP code for a material category.

**Auth:** `requireSupabaseAuth` + admin  
**Input:**
```typescript
{
  zip: string      // 3–10 chars
  category: string // material category
  limit: number    // 1–20, default 10
}
```
**Returns:** Array of discovered supplier records

---

#### `enrichMaterial` — POST
Fetches detailed specs and pricing for a material via Firecrawl.

**Auth:** `requireSupabaseAuth` + admin  
**Input:** `{ material_id: UUID }`  
**Returns:** Updated `materials` row with enriched spec data

---

#### `refreshPrices` — POST
Refreshes pricing for all materials from their source URLs.

**Auth:** `requireSupabaseAuth` + admin  
**Input:** `{ supplier_id?: UUID }` (optional filter)  
**Returns:** Array of new `material_prices` records

---

#### `importKnowledge` — POST
Imports knowledge documents (install guides, SDS, specs) via Firecrawl.

**Auth:** `requireSupabaseAuth` + admin  
**Input:** `{ url: string, kind: knowledge_doc_kind }`  
**Returns:** Created `knowledge_docs` record

---

#### `getPricingRecommendation` — POST
Gets AI-powered pricing recommendations for a project estimate.

**Auth:** `requireSupabaseAuth`  
**Input:** `{ project_id: UUID, estimate_id: UUID }`  
**Returns:** Array of `ai_estimate_recommendations` with suggested line items

---

### Scope Writer (`src/lib/scope-writer.functions.ts`)

#### `writeScope` — POST
AI-generates proposal scope sections from rough notes.

**Auth:** Validates `LOVABLE_API_KEY` only (⚠ known gap: no Supabase JWT check)  
**Input:**
```typescript
{
  rough_notes: string  // min 5 chars
  tone: "professional" | "board_ready" | "grant_friendly"
}
```
**Returns:**
```typescript
{
  executive_summary: string
  existing_conditions: string
  scope_of_work: string
  recommendation: string
  warranty: string
  exclusions: string
}
```

---

### Capture Router (`src/lib/capture-router.functions.ts`)

Routes captured field data to the appropriate project document target.

#### `previewCapture` — POST
Preview AI-generated content from field capture sources.

**Auth:** `requireSupabaseAuth`  
**Input:**
```typescript
{
  project_id: UUID
  photo_ids: UUID[]
  voice_note_ids: UUID[]
  target: "estimate_notes" | "proposal_scope_of_work" | "proposal_existing_conditions" | "proposal_executive_summary" | "proposal_recommendation"
  polish: boolean
}
```
**Returns:** Preview text string

---

#### `sendCapture` — POST
Writes AI-generated content to the specified target field.

**Auth:** `requireSupabaseAuth`  
**Input:** (same as previewCapture) + `body_text: string`  
**Returns:** Updated record

---

### Voice Functions (`src/lib/voice.functions.ts`)

#### `transcribeVoiceNote` — POST
Transcribes a voice note audio file and generates an AI summary.

**Auth:** `requireSupabaseAuth`  
**Input:** `{ voice_note_id: UUID }`  
**Returns:** `{ transcript: string, summary: string }`  
**Side effect:** Updates `voice_notes` record with transcript and summary

---

### Schema Check (`src/lib/schema-check/schema.functions.ts`)

#### `getSchemaSnapshot` — GET
Fetches the live Supabase schema for drift detection.

**Auth:** `requireSupabaseAuth`  
**Returns:** JSON snapshot of current schema (tables, columns, constraints)

---

### Git Sync (`src/lib/git-sync.functions.ts`)

Admin-only functions for GitHub repository sync status.

**Auth:** All require `requireSupabaseAuth` + admin role  
**Endpoints:** `checkGitSync`, `triggerGitSync`, `getGitSyncLogs`

---

## API Routes

### `POST /api/concept-image`
**File:** `src/routes/api/concept-image.ts`  
**Auth:** `requireSupabaseAuth` (via Authorization header)  
**Purpose:** Generates an AI architectural concept image

**Input:**
```typescript
{
  project_id: UUID
  concept_request_id: UUID
  source_photo_path?: string
  prompt: string
  must_keep?: string
  requested_changes?: string
}
```
**Returns:** `{ image_path: string }` — path in `concepts` storage bucket  
**Side effect:** Updates `concept_requests.status = 'generated'`, `generated_image_path`

---

### `GET /api/proposals/:id/pdf`
**File:** `src/routes/api/proposals.$id.pdf.tsx`  
**Auth:** Requires authenticated session  
**Purpose:** Generates and streams a PDF of the proposal

**Returns:** PDF stream (Content-Type: application/pdf)  
**Uses:** `@react-pdf/renderer` for PDF generation

---

## Supabase RPC Reference

### Public RPCs (no auth required)

| Function | Purpose |
|----------|---------|
| `portal_get_proposal(token TEXT)` | Read proposal data by portal token |
| `portal_mark_proposal_viewed(token TEXT)` | Record proposal view timestamp |
| `portal_accept_proposal(token, sig_data, sig_type, ...)` | Submit client signature |
| `portal_get_invoice(token TEXT)` | Read invoice by portal token |
| `portal_mark_invoice_viewed(token TEXT)` | Record invoice view timestamp |
| `portal_get_client_file(token TEXT, pin? TEXT)` | Read client file (PIN verified) |
| `portal_verify_client_file_pin(share_id UUID, pin TEXT)` | Verify PIN with attempt tracking |
| `get_invitation_preview(token TEXT)` | Preview invitation role/email |

### Authenticated RPCs

| Function | Auth | Purpose |
|----------|------|---------|
| `ensure_proposal_portal_token(proposal_id, rotate)` | Staff | Create/rotate proposal portal token |
| `ensure_invoice_portal_token(invoice_id, rotate)` | Staff | Create/rotate invoice portal token |
| `create_client_file_share(project_id, email, days, include_notes)` | Staff | Create client file share |
| `rotate_client_file_share_pin(share_id)` | Staff | Generate new PIN |
| `revoke_client_file_share(share_id)` | Staff | Revoke portal access |
| `project_profit_snapshot(project_id)` | Staff | JSONB profit calculation |
| `get_public_schema_snapshot()` | Staff | Schema drift detection |
| `accept_invitation(token)` | Authenticated | Accept staff invitation |

### Internal RPCs (called by triggers, not directly)

| Function | Trigger Event |
|----------|--------------|
| `set_updated_at()` | BEFORE UPDATE on most tables |
| `handle_new_user()` | AFTER INSERT on auth.users |
| `on_payment_insert()` | AFTER INSERT on payments → calls recalc_invoice_balance() |
| `on_proposal_signature_insert()` | AFTER INSERT on proposal_signatures → updates proposal status |
| `notify_staff(kind, message, ...)` | Called from application logic |

---

## MCP Tools (`src/lib/mcp/`)

Model Context Protocol tools for AI assistant integration:

| Tool | File | Description |
|------|------|-------------|
| `list-clients` | `tools/list-clients.ts` | Returns client list |
| `list-projects` | `tools/list-projects.ts` | Returns project list with status |
| `get-project` | `tools/get-project.ts` | Returns single project detail |
| `create-lead` | `tools/create-lead.ts` | Creates a new lead/project |

MCP endpoint: `/.mcp/` routes in `src/routes/[.mcp]/`
