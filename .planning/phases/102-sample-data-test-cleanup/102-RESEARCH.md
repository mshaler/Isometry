# Phase 102: Sample Data & Test Cleanup - Research

**Researched:** 2026-02-15
**Domain:** Sample data cleanup, test fixture maintenance, schema-on-read patterns
**Confidence:** HIGH

## Summary

Phase 102 removes hardcoded LATCH filter values from sample data and test fixtures now that Phase 101 has made the UI fully dynamic. The goal is to eliminate the disconnect between "discovery-driven UI" (Phase 101) and "preset values in fixtures" (current state). This phase ensures sample data reflects real-world schema-on-read imports where columns like `status` and `priority` may not exist or may have arbitrary values.

The research reveals three key insights:
1. **FACETS_SEED_SQL** currently seeds status/priority facets, but these should be app-specific (not universal)
2. **SAMPLE_NOTES** hardcodes priority values 0-5, contradicting the dynamic discovery philosophy
3. **TEST_FACETS** hardcodes status options list, creating brittle test assumptions about data shape

**Primary recommendation:** Remove hardcoded domain-specific facets and values from sample data. Keep only universal facets (folder, tags, created, modified, name). Let test fixtures use realistic "missing column" scenarios to verify schema-on-read resilience.

## User Constraints

IMPORTANT: No CONTEXT.md exists for this phase. All decisions are Claude's discretion.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sql.js | FTS5 build | SQLite in browser | Already used for all data operations |
| TypeScript | 5.x | Type safety | Project standard |
| Vitest | Latest | Test runner | Project standard for all tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | - | Simple string manipulation | Cleanup is primarily editing, not new dependencies |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual edits | AST parsing tools | Overkill for small, focused cleanup task |

**Installation:**
No new packages required. All work uses existing infrastructure.

## Architecture Patterns

### Recommended File Structure
```
src/
├── db/
│   └── sample-data.ts          # FACETS_SEED_SQL lives here (remove status/priority)
└── test/
    ├── fixtures.ts              # TEST_FACETS/TEST_NODES live here (make schema-flexible)
    └── examples/
        ├── tdd-patterns.test.ts # Uses loadTestFixtures
        ├── supergrid-*.test.ts  # All use loadTestFixtures
        └── [other test files]
```

### Pattern 1: Universal vs. App-Specific Facets

**What:** Distinguish between facets that apply to ALL data (universal) vs. those specific to certain workflows (app-specific).

**When to use:** When seeding the facets table for new database initialization.

**Example:**
```sql
-- UNIVERSAL facets (always seed these)
INSERT OR IGNORE INTO facets (id, name, facet_type, axis, source_column) VALUES
    ('folder', 'Folder', 'select', 'C', 'folder'),
    ('tags', 'Tags', 'multi_select', 'C', 'tags'),
    ('created', 'Created', 'date', 'T', 'created_at'),
    ('modified', 'Modified', 'date', 'T', 'modified_at'),
    ('due', 'Due Date', 'date', 'T', 'due_at'),
    ('name', 'Name', 'text', 'A', 'name'),
    ('location', 'Location', 'location', 'L', 'location_name');

-- APP-SPECIFIC facets (DO NOT seed, let users create)
-- status: Depends on workflow (not all notes have status)
-- priority: Depends on context (not all data is prioritized)
```

**Rationale:** Phase 100-101 established dynamic discovery. Seeding status/priority assumes all imports will have these columns, contradicting schema-on-read philosophy.

### Pattern 2: Schema-On-Read Test Fixtures

**What:** Test fixtures should include nodes with missing columns to verify resilient handling.

**When to use:** When designing test data to validate discovery and classification logic.

**Example:**
```typescript
export const TEST_NODES: Partial<TestLPGNode>[] = [
  // Node with ALL columns (ideal case)
  {
    id: 'fixture-node-1',
    name: 'Full Featured Node',
    folder: 'work',
    status: 'in_progress',  // Present
    priority: 5,            // Present
  },
  // Node with MISSING status/priority (realistic import)
  {
    id: 'fixture-node-2',
    name: 'Imported Note',
    folder: 'personal',
    // status: undefined     // Missing - common in real imports
    // priority: undefined   // Missing - common in real imports
  },
  // Node with NULL status/priority (explicit empty)
  {
    id: 'fixture-node-3',
    name: 'Empty Fields Node',
    folder: 'projects',
    status: null,           // Explicit null
    priority: null,         // Explicit null
  },
];
```

**Rationale:** Real-world imports (Apple Notes, Safari bookmarks, Contacts) don't have status/priority. Tests should reflect this.

