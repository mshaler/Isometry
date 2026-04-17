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
- 🚧 **v11.1 Dock/Explorer Inline Embedding** - Phases 151-154 (in progress)

## Phases

<details>
<summary>✅ Phases 1-144 — archived milestones (see .planning/milestones/)</summary>

All phases 1-144 are archived in `.planning/milestones/` under their respective milestone directories.

</details>

### ✅ v11.0 Navigation Bar Redesign (Shipped: 2026-04-16)

**Milestone Goal:** Replace the SidebarNav with a dock-style DockNav supporting 3-state collapse, per-view minimap thumbnails, verb-noun taxonomy, explorer decoupling, and stub entries for Maps/Formulas/Stories. Phase 150 (iOS Stories Splash) deferred.

### 🚧 v11.1 Dock/Explorer Inline Embedding (In Progress)

**Milestone Goal:** Replace the PanelDrawer side drawer with explorers embedded directly into the main view at contextually appropriate positions (above/below the active view), toggled from the dock.

## Phase Details

### Phase 145: SECTION_DEFS Extraction + Regression Baseline
**Goal**: Shared section/item key constants are extracted and keyboard shortcuts have test coverage before any navigation swap begins
**Depends on**: Phase 144
**Requirements**: DOCK-06
**Success Criteria** (what must be TRUE):
  1. `src/ui/section-defs.ts` exists and exports all `"sectionKey:itemKey"` composite key constants previously inlined in SidebarNav
  2. ShortcutRegistry regression test suite covers all Cmd+1-9 bindings and passes green
  3. Existing keyboard shortcuts fire the correct view activation with no behavioral change
  4. SidebarNav imports and uses constants from section-defs.ts (no key string literals remain in SidebarNav)
**Plans:** 1/1 plans complete
Plans:
- [x] 145-01-PLAN.md — Extract section-defs.ts constants, rewire imports, add Cmd+1-9 regression tests

### Phase 146: DockNav Shell + SidebarNav Swap
**Goal**: Users see a functional dock-style navbar organized by verb-noun taxonomy in place of SidebarNav, with icon + label display and click-to-activate working across all 5 themes
**Depends on**: Phase 145
**Requirements**: DOCK-01, DOCK-02, DOCK-03, DOCK-04, A11Y-03
**Success Criteria** (what must be TRUE):
  1. User sees a vertical dock with 48×48 Lucide SVG icon + label for each navigation item
  2. User clicks a dock item and the corresponding explorer/view activates in the main panel
  3. Active dock item shows a visible highlight/indicator distinguishing it from inactive items
  4. Dock items are organized under Integrate, Visualize, Analyze, Activate, and Help section headers
  5. All 5 design themes render the dock correctly with no missing or fallback token values
**Plans:** 2/2 plans complete
Plans:
- [x] 146-01-PLAN.md — Create DockNav component and dock-nav.css styles
- [x] 146-02-PLAN.md — Wire DockNav into main.ts, delete SidebarNav files

### Phase 147: 3-State Collapse + Accessibility
**Goal**: Users can cycle the dock through Hidden, Icon-only, and Icon+Thumbnail states with smooth animation, persistent preference, and fully accessible keyboard navigation
**Depends on**: Phase 146
**Requirements**: CLPS-01, CLPS-02, CLPS-03, CLPS-04, A11Y-01, A11Y-02, A11Y-04
**Success Criteria** (what must be TRUE):
  1. User clicks the dock toggle and the dock snaps between Hidden, Icon-only, and Icon+Thumbnail states
  2. State transition plays a smooth CSS animation (no jump or flicker) using grid-template-rows 0fr to 1fr
  3. Chosen collapse state survives an app reload (persisted via ui_state)
  4. Arrow keys navigate between dock items without requiring a mouse
  5. VoiceOver announces the dock state name when transitioning and announces the activated item on click
**Plans:** 2/2 plans complete
Plans:
- [x] 147-01-PLAN.md — CSS collapse states, toggle button, animation, persistence, sidebar width sync
- [x] 147-02-PLAN.md — ARIA tablist roles, roving tabindex keyboard navigation, VoiceOver announcements

### Phase 148: MinimapRenderer + Loupe
**Goal**: Users see a 96×48 thumbnail per dock item reflecting current view state, with a loupe overlay showing the visible viewport, rendered lazily and without blocking the main thread
**Depends on**: Phase 147
**Requirements**: MMAP-01, MMAP-02, MMAP-03, MMAP-04, DOCK-05
**Success Criteria** (what must be TRUE):
  1. User hovers over a collapsed dock item (or expands to Icon+Thumbnail state) and sees a 96×48 minimap thumbnail appear for that view
  2. Thumbnail does not render until the user interacts with the dock — no background render on idle
  3. A loupe/viewport overlay on the thumbnail indicates which portion of the full canvas is currently visible
  4. Each visualization dock item shows the current PAFV axis summary label beneath or alongside its thumbnail
  5. Scrolling or interacting with the main view does not cause visible jank — thumbnail generation runs off the main thread
