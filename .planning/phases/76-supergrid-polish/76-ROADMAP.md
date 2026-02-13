# Phase 76 Roadmap: SuperGrid Polish

**Phase:** 76
**Status:** READY
**Plans:** 3
**Est. Duration:** ~45 minutes total

## Phase Overview

Phase 76 closes the v5.0 SuperGrid MVP by addressing:
1. **SuperSearch** — The one Super* feature not in Phase 75 (FTS5 integration)
2. **Performance verification** — Benchmark validation against spec targets
3. **Visual polish** — Deferred animation refinements for production quality

## Plan Sequence

### Plan 76-01: SuperSearch (FTS5 Integration)
**Priority:** P0 (MVP criterion)
**Requirements:** SRCH-01, SRCH-02, SRCH-03, SRCH-04, SRCH-05
**Est. Duration:** ~20 minutes

**Scope:**
- Create SearchBar component in React chrome
- Implement SearchContext for cross-component state
- Wire FTS5 queries through sql.js (nodes_fts virtual table)
- Add highlight rendering to GridRenderingEngine
- Preserve search state across view transitions

**Key Files:**
- `src/components/search/SearchBar.tsx` (new)
- `src/state/SearchContext.tsx` (new)
- `src/d3/SuperGridEngine/GridRenderingEngine.ts` (modify)
- `src/db/queries/search.ts` (new)

**Dependencies:**
- Requires Phase 75 complete (SuperFilter context patterns)
- Uses existing nodes_fts virtual table from schema.sql

### Plan 76-02: Performance Verification
**Priority:** P0 (MVP criterion)
**Requirements:** PERF-01, PERF-02, PERF-03, PERF-04
**Est. Duration:** ~15 minutes

**Scope:**
- Create performance test suite with synthetic datasets
- Generate 1k, 5k, 10k card test data
- Benchmark render times against spec targets
- Benchmark FTS5 search latency
- Add performance markers for ongoing monitoring

**Key Files:**
- `src/test/performance/render-benchmark.test.ts` (new)
- `src/test/performance/search-benchmark.test.ts` (new)
- `src/test/performance/test-data-generator.ts` (new)

**Targets (from spec Section 12):**
| Metric | Target | Test Scope |
|--------|--------|------------|
| 1k card render | < 200ms | Baseline |
| 10k card render | < 500ms | Scale target |
| FTS5 search (10k) | < 100ms | Search latency |
| Header click response | < 50ms | Interaction |
| 60fps threshold | 16ms frames | Animation |

### Plan 76-03: Visual Polish
**Priority:** P2 (non-blocking)
**Requirements:** POLISH-01, POLISH-02, POLISH-03
**Est. Duration:** ~10 minutes

**Scope:**
- Refactor renderNestedAxisHeaders() from .append() to .join()
- Add edge case handling for >5 nesting levels
- Implement graceful degradation for performance limits
- Clean up animation timing consistency

**Key Files:**
- `src/d3/SuperGridEngine/GridRenderingEngine.ts` (refactor)
- `src/d3/grid-rendering/HeaderAnimationController.ts` (modify)

**Technical Debt Resolution:**
- Deferred from Phase 61-01: nested header repositioning animation
- Current: imperative .append() pattern at line ~1185
- Target: data-driven .join() for proper enter/update/exit

## Dependencies

```
Phase 73 (Phase A: Stack/Density/Zoom/Zones)
    ↓
Phase 74 (Phase B: Dynamic/Size/Select/Position)
    ↓
Phase 75 (Phase C: Filter/Sort/Cards/Audit) ← In progress
    ↓
Phase 76 (Polish: Search/Perf/Visual) ← This roadmap
    ↓
v5.0 SuperGrid MVP COMPLETE
```

## Success Criteria

Phase 76 is complete when:

1. **SuperSearch functional:**
   - [ ] Search bar renders in toolbar
   - [ ] FTS5 queries execute correctly
   - [ ] Matching cells highlighted in-grid
   - [ ] Search state persists across view transitions

2. **Performance verified:**
   - [ ] 10k card render < 500ms (documented)
   - [ ] FTS5 search < 100ms at 10k (documented)
   - [ ] 60fps maintained at 1k cards (documented)

3. **Visual polish complete:**
   - [ ] Nested headers animate smoothly
   - [ ] Deep nesting handled gracefully
   - [ ] No animation jank in transitions

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| FTS5 performance at scale | Low | High | Use LIMIT, pagination |
| Highlight rendering overhead | Medium | Medium | Batch updates, requestAnimationFrame |
| Join refactor regression | Medium | High | Comprehensive tests before refactor |

## Notes

- Phase 76 can start as soon as Phase 75 is complete
- Plans 76-01 and 76-02 are P0 (block MVP closure)
- Plan 76-03 is P2 (can be deferred if timeline pressure)
- After Phase 76, v5.0 SuperGrid MVP milestone is complete
