# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-10)

**Core value:** Transform the Isometry ecosystem with a capture-shell-preview workflow that bridges rapid note-taking with AI-assisted development, seamlessly integrating notebook cards into the existing PAFV+LATCH+GRAPH knowledge system.
**Current focus:** v4.2 Three-Canvas Notebook - Phase 46 (Live Data Synchronization)

## Current Position

Phase: 44 of 46 (Preview Visualization Expansion)
Plan: 3 of 3 complete
Status: Phase 44 complete
Last activity: 2026-02-10 — Completed 44-03-PLAN.md (Timeline Visualization)

Progress: [████████░░░░] 75% v4.2 (3/4 phases complete)

## Performance Metrics

**Previous Milestones:**
- v3.1: 18 plans, 7 phases, 3 days
- v4.1: 27 plans, 9 phases, 5 days
- v4.3: 2 plans, 1 phase, ~5 minutes execution

**v4.2 Progress:**
- Phase 43: 3 plans, 2 waves, ~18 minutes execution
- Phase 44: 3 plans, 2 waves, ~18 minutes execution
- Phase 45: 3 plans, 2 waves, ~18 minutes execution

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
- shouldRerenderOnTransaction: false for TipTap performance (CRITICAL)
- immediatelyRender: true for instant editor rendering
- @tiptap/suggestion for slash command and wiki link triggers
- tippy.js for popup positioning
- Custom window events (isometry:save-card, isometry:send-to-shell) for cross-component communication
- useEditorState with selector for minimal toolbar re-renders
- getText() for markdown extraction (simpler than storage.markdown.getMarkdown)
- WikiLink as Mark extension for inline [[ link syntax
- LINK edge type in sql.js edges table for graph connectivity
- queryCardsForSuggestions and createLinkEdge utilities for sql.js interaction

**Phase 44 decisions:**
- Simulation timeout: 300 ticks OR 3 seconds to save CPU
- EDGE_TYPE_STYLES with colors and dasharray per GRAPH type
- Default 100 node limit for performance
- Node selection updates activeCard for cross-canvas sync
- DDL blocking in Data Inspector (SELECT only)
- Auto-LIMIT 1000 for queries without explicit LIMIT
- Timeline facet default: created_at
- Event radius: 6px default, 8px on hover
- Fallback domain: 30 days from now for empty timeline

**Phase 50 decisions:**
- Hook test mocks require db.exec() method, not empty object
- Requirement traceability tests tagged with [FOUND-XX] in test names
- dataVersion-based cache invalidation for hook refresh behavior

### Pending Todos

None — Phase 44 complete, ready for Phase 46 planning.

### Blockers/Concerns

**Pre-existing Issues (not blocking v4.2):**
- ~40 TypeScript errors in grid-interaction, grid-selection, logging modules (pre-existing)
- Directory health check failing for src/services (22/15 files) - pre-existing cleanup needed

**v4.2 Implementation Notes:**
- Shell pane now functional with WebSocket, copy/paste, history, GSD execution
- Preview pane 100% complete - SuperGrid, Network Graph, Timeline, Data Inspector all functional
- Capture pane now uses TipTap with slash commands, wiki links, and auto-save
- Critical: Bidirectional sync trigger for notebook_cards ↔ nodes LATCH data (Phase 46)
- v4.3 property classification now available for Navigator faceted navigation

## Session Continuity

Last session: 2026-02-10
Stopped at: Completed 44-03-PLAN.md (Timeline Visualization)
Resume file: None

## Next Steps

1. Run `/gsd:plan-phase 46` for Live Data Synchronization (all dependencies met)
2. Phase 46: Live Data Synchronization (SYNC-01 to SYNC-03)
3. v4.2 release after Phase 46 complete
