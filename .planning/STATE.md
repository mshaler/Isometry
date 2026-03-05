---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Native ETL
status: ready_to_plan
last_updated: "2026-03-05T00:00:00.000Z"
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.
**Current focus:** v4.0 Native ETL — Phase 33: Native ETL Foundation

## Current Position

Phase: 33 of 36 (Native ETL Foundation)
Plan: —
Status: Ready to plan
Last activity: 2026-03-05 — v4.0 roadmap created (Phases 33-36)

Progress: [░░░░░░░░░░] 0% (v4.0)

## Performance Metrics

**Velocity:**
- Total plans completed: 1 (v3.1 Phase 29 Plan 01)
- Phase 29 Plan 01: 5m 17s, 2 tasks, 5 files

*Updated after each plan completion*

## Accumulated Context

### Decisions

All TypeScript architectural decisions locked (D-001..D-010). Full logs in PROJECT.md.
All v3.0 SuperGrid decisions documented in PROJECT.md Key Decisions table.

- v3.1 Phase 28 completed: N-Level Foundation (depth limit removed, compound keys, asymmetric grid)
- v3.1 Phase 29 Plan 01 completed: buildGridTemplateColumns updated to rowHeaderDepth count (N*80px); RHDR test scaffolds in place for Plan 02
- rowHeaderDepth defaults to 1 for backward compatibility; each additional row axis level adds one 80px header column
- RHDR test contract: data-level attribute on row headers required by Plan 02 rendering implementation
- v4.0 architecture: Swift adapters → CanonicalCard JSON → existing native:action bridge → ImportOrchestrator (additive-only)
- Reminders + Calendar MUST use EventKit (App Store sandbox blocks direct SQLite for these databases)
- Notes adapter uses GRDB.swift with ?immutable=1 URI for WAL-safe read-only access
- Notes protobuf content deferred to Phase 36 — title-only ships first to validate pipeline without protobuf risk
- 200-card chunked bridge dispatch required from Phase 33 day one — not retrofitted later
- CoreDataTimestampConverter shared utility must exist in Phase 33 before any adapter writes a date field
- App Store vs direct distribution decision affects NSOpenPanel vs Full Disk Access path — confirm before Phase 33

### Pending Todos

None.

### Blockers/Concerns

- Phase 35 (Notes): ZTITLE1 vs ZTITLE2 column name discrepancy must be resolved via PRAGMA table_info on real macOS 14/15 hardware before writing queries
- Phase 36 (Protobuf): notestore.proto Document→Note→note_text field path unverified against macOS 15 — mandatory pre-implementation spike
- Phase 33 pre-work: App Store vs direct distribution decision needed to finalize PermissionManager architecture

## Session Continuity

Last session: 2026-03-05
Stopped at: Completed 29-multi-level-row-headers/29-01-PLAN.md
Resume: Run /gsd:execute-phase 29 02 (Plan 02 — multi-level row header rendering)
