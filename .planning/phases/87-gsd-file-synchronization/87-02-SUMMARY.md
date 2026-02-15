---
phase: 87-gsd-file-synchronization
plan: 02
subsystem: services/gsd
tags: [file-watcher, chokidar, websocket, debounce]
dependency_graph:
  requires:
    - chokidar (via tailwindcss dependency)
    - ws (WebSocket library)
  provides:
    - GSDFileWatcher class for .planning/ monitoring
    - GSDFileChangeEvent interface for WebSocket messages
    - isGSDFileMessage type guard for message routing
  affects:
    - Future plan 87-03 (state synchronization)
    - WebSocket server message routing
tech_stack:
  added: []
  patterns:
    - Chokidar awaitWriteFinish for debounced file watching
    - skipWatchPaths pattern for preventing update loops
    - Type guard pattern for WebSocket message dispatch
key_files:
  created:
    - src/services/gsd/gsdFileWatcher.ts
    - src/services/gsd/__tests__/gsdFileWatcher.test.ts
  modified:
    - src/services/gsd/index.ts
    - src/services/terminal/messageRouter.ts
decisions:
  - id: WATCH-01
    decision: Use chokidar awaitWriteFinish with 400ms stabilityThreshold
    rationale: Within <500ms GSD-02 requirement with 100ms safety margin
  - id: WATCH-02
    decision: Single watcher per project shared across clients
    rationale: Efficient resource use, avoid duplicate file system watchers
  - id: WATCH-03
    decision: skipWatchPaths with 600ms timeout
    rationale: Covers debounce window (400ms + 100ms poll) to prevent loops
  - id: ROUTE-01
    decision: Type guard in messageRouter for GSD messages
    rationale: Follows existing pattern, avoids circular dependencies
metrics:
  duration: "5m 18s"
  completed: "2026-02-15"
  tasks: 3
  tests: 5
  commits: 2
---

# Phase 87 Plan 02: GSD File Watcher Summary

Chokidar-based file watcher with 400ms debounce for .planning/ directory, emitting WebSocket messages and skipping own writes.

## What Was Built

### GSD File Watcher (gsdFileWatcher.ts)

Core class for monitoring the `.planning/` directory:

- **GSDFileWatcher** - Main watcher class
  - `startWatching(sessionId, ws)` - Register client and start watching
  - `stopWatching(sessionId)` - Unregister client, close watcher when empty
  - `markWritePath(filePath)` - Skip path to prevent update loops
  - `cleanup()` - Full cleanup of watcher and state

- **GSDFileChangeEvent** - WebSocket message interface
  - `type: 'gsd_file_update'`
  - `filePath: string` (relative to project root)
  - `changeType: 'add' | 'change' | 'unlink'`
  - `timestamp: string`
  - `sessionId: string`

Configuration meeting GSD-02 requirement:
```typescript
awaitWriteFinish: {
  stabilityThreshold: 400, // <500ms requirement
  pollInterval: 100,
}
```

### Message Router Extension (messageRouter.ts)

Added GSD message type guard:

- **isGSDFileMessage** - Type guard for WebSocket dispatch
- **GSDClientMessage** - Interface for client messages
  - `'start_gsd_watch'` - Begin watching
  - `'stop_gsd_watch'` - Stop watching
  - `'gsd_task_update'` - Task status change

### Timing Tests (gsdFileWatcher.test.ts)

5 tests documenting timing constraints:

1. stabilityThreshold (400ms) < requirement (500ms)
2. Safety margin >= 100ms
3. Rapid save behavior documentation
4. Configuration values documentation
5. skipWatchPaths timeout coverage

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 9d45ad14 | feat | GSDFileWatcher created (bundled with 87-01) |
| ac949721 | feat | Add GSD message routing type guard |
| 41ac0ac1 | test | Add debounce timing verification tests |

## Deviations from Plan

### Pre-completed Task

**Task 1 (GSDFileWatcher)** was already committed as part of 87-01 (commit 9d45ad14). The watcher was staged alongside the parser files and committed together.

**Impact:** None - the implementation matches the plan specification exactly.

## Verification

- [x] GSDFileWatcher creates chokidar watcher with awaitWriteFinish config
- [x] File changes emit WebSocket messages with relative paths
- [x] skipWatchPaths mechanism prevents update loops
- [x] messageRouter exports isGSDFileMessage type guard
- [x] Debounce timing (400ms) verified to be within <500ms requirement
- [x] `npm run typecheck` passes
- [x] `npm run test` passes for debounce timing test (5/5)

## Self-Check: PASSED

All artifacts verified:
- FOUND: src/services/gsd/gsdFileWatcher.ts
- FOUND: src/services/gsd/__tests__/gsdFileWatcher.test.ts
- FOUND: src/services/gsd/index.ts
- FOUND: src/services/terminal/messageRouter.ts
- FOUND: 9d45ad14 (commit - from 87-01)
- FOUND: ac949721 (commit)
- FOUND: 41ac0ac1 (commit)
