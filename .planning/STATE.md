# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** Transform the Isometry ecosystem with a capture-shell-preview workflow that bridges rapid note-taking with AI-assisted development, seamlessly integrating notebook cards into the existing PAFV+LATCH+GRAPH knowledge system.

**Current focus:** Phase 85 - Backend Infrastructure & Terminal Execution

## Current Position

Phase: 85 of 93 (Backend Infrastructure & Terminal Execution)
Plan: 3 of 5 complete
Status: In progress
Last activity: 2026-02-14 — Completed 85-03-PLAN.md (xterm.js Frontend Integration)

Progress (Phase 85): [██████░░░░] 60% (3 of 5 plans)
Overall: [████████░░] 88% (88 of ~100 total phases across all milestones)

## Current Milestone: v6.2 Capture Writing Surface

**Goal:** Transform Capture into a world-class writing surface combining Apple Notes fluency, Notion flexibility, and Obsidian power — with Isometry-native view embeds.

**Target features:**
- Apple Notes Fluency — Full keyboard shortcuts, smart formatting, auto-lists, inline checklists
- Notion Slash Commands — Block types, embeds, references
- Obsidian Power — Backlinks, templates, inline properties
- Isometry-Native Embeds — /supergrid, /network, /timeline live views

**Status:** Gathering requirements

## Previous Milestone: v6.1 SuperStack Enhancement (Paused)

**Goal:** Dramatically enhance SuperGrid via SuperStack—the nested hierarchical header system that transforms SuperGrid from a flat grid into a true dimensional pivot table.

**Phases:**
- Phase 89: Static Headers Foundation (6 requirements) ✓
- Phase 90: SQL Integration (5 requirements)
- Phase 91: Interactions (5 requirements)
- Phase 92: Data Cell Integration (4 requirements)
- Phase 93: Polish & Performance (5 requirements)

**Total requirements:** 25
**Resume:** `/gsd:plan-phase 90` when ready

## Current Milestone: v6.0 Interactive Shell — IN PROGRESS

**Goal:** Complete Shell implementation with working Terminal, Claude AI, and GSD GUI tabs.
**Status:** Phase 85 in progress

**Phases:**
- Phase 85: Backend Infrastructure & Terminal Execution (5 plans)
  - [x] 85-01: PTY Backend Infrastructure (~4m)
  - [x] 85-02: WebSocket Server Integration (~4m)
  - [x] 85-03: xterm.js Frontend Integration (~5m)
  - [ ] 85-04: Terminal Tab Component
  - [ ] 85-05: Terminal Verification
- Phase 86: Claude AI MCP Integration (7 requirements)
- Phase 87: GSD File Synchronization (7 requirements)
- Phase 88: Integration & Polish (verification only)

## Previous Milestone: v5.2 Cards & Connections — COMPLETE

**Goal:** Migrate from nodes/edges to cards/connections with 4-type constraint.
**Completed:** 2026-02-13

**Phase 84 Plans:**
- [x] 84-01: Schema migration with type constraints (~5m)
- [x] 84-02: TypeScript Card/Connection interfaces
- [x] 84-03: Data layer migration (~7m)
- [x] 84-04: Verification and cleanup (~8m)

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
| 85 (Backend Terminal) | 3/5 | ~4.3m | In Progress |
| 84 (Cards & Connections) | 4 | ~7m | Complete |
| 80 (Notebook Integration) | 2 | ~4.5m | Complete |
| 79 (Catalog Browser) | 3 | ~4.7m | Complete |

*Updated: 2026-02-14*

## Accumulated Context

### Decisions

Recent decisions affecting v6.1 work:

**SuperStack Implementation:**
- SSTACK-01: D3.js for all header rendering (enter/update/exit pattern)
- SSTACK-02: SQLite queries drive header discovery (GROUP BY, json_each, strftime)
- SSTACK-03: Header trees built from flat query results (not pre-hierarchical data)
- SSTACK-04: Spans calculated bottom-up (leaves have span=1, parents sum children)

**Architecture (from v4.1):**
- Bridge elimination via sql.js direct access (eliminated 40KB MessageBridge)
- D3.js queries SQLite synchronously in same memory space

**Terminal Security (from 85-01):**
- TERM-01: Shell whitelist validation (/bin/zsh, /bin/bash, /bin/sh only)
- TERM-02: spawn() with args array, never string interpolation
- TERM-03: 64KB output buffer for reconnection replay

**Message Routing (from 85-02):**
- TERM-04: Type guards for message dispatch (isTerminalMessage, isCommandMessage, etc.)
- TERM-05: Local interface to avoid circular dependency
- TERM-06: Layered dispatch: ping -> terminal -> file-monitoring -> command -> unknown

**Frontend Integration (from 85-03):**
- TERM-07: Terminal callbacks defined in WebSocketDispatcherOptions interface
- TERM-08: useTerminal uses dispatcher methods, not direct WebSocket messages
- TERM-09: Session ID generated client-side (term-{timestamp}-{random})

See PROJECT.md Key Decisions table for full history.

### Pending Todos

None yet.

### Blockers/Concerns

**v6.1 SuperStack:**
- No blockers identified
- Implementation plan is comprehensive with type definitions ready
- File structure already specified: `src/superstack/`

**Technical Debt:**
- knip unused exports: 275 reported (baseline ratchet at 1000, needs cleanup)
- Directory health: src/services (22/15 files)

## Session Continuity

Last session: 2026-02-14
Stopped at: Phase 85 Plan 03 complete, ready for Plan 04 (Terminal Tab Component)
Resume file: .planning/phases/85-backend-terminal/85-04-PLAN.md

**Phase 85 Plan 03 Complete:**
- claudeCodeWebSocketDispatcher.ts: Terminal callbacks and send methods
- useTerminal.ts: Real PTY communication via dispatcher
- Keystroke forwarding, resize sync, session cleanup

**Next step:** Execute Plan 85-04 (Terminal Tab Component)
