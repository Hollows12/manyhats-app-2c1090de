# V1 Release Gates

ManyHats Pro V1 is release-ready only when every required gate below has current evidence. Passing these gates supports a SOC 2 readiness program; it does not constitute SOC 2 certification.

## Automated pull-request gates

| Gate                                            | Required evidence        | Blocks merge |
| ----------------------------------------------- | ------------------------ | ------------ |
| Changed-file lint                               | GitHub Actions CI result | Yes          |
| TypeScript typecheck                            | GitHub Actions CI result | Yes          |
| Unit and integration tests                      | GitHub Actions CI result | Yes          |
| Production build                                | GitHub Actions CI result | Yes          |
| Supabase migration/config validation            | GitHub Actions CI result | Yes          |
| Root security policy and secret scan            | Security Gates workflow  | Yes          |
| New-table RLS and `SECURITY DEFINER` invariants | Security Gates workflow  | Yes          |
| High/critical dependency changes                | Dependency Review        | Yes          |
| Static application security analysis            | CodeQL                   | Yes          |

## Manual V1 release gates

| Control                        | V1 requirement                                                                    | Current status               |
| ------------------------------ | --------------------------------------------------------------------------------- | ---------------------------- |
| Source of truth                | Reviewed GitHub `main`; Lovable remains unpublished                               | Enforced operationally       |
| Mobile distribution            | Signed Flutter release build and store metadata                                   | Pending final Flutter work   |
| Tenant scope                   | Controlled single-company use/invited beta only                                   | Approved V1 boundary         |
| Public multi-company isolation | Organization-scoped schema, RLS, storage, RPCs, and negative tests                | Blocks public SaaS release   |
| Supabase advisors              | Security warnings dispositioned; performance warnings prioritized and load-tested | In progress                  |
| Portal abuse controls          | Rate limiting and live token-expiry/revocation verification                       | Pending                      |
| Authentication hardening       | Breached-password protection and production redirect review                       | Pending live verification    |
| Backup/recovery                | Backup schedule, restore test, RPO/RTO, and owner recorded                        | Pending operational evidence |
| Incident response              | Owner, severity process, notification path, and exercise evidence                 | Pending operational evidence |
| Access review                  | Production admins, GitHub, Supabase, OpenAI, payment, and signing access reviewed | Pending operational evidence |
| Privacy/data handling          | Retention, deletion, export, vendor inventory, and privacy notice approved        | Pending policy/legal review  |

## Release decision

No public production or app-store release is authorized by a green build alone. The owner must record a release decision after automated checks pass and all controls applicable to the intended release audience are complete. Any exception requires a named owner, reason, compensating control, expiration date, and tracking issue.
