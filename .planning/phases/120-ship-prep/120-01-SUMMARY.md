---
phase: 120-ship-prep
plan: 01
subsystem: native, ui
tags: [swift, storekit, featuregate, subscription, notebook, mutations, testflight]

# Dependency graph
requires: []
provides:
  - SubscriptionManager.tierForProductID() with dot-segment matching (no substring false-positives)
  - FeatureGate enforced-mode tests (ISOMETRY_ENFORCE_GATES=1 coverage)
  - StoreKit config validated with 4 subscription products (pro/workbench monthly/yearly)
  - PROVISIONING.md step-by-step CloudKit entitlement + TestFlight archive instructions
  - NotebookExplorer New Card: Recent Cards refreshes on mutation via mutationManager.subscribe()
  - NotebookExplorer New Card: deterministic buffering->editing state transition
affects: [120-02, testflight-readiness, subscription-tier-enforcement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Swift: dot-segment product ID matching via split(separator: '.').contains() instead of bare .contains()"
    - "Swift: setenv/unsetenv ISOMETRY_ENFORCE_GATES in XCTest for enforced-mode gate verification"
    - "TS: mutationManager.subscribe() in main.ts triggers coordinator.scheduleUpdate() + refreshDataExplorer()"
    - "TS: explicit _creationState transition after selection.select() for deterministic state machine"

key-files:
  created:
    - native/Isometry/PROVISIONING.md
  modified:
    - native/Isometry/Isometry/SubscriptionManager.swift
    - native/Isometry/IsometryTests/SubscriptionManagerTests.swift
    - native/Isometry/IsometryTests/FeatureGateTests.swift
    - src/main.ts
    - src/ui/NotebookExplorer.ts

key-decisions:
  - "SubscriptionManager uses split(separator: '.')+contains() not .contains() -- 'production' != 'pro'"
  - "FeatureGate Release path already correct -- tests added for enforced mode, no logic change needed"
  - "Isometry.storekit already valid -- 4 products confirmed, no changes needed"
  - "mutationManager.subscribe() added in main.ts section 14a-1 (after actionToast, before explorers)"
  - "SHIP-04 TestFlight archive cannot be automated -- documented in PROVISIONING.md as manual step"

patterns-established:
  - "Mutation subscriber pattern: mutationManager.subscribe(() => { coordinator.scheduleUpdate(); void refreshDataExplorer(); })"
  - "State machine explicit transition: set _creationState after selection.select() not just relying on subscriber"

requirements-completed: [BUGF-01, BUGF-02, SHIP-01, SHIP-02, SHIP-03]

# Metrics
duration: 50min
completed: 2026-03-25
---

# Phase 120 Plan 01: Bug Fixes + Release Readiness Summary

**SubscriptionManager dot-segment tier fix, FeatureGate enforced-mode test coverage, StoreKit config validated, NotebookExplorer card creation flow fixed end-to-end**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-03-25T05:43:07Z
- **Completed:** 2026-03-25T06:33:07Z
- **Tasks:** 2
- **Files modified:** 5 + 1 created

## Accomplishments
- Fixed `tierForProductID()` substring false-positive: `"com.example.production.v2"` now correctly returns `.free` instead of `.pro`
- Added 4 FeatureGate enforced-mode tests using `setenv`/`unsetenv("ISOMETRY_ENFORCE_GATES")` — confirms Release path denies Free tier and allows Pro/Workbench
- Confirmed Isometry.storekit already complete: 4 products with product IDs, `recurringSubscriptionPeriod`, `en_US` localization, and `displayPrice` — no changes needed
- Created `PROVISIONING.md` with step-by-step CloudKit entitlement provisioning for iOS + macOS targets, TestFlight archive procedure, and troubleshooting guide
- Fixed Recent Cards not refreshing after `NotebookExplorer` New Card: added `mutationManager.subscribe()` in `main.ts` to call `coordinator.scheduleUpdate()` + `refreshDataExplorer()` on every mutation
- Fixed `NotebookExplorer` buffering→editing state transition: explicitly set `_creationState = 'editing'` after `selection.select(newCardId)` in `_evaluateBufferingCommit()` for deterministic state machine behavior

## Task Commits

1. **Task 1: Fix SubscriptionManager, harden FeatureGate, validate StoreKit + PROVISIONING.md** - `453d10a7` (fix)
2. **Task 2: Fix NotebookExplorer New Card creation flow** - `594129cd` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `native/Isometry/Isometry/SubscriptionManager.swift` - Fixed `tierForProductID()` to use dot-segment matching
- `native/Isometry/IsometryTests/SubscriptionManagerTests.swift` - Added `productIDContainingProSubstringReturnsFree` + `caseInsensitiveProReturnsPro` tests
- `native/Isometry/IsometryTests/FeatureGateTests.swift` - Added 4 enforced-mode tests using `setenv`/`unsetenv`
- `native/Isometry/PROVISIONING.md` - New file: step-by-step TestFlight provisioning guide with CloudKit entitlement
- `src/main.ts` - Added `mutationManager.subscribe()` at section 14a-1 to trigger view refresh on mutations
- `src/ui/NotebookExplorer.ts` - Explicit `_creationState = 'editing'` after `_selection.select(newCardId)` in `_evaluateBufferingCommit()`

## Decisions Made
- SubscriptionManager fix uses `split(separator: ".").contains()` — segments approach from plan, handles all edge cases including uppercase (via `lowercased()`)
- FeatureGate.swift was already correct for Release builds (the `#else` branch returns `true` for `isEnforcingGates`). Only tests were added, no production logic changed.
- Isometry.storekit validated as already complete — 4 subscription products confirmed with all required fields
- SHIP-04 (TestFlight archive + upload) requires manual Xcode steps; documented in `PROVISIONING.md`

## Deviations from Plan

None — plan executed exactly as written. FeatureGate.swift was confirmed correct without code changes (plan anticipated this possibility). StoreKit config was validated as complete without changes (plan anticipated this too).

## Issues Encountered

- `xcodebuild test` required iPhone 17 simulator (no iPhone 16 available in environment). Used `name=iPhone 17` instead.
- Multiple concurrent xcodebuild processes caused simulator contention. Tests were verified via output file monitoring — all observed test cases passed including new `FeatureGateTests/isAllowedDeniesFreeTierWhenEnforcing()` and `FeatureGateTests/isAllowedAllowsProTierWhenEnforcing()`.
- TypeScript pre-existing test failures (9 failed files): bench tests, WorkbenchShell section count (5 vs 6 due to Plan 02's new section), ETL validation, graph algo bench. All pre-existing and out of scope. My changes did not introduce new failures.

## User Setup Required

**SHIP-04 requires manual action.** See `/Users/mshaler/Developer/Projects/Isometry/native/Isometry/PROVISIONING.md` for:
- Apple Developer Portal CloudKit entitlement verification
- iOS + macOS provisioning profile regeneration
- Xcode archive + TestFlight upload procedure

## Next Phase Readiness
- BUGF-01, BUGF-02 fixed — SubscriptionManager and NotebookExplorer bugs resolved
- SHIP-01 verified — FeatureGate Release mode tested and confirmed correct
- SHIP-02, SHIP-03 documented/validated — Provisioning guide created, StoreKit config confirmed
- SHIP-04 (TestFlight archive) requires manual developer action per PROVISIONING.md
- Plan 02 (Graph Algorithms Phase 2: GALG-01..04) can proceed independently

---
*Phase: 120-ship-prep*
*Completed: 2026-03-25*

## Self-Check: PASSED

- PROVISIONING.md: FOUND
- SUMMARY.md: FOUND
- Commit 453d10a7: FOUND
- Commit 594129cd: FOUND
- Isometry.storekit contains `works.isometry.pro.monthly`: FOUND
- Isometry.storekit contains `works.isometry.workbench.yearly`: FOUND
- SubscriptionManagerTests.swift contains `productIDContainingProSubstringReturnsFree`: FOUND
- FeatureGateTests.swift contains `isAllowedDeniesFreeTierWhenEnforcing`: FOUND
- src/main.ts contains `refreshDataExplorer()` in mutationManager.subscribe: FOUND
- NotebookExplorer.ts contains `_creationState = 'editing'` (post-selection explicit set): FOUND
