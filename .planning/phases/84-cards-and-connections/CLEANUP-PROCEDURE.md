# Phase 84 Cleanup Procedure

## Current State

After Phase 84 completion (2026-02-14):

- **Active tables:** `cards`, `connections`, `card_properties`, `cards_fts`
- **Legacy tables:** `nodes`, `edges`, `node_properties`, `nodes_fts` (kept for compatibility)
- **Backup tables:** `nodes_backup`, `edges_backup` (if migration script ran)
- **Data access:** All hooks, ETL, filter compiler, PAFV projection now use cards table

## Schema Summary

### New Tables (Phase 84)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `cards` | Primary data (replaces nodes) | id, card_type (note/person/event/resource), name, content, LATCH fields |
| `connections` | Relationships (replaces edges) | id, source_id, target_id, via_card_id, label, weight |
| `card_properties` | EAV storage (replaces node_properties) | id, card_id, key, value, value_type |
| `cards_fts` | FTS5 virtual table | name, content, tags, folder |

### Legacy Tables (To Be Dropped)

| Table | Reason to Drop |
|-------|----------------|
| `nodes` | Replaced by `cards` |
| `edges` | Replaced by `connections` |
| `node_properties` | Replaced by `card_properties` |
| `nodes_fts` | Replaced by `cards_fts` |

## Rollback Procedure (if needed)

If issues are discovered after migration, execute these SQL commands:

```sql
-- Step 1: Drop new tables and FTS
DROP TABLE IF EXISTS connections;
DROP TABLE IF EXISTS cards_fts;
DROP TABLE IF EXISTS card_properties;
DROP TABLE IF EXISTS cards;

-- Step 2: Restore from backup (if backups exist)
ALTER TABLE nodes_backup RENAME TO nodes;
ALTER TABLE edges_backup RENAME TO edges;
-- OR if backups don't exist, the original nodes/edges tables remain

-- Step 3: Restore FTS (rebuild from nodes)
INSERT INTO nodes_fts(nodes_fts) VALUES('rebuild');

-- Step 4: Restore node_properties if renamed
ALTER TABLE card_properties RENAME TO node_properties;
```

After SQL rollback, revert code changes using git:
```bash
git revert HEAD~N  # where N = number of Phase 84 commits
```

## Cleanup Procedure (after verification period)

**Timeline:** Execute after 2 weeks of stable operation (target: 2026-02-28)

### Step 1: Verify Current State

```bash
# Run full test suite
npm run test:run

# Verify TypeScript compilation
npm run typecheck

# Start dev server and manually verify
npm run dev
```

### Step 2: Drop Backup Tables

```sql
-- Only if nodes_backup/edges_backup exist
DROP TABLE IF EXISTS nodes_backup;
DROP TABLE IF EXISTS edges_backup;
```

### Step 3: Drop Legacy Tables

```sql
-- Drop legacy tables (order matters for foreign keys)
DROP TABLE IF EXISTS notebook_cards;  -- FK to nodes
DROP TABLE IF EXISTS edges;
DROP TABLE IF EXISTS nodes_fts;  -- Drop FTS before content table
DROP TABLE IF EXISTS node_properties;
DROP TABLE IF EXISTS nodes;
```

Note: `notebook_cards` table references `nodes.id` via FK. Either:
- Update `notebook_cards` to reference `cards.id`, OR
- Drop and recreate with new FK

### Step 4: Remove Deprecated Code

After backup/legacy tables are dropped:

1. Remove `src/types/node.ts` if it exists (deprecated layer)
2. Remove any `rowToNode()` usage
3. Remove `Node` and `Edge` type imports
4. Remove `useLiveNodes` deprecated shim
5. Remove `insertCanonicalNodesLegacy` function

## Verification Checklist

Before dropping backups, verify all scenarios:

- [ ] SuperGrid renders correctly with card data
- [ ] FTS5 search returns correct cards
- [ ] All 4 card types work (note, person, event, resource)
- [ ] Connections with via_card_id display correctly
- [ ] ETL import produces valid cards (test Apple Notes import)
- [ ] Graph traversal (recursive CTE) returns correct results
- [ ] Timeline view works with cards
- [ ] Network graph view works with connections
- [ ] No console errors during normal operation
- [ ] Performance is acceptable (no regression from nodes)

## Test Commands

```bash
# Run all tests
npm run test:run

# Run just cards-related tests
npm run test -- src/db/__tests__/cards-integration.test.ts
npm run test -- src/db/__tests__/cards-migration.test.ts
npm run test -- src/etl/database/__tests__/insertion.test.ts

# Check TypeScript
npm run typecheck

# Full quality check
npm run check
```

## Timeline

| Date | Action |
|------|--------|
| 2026-02-14 | Phase 84 complete, cards table active |
| 2026-02-14 to 2026-02-21 | Monitoring period, keep all tables |
| 2026-02-21 | Run verification checklist |
| 2026-02-28 | Execute cleanup if verified |
| 2026-03-01 | Remove deprecated code |

## Contact

Phase implemented by Claude Code / GSD executor.
See `.planning/phases/84-cards-and-connections/` for full documentation.
