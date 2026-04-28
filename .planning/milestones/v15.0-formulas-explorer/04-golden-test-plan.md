# Golden-Test Corpus Plan

**Artifact:** `04-golden-test-plan.md`
**Work Area:** WA-4
**Milestone:** v15.0 — Formulas Explorer Architecture
**Status:** Authoritative
**Related:**
- `02-compilation-pipeline.md` — test targets (expected SQL and annotation algorithms)
- `01-three-explorer-spec.md` — category definitions (Formulas / Marks / Audits boundaries)
- `03-formula-card-schema.md` — formula_cards schema (promotion/versioning)
- `06-chip-well-geometry.md` — input contract (`ChipWellOutputContract`, §9)

---

## Overview

This document defines the complete golden-test corpus for the Formulas / Marks / Audits compilation pipeline. It specifies:

1. **Fixture Dataset** — ~50 hand-curated `cards` rows with test-readable IDs, spanning all `card_type` values and all edge-case scenarios needed by the corpus.
2. **Test Corpus** — 30+ named test cases covering Formulas, Marks, and Audits in isolation, in combination, and in edge cases.
3. **Test Runner Architecture** — How the corpus integrates with `realDb()`, Vitest `test.each()`, and the `tests/golden/` directory structure.
4. **Anti-Patching Policy** — Immutable rules for maintaining corpus integrity.

All content in this document is specification. No TypeScript code files are created by this phase.

---

## Section 1 — Fixture Dataset Definition (TEST-01)

### Design Principles

- **D-01:** Every row has a test-readable ID (descriptive kebab-case). The ID encodes both the scenario family and the row's role within it.
- **D-02:** The fixture is delivered as a standalone `.sql` block (CREATE TABLE + INSERTs). The SQL is the source of truth — runnable against `sqlite3 :memory:` without any application code.
- **D-03:** Cards only — no connections table. The compilation pipeline operates exclusively on the `cards` table.

The SQL block below will be extracted to `tests/golden/fixtures/golden-corpus.sql` at implementation time (per D-08, the fixture lives in `tests/golden/fixtures/`).

### Fixture SQL

