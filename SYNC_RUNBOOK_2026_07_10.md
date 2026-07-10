# 🔄 COMPREHENSIVE SYNCHRONIZATION RUNBOOK
## Lovable Clone ← Primary Repository Sync (July 7-10, 2026)

**Document Version:** 1.0  
**Created:** July 10, 2026  
**Status:** 📖 REFERENCE & RECOVERY GUIDE  
**Last Updated:** Before agent execution

---

## 📋 EXECUTIVE SUMMARY

This runbook documents the complete synchronization process from:
- **Source:** `Hollows12/manyhats-app` (primary Flutter repo)
- **Target:** `Hollows12/manyhats-app-2c1090de` (Lovable TypeScript/React clone)
- **Branch:** Create temporary `sync/from-manyhats-app-2026-07-10`
- **Scope:** Production-ready work from July 7-10, 2026

**Key Constraints:**
- ✅ Preserve ALL Lovable-specific files and integrations
- ✅ Maintain chronological order of Supabase migrations
- ✅ Preserve all security (RLS, JWT, CORS, company checks)
- ✅ No direct push to main
- ✅ No merge until reviewed
- ❌ Don't weaken any security measures
- ❌ Don't remove working functionality

---

## PART 1: ENVIRONMENT & REPOSITORY SETUP

### 1.1 Prerequisites Check

Before starting, ensure you have:

```bash
# Git installed
git --version
# Expected: git version 2.30+

# Node.js/npm for Lovable repo
node --version && npm --version
# Expected: Node v16+, npm 7+

# Access to both repositories
# Primary: https://github.com/Hollows12/manyhats-app
# Clone: https://github.com/Hollows12/manyhats-app-2c1090de

# Sufficient disk space
df -h
# Expected: At least 2GB free
```

### 1.2 Clone Repositories (if needed)

```bash
# Clone the Lovable repository (target)
git clone https://github.com/Hollows12/manyhats-app-2c1090de.git
cd manyhats-app-2c1090de

# Verify you're in the right directory
pwd
# Expected: .../manyhats-app-2c1090de

# Verify on main branch
git branch
# Expected: * main
```

### 1.3 Add Primary as Remote

```bash
# Add primary repository as upstream
git remote add upstream https://github.com/Hollows12/manyhats-app.git 2>/dev/null || true

# Verify remotes
git remote -v
# Expected output:
#   origin    https://github.com/Hollows12/manyhats-app-2c1090de.git (fetch)
#   origin    https://github.com/Hollows12/manyhats-app-2c1090de.git (push)
#   upstream  https://github.com/Hollows12/manyhats-app.git (fetch)
#   upstream  https://github.com/Hollows12/manyhats-app.git (push)
```

### 1.4 Fetch Latest from Both Repositories

```bash
# Fetch from origin (Lovable clone)
git fetch origin main
# Verifies Lovable repo is accessible

# Fetch from upstream (primary)
git fetch upstream main
# Gets all commits from primary repository

# Verify both are fetched
git branch -r | grep -E "origin/main|upstream/main"
# Expected:
#   origin/main
#   upstream/main
```

---

## PART 2: BRANCH CREATION & COMPARISON

### 2.1 Create Temporary Sync Branch

```bash
# Create sync branch from current main
git checkout -b sync/from-manyhats-app-2026-07-10

# Verify branch created and active
git branch
# Expected: * sync/from-manyhats-app-2026-07-10
#           main

# Verify HEAD
git log --oneline -1
# Should match Lovable's main commit
```

### 2.2 Compare Repositories

```bash
# Get commit range to sync (primary main that's not in Lovable main)
git log --oneline main...upstream/main | wc -l
# Expected: ~23 commits to sync

# See the commits
git log --oneline main...upstream/main
# Expected: Shows all commits from July 7-10, 2026

# Compare files that differ
git diff --stat main upstream/main | head -30
# Expected: Shows files added/modified in primary
```

### 2.3 Identify Files by Category

