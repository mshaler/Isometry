# Phase 63: Schema & Query Safety - Research

**Researched:** 2026-02-12
**Domain:** SQLite schema design for dynamic properties, SQL injection prevention, YAML parsing
**Confidence:** HIGH

## Summary

Phase 63 focuses on three critical data integrity concerns: (1) storing arbitrary YAML frontmatter properties in a flexible schema, (2) fixing SQL injection vulnerabilities by using proper parameterized queries, and (3) ensuring deterministic ETL identity generation. The research reveals that sql.js fully supports prepared statement parameter binding via `stmt.bind()`, modern YAML parsers like `gray-matter` handle arbitrary frontmatter keys elegantly, and that storing dynamic properties as JSON columns is significantly more performant than Entity-Attribute-Value (EAV) tables for this use case.

The existing codebase has mixed parameter usage: `db.exec()` correctly passes parameters in some places (e.g., SuperGrid filtering), but `execute()` in `src/db/operations.ts` has a critical bug where the `params` argument is ignored entirely. Additionally, `uuidv4()` is used for node IDs instead of deterministic UUID v5 generation, which prevents idempotent ETL runs.

**Primary recommendation:** Add JSON column to nodes table for arbitrary properties (avoid EAV), fix `execute()` to use `stmt.bind()`, upgrade to `gray-matter` for YAML parsing with unknown key preservation, and implement UUID v5 for deterministic source_id generation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sql.js-fts5 | Latest | SQLite in WASM with FTS5 | Already in use, supports all needed SQLite features including JSON1 |
| gray-matter | ^4.0.3 | YAML frontmatter parser | Battle-tested, used by Gatsby/Netlify/Astro, preserves unknown keys |
| uuid | ^9.0.0+ | UUID generation (v4 and v5) | Already in use, supports deterministic v5 generation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| yaml | ^2.3.4 | Full YAML parser | If gray-matter insufficient for complex YAML structures |
| @paralleldrive/cuid2 | ^2.2.0 | Collision-resistant IDs | Alternative to UUID v5 if stronger collision resistance needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON column | EAV table (node_properties) | EAV provides ultimate flexibility but ~10x slower queries, complex joins, no data integrity |
| gray-matter | front-matter | front-matter is simpler but gray-matter has wider adoption and better edge case handling |
| UUID v5 | cuid2 | cuid2 has stronger collision resistance but UUID v5 is standard and sufficient |

**Installation:**
```bash
npm install gray-matter  # YAML frontmatter parser
# uuid already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── db/
│   ├── schema.sql           # Add dynamic_properties JSON column to nodes
│   ├── operations.ts        # FIX: execute() must use stmt.bind(params)
│   └── migrations/          # Schema migration for adding column
├── etl/
│   ├── alto-parser.ts       # UPGRADE: Replace custom YAML parser with gray-matter
│   ├── alto-importer.ts     # FIX: Use UUID v5 instead of uuidv4()
│   └── source-id-generator.ts  # NEW: Centralized deterministic ID generation
└── services/
    └── property-service.ts  # NEW: Dynamic property CRUD operations
```

### Pattern 1: JSON Column for Dynamic Properties

**What:** Store arbitrary YAML frontmatter properties in a `dynamic_properties` JSON column on the `nodes` table instead of creating an EAV table.

**When to use:** When properties are sparse, schema is unknown at design time, and read performance matters.

**Example:**
```sql
-- Add to schema.sql
ALTER TABLE nodes ADD COLUMN dynamic_properties TEXT; -- JSON object

-- Query with JSON1 extension
SELECT id, name, json_extract(dynamic_properties, '$.custom_field') as custom_field
FROM nodes
WHERE json_extract(dynamic_properties, '$.status') = 'active';

-- Create index on frequently-queried JSON path
CREATE INDEX idx_nodes_dynamic_status
ON nodes(json_extract(dynamic_properties, '$.status'));
```

**Why this pattern:**
- **Performance:** JSON queries are 5-10x faster than EAV joins
- **Simplicity:** Single row per node, no complex JOINs
- **Indexing:** SQLite JSON1 supports indexed expressions
- **Type safety:** Can validate JSON schema in application layer
- **Storage:** More efficient than EAV (no repeated entity_id per attribute)

### Pattern 2: Parameterized Queries with stmt.bind()

