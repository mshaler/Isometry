# Phase 174: Tab Management - Research

**Researched:** 2026-04-21
**Domain:** SuperWidget tab bar — TypeScript DOM, Pointer Events DnD, roving tabindex, overflow chevrons
**Confidence:** HIGH

## Summary

Phase 174 establishes a real tab management system in the SuperWidget's `[data-slot="tabs"]` slot, replacing three placeholder buttons with a full tab bar backed by a new `TabSlot` type. All 10 requirements (TABS-01 through TABS-10) are within the existing project stack — no new libraries, no new npm packages.

The implementation has four technical concerns: (1) `TabSlot` type definition that wraps `Projection` without conflating with canvas-internal tabs, (2) tab state management — create/close/switch/reorder operating through `commitProjection` and pure transition functions, (3) DOM rendering — a `.sw-tab-strip` flex scroll container with left/right chevron overflow affordances replacing the `mask-image` fade, and (4) drag reorder using the Pointer Events API pattern already present in `PivotConfigPanel.ts` with an insertion line visual.

The project already has every building block needed: `switchTab()` / `toggleTabEnabled()` in `projection.ts`, the roving tabindex pattern in `ViewTabBar.ts`, the Pointer Events DnD + insertion line pattern in `PivotConfigPanel.ts`, and `ShortcutRegistry.register()` for Cmd+W. Research is entirely internal — no external documentation required.

**Primary recommendation:** Build `TabBar` as a standalone class in `src/superwidget/TabBar.ts`. Wire it into `SuperWidget` without SuperWidget importing `TabBar` directly — pass a factory or have SuperWidget accept a `tabBar` config object. Keep `TabSlot[]` array state in a new `TabManager` utility (or inline in `SuperWidget`) and drive all mutations through `switchTab()` / `toggleTabEnabled()` to preserve reference-equality bail-outs in `commitProjection`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** New tabs default to View (Bound) canvas type. No canvas chooser screen.
- **D-02:** All tabs share the same provider state (FilterProvider, PAFVProvider, DensityProvider). Switching tabs only changes the canvas.
- **D-03:** TabSlot wraps a Projection. TabSlot adds shell-level metadata (label, badge) without conflating with canvas-internal tabs.
- **D-04:** When a tab is closed, the adjacent tab activates — the tab to the right, or if rightmost was closed, the tab to its left. Standard browser convention.
- **D-05:** No close confirmation dialogs. Close is always immediate.
- **D-06:** Last tab cannot be closed. The × button should be hidden or disabled on the sole remaining tab.
- **D-07:** Insertion line visual feedback during drag reorder — vertical line appears between tabs at the drop target. Dragged tab dims at source position. Matches existing SuperDynamic axis reorder pattern.
- **D-08:** Pointer Events API for drag (not HTML5 Drag and Drop) — consistent with existing DnD patterns.
- **D-09:** Replace the existing CSS `mask-image` edge fade with explicit chevron buttons. Left/right chevrons appear only when overflow exists in that direction. Clicking a chevron scrolls by one tab width.
- **D-10:** Remove `scrollbar-width: none` and `mask-image` from the tabs slot CSS. Chevrons become the sole overflow affordance.

