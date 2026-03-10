---
phase: 63-notebook-formatting-toolbar
plan: 01
subsystem: ui
tags: [markdown, toolbar, textarea, execCommand, formatting, undo]

# Dependency graph
requires:
  - phase: 57-notebook-explorer
    provides: NotebookExplorer class with tabbed Write/Preview, marked + DOMPurify pipeline
provides:
  - Undo-safe Markdown formatting engine (_undoSafeInsert, _formatInline, _formatLinePrefix, _cycleHeading)
  - 8-button formatting toolbar DOM with CSS styling
  - Toolbar visibility tied to Write/Preview tab state
affects: [64-notebook-persistence, 65-notebook-charts]

# Tech tracking
tech-stack:
  added: []
  patterns: [contentEditable + execCommand undo-safe insertion, line-prefix formatting, heading cycle state machine]

key-files:
  created: []
  modified:
    - src/ui/NotebookExplorer.ts
    - src/styles/notebook-explorer.css
    - tests/ui/NotebookExplorer.test.ts

key-decisions:
  - "execCommand('insertText') with contentEditable trick for undo-safe textarea insertion (GitHub markdown-toolbar-element pattern)"
  - "Fallback to direct value assignment in jsdom/non-WebKit environments (graceful degradation)"
  - "H4+ heading lines treated as plain text in cycle (only H1-H3 recognized)"
  - "Empty trailing lines skipped during line-prefix formatting to avoid spurious prefixed blank lines"

patterns-established:
  - "_undoSafeInsert: contentEditable toggle + execCommand + explicit _content sync"
  - "_createButtonGroup: reusable toolbar button factory with label/title/action"
  - "Toolbar visibility toggle in _switchTab() for Write-mode-only UI elements"

requirements-completed: [NOTE-01, NOTE-02]

# Metrics
duration: 5min
completed: 2026-03-09
---

# Phase 63 Plan 01: Notebook Formatting Toolbar Summary

**Undo-safe Markdown formatting engine with 8-button toolbar (bold, italic, strikethrough, heading, list, blockquote, link, code) using execCommand('insertText') contentEditable trick**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-09T16:13:05Z
- **Completed:** 2026-03-09T16:18:21Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Replaced broken `_wrapSelection()` (direct textarea.value assignment destroying undo stack) with undo-safe `_undoSafeInsert()` using GitHub's contentEditable + execCommand trick
- Built 4 formatting methods: `_formatInline` (wrap), `_formatLinePrefix` (line-start prefix), `_cycleHeading` (H1->H2->H3->plain cycle), all routing through `_undoSafeInsert`
- Created 8-button toolbar DOM in 3 groups with 2 dividers, visible only in Write mode
- Added CSS styling with design tokens (`.notebook-toolbar`, `.notebook-toolbar-btn`, `.notebook-toolbar-divider`)
- All existing Cmd+B/I/K keyboard shortcuts preserved, now using new undo-safe code path
- 30 new tests added (16 formatting engine + 14 toolbar), total 58 tests all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Undo-safe insertion engine + formatting methods** - `28cb1652` (feat) [TDD: red-green]
2. **Task 2: Toolbar DOM + CSS styling + tab visibility** - `9b93eb4a` (feat)

## Files Created/Modified
- `src/ui/NotebookExplorer.ts` - Added _undoSafeInsert, _formatInline, _formatLinePrefix, _cycleHeading, _createToolbar, _createButtonGroup, _createDivider; removed _wrapSelection
- `src/styles/notebook-explorer.css` - Added .notebook-toolbar, .notebook-toolbar-group, .notebook-toolbar-btn, .notebook-toolbar-divider CSS rules
- `tests/ui/NotebookExplorer.test.ts` - Added 30 new tests across 2 describe blocks (formatting engine, toolbar)

## Decisions Made
- Used execCommand('insertText') with contentEditable trick (GitHub's proven pattern) instead of setRangeText or synthetic InputEvent
- Explicit `_content = textarea.value` sync after every formatting operation (execCommand may not fire input event in all WebKit versions)
- H4+ headings treated as plain text in cycle (regex matches only 1-3 hashes)
- Empty trailing lines skipped during line-prefix formatting

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Formatting toolbar complete, ready for per-card notebook scoping (Phase 64)
- _undoSafeInsert primitive available for any future textarea formatting operations
- Toolbar DOM pattern (button groups + dividers) extensible for additional buttons

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 63-notebook-formatting-toolbar*
*Completed: 2026-03-09*
