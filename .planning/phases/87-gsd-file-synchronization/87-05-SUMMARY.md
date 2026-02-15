---
phase: 87
plan: 05
subsystem: gsd-file-sync
tags: [conflict-detection, conflict-resolution, websocket, modal]
dependency_graph:
  requires: ["87-03-gsdFileSyncService", "87-04-useGSDFileSync"]
  provides: ["conflict-detection", "conflict-resolution-modal", "conflict-websocket-messages"]
  affects: ["GSD UI", "file synchronization"]
tech_stack:
  added: []
  patterns: ["conflict-last-write-wins", "optimistic-ui-close"]
key_files:
  created:
    - src/services/gsd/gsdConflictResolver.ts
    - src/components/shell/GSDConflictModal.tsx
  modified:
    - src/services/gsd/gsdFileSyncService.ts
    - src/services/gsd/index.ts
    - src/hooks/useGSDFileSync.ts
    - src/components/shell/index.ts
decisions:
  - id: CONFLICT-01
    summary: "Conflict detection compares file vs last synced state (not live UI)"
  - id: CONFLICT-02
    summary: "Structural changes (task count) treated as special conflict type"
  - id: CONFLICT-03
    summary: "Modal closes optimistically on resolution, confirmed by WebSocket response"
metrics:
  duration: "4m 24s"
  completed: "2026-02-15"
---

# Phase 87 Plan 05: Conflict Detection & Resolution Summary

Conflict detection and resolution UI for concurrent GSD file edits with WebSocket integration.

## One-liner

When Claude Code modifies PLAN.md while user has pending UI changes, modal shows task diffs and lets user choose file or UI version.

## Commits

| Commit | Description | Files |
|--------|-------------|-------|
| d7dad90f | Add conflict detection service | gsdConflictResolver.ts, index.ts |
| 942427f8 | Add conflict modal with WebSocket wiring | GSDConflictModal.tsx, useGSDFileSync.ts, index.ts |
| dcbdef28 | Integrate detection into sync service | gsdFileSyncService.ts |

## Key Implementation Details

### gsdConflictResolver.ts

**Types:**
- `TaskDiff`: Per-task difference (taskIndex, taskName, field, fileValue, uiValue)
- `ConflictData`: Complete conflict (planPath, fileVersion, uiVersion, timestamp, diffs)
- `ConflictResolution`: 'keep_file' | 'keep_ui' | 'cancel'

**Functions:**
- `detectConflict(fileVersion, uiVersion)`: Returns ConflictData if task statuses differ
- `applyResolution(conflict, resolution)`: Returns ParsedPlanFile based on choice
- `formatConflictSummary(conflict)`: Human-readable diff description

### GSDConflictModal.tsx

- Theme-aware (NeXTSTEP/Modern) modal UI
- Shows plan path and diff count
- Lists conflicting tasks with file vs UI status values
- Warning banner for structural changes (task count mismatch)
- Three buttons: Cancel, Keep File Version, Keep My Changes

### useGSDFileSync.ts Changes

**New State:**
- `conflict: ConflictData | null`
- `isConflictModalOpen: boolean`

**New Message Types:**
- `gsd_conflict`: Server detected conflict, opens modal
- `gsd_conflict_resolved`: Server confirmed resolution, updates cache

**New Callback:**
- `resolveConflict(resolution)`: Sends gsd_resolve_conflict to server

### gsdFileSyncService.ts Changes

**New State:**
- `lastSyncedState = Map<string, ParsedPlanFile>()` for tracking per-plan state

**New Methods:**
- `handleFileChange()`: Detect conflicts before broadcasting file updates
- `handleConflictResolution()`: Apply resolution and write back if keeping UI
- `updateSyncedState()` / `getSyncedState()`: State accessors

**New Message Handler:**
- `gsd_resolve_conflict` case in switch

## Verification Checklist

- [x] detectConflict identifies task status differences
- [x] GSDConflictModal displays diff list with file vs UI values
- [x] Resolution buttons trigger correct actions
- [x] useGSDFileSync handles 'gsd_conflict' messages and opens modal
- [x] useGSDFileSync exposes resolveConflict callback
- [x] Sync service tracks last synced state per plan
- [x] Conflict resolution writes back when keeping UI version
- [x] `npm run typecheck` passes

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] FOUND: src/services/gsd/gsdConflictResolver.ts
- [x] FOUND: src/components/shell/GSDConflictModal.tsx
- [x] FOUND: d7dad90f (Task 1 commit)
- [x] FOUND: 942427f8 (Task 2 commit)
- [x] FOUND: dcbdef28 (Task 3 commit)
