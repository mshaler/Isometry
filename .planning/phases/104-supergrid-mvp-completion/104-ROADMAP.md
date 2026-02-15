# Phase 104 Roadmap: SuperGrid MVP Completion

**Phase:** 104
**Status:** READY
**Plans:** 3
**Est. Duration:** ~2 hours total

## Phase Overview

Phase 104 closes the SuperGrid MVP by implementing the final two gaps identified in the gap analysis:
1. **SuperDynamic E2E** — Wire drag-and-drop axis repositioning to PAFVProvider
2. **SuperSize Persistence** — Persist cell resize state to SQLite
3. **Tier 2 Verification** — Integration tests for view state persistence

## Plan Sequence

### Plan 104-01: SuperDynamic End-to-End Wiring
**Priority:** P0 (MVP criterion)
**Requirements:** DYNAMIC-01, DYNAMIC-02, DYNAMIC-03
**Est. Duration:** ~45 minutes

**Scope:**
- Create dimension inference utility (`latch-inference.ts`)
- Create available facets discovery hook (`useAvailableFacets.ts`)
- Wire SuperDynamic into SuperGrid layout
- Add axis change handler bridging to usePAFV
- Add grid reflow animation on axis change

**Key Files:**
- `src/utils/latch-inference.ts` (new)
- `src/hooks/useAvailableFacets.ts` (new)
- `src/components/supergrid/SuperGrid.tsx` (modify)
- `src/components/supergrid/SuperGrid.css` (modify)

**Implementation Notes:**
```typescript
// In SuperGrid.tsx, add:
import { SuperDynamic } from './SuperDynamic';
import { useAvailableFacets } from '@/hooks/useAvailableFacets';
import { inferDimensionFromFacet } from '@/utils/latch-inference';

// Wire axis change to PAFVProvider
const handleAxisChange = useCallback((plane: 'x' | 'y' | 'z', facetId: string) => {
  if (!facetId) {
    removeMapping(plane);
  } else {
    const dimension = inferDimensionFromFacet(facetId);
    setMapping(plane, dimension, facetId);
  }
}, [setMapping, removeMapping]);
```

**Verification:**
```bash
npm run gsd "Test SuperDynamic axis drag transposes grid"
```

### Plan 104-02: SuperSize Persistence
**Priority:** P0 (MVP criterion)
**Requirements:** SIZE-01, SIZE-02
**Est. Duration:** ~30 minutes

**Scope:**
- Create cell size persistence hook with SQLite read/write
- Wire hook into SuperSize component
- Add debounced save on size changes
- Load saved sizes on component mount

**Key Files:**
- `src/hooks/useCellSizePersistence.ts` (new)
- `src/components/supergrid/SuperSize.tsx` (modify)

**Implementation Notes:**
```typescript
// useCellSizePersistence.ts
export function useCellSizePersistence(datasetId = 'default') {
  const { db } = useSQLite();
  
  const loadSizes = useCallback(async () => {
    const result = db.exec(`
      SELECT state_json FROM view_state 
      WHERE id = 'supergrid-cell-sizes' AND family = 'LATCH'
    `);
    return result[0]?.values?.[0]?.[0] 
      ? JSON.parse(result[0].values[0][0] as string) 
      : null;
  }, [db]);

  const saveSizes = useMemo(
    () => debounce((state) => {
      db.run(`
        INSERT OR REPLACE INTO view_state 
        (id, dataset_id, app_id, family, state_json, updated_at)
        VALUES (?, ?, 'isometry', 'LATCH', ?, datetime('now'))
      `, ['supergrid-cell-sizes', datasetId, JSON.stringify(state)]);
    }, 500),
    [db, datasetId]
  );

  return { loadSizes, saveSizes };
}
```

**Verification:**
```bash
npm run gsd "Test SuperSize resize persists after navigation"
```

### Plan 104-03: Tier 2 State Verification
**Priority:** P1 (non-blocking but important)
**Requirements:** VERIFY-01
**Est. Duration:** ~30 minutes

**Scope:**
- Create integration test suite for view transitions
- Test axis assignment persistence across Grid ↔ List
- Test header collapse state persistence
- Test cross-family suspend/restore

**Key Files:**
- `src/test/integration/view-transitions.test.ts` (new)
- `src/test/integration/superdynamic-e2e.test.ts` (new)

**Test Cases:**
```typescript
describe('Tier 2: LATCH Family State', () => {
  it('preserves axis assignments across Grid → List → Grid');
  it('preserves header collapse state across transitions');
  it('suspends LATCH state when entering GRAPH family');
  it('restores LATCH state when returning from GRAPH');
});
```

**Verification:**
```bash
npm run test:run -- --testPathPattern="view-transitions"
```

## GSD Execution Commands

Run each plan with the GSD automation:

```bash
# Plan 104-01: SuperDynamic
npm run gsd "Implement SuperDynamic end-to-end wiring per phase 104-01"

# Plan 104-02: SuperSize Persistence  
npm run gsd "Implement SuperSize persistence per phase 104-02"

# Plan 104-03: Tier 2 Verification
npm run gsd "Add Tier 2 view state integration tests per phase 104-03"

# Final verification
npm run check:quick
npm run test:run -- --testPathPattern="supergrid|view-transitions"
```

## Success Criteria

Phase 104 is complete when:

1. **SuperDynamic functional:**
   - [ ] Drag x-axis to y-axis transposes grid
   - [ ] Drag facet to empty slot assigns it
   - [ ] Escape cancels drag
   - [ ] Reflow animation < 500ms

2. **SuperSize persists:**
   - [ ] Resize column, navigate away, return → size restored
   - [ ] Global size factor persists
   - [ ] Debounced writes (no DB spam)

3. **Tier 2 verified:**
   - [ ] Integration tests pass
   - [ ] Manual verification works

4. **Quality gates pass:**
   - [ ] `npm run check:quick` — zero errors
   - [ ] `npm run test:run` — all tests pass

## Post-Phase Actions

After Phase 104 completes:

1. Update `specs/SuperGrid-Specification.md` status: "Draft" → "v1.0 MVP"
2. Update CLAUDE.md with current SuperGrid state
3. Create GitHub release tag `v7.0-supergrid-mvp`
4. Archive gap analysis document to `.planning/archive/`

## Dependencies

```
Phase 103 (Console Cleanup) ✅ Complete
    ↓
Phase 104 (SuperGrid MVP Completion) ← This roadmap
    ↓
v7.0 SuperGrid MVP COMPLETE
    ↓
Phase 105+ (Post-MVP: SuperTime, SuperCalc formulas, etc.)
```