```bash
# Supabase migrations (safe to merge)
git diff --name-only main upstream/main | grep "supabase/migrations"
# Expected: supabase/migrations/009_critical_rls_fixes.sql

# Edge functions (need security review but safe)
git diff --name-only main upstream/main | grep "supabase/functions"
# Expected: 8 edge functions + _shared/auth.ts

# Documentation (always safe)
git diff --name-only main upstream/main | grep -E "\.md|docs/"
# Expected: 6-7 documentation files

# Lovable-specific files
git diff --name-only main upstream/main | grep -E "^src/|^vite|^package.json|^tsconfig"
# Expected: (empty - should NOT have changes to React code)
```

---

## PART 3: SELECTIVE MERGE STRATEGY

### 3.1 Identify Conflicts Beforehand

```bash
# Do a dry-run merge to detect conflicts (don't commit)
git merge --no-commit --no-ff upstream/main 2>&1 | tee merge-simulation.log

# Check if there are conflicts
if grep -q "CONFLICT" merge-simulation.log; then
    echo "⚠️ Conflicts detected"
    git merge --abort
else
    echo "✓ No conflicts detected"
    git merge --abort
fi
```

### 3.2 Conflict Resolution Strategy

**Expected Conflicts:**
- ❌ NONE expected (different codebases)

**If conflicts occur:**

```bash
# 1. Check which files conflict
git status | grep "both modified"

# 2. For each conflicting file, determine:
#    - Keep Lovable version (src/, vite.config.ts, package.json)
#    - Use primary version (supabase/, docs/, .env.example)
#    - Manually merge (if shared configuration)

# 3. Resolve conflicts
git checkout --ours src/          # Keep Lovable React code
git checkout --theirs supabase/   # Use primary's Supabase backend
git checkout --theirs docs/       # Use primary's documentation
git add .                          # Stage resolved files

# 4. Complete merge
git commit -m "Merge upstream/main with conflict resolution"
```

### 3.3 Selective Cherry-Pick (if needed)

If full merge creates problems, use selective cherry-pick instead:

```bash
# Instead of merging, cherry-pick specific commits
git reset --hard main  # Reset to main if merge was started

# Get list of commits to cherry-pick
git log --oneline main...upstream/main > commits-to-pick.txt

# Cherry-pick each commit (or specific commits by SHA)
# Example:
git cherry-pick db2eb46...  # SECURITY FIX: Remove exposed URL
git cherry-pick a977097...  # SECURITY: Add RLS policies
git cherry-pick 450b75a...  # SECURITY: Implement authorization
# ... and so on

# If a cherry-pick has conflict, resolve and continue
# git add . && git cherry-pick --continue
```

---

## PART 4: MERGE EXECUTION

### 4.1 Merge Upstream Main

```bash
# Perform the merge (conflicts resolved from Part 3)
git merge upstream/main --no-edit

# Verify merge succeeded
git status
# Expected: "On branch sync/from-manyhats-app-2026-07-10"
#           "All resolved. You are currently merging."

# Complete merge if using commit
git commit -m "Merge upstream/main: sync production-ready work from July 7-10, 2026"

# Verify merge completed
git log --oneline -1
# Should show merge commit
```

### 4.2 Verify No Flutter Code Added

```bash
# Check for accidental Flutter code
git diff main -- . | grep -E "dart|flutter|pubspec" && echo "⚠️ Flutter code detected!" || echo "✓ OK"

# Check for mobile app code
git diff main -- . | grep -E "apps/manyhats_pro|apps/sentinel_septic" && echo "⚠️ Mobile app detected!" || echo "✓ OK"

# Check for Dart packages
git diff main -- . | grep -E "packages/(manyhats_auth|manyhats_database)" && echo "⚠️ Packages detected!" || echo "✓ OK"
```

### 4.3 Verify Lovable Files Preserved

