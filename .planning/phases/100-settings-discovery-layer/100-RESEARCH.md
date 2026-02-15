# Phase 100: Settings & Discovery Layer - Research

**Researched:** 2026-02-15
**Domain:** SQLite settings persistence and dynamic facet value discovery
**Confidence:** HIGH

## Summary

Phase 100 introduces two complementary systems for Isometry's schema-on-read architecture: a settings registry for user preferences and a facet value discovery layer for dynamic UI population. This eliminates hardcoded LATCH filter values (priority ranges, status options, folder lists) that currently assume specific data schemas.

The settings table provides persistent key-value storage for user preferences (status colors, default filters, UI state). The discovery queries dynamically extract distinct facet values from actual data, enabling the UI to adapt to any imported dataset without schema assumptions.

**Primary recommendation:** Use SQLite's existing `settings` table (already in schema) with JSON values, add type-safe service wrapper, and implement TanStack Query-cached discovery queries with 5-minute stale time.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sql.js | (WASM) | Settings storage, discovery queries | Already in use, zero serialization overhead |
| @tanstack/react-query | ^5.90.20 | Query caching, stale-while-revalidate | Already in package.json, industry standard for server state |
| TypeScript | strict | Type-safe settings access | Project requirement |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| JSON.stringify/parse | (native) | Settings value serialization | Simple objects, no circular refs |
| zod | (if needed) | Runtime validation for settings | If strict schema validation required |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Query | Custom cache | TQ provides battle-tested invalidation, dedupe, stale-while-revalidate out of box |
| JSON values | Separate typed columns | JSON is flexible for schema-on-read, avoids ALTER TABLE migrations |
| sql.js | IndexedDB directly | sql.js already manages all data, maintains single source of truth |

**Installation:**
No new dependencies required. All libraries already present in project.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── db/
│   ├── settings.ts              # Settings CRUD service
│   └── schema.sql               # (already has settings table)
├── services/
│   ├── facet-discovery.ts       # Discovery query builders
│   └── property-classifier.ts   # (existing, needs updates)
├── hooks/
│   ├── useSettings.ts           # React hook for settings access
│   └── useFacetValues.ts        # React hook for discovery queries
└── components/
    ├── CardDetailModal.tsx      # (update to use discovery)
    └── LATCHFilter.tsx          # (update to use discovery)
```

### Pattern 1: Settings Service Layer
**What:** Type-safe wrapper around settings table with JSON serialization
**When to use:** All user preference storage (theme, status colors, defaults)
**Example:**
```typescript
// Source: Existing schema.sql + Configuration pattern from src/features/configuration/
export interface SettingsService {
  getSetting<T>(key: string): T | null;
  setSetting<T>(key: string, value: T): void;
  deleteSetting(key: string): void;
}

// Implementation
export function createSettingsService(db: Database): SettingsService {
  return {
    getSetting<T>(key: string): T | null {
      const result = db.exec(
        'SELECT value FROM settings WHERE key = ?',
        [key]
      );
      if (!result.length || !result[0].values.length) return null;
      const json = result[0].values[0][0] as string;
      return JSON.parse(json) as T;
    },

    setSetting<T>(key: string, value: T): void {
      const json = JSON.stringify(value);
      db.run(
        `INSERT INTO settings (key, value, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at`,
        [key, json]
      );
    },

    deleteSetting(key: string): void {
      db.run('DELETE FROM settings WHERE key = ?', [key]);
    }
  };
}
```

### Pattern 2: Discovery Query Builders
**What:** Parameterized SQL builders for extracting distinct facet values
**When to use:** Populating dropdown options, detecting value ranges
**Example:**
```typescript
// Source: Existing header-discovery.ts pattern from SuperStack
export function buildFacetDiscoveryQuery(
  column: string,
  options: { excludeNull?: boolean; limit?: number } = {}
): BuiltQuery {
  const { excludeNull = true, limit = 100 } = options;

  let sql = `
    SELECT DISTINCT ${column} as value, COUNT(*) as count
    FROM cards
    WHERE deleted_at IS NULL
  `;

  if (excludeNull) {
    sql += ` AND ${column} IS NOT NULL AND ${column} != ''`;
  }

  sql += `
    GROUP BY ${column}
    ORDER BY count DESC
    LIMIT ?
  `;

  return { sql, params: [limit] };
}

