---
phase: 90-sql-integration
plan: 01
subsystem: superstack
tags: [sql, query-generation, header-discovery, testing]
dependency_graph:
  requires: [FacetConfig, superstack-types]
  provides: [buildHeaderDiscoveryQuery, buildStackedHeaderQuery, buildFacetSelect]
  affects: [header-rendering, tree-building]
tech_stack:
  added: [sql.js-performance-testing]
  patterns: [query-dispatch, strftime-extraction, json_each-explosion]
key_files:
  created:
    - src/db/queries/header-discovery.ts
    - src/db/queries/__tests__/header-discovery.test.ts
  modified: []
decisions:
  - id: SQL-01
    decision: Dispatch query generation on facet.dataType
    rationale: Different facet types require different SQL patterns (strftime for dates, json_each for arrays)
    alternatives: Single unified query, runtime type switching
    impact: Clear separation of concerns, easy to extend with new facet types
  - id: SQL-02
    decision: Quarter calculation via formula not strftime('%Q')
    rationale: SQLite strftime doesn't support %Q, must calculate from month
    alternatives: Pre-compute quarters, use CASE statement
    impact: Formula `'Q' || ((month - 1) / 3 + 1)` works on all SQLite versions
  - id: SQL-03
    decision: Month name ordering by numeric month not alphabetic
    rationale: Alphabetic would give April, August, December... not Jan, Feb, Mar
    alternatives: Custom sort order, pre-sorted lookup
    impact: `ORDER BY strftime('%m', column)` gives correct calendar order
metrics:
  duration_minutes: 3
  completed_date: 2026-02-14
  tests_added: 30
  test_duration_ms: 453
  performance_target_met: true
---

# Phase 90 Plan 01: Header Discovery Query Generator

**SQL query generation for SuperStack header discovery with facet type dispatch.**

## One-liner

Dynamic SQL query generator that dispatches on FacetConfig.dataType to build GROUP BY queries for time (strftime), multi-select (json_each), and simple facets.

## What Was Built

### Core Module: header-discovery.ts

Created SQL query generator module with three public functions:

1. **buildHeaderDiscoveryQuery(facet: FacetConfig): string**
   - Dispatches on facet.dataType to generate appropriate SQL
   - Date facets → strftime extraction (year, quarter, month, week)
   - Multi-select facets → json_each array explosion
   - Simple facets → COALESCE with 'Unassigned' default
   - All queries include `deleted_at IS NULL` filter

2. **buildFacetSelect(facet: FacetConfig, alias?: string): string**
   - Generates SQL SELECT fragment for a single facet
   - Used by buildStackedHeaderQuery for composition
   - Handles quarter formula and multi_select special cases

3. **buildStackedHeaderQuery(facets: FacetConfig[]): string**
   - Builds multi-facet hierarchy queries
   - Handles up to 3 facet levels (year > quarter > month)
   - Composes SELECT, FROM, WHERE, GROUP BY clauses
   - Special FROM clause handling for multi_select facets

### Query Patterns Implemented

**Date facets (strftime extraction):**
```sql
-- Year
SELECT strftime('%Y', created_at) as value, COUNT(*) as card_count
FROM nodes
WHERE deleted_at IS NULL AND created_at IS NOT NULL
GROUP BY value
ORDER BY value DESC

-- Quarter (calculated formula)
SELECT 'Q' || ((CAST(strftime('%m', created_at) AS INTEGER) - 1) / 3 + 1) as value,
       COUNT(*) as card_count
FROM nodes
WHERE deleted_at IS NULL AND created_at IS NOT NULL
GROUP BY value
ORDER BY value DESC

-- Month (numeric ordering)
SELECT strftime('%B', created_at) as value, COUNT(*) as card_count
FROM nodes
WHERE deleted_at IS NULL AND created_at IS NOT NULL
GROUP BY value
ORDER BY strftime('%m', created_at)
```

**Multi-select facets (json_each):**
```sql
SELECT json_each.value, COUNT(*) as card_count
FROM nodes, json_each(nodes.tags)
WHERE nodes.deleted_at IS NULL
  AND nodes.tags IS NOT NULL
  AND nodes.tags != '[]'
GROUP BY json_each.value
ORDER BY card_count DESC
```

**Simple facets (COALESCE):**
```sql
SELECT COALESCE(folder, 'Unassigned') as value, COUNT(*) as card_count
FROM nodes
WHERE deleted_at IS NULL
GROUP BY value
ORDER BY card_count DESC
```

**Stacked hierarchy (folder > status):**
```sql
SELECT
  COALESCE(folder, 'Unassigned') as facet_0,
  COALESCE(status, 'Unassigned') as facet_1,
  COUNT(*) as card_count
FROM nodes
WHERE nodes.deleted_at IS NULL
  AND nodes.folder IS NOT NULL
  AND nodes.status IS NOT NULL
GROUP BY COALESCE(folder, 'Unassigned'), COALESCE(status, 'Unassigned')
ORDER BY card_count DESC
```

### Comprehensive Test Suite

Created 30 tests in header-discovery.test.ts:

**Unit tests (20):**
- Date facets: year, quarter, month, week extraction
- Multi-select facets: json_each explosion
- Simple facets: text, select, number with COALESCE
- Error handling: unsupported dataType, missing timeFormat
- buildFacetSelect fragment generation
- buildStackedHeaderQuery multi-level hierarchies
- deleted_at filter verification

**SQL snapshot tests (3):**
- Year facet SQL
- Tags facet SQL
- Folder facet SQL

**Performance benchmarks (5 - MANDATORY):**
- Setup: 10,000 nodes with varied data across 3 years
- Simple facet query (folder): <100ms ✓
- Date facet query (year extraction): <100ms ✓
- Multi_select facet query (tags): <100ms ✓
- Stacked query (folder > status): <100ms ✓
- Three-level time hierarchy: <100ms ✓

**All 30 tests pass in 453ms total.**

## Deviations from Plan

None - plan executed exactly as written.

## Key Technical Details

### Quarter Calculation Formula

SQLite's strftime doesn't support '%Q' for quarter, so we calculate it:
```typescript
const quarterFormula = `'Q' || ((CAST(strftime('%m', ${column}) AS INTEGER) - 1) / 3 + 1)`;
```

This formula:
- Extracts month as integer (1-12)
- Subtracts 1 to get 0-11 range
- Divides by 3 to get 0-3 range
- Adds 1 to get 1-4 range
- Prepends 'Q' to get 'Q1', 'Q2', 'Q3', 'Q4'

### Month Name Ordering

Month names are extracted via `strftime('%B', column)` which gives "January", "February", etc.
Alphabetic ordering would give incorrect results (April, August, December...).

Solution: `ORDER BY strftime('%m', column)` - numeric month for correct calendar order.

### Multi-select FROM Clause Handling

Multi-select facets require special FROM clause:
```sql
FROM nodes, json_each(nodes.tags)
```

This is a cross join that explodes the JSON array into individual rows.
The WHERE clause filters out NULL and empty arrays.

### Error Handling

**TypeError exceptions:**
- Unsupported dataType → clear error message
- Missing timeFormat for date facet → required field validation

**Defensive programming:**
- Empty sourceColumn → returns empty result (not error)
- NULL values → COALESCE to 'Unassigned'
- Deleted nodes → always filtered via `deleted_at IS NULL`

## Testing Highlights

### Performance Validation

**Setup:** 10,000 nodes generated with:
- 5 folders (Work, Personal, Projects, Archive, Ideas)
- 4 statuses (active, completed, archived, pending)
- 5 priorities (1-5)
- 5 tag sets (meeting+urgent, research+reading, dev+backend, design+ui, empty)
- Dates across 3 years (2023-2025) randomly distributed

**Results:** All queries complete in <100ms, meeting the SQL performance target.

### Snapshot Testing

SQL snapshots prevent unintended query changes:
- Year facet: 5 lines, standard strftime
- Tags facet: 8 lines, json_each explosion
- Folder facet: 6 lines, simple COALESCE

Any change to generated SQL will trigger snapshot diff for review.

## Integration Points

**Imports FacetConfig from:**
```typescript
import type { FacetConfig } from '../../superstack/types/superstack';
```

**Provides to downstream modules:**
- buildHeaderDiscoveryQuery → tree-builder (discover header values)
- buildStackedHeaderQuery → tree-builder (multi-facet hierarchies)
- buildFacetSelect → custom query composition

**Used by (future plans):**
- 90-02: Tree builder will call these functions to discover header values
- 91-XX: Interaction handlers will use for drill-down queries

## Files Modified

### Created
- `src/db/queries/header-discovery.ts` (220 lines)
- `src/db/queries/__tests__/header-discovery.test.ts` (582 lines)

### Pattern Alignment

Follows existing pattern from `src/db/queries/facet-aggregates.ts`:
- Export typed functions, not classes
- Use sql.js Database type
- Return SQL strings for db.exec()
- Include comprehensive JSDoc comments

## Next Steps (Phase 90 Plan 02)

**Tree Builder Module:**
1. Call buildHeaderDiscoveryQuery to get facet values
2. Execute SQL via db.exec()
3. Build HeaderTree from query results
4. Calculate spans bottom-up
5. Compute aggregates (count, sum, avg)

**Key integration:**
```typescript
const sql = buildHeaderDiscoveryQuery(facet);
const result = db.exec(sql);
const headerTree = buildTreeFromQueryResults(result, facet);
```

## Self-Check: PASSED

**Files created:**
```bash
✓ FOUND: src/db/queries/header-discovery.ts
✓ FOUND: src/db/queries/__tests__/header-discovery.test.ts
```

**Commits exist:**
```bash
✓ FOUND: ef4528e3 (Task 1: query generator)
✓ FOUND: f6873922 (Task 2: test suite)
```

**Exports verified:**
```typescript
✓ buildHeaderDiscoveryQuery exported
✓ buildStackedHeaderQuery exported
✓ buildFacetSelect exported
```

**Tests verified:**
```bash
✓ 30/30 tests pass
✓ All performance benchmarks <100ms
✓ TypeScript compilation clean
```

**Quality checks:**
```bash
✓ npm run typecheck: 0 errors
✓ npm run test: 30 passed
✓ Pre-commit hooks: all passed
```
