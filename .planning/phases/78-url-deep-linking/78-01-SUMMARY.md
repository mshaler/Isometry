---
phase: 78-url-deep-linking
plan: 01
subsystem: url-state
tags: [deep-linking, navigation, selection]
dependency_graph:
  requires: [77-01]
  provides: [node-deep-link-hook, scroll-to-node-context]
  affects: [App.tsx, SelectionContext]
tech_stack:
  added: []
  patterns: [url-param-reading, context-registration]
key_files:
  created:
    - src/hooks/ui/useNodeDeepLink.ts
    - src/hooks/ui/__tests__/useNodeDeepLink.test.tsx
  modified:
    - src/App.tsx
    - src/state/SelectionContext.tsx
    - src/hooks/ui/index.ts
decisions:
  - id: DEEPLINK-DEC-01
    title: Keep URL param for shareability
    rationale: Users can copy/paste URLs to share deep links with others
  - id: DEEPLINK-DEC-02
    title: ProcessedRef prevents re-triggering
    rationale: useRef tracks processed nodeId to prevent effect from running multiple times on same nodeId
  - id: DEEPLINK-DEC-03
    title: requestAnimationFrame for scroll timing
    rationale: Small delay ensures view has rendered before scroll attempt
  - id: DEEPLINK-DEC-04
    title: scrollToNode registration pattern
    rationale: Views register their scroll function via context, enabling view-agnostic deep linking
metrics:
  duration_minutes: 6
  completed_at: 2026-02-13T06:29:22Z
---

# Phase 78 Plan 01: Node Deep Links Summary

URL parameter ?nodeId={id} focuses that node on page load with selection and scroll-to-view.

## One-liner

Node deep linking via useNodeDeepLink hook with SelectionContext scroll registration pattern.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create useNodeDeepLink hook | e18bff58 | src/hooks/ui/useNodeDeepLink.ts, src/hooks/ui/index.ts |
| 2 | Add scrollToNode to SelectionContext | b3ea6559 | src/state/SelectionContext.tsx |
| 3 | Wire hook into App.tsx | e81e66d3 | src/App.tsx |
| 4 | Test deep linking | a6d82da9 | src/hooks/ui/__tests__/useNodeDeepLink.test.tsx |

## Implementation Details

### useNodeDeepLink Hook

The hook reads `nodeId` from URL search params, validates the node exists in the database, selects it, and triggers scroll-to-view. Key behaviors:

- **Validation**: Queries `SELECT id FROM nodes WHERE id = ? AND deleted_at IS NULL`
- **Selection**: Uses `select(nodeId)` from SelectionContext
- **Scroll**: Calls `scrollToNode(nodeId)` if registered by the active view
- **URL preservation**: Keeps the `?nodeId=` param for shareability
- **Idempotency**: Uses `processedRef` to prevent re-processing same nodeId

### SelectionContext Enhancement

Added view-agnostic scroll registration:

```typescript
scrollToNode: ScrollToNodeFn | null;
registerScrollToNode: (fn: ScrollToNodeFn) => void;
unregisterScrollToNode: () => void;
```

Views (SuperGrid, Network, etc.) call `registerScrollToNode` on mount and `unregisterScrollToNode` on unmount.

### App.tsx Integration

Added `SelectionProvider` to default and integrated routes (was missing). Created `DeepLinkHandler` wrapper component that invokes `useNodeDeepLink()` inside the proper context hierarchy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing SelectionProvider in default route**
- **Found during:** Task 3
- **Issue:** Default App.tsx route didn't include SelectionProvider, but the hook needs it
- **Fix:** Added SelectionProvider wrapper to default and integrated routes
- **Files modified:** src/App.tsx
- **Commit:** e81e66d3

## Test Coverage

12 tests covering:
- Valid nodeId selection and scroll
- Database verification
- URL param preservation
- Invalid nodeId warning
- Empty result handling
- No nodeId = no action
- Loading state handling
- Duplicate processing prevention
- Database error handling

## Success Criteria

- [x] URL-01 satisfied: Node deep links work via ?nodeId= parameter
- [x] Selection and scroll-to-view function
- [x] All view types supported via SelectionContext registration pattern
- [x] Invalid nodeId shows graceful error (logs warning, doesn't crash)
- [x] Tests passing (12/12)

## Next Steps

Phase 78-02: Filter state serialization to URL (bidirectional LATCH filter URL encoding)

## Self-Check: PASSED

- [x] FOUND: src/hooks/ui/useNodeDeepLink.ts
- [x] FOUND: src/hooks/ui/__tests__/useNodeDeepLink.test.tsx
- [x] FOUND: commit e18bff58
- [x] FOUND: commit b3ea6559
- [x] FOUND: commit e81e66d3
- [x] FOUND: commit a6d82da9
