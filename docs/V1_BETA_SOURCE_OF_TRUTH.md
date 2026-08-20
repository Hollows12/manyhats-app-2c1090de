# ManyHats Pro V1 Private-Beta Source of Truth

**Owner:** Michael Wayne Canter II

**Status:** Mandatory private-beta acceptance contract

**Product flow:** Shared Vision -> Vision Proposal -> Project Delivery -> Client Relationship -> Better Business

**Operating rule:** Capture Once. Use Everywhere.

## Authority and release boundary

- `Hollows12/manyhats-app-2c1090de` `main` owns the React office/web app, API routes,
  production Supabase migrations, RLS, Storage, payments, entitlements, estimates, proposals,
  portals, and business intelligence.
- `Hollows12/manyhats-app` `main` owns the Flutter iOS/Android field application, offline
  capture/sync, and mobile presentation.
- Supabase production project `hgiwvyziupfpxzdocbxr` is the deployed data contract and changes
  only through reviewed backend migrations.
- Private owner/device acceptance precedes the controlled contractor beta. A successful build,
  migration, or merge never authorizes App Store or Play Store publication.
- Public multi-company SaaS remains blocked until organization isolation is implemented and
  negatively tested across schema, RLS, Storage, RPCs, server functions, and portals.

## Release-critical workflow

Every stage below must work end to end without re-entering data already captured earlier:

1. Sign in, invitation, password recovery, and role-appropriate navigation.
2. Lead and client creation, follow-up, conversion, and relationship history.
3. Project creation using a standard template or a fully custom project.
4. Shared Vision capture: goals, priorities, ideas, photos/captions, voice/text notes, plans,
   scans, measurements, site conditions, inclusions, exclusions, constraints, risks, budget,
   timeline, warranty expectations, and client confirmation.
5. Offline drafts, durable upload queue, retry/backoff, idempotency, visible sync state,
   reconnect correction, duplicate prevention, and a tested conflict policy.
6. Scope and estimate generation from the Shared Vision, measurements, project template,
   jurisdiction, current supplier data, and contractor-configured rates.
7. Contractor-only review of costs, markup, overhead, contingency, tax, schedule, and profit.
8. Low, recommended, and premium client options with a clean client view that never exposes
   internal costs, AI reasoning, wages, markup details, or contractor profit.
9. Vision Proposal creation with attachments, ultra-realistic rendering, optional concept plans,
   preliminary blueprints/material lists, and entitled 3D walkthroughs.
10. Internal approval, secure delivery, client comparison, revision request, version history,
    e-signature, immutable accepted snapshot, and downloadable signed copy.
11. Payment schedule, deposit, project activation, schedule, assignments, daily logs, photos,
    documents, job costs, receipts, change orders, progress billing, invoices, and payments.
12. Closeout: final cost/profit snapshot, punch list, approvals, warranties, as-built/final files,
    client Universal File, audit trail, and long-term relationship follow-up.

## Universal construction engine

The V1 project system must support reusable templates and unrestricted custom phases, tasks,
trades, dependencies, cost items, documents, inspections, and closeout requirements.

| Family | Required private-beta coverage |
| --- | --- |
| Residential | New/custom/spec homes, additions, garages, basements, kitchens, bathrooms, whole-home remodeling, repair, outdoor living |
| Custom buildings | Barndominiums, pole barns, shops, garages, cabins, container homes and commercial/short-term-rental container builds |
| Commercial | Tenant improvements, offices, retail, restaurants, warehouses, industrial and institutional work |
| Municipal/public works | City, county, state, VA, federal and other public work; procurement/contract type, prevailing wage, certified payroll, bonds, submittals, RFIs, retainage, pay applications and compliance tracking |
| Site/civil | Excavation, clearing, grading, site development, foundations, utilities, driveways, roads, parking, retaining walls, demolition and erosion control |
| Water management | French/trench/curtain drains, swales, culverts, stormwater, drainage, runoff control, stream crossings and engineered water-control workflows |
| Bridge work | Bridge/site intake, access and constraint documentation, phases, estimating, permit/inspection/engineering checkpoints and closeout |
| Concrete/masonry | Flatwork, decorative/stamped concrete, CMU, foundations, masonry, veneer, chimneys and restoration |
| Specialty | Pools/spas, septic, landscaping, historic restoration and a fully custom fallback for work not represented by a preset |

Custom Project must permit manual configuration or AI-assisted generation from photos, voice,
plans, scans, measurements, LiDAR, site conditions, and the contractor's instructions.

## Pricing, estimating, and profitability

- Local service area, jurisdiction, state/county/city context, codes, permits, inspections,
  professional-seal checkpoints, tax rules, and supplier search radius are captured explicitly.
- Material prices support current local supplier evidence, timestamp/source, expiration/freshness,
  quote comparison, manual override, and approval before client use.
- Costing includes material, employee labor, subcontractors, equipment, production rates, fuel,
  travel, disposal, permits, tax, overhead, contingency, markup, and change-order effects.
- Contractors may configure individual employee pay/cost rates. When no labor rate is available,
  estimates may use a clearly labeled $25/hour planning fallback that the contractor must approve.
- Estimate recommendations include confidence, assumptions, missing information, risk flags, and
  low/recommended/premium choices.
