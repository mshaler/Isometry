# Requirements: Isometry v13.2

**Defined:** 2026-04-21
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v13.2 Requirements

Requirements for View + Editor Canvases milestone. Each maps to roadmap phases.

### ViewCanvas

- [x] **VCNV-01**: User can see 9 D3 views rendered inside SuperWidget canvas slot (ViewManager mounted via wrapper-div isolation)
- [x] **VCNV-02**: User can switch between views via Projection state (activeTabId encodes view type, onProjectionChange drives ViewManager.switchTo)
- [x] **VCNV-03**: SuperWidget status slot shows current view name and card count, updated after each render
- [x] **VCNV-04**: Bound views auto-show their Explorer sidecar (e.g., SuperGrid → ProjectionExplorer); Unbound views hide sidecar
- [x] **VCNV-05**: ViewCanvas.destroy() tears down ViewManager and unsubscribes coordinator — no leaked subscriptions

### EditorCanvas

- [ ] **ECNV-01**: User can see Notebook card editor rendered inside SuperWidget canvas slot (NotebookExplorer mounted with SelectionProvider binding)
- [ ] **ECNV-02**: SuperWidget status slot shows selected card title, updated reactively on selection change
- [ ] **ECNV-03**: EditorCanvas.destroy() cancels debounced auto-save timer, flushes unsaved content, and unsubscribes all 4 provider handles
- [ ] **ECNV-04**: Card selection in another canvas (e.g., SuperGrid cell click) propagates to EditorCanvas on next mount via shared SelectionProvider

### Integration

- [ ] **INTG-01**: 3-canvas transition matrix (Explorer↔View↔Editor — all 6 directional transitions) passes as Playwright CI gate
- [ ] **INTG-02**: 9-view cycle within ViewCanvas (list→grid→kanban→calendar→timeline→gallery→network→tree→supergrid) completes without DOM leaks
- [ ] **INTG-03**: CANV-06 preserved — readFileSync assertion confirms SuperWidget.ts has zero import references to ViewCanvas or EditorCanvas
- [ ] **INTG-04**: Rapid canvas switching (3+ transitions in <500ms) produces no orphaned DOM or stale subscriptions

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Canvas Enhancements

- **FCNV-01**: Split-pane canvas layout (View + Editor side-by-side)
- **FCNV-02**: Canvas-level undo/redo scoping (per-canvas MutationManager)
- **FCNV-03**: Custom canvas types via user plugin API

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| ViewManager rewrite | ViewManager is consumed as-is — no structural changes |
| NotebookExplorer rewrite | NotebookExplorer is consumed as-is — only lifecycle wrapping |
| New D3 view types | 9 views sufficient; new views are a separate milestone |
| Multi-canvas simultaneous display | Split-pane deferred to future — one active canvas at a time |
| Canvas drag-and-drop reordering | SuperWidget has fixed slot layout |
| statusSlot.ts reuse for View/Editor | ExplorerCanvas status schema differs — each canvas writes its own status DOM |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| VCNV-01 | Phase 171 | Complete |
| VCNV-02 | Phase 171 | Complete |
| VCNV-03 | Phase 171 | Complete |
| VCNV-04 | Phase 171 | Complete |
| VCNV-05 | Phase 171 | Complete |
| ECNV-01 | Phase 172 | Pending |
| ECNV-02 | Phase 172 | Pending |
| ECNV-03 | Phase 172 | Pending |
| ECNV-04 | Phase 172 | Pending |
| INTG-01 | Phase 173 | Pending |
| INTG-02 | Phase 173 | Pending |
| INTG-03 | Phase 173 | Pending |
| INTG-04 | Phase 173 | Pending |

**Coverage:**
- v13.2 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-04-21*
*Last updated: 2026-04-21 after roadmap creation — all 13 requirements mapped*