**What:** Use sql.js prepared statement parameter binding to prevent SQL injection.

**When to use:** Always, for any query with user-provided or dynamic values.

**Example:**
```typescript
// CORRECT: Using stmt.bind() with parameters
const execute = (sql: string, params: unknown[] = []): Record<string, unknown>[] => {
  const stmt = db.prepare(sql);

  // Bind parameters before stepping through results
  if (params.length > 0) {
    stmt.bind(params as BindParams);
  }

  const results: Record<string, unknown>[] = [];
  while (stmt.step()) {
    const columns = stmt.getColumnNames();
    const values = stmt.get();
    const row: Record<string, unknown> = {};
    columns.forEach((col, index) => {
      row[col] = values[index];
    });
    results.push(row);
  }

  stmt.free();
  return results;
};

// WRONG: String interpolation (current bug in operations.ts line 33)
const execute = (sql: string, _params: unknown[] = []): Record<string, unknown>[] => {
  // BUG: _params is IGNORED! This allows SQL injection
  const stmt = db.prepare(sql);  // sql might contain user input
  while (stmt.step()) { /* ... */ }
};
```

**sql.js Parameter Formats:**
- Named: `:name`, `@name`, `$name` → bind with object: `{$name: value}`
- Positional: `?` → bind with array: `[value1, value2]`

### Pattern 3: Deterministic UUID v5 Generation

**What:** Use UUID v5 (SHA-1 hash) to generate deterministic IDs from source data, ensuring idempotent ETL imports.

**When to use:** ETL pipelines where the same source data should always produce the same node ID.

**Example:**
```typescript
// Source: Adaptation from UUID RFC 4122 and deterministic UUID generation patterns

import { v5 as uuidv5 } from 'uuid';

// Define namespace UUID for your application
const ISOMETRY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // Or generate once and hardcode

/**
 * Generate deterministic source_id from source system and identifier
 * Same inputs always produce same UUID
 */
export function generateDeterministicSourceId(
  source: string,
  sourceIdentifier: string | number
): string {
  // Combine source and identifier into canonical string
  const canonical = `${source}:${sourceIdentifier}`;

  // Generate UUID v5 from namespace and canonical string
  return uuidv5(canonical, ISOMETRY_NAMESPACE);
}

// Usage in ETL
const node = {
  id: uuidv4(), // Random ID for internal use
  source: 'alto-index',
  source_id: generateDeterministicSourceId('alto-index', frontmatter.id),
  // ... other fields
};

// On re-import, same source_id is generated
// UNIQUE constraint on (source, source_id) prevents duplicates
```

**Benefits:**
- **Idempotent imports:** Re-running ETL on same data doesn't create duplicates
- **Collision resistance:** SHA-1 provides sufficient collision resistance (50% at 2.71 quintillion)
- **Standard:** UUID v5 is RFC 4122 standard, widely supported
- **Deterministic:** Same inputs = same output, predictable for testing

**Collision handling fallback:**
```typescript
/**
 * Insert with collision fallback
 * If source_id collision occurs, append counter until unique
 */
async function insertWithCollisionFallback(node: NodeRecord, db: Database): Promise<string> {
  let attempt = 0;
  let sourceId = node.source_id;

  while (attempt < 100) { // Safety limit
    try {
      db.run(
        `INSERT INTO nodes (id, source, source_id, name, ...) VALUES (?, ?, ?, ?, ...)`,
        [node.id, node.source, sourceId, node.name, ...]
      );
      return sourceId;
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        // Generate new source_id with counter suffix
        attempt++;
        sourceId = generateDeterministicSourceId(
          node.source,
          `${node.source_id}-${attempt}`
        );
      } else {
        throw error;
      }
    }
  }

  throw new Error('Failed to generate unique source_id after 100 attempts');
}
```

### Pattern 4: YAML Frontmatter Parsing with gray-matter

**What:** Use `gray-matter` to parse markdown files with YAML frontmatter, preserving all keys including unknown ones.

**When to use:** ETL pipelines importing markdown files with arbitrary YAML frontmatter.

