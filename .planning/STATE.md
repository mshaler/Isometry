---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Native Shell
status: unknown
last_updated: "2026-03-02T16:11:17.840Z"
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 2
  completed_plans: 1
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.
**Current focus:** v2.0 Native Shell — Phase 11 (Xcode Shell + WKURLSchemeHandler)

## Current Position

```
[v0.1 SHIPPED] [v0.5 SHIPPED] [v1.0 SHIPPED] [v1.1 SHIPPED] [v2.0 ◆ PHASE 11]
```

Phase: 11 of 14 (v2.0) — Xcode Shell + WKURLSchemeHandler
Plan: — (ready to plan)
Status: Ready to plan
Last activity: 2026-03-02 — v2.0 roadmap created (Phases 11-14, 28 requirements)

Progress: [░░░░░░░░░░] 0% (0/TBD plans)

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

## Accumulated Context

### Decisions

All TypeScript architectural decisions locked (D-001..D-010). Full logs in PROJECT.md.

v2.0 key decisions (pre-locked by research):
- Swift owns exactly 5 concerns: MIME serving, 5-message bridge, db blob persistence, file picker, lifecycle
- WKScriptMessageHandler (not WKScriptMessageHandlerWithReply) — avoids Swift 6 Sendable issues
- sql.js remains source of truth; native file = checkpoint target only (no parallel SQL schema)
- iCloud Documents (file-level sync) for v2.0; full CloudKit subscription sync deferred to v2+
- WASM MIME fix is Phase 11's first deliverable — gating risk for entire milestone
- [Phase 11]: build:native skips tsc due to pre-existing ETL test type errors; Vite transpiles correctly
- [Phase 11]: TreeView omits selectionProvider: SelectionProvider lacks SelectionProviderLike interface
- [Phase 11]: Dual Vite configs: vite.config.ts (library/test) and vite.config.native.ts (app-mode/native)

### Known Technical Debt

- WKWebView WASM MIME type rejection — resolved in Phase 11 via WKURLSchemeHandler
- Schema loading conditional dynamic import (node:fs vs ?raw) — carried from v1.1
- GalleryView pure HTML (no D3 data join) — carried from v1.0

### Blockers/Concerns

- Phase 11: WASM MIME fix must be validated in Release build (not DEBUG dev server)
- Phase 12: db.export() timing at 10K+ cards is unvalidated — benchmark in Phase 12
- Phase 12: scenePhase unreliable on macOS — use applicationWillTerminate instead
- Phase 14: StoreKit 2 requires App Store Connect product setup (external dependency)

## Session Continuity

Last session: 2026-03-02
Stopped at: v2.0 roadmap created — Phases 11-14 defined, 28 requirements mapped
Resume file: None — start with `/gsd:plan-phase 11`
