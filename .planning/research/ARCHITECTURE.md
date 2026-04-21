# Architecture Research: SuperWidget Substrate

**Milestone:** v13.0 SuperWidget Substrate
**Date:** 2026-04-21
**Confidence:** HIGH — all findings from direct codebase inspection

## Summary

SuperWidget is a pure addition — v13.0 modifies zero existing files. WorkbenchShell, DockNav, all providers, StateCoordinator, PanelRegistry, PluginRegistry, and all views are untouched.

## New Components

| File | Purpose |
|---|---|
| `src/superwidget/SuperWidget.ts` | TypeScript class, four-slot DOM, commitProjection() entry point |
| `src/superwidget/SuperWidget.css` | CSS Grid substrate, --sw-* token namespace, bundled via import |
| `src/superwidget/projection.ts` | Pure types and transition functions |
| `src/superwidget/canvas/registry.ts` | CanvasRegistryEntry map, plug-in seam |
| `src/superwidget/canvas/ExplorerCanvasStub.ts` | Explorer type stub |
| `src/superwidget/canvas/ViewCanvasStub.ts` | View type stub (supports Bound sidecar) |
| `src/superwidget/canvas/EditorCanvasStub.ts` | Editor type stub |
| `src/superwidget/README.md` | Contract documentation |
| `tests/superwidget/SuperWidget.substrate.test.ts` | WA-1 tests |
| `tests/superwidget/projection.test.ts` | WA-2 tests (at least 20 table-driven) |
| `tests/superwidget/SuperWidget.projection.test.ts` | WA-3 tests |
| `tests/superwidget/CanvasStubs.test.ts` | WA-4 tests |
| `tests/superwidget/SuperWidget.integration.test.ts` | WA-5 cross-seam tests (7-row matrix) |

## Integration Points

### Projection State Machine vs. Provider System

Projection state machine is **deliberately orthogonal** to the provider system:
- `projection.ts` pure functions govern UI slot content (which Canvas fills the canvas slot)
- Providers (PAFVProvider, FilterProvider, etc.) govern data/SQL queries
- These never merge
- SuperWidget does NOT register with StateCoordinator — a tab switch never triggers a Worker re-query

### Three Registries Coexist Without Merging

| Registry | Scope | Shape | Instance |
|----------|-------|-------|----------|
| `PluginRegistry` (v8.0) | SuperGrid render pipeline | Dependency graph, enable/disable, 3-hook pipeline | Per PivotGrid instance |
| `PanelRegistry` (v12.0) | Explorer panel lifecycle | Mount-once, show/hide | Per WorkbenchShell |
| `CanvasRegistry` (v13.0) | Canvas slot resolution | Static Map, lookup-only | Module singleton |

CanvasRegistry is the simplest: a `Map<string, CanvasRegistryEntry>` with no dependency graph or enable/disable.

### Component Pattern

SuperWidget.ts must be a TypeScript class with `mount(container: HTMLElement)` and `destroy()`, matching WorkbenchShell, DockNav, DataExplorerPanel, and all Explorer panels exactly.

## DOM Layout

```
.superwidget
  [data-slot="header"]    — zone theme label, collapse chevron
  [data-slot="canvas"]    — replaced on commitProjection
    [data-sidecar]        — View/Bound only, collapsible (child of canvas)
    view content
  [data-slot="status"]    — always in DOM; min-height: 0 when empty
  [data-slot="tabs"]      — horizontal scroll + edge fade mask-image
    content tabs          — governed by enabledTabIds
    [data-tab-role="config"]  — gear, grid-column: -1, always visible
```

## Data Flow

### commitProjection Path

1. `commitProjection(newProjection)` called
2. `validateProjection(newProjection)` — reject invalid with console warning, no DOM change
3. Diff old vs. new projection — determine which slots changed
4. Re-render only affected slots (slot-scoped)
5. Tab switch → canvas slot only; header/status DOM untouched

### Bound Sidecar Resolution

- `defaultExplorerId` comes from the CanvasRegistry entry for the View
- NOT from the Projection type (no `boundExplorerId` field)
- Hard invariant: Projection stays clean; binding pairing is a Canvas-level concern

### Reference Equality Invariant

- On invalid tabId, `switchTab` returns the original projection object reference (`===`)
- Not a new object with the same values
- Anti-patching rule forbids weakening `.toBe` to `.toEqual`

## Build Order

Strictly sequenced — each WA gates the next:

1. **WA-1: Four-Slot Substrate** — DOM + CSS Grid + tab bar
2. **WA-2: Projection State Machine** — pure functions, no DOM
3. **WA-3: Projection-Driven Rendering** — commitProjection wiring
4. **WA-4: Canvas Type Stubs** — three stubs + registry
5. **WA-5: Cross-Seam Integration Tests** — 7-row matrix

Cannot parallelize WA-2/WA-3 or WA-3/WA-4. Each begins with a failing test.

## CSS Conventions

- `--sw-*` namespace for all SuperWidget custom properties
- Bundled CSS (imported in .ts), no `<link>` tags
- `data-*` attributes for behavioral queries (data-attribute-over-has pattern)
- No `style.display = ''` — explicit values only
- No `:has()` for behavioral selectors

## Permanent Regression Guards

```bash
grep -rn "style\.display = ''" src/superwidget   # must be zero
grep -rn "<link" src/superwidget                  # must be zero
grep -rn ":has(" src/superwidget/*.css            # must be zero or comment-justified
grep -rn "alert(\|confirm(" src/superwidget       # must be zero
```

## Open Questions

None — the handoff document resolves all design questions. The architecture is fully specified for this milestone.
