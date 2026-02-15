# Phase 90: SQL Integration - Research

**Researched:** 2026-02-13
**Domain:** SQL query generation, database-to-UI data binding
**Confidence:** HIGH

## Summary

Phase 90 connects the static header foundation (Phase 89) to live SQLite queries. The goal is to replace hardcoded header data with dynamic queries that discover dimension values via `GROUP BY`, handle time-based faceting with `strftime()`, and explode multi-value facets like tags using `json_each()`. This phase requires building SQL query generators, handling async/loading states in the React UI, and binding D3.js header rendering to query results.

The existing codebase already has a working pattern: `src/db/queries/facet-aggregates.ts` demonstrates the core SQL pattern (GROUP BY with COUNT for folders, statuses, and tags via json_each). Phase 90 extends this to build hierarchical headers for PAFV projection axes.

**Primary recommendation:** Build a `HeaderDiscoveryService` that generates SQL queries based on `PAFVProjection` configuration, executes them via sql.js synchronously, and transforms results into `HeaderNode` trees for D3 rendering. Use strftime for time facets, json_each for multi-select, and handle empty datasets with graceful fallbacks.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sql.js | Latest (WASM) | SQLite in browser | Synchronous queries, no bridge overhead, FTS5 support |
| D3.js | v7 | Header visualization | Data join pattern for enter/update/exit, hierarchical bindings |
| TypeScript | 5.x | Type safety | Strict mode enforced, typed query results |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React | 18 | UI state/loading | Only for loading indicators and error boundaries |
| Vitest | Latest | Testing | TDD: write query tests before implementation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sql.js synchronous | Async SQLite.swift bridge | No — eliminated in v4 architecture |
| D3.js data join | Manual DOM manipulation | D3's enter/update/exit handles transitions automatically |
| Inline SQL strings | Query builder (Kysely) | Not needed — SQL is simple and testable as strings |

**Installation:**
```bash
# All dependencies already in package.json
npm install
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── db/
│   ├── queries/
│   │   ├── facet-aggregates.ts       # ✅ Existing pattern to extend
│   │   └── header-discovery.ts       # 🆕 Phase 90 query generator
├── services/
│   └── supergrid/
│       └── HeaderDiscoveryService.ts  # 🆕 Phase 90 service layer
├── d3/
│   └── grid-rendering/
│       ├── GridRenderingEngine.ts     # ✅ Existing, calls service
│       └── NestedHeaderRenderer.ts    # ✅ Existing, binds query results
└── types/
    └── grid.ts                        # ✅ HeaderNode, PAFVProjection types
```

### Pattern 1: Header Discovery Query Generator

**What:** Function that builds SQL GROUP BY queries from PAFVProjection configuration
**When to use:** When rendering headers for any PAFV axis assignment

**Example:**
```typescript
// Source: Existing pattern in src/db/queries/facet-aggregates.ts
export function buildHeaderDiscoveryQuery(
  projection: PAFVProjection,
  axis: 'x' | 'y'
): string {
  const axisConfig = axis === 'x' ? projection.yAxis : projection.xAxis;
  if (!axisConfig) return '';

  const facet = axisConfig.facet;

  // Time facets: use strftime
  if (facet === 'year') {
    return `
      SELECT strftime('%Y', created_at) as value, COUNT(*) as count
      FROM nodes
      WHERE deleted_at IS NULL AND created_at IS NOT NULL
      GROUP BY strftime('%Y', created_at)
      ORDER BY value DESC
    `;
  }

  if (facet === 'quarter') {
    return `
      SELECT
        'Q' || ((CAST(strftime('%m', created_at) AS INTEGER) - 1) / 3 + 1) as value,
        COUNT(*) as count
      FROM nodes
      WHERE deleted_at IS NULL AND created_at IS NOT NULL
      GROUP BY value
      ORDER BY value
    `;
  }

  if (facet === 'month') {
    return `
      SELECT strftime('%Y-%m', created_at) as value, COUNT(*) as count
      FROM nodes
      WHERE deleted_at IS NULL AND created_at IS NOT NULL
      GROUP BY value
      ORDER BY value DESC
    `;
  }

  // Multi-select facets: use json_each
  if (facet === 'tags') {
    return `
      SELECT json_each.value, COUNT(*) as count
      FROM nodes, json_each(nodes.tags)
      WHERE nodes.deleted_at IS NULL AND nodes.tags IS NOT NULL
      GROUP BY json_each.value
      ORDER BY count DESC
    `;
  }

  // Default: simple column GROUP BY
  return `
    SELECT ${facet} as value, COUNT(*) as count
    FROM nodes
    WHERE deleted_at IS NULL AND ${facet} IS NOT NULL AND ${facet} != ''
    GROUP BY ${facet}
    ORDER BY count DESC
  `;
}
```

