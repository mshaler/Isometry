# Requirements: Isometry v6.0 Performance

**Defined:** 2026-03-11
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.

## v6.0 Requirements

Requirements for ship-ready performance at 20K card scale. Each maps to roadmap phases.

### Profiling & Instrumentation

- [x] **PROF-01**: Performance.mark/measure hooks instrument Worker Bridge query round-trips (sent → response latency)
- [x] **PROF-02**: Performance.mark/measure hooks instrument render path (fetchAndRender → D3 join → paint)
- [x] **PROF-03**: Performance.mark/measure hooks instrument import pipeline (parse → dedup → write → FTS rebuild)
- [x] **PROF-04**: Vitest bench files measure SQL query throughput at 1K/5K/20K card scale
- [x] **PROF-05**: Vitest bench files measure SuperGrid render cycle time at varying axis configurations
- [x] **PROF-06**: Vitest bench files measure ETL import throughput (cards/second) per source type
- [x] **PROF-07**: Bundle analysis via rollup-plugin-visualizer generates treemap of production build composition

### Render Optimization

- [x] **RNDR-01**: EXPLAIN QUERY PLAN analysis identifies missing indexes on PAFV GROUP BY columns
- [x] **RNDR-02**: Covering indexes added for SuperGrid axis queries (folder, card_type, status, created_at)
- [x] **RNDR-03**: SuperGrid query path optimized based on profiling data at 20K card scale
- [x] **RNDR-04**: Virtualizer VIRTUALIZATION_THRESHOLD validated and tuned for 20K card PAFV projections
- [x] **RNDR-05**: postMessage payload size measured and reduced for large Worker responses (>10KB)

### Import & Launch

- [x] **IMPT-01**: ETL batch size re-validated at 20K cards (current 100-card batches vs larger)
- [x] **IMPT-02**: FTS trigger rebuild timing measured and optimized for 20K card bulk imports
- [x] **IMPT-03**: Parser throughput benchmarked per source type with bottleneck identification
- [x] **LNCH-01**: Cold start decomposed: WASM init → DB hydration → first meaningful paint with timing
- [x] **LNCH-02**: WKWebView warm-up pattern implemented to reduce first-paint latency

### Memory

- [x] **MMRY-01**: WASM heap + JS heap measured at 20K cards with peak/steady-state identified
- [x] **MMRY-02**: Import-delete-reimport cycle tested for heap fragmentation/growth
- [x] **MMRY-03**: WKWebView webViewWebContentProcessDidTerminate wired to checkpoint restore path

### Regression Guard

- [x] **RGRD-01**: Performance budgets defined: render <16ms, query <200ms, launch <3s, heap <150MB
- [ ] **RGRD-02**: CI benchmark job added to GitHub Actions with relative thresholds
- [x] **RGRD-03**: Baseline JSON committed for cross-commit comparison
- [ ] **RGRD-04**: CI bench job starts as continue-on-error, promoted to blocking after calibration

## Future Requirements

### Advanced Optimization

- **AOPT-01**: Canvas/WebGL rendering for views exceeding CSS Grid limits (100K+ cards)
- **AOPT-02**: DuckDB swap for sql.js at extreme scale
- **AOPT-03**: Shared memory (SharedArrayBuffer) for zero-copy Worker communication
- **AOPT-04**: Service Worker caching for WASM binary

## Out of Scope

| Feature | Reason |
|---------|--------|
| Canvas/WebGL rendering | CSS Grid + data windowing is correct architecture at 20K scale |
| DuckDB swap | Explicitly out of scope per PROJECT.md (future optimization) |
| SharedArrayBuffer | Requires COOP/COEP headers that complicate WKWebView serving |
| Synthetic 20K seed dataset | User has real data; bench files generate their own test data |
| Profiling UI dashboard | Chrome DevTools + Xcode Instruments are sufficient |
| Non-virtualized view guards | "Too many cards" warnings are UX decisions, not perf work |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROF-01 | Phase 74 | Complete |
| PROF-02 | Phase 74 | Complete |
| PROF-03 | Phase 74 | Complete |
| PROF-04 | Phase 74 | Complete |
| PROF-05 | Phase 74 | Complete |
| PROF-06 | Phase 74 | Complete |
| PROF-07 | Phase 74 | Complete |
| RNDR-01 | Phase 76 | Complete |
| RNDR-02 | Phase 76 | Complete |
| RNDR-03 | Phase 76 | Complete |
| RNDR-04 | Phase 76 | Complete |
| RNDR-05 | Phase 76 | Complete |
| IMPT-01 | Phase 77 | Complete |
| IMPT-02 | Phase 77 | Complete |
| IMPT-03 | Phase 77 | Complete |
| LNCH-01 | Phase 77 | Complete |
| LNCH-02 | Phase 77 | Complete |
| MMRY-01 | Phase 77 | Complete |
| MMRY-02 | Phase 77 | Complete |
| MMRY-03 | Phase 77 | Complete |
| RGRD-01 | Phase 75 | Complete |
| RGRD-02 | Phase 78 | Pending |
| RGRD-03 | Phase 75 | Complete |
| RGRD-04 | Phase 78 | Pending |

**Coverage:**
- v6.0 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-11 -- traceability mapped after roadmap creation*
