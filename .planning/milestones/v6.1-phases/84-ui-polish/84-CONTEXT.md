# Phase 84: UI Polish — Context

**Gathered:** 2026-03-15
**Status:** Ready for planning
**Source:** PRD Express Path (planning/phases/ui-polish/ui-polish-01-HANDOFF.md)

<domain>
## Phase Boundary

Six targeted UI improvements across correctness, accessibility, and polish in the web layer. Sourced from Codex external review, arbitrated and grounded by Claude. All fixes are surgical — no new providers, no Worker boundary changes, no new global state.

</domain>

<decisions>
## Implementation Decisions

### Architectural Constraints (LOCKED)
- No new provider singletons or global state — all state flows through existing providers
- No changes to Worker boundary (worker/protocol.ts, WorkerBridge.ts) except what is explicitly specified
- SuperGrid._fetchAndRender() is the single query entrypoint — no secondary query paths
- All tests use behavioral assertions — no pixel snapshots, no mock leakage
- SuperGridProviderLike and SuperGridDensityLike in src/views/types.ts are the authoritative contracts

### WA1: Aggregation Wiring (P1 Correctness)
- Extend SuperGridProviderLike with getAggregation(): AggregationMode
- Add displayField: undefined to _noOpDensityProvider stub
- Spread projectionOpt into superGridQuery() only when aggregation !== 'count'
- Verify PAFVProvider.setAggregation() calls _scheduleNotify()

### WA2: :has() Behavioral Fix (P2 Runtime Correctness)
- Replace :has() DOM query in LatchExplorers.ts with data-time-field attribute selector
- Add class-based CSS fallback (collapsible-section__body--has-explorer) as primary rule
- Keep :has() CSS rules as progressive enhancement only

### WA3: AppDialog Primitive (P1 UX)
- New src/ui/AppDialog.ts — lightweight imperative dialog using native <dialog> element
- New src/styles/app-dialog.css — minimal styles with existing CSS variables
- Migrate 3 call sites: CommandBar alert, PropertiesExplorer confirm, main.ts confirm
- Promise-based API: show() returns Promise<boolean>
- Focus trap, Escape dismiss, backdrop click dismiss

### WA4: Keyboard Navigation (P1 Accessibility)
- CommandBar: roving tabindex on role="menu" items with ArrowUp/Down/Home/End
- ViewTabBar: ArrowLeft/Right tab switching with roving tabindex on role="tablist"
- Escape in CommandBar returns focus to trigger button

### WA5: Histogram Error State (P3)
- Replace silent _render([]) fallback with inline error element + Retry button
- _showError() / _clearError() methods with lazy DOM creation
- Successful fetch clears any previous error state

### WA6: WorkbenchShell Stub Cleanup (P3)
- Replace stubContent strings with explicit section state model (loading/ready/empty)
- setState('ready') called after each explorer mounts
- Sync with WA2's collapsible-section__body--has-explorer class

### Claude's Discretion
- Internal implementation details of focus trap in AppDialog
- Exact CSS token values for app-dialog styling
- Error message wording for histogram failures
- Loading indicator style (blank vs minimal spinner)

</decisions>

<specifics>
## Specific Ideas

- AppDialog uses native <dialog> element — accessible by default, self-cleaning from DOM
- Roving tabindex pattern: exactly one tabindex="0" per component at all times
- data-time-field attribute on presets container eliminates :has() WKWebView risk
- projectionOpt spread is no-op for default state — zero test churn on existing suite
- _handleResetAll becomes async; button listener uses void cast pattern

</specifics>

<deferred>
## Deferred Ideas

- Responsive media queries (WKWebView viewport is Swift-controlled)
- SuperGrid inline style extraction to CSS classes (mid-refactor risk)
- D3.js or Worker boundary changes
- calcQuery aggregation wiring (uses its own per-field aggregates map, correct as-is)

</deferred>

---

*Phase: 84-ui-polish*
*Context gathered: 2026-03-15 via PRD Express Path*
