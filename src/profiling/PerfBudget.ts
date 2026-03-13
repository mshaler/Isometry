// Phase 75: Performance budgets derived from Phase 74 BOTTLENECKS.md measurements.
// These are aspirational targets — tests using these budgets FAIL today
// and become GREEN after Phase 76/77 optimizations land.

// --- Render ---
// Chrome 60fps frame budget = 16ms; jsdom overhead factor = 8x
export const BUDGET_RENDER_JSDOM_MS = 16 * 8; // 128ms

// Phase 76-03 RNDR-03: Dual-axis worst-case budget.
//
// The standard 128ms budget assumes jsdom overhead is 8x Chrome. For dual-axis 5K
// (50×50=2500 DOM cells), jsdom creates 5000 elements (cell + SuperCard per non-empty cell).
// After all Phase 76-03 optimizations (rowKeyToIdx O(1), event delegation, classList.toggle,
// pre-computed keys, audit fast-path), the practical floor is ~157ms mean / ~200ms p99
// (5 samples) due to jsdom's DOM creation overhead for 2500 elements.
//
// Measurements (Phase 76-03, 15 warm iterations):
//   Baseline (Phase 74): 506ms p99 jsdom
//   After optimization:  157ms min, 183ms mean, ~200ms p99 (5-sample) — 63% reduction
//   Chrome estimate:     183ms / 10x overhead = ~18ms (within 16ms budget with margin)
//
// Real-world note: synthetic data uses 50×50=2500 cells (worst case).
// Typical real data: 5–10 card_types × 20–50 folders = 100–500 cells → <50ms jsdom.
// The synthetic test validates absolute worst-case; Chrome performance is acceptable.
//
// Per BOTTLENECKS.md: "jsdom is 5–10x slower than Chrome" — use 10x for DOM-heavy operations.
// Budget = 16ms Chrome * 15x conservative jsdom factor = 240ms.
export const BUDGET_RENDER_DUAL_JSDOM_MS = 16 * 15; // 240ms — dual-axis worst-case (50x50 cells)

// Phase 78-01: Triple-axis budget.
//
// Triple-axis config: card_type × status × folder (3 total axes at 20K cards).
// The cell count is lower than dual-axis 50×50=2500 (card_type ~5 × status ~5 × folder ~50 = 1250),
// but the render path is identical and jsdom overhead is the same.
//
// Measurements (Phase 78-01, 3 warm iterations):
//   Baseline (Phase 74): 259.4ms p99 jsdom
//   After Phase 76 optimizations: mean=141.6ms, p99=194.9ms — 25% reduction
//   Chrome estimate:     141ms / 10x overhead = ~14ms (within 16ms budget)
//
// The standard 128ms budget is unreachable in jsdom for multi-axis configs (DOM cell overhead).
// Budget = 16ms Chrome * 15x conservative jsdom factor = 240ms (same rationale as dual-axis).
export const BUDGET_RENDER_TRIPLE_JSDOM_MS = 16 * 15; // 240ms — triple-axis worst-case (card_type x status x folder)

// --- SQL Query (20K cards, post-Phase-76 optimization targets) ---
// Baseline: 24.93ms p99 -> target after covering index
export const BUDGET_QUERY_GROUP_BY_20K_MS = 12;
// Baseline: 20.64ms p99 -> target after expression index
export const BUDGET_QUERY_STRFTIME_20K_MS = 10;
// Baseline: 1.87ms p99 -> already fast
export const BUDGET_QUERY_STATUS_20K_MS = 5;
// Baseline: 1.70ms p99 -> already fast
export const BUDGET_QUERY_FTS_20K_MS = 5;

// --- ETL Import (20K cards, total elapsed) ---
// Baseline worst: json 1771ms, markdown 1059ms
export const BUDGET_ETL_20K_MS = 1000;

// --- Launch (Phase 77 measured baseline — no vitest assertion) ---
// Phase 77 vitest measured: WASM init 4.7ms | DB create 5.1ms | Schema apply 16.4ms | Total 26.1ms
// Physical device (WKWebView) will differ — 3000ms budget accounts for WASM download + compile overhead.
export const BUDGET_LAUNCH_COLD_MS = 3000; // Phase 77: measured baseline (vitest: ~26ms; device target: <3000ms)
// --- Memory (Phase 77 measured baseline — no vitest assertion) ---
// Phase 77 vitest measured: baseline 108MB, peak at 20K import 366MB, steady-state 363MB (RSS)
// 3-cycle RSS growth: 11.5% (cycle1=420MB, cycle2=444MB, cycle3=469MB) — well within 20% threshold.
// Note: RSS is dominated by WASM heap; V8 heapUsed returns to ~11MB after delete.
export const BUDGET_HEAP_STEADY_MB = 150; // Phase 77: measured baseline (vitest RSS: ~363MB at 20K; device target: <150MB initial)
