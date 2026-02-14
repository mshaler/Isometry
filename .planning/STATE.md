# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** Transform the Isometry ecosystem with a capture-shell-preview workflow that bridges rapid note-taking with AI-assisted development, seamlessly integrating notebook cards into the existing PAFV+LATCH+GRAPH knowledge system.

**Current focus:** Phase 94 - Foundation & Critical Fixes (Capture Writing Surface v6.2)

## Current Position

Phase: 94 of 98 (Foundation & Critical Fixes - Capture Writing Surface v6.2)
Plan: 3 of 4 complete
Status: Phase 94 in progress
Last activity: 2026-02-14 — Completed 94-04-PLAN.md (Word Count + Undo/Redo Polish)

Progress (Phase 94): [███████▓░░] 75% (3 of 4 plans)
Overall: [████████░░] 94% (94 of ~130 total phases across all milestones)

## Active Milestones

### v6.2 Capture Writing Surface — CURRENT

**Goal:** Transform Capture into world-class writing surface with Apple Notes fluency, Notion flexibility, Obsidian power, Isometry-native embeds.

**Phases:**
- Phase 94: Foundation & Critical Fixes (11 requirements) — IN PROGRESS (3/4 plans complete)
  - [x] 94-01: Markdown Serialization Fix (~5m) ✓
  - [x] 94-02: Paste Sanitization + Tippy.js Cleanup (~5m) ✓
  - [ ] 94-03: Apple Notes Keyboard Shortcuts
  - [x] 94-04: Word Count + Undo/Redo Polish (~6m) ✓
- Phase 95: Data Layer & Backlinks (9 requirements)
- Phase 96: Block Types & Slash Commands (14 requirements)
- Phase 97: Inline Properties (4 requirements)
- Phase 98: Isometry Embeds & Polish (7 requirements)

**Total requirements:** 43
**Current:** Phase 94 execution in progress (plan 94-01 complete)

### v6.1 SuperStack Enhancement — IN PROGRESS

**Goal:** Dramatically enhance SuperGrid via SuperStack—the nested hierarchical header system that transforms SuperGrid from a flat grid into a true dimensional pivot table.

**Phases:**
- Phase 89: Static Headers Foundation (6 requirements) ✓
- Phase 90: SQL Integration (5 requirements) — ✓ COMPLETE
  - [x] 90-01: Header Discovery Query Generator (~3m) ✓
  - [x] 90-02: Tree Builder from Query Results (~6m) ✓
- Phase 91: Interactions (5 requirements)
- Phase 92: Data Cell Integration (4 requirements)
- Phase 93: Polish & Performance (5 requirements)

**Total requirements:** 25
**Current:** Phase 90 complete, ready for Phase 91

### v6.0 Interactive Shell — IN PROGRESS

**Goal:** Complete Shell implementation with working Terminal, Claude AI, and GSD GUI tabs.
**Status:** Phase 85 in progress (4/5 plans complete)

**Phases:**
- Phase 85: Backend Infrastructure & Terminal Execution (5 plans) — 80% complete
- Phase 86: Claude AI MCP Integration (7 requirements)
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
| 94 (Foundation Fixes) | 3/4 | ~5.4m | In Progress |
| 90 (SQL Integration) | 2/2 | ~4.5m | Complete ✓ |
| 85 (Backend Terminal) | 4/5 | ~5.3m | Paused |
| 84 (Cards & Connections) | 4 | ~7m | Complete |
| 80 (Notebook Integration) | 2 | ~4.5m | Complete |

*Updated: 2026-02-14*

## Accumulated Context

### Decisions

Recent decisions affecting v6.2 work:

**Capture Writing Surface (Phase 94-98):**
- MD-01: Use @tiptap/markdown extension with storage API (official TipTap approach) ✅ Implemented 94-01
- MD-02: Manual test plan instead of automated unit tests (TipTap test environment would delay fix) ✅ Implemented 94-01
- SEC-01: DOMPurify for paste sanitization via transformPastedHTML (prevents XSS) ✅ Implemented 94-02
- MEM-01: Destroyed flag pattern for Tippy cleanup (prevents memory leaks) ✅ Implemented 94-02
- POLISH-COUNT: Use TipTap CharacterCount extension storage API ✅ Implemented 94-04
- POLISH-STATUS: Separate EditorStatusBar component at bottom of editor ✅ Implemented 94-04
- CAPTURE-01: ~~Migrate from getText() to @tiptap/markdown~~ ✅ COMPLETE (94-01)
- CAPTURE-02: ~~DOMPurify for paste sanitization~~ ✅ COMPLETE (94-02)
- CAPTURE-03: Templates stored in sql.js database, not files (consistency with cards)
- CAPTURE-04: Start with one-way property sync (editor → PropertyEditor), defer reverse sync
- CAPTURE-05: D3.js embed integration requires validation spike before full implementation (Phase 98-01)

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

