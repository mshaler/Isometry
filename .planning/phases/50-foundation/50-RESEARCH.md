# Phase 50: Foundation (Schema-on-Read Classification) - Research

**Researched:** 2026-02-10
**Domain:** Schema-on-read property classification, React hooks caching, sql.js synchronous queries
**Confidence:** HIGH

## Summary

Phase 50 implements a schema-on-read property classification service that reads the facets table and produces LATCH+GRAPH bucketed property lists. The implementation **already exists** in the codebase with comprehensive test coverage. Research confirms the implementation follows React best practices for hooks, sql.js synchronous query patterns, and faceted navigation principles.

The existing implementation uses `classifyProperties()` service that queries the facets table (WHERE enabled = 1, ORDER BY axis, sort_order), buckets properties into L/A/T/C/H based on the axis field, and adds 6 GRAPH properties (4 edge types + 2 computed metrics) programmatically. The `usePropertyClassification()` hook provides React-friendly access with caching via useRef, refresh capability, and dataVersion tracking for automatic cache invalidation.

**Primary recommendation:** Phase 50 planning should focus on validation and integration, not implementation. The core service and hook are production-ready.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.2+ | Hook container | Context API + concurrent features required |
| sql.js | FTS5 build | SQLite in WASM | Direct synchronous queries, bridge elimination |
| TypeScript | 5.x (strict) | Type safety | Required for codebase, no `any` allowed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | Latest | Testing | TDD workflow, already used in codebase |
| sql.js-fts5 | Latest | FTS5 support | Currently vendored in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| useRef caching | React Query | RQ adds complexity for static schema reads |
| Manual bucket logic | Computed columns | SQL can't programmatically add GRAPH metrics |
| Direct db.exec | useSQLiteQuery | Hook adds unnecessary abstraction for service layer |

**Installation:**
```bash
# Dependencies already in package.json
npm install # All required packages present
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── services/                  # Pure functions, no React dependencies
│   └── property-classifier.ts # classifyProperties(db) -> PropertyClassification
├── hooks/                     # React integration layer
│   └── data/
│       └── usePropertyClassification.ts # Hook wrapping service
└── __tests__/                 # Co-located tests
    └── property-classifier.test.ts
```

### Pattern 1: Service + Hook Separation
**What:** Pure service function that takes Database, returns data. Hook layer handles React concerns (caching, loading states, error handling).
**When to use:** Any data operation that could be called outside React (tests, workers, server-side).
**Example:**
```typescript
// Service layer (pure function)
// Source: /src/services/property-classifier.ts (existing implementation)
export function classifyProperties(db: Database): PropertyClassification {
  const classification: PropertyClassification = { L: [], A: [], T: [], C: [], H: [], GRAPH: [] };

  const result = db.exec(`
    SELECT id, name, facet_type, axis, source_column, enabled, sort_order
    FROM facets
    WHERE enabled = 1
    ORDER BY axis, sort_order
  `);

  // Process rows into LATCH buckets...
  // Add GRAPH edge types programmatically...

  return classification;
}

// Hook layer (React concerns)
// Source: /src/hooks/data/usePropertyClassification.ts (existing implementation)
export function usePropertyClassification(): UsePropertyClassificationResult {
  const { db, loading: dbLoading, error: dbError, dataVersion } = useSQLite();
  const [classification, setClassification] = useState<PropertyClassification | null>(null);
  const cacheRef = useRef<{ classification: PropertyClassification | null; dataVersion: number }>({
    classification: null,
    dataVersion: -1,
  });

  // Cache check using dataVersion
  if (cacheRef.current.dataVersion === dataVersion && cacheRef.current.classification !== null) {
    return cached result;
  }

  // Call service layer
  const result = classifyProperties(db as unknown as Database);

  // Update cache
  cacheRef.current = { classification: result, dataVersion };

  return { classification, isLoading, error, refresh };
}
```

