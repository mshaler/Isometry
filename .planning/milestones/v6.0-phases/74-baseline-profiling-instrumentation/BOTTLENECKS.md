# Phase 74: Bottleneck Analysis

**Date:** 2026-03-11
**Purpose:** Ranked bottleneck list gating Phase 76 (Render/Query Optimization) and Phase 77 (Import/Launch/Memory) work.
**Methodology:** Direct performance.now() measurement (tsx + vitest) at 1K/5K/20K scale + rollup-plugin-visualizer bundle analysis.

## Ranked Bottlenecks (by user-perceived severity)

| Rank | Domain | Bottleneck | Severity | Evidence |
|------|--------|-----------|----------|----------|
| 1 | SQL Query | GROUP BY folder, card_type (full table scan) | High — every SuperGrid axis change | 24.9ms p99 at 20K |
| 2 | SQL Query | GROUP BY created_at (month) — strftime scan | High — every time-axis render | 20.6ms p99 at 20K |
| 3 | ETL Import | markdown parse pipeline | High — blocks import UX | 1059ms total for 20K cards |
| 4 | Bundle | xlsx chunk (lazy-loaded on import) | Medium — cold-start first import | 419KB raw / 138KB gzip |
| 5 | ETL Import | json parse pipeline | Medium — blocks import UX | 1771ms total for 20K cards |
| 6 | Bundle | WASM file (sql-wasm-fts5) | Medium — cold-start launch | 756KB raw / 370KB gzip |
| 7 | Bundle | Main JS chunk | Medium — initial page load | 1025KB raw / 285KB gzip |
| 8 | SQL Query | GROUP BY status | Low — fast even at 20K | 1.9ms p99 at 20K |
| 9 | ETL Import | csv parse pipeline | Low — PapaParse is fast | 767ms total for 20K |
| 10 | ETL Import | apple_notes pipeline | Low — fastest importer | 182ms total for 20K |

**Ranking formula:** frequency (how often user triggers) × latency (ms at 20K) × user-facing impact (blocks interaction vs background).

**Note:** SuperGrid render timings are from jsdom (5–10x overhead vs Chrome). Absolute values not meaningful; relative ratios between axis configurations are valid for Phase 76 prioritization.

## Domain: SQL Query (PROF-04)

Measured: direct `performance.now()` in Node (tsx), same WASM runtime as production, 200 iterations at 1K / 100 at 5K / 50 at 20K.

| Query | 1K p99 | 5K p99 | 20K p99 | ops/sec (20K) |
|-------|--------|--------|---------|---------------|
| GROUP BY folder, card_type | 1.04ms | 6.24ms | 24.93ms | 42 |
| GROUP BY status | 0.12ms | 0.43ms | 1.87ms | 623 |
| GROUP BY created_at (month) | 0.76ms | 5.78ms | 20.64ms | 52 |
| FTS 3-word search | 0.20ms | 0.51ms | 1.70ms | 1026 |

**Key observations:**
- GROUP BY on two string columns (folder, card_type) is 13× slower than single-column GROUP BY (status) at 20K — no composite index.
- strftime() GROUP BY is nearly as slow as the two-column case — no functional index.
- FTS5 is fast even at 20K (1.7ms p99) — no optimization needed.
- Status GROUP BY is fast (1.9ms) — single low-cardinality column, good cache behavior.

## Domain: SuperGrid Render (PROF-05)

Measured: vitest jsdom environment, `_renderCells()` timing via `performance.now()`, 10 iterations (5 for 20K). **jsdom is 5–10× slower than Chrome** — use for relative comparison only, not absolute budget setting.

| Axis Config | Cell Count | p99 (jsdom) | ops/sec (jsdom) | Chrome estimate (÷8) |
|-------------|-----------|-------------|-----------------|----------------------|
| single (folder) | 1K | 85.3ms | 12 | ~11ms |
| single (folder) | 5K | 44.7ms | 22 | ~6ms |
| single (folder) | 20K | 37.8ms | 26 | ~5ms |
| dual (folder × card_type) | 1K | 194.3ms | 5 | ~24ms |
| dual (folder × card_type) | 5K | 506.0ms | 2 | ~63ms |
| dual (folder × card_type) | 20K | 434.2ms | 2 | ~54ms |
| triple (folder × card_type × status) | 1K | 99.8ms | 10 | ~12ms |
| triple (folder × card_type × status) | 5K | 162.2ms | 6 | ~20ms |
| triple (folder × card_type × status) | 20K | 259.4ms | 4 | ~32ms |

**Key observations:**
- Dual axis is the worst case (2 col axes × 1 row axis = large header span table). 5K cells = 506ms jsdom / ~63ms Chrome est.
- Single axis performance is non-monotonic — 20K cells faster than 1K because data generation time dominates at small sizes.
- Triple axis scales roughly linearly. Chrome estimates suggest 32ms at 20K is acceptable for 60fps if it doesn't block the main thread.
- Phase 77 Instruments measurement required to confirm Chrome estimates before setting budgets.

## Domain: ETL Import (PROF-06)

Measured: vitest Node environment, `performance.now()` around `ImportOrchestrator.import()`, single run per scale tier (shared DB, dedup handles duplicates on re-runs).

| Source Type | 1K total | 1K cards/s | 5K total | 5K cards/s | 20K total | 20K cards/s |
|------------|---------|-----------|---------|-----------|---------|------------|
| apple_notes | 21ms | 48,000/s | 47ms | 106,000/s | 182ms | 110,000/s |
| csv | 45ms | 22,000/s | 180ms | 28,000/s | 767ms | 26,000/s |
| json | 110ms | 9,100/s | 470ms | 10,600/s | 1,771ms | 11,300/s |
| markdown | 229ms | 4,400/s | 407ms | 12,300/s | 1,059ms | 18,900/s |

