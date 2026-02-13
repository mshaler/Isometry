# Phase 65: Facet Discovery - Research

**Researched:** 2026-02-12
**Domain:** Dynamic property discovery, schema-on-read classification, Navigator UI integration
**Confidence:** HIGH

## Summary

Phase 65 surfaces dynamic properties from the `node_properties` EAV table (added in Phase 63) as available Navigator facets alongside schema-defined facets from the `facets` table. Phase 64 just completed the ETL pipeline upgrade that stores unknown YAML frontmatter keys in `node_properties` with JSON-serialized values and type metadata. Now Phase 65 makes those properties discoverable and usable for PAFV axis mapping in SuperGrid.

The implementation extends the existing property classification system (Phase 50) to query both `facets` table (schema-defined) and `node_properties` table (dynamic). The classifier adds discovered properties to their appropriate LATCH buckets based on value type inference. Navigator UI (Phase 51) already renders classified properties as draggable facets; Phase 65 adds visual distinction (icon, styling, badge) to differentiate dynamic properties from schema-defined ones.

The architecture is clean: `property-classifier.ts` gains a `discoverDynamicProperties()` function that queries `SELECT DISTINCT key, value_type FROM node_properties`, infers LATCH bucket from value_type, and returns `ClassifiedProperty[]` compatible with the existing classification interface. The Navigator's `PafvNavigator.tsx` already consumes classification buckets; it just needs visual indicators for dynamic properties (e.g., sparkle icon, different chip color).

**Primary recommendation:** Extend `classifyProperties()` to merge facets table (schema) with node_properties (dynamic), use value_type for LATCH bucket inference, and add `isDynamic: boolean` to `ClassifiedProperty` interface for Navigator styling.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sql.js | WASM (in use) | SQLite in browser, direct D3.js access | Project standard, bridge-elimination architecture |
| TypeScript | 5.x (strict) | Type safety | Project standard, no `any` allowed |
| React | 18.2+ | UI framework | Project standard, hooks API |
| D3.js | v7 | Visualization rendering | Project standard, SuperGrid renderer |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-dnd | 16.0.1 | Drag-and-drop | Already in use by PafvNavigator for facet dragging |
| lucide-react | 0.294.0 | Icons | Sparkle icon for dynamic facets |
| tailwindcss | 3.3.5 | Styling | Theme-aware chip styling (NeXTSTEP/Modern) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Value type inference | Explicit LATCH column in node_properties | Value type inference is flexible (works for any source), explicit column is rigid but faster |
| Merging facets + properties in classifier | Separate useNodeProperties hook | Merging keeps single classification interface, separation allows independent refresh |
| Visual badge/icon for dynamic facets | Separate "Dynamic Properties" accordion section | Badge integrates with existing buckets, section segregates (may be clearer for users) |

**Installation:**
```bash
# All dependencies already present
npm install  # No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── services/
│   └── property-classifier.ts        # Extend with discoverDynamicProperties()
├── db/
│   └── schema.sql                    # node_properties table (Phase 63)
├── etl/
│   └── storage/
│       └── property-storage.ts       # storeNodeProperties() (Phase 64)
├── components/
│   └── navigator/
│       └── PafvNavigator.tsx         # Add isDynamic styling
└── types/
    └── pafv.ts                       # ClassifiedProperty interface
```

### Pattern 1: Dynamic Property Discovery via Value Type Inference
**What:** Query `node_properties` for distinct keys, infer LATCH bucket from `value_type` column.
**When to use:** Surfacing schema-on-read properties without hardcoding mappings.
**Example:**
```typescript
// Source: Phase 65 implementation pattern
interface DynamicProperty {
  key: string;
  valueType: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
  sampleValue: string; // JSON-encoded
  nodeCount: number;   // How many nodes have this property
}

function discoverDynamicProperties(db: Database): DynamicProperty[] {
  const result = db.exec(`
    SELECT
      key,
      value_type,
      COUNT(DISTINCT node_id) as node_count,
      MIN(value) as sample_value
    FROM node_properties
    GROUP BY key, value_type
    ORDER BY node_count DESC, key ASC
  `);

  if (result.length === 0 || !result[0].values) return [];

  return result[0].values.map(row => ({
    key: row[0] as string,
    valueType: row[1] as DynamicProperty['valueType'],
    nodeCount: row[2] as number,
    sampleValue: row[3] as string,
  }));
}
```

