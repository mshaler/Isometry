# ISOMETRY — Full-App Automated Test Harness (Reconciled)

**Original**: `Isometry-Full-App-Test-Harness.docx` (Claude AI handoff)
**Reconciled**: 2026-03-15 — updated to reflect v6.0 shipped state
**Purpose**: v6.0 post-ship hardening / pre-v7 quality gate

---

## What Changed From the Original

| Original Assumption | Actual State (v6.0) |
|---|---|
| "Phase 22 Plan 03 hideEmpty not yet built" | hideEmpty shipped in v5.2+; tested in 8 files across views/profiling/providers |
| "`__agg__` prefix needs TDD red-first" | `__agg__` convention locked as D-011; used in SuperGridQuery.ts + supergrid.handler.ts |
| "Phase 23 SuperSort is next milestone" | Project is on v6.0 (Phase 78). SuperSort shipped in v3.0. |
| "CalcExplorer has no test file" | Still true for dedicated unit tests, but `seam-calc-footer.test.ts` covers the query→footer seam |
| "No seam tests exist" | 3 seam tests already exist in `tests/integration/seam-*.test.ts` |
| "`seed.ts` is a reusable DB factory" | It's a 10K-card performance seeder — not suitable for lightweight seam tests |
| "StateCoordinator takes providers in constructor" | StateCoordinator has a no-arg constructor; uses `registerProvider(key, provider)` |
| "~1,500 KB of tests" | ~55K lines of test code across all test directories |
| "ETL FTS only covers Apple Notes" | `etl-progress.test.ts` also covers FTS; CSV/XLSX import tested in `etl-all-parsers.test.ts` but without FTS verification |

---

## 1. Existing Seam Tests (Already Done)

### seam-calc-footer.test.ts (294 lines)
**Covers**: Real FilterProvider → `buildSuperGridCalcQuery()` → SQL output assertion
- Bug #2 regression (colAxes in GROUP BY) ✅
- Axis filter → WHERE propagation ✅
- Range filter → WHERE propagation ✅
- Compound filter (axis + range + search) ✅
- All 4 aggregation modes (SUM/AVG/COUNT/OFF) ✅
- Non-numeric field safety net ✅
- Empty colAxes (row-only) ✅
- Filter clear → base WHERE only ✅

**Partially covers**: GAP-01 (filter→SQL), GAP-05 (range filter→SQL)
**Does NOT cover**: Actual sql.js execution of the generated SQL — assertions are on SQL string shape only

### seam-coordinator-batch.test.ts (228 lines)
**Covers**: Real FilterProvider + PAFVProvider + SelectionProvider → real StateCoordinator batching
- Single provider → one callback ✅
- Multiple providers → one batched callback ✅
- Sequential changes → separate callbacks ✅
- Unsubscribe prevents stale callbacks ✅
- Unregister provider stops notifications ✅
- destroy() cancels pending timer ✅
- scheduleUpdate idempotency ✅
- Provider-before-coordinator ordering ✅

**Fully covers**: GAP-04 (coordinator batching)
**Does NOT cover**: The view end — no SuperGrid or ViewManager verifying it received the notification

### seam-selection-notebook.test.ts (284 lines)
**Covers**: SelectionProvider → NotebookExplorer binding contract
- select() vs toggle() Bug #6 regression ✅
- Subscriber notification ✅
- Notebook flush/load sequence via mock bridge ✅

**Fully covers**: Selection→Notebook seam (not in original gap list — was a bonus)

---

## 2. Revised Gap Analysis

Scores updated to reflect existing seam tests + v6.0 shipped state.

