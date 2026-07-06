# Phase 1 — Contractor Financial Engine

**Shipped:** July 6, 2026
**Status:** ✅ Production-ready in Lovable MVP

Closes the money loop: **Estimate → Proposal → Deposit → Invoice → Progress Billing → Payment → Profit Analysis**, all rooted on the existing `projects` record.

---

## Database (Supabase)

New tables (all RLS-protected — `is_staff` only):

| Table | Purpose |
| --- | --- |
| `invoices` | Numbered invoices tied to project + optional proposal. Auto-tracks `balance_due` and `status` via triggers. |
| `invoice_line_items` | Description, qty, unit_price, tax_rate, line_total. |
| `payments` | Cash / check / ACH / credit card / stripe / quickbooks / other. `is_void` supported. Auto-recalculates parent invoice balance & status. |
| `deposits` | Amount, %, due date, status (pending/invoiced/paid/waived/void), linked to project & proposal. |
| `progress_billings` | Draw #, percent complete, amount due, retainage, approval fields. |

Enums: `invoice_status`, `payment_method`, `deposit_status`, `progress_billing_status`.

Trigger functions:
- `recalc_invoice_balance()` — after any payment insert/update/delete
- `sync_invoice_balance_from_total()` — before insert/update of invoice.total

RPC:
- `project_profit_snapshot(_project_id UUID) RETURNS JSONB` — staff-gated; returns real-time `estimated_revenue`, `approved_revenue`, `invoiced_revenue`, `paid_revenue`, `outstanding_balance`, `estimated_cost`, `actual_cost`, `gross_profit`, `net_profit`, `profit_margin_pct`, `variance`.

## Frontend

- **`src/lib/finance.ts`** — enums, labels, invoice-number generator, `ProfitSnapshot` type.
- **`src/components/project/financial.tsx`** — Financial tab: KPI strip, live profit panel, deposits, invoices (with line-item editor and record-payment dialog), progress billing.
- **`src/routes/_authenticated/invoices.tsx`** — global Invoices list with totals.
- **`src/routes/_authenticated/payments.tsx`** — global Payments ledger.
- **Project detail** (`projects.$id.tsx`) — new **Financial** tab on every project.
- **Sidebar** — new **Financial** group: Invoices, Payments, Job Costing.
- **Dashboard** — new KPI row: Revenue (Month), Payments (Month), Outstanding, Deposits Due, Open Proposals.

## Invoice generation

The Financial tab's "From proposal" button copies the accepted proposal's selected option into a new invoice as a single line item (with total). Blank invoices are also supported. No duplicate customer/project entry.

## Payment recording

Record dialog captures amount, date, method, reference number, and notes. Payments automatically:
- Reduce invoice `balance_due`
- Update invoice `status` (partial/paid)
- Void via row-level `Ban` button (sets `is_void`, recalculates)

## Profit engine

`project_profit_snapshot` is called on every Financial tab open and returns live numbers straight from `estimates`, `proposals`, `proposal_options`, `invoices`, `payments`, and `job_costs`. No cached "snapshot" rows — always fresh.

Approved revenue prefers the sum of `is_selected=true` proposal options on an `approved` proposal; falls back to the highest estimate if none selected. Because the enum on `proposals.status` only includes `approved` (not `accepted`/`signed`), the RPC filter mirrors that.

## Roles / RLS

Everything financial is `USING (public.is_staff(auth.uid()))`. Clients get read-only later through the customer portal (Phase 2).

## Not in this phase (roadmap)

- Stripe/Paddle live payment capture (record-only for now — connector separate)
- QuickBooks / Xero export (fields staged; hook pending)
- Customer portal read-only invoice view
- pg_cron overdue-invoice status update
