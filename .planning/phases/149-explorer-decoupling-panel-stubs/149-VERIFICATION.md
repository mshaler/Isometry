---
phase: 149-explorer-decoupling-panel-stubs
verified: 2026-04-16T10:15:00Z
status: human_needed
score: 6/6 must-haves verified (automated); 1 behavioral item requires human confirmation
re_verification: false
human_verification:
  - test: "Properties and Projection panels are accessible from dock"
    expected: "User can open Properties and Projection explorer panels from a dock item in the Integrate section (the two dockToPanelMap entries 'integrate:properties' and 'integrate:projection' currently have no dock items backing them — the integrate section only contains 'catalog')"
    why_human: "Cannot programmatically determine if this is an intentional scope decision (dock simplification in fed8fce3 pre-dates the phase, and the panels are available through another mechanism) or an unresolved gap. The PLAN acceptance criteria only required the map entries to exist, not the dock items to be present. A human must confirm: are Properties and Projection explorers meant to be accessible from the dock in this phase?"
---

# Phase 149: Explorer Decoupling + Panel Stubs Verification Report

**Phase Goal:** Relocate PanelDrawer from hidden tray to visible side drawer; wire dock clicks to toggle explorer panels; create Maps/Formulas/Stories stub panels with "Coming soon" placeholders.
**Verified:** 2026-04-16T10:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PanelDrawer renders as a visible side column inside .workbench-main, not in a hidden tray | ✓ VERIFIED | WorkbenchShell.ts mounts PanelDrawer into `contentRow` (.workbench-main__content); `.workbench-panel-tray` does not exist anywhere in src/ |
| 2 | Clicking a dock item mapped to an explorer toggles that panel open/closed in the side drawer | ✓ VERIFIED (partial scope) | `dockToPanelMap` wired in main.ts; `analyze:filter`, `activate:notebook`, `synthesize:maps`, `analyze:formula`, `activate:stories` all have live dock entries and working routes; `integrate:properties`/`integrate:projection` are mapped but have no dock item (see Human Verification) |
| 3 | All 8 existing explorers still function correctly after relocation | ✓ VERIFIED | 4335 unit tests pass; PanelRegistry.enable/disable/mount/unmount chain unchanged; factories registered for properties, projection, latch, notebook, calc, algorithm, visual |
| 4 | PanelDrawer icon strip is hidden (display:none) since DockNav is the activation surface | ✓ VERIFIED | PanelDrawer.ts line 97: `strip.style.display = 'none'` added immediately after strip creation in mount() |
| 5 | Maps/Formulas/Stories stub panels show "Coming soon" placeholder when clicked | ✓ VERIFIED | MapsPanelStub.ts, FormulasPanelStub.ts, StoriesPanelStub.ts all exist with correct placeholder content; each has `role="status"` on the "Coming soon" text |
| 6 | Dock navbar contains no filter controls or explorer content — only navigation affordances | ✓ VERIFIED | DockNav renders only DOCK_DEFS entries (icon + label); explorer widgets removed from dock pre-phase via fed8fce3 |