| Gap ID | Missing Coverage | Was | Now | Remaining Work |
|---|---|---|---|---|
| GAP-01 | Filter → QueryBuilder → **real sql.js** execution | 4/10 | 6/10 | seam-calc-footer tests SQL shape but not execution. Need real DB round-trip. |
| GAP-02 | PAFV → Bridge → CellDatum shape | 3/10 | 3/10 | Still no test of the actual bridge query→CellDatum transformation. `__agg__` regression guard needed. |
| GAP-03 | ViewTabBar → PAFVProvider → ViewManager | 5/10 | 5/10 | No change. Each tested in isolation. |
| GAP-04 | Filter → Coordinator → re-query | 3/10 | **8/10** | `seam-coordinator-batch.test.ts` covers this well. Only missing: verify SuperGrid actually receives the re-query. |
| GAP-05 | HistogramScrubber drag → setRangeFilter → SQL | 4/10 | 6/10 | Range filter SQL verified in seam-calc-footer. Missing: scrubber DOM event → setRangeFilter call. |
| GAP-06 | hideEmpty → bridge query | 0/10 | **5/10** | hideEmpty is tested in 8 files (SuperDensityProvider unit, SuperGrid view, profiling). Missing: seam test verifying coordinator propagation. |
| GAP-07 | CommandBar shortcut → provider mutation | 5/10 | 5/10 | No change. CommandBar.test.ts (303 lines) tests DOM but not downstream provider effects. |
| GAP-08 | XLSX/CSV import → FTS5 trigger | 6/10 | 6/10 | Apple Notes + progress test cover FTS. CSV/XLSX imports tested but without FTS verification. |
| GAP-09 | WorkbenchShell initial state wiring | 6/10 | 6/10 | 265-line test covers DOM structure but not provider initialization order. |
| GAP-10 | CalcExplorer unit tests | 0/10 | **3/10** | `seam-calc-footer.test.ts` covers query output. No CalcExplorer DOM/lifecycle test. |

---

## 3. Strategy (Unchanged From Original — Still Correct)

### 3.1 Anti-Patching Gate
> **PERMANENT RULE**: If a test fails, fix the app to be correct, then verify the test passes because of correct behavior — not because the assertion was weakened. If the fix requires a special case or flag, stop and explain before proceeding.

### 3.2 Seam Test Definition
A seam test exercises 2+ components with only the **I/O boundary** mocked (sql.js in-memory, jsdom events, bridge spy). Everything between components is real. Mocking one component to test another is a unit test, not a seam test.

### 3.3 Directory Convention
**Use `tests/integration/`** — not a new `tests/seams/` directory. Three seam tests already live there with the `seam-*.test.ts` naming convention. Continue that pattern.

---

## 4. Shared Infrastructure

### 4.A: `tests/helpers/realDb.ts` — NEW

The existing `tests/database/seed.ts` seeds 10K cards for benchmarks. Seam tests need a lightweight factory.

```ts
// tests/helpers/realDb.ts
import { Database } from '../../src/database/Database';

/**
 * Create a real in-memory sql.js database with production schema.
 * Lightweight — no seed data. Callers insert what they need.
 */
export async function realDb(): Promise<Database> {
  const db = new Database();
  await db.initialize();
  return db;
}
```

### 4.B: `tests/helpers/makeProviders.ts` — NEW

Based on actual source: StateCoordinator has no-arg constructor, uses `registerProvider(key, provider)`.

```ts
// tests/helpers/makeProviders.ts
import { FilterProvider } from '../../src/providers/FilterProvider';
import { PAFVProvider } from '../../src/providers/PAFVProvider';
import { SelectionProvider } from '../../src/providers/SelectionProvider';
import { SuperDensityProvider } from '../../src/providers/SuperDensityProvider';
import { StateCoordinator } from '../../src/providers/StateCoordinator';

export function makeProviders() {
  const filter = new FilterProvider();
  const pafv = new PAFVProvider();
  const density = new SuperDensityProvider();
  const selection = new SelectionProvider();
  const coordinator = new StateCoordinator();

  coordinator.registerProvider('filter', filter);
  coordinator.registerProvider('pafv', pafv);
  coordinator.registerProvider('density', density);
  coordinator.registerProvider('selection', selection);

  return { filter, pafv, density, selection, coordinator };
}
```

> **CC**: Verify these constructor signatures before writing. Read each provider's source. If SchemaProvider is needed for any seam, add it with setter injection per v5.3 pattern.

### 4.C: Smoke Tests

```
tests/helpers/helpers.smoke.test.ts
```

- `realDb()` → insert row → query back → exists
- `makeProviders()` → filter.setAxisFilter() → coordinator fires → no throw

**Gate**: Both smoke tests green before proceeding.

---

## 5. Work Areas — Revised and Reordered

### Dropped Work Areas

| Original WA | Reason Dropped |
|---|---|
| WA-04 (hideEmpty RED→GREEN TDD) | hideEmpty already shipped and has coverage in 8 test files. Convert to a regular seam regression test (see revised WA-04). |

