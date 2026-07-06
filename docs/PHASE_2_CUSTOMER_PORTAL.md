# Phase 2 — Customer Portal

**Shipped:** July 6, 2026
**Status:** ✅ v1 in production

Public, no-login portal so clients can review, sign, and track a proposal, plus see any invoices and balances on the project — all from a single shareable link.

---

## Link model

- Per-proposal token: one URL per proposal.
- Format: `/portal/proposal/<64-hex-char token>`
- Tokens live in `proposals.portal_token` + `proposals.portal_token_expires_at` (default 90 days).
- Staff generate or rotate the link from the proposal card via the **Copy client link** / rotate buttons (both call `ensure_proposal_portal_token(_proposal_id, _rotate)`).

## Database (migration `20260706151143`)

New columns on `proposals`: `portal_token TEXT UNIQUE`, `portal_token_expires_at TIMESTAMPTZ`, plus an index on the token.

Three SECURITY DEFINER RPCs:

| Function | Roles | Purpose |
|---|---|---|
| `portal_get_proposal(_token)` | `anon`, `authenticated` | Returns proposal, options, project + client display info, all non-void invoices, and totals for the project. |
| `portal_accept_proposal(_token, _signer_name, _signer_email, _selected_option_id, _signature_data, _ip_address)` | `anon`, `authenticated` | Inserts a `proposal_signatures` row and sets `proposals.status='approved'` + `approved_at`. Rejects on `expired`, `not_found`, `already_accepted`, or `invalid_option`. |
| `ensure_proposal_portal_token(_proposal_id, _rotate)` | `authenticated` (staff via `is_staff()`) | Mints a fresh token if missing / expired / rotate=true. |

All three are `SECURITY DEFINER` with `search_path = public` and `EXECUTE` explicitly revoked from `PUBLIC` before selective grants. RLS on `proposals` / `proposal_signatures` / `invoices` is unchanged — the portal only reads through the RPC surface.

## Frontend

- **`src/routes/portal.proposal.$token.tsx`** — public TanStack route (no `_authenticated`). Fetches via anon Supabase client. Renders:
  - Proposal header with project + client, status badge, sent date.
  - Full proposal body (summary, scope, recommendation, timeline, warranty, exclusions, payment terms).
  - Pricing options card (recommended highlighted).
  - Invoices & Balances table with totals row and per-invoice status badge.
  - Accept & Sign form (option picker + typed name + optional email). Success flips status to Accepted and refreshes.
  - Custom `errorComponent` and `notFoundComponent` for expired/invalid links.
- **`src/components/project/proposal.tsx`** — added `<ClientLinkButtons>`:
  - "Copy client link" → mints token if missing, copies `${origin}/portal/proposal/<token>` to clipboard.
  - Adjacent rotate button — mints a new token (old link stops working).

## Trust & privacy

- Token is a 24-byte hex string (48 chars of entropy, 384-bit). Not guessable.
- Only fields safe for clients are projected in `portal_get_proposal`. Void invoices, internal notes, costs, and job-cost data are never included.
- The portal HTML sets `robots: noindex` so links are not crawled.
- Rotating the token invalidates the previous URL immediately.

## Not in this phase (roadmap)

- Actual payment collection from the portal (Stripe/Paddle wiring is separate).
- Portal invoice PDF download link.
- Email-driven "sign now" workflow (needs email domain in Phase 3).
- Client-uploaded change-order approvals.
