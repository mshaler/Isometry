---
phase: 175-shell-replacement
verified: 2026-04-22T14:06:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 175: Shell Replacement Verification Report

**Phase Goal:** SuperWidget becomes top-level #app container; all ~17 WorkbenchShell wiring points re-routed
**Verified:** 2026-04-22T14:06:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SuperWidget constructor accepts CommandBar and mounts it in the header slot | VERIFIED | `SuperWidget.ts` lines 47-67: `commandBar?.mount(this._headerEl)` in constructor |
| 2 | SuperWidget creates a sidebar slot spanning all 4 grid rows | VERIFIED | `SuperWidget.ts` line 57-58: `_sidebarEl` with `dataset['slot'] = 'sidebar'`; CSS `grid-area: sidebar` spans all 4 rows |
| 3 | SuperWidget provides getTopSlotEl() and getBottomSlotEl() accessors | VERIFIED | `SuperWidget.ts` lines 288-289: both methods return `HTMLElement` instances |
| 4 | SuperWidget CSS grid is 5-slot with sidebar column + grid-template-areas | VERIFIED | `superwidget.css` lines 36-42: `grid-template-columns: auto 1fr` + named areas for sidebar/header/tabs/canvas/status |
| 5 | App loads with SuperWidget mounted on #app as top-level container | VERIFIED | `main.ts` line 577-578: `new SuperWidget(getCanvasFactory(), shortcuts, commandBar)` + `superWidget.mount(container)` where `container = document.getElementById('app')` |
| 6 | DockNav appears in the SuperWidget sidebar slot | VERIFIED | `main.ts` line 975: `dockNav.mount(superWidget.sidebarEl)` |
| 7 | WorkbenchShell.ts is deleted with zero remaining imports anywhere | VERIFIED | File confirmed deleted; `grep -r "WorkbenchShell" src/` returns zero matches |
| 8 | window.__isometry debug object exposes superWidget instead of shell | VERIFIED | `main.ts` line 1936: `superWidget,` present in `window.__isometry` object |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/superwidget/SuperWidget.ts` | 5-slot layout with sidebar, CommandBar param, passthrough accessors | VERIFIED | 294 LOC; all required methods and fields present |
| `src/styles/superwidget.css` | CSS grid with sidebar column and grid-template-areas | VERIFIED | `grid-template-areas` with 4 sidebar rows; `.sw-explorer-slot-top/bottom` rules present |
| `src/main.ts` | Rewired bootstrap — SuperWidget as root, no shell references | VERIFIED | No `WorkbenchShell` references; all 17+ wiring points re-routed |
| `tests/superwidget/shellReplacement.test.ts` | Smoke test verifying all wiring points | VERIFIED | 7 tests passing covering SHEL-01..SHEL-06 |
| `src/ui/WorkbenchShell.ts` | Must NOT exist (deleted) | VERIFIED | File does not exist |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/main.ts` | `src/superwidget/SuperWidget.ts` | `new SuperWidget(..., commandBar)` | WIRED | Line 577: `new SuperWidget(getCanvasFactory(), shortcuts, commandBar)` |
| `src/main.ts` | `src/ui/DockNav.ts` | `dockNav.mount(superWidget.sidebarEl)` | WIRED | Line 975: exact pattern confirmed |
| `src/main.ts` | `window.__isometry` | `superWidget` property in debug object | WIRED | Line 1936: `superWidget,` in debug object; bare `shell,` not present |
| `src/main.ts` | `src/ui/CommandBar.ts` | standalone `commandBar` const, `setSubtitle` calls | WIRED | Lines 703, 737, 1049: `commandBar.setSubtitle(...)` |
| `src/main.ts` | `superWidget.canvasEl` | `topSlotEl`/`viewContentEl`/`bottomSlotEl` ordering | WIRED | Lines 646-666: prepend topSlot, append viewContentEl, append bottomSlot |
| `src/presets/LayoutPresetManager.ts` | no getSectionStates/restoreSectionStates | constructor `(bridge)` only | WIRED | Constructor line 38: `constructor(bridge: Bridge)` — dead params removed |

### Data-Flow Trace (Level 4)

