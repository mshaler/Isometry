# Phase 99: SuperStack SQL Integration - Research

**Researched:** 2026-02-15
**Domain:** SQLite query generation, React hooks, sql.js integration
**Confidence:** HIGH

## Summary

Phase 99 connects SuperStack headers to live SQLite data. The existing v6.1 implementation (Phase 89-93) already has the complete type system, tree builder, and D3.js renderer. Phase 99 adds the missing SQL layer: query builders that generate `GROUP BY` queries with `json_each()` for multi-select facets and `strftime()` for time facets, plus React hooks that fetch data and transform it into HeaderTree structures.

The codebase already provides all necessary infrastructure: `useDatabaseService` for sql.js access, `useSQLiteQuery` for query execution patterns, and `buildHeaderTree` for transforming flat SQL results into hierarchical trees. A comprehensive implementation specification exists at `superstack-phase2-sql-integration.md` with code examples, test templates, and acceptance criteria.

**Primary recommendation:** Follow the existing specification exactly. It's well-researched, includes working code examples verified against the actual schema, and aligns with established patterns.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sql.js | (vendored WASM) | SQLite in browser | Bridge elimination architecture, FTS5+JSON1 support |
| React | 18.2+ | Hook infrastructure | Existing hook patterns in codebase |
| D3.js | 7.x | Tree rendering | Already used for SuperStack renderer |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| performance.now() | Browser API | Query timing | Tracking query execution for <100ms target |
| JSON.stringify | Browser API | Param memoization | Preventing unnecessary React re-renders |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sql.js direct queries | ORM layer | Direct SQL provides better performance, explicit control over GROUP BY |
| React hooks | Class components | Hooks match existing codebase patterns |
| useDatabaseService | Raw SQLiteProvider | useDatabaseService provides compatibility layer |

**Installation:**
No new dependencies required. All infrastructure already exists.

## Architecture Patterns

### Recommended Project Structure
```
src/superstack/
├── queries/
│   ├── header-discovery.ts    # SQL query builders (NEW)
│   └── query-utils.ts          # Facet chain helpers (NEW)
├── hooks/
│   └── useSuperStackData.ts    # React data fetching hook (NEW)
├── demos/
│   └── SuperStackDemo.tsx      # Live data demo component (NEW)
└── __tests__/
    └── sql-integration.test.ts # Real sql.js tests (NEW)
```

### Pattern 1: SQL Query Builder with Parameterized Queries
**What:** Generate SQL with placeholders, return SQL + params separately
**When to use:** All database queries to prevent SQL injection
**Example:**
```typescript
// Source: superstack-phase2-sql-integration.md lines 147-234
export function buildHeaderDiscoveryQuery(
  rowFacets: FacetConfig[],
  colFacets: FacetConfig[],
  filters: QueryFilter[] = [],
  options: QueryOptions = {}
): BuiltQuery {
  const allFacets = [...rowFacets, ...colFacets];
  const params: (string | number)[] = [];

  // Build SELECT clause with strftime for time facets
  const selectClauses = allFacets.map(facet => {
    if (facet.axis === 'T' && facet.timeFormat) {
      return `strftime('${facet.timeFormat}', cards.${facet.sourceColumn}) AS ${facet.id}`;
    }
    if (facet.dataType === 'multi_select') {
      return `json_each.value AS ${facet.id}`;
    }
    return `cards.${facet.sourceColumn} AS ${facet.id}`;
  });
  selectClauses.push('COUNT(*) AS card_count');

  // Build FROM with json_each CROSS JOIN for multi_select
  let fromClause = 'FROM cards';
  const multiSelectFacets = allFacets.filter(f => f.dataType === 'multi_select');
  multiSelectFacets.forEach((facet, index) => {
    fromClause += `\nCROSS JOIN json_each(cards.${facet.sourceColumn}) AS je${index}`;
  });

  // Build WHERE with parameterized filters
  const whereClauses: string[] = ['cards.deleted_at IS NULL'];
  filters.forEach(filter => {
    whereClauses.push(`cards.${filter.facetId} = ?`);
    params.push(filter.value);
  });

  const sql = `
