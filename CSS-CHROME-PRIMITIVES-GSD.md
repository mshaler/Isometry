# GSD Milestone: CSS Chrome Primitives

*Offloading Visual State from React to CSS*

**Date:** February 2026  
**Type:** GSD Executor Handoff  
**Target:** Claude Code  
**Depends on:** @isometry/primitives Tier 1 tokens (tokens.css must exist first)  
**Scope:** Migrate presentation-state management from React useState to CSS-only patterns

---

## Problem Statement

The current Isometry control chrome uses React `useState` for visual toggles (sidebar open/closed, panel collapsed/expanded, tooltip visible/hidden). Each toggle creates a re-render. On iOS, unnecessary re-renders compete with D3's rendering budget. Many of these are **presentation state** — they control visibility and layout, not application logic.

**CSS can handle presentation state natively** via `:has()`, `<details>`, `<dialog>`, `position: sticky`, and transition properties. Moving these out of React means fewer re-renders, faster perceived performance, and chrome that works before JS hydrates.

---

## Guiding Principle

```
Presentation state  →  CSS    (visible/hidden, expanded/collapsed, highlighted/normal)
Application state   →  React  (selected facets, data mutations, undo stack)
Data state          →  D3     (enter/update/exit, force simulations)
```

**Litmus test**: "If this state were lost on page reload, would the user lose work?" If no → CSS. If yes → React.

---

## Task 1: Sidebar Collapse

**Current**: React `useState<boolean>(sidebarOpen)` triggers re-render of entire layout.

**Target**: Pure CSS with a class toggle.

```css
/* src/styles/chrome/sidebar.css */

.iso-sidebar {
  width: var(--iso-sidebar-w, 260px);
  transition: width var(--iso-transition-normal),
              opacity var(--iso-transition-normal);
  overflow: hidden;
  flex-shrink: 0;
}

.iso-sidebar[data-collapsed="true"] {
  width: var(--iso-sidebar-collapsed-w, 44px);
}

.iso-sidebar[data-collapsed="true"] .iso-sidebar__content {
  opacity: 0;
  pointer-events: none;
}

.iso-sidebar[data-collapsed="true"] .iso-sidebar__toggle-icon {
  transform: rotate(180deg);
}
```

**JS**: One line — `sidebar.dataset.collapsed = sidebar.dataset.collapsed === "true" ? "false" : "true";`

**No React state, no re-render.** The toggle button lives in the DOM, CSS handles all visual transitions.

**Primitives to add to `tokens.css`:**

```css
:root {
  --iso-sidebar-w: 260px;
  --iso-sidebar-collapsed-w: 44px;
}
```

**Verification**: Sidebar animates open/closed. No React component re-renders (confirm via React DevTools profiler).

---

## Task 2: Accordion Panels (Inspector, LATCH Editor)

**Current**: React state per-panel `useState<Record<string, boolean>>`.

**Target**: Native `<details>` + CSS.

```css
/* src/styles/chrome/accordion.css */

.iso-accordion-item {
  border-bottom: 1px solid var(--iso-border-subtle);
}

.iso-accordion-item > summary {
  display: flex;
  align-items: center;
  padding: var(--iso-space-md) var(--iso-space-lg);
  cursor: pointer;
  user-select: none;
  font-size: var(--iso-font-size-sm);
  font-weight: var(--iso-font-weight-medium);
  color: var(--iso-fg-primary);
  list-style: none; /* remove default marker */
}

.iso-accordion-item > summary::before {
  content: "▶";
  font-size: 10px;
  margin-right: var(--iso-space-md);
  transition: transform var(--iso-transition-fast);
  color: var(--iso-fg-muted);
}

.iso-accordion-item[open] > summary::before {
  transform: rotate(90deg);
}

.iso-accordion-item > .iso-accordion-body {
  padding: 0 var(--iso-space-lg) var(--iso-space-lg);
  animation: iso-accordion-open var(--iso-transition-normal) ease;
}

@keyframes iso-accordion-open {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

**HTML**:
```html
<details class="iso-accordion-item" open>
  <summary>Time Facets</summary>
  <div class="iso-accordion-body">
    <!-- facet controls here -->
  </div>
