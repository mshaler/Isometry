# Phase 120: Ship Prep - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

App is TestFlight-ready with production FeatureGate, fixed tier/notebook bugs, and extended graph algorithm visualization. Two parallel plans: (1) Bug Fixes + Release Readiness, (2) Graph Algorithms Phase 2. No new capabilities — fixes, hardening, and visual extensions to existing graph algorithms.

</domain>

<decisions>
## Implementation Decisions

### Graph Visualization (GALG-01..04)
- Shortest path target node: circle badge overlaid on the node showing hop count (notification-badge style)
- Single-source shortest path distance coloring: `d3.interpolateWarm` (yellow → orange → red, closer = warm)
- Edge betweenness stroke thickness range: 1px → 6px (subtle, low visual noise)
- Weighted Dijkstra cost: numeric attribute picker — user selects any numeric column from connections table as weight; falls back to uniform weight = 1 when no column selected

### FeatureGate Release Mode (SHIP-01)
- Remove DEBUG bypass: flip default so Release builds always enforce, Debug builds bypass unless `ISOMETRY_ENFORCE_GATES=1` env var is set (reverse current behavior)
- Keep the `ISOMETRY_ENFORCE_GATES` env var for integration test override
- No new feature gates — keep current three only (fileImport, cloudSave, exportData at Pro tier)
- All 9 views remain Free; graph algorithms remain Free; Workbench tier not gated yet

### SubscriptionManager Bug Fix (BUGF-01)
- `tierForProductID()` must return `.free` (not `.pro`) for unknown product identifiers

### Notebook New Card Fix (BUGF-02)
- Two bugs: (1) Recent Cards list doesn't refresh after card creation, (2) selection doesn't trigger editor load — stays in idle/buffering state
- Expected behavior after fix: New Card creates the card via MutationManager, auto-selects it, Recent Cards refreshes to show it at top, AND notebook editor opens the card ready for content editing

### TestFlight Workflow (SHIP-02, SHIP-03, SHIP-04)
- SHIP-02: Claude generates step-by-step provisioning profile regeneration instructions for Apple Developer Portal with CloudKit entitlement (both iOS and macOS targets)
- SHIP-03: Create a `.storekit` configuration file with placeholder product IDs for Pro and Workbench subscription tiers (editable later when real App Store Connect products are set up)
- SHIP-04: Both iOS and native macOS (not Catalyst) targets must archive cleanly for TestFlight upload

### Claude's Discretion
- Badge styling details (size, font, background color for hop count circle)
- Exact interpolateWarm domain mapping (linear or log scale)
- Edge betweenness computation approach (exact Brandes vs sampling threshold — existing handler already has both paths)
- Numeric attribute picker UI placement in NetworkView controls
- StoreKit Configuration file product ID naming convention
- Exact provisioning profile step ordering for dual-target (iOS + macOS)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Native Shell Architecture
- `native/Isometry/CLAUDE.md` — Complete native shell guide, bridge protocol, FeatureGate design, file map
- `native/Isometry/Isometry/FeatureGate.swift` — Current DEBUG bypass implementation (lines 44-48, 54-57)
- `native/Isometry/Isometry/SubscriptionManager.swift` — tierForProductID() at line 219

### Graph Algorithms
- `src/worker/handlers/graph-algorithms.handler.ts` — Existing betweenness, community detection, centrality; extends for GALG-01..04
- `src/worker/protocol.ts` — Worker message protocol (graph:compute, graph:shortestPath, graph:metrics-read)
- `src/database/queries/graph.ts` — shortestPath SQL + BFS implementation

### Notebook / Card Creation
- `src/ui/NotebookExplorer.ts` — New Card button (line 353), _enterBuffering (line 501), _evaluateBufferingCommit (line 536)
- `src/mutations/inverses.ts` — createCardMutation (line 103)

### Project Architecture
- `CLAUDE-v5.md` — Canonical JS runtime decisions (D-001..D-020)
- `.planning/codebase/CONVENTIONS.md` — Naming, formatting, linting rules
- `.planning/codebase/INTEGRATIONS.md` — StoreKit 2, CloudKit integration patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FeatureGate.swift`: Already has `isAllowed()` pure function + `ISOMETRY_ENFORCE_GATES` env var — just needs default flip
- `FeatureGateTests.swift` + `SubscriptionManagerTests.swift`: Existing test coverage to extend
- `graph-algorithms.handler.ts`: Has both exact Brandes betweenness AND sampling-based approximate — reuse for GALG-03
- `graphology-shortest-path` + `graphology-metrics/centrality/betweenness`: npm deps already installed
- `graph.ts`: `shortestPath()` BFS already works — GALG-01 badge is visualization on top of existing data
- `NotebookExplorer.ts`: Full creation state machine (buffering → editing → idle) — BUGF-02 is fixing the transition

### Established Patterns
- Worker protocol: `graph:compute` message with algorithm name + params — extend for new algorithm variants
- D3 data join: all view rendering uses `.data()` + `.join()` — graph viz follows same pattern
- MutationManager: all card CRUD goes through `execute(mutation)` — NotebookExplorer already uses this correctly
- Provider subscription: `_selection.select(id)` fires subscriber chain — issue is likely subscriber not triggering NotebookExplorer refresh

### Integration Points
- NetworkView: renders nodes + edges via D3 force layout — badge/coloring/thickness are D3 attribute bindings on existing elements
- StateCoordinator: orchestrates provider notifications — Recent Cards refresh likely needs subscription wiring
- BridgeManager: dispatches `native:action` through FeatureGate — Release build path currently untested

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions captured above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 120-ship-prep*
*Context gathered: 2026-03-24*