### Pattern 2: Query Result to HeaderNode Transformation

**What:** Convert flat SQL results into HeaderNode tree structure
**When to use:** After executing header discovery query, before D3 rendering

**Example:**
```typescript
// Transform SQL results into HeaderNode tree
export function buildHeaderTreeFromQuery(
  results: Array<{ value: string; count: number }>,
  facet: string
): HeaderNode[] {
  return results.map((row, index) => ({
    id: `${facet}-${row.value}`,
    label: row.value,
    level: 0,
    children: [],
    facet,
    x: 0,
    y: 0,
    width: 120,  // Will be calculated by layout service
    height: 40,
    span: 1,
    isLeaf: true,
    isExpanded: true,
    isVisible: true,
    count: row.count,
  }));
}
```

### Pattern 3: Loading State Management

**What:** React hook for async query execution with loading/error states
**When to use:** When headers need to be fetched on projection change

**Example:**
```typescript
// React hook for header discovery
export function useHeaderDiscovery(
  db: Database | null,
  projection: PAFVProjection | null
): {
  headers: { columns: HeaderNode[]; rows: HeaderNode[] } | null;
  isLoading: boolean;
  error: Error | null;
} {
  const [headers, setHeaders] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!db || !projection) {
      setHeaders(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // sql.js queries are synchronous, but wrap in try-catch for errors
      const columnQuery = buildHeaderDiscoveryQuery(projection, 'x');
      const rowQuery = buildHeaderDiscoveryQuery(projection, 'y');

      const columnResults = columnQuery ? db.exec(columnQuery) : [];
      const rowResults = rowQuery ? db.exec(rowQuery) : [];

      const columns = columnResults[0]?.values.map(([value, count]) => ({
        value: String(value),
        count: Number(count),
      })) || [];

      const rows = rowResults[0]?.values.map(([value, count]) => ({
        value: String(value),
        count: Number(count),
      })) || [];

      setHeaders({
        columns: buildHeaderTreeFromQuery(columns, projection.yAxis?.facet || ''),
        rows: buildHeaderTreeFromQuery(rows, projection.xAxis?.facet || ''),
      });
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [db, projection]);

  return { headers, isLoading, error };
}
```

### Pattern 4: Stacked (Hierarchical) Header Query

**What:** For axes with multiple facets (e.g., year > quarter > month), build nested GROUP BY
**When to use:** When `axisConfig.facets` array has length > 1