```sql
-- =============================================================================
-- Golden Test Corpus — Fixture Dataset
-- Compatible with: sqlite3 :memory:  |  Schema from: tests/harness/seedCards.ts
-- Extracted to: tests/golden/fixtures/golden-corpus.sql at implementation time
--
-- Row ID naming convention: {scenario-family}-{role}
--   calc-*     : Calculation dependency chain and derived column scenarios
--   filter-*   : Filter predicate and composition scenarios
--   sort-*     : Sort ordering scenarios
--   mark-*     : Marks annotation scenarios
--   audit-*    : Audits annotation scenarios
--   cross-*    : Cross-category (multiple explorers active) scenarios
--   edge-*     : Edge cases (NULL columns, type mismatch, empty results)
--   bulk-*     : Large-cardinality rows for COUNT/SUM meaningfulness
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fixture cards table: same schema as production cards table.
-- The golden corpus adds folder_l1..l4 enrichment columns (TEXT, nullable)
-- because the compilation pipeline examples reference them and FolderHierarchyEnricher
-- populates them in production. The realDb() schema already includes these columns.
-- -----------------------------------------------------------------------------

-- calc-dep-a: first node in A->B->C dependency chain (name transforms)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('calc-dep-a', 'note', 'Alpha Note', 'First node in calc dependency chain', 'manual', 'Work/Projects/Alpha', 'calc,dep', 'open', 3, 1, '2026-01-10T09:00:00Z', '2026-01-10T09:00:00Z', NULL, NULL, 'Work', 'Projects', 'Alpha', NULL);

-- calc-dep-b: second node in A->B->C dependency chain
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('calc-dep-b', 'note', 'Beta Note', 'Second node in calc dependency chain', 'manual', 'Work/Projects/Beta', 'calc,dep', 'open', 2, 2, '2026-01-11T09:00:00Z', '2026-01-11T09:00:00Z', NULL, NULL, 'Work', 'Projects', 'Beta', NULL);

-- calc-dep-c: third node in A->B->C dependency chain
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('calc-dep-c', 'note', 'Gamma Note', 'Third node in calc dependency chain', 'manual', 'Work/Projects/Gamma', 'calc,dep', 'open', 1, 3, '2026-01-12T09:00:00Z', '2026-01-12T09:00:00Z', NULL, NULL, 'Work', 'Projects', 'Gamma', NULL);

-- calc-cycle-a: first participant in A<->B cycle (references B's alias)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('calc-cycle-a', 'task', 'Cycle Task A', 'Cycle participant: references B_col', 'apple-reminders', 'Work/Cycles', 'cycle', 'in_progress', 4, 4, '2026-01-13T09:00:00Z', '2026-01-13T09:00:00Z', '2026-02-01T00:00:00Z', NULL, 'Work', 'Cycles', NULL, NULL);

-- calc-cycle-b: second participant in A<->B cycle (references A's alias)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('calc-cycle-b', 'task', 'Cycle Task B', 'Cycle participant: references A_col', 'apple-reminders', 'Work/Cycles', 'cycle', 'in_progress', 4, 5, '2026-01-14T09:00:00Z', '2026-01-14T09:00:00Z', '2026-02-02T00:00:00Z', NULL, 'Work', 'Cycles', NULL, NULL);

-- filter-null-source: note with NULL source (NULL predicate column scenario)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('filter-null-source', 'note', 'Null Source Note', 'Source column is NULL for NULL predicate tests', NULL, 'Personal/Journal', 'null-test', 'open', 0, 6, '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z', NULL, NULL, 'Personal', 'Journal', NULL, NULL);

-- filter-null-folder: note with NULL folder (NULL hierarchical path)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('filter-null-folder', 'note', 'Null Folder Note', 'Folder columns are all NULL', 'manual', NULL, 'null-test', 'open', 0, 7, '2026-01-16T09:00:00Z', '2026-01-16T09:00:00Z', NULL, NULL, NULL, NULL, NULL, NULL);

-- filter-null-tags: note with NULL tags
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('filter-null-tags', 'note', 'Null Tags Note', 'Tags column is NULL', 'manual', 'Personal', 'open', NULL, 0, 8, '2026-01-17T09:00:00Z', '2026-01-17T09:00:00Z', NULL, NULL, 'Personal', NULL, NULL, NULL);

-- filter-null-priority: task with NULL priority (uses default 0)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('filter-null-priority', 'task', 'Default Priority Task', 'Priority set to 0 (default)', 'apple-reminders', 'Work', NULL, 'open', 0, 9, '2026-01-18T09:00:00Z', '2026-01-18T09:00:00Z', NULL, NULL, 'Work', NULL, NULL, NULL);

-- filter-apple-notes-a: note from apple-notes source (filter combo target)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('filter-apple-notes-a', 'note', 'Apple Note A', 'First apple-notes note for filter combo', 'apple-notes', 'Personal/Journal', 'imported', 'open', 1, 10, '2026-01-19T09:00:00Z', '2026-01-19T09:00:00Z', NULL, NULL, 'Personal', 'Journal', NULL, NULL);

-- filter-apple-notes-b: note from apple-notes source (filter combo target)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('filter-apple-notes-b', 'note', 'Apple Note B', 'Second apple-notes note for filter combo', 'apple-notes', 'Work/Projects/Alpha', 'imported', 'open', 2, 11, '2026-01-20T09:00:00Z', '2026-01-20T09:00:00Z', NULL, NULL, 'Work', 'Projects', 'Alpha', NULL);

-- filter-csv-note: note from csv-import source (excluded by apple-notes filter)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('filter-csv-note', 'note', 'CSV Import Note', 'CSV-imported note, excluded by source filter', 'csv-import', 'Data/Imports', 'csv', 'open', 0, 12, '2026-01-21T09:00:00Z', '2026-01-21T09:00:00Z', NULL, NULL, 'Data', 'Imports', NULL, NULL);

-- filter-no-match: task (excluded from note-only filter, no-match scenarios)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('filter-no-match', 'task', 'Task Outside Filter', 'Task excluded from note filters', 'apple-reminders', 'Work', NULL, 'open', 2, 13, '2026-01-22T09:00:00Z', '2026-01-22T09:00:00Z', '2026-03-01T00:00:00Z', NULL, 'Work', NULL, NULL, NULL);

-- sort-alpha-first: note at front of alphabetical sort (name starts with A)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('sort-alpha-first', 'note', 'Aardvark Notes', 'First alphabetically for sort tests', 'manual', 'Archive/A', NULL, 'open', 0, 14, '2026-01-05T08:00:00Z', '2026-01-05T08:00:00Z', NULL, NULL, 'Archive', 'A', NULL, NULL);

-- sort-alpha-middle: note in middle of alphabetical sort (name starts with M)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('sort-alpha-middle', 'note', 'Mongoose Notes', 'Middle alphabetically for sort tests', 'manual', 'Archive/M', NULL, 'open', 0, 15, '2026-02-01T08:00:00Z', '2026-02-01T08:00:00Z', NULL, NULL, 'Archive', 'M', NULL, NULL);

-- sort-alpha-last: note at end of alphabetical sort (name starts with Z)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('sort-alpha-last', 'note', 'Zebra Notes', 'Last alphabetically for sort tests', 'manual', 'Archive/Z', NULL, 'open', 0, 16, '2026-03-01T08:00:00Z', '2026-03-01T08:00:00Z', NULL, NULL, 'Archive', 'Z', NULL, NULL);

-- mark-priority-high: task with priority 5 (triggers urgent mark)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('mark-priority-high', 'task', 'Critical Task', 'High priority task for mark tests', 'apple-reminders', 'Work/Urgent', 'priority,urgent', 'in_progress', 5, 17, '2026-01-25T09:00:00Z', '2026-01-25T09:00:00Z', '2026-02-01T00:00:00Z', NULL, 'Work', 'Urgent', NULL, NULL);

-- mark-priority-above-threshold: task with priority 4 (also triggers urgent mark)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('mark-priority-above-threshold', 'task', 'High Priority Task', 'Priority 4 task, above urgent threshold', 'apple-reminders', 'Work/Projects', 'priority', 'in_progress', 4, 18, '2026-01-26T09:00:00Z', '2026-01-26T09:00:00Z', '2026-02-15T00:00:00Z', NULL, 'Work', 'Projects', NULL, NULL);

-- mark-priority-low: task with priority 1 (below urgent threshold)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('mark-priority-low', 'task', 'Low Priority Task', 'Priority 1 task, below urgent threshold', 'apple-reminders', 'Work', NULL, 'open', 1, 19, '2026-01-27T09:00:00Z', '2026-01-27T09:00:00Z', NULL, NULL, 'Work', NULL, NULL, NULL);

-- mark-apple-source: note from apple-notes (triggers apple-source mark)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('mark-apple-source', 'note', 'Apple Source Note', 'From apple-notes, triggers apple-source mark', 'apple-notes', 'Personal', NULL, 'open', 0, 20, '2026-02-01T09:00:00Z', '2026-02-01T09:00:00Z', NULL, NULL, 'Personal', NULL, NULL, NULL);

-- mark-null-priority: task with null-equivalent priority (0), below threshold
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('mark-null-priority', 'task', 'Zero Priority Task', 'Priority is 0, not above any positive threshold', 'manual', 'Work', NULL, 'open', 0, 21, '2026-02-02T09:00:00Z', '2026-02-02T09:00:00Z', NULL, NULL, 'Work', NULL, NULL, NULL);

-- mark-both: task with priority 5 AND apple-notes source (triggers both marks)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('mark-both', 'task', 'Both Marks Task', 'Priority 5 + apple-notes, gets both CSS classes', 'apple-notes', 'Work/Urgent', 'urgent,imported', 'in_progress', 5, 22, '2026-02-03T09:00:00Z', '2026-02-03T09:00:00Z', '2026-02-10T00:00:00Z', NULL, 'Work', 'Urgent', NULL, NULL);

-- audit-missing-due: task in_progress with null due_at (validation rule target)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('audit-missing-due', 'task', 'In-Progress No Due Date', 'In-progress task with no due date — validation anomaly', 'apple-reminders', 'Work/Projects', 'audit', 'in_progress', 3, 23, '2026-02-04T09:00:00Z', '2026-02-04T09:00:00Z', NULL, NULL, 'Work', 'Projects', NULL, NULL);

-- audit-overdue: task with due_at in the past and status not completed
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('audit-overdue', 'task', 'Overdue Task', 'Past due date, not completed — anomaly', 'apple-reminders', 'Work', 'overdue', 'in_progress', 4, 24, '2026-01-01T09:00:00Z', '2026-01-01T09:00:00Z', '2026-01-20T00:00:00Z', NULL, 'Work', NULL, NULL, NULL);

-- audit-valid-task: task with due date and proper status (no audit flag)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('audit-valid-task', 'task', 'Valid Task', 'Has due date and normal status — no audit flag', 'apple-reminders', 'Work/Projects', NULL, 'open', 2, 25, '2026-02-05T09:00:00Z', '2026-02-05T09:00:00Z', '2026-03-15T00:00:00Z', NULL, 'Work', 'Projects', NULL, NULL);

-- audit-high-priority-anomaly: note with priority > 4 (anomaly rule: "High priority")
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('audit-high-priority-anomaly', 'note', 'Unusually High Priority Note', 'Note with priority 5 — anomaly (notes rarely need urgency)', 'manual', 'Work', 'anomaly', 'open', 5, 26, '2026-02-06T09:00:00Z', '2026-02-06T09:00:00Z', NULL, NULL, 'Work', NULL, NULL, NULL);

-- audit-null-status: task with NULL status (NULL handling in audits)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('audit-null-status', 'task', 'Task No Status', 'Status is NULL — NULL predicate column in audit', 'manual', 'Work', NULL, NULL, 2, 27, '2026-02-07T09:00:00Z', '2026-02-07T09:00:00Z', NULL, NULL, 'Work', NULL, NULL, NULL);

-- cross-note-work: note in Work folder (multi-explorer scenarios)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('cross-note-work', 'note', 'Work Note', 'Note in Work folder for cross-category tests', 'apple-notes', 'Work/Projects/Alpha', NULL, 'open', 2, 28, '2026-02-08T09:00:00Z', '2026-02-08T09:00:00Z', NULL, NULL, 'Work', 'Projects', 'Alpha', NULL);

-- cross-note-personal: note in Personal folder
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('cross-note-personal', 'note', 'Personal Note', 'Note in Personal folder for cross-category tests', 'apple-notes', 'Personal/Journal', NULL, 'open', 1, 29, '2026-02-09T09:00:00Z', '2026-02-09T09:00:00Z', NULL, NULL, 'Personal', 'Journal', NULL, NULL);

-- cross-task-urgent: task with high priority (for cross-explorer active scenario)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('cross-task-urgent', 'task', 'Cross Urgent Task', 'High priority task for all-three-explorers test', 'apple-reminders', 'Work/Urgent', 'urgent', 'in_progress', 5, 30, '2026-02-10T09:00:00Z', '2026-02-10T09:00:00Z', '2026-02-20T00:00:00Z', NULL, 'Work', 'Urgent', NULL, NULL);

-- edge-empty-result: event type (if filtered to note, produces empty result)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('edge-empty-result', 'event', 'Calendar Event', 'Event type — excluded from note-only filter (empty result scenario)', 'apple-notes', 'Events/Calendar', NULL, NULL, 0, 31, '2026-02-11T09:00:00Z', '2026-02-11T09:00:00Z', '2026-03-01T00:00:00Z', NULL, 'Events', 'Calendar', NULL, NULL);

-- edge-type-mismatch: resource type (has text name, used for type-mismatch test)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('edge-type-mismatch', 'resource', 'Resource Document', 'Resource type for type-mismatch DSL scenario', 'csv-import', 'Data/Resources', NULL, NULL, 0, 32, '2026-02-12T09:00:00Z', '2026-02-12T09:00:00Z', NULL, NULL, 'Data', 'Resources', NULL, NULL);

-- edge-deep-folder: note with 4-level folder hierarchy (tests folder_l4)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('edge-deep-folder', 'note', 'Deep Folder Note', 'Folder hierarchy at max depth 4', 'manual', 'Work/Projects/Alpha/Archive', NULL, 'open', 0, 33, '2026-02-13T09:00:00Z', '2026-02-13T09:00:00Z', NULL, NULL, 'Work', 'Projects', 'Alpha', 'Archive');

-- edge-date-range-early: note with created_at in early January (date range filter)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('edge-date-range-early', 'note', 'Early January Note', 'Created in early January for date range filter test', 'manual', 'Archive', NULL, 'open', 0, 34, '2026-01-02T09:00:00Z', '2026-01-02T09:00:00Z', NULL, NULL, 'Archive', NULL, NULL, NULL);

-- edge-date-range-middle: note with created_at mid-January (within date range)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('edge-date-range-middle', 'note', 'Mid January Note', 'Created mid-January, within date range filter', 'manual', 'Archive', NULL, 'open', 0, 35, '2026-01-15T12:00:00Z', '2026-01-15T12:00:00Z', NULL, NULL, 'Archive', NULL, NULL, NULL);

-- edge-date-range-late: note with created_at in late January (outside early range)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('edge-date-range-late', 'note', 'Late January Note', 'Created late January, outside early date range', 'manual', 'Archive', NULL, 'open', 0, 36, '2026-01-28T09:00:00Z', '2026-01-28T09:00:00Z', NULL, NULL, 'Archive', NULL, NULL, NULL);

-- bulk-note-01: bulk note for COUNT/SUM meaningfulness (node_type = note)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('bulk-note-01', 'note', 'Bulk Note 01', 'Bulk note for aggregate tests', 'manual', 'Bulk', NULL, 'open', 0, 37, '2026-02-14T09:00:00Z', '2026-02-14T09:00:00Z', NULL, NULL, 'Bulk', NULL, NULL, NULL);

-- bulk-note-02: bulk note for COUNT/SUM meaningfulness
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('bulk-note-02', 'note', 'Bulk Note 02', 'Bulk note for aggregate tests', 'apple-notes', 'Work/Projects', NULL, 'open', 0, 38, '2026-02-15T09:00:00Z', '2026-02-15T09:00:00Z', NULL, NULL, 'Work', 'Projects', NULL, NULL);

-- bulk-note-03: bulk note for COUNT/SUM meaningfulness
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('bulk-note-03', 'note', 'Bulk Note 03', 'Bulk note for aggregate tests', 'apple-notes', 'Personal', NULL, 'open', 0, 39, '2026-02-16T09:00:00Z', '2026-02-16T09:00:00Z', NULL, NULL, 'Personal', NULL, NULL, NULL);

-- bulk-task-01: bulk task for COUNT by node_type (task group)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('bulk-task-01', 'task', 'Bulk Task 01', 'Bulk task for aggregate tests', 'apple-reminders', 'Work', NULL, 'open', 1, 40, '2026-02-17T09:00:00Z', '2026-02-17T09:00:00Z', NULL, NULL, 'Work', NULL, NULL, NULL);

-- bulk-task-02: bulk task for COUNT by node_type (task group)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('bulk-task-02', 'task', 'Bulk Task 02', 'Bulk task for aggregate tests', 'apple-reminders', 'Work/Projects', NULL, 'in_progress', 2, 41, '2026-02-18T09:00:00Z', '2026-02-18T09:00:00Z', '2026-03-30T00:00:00Z', NULL, 'Work', 'Projects', NULL, NULL);

-- bulk-event-01: event type for COUNT by node_type (event group)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('bulk-event-01', 'event', 'Bulk Event 01', 'Bulk event for aggregate tests', 'apple-notes', 'Events', NULL, NULL, 0, 42, '2026-02-19T09:00:00Z', '2026-02-19T09:00:00Z', '2026-03-05T00:00:00Z', NULL, 'Events', NULL, NULL, NULL);

-- bulk-resource-01: resource type for COUNT by node_type (resource group)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('bulk-resource-01', 'resource', 'Bulk Resource 01', 'Bulk resource for aggregate tests', 'csv-import', 'Data', NULL, NULL, 0, 43, '2026-02-20T09:00:00Z', '2026-02-20T09:00:00Z', NULL, NULL, 'Data', NULL, NULL, NULL);

-- bulk-person-01: person type for COUNT by node_type (person group — all 5 card_types present)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('bulk-person-01', 'person', 'Bulk Person 01', 'Bulk person for aggregate tests', 'manual', 'Contacts', NULL, NULL, 0, 44, '2026-02-21T09:00:00Z', '2026-02-21T09:00:00Z', NULL, NULL, 'Contacts', NULL, NULL, NULL);

-- bulk-person-02: second person for sufficient cardinality in person group
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('bulk-person-02', 'person', 'Bulk Person 02', 'Second person for aggregate tests', 'csv-import', 'Contacts', NULL, NULL, 0, 45, '2026-02-22T09:00:00Z', '2026-02-22T09:00:00Z', NULL, NULL, 'Contacts', NULL, NULL, NULL);

-- sort-folder-work-a: note in Work/Projects/Alpha for multi-sort test (folder_l1=Work, name=Aardvark)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('sort-folder-work-a', 'note', 'Aardvark Report', 'For multi-sort: folder_l1=Work, name=Aardvark', 'manual', 'Work/Projects', NULL, 'open', 0, 46, '2026-02-23T09:00:00Z', '2026-02-23T09:00:00Z', NULL, NULL, 'Work', 'Projects', NULL, NULL);

-- sort-folder-work-z: note in Work/Projects for multi-sort test (folder_l1=Work, name=Zebra)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('sort-folder-work-z', 'note', 'Zebra Report', 'For multi-sort: folder_l1=Work, name=Zebra', 'manual', 'Work/Projects', NULL, 'open', 0, 47, '2026-02-24T09:00:00Z', '2026-02-24T09:00:00Z', NULL, NULL, 'Work', 'Projects', NULL, NULL);

-- sort-folder-personal-m: note in Personal folder for multi-sort test (folder_l1=Personal, name=Mongoose)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('sort-folder-personal-m', 'note', 'Mongoose Journal', 'For multi-sort: folder_l1=Personal, name=Mongoose', 'manual', 'Personal/Journal', NULL, 'open', 0, 48, '2026-02-25T09:00:00Z', '2026-02-25T09:00:00Z', NULL, NULL, 'Personal', 'Journal', NULL, NULL);

-- window-rank-source-a: note from apple-notes for window function RANK test (source group 1)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('window-rank-source-a', 'note', 'Ranked Apple Note A', 'Window rank test: apple-notes group, earliest', 'apple-notes', 'Personal', NULL, 'open', 0, 49, '2026-01-03T09:00:00Z', '2026-01-03T09:00:00Z', NULL, NULL, 'Personal', NULL, NULL, NULL);

-- window-rank-source-b: note from apple-notes for window function RANK test (source group 1, later)
INSERT INTO cards (id, card_type, name, content, source, folder, tags, status, priority, sort_order, created_at, modified_at, due_at, deleted_at, folder_l1, folder_l2, folder_l3, folder_l4)
VALUES ('window-rank-source-b', 'note', 'Ranked Apple Note B', 'Window rank test: apple-notes group, later', 'apple-notes', 'Work', NULL, 'open', 0, 50, '2026-01-07T09:00:00Z', '2026-01-07T09:00:00Z', NULL, NULL, 'Work', NULL, NULL, NULL);
```

