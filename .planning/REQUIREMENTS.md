# Requirements — v11.1 Dock/Explorer Inline Embedding

## Milestone Requirements

### Removal

- [ ] **RMV-01**: PanelDrawer side drawer is removed — no side panel column exists in the layout
- [ ] **RMV-02**: PanelDrawer icon strip, resize handle, and drawer container are deleted from the DOM

### Integrate Section

- [ ] **INTG-01**: User clicks Data icon in dock and Data Explorer + Properties Explorer appear at the top of the main view area (above the active view)
- [ ] **INTG-02**: User clicks Data icon again and both Data Explorer + Properties Explorer hide (toggle behavior)

### Visualize Section

- [ ] **VIZ-01**: User clicks SuperGrids and the Projections Explorer appears above the SuperGrid view
- [ ] **VIZ-02**: User clicks a non-SuperGrid view (Timelines, Maps, Charts, Graphs) and the Projections Explorer is hidden — only the selected view shows
- [ ] **VIZ-03**: Switching from a non-SuperGrid view back to SuperGrids restores the Projections Explorer above the grid

### Analyze Section

- [ ] **ANLZ-01**: User clicks Filters in dock and all 5 LATCH Filters appear below the active view
- [ ] **ANLZ-02**: User clicks Filters again and LATCH Filters hide (toggle behavior)
- [ ] **ANLZ-03**: LATCH Filters persist across view switches — if toggled on, they stay visible when switching between SuperGrids, Timelines, etc.
- [ ] **ANLZ-04**: User clicks Formulas in dock and Formulas Explorer appears below the active view (below Filters if both visible)
- [ ] **ANLZ-05**: User clicks Formulas again and Formulas Explorer hides (toggle behavior)

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
| RMV-01 | — | — | Pending |
| RMV-02 | — | — | Pending |
| INTG-01 | — | — | Pending |
| INTG-02 | — | — | Pending |
| VIZ-01 | — | — | Pending |
| VIZ-02 | — | — | Pending |
| VIZ-03 | — | — | Pending |
| ANLZ-01 | — | — | Pending |
| ANLZ-02 | — | — | Pending |
| ANLZ-03 | — | — | Pending |
| ANLZ-04 | — | — | Pending |
| ANLZ-05 | — | — | Pending |
| REGR-01 | — | — | Pending |