**Plans:** 2/2 plans complete
Plans:
- [x] 148-01-PLAN.md — MinimapRenderer module with per-view sketch functions, PAFV caption bar, lazy DockNav trigger
- [x] 148-02-PLAN.md — Loupe overlay with click-to-jump and drag-to-pan, main.ts wiring, debounced re-render
**UI hint**: yes

### Phase 149: Explorer Decoupling + Panel Stubs
**Goal**: All explorer panels render exclusively in the main panel (not inside the dock), and Maps, Formulas, and Stories appear as stub dock entries with "Coming soon" content
**Depends on**: Phase 146
**Requirements**: DCPL-01, DCPL-02, DCPL-03, STUB-01, STUB-02, STUB-03
**Success Criteria** (what must be TRUE):
  1. The dock navbar contains no filter controls, explorer widgets, or panel content — only navigation affordances
  2. All 8 existing explorers (Properties, Projection, Visual, LATCH, Data, Notebook, Algorithm, Calc) open in the main panel with no functionality regression
  3. User sees a Maps dock entry that, when activated, shows a "Coming soon" placeholder panel
  4. User sees a Formulas dock entry that, when activated, shows a "Coming soon" placeholder panel
  5. User sees a Stories dock entry that, when activated, shows a "Coming soon" placeholder panel
**Plans**: 2 plans
Plans:
- [x] 149-01-PLAN.md — Relocate PanelDrawer to visible side drawer, wire explorer toggle routing
- [x] 149-02-PLAN.md — Create Maps/Formulas/Stories stub panel factories and dock routing
**UI hint**: yes

### Phase 150: iOS Stories Splash
**Goal**: iOS app launches to a SwiftUI Stories splash screen that presents a mini-app launcher concept, dismisses to the full Workbench, and never delays WASM warm-up
**Depends on**: Phase 149
**Requirements**: SPLS-01, SPLS-02, SPLS-03, SPLS-04
**Status**: DEFERRED — Stories platform split (iOS vs macOS) requires product decision before scope is finalized
**Success Criteria** (what must be TRUE):
  1. iOS app opens to a full-screen Stories splash (fullScreenCover) showing a dataset + view + controls launcher grid
  2. User taps a dismiss control and transitions directly into the full Workbench with WKWebView already loaded
  3. WASM initialization completes in the background unconditionally — first SuperGrid render after splash dismiss is instant
  4. Splash is shown only on first launch; subsequent launches open directly to Workbench (gated by @AppStorage hasSeenWelcome)
**Plans**: TBD

---

### Phase 151: PanelDrawer Removal + Inline Container Scaffolding
**Goal**: The PanelDrawer side drawer is fully removed from the layout and a new inline embedding container structure exists in its place — ready to host explorer sections above and below the active view
**Depends on**: Phase 149
**Requirements**: RMV-01, RMV-02
**Success Criteria** (what must be TRUE):
  1. No side panel column, icon strip, or resize handle exists in the DOM — layout is a clean vertical stack
  2. The main view area contains a top-slot container element (for explorers above the view) and a bottom-slot container element (for explorers below the view)
  3. All existing tests that touched PanelDrawer pass or are removed — no dangling references remain
  4. The active view renders at its correct dimensions with no layout shift caused by the removal
**Plans:** 1/1 plans complete
Plans:
- [x] 151-01-PLAN.md — Delete PanelDrawer, restructure layout to vertical stack with top/bottom slots, update tests
**UI hint**: yes

### Phase 152: Integrate + Visualize Inline Embedding
**Goal**: Users can toggle Data Explorer + Properties Explorer above the active view from the Integrate dock section, and Projections Explorer appears above SuperGrid only — automatically hidden for all other views
**Depends on**: Phase 151
**Requirements**: INTG-01, INTG-02, VIZ-01, VIZ-02, VIZ-03
**Success Criteria** (what must be TRUE):
  1. User clicks the Data icon in the dock and Data Explorer + Properties Explorer appear at the top of the main view area above the active view
  2. User clicks the Data icon again and both Data Explorer + Properties Explorer hide
  3. User activates the SuperGrids view and Projections Explorer appears above the grid (even if no explicit toggle was needed)
  4. User switches to any non-SuperGrid view (Timelines, Charts, Graphs, etc.) and Projections Explorer is hidden — only the selected view shows
  5. User switches back to SuperGrids and Projections Explorer reappears in the top slot
