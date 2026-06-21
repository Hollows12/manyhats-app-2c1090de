
# ManyHats Pro — v1 Build Plan

Build the full ManyHats Construction operating system. Per your answers: **all 16 modules scaffolded** with real CRUD where it matters (clients, projects, field capture, estimates, proposals, change orders, job costing), and **placeholders** for the deeper specialty features (LiDAR, sensors, local pricing API, selections center inventory). Auth covers **Mike + crew + client portal**. AI runs on **Lovable AI** (Gemini). Proposals export as **real server-generated PDFs**.

## What ships in v1

### 1. Brand & design system
- Navy (`#0B1B33`), gold (`#C9A24B`), white, dark charcoal in `src/styles.css` as semantic tokens (no hardcoded hex in components).
- Display: Playfair Display (proposals/headings). Body: Inter. Mono: JetBrains Mono.
- Dense, field-friendly UI: large tap targets, sticky bottom action bars on mobile, command-center feel — not a generic SaaS dashboard.
- Veteran-owned badge in header/footer.

### 2. Auth & roles (Lovable Cloud)
- Email/password + Google sign-in.
- `app_role` enum: `admin`, `crew`, `client`. Roles stored in separate `user_roles` table with `has_role()` security-definer function.
- `_authenticated/` layout for staff. `_authenticated/_admin/` for owner-only (settings, pricing, KB writes, user mgmt).
- Client portal at `/portal/*` — clients see only their projects, proposals, approvals.
- `profiles` table (full_name, phone, company).

### 3. Database schema (one migration)
Core tables, all with RLS + GRANTs:
- `profiles`, `user_roles`
- `clients`
- `projects` (typed enums for project_type and project_status)
- `project_photos`, `photo_tags` (with `is_real_site_photo`)
- `measurements`
- `voice_notes` (placeholder fields)
- `lidar_scans` (placeholder fields)
- `estimates`, `estimate_line_items`, `estimate_categories` enum
- `proposals`, `proposal_options` (Good/Better/Best), `proposal_signatures`
- `concept_requests` (with `must_keep`, `requested_changes`, `approved_for_proposal`, `generated_image_url`)
- `home_builds` (pre-construction, design, selections jsonb)
- `container_builds`
- `historic_projects`
- `septic_projects` (+ `septic_sensor_readings` placeholder)
- `change_orders`
- `daily_logs`, `job_tasks`
- `job_costs` (estimated vs actual)
- `knowledge_entries` (auto-populated on project close)
- `material_costs` (local pricing placeholder, ZIP/county-tied)
- `production_rates`
- `proposal_templates`, `estimate_templates`, `concept_templates` (seeded)

RLS rules:
- Staff (admin/crew) see all rows; admin-only for writes to pricing/KB/settings.
- Clients see only rows tied to their `client_id` (linked via profile).

### 4. Modules (routes)
All under `/_authenticated/`:

```text
/dashboard            Pipeline cards + recent activity
/leads                Kanban by status (Lead → Site Visit Scheduled → Field Capture)
/clients              List + detail (contact, linked projects, history)
/projects             List with filters (type, status, county)
/projects/$id         Tabs: Overview · Field Capture · Estimate · Proposal
                            · Concept Studio · Job Mgmt · Job Costing · KB
                            · [specialty tab based on project_type]
/field-capture        Mobile-first photo + measurement capture
/estimates            List + builder
/proposals            List + builder + PDF export
/concept-studio       Concept requests + AI image gen
/home-builder         Home Builder Pro module
/container-builds     Container Build Pro
/historic             Historic Restoration Pro
/septic               Sentinel Septic Pro
/job-management       Schedule, daily logs, change orders
/job-costing          Estimate vs actual variance reports
/knowledge-base       Searchable past project intelligence
/settings             Company info, users, pricing (admin only)
```

Client portal:
```text
/portal/projects      Their projects only
/portal/proposals/$id View + e-sign approval
```

### 5. AI features (Lovable AI Gateway)
- **Scope Writer** server fn `summarizeScope`: takes rough notes + project type → returns structured `{ executive_summary, existing_conditions, scope_of_work, recommendation, warranty, exclusions }` using `google/gemini-3-flash-preview` + Zod schema. Tone selector (Professional / Board-ready / Grant-friendly).
- **Concept Studio** streaming image-gen route `/api/concept-image`: takes prompt + must-keep + requested changes → streams partial images using `google/gemini-3-pro-image-preview`. Saves final to Supabase Storage `concepts` bucket. All concepts labeled "Conceptual Rendering only…".

