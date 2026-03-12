// Phase 75: Performance budgets derived from Phase 74 BOTTLENECKS.md measurements.
// These are aspirational targets — tests using these budgets FAIL today
// and become GREEN after Phase 76/77 optimizations land.

// --- Render ---
// Chrome 60fps frame budget = 16ms; jsdom overhead factor = 8x
export const BUDGET_RENDER_JSDOM_MS = 16 * 8; // 128ms

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

// --- Launch (Phase 77 physical device target — no vitest assertion) ---
export const BUDGET_LAUNCH_COLD_MS = 3000; // TODO Phase 77: Instruments measurement
// --- Memory (Phase 77 physical device target — no vitest assertion) ---
export const BUDGET_HEAP_STEADY_MB = 150; // TODO Phase 77: Xcode memory gauge
