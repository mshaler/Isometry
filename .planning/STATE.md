---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Native ETL
status: defining_requirements
last_updated: "2026-03-05T23:00:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.
**Current focus:** v4.0 Native ETL — macOS-first direct SQLite importers for Apple Notes, Reminders, Calendar

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-05 — Milestone v4.0 started (v3.1 SuperStack paused at Phase 28)

## Performance Metrics

**Velocity:**
- Total plans completed: 0 (v4.0)

*Updated after each plan completion*

## Accumulated Context

### Decisions

All TypeScript architectural decisions locked (D-001..D-010). Full logs in PROJECT.md.
All v3.0 SuperGrid decisions documented in PROJECT.md Key Decisions table.

- v3.1 Phase 28 completed: N-Level Foundation (depth limit removed, compound keys, asymmetric grid)
- v3.1 paused at Phase 28 — Phases 29-32 reserved but not started
- v4.0 architecture: macOS direct SQLite reads → CanonicalCard JSON → existing bridge → ImportOrchestrator
- Direct SQLite chosen over EventKit for macOS (faster, richer data); iOS EventKit deferred
- Apple Notes content requires gzip+protobuf decompression (not plaintext in NoteStore.sqlite)
- macOS TCC/Full Disk Access required for reading system database containers

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-05
Stopped at: Defining v4.0 milestone requirements
Resume: Continue requirements definition → roadmap creation