### Pattern 2: Value Type to LATCH Bucket Mapping
**What:** Map value_type to appropriate LATCH dimension for spatial projection.
**When to use:** Converting EAV value types to PAFV axes without explicit schema.
**Example:**
```typescript
// Source: Phase 65 inference logic
function inferLATCHBucket(valueType: string, key: string): LATCHBucket {
  // Time: ISO dates, timestamps, Unix epochs
  if (valueType === 'string' && /date|time|timestamp|created|modified|due/i.test(key)) {
    return 'T';
  }

  // Category: strings, arrays (tags), booleans (flags)
  if (valueType === 'string' || valueType === 'array' || valueType === 'boolean') {
    return 'C';
  }

  // Hierarchy: numbers (scores, priorities, counts)
  if (valueType === 'number') {
    return 'H';
  }

  // Location: explicit location keys
  if (/location|address|place|city|country/i.test(key)) {
    return 'L';
  }

  // Alphabet: text content (default for strings)
  return 'A';
}
```

### Pattern 3: Merging Schema and Dynamic Properties in Classification
**What:** Extend `classifyProperties()` to include both facets table and node_properties.
**When to use:** Single unified classification for Navigator UI consumption.
**Example:**
```typescript
// Source: property-classifier.ts extension
export function classifyProperties(db: Database): PropertyClassification {
  const classification: PropertyClassification = {
    L: [], A: [], T: [], C: [], H: [], GRAPH: []
  };

  // 1. Load schema-defined facets (existing logic)
  const facetResult = db.exec(`
    SELECT id, name, facet_type, axis, source_column, enabled, sort_order
    FROM facets
    WHERE enabled = 1
    ORDER BY axis, sort_order
  `);
  // ... process facet rows into classification buckets ...

  // 2. Discover dynamic properties
  const dynamicProps = discoverDynamicProperties(db);

  // 3. Convert to ClassifiedProperty and merge
  for (const prop of dynamicProps) {
    const bucket = inferLATCHBucket(prop.valueType, prop.key);
    const classifiedProp: ClassifiedProperty = {
      id: `dynamic-${prop.key}`,
      name: humanizeKey(prop.key), // "contact_email" → "Contact Email"
      bucket,
      sourceColumn: `node_properties.${prop.key}`, // Special source marker
      facetType: prop.valueType,
      enabled: true,
      sortOrder: 1000 + classification[bucket].length, // After schema facets
      isEdgeProperty: false,
      isDynamic: true, // NEW FLAG
      nodeCount: prop.nodeCount, // NEW FIELD for badge display
    };
    classification[bucket].push(classifiedProp);
  }

  // 4. Add GRAPH bucket (existing logic)
  // ...

  return classification;
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}
```

### Pattern 4: Navigator UI Distinction for Dynamic Facets
**What:** Render dynamic facets with visual indicator (icon, color, badge) to differentiate from schema facets.
**When to use:** User needs to understand which facets are schema-defined vs discovered.
**Example:**
```typescript
// Source: PafvNavigator.tsx extension
import { Sparkles } from 'lucide-react';

function DraggablePropertyChip({ property, sourceWell }: DraggablePropertyChipProps) {
  const isDynamic = property.isDynamic ?? false;
  const nodeCount = property.nodeCount ?? 0;

  return (
    <div className={`facet-chip ${isDynamic ? 'dynamic-facet' : 'schema-facet'}`}>
      {isDynamic && <Sparkles className="w-3 h-3 text-yellow-500" />}
      <span className="truncate">{property.name}</span>
      {isDynamic && nodeCount > 0 && (
        <span className="text-[9px] opacity-60">({nodeCount})</span>
      )}
    </div>
  );
}
```

### Pattern 5: Dynamic Property Querying in Grid Projection
**What:** When dynamic property is mapped to axis, query `node_properties` via JOIN instead of direct column.
**When to use:** User drags dynamic facet to X/Y/Z plane, SuperGrid needs to project cards.
**Example:**
```typescript
// Source: usePAFVProjection.ts extension
function buildProjectionSQL(xAxis: AxisMapping, yAxis: AxisMapping): string {
  // Detect if axis uses dynamic property
  const xIsDynamic = xAxis.facet.startsWith('node_properties.');
  const yIsDynamic = yAxis.facet.startsWith('node_properties.');

  // Build column expression
  const xColumn = xIsDynamic
    ? `(SELECT value FROM node_properties WHERE node_id = nodes.id AND key = ? LIMIT 1)`
    : xAxis.facet;

  const yColumn = yIsDynamic
    ? `(SELECT value FROM node_properties WHERE node_id = nodes.id AND key = ? LIMIT 1)`
    : yAxis.facet;

  const params = [];
  if (xIsDynamic) params.push(xAxis.facet.replace('node_properties.', ''));
  if (yIsDynamic) params.push(yAxis.facet.replace('node_properties.', ''));

  return {
    sql: `
      SELECT
        ${xColumn} as x_value,
        ${yColumn} as y_value,
        COUNT(*) as node_count,
        GROUP_CONCAT(id) as node_ids
      FROM nodes
      WHERE deleted_at IS NULL
      GROUP BY x_value, y_value
    `,
    params
  };
}
```

