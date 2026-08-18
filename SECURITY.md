# Security Policy

## System and Scope

ManyHats Pro is a contractor operations platform with a Flutter mobile client, a React/TanStack web and administration surface, and a Supabase backend. This policy covers application source, API routes, server functions, Supabase migrations, Row Level Security policies, storage policies, payment webhooks, public portal routes, AI integrations, CI workflows, and release configuration.

V1 is approved only for ManyHats Construction's controlled single-company use and invited beta testing. A public multi-company SaaS release is out of scope until organization identifiers and organization-scoped authorization are enforced across every tenant-owned row, RPC, storage path, and server operation.

## Threat Model and Trust Boundaries

Treat browser and mobile inputs, uploaded files, portal tokens, webhook payloads, AI output, URL parameters, and database identifiers as attacker-controlled. Supabase service-role credentials, payment secrets, AI provider keys, CI credentials, and signing credentials are trusted secrets and must remain server-side.

The principal boundaries are Supabase Auth, RLS, authenticated server functions, public token-scoped portal RPCs, Stripe signature verification, private Storage policies, and the transition from user-scoped clients to service-role operations.

## Security Invariants

- Every non-public data operation authenticates the caller and authorizes the exact record before reading, mutating, generating content, or incurring third-party cost.
- Service-role clients are created only in server-only modules and are used only after caller or webhook authorization succeeds.
- RLS is enabled for application tables. New tenant-owned tables must ship with least-privilege policies and negative cross-user tests.
- Public portal operations expose only token-scoped client-safe fields, enforce expiration or revocation where supported, and never disclose internal costs, staff notes, secrets, or unrelated project data.
- Stripe mutations require valid webhook signatures, idempotency, project and invoice integrity checks, and service-role-only RPC execution.
- Storage buckets remain private; access is RLS-scoped or delivered through short-lived signed URLs.
- AI keys and calls remain server-side. AI output is advisory, labeled, bounded, and requires human approval before it changes client-facing scope, pricing, schedule, or commitments.
- Secrets are never committed, logged, returned to clients, embedded in mobile or browser bundles, or copied into test fixtures.
- Security-sensitive failures fail closed and produce actionable audit evidence without exposing sensitive payloads.

## Reportable Findings and Severity Context

Report authentication bypass, broken object-level authorization, RLS or storage isolation failure, service-role exposure or misuse, portal token data leakage, webhook forgery or replay, payment integrity failure, unrestricted paid-AI invocation, secret disclosure, unsafe file handling, and CI or release control bypass.

Treat remotely reachable cross-record access, payment manipulation, service-role compromise, signing-secret exposure, or cross-company access as high or critical depending on demonstrated impact. Do not downgrade a finding solely because V1 currently has one company when the affected surface is internet-accessible or intended for multi-company use.

## Out of Scope and Accepted Risk

There are no blanket finding-class exclusions. Test fixtures and local-only developer utilities are not production findings unless they can affect shipped artifacts, CI, credentials, or production data. Any accepted risk must be documented with an owner, expiry date, compensating control, and linked tracking item.

## Known Limitations and Release Restrictions

- Public multi-company release is blocked until organization-scoped schema, RLS, storage, RPC, and negative isolation tests are complete.
- SOC 2 readiness work and repository evidence do not constitute SOC 2 certification; certification requires an independent auditor and an operating-period assessment.
- Existing Supabase security and performance advisories must be triaged before public release. Intentional `SECURITY DEFINER` functions require documented purpose, restricted grants, fixed search paths, and authorization tests.
- Public portal rate limiting and breached-password protection remain release-hardening items until live configuration is verified.

See `docs/SECURITY.md` for implementation details, control history, and current technical-debt tracking.
