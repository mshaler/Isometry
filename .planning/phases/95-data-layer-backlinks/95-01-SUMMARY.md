---
phase: 95-data-layer-backlinks
plan: 01
subsystem: data-layer
tags: [sql.js, templates, fts5, crud]
dependency_graph:
  requires: []
  provides:
    - templates-table
    - templates-crud-api
    - templates-fts-search
  affects:
    - capture-editor
    - slash-commands
tech_stack:
  added: []
  patterns: [sql.js-crud, fts5-search, idempotent-seeding]
key_files:
  created:
    - src/db/migrations/add-templates-table.sql
    - src/utils/editor/templates.ts
  modified:
    - src/db/schema.sql
    - src/db/SQLiteProvider.tsx
decisions:
  - id: TEMPLATES-01
    title: Template storage in sql.js with FTS5
    choice: Templates table with FTS5 virtual table and sync triggers
    rationale: Consistency with other card data, enables full-text search
metrics:
  duration: ~5m
  completed: 2026-02-14
---

# Phase 95 Plan 01: Templates Data Layer Summary

Templates stored in sql.js database with FTS5 search, CRUD operations, and built-in template seeding on app startup.

## Implementation Summary

### Task 1: Templates table schema (pre-existing)

Schema was already added in a prior commit (625f14ae as part of 95-03 work). Verified:
- `templates` table with id, name, description, category, content, variables columns
- Indexes on category, usage_count (DESC), name
- FTS5 virtual table `templates_fts` for full-text search
- Sync triggers for FTS5 (insert, delete, update)
- Migration file at `src/db/migrations/add-templates-table.sql`

### Task 2: Template CRUD operations

Created `src/utils/editor/templates.ts` following the backlinks.ts pattern:

**Interfaces:**
- `TemplateVariable` - Variable placeholder definition (name, type, default, description)
- `Template` - Full template object with metadata

**Functions:**
- `queryTemplates(db, category?)` - List templates, optionally filtered by category
- `searchTemplates(db, query, limit?)` - FTS5 full-text search with fallback
- `getTemplate(db, templateId)` - Get single template by ID
- `createTemplate(db, template)` - Create new template, returns ID
- `updateTemplate(db, templateId, updates)` - Partial update
- `deleteTemplate(db, templateId)` - Delete by ID
- `incrementTemplateUsage(db, templateId)` - Track usage for sorting

**Commit:** bfd9e2e5

### Task 3: Built-in template seeding

Wired `seedBuiltInTemplates` to `SQLiteProvider.tsx`:
- Imported function after sample-data import
- Called after facets seeding, before setDb()
- Uses INSERT OR IGNORE for idempotent operation

**Built-in templates seeded:**
1. Meeting Notes (meeting category) - Attendees, agenda, action items
2. Daily Note (daily category) - Gratitude, goals, reflection
3. Project (project category) - Overview, milestones, resources
4. Task (note category) - Due date, priority, subtasks

**Commit:** 3b7d6ca6

## Verification Results

| Check | Status |
|-------|--------|
| `npm run typecheck` | PASS (0 errors) |
| Schema includes templates table | PASS |
| FTS5 virtual table exists | PASS |
| templates.ts exports 8 functions | PASS |
| seedBuiltInTemplates called in SQLiteProvider | PASS |

## Deviations from Plan

### [Rule 3 - Blocking] Task 1 already completed

**Found during:** Task 1 execution
**Issue:** Templates table schema was already added in commit 625f14ae (labeled as 95-03)
**Resolution:** Verified schema exists, proceeded with Tasks 2-3

### [Rule 1 - Bug] Line length violations

**Found during:** Task 2 verification
**Issue:** Three lines exceeded 120 char limit in templates.ts
**Fix:** Created `rowToTemplate` helper function and `TemplateRow` type alias
**Files modified:** src/utils/editor/templates.ts

## Self-Check: PASSED

```
FOUND: src/db/schema.sql (templates table verified)
FOUND: src/db/migrations/add-templates-table.sql
FOUND: src/utils/editor/templates.ts
FOUND: bfd9e2e5 (Task 2 commit)
FOUND: 3b7d6ca6 (Task 3 commit)
```

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 625f14ae | Templates table schema (prior work) |
| 2 | bfd9e2e5 | Template CRUD operations |
| 3 | 3b7d6ca6 | Wire template seeding to initialization |

## Next Steps

This plan enables:
- Phase 96-03: `/template` slash command implementation
- Template picker modal for template selection
- Template variable substitution in UI layer