### Revised Work Areas

---

#### WA-00: Shared Infrastructure
**Files**: `tests/helpers/realDb.ts`, `tests/helpers/makeProviders.ts`, `tests/helpers/helpers.smoke.test.ts`
**Gate**: Both smoke tests pass. No duplicate Database initialization code introduced.

---

#### WA-01: GAP-01 — Filter → QueryBuilder → Real SQLite (UPGRADED)
**File**: `tests/integration/seam-filter-to-sql.test.ts`

The existing `seam-calc-footer.test.ts` tests SQL *shape*. This test executes the SQL against a real database and verifies *result correctness*.

| Test | Setup | Assert |
|---|---|---|
| eq filter excludes non-matching rows | seed 3 cards, folder=[A,A,B]; addFilter(folder,eq,A) | 2 rows, both folder=A |
| neq filter excludes matching rows | seed with status=[active,archived,active] | archived row absent |
| in filter with array | seed card_type=[note,task,event]; addFilter(card_type,in,[note,task]) | Only note+task returned |
| FTS search matches | seed 3 cards with distinct names; setSearchQuery(name2) | Only card 2 returned |
| FTS + field filter combined | setSearchQuery + addFilter(folder,eq,target) | Only dual-match returned |
| range filter: priority >= 3 | seed priorities 1-5; setRangeFilter(priority,3,null) | Only 3,4,5 returned |
| axis filter | seed mixed types; setAxisFilter(card_type,[note]) | Only notes returned |
| allowlist prevents injection | setAxisFilter with evil_field | Throws before SQL executes |
| soft-deleted rows excluded | seed 3; soft-delete 1; query | Deleted row absent |

**Gate**: All 9 pass against real sql.js. Runtime < 500ms.

---

#### WA-02: GAP-02 — PAFV → Bridge → CellDatum Shape (REGRESSION GUARD)
**File**: `tests/integration/seam-pafv-to-cells.test.ts`

| Test | Config | Assert |
|---|---|---|
| 1-axis col: card_type only | colAxes:[card_type], rowAxes:[] | CellDatum per distinct card_type; count matches seed |
| 2-axis: card_type × folder | colAxes:[card_type], rowAxes:[folder] | Correct count at each intersection |
| **`__agg__ REGRESSION: no column collision`** | any grouped query | `__agg__count` key present; no bare `count` collision |
| hideEmpty=true excludes zero cells | hideEmpty:true | No zero-count entries |
| hideEmpty=false includes zero cells | hideEmpty:false | All combinations present |
| sortOverrides applied | setSortOverrides([{field:name,direction:desc}]) | card_ids in reverse-name order |

> The `__agg__ REGRESSION` test name is **permanent** — never rename it.

**Gate**: All 6 pass.

---

#### WA-03: GAP-04 Upgrade — Filter → Coordinator → SuperGrid Re-Query
**File**: `tests/integration/seam-filter-coordinator-requery.test.ts`

The existing `seam-coordinator-batch.test.ts` covers the coordinator side. This adds the **view side** — verifying SuperGrid (or a bridge spy) actually receives the re-query.

| Test | Action | Assert |
|---|---|---|
| filter change triggers bridge re-query | filter.addFilter; flush | bridge.superGridQuery spy called |
| re-query uses updated filter params | filter.addFilter(folder,eq,Work); flush | call arg contains folder WHERE |
| rapid filter changes batch into one re-query | addFilter ×3; flush | spy called exactly once |
| filter clear triggers re-query with base WHERE | addFilter; flush; clearFilters; flush | Second call has only deleted_at IS NULL |
| after destroy, no re-query | destroy; addFilter; flush | spy not called after destroy |

**Gate**: All 5 pass. Bridge.superGridQuery is the only spy; coordinator + filter are real.

---

#### WA-04: GAP-06 — hideEmpty + viewMode Seam (REGRESSION, not TDD)
**File**: `tests/integration/seam-density-bridge.test.ts`

These are **regression guards**, not TDD-red tests. hideEmpty is already implemented. All should be GREEN on arrival.

