---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Native Shell
status: unknown
last_updated: "2026-03-03T22:41:43.273Z"
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 11
  completed_plans: 11
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.
**Current focus:** v2.0 Native Shell — Phase 14 (iCloud + StoreKit Tiers) next

## Current Position

```
[v0.1 SHIPPED] [v0.5 SHIPPED] [v1.0 SHIPPED] [v1.1 SHIPPED] [v2.0 ◆ PHASE 14 next]
```

Phase: 14 of 14 (v2.0) — iCloud + StoreKit Tiers — In Progress (Plan 02 of 3 complete)
Next: Phase 14 Plan 03 — Wire SubscriptionManager into app, paywall UI, FeatureGate in BridgeManager
Last activity: 2026-03-03 — Phase 14 Plan 02 complete (SubscriptionManager, FeatureGate, .storekit config)

Progress: Phases 11-13 complete, Phase 14 in progress (Plan 02/03 done)

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
| Phase 12 P03 | 4 | 2 commits (3 tasks) | 3 files |
| Phase 13 P01 | 3 | 2 tasks | 2 files |
| Phase 13 P02 | 3 | 2 tasks | 3 files |
| Phase 13 P03 | 5 | 1 task | 10 files |
| Phase 14 P02 | 189 | 2 tasks | 3 files |
| Phase 14-icloud-storekit-tiers P01 | 4 | 2 tasks | 4 files |

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
- [Phase 12-03]: BridgeManager shared between IsometryApp and ContentView via init parameter (Option A) not @EnvironmentObject — explicit dependency, no magic
- [Phase 12-03]: Timer.scheduledTimer on main run loop chosen over Task.sleep loop — auto-pauses on background satisfying DATA-05 without extra code
- [Phase 12-03]: NSApplicationDelegateAdaptor for macOS quit save — ScenePhase.background doesn't fire on cmd-Q
- [Phase 12-03]: beginBackgroundTask expiration handler must call endBackgroundTask with proper closure capture to prevent watchdog kill
- [Phase 12-03]: webViewWebContentProcessDidTerminate is nonisolated — bridges to @MainActor via Task for Swift 6 compliance

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
- [Phase 13-01]: Notification.Name extensions live in ContentView.swift — same module, visible to IsometryCommands without extra import
- [Phase 13-01]: Import button posts notification only in Plan 01 — fileImporter modifier scoped to Plan 02 to keep plan boundaries clean
- [Phase 13-01]: NavigationSplitView detailOnly by default — maximises D3 canvas area per CONTEXT.md; sidebar toggle reveals sidebar
- [Phase 13-02]: JSONSerialization for sendFileImport payload — handles quotes, newlines, special chars in file content safely (no string interpolation)
- [Phase 13-02]: native:action uses kind discriminator (importFile) — extensible for future actions without new message types
- [Phase 13-02]: Text formats (json/csv/md) sent as UTF-8 text, xlsx sent as base64 — matches ETL parser expectations
- [Phase 13-02]: 50MB cap checked before reading file bytes into memory — prevents OOM on large files
- [Phase 13-02]: SourceType added as top-level import type in NativeBridge.ts — cleaner than inline import() syntax
- [Phase 13-03]: Per-size macOS icon PNGs generated instead of single 1024px — eliminates asset catalog build warnings
- [Phase 13-03]: Python struct+zlib for PNG generation — no PIL/external dependency needed
- [Phase 14]: [14-02] fileImport requires Pro tier per CONTEXT.md: Pro gates ETL/file import features
- [Phase 14]: [14-02] Combine import added explicitly -- StoreKit does not re-export ObservableObject/Published
- [Phase 14]: [14-02] .storekit groupNumber: Workbench=1 (highest priority), Pro=2 -- Apple uses lower=higher
- [Phase 14]: [14-02] Transaction.updates listener started first in init() before product loading per RESEARCH.md Pitfall 6

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
Stopped at: Completed 14-02-PLAN.md — SubscriptionManager, FeatureGate, Isometry.storekit created
Resume file: None — Phase 14 Plan 03 is next (wire tier into app, paywall UI, FeatureGate integration)
