# ManyHats Pro - Project Intelligence Layer Architecture

**Version:** 1.0  
**Last Updated:** July 6, 2026  
**Status:** Authoritative Architecture Document  
**Audience:** Architects, Backend Engineers, Frontend Engineers, Product Team

---

## Table of Contents

1. [Executive Overview](#executive-overview)
2. [Core Principle: Project as Center](#core-principle-project-as-center)
3. [Data Model](#data-model)
4. [Project Lifecycle & Data Flow](#project-lifecycle--data-flow)
5. [Database Schema](#database-schema)
6. [Query Patterns](#query-patterns)
7. [Integration Points](#integration-points)
8. [Real-time Updates](#real-time-updates)
9. [Future Extensibility](#future-extensibility)

---

## Executive Overview

The **Project Intelligence Layer** is the architectural foundation of ManyHats Pro. It ensures that every piece of information entered into the system is stored once in a canonical location and made available everywhere it's needed.

### Core Design Principle

```
                    PROJECT RECORD
                         |
        (Single source of truth for all job data)
        
Contains or connects to:
├─ Customer data (who, contact, history)
├─ Financial data (estimate, proposal, invoice, costs, profit)
├─ Operational data (schedule, team, materials, equipment)
├─ Documents (photos, voice notes, transcriptions, signatures)
└─ Future data (GPS, LiDAR, AR, inspections, septic systems)
```

**Key Principle:** Data is entered at its most logical point and flows outward to all consumers without duplication.

---

## Core Principle: Project as Center

### Why Projects?

A **project** is what contractors actually think about operationally:

- "How much will this septic replacement cost?"
- "When is the plumbing job scheduled?"
- "Who did the electrical work on that installation?"
- "What was our profit on that job?"
- "Did we complete that proposal?"

All of these questions center on a single project record.

### Project Definition

```sql
-- A project represents ONE job at ONE customer location
-- It is the parent record for all related financial and operational data

CREATE TABLE projects (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES company_profiles(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    
    -- Project identity
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL, -- 'lead', 'proposal', 'approved', 'scheduled', 'in_progress', 'completed', 'archived'
    
    -- Proposal & contract
    estimate_id UUID REFERENCES estimates(id),
    proposal_id UUID REFERENCES proposals(id),
    signed_proposal_id UUID REFERENCES proposal_signatures(id),
    
    -- Financial
    estimated_revenue NUMERIC,
    estimated_costs NUMERIC,
    estimated_profit NUMERIC,
    actual_revenue NUMERIC,
    actual_costs NUMERIC,
    actual_profit NUMERIC,
    
    -- Schedule
    start_date DATE,
    end_date DATE,
    
    -- Metadata
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Project States

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  lead (discovered opportunity)                                  │
│      ↓ (site visit + estimate)                                  │
│  proposal (estimate created, sent to customer)                  │
│      ↓ (customer reviews proposal)                              │
│  approved (customer signs proposal, contract ready)             │
│      ↓ (scheduled for execution)                                │
│  scheduled (in contractor's calendar)                           │
│      ↓ (work begins)                                            │
│  in_progress (active work phase)                                │
│      ↓ (work complete)                                          │
│  completed (delivered, invoice paid)                            │
│      ↓ (archive for future reference)                           │
│  archived (historical record)                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Entity Relationship

```
                        COMPANY
                            |
        ┌───────────────────┼───────────────────┐
        |                   |                   |
    CUSTOMER           TEAM MEMBERS        PROJECT ← Central Hub
        |                   |                   |
        |                   |                   ├─ ESTIMATE
        |                   |                   ├─ PROPOSAL
        |                   |                   ├─ SCHEDULE
        |                   |                   ├─ FINANCIALS
        |                   |                   ├─ PHOTOS
        |                   |                   ├─ DOCUMENTS
        |                   |                   ├─ VOICE NOTES
        |                   |                   ├─ MEASUREMENTS
        └───────────────────┴───────────────────┘
```

### Core Tables (Project-Centric)

#### 1. Customer & Contact Tables

```sql
-- Customers are the organizations we serve
CREATE TABLE customers (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES company_profiles(id),
    name TEXT NOT NULL,
    industry TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    country TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Contacts are people at each customer
CREATE TABLE contacts (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id),
    name TEXT NOT NULL,
    title TEXT,
    email TEXT,
    phone TEXT,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP
);

-- Interactions track all communication
CREATE TABLE interactions (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id),
    project_id UUID REFERENCES projects(id),
    interaction_type TEXT, -- 'call', 'email', 'meeting', 'site_visit', 'note'
    notes TEXT,
    created_at TIMESTAMP,
    created_by UUID REFERENCES auth.users(id)
);
```

#### 2. Project Core Table

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES company_profiles(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    
    -- Identification
    name TEXT NOT NULL,
    description TEXT,
    project_number TEXT UNIQUE,
    status TEXT NOT NULL, -- 'lead', 'proposal', 'approved', 'scheduled', 'in_progress', 'completed', 'archived'
    
    -- Service type & scope
    service_type TEXT, -- 'septic_replacement', 'plumbing', 'electrical', etc.
    scope_of_work TEXT,
    
    -- Links to proposal/contract
    estimate_id UUID REFERENCES estimates(id),
    proposal_id UUID REFERENCES proposals(id),
    signed_proposal_id UUID REFERENCES proposal_signatures(id),
    
    -- Financial tracking (automatically calculated)
    estimated_revenue NUMERIC,
    estimated_costs NUMERIC,
    estimated_profit NUMERIC,
    estimated_margin_percent NUMERIC,
    
    actual_revenue NUMERIC,
    actual_costs NUMERIC,
    actual_profit NUMERIC,
    actual_margin_percent NUMERIC,
    
    -- Schedule
    start_date DATE,
    end_date DATE,
    
    -- Metadata
    lead_source TEXT,
    customer_contact_id UUID REFERENCES contacts(id),
    assigned_to UUID REFERENCES team_members(id),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);
```

#### 3. Estimate & Proposal

```sql
CREATE TABLE estimates (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES company_profiles(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    
    service_type TEXT,
    description TEXT,
    
    base_price NUMERIC,
    markup_percentage NUMERIC,
    final_price NUMERIC,
    
    confidence_score NUMERIC, -- From Smart Pricing Engine
    ai_generated BOOLEAN,
    
    status TEXT, -- 'draft', 'sent', 'accepted', 'rejected'
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE proposals (
    id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES company_profiles(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    estimate_id UUID NOT NULL REFERENCES estimates(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    
    title TEXT,
    description TEXT,
    total_amount NUMERIC,
    payment_terms TEXT,
    validity_days INTEGER,
    
    status TEXT, -- 'draft', 'sent', 'viewed', 'signed', 'rejected', 'expired'
    
    pdf_url TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE proposal_signatures (
    id UUID PRIMARY KEY,
    proposal_id UUID NOT NULL REFERENCES proposals(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    
    customer_contact_id UUID REFERENCES contacts(id),
    signature_image BYTEA,
    signed_at TIMESTAMP,
    
    created_at TIMESTAMP
);
```

#### 4. Project Documents

```sql
CREATE TABLE project_photos (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    
    photo_url TEXT NOT NULL,
    storage_path TEXT,
    caption TEXT,
    taken_at TIMESTAMP,
    taken_by UUID REFERENCES team_members(id),
    
    -- Future mobile fields
    gps_latitude NUMERIC,
    gps_longitude NUMERIC,
    
    created_at TIMESTAMP
);

CREATE TABLE project_documents (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    
    document_type TEXT, -- 'contract', 'permit', 'inspection', 'warranty', 'other'
    file_url TEXT NOT NULL,
    storage_path TEXT,
    file_name TEXT,
    
    uploaded_at TIMESTAMP,
    uploaded_by UUID REFERENCES team_members(id)
);

CREATE TABLE voice_notes (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    
    audio_url TEXT NOT NULL,
    storage_path TEXT,
    duration_seconds INTEGER,
    
    created_at TIMESTAMP,
    created_by UUID REFERENCES team_members(id)
);

CREATE TABLE ai_transcriptions (
    id UUID PRIMARY KEY,
    voice_note_id UUID NOT NULL REFERENCES voice_notes(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    
    transcription_text TEXT,
    confidence_score NUMERIC,
    
    created_at TIMESTAMP
);
```

#### 5. Project Measurements

```sql
CREATE TABLE project_measurements (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    
    measurement_type TEXT, -- 'manual', 'gps', 'ar', 'lidar'
    measurement_category TEXT, -- 'distance', 'area', 'depth', 'height', etc.
    
    value NUMERIC,
    unit TEXT, -- 'feet', 'meters', 'square_feet', etc.
    
    description TEXT,
    created_at TIMESTAMP,
    created_by UUID REFERENCES team_members(id)
);

-- Future: Detailed measurement points (Phase 2+)
CREATE TABLE measurement_points (
    id UUID PRIMARY KEY,
    project_measurement_id UUID REFERENCES project_measurements(id),
    
    point_number INTEGER,
    x NUMERIC,
    y NUMERIC,
    z NUMERIC,
    
    created_at TIMESTAMP
);
```

#### 6. Project Schedule & Operations

```sql
CREATE TABLE project_schedules (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    
    scheduled_date DATE NOT NULL,
    scheduled_start_time TIME,
    scheduled_end_time TIME,
    
    assigned_to UUID NOT NULL REFERENCES team_members(id),
    status TEXT, -- 'scheduled', 'in_progress', 'completed', 'cancelled'
    
    created_at TIMESTAMP
);

CREATE TABLE project_status_updates (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    
    status_type TEXT, -- 'progress', 'issue', 'completion', 'delay'
    note TEXT,
    
    created_at TIMESTAMP,
    created_by UUID REFERENCES team_members(id)
);
```

#### 7. Project Financial Tracking

```sql
CREATE TABLE project_invoices (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    company_id UUID NOT NULL REFERENCES company_profiles(id),
    
    invoice_number TEXT UNIQUE,
    total_amount NUMERIC,
    
    status TEXT, -- 'draft', 'sent', 'viewed', 'paid', 'overdue'
    
    due_date DATE,
    paid_date DATE,
    
    created_at TIMESTAMP
);

CREATE TABLE project_costs (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    
    cost_type TEXT, -- 'material', 'labor', 'equipment', 'subcontractor', 'other'
    cost_category TEXT,
    
    amount NUMERIC,
    description TEXT,
    
    created_at TIMESTAMP,
    created_by UUID REFERENCES team_members(id)
);

CREATE TABLE project_labor (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    team_member_id UUID NOT NULL REFERENCES team_members(id),
    
    hours_worked NUMERIC,
    hourly_rate NUMERIC,
    total_cost NUMERIC,
    
    date_worked DATE,
    description TEXT,
    
    created_at TIMESTAMP
);

CREATE TABLE project_materials (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    
    item_description TEXT,
    quantity NUMERIC,
    unit_cost NUMERIC,
    total_cost NUMERIC,
    
    ordered_date DATE,
    received_date DATE,
    
    created_at TIMESTAMP
);

CREATE TABLE project_profit_snapshots (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    
    snapshot_date TIMESTAMP,
    
    revenue NUMERIC,
    costs NUMERIC,
    profit NUMERIC,
    margin_percent NUMERIC,
    
    created_at TIMESTAMP
);
```

---

## Project Lifecycle & Data Flow

### Complete Workflow

```
┌────────────────────────────────────────────────────────────────────┐
│                    PROJECT LIFECYCLE WORKFLOW                      │
└────────────────────────────────────────────────────────────────────┘

STAGE 1: DISCOVERY
├─ Input: Customer lead (name, phone, email, problem)
├─ Tables: customers, contacts, interactions
├─ Output: New customer record in system
└─ Status: "lead"

STAGE 2: QUALIFICATION (Site Visit)
├─ Input: Site visit
│   ├─ Location, photos, voice notes
│   ├─ Measurements (manual or GPS)
│   ├─ Scope observations
│   └─ Contact person identification
├─ Tables: project_photos, voice_notes, project_measurements
├─ AI Process: Transcribe voice notes, analyze images
└─ Status: Still "lead" (pre-estimate)

STAGE 3: PRICING
├─ Trigger: Manual "Generate Estimate" click
├─ Process: Smart Pricing Engine
│   ├─ Read measurements from project_measurements
│   ├─ Read photos and voice analysis
│   ├─ Query market benchmarks
│   ├─ Return base price + confidence
│   └─ Suggest markup %
├─ Tables: estimates (created with project reference)
├─ Human: Contractor reviews, approves or adjusts pricing
└─ Status: "proposal" (estimate created)

STAGE 4: PROPOSAL GENERATION
├─ Trigger: Contractor clicks "Generate Proposal"
├─ Process: Proposal Builder
│   ├─ Reads estimate
│   ├─ Reads customer info
│   ├─ Applies template
│   └─ Generates PDF
├─ Tables: proposals (created with estimate reference)
├─ Output: PDF sent to customer
└─ Status: "proposal" (sent to customer)

STAGE 5: APPROVAL & CONTRACT
├─ Trigger: Customer signs proposal
├─ Input: E-signature capture
├─ Tables: proposal_signatures
├─ System: Auto-creates PROJECT record
│   └─ Links to: customer, estimate, proposal, signature
├─ Output: Project ID now exists in system
└─ Status: "approved"

STAGE 6: SCHEDULING
├─ Trigger: Contractor schedules work
├─ Input: Date, time, technician assignment
├─ Tables: project_schedules
├─ Output: Calendar entry created
└─ Status: "scheduled"

STAGE 7: EXECUTION
├─ Trigger: Work date arrives
├─ Process: Technician logs time, photos, notes
├─ Tables:
│   ├─ project_labor (time tracking)
│   ├─ project_costs (material/equipment)
│   ├─ project_photos (progress photos)
│   └─ project_status_updates (daily logs)
├─ System: Real-time profit calculations
└─ Status: "in_progress"

STAGE 8: COMPLETION
├─ Trigger: Work complete, inspection passed
├─ Input: Final status, completion photos, sign-off
├─ Tables: project_status_updates, project_profit_snapshots
├─ System: Calculates final profit/margin
└─ Status: "completed"

STAGE 9: FINANCIAL CLOSURE
├─ Trigger: Invoice sent (manual or auto-generated)
├─ Process:
│   ├─ Generate invoice from proposal/contract
│   ├─ Track customer payment
│   ├─ Final cost reconciliation
│   └─ Profit verification
├─ Tables: project_invoices, project_costs (final)
└─ Status: "completed" (financially closed when paid)

STAGE 10: ARCHIVE & ANALYTICS
├─ Input: Project kept for history, warranty tracking
├─ Output: Available for:
│   ├─ Future analytics
│   ├─ Repeat customer recognition
│   ├─ Pricing learning
│   └─ Warranty service
└─ Status: "archived" (or "active" if warranty tracking)

```

### Data Entry Points

Every piece of information enters at exactly one logical point:

| Information | Entered At | Available From | Used By |
|-------------|-----------|-------------------|---------|
| Customer name | Customer creation | `customers` table | Estimates, proposals, invoices, CRM |
| Site measurements | Site visit/project record | `project_measurements` | Pricing engine, estimates, AI analysis |
| Service description | Manual or from estimate | `estimates` table | Proposals, contracts, job costing |
| Price | Smart Pricing Engine | `estimates` table | Proposals, invoices, profit analysis |
| Labor hours | Daily time entry | `project_labor` table | Invoices, cost analysis, profitability |
| Material costs | Purchase/receipt | `project_materials` table | Job costing, profit analysis |
| Customer contact | Contact creation | `contacts` table | Invoices, communication, proposal sign-off |
| Payment status | Payment recording | `project_invoices` table | Cash flow, AR aging, dashboards |

---

## Database Schema

### Complete Table Relationships

```
company_profiles
├─ customers (many)
│   ├─ contacts (many)
│   ├─ interactions (many)
│   └─ projects (many)
│       ├─ estimates (many)
│       │   └─ proposals (many)
│       │       └─ proposal_signatures (one)
│       ├─ project_photos (many)
│       ├─ project_documents (many)
│       ├─ voice_notes (many)
│       │   └─ ai_transcriptions (many)
│       ├─ project_measurements (many)
│       │   └─ measurement_points (many)
│       ├─ project_schedules (many)
│       ├─ project_status_updates (many)
│       ├─ project_invoices (many)
│       ├─ project_costs (many)
│       ├─ project_labor (many)
│       ├─ project_materials (many)
│       └─ project_profit_snapshots (many)
└─ team_members (many)
    ├─ project_schedules (assigned projects)
    ├─ project_labor (work logs)
    └─ interactions (created by)
```

### Indexing Strategy

```sql
-- Performance-critical queries
CREATE INDEX idx_projects_company_status ON projects(company_id, status);
CREATE INDEX idx_projects_customer ON projects(customer_id);
CREATE INDEX idx_project_photos_project ON project_photos(project_id);
CREATE INDEX idx_project_labor_project ON project_labor(project_id);
CREATE INDEX idx_project_costs_project ON project_costs(project_id);
CREATE INDEX idx_interactions_customer ON interactions(customer_id);
CREATE INDEX idx_estimates_project ON estimates(project_id);
CREATE INDEX idx_invoices_project ON project_invoices(project_id);
```

---

## Query Patterns

### Common Queries

```sql
-- "Show me all projects for a customer"
SELECT * FROM projects
WHERE customer_id = $1 AND company_id = $2
ORDER BY created_at DESC;

-- "What's the profit on this job?"
SELECT 
    actual_revenue,
    actual_costs,
    actual_profit,
    actual_margin_percent
FROM projects
WHERE id = $1;

-- "Show all photos from this project"
SELECT * FROM project_photos
WHERE project_id = $1
ORDER BY taken_at DESC;

-- "What are total labor costs on this project?"
SELECT 
    SUM(total_cost) as total_labor_cost,
    SUM(hours_worked) as total_hours
FROM project_labor
WHERE project_id = $1;

-- "Show all costs breakdown"
SELECT 
    cost_type,
    SUM(amount) as total,
    COUNT(*) as count
FROM project_costs
WHERE project_id = $1
GROUP BY cost_type;

-- "Which projects are unpaid?"
SELECT p.* FROM projects p
JOIN project_invoices pi ON p.id = pi.project_id
WHERE p.company_id = $1 
AND pi.status IN ('sent', 'viewed', 'overdue');

-- "Show project profit vs estimate"
SELECT 
    p.id,
    p.name,
    p.estimated_profit,
    p.actual_profit,
    (p.actual_profit - p.estimated_profit) as variance
FROM projects p
WHERE p.company_id = $1
ORDER BY variance DESC;

-- "Get project timeline with all activity"
SELECT 'photo' as type, taken_at as timestamp, caption as note FROM project_photos WHERE project_id = $1
UNION ALL
SELECT 'status_update', created_at, note FROM project_status_updates WHERE project_id = $1
UNION ALL
SELECT 'labor', date_worked, description FROM project_labor WHERE project_id = $1
ORDER BY timestamp DESC;
```

---

## Integration Points

### How Other Modules Connect

#### Smart Pricing Engine

```
1. Receives project context:
   ├─ project_measurements (site scope)
   ├─ project_photos (visual analysis)
   ├─ voice_notes + ai_transcriptions (verbal description)
   └─ service_type (what type of work)

2. Returns pricing:
   ├─ base_price → estimates table
   ├─ confidence_score → estimates table
   └─ recommendations → UI display

3. Pricing linked back to project:
   project.estimated_revenue = estimate.final_price
   project.estimated_profit = estimated_revenue - estimated_costs
```

#### Contractor Financial Engine

```
1. Reads from project:
   ├─ project.estimated_revenue
   ├─ project.estimated_costs
   ├─ project_costs (actual costs)
   ├─ project_labor (labor costs)
   └─ project_materials (material costs)

2. Calculates:
   ├─ project.actual_profit
   ├─ project.actual_margin_percent
   ├─ cash_flow_projection
   └─ budget_status

3. Writes back to project:
   ├─ project_profit_snapshots
   └─ project.updated_at
```

#### Scheduling

```
1. Reads from project:
   ├─ project.start_date
   ├─ project.end_date
   └─ project.assigned_to

2. Creates/updates:
   ├─ project_schedules
   └─ project.status = 'scheduled'

3. Updates project as work happens:
   ├─ project.status = 'in_progress'
   └─ project.updated_at
```

#### Invoicing

```
1. Reads from project:
   ├─ project.estimated_revenue
   ├─ proposal.total_amount
   ├─ project_costs (for job costing detail)
   └─ customer info from customers table

2. Creates:
   ├─ project_invoices
   ├─ PDF from project data
   └─ Sends to customer

3. Tracks:
   ├─ project_invoices.status
   ├─ project_invoices.paid_date
   └─ project.actual_revenue
```

---

## Real-time Updates

### Supabase Real-time Subscriptions

```typescript
// Subscribe to project changes
supabase
  .channel(`project:${projectId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'projects',
      filter: `id=eq.${projectId}`,
    },
    (payload) => {
      // Update UI with latest project data
      updateProjectDisplay(payload.new);
    }
  )
  .subscribe();

// Subscribe to cost changes (for real-time profit updates)
supabase
  .channel(`project_costs:${projectId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'project_costs',
      filter: `project_id=eq.${projectId}`,
    },
    (payload) => {
      // Recalculate profit when new cost added
      recalculateProjectProfit(projectId);
    }
  )
  .subscribe();
```

---

## Future Extensibility

### Phase 2+ Fields (Already in Schema)

The following tables include fields for future mobile features:

```sql
-- project_photos includes GPS coordinates for future mapping
├─ gps_latitude
├─ gps_longitude

-- project_measurements prepared for AR/LiDAR data
├─ measurement_type: 'manual', 'gps', 'ar', 'lidar'
└─ measurement_points table for detailed 3D data

-- Future tables pre-planned but not implemented yet
├─ project_locations (for multi-site projects)
├─ ar_measurements (AR-captured dimensions)
├─ lidar_scans (drone/mobile LiDAR data)
├─ site_maps (2D/3D site visualizations)
├─ septic_systems (Phase 3 Sentinel module)
├─ mobile_devices (device registration)
├─ offline_sync_queue (offline change tracking)
└─ push_notification_tokens (mobile notifications)
```

### How to Add New Features

1. **New field needed on existing table?**
   - Add to project or related table
   - Update indexes if frequently queried
   - Add RLS policy if security-critical

2. **New workflow that touches projects?**
   - Create new table with project_id foreign key
   - Add indexes
   - Create Edge Function to sync data
   - Update real-time subscriptions

3. **New document type?**
   - Add to project_documents with document_type
   - No schema change needed
   - Update file storage strategy if needed

4. **New calculation/insight?**
   - Create Edge Function that reads project data
   - Cache results in project_profit_snapshots or similar
   - Update via triggers or scheduled functions

---

## Consistency Rules

### Data Integrity

1. **Every entry has exactly one project reference**
   - `project_photos.project_id`
   - `project_labor.project_id`
   - `project_costs.project_id`
   - etc.

2. **Project always references customer**
   - `projects.customer_id` - never NULL

3. **Project always references company**
   - `projects.company_id` - never NULL

4. **All timestamps use UTC**
   - TIMESTAMP stored in UTC
   - Timezone handled on client

5. **Financial data is read-only after calculation**
   - `project.actual_profit` calculated by function
   - Manual edits only to `project_costs` line items
   - Not directly editable in UI

---

## Document References

- [PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md) - Overall product strategy
- [CONTRACTOR_FINANCIAL_ENGINE.md](./CONTRACTOR_FINANCIAL_ENGINE.md) - Financial calculations
- [FLUTTER_FUTURE_READY_BACKEND.md](./FLUTTER_FUTURE_READY_BACKEND.md) - Mobile sync strategy
- [SMART_PRICING_ENGINE.md](./SMART_PRICING_ENGINE.md) - Pricing engine integration
- [LOVABLE_BUILD_GUIDE.md](./LOVABLE_BUILD_GUIDE.md) - Web development guide

---

**Last Updated:** July 6, 2026  
**Status:** ✅ Authoritative - Core Architecture Document  
**Next Review:** Upon mobile (Flutter) architecture initiation
