---
phase: 46
plan: 03
subsystem: notebook-sync
tags: [sync-02, capture, selection, cross-canvas]
dependency_graph:
  requires:
    - 46-01  # SYNC-01 data version chain
    - 46-02  # SelectionContext in Preview tabs
  provides:
    - SYNC-02 implementation
    - Cross-canvas card loading
  affects:
    - CaptureComponent
    - NotebookContext
tech_stack:
  added: []
  patterns:
    - Selection-driven content loading
    - Auto-save before card switch
key_files:
  created: []
  modified:
    - src/contexts/NotebookContext.tsx
    - src/contexts/notebook.ts
    - src/contexts/notebook/types.ts
    - src/contexts/notebook/cardOperations.ts
    - src/components/notebook/CaptureComponent.tsx
decisions: []
metrics:
  duration_seconds: 340
  completed: 2026-02-10
---

# Phase 46 Plan 03: SYNC-02 Capture Selection Loading Summary

**One-liner:** CaptureComponent now loads card content when user clicks in Preview, with auto-save protection.

## What Was Built

This plan implements SYNC-02: scroll-to-card navigation from Preview to Capture. When a user clicks a card or node in the Preview canvas (NetworkGraph, Timeline), the Capture editor automatically loads and displays that card's content.

### Key Capabilities

1. **loadCard function in NotebookContext** - Queries database for a card by ID or node_id and sets it as activeCard
2. **Selection-driven loading in CaptureComponent** - useEffect that reacts to selection.lastSelectedId changes
3. **Auto-save protection** - Current work is saved before switching to new card (if dirty)
4. **Infinite loop prevention** - Checks if selected card is already loaded before triggering load

## Implementation Details

### Task 1: Add loadCard to NotebookContext

Added `loadCardById` to cardOperations that queries:
```sql
SELECT nc.*, n.name, n.node_type
FROM notebook_cards nc
JOIN nodes n ON nc.node_id = n.id
WHERE (nc.id = ? OR nc.node_id = ?) AND n.deleted_at IS NULL
LIMIT 1
```

This allows looking up cards by either their notebook_cards.id or their node_id, since selection from Preview tabs may use either.

The `loadCard` function in NotebookContext:
- Checks cache first for performance
- Queries database if not cached
- Updates cache with LRU eviction
- Sets activeCard state

### Task 2: Connect CaptureComponent to SelectionContext

Added useEffect with the pattern:
```typescript
useEffect(() => {
  const selectedId = selection.lastSelectedId;
  if (!selectedId) return;

  // Don't reload if already loaded
  if (activeCard?.id === selectedId || activeCard?.nodeId === selectedId) {
    return;
  }

  // Auto-save then load, or just load
  if (isDirty) {
    saveNow().then(() => loadCard(selectedId));
  } else {
    loadCard(selectedId);
  }
}, [selection.lastSelectedId, ...]);
```

## Verification

- `npm run typecheck` passes (no new errors introduced)
- CaptureComponent imports useSelection
- CaptureComponent has useEffect with selection.lastSelectedId dependency
- loadCard function available via useNotebook() hook

## Files Modified

| File | Changes |
|------|---------|
| src/contexts/notebook/cardOperations.ts | Added loadCardById function |
| src/contexts/notebook/types.ts | Added loadCard to NotebookContextType interface |
| src/contexts/notebook.ts | Added loadCardById to CardOperations interface and implementation |
| src/contexts/NotebookContext.tsx | Added loadCard function and export |
| src/components/notebook/CaptureComponent.tsx | Added useSelection import and SYNC-02 useEffect |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | bdb1445f | feat(46-03): add loadCard function to NotebookContext for SYNC-02 |
| 2 | 176c01b8 | feat(46-03): connect CaptureComponent to SelectionContext for SYNC-02 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed duplicate NotebookContextType interfaces**
- **Found during:** Task 1
- **Issue:** Two files defined NotebookContextType: notebook.ts and notebook/types.ts
- **Fix:** Updated both files to include loadCard method
- **Files modified:** src/contexts/notebook.ts, src/contexts/notebook/types.ts
- **Commit:** bdb1445f

**2. [Rule 3 - Blocking] Fixed missing CardOperations.loadCardById**
- **Found during:** Task 1
- **Issue:** CardOperations interface in notebook.ts didn't have loadCardById
- **Fix:** Added loadCardById to both the interface and implementation in notebook.ts
- **Files modified:** src/contexts/notebook.ts
- **Commit:** bdb1445f

## Success Criteria Verification

- [x] loadCard function available in NotebookContext
- [x] CaptureComponent listens to selection.lastSelectedId via useEffect
- [x] Clicking card in Preview loads its content in Capture editor (via loadCard)
- [x] Current work is auto-saved before switching cards (isDirty check)
- [x] No infinite loops between canvases (checked by comparing IDs)
- [x] SYNC-02: User clicks card in Preview and Capture shows it

## Self-Check: PASSED

File existence verified:
- FOUND: src/contexts/NotebookContext.tsx
- FOUND: src/contexts/notebook/cardOperations.ts
- FOUND: src/contexts/notebook/types.ts
- FOUND: src/contexts/notebook.ts
- FOUND: src/components/notebook/CaptureComponent.tsx

Commits verified:
- FOUND: bdb1445f
- FOUND: 176c01b8