| Test | State | Assert |
|---|---|---|
| hideEmpty=false → bridge receives false | density.setHideEmpty(false); trigger | bridge call includes hideEmpty:false |
| hideEmpty=true → bridge receives true | density.setHideEmpty(true); trigger | bridge call includes hideEmpty:true |
| viewMode=matrix → bridge receives matrix | density.setViewMode('matrix'); trigger | bridge call includes viewMode:'matrix' |
| viewMode change triggers re-query | density.setViewMode; flush | bridge called again |
| hideEmpty change triggers re-query | density.setHideEmpty; flush | bridge called again |

**Gate**: All 5 pass GREEN on first run. If any fail, it's a real bug — investigate.

---

#### WA-05: GAP-03 — ViewTabBar → PAFVProvider → ViewManager
**File**: `tests/integration/seam-view-tab-switching.test.ts`

ViewTabBar is 92 LOC. ViewManager takes `container, coordinator, queryBuilder, bridge, pafv, filter, announcer`.

| Test | Action | Assert |
|---|---|---|
| clicking supergrid tab sets viewType | simulate click on supergrid tab | pafv.getState().viewType === 'supergrid' |
| clicking network tab sets viewType | simulate click on network tab | pafv.getState().viewType === 'network' |
| tab click fires coordinator notify | click any tab; flush | coordinator subscriber called |
| active tab has aria-selected=true | click kanban tab; inspect DOM | kanban button aria-selected='true'; others 'false' |
| LATCH→GRAPH round-trip preserves state | set xAxis; click network; click list | pafv.getState().xAxis preserved |

**Gate**: All 5 pass.

---

#### WA-06: GAP-05 — HistogramScrubber → setRangeFilter → SQL
**File**: `tests/integration/seam-histogram-range-filter.test.ts`

The SQL output side is already covered in `seam-calc-footer.test.ts`. This tests the DOM event → provider call.

| Test | Action | Assert |
|---|---|---|
| scrubber drag fires setRangeFilter | pointerdown/pointermove/pointerup | filter.setRangeFilter called with correct min/max |
| range filter round-trips to SQL WHERE | drag → setRangeFilter(priority,2,4) | compile().where contains priority >= ? AND <= ? |
| scrubber reset clears range filter | drag; click reset; flush | filter.hasRangeFilter(field) === false |
| range filter triggers coordinator re-query | drag; flush | coordinator subscriber called |

**Gate**: All 4 pass.

---

#### WA-07: GAP-07 — CommandBar Shortcut → Provider Mutation
**File**: `tests/integration/seam-commandbar-shortcuts.test.ts`

CommandBar.test.ts (303 lines) already covers DOM. This covers downstream effects.

| Test | Key Event | Assert |
|---|---|---|
| ⌘F opens search mode | keydown ⌘F | search input focused; pafv state unchanged |
| Escape clears search | type + Escape | filter.setSearchQuery(null); input cleared |
| ⌘K opens palette | keydown ⌘K | palette element aria-expanded='true' |
| destroy removes listener | mount; destroy; ⌘F | no action after destroy |

**Gate**: All 4 pass.

---

#### WA-08: GAP-08 — XLSX/CSV Import → FTS5 Trigger
**File**: `tests/integration/seam-etl-fts5.test.ts`

`etl-all-parsers.test.ts` tests CSV/XLSX import but does NOT call `searchCards()` after import. `etl-roundtrip.test.ts` tests FTS but only for Apple Notes.

| Test | Import Path | Assert |
|---|---|---|
| XLSX import: FTS-searchable | import .xlsx → searchCards(name) | returns imported card |
| CSV import: FTS-searchable | import .csv → searchCards(name) | returns imported card |
| cards_fts rowcount matches cards | import any format | SELECT COUNT(*) FROM cards_fts = cards count |
| Re-import updates FTS index | import A; re-import with new name | old name returns 0; new name returns 1 |

**Gate**: All 4 pass.

---

#### WA-09: GAP-09 — WorkbenchShell Initial State Wiring
**File**: `tests/ui/WorkbenchShell.test.ts` (additions to existing 265-line file)

Read existing tests first. Skip any that already exist.

| Test | Scenario | Assert |
|---|---|---|
| mount wires providers before first render | mount(container) | pafv.getState() has valid viewType |
| initial view matches PAFVProvider default | default viewType; mount | expected view marker class present |
| filter change before mount doesn't throw | addFilter; mount | no error; filter state preserved |
| destroy cleans all subscriptions | mount; destroy; mutate; flush | no errors or callbacks after destroy |