### Anti-Patterns to Avoid
- **Hardcoding dynamic property → LATCH mapping:** Use value_type inference, not a static map. Properties named "score" vs "priority" should both map to Hierarchy.
- **Querying node_properties in N+1 loop:** Use JOIN or correlated subquery in single SQL statement, not per-node query.
- **Treating dynamic properties as second-class:** They should work identically to schema facets once classified (drag, drop, projection).
- **Missing isDynamic flag:** Navigator needs this to render visual distinction; without it, users can't tell schema from discovered properties.
- **Ignoring nodeCount:** Dynamic properties with nodeCount=1 are likely noise; consider threshold (e.g., show only if >5 nodes).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Key humanization | Custom string formatter | `lodash.startCase` or built-in replace | Edge cases: acronyms (HTML → Html), special chars, Unicode |
| Value type detection | JSON.parse try/catch loop | Store value_type in table (Phase 64 done) | Type info already captured at ETL time, no need to re-infer |
| Dynamic property caching | Custom cache layer | Use existing dataVersion pattern | PropertyClassification already uses dataVersion for cache invalidation |
| SQL injection in dynamic queries | String interpolation | sql.js stmt.bind(params) | Phase 63 fixed query safety; maintain it here |

**Key insight:** Phase 64 already solved the hard problem (storing arbitrary properties with type metadata). Phase 65 is just surfacing what's already there.

## Common Pitfalls

### Pitfall 1: Value Type Ambiguity
**What goes wrong:** Property with value_type='string' contains ISO date ("2024-01-15") but inferred as Alphabet, not Time.
**Why it happens:** ETL stores type based on YAML type, not semantic meaning. YAML parser sees string, not date.
**How to avoid:** Heuristic detection in `inferLATCHBucket()` — check key name and value pattern for date-like strings.
**Warning signs:** Date properties appear in Alphabet bucket; user drags "created_date" to X-axis and SuperGrid sorts alphabetically, not chronologically.

```typescript
// Pattern: Date string detection
function looksLikeDate(value: string): boolean {
  // ISO 8601, RFC 3339, common formats
  return /^\d{4}-\d{2}-\d{2}/.test(value) ||
         /^\d{2}\/\d{2}\/\d{4}/.test(value) ||
         !isNaN(Date.parse(value));
}

if (valueType === 'string' && looksLikeDate(sampleValue)) {
  return 'T'; // Time bucket
}
```

### Pitfall 2: Collision with Schema Facets
**What goes wrong:** Dynamic property named "priority" collides with schema-defined "priority" facet.
**Why it happens:** Both exist in the system; classifier adds both to same bucket with same name.
**How to avoid:** Prefix dynamic property IDs (`dynamic-priority`) and optionally append badge to name ("Priority (dynamic)").
**Warning signs:** Navigator shows duplicate "Priority" facets; dragging one doesn't work as expected.

```typescript
// Pattern: Collision detection and naming
const schemaFacetIds = new Set(
  classification.H.map(p => p.sourceColumn)
);

if (schemaFacetIds.has(prop.key)) {
  classifiedProp.name = `${humanizeKey(prop.key)} (custom)`;
}
```

### Pitfall 3: Performance with Large node_properties Table
**What goes wrong:** `SELECT DISTINCT key FROM node_properties` scans entire table; slow with 100K+ properties.
**Why it happens:** No index on (key) column; full table scan required.
**How to avoid:** Verify index exists (Phase 63 created `idx_node_properties_key`); if slow, add LIMIT or cache results.
**Warning signs:** Navigator takes >500ms to load; property classification query shows in slow query log.

```typescript
// Pattern: Threshold filtering
const result = db.exec(`
  SELECT key, value_type, COUNT(DISTINCT node_id) as node_count
  FROM node_properties
  GROUP BY key, value_type
  HAVING node_count >= 5  -- Only show properties used by 5+ nodes
  ORDER BY node_count DESC
  LIMIT 50  -- Cap at 50 dynamic facets
`);
```