**Example:**
```typescript
// Source: gray-matter documentation patterns

import matter from 'gray-matter';

/**
 * Parse markdown file with YAML frontmatter
 * Preserves all keys, even those not in TypeScript interface
 */
export function parseMarkdownWithFrontmatter(fileContent: string): {
  frontmatter: Record<string, unknown>;
  content: string;
  yaml: string;
} {
  const parsed = matter(fileContent);

  return {
    frontmatter: parsed.data,           // All YAML keys as object
    content: parsed.content,            // Markdown content
    yaml: parsed.matter || '',          // Raw YAML string
  };
}

// Usage
const file = fs.readFileSync('note.md', 'utf8');
const { frontmatter, content } = parseMarkdownWithFrontmatter(file);

// Map known LATCH fields
const node = {
  id: uuidv4(),
  name: frontmatter.title as string || 'Untitled',
  folder: frontmatter.folder as string || null,
  tags: JSON.stringify(frontmatter.tags || []),
  created_at: frontmatter.created as string || new Date().toISOString(),
  // ... other known fields
};

// Store unknown fields in dynamic_properties
const knownKeys = new Set(['title', 'folder', 'tags', 'created', 'modified', 'status', 'priority']);
const dynamicProperties: Record<string, unknown> = {};

Object.entries(frontmatter).forEach(([key, value]) => {
  if (!knownKeys.has(key)) {
    dynamicProperties[key] = value;
  }
});

node.dynamic_properties = JSON.stringify(dynamicProperties);
```

**Configuration options:**
```typescript
// Advanced: Custom YAML parser with specific options
import matter from 'gray-matter';
import yaml from 'yaml';

const parsed = matter(fileContent, {
  engines: {
    yaml: {
      parse: (str: string) => yaml.parse(str, {
        // Preserve unknown tags
        strict: false,
        // Keep original types
        schema: 'core',
      }),
    },
  },
});
```

### Anti-Patterns to Avoid

- **Don't use EAV tables for dynamic properties:** Query complexity explodes, performance degrades 5-10x, and you lose referential integrity. Use JSON columns instead.

- **Don't ignore parameters in execute():** The current bug in `src/db/operations.ts:33` where `_params` is unused creates SQL injection vulnerability. Always call `stmt.bind(params)`.

- **Don't use uuidv4() for ETL source_id:** Random UUIDs make re-imports create duplicates. Use UUID v5 for deterministic generation.

- **Don't hand-roll YAML frontmatter parsers:** Custom parsers miss edge cases. Use `gray-matter` which handles YAML, TOML, JSON, and Coffee frontmatter.

- **Don't store JSON as unindexed TEXT:** Use SQLite's JSON1 extension and create indexes on frequently-queried JSON paths for performance.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom regex/split parser | `gray-matter` | Handles YAML/TOML/JSON, preserves unknown keys, battle-tested by Gatsby/Netlify |
| Deterministic ID generation | Hash concatenation | UUID v5 (SHA-1) | Standard, collision-resistant, properly namespaced |
| Dynamic property storage | EAV table schema | JSON column with JSON1 | 5-10x faster queries, simpler schema, indexable |
| SQL injection prevention | Manual escaping | Parameterized queries (stmt.bind) | Impossible to get wrong, database-level protection |

**Key insight:** These are solved problems with mature libraries and SQL features. Custom solutions introduce bugs (missing YAML edge cases), security vulnerabilities (injection attacks), and performance issues (EAV join complexity).

## Common Pitfalls

### Pitfall 1: Ignoring Parameters in execute()

**What goes wrong:** SQL injection vulnerability when `execute(sql, params)` doesn't actually bind the parameters.

**Why it happens:** The current implementation in `src/db/operations.ts:33` names the parameter `_params` (underscore prefix signals unused) and never calls `stmt.bind()`.

**How to avoid:**
```typescript
// WRONG (current code):
const execute = (sql: string, _params: unknown[] = []): Record<string, unknown>[] => {
  const stmt = db.prepare(sql);  // _params never used!
  while (stmt.step()) { /* ... */ }
};

// CORRECT:
const execute = (sql: string, params: unknown[] = []): Record<string, unknown>[] => {
  const stmt = db.prepare(sql);

  if (params.length > 0) {
    stmt.bind(params as BindParams);  // Actually bind the parameters
  }

  while (stmt.step()) { /* ... */ }
};
```

**Warning signs:**
- Parameter prefixed with underscore (`_params`)
- No call to `stmt.bind()` in the function body
- String concatenation or template literals in SQL queries
- User input directly in SQL string