### Pattern 2: useRef for Caching (Not useMemo)
**What:** useRef creates a mutable container that persists across renders without triggering re-renders. useMemo would recalculate on dependency changes; useRef gives manual control.
**When to use:** Cache invalidation based on external version counter (dataVersion), not React dependencies.
**Example:**
```typescript
// Source: React documentation + existing implementation
const cacheRef = useRef<{ classification: PropertyClassification | null; dataVersion: number }>({
  classification: null,
  dataVersion: -1,
});

// Manual cache check
if (cacheRef.current.dataVersion === dataVersion && cacheRef.current.classification !== null) {
  setClassification(cacheRef.current.classification);
  setIsLoading(false);
  return; // Skip query
}

// Explicit cache update
cacheRef.current = { classification: result, dataVersion };
```

**Why not useMemo?** useMemo compares dependencies with Object.is and recalculates on change. Here, we need manual control: only invalidate when dataVersion changes OR user calls refresh(). useMemo can't implement the refresh() pattern.

### Pattern 3: Synchronous sql.js Queries in Services
**What:** sql.js Database.exec() returns results synchronously (no promises). Service functions can be pure, synchronous operations.
**When to use:** Always for service layer. Hooks handle async concerns (DB loading state).
**Example:**
```typescript
// CORRECT: Synchronous service function
export function classifyProperties(db: Database): PropertyClassification {
  const result = db.exec(SQL); // Synchronous
  // Process result immediately
  return classification;
}

// WRONG: Async service function (unnecessary)
export async function classifyProperties(db: Database): Promise<PropertyClassification> {
  // sql.js is synchronous, don't add promises
}
```

**Why synchronous?** sql.js runs in the same JS runtime as D3.js and React. No bridge, no IPC, no serialization. This is the bridge elimination architecture - embrace synchronous access.

### Pattern 4: dataVersion for Cache Invalidation
**What:** SQLiteProvider exposes a dataVersion counter that increments on any data mutation (run(), execute() with INSERT/UPDATE/DELETE). Hooks check dataVersion to invalidate caches.
**When to use:** Any derived data that should refresh when underlying data changes.
**Example:**
```typescript
// Source: /src/db/SQLiteProvider.tsx (existing pattern)
// In SQLiteProvider
const [dataVersion, setDataVersion] = useState(0);

const run = (sql: string, params?: unknown[]) => {
  db.run(sql, params);
  setDataVersion(v => v + 1); // Increment on mutation
};

// In hook
const { dataVersion } = useSQLite();

useEffect(() => {
  if (cacheRef.current.dataVersion !== dataVersion) {
    loadClassification(); // Refetch on version change
  }
}, [dataVersion]);
```

### Anti-Patterns to Avoid
- **Using useMemo for manual cache control:** useMemo is for computed values, not manual invalidation. Use useRef + dataVersion.
- **Making service functions async:** sql.js is synchronous. Don't add promises unless actually needed (e.g., fetch()).
- **Querying in the hook directly:** Hook should call service function. Keeps logic testable without React.
- **Using db.exec() return format in business logic:** Transform sql.js result shape (columns/values arrays) to TypeScript interfaces in service layer, never expose to components.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hook caching | Custom memoization with useState | useRef + dataVersion | React hooks are optimized, edge cases handled |
| SQL result parsing | Manual column indexing loops | Service layer transformation | Single responsibility, testable, reusable |
| GRAPH bucket population | Database triggers | Programmatic addition in service | GRAPH metrics are computed (degree, weight), not stored |
| Facet table queries | String concatenation SQL | Parameterized queries with db.exec() | SQL injection prevention, query optimization |

**Key insight:** Property classification is a read-only operation on a mostly-static schema. The complexity is in correct bucketing logic and caching, not in fancy query optimization. The existing implementation is architecturally sound.

## Common Pitfalls