**Row count:** 50 INSERT statements spanning all 5 `card_type` values (`note`, `task`, `event`, `resource`, `person`).

**Scenario coverage:**

| Scenario family | Rows | Purpose |
|-----------------|------|---------|
| `calc-*` | 5 | Dependency chain (A→B→C), cycle detection (A↔B) |
| `filter-*` | 7 | NULL source/folder/tags/priority, apple-notes filter, no-match exclusions |
| `sort-*` | 6 | Alphabetical extremes + multi-key sort by folder_l1, name |
| `mark-*` | 7 | Priority threshold, multi-mark accumulation, NULL-column handling |
| `audit-*` | 5 | Validation rule, anomaly rule, NULL status |
| `cross-*` | 3 | Multi-explorer active scenarios |
| `edge-*` | 6 | Empty results, type mismatch, deep folder, date ranges |
| `bulk-*` | 11 | All 5 card_type values with sufficient cardinality for COUNT/SUM |
| `window-*` | 2 | Window function RANK PARTITION groups |

---

## Section 2 — Test Corpus (TEST-02)

### Format Convention

Each test case is presented as a structured object conforming to the `GoldenTestCase` type (defined in Section 3). The `chipArrangement` field conforms to `ChipWellOutputContract` shape (from `06-chip-well-geometry.md` §9). Per D-12, NO `toMatchSnapshot()` — all assertions use normalized string comparison for SQL and sorted deep-equal for result rows/annotations.

The first 10 cases are the backbone cases derived from `02-compilation-pipeline.md` §10 (Examples 1–10). Expected SQL is taken verbatim from that document.

---

### Case 1: single-calc-derived-column

```
name: "single-calc-derived-column"
category: "formulas/calculations"
chipArrangement:
  calculations: [{ id: "chip-c1", dsl: "UPPER(name) AS display_name", typeSignature: "expression" }]
  filters: []
  sorts: []
  marks: []
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: "SELECT *, UPPER(name) AS display_name FROM cards WHERE deleted_at IS NULL"
expectedBindValues: []
expectedResult: [/* all non-deleted fixture rows with display_name = UPPER(name) */]
orderSensitive: false
errorExpected: null
```

**What it exercises:** COMP-01 (clause mapping), COMP-02 (single-chip, no dependency graph needed). Simplest non-trivial formula output.

---

### Case 2: single-filter-equality

```
name: "single-filter-equality"
category: "formulas/filters"
chipArrangement:
  calculations: []
  filters: [{ id: "chip-f1", dsl: "card_type = 'note'", typeSignature: "predicate" }]
  sorts: []
  marks: []
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: "SELECT * FROM cards WHERE deleted_at IS NULL AND card_type = ?"
expectedBindValues: ["note"]
expectedResult: [/* all rows where card_type = 'note' */]
orderSensitive: false
errorExpected: null
```

**Notes:** `node_type` is the legacy column name from the compilation pipeline examples; in the fixture `card_type` is used per `SeedCard` interface. The test case uses `card_type` to match the fixture schema. This deviation from the Example 2 column name is intentional — the fixture schema is authoritative (D-02).

**What it exercises:** COMP-03 bind-value protocol. `'note'` becomes `?` placeholder; prohibited string-concat form (`WHERE card_type = 'note'`) would be a FE-RG-02 violation.

---

### Case 3: single-sort-created-at-desc

```
name: "single-sort-created-at-desc"
category: "formulas/sorts"
chipArrangement:
  calculations: []
  filters: []
  sorts: [{ id: "chip-s1", dsl: "created_at DESC", typeSignature: "ordering" }]
  marks: []
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: "SELECT * FROM cards WHERE deleted_at IS NULL ORDER BY created_at DESC"
expectedBindValues: []
expectedResult: [/* all non-deleted fixture rows sorted created_at DESC */]
orderSensitive: true
errorExpected: null
```

**What it exercises:** FE-RG-04 (sort direction is structural, not a bind value). Column validated against SchemaProvider allowlist (COMP-04).

---

### Case 4: multi-filter-and-composition

```
name: "multi-filter-and-composition"
category: "formulas/filters"
chipArrangement:
  calculations: []
  filters: [
    { id: "chip-f1", dsl: "card_type = 'note'", typeSignature: "predicate" },
    { id: "chip-f2", dsl: "source = 'apple-notes'", typeSignature: "predicate" }
  ]
  sorts: []
  marks: []
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: "SELECT * FROM cards WHERE deleted_at IS NULL AND card_type = ? AND source = ?"
expectedBindValues: ["note", "apple-notes"]
expectedResult:
  - { id: "filter-apple-notes-a", card_type: "note", source: "apple-notes", ... }
  - { id: "filter-apple-notes-b", card_type: "note", source: "apple-notes", ... }
  - { id: "mark-apple-source", card_type: "note", source: "apple-notes", ... }
  - { id: "cross-note-work", card_type: "note", source: "apple-notes", ... }
  - { id: "cross-note-personal", card_type: "note", source: "apple-notes", ... }
  - { id: "bulk-note-02", card_type: "note", source: "apple-notes", ... }
  - { id: "bulk-note-03", card_type: "note", source: "apple-notes", ... }
  - { id: "window-rank-source-a", card_type: "note", source: "apple-notes", ... }
  - { id: "window-rank-source-b", card_type: "note", source: "apple-notes", ... }
orderSensitive: false
errorExpected: null
```

