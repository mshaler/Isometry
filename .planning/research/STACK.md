# Stack Research: SuperWidget Substrate

**Milestone:** v13.0 SuperWidget Substrate
**Date:** 2026-04-21
**Confidence:** HIGH

## Summary

Zero new npm dependencies required. Every capability needed for the SuperWidget substrate is covered by the existing stack (TypeScript 5.9, CSS Grid, CSS custom properties, Vitest, Playwright).

## New Capabilities Needed

### CSS Techniques (no new dependencies)

| Technique | Purpose | Browser Support | Codebase Precedent |
|-----------|---------|----------------|-------------------|
| `grid-template-areas` | Four-slot invariant substrate layout | All targets | SuperGrid uses `grid-column: span N`, PivotGrid uses `display: grid` — named areas are the natural next step |
| `mask-image` gradient edge fade | Tab bar horizontal scroll overflow indication | Safari 17+ (within baseline) | Not yet used — 3 lines of pure CSS, no library |
| `--sw-*` CSS namespace | SuperWidget design tokens | N/A (convention) | Follows `--sg-*` (SuperGrid) and `--pv-*` (PivotTable) pattern |

### TypeScript Patterns (no new dependencies)

| Pattern | Purpose | Codebase Precedent |
|---------|---------|-------------------|
| Pure transition functions | Projection state machine | `keys.ts` (compound key utilities), `SortState.ts`, `SuperTimeUtils.ts` |
| Registry with typed entries | Canvas registry plug-in seam | `PluginRegistry` v8.0 (D-012) — register/enable/disable with typed entries |
| `mount(container)/destroy()` class | SuperWidget component lifecycle | WorkbenchShell, DataExplorerPanel, PropertiesExplorer, DockNav |
| `data-*` attributes for behavioral queries | Slot identification, canvas type, render count | data-attribute-over-has pattern from v6.1 |

## What NOT to Add

| Temptation | Why Not |
|-----------|---------|
| Web Components / Custom Elements | Codebase convention is plain TS classes with mount/destroy — introducing HTMLElement subclasses would create a parallel component model |
| CSS Container Queries | Substrate layout is invariant (CSS Grid areas); container queries are for responsive content, which belongs to real Canvas implementations in v13.1+ |
| State management library | Projection state machine is pure functions — no Redux/MobX/Zustand; matches existing provider pattern |
| Animation library | Transitions deferred to future milestone per handoff |
| New test framework | Vitest + Playwright already cover unit + integration + E2E |

## Integration Points

| Existing System | Integration |
|----------------|-------------|
| PluginRegistry (v8.0) | Canvas registry follows same pattern — typed entries, register/lookup, plug-in seam |
| ViewTabBar ARIA | Tab bar should mirror existing `role="tablist"` / `role="tab"` / `aria-selected` pattern |
| CSS design tokens | `--sw-*` namespace; inherit from global theme tokens (`--bg-primary`, `--text-primary`, etc.) |
| WorkbenchShell | SuperWidget will eventually replace inline embedding; for v13.0, it's standalone |

## Recommendation

Proceed immediately with WA-1. No package installation, tooling setup, or stack changes needed. The `--sw-*` CSS namespace should be confirmed before any CSS is written. The Canvas registry interface (particularly `defaultExplorerId?: string` on View entries) is the critical seam that gates all v13.x milestones.