SELECT ${selectClauses.join(',\n  ')}
${fromClause}
WHERE ${whereClauses.join(' AND ')}
GROUP BY ${allFacets.map(f => f.id).join(', ')}
HAVING card_count > 0
ORDER BY ${allFacets.map(f => f.id).join(', ')}
  `.trim();

  return { sql, params };
}
```

### Pattern 2: React Hook with useMemo for Query Stability
**What:** Memoize query object to prevent re-renders, use useCallback for fetch function
**When to use:** All data-fetching hooks
**Example:**
```typescript
// Source: superstack-phase2-sql-integration.md lines 562-659
export function useSuperStackData(config: SuperStackDataConfig): SuperStackDataResult {
  const db = useDatabaseService();

  const [rows, setRows] = useState<QueryRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [queryTime, setQueryTime] = useState<number | null>(null);

  // Memoize query to prevent rebuilding on every render
  const query = useMemo(() => {
    return buildHeaderDiscoveryQuery(
      config.rowFacets,
      config.colFacets,
      config.filters,
      config.options
    );
  }, [config.rowFacets, config.colFacets, config.filters, config.options]);

  // Fetch function with performance tracking
  const fetchData = useCallback(async () => {
    const startTime = performance.now();
    const result = await db.executeQuery<QueryRow>(query.sql, query.params);
    setQueryTime(performance.now() - startTime);
    setRows(result.data || []);
  }, [query, db]);

  // Build trees from rows (memoized)
  const rowTree = useMemo(() => {
    return buildHeaderTree(rows, config.rowFacets, 'row');
  }, [rows, config.rowFacets]);

  return { rowTree, colTree, isLoading, queryTime, refetch: fetchData };
}
```

### Pattern 3: Tree Building from Flat SQL Results
**What:** Iterate flat rows, build tree by path, accumulate counts bottom-up
**When to use:** Converting SQL GROUP BY results into hierarchical HeaderTree
**Example:**
```typescript
// Source: src/superstack/builders/header-tree-builder.ts lines 28-96
export function buildHeaderTree(
  rows: QueryRow[],
  facets: FacetConfig[],
  axis: 'row' | 'column'
): HeaderTree {
  const roots: HeaderNode[] = [];
  const nodeMap = new Map<string, HeaderNode>();

  // Build tree by iterating through unique paths
  for (const row of rows) {
    let currentLevel = roots;
    const currentPath: string[] = [];

    for (let depth = 0; depth < facets.length; depth++) {
      const facet = facets[depth];
      const value = String(row[facet.id] ?? '');
      currentPath.push(value);
      const nodeId = currentPath.join('|');

      let node = nodeMap.get(nodeId);
      if (!node) {
        node = {
          id: nodeId,
          facet,
          value,
          depth,
          span: 0,
          children: [],
          path: [...currentPath],
          aggregate: { count: 0 }
        };
        nodeMap.set(nodeId, node);
        currentLevel.push(node);
      }

      // Accumulate counts up the tree
      node.aggregate.count += row.card_count;
      currentLevel = node.children;
    }
  }

  calculateSpansAndIndices(roots);
  return { axis, facets, roots, maxDepth: facets.length, leaves: collectLeaves(roots) };
}
```

### Anti-Patterns to Avoid
- **String interpolation in SQL:** Always use parameterized queries with `?` placeholders
- **New objects in render:** Memoize query objects to prevent infinite re-render loops
- **Synchronous db.exec() in hooks:** Use async `executeQuery` wrapper from useDatabaseService
- **Missing deleted_at filter:** Always exclude soft-deleted cards with `WHERE deleted_at IS NULL`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL parameterization | Custom escaping | BuiltQuery interface with params array | sql.js handles binding, prevents injection |
| Query memoization | Custom equality check | React useMemo with deps array | Built-in shallow comparison, avoids bugs |
| Tree building | Recursive SQL | buildHeaderTree from flat results | SQLite GROUP BY + bottom-up span calculation is simpler |
| Multi-select explosion | String parsing | `json_each()` CROSS JOIN | SQLite native JSON support, indexed, fast |
| Time facet extraction | JavaScript Date | `strftime()` in SQL | Server-side extraction, consistent timezone handling |

**Key insight:** SQLite already has FTS5, JSON1, and recursive CTEs. Use them directly rather than fetching raw data and processing in JavaScript.

