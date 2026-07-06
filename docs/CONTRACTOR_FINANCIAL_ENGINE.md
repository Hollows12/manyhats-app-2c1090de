# ManyHats Pro - Contractor Financial Engine

**Version:** 1.0  
**Last Updated:** July 6, 2026  
**Status:** Authoritative Architecture Document  
**Audience:** Financial Engineers, Backend Architects, Product Managers

---

## Executive Overview

The **Contractor Financial Engine** is NOT generic accounting software. It is a **project-based financial system** purpose-built for service contractors.

### Core Principle

```
┌────────────────────────────────────────────┐
│     EVERY FINANCIAL EVENT IS A PROJECT     │
│                                            │
│  Estimate → Proposal → Deposit → Invoice  │
│         → Progress Billing → Payment       │
│                                            │
│  All tied to ONE project record            │
└────────────────────────────────────────────┘
```

---

## Financial Workflow

```
LEAD & SITE VISIT
├─ Scope captured (measurements, photos, voice notes)
└─ Attached to customer record
        ↓
    SMART PRICING ENGINE
    ├─ Reads site visit data
    ├─ Calculates base price
    ├─ Suggests markup
    └─ Returns confidence score
            ↓
        ESTIMATE CREATED
        ├─ Base price from Smart Pricing
        ├─ Contractor adjusts markup if needed
        ├─ Final estimate price set
        └─ Estimated profit calculated
                ↓
            PROPOSAL GENERATED
            ├─ From estimate
            ├─ Customer reviews & approves
            └─ E-signature captured
                    ↓
                CONTRACT APPROVED
                ├─ Project automatically created
                ├─ Estimated revenue locked in
                ├─ Estimated cost budget set
                └─ Profit target established
                        ↓
                    EXECUTION PHASE
                    ├─ Schedule work
                    ├─ Record material purchases → costs accumulate
                    ├─ Record labor → costs accumulate
                    ├─ Record equipment usage → costs accumulate
                    ├─ System: Real-time profit = Revenue - Accumulated Costs
                    └─ Alerts if approaching budget
                            ↓
                        PROGRESS BILLING (if multi-phase)
                        ├─ Create progress invoice
                        ├─ Customer pays deposit for next phase
                        ├─ Cash flow updated
                        └─ Project continues
                                ↓
                            COMPLETION
                            ├─ Final invoice generated
                            ├─ All costs finalized
                            ├─ Actual profit calculated
                            └─ Variance from estimate analyzed
                                    ↓
                                PAYMENT COLLECTION
                                ├─ Track customer payment
                                ├─ Reconcile against invoice
                                └─ Update cash position
                                        ↓
                                    ANALYSIS
                                    ├─ Why did we make/lose $X on this job?
                                    ├─ How does this compare to similar jobs?
                                    ├─ What should we price next time?
                                    └─ Insights fed back to Smart Pricing Engine
```

---

## Design Principles

1. **Project is the root record** - Every transaction links to a project
2. **Estimate-driven** - Budget comes from estimate/proposal
3. **Real-time visibility** - Profit margin updates as costs are entered
4. **No double entry** - Customer info, service description, pricing all entered once
5. **Contractor-first calculations** - Gross margin, labor efficiency, equipment utilization
6. **Optional integrations** - QB/Xero are export destinations, not core system
7. **Cash flow focused** - Deposits, progress billing, payment timing tracked automatically
8. **Budget protection** - Alerts when project costs exceed estimate

---

## Smart Financial Features

### AI-Powered Financial Intelligence

**Profit Forecasting:**
- Estimate final profit before work complete
- Identify remaining risks
- Confidence scoring based on history

**Underpriced Job Detection:**
- Compare estimated_margin vs market_margin
- Alert if margin < 10%
- Suggest pricing adjustments

**Budget Overrun Warnings:**
- Real-time monitoring of costs vs budget
- Alerts when approaching limit
- Critical alert if already negative

**Labor Efficiency Metrics:**
- Track technician productivity
- Revenue per hour
- Profit per hour
- Efficiency trends

**Equipment Utilization Analysis:**
- Track equipment cost vs value delivered
- ROI calculation
- Suggest better utilization

**Pricing Optimization:**
- Analyze historical projects with similar scope
- Compare estimated vs actual profit
- Recommend pricing adjustments for future

---

## Financial Dashboard

### Real-Time Metrics

```
┌─────────────────────────────────────────────────────────┐
│  TODAY'S SNAPSHOT                                       │
├─────────────────────────────────────────────────────────┤
│  Revenue This Month:        $45,200                     │
│  Costs This Month:          $28,100                     │
│  Profit This Month:         $17,100                     │
│  Margin:                    37.8%                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  CASH FLOW                                              │
├─────────────────────────────────────────────────────────┤
│  Outstanding Invoices:      $12,400                     │
│  Deposits Received Today:   $5,200                      │
│  Bills Due This Week:       $8,900                      │
│  Net Cash Position:         $8,700                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  ACTIVE PROJECTS                                        │
├─────────────────────────────────────────────────────────┤
│  In Progress:               12 projects                 │
│  At Risk (low margin):      2 projects                  │
│  Behind Budget:             1 project                   │
│  On Track:                  9 projects                  │
└─────────────────────────────────────────────────────────┘
```

---

## QuickBooks/Xero Integration Strategy

### ManyHats as System of Record

```
┌────────────────────────────────────┐
│  ManyHats Pro (System of Record)   │
│                                    │
│  • Project management              │
│  • Estimate/proposal generation    │
│  • Invoice creation (from projects)│
│  • Cost tracking                   │
│  • Cash receipt                    │
│  • Profit analysis                 │
└────────────────────────────────────┘
          ↓ EXPORT ↓
┌────────────────────────────────────┐
│  QuickBooks Online                 │
│                                    │
│  • Customer records                │
│  • Invoice detail                  │
│  • Check register                  │
│  • Expense accounts                │
│  • Profit/loss report              │
└────────────────────────────────────┘
```

**ONE-WAY SYNC:**
- ManyHats → QuickBooks (export only)
- Contractors can use ManyHats day-to-day without QB
- At end of period, sync to QB for accounting/tax
- QB is not real-time, not primary system

**OPTIONAL INTEGRATIONS:**
- QB for financial statement generation
- QB for tax reporting
- QB for accountant access
- QB for multi-entity consolidation

**ManyHats NEVER depends on QB**
- Works standalone
- QB integration fails? Contractors still operate
- Data is source of truth in ManyHats

---

## Document References

- [PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md) - Overall product strategy
- [PROJECT_INTELLIGENCE_LAYER.md](./PROJECT_INTELLIGENCE_LAYER.md) - Core data model
- [FLUTTER_FUTURE_READY_BACKEND.md](./FLUTTER_FUTURE_READY_BACKEND.md) - Mobile backend
- [SMART_PRICING_ENGINE.md](./SMART_PRICING_ENGINE.md) - Pricing engine integration

---

**Last Updated:** July 6, 2026  
**Status:** ✅ Authoritative - Core Finance Architecture  
**Next Review:** Upon MVP launch for real-world validation