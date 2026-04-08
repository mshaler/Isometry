---
phase: 135-uat
plan: 01
subsystem: etl, ui
tags: [ViewDefaultsRegistry, PAFVProvider, auto-switch, recommendation-badges, ExcelParser, base64]

requires:
  - phase: 134-guided-tour
    provides: "Complete v10.0 feature set ready for UAT"
provides:
  - "All 20 dataset types verified against functional bar"
  - "Excel import base64 decode fix for native macOS path"
  - "Double undo/redo prevention in native macOS app"
affects: [v10.0-release]

tech-stack:
  added: []
  patterns: [base64-to-ArrayBuffer-decode, native-shortcut-dedup]

key-files:
  created:
    - ".planning/phases/135-uat/135-01-UAT-LOG.md"
  modified:
    - "src/etl/ImportOrchestrator.ts"
    - "src/main.ts"

key-decisions:
  - "Excel import in native path needs base64→ArrayBuffer decode (Swift evaluateJavaScript cannot pass ArrayBuffer)"
  - "Cmd+Z/Cmd+Shift+Z in native mode handled only by Swift menu bar (not JS ShortcutRegistry) to prevent double-undo"

patterns-established:
  - "Native binary data: base64-encode in Swift, atob+Uint8Array decode in JS before passing to parsers"
  - "Native shortcut guard: isNative flag gates JS shortcut registration when Swift menu bar handles the same binding"

requirements-completed: [UATX-01]

duration: 45min
completed: 2026-03-31
---

# Phase 135 Plan 01: Default View UAT Summary

**All 20 dataset types verified — auto-switch, axis defaults, recommendation badges correct. Two critical native-app bugs fixed: Excel base64 import and double-undo.**

## Performance

- **Duration:** ~45 min (including user spot-check and two bug fix cycles)
- **Tasks:** 2
- **Files modified:** 2 (src/etl/ImportOrchestrator.ts, src/main.ts)

## Accomplishments
- UAT log documents all 20 dataset types passing the functional bar (auto-switch, axes, badges, no empty grids)
- Fixed Excel import in native macOS app: base64 string from Swift bridge now decoded to ArrayBuffer before ExcelParser
- Fixed double undo/redo: ShortcutRegistry Cmd+Z skipped in native mode (Swift menu bar is the sole handler)

## Task Commits

1. **Task 1: UAT pass — all 20 dataset types** — `9a3ec4aa` (feat)
2. **Bug fix: Excel base64 decode** — `d1c4aa50` (fix)
3. **Bug fix: Double undo prevention** — `4e5948b0` (fix)

## Files Created/Modified
- `.planning/phases/135-uat/135-01-UAT-LOG.md` — UAT results for all 20 dataset types
- `src/etl/ImportOrchestrator.ts` — base64→ArrayBuffer decode for native Excel imports
- `src/main.ts` — Guard undo/redo shortcut registration behind !isNative

## Decisions Made
- Excel import fix placed in ImportOrchestrator (not NativeBridge) since that's where format-specific handling lives
- Undo/redo guard uses existing `isNative` flag (app:// protocol detection) — no new infrastructure needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Excel import produces zero cards in native macOS app**
- **Found during:** User spot-check (Task 2 checkpoint)
- **Issue:** Swift sends xlsx data as base64 string via evaluateJavaScript. ImportOrchestrator cast it directly to ArrayBuffer without decoding — SheetJS received a string, parsed zero rows.
- **Fix:** Added typeof check + atob/Uint8Array decode in ImportOrchestrator 'excel' case
- **Files modified:** src/etl/ImportOrchestrator.ts
- **Verification:** User confirmed "2 inserted, 0 errors" after fix; 20 ImportOrchestrator tests pass
- **Committed in:** d1c4aa50

**2. [Rule 1 - Bug] Cmd+Z undoes two mutations instead of one in native macOS app**
- **Found during:** User spot-check (Task 2 checkpoint)
- **Issue:** Swift menu bar CommandGroup fires Cmd+Z → evaluateJavaScript undo(). WKWebView also passes the keydown to JS → ShortcutRegistry fires undo() again. Two undo calls per keystroke.
- **Fix:** Skip Cmd+Z/Cmd+Shift+Z registration in ShortcutRegistry when isNative is true
- **Files modified:** src/main.ts
- **Verification:** User confirmed preset undo works correctly after fix; 206 shortcut/mutation/preset tests pass
- **Committed in:** 4e5948b0

---

**Total deviations:** 2 auto-fixed (2 bugs found during user testing)
**Impact on plan:** Both fixes necessary for native macOS app correctness. No scope creep.

## Issues Encountered
None beyond the two bugs documented above.

## Next Phase Readiness
- v10.0 UAT complete, ready for milestone completion

---
*Phase: 135-uat*
*Completed: 2026-03-31*
