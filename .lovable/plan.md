# Sync & Publish V1 Readiness Plan — ManyHats Pro

## Current State (inspection only)

### 1. GitHub connection
- The workspace is a Lovable-managed clone. Its configured remotes are:
  - `origin` → `git.private.lovable-gcp.code.storage/14d52593-cf19-46c2-9849-293daae70ee8.git`
  - `secondary` → `s3://lovable-repositories/14d52593-cf19-46c2-9849-293daae70ee8.git`
- **It is not directly connected to `github.com/Hollows12/manyhats-app-2c1090de` as a git remote.**
- The GitHub repository is public and reachable (latest commit confirmed via the GitHub API), but it is not currently registered in this checkout.

### 2. Commit positions
- **GitHub `main`:** `e694d9ab1bea53a0eade578d2e00aa209fd3d014` (2026-08-12) — adds the security migration `20260812023000_close_public_rpc_execute_inheritance.sql`.
- **Lovable `origin/main`:** `add4bfc5ba377e0311e866bb205c3d33a1081485` (2026-07-10).
- **Lovable workspace HEAD:** `dddee0a57da47a0969c5b951e8d02f4ac960860f` (2026-08-18) on branch `edit/edt-098215a3-d281-464f-a323-5409f1a6462b`.
- **Working tree:** clean.
- **Ahead of Lovable `origin/main`:** 19 commits (Client Files, share details, access-history filters, Git sync page, etc.).

### 3. Behind / ahead vs. GitHub
- **Lovable is behind GitHub `main` by the 2026-08-12 security fix.** The migration `supabase/migrations/20260812023000_close_public_rpc_execute_inheritance.sql` does **not** exist in the local workspace.
- **Lovable is also ahead of GitHub `main`** with the V1 UI/features built after the July 10-11 sync.
- **Result:** the two branches have diverged. GitHub has a security fix that must be pulled in before publishing V1.

### 4. Publish status
- **Not yet published.** A preview URL exists; no published URL is configured.

### 5. Security scan
- Last scan is **stale (2026-07-07)**.
- Current findings are **warnings only** (no critical/blockers), but the scan must be re-run before publishing because the codebase has changed significantly since then.

### 6. Other deployment readiness
- `GITHUB_REPO`, `GITHUB_TOKEN`, `GITHUB_BRANCH`, and `BUILD_COMMIT_SHA` are not set in the current environment. The Git sync page will show missing-config warnings until these secrets are added.
- Lovable Cloud (Supabase) integration is already configured.

---

## Exact safe steps to sync and publish V1

### Step 1 — Register the GitHub remote and inspect divergence
```bash
git remote add github https://github.com/Hollows12/manyhats-app-2c1090de.git
git fetch github main
```
Then verify the relationship:
```bash
git merge-base HEAD github/main
```

### Step 2 — Choose the sync strategy
- **If the merge base is `add4bfc` (Lovable `origin/main`):** GitHub `main` is a clean fast-forward from that point. The safest path is to cherry-pick the GitHub security commit onto the current Lovable edit branch:
  ```bash
  git cherry-pick e694d9ab1bea53a0eade578d2e00aa209fd3d014
  ```
  This migration only adds a new file, so it should apply cleanly.
- **If the merge base is somewhere else:** Run a dry-run merge to see conflicts and resolve them manually, keeping Lovable versions for `src/`, `vite.config.ts`, and `package.json` while using GitHub versions for `supabase/migrations/` and docs.

### Step 3 — Validate the merged state
Run the same checks used in the runbook:
```bash
bunx tsgo --noEmit
bun run build
bun run test
```
Do not proceed if any of these fail.

### Step 4 — Re-run security scan
Trigger a fresh security scan after the merge. Publishing is blocked only if it returns **critical** findings; warnings should be reviewed and documented.

### Step 5 — Publish V1
Once the merge and validation are clean, use the Lovable Publish flow (`preview_ui--publish`) to make the app live. This plan does **not** publish now; it only prepares the state for a safe publish.

### Step 6 — Push back to GitHub (recommended)
After the publish succeeds and the merged branch is verified, push the result back to `Hollows12/manyhats-app-2c1090de` main so both repositories stay synchronized:
```bash
git push github HEAD:main
```

---

## Risks if published without syncing

1. **Security gap:** V1 would be published without the 2026-08-12 PUBLIC RPC revocation fix, leaving staff/application RPCs potentially callable by anonymous users.
2. **Stale scan:** A security scan from July 7 does not reflect the current V1 code, so unknown critical issues could be published.
3. **Git drift:** Publishing from Lovable without pushing back to GitHub will widen the divergence, making future syncs harder.

---

## Approval requested

Approve this plan to execute the sync-and-publish steps. No code changes or publishing will happen until you approve.
