---
phase: 44-keyboard-shortcuts-navigation
plan: 01
subsystem: ui
tags: [keyboard-shortcuts, shortcut-registry, view-switching, undo-redo]

# Dependency graph
requires:
  - phase: 04-providers
    provides: "ViewType union type, MutationManager undo/redo"
  - phase: 07-views
    provides: "ViewManager.switchTo(), viewFactory"
provides:
  - "ShortcutRegistry class with centralized keyboard handler management"
  - "Cmd+1-9 view switching shortcuts"
  - "Undo/redo via registry (replacing ad-hoc keydown listeners)"
  - "window.__isometry.shortcuts for help overlay (Plan 02)"
affects: [44-02-help-overlay]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Centralized keyboard shortcut registry with single keydown listener"]

key-files:
  created:
    - src/shortcuts/ShortcutRegistry.ts
    - src/shortcuts/index.ts
    - tests/shortcuts/ShortcutRegistry.test.ts
  modified:
    - src/main.ts

key-decisions:
  - "ShortcutRegistry uses single keydown listener with input field guard — eliminates duplicated guard logic across handlers"
  - "Cmd modifier maps to metaKey on Mac and ctrlKey on non-Mac — consistent cross-platform behavior"
  - "AuditOverlay Shift+A shortcut left as-is — it manages its own lifecycle and migrating would add unnecessary coupling"

patterns-established:
  - "ShortcutRegistry pattern: register(shortcut, handler, meta) for all keyboard shortcuts"
  - "Plain key shortcuts (e.g., '?') require no modifier and reject events with any modifier pressed"

requirements-completed: [KEYS-04, KEYS-01]

# Metrics
duration: 5min
completed: 2026-03-07
---

# Phase 44 Plan 01: ShortcutRegistry Summary

**Centralized keyboard shortcut registry with Cmd+1-9 view switching and undo/redo via single keydown listener with built-in input field guard**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-07T19:39:39Z
- **Completed:** 2026-03-07T19:45:13Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created ShortcutRegistry class with register/unregister/getAll/destroy API and built-in input field guard
- Registered Cmd+1-9 for view switching across all 9 views (list, grid, kanban, calendar, timeline, gallery, network, tree, supergrid)
- Registered Cmd+Z/Cmd+Shift+Z for undo/redo through ShortcutRegistry
- Exposed shortcuts on window.__isometry for help overlay (Plan 02) and DevTools inspection

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ShortcutRegistry with tests (TDD)** - `c41a1929` (feat)
2. **Task 2: Wire ShortcutRegistry in main.ts with Cmd+1-9 and undo/redo** - `e451ded7` (feat)

_Note: Task 1 followed TDD (RED -> GREEN) with all 23 tests passing._

## Files Created/Modified
- `src/shortcuts/ShortcutRegistry.ts` - Centralized keyboard shortcut registry with platform-aware modifier handling
- `src/shortcuts/index.ts` - Barrel export for ShortcutRegistry and ShortcutEntry type
- `tests/shortcuts/ShortcutRegistry.test.ts` - 23 unit tests covering registration, dispatch, input guard, plain keys
- `src/main.ts` - Import ShortcutRegistry, register all shortcuts, expose on window.__isometry

## Decisions Made
- ShortcutRegistry uses a single document keydown listener with built-in input field guard (INPUT, TEXTAREA, contentEditable) to prevent duplicated guard logic
- Cmd modifier maps to metaKey on Mac and ctrlKey on non-Mac for consistent cross-platform behavior
- AuditOverlay Shift+A shortcut not migrated — it owns its own keydown listener and lifecycle, migrating would add coupling
- setupMutationShortcuts not called in main.ts — undo/redo handled entirely by ShortcutRegistry

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed biome formatting issues**
- **Found during:** Task 2 verification
- **Issue:** Biome flagged platform detection line wrapping and barrel export sort order
- **Fix:** Collapsed multi-line platform detection to single line; reordered exports (type before value)
- **Files modified:** src/shortcuts/ShortcutRegistry.ts, src/shortcuts/index.ts
- **Verification:** `npx biome check src/shortcuts/` exits clean
- **Committed in:** e451ded7 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking - formatting)
**Impact on plan:** Minor formatting fix required by Biome linter. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in main.ts (ViewManagerConfig missing `filter` from Phase 43) and JSONParser.ts — both unrelated to this plan's changes, not fixed per scope boundary rules

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ShortcutRegistry is accessible via `window.__isometry.shortcuts` for Plan 02 (help overlay)
- `getAll()` returns full list of registered shortcuts with category/description for rendering
- Ready for Plan 02 to build `?` key help overlay displaying all registered shortcuts

---
*Phase: 44-keyboard-shortcuts-navigation*
*Completed: 2026-03-07*
