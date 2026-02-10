# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** Transform the Isometry ecosystem with a capture-shell-preview workflow that bridges rapid note-taking with AI-assisted development, seamlessly integrating notebook cards into the existing PAFV+LATCH+GRAPH knowledge system.
**Current focus:** v4.2 Three-Canvas Notebook - Phase 45 (TipTap Editor Migration)

## Current Position

Phase: 45 of 46 (TipTap Editor Migration)
Plan: 2 of 3 complete (45-02 Slash Commands)
Status: In progress
Last activity: 2026-02-10 — Completed 45-02 (Slash Commands)

Progress: [████░░░░░░░░] 33% (Phase 45: 2/3 plans complete)

## Performance Metrics

**Previous Milestones:**
- v3.1: 18 plans, 7 phases, 3 days
- v4.1: 27 plans, 9 phases, 5 days
- v4.3: 2 plans, 1 phase, ~5 minutes execution

**v4.2 Progress:**
- Phase 43: 3 plans, 2 waves, ~18 minutes execution
- Phase 45: 2 plans complete, ~12 minutes execution

**v4.2 Target:**
- 4 phases (43-46)
- Estimated ~12-16 plans total

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Key v4.1 decisions carried forward:

- sql.js-fts5 package chosen over CDN sql.js for FTS5 support
- TanStack Virtual integration for 10k+ cell performance
- ViewEngine architecture for unified D3 rendering
- idb package for IndexedDB persistence
- Bridge elimination achieved via sql.js direct access

**v4.2 decisions from research:**
- TipTap v3.19.0 for Capture editor (replacing MDEditor)
- @anthropic-ai/sdk v0.74.0 for Claude integration
- xterm.js v6.0.0 for terminal (upgrade from v5.5.0)
- Queue-based rate limiting for Claude API to prevent 429 errors
- Split NotebookContext pattern to prevent cascade re-renders

**Phase 43 decisions:**
- WebSocket heartbeat: 30s ping, 60s pong timeout
- Exponential backoff: 1s-30s, factor 2, max 10 attempts
- Terminal prompt shows abbreviated path (last 2 segments)
- Selection-aware Cmd+C (copy if selected, SIGINT if not)
- Toast notifications auto-dismiss after 3 seconds
- Failed commands loaded into input for retry editing
- Tool calls collapsed by default with click-to-expand
- Auto-scroll pauses when user scrolls up, resumes at bottom

**Phase 45 decisions:**
- shouldRerenderOnTransaction: false for TipTap performance
- @tiptap/suggestion for slash command trigger detection
- tippy.js for popup positioning
- Custom window events for cross-component command execution

**Phase 50 decisions:**
- Hook test mocks require db.exec() method, not empty object
- Requirement traceability tests tagged with [FOUND-XX] in test names
- dataVersion-based cache invalidation for hook refresh behavior

### Pending Todos

None — 45-02 complete, ready for 45-03.

### Blockers/Concerns

**Pre-existing Issues (not blocking v4.2):**
- ~1252 TypeScript errors in various modules (pre-existing, documented)
- Directory health check failing for src/services (22/15 files) - pre-existing cleanup needed

**v4.2 Implementation Notes:**
- Shell pane now functional with WebSocket, copy/paste, history, GSD execution
- Preview pane 50% complete - SuperGrid works, Network/Timeline/Inspector are stubs
- Capture pane now uses TipTap with slash commands
- Markdown serialization deferred - using getText() temporarily

## Session Continuity

Last session: 2026-02-10
Stopped at: Completed 45-02 (Slash Commands)
Resume file: None

## Next Steps

1. Continue with 45-03 (Markdown syntax highlighting) if planned
2. Phase 44: Preview Visualization Expansion (parallel execution)
3. Phase 46: Live Data Synchronization (requires 44, 45 complete)