### Pattern 3: Graceful Column Handling in loadTestFixtures

**What:** The `loadTestFixtures` function should handle missing columns without throwing errors.

**When to use:** When inserting test data that may have incomplete schemas.

**Example:**
```typescript
export async function loadTestFixtures(db: Database, options = {}): Promise<void> {
  const { nodes = true } = options;

  if (nodes) {
    // Try full schema first
    let insertSQL = `
      INSERT OR REPLACE INTO nodes (
        id, name, content, folder, tags, status, priority, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const stmt = db.prepare(insertSQL);
      for (const node of TEST_NODES) {
        stmt.run([
          node.id || '',
          node.name || '',
          node.content || '',
          node.folder || '',
          node.tags || '',
          node.status || null,    // Graceful null fallback
          node.priority || null,  // Graceful null fallback
          node.created_at || new Date().toISOString(),
        ]);
      }
      stmt.free();
    } catch (error) {
      // If columns don't exist, fall back to minimal schema
      console.warn('[Test] Some columns missing, using minimal schema:', error);
      const minimalSQL = `
        INSERT OR REPLACE INTO nodes (id, name, content, folder, created_at)
        VALUES (?, ?, ?, ?, ?)
      `;
      const stmt = db.prepare(minimalSQL);
      for (const node of TEST_NODES) {
        stmt.run([
          node.id || '',
          node.name || '',
          node.content || '',
          node.folder || '',
          node.created_at || new Date().toISOString(),
        ]);
      }
      stmt.free();
    }
  }
}
```

**Rationale:** Tests should be resilient to schema variations, just like the app itself.

### Anti-Patterns to Avoid

- **Hardcoding domain-specific facet options:** Don't put status values like `["active", "completed", "blocked"]` in test fixtures. Use actual database discovery or leave undefined.
- **Assuming columns exist:** Don't write SQL that assumes `status` or `priority` columns exist. Use conditional logic or try-catch.
- **0-5 priority range assumption:** Don't hardcode priority values in specific ranges. Use null, or use realistic ranges that actual data would have (e.g., 1-10, or arbitrary user-defined values).
- **Seeding workflow-specific facets:** Don't seed status/priority facets in FACETS_SEED_SQL. These are user-defined based on their data.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema introspection | Custom column detection | SQLite PRAGMA table_info() | Already handles missing columns |
| Dynamic SQL generation | String concatenation | Parameterized queries | Already used throughout codebase |
| Test data generation | Complex factory patterns | Simple TypeScript arrays | Current approach works, just needs cleanup |

**Key insight:** This phase is about removing code, not adding complexity. The infrastructure for dynamic discovery already exists (Phase 100-101). Now align sample data with that reality.

## Common Pitfalls

### Pitfall 1: Breaking Existing Tests by Removing Too Much
**What goes wrong:** Removing hardcoded values might cause tests that depend on specific data shapes to fail.

**Why it happens:** Tests may have implicit dependencies on status/priority values existing.

**How to avoid:**
1. Audit all test files that import `loadTestFixtures`, `TEST_NODES`, `TEST_FACETS`
2. Search for code that assumes `status` or `priority` fields exist
3. Update tests to be schema-flexible or add explicit status/priority where tests genuinely need them

**Warning signs:**
- Tests failing with "column not found" errors after cleanup
- Tests checking `node.priority > 3` without verifying column exists
- Hardcoded status value checks like `status === 'active'`

### Pitfall 2: Confusing Universal vs. App-Specific Facets
**What goes wrong:** Removing folder/tags/created facets (which ARE universal) along with status/priority (which are NOT).

**Why it happens:** All facets look the same in FACETS_SEED_SQL.

**How to avoid:**
- **Keep:** folder, tags, created_at, modified_at, due_at, name, location_name (schema columns that exist for all nodes)
- **Remove:** status, priority (application-level concepts that don't exist in all imports)

**Warning signs:**
- Tests failing because folder facet is missing
- Discovery hooks returning empty results for created_at

### Pitfall 3: Sample Data Doesn't Match Real Imports
**What goes wrong:** Sample data still looks like manually-curated task management data, not real imports.

**Why it happens:** Current SAMPLE_NOTES were designed to demonstrate features, not reflect realistic ETL.

**How to avoid:**
- Add sample notes that have null status/priority (like imported Apple Notes)
- Add sample bookmarks/contacts that only have folder/tags (no priority)
- Use varied priority values (not just 0-5) or omit entirely

**Warning signs:**
- All sample data has priority 1-5
- All sample data has status "active"/"completed"
- Sample data doesn't reflect "imported from Safari" or "imported from Contacts" scenarios

### Pitfall 4: Test Fixtures Assume Full Schema
**What goes wrong:** `loadTestFixtures` tries to insert into columns that don't exist, causing SQL errors.

**Why it happens:** INSERT statement lists all columns, including optional ones.

**How to avoid:**
- Use try-catch around INSERT statements
- Fall back to minimal schema (id, name, content, folder, created_at) if full schema fails
- Make status/priority optional in TypeScript interfaces (`status?: string`)

**Warning signs:**
- Tests fail with "no such column: status"
- Tests fail in environments where schema.sql hasn't created status column
- loadTestFixtures crashes on partial schemas

## Code Examples

Verified patterns from current codebase:

### Example 1: Current FACETS_SEED_SQL (Before)
```sql
-- From src/db/sample-data.ts (current state)
INSERT OR IGNORE INTO facets (id, name, facet_type, axis, source_column) VALUES
    ('folder', 'Folder', 'select', 'C', 'folder'),
    ('tags', 'Tags', 'multi_select', 'C', 'tags'),
    ('status', 'Status', 'select', 'C', 'status'),      -- REMOVE (app-specific)
    ('priority', 'Priority', 'number', 'H', 'priority'), -- REMOVE (app-specific)
    ('created', 'Created', 'date', 'T', 'created_at'),
    ('modified', 'Modified', 'date', 'T', 'modified_at'),
    ('due', 'Due Date', 'date', 'T', 'due_at'),
    ('name', 'Name', 'text', 'A', 'name'),
    ('location', 'Location', 'location', 'L', 'location_name');
