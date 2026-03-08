# Requirements: Isometry v5.0 Designer Workbench

**Defined:** 2026-03-08
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.

## v5.0 Requirements

Requirements for v5.0 Designer Workbench milestone. Each maps to roadmap phases.

### Shell Scaffolding

- [ ] **SHEL-01**: WorkbenchShell creates vertical stack layout under #app with .workbench-shell flex-column container
- [ ] **SHEL-02**: CollapsibleSection reusable primitive with expand/collapse animation, keyboard operation (Enter/Space), and aria-expanded
- [ ] **SHEL-03**: CommandBar renders app icon trigger, command input (opens existing CommandPalette), and settings menu trigger
- [ ] **SHEL-04**: ViewManager re-rooted from #app to .workbench-view-content sub-element
- [ ] **SHEL-05**: SuperGrid renders identically in new mount point -- all existing SuperGrid tests pass without modification
- [ ] **SHEL-06**: All new CSS selectors scoped under .workbench-shell -- no bare element selectors, no global box-sizing resets

### Properties Explorer

- [ ] **PROP-01**: PropertiesExplorer displays properties grouped by LATCH axis families in columns
- [ ] **PROP-02**: Property catalog derived from PAFVProvider metadata (not static mock data)
- [ ] **PROP-03**: Per-property toggle checkbox enables/disables axis availability
- [ ] **PROP-04**: Inline display name editing per property (click-to-edit span-to-input swap)
- [ ] **PROP-05**: Column collapse/expand per axis group with count badges

### Projection Explorer

- [ ] **PROJ-01**: ProjectionExplorer renders 4 wells (available, x, y, z) displaying property chips
- [ ] **PROJ-02**: User can drag property chips between wells using native HTML5 DnD
- [ ] **PROJ-03**: User can reorder property chips within a well via drag
- [ ] **PROJ-04**: Validation guards prevent duplicate insertion and enforce x/y wells retain at least 1 property
- [ ] **PROJ-05**: Z-plane controls: display field select, audit toggle, card density select, aggregation mode select
- [ ] **PROJ-06**: Aggregation mode maps to SQL GROUP BY via PAFVProvider.setAggregation() -- not visual-only
- [ ] **PROJ-07**: All well/control changes flow through providers + StateCoordinator.scheduleUpdate() only

### Visual Explorer

- [ ] **VISL-01**: Visual Explorer wraps existing SuperGrid with left vertical zoom rail slider
- [ ] **VISL-02**: Zoom slider wired bidirectionally to SuperPositionProvider.zoomLevel
- [ ] **VISL-03**: Visual Explorer section uses fillRemaining (flex: 1 1 auto) for available vertical space

### LATCH Explorers

- [ ] **LTCH-01**: LatchExplorers renders collapsible sections for each LATCH axis (Location, Alphabet, Time, Category, Hierarchy)
- [ ] **LTCH-02**: Filter controls wired to existing FilterProvider -- no parallel filter stack

### Notebook Explorer

- [ ] **NOTE-01**: NotebookExplorer v1 with resizable two-pane layout (textarea editor + sanitized HTML preview)
- [ ] **NOTE-02**: Markdown rendered via marked + DOMPurify with strict allowlist preventing XSS in WKWebView context
- [ ] **NOTE-03**: D3 chart preview stub container (.notebook-chart-preview) reserved for future use
- [ ] **NOTE-04**: Session-only persistence -- no writes to IsometryDatabase

### Integration

- [ ] **INTG-01**: Explorer modules follow mount/update/destroy lifecycle API pattern
- [ ] **INTG-02**: Provider references injected via constructor from WorkbenchShell (no singleton imports)
- [ ] **INTG-03**: Incremental DOM updates via D3 selection.join for repeated structures (chips, rows, menu items)
- [ ] **INTG-04**: ARIA roles on menus (role="menu"/role="menuitem"), wells (role="listbox"/role="option"), collapsible headers (aria-expanded)
- [ ] **INTG-05**: Existing test suite (typecheck, lint, vitest) remains green throughout all phases

## Future Requirements

### Notebook Phase B

- **NOTB-01**: Formatting toolbar with bold/italic/heading/list controls
- **NOTB-02**: D3 chart block rendering from bar schema in notebook content
- **NOTB-03**: Full markdown engine migration with code syntax highlighting

### LATCH Phase B

- **LTCB-01**: Time axis histogram scrubber for temporal filtering
- **LTCB-02**: Category axis tag chips with multi-select
- **LTCB-03**: Hierarchy axis tree band with expand/collapse

### Notebook Persistence

- **NPRST-01**: Notebook content persists to IsometryDatabase (after native actor migration)

## Out of Scope

| Feature | Reason |
|---------|--------|
| React/Tailwind/shadcn runtime | Pure TypeScript + D3/DOM per spec -- no framework |
| Notebook formatting toolbar | Deferred to Phase B (future polish) |
| D3 chart blocks in notebook | Deferred to Phase B (bar schema rendering) |
| Notebook persistence to database | Deferred until native SwiftUI/IsometryDatabase actor migration |
| LATCH histogram/chips/tree subpanes | Deferred to Phase B (skeleton + filter wiring first) |
| Secondary visualization in Visual Explorer | SuperGrid only -- no parallel chart |
| External DnD library | HTML5 native DnD sufficient; matches existing patterns |
| Custom theme for Workbench | Single canonical token-driven theme (spec resolved decision) |
| Code syntax highlighting | Deferred to Notebook Phase B |
| Mutual-exclusion accordion behavior | Independent collapse per panel (VS Code/Figma/Tableau pattern) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHEL-01 | Phase 54 | Pending |
| SHEL-02 | Phase 54 | Pending |
| SHEL-03 | Phase 54 | Pending |
| SHEL-04 | Phase 54 | Pending |
| SHEL-05 | Phase 54 | Pending |
| SHEL-06 | Phase 54 | Pending |
| PROP-01 | Phase 55 | Pending |
| PROP-02 | Phase 55 | Pending |
| PROP-03 | Phase 55 | Pending |
| PROP-04 | Phase 55 | Pending |
| PROP-05 | Phase 55 | Pending |
| PROJ-01 | Phase 55 | Pending |
| PROJ-02 | Phase 55 | Pending |
| PROJ-03 | Phase 55 | Pending |
| PROJ-04 | Phase 55 | Pending |
| PROJ-05 | Phase 55 | Pending |
| PROJ-06 | Phase 55 | Pending |
| PROJ-07 | Phase 55 | Pending |
| VISL-01 | Phase 56 | Pending |
| VISL-02 | Phase 56 | Pending |
| VISL-03 | Phase 56 | Pending |
| LTCH-01 | Phase 56 | Pending |
| LTCH-02 | Phase 56 | Pending |
| NOTE-01 | Phase 57 | Pending |
| NOTE-02 | Phase 57 | Pending |
| NOTE-03 | Phase 57 | Pending |
| NOTE-04 | Phase 57 | Pending |
| INTG-01 | Phase 54 | Pending |
| INTG-02 | Phase 54 | Pending |
| INTG-03 | Phase 55 | Pending |
| INTG-04 | Phase 54 | Pending |
| INTG-05 | Phase 54 | Pending |

**Coverage:**
- v5.0 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

---
*Requirements defined: 2026-03-08*
*Last updated: 2026-03-08 after initial definition*
