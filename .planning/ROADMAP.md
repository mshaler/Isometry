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
- 🔄 **v13.1 Data Explorer Canvas** - Phases 167-170 (active)

## Phases

<details>
<summary>✅ Phases 1-166 -- archived milestones (see .planning/milestones/)</summary>

All phases 1-166 are archived in `.planning/milestones/` under their respective milestone directories.

</details>

## v13.1 Data Explorer Canvas

### Phase 167: ExplorerCanvas Core
**Goal**: Users see a real Data Explorer mounted inside SuperWidget, replacing the stub placeholder
**Depends on**: Phase 166 (v13.0 Integration Testing — canvas registry, CanvasComponent interface, CANV-06 abstraction contract)
**Requirements**: EXCV-01, EXCV-04, EXCV-05
**Success Criteria** (what must be TRUE):
  1. SuperWidget mounts ExplorerCanvas and the canvas slot contains real DataExplorerPanel DOM (not a stub label)
  2. ExplorerCanvas is registered in the canvas registry via a factory function — SuperWidget.ts has zero `import` references to ExplorerCanvas
  3. ExplorerCanvas.mount() calls DataExplorerPanel section builders (Import/Export, Catalog, DB Utilities) without duplicating their logic
  4. ExplorerCanvas.destroy() tears down all DOM and event listeners cleanly with no leaks
**Plans**: 2 plans
Plans:
- [ ] 167-01-PLAN.md — ExplorerCanvas class + tests + CSS
- [ ] 167-02-PLAN.md — Wire SuperWidget into main.ts, remove sidebar
**UI hint**: yes

### Phase 168: Tab System
**Goal**: Users can switch between Import/Export, Catalog, and DB Utilities tabs inside the canvas slot
**Depends on**: Phase 167
**Requirements**: EXCV-02, EXCV-03
**Success Criteria** (what must be TRUE):
  1. Three tabs (Import/Export, Catalog, DB Utilities) are visible in the SuperWidget canvas slot and each renders the correct DataExplorerPanel section content
  2. Clicking a tab updates `activeTabId` on the Projection via commitProjection — the canvas slot swaps content without a full destroy/remount cycle
  3. The tab that was active when destroy() is called is reflected in the final Projection state (no state leak between mounts)
**Plans**: 2 plans
Plans:
- [ ] 167-01-PLAN.md — ExplorerCanvas class + tests + CSS
- [ ] 167-02-PLAN.md — Wire SuperWidget into main.ts, remove sidebar
**UI hint**: yes

### Phase 169: Status Slot
**Goal**: Users see live ingestion counts (cards, connections, last import) in the SuperWidget status slot
**Depends on**: Phase 167
**Requirements**: STAT-01, STAT-02, STAT-03, STAT-04
**Success Criteria** (what must be TRUE):
  1. Status slot shows current card count (SELECT COUNT(*) from cards WHERE deleted_at IS NULL) and updates immediately after an import or delete
  2. Status slot shows current connection count and updates on the same mutation events as card count
  3. Status slot shows the timestamp of the most recent import run from the import_runs catalog table, formatted as a human-readable relative time
  4. Updating the status slot does not trigger a canvas re-render or tab content swap — only the status slot DOM changes
**Plans**: 2 plans
Plans:
- [ ] 167-01-PLAN.md — ExplorerCanvas class + tests + CSS
- [ ] 167-02-PLAN.md — Wire SuperWidget into main.ts, remove sidebar
**UI hint**: yes

### Phase 170: Integration Testing
**Goal**: Cross-seam tests and Playwright CI smoke verify the full ExplorerCanvas path end-to-end
**Depends on**: Phase 168, Phase 169
**Requirements**: EINT-01, EINT-02, EINT-03, EINT-04
**Success Criteria** (what must be TRUE):
  1. A Vitest cross-seam test mounts ExplorerCanvas through the registry (no direct import) and asserts real DataExplorerPanel DOM is present — not a stub label
  2. A Vitest cross-seam test commits Projections with each of the three activeTabId values and asserts the correct section content appears in the canvas slot each time
  3. A Vitest cross-seam test simulates an import, then asserts the status slot card count and last-import timestamp reflect the new data
  4. The Playwright WebKit CI smoke test navigates to the ExplorerCanvas, switches tabs, and confirms the correct section heading is visible — wired as a hard gate in CI
**Plans**: 2 plans
Plans:
- [ ] 167-01-PLAN.md — ExplorerCanvas class + tests + CSS
- [ ] 167-02-PLAN.md — Wire SuperWidget into main.ts, remove sidebar

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 162. Substrate Layout | v13.0 | 2/2 | Complete | 2026-04-21 |
| 163. Projection State Machine | v13.0 | 2/2 | Complete | 2026-04-21 |
| 164. Projection Rendering | v13.0 | 2/2 | Complete | 2026-04-21 |
| 165. Canvas Stubs + Registry | v13.0 | 3/3 | Complete | 2026-04-21 |
| 166. Integration Testing | v13.0 | 2/2 | Complete | 2026-04-21 |
| 167. ExplorerCanvas Core | v13.1 | 0/2 | Planning complete | - |
| 168. Tab System | v13.1 | 0/? | Not started | - |
| 169. Status Slot | v13.1 | 0/? | Not started | - |
| 170. Integration Testing | v13.1 | 0/? | Not started | - |