// Multi-select facets (tags)
export function buildMultiSelectDiscoveryQuery(column: string): BuiltQuery {
  return {
    sql: `
      SELECT DISTINCT je.value, COUNT(*) as count
      FROM cards
      CROSS JOIN json_each(cards.${column}) AS je
      WHERE deleted_at IS NULL
        AND ${column} IS NOT NULL
      GROUP BY je.value
      ORDER BY count DESC
    `,
    params: []
  };
}
```

### Pattern 3: TanStack Query Caching
**What:** React hooks with stale-while-revalidate caching
**When to use:** All discovery queries to avoid re-fetching unchanged data
**Example:**
```typescript
// Source: TanStack Query best practices + existing useLiveQuery pattern
export function useFacetValues(column: string) {
  const db = useDatabase();

  return useQuery({
    queryKey: ['facet-values', column],
    queryFn: async () => {
      if (!db) return [];

      const query = buildFacetDiscoveryQuery(column);
      const result = db.exec(query.sql, query.params);

      if (!result.length || !result[0].values.length) return [];

      return result[0].values.map(row => ({
        value: row[0] as string,
        count: row[1] as number
      }));
    },
    staleTime: 5 * 60 * 1000,  // 5 minutes
    gcTime: 10 * 60 * 1000,    // 10 minutes
    enabled: !!db
  });
}
```

### Anti-Patterns to Avoid
- **Hardcoded option arrays:** Never define `const STATUS_OPTIONS = ['active', 'blocked', ...]` — always query actual data
- **Schema assumptions:** Don't assume priority is 0-5 or status exists — check for column existence and range
- **Sync storage access:** Don't block render while fetching settings — use loading states
- **Manual cache invalidation:** Use TanStack Query's automatic invalidation via queryKey changes

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Query caching | Custom Map/WeakMap cache | TanStack Query | Handles stale-while-revalidate, deduplication, garbage collection, background refetch |
| Settings serialization | Custom binary format | JSON.stringify/parse | Debuggable, schema-flexible, SQLite optimized for TEXT |
| Distinct value queries | Recursive table scans | GROUP BY with COUNT | Single-pass aggregation, indexed, standard SQL |
| Column existence checks | Try/catch on query | PRAGMA table_info or schema introspection | Explicit, no error handling overhead |

**Key insight:** SQLite's GROUP BY + COUNT is highly optimized for facet discovery. Custom iteration is slower and error-prone. TanStack Query's caching eliminates the need for manual cache management — stale-while-revalidate shows old data instantly while refetching in background.

## Common Pitfalls

### Pitfall 1: Settings Value Corruption
**What goes wrong:** Storing non-JSON-serializable values (functions, circular refs) causes parse errors
**Why it happens:** TypeScript generics don't enforce serializability at compile time
**How to avoid:** Use zod schema validation or restrict to JSON-primitive types
**Warning signs:** `JSON.parse` errors in console, settings not persisting correctly

### Pitfall 2: Discovery Query Performance
**What goes wrong:** `SELECT DISTINCT` on large datasets without indexes causes multi-second delays
**Why it happens:** Facet columns (folder, status) may not have covering indexes
**How to avoid:** Ensure indexes exist on all facet columns (already present in schema.sql), use LIMIT
**Warning signs:** >100ms query time, UI freezes during dropdown open

### Pitfall 3: Multi-Select JSON Handling
**What goes wrong:** `json_each()` fails if tags column contains non-array values (null, string)
**Why it happens:** Legacy data or direct SQL inserts bypass validation
**How to avoid:** Add `AND ${column} IS NOT NULL AND json_valid(${column})` guard
**Warning signs:** SQL errors like "malformed JSON", empty dropdowns despite data

### Pitfall 4: Stale UI After Mutations
**What goes wrong:** User adds new status value, dropdown doesn't show it until manual refresh
**Why it happens:** TanStack Query cache not invalidated after mutations
**How to avoid:** Call `queryClient.invalidateQueries(['facet-values'])` after INSERT/UPDATE
**Warning signs:** Users report "new values don't appear", need to reload page

### Pitfall 5: Type Safety Loss
**What goes wrong:** `getSetting<StatusColor>('status_colors')` returns `any`, bypasses type checking
**Why it happens:** JSON.parse returns `any`, TypeScript can't verify runtime shape
**How to avoid:** Use zod validators or type guards after parsing
**Warning signs:** Runtime errors like "Cannot read property of undefined", type mismatches

## Code Examples

Verified patterns from official sources and existing codebase:

### Discovery Query for Status Values
```typescript
// Source: Existing property-classifier.ts pattern
export function discoverStatusValues(db: Database): string[] {
  const result = db.exec(`
    SELECT DISTINCT status, COUNT(*) as count
    FROM cards
    WHERE status IS NOT NULL
      AND status != ''
      AND deleted_at IS NULL
    GROUP BY status
    ORDER BY count DESC
    LIMIT 50
  `);

  if (!result.length || !result[0].values.length) return [];

  return result[0].values.map(row => row[0] as string);
}
```

### Discovery Query for Priority Range
```typescript
// Source: Existing property-classifier.ts columnHasData pattern
export function discoverPriorityRange(db: Database): [number, number] | null {
  const result = db.exec(`
    SELECT MIN(priority) as min, MAX(priority) as max
    FROM cards
    WHERE priority IS NOT NULL
      AND deleted_at IS NULL
  `);

  if (!result.length || !result[0].values.length) return null;

  const [min, max] = result[0].values[0];
  return [min as number, max as number];
}
```

### Settings Hook with Type Safety
```typescript
// Source: TanStack Query + existing configuration hooks
export function useSetting<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const db = useDatabase();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['setting', key],
    queryFn: async () => {
      if (!db) return defaultValue;
      const service = createSettingsService(db);
      return service.getSetting<T>(key) ?? defaultValue;
    },
    staleTime: Infinity,  // Settings rarely change
    enabled: !!db
  });

  const setValue = useCallback((value: T) => {
    if (!db) return;
    const service = createSettingsService(db);
    service.setSetting(key, value);
    queryClient.setQueryData(['setting', key], value);
  }, [db, key, queryClient]);

  return [data ?? defaultValue, setValue];
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded arrays | Discovery queries | Phase 100 (now) | UI adapts to any dataset schema |
| Global constants | Settings table | Phase 100 (now) | User preferences persist across sessions |
| Manual cache | TanStack Query | v5.90 (Feb 2026) | Automatic stale-while-revalidate, deduplication |
| `cacheTime` config | `gcTime` config | TanStack Query v5 | Clearer semantics (garbage collection time) |

