# ManyHats Pro

> **V1 Architectural Baseline — established 2026-07-15**

Contractor operations platform for ManyHats Construction LLC. Built with TanStack Start, Supabase, and Cloudflare Workers.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | TanStack Start (React 19, Vite 8) |
| Routing | TanStack Router (file-based) |
| State | TanStack Query |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Storage | Supabase Storage |
| AI | Lovable AI Gateway (Gemini 3 Flash) |
| Email | Resend (transactional) |
| Payments | Stripe |
| Hosting | Cloudflare Workers (Nitro adapter) |

---

## Workflow

```
Shared Vision → Field Capture → Estimate → Proposal → Client Approval
→ E-Signature → Project → Invoice → Payment → Profit Dashboard → Client Portal
```

---

## Architecture documentation

See [`docs/`](./docs/) for the complete V1 architecture reference:

- [`V1_BETA_SOURCE_OF_TRUTH.md`](./docs/V1_BETA_SOURCE_OF_TRUTH.md) — complete private-beta
  product and acceptance contract preserving the original V1 plan
- [`V1_RELEASE_GATES.md`](./docs/V1_RELEASE_GATES.md) — technical, operational and device gates
- [`ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — stack overview, directory map, auth flow
- [`DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md) — all 46 tables, 14 migrations, RPCs
- [`SECURITY.md`](./docs/SECURITY.md) — auth, RLS patterns, portal security
- [`WORKFLOWS.md`](./docs/WORKFLOWS.md) — Mermaid workflow diagrams
- [`ROADMAP_V1.md`](./docs/ROADMAP_V1.md) — prioritized remaining work
- [`V1_ARCHITECTURE_FREEZE.md`](./docs/V1_ARCHITECTURE_FREEZE.md) — baseline freeze marker

---

## Getting started

### Prerequisites

- Node.js 20+
- Supabase project (URL + keys)
- Lovable AI Gateway key
- Resend API key (email)
- Stripe secret key (payments)

### Environment variables

```
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
LOVABLE_API_KEY=
FIRECRAWL_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@yourdomain.com
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

### Development

```bash
npm install
npm run dev       # Vite dev server
npm run build     # Production build
npm run test      # Vitest (4 pass / 1 skipped)
```

---

## V1 completion status

**Money loop complete; private-beta acceptance remains in progress.** The contractor money loop — lead → estimate → proposal → e-signature → deposit → project → invoice → payment → profit dashboard → client portal — is implemented end-to-end. Complete V1 readiness additionally requires every mandatory capability and test in the private-beta source of truth.

See [`docs/BUILD_STATUS.md`](./docs/BUILD_STATUS.md) for the detailed feature audit and [`docs/ROADMAP_V1.md`](./docs/ROADMAP_V1.md) for remaining V1 work.

---

*Veteran-owned contractor platform · ManyHats Construction LLC · Mike Canter, CEO*