- Actual-versus-estimated feedback improves future recommendations without overwriting history.
- Receipt capture posts to expenses/job costing and tax categories with duplicate protection.

## Visual construction intelligence

- Shared Vision renderings target ultra-realistic presentation and remain clearly labeled as
  visualization, not sealed construction documents.
- Concept plans and preliminary blueprint/material packages use confirmed measurements, current
  available local/state code context, site facts, and current approved material data. They expose
  assumptions and required architect/engineer/permit review.
- Subscriber 3D walkthroughs reinforce the approved Shared Vision and cannot silently alter it.
- LiDAR, photos, screenshots, scans, GPS/elevation and plans may identify slopes, low points,
  likely water paths, erosion, access limits, quantities, visible conflicts, and inspection needs.
- Site Intelligence suggestions show evidence, alternatives, confidence and risk. A contractor
  must approve a suggestion before it enters a plan, estimate, schedule, or proposal.
- AI never represents itself as a survey, utility locate, soil/percolation test, hydraulic or
  structural calculation, permit approval, or licensed professional seal.

## Sentinel Septic subscription upgrade

Sentinel remains an entitled ManyHats Pro add-on/product surface while sharing the approved core
project workflow. Private-beta testers may receive temporary access without being charged.

Required coverage includes new installation, repair, replacement, tank, distribution, piping,
leach field, excavation, disposal, materials, labor, equipment, soil/drainage/access observations,
GPS/LiDAR/elevation/slope capture, setback and permit requirements, inspection and maintenance
history, mapping/drawing support, alerts, as-built/client documentation, and exportable reports.

## Site Intelligence subscription boundary

- Standard includes ordinary excavation, grading, land management, drainage, estimating,
  proposals, scheduling, documentation, and basic project templates.
- Advanced Site Intelligence includes LiDAR terrain/slope/drainage analysis, runoff visualization,
  AI placement alternatives, cut/fill assistance, advanced takeoffs, and bridge/engineered
  water-control workflows.
- Private-beta entitlements may unlock all advanced capabilities temporarily while usage and
  failures are recorded for plan design.

## CEO and Executive Business Assistant

The V1 Better Business stage must help an owner move from owner-operator toward executive control:

- daily briefing covering jobs, schedule, cash, overdue invoices, leads, staffing, equipment,
  commitments, exceptions, and urgent risks;
- project/service/crew profitability, actual-versus-estimated results, cash-flow forecast,
  expenses, receipts, tax readiness, vendor rates, and capacity indicators;
- lead follow-up, pipeline, basic advertising/marketing suggestions, client retention, reviews,
  and recommended next actions;
- hiring timing, role descriptions, employee burden/cost, crew capacity, subcontractor planning,
  workload balance, equipment use, and maintenance reminders;
- business-health score with evidence, trends, warnings, priorities, and practical scaling steps;
- separation of private executive data from admin, crew, subcontractor, and client views;
- projections and assumptions are labeled, and financial, tax, legal, engineering, and HR outputs
  remain decision support requiring owner/professional review.

## Entitlements and beta access

- Server/database authorization is authoritative; hiding a button is not an entitlement boundary.
- Standard construction workflows remain usable without specialty upgrades.
- Rendering, concept plans, AI generators, proposal attachments, 3D walkthrough, Site Intelligence,
  and Sentinel access follow the approved plan/add-on catalog and temporary beta overrides.
- Subscription checkout remains disabled in mobile private beta until Apple/Google digital-purchase
  compliance and the public paid-release controls are approved.

## Security, reliability, and operations gates

- Auth, invitations, redirects/deep links, password recovery, session lifecycle and account
  deletion are tested on production-configured devices.
- RLS, Storage, RPC and server-function authorization prevent cross-role/cross-client access;
  privileged functions are minimal, token-protected, search-path hardened and grant-restricted.
- Secrets and service-role credentials never enter a browser or mobile build.
- Portal tokens/PINs support expiry, rotation, revocation and abuse/rate controls.
- Audit/activity history covers material project, proposal, signature, payment, role, entitlement,
  financial and closeout events.
- Backups, restore test, rollback, monitoring/crash reporting, incident response, access review,
  retention/deletion/export, privacy notice, terms and support path have current evidence.
- Automated gates include formatting/lint, type analysis, unit/integration tests, production builds,
  migration validation, secret scan, RLS/privileged-function checks, dependency audit and CodeQL.

## Private-beta acceptance

1. Owner acceptance runs for two to three days on a directly installed production-configured
   iPhone/iPad and one Android device.
2. Controlled beta then targets 8-12 people across approximately 12-18 devices using TestFlight
   and Google Play Internal Testing only.
3. Test roles include owner/admin, contractors across different specialties, crew/field staff,
   office/admin, and client actors.
4. Acceptance scenarios cover standard, custom, commercial/public, excavation/drainage/bridge,
   pool, septic, offline, entitlement, executive-assistant, portal, financial and closeout paths.
5. No `v1.0.0` tag or store publication occurs until every mandatory scenario has current evidence
   or a documented owner-approved exception with scope, risk, compensating control and expiry.

## Traceability rule

Every requirement above must map to:

1. an owning repository/component;
2. implemented code and, when applicable, a reviewed migration;
3. automated tests where practical;
4. a named real-device or operational acceptance scenario; and
5. a recorded result for the exact release candidate.

Documentation or a shell screen alone does not count as implementation.