### Claude's Discretion
- Exact TabSlot type shape (fields beyond what Projection provides)
- Whether chevron scroll uses `scrollBy()` with smooth behavior or manual animation
- Internal data structure for tab ordering (array vs linked list)
- Whether Cmd+W close fires through ShortcutRegistry or a dedicated handler
- FLIP animation on reorder (if warranted given tab count is typically small)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TABS-01 | User can create a new tab via + button in the tab bar | `toggleTabEnabled()` adds to enabledTabIds; new Projection via spread; `.sw-tab-strip__add` button pattern from UI-SPEC |
| TABS-02 | User can close a tab via × button (last tab cannot be closed) | Guard: `enabledTabIds.length === 1` → hide/disable ×; close fires `toggleTabEnabled(proj, tabId)` after adjacency selection |
| TABS-03 | User can switch between tabs by clicking tab headers | `switchTab(proj, tabId)` → `commitProjection(newProj)` |
| TABS-04 | Active tab has a visible indicator distinguishing it from inactive tabs | `[data-tab-active="true"]` CSS rule already exists in superwidget.css; set on active tab only |
| TABS-05 | User can reorder tabs via pointer drag-and-drop | Pointer Events pattern from `PivotConfigPanel.ts`; insertion line from `.pv-insertion-line` precedent; reorder updates TabSlot array, re-renders tab list |
| TABS-06 | Tab bar shows overflow chevrons when tabs exceed available width | `.sw-tab-strip` scroll container + ResizeObserver + scroll event listener; chevrons shown/hidden based on scrollLeft position |
| TABS-07 | User can navigate tabs via keyboard (roving tabindex, arrow keys) | Roving tabindex from `ViewTabBar.ts`; ArrowLeft/Right/Home/End; event delegation on `[data-slot="tabs"]` |
| TABS-08 | User can close active tab via Cmd+W shortcut | `ShortcutRegistry.register('Cmd+W', ...)` — no-op guard when `enabledTabIds.length === 1` |
| TABS-09 | TabSlot type wraps Projection without conflating shell-level tabs with canvas-internal tabs | New `TabSlot` interface: `{ tabId: string; label: string; badge?: string; projection: Projection }` |
| TABS-10 | Tab metadata flows upward via onTabMetadataChange callback (CANV-06 preserved) | `CanvasComponent` interface extension: `onTabMetadataChange?(meta: { label?: string; badge?: string }): void` |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9 (strict) | All implementation code | Project standard — no alternatives |
| CSS custom properties | Native | `--sw-*` tokens for tab bar styling | Project pattern — all SuperWidget CSS uses this namespace |
| Pointer Events API | Native browser | Drag reorder | D-08 locked; already used in PivotConfigPanel, SuperGridSizer, KanbanView |
| ResizeObserver | Native browser | Overflow chevron recompute on resize | Already used in multiple places in the codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| D3 data join | v7.9 | Tab list DOM rendering | Optional — tab count is small (2-8); plain DOM loop acceptable |

**Note on D3 vs plain DOM for tabs:** The CONTEXT.md explicitly notes "tab bar is likely plain DOM given small element count." Plain DOM array mapping is simpler and matches the SuperWidget constructor's own style. D3 data join adds overhead not warranted for 2-8 tabs.

**Installation:** No new packages required. Phase is purely within existing codebase.

---

## Architecture Patterns

### Recommended Project Structure

```
src/superwidget/
├── TabBar.ts           # New: tab bar DOM rendering + event handling
├── TabSlot.ts          # New: TabSlot type + factory helpers
├── SuperWidget.ts      # Modified: wire TabBar, expose tab lifecycle hooks
├── projection.ts       # Existing: switchTab(), toggleTabEnabled() — no changes needed
└── registry.ts         # Existing: canvas registry — no changes needed

src/styles/
└── superwidget.css     # Modified: remove mask-image/scrollbar-width; add chevron + close button styles

tests/superwidget/
├── TabBar.test.ts      # New: TABS-01..TABS-08 unit tests
└── TabSlot.test.ts     # New: TABS-09 type + factory tests
```

### Pattern 1: TabSlot Type

**What:** Thin shell-level wrapper around a `Projection` that adds display metadata.
**When to use:** Whenever the tab bar needs to render a label or badge without reaching into the canvas.

