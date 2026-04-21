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
- 🚧 **v13.0 SuperWidget Substrate** - Phases 162-166 (in progress)

## Phases

<details>
<summary>✅ Phases 1-161 -- archived milestones (see .planning/milestones/)</summary>

All phases 1-161 are archived in `.planning/milestones/` under their respective milestone directories.

</details>

### 🚧 v13.0 SuperWidget Substrate (In Progress)

**Milestone Goal:** Implement the SuperWidget four-slot substrate and projection state machine — the universal container primitive that every zone-based navigation flow depends on.

- [ ] **Phase 162: Substrate Layout** - CSS Grid four-slot DOM skeleton with --sw-* tokens and mount/destroy lifecycle
- [ ] **Phase 163: Projection State Machine** - Pure transition functions (switchTab, setCanvas, setBinding, toggleTabEnabled) with reference equality contract
- [ ] **Phase 164: Projection Rendering** - commitProjection validation, slot-scoped re-renders, and zone theme header
- [ ] **Phase 165: Canvas Stubs + Registry** - Three Canvas type stubs with CanvasComponent interface and canvas registry plug-in seam
- [ ] **Phase 166: Integration Testing** - Cross-seam tests covering the full projection-to-DOM path plus Playwright WebKit CI smoke

## Phase Details

<details>
<summary>✅ Phases 1-161 -- archived milestones (see .planning/milestones/)</summary>

Phase detail sections for Phases 1-161 are archived in `.planning/milestones/` under their respective milestone directories.

</details>

### Phase 162: Substrate Layout
**Goal**: SuperWidget renders as a four-slot CSS Grid container with correct DOM structure, custom properties, and lifecycle
**Depends on**: Nothing (first v13.0 phase)
**Requirements**: SLAT-01, SLAT-02, SLAT-03, SLAT-04, SLAT-05, SLAT-06, SLAT-07
**Success Criteria** (what must be TRUE):
  1. SuperWidget mounts into any container via mount(el) and removes all DOM via destroy() with no leaks
  2. Four named slots (header, canvas, status, tabs) exist in the DOM with correct data-slot attributes and CSS Grid layout
  3. Config gear renders as the last tab-bar child with data-tab-role="config" and is right-aligned via margin-left: auto (flex container)
  4. Status slot occupies zero height when empty (min-height: 0, no display: none) and non-zero height when populated
  5. Tab bar scrolls horizontally with CSS mask-image edge fade when tabs overflow the container width
  6. SuperWidget root element has flex: 1 1 auto; min-height: 0 preventing CSS Grid height collapse in a flex chain
  7. All SuperWidget CSS uses --sw-* custom property namespace; no style is injected via link tags
**Plans**: 2 plans
Plans:
- [x] 162-01-PLAN.md — SuperWidget class + CSS Grid layout + --sw-* tokens
- [x] 162-02-PLAN.md — TDD test suite verifying all SLAT requirements
**UI hint**: yes

### Phase 163: Projection State Machine
**Goal**: All five projection transition functions are pure, composable, and uphold a strict reference equality contract
**Depends on**: Phase 162 (Projection type must map to the slot structure established in Phase 162)
**Requirements**: PROJ-01, PROJ-02, PROJ-03, PROJ-04, PROJ-05, PROJ-06, PROJ-07
**Success Criteria** (what must be TRUE):
  1. A Projection value can be constructed with all required fields (canvasType, canvasBinding, zoneRole, canvasId, activeTabId, enabledTabIds) and round-trips through JSON serialization without data loss
  2. switchTab with an invalid tabId returns the exact same object reference, not a structurally equal copy
  3. setBinding with Bound on a non-View canvas type returns the original reference unchanged
  4. toggleTabEnabled returns the original reference when the tab's enabled state would not change
  5. validateProjection catches all four invalid states (invalid activeTabId, Bound on non-View, empty canvasId, empty enabledTabIds) and returns {valid: false, reason} without throwing
  6. All transition functions produce the same output for the same input across repeated calls (pure, no hidden state)
**Plans**: 2 plans
Plans:
- [x] 163-01-PLAN.md — TDD: Projection type + 4 transition functions (PROJ-01..05)
- [x] 163-02-PLAN.md — TDD: validateProjection + purity assertions (PROJ-06..07)





### Phase 164: Projection Rendering
**Goal**: SuperWidget renders projection state to the DOM with slot-scoped updates and safe commit validation
**Depends on**: Phase 162 (slots must exist), Phase 163 (Projection type and transition functions must be defined)
**Requirements**: RNDR-01, RNDR-02, RNDR-03, RNDR-04, RNDR-05
**Success Criteria** (what must be TRUE):
  1. commitProjection with a valid Projection mounts the correct canvas content into the canvas slot
  2. commitProjection with an invalid Projection logs a console warning, leaves the DOM unchanged, and does not call the canvas factory
  3. Switching the active tab increments the canvas slot's data-render-count but leaves header, status, and tabs slots at their prior render counts
  4. Switching canvas type calls destroy() on the prior canvas instance before mount() on the new canvas, resetting canvas data-render-count to 1
  5. The header slot displays the human-readable zone theme label derived from projection.zoneRole without querying any parent component
