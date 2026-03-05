# Requirements: Isometry v3.1 SuperStack

**Defined:** 2026-03-05
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v3.1 Requirements

Requirements for N-level axis stacking with collapsible headers, aggregate/hide collapse modes, drag reorder, and full compound D3 keying.

### Foundation (STAK)

- [x] **STAK-01**: PAFVProvider accepts any number of axes per dimension (no hard limit)
- [x] **STAK-02**: D3 cell key function uses compound key from ALL stacking levels (not just primary)
- [ ] **STAK-03**: Cell placement logic computes grid position from all axis levels
- [ ] **STAK-04**: Asymmetric depths work (e.g., 3 row axes, 2 column axes render correctly)
- [ ] **STAK-05**: SuperGridQuery GROUP BY validated with 4+ level test cases

### Row Headers (RHDR)

- [ ] **RHDR-01**: Row headers render at all stacking levels (not just level 0)
- [ ] **RHDR-02**: Row header grips appear at each level for drag interaction
- [ ] **RHDR-03**: Row headers use CSS Grid spanning consistent with column headers (SuperStackHeader)
- [ ] **RHDR-04**: Row header parent-path keys prevent collision across levels

### Collapse (CLPS)

- [ ] **CLPS-01**: Any header at any level can be independently collapsed/expanded
- [ ] **CLPS-02**: Aggregate mode (default): collapsed header shows count/sum of hidden children
- [ ] **CLPS-03**: Hide mode: collapsed header hides children with no aggregate row
- [ ] **CLPS-04**: User can toggle between aggregate and hide per header (context menu or indicator)
- [ ] **CLPS-05**: Collapsing a parent hides all nested children recursively
- [ ] **CLPS-06**: Collapse state persists in Tier 2 (survives view transitions within LATCH family)

### Drag Reorder (DRAG)

- [ ] **DRAG-01**: User can drag a stacking level to reorder within its dimension (e.g., swap row level 0 and 1)
- [ ] **DRAG-02**: Cross-dimension transpose still works with N-level stacks (row<->column)
- [ ] **DRAG-03**: Drag reorder triggers D3 transition animation (300ms, consistent with SuperDynamic)
- [ ] **DRAG-04**: Reorder persists in Tier 2 via PAFVProvider serialization

### Polish (PRST)

- [ ] **PRST-01**: Stacking order and collapse state survive app reload (Tier 2 persistence round-trip)
- [ ] **PRST-02**: Selection (lasso, Cmd+click, Shift+click) works correctly with compound cell keys
- [ ] **PRST-03**: Render performance with 4-level stacking on 10x10 grid stays under 16ms
- [ ] **PRST-04**: SuperCards (aggregation) render correctly at all nesting depths

## Future Requirements

Deferred to subsequent milestones. Not in current roadmap.

### SuperCalc

- **CALC-01**: HyperFormula integration with PAFV-scoped formula reference syntax
- **CALC-02**: Computed value visual distinction (SuperAudit)

### Sync

- **SYNC-01**: CloudKit subscription sync with custom zones and change tokens

### Performance

- **VSCR-01**: Virtual scrolling or windowing for extremely large grids

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Virtual scrolling | Not needed — grid renders group intersections (max 2,500 cells) |
| Formula engine (SuperCalc) | Formula reference syntax for PAFV coordinates unsolved; deferred |
| New view types | v3.1 is purely SuperGrid enhancement |
| Schema changes | No new tables or columns needed |
| Native shell changes | Pure TypeScript/D3 milestone |
| New Worker message types | SuperGridQuery already handles N axes |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STAK-01 | Phase 28 | Complete |
| STAK-02 | Phase 28 | Complete |
| STAK-03 | Phase 28 | Pending |
| STAK-04 | Phase 28 | Pending |
| STAK-05 | Phase 28 | Pending |
| RHDR-01 | Phase 29 | Pending |
| RHDR-02 | Phase 29 | Pending |
| RHDR-03 | Phase 29 | Pending |
| RHDR-04 | Phase 29 | Pending |
| CLPS-01 | Phase 30 | Pending |
| CLPS-02 | Phase 30 | Pending |
| CLPS-03 | Phase 30 | Pending |
| CLPS-04 | Phase 30 | Pending |
| CLPS-05 | Phase 30 | Pending |
| CLPS-06 | Phase 30 | Pending |
| DRAG-01 | Phase 31 | Pending |
| DRAG-02 | Phase 31 | Pending |
| DRAG-03 | Phase 31 | Pending |
| DRAG-04 | Phase 31 | Pending |
| PRST-01 | Phase 32 | Pending |
| PRST-02 | Phase 32 | Pending |
| PRST-03 | Phase 32 | Pending |
| PRST-04 | Phase 32 | Pending |

**Coverage:**
- v3.1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after roadmap creation*
