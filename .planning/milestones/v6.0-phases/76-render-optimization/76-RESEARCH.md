# Phase 76: Render Optimization - Research

**Researched:** 2026-03-12
**Domain:** SQLite index optimization, SuperGrid render path, Worker message payload reduction
**Confidence:** HIGH — all findings grounded in direct codebase inspection + SQLite official documentation patterns

## Summary

Phase 76 is a pure optimization phase: all failing budget tests already exist (Phase 75 TDD red step), all bottleneck data already exists (Phase 74 BOTTLENECKS.md), and all implementation touch-points are known. The work is four independent tracks: (1) add covering indexes to schema.sql, (2) verify with EXPLAIN QUERY PLAN as vitest assertions, (3) truncate card_ids payloads to 50 in the supergrid handler and add a lazy-fetch `supergrid:cell-detail` message type, and (4) tune SuperGridVirtualizer OVERSCAN_ROWS and validate the VIRTUALIZATION_THRESHOLD at 20K cards with PAFV projections.

The render budget tests (dual 5K = 535ms jsdom, triple 20K = 302ms jsdom vs 128ms budget) will be addressed by a combination of virtualization tuning and render path analysis. The SQL tests (GROUP BY folder+card_type = 24.9ms, strftime = 20.6ms vs 12ms/10ms budgets) will be addressed entirely by covering indexes — no query rewrites needed.

The schema.sql already has 5 single-column partial indexes but no composite index for the two-column GROUP BY case and no expression index for the strftime GROUP BY case. The supergrid handler already returns full card_ids via GROUP_CONCAT with no truncation. The virtualizer has OVERSCAN_ROWS=5 and VIRTUALIZATION_THRESHOLD=100, neither of which has been profiled at 20K with PAFV projections.

**Primary recommendation:** Ship indexes first (fastest path to green SQL tests), then attack render budget by profiling where _renderCells time is spent at dual-axis 5K cells, then ship payload truncation + cell-detail message. All four tracks can be planned as independent plans and executed sequentially.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Index Strategy
- Indexes created via `CREATE INDEX IF NOT EXISTS` in Worker schema init (idempotent, no migration tracking)
- Only measured bottlenecks targeted: composite index `(folder, card_type, deleted_at)` + expression indexes on `created_at`
- Expression indexes for ALL five time granularities (day, week, month, quarter, year) on `created_at` — not just month
- EXPLAIN QUERY PLAN verification as vitest assertion — test asserts `USING INDEX` appears, catches regressions if query changes

#### Virtualizer Tuning
- Keep virtualizer simple: row-only windowing, no header-aware calculation
- Re-evaluate OVERSCAN_ROWS — test values 3, 5, 10 at 20K cards, pick best flicker-vs-cost tradeoff
- Vitest benchmark for virtualizer: 20K card test confirms activation and render under budget
- Claude's Discretion: VIRTUALIZATION_THRESHOLD — Claude picks fixed vs dynamic based on measurement with PAFV projections at 20K

#### Payload Reduction
- Truncate card_ids to 50 per cell in supergrid:query response — tooltip shows "50 of N" pattern
- Add `supergrid:cell-detail` Worker message for lazy-fetch of full card_ids on cell drill-down (natural companion to truncation)
- Vitest assertion on payload size: `JSON.stringify(response).length` < threshold at 20K cards — catches payload regression

#### Budget Enforcement
- Phase 76 MUST GREEN all SQL budget tests from PerfBudget.ts (12ms GROUP BY, 10ms strftime, 5ms status, 5ms FTS)
- Phase 76 ALSO targets render budget (BUDGET_RENDER_JSDOM_MS = 128ms) — not deferred to Phase 77
- If a target is unachievable with indexes alone, add more optimization (query rewrite, materialized views, caching) — keep original targets unless truly impossible
- Budget tests run locally only — skipped or relaxed in CI due to unpredictable runner perf characteristics