**Deprecated/outdated:**
- Hardcoded `STATUS_OPTIONS`, `FOLDER_OPTIONS` arrays — replaced by discovery queries
- `numericColumnsWithDefaults` in property-classifier.ts — should be removed after Phase 101

## Open Questions

1. **Should settings support schema versioning?**
   - What we know: Settings are JSON blobs, schema can change over time
   - What's unclear: How to handle migrations when settings structure changes
   - Recommendation: Start simple (no versioning), add migration system in Phase 101 if needed

2. **How to handle settings conflicts across devices?**
   - What we know: Isometry is local-first, sync not yet implemented
   - What's unclear: Last-write-wins vs merge strategy when sync added
   - Recommendation: Defer to sync implementation phase, assume single device for now

3. **Should discovery queries support custom filters?**
   - What we know: Some facets may need filtering (e.g., only active statuses)
   - What's unclear: Whether this adds complexity worth the flexibility
   - Recommendation: Add optional `QueryFilter[]` param to discovery builders

## Sources

### Primary (HIGH confidence)
- Existing schema.sql (lines 344-356) — settings table already defined
- src/superstack/queries/header-discovery.ts — pattern for GROUP BY queries with params
- src/services/property-classifier.ts — existing discovery logic for dynamic properties
- src/hooks/database/useLiveQueryCore.ts — TanStack Query integration pattern
- package.json — @tanstack/react-query ^5.90.20 confirmed

### Secondary (MEDIUM confidence)
- [TanStack Query Caching Examples](https://tanstack.com/query/v4/docs/react/guides/caching) — staleTime/gcTime best practices
- [React Data Fetching with TanStack Query](https://rtcamp.com/handbook/react-best-practices/data-loading/) — recommended patterns
- [SQLite Best Practices](https://www.sqliteforum.com/p/sqlite-best-practices-review) — settings table optimization
- [Faceted Search SQL Implementation](https://pretius.com/blog/sql-faceted-search-mybatis) — GROUP BY for facet discovery

### Tertiary (LOW confidence)
- [Metadata Lakehouse Architecture](https://atlan.com/know/metadata-lakehouse/) — schema-on-read concepts (general context)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, verified in package.json and imports
- Architecture: HIGH — patterns derived from existing working code (header-discovery.ts, property-classifier.ts)
- Pitfalls: MEDIUM — based on known SQLite/JSON/TanStack Query gotchas, not project-specific incidents

**Research date:** 2026-02-15
**Valid until:** 60 days (stable domain: SQLite and TanStack Query patterns unlikely to change)
