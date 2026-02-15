---
phase: 96-block-types-slash-commands
plan: 02
subsystem: ui
tags: [tiptap, react, node-view, callout, slash-commands]

# Dependency graph
requires:
  - phase: 96-01
    provides: heading slash commands foundation
provides:
  - CalloutExtension TipTap node for rich callout blocks
  - CalloutNode React component with type selector
  - /callout slash command in editor
  - Theme-aware callout CSS styling
affects: [96-03, 97-inline-properties]

# Tech tracking
tech-stack:
  added: []
  patterns: [TipTap custom Node with ReactNodeViewRenderer, separate types file to avoid circular deps]

key-files:
  created:
    - src/components/notebook/editor/extensions/CalloutExtension.ts
    - src/components/notebook/editor/extensions/callout-types.ts
    - src/components/notebook/editor/nodes/CalloutNode.tsx
  modified:
    - src/components/notebook/editor/extensions/index.ts
    - src/hooks/ui/useTipTapEditor.ts
    - src/components/notebook/editor/extensions/slash-commands.ts
    - src/index.css

key-decisions:
  - "CALL-01: Extract callout-types.ts to break circular dependency between CalloutExtension.ts and CalloutNode.tsx"
  - "CALL-02: Use Unicode escapes for emojis to avoid encoding issues in source files"
  - "CALL-03: contentEditable={false} on select element prevents editor capturing input"

patterns-established:
  - "TipTap custom Node pattern: Extension file imports React component, component imports types from separate file"
  - "Node view component pattern: NodeViewWrapper required, NodeViewContent for editable areas"

# Metrics
duration: 4min
completed: 2026-02-14
---

# Phase 96 Plan 02: Callout Extension Summary

**TipTap CalloutExtension with React node view, type selector dropdown, and theme-aware CSS for info/warning/tip/error blocks**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-15T01:28:31Z
- **Completed:** 2026-02-15T01:32:33Z
- **Tasks:** 4
- **Files created:** 3
- **Files modified:** 4

## Accomplishments

- Created CalloutExtension TipTap node with type attribute supporting 4 callout types
- Built CalloutNode React component with icon and dropdown type selector
- Added /callout slash command for easy insertion
- Implemented theme-aware CSS styling with distinct colored left borders

## Task Commits

Each task was committed atomically:

1. **Tasks 1-3: CalloutExtension + CalloutNode + wiring** - `5a6d5d54` (feat)
2. **Task 4: Callout CSS styling** - `07b59916` (feat)

## Files Created/Modified

**Created:**
- `src/components/notebook/editor/extensions/CalloutExtension.ts` - TipTap Node extension with setCallout command
- `src/components/notebook/editor/extensions/callout-types.ts` - Type definitions (breaks circular dep)
- `src/components/notebook/editor/nodes/CalloutNode.tsx` - React component with type dropdown

**Modified:**
- `src/components/notebook/editor/extensions/index.ts` - Export CalloutExtension
- `src/hooks/ui/useTipTapEditor.ts` - Register CalloutExtension in extensions array
- `src/components/notebook/editor/extensions/slash-commands.ts` - Add /callout command
- `src/index.css` - Add callout block CSS with theme support

## Decisions Made

- **CALL-01:** Extracted types to separate file (callout-types.ts) to break circular dependency between extension and node component - depcruise was flagging warning
- **CALL-02:** Used Unicode escapes for emojis (e.g., '\u{1F4A1}' for lightbulb) to avoid encoding issues
- **CALL-03:** Added contentEditable={false} to select element to prevent TipTap from capturing dropdown interactions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Circular dependency between CalloutExtension.ts and CalloutNode.tsx**
- **Found during:** Task 1-3 commit attempt
- **Issue:** depcruise flagged circular dependency - CalloutExtension imports CalloutNode, CalloutNode imports CalloutType from CalloutExtension
- **Fix:** Extracted CalloutType and CalloutAttributes to separate callout-types.ts file
- **Files modified:** CalloutExtension.ts, CalloutNode.tsx, callout-types.ts (new)
- **Verification:** depcruise passes with 0 warnings for new files
- **Committed in:** 5a6d5d54 (combined with Task 1-3)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Standard TipTap pattern requires this separation. No scope creep.

## Issues Encountered

None - plan executed with one auto-fix for circular dependency.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CalloutExtension ready for use in Capture editor
- Pattern established for future TipTap custom nodes (separate types file)
- Ready for 96-03 (placeholder if planned) or Phase 97

## Self-Check: PASSED

Verified claims:
- [x] CalloutExtension.ts exists at src/components/notebook/editor/extensions/CalloutExtension.ts
- [x] CalloutNode.tsx exists at src/components/notebook/editor/nodes/CalloutNode.tsx
- [x] callout-types.ts exists at src/components/notebook/editor/extensions/callout-types.ts
- [x] Commit 5a6d5d54 found in git log
- [x] Commit 07b59916 found in git log

---
*Phase: 96-block-types-slash-commands*
*Completed: 2026-02-14*
