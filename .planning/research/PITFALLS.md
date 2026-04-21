# Pitfalls Research: SuperWidget Substrate

**Milestone:** v13.0 SuperWidget Substrate
**Date:** 2026-04-21
**Confidence:** HIGH — all findings derived from direct codebase analysis

## Critical Pitfalls

### 1. CSS Grid Height Collapse in Flex Chain
**Risk:** CRITICAL | **Phase:** WA-1

The existing workbench is a flex column chain: `.workbench-shell` → `.workbench-body` → `.workbench-main` → `.workbench-main__content`. SuperWidget introduces a CSS Grid root inside this chain. CSS Grid `1fr` rows require the grid container to have a definite block size. If the SuperWidget container lacks `flex: 1 1 auto; min-height: 0`, all four slots collapse to zero height.

This is a WKWebView-only failure — jsdom does not do layout, so all tests pass (false green).

**Prevention:** Apply `flex: 1 1 auto; min-height: 0` to the SuperWidget root. Write a Playwright WebKit smoke test asserting `getBoundingClientRect().height > 0` on all four `[data-slot]` elements.

### 2. State Machine No-Op Returns New Object Reference
**Risk:** CRITICAL | **Phase:** WA-2

The handoff contract is explicit: `switchTab` on an invalid tabId must return the **original reference**. The default JS pattern `return { ...projection }` always creates a new reference even when nothing changed. Any downstream `if (prev !== next)` triggers a spurious re-render on every no-op.

**Prevention:** Every guard path must `return projection` (the exact input variable), not spread. Write `.toBe` assertions (strict reference equality), not `.toEqual`.

### 3. Canvas Registry Abstraction Leaks Stub Identity Into Substrate
**Risk:** CRITICAL | **Phase:** WA-4

If `SuperWidget.ts` references concrete stub classes (`instanceof ExplorerCanvasStub`) rather than the `CanvasComponent` interface from `registry.ts`, every subsequent milestone requires editing the substrate to swap in real Canvases — the exact churn the registry pattern prevents.

**Prevention:** `SuperWidget.ts` must only reference the `CanvasComponent` interface. Enforce: `grep -rn "ExplorerCanvasStub\|ViewCanvasStub\|EditorCanvasStub" src/superwidget/SuperWidget.ts` must return zero matches.

## High Pitfalls

### 4. Full Widget Re-Render on Tab Switch
**Risk:** HIGH | **Phase:** WA-3

The simplest implementation rebuilds the entire component on every `commitProjection`. This causes all four slots to re-render on every tab switch — undetectable in tests that only assert DOM content, but `data-render-count` catches it.

**Prevention:** Each slot stores a reference to its own DOM container. `commitProjection` computes which slots changed and re-renders only those. Assert header `data-render-count` does NOT increment on tab switch.

### 5. Mount-Once vs. Destroy-and-Recreate Confusion
**Risk:** HIGH | **Phase:** WA-3 / WA-4

The existing `PanelManager` uses mount-once — panels never destroyed, only hidden. SuperWidget Canvas switching is a different contract: `setCanvas` must destroy the prior Canvas and mount the new one, resetting `data-render-count` to 1. Applying PanelManager's pattern to Canvas switching leaks stale state.

**Prevention:** `commitProjection` for a canvas change must call `canvas.destroy()` before `canvas.mount()`. Never set `style.display = 'none'` on a Canvas to "hide" it — destroy it.

### 6. Sidecar Element Outside Canvas Slot Boundary
**Risk:** HIGH | **Phase:** WA-4

When a View switches from Unbound to Bound, the temptation is to add the sidecar as a sibling to the canvas slot (mirroring existing `workbench-slot-top` / `workbench-slot-bottom`). The spec requires it as a **child** of the canvas slot.

**Prevention:** Sidecar (`data-sidecar="true"`) must be a child of `[data-slot="canvas"]`. Canvas slot uses `display: grid; grid-template-rows: auto 1fr` when Bound. Test: `document.querySelector('[data-slot="canvas"] [data-sidecar]')` must return non-null when Bound.

### 7. Tab Bar ARIA Deviates from Existing Roving Tabindex
**Risk:** HIGH | **Phase:** WA-1

The existing `ViewTabBar.ts` implements `role="tablist"` with roving tabindex (ArrowLeft/Right, Home, End). The config gear adds a subtle case: it must retain `tabindex="0"` permanently (not part of the roving sequence) while content tabs use roving tabindex.