```

### Example 2: Updated FACETS_SEED_SQL (After)
```sql
-- Universal facets only (schema columns that exist for all nodes)
INSERT OR IGNORE INTO facets (id, name, facet_type, axis, source_column) VALUES
    ('folder', 'Folder', 'select', 'C', 'folder'),
    ('tags', 'Tags', 'multi_select', 'C', 'tags'),
    ('created', 'Created', 'date', 'T', 'created_at'),
    ('modified', 'Modified', 'date', 'T', 'modified_at'),
    ('due', 'Due Date', 'date', 'T', 'due_at'),
    ('name', 'Name', 'text', 'A', 'name'),
    ('location', 'Location', 'location', 'L', 'location_name');
```

### Example 3: Current SAMPLE_NOTES (Before)
```typescript
// From src/db/sample-data.ts (current state)
const SAMPLE_NOTES: SampleNote[] = [
  {
    id: 'n001',
    name: 'Q1 Planning Meeting Notes',
    folder: 'Work',
    tags: ['meetings', 'planning'],
    priority: 4,  // HARDCODED 0-5 range
    createdDaysAgo: 5
  },
  // ... all have priority 0-5
];
```

### Example 4: Updated SAMPLE_NOTES (After)
```typescript
// Reflects realistic schema-on-read imports
const SAMPLE_NOTES: SampleNote[] = [
  // Imported from Apple Notes (no priority/status)
  {
    id: 'n001',
    name: 'Q1 Planning Meeting Notes',
    folder: 'Work',
    tags: ['meetings', 'planning'],
    priority: null,  // Realistic: imported notes lack priority
    createdDaysAgo: 5
  },
  // User-created note (has priority)
  {
    id: 'n002',
    name: 'Product Roadmap Draft',
    folder: 'Work',
    tags: ['planning', 'draft'],
    priority: 8,     // Dynamic: user set this, not constrained to 0-5
    createdDaysAgo: 12
  },
  // Imported bookmark (no priority)
  {
    id: 'b001',
    name: 'React Documentation',
    folder: 'Development',
    tags: ['react', 'documentation'],
    priority: null,  // Realistic: bookmarks don't have priority
    createdDaysAgo: 10
  },
];
```

### Example 5: Current TEST_FACETS (Before)
```typescript
// From src/test/fixtures.ts (current state)
export const TEST_FACETS: Partial<TestLPGFacet>[] = [
  {
    id: 'test-facet-status',
    name: 'Status',
    facet_type: 'select',
    axis: 'C',
    source_column: 'status',
    options: '["active", "in_progress", "completed", "blocked", "cancelled"]', // HARDCODED
  },
  {
    id: 'test-facet-priority',
    name: 'Priority',
    facet_type: 'range',
    axis: 'H',
    source_column: 'priority',
    options: '{"min": 1, "max": 5, "step": 1}',  // HARDCODED range
  },
];
```

### Example 6: Updated TEST_FACETS (After)
```typescript
// App-agnostic test facets (no hardcoded domain values)
export const TEST_FACETS: Partial<TestLPGFacet>[] = [
  {
    id: 'test-facet-folder',
    name: 'Folder',
    facet_type: 'select',
    axis: 'C',
    source_column: 'folder',
    // No options - discovered dynamically from actual data
  },
  {
    id: 'test-facet-priority',
    name: 'Priority',
    facet_type: 'range',
    axis: 'H',
    source_column: 'priority',
    // No options - range discovered via MIN/MAX query (Phase 101)
  },
  // Status facet removed entirely or made optional
];
```

### Example 7: Graceful loadTestFixtures (After)
```typescript
// From src/test/fixtures.ts (updated pattern)
export async function loadTestFixtures(db: Database, options = {}): Promise<void> {
  const { nodes = true, facets = true } = options;

  if (nodes) {
    // Use try-catch to handle missing columns gracefully
    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO nodes (
          id, name, content, folder, tags, status, priority, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const node of TEST_NODES) {
        stmt.run([
          node.id || '',
          node.name || '',
          node.content || '',
          node.folder || '',
          node.tags || '',
          node.status || null,    // Graceful null for missing column
          node.priority || null,  // Graceful null for missing column
          node.created_at || new Date().toISOString(),
        ]);
      }
      stmt.free();
    } catch (error) {
      // CLASSIFY-03: Missing columns return gracefully
      console.warn('[Test] Some columns missing, using minimal schema');
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO nodes (id, name, content, folder, tags, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const node of TEST_NODES) {
        stmt.run([
          node.id || '',
          node.name || '',
          node.content || '',
          node.folder || '',
          node.tags || '',
          node.created_at || new Date().toISOString(),
        ]);
      }
      stmt.free();
    }
  }

  if (facets) {
    // Only seed universal facets in tests
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO facets (
        id, name, facet_type, axis, source_column, options, icon, color, enabled, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const facet of TEST_FACETS) {
      stmt.run([
        facet.id || '',
        facet.name || '',
        facet.facet_type || 'text',
        facet.axis || 'C',
        facet.source_column || '',
        facet.options || null,  // Null, not hardcoded list
        facet.icon || null,
        facet.color || null,
        facet.enabled ? 1 : 0,
        facet.sort_order || 0,
      ]);
    }
    stmt.free();
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded status/priority in sample data | Dynamic discovery from database | Phase 100-101 | UI no longer needs preset values |
| FACETS_SEED_SQL includes all possible facets | Seed only universal facets | Phase 102 | Reflects schema-on-read reality |
| Test fixtures assume full schema | Try-catch with fallback to minimal schema | Phase 102 | Tests work with partial schemas |
| Priority always 0-5 range | Null or user-defined values | Phase 102 | Matches real-world import data |

**Deprecated/outdated:**
- **Hardcoded status options lists:** Phase 101 made status dropdown dynamic via `useStatusValues()`. Sample data shouldn't contradict this.
- **Priority range 0-5 assumption:** Phase 101 discovers priority range via MIN/MAX query. Sample data shouldn't preset this range.
- **Seeding status/priority facets:** These are workflow-specific, not universal. Let users create them if needed.

## Open Questions

1. **Should we keep ANY sample nodes with status/priority?**
   - What we know: Phase 101 made UI dynamic, so hardcoded values aren't needed for UI to work
   - What's unclear: Do we want sample data to demonstrate "here's what status/priority look like" or demonstrate "realistic imports often lack these"?
   - Recommendation: Mix both. Include 2-3 nodes with status/priority (demonstrating the feature), but majority without (demonstrating realistic imports). Update SAMPLE-02 requirement to reflect this.

2. **Should TEST_FACETS include status at all?**
   - What we know: Status is app-specific, not universal
   - What's unclear: Do tests need to verify status facet behavior?
   - Recommendation: Keep ONE status facet in TEST_FACETS for tests that specifically verify status handling, but remove hardcoded options list. Let tests discover actual status values from TEST_NODES.

3. **How should loadTestFixtures handle cards table vs. nodes table?**
   - What we know: Schema.sql has both cards and nodes tables (cards is new Phase 84 model, nodes is legacy)
   - What's unclear: Should test fixtures populate both? Only nodes? Only cards?
   - Recommendation: Populate nodes table only for now (legacy support). Phase 84 migration will handle cards table separately. Update TEST-03 requirement to specify "nodes table" explicitly.

## Sources

### Primary (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/src/db/sample-data.ts` - Current FACETS_SEED_SQL and SAMPLE_NOTES implementation
- `/Users/mshaler/Developer/Projects/Isometry/src/test/fixtures.ts` - Current TEST_FACETS, TEST_NODES, loadTestFixtures implementation
- `/Users/mshaler/Developer/Projects/Isometry/.planning/REQUIREMENTS.md` - Requirements SAMPLE-01 to SAMPLE-03, TEST-01 to TEST-03
- `/Users/mshaler/Developer/Projects/Isometry/.planning/STATE.md` - Phase 100-101 completion status and decisions

### Secondary (MEDIUM confidence)
- `/Users/mshaler/Developer/Projects/Isometry/src/db/SQLiteProvider.tsx` - Usage of FACETS_SEED_SQL in database initialization
- `/Users/mshaler/Developer/Projects/Isometry/src/test/examples/*.test.ts` - Test files that use loadTestFixtures
- `/Users/mshaler/Developer/Projects/Isometry/.planning/phases/101-ui-integration/101-01-SUMMARY.md` - Phase 101 implementation details

### Tertiary (LOW confidence)
- None required. All findings based on direct codebase analysis.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, uses existing sql.js + TypeScript + Vitest
- Architecture: HIGH - Clear separation of universal vs. app-specific facets based on Phase 100-101 patterns
- Pitfalls: HIGH - Identified specific failure modes from codebase analysis (missing columns, test dependencies)

**Research date:** 2026-02-15
**Valid until:** 90 days (stable domain - cleanup work, not fast-moving technology)

## Implementation Strategy

### Files to Modify

1. **src/db/sample-data.ts** (SAMPLE-01, SAMPLE-02, SAMPLE-03)
   - Remove status/priority from FACETS_SEED_SQL (lines 208-209)
   - Update SAMPLE_NOTES to use null or varied priority values (lines 13-52)
   - Add mix of nodes with/without status/priority to reflect realistic imports

2. **src/test/fixtures.ts** (TEST-01, TEST-02, TEST-03)
   - Remove hardcoded options from TEST_FACETS status facet (line 308) or remove entirely
   - Update TEST_NODES to include nodes with missing status/priority (lines 70-200)
   - Add try-catch to loadTestFixtures for graceful column handling (lines 431-552)

### Testing Strategy

1. **Verify FACETS_SEED_SQL changes:**
   ```bash
   # Should only seed 7 universal facets, not 9
   grep "INSERT OR IGNORE INTO facets" src/db/sample-data.ts
   ```

2. **Verify SAMPLE_NOTES changes:**
   ```bash
   # Should find nodes with priority: null
   grep "priority: null" src/db/sample-data.ts
   ```

3. **Verify TEST_FACETS changes:**
   ```bash
   # Should NOT find hardcoded status options
   grep '"active", "in_progress"' src/test/fixtures.ts
   # Should fail (not found)
   ```

4. **Run existing tests to catch regressions:**
   ```bash
   npm run test -- src/test/examples/
   npm run typecheck
   ```

### Success Criteria

- [ ] FACETS_SEED_SQL seeds only 7 universal facets (removed status/priority)
- [ ] SAMPLE_NOTES includes mix of nodes with/without priority (no longer hardcoded 0-5)
- [ ] SAMPLE_NOTES reflects realistic schema-on-read imports
- [ ] TEST_FACETS status options removed or made placeholder
- [ ] TEST_NODES includes nodes with missing status/priority columns
- [ ] loadTestFixtures handles missing columns gracefully via try-catch
- [ ] All existing tests still pass
- [ ] TypeScript compilation clean

## Next Steps for Planner

1. Break work into 3 atomic tasks:
   - Task 1: Update FACETS_SEED_SQL (remove status/priority facets)
   - Task 2: Update SAMPLE_NOTES (realistic priority values, schema-on-read mix)
   - Task 3: Update TEST_FACETS/TEST_NODES/loadTestFixtures (graceful handling)

2. Each task should:
   - Modify 1-2 files max
   - Include verification grep commands
   - Run `npm run typecheck` after changes
   - Run relevant tests to catch regressions

3. Commit strategy:
   - Commit 1: `refactor(sample-data): remove app-specific facets from seed SQL` (SAMPLE-01)
   - Commit 2: `refactor(sample-data): use realistic priority values reflecting imports` (SAMPLE-02, SAMPLE-03)
   - Commit 3: `refactor(test): make fixtures resilient to missing columns` (TEST-01, TEST-02, TEST-03)

4. Watch for:
   - Tests failing with "column not found" errors
   - UI still working correctly with dynamic discovery
   - Sample data loading successfully on fresh database init