**Example:**
```typescript
export function buildStackedHeaderQuery(
  facets: string[]
): string {
  // For stacked time facets: year, quarter, month
  if (facets.includes('year') && facets.includes('month')) {
    return `
      SELECT
        strftime('%Y', created_at) as year,
        'Q' || ((CAST(strftime('%m', created_at) AS INTEGER) - 1) / 3 + 1) as quarter,
        strftime('%B', created_at) as month,
        COUNT(*) as count
      FROM nodes
      WHERE deleted_at IS NULL AND created_at IS NOT NULL
      GROUP BY year, quarter, month
      ORDER BY created_at DESC
    `;
  }

  // For stacked category facets: folder, status
  if (facets.includes('folder') && facets.includes('status')) {
    return `
      SELECT
        folder,
        status,
        COUNT(*) as count
      FROM nodes
      WHERE deleted_at IS NULL
        AND folder IS NOT NULL
        AND status IS NOT NULL
      GROUP BY folder, status
      ORDER BY folder, status
    `;
  }

  // Generic stacked query (up to 3 levels)
  const selectCols = facets.join(', ');
  const groupCols = facets.join(', ');
  return `
    SELECT ${selectCols}, COUNT(*) as count
    FROM nodes
    WHERE deleted_at IS NULL
    GROUP BY ${groupCols}
    ORDER BY ${groupCols}
  `;
}
```

### Anti-Patterns to Avoid

- **Async queries in sql.js:** sql.js is synchronous. Don't wrap in Promises unless you need to defer execution.
- **String interpolation:** Use parameterized queries (`db.exec(sql, [params])`) to avoid SQL injection, even though facet names are controlled.
- **Missing NULL checks:** Always filter `WHERE deleted_at IS NULL AND <facet> IS NOT NULL` to avoid null header values.
- **Hardcoded facet logic:** Query generator should dispatch on facet type (time, multi_select, simple) rather than hardcoding each facet.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL query builder | Custom AST/builder | Direct SQL strings with conditionals | SQLite queries are simple, testable as strings |
| Date formatting | Custom strftime wrappers | SQLite's built-in strftime() | Handles edge cases (leap years, timezones) |
| JSON array parsing | Custom split logic | SQLite's json_each() | Optimized, handles nested arrays |
| Loading indicators | Custom spinner logic | React Suspense (future) | Standard pattern for async state |
| Empty state handling | Custom fallback UI | HeaderNode with count=0 check | Consistent with D3 data join pattern |

**Key insight:** SQLite's built-in functions (strftime, json_each, GROUP BY) are battle-tested and handle edge cases. Use them directly rather than reimplementing date math or JSON parsing in JavaScript.

## Common Pitfalls

### Pitfall 1: Forgetting to Filter Deleted Nodes

**What goes wrong:** Header counts include soft-deleted cards, causing mismatch with visible data
**Why it happens:** Easy to forget `WHERE deleted_at IS NULL` in aggregation queries
**How to avoid:** Add `deleted_at IS NULL` to ALL header discovery queries as mandatory filter
**Warning signs:** Header count badges show higher numbers than visible cards in grid

### Pitfall 2: strftime() Returns NULL for Invalid Dates

**What goes wrong:** Malformed `created_at` values produce NULL results, causing empty headers
**Why it happens:** Data imported from external sources may have invalid date strings
**How to avoid:** Add `AND created_at IS NOT NULL` filter AND validate date format on import
**Warning signs:** Headers disappear after axis change to time facet

### Pitfall 3: json_each() on NULL or Empty Array

**What goes wrong:** Query returns no rows instead of empty result set
**Why it happens:** json_each(NULL) or json_each('[]') produces zero rows in cross join
**How to avoid:** Filter `WHERE tags IS NOT NULL AND tags != '[]'` before json_each
**Warning signs:** Tags axis shows "No data" even when cards exist

### Pitfall 4: Quarter Calculation Off-by-One

**What goes wrong:** January (month 1) calculates as Q0 instead of Q1
**Why it happens:** Integer division doesn't round up: `(1-1)/3 = 0`
**How to avoid:** Use formula `((month - 1) / 3) + 1` to get Q1-Q4
**Warning signs:** Quarter headers show Q0 or quarter counts don't sum to 12 months

### Pitfall 5: Week Number Ambiguity (ISO vs Sunday-start)

