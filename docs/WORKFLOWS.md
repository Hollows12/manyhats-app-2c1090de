# ManyHats Pro — Workflows

> **Version:** V1 Baseline · 2026-07-15  
> Documents all implemented workflow paths.

---

## Master Workflow: Lead to Payment

```mermaid
flowchart TD
    START([New Inquiry]) --> LEAD[Create Lead\nProject status: lead]
    LEAD --> SITE[Schedule Site Visit\nstatus: site_visit_scheduled]
    SITE --> FIELD[Field Capture\nstatus: field_capture\nPhotos · Measurements · Voice · GPS]
    FIELD --> SHARED[Update Shared Vision\nSummary · Budget · Timeline · Site Notes]
    SHARED --> EST[Build Estimate\nstatus: estimating\nLine items · AI recommendations]
    EST --> DRAFT[Write Proposal\nstatus: proposal_draft\nAI scope writer · Options · Concepts]
    DRAFT --> SEND[Send Proposal to Client\nstatus: proposal_sent\nPortal token generated]
    SEND --> SIGN{Client Signs?}
    SIGN -->|Yes| APPROVED[status: approved\nDeposit collected]
    SIGN -->|No / Revise| DRAFT
    SIGN -->|Lost| LOST([status: lost])
    APPROVED --> ACTIVE[Start Construction\nstatus: active\nJob tasks · Daily logs · Receipts]
    ACTIVE --> WAIT_C{Waiting on Client?}
    WAIT_C -->|Yes| WC[status: waiting_on_client]
    WC --> ACTIVE
    ACTIVE --> WAIT_M{Waiting on Materials?}
    WAIT_M -->|Yes| WM[status: waiting_on_materials]
    WM --> ACTIVE
    ACTIVE --> CHANGES{Change Orders?}
    CHANGES -->|Yes| CO[Record Change Order\nPrice/timeline adjustment]
    CO --> ACTIVE
    ACTIVE --> INVOICE[Generate Invoice\nFrom proposal line items]
    INVOICE --> IPAY[Collect Payment\ncash/check/ACH/card]
    IPAY --> COMPLETE([status: complete])
```

---

## Proposal Workflow

```mermaid
sequenceDiagram
    participant Staff
    participant App as ManyHats App
    participant AI as Lovable AI Gateway
    participant DB as Supabase
    participant Client

    Staff->>App: Open project → Proposal tab
    Staff->>App: Enter rough notes / pull from Shared Vision
    App->>AI: writeScope(rough_notes, tone)
    AI-->>App: { executive_summary, scope_of_work, ... }
    App->>DB: INSERT proposals (scope sections, estimate_id)
    Staff->>App: Review scope, add options, set price
    Staff->>App: "Send to Client"
    App->>DB: ensure_proposal_portal_token()
    DB-->>App: portal_token
    App-->>Staff: Portal URL /portal/proposal/{token}
    Staff->>Client: Share URL (email / text)
    Client->>App: Open portal link
    App->>DB: portal_get_proposal(token)
    DB-->>App: proposal + options (no internal data)
    App-->>Client: View proposal
    Client->>App: Sign digitally (typed/drawn name)
    App->>DB: portal_accept_proposal(token, signature)
    DB->>DB: INSERT proposal_signatures
    DB->>DB: UPDATE proposals SET status='approved', accepted_at=now()
    DB-->>App: success
    App-->>Client: "Thank you, proposal accepted"
    App-->>Staff: Notification (proposal approved)
```

---

## Field Capture Workflow

```mermaid
flowchart LR
    PHONE[Phone / Tablet on Site]
    PHOTO[Take Photos\nCategory + Phase tags\nGPS coordinates\nClient-facing flag]
    MEAS[Record Measurements\nLabel + Value + Unit]
    VOICE[Record Voice Note\nAudio → Transcript]
    RECEIPT[Snap Receipt\nAmount + Category]
    DAILY[Daily Log Entry\nDate + Crew + Progress]

    PHONE --> PHOTO
    PHONE --> MEAS
    PHONE --> VOICE
    PHONE --> RECEIPT
    PHONE --> DAILY

    PHOTO -->|proposal_include=true| PROP[Proposal Photos]
    PHOTO -->|is_client_facing=true| CF[Client File]
    MEAS -->|feeds| EST[Estimate Quantities]
    VOICE -->|transcript| SCOPE[AI Scope Writer input]
    RECEIPT -->|actual cost| COSTING[Job Costing]
    DAILY -->|progress| TIMELINE[Activity Timeline]
```

---

## Invoice and Payment Workflow