### Pitfall 2: Using db.exec() for INSERT/UPDATE

**What goes wrong:** `db.exec()` doesn't trigger `setDataVersion()` increment, so React components don't re-fetch updated data.

**Why it happens:** `db.exec()` is a low-level API that returns results but doesn't integrate with the live data synchronization system. Only `run()` increments `dataVersion`.

**How to avoid:**
```typescript
// WRONG: Direct db.exec for mutations
db.exec(`INSERT INTO nodes (id, name) VALUES (?, ?)`, [id, name]);
// Components won't see the new data until manual refresh!

// CORRECT: Use run() from DatabaseOperations
const { run } = useSQLiteQuery();
run(`INSERT INTO nodes (id, name) VALUES (?, ?)`, [id, name]);
// Increments dataVersion → all useSQLiteQuery hooks refetch
```

**Warning signs:**
- `db.exec()` used for INSERT, UPDATE, or DELETE
- Manual state updates after database writes
- Components showing stale data after mutations

### Pitfall 3: EAV Table Performance Cliff

**What goes wrong:** EAV tables seem elegant for dynamic properties but query performance degrades dramatically as data grows.

**Why it happens:** Fetching all properties for one entity requires joining or aggregating many rows. 10 properties = 10 rows = 10x the I/O and index lookups.

**How to avoid:**
```sql
-- WRONG: EAV table (slow)
CREATE TABLE node_properties (
  node_id TEXT REFERENCES nodes(id),
  key TEXT,
  value TEXT,
  PRIMARY KEY (node_id, key)
);

-- Fetching one node's properties requires aggregation:
SELECT n.*,
  json_group_object(np.key, np.value) as properties
FROM nodes n
LEFT JOIN node_properties np ON n.id = np.node_id
WHERE n.id = ?
GROUP BY n.id;
-- Complex query, multiple joins, slow with 1000+ nodes

-- CORRECT: JSON column (fast)
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  name TEXT,
  dynamic_properties TEXT  -- JSON object
);

-- Fetching one node is simple:
SELECT * FROM nodes WHERE id = ?;
-- Single row fetch, fast
```

**Warning signs:**
- More than 3 tables joined to fetch one logical entity
- Queries with `GROUP BY` and `json_group_object` for property assembly
- Linear performance degradation as property count increases
- Complex application code to reassemble entities from rows

### Pitfall 4: Non-Deterministic ETL IDs

**What goes wrong:** Re-importing the same data creates duplicate nodes because `uuidv4()` generates different IDs each time.

**Why it happens:** Random UUIDs are non-deterministic by design. ETL needs deterministic IDs based on source data.

**How to avoid:**
```typescript
// WRONG: Random UUID for source_id
const node = {
  id: uuidv4(),
  source: 'alto-index',
  source_id: uuidv4(),  // Different every time!
  // ...
};
// Re-import creates duplicate even though source data is identical

// CORRECT: Deterministic UUID v5
import { v5 as uuidv5 } from 'uuid';

const node = {
  id: uuidv4(),  // Internal ID can be random
  source: 'alto-index',
  source_id: uuidv5(`alto-index:${frontmatter.id}`, NAMESPACE),
  // Same frontmatter.id always produces same source_id
};
// Re-import finds existing node via UNIQUE(source, source_id)
```

**Warning signs:**
- `uuidv4()` used for `source_id` field
- ETL imports create duplicates on re-run
- No UNIQUE constraint on (source, source_id)
- Manual deduplication logic after import

## Code Examples

Verified patterns from official sources and current codebase analysis:

### Fixing execute() Parameter Binding

```typescript
// File: src/db/operations.ts
// Source: sql.js Statement documentation + current codebase pattern

/**
 * FIXED: execute() now properly binds parameters
 * Prevents SQL injection by using prepared statement binding
 */
const execute = (sql: string, params: unknown[] = []): Record<string, unknown>[] => {
  if (!db) {
    throw new Error('Database not initialized');
  }

  try {
    const stmt = db.prepare(sql);

    // CRITICAL FIX: Bind parameters before stepping
    if (params.length > 0) {
      stmt.bind(params as BindParams);
    }

    const results: Record<string, unknown>[] = [];

    while (stmt.step()) {
      const columns = stmt.getColumnNames();
      const values = stmt.get();
      const row: Record<string, unknown> = {};

      columns.forEach((col, index) => {
        row[col] = values[index];
      });
      results.push(row);
    }

    stmt.free();
    return results;
  } catch (error) {
    devLogger.error('SQLiteProvider.execute() failed', error);
    throw error;
  }
};
```