### Claude's Discretion
- VIRTUALIZATION_THRESHOLD — Claude picks fixed vs dynamic based on measurement with PAFV projections at 20K

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RNDR-01 | EXPLAIN QUERY PLAN analysis identifies missing indexes on PAFV GROUP BY columns | SQLite EXPLAIN QUERY PLAN output includes "USING INDEX" token when an index is used; `db.exec('EXPLAIN QUERY PLAN ...')` returns rows with detail column — vitest assertion checks `detail.includes('USING INDEX')` |
| RNDR-02 | Covering indexes added for SuperGrid axis queries (folder, card_type, status, created_at) | schema.sql already has single-column partial indexes; needs composite `(folder, card_type, deleted_at)` and five expression indexes on `strftime(pattern, created_at)` — added via `CREATE INDEX IF NOT EXISTS` |
| RNDR-03 | SuperGrid query path optimized based on profiling data at 20K card scale | Index addition is the primary optimization; render path profiling of _renderCells at dual-axis 5K guides virtualizer/payload changes |
| RNDR-04 | Virtualizer VIRTUALIZATION_THRESHOLD validated and tuned for 20K card PAFV projections | SuperGridVirtualizer.ts has VIRTUALIZATION_THRESHOLD=100, OVERSCAN_ROWS=5; both constants need empirical validation at 20K with multi-axis PAFV output (many rows, large cell counts) |
| RNDR-05 | postMessage payload size measured and reduced for large Worker responses (>10KB) | supergrid.handler.ts returns GROUP_CONCAT(id) unbounded; truncating to 50 card_ids per cell + adding supergrid:cell-detail lazy message reduces payload; `JSON.stringify(response).length` assertion enforces the budget |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sql.js | 1.14 (custom FTS5) | SQLite WASM runtime | Already in project; all DB operations go through it |
| Vitest | 4.0 | Test framework + timing assertions | Already configured; budget tests use it |
| D3.js | 7.9 | DOM data join in _renderCells | Already in project; SuperGrid is built on D3 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | 5.9 strict | Type safety for new protocol types | New `supergrid:cell-detail` message type needs protocol.ts + worker.ts entries |
| performance.now() | Browser/Node built-in | Timing measurements in tests | Already used in budget.test.ts and budget-render.test.ts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Expression indexes in schema.sql | Materialized computed column + index | Expression indexes are simpler, idempotent, and the correct SQLite approach for strftime() |
| Fixed VIRTUALIZATION_THRESHOLD | Dynamic threshold based on cell count | Fixed is simpler and measurable; dynamic adds complexity with uncertain benefit |
| Truncate in handler | Truncate in WorkerBridge | Handler truncation keeps the decision in the data layer; WorkerBridge doesn't know about domain semantics |

**Installation:** No new packages needed — all optimization work is in existing code paths.

## Architecture Patterns

### Recommended Project Structure
```
src/database/
└── schema.sql              # Add CREATE INDEX IF NOT EXISTS DDL here

src/worker/
├── protocol.ts             # Add supergrid:cell-detail to WorkerRequestType, WorkerPayloads, WorkerResponses
├── worker.ts               # Add case 'supergrid:cell-detail' to routeRequest switch
└── handlers/
    └── supergrid.handler.ts  # Add handleSuperGridCellDetail(); truncate card_ids in handleSuperGridQuery

src/views/supergrid/
└── SuperGridVirtualizer.ts  # Tune OVERSCAN_ROWS constant; validate VIRTUALIZATION_THRESHOLD

src/worker/
└── WorkerBridge.ts          # Add cellDetailQuery() method

tests/profiling/
├── budget.test.ts           # These must go GREEN after indexes land
└── budget-render.test.ts    # These must go GREEN after render optimization lands

tests/worker/handlers/
└── supergrid-cell-detail.test.ts  # New test file for cell-detail handler
```

