# Phase 3 — Mobile Field Capture, Voice Notes & PWA

## What shipped

### 1. Mobile field capture route
- `/field-capture` — project picker (existing).
- `/field-capture/$projectId` — new mobile-first workspace with a 4-tab
  bottom-friendly layout: **Photos · Voice · Receipts · Log**. Sticky project
  header, thumb-friendly targets, no desktop chrome.

### 2. Photo metadata model
`project_photos` extended with:
- `category` (free-form)
- `phase` — `before | during | after | damage | material | receipt | other`
- `is_client_facing` — controls whether a photo can ever appear in the
  client portal / proposal
- `proposal_include` — flag the photo for the next proposal
- `gps_lat` / `gps_lng` — captured from the browser Geolocation API on upload
- `captured_at` — client-clock timestamp
- `client_id` — optional denorm link

Each photo card now exposes phase, proposal, and client/internal toggles.
GPS is captured on upload if the user grants permission (soft-fail).

### 3. Voice notes (real, AI-powered)
- Recorder uses `MediaRecorder` (`audio/webm`, iOS fallback `audio/mp4`).
- Audio uploads to the `field-photos` bucket under `voice/<projectId>/…`.
- Server function `transcribeVoiceNote` (`src/lib/voice.functions.ts`):
  1. `POST /v1/audio/transcriptions` on the Lovable AI Gateway with
     `openai/gpt-4o-mini-transcribe`.
  2. Follow-up `google/gemini-2.5-flash` chat call in JSON mode to produce
     a 2-3 sentence summary + a scope-note draft.
  3. Writes `transcript`, `summary`, `scope_notes` back to `voice_notes`.
- Client key stays server-side (`LOVABLE_API_KEY`); the browser never sees it.
- Re-transcribe button available per-note.

### 4. Receipts → Job Costs
New `receipts` table (staff-only RLS). Field users snap a photo, enter
vendor / amount / category (material, equipment, fuel, subcontractor, misc),
purchase date, and notes. **"Push to Job Costs"** upserts the matching
`job_costs.category` row (creates if missing) and links `job_cost_id` back
on the receipt so it can't be double-posted.

### 5. Daily field log
Uses the existing `daily_logs` table. New tab per project with a form for
date, weather, crew, materials, equipment, subs, progress, client comms, and
hours. Displayed reverse-chronologically with delete.

### 6. PWA
- `public/manifest.webmanifest` with `display: standalone`, theme color,
  icons (192 / 512).
- Root route links the manifest + apple-touch-icon.
- **Manifest-only** installability per the PWA skill — no service worker,
  no offline cache. This keeps client financial data out of any browser
  cache and avoids Lovable preview issues.

## Workflow

```
Field Photos + Voice Notes + Receipts
        │
        ▼
AI transcript + summary + scope draft (voice notes)
        │
        ▼
Copy scope draft into Estimate / Proposal (manual for now)
        │
        ▼
Receipts pushed to Job Costs → Financial tab profitability
```

## Deferred (not in this pass)

- **Offline queue** — needs IndexedDB + background sync worker. Not shipped
  because the PWA skill explicitly forbids app-shell service workers for
  installability-only PWAs, and safe offline caching of financial data
  requires per-user encryption we don't have yet. Field users still work
  online-first; failed uploads surface `toast.error` and can be retried.
- **Auto-attach voice scope to estimate / proposal** — scope drafts are
  visible on the voice card; copy/paste into the Estimate tab until we
  wire a dedicated "Send to Proposal" server function.
- **LiDAR scan import** — parked; iOS/WebXR pipeline is a larger project.
- **Bulk-upload progress bar** — uploads still work in bulk (multi-file
  input), just without a per-file progress UI.

## Security model

- All new tables (`receipts`) are `is_staff(auth.uid())` gated.
- Photo `is_client_facing = false` by default; the customer portal must
  filter on this column before ever exposing a photo.
- `field-photos` bucket is private; the app serves signed URLs (1h) on
  demand.
- `LOVABLE_API_KEY` only exists server-side. Transcription happens inside
  a `requireSupabaseAuth` server function.
- No financial data is cached in the PWA shell (no service worker).

## PWA install instructions

1. Open the published app on iOS Safari or Android Chrome.
2. Share → **Add to Home Screen** (iOS) or the browser menu → **Install app**
   (Android/desktop Chrome).
3. Launch from the home-screen icon for a full-screen contractor view.
