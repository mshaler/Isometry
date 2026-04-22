# Stack Research

**Domain:** SuperWidget Shell — tab management, sidecar transitions, rich status slots, session persistence
**Researched:** 2026-04-21
**Confidence:** HIGH

## Summary Verdict

No new runtime dependencies are needed. All required capabilities — tab management, drag-to-reorder, sidecar show/hide transitions, rich status slots, session persistence — are achievable with the existing stack (TypeScript 5.9, D3.js v7.9, CSS custom properties, StateManager + ui_state). The analysis below covers the specific patterns and integration points needed for each feature area.

---

## Existing Stack (Validated — Do Not Re-Research)

| Technology | Version | Purpose |
|------------|---------|---------|
| TypeScript | 5.9.3 (strict) | All logic |
| D3.js | 7.9.0 | DOM management, data joins |
| sql.js | 1.14.0 (FTS5 WASM) | System of record |
| Vite | 7.3.1 | Build |
| Vitest | 4.0.18 | Tests |
| Biome | 2.4.6 | Lint |
| Playwright | 1.58.2 | E2E |
| StateManager | — | Tier 2 ui_state persistence |
| DOMPurify | 3.3.2 | XSS sanitization (notebook) |
| marked | 17.0.4 | Markdown (notebook) |

---

## Feature Area: Tab Management UX

### Pattern: Pure DOM tab bar with event delegation

The current SuperWidget tabs slot (`[data-slot="tabs"]`) already renders placeholder buttons with `data-tab-role="tab"` and `data-tab-active="true"`. The Projection state machine (`enabledTabIds`, `activeTabId`) already tracks tab state. What is missing is the wiring layer that makes tab clicks invoke `commitProjection(switchTab(...))`.

**Recommended approach:** Event-delegated click handler on `_tabsEl` in SuperWidget, mirroring the identical pattern used in `ExplorerCanvas.ts` (tab bar delegation via `.closest('[data-tab-id]')`). No library needed.

**Tab create/close:** Add/remove tabs by calling `toggleTabEnabled()` (already implemented in `projection.ts`). Render a close button as a child `<button>` inside each tab `<button>` — intercept click before delegation fires via `e.stopPropagation()`. This matches browser tab bar convention; the inner button carries `aria-label="Close tab"` to satisfy the nested interactive element ARIA requirement.

**ARIA pattern:** `role="tablist"` on `[data-slot="tabs"]`, `role="tab"` on each button, `aria-selected` mirrors `data-tab-active`, `aria-controls` points to the canvas slot id. Keyboard: ArrowLeft/ArrowRight cycle tabs (roving tabindex pattern — already validated in CommandBar and ViewTabBar at v6.1). Delete key on focused tab triggers close. Matches W3C APG Tabs pattern.

**Confidence:** HIGH — pattern is the exact pattern already validated in ExplorerCanvas and DockNav.

---

## Feature Area: Tab Drag-to-Reorder

### Pattern: Pointer events with setPointerCapture — no library

The codebase made a binding architectural decision at v7.2: all drag surfaces use pointer events (not HTML5 DnD) because WKWebView intercepts HTML5 `dragstart`. This must be honored here.

The SuperGrid axis grip reorder (same-dimension reorder via `pointerdown/pointermove/pointerup` in v7.2) is the reference implementation. Tab reorder is simpler — it is 1D horizontal, not 2D.

**Recommended approach:**
1. `pointerdown` on tab: record `startIndex`, call `el.setPointerCapture(e.pointerId)` to pin the pointer to the element during fast movement.
2. `pointermove`: compute drag offset, derive `targetIndex` from tab midpoints via `getBoundingClientRect()` on sibling tabs. Apply a CSS `translate3d` ghost offset to the dragged tab.
3. `pointerup`/`pointercancel`: call `reorderTab(fromIndex, toIndex)` — a new pure function analogous to `reorderColAxes` in PAFVProvider. Dispatch to update Projection `enabledTabIds` order and re-commit.
4. Visual feedback: `data-drag-active` attribute on dragging tab (CSS dims it with `opacity: 0.5`), insertion line `::after` pseudo-element on drop target (already validated in SuperGrid axis DnD at v7.2).

**Do NOT use:** `sortablejs`, `@dnd-kit/core`, `react-beautiful-dnd` — all are React-scoped or add a runtime dependency that violates the zero-framework constraint.