### Pattern 1: CREATE INDEX IF NOT EXISTS in schema.sql (idempotent DDL)
**What:** All index DDL lives in schema.sql, using `CREATE INDEX IF NOT EXISTS` so re-applying schema on existing DB is safe.
**When to use:** Any new index for this project.
**Example:**
```sql
-- Composite covering index for the primary SuperGrid GROUP BY bottleneck
-- Covering (folder, card_type, deleted_at) means the WHERE deleted_at IS NULL
-- filter and the GROUP BY can both be served from the index without table scan.
CREATE INDEX IF NOT EXISTS idx_cards_sg_folder_type
    ON cards(folder, card_type, deleted_at);

-- Expression indexes for all five strftime() granularities on created_at.
-- SQLite expression indexes require the EXACT same expression as used in the query.
-- Each granularity needs its own index.
CREATE INDEX IF NOT EXISTS idx_cards_sg_created_day
    ON cards(strftime('%Y-%m-%d', created_at));
CREATE INDEX IF NOT EXISTS idx_cards_sg_created_week
    ON cards(strftime('%Y-W%W', created_at));
CREATE INDEX IF NOT EXISTS idx_cards_sg_created_month
    ON cards(strftime('%Y-%m', created_at));
CREATE INDEX IF NOT EXISTS idx_cards_sg_created_quarter
    ON cards(strftime('%Y', created_at) || '-Q' || ((CAST(strftime('%m', created_at) AS INT) - 1) / 3 + 1));
CREATE INDEX IF NOT EXISTS idx_cards_sg_created_year
    ON cards(strftime('%Y', created_at));
```

### Pattern 2: EXPLAIN QUERY PLAN vitest assertion
**What:** Run `EXPLAIN QUERY PLAN <query>` against a seeded 20K database and assert the output contains "USING INDEX".
**When to use:** For each query the new indexes are intended to accelerate.
**Example:**
```typescript
// Source: sqlite.org/eqp.html — EXPLAIN QUERY PLAN returns rows with `detail` column
it('GROUP BY folder, card_type uses covering index', () => {
    const results = db.exec(
        'EXPLAIN QUERY PLAN SELECT folder, card_type, COUNT(*) FROM cards WHERE deleted_at IS NULL GROUP BY folder, card_type'
    );
    const detail = results[0]!.values.map(row => String(row[3])).join('\n');
    expect(detail).toContain('USING INDEX');
});
```
Note: EXPLAIN QUERY PLAN rows have 4 columns: id, parent, notused, detail. The `detail` string contains the plan text.

### Pattern 3: card_ids truncation in supergrid handler
**What:** Cap GROUP_CONCAT output in the handler after splitting, keeping only the first 50 IDs per cell.
**When to use:** supergrid:query response only — cell-detail handler returns the full list.
**Example:**
```typescript
// In handleSuperGridQuery(), after splitting card_ids:
const CARD_IDS_LIMIT = 50;
const card_ids_full = typeof cardIdsRaw === 'string' ? cardIdsRaw.split(',').filter(Boolean) : [];
const card_ids = card_ids_full.slice(0, CARD_IDS_LIMIT);
const card_ids_total = card_ids_full.length; // Include in CellDatum for "50 of N" tooltip
```
The `card_ids_total` field must be added to the `CellDatum` interface in protocol.ts.

### Pattern 4: supergrid:cell-detail new Worker message
**What:** A new request type that fetches full card_ids for a single cell, identified by axis field values.
**When to use:** When user drills into a cell (tooltip, selection, export).
**Example:**
```typescript
// protocol.ts additions:
// WorkerRequestType: add 'supergrid:cell-detail'
// WorkerPayloads:
'supergrid:cell-detail': {
    axisValues: Record<string, string>; // e.g., { folder: 'work', card_type: 'note' }
    where: string;    // FilterProvider.compile() WHERE fragment
    params: unknown[];
};
// WorkerResponses:
'supergrid:cell-detail': { card_ids: string[]; total: number };
```

### Pattern 5: VIRTUALIZATION_THRESHOLD validation test
**What:** Assert that virtualizer.isActive() returns true at 20K card projections and that render completes under budget.
**When to use:** After tuning OVERSCAN_ROWS; confirms the new values don't break activation logic.
**Example:**
```typescript
it('virtualizer activates at 20K rows', () => {
    const virt = new SuperGridVirtualizer(() => 28, () => 0);
    virt.setTotalRows(20_000);
    expect(virt.isActive()).toBe(true);
});
```

