# Phase 76 Requirements: SuperGrid Polish

**Phase:** 76 (SuperGrid Polish)
**Status:** READY
**Total Requirements:** 12

## Overview

Phase 76 closes the MVP gap identified in the SuperGrid Specification Section 11. After Phase 75 (SuperFilter, SuperSort, SuperCards, SuperAudit), the remaining MVP acceptance criteria focus on:

1. **SuperSearch** — FTS5 integration with in-grid highlighting (not in Phases 73-75)
2. **Performance verification** — 10k card benchmarks per spec targets
3. **Visual polish** — Deferred animation refinements
4. **E2E integration** — End-to-end flow validation

## Requirement Categories

### SuperSearch — FTS5 Full-Text Search (SRCH)

| ID | Requirement | Priority | Plan |
|----|-------------|----------|------|
| SRCH-01 | Search bar component in React chrome | P0 | 76-01 |
| SRCH-02 | FTS5 query with porter tokenizer and prefix matching | P0 | 76-01 |
| SRCH-03 | In-grid highlighting of matching cells (not separate list) | P0 | 76-01 |
| SRCH-04 | Faceted search within specific axis | P1 | 76-01 |
| SRCH-05 | Search state preserved across view transitions | P1 | 76-01 |

### Performance Verification (PERF)

| ID | Requirement | Priority | Plan |
|----|-------------|----------|------|
| PERF-01 | 10k card render < 500ms | P0 | 76-02 |
| PERF-02 | FTS5 search < 100ms at 10k cards | P0 | 76-02 |
| PERF-03 | Header click response < 50ms | P1 | 76-02 |
| PERF-04 | 60fps maintained with 1k cards during interaction | P1 | 76-02 |

### Visual Polish (POLISH)

| ID | Requirement | Priority | Plan |
|----|-------------|----------|------|
| POLISH-01 | Nested header animation (deferred join() refactor) | P2 | 76-03 |
| POLISH-02 | Edge case handling for deep nesting (>5 levels) | P2 | 76-03 |
| POLISH-03 | Graceful degradation for performance limits | P2 | 76-03 |

## Coverage Matrix

| Plan | Requirements | Count |
|------|--------------|-------|
| 76-01 | SRCH-01, SRCH-02, SRCH-03, SRCH-04, SRCH-05 | 5 |
| 76-02 | PERF-01, PERF-02, PERF-03, PERF-04 | 4 |
| 76-03 | POLISH-01, POLISH-02, POLISH-03 | 3 |

**Total:** 12 requirements across 3 plans

## MVP Acceptance Criteria Mapping

From SuperGrid-Specification.md Section 11:

| Criterion | Status | Covered By |
|-----------|--------|------------|
| Two-axis grid with row/column headers | ✅ | Phase 73 |
| Header nesting (multi-level groups) | ✅ | Phase 73-01 |
| Density slider (sparse ↔ dense) | ✅ | Phase 73-02 |
| Drag-drop axis swap | ✅ | Phase 74-01 |
| Header click sorts data | ⏳ | Phase 75-02 |
| Cursor changes across zone boundaries | ✅ | Phase 73-04 |
| Column resize with drag handle | ✅ | Phase 74-02 |
| Zoom pins upper-left corner | ✅ | Phase 73-03 |
| **FTS5 search highlights matching cells** | ❌ | **76-01** |
| View transitions preserve Tier 1 state | ⏳ | Phase 74-04 + 76-01 |
| 60fps with 1,000 cards | ⏳ | **76-02** |
| 10k card render < 500ms | ❌ | **76-02** |

## Dependencies

**Requires:**
- Phase 75 complete (SuperFilter, SuperSort, SuperCards, SuperAudit)

**Provides:**
- SuperSearch FTS5 integration (MVP criterion)
- Performance verification (MVP criterion)
- Visual polish for production readiness

**Affects:**
- v5.0 SuperGrid MVP milestone closure
- User-facing search functionality
- Large dataset performance guarantees

## Notes

### SuperSearch Architecture Decision

The spec (Section 2.14) specifies:
- Search bar in React chrome (not D3)
- FTS5 query via sql.js
- Results highlighted **in-situ within the grid** (not separate results list)
- Faceted filtering available but optional

This requires coordination between:
1. React search component (input + state)
2. sql.js FTS5 query execution
3. D3 GridRenderingEngine highlight rendering
4. SearchState in React context for cross-component access

### Performance Testing Strategy

Per spec Section 12:
- Use Performance.now() around render calls
- Test at 1k, 5k, 10k card counts
- FTS5 search latency as separate measurement
- Memory monitoring for long sessions

### Deferred Technical Debt

POLISH-01 addresses nested header animation that was deferred from Phase 61-01:
- Current: Imperative .append() in renderNestedAxisHeaders()
- Target: Data-driven .join() pattern for proper enter/update/exit
- Location: GridRenderingEngine.ts:1185

This refactor enables smooth header animations during view transitions.
