# Phase 162: Substrate Layout - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

SuperWidget renders as a four-slot CSS Grid container with correct DOM structure, `--sw-*` custom properties, and `mount(container)/destroy()` lifecycle. No state, no events, no projection logic — pure DOM skeleton.

</domain>

<decisions>
## Implementation Decisions

### CSS File Strategy
- **D-01:** Single `superwidget.css` file co-locating `--sw-*` tokens and all layout/slot rules. Imported by `SuperWidget.ts`. Matches `--sg-*` in `supergrid.css` and `--pv-*` in `pivot.css` co-location precedent.
- **D-02:** Selectors use `data-slot` attributes as primary CSS hooks (e.g., `[data-slot="header"]`, `[data-slot="canvas"]`). Data attributes do double duty: test hooks + styling. No BEM classes needed.

### Tab Bar
- **D-03:** SuperWidget builds its own tab bar DOM — no reuse of or coupling to `ViewTabBar`. The tab bar is a scrolling flex row inside the tabs slot. The two components serve different purposes and evolve independently.
- **D-04:** Tab overflow edge fade uses standard both-edge linear gradient: `mask-image: linear-gradient(to right, transparent, black 32px, black calc(100% - 32px), transparent)`.

### SuperWidget Class API
- **D-05:** Phase 162 exposes public read-only getters for all four slot elements (`headerEl`, `canvasEl`, `statusEl`, `tabsEl`). Downstream phases (164, 165) can access slots immediately without modifying SuperWidget.
- **D-06:** No events in Phase 162. SuperWidget is pure DOM skeleton + lifecycle. Event emission arrives with projection state in Phase 163/164.

### DOM Structure
- **D-07:** Grid template rows order: header → tabs → canvas → status. IDE-style layout: tabs below header for navigation context, canvas gets flex space (`1fr`), status bar at bottom.
- **D-08:** Config gear is the last child inside the tabs slot with `data-tab-role="config"` and right-aligned via `margin-left: auto`. Not a separate grid item.

### Claude's Discretion
- Exact `--sw-*` token names and values (derived from design-tokens.css palette)
- Grid gap values and slot padding
- Config gear placeholder content (icon or text)
- Status slot `min-height: 0` implementation detail

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Decisions
- `.planning/ROADMAP.md` §Phase 162 — Success criteria and requirements (SLAT-01..07)
- `.planning/REQUIREMENTS.md` §Substrate Layout — SLAT-01 through SLAT-07 acceptance criteria
- `.planning/STATE.md` §Accumulated Context — v13.0 handoff decisions (locked)

### Existing Patterns (reference for consistency)
- `src/ui/WorkbenchShell.ts` — mount/destroy lifecycle pattern to follow
- `src/styles/supergrid.css` — `--sg-*` token namespace precedent
- `src/styles/pivot.css` + `src/styles/pivot.module.css` — `--pv-*` token namespace precedent
- `src/styles/design-tokens.css` — Global token layer (`--bg-*`, `--text-*`, `--accent`)
- `src/ui/ViewTabBar.ts` — Existing tab bar (NOT reused, but reference for DOM patterns)
- `src/styles/view-tab-bar.css` — Tab bar styling reference

### Conventions
- `.planning/codebase/CONVENTIONS.md` — File naming, code style, import patterns
- `.planning/codebase/STRUCTURE.md` — Source directory layout

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorkbenchShell.ts`: mount/destroy lifecycle pattern — SuperWidget follows the same shape
- `design-tokens.css`: Global `--bg-*`, `--text-*`, `--accent` tokens — `--sw-*` tokens should reference these for theme consistency

### Established Patterns
- CSS custom property namespaces: `--sg-*` (supergrid), `--pv-*` (pivot) — SuperWidget uses `--sw-*`
- Data attributes for test hooks and CSS: `data-col-start`, `data-canvas-type`, `data-render-count` — SuperWidget uses `data-slot`
- Component CSS co-located: each component imports its own CSS file
- Class lifecycle: constructor builds DOM, `mount(el)` appends, `destroy()` removes + cleans up

### Integration Points
- `src/styles/` directory for `superwidget.css`
- `src/ui/` or new `src/superwidget/` directory for `SuperWidget.ts` (planner decides)
- `tests/superwidget/` for all tests (locked convention)
- No existing `mask-image` pattern — edge fade is new CSS introduced here

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

*Phase: 162-substrate-layout*
*Context gathered: 2026-04-21*
