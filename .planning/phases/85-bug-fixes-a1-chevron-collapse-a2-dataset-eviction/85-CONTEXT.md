# Phase 85: Bug Fixes (A1 Chevron Collapse + A2 Dataset Eviction) - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix two cross-cutting regressions identified in UAT:
- **A1:** CollapsibleSection chevron toggles update icon state but do not actually collapse/expand section content vertically
- **A2:** Loading a new dataset via Command-K does not evict the prior dataset — old nodes remain visible, Projection Explorer retains stale axis properties

These are diagnosis-first bug fixes. No new features, no new components.

</domain>

<decisions>
## Implementation Decisions

### A1: Chevron Collapse
- Diagnose the actual root cause first before applying any fix — likely a CSS max-height or display binding issue where the chevron visual state is disconnected from the content container's visibility
- CollapsibleSection already has collapse logic (Phase 54) with ▾/▸ chevrons, ~200ms max-height CSS transitions, localStorage persistence, and ARIA attributes — do not rewrite, fix the binding
- Collapse/expand must animate (150-200ms ease) — no jarring snap
- State persists per-section during session (each section independent, not accordion)

### A2: Dataset Eviction
- Command-K is implicitly a replace action — no confirmation dialog
- Eviction is a full state reset for the dataset context: clear all data AND reset filters, PAFV axis assignments, selection state, and zoom/scroll position to defaults
- Each dataset has its own default filters, axis assignments, etc. — loading a new dataset applies that dataset's defaults, not the previous dataset's configuration
- Eviction must DELETE prior cards/connections from sql.js before INSERT of new dataset
- SchemaProvider must re-introspect (PRAGMA table_info) after new data loads
- ProjectionExplorer axis fields must reset to new dataset's intrinsic properties
- If eviction takes >100ms, show a loading state so user doesn't see flash of old data

### Testing Strategy
- A2 regression test: both vitest unit test (real sql.js, verify zero rows from Dataset A after loading Dataset B) AND Playwright E2E test (load Dataset A, Command-K load Dataset B, confirm zero visual bleed)
- A1: manual verification sufficient given it's a CSS/binding fix, but add a unit test for CollapsibleSection toggle state if one doesn't exist

### Claude's Discretion
- Exact diagnosis approach for A1 (CSS inspector vs code reading)
- Whether eviction resets are synchronous or use a brief loading interstitial
- Order of provider resets during eviction sequence
- Whether to batch the DELETE + INSERT in a single sql.js transaction

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UAT Specification
- `docs/UAT-HANDOFF-DesignWorkbench.md` — Full UAT field notes, sections A1 and A2 define acceptance criteria

### CollapsibleSection (A1)
- `src/ui/CollapsibleSection.ts` — Collapsible panel primitive with toggle header, chevron indicator, max-height transition, localStorage persistence
- `src/ui/WorkbenchShell.ts` — Creates 5 CollapsibleSections in panel-rail container

### Dataset Loading (A2)
- `src/sample/SampleDataManager.ts` — SQL seed loading with temp table INSERT SELECT pattern
- `src/palette/CommandPalette.ts` — Command-K trigger for dataset loading via onLoadSample callback
- `src/views/ViewManager.ts` — View lifecycle, switchTo(), _fetchAndRender(), onLoadSample callback
- `src/providers/SchemaProvider.ts` — Runtime PRAGMA table_info introspection, LATCH heuristic classification (if exists, or check providers/ directory)
- `src/ui/ProjectionExplorer.ts` — 4-well DnD chip assignment, subscribes to SchemaProvider
- `src/providers/FilterProvider.ts` — Filter state, addFilter/clearFilters
- `src/providers/PAFVProvider.ts` — Axis assignments, VIEW_DEFAULTS
- `src/providers/SelectionProvider.ts` — Ephemeral selection state
- `src/providers/SuperPositionProvider.ts` — Scroll/zoom position cache

### D3 Data Join Patterns
- `src/views/GridView.ts` — Representative .data().join() pattern with key functions
- `src/views/SuperGrid.ts` — SuperGrid rendering pipeline

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- CollapsibleSection: Already has full collapse/expand API (setCollapsed, getCollapsed, setState) with ARIA — fix the binding, don't rebuild
- StateCoordinator: Central subscription hub — can orchestrate provider resets during eviction
- PAFVProvider.setViewType(): Already applies VIEW_DEFAULTS on view switch — similar pattern needed for dataset switch
- SampleDataManager: Already loads datasets via SQL seeds — needs DELETE-before-INSERT guard

### Established Patterns
- Provider setter injection: All late-binding providers use setter injection (Phase 69-73) — SchemaProvider re-introspection follows this pattern
- _migrateState() in StateManager: Already handles filtering unknown fields — relevant model for dataset schema change
- D3 key function mandatory on every .data() call (D-005) — exit selection should remove old nodes IF data is properly replaced

### Integration Points
- CommandPalette → ViewManager.onLoadSample → SampleDataManager — this is the dataset loading call chain
- SchemaProvider → PropertiesExplorer, ProjectionExplorer, LatchExplorers — all subscribe and need update notification after re-introspection
- FilterProvider/PAFVProvider resets → StateCoordinator notification → view re-render via _fetchAndRender()

</code_context>

<specifics>
## Specific Ideas

- A2 is the most serious UAT bug — dataset bleed makes the app appear broken when switching datasets
- The eviction path should be the same whether triggered by Command-K, Catalog selection (Phase 88), or any future dataset switch mechanism
- "Zero rows from Dataset A appear in any view" is the hard acceptance criterion

</specifics>

<deferred>
## Deferred Ideas

- ViewZipper position-morph animation (cards follow between views) — post-v7.0
- Per-dataset saved filter/axis configurations (load dataset AND restore its last config) — future enhancement
- Catalog ViewZipper integration — Phase 88+

</deferred>

---

*Phase: 85-bug-fixes-a1-chevron-collapse-a2-dataset-eviction*
*Context gathered: 2026-03-17*
