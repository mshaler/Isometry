# Phase 77 Research: Versioning

## Current State

### Schema
- `version` column exists in `nodes` table (INTEGER DEFAULT 1)
- `syncVersion` and `syncState` defined in types but unused
- CanonicalNode schema includes `version: z.number().int().positive().default(1)`

### Update Paths
All update operations in the codebase that need version increment:

1. **useDatabaseService.ts:100-102** - `updateNodePosition()`
   - Updates `grid_x`, `grid_y`, `modified_at`
   - Does NOT increment version

2. **db/operations.ts** - `execute()` function
   - Generic SQL executor
   - Would need to intercept UPDATE queries or use triggers

3. **Individual update calls** - scattered across hooks
   - Property updates
   - Status changes
   - Content edits

### Options Analysis

#### Option A: SQL Trigger (Recommended)
```sql
CREATE TRIGGER increment_version_on_update
AFTER UPDATE ON nodes
FOR EACH ROW
WHEN NEW.version = OLD.version  -- Only if not manually set
BEGIN
    UPDATE nodes SET version = OLD.version + 1 WHERE id = NEW.id;
END;
```

Pros:
- Automatic, no code changes needed per update call
- Can't be forgotten
- Works for all update paths including direct SQL

Cons:
- Trigger runs even for position-only updates (acceptable?)
- sql.js trigger syntax needs verification

#### Option B: Explicit version increment in all update functions
```typescript
db.run(`UPDATE nodes SET ..., version = version + 1 WHERE id = ?`, [id]);
```

Pros:
- Explicit control over when version increments
- Could exclude position-only updates

Cons:
- Easy to forget in new code
- Requires auditing all update paths

### Recommendation

**Use SQL Trigger (Option A)** because:
1. Version should increment on ANY data change (including position)
2. Guarantees consistency across all update paths
3. Future-proof for new update operations

### UI Display Requirements

Version display locations:
1. Node detail panel (if exists)
2. Data Inspector query results (already includes `version` column)
3. Card tooltip on hover (optional)

Minimal implementation: Just ensure version increments; UI display is bonus.

## Implementation Plan

### Plan 77-01: Version Increment Trigger
1. Add UPDATE trigger to schema.sql
2. Test trigger fires on various update types
3. Verify version increment in integration test

### Plan 77-02: Version Display (Optional)
1. Show version in Data Inspector (already there via SELECT *)
2. Add version badge to card hover tooltip
3. Show "Modified X times" indicator

## Files to Modify

- `src/db/schema.sql` - Add trigger
- `src/db/init.ts` - Ensure trigger created on init
- `src/hooks/database/useDatabaseService.ts` - Verify no conflicts with trigger
- Tests for version increment

## Risks

- sql.js trigger compatibility (should work, but verify)
- Performance impact of trigger (negligible for single-row updates)
- Position updates incrementing version (acceptable tradeoff)
