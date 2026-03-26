---
phase: 124-selective-import-partitioning
plan: "02"
subsystem: ui
tags: [swift, typescript, etl, native-bridge, cloudkit, import, alto-index]

# Dependency graph
requires:
  - phase: 124-01
    provides: runAltoImport Swift pipeline, sendChunk sourceType field, native:request-alto-import bridge message
  - phase: 123-directory-discovery
    provides: DirectoryDiscoverySheet base class, AltoDiscoveryPayload type, alto-discovery CustomEvent

provides:
  - DirectoryDiscoverySheet import state machine (idle -> selecting -> importing -> complete)
  - Select All / Deselect All toggle button with bidirectional state sync
  - Per-directory progress rows with accessible status indicators (spinner, checkmark, error)
  - Progress bar tracking completed directories with CSS transition
  - native:alto-import-progress bridge handler in NativeBridge.ts
  - native:request-alto-import trigger in main.ts with coordinator.refresh on all-complete
  - Per-directory catalog entries (alto_index_notes, alto_index_contacts, etc.) via getSourceName()
  - BridgeManager.swift webView wiring fix before runAltoImport
  - DedupEngine source normalisation (alto_index_* -> alto_index) for UNIQUE constraint correctness

affects:
  - phase: 125-dataset-lifecycle-management
  - alto-index re-import flows
  - CloudKit sync (cards sourced with per-directory sourceType stored in catalog)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Import state machine pattern in DirectoryDiscoverySheet (state property + updateProgress method)
    - dedupSource normalisation for compound source namespace (alto_index_* -> alto_index for dedup, full name for catalog)
    - importCoordinator.webView wiring at call site (not at construction) for late-bound WKWebView

key-files:
  created: []
  modified:
    - src/ui/DirectoryDiscoverySheet.ts
    - src/styles/directory-discovery.css
    - src/native/NativeBridge.ts
    - src/main.ts
    - src/worker/handlers/etl-import-native.handler.ts
    - native/Isometry/Isometry/BridgeManager.swift

key-decisions:
  - "dedupSource mapping: alto_index_* source types normalise to alto_index for DedupEngine lookup because cards are stored with source=alto_index regardless of which subdirectory they came from"
  - "webView wiring at call site: importCoordinator.webView must be set inside the native:request-alto-import handler branch (not in runNativeImport path), so the fix is a single assignment before runAltoImport"
  - "Escape key ignored during importing state (per UI-SPEC accessibility contract)"
  - "Close button available during import (labeled Close (import in progress)) to prevent UI lockout"

patterns-established:
  - "State machine in UI sheet: _state enum drives DOM mutations via updateProgress(), avoiding full re-render"
  - "dedupSource derivation pattern: normalise compound source namespace for dedup, preserve full sourceType for catalog"

requirements-completed: [IMPT-01, IMPT-02, IMPT-03, IMPT-04, BEXL-01, BEXL-02]

# Metrics
duration: ~11.5h (plan start to verification complete including Xcode build + end-to-end test)
completed: 2026-03-26
---

# Phase 124 Plan 02: Selective Import State Machine + Bridge Wiring Summary

**SelectAll/DeselectAll toggle + per-directory import progress (spinner -> checkmark -> card count) wired through native:alto-import-progress bridge, with two production bugs fixed during verification (webView nil, dedup source mismatch), yielding a verified 21,082-card import from zero.**

## Performance

- **Duration:** ~11.5h (including Xcode build cycle and end-to-end verification)
- **Started:** 2026-03-26T04:57:14Z
- **Completed:** 2026-03-26T16:30:00Z
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 8

## Accomplishments