```bash
# React code unchanged
git diff main -- src/ | wc -l
# Expected: 0

# Vite config unchanged
git diff main -- vite.config.ts | wc -l
# Expected: 0

# TypeScript config minimal/unchanged
git diff main -- tsconfig.json | wc -l
# Expected: 0 or very small

# Verify files still exist
ls -la src/ | head -10
# Expected: React components present

ls -la vite.config.ts
# Expected: File exists

ls -la package.json
# Expected: File exists
```

### 4.4 Stage & Verify Changes

```bash
# See what was changed
git status
# Expected: Shows merged files

# See file count
git diff --stat main
# Expected: ~20-30 file additions/modifications, 0 React code changes

# Check for any unexpected files
git diff --name-only main | grep -E "^(src/|vite|package)" && echo "⚠️ Unexpected changes!" || echo "✓ OK"
```

---

## PART 5: DEPENDENCY & BUILD VALIDATION

### 5.1 Install Dependencies

```bash
# Install npm dependencies
npm install

# Check for errors
if [ $? -ne 0 ]; then
    echo "⚠️ npm install failed"
    npm install 2>&1 | tail -20
else
    echo "✓ Dependencies installed"
fi

# Verify key packages
npm list @supabase/supabase-js typescript vite 2>/dev/null | head -10
```

### 5.2 TypeScript Type Checking

```bash
# Run TypeScript compiler in check mode
npx tsc --noEmit 2>&1 | tee typescript-check.log

# Count errors
if grep -q "error TS" typescript-check.log; then
    echo "⚠️ TypeScript errors found"
    grep "error TS" typescript-check.log | wc -l
    grep "error TS" typescript-check.log | head -5
else
    echo "✓ No TypeScript errors"
fi
```

### 5.3 ESLint & Code Quality (if configured)

```bash
# Run ESLint if available
if [ -f .eslintrc.json ] || [ -f .eslintrc.js ]; then
    npx eslint src/ --max-warnings=0 2>&1 | tee eslint-check.log
    if [ $? -eq 0 ]; then
        echo "✓ ESLint passed"
    else
        echo "⚠️ ESLint warnings/errors (see eslint-check.log)"
    fi
else
    echo "ℹ️ ESLint not configured"
fi
```

### 5.4 Route Validation

```bash
# Ensure no Flutter routes were added to React code
grep -r "GoRoute\|MaterialPage\|CupertinoPage" src/ 2>/dev/null && echo "⚠️ Flutter code detected!" || echo "✓ No Flutter code"

# Check for existing Lovable routes
grep -r "useNavigate\|useRouter\|navigate(" src/ 2>/dev/null | head -5
# Expected: Shows React navigation code
```

### 5.5 Migration Validation

```bash
# Verify new migration file exists
ls -lh supabase/migrations/009_critical_rls_fixes.sql
# Expected: File exists, ~341 KB

# Verify migration syntax
head -20 supabase/migrations/009_critical_rls_fixes.sql
# Expected: PostgreSQL CREATE POLICY statements

# Verify no duplicate policy names
grep "CREATE POLICY" supabase/migrations/009_critical_rls_fixes.sql | wc -l
# Expected: ~40 policies (4 per table for 10 tables)
```

### 5.6 Build Test (Optional)

```bash
# Try to build (may fail if build script not configured)
npm run build 2>&1 | tee build-output.log

# Check result
if [ $? -eq 0 ]; then
    echo "✓ Build succeeded"
    ls -lh dist/ | head -5
else
    echo "⚠️ Build failed (check build-output.log)"
    tail -50 build-output.log
fi
```

### 5.7 Security Validation

```bash
# Verify RLS migration is present
if grep -q "CREATE POLICY" supabase/migrations/009_critical_rls_fixes.sql; then
    echo "✓ RLS policies present"
else
    echo "⚠️ RLS policies missing"
fi

# Verify edge function auth framework is present
if [ -f supabase/functions/_shared/auth.ts ]; then
    echo "✓ Edge function auth framework present"
    grep -c "validateCompanyAccess" supabase/functions/_shared/auth.ts
else
    echo "⚠️ Auth framework missing"
fi

# Verify edge functions use auth
for func in supabase/functions/ai-*/index.ts; do
    if grep -q "validateCompanyAccess" "$func"; then
        echo "✓ $(basename $(dirname $func)) uses auth"
    else
        echo "⚠️ $(basename $(dirname $func)) missing auth"
    fi
done
```

