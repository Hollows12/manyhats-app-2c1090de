# Firecrawl Smart Pricing Engine — Build Plan

This is a large, multi-pass build. I'll ship it in ordered passes so you can review as we go, and I'll flag anything that needs your call (like your contractor ZIP/service radius, and which suppliers to prioritize first).

## Ground rules (baked into every phase)
- Firecrawl runs **server-side only** (`FIRECRAWL_API_KEY` never in the browser).
- All scraped data is **cached in Supabase** with source URL + retrieved-at + confidence. Estimates read the cache, never live-scrape mid-estimate.
- AI recommendations are **advisory** — every AI-suggested line item lands in a **"Pending contractor review"** state and cannot flow into a client proposal until you approve it.
- We only touch **publicly available** pages, respect robots/ToS, and skip anything gated.
- Every price stored keeps `source`, `retrieved_at`, `product_url`, and `price_confidence`.

## Pass 1 — Foundation (this turn's target)
1. **Connect Firecrawl** via Lovable connector (workspace already may have one — I'll check `list_connections`; if not, I'll trigger the connect flow).
2. **Supabase schema** — one migration adding:
   - `suppliers` (name, address, phone, website, categories[], zip, county, state, distance_mi, hours, is_favorite, last_updated)
   - `materials` (name, manufacturer, description, coverage, yield, weight, dimensions, colors[], compatible_with[], install_instructions, tds_url, warranty, sds_url, image_url, upc, sku, spec jsonb)
   - `material_prices` (material_id, supplier_id, price, unit, price_date, availability, product_url, source, price_confidence, retrieved_at) + history-friendly (no upsert-collapse; keep every snapshot)
   - `contractor_service_areas` (contractor_id, zip, radius_mi, primary bool)
   - `preferred_vendors` (contractor_id, supplier_id, trade)
   - `ai_estimate_recommendations` (project_id, payload jsonb, status enum: pending/approved/rejected, confidence, notes, reviewed_by, reviewed_at)
   - `firecrawl_jobs` (kind, target, status, started_at, finished_at, result_summary, error) — audit trail
   - `knowledge_docs` (title, kind: install/spec/sds/warranty/practice/safety, body_md, source_url, tags[], embedding-ready text)
   - All with RLS: staff read/write, admin-only for pricing/knowledge writes, `service_role` for Firecrawl workers. GRANTs included.
3. **Server helpers** (`src/lib/firecrawl/*.server.ts`) wrapping scrape/search/map/crawl with typed returns + Supabase caching.
4. **Firecrawl server functions** (`*.functions.ts`) — admin-gated:
   - `discoverSuppliersByZip({ zip, radius })` — Firecrawl search → normalize → upsert `suppliers`.
   - `enrichMaterial({ query|url })` — scrape product page → upsert `materials` + `material_prices`.
   - `refreshSupplierPrices({ supplier_id, category })` — batched crawl of category pages.
5. **Settings → Service Area** panel: contractor enters ZIP + radius (used by every discovery job).

## Pass 2 — Supplier & Material UI
- New route `/_authenticated/pricing` (admin) with tabs:
  - **Suppliers** — table + "Discover suppliers for ZIP" action, favorite toggle, distance sort.
  - **Materials** — searchable catalog, per-material price history chart, "Refresh from web" button.
  - **Jobs** — Firecrawl job log (audit trail).
- Placeholder "Connect supplier API" buttons stay, now wired to the discovery flow.

## Pass 3 — AI Smart Pricing (advisory)
- New server fn `recommendEstimate({ project_id })` using Lovable AI Gateway (Gemini) + Zod:
  - Reads project type, photos count, measurements, notes, cached material_prices for the project's ZIP, historical `job_costs`, `knowledge_entries`.
  - Returns structured recommendation: materials[], quantities, labor_hours, equipment, travel, waste, contingency, markup, margin, price_range {low, high}, confidence, reasoning.
  - Persists to `ai_estimate_recommendations` with `status='pending'`.
- Estimate builder gets a **"AI Suggestions"** panel with per-line **Approve / Edit / Reject**. Only approved lines can be pushed into the real estimate. Proposal builder blocks "Ready to Send" if any AI line is still pending inside the linked estimate.

## Pass 4 — Proposal enhancement
- Extend `proposals` with `payment_schedule`, `optional_upgrades`, `hidden_condition_disclaimer`, `price_validity_days` (default 30).
- Update PDF sections to include Material Summary, Labor Summary, Optional Upgrades, Payment Schedule, Price Validity, Hidden Condition Disclaimer. Keep existing order rules (real photos last, concept watermark).

## Pass 5 — Learning loop
- On project → Complete, an existing hook already offers to write a `knowledge_entries` row. Extend it to compute variance vs estimate (cost, hours, profit) and store an AI-generated "how to bid this next time" note. Feed that back into `recommendEstimate` context.

## Pass 6 — Knowledge Center
- Route `/_authenticated/knowledge-center` with search across `knowledge_docs` + `knowledge_entries` (products, install methods, coverage, TDS/SDS links, safety, practices). Import action uses Firecrawl `scrape` with `formats: ['markdown','summary']` and stores markdown + source.

## Pass 7 — Future-ready seams
- Thin interfaces in `src/lib/pricing/providers/` (`SupplierProvider`, `InventoryProvider`, `WeatherProvider`, `PermitProvider`, `PaymentProvider`) so Firecrawl is one implementation among many. QuickBooks/Stripe/Square/GIS/LiDAR/telematics get typed stubs, no live calls yet.

## What I need from you before Pass 1
1. **Contractor ZIP + service radius** (e.g. 43055 / 40 mi) — I'll seed one, but you'll want the real one.
2. **Firecrawl** — I'll check for an existing workspace connection first. If none, I'll trigger the connect flow (uses Lovable-managed key; no manual paste).
3. Confirm you're OK with me creating ~9 new tables in one migration.

Reply "go" and I'll run Pass 1 (connector check + migration + server helpers + Service Area settings). Or tell me which pass to prioritize first.