</details>
```

**Zero JS needed.** The browser handles open/close state natively.

**Verification**: Accordion opens/closes with animation. No React state involved. Works with SSR/pre-hydration.

---

## Task 3: Sticky Headers (SuperGrid)

**Current**: Manual scroll listener + React state to toggle sticky class.

**Target**: Pure CSS `position: sticky`.

```css
/* src/styles/chrome/sticky-headers.css */

.iso-grid-col-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--iso-header-col0); /* must be opaque for sticky to look right */
}

.iso-grid-col-header--depth1 {
  top: var(--iso-grid-col-hdr-h); /* offset by parent header height */
  z-index: 19;
  background: var(--iso-header-col1);
}

.iso-grid-row-header {
  position: sticky;
  left: 0;
  z-index: 18;
  background: var(--iso-header-row0);
}

.iso-grid-row-header--depth1 {
  left: var(--iso-grid-row-hdr0-w);
  z-index: 17;
  background: var(--iso-header-row1);
}

.iso-grid-corner {
  position: sticky;
  top: 0;
  left: 0;
  z-index: 30; /* above both axes */
  background: var(--iso-header-corner);
}
```

**Key insight**: For stacked sticky headers, each depth level offsets its `top` or `left` by the cumulative size of parent headers. This reads directly from Tier 2 primitives.

**Verification**: Scroll SuperGrid vertically — column headers stick. Scroll horizontally — row headers stick. Corner cell stays pinned at intersection. No JS scroll listeners.

---

## Task 4: Scroll Shadows

**Current**: Not implemented (or manual scroll listener).

**Target**: CSS-only scroll indicators.

```css
/* src/styles/chrome/scroll-shadows.css */

.iso-scroll-container {
  overflow: auto;
  /* Scroll shadows via background-attachment */
  background:
    /* Top shadow */
    linear-gradient(var(--iso-bg-base) 30%, transparent),
    linear-gradient(transparent, var(--iso-bg-base) 70%) 0 100%,
    /* Shadow covers */
    radial-gradient(farthest-side at 50% 0, rgba(0,0,0,0.25), transparent),
    radial-gradient(farthest-side at 50% 100%, rgba(0,0,0,0.25), transparent) 0 100%;
  background-color: var(--iso-bg-base);
  background-repeat: no-repeat;
  background-size: 100% 40px, 100% 40px, 100% 12px, 100% 12px;
  background-attachment: local, local, scroll, scroll;
}
```

**Zero JS.** Shadows appear/disappear based on scroll position via `background-attachment: local` vs `scroll`.

**Verification**: Content overflows container. Top shadow invisible when scrolled to top, appears when scrolled down. Bottom shadow disappears at bottom.

---

## Task 5: Tooltip Positioning

**Current**: React portal + state for position.

**Target**: CSS `::after` for simple text tooltips. React only needed for rich/interactive tooltips.

```css
/* src/styles/chrome/tooltip.css */

[data-tooltip] {
  position: relative;
}

[data-tooltip]::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  padding: var(--iso-space-xs) var(--iso-space-md);
  background: var(--iso-bg-sunken);
  color: var(--iso-fg-secondary);
  font-size: var(--iso-font-size-xs);
  font-family: var(--iso-font-mono);
  border-radius: var(--iso-radius-sm);
  border: 1px solid var(--iso-border-default);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--iso-transition-fast);
  z-index: 600;
}

[data-tooltip]:hover::after {
  opacity: 1;
}
```

**Usage**: `<button data-tooltip="Collapse sidebar">☰</button>`

**Verification**: Hover shows tooltip. No React state. No portal. No re-render.

---

## Task 6: Dialog/Modal

**Current**: React state + portal.

**Target**: Native `<dialog>` + CSS.

```css
/* src/styles/chrome/dialog.css */

.iso-dialog {
  border: 1px solid var(--iso-border-default);
  border-radius: var(--iso-radius-xl);
  background: var(--iso-bg-raised);
  color: var(--iso-fg-primary);
  padding: var(--iso-space-xxl);
  box-shadow: var(--iso-shadow-deep);
  max-width: 480px;
  width: 90vw;
}