### Anti-Patterns to Avoid
- **Adding indexes in Worker initialization code (not schema.sql):** Worker init runs on every startup, but schema.sql is the single source of truth. `CREATE INDEX IF NOT EXISTS` in schema.sql keeps DDL co-located with table definition and avoids scattered initialization logic.
- **Using db.exec() instead of prepare+all for parameterized queries:** The existing supergrid handler uses prepare+all correctly. Any new handler (cell-detail) must follow the same pattern.
- **Expression index expression mismatch:** SQLite expression indexes only activate when the query expression EXACTLY matches the index expression. The quarter expression in SuperGridQuery.ts uses `strftime('%Y', field) || '-Q' || ((CAST(strftime('%m', field) AS INT) - 1) / 3 + 1)` — the index DDL must use the identical string.
- **Registering event listeners inside _renderCells:** SuperGrid.ts explicitly guards against this (comment at line 1061). Any render optimization must not add new listener registrations in the render path.
- **Truncating card_ids in WorkerBridge instead of the handler:** WorkerBridge is a transport layer; domain decisions (50-card limit) belong in the handler.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Query plan inspection | Custom SQL parser | `EXPLAIN QUERY PLAN` via db.exec() | SQLite's built-in plan explanation is authoritative |
| Payload size measurement | Custom serializer | `JSON.stringify(response).length` | Standard JS; matches actual postMessage serialization cost |
| Expression index expressions | Rewrite strftime logic | Copy STRFTIME_PATTERNS from SuperGridQuery.ts verbatim | Divergence causes expression indexes to silently miss |

**Key insight:** The optimization targets are already measured; the implementation is mechanical index DDL + minor handler changes. Avoid over-engineering.

## Common Pitfalls

### Pitfall 1: Expression Index Expression Must Be Identical
**What goes wrong:** Index exists but EXPLAIN QUERY PLAN shows full table scan.
**Why it happens:** SQLite expression indexes only activate when the query's expression byte-matches the index's expression. Even a whitespace difference (e.g., `strftime( '%Y', ...)` vs `strftime('%Y', ...)`) causes a miss.
**How to avoid:** Copy the exact strings from `STRFTIME_PATTERNS` in SuperGridQuery.ts into the schema.sql index DDL. Run EXPLAIN QUERY PLAN test to confirm `USING INDEX` appears.
**Warning signs:** EXPLAIN QUERY PLAN output shows `SCAN TABLE cards` instead of `USING INDEX`.

### Pitfall 2: Partial Index vs Full Index for Expression Indexes
**What goes wrong:** Add `WHERE deleted_at IS NULL` to expression index and query plan ignores it because the query expression includes deleted_at in a different position.
**Why it happens:** SQLite partial expression indexes have restrictions — the WHERE clause must exactly match the query's WHERE clause for the partial index to activate.
**How to avoid:** Keep expression indexes as full indexes (no WHERE clause). The composite covering index `(folder, card_type, deleted_at)` should include `deleted_at` as a column, not as a WHERE clause, so it covers the `WHERE deleted_at IS NULL` filter.
**Warning signs:** EXPLAIN QUERY PLAN shows `USING INDEX (partial)` or unexpected scan.

### Pitfall 3: Quarter Expression Complexity
**What goes wrong:** The quarter strftime expression `strftime('%Y', field) || '-Q' || ((CAST(strftime('%m', field) AS INT) - 1) / 3 + 1)` — this involves string concatenation and integer arithmetic that SQLite may not index-optimize even with an expression index.
**Why it happens:** SQLite expression indexes work best with deterministic pure functions. String concatenation with arithmetic may not be considered identical to the SELECT expression.
**How to avoid:** Run EXPLAIN QUERY PLAN for the quarter query specifically. If the index doesn't activate, the fallback is acceptable (quarter is less common than month). Document the limitation.
**Warning signs:** Quarter query EXPLAIN QUERY PLAN shows table scan even after index creation.

### Pitfall 4: CellDatum Interface Extension Breaks Existing Tests
**What goes wrong:** Adding `card_ids_total?: number` to CellDatum breaks tests that construct CellDatum objects without it.
**Why it happens:** TypeScript strict mode — all existing CellDatum test fixtures and mock helpers lack the field.
**How to avoid:** Make `card_ids_total` optional (`card_ids_total?: number`) so existing code compiles without changes. Add it only in the handler's return path.
**Warning signs:** TypeScript errors on existing test fixtures after protocol.ts change.