**What it exercises:** FE-RG-03 (AND-only composition). Bind values ordered by chip position: chip-f1's `'note'` first, chip-f2's `'apple-notes'` second.

---

### Case 5: multi-sort-lexicographic

```
name: "multi-sort-lexicographic"
category: "formulas/sorts"
chipArrangement:
  calculations: []
  filters: []
  sorts: [
    { id: "chip-s1", dsl: "folder_l1 ASC", typeSignature: "ordering" },
    { id: "chip-s2", dsl: "name ASC", typeSignature: "ordering" }
  ]
  marks: []
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: "SELECT * FROM cards WHERE deleted_at IS NULL ORDER BY folder_l1 ASC, name ASC"
expectedBindValues: []
expectedResult: [/* all non-deleted rows sorted by folder_l1 ASC then name ASC — NULLs last per SQLite default */]
orderSensitive: true
errorExpected: null
```

**What it exercises:** FE-RG-04 (lexicographic chip-position sort). Primary key is chip-s1 (`folder_l1`), secondary is chip-s2 (`name`). Swapping chip order would change sort priority.

---

### Case 6: calculation-plus-filter-combo

```
name: "calculation-plus-filter-combo"
category: "formulas/calculations"
chipArrangement:
  calculations: [{ id: "chip-c1", dsl: "UPPER(name) AS display_name", typeSignature: "expression" }]
  filters: [{ id: "chip-f1", dsl: "card_type = 'note'", typeSignature: "predicate" }]
  sorts: []
  marks: []
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: "SELECT *, UPPER(name) AS display_name FROM cards WHERE deleted_at IS NULL AND card_type = ?"
expectedBindValues: ["note"]
expectedResult: [/* all note rows with display_name = UPPER(name) */]
orderSensitive: false
errorExpected: null
```

**What it exercises:** Cross-category within Formulas Explorer. Calculation → SELECT fragment; Filter → WHERE conjunct. QueryBuilder composes independently.

---

### Case 7: aggregation-with-group-by-from-view

```
name: "aggregation-with-group-by-from-view"
category: "formulas/calculations"
chipArrangement:
  calculations: [{ id: "chip-c1", dsl: "COUNT(*) AS row_count", typeSignature: "expression" }]
  filters: []
  sorts: []
  marks: []
  audits: { anomaly: [], validation: [] }
viewContext: { groupBy: "card_type" }
expectedSql: "SELECT card_type, COUNT(*) AS row_count FROM cards WHERE deleted_at IS NULL GROUP BY card_type"
expectedBindValues: []
expectedResult:
  - { card_type: "event", row_count: 2 }
  - { card_type: "note", row_count: <count of all note rows> }
  - { card_type: "person", row_count: 2 }
  - { card_type: "resource", row_count: 2 }
  - { card_type: "task", row_count: <count of all task rows> }
orderSensitive: false
errorExpected: null
```

**Notes:** `GROUP BY card_type` comes from `viewContext`, NOT from `FormulasProvider` (FE-RG-01). The expected result row counts reflect the fixture dataset totals. Exact counts to be computed at implementation time by running the fixture SQL against the schema.

**What it exercises:** FE-RG-01 (FormulasProvider never emits GROUP BY). The same chip in a flat-list view context would produce no GROUP BY.

---

### Case 8: window-function-rank

```
name: "window-function-rank"
category: "formulas/calculations"
chipArrangement:
  calculations: [{ id: "chip-c1", dsl: "RANK() OVER (PARTITION BY source ORDER BY created_at DESC) AS source_rank", typeSignature: "expression" }]
  filters: []
  sorts: []
  marks: []
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: "SELECT *, RANK() OVER (PARTITION BY source ORDER BY created_at DESC) AS source_rank FROM cards WHERE deleted_at IS NULL"
expectedBindValues: []
expectedResult: [/* all non-deleted rows with source_rank computed per partition */]
orderSensitive: false
errorExpected: null
```

**What it exercises:** Window function as a single SELECT fragment. `OVER (PARTITION BY ... ORDER BY ...)` is part of the expression, not a separate SQL clause. No bind values (structural elements only).

---

### Case 9: cross-category-filtered-totals

```
name: "cross-category-filtered-totals"
category: "formulas/calculations"
chipArrangement:
  calculations: [{ id: "chip-c1", dsl: "SUM(CASE WHEN source = 'apple-notes' THEN 1 ELSE 0 END) AS apple_notes_count", typeSignature: "expression" }]
  filters: [{ id: "chip-f1", dsl: "card_type = 'note'", typeSignature: "predicate" }]
  sorts: []
  marks: []
  audits: { anomaly: [], validation: [] }
viewContext: { groupBy: "folder_l1" }
expectedSql: "SELECT folder_l1, SUM(CASE WHEN source = ? THEN 1 ELSE 0 END) AS apple_notes_count FROM cards WHERE deleted_at IS NULL AND card_type = ? GROUP BY folder_l1"
expectedBindValues: ["apple-notes", "note"]
expectedResult:
  - { folder_l1: "Archive", apple_notes_count: 0 }
  - { folder_l1: "Bulk", apple_notes_count: 0 }
  - { folder_l1: "Personal", apple_notes_count: <count> }
  - { folder_l1: "Work", apple_notes_count: <count> }
  - { folder_l1: null, apple_notes_count: 0 }
orderSensitive: false
errorExpected: null
```

**Notes:** Bind value order: `'apple-notes'` first (SELECT clause `CASE WHEN` placeholder appears before WHERE clause `card_type` placeholder in SQL text order). This is the canonical cross-category reference example (§2.5 of 02-compilation-pipeline.md). Exact `apple_notes_count` values computed at implementation time.

**What it exercises:** Cross-category reference via `CASE WHEN` (COMP inline resolution). FE-RG-01 (GROUP BY from viewContext). FE-RG-02 (bind-value protocol for CASE WHEN placeholder).

---

### Case 10: dependency-cycle-error

```
name: "dependency-cycle-error"
category: "formulas/calculations"
chipArrangement:
  calculations: [
    { id: "chip-A", dsl: "B_col + 1 AS A_col", typeSignature: "expression" },
    { id: "chip-B", dsl: "A_col - 1 AS B_col", typeSignature: "expression" }
  ]
  filters: []
  sorts: []
  marks: []
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: null
expectedBindValues: null
expectedResult: null
orderSensitive: false
errorExpected: { kind: "CycleError", participants: ["chip-A", "chip-B"] }
```

**What it exercises:** FE-RG-05 (cycle detection). Kahn's algorithm detects both chips remain with `inDegree > 0`. No SQL produced. `CycleError.participants` carries chip IDs for UI highlighting.

---

### Case 11: calculation-dependency-chain

```
name: "calculation-dependency-chain"
category: "formulas/calculations"
chipArrangement:
  calculations: [
    { id: "chip-c1", dsl: "priority + 1 AS priority_plus", typeSignature: "expression" },
    { id: "chip-c2", dsl: "priority_plus * 2 AS priority_doubled", typeSignature: "expression" }
  ]
  filters: []
  sorts: []
  marks: []
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: "SELECT *, priority + 1 AS priority_plus, priority_plus * 2 AS priority_doubled FROM cards WHERE deleted_at IS NULL"
expectedBindValues: []
expectedResult: [/* all non-deleted rows with priority_plus and priority_doubled computed */]
orderSensitive: false
errorExpected: null
```

**What it exercises:** COMP-02 topological sort. chip-c2 depends on chip-c1's output alias (`priority_plus`). chip-c1 must appear first in SELECT clause.

---

### Case 12: three-filter-and-chain

```
name: "three-filter-and-chain"
category: "formulas/filters"
chipArrangement:
  calculations: []
  filters: [
    { id: "chip-f1", dsl: "card_type = 'note'", typeSignature: "predicate" },
    { id: "chip-f2", dsl: "source = 'apple-notes'", typeSignature: "predicate" },
    { id: "chip-f3", dsl: "priority > 0", typeSignature: "predicate" }
  ]
  sorts: []
  marks: []
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: "SELECT * FROM cards WHERE deleted_at IS NULL AND card_type = ? AND source = ? AND priority > ?"
expectedBindValues: ["note", "apple-notes", 0]
expectedResult: [/* note rows from apple-notes with priority > 0 */]
orderSensitive: false
errorExpected: null
```

**What it exercises:** FE-RG-03 with three chips. Three conjuncts. Bind values in chip-well position order.

---

### Case 13: sort-plus-filter-combo

```
name: "sort-plus-filter-combo"
category: "formulas/sorts"
chipArrangement:
  calculations: []
  filters: [{ id: "chip-f1", dsl: "card_type = 'note'", typeSignature: "predicate" }]
  sorts: [{ id: "chip-s1", dsl: "name ASC", typeSignature: "ordering" }]
  marks: []
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: "SELECT * FROM cards WHERE deleted_at IS NULL AND card_type = ? ORDER BY name ASC"
expectedBindValues: ["note"]
expectedResult: [/* note rows sorted by name ASC */]
orderSensitive: true
errorExpected: null
```