- DirectoryDiscoverySheet upgraded with full 4-state machine (idle/selecting/importing/complete): select-all toggle, per-directory progress rows with ARIA roles, 4px progress bar with CSS transition, Import Complete total card count display
- NativeBridge.ts wired for native:alto-import-progress messages dispatching as CustomEvent; main.ts sends native:request-alto-import with selected directories and calls coordinator.refresh() on all-complete
- etl-import-native.handler.ts routes per-directory sourceTypes (alto_index_notes, etc.) to individual catalog entries via getSourceName() while normalising dedup lookups to alto_index
- Two production bugs discovered and fixed during end-to-end verification: nil webView in BridgeManager and UNIQUE constraint violations from dedup source mismatch

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade DirectoryDiscoverySheet with import state machine + CSS** - `e05bfd26` (feat)
2. **Task 2: Bug fix — webView nil + dedup source mismatch** - `86d1b50c` (fix)
3. **Task 2: Verification artifacts — Xcode bump + fixture refresh** - `d37fb5bb` (chore)

**Plan metadata:** (docs commit — created after this summary)

## Files Created/Modified

- `src/ui/DirectoryDiscoverySheet.ts` - Import state machine, Select All toggle, updateProgress(), complete state
- `src/styles/directory-discovery.css` - .disc-import-progress-bar, .disc-import-row variants, .disc-import-spinner, prefers-reduced-motion fallback
- `src/native/NativeBridge.ts` - native:alto-import-progress case dispatching alto-import-progress CustomEvent
- `src/main.ts` - native:request-alto-import sender, alto-import-progress listener, coordinator.refresh
- `src/worker/handlers/etl-import-native.handler.ts` - getSourceName() helper, dedupSource normalisation
- `native/Isometry/Isometry/BridgeManager.swift` - webView wiring before runAltoImport

## Decisions Made

- **dedupSource normalisation:** alto_index_* source types are mapped back to alto_index for DedupEngine because cards carry source=alto_index in the database regardless of which subdirectory they came from. Full sourceType (alto_index_notes etc.) is preserved only for catalog entries.
- **webView wired at call site:** The fix adds `self?.importCoordinator?.webView = self?.webView` inside the native:request-alto-import branch, immediately before runAltoImport. This matches the pattern used by runNativeImport and does not require refactoring ImportCoordinator initialisation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] BridgeManager: importCoordinator.webView nil during runAltoImport**
- **Found during:** Task 2 (end-to-end verification)
- **Issue:** importCoordinator.webView was only wired in the runNativeImport code path. The new native:request-alto-import handler called runAltoImport without setting webView, causing a nil webView crash/silent failure during chunk sending.
- **Fix:** Added `self?.importCoordinator?.webView = self?.webView` before the runAltoImport call in the native:request-alto-import handler branch.
- **Files modified:** native/Isometry/Isometry/BridgeManager.swift
- **Verification:** 21,082 cards imported successfully from zero after database purge
- **Committed in:** 86d1b50c

**2. [Rule 1 - Bug] etl-import-native.handler.ts: dedup source mismatch causing UNIQUE violations**
- **Found during:** Task 2 (end-to-end verification)
- **Issue:** DedupEngine queried `WHERE source = 'alto_index_notes'` (per-directory sourceType) but existing cards have `source = 'alto_index'`. The dedup lookup found no existing cards, so every card was treated as a new insert, causing UNIQUE constraint violations on re-import.
- **Fix:** Derived `dedupSource` that maps `alto_index_*` back to `alto_index` before passing to DedupEngine.process(). The full sourceType is still passed to CatalogWriter for per-directory catalog entries.
- **Files modified:** src/worker/handlers/etl-import-native.handler.ts
- **Verification:** Clean import of 21,082 cards with no UNIQUE violations
- **Committed in:** 86d1b50c

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs)
**Impact on plan:** Both fixes were necessary for correctness — the feature was non-functional without them. No scope creep.

## Issues Encountered

- Xcode project file bumped to LastUpgradeCheck 2640 during build (automatic, no action required)
- WebBundle/index.html not tracked by git (.gitignore) — asset hash update is reflected in the running app but not committed

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 125 (Dataset Lifecycle Management) can proceed: per-directory catalog entries are now created with distinct sourceType keys (alto_index_notes, alto_index_contacts, etc.)
- DSET-04 (diff preview) will need the dedupSource normalisation pattern from this plan — dedup compares against alto_index, not per-directory keys
- The 21,082-card verified import confirms the full selective import pipeline is production-ready

---
*Phase: 124-selective-import-partitioning*
*Completed: 2026-03-26*