**What goes wrong:** Week 1 starts on different dates depending on locale
**Why it happens:** SQLite's `%W` (Sunday-start) vs `%w` (ISO Monday-start) differ
**How to avoid:** Document which week format is used, or let user configure preference
**Warning signs:** Week headers don't align with user's calendar expectations

## Code Examples

Verified patterns from SQLite official documentation and existing codebase:

### Time Facet: Year

```sql
-- Source: https://sqlite.org/lang_datefunc.html
SELECT strftime('%Y', created_at) as year, COUNT(*) as count
FROM nodes
WHERE deleted_at IS NULL AND created_at IS NOT NULL
GROUP BY strftime('%Y', created_at)
ORDER BY year DESC
```

### Time Facet: Quarter (Calculated)

```sql
-- Source: Derived from SQLite strftime documentation
SELECT
  'Q' || ((CAST(strftime('%m', created_at) AS INTEGER) - 1) / 3 + 1) as quarter,
  COUNT(*) as count
FROM nodes
WHERE deleted_at IS NULL AND created_at IS NOT NULL
GROUP BY quarter
ORDER BY quarter
```

### Time Facet: Month Name

```sql
-- Source: https://www.sqlitetutorial.net/sqlite-date-functions/sqlite-strftime-function/
SELECT strftime('%B', created_at) as month, COUNT(*) as count
FROM nodes
WHERE deleted_at IS NULL AND created_at IS NOT NULL
GROUP BY month
ORDER BY strftime('%m', created_at)  -- Numeric order, not alphabetic
```

### Multi-Select Facet: Tags

```sql
-- Source: Existing pattern in src/db/queries/facet-aggregates.ts
SELECT json_each.value as tag, COUNT(*) as count
FROM nodes, json_each(nodes.tags)
WHERE nodes.deleted_at IS NULL
  AND nodes.tags IS NOT NULL
  AND nodes.tags != '[]'
GROUP BY json_each.value
ORDER BY count DESC
```

### Hierarchical Query: Year > Quarter > Month

```sql
-- Source: Composed from SQLite strftime patterns
SELECT
  strftime('%Y', created_at) as year,
  'Q' || ((CAST(strftime('%m', created_at) AS INTEGER) - 1) / 3 + 1) as quarter,
  strftime('%B', created_at) as month,
  COUNT(*) as count
FROM nodes
WHERE deleted_at IS NULL AND created_at IS NOT NULL
GROUP BY year, quarter, month
ORDER BY created_at DESC
```

### Empty Dataset Handling