**Plans**: 2 plans
Plans:
- [ ] 162-01-PLAN.md — SuperWidget class + CSS Grid layout + --sw-* tokens
- [ ] 162-02-PLAN.md — TDD test suite verifying all SLAT requirements
**UI hint**: yes

### Phase 165: Canvas Stubs + Registry
**Goal**: Three Canvas type stubs implement the CanvasComponent interface and register in a canvas registry that SuperWidget references only via interface
**Depends on**: Phase 163 (CanvasComponent interface is defined in projection.ts or companion types file), Phase 164 (SuperWidget.ts calls the interface methods)
**Requirements**: CANV-01, CANV-02, CANV-03, CANV-04, CANV-05, CANV-06, CANV-07
**Success Criteria** (what must be TRUE):
  1. ExplorerCanvasStub mounts an element with data-canvas-type="Explorer", displays its canvasId, and increments data-render-count on each mount call
  2. ViewCanvasStub in Bound mode renders a data-sidecar child element alongside the main canvas element; in Unbound mode the data-sidecar element is absent
  3. EditorCanvasStub mounts with data-canvas-type="Editor" and has no sidecar affordance
  4. Canvas registry lookup by canvasId returns a typed CanvasRegistryEntry; lookup for an unknown canvasId returns undefined without throwing
  5. View registry entries expose a defaultExplorerId string that SuperWidget can read without knowing the concrete stub class
  6. SuperWidget.ts contains zero direct references to ExplorerCanvasStub, ViewCanvasStub, or EditorCanvasStub class names
  7. All three stub files begin with a comment marking them as stubs for replacement in v13.1+
**Plans**: 2 plans
Plans:
- [ ] 162-01-PLAN.md — SuperWidget class + CSS Grid layout + --sw-* tokens
- [ ] 162-02-PLAN.md — TDD test suite verifying all SLAT requirements
**UI hint**: yes

### Phase 166: Integration Testing
**Goal**: The full projection-to-DOM path is verified by cross-seam tests and a Playwright WebKit smoke test passes in CI
**Depends on**: Phase 162, Phase 163, Phase 164, Phase 165 (full substrate must be in place before cross-seam path can be tested end-to-end)
**Requirements**: INTG-01, INTG-02, INTG-03, INTG-04, INTG-05, INTG-06, INTG-07
**Success Criteria** (what must be TRUE):
  1. Transitioning from Explorer canvas to View/Bound canvas causes a data-sidecar element to appear in the DOM and the header zone label to update
  2. Transitioning from View/Bound to View/Unbound removes the data-sidecar element without unmounting the view canvas
  3. Transitioning from View canvas to Editor canvas updates the header zone label and leaves no trace of the prior View canvas in the DOM
  4. Committing an invalid projection (Bound binding on an Editor canvas) produces no DOM change and a console.warn call
  5. Switching to a disabled tabId via switchTab preserves the original Projection object reference (verified by strict equality)
  6. Committing 10 projections in rapid succession results in exactly the final canvas state mounted with no intermediate canvas instances leaking into the DOM
  7. The Playwright WebKit smoke test exercises the full integration matrix and passes as a CI hard gate
**Plans**: 2 plans
Plans:
- [ ] 162-01-PLAN.md — SuperWidget class + CSS Grid layout + --sw-* tokens
- [ ] 162-02-PLAN.md — TDD test suite verifying all SLAT requirements

## Progress

**Execution Order:**
Phase 162 gates all others. Phase 163 can begin once the Projection type is sketched in Phase 162.
Phase 164 depends on 162 + 163. Phase 165 depends on 163 + 164. Phase 166 depends on all of 162-165.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 155. CSS Namespace + Design Token Audit | v12.0 | 3/3 | Complete | 2026-04-17 |
| 156. PanelManager Extraction | v12.0 | 2/2 | Complete | 2026-04-17 |
| 157. Persistence + SchemaProvider Wiring | v12.0 | 2/2 | Complete | 2026-04-18 |
| 158. Explorer Accessibility + Event Delegation | v12.0 | 2/2 | Complete | 2026-04-18 |
| 159. DataExplorer Catalog Completion | v12.0 | 2/2 | Complete | 2026-04-18 |
| 160. Visual Polish + CalcExplorer Feedback | v12.0 | 2/2 | Complete | 2026-04-18 |
| 161. Explorer Layout Constraints + Dismiss Affordance | v12.0 | 2/2 | Complete | 2026-04-18 |
| 162. Substrate Layout | v13.0 | 2/2 | Complete    | 2026-04-21 |
| 163. Projection State Machine | v13.0 | 2/2 | Complete    | 2026-04-21 |
| 164. Projection Rendering | v13.0 | 0/? | Not started | - |
| 165. Canvas Stubs + Registry | v13.0 | 0/? | Not started | - |
| 166. Integration Testing | v13.0 | 0/? | Not started | - |
