---
phase: 87-gsd-file-synchronization
plan: 04
subsystem: gsd-frontend
tags: [hooks, react-query, websocket, optimistic-updates, accessibility]
dependency-graph:
  requires:
    - 87-01 (gsdTypes.ts - ParsedPlanFile, GSDTask, TaskStatus)
    - 87-02 (gsdFileWatcher.ts - GSDFileChangeEvent type)
  provides:
    - useGSDFileSync hook for WebSocket file watching
    - useGSDTaskToggle hook for task status mutations
    - GSDProgressDisplay component for plan progress UI
  affects:
    - Shell tab UI (can now show GSD progress)
    - React Query cache (invalidated on file changes)
tech-stack:
  added:
    - "@tanstack/react-query" useMutation for optimistic updates
  patterns:
    - Optimistic update with rollback context
    - WebSocket message type guards
    - Accessible click-to-toggle with keyboard support
key-files:
  created:
    - src/hooks/useGSDFileSync.ts
    - src/hooks/useGSDTaskToggle.ts
    - src/components/shell/GSDProgressDisplay.tsx
    - src/components/shell/index.ts
  modified:
    - src/hooks/index.ts
decisions:
  - SYNC-01: Use React Query invalidation on gsd_file_update messages (not polling)
  - SYNC-02: Optimistic updates via useMutation onMutate with rollback context
  - SYNC-03: 10-second timeout on plan data requests
  - UI-01: Three-state icons (Circle/Clock/CheckCircle) from lucide-react
  - A11Y-01: role="button" with tabIndex and onKeyDown for task items
  - A11Y-02: aria-label describes current status and next status on click
metrics:
  duration: 3m
  completed: 2026-02-15
---

# Phase 87 Plan 04: React Hooks and Progress Display Summary

React hooks for WebSocket file sync with optimistic task status updates and accessible progress UI.

## One-liner

useGSDFileSync for WebSocket subscription with cache invalidation, useGSDTaskToggle for optimistic mutations, GSDProgressDisplay for progress bar and task list with click-to-toggle.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create GSD sync React hooks | 90cf1fdc | useGSDFileSync.ts, useGSDTaskToggle.ts, index.ts |
| 2 | Create GSD progress display component | 5dbf7b38 | GSDProgressDisplay.tsx, index.ts |

## Technical Approach

### useGSDFileSync Hook

Manages WebSocket lifecycle for GSD file watching:
- Connects to `ws://localhost:3001` (configurable)
- Sends `start_gsd_watch` on open, `stop_gsd_watch` on close
- Handles three message types:
  - `gsd_watch_started`: Sets isWatching state
  - `gsd_file_update`: Invalidates React Query cache
  - `gsd_plan_data`: Updates cache and resolves pending requests
- `requestPlan()` returns Promise with 10-second timeout

### useGSDTaskToggle Hook

Implements optimistic updates with rollback:
- `onMutate`: Cancel queries, snapshot previous, apply optimistic update
- `onError`: Restore previous snapshot
- `onSettled`: Invalidate to sync with server
- `nextTaskStatus()` helper: pending -> in_progress -> complete -> pending

### GSDProgressDisplay Component

Accessible progress UI:
- Progress bar with aria-valuenow
- Task list with role="button", tabIndex, keyboard activation
- aria-label describes both current and next status
- Connection indicator (Live/Paused with icons)
- Loading, error, disconnected states

## Key Patterns Established

```typescript
// Optimistic update with rollback
const mutation = useMutation({
  onMutate: async (variables) => {
    await queryClient.cancelQueries({ queryKey });
    const previous = queryClient.getQueryData(queryKey);
    queryClient.setQueryData(queryKey, optimisticValue);
    return { previous };
  },
  onError: (error, variables, context) => {
    if (context?.previous) {
      queryClient.setQueryData(queryKey, context.previous);
    }
  },
  onSettled: () => {
    void queryClient.invalidateQueries({ queryKey });
  }
});
```

```typescript
// WebSocket message type guard
function isGSDMessage(data: unknown): data is GSDInboundMessage {
  if (typeof data !== 'object' || data === null) return false;
  const msg = data as Record<string, unknown>;
  return msg.type === 'gsd_file_update' || ...;
}
```

## Verification Results

- [x] useGSDFileSync subscribes to WebSocket and invalidates queries on file changes
- [x] useGSDFileSync handles `gsd_file_update` messages (GSDFileChangeEvent from 87-02)
- [x] useGSDTaskToggle performs optimistic updates with rollback
- [x] GSDProgressDisplay shows progress bar and task list
- [x] Clicking task cycles through pending -> in_progress -> complete -> pending
- [x] Live sync indicator shows connection status
- [x] Component is accessible (keyboard navigation, ARIA labels)
- [x] `npm run typecheck` passes (no errors in new files)

## Deviations from Plan

None - plan executed exactly as written.

## Next Steps

- 87-05: Error Handling & Recovery - handle network failures, retry logic, conflict resolution

## Self-Check

- [x] FOUND: src/hooks/useGSDFileSync.ts
- [x] FOUND: src/hooks/useGSDTaskToggle.ts
- [x] FOUND: src/components/shell/GSDProgressDisplay.tsx
- [x] FOUND: src/components/shell/index.ts
- [x] FOUND: 90cf1fdc (Task 1 commit)
- [x] FOUND: 5dbf7b38 (Task 2 commit)

## Self-Check: PASSED