Not applicable — phase produces structural wiring (shell replacement), not data-rendering components. The SuperWidget DOM skeleton and slot routing are the deliverables; data flows through pre-existing providers unchanged.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| WorkbenchShell.ts deleted | `test ! -f src/ui/WorkbenchShell.ts` | File absent | PASS |
| No WorkbenchShell references in src/ | `grep -r "WorkbenchShell" src/` | Zero matches | PASS |
| No shell.* call sites in main.ts (outside harness branch) | `grep "shell\." src/main.ts` | Only `shell.mount(container)` inside harness early-exit branch (HarnessShell, not WorkbenchShell) | PASS |
| workbench.css shell rules removed | Pattern scan for `.workbench-shell`, `.workbench-body`, `.workbench-sidebar`, `.workbench-main`, `.workbench-slot-top`, `.workbench-slot-bottom` | Zero matches | PASS |
| workbench.css live rules preserved | `.workbench-command-bar`, `.collapsible-section` | Both present | PASS |
| LayoutPresetManager no longer references section state | `grep getSectionStates src/presets/` | Zero matches | PASS |
| presetCommands.ts no restoreSectionStates | `grep restoreSectionStates src/presets/` | Zero matches | PASS |
| All smoke tests pass | `npx vitest run tests/superwidget/shellReplacement.test.ts` | 7/7 PASS | PASS |
| Full superwidget suite passes | `npx vitest run tests/superwidget/` | 328/328 PASS | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SHEL-01 | 175-01, 175-02 | SuperWidget is the top-level container mounted on #app | SATISFIED | `main.ts:577-578` — `superWidget.mount(container)` where container is `#app` |
| SHEL-02 | 175-01, 175-02 | DockNav re-parented as sidebar alongside SuperWidget canvas area | SATISFIED | `main.ts:975` — `dockNav.mount(superWidget.sidebarEl)`; sidebar slot with `grid-area: sidebar` spanning all 4 rows |
| SHEL-03 | 175-01, 175-02 | CommandBar migrated to SuperWidget header slot | SATISFIED | `SuperWidget.ts:63-65` — `commandBar.mount(this._headerEl)`; smoke test verifies `.workbench-command-bar` inside `[data-slot="header"]` |
| SHEL-04 | 175-02 | WorkbenchShell fully retired (file deleted or emptied) | SATISFIED | File does not exist; zero grep matches for `WorkbenchShell` in `src/` |
| SHEL-05 | 175-02 | StateCoordinator 16ms batch window drained before shell teardown during migration | SATISFIED | All SuperWidget construction + mount + slot wiring completes synchronously before any `await bridge.send()` calls in `main.ts`; ordering guarantee test passes |
| SHEL-06 | 175-02 | All ~40 shell.* wiring points in main.ts re-routed to SuperWidget equivalents | SATISFIED | Zero occurrences of `shell.get` in `main.ts`; 17 documented call sites all re-routed per SUMMARY; `WorkbenchShell` import removed |

**Note on SHEL-05 description vs implementation:** The requirement text mentions "StateCoordinator 16ms batch window drained before shell teardown during migration" but the actual implementation satisfies the intent (D-08 ordering guarantee) by ensuring SuperWidget is fully constructed and mounted synchronously before any async bridge calls. There is no shell teardown step — it was a clean big-bang swap with no migration teardown path. The smoke test explicitly verifies all slots are wired without any awaits.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/main.ts:108` | `const shell = new HarnessShell(); shell.mount(container)` | INFO | `shell` local variable inside early-exit harness branch; not WorkbenchShell. Unrelated to this phase. |
| `src/presets/presetCommands.ts` | `forward`/`inverse` no-op callbacks for section state undo/redo | INFO | Intentional per D-04 — section states dropped entirely. No user-visible regression since section states were already no-ops on WorkbenchShell. |

No blockers or warnings.

### Human Verification Required

The following items benefit from human spot-check but are not blockers for automated verification:

**1. Visual Layout — Sidebar + Header Rendering**
**Test:** Open the app in a browser. Confirm the sidebar (DockNav icon rail) appears to the left of the header/tabs/canvas/status column.
**Expected:** App layout matches the 5-slot grid — sidebar at left edge, CommandBar in header, tabs below, canvas filling the 1fr row, status at bottom.
**Why human:** CSS grid-template-areas are verified structurally but visual rendering requires a browser.

**2. CommandBar Subtitle Updates**
**Test:** Import a dataset and observe the CommandBar subtitle.
**Expected:** Subtitle updates to the dataset name after import (e.g. "Meryl Streep Filmography").
**Why human:** `commandBar.setSubtitle()` wiring is code-verified but subtitle text display in the UI requires visual confirmation.

### Gaps Summary

No gaps. All 8 must-haves verified, all 6 requirement IDs (SHEL-01..SHEL-06) satisfied, zero blocker anti-patterns, 328/328 tests passing.

---

_Verified: 2026-04-22T14:06:00Z_
_Verifier: Claude (gsd-verifier)_