```typescript
// src/superwidget/TabSlot.ts
import type { Projection } from './projection';

export interface TabSlot {
  readonly tabId: string;         // Matches projection.activeTabId convention
  readonly label: string;         // Display name (e.g., "View", "Editor", "Explorer")
  readonly badge?: string;        // Optional canvas-provided metadata (TABS-10)
  readonly projection: Projection; // Wrapped projection — read canvasType, canvasBinding from here
}

/** Factory: create a new TabSlot with View (Bound) defaults (D-01). */
export function makeTabSlot(overrides?: Partial<TabSlot>): TabSlot {
  const tabId = overrides?.tabId ?? `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    tabId,
    label: overrides?.label ?? 'View',
    badge: overrides?.badge,
    projection: overrides?.projection ?? {
      canvasType: 'View',
      canvasBinding: 'Bound',
      zoneRole: 'primary',
      canvasId: 'view-canvas',
      activeTabId: tabId,
      enabledTabIds: [tabId],
    },
  };
}
```

**Key insight:** `TabSlot.tabId` mirrors `projection.activeTabId` for the tab that IS this slot. The `Projection.activeTabId` field on the wrapped projection is the canvas-internal active sub-tab (e.g., the active explorer panel tab). These are DIFFERENT concepts — do not conflate.

### Pattern 2: Tab State as Array of TabSlots

**What:** `TabSlot[]` is the source of truth for tab ordering and metadata. Active tab is tracked as `activeTabSlotId: string`.
**When to use:** All tab mutations operate on the array; the active Projection for `commitProjection` is derived from the active TabSlot's `.projection`.

```typescript
// Inside SuperWidget or a TabManager helper
private _tabs: TabSlot[] = [];
private _activeTabId: string = '';

// Deriving active Projection:
getActiveProjection(): Projection | null {
  const slot = this._tabs.find(t => t.tabId === this._activeTabId);
  return slot?.projection ?? null;
}
```

**Internal data structure decision (Claude's discretion):** Use a plain array. Tab count is bounded (2-8 visible, capped by UX). Linked list complexity is not warranted.

### Pattern 3: Pointer Events Drag Reorder

**What:** Pointer Events API drag with `setPointerCapture`, ghost element, and insertion line. Exact pattern from `PivotConfigPanel.ts`.
**When to use:** TABS-05 drag reorder.

```typescript
// Matches PivotConfigPanel._startDrag() pattern
tabEl.addEventListener('pointerdown', (e: PointerEvent) => {
  e.preventDefault();
  tabEl.setPointerCapture(e.pointerId);
  // Set drag state, create insertion line element, apply opacity
  tabEl.dataset['tabDragging'] = 'true';
  // Register document-level pointermove/pointerup listeners
});
```

**Drag threshold:** 4px movement before activating drag mode (prevents accidental drag on click — per UI-SPEC). Check `Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4` in pointermove before entering drag state.

**Insertion line:** Vertical (not horizontal like PivotConfigPanel's horizontal zones). Position as `position: fixed; width: 2px; height: tabBarHeight; left: insertX` using tab `getBoundingClientRect()` midpoints along X axis.

### Pattern 4: Roving Tabindex (from ViewTabBar.ts)

**What:** Only the active tab has `tabindex="0"`; all others have `tabindex="-1"`. Keyboard events handled by event delegation on the container.
**When to use:** TABS-07 keyboard navigation.

```typescript
// Event delegation on [data-slot="tabs"] — matches ViewTabBar.ts pattern
tabsSlotEl.addEventListener('keydown', (e: KeyboardEvent) => {
  const tabs = this._tabs;
  const current = tabs.findIndex(t => t.tabId === this._activeTabId);
  if (e.key === 'ArrowRight') {
    const next = (current + 1) % tabs.length;
    this._switchToTab(tabs[next]!.tabId);
    this._focusTab(tabs[next]!.tabId);
  }
  // ArrowLeft, Home, End follow same pattern
});
```

### Pattern 5: Overflow Chevrons

**What:** `[data-slot="tabs"]` outer wrapper becomes a flex row: `[chevron-left] [.sw-tab-strip] [chevron-right] [add-button]`. The `.sw-tab-strip` is the only scrolling element.
**When to use:** TABS-06.

```typescript
// Chevron visibility update — called after scroll events and ResizeObserver
private _updateChevrons(): void {
  const strip = this._stripEl;
  const atStart = strip.scrollLeft <= 0;
  const atEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1;
  this._leftChevron.style.display = atStart ? 'none' : 'flex';
  this._rightChevron.style.display = atEnd ? 'none' : 'flex';
}