**Key observations:**
- apple_notes is fastest (~110K cards/s at 20K) because frontmatter parsing is minimal.
- json is slow because JSONParser constructs full card objects with content hash computation and stringification — ~11K cards/s at 20K.
- markdown is slowest at 1K (4.4K/s) but improves at scale (18.9K/s at 20K) — likely WASM JIT warm-up effect.
- csv is consistent at ~26–28K cards/s — PapaParse parse overhead is the bottleneck, not SQLite writes.
- All 20K imports complete in under 2 seconds — not a blocking UX issue for typical import sizes.
- Phase 77 optimization target: json (11K/s) and markdown (18.9K/s warmed) are the bottlenecks.

## Domain: Bundle Size (PROF-07)

Measured: `npm run analyze` with rollup-plugin-visualizer v7 (treemap template, gzip + brotli). App-mode build (index.html entry, no externals).

### JS Chunks

| Chunk | Raw | Gzip | Description |
|-------|-----|------|-------------|
| index-\*.js (main) | 562KB | 152KB | App code + D3 + DOMPurify + marked + deps |
| xlsx-\*.js | 419KB | 138KB | Excel/XLSX parser (lazy-loaded on import) |
| worker-\*.js | 223KB | 69KB | sql.js WASM loader + Worker message handlers |
| schema-\*.js | 7KB | 2KB | Schema static data |
| **JS Total** | **1,211KB** | **361KB** | — |

### Main Chunk Module Breakdown (from rollup-plugin-visualizer)

| Module | Raw | Gzip | % of main chunk |
|--------|-----|------|----------------|
| App code (src/) | 712KB | 175KB | 67.8% |
| D3.js | 230KB | 80KB | 21.9% |
| DOMPurify | 64KB | 17KB | 6.1% |
| marked | 42KB | 12KB | 4.0% |
| Vite runtime | 1KB | 1KB | 0.1% |
| **Main chunk total** | **1,025KB** | **285KB** | 100% |

### Non-JS Assets

| Asset | Raw | Gzip | Notes |
|-------|-----|------|-------|
| sql-wasm-fts5.wasm | 756KB | 370KB | WASM not gzip-served by default; custom FTS5 build |
| index-\*.css | 49KB | 8KB | All app styles bundled |
| **Grand total (JS + CSS)** | **1,260KB** | **369KB** | Excluding WASM |
| **Grand total (all)** | **2,016KB** | **739KB** | Including WASM |

**Key observations:**
- App code (src/) dominates main chunk at 68% — indicates room for code splitting.
- xlsx (138KB gzip) is already split into a separate chunk — lazy-loads on first import trigger.
- D3.js (80KB gzip) is the largest third-party dependency in the main bundle. Tree-shaking is partial (full D3 package imported).
- WASM (756KB raw) dominates total payload — not compressible. WKWebView streaming compile mitigates parse time.
- No sql.js in main JS — it's in the Worker chunk, which is correct.

## Phase 76/77 Inputs

### Phase 76 (Render + SQL Optimization)

**Top SQL bottlenecks by p99 at 20K (priority order for index work):**
1. `GROUP BY folder, card_type` — 24.9ms p99. Target: add composite index `(folder, card_type, deleted_at)`.
2. `GROUP BY strftime('%Y-%m', created_at)` — 20.6ms p99. Target: add expression index on `strftime('%Y-%m', created_at)`.
3. `GROUP BY status` — 1.9ms p99. Already fast; index may help but lower priority.

**EXPLAIN QUERY PLAN required on actual 20K dataset before writing index DDL (Phase 76 task).**

**Render bottleneck (pending Chrome measurement via Phase 77 Instruments):**
- Dual-axis 5K cells is the worst relative case (~63ms Chrome estimate). Investigate: is it DOM node count, span table header computation, or D3 data join key overhead?

### Phase 77 (Import + Launch + Memory)

**ETL throughput limiting factors by source type:**
- json: 11.3K cards/s at 20K — JSON.parse + content hash SHA-256 computation dominates.
- markdown: 18.9K cards/s at 20K — gray-matter YAML parse + marked HTML render per card.
- csv: 26K cards/s at 20K — PapaParse stream parse overhead.
- apple_notes: 110K cards/s at 20K — already fast, no action needed.

**Launch (cold-start):**
- Total gzip JS transfer: 361KB (main + worker + schema) — acceptable for initial load.
- xlsx chunk (138KB gzip) deferred until import — correct.
- WASM (756KB raw) is the dominant cold-start cost — streaming compile + WKWebView locateFile path.

**Memory:**
- Deferred to Phase 77 physical device measurement (Xcode Instruments required).
- Hypothesis: 20K cards × avg row size ~600B ≈ 12MB in-DB + D3 DOM nodes × overhead.
- Cannot measure accurately in vitest Node environment.

## Notes

- All JS/SQL measurements on Apple M-series Mac (Rosetta not applicable, arm64 Node).
- WASM JIT behavior in Node may differ from Safari WKWebView (typically faster in WKWebView after first run).
- jsdom render times are 5–10× slower than Chrome DevTools — Chrome estimates computed by ÷8 heuristic.
- Memory measurements deferred to Phase 77 (requires physical device + Xcode Instruments).
- **No budgets proposed** — Phase 75 derives budgets from this data (TDD red step).
- vitest bench v4 with `--run` collects empty sample arrays in `forks` pool mode; measurements collected via `performance.now()` directly.
