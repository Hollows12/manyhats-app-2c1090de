# Privileged Database Function Register

This register documents the intentionally callable `SECURITY DEFINER` functions in ManyHats Pro V1. These functions cross the Supabase RLS boundary and therefore require explicit caller grants, fixed search paths, authorization or capability checks, and regression validation.

## Control requirements

- `PUBLIC` execute is revoked for every function.
- Grants are limited to the caller roles listed below.
- The fixed search path is `pg_catalog, public, extensions`.
- Browser and mobile identifiers, tokens, PINs, and payloads are attacker-controlled.
- Staff functions validate `auth.uid()` through `is_staff` or `has_role`.
- Portal functions treat high-entropy tokens as scoped capabilities, enforce expiry where supported, and return client-safe fields only.
- Client-file functions additionally validate a six-digit PIN, revocation, expiry, and lockout state.
- Public portal rate limiting remains a V1 release-hardening requirement.

## Registered functions

| Function group | Functions | Callers | Required control |
|---|---|---|---|
| Invitation | `accept_invitation` | authenticated | Authenticated user, unaccepted/unexpired token, account email match |
| Invitation preview | `get_invitation_preview` | anon, authenticated | High-entropy invitation token; preview fields only |
| Admin file-share management | `create_client_file_share`, `revoke_client_file_share`, `rotate_client_file_share_pin` | authenticated | Admin role |
| Staff portal-token management | `ensure_invoice_portal_token`, `ensure_proposal_portal_token`, `revoke_invoice_portal_token`, `revoke_proposal_portal_token`, `send_proposal` | authenticated | Staff role |
| Staff financial reporting | `project_profit_snapshot` | authenticated | Staff role |
| Proposal portal | `portal_get_proposal`, `portal_mark_proposal_viewed`, `portal_accept_proposal` | anon, authenticated | Valid unexpired proposal token; proposal/option relationship; terms acceptance |
| Invoice portal | `portal_get_invoice`, `portal_mark_invoice_viewed` | anon, authenticated | Valid unexpired invoice token |
| Client-file portal | `portal_verify_client_file_pin`, `portal_get_client_file` | anon, authenticated | Valid token, unexpired/unrevoked share, six-digit PIN, bcrypt verification and lockout |

## Advisor disposition

Supabase reports one warning per callable role, so these 18 functions produce 26 advisor entries. The entries are retained as reviewed intentional privileged surfaces rather than silenced by weakening or breaking required workflows. Any new callable `SECURITY DEFINER` function must be added here with its caller, authorization invariant, grant, fixed search path, and negative test before merge.


## Public portal abuse protection

All anonymous portal RPCs are protected by the PostgREST pre-request function `private.check_portal_rate_limit()`. It hashes the trusted forwarded client IP, uses five-minute per-path buckets, returns HTTP 429 with a five-minute `Retry-After`, and retains only short-lived pseudonymous counters.

- Proposal acceptance: 10 requests per IP per five minutes.
- Client-file PIN verification: 20 requests per IP per five minutes, in addition to the share-level five-attempt lockout.
- Portal reads, previews, and viewed markers: 120 requests per IP per path per five minutes.
- Other authenticated application and Data API traffic is not affected.
- Rows older than one day are opportunistically removed.
