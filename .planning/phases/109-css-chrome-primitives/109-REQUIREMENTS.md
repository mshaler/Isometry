# Phase 109: CSS Chrome Primitives — Requirements

**Milestone:** v6.8 CSS Primitives
**Phase:** 109
**Goal:** Offload visual/presentation state from React to CSS-only patterns

## Guiding Principle

```
Presentation state  →  CSS    (visible/hidden, expanded/collapsed, highlighted/normal)
Application state   →  React  (selected facets, data mutations, undo stack)
Data state          →  D3     (enter/update/exit, force simulations)
```

**Litmus test**: "If this state were lost on page reload, would the user lose work?" If no → CSS. If yes → React.

## Requirements

| REQ-ID | Task | Complexity | Priority | Depends On |
|--------|------|-----------|----------|------------|
| CHR-01 | Sticky Headers | Low | P0 | Tier 2 primitives |
| CHR-02 | Selection Highlighting | Low | P0 | D3 renderers |
| CHR-03 | Scroll Shadows | Low | P1 | None |
| CHR-04 | Tooltips | Low | P1 | None |
| CHR-05 | Sidebar Collapse | Medium | P1 | Layout structure |
| CHR-06 | Accordion Panels | Medium | P2 | Inspector UI |
| CHR-07 | Dialogs | Medium | P2 | None |
| CHR-08 | Theme Switching | Low | P1 | tokens-light.css |

## Detailed Requirements

### CHR-01: Sticky Headers

**Current**: Manual scroll listener + React state to toggle sticky class
**Target**: Pure CSS `position: sticky` with depth offsets

**Deliverables:**
- `src/styles/chrome/sticky-headers.css`

**Acceptance Criteria:**
- Column headers stick when scrolling vertically
- Row headers stick when scrolling horizontally
- Corner cell stays pinned at intersection
- No JS scroll listeners
- Multi-level headers offset correctly by parent height/width

### CHR-02: Selection Highlighting

**Current**: React state for `selectedHeaderId` triggers re-render
**Target**: CSS class toggle via D3 (which already manages DOM elements)

**Deliverables:**
- `src/styles/chrome/selection.css`

**Acceptance Criteria:**
- Header click → header highlights + cells in scope highlight
- Selection uses accent color with outline
- D3 manages class application, CSS owns visual effects
- No React re-render on selection change

### CHR-03: Scroll Shadows

**Current**: Not implemented
**Target**: CSS-only scroll indicators via `background-attachment`

**Deliverables:**
- `src/styles/chrome/scroll-shadows.css`

**Acceptance Criteria:**
- Top shadow invisible when at top, appears when scrolled
- Bottom shadow disappears at bottom
- Zero JavaScript involved

### CHR-04: Tooltips

**Current**: React portal + state for position
**Target**: CSS `::after` pseudo-element for simple text tooltips

**Deliverables:**
- `src/styles/chrome/tooltip.css`

**Acceptance Criteria:**
- Hover shows tooltip with `data-tooltip` attribute
- No React state, no portal, no re-render
- Smooth fade-in transition

### CHR-05: Sidebar Collapse

**Current**: React `useState<boolean>(sidebarOpen)` triggers re-render
**Target**: `data-collapsed` attribute + CSS transitions

**Deliverables:**
- `src/styles/chrome/sidebar.css`
- Add `--iso-sidebar-w` and `--iso-sidebar-collapsed-w` to tokens.css

**Acceptance Criteria:**
- Sidebar animates open/closed
- No React component re-renders (verify via DevTools Profiler)
- One-line JS toggle: `sidebar.dataset.collapsed = ...`

### CHR-06: Accordion Panels

**Current**: React state per-panel `useState<Record<string, boolean>>`
**Target**: Native `<details>` element + CSS

**Deliverables:**
- `src/styles/chrome/accordion.css`

**Acceptance Criteria:**
- Accordion opens/closes with animation
- No React state involved
- Works with SSR/pre-hydration

### CHR-07: Dialogs

**Current**: React state + portal
**Target**: Native `<dialog>` element + CSS

**Deliverables:**
- `src/styles/chrome/dialog.css`

**Acceptance Criteria:**
- Dialog opens with animation and backdrop blur
- Closes on Escape
- No React re-render on open/close
- React only calls `.showModal()` / `.close()`

### CHR-08: Theme Switching

**Current**: React context provider + state
**Target**: `data-theme` attribute on `<html>`, CSS cascades

**Deliverables:**
- Verify tokens-light.css works
- localStorage persistence pattern

**Acceptance Criteria:**
- Theme switches instantly
- No React re-render cascade
- Works on first paint (no flash of wrong theme)

## Implementation Order

| Plan | Tasks | Wave |
|------|-------|------|
| 109-01 | CHR-01 (Sticky Headers), CHR-02 (Selection) | 1 |
| 109-02 | CHR-03 (Scroll Shadows), CHR-04 (Tooltips), CHR-08 (Theme) | 1 |
| 109-03 | CHR-05 (Sidebar), CHR-06 (Accordion), CHR-07 (Dialog) | 2 |

## Verification Gate

After all tasks complete:

1. Open React DevTools Profiler
2. Perform each visual toggle (collapse sidebar, open accordion, hover tooltip, open dialog, switch theme, click header)
3. **Zero React re-renders** for tasks 1-7
4. Task 8 (selection) shows D3 class updates only, no React component updates
5. All chrome animations run at 60fps
6. Chrome renders correctly before JS hydration

## File Structure

```
src/styles/
  chrome/
    sidebar.css           ← CHR-05
    accordion.css         ← CHR-06
    sticky-headers.css    ← CHR-01
    scroll-shadows.css    ← CHR-03
    tooltip.css           ← CHR-04
    dialog.css            ← CHR-07
    selection.css         ← CHR-02
  chrome-index.css        ← @import aggregator
```

## What React Still Owns

This phase does NOT touch:
- Drag-and-drop (react-dnd / dnd-kit)
- LATCH facet inspector state
- Data mutations
- Undo/redo stack
- Sync status indicators
- Complex keyboard navigation sequences

These are **application state** and rightfully belong in React.