**Gate**: All 4 new tests pass; no regressions in existing 17 tests.

---

#### WA-10: GAP-10 — CalcExplorer
**File**: `tests/ui/CalcExplorer.test.ts` (NEW)

CalcExplorer is 269 LOC. Constructor takes `CalcExplorerConfig { bridge, pafv, container, onConfigChange, schema?, alias? }`.

| Test | Scenario | Assert |
|---|---|---|
| mount creates root element | mount(container) | .calc-explorer element in DOM |
| axis change rebuilds dropdowns | pafv.setColAxes([...]); flush | dropdown count matches axis count |
| numeric field shows SUM/AVG/COUNT/MIN/MAX/OFF | mount with priority axis | dropdown has 6 options |
| text field shows COUNT/OFF only | mount with name axis | dropdown has 2 options |
| config change fires onConfigChange | select AVG in dropdown | callback fired with updated config |
| destroy cleans up | mount; destroy; mutate | no DOM updates after destroy |

**Gate**: All 6 pass.

---

## 6. Execution Order & Gates

| Step | Work Area | Gate | If Fails |
|---|---|---|---|
| 0 | Shared infrastructure | Both smoke tests pass | Fix factory wiring — do not proceed |
| 1 | WA-01: filter-to-sql | All 9 pass with real sql.js | Fix field name mismatch between allowlist and schema |
| 2 | WA-02: pafv-to-cells | All 6 pass incl. `__agg__` regression | Fix bridge shape transformation |
| 3 | WA-03: filter-coordinator-requery | All 5 pass | Fix coordinator→view subscription wiring |
| 4 | WA-04: density-bridge | All 5 pass GREEN on arrival | If RED → real bug in hideEmpty propagation |
| 5 | WA-05: view-tab-switching | All 5 pass | Fix ViewTabBar event dispatch |
| 6 | WA-06: histogram-range-filter | All 4 pass | Fix scrubber event→setRangeFilter |
| 7 | WA-07: commandbar-shortcuts | All 4 pass | Fix CommandBar listener registration |
| 8 | WA-08: etl-fts5 | All 4 pass | Fix bulk INSERT FTS trigger path |
| 9 | WA-09: WorkbenchShell additions | All 4 new + 17 existing pass | Fix provider init order |
| 10 | WA-10: CalcExplorer | All 6 pass | Implement missing CalcExplorer behavior |

---

## 7. package.json Script Additions

```json
"test:seams":   "vitest run tests/integration/seam-*.test.ts",
"test:harness": "vitest run tests/integration/seam-*.test.ts tests/ui/CalcExplorer.test.ts tests/helpers/",
"test:full":    "vitest run && swift test"
```

---

## 8. Revised Coverage Targets

| Seam / Layer | Before Harness | After Harness | Primary Work Area |
|---|---|---|---|
| Filter → SQL (real DB) | 6/10 | 9/10 | WA-01 |
| PAFV → CellDatum shape | 3/10 | 9/10 | WA-02 |
| Filter → Coordinator → View | **8/10** | 9/10 | WA-03 (view-side upgrade) |
| hideEmpty / viewMode seam | **5/10** | 9/10 | WA-04 (regression guard) |
| ViewTabBar → ViewManager | 5/10 | 9/10 | WA-05 |
| HistogramScrubber → RangeFilter | 6/10 | 9/10 | WA-06 |
| CommandBar → Provider | 5/10 | 8/10 | WA-07 |
| ETL FTS5 (all formats) | 6/10 | 9/10 | WA-08 |
| WorkbenchShell wiring | 6/10 | 9/10 | WA-09 |
| CalcExplorer | 3/10 | 8/10 | WA-10 |

---

## 9. Permanent Out-of-Scope (Unchanged)

- Pixel snapshot / visual regression tests
- CloudKit sync integration tests (requires iCloud account)
- D3 force simulation correctness
- Performance / benchmark expansion (v6.0 already has perf budgets)
- sqlite-vec / semantic similarity
- Playwright E2E browser tests (seam tests cover integration contracts)
- GeometryBroadcast / sleeper wire
- Duplicate ETL unit tests

---

## MILESTONE

All 10 work area gates green = the full app is verified at every seam. This is the quality bar for v7.0 entry.
