# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** Transform the Isometry ecosystem with a capture-shell-preview workflow that bridges rapid note-taking with AI-assisted development, seamlessly integrating notebook cards into the existing PAFV+LATCH+GRAPH knowledge system.

**Current focus:** Phase 96 - Block Types & Slash Commands (Capture Writing Surface v6.2)

## Current Position

Phase: 92 of 98 (Data Cell Integration - SuperStack Enhancement v6.1)
Plan: 4 of 4 complete
Status: Complete
Last activity: 2026-02-15 — Completed Phase 92 (all 4 plans)

Progress (Phase 92): [██████████] 100% (4 of 4 plans)
Overall: [████████░░] 99% (104 of ~130 total phases across all milestones)

## Active Milestones

### v6.2 Capture Writing Surface — CURRENT

**Goal:** Transform Capture into world-class writing surface with Apple Notes fluency, Notion flexibility, Obsidian power, Isometry-native embeds.

**Phases:**
- Phase 94: Foundation & Critical Fixes (11 requirements) — ✓ COMPLETE (4/4 plans)
  - [x] 94-01: Markdown Serialization Fix (~5m) ✓
  - [x] 94-02: Paste Sanitization + Tippy.js Cleanup (~5m) ✓
  - [x] 94-03: Apple Notes Keyboard Shortcuts (~5.5m) ✓
  - [x] 94-04: Word Count + Undo/Redo Polish (~6m) ✓
- Phase 95: Data Layer & Backlinks (9 requirements) — ✓ COMPLETE (4/4 plans)
  - [x] 95-01: Templates Data Layer (~5m) ✓
  - [x] 95-02: Backlinks Query Infrastructure ✓
  - [x] 95-03: Backlinks Panel in RightSidebar ✓
  - [x] 95-04: Forward Links Panel ✓
- Phase 96: Block Types & Slash Commands (14 requirements) — ✓ COMPLETE (3/3 plans)
  - [x] 96-01: Basic Slash Commands (~6m) ✓
  - [x] 96-02: Callout Blocks (~4m) ✓
  - [x] 96-03: Additional Block Types (~6m) ✓
- Phase 97: Inline Properties (4 requirements)
- Phase 98: Isometry Embeds & Polish (7 requirements)

**Total requirements:** 43
**Current:** Phase 96 COMPLETE (3/3 plans), ready for Phase 97

### v6.1 SuperStack Enhancement — IN PROGRESS

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
- Phase 93: Polish & Performance (5 requirements)

**Total requirements:** 26
**Current:** Phase 92 COMPLETE (4/4 plans), ready for Phase 93

### v6.0 Interactive Shell — IN PROGRESS

**Goal:** Complete Shell implementation with working Terminal, Claude AI, and GSD GUI tabs.
**Status:** Phase 86 in progress (2/4 plans complete)

**Phases:**
- Phase 85: Backend Infrastructure & Terminal Execution (5 plans) — ✓ COMPLETE
  - [x] 85-01: PTY spawn (shell mode) ✓
  - [x] 85-02: PTY spawn (claude-code mode) ✓
  - [x] 85-03: xterm.js frontend integration ✓
  - [x] 85-04: Terminal mode switching ✓
  - [x] 85-05: Mode toggle UI + ANSI sanitization ✓
- Phase 86: Claude AI Integration (4 plans) — IN PROGRESS (2/4)
  - [x] 86-01: Basic Chat Interface ✓
  - [x] 86-02: Project Context ✓
  - [ ] 86-03: MCP Tool Integration (planned)
  - [ ] 86-04: Claude Code Integration (planned)
- Phase 87: GSD File Synchronization (7 requirements)
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
| 96 (Block Types) | 3/3 | ~5m | Complete ✓ |
| 92 (Data Cell Integration) | 4/4 | ~5.3m | Complete ✓ |
| 95 (Data Layer) | 4/4 | ~4m | Complete ✓ |
| 91 (Interactions) | 2/2 | ~7m | Complete ✓ |
| 94 (Foundation Fixes) | 4/4 | ~5.4m | Complete ✓ |
| 90 (SQL Integration) | 2/2 | ~4.5m | Complete ✓ |

*Updated: 2026-02-15*

## Accumulated Context

### Decisions

Recent decisions affecting v6.1 SuperStack work:

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

**Terminal Security (from Phase 85):**
- TERM-01: Shell whitelist validation (/bin/zsh, /bin/bash, /bin/sh only)
- TERM-02: spawn() with args array, never string interpolation
- TERM-10: Mode switch kills and respawns PTY rather than in-place modification

See PROJECT.md Key Decisions table for full history.

### Pending Todos

None yet.

### Blockers/Concerns

**v6.1 SuperStack:**
- No blockers identified
- useHeaderInteractions hook ready for additional interaction types
- Click-to-filter logs constraints to console (FilterContext wiring in Phase 92)

**v6.2 Capture Writing Surface:**
- Phase 98 risk: D3.js + TipTap NodeView integration pattern unproven — needs validation spike (Plan 98-01)
- Template picker UX: ✅ RESOLVED - Modal approach implemented in 95-02

**Technical Debt:**
- knip unused exports: 275 reported (baseline ratchet at 1000, needs cleanup)
- Directory health: src/services (22/15 files)
- TipTap automated tests: Manual test plan in place, need test infrastructure (follow-up to 94-01)

## Session Continuity

Last session: 2026-02-14
Stopped at: Phase 86-02 COMPLETE - Project Context
Resume file: .planning/phases/86-claude-ai-integration/

**Phase 86 Summary (Plans 1-2 Complete):**
- 86-01: Basic Chat Interface - ClaudeAIChat component, useClaudeAI hook, streaming responses
- 86-02: Project Context - LATCH/GRAPH/PAFV architecture in system prompt, active card context

**Next Step:** Test Claude AI chat in browser, then implement 86-03 (MCP Tools) and 86-04 (Claude Code)

**To test Claude AI:**
1. Add `VITE_ANTHROPIC_API_KEY=sk-ant-...` to `.env` file
2. Run `npm run dev`
3. Click the Claude AI tab in Shell
4. Chat with Claude - it knows about Isometry architecture

**Key Fix:** Defaulted to collapsed density mode to prevent text overlap when 6,741 cards share grid positions

**Next step:** Phase 93 - Polish & Performance (virtual scrolling, accessibility, animations)
