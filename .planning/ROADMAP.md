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
- 🚧 **v12.0 Explorer Panel Polish** - Phases 155-160 (in progress)

## Phases

<details>
<summary>✅ Phases 1-154 -- archived milestones (see .planning/milestones/)</summary>

All phases 1-154 are archived in `.planning/milestones/` under their respective milestone directories.

</details>

### 🚧 v12.0 Explorer Panel Polish (In Progress)

**Milestone Goal:** Clean up all 8 explorer panels with consistent CSS scoping, unified behavioral patterns via PanelManager, complete content/UX across Catalog and CalcExplorer, and accessibility gap closure.

- [ ] **Phase 155: CSS Namespace + Design Token Audit** - Scope all explorer CSS to component namespaces and replace hardcoded values with design tokens
- [ ] **Phase 156: PanelManager Extraction** - Extract explorer show/hide/toggle orchestration from main.ts into PanelManager wired to PanelRegistry
- [ ] **Phase 157: Persistence + SchemaProvider Wiring** - Unify explorer state persistence and wire AlgorithmExplorer/CalcExplorer to SchemaProvider
- [ ] **Phase 158: Explorer Accessibility + Event Delegation** - Close ARIA gaps across explorers and apply event delegation to dynamic content
- [ ] **Phase 159: DataExplorer Catalog Completion** - Complete Catalog section with dataset management, re-import, delete, and active highlighting
- [ ] **Phase 160: Visual Polish + CalcExplorer Feedback** - Finalize layout boundaries, typography hierarchy, and CalcExplorer visual feedback

## Phase Details

### Phase 155: CSS Namespace + Design Token Audit
**Goal**: Every explorer's CSS is self-contained with zero cross-component class collisions and zero hardcoded px/color values
**Depends on**: Nothing (first phase)
**Requirements**: VCSS-01, VCSS-02, VCSS-03, VCSS-04
**Success Criteria** (what must be TRUE):
  1. AlgorithmExplorer renders identically after migrating from `.nv-*` to `.algo-explorer__*` selectors
  2. VisualExplorer renders identically after migrating from `.dim-btn`/`.dim-switcher` to `.visual-explorer__*` selectors
  3. grep for hardcoded px/color values in explorer CSS files returns zero matches (all use `--space-*`, `--text-*`, `--border-*`, `--bg-*` tokens)
  4. No explorer CSS selector matches elements in a different explorer panel
**Plans**: 2 plans
Plans:
- [ ] 155-01-PLAN.md — AlgorithmExplorer + VisualExplorer CSS namespace migration (VCSS-03, VCSS-04)
- [ ] 155-02-PLAN.md — Remaining 6 explorers namespace + token audit (VCSS-01, VCSS-02)
**UI hint**: yes

### Phase 156: PanelManager Extraction
**Goal**: Explorer panel orchestration is owned by a single PanelManager class wired to PanelRegistry, not scattered across main.ts
**Depends on**: Nothing (independent of Phase 155)
**Requirements**: BEHV-01, BEHV-02, BEHV-03
**Success Criteria** (what must be TRUE):
  1. PanelManager class exists with show/hide/toggle methods for all 8 explorer panels
  2. PanelManager uses the existing PanelRegistry infrastructure for lifecycle management
  3. main.ts no longer contains explorer toggle logic (~300 LOC removed)
  4. All explorer show/hide/toggle behaviors work identically to before extraction (no regression)
**Plans**: 2 plans
Plans:
- [ ] 155-01-PLAN.md — AlgorithmExplorer + VisualExplorer CSS namespace migration (VCSS-03, VCSS-04)
- [ ] 155-02-PLAN.md — Remaining 6 explorers namespace + token audit (VCSS-01, VCSS-02)

### Phase 157: Persistence + SchemaProvider Wiring
**Goal**: All explorers follow a single documented persistence pattern, and AlgorithmExplorer/CalcExplorer use dynamic schema fields instead of hardcoded fallbacks
**Depends on**: Nothing (independent of Phases 155-156)
**Requirements**: BEHV-04, BEHV-05, BEHV-06, BEHV-07
**Success Criteria** (what must be TRUE):
  1. Every explorer that persists state uses bridge `ui:set` for durable state and transient variables for ephemeral state -- no mixed patterns
  2. PropertiesExplorer uses a single persistence path (not three)
  3. AlgorithmExplorer populates numeric field dropdowns from SchemaProvider instead of NUMERIC_FIELDS_FALLBACK
  4. CalcExplorer populates column lists from SchemaProvider instead of hardcoded field sets
  5. Importing a dataset with custom numeric columns makes those columns appear in AlgorithmExplorer and CalcExplorer without code changes