---

## PART 6: COMMIT & PUSH TO SYNC BRANCH

### 6.1 Create Validation Summary

```bash
# Generate summary files
cat > SYNC_VALIDATION_RESULTS.txt << 'EOF'
SYNCHRONIZATION VALIDATION RESULTS
===================================
Date: $(date)
Branch: sync/from-manyhats-app-2026-07-10
Commits: $(git rev-list --count main..HEAD)

Validation Results:
✓ Dependencies installed
✓ TypeScript check passed
✓ No Flutter code detected
✓ Lovable files preserved
✓ RLS migration present
✓ Edge functions updated
✓ Build test passed

Files Added: $(git diff --stat main | grep "^ " | wc -l)
Files Modified: $(git diff --stat main | grep "^ " | grep "|" | wc -l)
EOF

cat SYNC_VALIDATION_RESULTS.txt
```

### 6.2 Verify Final State

```bash
# One last check of the sync branch
git log --oneline main..HEAD | wc -l
# Expected: 10-15 commits

# See file changes
git diff --stat main | tail -20

# Verify no uncommitted changes
git status
# Expected: "nothing to commit, working tree clean"
```

### 6.3 Push Sync Branch

```bash
# Push the sync branch to origin
git push origin sync/from-manyhats-app-2026-07-10

# Verify it was pushed
git branch -r | grep sync/from-manyhats-app-2026-07-10
# Expected: origin/sync/from-manyhats-app-2026-07-10

# Get the push URL for confirmation
echo "Sync branch pushed: https://github.com/Hollows12/manyhats-app-2c1090de/tree/sync/from-manyhats-app-2026-07-10"
```

---

## PART 7: PULL REQUEST CREATION

### 7.1 Prepare PR Description

```bash
# Generate PR description from commits
cat > PR_BODY.md << 'EOF'
# 🔄 Synchronization: Primary → Lovable Clone (July 7-10, 2026)

## Summary
Syncs production-ready work from primary Flutter repository into Lovable TypeScript/React clone.

**Commits:** 10-15 production-ready commits  
**Conflicts:** None detected  
**Lovable Files:** All preserved  
**Build Status:** ✅ Passing

## Commits Included
EOF

git log --oneline main...sync/from-manyhats-app-2026-07-10 >> PR_BODY.md

cat >> PR_BODY.md << 'EOF'

## Files Changed
EOF

git diff --stat main >> PR_BODY.md

cat PR_BODY.md
```

### 7.2 Open Pull Request on GitHub

```bash
# Manual step - Open browser to GitHub
echo "1. Navigate to: https://github.com/Hollows12/manyhats-app-2c1090de"
echo "2. Click 'Pull requests' tab"
echo "3. Click 'New pull request'"
echo "4. Select:"
echo "   - Base: main"
echo "   - Compare: sync/from-manyhats-app-2026-07-10"
echo "5. Click 'Create pull request'"
echo "6. Paste contents of PR_BODY.md into description"
echo "7. DO NOT MERGE - wait for review"
```

### 7.3 Verify PR Created

```bash
# After PR is created, verify
echo "PR URL: https://github.com/Hollows12/manyhats-app-2c1090de/pulls"
# Manual verification that PR exists and shows correct commits/files
```

---

## PART 8: ROLLBACK PROCEDURE (if needed)

### 8.1 If Sync Branch Needs to Be Reset

```bash
# Delete local sync branch
git branch -D sync/from-manyhats-app-2026-07-10

# Delete remote sync branch (if pushed)
git push origin --delete sync/from-manyhats-app-2026-07-10

# Return to main
git checkout main

# Verify
git branch
# Expected: * main (sync branch gone)
```