**Plans:** 1/1 plans complete
Plans:
- [x] 152-01-PLAN.md — Wire Data+Properties toggle and Projections auto-visibility into top-slot inline embedding
**UI hint**: yes

### Phase 153: Analyze Section Inline Embedding
**Goal**: Users can toggle LATCH Filters and Formulas Explorer below the active view from the Analyze dock section, with filters persisting across view switches
**Depends on**: Phase 152
**Requirements**: ANLZ-01, ANLZ-02, ANLZ-03, ANLZ-04, ANLZ-05
**Success Criteria** (what must be TRUE):
  1. User clicks Filters in the dock and all 5 LATCH Filters appear below the active view
  2. User clicks Filters again and all LATCH Filters hide
  3. User switches views while Filters are toggled on and the LATCH Filters remain visible below the new active view
  4. User clicks Formulas in the dock and a Formulas Explorer placeholder appears below the active view (below Filters if both are visible)
  5. User clicks Formulas again and the Formulas Explorer hides
**Plans**: TBD
**UI hint**: yes

### Phase 154: Regression Guard + Hardening
**Goal**: All existing tests pass with no regressions after the explorer relocation, and integration tests verify the complete inline embedding flow end-to-end
**Depends on**: Phase 153
**Requirements**: REGR-01
**Success Criteria** (what must be TRUE):
  1. Full test suite (unit + seam + E2E) passes green with no regressions introduced by Phases 151-153
  2. An integration test verifies the Data dock toggle shows/hides the top-slot explorers in the correct DOM position
  3. An integration test verifies Projections Explorer appears only when SuperGrid is the active view
  4. An integration test verifies LATCH Filters persist across a view switch
**Plans**: TBD

## Phases (Summary Checklist)

### v11.0 Navigation Bar Redesign
- [x] **Phase 145: SECTION_DEFS Extraction + Regression Baseline** - Extract shared nav key constants and establish keyboard shortcut regression tests (completed 2026-04-09)
- [x] **Phase 146: DockNav Shell + SidebarNav Swap** - Replace SidebarNav with dock-style DockNav using verb-noun taxonomy and full theme coverage (completed 2026-04-11)
- [x] **Phase 147: 3-State Collapse + Accessibility** - Implement Hidden/Icon-only/Icon+Thumbnail collapse with animation, persistence, and ARIA/VoiceOver support (completed 2026-04-12)
- [x] **Phase 148: MinimapRenderer + Loupe** - Lazy 96×48 thumbnails per view with loupe overlay and PAFV axis labels, off-main-thread rendering (completed 2026-04-12)
- [x] **Phase 149: Explorer Decoupling + Panel Stubs** - Move all explorer content to main panel and register Maps/Formulas/Stories stub entries (completed 2026-04-16)
- [ ] **Phase 150: iOS Stories Splash** - SwiftUI fullScreenCover splash with mini-app launcher grid and unconditional WASM warm-up (DEFERRED)

### v11.1 Dock/Explorer Inline Embedding
- [x] **Phase 151: PanelDrawer Removal + Inline Container Scaffolding** - Remove PanelDrawer entirely and scaffold top/bottom inline embedding slots (completed 2026-04-16)
- [x] **Phase 152: Integrate + Visualize Inline Embedding** - Data/Properties Explorer toggle above view; Projections Explorer conditionally above SuperGrid only (completed 2026-04-17)
- [ ] **Phase 153: Analyze Section Inline Embedding** - LATCH Filters + Formulas Explorer toggle below view with cross-view filter persistence
- [ ] **Phase 154: Regression Guard + Hardening** - Full test suite green, integration tests for all three inline embedding flows

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 145. SECTION_DEFS + Regression Baseline | v11.0 | 1/1 | Complete    | 2026-04-09 |
| 146. DockNav Shell + SidebarNav Swap | v11.0 | 2/2 | Complete    | 2026-04-11 |
| 147. 3-State Collapse + Accessibility | v11.0 | 2/2 | Complete    | 2026-04-12 |
| 148. MinimapRenderer + Loupe | v11.0 | 2/2 | Complete   | 2026-04-12 |
| 149. Explorer Decoupling + Panel Stubs | v11.0 | 2/2 | Complete    | 2026-04-16 |
| 150. iOS Stories Splash | v11.0 | 0/TBD | Deferred | - |
| 151. PanelDrawer Removal + Inline Container Scaffolding | v11.1 | 1/1 | Complete    | 2026-04-16 |
| 152. Integrate + Visualize Inline Embedding | v11.1 | 1/1 | Complete   | 2026-04-17 |
| 153. Analyze Section Inline Embedding | v11.1 | 0/TBD | Not started | - |
| 154. Regression Guard + Hardening | v11.1 | 0/TBD | Not started | - |
