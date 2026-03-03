---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Native Shell
status: in-progress
last_updated: "2026-03-03T16:51:00Z"
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 3
  completed_plans: 2
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.
**Current focus:** v2.0 Native Shell — Phase 12 (Bridge + Data Persistence)

## Current Position

```
[v0.1 SHIPPED] [v0.5 SHIPPED] [v1.0 SHIPPED] [v1.1 SHIPPED] [v2.0 ◆ PHASE 12]
```

Phase: 12 of 14 (v2.0) — Bridge + Data Persistence
Plan: 02/03 — COMPLETED (12-01 Bridge + 12-02 DatabaseManager)
Status: Phase 12 in progress — Plans 01 and 02 complete, Plan 03 pending
Last activity: 2026-03-03 — Phase 12 Plan 01 completed (BridgeManager.swift + NativeBridge.ts bidirectional bridge)

Progress: [██████░░░░] 67% (2/3 plans)

## Performance Metrics

| Metric | v0.1 | v0.5 | v1.0 | v1.1 |
|--------|------|------|------|------|
| Tests passing | 151 | 774 | 897 | ~1,433 |
| TypeScript LOC | 3,378 | 20,468 | 24,298 | 70,123 |
| Insert p99 | <10ms | — | — | — |
| FTS p99 | <100ms | — | — | — |
| Graph traversal p99 | <500ms | — | — | — |
| Render p95 (100 cards) | — | — | <16ms | — |
| Phase 11 P01 | 3 | 3 tasks | 5 files |
| Phase 11 P02 | ~90 | 3 tasks | 11 files |
| Phase 12 P01 | 24 | 2 tasks (TDD) | 9 files |
| Phase 12 P02 | 9 | 1 task (TDD) | 3 files |

## Accumulated Context

### Decisions

All TypeScript architectural decisions locked (D-001..D-010). Full logs in PROJECT.md.

Phase 12 decisions:
- [Phase 12-01]: WeakScriptMessageHandler as private nested class in BridgeManager prevents WKUserContentController retain cycle
- [Phase 12-01]: Two-phase native launch: waitForLaunchPayload() blocks before WorkerBridge creation so dbData bytes arrive before WASM init
- [Phase 12-01]: Binary data always base64-encoded through nativeBridge — raw Uint8Array arrives as dictionary {0:byte,...}
- [Phase 12-01]: isDirty is computed property delegating to DatabaseManager — no dual flags, single source of truth
- [Phase 12-01]: DEFAULT_WORKER_CONFIG narrowed to Pick<WorkerBridgeConfig, timeout|debug> — wasmBinary/dbData are init-time only
- [Phase 12-02]: DatabaseManager uses two-init pattern — production uses Application Support/Isometry/, test uses custom baseDirectory
- [Phase 12-02]: isDirty lives inside DatabaseManager actor as single source of truth — BridgeManager delegates via databaseManager?.isDirty ?? false
- [Phase 12-02]: .tmp write does NOT use .atomic option — rotation sequence (write .tmp → rotate .db to .bak → rename .tmp to .db) is controlled manually

v2.0 key decisions (pre-locked by research):
- Swift owns exactly 5 concerns: MIME serving, 5-message bridge, db blob persistence, file picker, lifecycle
- WKScriptMessageHandler (not WKScriptMessageHandlerWithReply) — avoids Swift 6 Sendable issues
- sql.js remains source of truth; native file = checkpoint target only (no parallel SQL schema)
- iCloud Documents (file-level sync) for v2.0; full CloudKit subscription sync deferred to v2+
- WASM MIME fix is Phase 11's first deliverable — gating risk for entire milestone
- [Phase 11]: build:native skips tsc due to pre-existing ETL test type errors; Vite transpiles correctly
- [Phase 11]: TreeView omits selectionProvider: SelectionProvider lacks SelectionProviderLike interface
- [Phase 11]: Dual Vite configs: vite.config.ts (library/test) and vite.config.native.ts (app-mode/native)
- [Phase 11]: Message-driven Worker init eliminates auto-init/wasm-init race condition
- [Phase 11]: db:query message type added for ViewManager SELECT queries (db:exec is DML-only)
- [Phase 11]: ContentView always uses app:// scheme; DEBUG adds console forwarding + isInspectable

### Known Technical Debt

- WKWebView WASM MIME type rejection — ✅ RESOLVED in Phase 11 via WKURLSchemeHandler + WASM pre-loading
- Schema loading conditional dynamic import (node:fs vs ?raw) — carried from v1.1
- GalleryView pure HTML (no D3 data join) — carried from v1.0

### Blockers/Concerns

- Phase 11: WASM MIME fix ✅ VALIDATED — app boots in Xcode with correct WASM loading
- Phase 12: db.export() timing at 10K+ cards is unvalidated — benchmark in Phase 12
- Phase 12: scenePhase unreliable on macOS — use applicationWillTerminate instead
- Phase 14: StoreKit 2 requires App Store Connect product setup (external dependency)

## Session Continuity

Last session: 2026-03-03
Stopped at: Phase 12 Plan 01 complete — BridgeManager.swift + NativeBridge.ts bidirectional bridge, 1172 TS tests passing
Resume file: None — continue with Phase 12 Plan 03 (ContentView integration)
