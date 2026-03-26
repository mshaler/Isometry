---
gsd_state_version: 1.0
milestone: v9.2
milestone_name: Alto Index Import
status: planning
stopped_at: Completed 124-02-PLAN.md
last_updated: "2026-03-26T16:31:50.081Z"
last_activity: 2026-03-25 — v9.2 roadmap created; 13 requirements mapped to 3 phases
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 12
  completed_plans: 11
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Current focus:** v9.2 Alto Index Import -- Phase 123: Directory Discovery

## Current Position

Phase: 123 of 125 (Directory Discovery)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-03-25 — v9.2 roadmap created; 13 requirements mapped to 3 phases

Progress: [░░░░░░░░░░] 0%

## Milestone History

- ✅ v8.3 Plugin E2E Test Suite: Phases 104-107 complete (4 phases, 8 plans, 20 reqs, CI hard gate)
- ✅ v8.4 Consolidate View Navigation: Phase 108 complete (1 phase, 2 plans, ViewZipper removed)
- ✅ v8.5 ETL E2E Test Suite: Phases 109-113 complete (5 phases, 12 plans, 30 reqs)
- ✅ v9.0 Graph Algorithms: Phases 114-119 complete (6 phases, 13 plans, 23 reqs)
- ✅ v9.1 Ship Prep: Phases 120-122 complete (3 phases, 8 plans, TestFlight-ready)

## Performance Metrics

**Velocity:**
- v9.1 milestone: 3 phases, 8 plans
- v9.0 milestone: 6 phases, 13 plans
- v8.5 milestone: 5 phases, 12 plans
- v8.4 milestone: 1 phase, 2 plans
- v8.3 milestone: 4 phases, 8 plans

*Updated after each milestone completion*

## Accumulated Context

### Decisions

All TypeScript architectural decisions locked (D-001..D-020). Full logs in PROJECT.md.
- [Phase 121-ship-hardening]: MetricKitSubscriber uses @MainActor + nonisolated delegate with Task hop for thread-safe @Published updates
- [Phase 121-ship-hardening]: PrivacyInfo.xcprivacy includes UserDefaults (CA92.1) and FileTimestamp (DDA9.1) required reason APIs
- [Phase 122-supergrid-convergence]: BridgeDataAdapter uses getCellKey not buildCellKey for key consistency with PivotGrid lookups
- [Phase 122-supergrid-convergence]: 336 monolithic SuperGrid DOM-internal tests marked it.skip(CONV-06) -- behavior verified by E2E
- [Phase 123]: alto_index runNativeImport redirects to directory picker (DISC-01 discovery-first flow)
- [Phase 123]: pickAltoDirectory NotificationCenter bridges both JS-triggered (native:request-alto-discovery) and native UI paths to same picker
- [Phase 123]: DirectoryDiscoverySheet uses showModal() directly (not AppDialog) for checkbox list; badge data-type maps exact Swift subdirectory names to CSS provenance tokens; alto-discovery CustomEvent keeps NativeBridge decoupled from UI
- [Phase 123]: Plan 02: DirectoryDiscoverySheet uses showModal() directly (not AppDialog) for checkbox list; badge data-type maps exact Swift subdirectory names to CSS provenance tokens; alto-discovery CustomEvent keeps NativeBridge decoupled from UI
- [Phase 124]: fetchCardsForDirectory returns [CanonicalCard] synchronously (not AsyncStream) since single directories are small enough; sourceType threaded through sendChunk as optional for backward compatibility; security-scoped resource access managed in BridgeManager handler not inside runAltoImport
- [Phase 124-02]: dedupSource normalisation: alto_index_* source types normalise to alto_index for DedupEngine lookup since cards are stored with source=alto_index; full sourceType preserved for catalog entries
- [Phase 124-02]: importCoordinator.webView wired at call site inside native:request-alto-import handler before runAltoImport (not at construction); mirrors runNativeImport pattern

### Roadmap Evolution

- Phase 123 added: Directory Discovery (DISC-01..03)
- Phase 124 added: Selective Import + Partitioning (IMPT-01..04, BEXL-01..02)
- Phase 125 added: Dataset Lifecycle Management (DSET-01..04)

### Blockers/Concerns

- BEXL-01/02: Binary exclusion must be enforced at AltoIndexAdapter level -- attachment fields are already in YAML frontmatter as metadata strings, but adapter must explicitly skip reading attachment file bytes
- DSET-04: Diff preview requires computing card fingerprints before committing re-import; DedupEngine already has source+source_id keying but diff surface is new UI work

## Session Continuity

Last session: 2026-03-26T16:31:50.078Z
Stopped at: Completed 124-02-PLAN.md
Resume: /gsd:plan-phase 123 to break down Phase 123 into execution plans
