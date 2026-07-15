# ManyHats Pro — System Overview

> **Version:** V1 Baseline · 2026-07-15  
> Reflects actual implemented state. Future Roadmap items are clearly marked.

---

## Company & Mission

**ManyHats Construction LLC** — Veteran-Owned Contractor  
Owner: Mike Canter, CEO & Owner  
Phone: 740-600-1374  
Specialties: Heavy Civil · Concrete · Masonry · Utilities · Historic Restoration

ManyHats Pro is the field-to-finance management platform for ManyHats Construction. It replaces disconnected spreadsheets and paper with a single connected system covering every stage from first client contact through final payment.

---

## Overall Completion (V1 Baseline)

```
Lead ✅ → Project ✅ → Estimate ✅ → Proposal ✅ → Invoice ⚠ → Payment ⚠ → Profit ⚠
```

| Phase | Status |
|-------|--------|
| CRM (clients, leads, contacts) | ✅ Complete |
| Project management spine | ✅ Complete |
| Field capture (photos, measurements, voice, GPS) | ✅ Complete |
| Estimate builder | ✅ Complete |
| Proposal generator + AI scope writer | ✅ Complete |
| Proposal portal (client view/sign) | ✅ Complete |
| Concept rendering (AI) | ✅ Complete |
| Smart pricing engine (Firecrawl) | ✅ Complete |
| Invoice generation | ⚠ Schema complete, UI present, email delivery missing |
| Payment recording | ⚠ Schema complete, UI present, Stripe not connected |
| Client file (Universal Client File) | ✅ Complete |
| Client file portal (PIN-protected) | ✅ Complete |
| Invoice portal (token-based) | ✅ Complete |
| Knowledge base | ✅ Complete |
| Job management (tasks, daily logs) | ✅ Complete |
| Job costing | ⚠ Estimated vs actual; no drill-in form |
| Specialty modules (home/container/historic/septic) | ⚠ Shell pages |
| Team management + invitations | ✅ Complete |
| Dashboard KPIs | ⚠ Counts + recent; no revenue/profit tiles |
| Admin tools (git sync, logs, schema diff) | ✅ Complete |

---

## Route Inventory

### Public Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `routes/index.tsx` | Landing page — brand, CTA to `/auth` |
| `/auth` | `routes/auth.tsx` | Email + Google sign-in, invite token accept, forgot password |
| `/reset-password` | `routes/reset-password.tsx` | Password recovery flow |
| `/email-help` | `routes/email-help.tsx` | Support / contact page |

### Client Portal Routes (Public, token-authenticated)

| Route | Component | Description |
|-------|-----------|-------------|
| `/portal/proposal/:token` | `portal.proposal.$token.tsx` | View, sign, pay deposit on proposal |
| `/portal/invoice/:token` | `portal.invoice.$token.tsx` | View, pay invoice |
| `/portal/client-file/:token` | `portal.client-file.$token.tsx` | PIN-protected universal client file |

### Authenticated Staff Routes

| Route | Component | Description | Status |
|-------|-----------|-------------|--------|
| `/dashboard` | `_authenticated/dashboard.tsx` | Summary counts, recent projects | ✅ |
| `/leads` | `_authenticated/leads.tsx` | Lead kanban view | ✅ |
| `/clients` | `_authenticated/clients.tsx` | Client list + CRUD | ✅ |
| `/clients/:id` | `_authenticated/clients.$id.tsx` | Client detail | ✅ |
| `/projects` | `_authenticated/projects.tsx` | Project list + filters | ✅ |
| `/projects/:id` | `_authenticated/projects.$id.tsx` | Project hub (tabbed) | ✅ |
| `/estimates` | `_authenticated/estimates.tsx` | Estimate list (read-only) | ✅ |
| `/proposals` | `_authenticated/proposals.tsx` | Proposal list + PDF | ✅ |
| `/invoices` | `_authenticated/invoices.tsx` | Invoice list + generate | ⚠ |
| `/payments` | `_authenticated/payments.tsx` | Payment recording | ⚠ |
| `/field-capture` | `_authenticated/field-capture.tsx` | Field capture picker | ✅ |
| `/field-capture/:projectId` | `_authenticated/field-capture.$projectId.tsx` | Project field capture | ✅ |
| `/pricing` | `_authenticated/pricing.tsx` | Smart pricing / Firecrawl | ✅ |
| `/concept-studio` | `_authenticated/concept-studio.tsx` | AI concept index | ✅ |
| `/job-management` | `_authenticated/job-management.tsx` | Job task list | ⚠ |
| `/job-costing` | `_authenticated/job-costing.tsx` | Estimated vs actual | ⚠ |
| `/knowledge-base` | `_authenticated/knowledge-base.tsx` | Knowledge docs + search | ✅ |
| `/team` | `_authenticated/team.tsx` | Team + invitation management | ✅ |
| `/settings` | `_authenticated/settings.tsx` | Company + user settings | ⚠ |
| `/home-builder` | `_authenticated/home-builder.tsx` | Residential specialty | ⚠ Shell |
| `/container-builds` | `_authenticated/container-builds.tsx` | Container specialty | ⚠ Shell |
| `/historic` | `_authenticated/historic.tsx` | Historic restoration specialty | ⚠ Shell |
| `/septic` | `_authenticated/septic.tsx` | Septic specialty | ⚠ Shell |
| `/schema-diff` | `_authenticated/schema-diff.tsx` | DB schema drift tool | ✅ |