**What it exercises:** Filter (WHERE) + Sort (ORDER BY) composing independently. ORDER BY follows WHERE in clause order (COMP-01).

---

### Case 14: aggregation-no-group-by-flat

```
name: "aggregation-no-group-by-flat"
category: "formulas/calculations"
chipArrangement:
  calculations: [{ id: "chip-c1", dsl: "COUNT(*) AS total_count", typeSignature: "expression" }]
  filters: []
  sorts: []
  marks: []
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: "SELECT *, COUNT(*) AS total_count FROM cards WHERE deleted_at IS NULL"
expectedBindValues: []
expectedResult: [/* single row with total_count = number of non-deleted rows */]
orderSensitive: false
errorExpected: null
```

**What it exercises:** FE-RG-01 variant — same chip, no viewContext → no GROUP BY. Aggregation without grouping produces a single row (total count). Demonstrates that GROUP BY is purely viewContext-driven.

---

### Case 15: case-when-conditional-calculation

```
name: "case-when-conditional-calculation"
category: "formulas/calculations"
chipArrangement:
  calculations: [{ id: "chip-c1", dsl: "CASE WHEN priority >= 4 THEN 'high' ELSE 'low' END AS priority_label", typeSignature: "expression" }]
  filters: []
  sorts: []
  marks: []
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: "SELECT *, CASE WHEN priority >= ? THEN ? ELSE ? END AS priority_label FROM cards WHERE deleted_at IS NULL"
expectedBindValues: [4, "high", "low"]
expectedResult:
  - { id: "mark-priority-high", priority_label: "high", ... }
  - { id: "mark-priority-above-threshold", priority_label: "high", ... }
  - { id: "cross-task-urgent", priority_label: "high", ... }
  - { id: "audit-high-priority-anomaly", priority_label: "high", ... }
  - /* all other rows: priority_label: "low" */
orderSensitive: false
errorExpected: null
```

**What it exercises:** CASE WHEN with literal bind values in the THEN/ELSE branches. All three literal values (`4`, `'high'`, `'low'`) must be `?` placeholders.

---

### Case 16: date-range-filter-two-bind-values

```
name: "date-range-filter-two-bind-values"
category: "formulas/filters"
chipArrangement:
  calculations: []
  filters: [{ id: "chip-f1", dsl: "created_at BETWEEN '2026-01-05T00:00:00Z' AND '2026-01-20T23:59:59Z'", typeSignature: "predicate" }]
  sorts: []
  marks: []
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: "SELECT * FROM cards WHERE deleted_at IS NULL AND created_at BETWEEN ? AND ?"
expectedBindValues: ["2026-01-05T00:00:00Z", "2026-01-20T23:59:59Z"]
expectedResult:
  - { id: "sort-alpha-first", created_at: "2026-01-05T08:00:00Z", ... }
  - { id: "calc-dep-a", created_at: "2026-01-10T09:00:00Z", ... }
  - { id: "calc-dep-b", created_at: "2026-01-11T09:00:00Z", ... }
  - { id: "calc-dep-c", created_at: "2026-01-12T09:00:00Z", ... }
  - { id: "calc-cycle-a", created_at: "2026-01-13T09:00:00Z", ... }
  - { id: "calc-cycle-b", created_at: "2026-01-14T09:00:00Z", ... }
  - { id: "filter-null-source", created_at: "2026-01-15T09:00:00Z", ... }
  - { id: "edge-date-range-early", created_at: "2026-01-02T09:00:00Z", ... }
  - { id: "edge-date-range-middle", created_at: "2026-01-15T12:00:00Z", ... }
  - { id: "window-rank-source-a", created_at: "2026-01-03T09:00:00Z", ... }
  - { id: "window-rank-source-b", created_at: "2026-01-07T09:00:00Z", ... }
orderSensitive: false
errorExpected: null
```

**Notes:** `edge-date-range-early` (2026-01-02) is within the range. `edge-date-range-late` (2026-01-28) falls outside. Two bind values for one chip (BETWEEN ? AND ?). Exact result set computed at implementation time against fixture.

**What it exercises:** COMP-03 with two bind values from a single chip's BETWEEN predicate. FE-RG-02 (no literal date strings in SQL).

---

### Case 17: single-mark-urgent-priority

```
name: "single-mark-urgent-priority"
category: "marks/conditional"
chipArrangement:
  calculations: []
  filters: []
  sorts: []
  marks: [{ id: "chip-m1", dsl: "priority > 3", cssClass: "urgent", typeSignature: "class-assignment" }]
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: "SELECT * FROM cards WHERE deleted_at IS NULL"
expectedBindValues: []
expectedResult: [/* all non-deleted rows */]
expectedAnnotation:
  marks: Map {
    "calc-dep-a" → [],       -- priority 3, not > 3
    "calc-dep-b" → [],       -- priority 2
    "calc-dep-c" → [],       -- priority 1
    "calc-cycle-a" → ["urgent"],   -- priority 4
    "calc-cycle-b" → ["urgent"],   -- priority 4
    "mark-priority-high" → ["urgent"],          -- priority 5
    "mark-priority-above-threshold" → ["urgent"], -- priority 4
    "mark-priority-low" → [],      -- priority 1
    "mark-apple-source" → [],      -- priority 0
    "mark-null-priority" → [],     -- priority 0
    "mark-both" → ["urgent"],      -- priority 5
    "cross-task-urgent" → ["urgent"],  -- priority 5
    "audit-high-priority-anomaly" → ["urgent"],  -- priority 5
    /* all other rows → [] (priority <= 3) */
  }
orderSensitive: false
errorExpected: null
```

**What it exercises:** FE-RG-07 (Marks never filter — annotation Map.size must equal rows.length). annotateMarks() post-query pass. `priority > 3` is a JS-evaluated predicate on materialized result rows.

**Invariant assertion:** `annotationMap.size === resultRows.length` must hold.

---

### Case 18: multi-mark-two-classes

```
name: "multi-mark-two-classes"
category: "marks/conditional"
chipArrangement:
  calculations: []
  filters: []
  sorts: []
  marks: [
    { id: "chip-m1", dsl: "priority > 3", cssClass: "urgent", typeSignature: "class-assignment" },
    { id: "chip-m2", dsl: "source = 'apple-notes'", cssClass: "apple-source", typeSignature: "class-assignment" }
  ]
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: "SELECT * FROM cards WHERE deleted_at IS NULL"
expectedBindValues: []
expectedAnnotation:
  marks: Map {
    "mark-both" → ["urgent", "apple-source"],  -- priority 5 + apple-notes source
    "mark-priority-high" → ["urgent"],          -- priority 5, source not apple-notes
    "mark-apple-source" → ["apple-source"],     -- apple-notes, priority 0
    "filter-apple-notes-a" → ["apple-source"],  -- apple-notes, priority 1
    /* rows with priority > 3 AND apple-notes → both classes */
    /* rows with neither condition → [] */
  }
orderSensitive: false
errorExpected: null
```

**What it exercises:** Multi-chip marks — classes accumulate per row. A row matching both predicates gets both CSS classes in the array. Chip evaluation is independent per row.

---

### Case 19: mark-null-predicate-column

```
name: "mark-null-predicate-column"
category: "marks/conditional"
chipArrangement:
  calculations: []
  filters: []
  sorts: []
  marks: [{ id: "chip-m1", dsl: "source = 'apple-notes'", cssClass: "apple-source", typeSignature: "class-assignment" }]
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: "SELECT * FROM cards WHERE deleted_at IS NULL"
expectedBindValues: []
expectedAnnotation:
  marks: Map {
    "filter-null-source" → [],  -- source IS NULL: predicate is NULL, not FALSE — chip skipped for this row
    /* all apple-notes rows → ["apple-source"] */
    /* all non-null non-apple-notes rows → [] */
  }
orderSensitive: false
errorExpected: null
```

**What it exercises:** NULL handling in annotateMarks(). When `source IS NULL`, the predicate evaluates to NULL (not FALSE). The chip is skipped for that row. The row still appears in the Map with `[]` (empty class array). This is the correct behavior per COMP-05 §7 of 02-compilation-pipeline.md.

**Critical assertion:** `annotationMap.has("filter-null-source") === true` and `annotationMap.get("filter-null-source") === []`. The row is NOT absent from the Map.

---

### Case 20: mark-all-predicates-false-empty-classes

```
name: "mark-all-predicates-false-empty-classes"
category: "marks/conditional"
chipArrangement:
  calculations: []
  filters: []
  sorts: []
  marks: [{ id: "chip-m1", dsl: "priority > 100", cssClass: "impossible", typeSignature: "class-assignment" }]
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: "SELECT * FROM cards WHERE deleted_at IS NULL"
expectedBindValues: []
expectedAnnotation:
  marks: Map {
    /* every row → [] (no row has priority > 100) */
  }
orderSensitive: false
errorExpected: null
```

**What it exercises:** FE-RG-07 — even when all predicates are false, every row still appears in the Map with `[]`. Map.size === rows.length. Marks never produce an empty Map (unless rows.length is 0).

---

### Case 21: mark-all-rows-matching

```
name: "mark-all-rows-matching"
category: "marks/conditional"
chipArrangement:
  calculations: []
  filters: []
  sorts: []
  marks: [{ id: "chip-m1", dsl: "priority >= 0", cssClass: "has-priority", typeSignature: "class-assignment" }]
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: "SELECT * FROM cards WHERE deleted_at IS NULL"
expectedBindValues: []
expectedAnnotation:
  marks: Map {
    /* every row → ["has-priority"] (all rows have priority >= 0, including default 0) */
  }
orderSensitive: false
errorExpected: null
```

