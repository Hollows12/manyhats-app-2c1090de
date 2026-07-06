# Phase 2 — Customer Portal, E-Signatures & Send Flow

## Portal routes (public, token-scoped, no login)

- `/portal/proposal/$token` — client reviews and accepts the proposal.
- `/portal/invoice/$token` — client views invoice, line items, payments, balance.
- `/portal/payment/$token` *(future)* — dedicated pay-now surface once Stripe is wired.

Tokens are 24-byte random hex strings, unique per proposal / invoice, with a 90-day
expiry. Rotating or revoking a token instantly invalidates the old link.

## Data flow

### Proposal send
1. Staff clicks **Send proposal** in the proposal card.
2. `send_proposal(_proposal_id)` (SECURITY DEFINER, staff-only):
   - mints portal token + expiry (if none / expired),
   - sets `status='sent'` if the proposal was a draft,
   - sets `sent_at`,
   - pushes a `proposal_sent` notification.
3. The client link is auto-copied to the clipboard for delivery via email / SMS.

### Portal view
`portal_get_proposal(_token)` / `portal_get_invoice(_token)` return only whitelisted
fields (no costs, notes, or internal-only fields) so anyone with the URL sees only
what the client should see. On mount each portal page also calls
`portal_mark_proposal_viewed` / `portal_mark_invoice_viewed`, which stamps
`viewed_at` and pushes a `proposal_viewed` / `invoice_viewed` notification the first
time it fires.

### E-signature
`portal_accept_proposal` accepts name, optional email, optional phone, terms
checkbox, the selected option, and either a typed name or a drawn signature
(canvas PNG data URL). It persists to `proposal_signatures` (with `signature_kind`
= `typed` | `drawn`, `terms_accepted`, `ip_address`) and flips the proposal to
`approved`. A trigger raises a `proposal_signed` staff notification.

### Payment tracking
Payments still land through the existing staff **Record payment** flow. Every
new payment fires an `on_payment_insert` trigger that raises a
`payment_received` notification. Client-side online payments will be wired
through a payment-provider abstraction (`manual` → `stripe` → future
`quickbooks`); the portal invoice page already surfaces balance and hints at
the upcoming online-payment CTA.

## Security model

- All portal RPCs are `SECURITY DEFINER` and validate the token length (≥ 16
  chars) and expiry before returning any data.
- No direct table access is granted to `anon`; the client only ever calls the
  read-only RPCs above.
- Staff-only RPCs (`send_proposal`, `ensure_invoice_portal_token`, revoke, etc.)
  short-circuit with `is_staff(auth.uid())`.
- Rotating a link (`ensure_*_portal_token(_rotate=true)`) instantly invalidates
  the previous URL. Revoke clears the token entirely.

## Notifications

`public.notifications` is a broadcast-friendly table (nullable `user_id`) with
RLS scoped to staff. Kinds emitted so far:

| Kind | Trigger |
|------|---------|
| `proposal_sent` | Staff mints/sends |
| `proposal_viewed` | First portal open |
| `proposal_signed` | Client accepts |
| `invoice_viewed` | First portal open |
| `payment_received` | Payment insert (non-void) |

Dashboard surfaces the 10 most recent, with unread count, refetched every 30s.

## Activity timeline

Every project's timeline now includes proposal sent / viewed / signed and
invoice sent / viewed events alongside the existing invoice, payment, deposit,
and progress-billing entries. New **Proposals** filter chip added.

## Dashboard cards

New **Client Portal** row: Proposals Sent · Viewed · Accepted · Invoices
Awaiting Payment · Deposits Pending · Paid (Month).

## Future upgrade path

- **Client login** — swap portal token for a real Supabase auth session tied
  to a `clients` row; token remains an anonymous-view fallback.
- **Stripe** — add `payment_provider` config, deposit + invoice checkout
  sessions, webhook receiver, and receipts. Manual payment paths continue to
  work.
- **Email delivery** — hook `email_domain--scaffold_transactional_email` for
  proposal-sent / accepted / invoice-sent / payment-received templates. The
  Send button already returns a client link that can be swapped for
  automated delivery once templates are live.
