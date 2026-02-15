# Phase 104: SuperGrid MVP Completion

**Phase:** 104
**Status:** READY
**Priority:** P0 (MVP Gate)
**Est. Duration:** ~2 hours
**Milestone:** v7.0 SuperGrid MVP Complete

## Overview

Close the final two gaps blocking SuperGrid MVP declaration per spec Section 11 acceptance criteria.

## Requirements

### DYNAMIC-01: SuperDynamic End-to-End Wiring
**Priority:** P0
**Description:** Wire SuperDynamic drag-and-drop axis repositioning to PAFVProvider so axis changes trigger grid reflow.

**Acceptance Criteria:**
- [ ] SuperDynamic component renders in SuperGrid MiniNav area
- [ ] Dragging x-axis chip to y-axis slot transposes the grid
- [ ] Dragging facet from available list to empty slot assigns it
- [ ] Grid reflows with D3 transition < 500ms after drop
- [ ] Press Escape during drag cancels without state change

**Test File:** `src/test/integration/superdynamic-e2e.test.ts`

### DYNAMIC-02: Dimension Inference Utility
**Priority:** P0
**Description:** Create utility to infer LATCH dimension from facet name for axis assignment.

**Acceptance Criteria:**
- [ ] `inferDimensionFromFacet('created_at')` returns `'time'`
- [ ] `inferDimensionFromFacet('status')` returns `'category'`
- [ ] `inferDimensionFromFacet('folder')` returns `'hierarchy'`
- [ ] `inferDimensionFromFacet('location')` returns `'location'`
- [ ] `inferDimensionFromFacet('name')` returns `'alphabet'`

**Test File:** `src/utils/__tests__/latch-inference.test.ts`

### DYNAMIC-03: Available Facets Discovery
**Priority:** P0
**Description:** Create hook to discover available facets from SQLite schema for SuperDynamic axis options.

**Acceptance Criteria:**
- [ ] Hook queries `pragma_table_info('nodes')` for column names
- [ ] Returns `FacetOption[]` with id, label, description
- [ ] Excludes internal columns (id, content, deleted_at)
- [ ] Formats labels (snake_case → Title Case)

**Test File:** `src/hooks/__tests__/useAvailableFacets.test.ts`

### SIZE-01: Cell Size Persistence Hook
**Priority:** P0
**Description:** Create hook to persist and restore cell sizes to/from SQLite view_state table.

**Acceptance Criteria:**
- [ ] `loadSizes()` reads from view_state table on mount
- [ ] `saveSizes()` writes to view_state table (debounced 500ms)
- [ ] Handles missing table gracefully
- [ ] State survives navigation and browser refresh

**Test File:** `src/hooks/__tests__/useCellSizePersistence.test.ts`

### SIZE-02: SuperSize Persistence Integration
**Priority:** P0
**Description:** Wire useCellSizePersistence hook into SuperSize component.

**Acceptance Criteria:**
- [ ] Initial cell sizes loaded from SQLite on mount
- [ ] Global size factor persists across sessions
- [ ] Resize operations save to SQLite after 500ms debounce
- [ ] Navigate away and return restores exact sizes

**Test File:** `src/components/supergrid/__tests__/SuperSize.persistence.test.ts`

### VERIFY-01: Tier 2 State Integration Tests
**Priority:** P1
**Description:** Add integration tests verifying Tier 2 view state persistence across LATCH family transitions.

**Acceptance Criteria:**
- [ ] Axis assignments persist Grid → List → Grid
- [ ] Header collapse state persists across transitions
- [ ] Custom sort order persists across transitions
- [ ] lastActiveView restores correct view on family return

**Test File:** `src/test/integration/view-transitions.test.ts`

## Dependencies

- Phase 103 (Console Cleanup) ✅ Complete
- Existing SuperDynamic.tsx component
- Existing SuperSize.tsx component
- Existing usePAFV hook
- SQLite view_state table (verify exists)

## Success Metrics

Phase 104 is complete when:
1. All DYNAMIC-* requirements pass tests
2. All SIZE-* requirements pass tests
3. `npm run check:quick` passes (zero errors)
4. Manual verification: drag axis, resize column, navigate, return → state preserved

## Files to Create

| File | Purpose |
|------|---------|
| `src/utils/latch-inference.ts` | DYNAMIC-02: Dimension inference |
| `src/hooks/useAvailableFacets.ts` | DYNAMIC-03: Facet discovery |
| `src/hooks/useCellSizePersistence.ts` | SIZE-01: Size persistence |
| `src/test/integration/superdynamic-e2e.test.ts` | DYNAMIC-01: E2E tests |
| `src/test/integration/view-transitions.test.ts` | VERIFY-01: Tier 2 tests |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/supergrid/SuperGrid.tsx` | Wire SuperDynamic, add reflow animation |
| `src/components/supergrid/SuperGrid.css` | Add reflow animation styles |
| `src/components/supergrid/SuperSize.tsx` | Wire persistence hook |

## Rollback Plan

All changes are additive. Rollback by:
1. Remove SuperDynamic from SuperGrid render
2. Remove persistence hook from SuperSize
3. New utility files can be deleted without impact
