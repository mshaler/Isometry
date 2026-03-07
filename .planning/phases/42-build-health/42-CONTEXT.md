# Phase 42: Build Health - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the build pipeline trustworthy: zero TS errors, zero test failures, automated linting with Biome, working native Xcode build with correct provisioning, and CI that prevents regressions. This is the foundation phase for v4.2 — all subsequent phases depend on it.

</domain>

<decisions>
## Implementation Decisions

### Linting setup
- Biome handles both linting AND formatting (replaces ESLint + Prettier in one tool)
- Use Biome's "recommended" rules preset — catches real bugs without being noisy
- Formatting: tabs, 120-character line width
- CI reports lint/format errors only — developer runs `biome check --write` locally to fix
- No auto-fix commits in CI

### CI pipeline design
- Trigger: every push to any branch
- Scope: web only (tsc + biome check + vitest) — no Xcode builds in CI
- Required check: block merge on failure (branch protection on main)
- Jobs run in parallel: typecheck, lint, and test as separate concurrent jobs with fail-fast

### TS error strategy
- Fix all 164 errors inline across all 9 test files — no exclusions, no suppressions
- Update the 4 SuperGridSizer test expected values from 160px to 80px (correct post-v3.1 depth change)
- Keep current tsconfig strictness flags as-is (already very strict: strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, noPropertyAccessFromIndexSignature)
- Update `make ci` target to include biome check (typecheck + lint + vitest)

### Native build scope
- Fix the npm Run Script build phase path in Xcode project (essential for one-click builds)
- Regenerate provisioning profile with CloudKit + iCloud entitlements (BUILD-04)
- Zero Xcode warnings required — `make check` must pass clean (maintain the 32-warning cleanup from v4.1)
- Add `make lint` (biome check) and `make fix` (biome check --write) Makefile targets

### Claude's Discretion
- Biome config file structure and specific rule overrides if needed
- GitHub Actions workflow file structure and caching strategy
- Order of TS error fixes across the 9 test files
- Exact npm Run Script path fix in Xcode build phase

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Makefile`: Already has build automation with `make ci` (typecheck + vitest + xcode build), `make check` (zero-warning build), platform targets
- `tsconfig.json`: Already strict mode with aggressive flags — just needs test file errors fixed
- npm scripts: `typecheck`, `test`, `dev`, `build:native` already defined in package.json

### Established Patterns
- Makefile is the build automation interface — all new targets follow existing conventions
- `make check` pattern: build + filter warnings/errors + report result — extend to web checks
- Xcode project at `native/Isometry/Isometry.xcodeproj` with schemes for macOS and iOS

### Integration Points
- `make ci` target needs biome check added between typecheck and vitest
- GitHub Actions workflow will mirror `make ci` but with parallel jobs
- Xcode Run Script phase needs correct path to project root package.json
- Branch protection rule on `main` branch after CI workflow is in place

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for build tooling.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 42-build-health*
*Context gathered: 2026-03-07*