```mermaid
flowchart TD
    PROP_APPROVED[Proposal Approved]
    GEN_INV[Generate Invoice\nFrom proposal line items\nInvoice line items pre-populated]
    DRAFT_INV[Invoice status: draft]
    SEND_INV[Send Invoice\nPortal token generated\nstatus: sent]
    CLIENT_VIEW[Client views invoice\nviewed_at recorded]
    PAYMENT{Payment Received}
    PAY_PARTIAL[Record partial payment\nstatus: partial]
    PAY_FULL[Record final payment\nstatus: paid\nbalance_due = 0]
    CHANGE{Change Orders?}
    CO[Change Order\nPrice adjustment\nRe-invoice if needed]

    PROP_APPROVED --> GEN_INV
    GEN_INV --> DRAFT_INV
    DRAFT_INV --> SEND_INV
    SEND_INV --> CLIENT_VIEW
    CLIENT_VIEW --> PAYMENT
    PAYMENT -->|partial| PAY_PARTIAL
    PAY_PARTIAL --> PAYMENT
    PAYMENT -->|full| PAY_FULL
    CHANGE -->|before invoice| GEN_INV
    CHANGE -->|after invoice| CO
    CO --> GEN_INV
```

**Automation:**  
- `on_payment_insert()` trigger calls `recalc_invoice_balance()` on every payment insert
- Invoice `balance_due` is always auto-recalculated

---

## Client File Share Workflow

```mermaid
sequenceDiagram
    participant Staff
    participant App
    participant DB as Supabase (pgcrypto)
    participant Email
    participant Client

    Staff->>App: Click "Share Client File"
    Staff->>App: Enter client email, expiry days
    App->>DB: create_client_file_share(project_id, email, days, include_notes)
    DB->>DB: Generate secure token
    DB->>DB: bcrypt PIN (4-digit)
    DB-->>App: { token, pin, share_id }
    App-->>Staff: Portal URL + PIN to send to client
    Staff->>Email: Send URL + PIN to client (manual or future email infra)
    Client->>App: Open /portal/client-file/{token}
    App->>Client: PIN entry form
    Client->>App: Enter PIN
    App->>DB: portal_verify_client_file_pin(share_id, pin)
    DB->>DB: crypt(pin) vs pin_hash
    Note over DB: Max 5 attempts before lockout
    DB-->>App: verified
    App->>DB: portal_get_client_file(token)
    DB-->>App: Full project file (proposals, invoices, photos, contracts)
    App-->>Client: Universal Client File view
    DB->>DB: INSERT client_file_share_views (ip, user_agent, timestamp)
```

---

## AI Estimate Recommendation Workflow

```mermaid
flowchart LR
    INPUT[Project + Shared Vision\nField photos\nSite notes]
    AI[AI Analysis\nvia Lovable AI Gateway]
    REC[ai_estimate_recommendations\nstatus: pending]
    REVIEW{Staff Review}
    APPROVED[Status: approved\nAdd to estimate_line_items]
    REJECTED[Status: rejected\nNot used]

    INPUT --> AI
    AI --> REC
    REC --> REVIEW
    REVIEW -->|Approve| APPROVED
    REVIEW -->|Reject| REJECTED
```

**Key principle:** AI suggestions are never automatically added to estimates. Every recommendation requires explicit staff approval. This prevents unreviewed AI suggestions from entering client-facing documents.

---

## Team Invitation Workflow

```mermaid
sequenceDiagram
    Admin->>App: Create invitation (email, role: admin/crew)
    App->>DB: INSERT invitations (token, expires_at: 14 days)
    App-->>Admin: Invite link with token
    Admin->>Staff: Share invite link
    Staff->>App: Open /auth?invite_token={token}
    App->>DB: get_invitation_preview(token)
    DB-->>App: { role, email }
    Staff->>App: Sign up (email + password)
    App->>DB: accept_invitation(token)
    DB->>DB: INSERT user_roles (role from invitation)
    DB->>DB: Mark invitation accepted
    App-->>Staff: Onboarded with correct role
```

---

## Change Order Workflow

1. Staff identifies change during construction
2. Opens project → Change Orders (in Job Management tab)
3. Creates change order: description, reason, price change (+ or -), timeline change (days)
4. Change order stored in `change_orders` with `project_id` FK
5. Profit snapshot RPC (`project_profit_snapshot`) includes change orders in revenue calc
6. If change increases price significantly, new invoice generated

---

## Concept Rendering Workflow

1. Staff opens project → Concept tab
2. Creates concept request: title, prompt, source photo, must-keep, requested changes
3. Status: `draft` → `ready_to_generate`
4. Staff triggers generation → AI generates image via `/api/concept-image`
5. Image stored in `concepts` Supabase Storage bucket
6. Status: `generated`
7. Staff reviews: `approved` → can include in proposal (`approved_for_proposal = true`)
8. Status: `rejected` → archived, not used
