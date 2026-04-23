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
- ✅ **v13.3 SuperWidget Shell** - Phases 174-178 (shipped 2026-04-22)
- [ ] **v14.0 Horizontal Ribbon Navigation** - Phases 179-181

## Phases

<details>
<summary>Phases 1-178 -- archived milestones (see .planning/milestones/)</summary>

All phases 1-178 are archived in `.planning/milestones/` under their respective milestone directories.

</details>

### v14.0 Horizontal Ribbon Navigation

- [x] **Phase 179: Dock Wiring Repair** - Fix all broken click handlers so DockNav items correctly toggle explorers and switch views (completed 2026-04-22)
- [x] **Phase 180: Horizontal Ribbon Layout** - Reorient DockNav from vertical sidebar to horizontal ribbon row; update SuperWidget CSS grid (completed 2026-04-22)
- [x] **Phase 181: Stub Ribbon Rows** - Add Stories and Datasets ribbon rows as disabled placeholder bars below the navigation ribbon (completed 2026-04-23)

## Phase Details

### Phase 179: Dock Wiring Repair
**Goal**: All dock navigation items respond correctly to user clicks — explorers toggle, views switch, and active state is visually reflected
**Depends on**: Nothing (first phase of milestone)
**Requirements**: WIRE-01, WIRE-02, WIRE-03, WIRE-04, WIRE-05, WIRE-06
**Success Criteria** (what must be TRUE):
  1. User clicks the Data Explorer dock icon and the explorer panel appears or disappears in the sidecar
  2. User clicks the Filter dock icon and the LATCH filters panel toggles in the sidecar
  3. User clicks the Formulas dock icon and the formulas panel toggles in the sidecar
  4. User clicks any Visualize section icon (SuperGrid, Timeline, Maps, Charts, Graphs) and the active view switches
  5. User clicks the Settings icon and the settings panel or command palette opens
  6. The currently active dock item is visually distinguished from inactive items (accent color, background, or indicator)
**Plans:** 1/1 plans complete
Plans:
- [x] 179-01-PLAN.md — Wire help section handlers and mount-time dock state sync
**UI hint**: yes

### Phase 180: Horizontal Ribbon Layout
**Goal**: Navigation renders as a horizontal ribbon bar spanning full viewport width, with verb-noun sections flowing left-to-right and the canvas reclaiming the sidebar column
**Depends on**: Phase 179
**Requirements**: HRIB-01, HRIB-02, HRIB-03, HRIB-04, HRIB-05, HRIB-06, HRIB-07
**Success Criteria** (what must be TRUE):
  1. The navigation bar appears as a horizontal strip below the tab strip, not as a left sidebar column
  2. Verb-noun sections (Integrate / Visualize / Analyze / Activate / Help) are arranged left-to-right with visible dividers between them
  3. Each navigation item shows its Lucide icon and text label side-by-side in a horizontal layout
  4. The canvas area stretches to the full viewport width with no 48px sidebar gap on the left
  5. Pressing ArrowLeft / ArrowRight moves keyboard focus between ribbon items (not ArrowUp / ArrowDown)
  6. The active ribbon item is highlighted with the accent color consistent with the previous dock active state
**Plans:** 2/2 plans complete
Plans:
- [x] 180-01-PLAN.md — Restructure SuperWidget CSS Grid (remove sidebar column, add ribbon row) and update mount points
- [x] 180-02-PLAN.md — Rewrite DockNav and dock-nav.css for horizontal ribbon layout
**UI hint**: yes

### Phase 181: Stub Ribbon Rows
**Goal**: Two additional ribbon rows (Stories and Datasets) appear below the navigation ribbon as visible-but-disabled placeholders, communicating future capability without allowing interaction
**Depends on**: Phase 180
**Requirements**: STOR-01, STOR-02, STOR-03, DSET-01, DSET-02, DSET-03
**Success Criteria** (what must be TRUE):
  1. A Stories ribbon row is visible below the navigation ribbon with labeled placeholder items (e.g., "New Story", "Play", "Share")
  2. A Datasets ribbon row is visible below the Stories ribbon with labeled placeholder items (e.g., "Import", "Export", "Browse")
  3. All Stories and Datasets items are visually greyed out and display a not-allowed cursor on hover
  4. Clicking any Stories or Datasets item produces no action or navigation change
**Plans:** 1/1 plans complete
Plans:
- [x] 181-01-PLAN.md — Add Stories and Datasets stub ribbon rows with disabled placeholder items
**UI hint**: yes

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 179. Dock Wiring Repair | 1/1 | Complete    | 2026-04-22 |
| 180. Horizontal Ribbon Layout | 2/2 | Complete    | 2026-04-22 |
| 181. Stub Ribbon Rows | 1/1 | Complete    | 2026-04-23 |
