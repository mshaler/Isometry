# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Transform the Isometry ecosystem with a capture-shell-preview workflow that bridges rapid note-taking with AI-assisted development, seamlessly integrating notebook cards into the existing PAFV+LATCH+GRAPH knowledge system.

**Current focus:** v6.0 Interactive Shell — Phase 87 GSD File Synchronization

## Current Position

Phase: 87 (GSD File Synchronization)
Plan: 4 of 5 complete
Status: In progress
Last activity: 2026-02-15 — Completed 87-04-PLAN.md (React Hooks & Progress Display)

Progress (Phase 87): [████████░░] 80%
Overall: Resuming v6.0 Interactive Shell milestone

## Active Milestones

### v6.3 SuperStack SQL Integration — COMPLETE

**Goal:** Connect SuperStack headers to live SQLite data via sql.js with query builders, React hooks, and integration tests.

**Status:** ✅ COMPLETE

**Plans:**
| Plan | Focus | Requirements | Deliverables | Status |
|------|-------|--------------|--------------|--------|
| 99-01 | SQL Query Builders | QUERY-01 to QUERY-06 | `queries/header-discovery.ts` | ✅ |
| 99-02 | Query Utilities | QUTIL-01 to QUTIL-04 | `queries/query-utils.ts` | ✅ |
| 99-03 | Integration Tests | TEST-01 to TEST-05 | `__tests__/sql-integration.test.ts` | ✅ |
| 99-04 | React Hook | HOOK-01 to HOOK-05 | `hooks/useSuperStackData.ts` | ✅ |
| 99-05 | Demo Component | DEMO-01 to DEMO-03 | `demos/SuperStackDemo.tsx` | ✅ |

**Phases:** Phase 99 (single consolidated phase) — COMPLETE

**Total requirements:** 23 | **Status:** COMPLETE

### v6.2 Capture Writing Surface — COMPLETE

**Goal:** Transform Capture into world-class writing surface with Apple Notes fluency, Notion flexibility, Obsidian power, Isometry-native embeds.

**Phases:**
- Phase 94: Foundation & Critical Fixes — ✓ COMPLETE (4/4 plans)
- Phase 95: Data Layer & Backlinks — ✓ COMPLETE (4/4 plans)
- Phase 96: Block Types & Slash Commands — ✓ COMPLETE (3/3 plans)
- Phase 97: Inline Properties — ✓ COMPLETE (2/2 plans)
- Phase 98: Isometry Embeds & Polish — ✓ COMPLETE (4/4 plans)

**Total requirements:** 43 | **Status:** COMPLETE

### v6.1 SuperStack Enhancement — COMPLETE

**Goal:** Dramatically enhance SuperGrid via SuperStack—the nested hierarchical header system that transforms SuperGrid from a flat grid into a true dimensional pivot table.

**Phases:**
- Phase 89: Static Headers Foundation (6 requirements) ✓
- Phase 90: SQL Integration (5 requirements) — ✓ COMPLETE
  - [x] 90-01: Header Discovery Query Generator (~3m) ✓
  - [x] 90-02: Tree Builder from Query Results (~6m) ✓
- Phase 91: Interactions (5 requirements) — ✓ COMPLETE (2/2 plans)
  - [x] 91-01: Header Collapse/Expand + Click-to-Filter (~10m) ✓
  - [x] 91-02: Header Keyboard Navigation (~4m) ✓
- Phase 92: Data Cell Integration (5 requirements) — ✓ COMPLETE (4/4 plans)
  - [x] 92-01: Core data cell rendering with CSS Grid scroll container ✓
  - [x] 92-02: Density-aware rendering (counts vs card chips) ✓
  - [x] 92-03: Selection synchronization (~6m) ✓
  - [x] 92-04: SuperStack hierarchical header integration ✓
- Phase 93: Polish & Performance (5 requirements) — ✓ COMPLETE (3/3 plans)
  - [x] 93-01: Virtual scrolling with TanStack Virtual (~5m) ✓
  - [x] 93-02: Accessibility (ARIA + empty states) (~5m) ✓
  - [x] 93-03: GPU-accelerated animations + sticky headers (~5m) ✓

