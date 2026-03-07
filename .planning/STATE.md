---
gsd_state_version: 1.0
milestone: v4.1
milestone_name: Sync + Audit
status: in-progress
last_updated: "2026-03-07T03:28:57Z"
progress:
  total_phases: 2
  completed_phases: 2
  total_plans: 8
  completed_plans: 7
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.
**Current focus:** v4.1 Sync + Audit — Phase 38 (Virtual Scrolling) complete, ready for Phase 39

## Current Position

Phase: 39 of 41 (CloudKit Architecture)
Plan: 2 of 3 in current phase
Status: In Progress
Last activity: 2026-03-07 — Completed 39-02-PLAN.md (CKSyncEngine Infrastructure)

Progress: [######░░░░] 62%

## Performance Metrics

**Velocity:**
- v4.0 milestone: 9 plans in 2 days (4.5 plans/day)
- v3.1 milestone: 12 plans in 2 days (6 plans/day)
- v3.0 milestone: 35 plans in 2 days (17.5 plans/day)

*Updated after each plan completion*

## Accumulated Context

### Decisions

All TypeScript architectural decisions locked (D-001..D-010). Full logs in PROJECT.md.

Research decisions for v4.1:
- Change tracking must use in-memory session-level tracking (not SQLite triggers) to avoid ETL false positives
- Virtual scrolling must use data windowing (not DOM virtualization) to preserve D3 data join
- CloudKit record sync REPLACES iCloud Documents file sync (not supplements) -- dual sync causes silent data loss
- Bridge protocol extends existing native:sync message type (no new message types)

Phase 37-01 decisions:
- AuditState is not a StateCoordinator provider -- audit toggle is pure CSS overlay, no Worker re-query needed
- DedupEngine deletion detection is source-scoped and filters deleted_at IS NULL
- AuditState._cardSourceMap only tracks inserted/updated IDs, not deleted

Phase 37-02 decisions:
- SVG views use rect elements for audit stripes (SVG does not support CSS border); HTML views use data-* attributes
- Aggregation styling NOT scoped under .audit-mode -- always visible (data type distinction, not change tracking)
- auditState singleton exported at module level to avoid constructor injection changes across 9 views

Phase 37-03 decisions:
- AuditOverlay uses constructor DI for AuditState -- enables isolated testing
- bridge.importFile/importNative wrapped at app entry point rather than modifying WorkerBridge.ts
- AuditLegend close dismisses legend but audit stays ON -- simple UX
- SVG eye icon for toggle button -- cleaner visual at 16px

Phase 38-01 decisions:
- Data windowing approach: virtualizer filters data rows before D3 join, not DOM virtualization
- Row header rendering moved after virtualizer windowing to enable row header filtering
- getRowHeight callback reads --sg-row-height dynamically on every call (handles zoom changes)
- Aggregate injection loops use windowedLeafRowCells to skip non-visible rows

Phase 38-02 decisions:
- performance.now() in standard it() tests instead of Vitest bench API (bench requires separate runner)
- startRow clamped to min(max(0, firstVisible - OVERSCAN), endRow) to guarantee valid range invariant

Phase 39-01 decisions:
- Inlined saveCheckpointDirect logic into saveCheckpoint (removed indirection since useCoordinator branching is gone)
- migrateFromUbiquityIfNeeded uses simple FileManager.copyItem instead of NSFileCoordinator (Application Support is local storage)

Phase 39-02 decisions:
- CKSyncEngine.State.Serialization persisted via JSONEncoder (not NSKeyedArchiver) -- Serialization conforms to Codable natively
- SyncManager stored on BridgeManager (not IsometryApp struct) -- actors cannot be @StateObject, App structs are immutable
- BatchSnapshot pattern: capture actor-isolated state into Sendable struct for CKSyncEngine synchronous closure
- CKRecord extension methods marked nonisolated to avoid MainActor inference in Xcode 26

### Pending Todos

None.

### Blockers/Concerns

- Provisioning profile needs iCloud Documents entitlement regeneration (pre-existing from v2.0)
- CloudKit sync requires iCloud entitlement — provisioning profile issue must be resolved before Phase 39
- CSS content-visibility: auto requires Safari 18+ (iOS 18+) — iOS 17 users get JS windowing only

## Performance Metrics (v4.1)

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 37-01 | Audit Data Infrastructure | 5min | 2 | 10 |
| 37-02 | Audit Visual Overlay | 7min | 2 | 8 |
| 37-03 | Audit Toggle + Legend + Wiring | 5min | 2 | 7 |
| 38-01 | Virtual Scrolling Foundation | 10min | 2 | 5 |
| 38-02 | Performance Benchmarking | 62min | 2 | 2 |
| 39-01 | Database Storage Migration | 5min | 1 | 3 |
| 39-02 | CKSyncEngine Infrastructure | 12min | 2 | 4 |

## Session Continuity

Last session: 2026-03-07
Stopped at: Completed 39-02-PLAN.md (CKSyncEngine Infrastructure)
Resume: Continue Phase 39 with 39-03-PLAN.md