**What it exercises:** When all rows match, every Map entry has the CSS class. Map.size === rows.length. Tests the positive invariant of FE-RG-07.

---

### Case 22: mark-error-nonexistent-column

```
name: "mark-error-nonexistent-column"
category: "marks/conditional"
chipArrangement:
  calculations: []
  filters: []
  sorts: []
  marks: [
    { id: "chip-m1", dsl: "nonexistent_column > 0", cssClass: "error-class", typeSignature: "class-assignment" },
    { id: "chip-m2", dsl: "priority > 3", cssClass: "urgent", typeSignature: "class-assignment" }
  ]
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: "SELECT * FROM cards WHERE deleted_at IS NULL"
expectedBindValues: []
expectedAnnotation:
  marks: Map {
    /* chip-m1 is skipped for ALL rows (chip-scoped error) */
    /* chip-m2 evaluates normally */
    "mark-priority-high" → ["urgent"],   -- chip-m2 matched, chip-m1 errored
    /* all rows → classes from chip-m2 only */
  }
chipErrors:
  - { chipId: "chip-m1", kind: "PredicateEvalError", message: "Unknown column: nonexistent_column" }
orderSensitive: false
errorExpected: null
```

**Notes:** `errorExpected: null` because the overall annotation pass does NOT throw — chip-scoped errors are surfaced per-chip via `chipErrors`, not as a thrown error.

**What it exercises:** Error handling in annotateMarks(). Chip-m1 throws for all rows → chip-m1 is marked as errored, skipped for all rows. Chip-m2 continues evaluating normally. The annotation pass completes. Result Map still has entries for every row.

---

### Case 23: single-anomaly-rule-high-priority

```
name: "single-anomaly-rule-high-priority"
category: "audits/anomaly"
chipArrangement:
  calculations: []
  filters: []
  sorts: []
  marks: []
  audits:
    anomaly: [{ id: "chip-a1", dsl: "priority > 4", label: "High priority", kind: "anomaly", typeSignature: "flag-rule" }]
    validation: []
viewContext: null
expectedSql: "SELECT * FROM cards WHERE deleted_at IS NULL"
expectedBindValues: []
expectedAnnotation:
  audits: Map {
    "mark-priority-high" → [{ chipId: "chip-a1", kind: "anomaly", label: "High priority" }],
    "mark-both" → [{ chipId: "chip-a1", kind: "anomaly", label: "High priority" }],
    "cross-task-urgent" → [{ chipId: "chip-a1", kind: "anomaly", label: "High priority" }],
    "audit-high-priority-anomaly" → [{ chipId: "chip-a1", kind: "anomaly", label: "High priority" }],
    /* all other rows → [] */
  }
orderSensitive: false
errorExpected: null
```

**What it exercises:** FE-RG-08 (Audits never filter). annotateAudits() post-query pass. `AuditAnnotation.kind = 'anomaly'` distinguishes from validation rules.

**Invariant assertion:** `annotationMap.size === resultRows.length`.

---

### Case 24: single-validation-rule-missing-due-date

```
name: "single-validation-rule-missing-due-date"
category: "audits/validation"
chipArrangement:
  calculations: []
  filters: []
  sorts: []
  marks: []
  audits:
    anomaly: []
    validation: [{ id: "chip-v1", dsl: "due_at IS NULL AND status = 'in_progress'", label: "Missing due date", kind: "validation", typeSignature: "flag-rule" }]
viewContext: null
expectedSql: "SELECT * FROM cards WHERE deleted_at IS NULL"
expectedBindValues: []
expectedAnnotation:
  audits: Map {
    "audit-missing-due" → [{ chipId: "chip-v1", kind: "validation", label: "Missing due date" }],
    "calc-dep-a" → [],        -- status = 'open', not in_progress
    "calc-cycle-a" → [],      -- status = 'in_progress' BUT due_at is NOT NULL
    /* all rows where condition fails → [] */
  }
orderSensitive: false
errorExpected: null
```

**What it exercises:** `AuditAnnotation.kind = 'validation'`. Compound predicate with IS NULL and string equality. Only `audit-missing-due` satisfies both conditions.

---

### Case 25: multi-audit-anomaly-and-validation

```
name: "multi-audit-anomaly-and-validation"
category: "audits/anomaly"
chipArrangement:
  calculations: []
  filters: []
  sorts: []
  marks: []
  audits:
    anomaly: [{ id: "chip-a1", dsl: "priority > 4", label: "High priority", kind: "anomaly", typeSignature: "flag-rule" }]
    validation: [{ id: "chip-v1", dsl: "due_at IS NULL AND status = 'in_progress'", label: "Missing due date", kind: "validation", typeSignature: "flag-rule" }]
viewContext: null
expectedSql: "SELECT * FROM cards WHERE deleted_at IS NULL"
expectedBindValues: []
expectedAnnotation:
  audits: Map {
    "audit-missing-due" → [{ chipId: "chip-v1", kind: "validation", label: "Missing due date" }],
    "mark-priority-high" → [{ chipId: "chip-a1", kind: "anomaly", label: "High priority" }],
    "mark-both" → [{ chipId: "chip-a1", kind: "anomaly", label: "High priority" }],
    /* rows triggering both → two annotations */
    /* all other rows → [] */
  }
orderSensitive: false
errorExpected: null
```

**What it exercises:** Multiple audit chips from different sub-categories (anomaly + validation) composing. Rows accumulate annotations from both. `kind` field discriminates them for UI rendering.

---

### Case 26: audit-null-column-predicate

```
name: "audit-null-column-predicate"
category: "audits/validation"
chipArrangement:
  calculations: []
  filters: []
  sorts: []
  marks: []
  audits:
    anomaly: []
    validation: [{ id: "chip-v1", dsl: "status = 'in_progress'", label: "In progress", kind: "validation", typeSignature: "flag-rule" }]
viewContext: null
expectedSql: "SELECT * FROM cards WHERE deleted_at IS NULL"
expectedBindValues: []
expectedAnnotation:
  audits: Map {
    "audit-null-status" → [],   -- status IS NULL: predicate is NULL → chip skipped, row gets []
    /* in_progress rows → annotation */
    /* other non-null status rows → [] */
  }
orderSensitive: false
errorExpected: null
```

**What it exercises:** NULL handling in annotateAudits() — identical semantics to Marks. `audit-null-status` has `status = NULL`. Predicate evaluates to NULL (not FALSE). Chip is skipped. Row still appears in Map with `[]`.

---

### Case 27: all-three-explorers-active

```
name: "all-three-explorers-active"
category: "cross-category"
chipArrangement:
  calculations: [{ id: "chip-c1", dsl: "UPPER(name) AS display_name", typeSignature: "expression" }]
  filters: [{ id: "chip-f1", dsl: "card_type = 'task'", typeSignature: "predicate" }]
  sorts: [{ id: "chip-s1", dsl: "priority DESC", typeSignature: "ordering" }]
  marks: [{ id: "chip-m1", dsl: "priority > 3", cssClass: "urgent", typeSignature: "class-assignment" }]
  audits:
    anomaly: []
    validation: [{ id: "chip-v1", dsl: "due_at IS NULL AND status = 'in_progress'", label: "Missing due date", kind: "validation", typeSignature: "flag-rule" }]
viewContext: null
expectedSql: "SELECT *, UPPER(name) AS display_name FROM cards WHERE deleted_at IS NULL AND card_type = ? ORDER BY priority DESC"
expectedBindValues: ["task"]
expectedResult: [/* task rows sorted by priority DESC with display_name */]
expectedAnnotation:
  marks: Map {
    "calc-cycle-a" → ["urgent"],      -- task, priority 4
    "calc-cycle-b" → ["urgent"],      -- task, priority 4
    "mark-priority-high" → ["urgent"],           -- task, priority 5
    "mark-priority-above-threshold" → ["urgent"], -- task, priority 4
    "mark-both" → ["urgent"],         -- task, priority 5
    "cross-task-urgent" → ["urgent"], -- task, priority 5
    /* other task rows → [] */
  }
  audits: Map {
    "audit-missing-due" → [{ chipId: "chip-v1", kind: "validation", label: "Missing due date" }],
    /* all other task rows → [] */
  }
orderSensitive: true
errorExpected: null
```

**What it exercises:** Full pipeline — FormulasProvider compiles SQL, QueryBuilder assembles query, results annotated by annotateMarks() and annotateAudits() separately. All annotation Maps have size === result rows length.

---

### Case 28: filter-produces-empty-result

```
name: "filter-produces-empty-result"
category: "cross-category"
chipArrangement:
  calculations: []
  filters: [{ id: "chip-f1", dsl: "name = 'nonexistent-name-xyz'", typeSignature: "predicate" }]
  sorts: []
  marks: [{ id: "chip-m1", dsl: "priority > 0", cssClass: "has-priority", typeSignature: "class-assignment" }]
  audits:
    anomaly: [{ id: "chip-a1", dsl: "priority > 4", label: "High priority", kind: "anomaly", typeSignature: "flag-rule" }]
    validation: []
viewContext: null
expectedSql: "SELECT * FROM cards WHERE deleted_at IS NULL AND name = ?"
expectedBindValues: ["nonexistent-name-xyz"]
expectedResult: []
expectedAnnotation:
  marks: Map { /* empty — 0 result rows → 0 Map entries */ }
  audits: Map { /* empty — 0 result rows → 0 Map entries */ }
orderSensitive: false
errorExpected: null
```