**Terminal Security (from Phase 85):**
- TERM-01: Shell whitelist validation (/bin/zsh, /bin/bash, /bin/sh only)
- TERM-02: spawn() with args array, never string interpolation
- TERM-10: Mode switch kills and respawns PTY rather than in-place modification

See PROJECT.md Key Decisions table for full history.

### Pending Todos

None yet.

### Blockers/Concerns

**v6.2 Capture Writing Surface:**
- ~~Phase 94 critical: Current editor uses lossy getText() serialization~~ ✅ RESOLVED (94-01)
- ~~Security: XSS vulnerability via pasted HTML~~ ✅ RESOLVED (94-02)
- ~~Memory leaks: Tippy instances not cleaned up~~ ✅ RESOLVED (94-02)
- Phase 98 risk: D3.js + TipTap NodeView integration pattern unproven — needs validation spike (Plan 98-01)
- Research gap: Template picker UX (modal vs sidebar) — start with modal, iterate if needed

**v6.1 SuperStack:**
- No blockers identified
- Implementation plan is comprehensive with type definitions ready
- File structure already specified: `src/superstack/`

**Technical Debt:**
- knip unused exports: 275 reported (baseline ratchet at 1000, needs cleanup)
- Directory health: src/services (22/15 files)
- TipTap automated tests: Manual test plan in place, need test infrastructure (follow-up to 94-01)

## Session Continuity

Last session: 2026-02-14
Stopped at: Phase 94 plan 94-04 complete (Word Count + Undo/Redo Polish)
Resume file: .planning/phases/94-foundation-critical-fixes/94-04-SUMMARY.md

**Phase 94 Plan 94-04 Complete:**
- Added real-time word/character count: EditorStatusBar component
- Integrated @tiptap/extension-character-count for accurate tracking
- Status bar shows counts and save status (Saving.../Unsaved/Saved)
- Verified Undo/Redo buttons functional in toolbar
- No deviations from plan
- Duration: ~6 minutes
- Commits: fc37ea01, aebbdcdc

**Phase 94 Remaining Plans:**
- 94-03-PLAN.md: Apple Notes keyboard shortcuts (KEYS-01 through KEYS-06)

**Wave structure:**
- Wave 1: 94-01 ✅ (critical blocker), 94-02 ✅ (security/memory)
- Wave 2: 94-03 (shortcuts), 94-04 ✅ (polish)

**Next step:** Execute plan 94-03 (Apple Notes keyboard shortcuts)
Resume file: .planning/phases/94-foundation-critical-fixes/94-01-SUMMARY.md

**Phase 94 Plan 94-01 Complete:**
- Eliminated critical data loss bug: getText() → @tiptap/markdown
- Added Markdown extension to editor configuration
- Replaced lossy serialization in onUpdate and saveNow
- Created comprehensive manual test plan
- All formatting (bold, italic, lists, links, headings) now persists
- Duration: ~5.1 minutes
- Commits: 29d6ecb0, 60ee0a36

**Phase 94 Remaining Plans:**
- 94-02-PLAN.md: Paste sanitization + Tippy.js cleanup (FOUND-02, FOUND-03)
- 94-03-PLAN.md: Apple Notes keyboard shortcuts (KEYS-01 through KEYS-06)
- 94-04-PLAN.md: Word count + Undo/Redo polish (POLISH-01, POLISH-02)

**Wave structure:**
- Wave 1: 94-01 ✅ (critical blocker), 94-02 (security/memory) — parallel
- Wave 2: 94-03 (shortcuts), 94-04 (polish) — depend on 94-01

**Next step:** Execute plan 94-02 (or continue Phase 94 execution)
