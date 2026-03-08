---
phase: 51-command-palette
plan: 01
subsystem: ui
tags: [fuzzy-search, command-palette, localStorage, registry-pattern]

# Dependency graph
requires: []
provides:
  - "fuzzyMatch(query, target) scorer with substring and word-boundary fuzzy matching"
  - "CommandRegistry class with search, getVisible, getById, register/registerAll"
  - "Recents persistence (pushRecent, getRecents, getRecentCommands) via localStorage"
  - "PaletteCommand interface (id, label, category, shortcut, icon, visible, execute)"
affects: [51-02-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Word-boundary fuzzy matching: scattered chars must be at word boundary or consecutive"
    - "Visibility predicate pattern: optional visible() function excludes commands from results"
    - "localStorage recents: dedup + cap + most-recent-first ordering"

key-files:
  created:
    - src/palette/fuzzy.ts
    - src/palette/CommandRegistry.ts
    - src/palette/index.ts
    - tests/palette/CommandRegistry.test.ts
  modified: []

key-decisions:
  - "Built-in fuzzy scorer instead of fuse.js -- word-boundary constraint prevents false positives like 'lv' matching 'Calendar View'"
  - "Query length bonus in substring scoring -- longer exact matches score higher than shorter substrings"

patterns-established:
  - "Fuzzy scorer word-boundary constraint: non-substring scattered matches require each character at word boundary or consecutive with previous match"
  - "CommandRegistry visibility filter: commands with visible() returning false excluded from both search() and getVisible()"

requirements-completed: [CMDK-02, CMDK-07, CMDK-08]

# Metrics
duration: 3min
completed: 2026-03-08
---

# Phase 51 Plan 01: Command Registry + Fuzzy Scorer Summary

**Built-in fuzzy scorer with word-boundary constraint, CommandRegistry with visibility-filtered search, and localStorage recents persistence**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-08T03:26:03Z
- **Completed:** 2026-03-08T03:29:08Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 4

## Accomplishments
- Fuzzy scorer that distinguishes substring matches (high score) from word-boundary scattered matches (medium score) and rejects mid-word scattered matches (null)
- CommandRegistry with fuzzy search filtered by visibility predicates and sorted by score descending
- Recent commands persistence in localStorage with dedup, 5-item cap, and registry resolution
- 21 comprehensive tests covering all behaviors specified in the plan

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests** - `259ebba8` (test)
2. **Task 1 GREEN: Implementation** - `7135643d` (feat)

## Files Created/Modified
- `src/palette/fuzzy.ts` - fuzzyMatch(query, target) scorer with substring shortcut and word-boundary fuzzy fallback
- `src/palette/CommandRegistry.ts` - PaletteCommand interface, CommandRegistry class, pushRecent/getRecents/getRecentCommands functions
- `src/palette/index.ts` - Barrel exports for the palette module
- `tests/palette/CommandRegistry.test.ts` - 21 tests: 6 fuzzyMatch, 7 CommandRegistry, 8 Recents

## Decisions Made
- Built-in fuzzy scorer (not fuse.js): the ~30-item command list doesn't justify a 5kB dependency. The word-boundary constraint solves the "lv" vs "Calendar View" false positive elegantly.
- Query length bonus for substring scoring: `q.length * 10` added to substring score so "list view" (exact) scores higher than "list" (partial) against "List View".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fuzzy scorer false positives on scattered matches**
- **Found during:** Task 1 GREEN phase
- **Issue:** Plan's algorithm matched "lv" against "Calendar View" (l in calendar, v in view) but plan behavior spec requires null for this case
- **Fix:** Added word-boundary/consecutive constraint: scattered character matches only count if each character is at a word boundary (start of string, after space/hyphen) or consecutive with the previous match
- **Files modified:** src/palette/fuzzy.ts
- **Verification:** fuzzyMatch('lv', 'Calendar View') returns null; fuzzyMatch('lv', 'List View') returns positive score
- **Committed in:** 7135643d (GREEN commit)

**2. [Rule 1 - Bug] Equal scores for different-length substring matches**
- **Found during:** Task 1 GREEN phase
- **Issue:** fuzzyMatch('list view', 'List View') scored identically to fuzzyMatch('list', 'List View') because both used `1000 - target.length + starts-with bonus`
- **Fix:** Added `q.length * 10` bonus to substring score formula so longer query substrings score higher
- **Files modified:** src/palette/fuzzy.ts
- **Verification:** 'list view' score (1181) > 'list' score (1131) against 'List View'
- **Committed in:** 7135643d (GREEN commit)

---

**Total deviations:** 2 auto-fixed (2 bugs in plan-specified algorithm)
**Impact on plan:** Both fixes necessary for correctness per plan's own behavior spec. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CommandRegistry, fuzzyMatch, and recents functions ready for Plan 02 (CommandPalette UI component)
- Plan 02 will import from `src/palette/index.ts` barrel and wire into main.ts

## Self-Check: PASSED

All 4 created files verified on disk. Both commit hashes (259ebba8, 7135643d) verified in git log.

---
*Phase: 51-command-palette*
*Completed: 2026-03-08*