**Notes:** When result set is empty, both annotation Maps are empty (size 0). This is correct: Map.size === rows.length === 0. FE-RG-07 and FE-RG-08 are satisfied.

**What it exercises:** Annotation passes with empty input. annotation Maps are empty but not missing — they are returned as empty Maps, not null/undefined.

---

### Case 29: type-mismatch-at-drop-time

```
name: "type-mismatch-at-drop-time"
category: "cross-category"
chipArrangement:
  calculations: [{ id: "chip-c1", dsl: "UPPER(name) AS display_name", typeSignature: "expression" }]
  filters: [
    { id: "chip-f1", dsl: "display_name", typeSignature: "expression" }
    /* INVALID: chip-f1 has typeSignature 'expression' (text output) dropped into Filters well (requires 'predicate') */
  ]
  sorts: []
  marks: []
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: null
expectedBindValues: null
expectedResult: null
orderSensitive: false
errorExpected:
  { kind: "ValidationError", chipId: "chip-f1", reason: "Type mismatch: 'expression' chip cannot be dropped into Filters well (requires predicate)" }
```

**What it exercises:** Compile-time type validation of `ChipWellOutputContract`. A chip with `typeSignature: 'expression'` (text output) is invalid in the Filters well (which requires `typeSignature: 'predicate'`). Error is chip-scoped, not a hard abort of the entire compilation session.

**Notes:** This validation occurs at drop time (chip placement) per 06-chip-well-geometry.md §6 (type-incompatible drop). The `FormulasProvider.compile()` method should also enforce this as a defensive check.

---

### Case 30: three-way-calculation-dependency-chain

```
name: "three-way-calculation-dependency-chain"
category: "formulas/calculations"
chipArrangement:
  calculations: [
    { id: "chip-c1", dsl: "length(name) AS name_length", typeSignature: "expression" },
    { id: "chip-c2", dsl: "name_length * 2 AS name_length_doubled", typeSignature: "expression" },
    { id: "chip-c3", dsl: "name_length_doubled + name_length AS name_length_tripled", typeSignature: "expression" }
  ]
  filters: []
  sorts: []
  marks: []
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: "SELECT *, length(name) AS name_length, name_length * 2 AS name_length_doubled, name_length_doubled + name_length AS name_length_tripled FROM cards WHERE deleted_at IS NULL"
expectedBindValues: []
expectedResult: [/* all non-deleted rows with all three derived columns */]
orderSensitive: false
errorExpected: null
```

**What it exercises:** Deep topological sort — three-chip chain C3 → C2 → C1 (where C3 depends on C2's output, C2 depends on C1's output). Kahn's algorithm must produce [C1, C2, C3] order. SELECT clause must emit in that order. Chip-c3 appears last in SELECT.

---

### Case 31: mark-with-formula-filter-active

```
name: "mark-with-formula-filter-active"
category: "cross-category"
chipArrangement:
  calculations: []
  filters: [{ id: "chip-f1", dsl: "card_type = 'task'", typeSignature: "predicate" }]
  sorts: []
  marks: [{ id: "chip-m1", dsl: "priority > 3", cssClass: "urgent", typeSignature: "class-assignment" }]
  audits: { anomaly: [], validation: [] }
viewContext: null
expectedSql: "SELECT * FROM cards WHERE deleted_at IS NULL AND card_type = ?"
expectedBindValues: ["task"]
expectedResult: [/* task rows only */]
expectedAnnotation:
  marks: Map {
    /* annotation Map has same size as task result rows only */
    /* not all fixture rows — filter reduces the input to annotateMarks() */
  }
orderSensitive: false
errorExpected: null
```

**What it exercises:** Marks annotation receives only the filtered result set (tasks only). annotateMarks() operates on filtered rows, not all rows. Map.size === filtered rows count.

---

### Case 32: audit-anomaly-sorted-by-priority

```
name: "audit-anomaly-sorted-by-priority"
category: "audits/anomaly"
chipArrangement:
  calculations: []
  filters: []
  sorts: [{ id: "chip-s1", dsl: "priority DESC", typeSignature: "ordering" }]
  marks: []
  audits:
    anomaly: [{ id: "chip-a1", dsl: "priority > 4", label: "High priority", kind: "anomaly", typeSignature: "flag-rule" }]
    validation: []
viewContext: null
expectedSql: "SELECT * FROM cards WHERE deleted_at IS NULL ORDER BY priority DESC"
expectedBindValues: []
expectedAnnotation:
  audits: Map {
    "mark-priority-high" → [{ chipId: "chip-a1", kind: "anomaly", label: "High priority" }],
    "mark-both" → [{ chipId: "chip-a1", kind: "anomaly", label: "High priority" }],
    "cross-task-urgent" → [{ chipId: "chip-a1", kind: "anomaly", label: "High priority" }],
    "audit-high-priority-anomaly" → [{ chipId: "chip-a1", kind: "anomaly", label: "High priority" }],
    /* all other rows → [] */
  }
orderSensitive: true
errorExpected: null
```

**What it exercises:** Sort (ORDER BY) and Audits annotation composing. The sorted result is passed to annotateAudits(). Annotation Map keys are row IDs regardless of sort order. FE-RG-08 invariant holds.

---

## Section 3 — Test Runner Architecture (TEST-03)

### Directory Structure

Per D-07 and D-08, the golden corpus is a distinct testing tier alongside `tests/harness/` and `tests/seams/`:

```
tests/
  golden/
    fixtures/
      golden-corpus.sql       ← Extracted from §1 fixture SQL at implementation time
    corpus.test.ts            ← Single parameterized test file using test.each()
  harness/
    realDb.ts                 ← Existing: in-memory sql.js Database factory
    seedCards.ts              ← Existing: card seeding helper (reference for schema)
    makeProviders.ts          ← Existing: full provider stack factory
  seams/
    ...                       ← Existing: cross-component integration tests
```

### Fixture Loading Pattern

The corpus test file defines or imports a `loadGoldenFixture()` helper that runs the fixture SQL on top of a `realDb()` instance:

```
// Pseudocode — not a TypeScript file (no code shipped in this phase)

async function loadGoldenFixture(): Promise<Database> {
  const db = await realDb();   // applies production schema (CREATE TABLE cards, etc.)
  const sql = readFileSync('tests/golden/fixtures/golden-corpus.sql', 'utf-8');
  db.run(sql);                 // runs all 50 INSERT statements
  return db;
}
```

**Why `realDb()` first:** The `golden-corpus.sql` contains only INSERT statements (no CREATE TABLE). The schema is applied by `realDb()` → `Database.initialize()`. The fixture SQL runs on top of the already-created schema. This ensures the fixture remains compatible with schema migrations — the schema is the single source of truth.

**Lifecycle in tests:**

```
// Standard pattern per realDb.ts conventions
let db: Database;

beforeAll(async () => {
  db = await loadGoldenFixture();   // load once per suite (fixture is read-only)
});

afterAll(() => {
  db.close();   // release WASM heap
});
```

`beforeAll` (not `beforeEach`) is appropriate here because the fixture is read-only — tests must not mutate fixture rows. If a test needs mutation, it should use a separate `realDb()` instance with manually seeded data.

### Test File Structure (corpus.test.ts)

Per D-09, a single parameterized test file using Vitest `test.each()`:

```
// Pseudocode structure — not TypeScript code

import { GOLDEN_TEST_CASES } from './corpus-data'; // or inline in same file
import { FormulasProvider } from '../../src/providers/FormulasProvider';
import { annotateMarks, annotateAudits } from '../../src/providers/FormulasProvider';

const CORPUS: GoldenTestCase[] = [
  // case-1: single-calc-derived-column
  {
    name: "single-calc-derived-column",
    category: "formulas/calculations",
    chipArrangement: { ... },
    viewContext: null,
    expectedSql: "SELECT *, UPPER(name) AS display_name FROM cards WHERE deleted_at IS NULL",
    expectedBindValues: [],
    expectedResult: [...],
    orderSensitive: false,
    errorExpected: null
  },
  // ... 31 more cases
];

test.each(CORPUS)("$name", async ({ chipArrangement, viewContext, expectedSql, expectedBindValues, expectedResult, expectedAnnotation, orderSensitive, errorExpected }) => {

  // Step 1: Compile
  const compileResult = FormulasProvider.compile(chipArrangement, viewContext);

  if (errorExpected) {
    // Error case — no SQL produced
    expect(compileResult).toMatchObject({ kind: errorExpected.kind });
    if (errorExpected.participants) {
      expect(compileResult.participants).toEqual(expect.arrayContaining(errorExpected.participants));
    }
    return;
  }

  // Step 2: Assert SQL (normalized whitespace comparison per D-10)
  const normalizedActual = compileResult.sql.replace(/\s+/g, ' ').trim();
  const normalizedExpected = expectedSql.replace(/\s+/g, ' ').trim();
  expect(normalizedActual).toBe(normalizedExpected);
  expect(compileResult.params).toEqual(expectedBindValues);

  // Step 3: Execute against fixture db
  const rows = db.exec(compileResult.sql, compileResult.params);

  // Step 4: Assert result rows (sorted by id unless orderSensitive per D-11)
  if (expectedResult !== null) {
    const sortedActual = orderSensitive ? rows : [...rows].sort((a, b) => a.id < b.id ? -1 : 1);
    const sortedExpected = orderSensitive ? expectedResult : [...expectedResult].sort((a, b) => a.id < b.id ? -1 : 1);
    expect(sortedActual).toEqual(sortedExpected);
  }

  // Step 5: Assert Marks annotation (if present)
  if (expectedAnnotation?.marks) {
    const marksMap = annotateMarks(rows, chipArrangement.marks);
    // FE-RG-07: Map.size must equal rows.length
    expect(marksMap.size).toBe(rows.length);
    // Compare as sorted arrays of [rowId, classes] entries
    const actualEntries = [...marksMap.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1);
    const expectedEntries = [...expectedAnnotation.marks.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1);
    expect(actualEntries).toEqual(expectedEntries);
  }

  // Step 6: Assert Audits annotation (if present)
  if (expectedAnnotation?.audits) {
    const auditsMap = annotateAudits(rows, [...chipArrangement.audits.anomaly, ...chipArrangement.audits.validation]);
    // FE-RG-08: Map.size must equal rows.length
    expect(auditsMap.size).toBe(rows.length);
    // Compare as sorted arrays of [rowId, annotations] entries
    const actualEntries = [...auditsMap.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1);
    const expectedEntries = [...expectedAnnotation.audits.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1);
    expect(actualEntries).toEqual(expectedEntries);
  }
});
```