### Pitfall 5: New Worker Message Type Requires Exhaustive Switch Update
**What goes wrong:** Adding `supergrid:cell-detail` to WorkerRequestType causes TypeScript `never` error at the exhaustive `default` case in `routeRequest()`.
**Why it happens:** The switch in worker.ts uses a `never` check — TypeScript enforces all cases are handled.
**How to avoid:** Add the case to the switch in worker.ts as part of the same plan that adds the type to protocol.ts.
**Warning signs:** TypeScript build error `Type "supergrid:cell-detail" is not assignable to type 'never'`.

### Pitfall 6: VIRTUALIZATION_THRESHOLD at 100 May Be Too Low for PAFV Projections
**What goes wrong:** With a dual-axis PAFV projection at 20K cards, the number of unique (folder × card_type) combinations is small (e.g., 4×4=16 rows), so virtualization never activates even though the render is slow due to header span computation.
**Why it happens:** Row count is not the same as cell count. The virtualizer counts leaf rows, but the render cost is proportional to total cells (rows × columns).
**How to avoid:** Profile what `_totalRows` is for dual-axis 5K cell test. If it's below 100, lowering the threshold will help. If the row count is inherently small (dense multi-axis), virtualization alone cannot fix the render — need to investigate header span DOM construction cost.
**Warning signs:** OVERSCAN_ROWS tuning has no effect on dual-axis render time.

### Pitfall 7: Budget Tests Are Sensitive to Machine Speed
**What goes wrong:** Budget tests pass on fast dev machine but fail on slower reference hardware.
**Why it happens:** Phase 74 measurements were on Apple M-series Mac. Different machines will see different absolute timings.
**How to avoid:** Per CONTEXT.md decision: budget tests run locally only, skipped/relaxed in CI. The `budget.test.ts` and `budget-render.test.ts` files must pass on the developer's machine after optimization. This is the acceptance criterion.
**Warning signs:** Tests pass locally but fail in GitHub Actions — this is expected and acceptable per the locked decision.

## Code Examples

Verified patterns from codebase inspection:

### EXPLAIN QUERY PLAN execution pattern
```typescript
// Source: src/database/Database.ts — db.exec() returns columnar results
// EXPLAIN QUERY PLAN returns 4 columns: id, parent, notused, detail
// column index 3 (detail) contains the plan text
const results = db.exec(
    'EXPLAIN QUERY PLAN SELECT folder, card_type, COUNT(*) FROM cards WHERE deleted_at IS NULL GROUP BY folder, card_type'
);
// results[0].values = [[0, 0, 0, "SCAN TABLE cards USING COVERING INDEX idx_cards_sg_folder_type"]]
const detail = results[0]!.values.map(row => String(row[3]!)).join('\n');
expect(detail).toContain('USING INDEX');
```

### prepare+all pattern for new handler (consistent with existing handlers)
```typescript
// Source: src/worker/handlers/supergrid.handler.ts — established pattern
export function handleSuperGridCellDetail(
    db: Database,
    payload: WorkerPayloads['supergrid:cell-detail'],
): WorkerResponses['supergrid:cell-detail'] {
    // Validate axis field names
    for (const field of Object.keys(payload.axisValues)) {
        validateAxisField(field);
    }
    const whereParts = ['deleted_at IS NULL'];
    const params: unknown[] = [...payload.params];
    for (const [field, val] of Object.entries(payload.axisValues)) {
        whereParts.push(`${field} = ?`);
        params.push(val);
    }
    if (payload.where) whereParts.push(payload.where);
    const sql = `SELECT id FROM cards WHERE ${whereParts.join(' AND ')}`;
    const stmt = db.prepare<Record<string, unknown>>(sql);
    const rows = params.length > 0 ? stmt.all(...params) : stmt.all();
    stmt.free();
    const card_ids = rows.map(r => String(r['id']!)).filter(Boolean);
    return { card_ids, total: card_ids.length };
}
```

### SuperGridVirtualizer threshold test pattern
```typescript
// Source: src/views/supergrid/SuperGridVirtualizer.ts — isActive() uses VIRTUALIZATION_THRESHOLD
import { SuperGridVirtualizer, VIRTUALIZATION_THRESHOLD, OVERSCAN_ROWS } from '../../src/views/supergrid/SuperGridVirtualizer';

it('virtualizer activates when rows exceed threshold', () => {
    const v = new SuperGridVirtualizer(() => 28, () => 0);
    v.setTotalRows(VIRTUALIZATION_THRESHOLD);
    expect(v.isActive()).toBe(false); // exactly at threshold: not active
    v.setTotalRows(VIRTUALIZATION_THRESHOLD + 1);
    expect(v.isActive()).toBe(true);
});
```