**Plans**: 2 plans
Plans:
- [ ] 155-01-PLAN.md — AlgorithmExplorer + VisualExplorer CSS namespace migration (VCSS-03, VCSS-04)
- [ ] 155-02-PLAN.md — Remaining 6 explorers namespace + token audit (VCSS-01, VCSS-02)

### Phase 158: Explorer Accessibility + Event Delegation
**Goal**: All explorer interactive elements have proper ARIA attributes and dynamic content uses event delegation
**Depends on**: Phase 155 (CSS namespaces must be stable before adding aria attributes to renamed elements)
**Requirements**: EXPX-01, EXPX-02, EXPX-03, EXPX-10
**Success Criteria** (what must be TRUE):
  1. LatchExplorers category chips have `aria-selected` reflecting whether the chip's filter is active
  2. ProjectionExplorer drop zones have descriptive `aria-label` attributes
  3. CalcExplorer column dropdowns have associated labels (via `aria-label` or `<label>`)
  4. LatchExplorers chips and PropertiesExplorer toggles use event delegation (single handler on container) instead of per-element listeners
**Plans**: 2 plans
Plans:
- [ ] 155-01-PLAN.md — AlgorithmExplorer + VisualExplorer CSS namespace migration (VCSS-03, VCSS-04)
- [ ] 155-02-PLAN.md — Remaining 6 explorers namespace + token audit (VCSS-01, VCSS-02)
**UI hint**: yes

### Phase 159: DataExplorer Catalog Completion
**Goal**: Users can manage their datasets directly from the DataExplorer Catalog section
**Depends on**: Phase 156 (PanelManager ensures DataExplorer panel lifecycle is correct)
**Requirements**: EXPX-04, EXPX-05, EXPX-06, EXPX-07
**Success Criteria** (what must be TRUE):
  1. Catalog section lists all imported datasets with source type, card count, and import date
  2. User can trigger re-import for any dataset from its Catalog row
  3. User can delete a dataset with a confirmation dialog from its Catalog row
  4. The active/selected dataset row is visually highlighted
**Plans**: 2 plans
Plans:
- [ ] 155-01-PLAN.md — AlgorithmExplorer + VisualExplorer CSS namespace migration (VCSS-03, VCSS-04)
- [ ] 155-02-PLAN.md — Remaining 6 explorers namespace + token audit (VCSS-01, VCSS-02)
**UI hint**: yes

### Phase 160: Visual Polish + CalcExplorer Feedback
**Goal**: Explorer layout has clear visual boundaries and CalcExplorer provides feedback on active aggregations and column types
**Depends on**: Phase 155 (design tokens), Phase 158 (accessibility attributes in place)
**Requirements**: VCSS-05, VCSS-06, EXPX-08, EXPX-09
**Success Criteria** (what must be TRUE):
  1. DockNav strip, top-slot explorers, view content, and bottom-slot explorers have distinct visual boundaries (border/spacing/background differentiation)
  2. All explorer headers, labels, and content follow a consistent typography scale hierarchy
  3. CalcExplorer columns with active aggregations show a visual indicator (glyph or highlight)
  4. CalcExplorer columns show type indicators distinguishing numeric from text columns
**Plans**: 2 plans
Plans:
- [ ] 155-01-PLAN.md — AlgorithmExplorer + VisualExplorer CSS namespace migration (VCSS-03, VCSS-04)
- [ ] 155-02-PLAN.md — Remaining 6 explorers namespace + token audit (VCSS-01, VCSS-02)
**UI hint**: yes

## Progress

**Execution Order:**
Phases 155, 156, 157 have no mutual dependencies and could execute in any order.
Phase 158 depends on 155. Phase 159 depends on 156. Phase 160 depends on 155 + 158.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 155. CSS Namespace + Design Token Audit | v12.0 | 0/TBD | Not started | - |
| 156. PanelManager Extraction | v12.0 | 0/TBD | Not started | - |
| 157. Persistence + SchemaProvider Wiring | v12.0 | 0/TBD | Not started | - |
| 158. Explorer Accessibility + Event Delegation | v12.0 | 0/TBD | Not started | - |
| 159. DataExplorer Catalog Completion | v12.0 | 0/TBD | Not started | - |
| 160. Visual Polish + CalcExplorer Feedback | v12.0 | 0/TBD | Not started | - |