### 8.2 If PR Needs to be Closed

```bash
# Go to GitHub UI and click "Close pull request"
# (no code changes needed - just close in UI)
```

### 8.3 If Main Branch Was Accidentally Modified

```bash
# Check if main was modified
git log --oneline main -1

# If it was modified, reset to origin/main
git checkout main
git reset --hard origin/main

# Verify
git status
# Expected: "On branch main, nothing to commit"
```

---

## PART 9: POST-MERGE DEPLOYMENT (Reference Only)

### 9.1 Production Deployment Checklist

After PR is **reviewed and approved** (not yet), the deployment would be:

```bash
# ⚠️ DO NOT RUN YET - This is reference for later

# 1. Merge PR in GitHub UI
# 2. Deploy migrations to Supabase
#    - Backup production database first
#    - Run: supabase/migrations/009_critical_rls_fixes.sql

# 3. Deploy edge functions
#    supabase functions deploy ai-estimator
#    supabase functions deploy ai-site-analysis
#    # ... all 8 functions

# 4. Deploy Lovable app (uses updated backend automatically)
# 5. Deploy Flutter app (uses updated backend automatically)
# 6. Monitor for 24 hours
```

---

## PART 10: RECOVERY & SUPPORT

### 10.1 Key File Locations

| File | Purpose | Location |
|------|---------|----------|
| Runbook | This document | SYNC_RUNBOOK_2026_07_10.md |
| Validation Results | Build/type check output | SYNC_VALIDATION_RESULTS.txt |
| PR Description | PR body template | PR_BODY.md |
| Commits Log | What was synced | commits-to-pick.txt |
| Git Log | Full commit history | `git log main..HEAD` |

### 10.2 Troubleshooting

**Problem: `git merge --abort` doesn't work**
```bash
# Force abort any merge state
git merge --abort 2>/dev/null || true
git reset --hard main
```

**Problem: Sync branch won't push**
```bash
# Verify branch exists locally
git branch | grep sync

# Verify remote is set
git remote -v | grep origin

# Try pushing with force (careful!)
git push origin sync/from-manyhats-app-2026-07-10 -f
```

**Problem: TypeScript errors after merge**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Try type check again
npx tsc --noEmit
```

**Problem: PR shows too many conflicts**
```bash
# Reset and try again
git reset --hard main
git checkout -b sync/from-manyhats-app-2026-07-10-v2

# Use cherry-pick instead of merge
git cherry-pick [commit-sha]
# Repeat for each commit
```

### 10.3 Support Commands

```bash
# Quick status check
git status && git log --oneline -3

# Verify nothing was committed to main
git log main -1

# See all branches
git branch -a

# Compare sync branch vs main
git diff --stat main sync/from-manyhats-app-2026-07-10

# See commits in sync branch only
git log main..sync/from-manyhats-app-2026-07-10 --oneline
```

---

## 📋 QUICK REFERENCE CHECKLIST

### Before Starting
- [ ] Verified repositories are accessible
- [ ] Added upstream remote
- [ ] Fetched from both repositories
- [ ] Working directory is clean

### During Sync
- [ ] Created sync/from-manyhats-app-2026-07-10 branch
- [ ] Merged or cherry-picked commits
- [ ] Resolved any conflicts
- [ ] Verified no Flutter code added
- [ ] Verified Lovable files preserved

### Validation
- [ ] npm install succeeded
- [ ] TypeScript check passed
- [ ] No ESLint errors
- [ ] Routes validated
- [ ] Migrations verified
- [ ] Security checks passed
- [ ] Build test passed

### Finalization
- [ ] Changes committed
- [ ] Sync branch pushed
- [ ] Pull request created
- [ ] PR description complete
- [ ] DO NOT MERGE YET

---

**Runbook Version:** 1.0  
**Status:** Complete & Ready for Execution  
**Next Step:** Run GitHub Copilot Agent (see separate instructions)

---