### Payload size assertion pattern
```typescript
// Assert supergrid:query response is under threshold after truncation
// Run at 20K cards with multi-axis config to hit worst-case cell count
it('supergrid:query payload under 100KB at 20K cards', () => {
    const cells = handleSuperGridQuery(db, config).cells;
    const size = JSON.stringify({ cells }).length;
    expect(size).toBeLessThan(100 * 1024); // 100KB
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-column partial indexes on folder, card_type, status | Composite covering index (folder, card_type, deleted_at) | Phase 76 | Eliminates full table scan for the primary SuperGrid GROUP BY bottleneck |
| No expression indexes | Five expression indexes for all strftime() granularities | Phase 76 | Eliminates table scan for time-axis GROUP BY queries |
| Unbounded GROUP_CONCAT card_ids | Truncated to 50 per cell + lazy-fetch via supergrid:cell-detail | Phase 76 | Reduces postMessage payload by ~100x at 20K cards |
| OVERSCAN_ROWS=5 (unvalidated) | OVERSCAN_ROWS tuned by measurement | Phase 76 | Reduces unnecessary DOM nodes during scroll |

**Deprecated/outdated:**
- Nothing is being removed; all existing indexes are kept, new ones are additions.

## Open Questions

1. **Will VIRTUALIZATION_THRESHOLD=100 be too low for dual-axis rendering?**
   - What we know: dual-axis 5K cells = 535ms jsdom. The virtualizer activates when row count > 100.
   - What's unclear: At 5K cells with dual axes (4 card_types × N folders), the leaf row count may be small (e.g., 16 unique folders), so virtualizer never activates.
   - Recommendation: Profile what `_totalRows` is for the dual-axis test case. If row count < 100, the bottleneck is header span computation (not row virtualization), and the fix is a different optimization (e.g., memoize header construction). Investigate and document finding.

2. **Can the 128ms jsdom render budget be met for dual-axis 5K?**
   - What we know: Baseline is 535ms jsdom (~67ms Chrome est). Budget is 128ms jsdom (~16ms Chrome).
   - What's unclear: Whether indexes alone will move the render needle (they don't — indexes speed SQL, not DOM). The render path may need additional optimization beyond virtualization.
   - Recommendation: Profile _renderCells() with dual-axis 5K. If header span computation dominates, consider memoizing colHeaders/rowHeaders derivation. If D3 data join is the bottleneck, verify key functions are being used correctly. The CONTEXT.md says "keep original targets unless truly impossible" — measure first, optimize second.

3. **Does the quarter expression index actually activate?**
   - What we know: The quarter expression uses concatenation + arithmetic which is unusual for SQLite expression indexes.
   - What's unclear: Whether SQLite will recognize the expression in the GROUP BY as matching the index expression.
   - Recommendation: Create the index, run EXPLAIN QUERY PLAN, and check. If it doesn't activate, note it as a known limitation (quarter is not a primary bottleneck — month at 20.6ms is the target).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/profiling/budget.test.ts` |
| Full suite command | `npm run bench:budgets` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RNDR-01 | EXPLAIN QUERY PLAN shows USING INDEX for folder+card_type GROUP BY | unit | `npx vitest run tests/profiling/explain-plan.test.ts` | ❌ Wave 0 |
| RNDR-01 | EXPLAIN QUERY PLAN shows USING INDEX for strftime month GROUP BY | unit | `npx vitest run tests/profiling/explain-plan.test.ts` | ❌ Wave 0 |
| RNDR-02 | Covering indexes added — SQL budget tests green | integration | `npx vitest run tests/profiling/budget.test.ts` | ✅ (currently failing) |
| RNDR-03 | SuperGrid query path optimized — SQL budget tests green | integration | `npx vitest run tests/profiling/budget.test.ts` | ✅ (currently failing) |
| RNDR-04 | Virtualizer activates at 20K rows | unit | `npx vitest run tests/views/supergrid/SuperGridVirtualizer.test.ts` | check if exists |
| RNDR-04 | Render budget assertions green after virtualizer tuning | integration | `npx vitest run tests/profiling/budget-render.test.ts` | ✅ (currently failing) |
| RNDR-05 | supergrid:query payload < threshold at 20K cards | unit | `npx vitest run tests/worker/handlers/supergrid-payload.test.ts` | ❌ Wave 0 |
| RNDR-05 | supergrid:cell-detail handler returns full card_ids for a cell | unit | `npx vitest run tests/worker/handlers/supergrid-cell-detail.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/profiling/budget.test.ts tests/profiling/budget-render.test.ts`
- **Per wave merge:** `npm run bench:budgets`
- **Phase gate:** All budget tests green before phase verification