### Pitfall 4: JSON-Encoded Values Not Decoded
**What goes wrong:** Dynamic property contains array `["tag1", "tag2"]` but value is raw JSON string, not parsed.
**Why it happens:** `node_properties.value` stores JSON-serialized; classification doesn't decode.
**How to avoid:** For projection queries, decode value in SQL with `json_extract()` or in transform layer.
**Warning signs:** X-axis shows `["work"]` as literal string instead of "work" value.

```typescript
// Pattern: JSON value extraction in projection
const xColumn = xIsDynamic
  ? `json_extract((SELECT value FROM node_properties WHERE node_id = nodes.id AND key = ?), '$')`
  : xAxis.facet;
```

### Pitfall 5: Dynamic Properties Not Refreshing After ETL
**What goes wrong:** User imports new markdown files with novel frontmatter keys; Navigator doesn't show them.
**Why it happens:** `usePropertyClassification()` cache not invalidated after ETL completes.
**How to avoid:** Increment dataVersion in SQLiteContext after ETL operations; hook will auto-refresh.
**Warning signs:** New properties exist in `node_properties` table but don't appear in Navigator until page reload.

```typescript
// Pattern: ETL completion triggers refresh
async function importFiles(files: File[]) {
  for (const file of files) {
    await altoImporter.import(file);
  }
  // Increment dataVersion to invalidate classification cache
  incrementDataVersion();
}
```

## Code Examples

Verified patterns from existing implementation:

### Querying node_properties for Distinct Keys
```typescript
// Source: Phase 65 implementation (sql.js direct access)
const result = db.exec(`
  SELECT
    key,
    value_type,
    COUNT(DISTINCT node_id) as node_count,
    MIN(value) as sample_value
  FROM node_properties
  GROUP BY key, value_type
  HAVING node_count >= 3
  ORDER BY node_count DESC
`);
```

### Extending ClassifiedProperty Interface
```typescript
// Source: src/services/property-classifier.ts extension
export interface ClassifiedProperty {
  id: string;
  name: string;
  bucket: PropertyBucket;
  sourceColumn: string;
  facetType: string;
  enabled: boolean;
  sortOrder: number;
  isEdgeProperty: boolean;
  isDynamic?: boolean;      // NEW: Marks dynamic properties
  nodeCount?: number;        // NEW: For badge display
}
```

### Inferring LATCH Bucket from Value Type
```typescript
// Source: Phase 65 inference logic
function inferLATCHBucket(
  valueType: string,
  key: string,
  sampleValue?: string
): LATCHBucket {
  // Time: date patterns
  if (valueType === 'string') {
    const lowerKey = key.toLowerCase();
    if (/date|time|created|modified|due|start|end/.test(lowerKey)) {
      return 'T';
    }
    if (sampleValue && /^\d{4}-\d{2}-\d{2}/.test(sampleValue)) {
      return 'T';
    }
  }

  // Hierarchy: numbers
  if (valueType === 'number') {
    return 'H';
  }

  // Category: arrays, booleans, enums
  if (valueType === 'array' || valueType === 'boolean') {
    return 'C';
  }

  // Location: explicit keywords
  if (/location|address|city|country|lat|lon|place/.test(key.toLowerCase())) {
    return 'L';
  }

  // Default: Alphabet
  return 'A';
}
```

### Rendering Dynamic Facet with Visual Indicator
```typescript
// Source: PafvNavigator.tsx extension
import { Sparkles } from 'lucide-react';

function DraggablePropertyChip({ property, sourceWell }: DraggablePropertyChipProps) {
  const { theme } = useTheme();
  const isNeXTSTEP = theme === 'NeXTSTEP';
  const isDynamic = property.isDynamic ?? false;

  return (
    <div
      className={`
        flex items-center gap-1.5 h-7 px-2 rounded text-[11px]
        ${isDynamic ? 'border-dashed' : ''}
        ${isNeXTSTEP
          ? 'bg-[#3A3A3A] hover:bg-[#454545]'
          : 'bg-white border border-gray-200 hover:bg-gray-50'
        }
      `}
    >
      {isDynamic && (
        <Sparkles className={`w-3 h-3 ${isNeXTSTEP ? 'text-yellow-400' : 'text-yellow-500'}`} />
      )}
      <span className="truncate">{property.name}</span>
      {isDynamic && property.nodeCount && (
        <span className={`text-[9px] ml-auto ${isNeXTSTEP ? 'text-[#999]' : 'text-gray-400'}`}>
          {property.nodeCount}
        </span>
      )}
    </div>
  );
}
```

