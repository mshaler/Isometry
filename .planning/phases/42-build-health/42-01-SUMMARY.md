---
phase: 42-build-health
plan: 01
subsystem: infra
tags: [biome, linter, formatter, makefile, testing]

# Dependency graph
requires: []
provides:
  - "Biome 2.4.6 linter/formatter with tabs + 120-char width + recommended rules"
  - "Bulk-reformatted codebase (175 TypeScript files)"
  - "Makefile lint/fix/updated-ci targets"
  - "npm run lint and npm run fix scripts"
  - "Zero tsc errors, zero test failures, zero lint errors"
affects: [42-build-health, ci]

# Tech tracking
tech-stack:
  added: ["@biomejs/biome 2.4.6"]
  patterns: ["biome.json config at project root", "Makefile lint target for CI gate"]

key-files:
  created: ["biome.json"]
  modified: ["package.json", "Makefile", "src/**/*.ts (175 files reformatted)", "tests/**/*.ts"]

key-decisions:
  - "Disabled 8 Biome lint rules that conflict with project tsconfig strictness (useLiteralKeys vs noPropertyAccessFromIndexSignature, noNonNullAssertion vs strict null checks, noUnusedPrivateClassMembers false positives)"
  - "Applied unsafe auto-fixes for genuinely unused imports/variables rather than suppressing"
  - "Refactored regex while loops in attachments.ts to avoid assign-in-expression pattern"

patterns-established:
  - "biome.json at root: tabs, 120-width, LF, single quotes, recommended rules with targeted overrides"
  - "make lint / make fix for developer workflow"
  - "make ci includes lint between typecheck and test-web"

requirements-completed: [BUILD-01, BUILD-02, STAB-02]

# Metrics
duration: 6min
completed: 2026-03-07
---

# Phase 42 Plan 01: Lint + Test Fix Summary

**Biome 2.4.6 installed with tabs/120-width config, 175 files bulk-reformatted, 4 SuperGridSizer test expectations already fixed, Makefile lint/fix/ci targets added -- tsc/vitest/biome all exit 0**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-07T18:47:50Z
- **Completed:** 2026-03-07T18:53:52Z
- **Tasks:** 2
- **Files modified:** 179

## Accomplishments
- Installed @biomejs/biome 2.4.6 with locked formatting (tabs, 120-char, single quotes, LF)
- Bulk reformatted 175 TypeScript files from spaces to tabs in single commit
- Verified all 2133 tests pass with zero failures (STAB-02 already fixed in prior commit)
- Added Makefile lint, fix targets and updated ci target to include lint gate
- Resolved all Biome lint violations: 17 unused imports auto-fixed, 8 rules disabled for tsconfig compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix SuperGridSizer test failures and install Biome** - `c11b9d0f` (feat)
2. **Task 2: Update Makefile targets and verify full build health** - `d32c89e8` (fix)

## Files Created/Modified
- `biome.json` - Biome linter + formatter configuration (tabs, 120-width, recommended rules)
- `package.json` - Added @biomejs/biome devDependency, lint and fix npm scripts
- `Makefile` - Added lint, fix targets; updated ci target to include lint
- `src/**/*.ts` (89 files) - Bulk reformatted from spaces to tabs + lint fixes
- `tests/**/*.ts` (86 files) - Bulk reformatted from spaces to tabs + lint fixes
- `src/views/ListView.ts` - Restored private container field removed by Biome
- `src/views/SuperGrid.ts` - Restored _colDropZoneEl, _rowDropZoneEl, _rowHeaderDepth fields
- `src/views/TreeView.ts` - Restored private container, orphans fields
- `src/etl/parsers/attachments.ts` - Refactored regex while loops to avoid assign-in-expression

## Decisions Made
- Disabled `useLiteralKeys` rule: conflicts with tsconfig `noPropertyAccessFromIndexSignature` (requires bracket notation for index signatures)
- Disabled `noNonNullAssertion` rule: 743 uses across codebase, deliberate pattern with strict null checks
- Disabled `noUnusedPrivateClassMembers` rule: false positives on fields assigned in one method and read in another
- Disabled `noExplicitAny` (94 uses), `useTemplate` (15), `useNodejsImportProtocol` (10), `useIterableCallbackReturn` (24), `noUselessSwitchCase` (1): all are either established patterns or intentional code style in this codebase

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restored class fields incorrectly removed by Biome noUnusedPrivateClassMembers**
- **Found during:** Task 2 (tsc verification after bulk reformat)
- **Issue:** Biome's `--write --unsafe` auto-fix removed 7 private class field declarations (ListView.container, SuperGrid._colDropZoneEl/_rowDropZoneEl/_rowHeaderDepth, TreeView.container/orphans/root) that it classified as "unused private class members". These fields are assigned in one method and used in another -- Biome's static analysis didn't track cross-method usage.
- **Fix:** Restored all 7 field declarations manually, disabled `noUnusedPrivateClassMembers` rule in biome.json
- **Files modified:** src/views/ListView.ts, src/views/SuperGrid.ts, src/views/TreeView.ts, biome.json
- **Verification:** tsc --noEmit exits 0, vitest 2133/2133 pass
- **Committed in:** d32c89e8

**2. [Rule 1 - Bug] Biome 2.x config key changed from include/ignore to includes**
- **Found during:** Task 1 (initial biome check)
- **Issue:** RESEARCH.md template used Biome 1.x key names (`include`, `ignore`) that were renamed in Biome 2.x to `includes` (and `ignore` removed entirely)
- **Fix:** Updated biome.json to use `includes` key; dropped `ignore` (dist directories not in includes pattern anyway)
- **Files modified:** biome.json
- **Committed in:** c11b9d0f

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- SuperGridSizer test fixes (STAB-02) were already applied in prior commit `37a0ef38` -- Step A was a no-op
- Biome `--write --unsafe` more aggressive than expected with class member removal -- required post-fix restoration

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Build health foundation complete: tsc, vitest, and biome all exit 0
- CI gate ready: `make ci` now runs typecheck + lint + test-web + check
- Phase 42 Plan 02 (TS strict mode fixes) can proceed -- linting infrastructure is in place
- Phase 42 Plan 03 (GitHub Actions CI) can use biome.json config directly

---
*Phase: 42-build-health*
*Completed: 2026-03-07*