.iso-dialog::backdrop {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

/* Animate in */
.iso-dialog[open] {
  animation: iso-dialog-in var(--iso-transition-slow);
}

@keyframes iso-dialog-in {
  from { opacity: 0; transform: scale(0.95) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
```

**JS**: `document.querySelector('.iso-dialog').showModal()` / `.close()`

**React's role**: Only calling `.showModal()` in event handlers. No useState for visibility. No portal.

**Verification**: Dialog opens with animation and backdrop blur. Closes on Escape. No React re-render on open/close.

---

## Task 7: Theme Switching

**Current**: React context provider + state.

**Target**: `data-theme` attribute on `<html>`, CSS cascades everything.

```css
/* Already handled by tokens.css + tokens-light.css */
/* Switch = one line: */
/* document.documentElement.dataset.theme = 'light'; */
```

**Persist**: `localStorage.setItem('iso-theme', 'light')` — read on page load before React hydrates.

**Verification**: Theme switches instantly. No React re-render cascade. Works on first paint (no flash of wrong theme).

---

## Task 8: Selection Highlighting (Headers + Cells)

**Current**: React state for `selectedHeaderId`, triggers re-render.

**Target**: CSS class toggle via D3 (which already manages the DOM elements).

```css
/* src/styles/chrome/selection.css */

.iso-header--selected {
  background: var(--iso-border-accent) !important;
  color: var(--iso-fg-white);
}

.iso-cell--in-selection {
  outline: 2px solid var(--iso-border-accent);
  outline-offset: -2px;
  background: rgba(77, 166, 255, 0.08);
}

.iso-cell--in-selection .iso-mini-card {
  border-left-color: var(--iso-border-accent);
}
```

**D3 handles it**: `d3.selectAll('.iso-header').classed('iso-header--selected', d => d.id === selectedId)`

**Why this stays in D3, not pure CSS**: Selection is data-driven (which header was clicked maps to which cells), so D3's data binding manages the class application. But CSS owns all the visual effects. React is not involved.

**Verification**: Click header → header highlights + cells in its scope highlight. No React re-render.

---

## File Structure

```
src/styles/
  tokens.css                      ← Already from @isometry/primitives
  tokens-light.css                ← Already from @isometry/primitives
  chrome/
    sidebar.css                   ← Task 1
    accordion.css                 ← Task 2
    sticky-headers.css            ← Task 3
    scroll-shadows.css            ← Task 4
    tooltip.css                   ← Task 5
    dialog.css                    ← Task 6
    selection.css                 ← Task 8
  chrome-index.css                ← @import aggregator
```

Theme switching (Task 7) is handled by the existing token files.

---

## Implementation Order

| Order | Task | Complexity | Depends On |
|-------|------|-----------|------------|
| 1 | Sticky headers | Low | Tier 2 primitives exist |
| 2 | Selection highlighting | Low | D3 renderers exist |
| 3 | Scroll shadows | Low | None |
| 4 | Tooltips | Low | None |
| 5 | Sidebar collapse | Medium | Layout structure finalized |
| 6 | Accordion panels | Medium | Inspector UI structure |
| 7 | Dialogs | Medium | None |
| 8 | Theme switching | Low | tokens-light.css exists |

**Estimated total**: 3–4 days of Claude Code execution.

---

## Verification Gate

After all 8 tasks:

1. Open React DevTools Profiler
2. Perform each visual toggle (collapse sidebar, open accordion, hover tooltip, open dialog, switch theme, click header)
3. **Zero React re-renders** for tasks 1–7
4. Task 8 (selection) shows D3 class updates only, no React component updates
5. All chrome animations run at 60fps
6. Chrome renders correctly before JS hydration (test by throttling JS in DevTools)

---

## What React Still Owns

This milestone does NOT touch:
- Drag-and-drop (react-dnd / dnd-kit) — drag intent, drop zones, reorder logic
- LATCH facet inspector state — which facets map to which planes
- Data mutations — card status changes, field edits
- Undo/redo stack
- Sync status indicators (driven by async CloudKit state)
- Complex keyboard navigation sequences

These are **application state** and rightfully belong in React.

---

## Anti-Patterns to Avoid

1. **Don't use CSS-only for state that needs to persist across navigation.** If the user collapses a sidebar, navigates away, and comes back — that persistence needs JS (localStorage read → set `data-collapsed` on mount).

2. **Don't mix CSS toggle patterns.** Pick one: `data-*` attributes for boolean toggles, CSS classes for multi-state. Be consistent.

3. **Comment the pattern.** CSS-only toggles are non-obvious to the next developer. Add a brief comment: `/* CSS-only collapse — no React state. Toggle via data-collapsed attribute. */`

4. **Don't fight the browser.** If `<details>` doesn't animate the way you want, add a lightweight CSS animation rather than replacing it with React state.