// Chevron click — D-09: scrollBy with smooth
this._rightChevron.addEventListener('click', () => {
  const tabWidth = this._stripEl.querySelector('[data-tab-role="tab"]')?.clientWidth ?? 120;
  this._stripEl.scrollBy({ left: tabWidth + 4, behavior: 'smooth' });
});
```

**ResizeObserver teardown:** Store observer reference; call `.disconnect()` in `destroy()` to prevent leaks.

### Pattern 6: CanvasComponent Metadata Callback (TABS-10)

**What:** Extend the existing `CanvasComponent` interface with an optional `onTabMetadataChange` setter that SuperWidget injects after mounting a canvas.
**When to use:** TABS-10 — canvas updates badge/label without triggering `commitProjection`.

```typescript
// Extension to projection.ts CanvasComponent interface
export interface CanvasComponent {
  mount(container: HTMLElement): void;
  destroy(): void;
  onProjectionChange?(proj: Projection): void;
  // TABS-10: injected by SuperWidget after mount
  onTabMetadataChange?: ((meta: TabMetadata) => void) | undefined;
}

export interface TabMetadata {
  label?: string;
  badge?: string;
}
```

SuperWidget injects the callback after `canvas.mount()`:
```typescript
if (canvas.onTabMetadataChange !== undefined) {
  canvas.onTabMetadataChange = (meta) => this._updateTabMetadata(activeTabId, meta);
}
```

**CANV-06 preserved:** SuperWidget never imports any canvas class. The callback is injected through the `CanvasComponent` interface only.

### Anti-Patterns to Avoid

- **Storing Projection inside enabledTabIds strings:** `enabledTabIds` already exists on `Projection` as an array of string IDs. Do not re-use `enabledTabIds` for shell-level tab ordering — that's canvas-internal. The `TabSlot[]` array is the shell's source of truth for tab order, independent of `Projection.enabledTabIds`.
- **Calling canvas methods directly from tab switch:** Tab switch MUST go through `commitProjection()` → `activeTabId` change. No direct canvas method calls from the tab bar.
- **Using HTML5 DnD API:** D-08 locks Pointer Events. HTML5 DnD has `dragstart`/`dragover` API which is locked out.
- **Putting the tab bar scroll container on `[data-slot="tabs"]` directly:** D-09 requires removing `scrollbar-width: none` and `mask-image` from the slot itself. The slot becomes a flex row host; `.sw-tab-strip` is the scroll child.
- **Adding per-tab event listeners:** Use event delegation on the tab strip container (event delegation is a v6.0 performance pattern in this codebase).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab switch state transition | Custom state update logic | `switchTab(proj, tabId)` from projection.ts | Already handles reference-equality bail-out and active tab guard |
| Tab enable/disable | Custom array manipulation | `toggleTabEnabled(proj, tabId)` from projection.ts | Already handles "never remove active tab" guard |
| Pointer capture for drag | Custom mouse tracking | `element.setPointerCapture(e.pointerId)` | Pointer capture routes all pointermove/pointerup to the capturing element even if pointer leaves the element |
| Keyboard shortcut registration | Ad-hoc keydown listener | `ShortcutRegistry.register('Cmd+W', ...)` | Input field guard, Mac/Win normalization already handled |
| Tab ID generation | Sequential counter | `crypto.randomUUID()` or timestamp+random suffix | Avoid collisions across sessions; timestamp alone is fine for session-scoped IDs |

---

## Common Pitfalls

### Pitfall 1: TabSlot.tabId vs Projection.activeTabId Conflation
**What goes wrong:** Developer uses `Projection.activeTabId` to look up the current shell tab, but `activeTabId` is canvas-internal (e.g., the active explorer panel tab). Shell tab lookup uses `TabSlot.tabId`.
**Why it happens:** Both are called "tab id" but refer to different tab levels (shell tabs vs canvas sub-tabs).
**How to avoid:** `TabSlot.tabId` is always the shell-level identifier. `Projection.activeTabId` is canvas-internal. Never conflate. Document this distinction in the `TabSlot` interface JSDoc.
**Warning signs:** `commitProjection` is called with a `Projection` whose `activeTabId` does not match any `TabSlot.tabId`.

### Pitfall 2: Close Button Click Propagating to Tab Switch
**What goes wrong:** Clicking × fires both the close handler and the tab switch handler (since close button is a child of the tab button).
**Why it happens:** Click event bubbles from `.sw-tab__close` up to `[data-tab-role="tab"]`.
**How to avoid:** Call `e.stopPropagation()` in the close button's click handler. Noted explicitly in UI-SPEC section TABS-02.
**Warning signs:** Closing a tab activates it briefly before removing it.

### Pitfall 3: ResizeObserver Leak
**What goes wrong:** `ResizeObserver` created in tab bar initialization is never disconnected; memory leaks when SuperWidget is destroyed.
**Why it happens:** ResizeObserver holds a reference to the observed element and callback.
**How to avoid:** Store the `ResizeObserver` instance; call `.disconnect()` in `TabBar.destroy()`.
**Warning signs:** Multiple resize observers firing on the same tab strip after multiple mount/destroy cycles.

### Pitfall 4: Drag Threshold Missing
**What goes wrong:** Rapid click on a tab triggers drag state, dimming the tab and blocking the click from registering as a switch.
**Why it happens:** `pointerdown` immediately starts drag without checking movement.
**How to avoid:** Only enter drag mode after ≥4px of movement in `pointermove`. On `pointerup` without reaching threshold, treat as a click.
**Warning signs:** Tabs flicker on click; drag mode activates without moving the pointer.

### Pitfall 5: Chevron Visibility Not Updating After Tab Creation
**What goes wrong:** After adding a tab that causes overflow, chevrons don't appear until the user scrolls manually.
**Why it happens:** Chevron update is only wired to scroll events, not to tab array mutations.
**How to avoid:** Call `_updateChevrons()` after any tab array mutation (create, close, reorder) in addition to scroll/resize events. Use `requestAnimationFrame` to defer until DOM has updated.
**Warning signs:** Chevrons appear stale after creating a tab that overflows.

### Pitfall 6: New Tab scrollIntoView Timing
**What goes wrong:** `scrollIntoView` called immediately after DOM append doesn't scroll because the element has no layout yet.
**Why it happens:** Layout hasn't run; offsetLeft/width are 0.
**How to avoid:** Wrap `scrollIntoView` (or `scrollBy` to the new tab) in `requestAnimationFrame` after appending the new tab button to the DOM.
**Warning signs:** New tab is created off-screen to the right; user must manually scroll to find it.

---

## Code Examples

Verified patterns from existing codebase sources:

### Roving Tabindex (from ViewTabBar.ts)
```typescript
// Source: src/ui/ViewTabBar.ts — constructor keyboard handler
this._el.addEventListener('keydown', (e: KeyboardEvent) => {
  const types = VIEW_LABELS.map((v) => v.type);
  const currentIndex = types.indexOf(this._activeType);
  let nextIndex: number | null = null;
  if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % types.length;
  else if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + types.length) % types.length;
  else if (e.key === 'Home') nextIndex = 0;
  else if (e.key === 'End') nextIndex = types.length - 1;

  if (nextIndex !== null) {
    e.preventDefault();
    config.onSwitch(types[nextIndex]!);
    this._buttons.get(types[nextIndex]!)?.focus();
  }
});
```

### Pointer Events Drag with setPointerCapture (from PivotConfigPanel.ts)
```typescript
// Source: src/views/pivot/PivotConfigPanel.ts — _startDrag + document listeners
chip.addEventListener('pointerdown', (e: PointerEvent) => {
  e.preventDefault();
  this._startDrag(dimension, sourceZone, e);
});
// Inside _startDrag:
document.addEventListener('pointermove', this._boundPointerMove);
document.addEventListener('pointerup', this._boundPointerUp);
```

### Insertion Line Visual (from pivot.css)
```css
/* Source: src/styles/pivot.css — .pv-insertion-line */
.pv-insertion-line {
  position: fixed;
  height: 2px;
  background: var(--pv-accent, #3b82f6);
  border-radius: 1px;
  z-index: 10000;
  pointer-events: none;
  display: none;
  box-shadow: 0 0 4px var(--pv-accent, #3b82f6);
}
/* Tab bar variant: use width: 2px + height: <tab-bar-height>px for vertical line */
```

### ShortcutRegistry Registration Pattern
```typescript
// Source: src/shortcuts/ShortcutRegistry.ts
shortcuts.register('Cmd+W', () => {
  if (this._tabs.length <= 1) return; // D-06 guard
  this._closeTab(this._activeTabId);
}, { category: 'Tabs', description: 'Close active tab' });
```

### switchTab Pure Transition (from projection.ts)
```typescript
// Source: src/superwidget/projection.ts
export function switchTab(proj: Projection, tabId: string): Projection {
  if (!proj.enabledTabIds.includes(tabId)) return proj; // reference-equality bail-out
  if (proj.activeTabId === tabId) return proj;           // reference-equality bail-out
  return { ...proj, activeTabId: tabId };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Placeholder hardcoded tab buttons in SuperWidget constructor | Real TabSlot-driven rendering | Phase 174 | Replaces all placeholder buttons |
| `mask-image` CSS edge fade for overflow | Explicit left/right chevron buttons | Phase 174 (D-09) | Chevrons must be wired to scroll state |
| `scrollbar-width: none` on `[data-slot="tabs"]` | Moved to `.sw-tab-strip` inner container | Phase 174 (D-10) | Outer slot becomes flex row; scroll hidden only on inner strip |

**CSS changes required (D-09, D-10):**
- Remove from `[data-slot="tabs"]`: `scrollbar-width: none`, `mask-image: linear-gradient(...)`, `overflow-x: auto`
- Add to `[data-slot="tabs"]`: `overflow: hidden`, flex layout for chevrons + strip + add button
- New `.sw-tab-strip`: `overflow-x: scroll; scrollbar-width: none; display: flex; flex: 1 1 auto; min-width: 0`

---

## Open Questions

1. **TabSlot storage scope**
   - What we know: `TabSlot[]` must live somewhere accessible to both `SuperWidget` (for rendering) and potentially `main.ts` (for initial setup).
   - What's unclear: Whether `TabSlot[]` lives inside `SuperWidget` as private state or in a separate `TabManager` that `SuperWidget` accepts as a config parameter.
   - Recommendation: Keep `TabSlot[]` as private state inside `SuperWidget` for Phase 174. Phase 177 (persistence) will likely need to externalize this — cross that bridge then.

2. **CanvasComponent interface changes backward compatibility**
   - What we know: Adding `onTabMetadataChange?` to `CanvasComponent` is additive (optional field).
   - What's unclear: Whether existing canvas stub tests (`ExplorerCanvasStub.test.ts`, `ViewCanvasStub.test.ts`, `EditorCanvasStub.test.ts`) need updating.
   - Recommendation: Since the field is optional (`?`), existing stubs should pass TypeScript strict check without changes. Verify in Wave 0.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — pure TypeScript + CSS changes within existing project stack).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/superwidget/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TABS-01 | + button creates new TabSlot with View Bound defaults | unit | `npx vitest run tests/superwidget/TabBar.test.ts` | ❌ Wave 0 |
| TABS-02 | × button closes tab; last tab × is hidden/disabled | unit | `npx vitest run tests/superwidget/TabBar.test.ts` | ❌ Wave 0 |
| TABS-03 | Tab click fires switchTab and commitProjection | unit | `npx vitest run tests/superwidget/TabBar.test.ts` | ❌ Wave 0 |
| TABS-04 | Active tab has data-tab-active="true", others don't | unit | `npx vitest run tests/superwidget/TabBar.test.ts` | ❌ Wave 0 |
| TABS-05 | Drag reorder updates tab array order | unit | `npx vitest run tests/superwidget/TabBar.test.ts` | ❌ Wave 0 |
| TABS-06 | Chevrons show/hide based on scroll position | unit | `npx vitest run tests/superwidget/TabBar.test.ts` | ❌ Wave 0 |
| TABS-07 | ArrowLeft/Right/Home/End moves focus + switches tab | unit | `npx vitest run tests/superwidget/TabBar.test.ts` | ❌ Wave 0 |
| TABS-08 | Cmd+W closes active tab; no-op on last tab | unit | `npx vitest run tests/superwidget/TabBar.test.ts` | ❌ Wave 0 |
| TABS-09 | TabSlot type wraps Projection; fields do not overlap | unit | `npx vitest run tests/superwidget/TabSlot.test.ts` | ❌ Wave 0 |
| TABS-10 | onTabMetadataChange updates badge without commitProjection | unit | `npx vitest run tests/superwidget/TabBar.test.ts` | ❌ Wave 0 |

**jsdom annotation required:** All new superwidget tests must have `// @vitest-environment jsdom` at top of file (matching existing `tests/superwidget/SuperWidget.test.ts` pattern). Default vitest environment is `node` (WASM runs in node).

### Sampling Rate
- **Per task commit:** `npx vitest run tests/superwidget/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/superwidget/TabBar.test.ts` — covers TABS-01 through TABS-08, TABS-10 (must include `// @vitest-environment jsdom`)
- [ ] `tests/superwidget/TabSlot.test.ts` — covers TABS-09 TabSlot type shape and `makeTabSlot()` factory

*(No framework install needed — Vitest 4.0 already in dev dependencies)*

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 174 |
|-----------|---------------------|
| No abstractions for single-use code | Do not create a generic "DragManager" class — inline drag state in TabBar if only tabs use it |
| Simplicity first — min code that solves the problem | Plain DOM array for tabs; no D3 join unless genuinely simpler |
| Surgical changes — touch only what you must | Only modify `[data-slot="tabs"]` CSS rules; do not reorganize superwidget.css |
| Match existing style even if you'd do it differently | Use `dataset['tabRole']` (bracket notation for index signatures, strict mode) |
| TDD is non-negotiable | Write TabBar.test.ts and TabSlot.test.ts before implementing TabBar.ts |
| D3 key function mandatory on every `.data()` call | If D3 join used for tab rendering, key by `tabId` |

---

## Sources

### Primary (HIGH confidence)
- `src/superwidget/SuperWidget.ts` — current placeholder tab structure, `commitProjection` lifecycle
- `src/superwidget/projection.ts` — `switchTab()`, `toggleTabEnabled()`, `validateProjection()`, `CanvasComponent` interface
- `src/ui/ViewTabBar.ts` — roving tabindex pattern (ArrowLeft/Right/Home/End, aria-selected, tabindex)
- `src/ui/DockNav.ts` — event delegation pattern, roving tabindex variant
- `src/views/pivot/PivotConfigPanel.ts` — Pointer Events DnD with insertion line, ghost element, source dimming
- `src/styles/superwidget.css` — existing `--sw-*` tokens, `[data-tab-role]` selectors, tabs slot CSS
- `src/styles/pivot.css` — `.pv-insertion-line` visual specification
- `src/shortcuts/ShortcutRegistry.ts` — `register(shortcut, handler, meta)` API
- `.planning/phases/174-tab-management/174-UI-SPEC.md` — approved visual and interaction contract

### Secondary (MEDIUM confidence)
- `tests/superwidget/SuperWidget.test.ts` — jsdom environment annotation pattern for superwidget tests
- `vitest.config.ts` — default `environment: 'node'` confirms jsdom annotation is required

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all patterns verified in existing source files
- Architecture: HIGH — TabSlot type shape, DnD pattern, roving tabindex pattern all directly verified
- Pitfalls: HIGH — drag threshold, close propagation, ResizeObserver leak verified against existing DnD code
- CSS changes: HIGH — specific selectors and token additions verified against UI-SPEC and existing superwidget.css

**Research date:** 2026-04-21
**Valid until:** Stable — no external dependencies; valid until codebase changes
