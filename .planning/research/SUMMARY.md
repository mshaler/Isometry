# Research Summary: v5.0 Designer Workbench

**Domain:** Workbench shell + explorer-driven interface integration
**Researched:** 2026-03-08
**Overall confidence:** HIGH

## Executive Summary

The v5.0 Designer Workbench adds a new UI shell layer between `#app` and ViewManager, with collapsible explorer panels that drive SuperGrid through existing providers. This research answers five specific integration questions posed by the milestone context, all resolved entirely from codebase analysis -- no external dependencies or new architectural primitives needed.

The core insight: ViewManager already accepts its container via constructor config, SuperGrid creates its own scroll container with `overflow: auto` and `height: 100%`, and StateCoordinator's subscribe/scheduleUpdate pattern is the established way for any consumer to observe and trigger state changes. The Workbench shell is a thin orchestration layer that creates DOM hierarchy, distributes provider references to explorer constructors, and fans out coordinator notifications to explorer update() methods.

The primary risk is CSS layout regression: SuperGrid's sticky headers depend on its scroll container having a defined height, which requires the new `.workbench-view-content` flex child to have `min-height: 0` and `overflow: hidden`. Secondary risks include overlay mount targets being wrong after re-rooting (overlays must mount to `#app`, not to the view content area) and DnD event collision between ProjectionExplorer and SuperGrid (mitigated by distinct MIME types and separate module-level payload singletons).

Zero new npm dependencies are required. All modules are built with existing TypeScript + D3/DOM + CSS custom properties.

## Key Findings

**Stack:** Zero new dependencies. All new modules (WorkbenchShell, CollapsibleSection, CommandBar, 4 explorers) use existing TypeScript + D3 + CSS tokens. Markdown renderer for NotebookExplorer is the only potential addition, deferred to Phase 4.

**Architecture:** WorkbenchShell receives `#app`, creates `.workbench-shell` flex column, exposes `.workbench-view-content` for ViewManager. Explorers follow IExplorer interface (mount/update/destroy) with pull-on-notify state observation via single StateCoordinator subscription in WorkbenchShell.

**Critical pitfall:** CSS bleed from new stylesheets into SuperGrid's CSS Grid layout. All new selectors must be scoped under `.workbench-shell` or child classes. No bare element selectors, no global box-sizing resets.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Phase 1: Shell Scaffolding** (Low Risk)
   - Addresses: WorkbenchShell, CollapsibleSection, CommandBar, ViewManager re-rooting
   - Avoids: CSS bleed pitfall (#1), innerHTML destruction (#2), overlay mount regression (#5)
   - Gate: All existing tests pass, SuperGrid renders identically in new mount point

2. **Phase 2: Properties + Projection Explorers** (Medium Risk)
   - Addresses: PropertiesExplorer with LATCH grouping, ProjectionExplorer with DnD wells
   - Avoids: Parallel state (#4), DnD collision (#3), provider catalog divergence (#8)
   - Gate: Axis changes from explorer drive SuperGrid re-render; all SuperGrid tests green

3. **Phase 3: Visual + LATCH Explorers** (Low Risk)
   - Addresses: Visual Explorer zoom rail, LatchExplorers Phase A filter wiring
   - Avoids: Zoom slider racing with SuperZoom (#11), panel animation thrashing (#6)
   - Gate: No regression in SuperGrid performance benchmarks

4. **Phase 4: Notebook Explorer + Polish** (Low Risk)
   - Addresses: NotebookExplorer v1, keyboard accessibility, final spacing
   - Avoids: XSS in markdown preview (#5)
   - Gate: Full accessibility pass

**Phase ordering rationale:**
- Shell scaffolding first because it changes the DOM hierarchy -- highest regression risk, earliest detection
- Properties + Projection next because they are the core value and establish the explorer-to-provider pattern
- Visual + LATCH after because they depend on the shell layout being stable
- Notebook last because it has zero provider integration and benefits from stable layout

**Research flags for phases:**
- Phase 1: Needs careful CSS verification -- sticky headers, overflow, min-height
- Phase 2: DnD boundary design needed before implementation
- Phase 3: Standard patterns, unlikely to need research
- Phase 4: Markdown sanitizer choice needed (DOMPurify vs alternatives)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies; all patterns proven across 48 prior phases |
| Features | HIGH | All features specified in D3-UI-IMPLEMENTATION-SPEC-v2.md |
| Architecture | HIGH | All five integration questions resolved from codebase analysis; no external research needed |
| Pitfalls | HIGH | Derived from direct source code inspection with file/line references |

## Gaps to Address

- **CollapsibleSection animation strategy** -- Use CSS max-height transition, height animation, or simple display toggle? Affects layout thrashing in SuperGrid. Decide during Phase 1 planning.
- **ViewTabBar disposition** -- Remove entirely, keep as fallback, or repurpose? Spec implies explorers replace it but is not explicit.
- **NotebookExplorer markdown dependency** -- marked + DOMPurify (~30KB) vs minimal regex renderer (~50 LOC). Defer decision to Phase 4.
- **Property catalog shape** -- How PAFVProvider exposes available properties to PropertiesExplorer. Needs API design during Phase 2 planning (may need `getAvailableAxes(): AxisField[]` method).
- **AuditOverlay .audit-mode scope** -- Should `.audit-mode` class be on `#app` (global) or `viewHost` (view-contextual)? Affects whether explorers show audit styling.

## Sources

- `src/main.ts` -- composition root, provider wiring
- `src/views/ViewManager.ts` -- container ownership, lifecycle management
- `src/views/SuperGrid.ts` -- mount pattern, DnD implementation, scroll container
- `src/providers/StateCoordinator.ts` -- subscribe/scheduleUpdate pattern
- `src/ui/ViewTabBar.ts` -- current mount pattern (parentElement insertion)
- `src/audit/AuditOverlay.ts` -- container mount pattern
- `docs/D3-UI-IMPLEMENTATION-SPEC-v2.md` -- authoritative spec for all workbench features
- `.planning/PROJECT.md` -- architectural constraints and decisions

---
*Research completed: 2026-03-08*
*Ready for roadmap: yes*