### Admin Routes (staff only)

| Route | Description |
|-------|-------------|
| `/admin/git-sync` | Git sync status and trigger |
| `/admin/logs` | Application error log viewer |

### API Routes

| Route | Description |
|-------|-------------|
| `/api/concept-image` | AI concept image generation (POST) |
| `/api/proposals/:id/pdf` | Proposal PDF generation (GET) |

---

## Project Detail — Tab Architecture

The project detail page (`/projects/:id`) is the central hub. Tabs:

| Tab value | Component | Description | Status |
|-----------|-----------|-------------|--------|
| `overview` | inline | Shared Vision editor (summary, budget, timeline, site notes, measurement notes) | ✅ |
| `field` | `ProjectFieldCapture` | Photos, measurements, GPS, LiDAR | ✅ |
| `voice` | `ProjectVoiceNotes` | Voice note recorder + transcription | ✅ |
| `receipts` | `ProjectReceipts` | Job receipts + upload | ✅ |
| `daily` | `ProjectDailyLog` | Daily log entries | ✅ |
| `estimate` | `ProjectEstimate` | Line-item estimate builder | ✅ |
| `proposal` | `ProjectProposal` | Scope writer + proposal editor + send | ✅ |
| `concept` | `ProjectConcepts` | AI concept rendering | ✅ |
| `job` | `ProjectJobMgmt` | Job tasks + scheduling | ✅ |
| `costing` | `ProjectCosting` | Cost tracking (estimated vs actual) | ⚠ |
| `financial` | `ProjectFinancial` | Invoice + payment management | ⚠ |
| `clientfile` | `ClientFileTab` | Universal client file + portal link | ✅ |
| `home` | SpecialtyPlaceholder | Home Builder Pro | ⚠ Placeholder |
| `container` | SpecialtyPlaceholder | Container Build Pro | ⚠ Placeholder |
| `historic` | SpecialtyPlaceholder | Historic Restoration Pro | ⚠ Placeholder |
| `septic` | SpecialtyPlaceholder | Sentinel Septic Pro | ⚠ Placeholder |

---

## Platform Modules

### CRM Module
- **Leads**: Kanban board by project status. Leads are projects in early-stage statuses.
- **Clients**: CRUD for client records with linked projects.
- **Invitations**: Staff invite system (admin/crew roles) via token-based email invites.

### Project Module
- Central record for all project data.
- 12 lifecycle statuses from `lead` through `complete` or `lost`.
- 38 project types across Residential, Site/Civil, Concrete/Masonry, Commercial, Specialty.
- Shared Vision overview (inline edit): summary, budget range, desired timeline, site notes, measurement notes.

### Field Capture Module
- Photo upload with category, phase, GPS coordinates, is_client_facing, proposal_include flags.
- Measurements capture (LiDAR-ready schema).
- Voice notes with transcription support.
- Receipts with photo and amount.
- Daily log entries (date, summary, crew, weather, progress).

### Estimate Module
- Line items with categories: labor, material, equipment, subcontractor, fuel/travel, permit, disposal, contingency, markup, other.
- AI estimate recommendations table for AI-suggested line items pending review.

### Proposal Module
- AI scope writer (executive summary, existing conditions, scope of work, recommendation, warranty, exclusions).
- Proposal options (alternative scopes/pricing).
- Proposal signature capture.
- PDF generation.
- Portal token for client view/sign.

### Smart Pricing Module (Firecrawl)
- Supplier discovery and management.
- Material catalog with prices.
- Firecrawl jobs for supplier discovery, material enrichment, price refresh, knowledge import.
- Production rates per category.
- Preferred vendors per contractor/trade.

### Financial Module
- Invoices (draft → sent → partial → paid → overdue → void).
- Invoice line items generated from proposal/estimate.
- Payments (cash, check, ACH, credit card, Stripe, QuickBooks, other).
- Deposits and progress billings.
- Change orders with price/timeline impact.
- Profit snapshot RPC: estimated revenue vs approved revenue vs actual costs.

### Client File System
- Universal client file aggregating all project artifacts.
- Secure share: token + email PIN bcrypt authentication.
- PIN rotation and revocation.
- Audit trail for all share accesses.

### Knowledge Base
- Docs: install guides, specs, SDS, warranty, practice, safety, other.
- Entries: searchable knowledge items linked to docs.
- Imported via Firecrawl.

### AI Module
- Scope writer (proposals).
- Concept image generation (AI rendering from field photos).
- AI estimate recommendations (pending → approved → rejected).
- Pricing recommendation engine (Firecrawl + AI).
- All AI calls routed through Lovable AI Gateway (server-side only).

### Admin / Dev Tools
- Schema diff: detects drift between expected and live Supabase schema.
- Git sync: triggers and monitors branch sync.
- Error logs: application error viewer.
- MCP server: Model Context Protocol tools for list-clients, list-projects, get-project, create-lead.