### Querying Dynamic Property in Grid Projection
```typescript
// Source: usePAFVProjection.ts extension for dynamic facets
function buildAxisColumn(mapping: AxisMapping): { column: string; param?: string } {
  const isDynamic = mapping.facet.startsWith('node_properties.');

  if (isDynamic) {
    const key = mapping.facet.replace('node_properties.', '');
    return {
      column: `(
        SELECT json_extract(value, '$')
        FROM node_properties
        WHERE node_id = nodes.id AND key = ?
        LIMIT 1
      )`,
      param: key
    };
  }

  return { column: mapping.facet };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded facets in `facets` table | Schema + dynamic properties merged | Phase 65 (now) | True schema-on-read |
| Manual facet creation for new sources | Automatic discovery from YAML frontmatter | Phase 63-65 (v4.7) | Zero-touch onboarding |
| Single classification source | Dual source: facets table + node_properties | Phase 65 (now) | Unified classification interface |
| Static LATCH mapping | Value type + heuristic inference | Phase 65 (now) | Flexible property categorization |

**Deprecated/outdated:**
- Hardcoded facet lists in Navigator components (Phase 51 replaced with classification)
- Manual INSERT INTO facets for new properties (Phase 65 makes it automatic)
- Assumption that all facets come from `facets` table (Phase 65 adds dynamic source)

## Open Questions

1. **Should dynamic properties have a minimum node count threshold?**
   - What we know: Property used by 1 node is likely noise; property used by 100 nodes is signal
   - What's unclear: Optimal threshold (5 nodes? 10 nodes? Percentage of total?)
   - Recommendation: Start with 5-node minimum; make configurable via settings later

2. **How to handle dynamic property name collisions with schema facets?**
   - What we know: Both "priority" (schema) and "priority" (dynamic) can coexist in database
   - What's unclear: Show both? Hide dynamic if schema exists? Merge them?
   - Recommendation: Show both with suffix — "Priority" (schema) and "Priority (custom)" (dynamic)

3. **Should dynamic properties be editable/deletable from Navigator?**
   - What we know: Schema facets have enable/disable toggle in facets table
   - What's unclear: Can users hide noisy dynamic properties without deleting data?
   - Recommendation: Phase 65 shows all discovered properties; Phase 66+ adds user preferences for hiding

4. **How to handle multi-valued dynamic properties (arrays)?**
   - What we know: `node_properties.value` stores JSON array like `["tag1", "tag2"]`
   - What's unclear: In projection, should cards appear in multiple cells (exploded) or single cell (concatenated)?
   - Recommendation: Phase 65 treats arrays as single value (concatenate for display); multi-cell exploding in future phase

5. **Should value type inference be configurable by users?**
   - What we know: Automatic inference works for 80% of cases; edge cases exist (string dates, numeric IDs)
   - What's unclear: Should users be able to override inferred LATCH bucket?
   - Recommendation: Phase 65 uses automatic inference only; manual override via facets table in future (promote dynamic → schema)

## Sources

### Primary (HIGH confidence)
- Existing implementation: `/src/db/schema.sql` (lines 66-79) - `node_properties` table structure
- Existing implementation: `/src/etl/storage/property-storage.ts` - `storeNodeProperties()` and `getNodeProperties()`
- Existing implementation: `/src/services/property-classifier.ts` - `classifyProperties()` architecture
- Existing implementation: `/src/components/navigator/PafvNavigator.tsx` - Navigator UI rendering
- Phase 50 verification: `.planning/phases/50-foundation/50-VERIFICATION.md` - Property classification patterns
- Phase 51 research: `.planning/phases/51-navigator-integration/51-RESEARCH.md` - Navigator integration patterns
- Phase 63 plan: `.planning/phases/63-schema-and-query-safety/63-01-PLAN.md` - `node_properties` table creation
- Phase 64 verification: `.planning/phases/64-etl-pipeline-upgrade/64-VERIFICATION.md` - ETL pipeline implementation

### Secondary (MEDIUM confidence)
- SQLite documentation: JSON functions (`json_extract()`) for querying JSON-encoded values
- Existing test: `/src/services/__tests__/property-classifier.test.ts` - Classification test patterns

### Tertiary (LOW confidence)
- N/A - all critical information verified from existing codebase and phase documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - extends existing property classification system (Phase 50) and Navigator UI (Phase 51)
- Pitfalls: HIGH - identified from value_type semantics, SQL query patterns, and EAV table characteristics
- Code examples: HIGH - all patterns derived from existing working code

**Research date:** 2026-02-12
**Valid until:** 60 days (stable domain, internal extension of existing systems, no external dependencies)

**Implementation readiness:** All infrastructure exists. Phase 65 is integration of Phase 63 (schema) + Phase 64 (ETL) + Phase 50 (classification) + Phase 51 (Navigator UI).