**Confidence:** HIGH — identical pointer-events pattern is already validated for SuperGrid axis reorder. Key Decision D-017: "Pointer events only for DnD" is binding.

---

## Feature Area: Explorer Sidecar Show/Hide Transitions

### Pattern: CSS `grid-template-columns` interpolation — no JS animation

The SuperWidget root is already a CSS Grid (`grid-template-rows: auto auto 1fr auto`). The sidecar explorer needs to animate in/out alongside the main canvas. The correct approach is to add a sidecar column and animate `grid-template-columns` between `0px` and the sidecar width.

**Recommended CSS pattern:**
```css
[data-component="superwidget"] {
  grid-template-columns: 1fr var(--sw-sidecar-width, 0px);
  transition: grid-template-columns 200ms ease-out;
}

[data-component="superwidget"][data-sidecar-visible="true"] {
  --sw-sidecar-width: 280px;
}
```

Header, tabs, and status rows remain full-width via `grid-column: 1 / -1`. The sidecar slot sits in column 2 of the canvas row only. No JavaScript animation, no WAAPI, no `requestAnimationFrame` loop.

**Browser support:** Chrome 107+, Firefox 66+, Safari 16+. All well above the iOS 17 / macOS 14 deployment target. HIGH confidence.

**`transition-behavior: allow-discrete` is NOT needed here.** `grid-template-columns` is an interpolatable numeric property, not a discrete one. `allow-discrete` is only needed for `display: none` toggles; adding it here introduces unnecessary complexity.

**Overflow guard:** The sidecar container must have `overflow: hidden` so content does not bleed through the `0px` column during the transition. Add `clip-path: inset(0)` as a safety belt on the sidecar element.

**Multiple sidecars:** VIEW_SIDECAR_MAP in ViewCanvas.ts currently maps only `supergrid → explorer-1`. For v13.3, stay with a single sidecar column. If multiple explorers are needed later, stack them as tabs within the sidecar slot rather than adding more grid columns.

**Confidence:** HIGH — grid transition is Baseline (widely available), integrates naturally into the existing `--sw-*` token system, no new dependencies.

---

## Feature Area: Rich Status Slots

### Pattern: Canvas-driven status rendering — extend existing statusSlot.ts

The existing `statusSlot.ts` (Phase 169) and `ViewCanvas._updateStatus()` (Phase 171) establish the canonical pattern: each canvas type owns its status DOM and writes to `[data-stat="..."]` spans. The status slot is a dumb container; canvases inject typed content.

**Recommended status content per canvas type:**

| Canvas Type | Status Content | Data Source |
|-------------|---------------|-------------|
| View (all 9 views) | `{View Name} · {N} cards` | `ViewManager.getLastCards().length` — already wired |
| View (filter active) | `{N} cards · {M} filters active` | `FilterProvider.getActiveFilterCount()` — add getter |
| View (selection active) | `{N} selected` appended as extra span | `SelectionProvider` — Tier 3, never persist |
| Editor (card open) | `{Card title} · Editing` | EditorCanvas current card state |
| Editor (unsaved) | `{Card title} · Unsaved changes` | shadow-buffer dirty flag |
| Explorer | `{N} datasets · Last import: {relative time}` | existing `updateStatusSlot()` in statusSlot.ts |

**Implementation pattern:** Each CanvasComponent calls a `_refreshStatus(statusEl)` private method that is triggered (a) on mount, (b) on `onProjectionChange`, and (c) on provider subscription callbacks. For ViewCanvas the `ViewManager.onViewSwitch` callback already triggers `_updateStatus`; extend it with a `FilterProvider.subscribe()` call for filter count updates.

**Do NOT use:** IntersectionObserver, MutationObserver, or polling for status updates. Use the existing event-driven subscription pattern (`provider.subscribe()` → callback → DOM update) already validated throughout the codebase.

**Confidence:** HIGH — pattern extends existing working code in ViewCanvas.ts and statusSlot.ts with no new API surface.

---

## Feature Area: Tab and Shell Session Persistence

### Pattern: StateManager Tier 2 via ui_state — existing infrastructure

Tabs are UI-configuration state (not data or selection), so they belong in Tier 2. The existing StateManager with `registerProvider()` + `enableAutoPersist()` + `restore()` already handles all Tier 2 persistence.

**Recommended persistence shape:**
```typescript
// ui_state key: 'superwidget:tabs'
interface TabSessionState {
  zones: {
    [zoneRole: string]: {
      enabledTabIds: string[];
      activeTabId: string;
      canvasType: string;
      canvasId: string;
    };
  };
}
```