**Type definition (`GoldenTestCase`):**

```
// Pseudocode type — not TypeScript (no code shipped in this phase)
interface GoldenTestCase {
  name: string;
  category: 'formulas/calculations' | 'formulas/filters' | 'formulas/sorts'
           | 'marks/conditional' | 'audits/anomaly' | 'audits/validation'
           | 'cross-category';
  chipArrangement: ChipWellOutputContract;   // from 06-chip-well-geometry.md §9
  viewContext: { groupBy: string } | null;
  expectedSql: string | null;               // null for error cases
  expectedBindValues: unknown[] | null;     // null for error cases
  expectedResult: Record<string, unknown>[] | null;  // null for annotation-only or error cases
  expectedAnnotation?: {
    marks?: Map<string, string[]>;          // Map<rowId, cssClasses[]>
    audits?: Map<string, AuditAnnotation[]>; // Map<rowId, AuditAnnotation[]>
  };
  orderSensitive: boolean;                  // true when test includes ORDER BY and order matters
  errorExpected: {
    kind: 'CycleError' | 'ValidationError' | 'PredicateEvalError';
    participants?: string[];               // for CycleError: chip IDs forming the cycle
    chipId?: string;                       // for chip-scoped errors
    reason?: string;
  } | null;
  chipErrors?: {
    chipId: string;
    kind: string;
    message: string;
  }[];
}
```

### Assertion Strategy

Per D-10, D-11, D-12:

| What is compared | How |
|------------------|-----|
| **SQL string** | Collapse all whitespace runs to single space, trim, then `===` exact string match |
| **Bind values array** | `expect(actual).toEqual(expected)` — deep equal, order-sensitive (positional) |
| **Result rows (order-insensitive)** | Sort both arrays by `id` column ASC, then `expect(actual).toEqual(expected)` |
| **Result rows (order-sensitive)** | Compare arrays directly without sorting |
| **Marks Map** | Convert to `[rowId, classes[]]` entries sorted by `rowId`, then deep-equal |
| **Audits Map** | Convert to `[rowId, AuditAnnotation[]]` entries sorted by `rowId`, then deep-equal |
| **Error cases** | `expect(result).toMatchObject({ kind: '...' })` plus `arrayContaining` for participants |
| **Snapshots** | **PROHIBITED** — `toMatchSnapshot()` is never used (D-12) |

**Why no snapshots:** Snapshot files are opaque to reviewers, auto-update with `--update-snapshots`, and make it trivially easy to accept wrong expected values without investigation. This directly conflicts with the anti-patching policy (§4). All assertions in this corpus are explicit, readable, and intentional.

### Vitest Configuration Notes

- **No `@vitest-environment jsdom` annotation** — golden corpus tests are pure SQL/data (no DOM manipulation). Default Node environment applies.
- **Pool:** `forks` with `isolate: true` — each test file runs in its own process (WASM isolation, consistent with existing infrastructure).
- **Import:** Tests import from `FormulasProvider` (not yet implemented). This is by design — the corpus drives TDD of `FormulasProvider.compile()`, `annotateMarks()`, and `annotateAudits()`.

### What the Test Exercises

The full pipeline path:

```
1. FormulasProvider.compile(chipArrangement, viewContext)
     → { sql: string, params: unknown[] }

2. db.exec(sql, params)
     → ResultRow[]

3. annotateMarks(rows, chipArrangement.marks)
     → Map<rowId, string[]>

4. annotateAudits(rows, [...chipArrangement.audits.anomaly, ...chipArrangement.audits.validation])
     → Map<rowId, AuditAnnotation[]>
```

Each step has explicit assertions per case. The corpus gives full coverage of the compile → execute → annotate pipeline.

---

## Section 4 — Anti-Patching Policy (TEST-04)

This policy carries forward the v6.1 Test Harness anti-patching rules (FE-RG-12) and makes them explicit for the Formulas Explorer golden corpus.

### The Rules

**Rule 1: Corpus assertions are immutable.**

Once a test case is added to the corpus and its expected values are committed, those expected values must never be weakened, relaxed, or made more permissive to accommodate a failing implementation. The `expectedSql`, `expectedBindValues`, `expectedResult`, and `expectedAnnotation` fields of a committed test case are fixed until a deliberate spec change (see Rule 5).

**Rule 2: If a test fails, fix the implementation or fix the spec — never weaken the assertion.**

The expected values in the corpus are derived from the compilation pipeline specification (`02-compilation-pipeline.md`). If the actual output disagrees with the expected output:

- **Option A (implementation bug):** The production code (`FormulasProvider`, `annotateMarks`, `annotateAudits`) has a defect. Fix the production code.
- **Option B (spec mistake):** The expected value in the corpus was wrong when it was written. Fix the expected value deliberately, with a clear explanation in the commit message. Update `02-compilation-pipeline.md` if the spec itself was incorrect.

In no case does the assertion get weakened to make a test pass without understanding the root cause.

**Rule 3: Every bug fix adds a corpus case.**

When a bug is found in the compilation pipeline, Marks annotation, or Audits annotation — whether during TDD, code review, or production use — the fix must include a new test case that reproduces the bug. The corpus grows monotonically. No regression is considered fixed until a test case exists that would have caught it.

**Rule 4: CC (Claude Code) must never weaken a corpus assertion to make a test pass.**

This rule is explicit for the AI executor. If a golden test fails during implementation:

1. Diagnose the failure — read the assertion, trace the actual vs. expected output.
2. Find the defect in the production code.
3. Fix the production code so the assertion passes.
4. If the expected value appears wrong (not the code), escalate to the user with a clear explanation. Do not update the expected value unilaterally.

Updating `expectedSql`, `expectedBindValues`, `expectedResult`, or `expectedAnnotation` to match incorrect output — without understanding and documenting the root cause — is prohibited. This is what "never weaken" means in practice: the assertion is the ground truth, not the current implementation.

**Rule 5: Spec changes propagate to corpus.**

If `02-compilation-pipeline.md` is revised (for example: a clause order change, a bind-value protocol revision, a new Marks annotation algorithm), the affected corpus test case expected values are updated deliberately as part of that spec change. This is a spec update, not an anti-patching violation — because the expected value is being made more correct, not less strict.

### Grep-Verifiable Statements

This document contains both "anti-patching" and "never weaken" as required by FE-RG-12 verification checks:

- "anti-patching" appears in: section heading, policy title, FE-RG-12 reference
- "never weaken" appears in: Rule 4 (explicit prohibition), Rule 4 parenthetical explanation

---

## Appendix — Regression Guards

The following guards from `02-compilation-pipeline.md` and `01-three-explorer-spec.md` are directly relevant to the golden-test corpus. Each guard has at least one corpus case that exercises it.

| Guard ID | Guard Statement | Exercised By Cases |
|----------|----------------|--------------------|
| **FE-RG-02** | Bind-value protocol: `(sql_text, [bind_values])` tuples only. No user input string-concatenated into SQL. | Cases 2, 4, 6, 9, 13, 15, 16 — all predicate cases show `?` placeholders and bind arrays |
| **FE-RG-03** | Filters compose by AND only across chips. OR lives inside a single chip's DSL. | Cases 4 (two chips → two AND conjuncts), 12 (three chips → three conjuncts) |
| **FE-RG-04** | Sorts compose lexicographically by chip well position. | Cases 5 (two chips → `folder_l1 ASC, name ASC`), 13 (sort + filter) |
| **FE-RG-05** | Calculations form a dependency DAG. Cycles are compile-time errors with chip-well visualization. | Case 10 (two chips form A↔B cycle → CycleError with participants) |
| **FE-RG-07** | Marks annotation Map.size must equal result rows.length. Marks never remove rows. | Cases 17–22: explicit `expect(marksMap.size).toBe(rows.length)` assertion in every marks case |
| **FE-RG-08** | Audits annotation Map.size must equal result rows.length. Audits never remove rows. | Cases 23–26, 32: explicit `expect(auditsMap.size).toBe(rows.length)` assertion in every audits case |
| **FE-RG-12** | Anti-patching: corpus assertions are immutable; never weaken to make a test pass. | This document §4; grep-verifiable |
| **FE-RG-01** | FormulasProvider never emits GROUP BY. | Cases 7 and 9: GROUP BY comes from `viewContext`, not from `FormulasProvider` |

---

*End of `04-golden-test-plan.md`*
*Version 1.0 — Phase 187, Plan 01*
*Canonical source: `.planning/formulas-explorer-handoff-v2.md` §WA-4*
