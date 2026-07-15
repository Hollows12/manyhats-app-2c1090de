# ManyHats Pro — Edge Functions

> **Version:** V1 Baseline · 2026-07-15

---

## Summary

**ManyHats Pro V1 contains zero Supabase Edge Functions (Deno).**

This is correct and intentional.

---

## Stack Decision

ManyHats Pro uses **TanStack Start server functions** instead of Supabase Deno Edge Functions. This is a deliberate architectural choice made when the platform was built on the Lovable TanStack Start template (`tanstack_start_ts_2026-06-17`).

| Capability | ManyHats Pro Implementation | Supabase Edge Functions |
|-----------|---------------------------|------------------------|
| Server-side business logic | TanStack Start server functions (`.functions.ts`) | Deno `supabase/functions/` |
| Runtime | Cloudflare Workers (via Nitro) | Deno on Supabase infrastructure |
| Auth validation | `requireSupabaseAuth` TanStack middleware | `supabase.auth.getUser()` in Deno |
| Deployment | Single Cloudflare Worker bundle | Separate Deno function per endpoint |
| Secret access | `process.env.*` in Nitro | Supabase secret store |
| Language | TypeScript (Node/CF Workers) | TypeScript (Deno) |

---

## Confirmed Absence

```bash
ls supabase/functions/
# → directory does not exist
```

The `supabase/functions/` directory does not exist in this repository. This was verified during restoration validation on 2026-07-14.

---

## Where Edge-Function-Like Logic Lives

All logic that would typically live in Supabase Edge Functions is implemented as TanStack Start server functions:

| Capability | File |
|-----------|------|
| AI scope writing | `src/lib/scope-writer.functions.ts` |
| Voice transcription | `src/lib/voice.functions.ts` |
| Pricing / Firecrawl | `src/lib/firecrawl/pricing.functions.ts` |
| Field capture routing | `src/lib/capture-router.functions.ts` |
| Schema checks | `src/lib/schema-check/schema.functions.ts` |
| Git sync | `src/lib/git-sync.functions.ts` |
| Concept image generation | `src/routes/api/concept-image.ts` |
| Proposal PDF | `src/routes/api/proposals.$id.pdf.tsx` |

---

## Source Repository Note

The Flutter source repository (`Hollows12/manyhats-app`) contained Supabase Edge Functions (Deno). Those functions are **not applicable to the Lovable TanStack Start target** and were explicitly excluded from all restoration work. The security hardening applied to the source `estimate-ai-pricing-recommendation` Deno function was instead verified to have a **target-native equivalent** in `src/lib/firecrawl/pricing.functions.ts` with `requireSupabaseAuth` middleware.

---

## Future Roadmap

> Currently no plans to introduce Supabase Edge Functions. TanStack server functions are the intended pattern for this stack.

If future requirements necessitate Deno edge functions (e.g., webhook receivers, scheduled jobs), they would be added to `supabase/functions/` and documented here. Current candidates for consideration:

| Potential Future Use | Current Workaround |
|---------------------|-------------------|
| Scheduled price refresh (pg_cron) | On-demand Firecrawl jobs only |
| Stripe webhook handler | Not yet implemented |
| Email delivery callbacks | Not yet implemented |
| Database triggers needing HTTP calls | `notify_staff` RPC + in-app notifications |
