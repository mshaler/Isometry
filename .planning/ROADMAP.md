# Roadmap: Isometry

## Milestones

- ✅ **v0.1 Data Foundation** - Phases 1-2 (shipped 2026-02-28)
- ✅ **v0.5 Providers + Views** - Phases 4-6 (shipped 2026-02-28)
- ✅ **v1.0 Web Runtime** - Phases 3, 7 (shipped 2026-03-01)
- ✅ **v1.1 ETL Importers** - Phases 8-10 (shipped 2026-03-02)
- ✅ **v2.0 Native Shell** - Phases 11-14 (shipped 2026-03-03)
- ✅ **v3.0 SuperGrid Complete** - Phases 15-27 (shipped 2026-03-05)
- ✅ **v3.1 SuperStack** - Phases 28-32 (shipped 2026-03-06)
- ✅ **v4.0 Native ETL** - Phases 33-36 (shipped 2026-03-06)
- ✅ **v4.1 Sync + Audit** - Phases 37-41 (shipped 2026-03-07)
- ✅ **v4.2 Polish + QoL** - Phases 42-47 (shipped 2026-03-07)
- ✅ **v4.3 Review Fixes** - Phase 48 (shipped 2026-03-07)
- ✅ **v4.4 UX Complete** - Phases 49-52 (shipped 2026-03-08)
- ✅ **v5.0 Designer Workbench** - Phases 54-57 (shipped 2026-03-08)
- ✅ **v5.1 SuperGrid Spreadsheet UX** - Phases 58-61 (shipped 2026-03-08)
- ✅ **v5.2 SuperCalc + Workbench Phase B** - Phases 62-68 (shipped 2026-03-10)
- ✅ **v5.3 Dynamic Schema** - Phases 69-73 (shipped 2026-03-11)
- ✅ **v6.0 Performance** - Phases 74-78 (shipped 2026-03-13)
- ✅ **v6.1 Test Harness** - Phases 79-84 (shipped 2026-03-17)
- ✅ **v7.0 Design Workbench** - Phases 85-90 (shipped 2026-03-18)
- ✅ **v7.1 Notebook Card Editor** - Phases 91-94 (shipped 2026-03-19)
- ✅ **v7.2 Alto Index + DnD Migration** - Phases 95-96 (shipped 2026-03-21)
- ✅ **v8.0 SuperGrid Redesign** - Phases 97-100 (shipped 2026-03-21)
- ✅ **v8.1 Plugin Registry Complete** - Phases 101-102 (shipped 2026-03-22)
- ✅ **v8.2 SuperCalc v2** - Phase 103 (shipped 2026-03-22)
- ✅ **v8.3 Plugin E2E Test Suite** - Phases 104-107 (shipped 2026-03-22)
- ✅ **v8.4 Consolidate View Navigation** - Phase 108 (shipped 2026-03-22)
- ✅ **v10.1 Time Hierarchies** - Phases 136-139 (shipped 2026-04-08)
- ✅ **v10.2 SuperGrid Plugin Pipeline** - Phases 140-144 (shipped 2026-04-08)
- ✅ **v11.0 Navigation Bar Redesign** - Phases 145-149 (shipped 2026-04-16, Phase 150 deferred)
- ✅ **v11.1 Dock/Explorer Inline Embedding** - Phases 151-154 (shipped 2026-04-17)
- ✅ **v12.0 Explorer Panel Polish** - Phases 155-161 (shipped 2026-04-18)
- ✅ **v13.0 SuperWidget Substrate** - Phases 162-166 (shipped 2026-04-21)
- ✅ **v13.1 Data Explorer Canvas** - Phases 167-170 (shipped 2026-04-21)
- ✅ **v13.2 View + Editor Canvases** - Phases 171-173 (shipped 2026-04-22)
- 🚧 **v13.3 SuperWidget Shell** - Phases 174-177 (in progress)

## Phases

<details>
<summary>✅ Phases 1-173 -- archived milestones (see .planning/milestones/)</summary>

All phases 1-173 are archived in `.planning/milestones/` under their respective milestone directories.

</details>

### 🚧 v13.3 SuperWidget Shell (In Progress)

**Milestone Goal:** Replace WorkbenchShell with SuperWidget as the primary app container — tab management, explorer sidecar polish, rich status slots, and full session persistence.

#### Phase 174: Tab Management

- [x] **Phase 174: Tab Management** - Establish TabSlot type and full tab bar UX (create/close/reorder/switch, keyboard nav, overflow) (completed 2026-04-22)

Plans:
- [x] 174-01-PLAN.md — TabSlot type + CanvasComponent TabMetadata extension
- [x] 174-02-PLAN.md — TabBar core (create/close/switch/active/overflow) + SuperWidget wiring + CSS overhaul
- [x] 174-03-PLAN.md — Drag reorder, keyboard nav, Cmd+W shortcut, metadata callback wiring

#### Phase 175: Shell Replacement

- [x] **Phase 175: Shell Replacement** - SuperWidget becomes top-level #app container; all ~17 WorkbenchShell wiring points re-routed (completed 2026-04-22)

Plans:
- [x] 175-01-PLAN.md — SuperWidget 5-slot grid (sidebar + CommandBar param + explorer passthrough) + CSS layout
- [x] 175-02-PLAN.md — main.ts big-bang rewire + WorkbenchShell deletion + dead code cleanup + smoke test

