---
gsd_state_version: 1.0
milestone: v8.0
milestone_name: SuperGrid Redesign
status: milestone_complete
stopped_at: v8.0 SuperGrid Redesign shipped
last_updated: "2026-03-21T21:30:00.000Z"
last_activity: 2026-03-21 -- v8.0 SuperGrid Redesign milestone complete (4 phases, 7 plans, 14 plugins)
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 7
  completed_plans: 7
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Current focus:** Planning next milestone (v8.0 SuperGrid Redesign shipped)

## Current Position

Phase: All complete
Plan: N/A
Status: Milestone v8.0 shipped
Last activity: 2026-03-21 -- v8.0 SuperGrid Redesign milestone complete

Progress: [██████████] 100% (4/4 phases complete)

## Milestone History

- ✅ v7.2 Alto Index + DnD Migration: Phases 95-96 complete (verified, human_needed for WKWebView testing)
- ✅ v8.0 SuperGrid Redesign: Phases 97-100 complete (4 phases, 7 plans, 14 plugins shipped)

## Performance Metrics

**Velocity:**
- v8.0 milestone: 2 phases, 2 plans so far (Phase 97 + 98 each single-plan)
- v7.2 milestone: 2 phases, 5 plans
- v7.1 milestone: 4 phases, 8 plans
- v7.0 milestone: 6 phases, 17 plans in 2 days
- v6.1 milestone: 6 phases, 14 plans in 2 days

*Updated after each plan completion*

## Accumulated Context

### Decisions

All TypeScript architectural decisions locked (D-001..D-011). Full logs in PROJECT.md.

**v8.0 decisions:**
- D-012: Plugin registry pattern for SuperGrid features — each Super* capability is a PluginHook with transformData/transformLayout/afterRender hooks, managed by PluginRegistry with auto-dependency enforcement
- D-013: Sub-feature granularity — 10 categories (SuperStack, SuperZoom, SuperSize, SuperDensity, SuperCalc, SuperScroll, SuperSearch, SuperSelect, SuperAudit, SuperSort), 27 sub-features, each independently toggleable
- D-014: Data source progression — mock data → alto-index markdown-to-JSON → full sql.js/SQLite. Common DataProvider interface
- D-015: Two-layer grid rendering — Layer 1 (invisible table for scroll sizing) + Layer 2 (absolute-positioned overlay for grouped headers with scroll tracking). Layer 1 headers are invisible spacers; only Layer 2 is visible
- D-016: --pv-* CSS namespace for pivot module, --hns-* for harness, avoiding collision with existing --sg-* supergrid tokens
- D-017: Pointer events only for DnD — no HTML5 DnD (dragstart/dragover/drop), no react-dnd. Ghost element + elementsFromPoint hit-testing
- D-018: Feature harness is dev/test tool but architecture kept extensible for production debug/support use
- D-019: Registry Completeness Suite — 6-assertion reusable pattern (presence, count, order, uniqueness, referential integrity, stub detection) for any registry-style structure. Tests are PERMANENT GUARDs. See FeatureCatalogCompleteness.test.ts as canonical example
- D-020: NOOP_FACTORY branded sentinel — stub marker on factory function (__isNoopStub brand), not metadata. setFactory() clears stub automatically. getStubIds() enables mechanical TDD enforcement. Sentinel at implementation boundary, not description layer

**v8.0 design record:**
- Figma simplification preserved all 27 sub-features (FeatureCatalog.ts is canonical). Visual layout changed; feature inventory did not. See FEATURE_CATALOG in FeatureCatalog.ts for the authoritative list.
- Registry completeness test (FeatureCatalogCompleteness.test.ts) is a PERMANENT GUARD — same category as __agg__ regression guard (D-011). Never weaken to make it pass.
- **Registry Completeness Suite** pattern (reusable for any registry): presence, count, order, uniqueness, referential integrity, stub detection. Apply to any future registry (view types, ETL adapters, facet definitions).
- NOOP_FACTORY sentinel with __isNoopStub brand enables mechanical stub detection — TDD constraint is self-enforcing via getStubIds(), not honor-system.
- Each plugin's setFactory() call must be accompanied by a behavioral test before moving to the next plugin (TDD constraint on CC autonomy). Stub count in completeness test must decrease as plugins ship.

**v7.2 decisions (carried):**
- Pointer events pattern is canonical (Phase 95 PROJ-02..03)
- Phase 96 DnD migration complete (verified, human_needed for WKWebView)
- [Phase 99]: Plugin-grid bridge: PivotGrid.setRegistry()+runAfterRender() wired after overlay render — one integration, all future plugins benefit
- [Phase 99]: SuperStackSpans afterRender replaces .pv-col-span/.pv-row-span elements with N-level buildHeaderCells output; sizing passed via ctx.layout extension
- [Phase 99]: Shared SuperStackState created in HarnessShell and passed to spanning/collapse/aggregate factories via setFactory closures — single source of truth for collapsedSet
- [Phase 99]: PivotGrid overlay pointerdown listener routes to registry.runOnPointerEvent — one-time wiring, all pointer-aware plugins benefit
- [Phase 100]: Shared ZoomState object pattern: both wheel and slider plugins receive the same { zoom, listeners } reference — no external state manager needed for zoom sync
- [Phase 100]: Test helper exports (_setColWidthForTest, _setScaleForTest) allow behavioral tests to access plugin internal state without leaking into PluginHook interface
- [Phase 100]: SCROLL_BUFFER=2 for SuperScrollVirtual (pivot rows are wider than supergrid rows; lighter buffer vs OVERSCAN_ROWS=5)
- [Phase 100]: Chain cycle asc→desc→remove (3 clicks to remove from chain) vs single-sort asc→desc→null; different UX intent
- [Phase 100]: Shared aggFunctions Map pattern for SuperCalc (same as ZoomState for SuperZoom)
- [Phase 100]: computeAggregate COUNT returns 0 (not null) for empty/all-null — matches SQL COUNT semantics

### Roadmap Evolution

- Phase 100 added: Plugin Registry Wave 1 — SuperSize, SuperZoom, SuperCalc, SuperSort, SuperScroll (5 independent categories, 12 plugins)

### Blockers/Concerns

- None. Plugin registry and harness are shipped and working. Ready to implement first feature plugins.

### TODOs (carry forward)

- **Migrate collapse/aggregate to registerCatalog()**: superstack.collapse and superstack.aggregate are currently wired via HarnessShell setFactory() closures (shared SuperStackState pattern), not in registerCatalog(). When migrated, add them to the `implemented` list in FeatureCatalogCompleteness.test.ts and decrease stub count from 26. Watch whether more plugins end up harness-wired — if so, the catalog registration pattern has friction that needs fixing rather than working around.
- **Catalog-registered vs harness-wired split**: Currently intentional (SuperStackState sharing), but monitor whether it proliferates. More than a handful of harness-wired plugins is a design smell.

## Session Continuity

Last session: 2026-03-21T21:06:56.673Z
Stopped at: Completed 100-03-PLAN.md (SuperCalc plugins + full catalog registration)
Resume: Plan Phase 99 (first plugin implementations — SuperSize.header-resize or SuperZoom.slider)
