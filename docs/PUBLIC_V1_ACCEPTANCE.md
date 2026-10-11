# ManyHats Public V1 Acceptance Standard

**Purpose:** Define what must be true before ManyHats is called ready for public release. The
private beta is for learning; it does not lower this public release bar.

## Product promise

ManyHats should let one contractor run the complete business workflow with less administrative
overhead, then let that same company add people and controls without replacing the system. The
product serves the owner, office, field crew, subcontractors, and client from one trusted project
record: **capture once, use everywhere**.

“Best in market” is a goal, not a claim to publish before comparative user testing supports it.

## Small-business leverage target

ManyHats should give a one-person operator access to the repeatable business capacity of a much
larger contractor: capture information once, then carry it through estimating, scheduling,
field records, client communication, cost tracking, invoicing, and closeout. Agents should prepare
routine work across those steps so the owner can review decisions instead of re-entering data.

Treat “the work of 20 people” as a product vision to prove, not a literal staffing or savings
claim. Measure human minutes spent per project and per workflow before and after ManyHats, the
share of routine steps completed accurately with owner approval, correction/rework rates, and
time-to-complete at 1-, 5-, and 20-user company sizes. Public claims require customer evidence
and comparative tests.

## Competitive baseline

Reviewed 2026-10-11 from vendor product pages. These are vendor-described capabilities, not
independent quality ratings.

| Product | Publicly described strengths | ManyHats must meet or exceed |
| --- | --- | --- |
| Procore | Connected project management and financial data, project financials, and accounting integrations | Accurate field-to-cost/profit visibility, project controls, and reliable accounting exports/integrations |
| Autodesk Forma / Construction Cloud | Offline mobile project access, drawings, markups, RFIs, submittals, daily reports, document management, and a broad integration catalog | Dependable offline field work, current plan versions, linked decisions/evidence, and practical integrations |
| Buildertrend | Residential workflows spanning estimates, budgets, schedules, tasks, daily logs, change orders, client/subcontractor portals, and financials | A connected owner-client-crew workflow with estimates, changes, communications, job costs, and closeout |
| Jobber | Contractor quoting, scheduling, invoicing, customer communication, and admin automations | Fast solo-owner workflows and dependable follow-up automation with visibility and control |

Sources:
- [Procore Financial Management](https://www.procore.com/financial-management)
- [Autodesk Construction Management](https://construction.autodesk.com/)
- [Autodesk Forma mobile and offline workflows](https://construction.autodesk.com/products/construction-app/)
- [Buildertrend product overview](https://buildertrend.com/product-overview/)
- [Jobber automations](https://help.getjobber.com/en/articles/automations/)

## Required end-to-end journeys

Every journey must use the same verified project record, avoid re-entry, preserve history, and
work with the user's role and subscription.

1. **Set up the business:** Confirm real company rates and policies. Never treat examples as
   approved values. Keep a dated change history and snapshot the values used by each estimate.
2. **Win the work:** Capture a lead, client, goals, constraints, budget, schedule, site evidence,
   photos, plans, video, notes, and measurements. Convert the record into a contractor-reviewed
   scope and low/recommended/premium estimate with assumptions and internal profit protected.
3. **Build from current information:** Keep plan revisions, takeoff/measurement sources,
   jurisdiction and code references, supplier price source/date/freshness, and required reviews
   visible. AI-extracted measurements and code suggestions remain reviewable and never claim to
   be a survey, permit, inspection, engineering calculation, or professional seal.
4. **Deliver the project:** Carry approved scope into phases/tasks, schedule, assignments, daily
   logs, photos, documents, RFIs/issues, receipts, actual costs, change orders, invoices, payments,
   and client updates. Preserve who changed what and when.
5. **Close the loop:** Deliver punch list, warranties, as-built/final files, signed records, cost
   and profit results, and follow-up actions in a client-ready closeout.
6. **Run the business:** Give the owner a concise view of cash, receivables, leads, job margin,
   crew/equipment capacity, schedule conflicts, maintenance, and recommended next actions. Every
   AI recommendation shows its evidence, assumptions, confidence, and a human approval step before
   external, financial, legal, or safety-sensitive action.

## Solo-to-team acceptance

Run the same core journeys with representative companies configured for **1, 5, and 20 users**.
The one-person setup should be usable without an administrator or a complex implementation
project. Adding staff should reveal role-appropriate views and controls without changing the
company's project history or requiring a new data model.

At each size, verify:

- invitations, role changes, project assignments, notifications, and offboarding;
- owner-only costs, payroll/rates, profit, and executive data remain private;
- crew and subcontractor access is limited to assigned work and approved project information;
- field capture works offline, survives app restarts, retries safely, shows sync state, and does
  not create duplicates or silently discard conflicts;
- client access is limited to the client's own approved files, proposals, invoices, and updates;
- dashboards and exports agree with project and accounting records;
- common workflows remain usable on supported iPhone, iPad, Android, and web screen sizes.

Public SaaS release is blocked until organization isolation is negatively tested across database
RLS, Storage, RPCs, server functions, portals, search, exports, and background jobs. A hidden menu
or an authenticated session alone is not an authorization boundary.

## AI automation and trust

AI should reduce routine office work for small contractors while keeping the owner in control.
Useful agent-assisted tasks include preparing estimates from approved evidence, drafting client
updates, organizing receipts, flagging schedule/cost risks, and assembling closeout packages.

- Use scoped, auditable tools and least-privilege access.
- Show source records and distinguish confirmed facts from estimates or suggestions.
- Require approval before sending a proposal or message, changing a contract or schedule,
  committing spend, submitting a permit, or changing approved scope.
- Make failures, retries, and completed actions visible; support correction and rollback where
  appropriate.
- Never train or make decisions from one company's data in another company's tenant.

## Public release evidence

Before public availability, record evidence against the exact release candidate:

- all mandatory private-beta journeys pass on real devices and web;
- tenant-isolation and role-privacy negative tests pass;
- offline/reconnect and recovery scenarios pass without lost or duplicated records;
- migration rehearsal, production migration plan, backup restore, rollback, monitoring, support,
  privacy, retention, export, and incident response are reviewed;
- performance and load tests cover the 1/5/20-user acceptance scenarios and an agreed growth
  profile, with latency/error targets recorded before the run;
- external integrations, billing, entitlements, accessibility, and store policies pass their
  applicable checks;
- beta users validate that the product saves measurable administrative time and protects or
  improves estimating/job-cost accuracy against their existing process.

A green build, merged PR, successful prototype, or vendor feature comparison by itself is not
public-release evidence. The owner records the final release decision after all applicable gates
are satisfied.