### Pitfall 1: Over-Fetching Disabled Facets
**What goes wrong:** Query returns disabled facets (enabled=0), bloating classification and causing UI bugs.
**Why it happens:** Forgot WHERE enabled = 1 clause in SQL.
**How to avoid:** Always filter enabled facets in query, not in JavaScript.
**Warning signs:** LATCH buckets contain more properties than expected, UI shows hidden facets.

**Existing implementation:** ✅ Correct - includes WHERE enabled = 1

### Pitfall 2: Incorrect Sort Order Within Buckets
**What goes wrong:** Properties appear in random order within each LATCH bucket, breaking expected UI layout.
**Why it happens:** Forgot ORDER BY axis, sort_order in SQL.
**How to avoid:** ORDER BY axis (bucket grouping), then sort_order (within-bucket ordering).
**Warning signs:** Time bucket shows "Due, Created, Modified" instead of "Created, Modified, Due".

**Existing implementation:** ✅ Correct - includes ORDER BY axis, sort_order

### Pitfall 3: Missing GRAPH Properties
**What goes wrong:** GRAPH bucket is empty or incomplete, breaking Navigator 1 UI.
**Why it happens:** Forgot to add edge types and metrics programmatically after LATCH query.
**How to avoid:** GRAPH properties don't exist in facets table. Add 4 edge types (LINK, NEST, SEQUENCE, AFFINITY) + 2 metrics (degree, weight) in code.
**Warning signs:** GRAPH bucket length !== 6, Navigator 1 crashes on GRAPH access.

**Existing implementation:** ✅ Correct - adds 4 edge types + 2 metrics programmatically

### Pitfall 4: Cache Not Invalidating on Schema Changes
**What goes wrong:** User adds/removes/reorders facets, but UI doesn't update until page refresh.
**Why it happens:** Cache only invalidates on dataVersion change, but some schema operations don't trigger it.
**How to avoid:** Provide refresh() function that clears cache manually. Document when to call it (e.g., after facet CRUD).
**Warning signs:** New facets don't appear in UI, disabled facets still visible.

**Existing implementation:** ✅ Correct - provides refresh() function, cacheRef can be manually invalidated

### Pitfall 5: Returning sql.js Raw Format to Components
**What goes wrong:** Components receive { columns: string[], values: any[][] } instead of TypeScript interfaces.
**Why it happens:** Forgot to transform db.exec() result in service layer.
**How to avoid:** Service functions return domain types (ClassifiedProperty[]), never sql.js result shape.
**Warning signs:** Components doing row[columnIdx] indexing, no TypeScript autocomplete on properties.

**Existing implementation:** ✅ Correct - service returns PropertyClassification interface, not raw db.exec() result

## Code Examples

Verified patterns from existing implementation:

### Querying Facets Table
```typescript
// Source: /src/services/property-classifier.ts (lines 88-94)
const result = db.exec(`
  SELECT id, name, facet_type, axis, source_column, enabled, sort_order
  FROM facets
  WHERE enabled = 1
  ORDER BY axis, sort_order
`);
```

### Transforming sql.js Result to TypeScript Interface
```typescript
// Source: /src/services/property-classifier.ts (lines 97-124)
if (result.length > 0 && result[0].values) {
  const columns = result[0].columns;
  const idIdx = columns.indexOf('id');
  const nameIdx = columns.indexOf('name');
  // ... other column indices

  for (const row of result[0].values) {
    const axis = row[axisIdx] as string;
    const property: ClassifiedProperty = {
      id: row[idIdx] as string,
      name: row[nameIdx] as string,
      bucket: axis as LATCHBucket,
      sourceColumn: row[sourceColumnIdx] as string,
      facetType: row[facetTypeIdx] as string,
      enabled: (row[enabledIdx] as number) === 1,
      sortOrder: row[sortOrderIdx] as number,
      isEdgeProperty: false,
    };

    // Route to appropriate LATCH bucket
    if (axis === 'L' || axis === 'A' || axis === 'T' || axis === 'C' || axis === 'H') {
      classification[axis].push(property);
    }
  }
}
```