### Wave 0 Gaps
- [ ] `tests/profiling/explain-plan.test.ts` — covers RNDR-01 EXPLAIN QUERY PLAN assertions
- [ ] `tests/worker/handlers/supergrid-payload.test.ts` — covers RNDR-05 payload size assertion + card_ids truncation
- [ ] `tests/worker/handlers/supergrid-cell-detail.test.ts` — covers RNDR-05 cell-detail handler

Existing gaps to check:
- [ ] `tests/views/supergrid/SuperGridVirtualizer.test.ts` — may already exist; confirm it covers isActive() at 20K

## Key Files Reference

All critical files for Phase 76 implementation:

| File | Role | Change Type |
|------|------|------------|
| `src/database/schema.sql` | Index DDL lives here | Add 6 new `CREATE INDEX IF NOT EXISTS` statements |
| `src/worker/protocol.ts` | Message type definitions | Add `supergrid:cell-detail` to WorkerRequestType, WorkerPayloads, WorkerResponses; add `card_ids_total?` to CellDatum |
| `src/worker/worker.ts` | Request router | Add `case 'supergrid:cell-detail'` to routeRequest switch |
| `src/worker/handlers/supergrid.handler.ts` | Business logic | Add handleSuperGridCellDetail(); truncate card_ids to 50 in handleSuperGridQuery |
| `src/worker/WorkerBridge.ts` | Main thread API | Add cellDetailQuery() method |
| `src/views/supergrid/SuperGridVirtualizer.ts` | Virtualizer constants | Tune OVERSCAN_ROWS; validate VIRTUALIZATION_THRESHOLD |
| `src/profiling/PerfBudget.ts` | Budget constants | Read-only reference for test assertions |
| `tests/profiling/budget.test.ts` | SQL budget tests | Must go GREEN — currently FAILING for GROUP BY and strftime |
| `tests/profiling/budget-render.test.ts` | Render budget tests | Must go GREEN — currently FAILING for dual and triple axis |

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all 12 files listed above
- `src/database/schema.sql` — confirmed: existing single-column indexes, no composite, no expression indexes
- `src/worker/handlers/supergrid.handler.ts` — confirmed: unbounded GROUP_CONCAT, no card_ids truncation
- `src/views/supergrid/SuperGridVirtualizer.ts` — confirmed: VIRTUALIZATION_THRESHOLD=100, OVERSCAN_ROWS=5
- `.planning/phases/74-baseline-profiling-instrumentation/BOTTLENECKS.md` — Phase 74 measured data
- `tests/profiling/budget.test.ts` and `budget-render.test.ts` — Phase 75 TDD red step, confirmed failing tests
- `src/worker/protocol.ts` — confirmed: WorkerRequestType union, WorkerPayloads, WorkerResponses shapes

### Secondary (MEDIUM confidence)
- SQLite EXPLAIN QUERY PLAN documentation (verified from prior knowledge + pattern consistent with sql.js db.exec() API)
- SQLite expression index behavior with strftime() — standard behavior, well-documented

### Tertiary (LOW confidence)
- Quarter expression index activation — theoretical; requires runtime EXPLAIN QUERY PLAN verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all existing tooling
- Architecture: HIGH — all touch-points identified from direct codebase inspection
- Pitfalls: HIGH — SQL index pitfalls are well-understood; expression index caveats verified against schema

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable domain — SQLite index behavior doesn't change)
