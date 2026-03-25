# Phase 118: Polish + E2E - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Algorithm results stay synchronized with data changes (stale indicator), multi-algorithm overlays compose correctly (community color + centrality/PageRank size simultaneously), hover tooltip shows exact numeric scores, reset returns NetworkView to its default state, and a Playwright E2E spec provides a CI hard gate for the full compute-to-render pipeline. No new algorithms, no new PAFV axes, no new sidebar panels.

</domain>

<decisions>
## Implementation Decisions

### Stale indicator (GFND-04)
- Badge location: warning dot/badge on the AlgorithmExplorer sidebar section header + inline status text "⚠ Results may be outdated" when section is expanded
- Trigger: any MutationManager operation that inserts, updates, or deletes cards or connections marks graph_metrics as stale. Covers imports, manual edits, undo/redo, and ETL operations
- Persistence: session-only, tracked in-memory. No ui_state persistence — on page reload, no stale indicator shows (graph_metrics table still exists but user has no expectation of freshness after restart)
- Clearing: any successful Run of any algorithm clears the stale flag entirely. Simple model: stale means "data changed since last compute", any recompute addresses that
- Reset button also clears the stale indicator (restores to clean state)

### Multi-algorithm overlay (PAFV-04)
- Cumulative from _metricsMap: graph_metrics already stores all 6 columns per card via INSERT OR REPLACE. Running community writes community_id; running centrality writes centrality. _metricsMap loads ALL columns on each applyAlgorithmEncoding call. Encoding composes: community_id→fill, last-numeric-algorithm→radius
- Size encoding: last-computed numeric algorithm drives node size. If user runs PageRank then community, size stays PageRank-based. If user runs centrality then community, size switches to centrality. Community always drives color when present
- Legend: combined legend showing both active encodings — community color swatches AND size scale gradient in the same floating panel. Reflects what the user actually sees on the graph
- No UI changes to AlgorithmExplorer needed — cumulative behavior is implicit from persistent graph_metrics

### Hover tooltip (CTRL-03)
- Content: card name (bold header) + all non-null computed metrics from graph_metrics. Shows: PageRank: 0.042, Centrality: 0.18, Community: 3, Clustering: 0.67. Only metrics that have been computed (non-null) appear
- Rendering: d3-tip or equivalent tooltip library for polished positioning and animations
- Activation: tooltip only appears on nodes that have non-null graph_metrics data. Before any algorithm is run, no tooltip (existing node labels suffice). Keeps tooltip focused on algorithm scores per CTRL-03 requirement
- Trigger: mouseenter shows, mouseleave hides

### Clear/Reset (CTRL-04)
- Already partially implemented: AlgorithmExplorer Reset button exists, wired to NetworkView.resetEncoding()
- Phase 118 additions: Reset also clears the stale indicator flag, and resets legend to hidden state
- Reset does NOT clear graph_metrics table — metrics persist for potential re-use. Only visual encoding is reset

### E2E spec
- Single Playwright spec file covering the full compute-to-render critical path:
  1. Select algorithm in AlgorithmExplorer
  2. Click Run
  3. Assert graph_metrics rows via window.__isometry.queryAll()
  4. Assert NetworkView SVG has encoding attributes (fill/radius changes on nodes)
  5. Click Reset, assert defaults restored
- Multi-algorithm overlay test case: run community (assert color), then run centrality (assert size changed while color persists). Validates PAFV-04 end-to-end
- CI hard gate: failure blocks merge, same treatment as the 15 existing E2E specs from Phase 107

### Claude's Discretion
- Exact d3-tip configuration and CSS styling for tooltip
- MutationManager hook mechanism for staleness detection (subscription vs event)
- How _reapplyEncoding determines which numeric metric drives size (track last-run algorithm ID)
- SVG attribute selectors for E2E assertions
- Stale badge CSS styling (dot color, animation)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — GFND-04 (stale indicator), PAFV-04 (multi-algorithm overlay), CTRL-03 (hover tooltip), CTRL-04 (clear/reset)

### Prior Phase Context
- `.planning/phases/114-storage-foundation/114-CONTEXT.md` — graph_metrics DDL, INSERT OR REPLACE pattern, sanitizeAlgorithmResult
- `.planning/phases/115-algorithm-engine/115-CONTEXT.md` — Algorithm response shapes, disconnected graph handling, batch compute model
- `.planning/phases/116-schema-integration/116-CONTEXT.md` — AlgorithmExplorer architecture, SchemaProvider graph metric injection, FilterProvider scope
- `.planning/phases/117-networkview-enhancement/117-CONTEXT.md` — Node encoding (single circle), _metricsMap, resetEncoding, legend panel, pick mode, edge highlighting

### Existing Implementation (modify)
- `src/ui/AlgorithmExplorer.ts` — Add stale indicator badge, staleness flag management
- `src/views/NetworkView.ts` — Modify _reapplyEncoding for cumulative overlay, add d3-tip tooltip, update legend for combined view
- `src/views/NetworkView.ts` lines 631-670 — applyAlgorithmEncoding (modify for cumulative metric composition)
- `src/views/NetworkView.ts` lines 672-695 — resetEncoding (add stale indicator clearing)

### Staleness trigger
- `src/mutations/MutationManager.ts` — Hook point for card/connection mutation detection

### E2E infrastructure
- `e2e/helpers/etl.ts` — importNativeCards(), assertCatalogRow(), resetDatabase(), window.__isometry.queryAll()
- `e2e/` — Existing 15+ Playwright E2E specs for CI hard gate pattern reference

### Graph metrics (read)
- `src/database/queries/graph-metrics.ts` — readGraphMetrics, readAllGraphMetrics
- `src/worker/WorkerBridge.ts` — graph:compute, graph:metrics-read bridge methods

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `NetworkView._metricsMap`: Already loads ALL 6 metric columns per card — cumulative overlay reads both community_id→fill and centrality→radius from the same map
- `NetworkView._reapplyEncoding()`: Existing method that maps metrics to D3 visual attributes — extend for cumulative composition
- `NetworkView._updateLegend()`: Already builds community swatches + size scale — extend for combined legend
- `AlgorithmExplorer._statusEl`: Existing status line element — can add stale warning text here
- `AlgorithmExplorer._resetButton`: Already wired to onResetCallback → NetworkView.resetEncoding()
- `MutationManager`: Central mutation dispatch — subscription point for staleness detection

### Established Patterns
- Session-only state tracking (AuditState pattern from v4.1) — stale indicator follows same model
- CSS custom properties for theming (var(--danger), var(--accent), var(--text-muted))
- data-testid attributes on interactive elements for E2E selectors
- window.__isometry.queryAll() for Playwright database assertions
- Event delegation for hover handlers on SVG groups

### Integration Points
- MutationManager → AlgorithmExplorer: staleness notification on card/connection mutations
- AlgorithmExplorer → NetworkView: already wired via onResult/onReset callbacks
- NetworkView mouseenter/mouseleave → d3-tip tooltip show/hide
- E2E spec → CI: add to existing e2e job in GitHub Actions workflow

</code_context>

<specifics>
## Specific Ideas

- Cumulative overlay is the key insight: graph_metrics INSERT OR REPLACE means running community then centrality leaves both columns populated. No extra compute or batch mode needed — just read both columns in _reapplyEncoding
- d3-tip chosen over HTML div overlay for tooltip — user preferred library approach
- Stale badge should be visually subtle (small dot, not alarming) — it's informational, not an error

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 118-polish-e2e*
*Context gathered: 2026-03-24*