**Score:** 6/6 truths verified (with 1 behavioral scope question for human)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/ui/WorkbenchShell.ts` | PanelDrawer mounted inside .workbench-main as visible flex child | ✓ VERIFIED | Lines 79–89: `contentRow.className = 'workbench-main__content'`; `this._panelDrawer.mount(contentRow)`; `workbench-panel-tray` completely absent |
| `src/styles/workbench.css` | .workbench-main__content flex-row layout with panel-drawer slot | ✓ VERIFIED | Lines 67–74: `.workbench-main__content { flex: 1 1 auto; display: flex; flex-direction: row; ... }`; no `.workbench-panel-tray` rule anywhere in file |
| `src/ui/panels/PanelDrawer.ts` | togglePanel + scrollToPanel public API; icon strip hidden | ✓ VERIFIED | Lines 143–157: `togglePanel(panelId)` delegates to `_togglePanel()`; `scrollToPanel(panelId)` uses `entry.section.getElement().scrollIntoView()`; line 97: `strip.style.display = 'none'` |
| `src/main.ts` | onActivateItem routing for explorer panel toggles via dockToPanelMap | ✓ VERIFIED | Lines 970–979: `dockToPanelMap` with 7 entries; lines 1024–1034: generic toggle routing branch using `drawer.togglePanel(panelId)` and `drawer.scrollToPanel(panelId)` |
| `src/ui/panels/MapsPanelStub.ts` | Maps PanelMeta + PanelFactory with Coming soon placeholder | ✓ VERIFIED | Exports `MAPS_PANEL_META` (id: 'maps-stub', icon: 'globe') and `mapsPanelFactory`; "Coming soon" with `role="status"` |
| `src/ui/panels/FormulasPanelStub.ts` | Formulas PanelMeta + PanelFactory with Coming soon placeholder | ✓ VERIFIED | Exports `FORMULAS_PANEL_META` (id: 'formulas-stub', icon: 'code') and `formulasPanelFactory`; "Coming soon" with `role="status"` |
| `src/ui/panels/StoriesPanelStub.ts` | Stories PanelMeta + PanelFactory with Coming soon placeholder | ✓ VERIFIED | Exports `STORIES_PANEL_META` (id: 'stories-stub', icon: 'book-open') and `storiesPanelFactory`; "Coming soon" with `role="status"` |
| `src/ui/section-defs.ts` | Maps dock entry added to DOCK_DEFS synthesize section | ✓ VERIFIED | Lines 165–170: `synthesize` section with `{ key: 'maps', label: 'Maps', icon: 'globe' }` and `{ key: 'graph', label: 'Graphs', icon: 'share-2' }` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/main.ts` | `PanelRegistry.enable/disable` | `drawer.togglePanel(panelId)` in onActivateItem | ✓ WIRED | togglePanel delegates to `_togglePanel` which calls `registry.enable/disable` |
| `src/ui/WorkbenchShell.ts` | `PanelDrawer.mount` | `this._panelDrawer.mount(contentRow)` | ✓ WIRED | Line 85 of WorkbenchShell.ts |
| `src/main.ts` | `PanelRegistry` | `panelRegistry.register(MAPS_PANEL_META, mapsPanelFactory)` | ✓ WIRED | Lines 1586–1588 of main.ts |
| `src/main.ts` | `dockToPanelMap` | `'synthesize:maps': 'maps-stub'`, `'analyze:formula': 'formulas-stub'`, `'activate:stories': 'stories-stub'` | ✓ WIRED | Lines 976–978 of main.ts |
| `integrate:properties` / `integrate:projection` in dockToPanelMap | Live dock items | None — no dock items for these keys | ? ORPHANED MAP ENTRIES | dockToPanelMap lines 971–972 map these keys but DOCK_DEFS integrate section only has `catalog`; Properties/Projection panels cannot be activated from the dock (see Human Verification) |

### Data-Flow Trace (Level 4)

