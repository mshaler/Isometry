# Phase 74 Requirements: SuperGrid Phase B

## Requirements Traceability

All requirements derived from `specs/SuperGrid-Specification.md` Sections 2.2 (SuperDynamic), 2.3 (SuperSize), 2.6 (SuperSelect), 2.7 (SuperPosition), and Section 11 (MVP Acceptance Criteria).

## Requirements

### SuperDynamic — Axis Repositioning (Plan 74-01)

| ID | Requirement | Source | Acceptance Criteria |
|----|-------------|--------|---------------------|
| DYN-01 | Drag column header to row header area triggers grid reflow | Spec 2.2 | Rows become columns, columns become rows, data integrity maintained |
| DYN-02 | MiniNav serves as staging area for axes | Spec 2.2 | Drag axis to MiniNav removes from grid, aggregates data |
| DYN-03 | Visual cues during drag: ghost header, insertion indicator | Spec 2.2 | Ghost visible at 50% opacity, insertion line at drop target |
| DYN-04 | Grid reflows with D3 transition after drop | Spec 2.2 | Transition < 500ms, 60fps |
| DYN-05 | Cancel drag with Escape returns header to original | Spec 2.2 | No state change on cancel |

### SuperSize — Cell & Header Sizing (Plan 74-02)

| ID | Requirement | Source | Acceptance Criteria |
|----|-------------|--------|---------------------|
| SIZE-01 | Drag right edge of header to resize single column/row | Spec 2.3 | Smooth drag, snap to pixel grid |
| SIZE-02 | Shift+drag resizes all sibling cells proportionally | Spec 2.3 | All same-level headers resize equally |
| SIZE-03 | Minimum cell dimensions enforced (40px) | Spec 2.3 | Column stops at minimum width |
| SIZE-04 | Sizes persist per-dataset | Spec 2.3 | Sizes match after reload |
| SIZE-05 | Double-click resize edge auto-fits to content | Spec 6 | Width adjusts to fit longest content |

### SuperSelect — Z-Axis Selection (Plan 74-03)

| ID | Requirement | Source | Acceptance Criteria |
|----|-------------|--------|---------------------|
| SEL-01 | Click data cell selects that card (checkbox toggle) | Spec 2.6 | Selection state updates in SelectionProvider |
| SEL-02 | Click parent header selects all children at that level | Spec 2.6 | Selection count = child count |
| SEL-03 | Cmd+click for multi-select | Spec 2.6 | All clicked items in selection array |
| SEL-04 | Shift+click for range select | Spec 2.6 | Rectangular range selection |
| SEL-05 | Lasso select respects current z-level | Spec 2.6 | No headers in selection when lasso over data |
| SEL-06 | Every card has selection checkbox | Spec 2.6 | Checkbox visible, clickable |
| SEL-07 | Selection survives view transitions (Tier 1) | Spec 5 | Same cards selected after Grid → Kanban → Grid |

### SuperPosition — Coordinate Tracking (Plan 74-04)

| ID | Requirement | Source | Acceptance Criteria |
|----|-------------|--------|---------------------|
| POS-01 | Each card maintains PAFV coordinates (logical, not pixel) | Spec 2.7 | Coordinates derived from LATCH properties |
| POS-02 | View transitions recompute position from axis mappings | Spec 2.7 | Card visible in correct location after transition |
| POS-03 | Custom sort orders tracked contextually | Spec 2.7 | Sort order matches pre-transition after round-trip |
| POS-04 | Position after filter removal returns to original | Spec 2.7 | No position drift |

## Coverage Matrix

| Plan | Requirements | Count |
|------|-------------|-------|
| 74-01 | DYN-01, DYN-02, DYN-03, DYN-04, DYN-05 | 5 |
| 74-02 | SIZE-01, SIZE-02, SIZE-03, SIZE-04, SIZE-05 | 5 |
| 74-03 | SEL-01, SEL-02, SEL-03, SEL-04, SEL-05, SEL-06, SEL-07 | 7 |
| 74-04 | POS-01, POS-02, POS-03, POS-04 | 4 |

**Total Requirements:** 21
**Total Plans:** 4
**Coverage:** 100%

## Testing Requirements

### Unit Tests
- [ ] Drag state machine transitions
- [ ] Resize constraint enforcement
- [ ] Selection set operations (add, remove, toggle, range)
- [ ] PAFV coordinate calculation

### Integration Tests
- [ ] Axis drag → PAFVContext update → grid reflow
- [ ] Resize → SQLite persist → reload verification
- [ ] Selection → view transition → selection preserved
- [ ] Filter remove → position restoration

### Visual Regression
- [ ] Ghost header during drag
- [ ] Selection highlighting
- [ ] Resize handle appearance
