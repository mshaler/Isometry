---
phase: 96-block-types-slash-commands
plan: 03
subsystem: ui
tags: [tiptap, react, typescript, css, editor, blocks]

# Dependency graph
requires:
  - phase: 96-02
    provides: CalloutExtension pattern for custom TipTap blocks
provides:
  - ToggleExtension for collapsible content sections
  - BookmarkExtension for URL preview blocks
  - /toggle and /bookmark slash commands
  - Theme-aware CSS styling for both block types
affects: [97-inline-properties, 98-isometry-embeds]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Custom TipTap Node extensions with ReactNodeViewRenderer"
    - "NodeViewWrapper + NodeViewContent for editable block content"
    - "Local state (useState) synced to node attributes via updateAttributes"
    - "Module augmentation for TypeScript command typing"

key-files:
  created:
    - src/components/notebook/editor/extensions/ToggleExtension.ts
    - src/components/notebook/editor/nodes/ToggleNode.tsx
    - src/components/notebook/editor/extensions/BookmarkExtension.ts
    - src/components/notebook/editor/nodes/BookmarkNode.tsx
  modified:
    - src/components/notebook/editor/extensions/index.ts
    - src/hooks/ui/useTipTapEditor.ts
    - src/components/notebook/editor/extensions/slash-commands.ts
    - src/index.css

key-decisions:
  - "TOGGLE-01: Local useState for collapse state to avoid re-render cascade from attribute changes"
  - "TOGGLE-02: Start expanded (open: true) for better UX when inserting new toggle"
  - "BOOKMARK-01: atom: true for non-editable inline content (URL is the content)"
  - "BOOKMARK-02: Google favicon service for simple icon display without server-side unfurling"
  - "BOOKMARK-03: Auto-add https:// if user forgets protocol"

patterns-established:
  - "Block extensions: Extension.ts + Node.tsx file pair pattern"
  - "CSS styling: .block__element BEM-style class naming"
  - "Extension wiring: export from index.ts, import in useTipTapEditor.ts"

# Metrics
duration: 6min
completed: 2026-02-15
---

# Phase 96-03: Additional Block Types Summary

**Toggle (collapsible sections) and Bookmark (URL preview) TipTap block extensions with slash command integration**

## Performance

- **Duration:** 6m 17s
- **Started:** 2026-02-15T01:36:59Z
- **Completed:** 2026-02-15T01:43:16Z
- **Tasks:** 6
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments
- Created ToggleExtension with collapsible header, editable title, and content area
- Created BookmarkExtension with URL input, favicon display, and edit mode
- Added /toggle and /bookmark slash commands for easy block insertion
- Theme-aware CSS styling matching existing callout block aesthetic

## Task Commits

Each task was committed atomically:

1. **Task 1-2: Create ToggleExtension and ToggleNode** - `f106ae30` (feat) [Note: Accidentally included in prior commit]
2. **Task 3-4: Create BookmarkExtension and BookmarkNode** - `b37350e0` (feat)
3. **Task 5: Wire extensions into editor** - `978197c0` (feat)
4. **Task 6: Add CSS styling** - `2081c50e` (feat)

**Supporting fix:** `ff0f4884` (fix: pre-existing typecheck error in SuperGridScrollTest)

## Files Created/Modified
- `src/components/notebook/editor/extensions/ToggleExtension.ts` - TipTap Node extension for collapsible toggles
- `src/components/notebook/editor/nodes/ToggleNode.tsx` - React component with expand/collapse behavior
- `src/components/notebook/editor/extensions/BookmarkExtension.ts` - TipTap Node extension for URL bookmarks
- `src/components/notebook/editor/nodes/BookmarkNode.tsx` - React component with URL input and display
- `src/components/notebook/editor/extensions/index.ts` - Added exports for new extensions
- `src/hooks/ui/useTipTapEditor.ts` - Imported and registered extensions
- `src/components/notebook/editor/extensions/slash-commands.ts` - Added toggle and bookmark commands
- `src/index.css` - Added 177 lines of theme-aware block styling

## Decisions Made
- **TOGGLE-01:** Use local useState for collapse state instead of relying solely on node attributes. This prevents re-render cascade when user rapidly toggles open/closed.
- **TOGGLE-02:** New toggles start expanded (open: true) so user immediately sees where to type content.
- **BOOKMARK-01:** Set atom: true since bookmark content is the URL itself, not editable inline content.
- **BOOKMARK-02:** Use Google favicon service (`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`) for simple icon display. Server-side metadata unfurling deferred to future enhancement.
- **BOOKMARK-03:** Auto-add `https://` prefix if user pastes URL without protocol.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing typecheck error**
- **Found during:** Task 1-2 (commit attempt)
- **Issue:** Variable name mismatch in SuperGridScrollTest.tsx (`effectiveHeaderWidth` vs `_effectiveHeaderWidth`)
- **Fix:** Renamed declarations to match usage with underscore prefix
- **Files modified:** src/components/supergrid/SuperGridScrollTest.tsx
- **Verification:** `npm run check:types` passes
- **Committed in:** ff0f4884

**2. [Rule 3 - Blocking] Toggle files committed in wrong commit**
- **Found during:** Task 1-2 commit verification
- **Issue:** ToggleExtension.ts and ToggleNode.tsx were accidentally staged and committed in a prior commit (f106ae30) from Phase 92
- **Fix:** Continued with plan execution - files are in repo, just with different commit message
- **Impact:** None - files exist and work correctly

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary to proceed. No scope creep.

## Issues Encountered
- Pre-commit hook (lefthook) failing due to TypeScript errors in unrelated file required fixing before plan commits could proceed

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Toggle and Bookmark blocks complete and functional
- Phase 96 (Block Types & Slash Commands) now complete (3/3 plans)
- Ready to proceed to Phase 97 (Inline Properties)

---
*Phase: 96-block-types-slash-commands*
*Completed: 2026-02-15*

## Self-Check: PASSED

All files verified:
- ToggleExtension.ts (1540 bytes)
- ToggleNode.tsx (1114 bytes)
- BookmarkExtension.ts (1677 bytes)
- BookmarkNode.tsx (2761 bytes)

All commits verified:
- b37350e0, 978197c0, 2081c50e