Not applicable — stub panels render static "Coming soon" content by design. No data source needed.

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| TypeScript compiles | `npx tsc --noEmit` | Zero errors | ✓ PASS |
| All unit tests pass | `npx vitest run` | 4335 passed, 210 test files | ✓ PASS |
| `workbench-panel-tray` removed from src | grep in src/ | No matches | ✓ PASS |
| PanelDrawer icon strip hidden | `strip.style.display = 'none'` in PanelDrawer.mount() | Present at line 97 | ✓ PASS |
| Stub files exist with role=status | File content check | All 3 files present, all have `role="status"` on "Coming soon" body | ✓ PASS |
| synthesize:maps in DOCK_DEFS | section-defs.ts synthesize section | `{ key: 'maps', label: 'Maps', icon: 'globe' }` present | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| DCPL-01 | 149-01 | Explorers render in the main panel, not inside the dock navbar | ✓ SATISFIED | PanelDrawer mounted in .workbench-main__content, not in any hidden tray or dock navbar |
| DCPL-02 | 149-01 | Dock navbar provides navigation context only — no filter controls or explorer content in dock | ✓ SATISFIED | DockNav renders DOCK_DEFS items only; explorer panels live in PanelDrawer side drawer |
| DCPL-03 | 149-01 | All existing explorer functionality preserved (Properties, Projection, Visual, LATCH, Data, Notebook, Algorithm, Calc) | ✓ SATISFIED | 4335 tests pass; 8 panel factories registered; PanelRegistry wiring unchanged |
| STUB-01 | 149-02 | User sees Maps dock entry with placeholder icon and "Coming soon" panel content | ✓ SATISFIED | `synthesize:maps` in DOCK_DEFS; MapsPanelStub registered; routing wired via dockToPanelMap |
| STUB-02 | 149-02 | User sees Formulas dock entry with placeholder icon and "Coming soon" panel content | ✓ SATISFIED | `analyze:formula` in DOCK_DEFS; FormulasPanelStub registered; routing wired |
| STUB-03 | 149-02 | User sees Stories dock entry with placeholder icon and "Coming soon" panel content | ✓ SATISFIED | `activate:stories` in DOCK_DEFS; StoriesPanelStub registered; routing wired |

All 6 requirements for Phase 149 are programmatically satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/main.ts` | 971–972 | `'integrate:properties'` and `'integrate:projection'` in dockToPanelMap with no backing dock items | ℹ️ Info | Dead map entries — these panel IDs have no dock item to click. Properties and Projection explorers cannot be activated from the dock in the current DOCK_DEFS. The routing code is correct and will work if dock items are added. |

This is not a stub or blocker — the routing code and panels are real. It is a navigational gap: the two explorers specified in the plan as dock-activated cannot currently be reached via the dock.

### Human Verification Required

#### 1. Properties and Projection Explorer Dock Accessibility

**Test:** Open the app, expand the Integrate section of the dock. Count dock items visible. Try to find and click a "Properties" or "Projection" item.

**Expected:** If this is a known accepted scope deferral (dock items for Properties/Projection to be added in a later phase), confirm that understanding. If Properties/Projection were expected to be accessible from the dock in this phase, they are missing.

**Why human:** The DOCK_DEFS integrate section (commit `fed8fce3`, which predates Phase 149) only has `catalog`. The `dockToPanelMap` contains entries for `integrate:properties` and `integrate:projection` but these keys are never fired by the dock. The plan's acceptance criteria only required the map entries to exist — not that dock items back them. Human must confirm: is this an intentional phased approach (dock items added later), or a gap?

#### 2. Stub Panel Visual Verification

**Test:** Click Maps in the Synthesize dock section → verify globe icon + "Maps" heading + "Coming soon" text appears in the side drawer. Repeat for Formulas (Analyze section) and Stories (Activate section).

**Expected:** Each shows centered placeholder: icon (32px), feature name heading (600 weight), "Coming soon" body text.

**Why human:** CSS rendering and icon display (requires globe icon registered in icons.ts) cannot be verified programmatically.

#### 3. PanelDrawer Side Drawer Layout

**Test:** Click any working panel (LATCH Filters, Notebooks) and confirm the panel opens as a side drawer column to the left of the main view content, not as an overlay or hidden element.

**Expected:** VS Code-style side panel: drawer width ~300px, to the left of view content, resize handle visible.

**Why human:** CSS flex layout rendering requires visual inspection.

### Gaps Summary

No hard blockers found. The phase's 6 requirements (DCPL-01..03, STUB-01..03) are programmatically satisfied. TypeScript compiles clean, all 4335 tests pass.

One navigational gap noted as informational: `integrate:properties` and `integrate:projection` are registered in `dockToPanelMap` but the integrate dock section does not expose those items to the user. The Properties and Projection explorers are registered in PanelRegistry and fully functional — they simply have no dock entry point in the current UI. This may be intentional (deferred to a later phase that adds those dock items) or an oversight from the `fed8fce3` dock simplification commit that ran before Phase 149.

---

_Verified: 2026-04-16T10:15:00Z_
_Verifier: Claude (gsd-verifier)_
