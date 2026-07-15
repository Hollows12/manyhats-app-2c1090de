# ManyHats Pro — Platform Architecture V1 Freeze

**Freeze date:** 2026-07-15  
**Branch:** `docs/platform-architecture-v1`  
**Merged from:** `copilot/auditrestore-july-10-11-work-one-more-time` (restoration branch)  
**Baseline commit (main):** `f8a1c53`  
**Architecture branch commit:** `6d2dc7e`

---

## Version Freeze Statement

This is the **ManyHats Pro Platform Architecture V1 Baseline**.

The architecture described in `docs/ARCHITECTURE.md` and all related documents under `docs/` represents the **actual implemented state** of the ManyHats Pro platform as of 2026-07-15, following:

1. Validation of all restoration branch changes (2026-07-14)
2. Merge of restoration branch into main
3. Establishment of this architecture documentation branch

---

## What This Freeze Means

### For Future Development

- This document set is the **authoritative reference** for the platform architecture
- Future features **extend** this architecture — they do not redesign it
- Schema changes require new Supabase migration files — never edit applied migrations
- New server-side logic uses TanStack Start server functions — not Supabase Edge Functions
- New AI capabilities route through the Lovable AI Gateway — never embed API keys in client code
- All new tables require RLS policies following the patterns in `docs/SECURITY.md`

### What Is Fixed at V1

| Component | V1 State |
|-----------|---------|
| Frontend framework | React 19 + TanStack Start |
| Backend | Supabase (single instance) |
| Deployment target | Cloudflare Workers |
| AI provider | Lovable AI Gateway |
| Pricing intelligence | Firecrawl |
| Database | 46 tables, 14 migrations applied |
| Auth | Supabase Auth (email + Google) |
| Roles | admin / crew / client |
| Portal system | Proposal + Invoice + Client File (token + PIN) |

### What Is Not Fixed (Roadmap)

See `docs/ROADMAP_V1.md` for the complete prioritized backlog.

Top priorities before V1 feature completion:
1. Stripe payment integration (deposit + final payment)
2. Email infrastructure (transactional emails)
3. scope-writer auth middleware gap
4. Dashboard revenue/profit KPIs

---

## Validation Summary

All checks passed on 2026-07-14:

| Check | Result |
|-------|--------|
| Build (`npm run build`) | ✅ exit 0 |
| Tests (`npm run test`) | ✅ 4 passed / 1 skipped |
| TypeScript (`npx tsc --noEmit`) | ⚠ 9 pre-existing errors (TanStack Router search param) |
| Lint (`npm run lint`) | ⚠ ~3902 pre-existing Prettier violations |
| Merge conflict markers | ✅ None |
| Secrets scan | ✅ No hardcoded credentials |
| Migration integrity | ✅ All 14 migrations untouched |
| RLS policies | ✅ All tables protected |
| Edge Functions | ✅ None (correct for TanStack Start stack) |
| Lovable integration | ✅ All directories preserved |

---

## Document Index

| Document | Purpose |
|----------|---------|
| `docs/ARCHITECTURE.md` | Platform overview, stack, diagrams |
| `docs/SYSTEM_OVERVIEW.md` | Route inventory, completion status |
| `docs/DATABASE_SCHEMA.md` | All 46 tables, enums, RPCs |
| `docs/SHARED_VISION.md` | Core philosophy + data flow |
| `docs/WORKFLOWS.md` | End-to-end workflow diagrams |
| `docs/SECURITY.md` | Auth, RLS, portal security |
| `docs/AI_ARCHITECTURE.md` | AI capabilities and gateway |
| `docs/CLIENT_PORTAL.md` | Portal routes, token + PIN auth |
| `docs/API_REFERENCE.md` | Server functions + RPC reference |
| `docs/EDGE_FUNCTIONS.md` | Confirms no Deno edge functions |
| `docs/ROADMAP_V1.md` | Prioritized remaining V1 work |
| `docs/BUILD_STATUS.md` | Build/test/lint status |

---

_This freeze document is append-only. Do not modify it. Future architecture versions will create a new freeze document._