### Adding GRAPH Edge Types Programmatically
```typescript
// Source: /src/services/property-classifier.ts (lines 127-140)
const GRAPH_EDGE_TYPES = ['LINK', 'NEST', 'SEQUENCE', 'AFFINITY'] as const;

let sortOrder = 0;
for (const edgeType of GRAPH_EDGE_TYPES) {
  classification.GRAPH.push({
    id: `edge_type_${edgeType}`,
    name: edgeType,
    bucket: 'GRAPH',
    sourceColumn: 'edge_type',
    facetType: 'edge_type',
    enabled: true,
    sortOrder: sortOrder++,
    isEdgeProperty: true,
  });
}
```

### Adding GRAPH Computed Metrics
```typescript
// Source: /src/services/property-classifier.ts (lines 142-154)
const GRAPH_METRICS = [
  { id: 'metric_degree', name: 'Degree', sourceColumn: 'degree' },
  { id: 'metric_weight', name: 'Weight', sourceColumn: 'weight' },
] as const;

for (const metric of GRAPH_METRICS) {
  classification.GRAPH.push({
    id: metric.id,
    name: metric.name,
    bucket: 'GRAPH',
    sourceColumn: metric.sourceColumn,
    facetType: 'computed',
    enabled: true,
    sortOrder: sortOrder++,
    isEdgeProperty: false,
  });
}
```

### Hook with useRef Caching and dataVersion Tracking
```typescript
// Source: /src/hooks/data/usePropertyClassification.ts (lines 66-112)
export function usePropertyClassification(): UsePropertyClassificationResult {
  const { db, loading: dbLoading, error: dbError, dataVersion } = useSQLite();

  const [classification, setClassification] = useState<PropertyClassification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cache reference to prevent unnecessary re-classifications
  const cacheRef = useRef<{
    classification: PropertyClassification | null;
    dataVersion: number;
  }>({ classification: null, dataVersion: -1 });

  const loadClassification = useCallback(() => {
    if (dbLoading || !db) return;

    // Check cache - if data version hasn't changed, use cached result
    if (
      cacheRef.current.dataVersion === dataVersion &&
      cacheRef.current.classification !== null
    ) {
      setClassification(cacheRef.current.classification);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call the classifier service
      const result = classifyProperties(db as unknown as Database);

      // Update cache
      cacheRef.current = {
        classification: result,
        dataVersion,
      };

      setClassification(result);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setClassification(null);
    } finally {
      setIsLoading(false);
    }
  }, [db, dbLoading, dataVersion]);

  // Refresh function that forces reload
  const refresh = useCallback(() => {
    // Invalidate cache
    cacheRef.current = { classification: null, dataVersion: -1 };
    loadClassification();
  }, [loadClassification]);

  return {
    classification,
    isLoading: isLoading || dbLoading,
    error,
    refresh,
  };
}
```

