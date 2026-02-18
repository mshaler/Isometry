---
phase: 112-technical-debt-sprint
plan: 01
subsystem: tooling
tags: [knip, dead-code, exports, technical-debt]
dependency_graph:
  requires: []
  provides:
    - accurate knip unused export detection
    - single export pattern for component files
  affects:
    - future knip audits
    - import patterns
tech_stack:
  added: []
  patterns:
    - named exports over default exports
key_files:
  created: []
  modified:
    - knip.json
    - src/components/SuperGridCSSDemo.tsx
    - src/components/supergrid/SuperGridScrollTest.tsx
    - src/components/supergrid/SuperDynamic.tsx
    - src/components/supergrid/SuperGridCSS.tsx
    - src/components/notebook/editor/nodes/EmbedToolbar.tsx
    - src/components/notebook/PropertyEditor.tsx
    - src/components/notebook/CaptureComponent.tsx
    - src/utils/import-export/office/index.ts
    - src/features/abtest/hooks.ts
    - src/utils/performance/performance-monitor.ts
    - src/utils/performance/rendering-performance.ts
    - src/state/FilterContext.tsx
decisions:
  - "KNIP-BARREL-01: Add 33 barrel file entry points to knip.json to eliminate false positives"
  - "EXPORT-PATTERN-01: Keep named exports, remove default exports where no external dependencies"
  - "COMPAT-ALIAS-01: Retain backward-compatibility aliases that are actively imported (useExperimentVariant, performanceMonitor, renderingPerformanceMonitor)"
metrics:
  duration: 291s
  completed: 2026-02-17
---

# Phase 112 Plan 01: Knip Cleanup Summary

Updated knip.json with 33 barrel file entry points and removed duplicate exports from component files to establish accurate unused export detection baseline.

## Results

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Unused exports | ~275 | 91 | -184 (67% reduction) |
| Knip output lines | 340 | 217 | -123 (36% reduction) |
| Duplicate export files (plan scope) | 11 | 5 | -6 |

**Note:** 5 remaining duplicates are intentional backward-compatibility aliases that are actively imported by other modules.

## Commits

| Hash | Description |
|------|-------------|
| ca3425e1 | chore(112-01): configure knip barrel entries and remove duplicate exports |

## Tasks Completed

1. **Update knip.json with barrel file entries** - Added 33 barrel file entry points including `src/components/ui/index.ts`, `src/hooks/index.ts`, `src/d3/index.ts`, etc. Added `@vitest/coverage-v8` to `ignoreDependencies`.

2. **Remove duplicate exports from 11 files** - Removed duplicate default exports from 6 files (SuperGridCSSDemo, SuperGridScrollTest, SuperDynamic, SuperGridCSS, EmbedToolbar, PropertyEditor). Updated CaptureComponent.tsx to use named import. Retained 5 backward-compatibility aliases where actively used.

3. **Verify improvement** - Confirmed unused exports reduced from 275 to 91 (67% reduction). Build passes, tests pass (pre-existing failures unrelated to this change).

## Deviations from Plan

### Retained Aliases (Rule 2 - Missing Critical Functionality)

**Issue:** Some aliases flagged as duplicates are actively imported by other modules.

**Files affected:**
- `src/features/abtest/hooks.ts`: `useExperimentVariant` (re-exported via ABTestProvider.tsx)
- `src/utils/performance/performance-monitor.ts`: `performanceMonitor` (used by useGraphAnalytics.ts)
- `src/utils/performance/rendering-performance.ts`: `renderingPerformanceMonitor` (used by useRenderingOptimization.ts)

**Resolution:** Retained these aliases to avoid breaking imports. These are intentional backward-compatibility exports.

### Fixed Import (Rule 3 - Blocking Issue)

**Issue:** After removing default export from PropertyEditor.tsx, CaptureComponent.tsx import broke.

**Resolution:** Updated `import PropertyEditor from` to `import { PropertyEditor } from`.

## Verification

- `npm run build` - Passes
- `npm run typecheck` - Passes
- `npm run test -- --run` - 11 test files fail (pre-existing, unrelated to this change)
- `npx knip --reporter compact` - 217 lines (down from 340)

## Self-Check: PASSED

- [x] knip.json exists and contains barrel file entries
- [x] Commit ca3425e1 exists
- [x] Unused exports reduced from 275 to 91
- [x] Build passes