**Prevention:** Copy the roving tabindex implementation from `ViewTabBar.ts`. Config gear (`data-tab-role="config"`) is NOT in the roving sequence — it has its own fixed `tabindex="0"`. Test: only one content tab has `tabindex="0"` at any time; config gear always has `tabindex="0"`.

### 8. Tab Bar Overflow Missing Edge Fade
**Risk:** HIGH | **Phase:** WA-1

Adding `overflow-x: auto` passes all functional tests, but tabs beyond visible width are invisible without affordance. The handoff explicitly chose "horizontal scroll with edge fade."

**Prevention:** `mask-image: linear-gradient(...)` on tab bar container. Toggle via `data-overflows="true"` updated by `ResizeObserver`. Test for attribute presence when tabs overflow.

## Medium Pitfalls

### 9. `enabledTabIds` Toggle No-Op Returns New Object
**Risk:** MEDIUM | **Phase:** WA-2

`toggleTabEnabled` creates a new Projection with an updated array. If the tabId is already in the desired state, the function should return the original reference.

### 10. `style.display = ''` Leaks from PanelManager Pattern
**Risk:** MEDIUM | **Phase:** WA-1 / WA-3

`PanelManager.show()` uses `slot.container.style.display = ''`. This pattern is banned in `src/superwidget/` by the permanent regression guard. Verify Biome lint rule is active before starting WA-1.

### 11. Zone Theme Label Coupled to Parent Container
**Risk:** MEDIUM | **Phase:** WA-1 / WA-2

Header must read `projection.zoneRole` and map via a local lookup table inside SuperWidget — not from a parent's DOM attribute or global variable. The handoff mandates self-contained widget for testing.

### 12. Canvas Registry `defaultExplorerId` Missing — Silent Unbound Fallback
**Risk:** MEDIUM | **Phase:** WA-4

A View Canvas registered without `defaultExplorerId` silently renders Unbound even when `canvasBinding === 'Bound'`. `validateProjection` should warn (console) in this case.

## Low Pitfalls

### 13. CSS Token Namespace Collision
**Risk:** LOW | Use `--sw-*` prefix for all new custom properties. Existing: `--sg-*`, `--pv-*`.

### 14. Test Files in `src/` Instead of `tests/`
**Risk:** LOW | Tests in `src/` are excluded from Vitest config and silently don't run in CI.

### 15. Config Gear ID in `enabledTabIds`
**Risk:** LOW | If config gear's ID appears in `enabledTabIds`, `toggleTabEnabled` can disable it — breaking the always-visible invariant.

## Phase-Specific Warning Table

| Work Area | Pitfall | Mitigation |
|---|---|---|
| WA-1 | CSS Grid height collapse (#1) | `min-height: 0`; Playwright height assertion |
| WA-1 | Tab overflow no edge fade (#8) | `mask-image` gradient; `data-overflows` test |
| WA-1 | `style.display = ''` leak (#10) | Biome lint rule; grep CI check |
| WA-1 | ARIA tablist deviation (#7) | Copy ViewTabBar.ts pattern; keyboard nav tests |
| WA-2 | No-op returns new object (#2, #9) | `return projection` on guard paths; `.toBe` assertions |
| WA-3 | Full widget re-render (#4) | Slot-scoped queries; header render-count assertions |
| WA-3 | Mount-once confusion (#5) | Explicit `destroy()` before `mount()` on Canvas switch |
| WA-4 | Registry abstraction leak (#3) | Grep zero stub class names in SuperWidget.ts |
| WA-4 | Sidecar outside canvas slot (#6) | Child of canvas slot; querySelector assertion |
| WA-4 | Missing defaultExplorerId (#12) | Validator warns on Bound + no defaultExplorerId |

## Forward Warnings (v13.5+ Zone Shell)

- **CSS Grid inside Flex inside CSS Grid (deep nesting):** `min-height: 0; min-width: 0` must propagate at every nesting level when Zone Layout Shell nests multiple SuperWidgets.
- **Provider Subscriptions Outliving Canvas Destroy:** If `destroy()` is not called on canvas switch, subscriptions accumulate — one per switch.
- **D3 Data Join Ownership on Canvas Swap:** Reusing canvas slot container across type switches causes stale D3 key matches. Destroy-and-recreate is the only safe pattern.
