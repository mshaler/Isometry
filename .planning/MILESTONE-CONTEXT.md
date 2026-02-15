# Milestone Context: v6.4 Hardcoded Values Cleanup

**Goal:** Eliminate or externalize hardcoded LATCH filter values (priority, status, folder options, etc.) to support true schema-on-read architecture.

## Problem Statement

Isometry's schema-on-read architecture means metadata should come from source data, not hardcoded values. However, hardcoded LATCH filter values have crept into the codebase:

1. **Facets seed SQL** seeds `status` and `priority` facets even when source data doesn't have them
2. **UI components** hardcode folder/status options instead of discovering them from data
3. **Test fixtures** assume specific status values like `active`, `in_progress`, `blocked`
4. **Property classifier** assumes numeric defaults like `priority: 0`

These hardcoded values violate schema-on-read principles where the data itself defines available metadata.

## Research Findings

### Hardcoded Values Found

| Location | What's Hardcoded | Impact |
|----------|------------------|--------|
| `src/db/sample-data.ts` | FACETS_SEED_SQL seeds `status`, `priority` facets | Shows facets for non-existent data |
| `src/db/sample-data.ts` | SAMPLE_NOTES with hardcoded priority 0-5 | Test data implies priority always exists |
| `src/components/CardDetailModal.tsx` | Folder options: `['work', 'personal', 'projects', 'ideas', 'archive']` | UI assumes specific folders |
| `src/components/CardDetailModal.tsx` | Status options: `['active', 'completed', 'blocked', 'in_progress']` | UI assumes specific statuses |
| `src/components/CardDetailModal.tsx` | Status colors: hardcoded color map | Colors tied to hardcoded statuses |
| `src/components/LATCHFilter.tsx` | Priority range: `[1, 10]` | Assumes priority is always 1-10 |
| `src/services/property-classifier.ts` | Numeric defaults: `{ priority: 0, importance: 0, sort_order: 0 }` | Assumes these columns exist |
| `src/test/fixtures.ts` | TEST_FACETS with hardcoded status options | Test data assumes specific statuses |
| `src/test/fixtures.ts` | TEST_NODES with status/priority values | Test data assumes these fields |

### Current Property Classification Behavior

The `property-classifier.ts` correctly implements `columnHasData()` to hide facets when columns lack meaningful data. This is the right pattern to extend.

### Impact on User Experience

1. Users see "Priority" and "Status" facets even when their data doesn't have these fields
2. Card detail modal shows folder/status dropdowns with options that may not match their data
3. Filter UI assumes priority range 1-10 even if data uses different scales

## Solution Strategy

### Option 1: Settings Registry in SQLite (Recommended)

Create a `settings` table storing configuration as key-value pairs:

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL, -- JSON serialized
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  modified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
```

UI components query settings table for available options, with fallback to data discovery.

### Option 2: Pure Data Discovery

Remove all hardcoded values. UI components discover available values via queries:
- `SELECT DISTINCT folder FROM cards WHERE folder IS NOT NULL`
- `SELECT DISTINCT status FROM cards WHERE status IS NOT NULL`

### Option 3: Hybrid Approach (Recommended)

1. **Discovery-first**: Query actual data for available values
2. **Settings fallback**: Allow users to add custom options via settings
3. **No defaults**: Empty state when no data exists

## Acceptance Criteria

1. No hardcoded folder/status/priority values in UI components
2. Facet values discovered dynamically from data
3. Card detail modal options come from settings registry or data discovery
4. Test fixtures use minimal assumptions about schema
5. Property classifier handles missing columns gracefully
6. Settings registry provides user customization path

## Out of Scope

- Full settings UI (just the data layer and integration)
- Migration of existing hardcoded values to settings (manual cleanup)
- Real-time facet value updates (stale-while-revalidate is acceptable)

## Phase Structure

- **Phase 100**: Schema & Service Layer — Settings table, discovery queries, service layer
- **Phase 101**: UI Integration — CardDetailModal, LATCHFilter, property classifier updates
- **Phase 102**: Test Cleanup — Fixtures and sample data modernization

## Dependencies

- sql.js working (verified in Phase 99)
- TanStack Query for caching discovery results
- Existing property-classifier.ts pattern

## Reference Documents

- `src/services/property-classifier.ts` — Pattern for data discovery
- `src/db/sample-data.ts` — Hardcoded facets to remove
- `src/components/CardDetailModal.tsx` — UI hardcoding to fix

---
*Created: 2026-02-15*
