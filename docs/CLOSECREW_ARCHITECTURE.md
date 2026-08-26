# CloseCrew V1 architecture

## Product and tenant identity

CloseCrew is one organization-owned engine with two product surfaces. `product_accounts` records ManyHats Pro and standalone CloseCrew subscriptions against the same `organization_id`; customer and workflow data never moves between product-specific databases. Entitlements identify capabilities, while usage events meter provider consumption separately.

Access requires all three server-side checks: active organization membership, a valid entitlement backed by a valid product account, and an enabled rollout whose prerequisites are valid. Missing or inconsistent state denies access.

## Modules

- `provider.ts`: vendor-neutral signed-webhook and outbound-message contract. Twilio may be the first adapter, but domain services do not import Twilio.
- compliance: telephone normalization, STOP/HELP, suppression, quiet hours, exclusions, approved templates, and rate-limit decisions.
- contact/lead records: organization-scoped deduplication and explicit lead state.
- sequences: approved immutable template versions, bounded steps, enrollments, and immediate stop states.
- connectors: existing project, estimate, proposal, acceptance, deposit and Stripe intent records are referenced; balances remain authoritative on the server.
- attribution: attributed, estimated and confirmed revenue remain separate.
- audit and consent: append-only evidence with limited metadata. Provider secrets and raw webhook bodies are not stored.

## State machine

The canonical transition table is enforced in `closecrew_transition_lead` and mirrored in `src/lib/closecrew/state-machine.ts`. Invalid transitions fail. Question, acceptance, decline, opt-out, conversion, closure and archive stop active automation immediately.

## Rollout

1. Apply the review-approved migration in a non-production rehearsal database.
2. Regenerate Supabase TypeScript and Dart types from the rehearsed schema.
3. Configure encryption and a communications adapter with a registered test number.
4. Create the organization membership and product account, then entitlements.
5. Validate templates, business/quiet hours, suppression, provider signatures and A2P registration.
6. Set rollout to `internal`, validate prerequisites, then enable it.
7. Promote selected organizations to `private_beta`; eligible-plan and standalone audiences remain off until approved.

## Compliance checklist

- Business identity and HELP language reviewed in every approved template.
- Consent/legal basis captured; STOP is global and immediate.
- Global and organization suppression checked before enqueue and again before send.
- Quiet hours use organization timezone; emergency/prohibited categories are excluded.
- Per-contact and per-organization rate limits are enforced by the worker.
- Webhook signatures and replay/idempotency IDs are verified.
- Wrong-number and reassignment signals create immutable consent/suppression evidence.
- Review requests are one per eligible job; negative feedback stops requests without review gating.
- Message bodies/contact data are not written to application logs.
- Retention/deletion policy must be approved before private beta.

## Deployment and rollback

Production deployment is approval-gated. Deploy schema first, then server/provider routes, then web and Flutter clients, and finally entitlements/rollout. Keep rollout off throughout deployment.

Rollback begins by disabling `closecrew_rollouts` and pausing the communications worker. Application code can then be reverted safely. The migration adds types/tables and should not be destructively down-migrated after real consent/audit data exists; archive/export legally required evidence before an approved cleanup migration.

## Known limitations

- A provider adapter, signed webhook route and queue worker are not enabled by the core migration.
- Existing V1 records predate organization ownership; connector activation requires a reviewed organization-backfill migration.
- Retention periods, approved message copy, A2P registration and provider credentials are business/legal configuration, not defaults.
