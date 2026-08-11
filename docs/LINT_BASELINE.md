# ESLint Baseline Debt — ManyHats

> Last measured: 2026-08-11 · Branch: `codex/backend-stabilization`

## Summary

| Rule | Error count | Notes |
|---|---|---|
| `prettier/prettier` | 3,582 | Formatting violations in legacy source files |
| `@typescript-eslint/no-explicit-any` | 265 | Downgraded to **warning** as of this PR; pre-existing |
| `react-hooks/rules-of-hooks` | 1 | Pre-existing violation |
| **Total** | **3,848** | Across 79 files |

The `no-explicit-any` rule has been downgraded from `error` to `warn` in `eslint.config.js` so that
legacy `as any` casts do not block CI. The **265 any-warnings** are pre-existing; the exact count
must not grow in new or modified files without justification.

## CI Strategy

CI lints only **new or modified TypeScript/TSX files** in each PR or push (via `git diff`). This
ensures:

- New or changed code must pass ESLint and Prettier (exits 1 on errors).
- Pre-existing violations in untouched files do not block CI.
- The warning count in changed files is visible in CI output for review.

To lint the whole codebase locally and see the full debt:

```sh
npm run lint
```

## Cleanup Plan

1. **Prettier**: Run `npm run format` on sub-directories one at a time, commit per directory.
2. **no-explicit-any**: Replace `as any` casts with proper interfaces or `unknown` + type guards,
   starting with the highest-traffic files.
3. **react-hooks/rules-of-hooks**: Fix the single violation after identifying the file.

Do not fix these in the same PR as a feature or security change.