#### Phase 176: Explorer Sidecar + Status Slots

- [ ] **Phase 176: Explorer Sidecar + Status Slots** - Auto-show/hide sidecar transitions and rich contextual status per canvas type

#### Phase 177: Tab Persistence

- [ ] **Phase 177: Tab Persistence** - StateManager tab registration, boot sequencing, and migration layer for fresh sessions

## Phase Details

### Phase 174: Tab Management
**Goal**: Users can create, close, switch, and reorder tabs in the SuperWidget tab bar with keyboard navigation and overflow handling; TabSlot type establishes the shell-level tab abstraction separate from canvas-internal concerns
**Depends on**: Phase 173 (v13.2 complete — all 3 canvas stubs replaced with production)
**Requirements**: TABS-01, TABS-02, TABS-03, TABS-04, TABS-05, TABS-06, TABS-07, TABS-08, TABS-09, TABS-10
**Success Criteria** (what must be TRUE):
  1. User can click + to create a new tab; clicking × closes any tab except the last one; Cmd+W closes the active tab
  2. User can click any tab header to switch to it, and the active tab has a visible indicator distinguishing it from inactive tabs
  3. User can drag tab headers to reorder them via pointer drag-and-drop
  4. When tabs exceed available tab bar width, overflow chevrons appear and are usable for navigation
  5. User can navigate between tabs using arrow keys (roving tabindex pattern); tab metadata (canvas type label, badge) flows up through onTabMetadataChange without breaking CANV-06
**Plans**: 3 plans
**UI hint**: yes

### Phase 175: Shell Replacement
**Goal**: SuperWidget is mounted on #app as the top-level container; DockNav and CommandBar are re-parented into SuperWidget slots; WorkbenchShell is fully retired with no remaining references; all existing wiring survives intact
**Depends on**: Phase 174
**Requirements**: SHEL-01, SHEL-02, SHEL-03, SHEL-04, SHEL-05, SHEL-06
**Success Criteria** (what must be TRUE):
  1. The app loads and renders correctly with SuperWidget as the #app root — no visual regression from pre-migration
  2. DockNav appears as the sidebar alongside the SuperWidget canvas area; CommandBar appears in the SuperWidget header slot
  3. WorkbenchShell file is deleted (or emptied to zero exports); no import references to it remain in main.ts or any other file
  4. All ~17 shell.* callback wiring points in main.ts are re-routed to SuperWidget equivalents and verified via a Vitest smoke test
  5. StateCoordinator 16ms batch window drains cleanly during shell teardown — no dangling coordinator callbacks after migration
**Plans**: 2 plans
**UI hint**: yes

### Phase 176: Explorer Sidecar + Status Slots
**Goal**: Bound views auto-show their explorer sidecar with CSS grid transitions; unbound views auto-hide it; status slots show rich contextual content (card count, filter summary, selection info, card title, dataset info, sync status) per canvas type
**Depends on**: Phase 175
**Requirements**: SIDE-01, SIDE-02, SIDE-03, SIDE-04, SIDE-05, STAT-01, STAT-02, STAT-03, STAT-04, STAT-05, STAT-06, STAT-07
**Success Criteria** (what must be TRUE):
  1. Switching to SuperGrid auto-shows the ProjectionExplorer sidecar; switching to any other view type auto-hides it — with a CSS grid-template-columns transition (no JS animation)
  2. Multiple explorers can be active in the sidecar simultaneously (top-slot and bottom-slot preserved) and the sidecar show/hide does not trigger any Worker re-queries or canvas re-renders
  3. ViewCanvas status bar shows the current view name and card count, plus active filter count when filters are applied and selection count when cells are selected
  4. EditorCanvas status bar shows the active card title; ExplorerCanvas status bar shows the dataset name and last import time
  5. Status slot DOM is cleared and replaced (not accumulated) on every canvas type change via commitProjection; sync status indicator is visible in the status bar at all times
**Plans**: TBD
**UI hint**: yes

### Phase 177: Tab Persistence
**Goal**: Active tab selection and enabled tab list survive page reload and app restart via StateManager; fresh sessions that have no prior tab state initialize cleanly without errors
**Depends on**: Phase 176
**Requirements**: PRST-01, PRST-02, PRST-03, PRST-04
**Success Criteria** (what must be TRUE):
  1. Active tab and enabled tab list survive a page reload — the same tab is active after reload that was active before
  2. Tab state is registered under the sw:zone:{role}:tabs key convention in StateManager (ui_state table) via SuperWidgetStateProvider
  3. Tab state restores only after the canvas registry is populated — boot sequencing prevents premature restore before canvases are registered
  4. A fresh session with no prior tab state (first run, schema upgrade) initializes with a valid default tab state and no console errors
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 174. Tab Management | v13.3 | 3/3 | Complete    | 2026-04-22 |
| 175. Shell Replacement | v13.3 | 2/2 | Complete    | 2026-04-22 |
| 176. Explorer Sidecar + Status Slots | v13.3 | 0/? | Not started | - |
| 177. Tab Persistence | v13.3 | 0/? | Not started | - |

### Phase 178: CSS & Code Hygiene Audit

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 177
**Plans:** 2/2 plans complete

Plans:
- [ ] TBD (run /gsd:plan-phase 178 to break down)