### 6. Proposal PDF
- Server route `/api/proposals/$id/pdf` generates real PDF with React-PDF (`@react-pdf/renderer`).
- Strict order: Cover → Exec Summary → Existing Conditions → Scope → Options & Pricing → Recommendation → Timeline → Warranty → Exclusions → Payment → Signature → Concept Renderings (if any) → **Real photos last**.
- Navy/gold style, MH-YY-MMDD-### proposal numbers.
- Cover always shows: ManyHats Construction LLC, Mike Canter CEO, 740-600-1374, Veteran-Owned.

### 7. Field Capture
- Mobile camera upload to Supabase Storage `field-photos` bucket.
- Multi-tag (Before, Damage, Measurements, Progress, Finished, Reference, Concept Source, Final Work).
- "Real Site Photo" toggle enforced.
- Measurement entries with `is_confirmed` flag.
- **Hard rule enforced in proposal builder:** can't mark proposal "Ready to Send" unless project has ≥1 confirmed measurement (UI warning + server check).
- Voice notes + LiDAR shown as "Coming soon" cards with stored placeholder records.

### 8. Estimate Builder
- Add/edit/delete line items, auto-calc subtotal/markup/contingency/tax/grand total.
- Categories enum (Labor, Material, Equipment, Subcontractor, Fuel & Travel, Permit, Disposal, Contingency, Markup).
- "Convert to Proposal" button.
- 12 seeded estimate templates.

### 9. Job Costing
- Side-by-side estimated vs actual per category.
- Variance + margin + P/L computed.
- On project status → Complete, prompt to push a row into `knowledge_entries`.

### 10. Seed data
- Sample client: **Hideaway Airbnb Client**
- Sample project: **Hideaway Airbnb Container Build** (Estimating) with full line items.
- Sample proposal with Good/Better/Best options.
- Sample concept request: **Turn-Key Hideaway Airbnb Concept** with full must-keep/requested-changes text.
- Sample home project: **Custom Home Concept Build** (Lead).
- 12 estimate templates + 10 concept templates + sample production rates.

### 11. Important rules baked in
- No final pricing without confirmed measurements (server + UI).
- All concept images carry "Conceptual rendering only…" watermark line.
- Real photos always last in PDF.
- Proposal numbers auto-generated MH-YY-MMDD-###.
- Veteran-owned + Mike's contact info in every PDF cover.

## What's deferred (placeholder UI only)
- Local pricing engine live API (Home Depot/Lowe's/Menards) — table + manual entry shipped, "Connect supplier" button is placeholder.
- LiDAR / ARKit / WebXR — record CRUD only, no scan processing.
- Septic sensor live data — dashboard + readings table only.
- Selections Center inventory catalog — free-text fields only, no product database.
- Schedule/Gantt — daily logs + task list only, no Gantt timeline.
- Draw request workflow — change orders only.

## Technical notes
- TanStack Start, Supabase via Lovable Cloud, TanStack Query for all reads (`ensureQueryData` + `useSuspenseQuery`).
- All AI/PDF calls via `createServerFn` (PDF) and server routes (streaming image gen).
- `requireSupabaseAuth` on every write; admin role checks via `has_role`.
- Two storage buckets: `field-photos` (private), `concepts` (private), `proposals-pdf` (private).
- Sitemap + robots.txt scaffolded.

## Build order
1. Design system + brand
2. Enable Cloud, auth, roles, profiles, RLS
3. Full schema migration + seed data
4. Routing skeleton (all 16 module routes) + sidebar nav
5. Clients + Projects CRUD
6. Field Capture (photos + measurements)
7. Estimate Builder
8. Proposal Builder + PDF export
9. AI Scope Writer
10. Concept Studio + streaming image gen
11. Job Mgmt + Job Costing + Change Orders
12. Specialty modules (Home/Container/Historic/Septic) — tabs + fields
13. Knowledge Base
14. Client portal
15. Dashboard pipeline

This is a multi-step build. I'll ship it in passes and check in if anything needs your call (e.g. brand assets, logo upload).