**Integration:** Create a `SuperWidgetStateProvider` class implementing `PersistableProvider` (`getState() / setState() / resetState()`). Register with StateManager under key `'superwidget:tabs'` before calling `sm.restore()`. Auto-persist fires via `markDirty()` on every `commitProjection()` call.

**Migration guard:** Apply the same `_migrateState()` pattern from v5.3 — if a stored `canvasId` is not found in the current registry, fall back to the default Projection. This handles stale persisted state cleanly.

**Scoped vs global:** Tab state is NOT dataset-scoped (unlike PAFVProvider which uses Phase 130 `_scopedKeys`). Register without `scopeToDataset()`. Tabs persist globally across dataset switches.

**Confidence:** HIGH — StateManager + ui_state is the established, tested persistence layer. No alternative is appropriate.

---

## Recommended Stack

### Core Technologies (Unchanged)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TypeScript (strict) | 5.9.3 | All implementation | Locked |
| CSS custom properties | — | Sidecar transition, tab tokens | `--sw-*` namespace already established |
| Pointer Events API | — | Tab drag-to-reorder | D-017: no HTML5 DnD anywhere |
| StateManager + ui_state | — | Tab session persistence | Tier 2 canonical store |

### Supporting Libraries (Already Present)

| Library | Version | How It Applies to v13.3 |
|---------|---------|------------------------|
| D3.js | 7.9.0 | DOM management for status slot data joins (if any) |
| StateManager | — | `registerProvider('superwidget:tabs', ...)` |
| WorkerBridge | — | `ui:getAll` / `ui:set` messages for persistence |

---

## Installation

```bash
# Nothing to install — zero new dependencies
```

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `sortablejs` / `@dnd-kit/core` / `react-beautiful-dnd` | React-scoped or runtime framework dependency; violates zero-framework constraint | Pointer events with `setPointerCapture` (D-017, validated v7.2) |
| GSAP / Framer Motion / Anime.js | Animation library runtime; overkill for a CSS grid column transition | `grid-template-columns` CSS transition (Baseline, Chrome 107+) |
| `transition-behavior: allow-discrete` | Only needed for `display: none` discrete toggles; `grid-template-columns` is interpolatable | Plain CSS `transition: grid-template-columns 200ms ease-out` |
| CSS View Transitions API (`document.startViewTransition`) | Cross-document SPA transitions; Safari 18+ only (deployment target is iOS 17+) | CSS grid column transition |
| `localStorage` for tab state | Second, unsynchronized persistence layer; bypasses ui_state checkpoint flow | StateManager + ui_state via WorkerBridge |
| MutationObserver / polling for status updates | Anti-pattern in this codebase | Provider `subscribe()` callbacks (established pattern) |
| `@floating-ui/dom` / Popper.js | Not needed for tab bar or status bar | `title` attribute for tooltips (established convention) |
| React / Vue / Svelte components | Zero framework dependency is a locked architectural constraint | Pure TypeScript + D3/DOM |

---

## Integration Points with Existing Architecture

### SuperWidget.ts changes needed

1. Wire `_tabsEl` click delegation to call `switchTab()` + re-commit projection. Add a `setCommitCallback(fn)` so the owning shell connects its state management — keeps SuperWidget as a dumb renderer.
2. Grid layout update: expand from single-column to `grid-template-columns: 1fr var(--sw-sidecar-width, 0px)` with CSS transition. Sidecar column spans canvas row only; header/tabs/status remain `grid-column: 1 / -1`.
3. Add `data-sidecar-visible` attribute toggling — set by ViewCanvas via `onSidecarChange` callback (already exists in ViewCanvasConfig).

### StateCoordinator integration for status updates

Status slot updates for filter count require subscribing to FilterProvider changes. Use the existing `coordinator.subscribe()` pattern — do NOT add a new observer mechanism. The subscriber pattern is: `filter.subscribe(() => this._refreshStatus(this._statusEl))` inside ViewCanvas.mount().

### WorkbenchShell retirement

When SuperWidget becomes the primary container, WorkbenchShell's flex-column layout is retired. DockNav (v11.0) and inline explorer embedding (v11.1) live in the outer app shell, not inside SuperWidget's grid. SuperWidget is a zone primitive; the outer shell wraps DockNav + SuperWidget side-by-side.

---

## New CSS Tokens Needed

Extend the `--sw-*` namespace in `superwidget.css`:

| Token | Value | Purpose |
|-------|-------|---------|
| `--sw-sidecar-width` | `280px` | Sidecar expanded width |
| `--sw-sidecar-transition` | `grid-template-columns 200ms ease-out` | Matches `--transition-fast` timing convention |
| `--sw-tab-close-size` | `14px` | Close button target within tab pill |

---

## Alternatives Considered

| Recommendation | Alternative | Why Not |
|----------------|-------------|---------|
| CSS `grid-template-columns` transition for sidecar | CSS `max-width: 0` / `width: 0` on sidecar container | Grid approach is cleaner because sidecar is a true grid column; width tricks require additional `overflow: hidden` gymnastics and misfire in flex contexts |
| Pointer events for tab reorder | HTML5 DnD API | WKWebView intercepts `dragstart` (validated problem, fixed in v7.2); HTML5 DnD is architecturally banned (Key Decision D-017) |
| StateManager + ui_state for tab persistence | `localStorage` | localStorage creates a second unsynchronized persistence layer; ui_state is the canonical Tier 2 store flowing through WorkerBridge checkpoint |
| Inline close button inside tab pill | Right-click context menu to close | Inline close is discoverable, touch-friendly, and matches browser tab bar convention; context menu requires additional menu infrastructure |
| Single sidecar column (tabbed content inside) | Multiple sidecar grid columns | Simpler for v13.3; VIEW_SIDECAR_MAP currently maps one explorer per view type |

---

## Version Compatibility

All patterns are achievable with the locked dependency set. No version upgrades needed.

| Capability | Browser Requirement | Deployment Target | Status |
|-----------|--------------------|--------------------|--------|
| `grid-template-columns` transition | Chrome 107+, Safari 16+, Firefox 66+ | iOS 17+ / macOS 14+ (Safari 17+) | SAFE |
| Pointer events + `setPointerCapture` | Chrome 55+, Safari 13+, Firefox 59+ | iOS 17+ / macOS 14+ | SAFE |
| CSS custom properties (`--sw-*`) | Chrome 49+, Safari 9.1+, Firefox 31+ | iOS 17+ / macOS 14+ | SAFE |
| WAAPI (for FLIP animations, already in use) | Chrome 36+, Safari 13.1+, Firefox 48+ | iOS 17+ / macOS 14+ | SAFE |

---

## Sources

- `src/superwidget/SuperWidget.ts` — current four-slot CSS Grid layout and placeholder tab rendering (HIGH confidence, direct analysis)
- `src/superwidget/projection.ts` — Projection state machine, switchTab/toggleTabEnabled/validateProjection (HIGH confidence, direct analysis)
- `src/superwidget/ExplorerCanvas.ts` — event-delegation tab click pattern, reference implementation (HIGH confidence, direct analysis)
- `src/superwidget/ViewCanvas.ts` — status slot update pattern, onSidecarChange callback (HIGH confidence, direct analysis)
- `src/superwidget/statusSlot.ts` — existing status rendering primitives (HIGH confidence, direct analysis)
- `src/styles/superwidget.css` — current `--sw-*` token namespace and grid layout (HIGH confidence, direct analysis)
- `src/providers/StateManager.ts` — Tier 2 persistence via ui_state (HIGH confidence, direct analysis)
- `PROJECT.md` Key Decisions — D-017 (Pointer events only), D-005 (three-tier persistence), v7.2 validated patterns (HIGH confidence)
- [CSS animated grid layouts — web.dev](https://web.dev/articles/css-animated-grid-layouts) — `grid-template-columns` transition, browser support (Chrome 107+, Safari 16+, Firefox 66+) (MEDIUM confidence, official source)
- [transition-behavior: allow-discrete — modern-css.com](https://modern-css.com/animating-display-none-without-workarounds/) — discrete property transitions; confirmed NOT needed for grid column interpolation (MEDIUM confidence)
- [W3C WAI-ARIA APG Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) — tablist/tab/tabpanel ARIA structure, ArrowLeft/Right keyboard navigation (HIGH confidence, authoritative spec)
- [Smooth Drag Interactions with Pointer Events — DEV Community](https://dev.to/nishinoshake/smooth-drag-interactions-with-pointer-events-5e2j) — setPointerCapture pattern for drag-to-reorder (MEDIUM confidence, corroborates existing D-017 decision)

---
*Stack research for: v13.3 SuperWidget Shell*
*Researched: 2026-04-21*