### JSON Column Schema Migration

```sql
-- File: src/db/migrations/002_add_dynamic_properties.sql
-- Source: SQLite JSON1 extension patterns

-- Add JSON column for arbitrary YAML frontmatter properties
ALTER TABLE nodes ADD COLUMN dynamic_properties TEXT;

-- Create index on frequently-queried JSON path
-- Example: Index on status field within dynamic properties
CREATE INDEX idx_nodes_dynamic_status
ON nodes(json_extract(dynamic_properties, '$.status'))
WHERE dynamic_properties IS NOT NULL;

-- Create index on another common field (project)
CREATE INDEX idx_nodes_dynamic_project
ON nodes(json_extract(dynamic_properties, '$.project'))
WHERE dynamic_properties IS NOT NULL;
```

### Dynamic Property Service

```typescript
// File: src/services/property-service.ts
// Source: Design pattern for dynamic property CRUD

import type { Database } from 'sql.js';

export class DynamicPropertyService {
  constructor(private db: Database) {}

  /**
   * Get all dynamic properties for a node
   */
  getDynamicProperties(nodeId: string): Record<string, unknown> {
    const result = this.db.exec(
      `SELECT dynamic_properties FROM nodes WHERE id = ?`,
      [nodeId]
    );

    if (result.length === 0 || !result[0].values[0]) {
      return {};
    }

    const jsonString = result[0].values[0][0] as string;
    return jsonString ? JSON.parse(jsonString) : {};
  }

  /**
   * Set a dynamic property value
   */
  setDynamicProperty(
    nodeId: string,
    key: string,
    value: unknown
  ): void {
    // Get current properties
    const current = this.getDynamicProperties(nodeId);

    // Update property
    current[key] = value;

    // Save back
    this.db.run(
      `UPDATE nodes SET dynamic_properties = ? WHERE id = ?`,
      [JSON.stringify(current), nodeId]
    );
  }

  /**
   * Query nodes by dynamic property value
   */
  queryByDynamicProperty(
    key: string,
    value: unknown
  ): Array<Record<string, unknown>> {
    const result = this.db.exec(
      `SELECT id, name, dynamic_properties
       FROM nodes
       WHERE json_extract(dynamic_properties, ?) = ?`,
      [`$.${key}`, value]
    );

    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map(row => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  }
}
```

### Deterministic Source ID Generator

