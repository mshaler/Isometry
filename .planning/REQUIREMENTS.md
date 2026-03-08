# Requirements: Isometry v5.0 Designer Workbench

**Defined:** 2026-03-08
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.

## v5.0 Requirements

Requirements for v5.0 Designer Workbench milestone. Each maps to roadmap phases.

### Shell Scaffolding

- [x] **SHEL-01**: WorkbenchShell creates vertical stack layout under #app with .workbench-shell flex-column container
- [x] **SHEL-02**: CollapsibleSection reusable primitive with expand/collapse animation, keyboard operation (Enter/Space), and aria-expanded
- [x] **SHEL-03**: CommandBar renders app icon trigger, command input (opens existing CommandPalette), and settings menu trigger
- [x] **SHEL-04**: ViewManager re-rooted from #app to .workbench-view-content sub-element
- [x] **SHEL-05**: SuperGrid renders identically in new mount point -- all existing SuperGrid tests pass without modification
- [x] **SHEL-06**: All new CSS selectors scoped under .workbench-shell -- no bare element selectors, no global box-sizing resets

### Properties Explorer

- [x] **PROP-01**: PropertiesExplorer displays properties grouped by LATCH axis families in columns
- [x] **PROP-02**: Property catalog derived from PAFVProvider metadata (not static mock data)
- [x] **PROP-03**: Per-property toggle checkbox enables/disables axis availability
- [x] **PROP-04**: Inline display name editing per property (click-to-edit span-to-input swap)
- [x] **PROP-05**: Column collapse/expand per axis group with count badges

### Projection Explorer

- [x] **PROJ-01**: ProjectionExplorer renders 4 wells (available, x, y, z) displaying property chips
- [x] **PROJ-02**: User can drag property chips between wells using native HTML5 DnD
- [x] **PROJ-03**: User can reorder property chips within a well via drag
- [x] **PROJ-04**: Validation guards prevent duplicate insertion and enforce x/y wells retain at least 1 property
- [x] **PROJ-05**: Z-plane controls: display field select, audit toggle, card density select, aggregation mode select
- [x] **PROJ-06**: Aggregation mode maps to SQL GROUP BY via PAFVProvider.setAggregation() -- not visual-only
- [x] **PROJ-07**: All well/control changes flow through providers + StateCoordinator.scheduleUpdate() only

### Visual Explorer

- [x] **VISL-01**: Visual Explorer wraps existing SuperGrid with left vertical zoom rail slider
- [x] **VISL-02**: Zoom slider wired bidirectionally to SuperPositionProvider.zoomLevel
- [x] **VISL-03**: Visual Explorer section uses fillRemaining (flex: 1 1 auto) for available vertical space

### LATCH Explorers

- [x] **LTCH-01**: LatchExplorers renders collapsible sections for each LATCH axis (Location, Alphabet, Time, Category, Hierarchy)
- [x] **LTCH-02**: Filter controls wired to existing FilterProvider -- no parallel filter stack

### Notebook Explorer

- [x] **NOTE-01**: NotebookExplorer v1 with resizable two-pane layout (textarea editor + sanitized HTML preview)
- [x] **NOTE-02**: Markdown rendered via marked + DOMPurify with strict allowlist preventing XSS in WKWebView context
- [x] **NOTE-03**: D3 chart preview stub container (.notebook-chart-preview) reserved for future use
- [x] **NOTE-04**: Session-only persistence -- no writes to IsometryDatabase

### Integration

- [x] **INTG-01**: Explorer modules follow mount/update/destroy lifecycle API pattern
- [x] **INTG-02**: Provider references injected via constructor from WorkbenchShell (no singleton imports)
- [x] **INTG-03**: Incremental DOM updates via D3 selection.join for repeated structures (chips, rows, menu items)
- [x] **INTG-04**: ARIA roles on menus (role="menu"/role="menuitem"), wells (role="listbox"/role="option"), collapsible headers (aria-expanded)
- [x] **INTG-05**: Existing test suite (typecheck, lint, vitest) remains green throughout all phases

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
| SHEL-01 | Phase 54 | Complete |
| SHEL-02 | Phase 54 | Complete |
| SHEL-03 | Phase 54 | Complete |
| SHEL-04 | Phase 54 | Complete |
| SHEL-05 | Phase 54 | Complete |
| SHEL-06 | Phase 54 | Complete |
| PROP-01 | Phase 55 | Complete |
| PROP-02 | Phase 55 | Complete |
| PROP-03 | Phase 55 | Complete |
| PROP-04 | Phase 55 | Complete |
| PROP-05 | Phase 55 | Complete |
| PROJ-01 | Phase 55 | Complete |
| PROJ-02 | Phase 55 | Complete |
| PROJ-03 | Phase 55 | Complete |
| PROJ-04 | Phase 55 | Complete |
| PROJ-05 | Phase 55 | Complete |
| PROJ-06 | Phase 55 | Complete |
| PROJ-07 | Phase 55 | Complete |
| VISL-01 | Phase 56 | Complete |
| VISL-02 | Phase 56 | Complete |
| VISL-03 | Phase 56 | Complete |
| LTCH-01 | Phase 56 | Complete |
| LTCH-02 | Phase 56 | Complete |
| NOTE-01 | Phase 57 | Complete |
| NOTE-02 | Phase 57 | Complete |
| NOTE-03 | Phase 57 | Complete |
| NOTE-04 | Phase 57 | Complete |
| INTG-01 | Phase 54 | Complete |
| INTG-02 | Phase 54 | Complete |
| INTG-03 | Phase 55 | Complete |
| INTG-04 | Phase 54 | Complete |
| INTG-05 | Phase 54 | Complete |

**Coverage:**
- v5.0 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

---
*Requirements defined: 2026-03-08*
*Last updated: 2026-03-08 after initial definition*