## Common Pitfalls

### Pitfall 1: Schema Mismatch - cards vs nodes
**What goes wrong:** Spec examples reference `nodes` table, but schema uses `cards` table (Phase 84 migration)
**Why it happens:** Spec was written before cards/connections migration completed
**How to avoid:** Use `cards` table in queries, not `nodes`. Check `card_type` column exists.
**Warning signs:** Query fails with "no such table: nodes" or "no such column: node_type"

### Pitfall 2: Multi-Select Facet Alias Coordination
**What goes wrong:** buildSelectClause returns generic `json_each.value` but CROSS JOIN uses aliases `je0`, `je1`
**Why it happens:** Spec code has mismatch between SELECT and FROM clause generation
**How to avoid:** Pass facet index to buildSelectClause, return `je${index}.value AS ${facet.id}`
**Warning signs:** SQL error "no such column: json_each.value" when multiple multi_select facets exist

### Pitfall 3: Quarter Calculation Without Post-Processing
**What goes wrong:** `strftime('%Y-Q')` doesn't exist in SQLite, produces invalid results
**Why it happens:** Spec mentions "post-processing" but doesn't show implementation
**How to avoid:** Use `strftime('%m')` to get month, calculate quarter in JavaScript: `Math.ceil(month / 3)`
**Warning signs:** Quarter headers show "2024-Q" instead of "Q1", "Q2", etc.

### Pitfall 4: Empty Result Handling
**What goes wrong:** Hook returns `null` for trees, components crash on `tree.roots.map()`
**Why it happens:** buildHeaderTree not called when rows.length === 0
**How to avoid:** Return empty HeaderTree with `leafCount: 0, roots: []` instead of null
**Warning signs:** TypeError: Cannot read property 'map' of null

### Pitfall 5: useDatabaseService Loading State
**What goes wrong:** Queries execute before database ready, fail silently
**Why it happens:** Hook doesn't check `db.isReady()` before executing
**How to avoid:** Check `!db.isReady` and return early, use loading state from useDatabaseService
**Warning signs:** No data appears, no errors logged, query shows 0ms duration

## Code Examples

Verified patterns from official sources:

### Multi-Select Facet with json_each()
```typescript
// Source: Phase 90 implementation decisions (SQL-01, SQL-02, SQL-03)
// Dispatch on facet.dataType to generate correct SELECT clause

function buildSelectClause(facet: FacetConfig, index: number): string {
  if (facet.dataType === 'multi_select') {
    // Use alias from CROSS JOIN
    return `je${index}.value AS ${facet.id}`;
  }
  if (facet.axis === 'T' && facet.timeFormat) {
    return `strftime('${facet.timeFormat}', cards.${facet.sourceColumn}) AS ${facet.id}`;
  }
  return `cards.${facet.sourceColumn} AS ${facet.id}`;
}

// In buildHeaderDiscoveryQuery:
const multiSelectFacets = allFacets.filter(f => f.dataType === 'multi_select');
multiSelectFacets.forEach((facet, index) => {
  fromClause += `\nCROSS JOIN json_each(cards.${facet.sourceColumn}) AS je${index}`;
});
```

### Time Facet with strftime()
```typescript
// Source: COMMON_FACETS configuration in superstack-defaults.ts
const YEAR_FACET: FacetConfig = {
  id: 'year',
  axis: 'T',
  sourceColumn: 'created_at',
  timeFormat: '%Y',  // SQLite strftime format
  sortOrder: 'asc'
};

const MONTH_FACET: FacetConfig = {
  id: 'month',
  axis: 'T',
  sourceColumn: 'created_at',
  timeFormat: '%m',  // Returns '01'-'12'
  sortOrder: 'asc'
};

// Quarter requires post-processing (SQL-02 decision):
if (facet.id === 'quarter') {
  const month = parseInt(value, 10);
  const quarter = Math.ceil(month / 3);
  return `Q${quarter}`;
}
```

