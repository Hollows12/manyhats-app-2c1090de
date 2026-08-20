# V1 Private-Beta Gap Audit

**Audit baseline:** backend `main` at `f988099259ad15c455dc380a01d0bb9fc06e647a` and
production Supabase project `hgiwvyziupfpxzdocbxr` on 2026-08-20. Flutter findings must be
completed against its coordinated release head before the release candidate is tagged.

This audit uses `V1_BETA_SOURCE_OF_TRUTH.md` as the acceptance contract. A database table,
documentation entry, or route shell is evidence of foundation only; it is not proof of an
end-to-end private-beta workflow.

| Capability | Current evidence | Audit status | Required closure evidence |
| --- | --- | --- | --- |
| Canonical backend and production schema | PR #36 merged; production migration history includes the V1 security, entitlement, receipt, profitability and payment-integrity migrations | Implemented foundation | Re-run coordinated release checks on exact candidate |
| Money loop | Lead/project, estimate, proposal, signature, deposits, progress billing, invoices, payments, receipts and profit tables/UI exist | Implemented; device verification pending | Owner and client-actor end-to-end tests |
| Three pricing tiers and private profitability | Atomic estimate builder, proposal options, crew labor rates and profitability engine exist | Implemented; device verification pending | Low/recommended/premium and privacy acceptance tests |
| Proposal attachments/PDF | Private attachment table/storage policies and private PDF route exist | Implemented; device verification pending | Upload, access denial, client delivery and signed-copy tests |
| Shared Vision complete structured intake | Basic project, photo, voice and measurement foundations exist; older completion plan records missing goals, priorities, risks, constraints, inclusions, exclusions and readiness integration | Partial | One capture populates estimate, proposal, schedule, portal, closeout and BI |
| Offline field workflow | Flutter source-of-truth requires it; backend documentation describes queue behavior | Unverified | Real-device airplane-mode, reconnect, retry, duplicate and conflict tests |
| Universal/custom project engine | Backend has a broad project-type selector and several specialty tables; no implemented reusable phase/task/trade/dependency template engine was found | Missing/partial | Standard presets plus unrestricted custom project acceptance scenarios |
| Municipal/public works | Retainage and municipal proposal tone exist | Partial | Procurement, compliance, prevailing wage/certified payroll, bonds, submittals, RFIs and pay-app workflow |
| Pool installation | No dedicated pool workflow was found | Missing | Pool intake, phases, estimating, permits/inspections and closeout scenario |
| Excavation/land/water control/bridge | Basic excavation, site-development, drainage and stormwater project types exist | Partial | Detailed templates, takeoffs, inspections, bridge and engineered-water checkpoints |
| LiDAR Site Intelligence | Production has `lidar_scans`; no complete analysis/decision-support UI was found in backend | Missing/partial | Evidence overlays, alternatives, confidence/risk and contractor-approval workflow |
| Sentinel Septic | Production has `septic_projects`; entitlements include `sentinel_septic`; old roadmap identifies specialty UI as incomplete | Partial | Complete install/repair, mapping, permit, inspection, report and entitlement tests |
| Ultra-real rendering/concept plans/3D walkthrough | Estimate deliverables and entitlements exist | Implemented foundation | Quality, Shared Vision consistency, safety labels and device delivery tests |
| Local codes and supplier freshness | Service areas, suppliers, materials/prices and Firecrawl pricing foundation exist | Partial | Source/timestamp/freshness, jurisdiction evidence and contractor approval tests |
| Proposal revisions and immutable acceptance | Existing completion plan explicitly records missing revision request and immutable proposal version/snapshot | Missing | Versioned revision path, locked signed snapshot and signed-copy download |
| Change orders | Table and project workflow exist | Partial | Client approval, immutable snapshot, estimate/schedule/invoice/profit propagation |
| Closeout | Profit snapshot and client file foundations exist | Partial | Punch, warranty, final/as-built files, approvals and immutable closeout acceptance |
| CEO/Executive Business Assistant | Finance/profit KPIs and AI business architecture exist; no complete executive briefing, business-health, hiring, marketing and prioritized-action workflow was found | Missing/partial | Role-private Better Business dashboard and decision-support scenarios |
| Roles/audit/security | RLS on all production public tables, secure role management, activity/audit tables and portal hardening exist | Implemented foundation | Exact-candidate negative access and operational access-review evidence |
| Public multi-company SaaS | Current release gate intentionally limits V1 to controlled single-company/invited beta | Out of private-beta scope; public blocker | Organization-scoped isolation before broad public release |

## Immediate blocker order

1. Complete Flutter inventory and real-device/offline evidence mapping.
2. Implement universal/custom project templates and complete Shared Vision propagation.
3. Complete proposal revision/immutable acceptance and closeout integrity.
4. Complete Sentinel and Site Intelligence workflows with enforced entitlements.
5. Complete CEO/Executive Better Business workflows.
6. Close product polish, operational, legal/privacy, monitoring and signed-device gates.

## Production advisor note

The 2026-08-20 production security advisor run still reports informational/warning entries. The
token-facing portal functions are expected public entry points and require explicit documented
disposition based on their token, PIN, rate-limit and data-minimization controls. The
`stripe_payment_attempts` table has RLS enabled with no client policy; it is intentionally
service-only and requires explicit release documentation/negative verification rather than a
permissive client policy.