### Test Structure (TDD)
```typescript
// Source: /src/services/__tests__/property-classifier.test.ts (lines 75-95)
describe('classifyProperties', () => {
  test('returns 9 LATCH properties in correct buckets from default facets', () => {
    const classification = classifyProperties(db);

    // Count total LATCH properties
    const latchCount =
      classification.L.length +
      classification.A.length +
      classification.T.length +
      classification.C.length +
      classification.H.length;

    expect(latchCount).toBe(9);

    // Verify bucket assignments
    expect(classification.L).toHaveLength(1); // location
    expect(classification.A).toHaveLength(1); // name
    expect(classification.T).toHaveLength(3); // created, modified, due
    expect(classification.C).toHaveLength(3); // folder, tags, status
    expect(classification.H).toHaveLength(1); // priority
  });

  test('GRAPH bucket contains 4 edge types + 2 computed metrics', () => {
    const classification = classifyProperties(db);
    expect(classification.GRAPH).toHaveLength(6);
    // ... verify edge types and metrics
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| useMemo for all caching | useRef + dataVersion for manual control | React 18+ (2022) | Better cache invalidation control |
| Async db queries everywhere | Synchronous sql.js queries | Bridge elimination (v4.1, 2026) | Simpler mental model, no promise chains |
| React Query for all data | Selective use for remote data only | 2023-2024 | Reduced bundle size, simpler local data patterns |
| Schema stored in code | Schema read from facets table | Schema-on-read pattern (v4.x) | Dynamic facet management without code changes |

**Deprecated/outdated:**
- Bridge-based SQLite access: Replaced by direct sql.js in v4.1
- Class-based DatabaseService: Replaced by functional SQLiteProvider context in v4.1
- Manual SQL result parsing in components: Service layer transformation pattern now standard

## Open Questions

1. **Should GRAPH metrics (degree, weight) be computed on-demand or cached in nodes table?**
   - What we know: Currently computed programmatically, returned as "available" properties
   - What's unclear: When Navigator 1 actually USES degree/weight, how is it calculated? From edges table?
   - Recommendation: Keep as-is for Phase 50. If Navigator 1 needs actual values, that's a separate query concern, not classification concern

2. **How often does dataVersion increment affect performance with many simultaneous hooks?**
   - What we know: Each mutation increments dataVersion, triggering all hooks that depend on it
   - What's unclear: With 10+ hooks watching dataVersion, could mutations cause cascade re-renders?
   - Recommendation: Current implementation uses cacheRef to short-circuit if data hasn't changed. Monitor in practice; add debouncing if needed

3. **Should facets table support facet groups (e.g., "Date Properties" containing created/modified/due)?**
   - What we know: Current schema is flat, no grouping concept
   - What's unclear: Navigator 1 UI requirements - does it need visual grouping?
   - Recommendation: Phase 50 should not extend schema. If grouping needed, add in Navigator 1 phase with UI requirements defined

## Sources

### Primary (HIGH confidence)
- Existing implementation: /src/services/property-classifier.ts - complete service with LATCH+GRAPH bucketing
- Existing implementation: /src/hooks/data/usePropertyClassification.ts - React hook with caching
- Existing tests: /src/services/__tests__/property-classifier.test.ts - comprehensive test coverage
- Existing tests: /src/hooks/data/__tests__/usePropertyClassification.test.ts - hook behavior verification
- Schema definition: /src/db/schema.sql - facets table structure (lines 114-136)
- SQLiteProvider: /src/db/SQLiteProvider.tsx - dataVersion pattern, synchronous queries

### Secondary (MEDIUM confidence)
- [React useMemo documentation](https://react.dev/reference/react/useMemo) - Official React docs on memoization
- [React Hooks Guide 2026](https://inhaq.com/blog/mastering-react-hooks-the-ultimate-guide-for-building-modern-performant-uis.html) - Current best practices
- [Caching in React – useMemo and useCallback](https://www.freecodecamp.org/news/caching-in-react/) - Hook caching patterns
- [SQLite performance tuning](https://phiresky.github.io/blog/2020/sqlite-performance-tuning/) - Synchronous query performance
- [sql.js official site](https://sql.js.org/) - WASM SQLite implementation details

### Tertiary (LOW confidence)
- [Faceted Navigation patterns](https://alistapart.com/article/design-patterns-faceted-navigation/) - General faceted search UX (not specific to implementation)
- [Faceted Classification overview](https://www.sciencedirect.com/topics/computer-science/faceted-classification) - Academic context (not implementation guidance)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all dependencies already in use, no new packages needed
- Architecture: HIGH - existing implementation follows all documented patterns correctly
- Pitfalls: HIGH - existing implementation avoids all common pitfalls identified
- Code examples: HIGH - all examples from verified working code in repository

**Research date:** 2026-02-10
**Valid until:** 30 days (stable domain, existing implementation, minimal ecosystem churn expected)

**Implementation status:** ✅ COMPLETE - Phase 50 requirements already implemented with test coverage. Planning should focus on validation and integration, not implementation.
