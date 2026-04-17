# Requirements — v11.1 Dock/Explorer Inline Embedding

## Milestone Requirements

### Removal

- [x] **RMV-01**: PanelDrawer side drawer is removed — no side panel column exists in the layout
- [x] **RMV-02**: PanelDrawer icon strip, resize handle, and drawer container are deleted from the DOM

### Integrate Section

- [x] **INTG-01**: User clicks Data icon in dock and Data Explorer + Properties Explorer appear at the top of the main view area (above the active view)
- [x] **INTG-02**: User clicks Data icon again and both Data Explorer + Properties Explorer hide (toggle behavior)

### Visualize Section

- [ ] **VIZ-01**: User clicks SuperGrids and the Projections Explorer appears above the SuperGrid view
- [ ] **VIZ-02**: User clicks a non-SuperGrid view (Timelines, Maps, Charts, Graphs) and the Projections Explorer is hidden — only the selected view shows
- [ ] **VIZ-03**: Switching from a non-SuperGrid view back to SuperGrids restores the Projections Explorer above the grid

### Analyze Section

- [x] **ANLZ-01**: User clicks Filters in dock and all 5 LATCH Filters appear below the active view
- [x] **ANLZ-02**: User clicks Filters again and LATCH Filters hide (toggle behavior)
- [x] **ANLZ-03**: LATCH Filters persist across view switches — if toggled on, they stay visible when switching between SuperGrids, Timelines, etc.
- [x] **ANLZ-04**: User clicks Formulas in dock and Formulas Explorer appears below the active view (below Filters if both visible)
- [x] **ANLZ-05**: User clicks Formulas again and Formulas Explorer hides (toggle behavior)

### Regression

- [ ] **REGR-01**: All existing tests pass with no regressions after explorer relocation

## Future Requirements

- iOS Stories Splash screen (SPLS-01..04 from v11.0) — deferred to post-v11.1 milestone
- Stories Explorer full mini-app implementation — deferred
- Notebooks Explorer inline embedding — deferred
- Calc Explorer inline embedding — deferred
- Algorithm Explorer inline embedding — deferred
- Visual Explorer (zoom rail) inline embedding — deferred
- Settings and Help panel integration — deferred

## Out of Scope

- PanelDrawer side drawer (replaced by inline embedding)
- Stories/Notebooks/Calc/Algorithm/Visual explorer embedding — explicit deferral
- Animated explorer open/close transitions — simplicity first, add later if needed
- Explorer drag-to-resize — fixed heights, revisit if users need it
- Formulas real implementation — stub gets replaced with inline placeholder, full engine deferred

## Traceability

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| RMV-01 | Phase 151 | — | Pending |
| RMV-02 | Phase 151 | — | Pending |
| INTG-01 | Phase 152 | — | Pending |
| INTG-02 | Phase 152 | — | Pending |
| VIZ-01 | Phase 152 | — | Pending |
| VIZ-02 | Phase 152 | — | Pending |
| VIZ-03 | Phase 152 | — | Pending |
| ANLZ-01 | Phase 153 | — | Pending |
| ANLZ-02 | Phase 153 | — | Pending |
| ANLZ-03 | Phase 153 | — | Pending |
| ANLZ-04 | Phase 153 | — | Pending |
| ANLZ-05 | Phase 153 | — | Pending |
| REGR-01 | Phase 154 | — | Pending |