**Total requirements:** 26 | **Status:** COMPLETE

### v6.0 Interactive Shell — DEFERRED

**Goal:** Complete Shell implementation with working Terminal, Claude AI, and GSD GUI tabs.
**Status:** Phase 86 in progress (2/4 plans complete)

**Phases:**
- Phase 85: Backend Infrastructure & Terminal Execution (5 plans) — ✓ COMPLETE
  - [x] 85-01: PTY spawn (shell mode) ✓
  - [x] 85-02: PTY spawn (claude-code mode) ✓
  - [x] 85-03: xterm.js frontend integration ✓
  - [x] 85-04: Terminal mode switching ✓
  - [x] 85-05: Mode toggle UI + ANSI sanitization ✓
- Phase 86: Claude AI Integration (4 plans) — ✓ COMPLETE
  - [x] 86-01: Basic Chat Interface ✓
  - [x] 86-02: Project Context ✓
  - [x] 86-03: MCP Tool Integration ✓
  - [x] 86-04: Claude Code Integration ✓
- Phase 87: GSD File Synchronization (5 plans) — IN PROGRESS
  - [x] 87-01: GSD File Parser (~5m) ✓
  - [x] 87-02: File Watcher Integration (~5m) ✓
  - [x] 87-03: State Synchronization (~5m) ✓
  - [x] 87-04: React Hooks & Progress Display (~3m) ✓
  - [ ] 87-05: Error Handling & Recovery
- Phase 88: Integration & Polish (verification only)

## Performance Metrics

**Recent Milestones:**
- v5.2 Cards & Connections: 4 plans, 1 phase, ~20 minutes total
- v5.1 Notebook Integration: 2 plans, 1 phase, ~9 minutes total
- v4.9 Data Layer: 6 plans, 3 phases, same day
- v5.0 SuperGrid MVP: 12 plans, 4 phases, same day

**Velocity:**
- Average plan duration: ~6-8 minutes
- Recent trend: Stable (small, focused plans executing efficiently)

**By Recent Phase:**

| Phase | Plans | Avg Duration | Status |
|-------|-------|-------------|--------|
| 98 (Isometry Embeds) | 4/4 | ~4.5m | Complete ✓ |
| 97 (Inline Properties) | 2/2 | ~5m | Complete ✓ |
| 93 (Polish & Performance) | 3/3 | ~5m | Complete ✓ |
| 96 (Block Types) | 3/3 | ~5m | Complete ✓ |
| 92 (Data Cell Integration) | 4/4 | ~5.3m | Complete ✓ |
| 95 (Data Layer) | 4/4 | ~4m | Complete ✓ |
| 91 (Interactions) | 2/2 | ~7m | Complete ✓ |
| 94 (Foundation Fixes) | 4/4 | ~5.4m | Complete ✓ |

*Updated: 2026-02-15*

## Accumulated Context

### Decisions

Recent decisions affecting v6.1 SuperStack work:

**Polish & Performance (Phase 93):**
- PERF-01: TanStack Virtual for row-based virtualization, 100-cell threshold ✅ Implemented 93-01
- PERF-02: Virtualized sticky headers - headers outside scroll container with JS scroll sync ✅ Implemented 93-03
- A11Y-01: ARIA grid pattern with roving tabindex for keyboard navigation ✅ Implemented 93-02
- UX-01: Three empty state variants (first-use, no-results, error) with aria-live announcements ✅ Implemented 93-02
- UX-02: GPU-accelerated transforms (scaleX, translateX, opacity) skip layout recalculation ✅ Implemented 93-03

