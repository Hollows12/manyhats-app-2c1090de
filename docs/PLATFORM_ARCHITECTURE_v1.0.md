# ManyHats Platform Architecture v1.0

## Status

Approved and authoritative.

This document governs routine development for ManyHats Pro, shared platform services, and the relationship between ManyHats Pro and Sentinel Septic.

Architecture changes require deliberate review and must not occur accidentally through individual feature pull requests.

## Mission

ManyHats Pro is an AI-assisted business operating system for contractors and service businesses.

Its purpose is to preserve the contractor's and client's shared understanding from the first conversation through project delivery, payment, warranty, closeout, and the long-term client relationship.

## Core Principle

Shared Vision is the Project Intelligence Layer.

Every project begins with Shared Vision.

Every downstream workflow reads from it, enriches the project record, and preserves its history.

No core workflow should bypass it.

## Golden Rule

Capture Once. Use Everywhere.

When information already exists:

- Do not request it again without a valid reason.
- Reuse it automatically.
- Allow it to be updated when circumstances change.
- Record important changes.
- Preserve accepted and historical snapshots.
- Avoid duplicate files, photos, measurements, notes, and records.

## Universal Project Lifecycle

Lead
→ Client
→ Project
→ Shared Vision
→ Site Capture
→ AI Analysis
→ Estimate
→ Proposal
→ Client Acceptance
→ Project Delivery
→ Scheduling
→ Field Updates
→ Change Orders
→ Invoices
→ Payments
→ Client Portal
→ Warranty
→ Closeout
→ Business Intelligence
→ Lifetime Client Relationship

## Shared Vision Responsibilities

Shared Vision may capture or reference:

- Client goals
- Project goals
- Priorities
- Budget expectations
- Timeline expectations
- Inspiration
- Site conditions
- Existing conditions
- Measurements
- Photos
- Videos
- Voice notes
- Documents
- Materials
- Risks
- Constraints
- Client expectations
- Contractor recommendations
- AI recommendations
- Inclusions
- Exclusions
- Optional upgrades
- Warranty expectations
- Project readiness

Shared Vision must not become an oversized duplicate storage system.

Specialized records should remain in the correct domain tables while being linked into the Project Intelligence Layer.

## Universal Client File

Each client and project must have a connected digital record containing or referencing:

- Contact information
- Property information
- Shared Vision
- Site captures
- Photos and videos
- Voice notes
- Measurements
- Estimates
- Proposals
- Contracts
- Signatures
- Permits
- Change orders
- Project updates
- Invoices
- Payments
- Warranties
- Closeout documents
- Communications
- Activity history

Files and records must be referenced rather than unnecessarily duplicated.

## Core Platform Capabilities

- CRM
- Shared Vision
- Universal Client File
- AI Contractor OS
- Site Capture
- Estimating
- Proposals
- Contracts
- Scheduling
- Project Management
- Field Updates
- Change Orders
- Invoicing
- Payments
- Client Portal
- Warranty
- Closeout
- Reporting
- Business Intelligence
- Security
- Team and role management

These are connected stages and services within one platform.

They must not become isolated applications inside the application.

## AI Contractor OS

AI may assist with:

- Voice-to-structured capture
- Site analysis
- Estimate preparation
- Scope drafting
- Proposal writing
- Rendering assistance
- Schedule recommendations
- Risk detection
- Material recommendations
- Business insights
- Client communication drafts
- Project summaries

The contractor retains final control over:

- Pricing
- Scope
- Contracts
- Safety
- Regulatory compliance
- Client promises
- Scheduling commitments
- Final communication

## Trade Support

The core architecture must support multiple contractor and service trades.

Trade-specific capabilities may contribute:

- Specialized forms
- Calculators
- Checklists
- Templates
- AI instructions
- Reports
- Compliance records
- Proposal sections
- Project workflows
- Client portal content

Trade extensions must use the existing client, project, Shared Vision, document, security, and workflow architecture wherever practical.

## Sentinel Septic

Sentinel Septic is a separate branded product and an optional ManyHats Pro add-on.

Standalone Sentinel Septic must be capable of serving septic professionals independently.

The ManyHats Pro add-on must allow qualified ManyHats Pro customers to enable Sentinel septic tools without forcing those tools on unrelated contractors.

Shared services may include:

- Authentication
- Tenant and company management
- CRM foundations
- Shared Vision concepts
- Storage
- Security
- Client portal infrastructure
- Payments
- AI infrastructure
- Reporting infrastructure

Sentinel-specific capabilities remain independently defined, including:

- Septic site evaluation
- Soil and site information
- System planning
- Tank and component records
- Leach-field planning
- GPS, GIS, or mapping data
- Permit workflows
- Inspection workflows
- Maintenance records
- Regulatory records
- As-built documentation

## Security Laws

Every feature must preserve:

- Multi-tenant isolation
- Row Level Security
- Secure authentication
- Role-based authorization
- Secure storage access
- Portal isolation
- Auditability
- Safe public RPCs
- Secure payment processing
- Server-side secret handling
- Validated client input

Security must never be removed merely to make a workflow pass.

## Data Laws

- Use stable identifiers and relational references.
- Do not duplicate authoritative data without a snapshot or historical reason.
- Accepted proposals must preserve immutable snapshots.
- Signed contracts must preserve immutable snapshots.
- Accepted change orders must preserve immutable snapshots.
- Paid invoices must not be silently modified.
- Stripe or payment-provider confirmation must be verified server-side.
- Client-visible and internal-only information must be explicitly separated.
- Historical records must remain traceable.

## Product Design Laws

Every feature must:

- Strengthen the Shared Vision lifecycle.
- Reuse information already captured.
- Reduce administrative effort.
- Improve the contractor or client experience.
- Preserve security.
- Fit the existing architecture.
- Remain modular.
- Avoid unnecessary complexity.
- Support multiple trades where appropriate.
- Keep the contractor in control.

## Architecture Governance

Routine feature work must align with this document.

A feature PR must not redefine:

- Shared Vision
- The Universal Client File
- The contractor lifecycle
- ManyHats Pro's role
- Sentinel Septic's role
- The tenant model
- The security model

An architecture change requires:

1. A documented problem.
2. Alternatives considered.
3. Migration impact.
4. Security impact.
5. Product impact.
6. Explicit approval.
7. A versioned architecture amendment.

## Definition of Done

A feature is not complete unless:

- It follows this architecture.
- It fits into the project lifecycle.
- It follows Capture Once. Use Everywhere.
- It preserves tenant isolation.
- It protects internal data from portal users.
- It uses typed data contracts.
- It avoids broad unsafe casts.
- It includes appropriate tests.
- It passes applicable validation.
- It updates documentation.
- It delivers measurable user value.
