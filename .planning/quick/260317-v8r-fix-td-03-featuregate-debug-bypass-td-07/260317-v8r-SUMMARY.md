---
phase: quick
plan: 260317-v8r
subsystem: native-shell, testing
tags: [tech-debt, feature-gate, xctest, vitest, playwright, documentation]
dependency_graph:
  requires: []
  provides: [TD-03-fix, TD-07-fix, featuregate-tests, subscriptionmanager-tests, migration-edge-tests, histogram-brush-e2e]
  affects: [native/Isometry/Isometry/FeatureGate.swift, .planning/codebase/CONCERNS.md]
tech_stack:
  added: []
  patterns: [ISOMETRY_ENFORCE_GATES env var override]
key_files:
  created:
    - native/Isometry/IsometryTests/FeatureGateTests.swift
    - native/Isometry/IsometryTests/SubscriptionManagerTests.swift
    - tests/providers/StateManager.migration.test.ts
    - e2e/histogram-brush.spec.ts
    - .planning/milestones/v4.0-phases/34-reminders-calendar/34-SUMMARY.md
    - .planning/milestones/v4.0-phases/35-notes-title-metadata/35-SUMMARY.md
  modified:
    - native/Isometry/Isometry/FeatureGate.swift
    - .planning/codebase/CONCERNS.md
decisions:
  - "ISOMETRY_ENFORCE_GATES=1 env var to enforce tier gates in DEBUG builds (default unchanged: all features unlocked)"
metrics:
  duration: 226s
  completed: "2026-03-18T02:37:11Z"
  tasks: 5/5
  files_created: 6
  files_modified: 2
---

# Quick Task 260317-v8r: Fix TD-03 FeatureGate DEBUG Bypass + TD-07 Missing SUMMARYs

ISOMETRY_ENFORCE_GATES env var override for tier gate testing in DEBUG builds, 4 new test files (Swift XCTests, Vitest migration edge cases, Playwright E2E), 2 retroactive SUMMARY.md placeholders.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Fix TD-03: FeatureGate debug-toggleable bypass | 9a87b78a | FeatureGate.swift |
| 2 | Add FeatureGate + SubscriptionManager XCTests | 15cb31ce | FeatureGateTests.swift, SubscriptionManagerTests.swift |
| 3 | Add StateManager migration edge case tests | c2ee4c70 | StateManager.migration.test.ts |
| 4 | Add HistogramScrubber brush E2E Playwright spec | 505a831f | histogram-brush.spec.ts |
| 5 | Create TD-07 placeholder SUMMARY.md files | ebd1c633 | 34-SUMMARY.md, 35-SUMMARY.md, CONCERNS.md |

## What Changed

### TD-03 Fix: FeatureGate DEBUG Bypass
Replaced the unconditional `#if DEBUG return true` with an env var check. Default behavior unchanged (all features unlocked in DEBUG). Set `ISOMETRY_ENFORCE_GATES=1` in Xcode scheme environment variables to enforce tier gating during development/testing. Added `isEnforcingGates` static computed property for test introspection.

### New Test Coverage

**FeatureGateTests.swift (9 tests):** requiredTier mapping for all features, tier comparison logic (pro/free/workbench vs pro requirement), allCases completeness check, DEBUG bypass verification, isEnforcingGates property.

**SubscriptionManagerTests.swift (12 tests):** tierForProductID mapping for all 4 product IDs plus unknown and empty string, Tier Comparable ordering (4 assertions), productIDs count and exact set membership.

**StateManager.migration.test.ts (11 tests):** Empty filters array preservation, invalid field pruning from filters/axisFilters/rangeFilters, mixed valid/invalid entries, PAFV axis nulling for invalid fields, colAxes/rowAxes filtering, colWidths/sortOverrides pass-through, null axis value preservation, unwired SchemaProvider pass-through, non-filter/non-pafv key pass-through.

**histogram-brush.spec.ts (3 tests):** Histogram SVG render with bar elements and brush group, range filter apply/clear cycle, histogram bar CSS class verification.

### TD-07 Fix: Missing SUMMARY.md Files
Created retroactive placeholder SUMMARY.md files for phases 34 and 35, documenting that these phases were executed in parallel during v4.0 and explaining the missing artifact.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- [x] FeatureGate.swift compiles with ISOMETRY_ENFORCE_GATES logic
- [x] 11/11 StateManager migration edge case Vitest tests pass
- [x] Playwright E2E spec created (3 test scenarios)
- [x] Phase 34+35 SUMMARY.md files exist
- [x] CONCERNS.md updated: TD-03 resolved, TD-07 resolved, test coverage gaps updated
