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
- 🚧 **v13.2 View + Editor Canvases** - Phases 171-173 (in progress)

## Phases

<details>
<summary>✅ Phases 1-170 -- archived milestones (see .planning/milestones/)</summary>

All phases 1-170 are archived in `.planning/milestones/` under their respective milestone directories.

</details>

### 🚧 v13.2 View + Editor Canvases (In Progress)

**Milestone Goal:** Replace the two remaining CanvasComponent stubs with production implementations — ViewCanvas mounts the 9 D3 views inside SuperWidget, EditorCanvas mounts the card editor, and integration tests verify the full 3-canvas transition matrix.

- [ ] **Phase 171: ViewCanvas** - Production CanvasComponent wrapping ViewManager with 9-view switching, sidecar binding, and status slot
- [ ] **Phase 172: EditorCanvas** - Production CanvasComponent wrapping NotebookExplorer with card selection binding and destroy safety
- [ ] **Phase 173: 3-Canvas E2E Gate** - Full transition matrix Playwright CI gate replacing stub-based smoke test

## Phase Details

### Phase 171: ViewCanvas
**Goal**: Users can see all 9 D3 views rendered inside the SuperWidget canvas slot, with view switching driven by Projection state and Explorer sidecar shown/hidden per view binding
**Depends on**: Phase 170 (ExplorerCanvas, v13.1)
**Requirements**: VCNV-01, VCNV-02, VCNV-03, VCNV-04, VCNV-05
**Success Criteria** (what must be TRUE):
  1. All 9 D3 views render correctly inside the SuperWidget canvas slot via ViewManager wrapper-div isolation (container.innerHTML = '' does not corrupt the canvas slot)
  2. Switching Projection state (activeTabId) causes ViewManager.switchTo() to fire with the correct ViewType — no unknown tab IDs, no silent failures
  3. SuperWidget status slot shows current view name and live card count, updated after each ViewManager render callback
  4. SuperGrid activates the ProjectionExplorer sidecar; all other views hide the sidecar — driven by registry defaultExplorerId, not hardcoded type checks
  5. ViewCanvas.destroy() tears down ViewManager and produces zero leaked subscriptions in a before/after subscriber-count assertion
**Plans**: TBD
**UI hint**: yes

### Phase 172: EditorCanvas
**Goal**: Users can see the Notebook card editor rendered inside the SuperWidget canvas slot, with the status slot reflecting the selected card title and destroy safety preventing post-destroy auto-saves
**Depends on**: Phase 171
**Requirements**: ECNV-01, ECNV-02, ECNV-03, ECNV-04
**Success Criteria** (what must be TRUE):
  1. NotebookExplorer renders inside the SuperWidget canvas slot with SelectionProvider binding active — card content displays for the currently selected card
  2. SuperWidget status slot shows the selected card title, updating reactively when selection changes via SelectionProvider
  3. EditorCanvas.destroy() calls clearTimeout on the debounced auto-save timer, flushes unsaved content, and unsubscribes all 4 provider handles — a 600ms post-destroy bridge.send assertion finds no calls
  4. A card selected in a ViewCanvas (e.g., SuperGrid cell click) is visible to EditorCanvas on next mount via the shared SelectionProvider instance
**Plans**: TBD
**UI hint**: yes

### Phase 173: 3-Canvas E2E Gate
**Goal**: All 6 directional transitions between Explorer, View, and Editor canvases pass as a Playwright WebKit CI hard gate, and the CANV-06 plug-in seam invariant is verified at every phase boundary
**Depends on**: Phase 172
**Requirements**: INTG-01, INTG-02, INTG-03, INTG-04
**Success Criteria** (what must be TRUE):
  1. All 6 directional canvas transitions (Explorer→View, View→Explorer, View→Editor, Editor→View, Explorer→Editor, Editor→Explorer) pass in Playwright WebKit — _canvasEl has exactly one child after each transition
  2. A full 9-view cycle within ViewCanvas (list→grid→kanban→calendar→timeline→gallery→network→tree→supergrid) completes with zero orphaned DOM nodes or stale Worker subscriptions, including NetworkView force simulation stop
  3. readFileSync assertion on SuperWidget.ts confirms zero import references to ViewCanvas or EditorCanvas — CANV-06 preserved
  4. Rapid canvas switching (3+ transitions in under 500ms) produces no orphaned DOM and no stale subscriptions — destroy-before-mount ordering holds under timing stress
**Plans**: TBD

## Progress

<details>
<summary>✅ v13.1 Data Explorer Canvas (Phases 167-170) — SHIPPED 2026-04-21</summary>

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 167. ExplorerCanvas Core | v13.1 | 2/2 | Complete | 2026-04-21 |
| 168. Tab System | v13.1 | 2/2 | Complete | 2026-04-21 |
| 169. Status Slot | v13.1 | 2/2 | Complete | 2026-04-21 |
| 170. Integration Testing | v13.1 | 2/2 | Complete | 2026-04-21 |

</details>

### v13.2 View + Editor Canvases

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 171. ViewCanvas | v13.2 | 0/TBD | Not started | - |
| 172. EditorCanvas | v13.2 | 0/TBD | Not started | - |
| 173. 3-Canvas E2E Gate | v13.2 | 0/TBD | Not started | - |