**Data Cell Integration (Phase 92):**
- CELL-AGG-01: Use d3.group() for cell aggregation by position ✅ Implemented 92-02
- CELL-RENDER-01: Switch rendering mode based on valueDensity ('leaf' vs 'collapsed') ✅ Implemented 92-02
- CELL-VISUAL-01: Collapsed mode uses circles with count badges instead of rectangles ✅ Implemented 92-02
- COORD-SYS-01: Hard-code cell dimensions (160x100) in SuperGrid for now ✅ Implemented 92-02
- SEL-CELL-01: Pass selectedIds as Set<string> to DataCellRenderer for O(1) membership testing ✅ Implemented 92-03
- SEL-CELL-02: Blue highlight (stroke #3b82f6, fill #dbeafe) for selected cells ✅ Implemented 92-03
- SEL-CELL-03: Modifier key detection in click handler (metaKey/ctrlKey for toggle, shift for range) ✅ Implemented 92-03
- SEL-HEADER-01: Header click selects all cells by filtering nodes with extractNodeValue() ✅ Implemented 92-03

**Header Interactions (Phase 91):**
- INT-STATE-01: Keep collapse state LOCAL in useHeaderInteractions (Set<string>), not in Context API - prevents re-render cascade ✅ Implemented 91-01
- INT-CLONE-01: Use structuredClone(tree) before mutation - React requires immutable updates ✅ Implemented 91-01
- INT-LOG-01: Use superGridLogger.debug for filter constraints - FilterContext wiring deferred to Phase 92 ✅ Implemented 91-01
- INT-KB-01: Parse header key format to determine parent/child/sibling relationships ✅ Implemented 91-02
- INT-KB-02: Focus visuals use dashed stroke to differentiate from selection solid stroke ✅ Implemented 91-02
- INT-KB-03: Header IDs collected depth-first respecting collapsed state ✅ Implemented 91-02

**SuperStack Implementation (from v6.1):**
- SSTACK-01: D3.js for all header rendering (enter/update/exit pattern)
- SSTACK-02: SQLite queries drive header discovery (GROUP BY, json_each, strftime)
- SSTACK-03: Header trees built from flat query results (not pre-hierarchical data)
- SSTACK-04: Spans calculated bottom-up (leaves have span=1, parents sum children)
- SQL-01: Dispatch query generation on facet.dataType (Phase 90-01)
- SQL-02: Quarter calculation via formula not strftime('%Q') (Phase 90-01)
- SQL-03: Month name ordering by numeric month not alphabetic (Phase 90-01)
- SQL-ARCH-01: Use NestedHeaderRenderer directly, not GridRenderingEngine wrapper (Phase 90-02)
- SQL-05-IMPL: Empty datasets return empty HeaderTree (leafCount=0) not null (Phase 90-02)
- FACET-MAP-01: Infer FacetConfig from AxisMapping using LATCH heuristics (Phase 90-02)

**Capture Writing Surface (Phase 94-98):**
- MD-01: Use @tiptap/markdown extension with storage API (official TipTap approach) ✅ Implemented 94-01
- MD-02: Manual test plan instead of automated unit tests (TipTap test environment would delay fix) ✅ Implemented 94-01
- SEC-01: DOMPurify for paste sanitization via transformPastedHTML (prevents XSS) ✅ Implemented 94-02
- MEM-01: Destroyed flag pattern for Tippy cleanup (prevents memory leaks) ✅ Implemented 94-02
- POLISH-COUNT: Use TipTap CharacterCount extension storage API ✅ Implemented 94-04
- POLISH-STATUS: Separate EditorStatusBar component at bottom of editor ✅ Implemented 94-04
- KEYS-07: AppleNotesShortcuts extension pattern (centralize all shortcuts) ✅ Implemented 94-03
- KEYS-08: Graceful TaskList fallback (toggleTaskList || toggleBulletList) ✅ Implemented 94-03
- KEYS-09: TaskList/TaskItem installation for checkbox support ✅ Implemented 94-03
- CAPTURE-01: ~~Migrate from getText() to @tiptap/markdown~~ ✅ COMPLETE (94-01)
- CAPTURE-02: ~~DOMPurify for paste sanitization~~ ✅ COMPLETE (94-02)
- CAPTURE-03: Templates stored in sql.js database, not files (consistency with cards) ✅ Implemented 95-01
- TEMPLATES-01: Template table with FTS5, CRUD operations, 4 built-in templates ✅ Implemented 95-01
- CAPTURE-04: Start with one-way property sync (editor → PropertyEditor), defer reverse sync
- CAPTURE-05: D3.js embed integration requires validation spike before full implementation (Phase 98-01)
- BACK-QUERY-01: Use nodeId for backlink queries (edges reference nodes.id not notebook_cards.id) ✅ Implemented 95-03
- BACK-LIMIT-01: Default 50 backlinks limit for performance protection ✅ Implemented 95-03
- BACK-SELF-01: Exclude self-referencing links from backlink results ✅ Implemented 95-03
- TMPL-MODAL-01: Use CustomEvent for slash command to modal communication ✅ Implemented 95-02
- TMPL-MODAL-02: Variable substitution for {{date}} and {{time}} on insert ✅ Implemented 95-02
- TMPL-MODAL-03: Theme-aware styling (NeXTSTEP vs Modern) ✅ Implemented 95-02
- TMPL-SAVE-01: getEditorContent helper for markdown serialization with getText fallback ✅ Implemented 95-04
- TMPL-SAVE-02: Save as Template button placed between Save and Minimize in header ✅ Implemented 95-04
- SLASH-01: Use StarterKit built-in extensions (Heading, HorizontalRule, Blockquote) - no new dependencies ✅ Implemented 96-01
- SLASH-02: Date formatting with toLocaleDateString for readable output ✅ Implemented 96-01
- CALL-01: Extract callout-types.ts to break circular dependency between CalloutExtension.ts and CalloutNode.tsx ✅ Implemented 96-02
- CALL-02: Use Unicode escapes for emojis to avoid encoding issues ✅ Implemented 96-02
- CALL-03: contentEditable={false} on select prevents TipTap capturing dropdown input ✅ Implemented 96-02
- TOGGLE-01: Local useState for collapse state to avoid re-render cascade from attribute changes ✅ Implemented 96-03
- TOGGLE-02: Start expanded (open: true) for better UX when inserting new toggle ✅ Implemented 96-03
- BOOKMARK-01: atom: true for non-editable inline content (URL is the content) ✅ Implemented 96-03
- BOOKMARK-02: Google favicon service for simple icon display without server-side unfurling ✅ Implemented 96-03
- BOOKMARK-03: Auto-add https:// if user forgets protocol ✅ Implemented 96-03

**Isometry Embeds (Phase 98):**
- EMBED-01: atom: true for non-editable embed blocks (like bookmark) ✅ Implemented 98-01
- EMBED-02: ReactNodeViewRenderer for type-specific D3 visualization rendering ✅ Implemented 98-01
- EMBED-03: ResizeObserver for responsive width, manual height controls ✅ Implemented 98-01
- EMBED-04: Placeholder SVG visualizations with data info (full D3 in 98-02) ✅ Implemented 98-01
- EMBED-05: /supergrid, /network, /timeline slash commands ✅ Implemented 98-01
- EMBED-06: /table maps to SuperGrid embed with title "Table" ✅ Implemented 98-01
- EMBED-07: View toggle uses role=tab and aria-pressed for accessibility ✅ Implemented 98-03
- EMBED-08: Filter display truncates with ellipsis at 200px ✅ Implemented 98-03
- EMBED-09: NeXTSTEP theme uses monochrome palette for toolbar ✅ Implemented 98-03
- EMBED-10: Update callback compares old/new attributes to prevent unnecessary re-renders ✅ Implemented 98-04
- EMBED-11: 100ms resize debounce prevents rapid dimension updates ✅ Implemented 98-04
- EMBED-12: RAF wrapping ensures D3 renders don't block main thread ✅ Implemented 98-04

**Terminal Security (from Phase 85):**
- TERM-01: Shell whitelist validation (/bin/zsh, /bin/bash, /bin/sh only)
- TERM-02: spawn() with args array, never string interpolation
- TERM-10: Mode switch kills and respawns PTY rather than in-place modification

**GSD File Synchronization (Phase 87):**
- PARSE-01: Use gray-matter for frontmatter extraction (standard npm package) ✅ Implemented 87-01
- PARSE-02: XML-like regex for task extraction (custom <task> tags) ✅ Implemented 87-01
- PARSE-03: Status derived from <done> content presence (pending/complete) ✅ Implemented 87-01
- PARSE-04: parseGSDPlanContent helper for testing without file I/O ✅ Implemented 87-01
- WATCH-01: Chokidar awaitWriteFinish with 400ms stabilityThreshold (<500ms GSD-02) ✅ Implemented 87-02
- WATCH-02: Single watcher per project shared across clients ✅ Implemented 87-02
- WATCH-03: skipWatchPaths with 600ms timeout prevents update loops ✅ Implemented 87-02
- ROUTE-01: Type guard in messageRouter for GSD messages ✅ Implemented 87-02
- WRITE-01: Atomic writes via temp file + rename ✅ Implemented 87-03
- WRITE-02: Task status stored as <done> element presence ✅ Implemented 87-03
- SYNC-SVC-01: GSDFileSyncService orchestrates all file operations ✅ Implemented 87-03
- SYNC-SVC-02: markWritePath called before updateTaskStatus ✅ Implemented 87-03
- SYNC-01: Use React Query invalidation on gsd_file_update messages (not polling) ✅ Implemented 87-04
- SYNC-02: Optimistic updates via useMutation onMutate with rollback context ✅ Implemented 87-04
- SYNC-03: 10-second timeout on plan data requests ✅ Implemented 87-04
- UI-01: Three-state icons (Circle/Clock/CheckCircle) from lucide-react ✅ Implemented 87-04
- A11Y-01: role="button" with tabIndex and onKeyDown for task items ✅ Implemented 87-04
- A11Y-02: aria-label describes current status and next status on click ✅ Implemented 87-04

See PROJECT.md Key Decisions table for full history.

### Pending Todos

None yet.

### Blockers/Concerns

**v6.1 SuperStack:**
- No blockers identified
- useHeaderInteractions hook ready for additional interaction types
- Click-to-filter logs constraints to console (FilterContext wiring in Phase 92)

**v6.2 Capture Writing Surface:**
- Phase 98 risk: ✅ RESOLVED - D3.js + TipTap NodeView integration validated in 98-01 (placeholder approach works)
- Template picker UX: ✅ RESOLVED - Modal approach implemented in 95-02

**Technical Debt:**
- knip unused exports: 275 reported (baseline ratchet at 1000, needs cleanup)
- Directory health: src/services (22/15 files)
- TipTap automated tests: Manual test plan in place, need test infrastructure (follow-up to 94-01)

## Session Continuity

Last session: 2026-02-15
Completed: Plan 87-04 (React Hooks & Progress Display)
Next: Plan 87-05 (Error Handling & Recovery)

**Phase 87-04 Complete:**
- useGSDFileSync hook for WebSocket file watching
- useGSDTaskToggle hook with optimistic updates and rollback
- GSDProgressDisplay component with progress bar and task list
- Cache invalidation on gsd_file_update messages
- Accessible task toggling (keyboard + ARIA)

**Phase 87-03 Complete:**
- gsdFileWriter.ts with atomic writes (temp file + rename)
- gsdFileSyncService.ts for orchestrating read/watch/write
- ClaudeCodeServer integration for GSD message routing
- markWritePath prevents update loops
- gsd_read_plan added to message router

**Phase 87-02 Complete:**
- GSDFileWatcher class with chokidar
- 400ms debounce (within <500ms GSD-02 requirement)
- skipWatchPaths for preventing update loops
- isGSDFileMessage type guard for WebSocket routing
- 5 timing verification tests

**Phase 87-01 Complete:**
- GSD file parser with gray-matter
- 30 unit tests passing
- Types: PlanFrontmatter, GSDTask, ParsedPlanFile
- Functions: parseGSDPlanFile, extractTasks, normalizeTaskStatus

**v6.3 SuperStack SQL Integration — COMPLETE:**
- 23 requirements delivered across 5 plans
- 18 integration tests passing
- Query time: ~46ms (target: <100ms)

**Reference:**
- `.planning/phases/87-gsd-file-synchronization/87-04-SUMMARY.md` — Plan 87-04 execution summary
- `.planning/phases/87-gsd-file-synchronization/87-03-SUMMARY.md` — Plan 87-03 execution summary
- `.planning/phases/87-gsd-file-synchronization/87-02-SUMMARY.md` — Plan 87-02 execution summary
- `.planning/phases/87-gsd-file-synchronization/87-01-SUMMARY.md` — Plan 87-01 execution summary
- `superstack-phase2-sql-integration.md` — Full implementation specification