```typescript
// File: src/etl/source-id-generator.ts
// Source: UUID v5 RFC 4122 + collision handling pattern

import { v5 as uuidv5 } from 'uuid';
import type { Database } from 'sql.js';

// Application namespace UUID (generate once and hardcode)
// Or use a standard namespace like DNS: '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const ISOMETRY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Generate deterministic source_id from source and identifier
 * Same inputs always produce same UUID
 */
export function generateDeterministicSourceId(
  source: string,
  sourceIdentifier: string | number
): string {
  const canonical = `${source}:${sourceIdentifier}`;
  return uuidv5(canonical, ISOMETRY_NAMESPACE);
}

/**
 * Insert node with collision fallback
 * If source_id collision occurs, append counter until unique
 */
export function insertNodeWithCollisionHandling(
  db: Database,
  node: Record<string, unknown>,
  maxAttempts = 100
): string {
  let attempt = 0;
  let sourceId = node.source_id as string;
  const baseSourceIdentifier = sourceId;

  while (attempt < maxAttempts) {
    try {
      // Attempt insert with current source_id
      db.run(
        `INSERT INTO nodes (
          id, source, source_id, name, content, folder,
          created_at, dynamic_properties
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          node.id,
          node.source,
          sourceId,
          node.name,
          node.content,
          node.folder,
          node.created_at,
          node.dynamic_properties,
        ]
      );

      return sourceId; // Success

    } catch (error) {
      const err = error as Error;
      if (err.message.includes('UNIQUE constraint failed')) {
        // Collision detected - generate new source_id with counter
        attempt++;
        sourceId = generateDeterministicSourceId(
          node.source as string,
          `${baseSourceIdentifier}-collision-${attempt}`
        );
      } else {
        // Different error - propagate
        throw error;
      }
    }
  }

  throw new Error(
    `Failed to generate unique source_id after ${maxAttempts} attempts`
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom YAML parser (regex-based) | `gray-matter` with full YAML support | 2024+ | Handles edge cases, preserves unknown keys, supports TOML/JSON |
| EAV tables for sparse data | JSON columns with JSON1 indexing | 2022+ (SQLite 3.38.0) | 5-10x faster queries, simpler schema, built-in type validation |
| String concatenation queries | Parameterized queries via stmt.bind() | Always best practice | Prevents SQL injection, improves query plan caching |
| UUID v4 for all IDs | UUID v5 for deterministic IDs | When idempotence needed | Enables re-runnable ETL, deduplication by design |

**Deprecated/outdated:**
- **front-matter package:** Still works but `gray-matter` is more widely adopted and feature-complete
- **Custom JSON stringification for properties:** SQLite JSON1 provides native JSON query/index capabilities
- **Manual escaping for SQL strings:** Universally replaced by parameterized queries in modern practice

## Open Questions

1. **Migration strategy for existing nodes without dynamic_properties**
   - What we know: Schema can add nullable column, backward compatible
   - What's unclear: Should we backfill from existing `tags` JSON or other fields?
   - Recommendation: Add column as NULL, populate on first update/access (lazy migration)

2. **Performance of JSON1 indexes at scale**
   - What we know: SQLite JSON1 supports indexed expressions on JSON paths
   - What's unclear: Performance characteristics with 100k+ nodes and complex JSON
   - Recommendation: Create indexes conservatively on most-queried paths, monitor with EXPLAIN QUERY PLAN

3. **Collision probability with UUID v5 in practice**
   - What we know: Theoretical 50% collision at 2.71 quintillion UUIDs
   - What's unclear: Real-world collision rates with alto-index data volumes
   - Recommendation: Implement collision fallback (append counter), log collisions for monitoring

4. **gray-matter vs custom parser performance**
   - What we know: gray-matter handles more edge cases, preserves unknown keys
   - What's unclear: Performance impact on large file imports (1000+ files)
   - Recommendation: Use gray-matter, optimize with streaming if needed

## Sources

### Primary (HIGH confidence)
- [sql.js Statement Documentation](https://sql.js.org/documentation/Statement.html) - Parameter binding syntax and methods
- [SQLite JSON1 Extension Documentation](https://sqlite.org/json1.html) - JSON functions, operators, and indexing
- [gray-matter npm package](https://www.npmjs.com/package/gray-matter) - YAML frontmatter parsing
- [UUID RFC 4122](https://en.wikipedia.org/wiki/Universally_unique_identifier) - UUID v5 specification

### Secondary (MEDIUM confidence)
- [PostgreSQL JSONB vs. EAV Performance Analysis](https://www.razsamuel.com/postgresql-jsonb-vs-eav-dynamic-data/) - Architecture comparison (PostgreSQL but principles apply to SQLite)
- [Replacing EAV with JSONB](https://coussej.github.io/2016/01/14/Replacing-EAV-with-JSONB-in-PostgreSQL/) - Performance benchmarks showing 5-10x improvement
- [Generate deterministic UUID v4 in JavaScript](https://c100k.eu/articles/20240827-generate-deterministic-uuid-v4-javascript) - UUID v5 patterns
- [Use The Index, Luke: Bind Parameters](https://use-the-index-luke.com/sql/where-clause/bind-parameters) - SQL injection prevention via parameterization

### Tertiary (LOW confidence)
- [EAV Anti-Pattern Discussion](https://cedanet.com.au/antipatterns/eav.php) - General EAV critique (not SQLite-specific)
- [cuid2 collision resistance](https://github.com/paralleldrive/cuid2) - Alternative to UUID v5 (not using but aware of option)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - sql.js, gray-matter, and uuid are all in current use or standard solutions
- Architecture: HIGH - JSON columns vs EAV is well-researched, parameterized queries are universal best practice
- Pitfalls: HIGH - Based on actual bugs found in codebase (operations.ts:33, uuidv4 in alto-importer.ts)

**Research date:** 2026-02-12
**Valid until:** 90 days (stable technologies, slow-moving standards)