```typescript
// Source: D3.js best practices
function renderHeaders(queryResults: Array<{ value: string; count: number }>) {
  if (queryResults.length === 0) {
    // D3 data join with empty array will trigger exit() selection
    // Add a placeholder header node for "No data" state
    const emptyNode: HeaderNode = {
      id: 'empty-placeholder',
      label: 'No data',
      level: 0,
      children: [],
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      span: 1,
      isLeaf: true,
      isExpanded: false,
      isVisible: true,
      count: 0,
    };
    return [emptyNode];
  }
  return buildHeaderTreeFromQuery(queryResults);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded headers | Dynamic SQL queries | Phase 90 | Headers reflect actual data distribution |
| Manual date parsing | strftime() in SQL | Phase 90 | Edge cases handled by SQLite |
| String split for tags | json_each() | Phase 79 (already exists) | Proper array handling |
| enter/update/exit | selection.join() | D3 v5+ (already in use) | Simpler data binding code |

**Deprecated/outdated:**
- Async SQLite.swift queries: Eliminated in v4 via sql.js synchronous queries
- MessageBridge: No longer needed, sql.js runs in same JS context as D3

## Open Questions

1. **Performance threshold for header count**
   - What we know: 10K cards target per REQUIREMENTS.md (SQL-04: <100ms query time)
   - What's unclear: At what header count (e.g., 1000 unique tags) does GROUP BY slow down?
   - Recommendation: Add performance test with 10K cards, measure query time, fail if >100ms

2. **Facet type detection**
   - What we know: `facets` table has `facet_type` column (select, multi_select, date, number)
   - What's unclear: Should query generator read from facets table or hardcode type dispatch?
   - Recommendation: Start with hardcoded dispatch (year/quarter/month/tags), refactor to facets table lookup in Phase 91

3. **Hierarchical depth limit**
   - What we know: Stacked axes support multiple facets (e.g., year > quarter > month)
   - What's unclear: Is there a maximum nesting depth (3 levels? 5 levels?)
   - Recommendation: Support up to 3 levels initially (common use case: year/quarter/month or folder/subfolder/status)

4. **NULL value headers**
   - What we know: Cards with NULL facet values should show as "Unassigned" bucket
   - What's unclear: Should "Unassigned" be a separate query or COALESCE in main query?
   - Recommendation: Use COALESCE in query: `SELECT COALESCE(folder, 'Unassigned') as value, COUNT(*) as count`

5. **Week numbering standard**
   - What we know: SQLite supports `%W` (Sunday-start) and `%w` (ISO Monday-start)
   - What's unclear: Which standard should Isometry use by default?
   - Recommendation: Use ISO week (`%W`) for consistency with business calendars, document in facet config

## Sources

### Primary (HIGH confidence)
- [SQLite Date and Time Functions](https://sqlite.org/lang_datefunc.html) - Official SQLite documentation
- [SQLite JSON Functions](https://sqlite.org/json1.html) - Official JSON1 extension documentation
- Existing codebase: `src/db/queries/facet-aggregates.ts` - Working GROUP BY pattern
- Existing codebase: `src/types/grid.ts` - HeaderNode, PAFVProjection types
- Existing codebase: `src/d3/grid-rendering/GridRenderingEngine.ts` - D3 rendering integration point

### Secondary (MEDIUM confidence)
- [SQLite strftime() Function - SQLite Tutorial](https://www.sqlitetutorial.net/sqlite-date-functions/sqlite-strftime-function/) - Verified examples
- [How to GROUP BY Month in SQLite - LearnSQL.com](https://learnsql.com/cookbook/how-to-group-by-month-in-sqlite/) - Month grouping patterns
- [SQLite JSON_EACH() - Database.Guide](https://database.guide/sqlite-json_each/) - json_each usage examples
- [D3.js v7 Tutorial - GitHub sgratzl/d3tutorial](https://github.com/sgratzl/d3tutorial) - D3 v7 patterns
- [D3 Enter, Exit and Update - D3 in Depth](https://www.d3indepth.com/enterexit/) - Data join patterns

### Tertiary (LOW confidence)
- [How to GROUP BY Month and Year in SQLite - GeeksforGeeks](https://www.geeksforgeeks.org/sqlite/how-to-group-by-month-and-year-in-sqlite/) - Additional grouping examples (verify with official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - sql.js and D3.js are already in use, no new dependencies
- Architecture: HIGH - Existing facet-aggregates.ts provides proven pattern to extend
- Pitfalls: MEDIUM - Some derived from experience (quarter calculation), others inferred

**Research date:** 2026-02-13
**Valid until:** 30 days (stable APIs, unlikely to change before March 2026)

---

## Implementation Notes for Planner

**Critical path:**
1. Build `buildHeaderDiscoveryQuery()` function (SQL-01, SQL-02, SQL-03)
2. Add loading state to React hook (SQL-04)
3. Add empty dataset check and graceful fallback (SQL-05)
4. Wire service into GridRenderingEngine.renderProjectionHeaders()

**Testing strategy:**
- Unit tests for query generation (all facet types)
- Integration tests with mock sql.js database
- E2E test with 10K cards to verify <100ms performance

**Dependencies:**
- Phase 89 types (HeaderNode, PAFVProjection) must be stable
- sql.js database must be initialized before header discovery
- D3 rendering layer (NestedHeaderRenderer) already handles HeaderNode binding