### Hook Pattern with Performance Tracking
```typescript
// Source: Existing useSQLiteQuery pattern in src/hooks/database/useSQLiteQuery.ts
export function useSuperStackData(config: SuperStackDataConfig): SuperStackDataResult {
  const db = useDatabaseService();
  const [queryTime, setQueryTime] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!db.isReady()) return;

    setIsLoading(true);
    const startTime = performance.now();

    try {
      const result = await db.executeQuery<QueryRow>(query.sql, query.params);
      setQueryTime(performance.now() - startTime);

      if (result.success && result.data) {
        setRows(result.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [query, db]);

  return { rowTree, colTree, isLoading, queryTime, refetch: fetchData };
}
```

### Integration Test Pattern
```typescript
// Source: superstack-phase2-sql-integration.md lines 707-1045
describe('SuperStack SQL Integration', () => {
  let SQL: initSqlJs.SqlJsStatic;
  let db: Database;

  beforeEach(async () => {
    SQL = await initSqlJs();
    db = new SQL.Database();
    db.run(SCHEMA);
    db.run(SAMPLE_NODES);
  });

  it('builds valid SQL for folder + tags rows, year + month columns', () => {
    const { sql, params } = buildHeaderDiscoveryQuery(
      [COMMON_FACETS.folder, COMMON_FACETS.tags],
      [COMMON_FACETS.year, COMMON_FACETS.month]
    );

    expect(() => db.prepare(sql)).not.toThrow();
    expect(sql).toContain('json_each');
    expect(sql).toContain("strftime('%Y'");
  });

  it('excludes deleted cards by default', () => {
    const { sql } = buildHeaderDiscoveryQuery([COMMON_FACETS.folder], []);
    const results = db.exec(sql);
    const folders = results[0].values.map(row => row[0]);

    expect(folders).not.toContain('Trash'); // deleted_at is set
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded mock data | GROUP BY queries | Phase 99 (NOW) | Headers reflect actual data |
| Manual tree building | buildHeaderTree | Phase 89 (v6.1) | Consistent span calculation |
| nodes table | cards table | Phase 84 (v5.2) | 4-type constraint, clearer semantics |
| MessageBridge | sql.js direct | v4.1 foundation | Zero serialization overhead |

**Deprecated/outdated:**
- `nodes` table: Use `cards` table (migrated in Phase 84)
- `edges` table: Use `connections` table with `via_card_id`
- String-based query building: Use BuiltQuery interface with params array

## Open Questions

1. **Should demo use cards or nodes table?**
   - What we know: Schema has both tables (nodes marked LEGACY)
   - What's unclear: Whether migration is complete, which to query
   - Recommendation: Use `cards` table, add migration check in demo setup

2. **How to handle facets with NULL values?**
   - What we know: SQL NULL != NULL in GROUP BY creates separate groups
   - What's unclear: Should NULL be filtered out or shown as "(none)"
   - Recommendation: Add `COALESCE(facet, '(none)')` in SELECT, document in tests

3. **Performance target achievable with json_each()?**
   - What we know: <100ms target for 10K cards (spec requirement TEST-05)
   - What's unclear: Whether multiple CROSS JOINs stay under budget
   - Recommendation: Implement, benchmark, add indexes if needed

## Sources

### Primary (HIGH confidence)
- `superstack-phase2-sql-integration.md` - Complete implementation specification with code examples
- `src/superstack/types/superstack.ts` - Type definitions (QueryRow, FacetConfig, HeaderTree)
- `src/superstack/builders/header-tree-builder.ts` - Tree building algorithm
- `src/hooks/database/useDatabaseService.ts` - Database service hook pattern
- `src/hooks/database/useSQLiteQuery.ts` - Query hook pattern with performance tracking
- `src/db/schema.sql` - Actual schema (cards table, FTS5, JSON columns)
- `.planning/STATE.md` - Prior SuperStack decisions (SQL-01, SQL-02, SQL-03, FACET-MAP-01)

### Secondary (MEDIUM confidence)
- CLAUDE.md - Architecture truth, sql.js strategy, D3.js patterns
- PROJECT.md - v6.3 milestone definition, requirements list

### Tertiary (LOW confidence)
None - all findings verified against code or spec.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - sql.js, React hooks, D3.js already in use
- Architecture: HIGH - Spec provides complete code examples, aligns with existing patterns
- Pitfalls: HIGH - Schema mismatch identified via direct inspection, other issues from spec review

**Research date:** 2026-02-15
**Valid until:** 2026-03-17 (30 days - stable domain, schema unlikely to change)
