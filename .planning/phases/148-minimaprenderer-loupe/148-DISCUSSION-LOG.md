# Phase 148: MinimapRenderer + Loupe - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 148-minimaprenderer-loupe
**Areas discussed:** Thumbnail rendering strategy, Loupe overlay behavior, PAFV axis label presentation, Trigger & lifecycle

---

## Thumbnail Rendering Strategy

### Q1: How should the 96x48 thumbnails be produced?

| Option | Description | Selected |
|--------|-------------|----------|
| DOM snapshot -> canvas | html2canvas or similar to screenshot actual rendered view | |
| Simplified D3 sketch | Purpose-built mini-renderer per view type drawing schematic approximation | ✓ |
| SVG serialize -> `<img>` | Serialize existing SVG views to data URL, fallback for DOM views | |
| OffscreenCanvas in Worker | Simplified representation entirely off-main-thread via Canvas 2D | |

**User's choice:** Simplified D3 sketch
**Notes:** Each view gets its own sketch function. Lightweight, no new dependencies.

### Q2: How faithful should the sketches be?

| Option | Description | Selected |
|--------|-------------|----------|
| Color-accurate schematic | Real data colors, simplified shapes | ✓ |
| Monochrome silhouette | Single-color simplified shapes | |
| You decide | Claude picks | |

**User's choice:** Color-accurate schematic
**Notes:** Uses actual category hues from the real view for visual connection between thumbnail and full view.

### Q3: Where does the sketch render into?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline `<canvas>` element | Canvas 2D API, easy clear/redraw | |
| Inline `<svg>` element | D3 SVG elements in thumbnail div, consistent with codebase | ✓ |
| You decide | Claude picks | |

**User's choice:** Inline SVG
**Notes:** Stays in the D3/SVG world the codebase already uses.

---

## Loupe Overlay Behavior

### Q1: Should the loupe be interactive?

| Option | Description | Selected |
|--------|-------------|----------|
| View-only indicator | Static rectangle, no interaction | |
| Click-to-pan | Click spot to center main view there | |
| Click + drag-to-pan | Full minimap: click to jump, drag to scrub viewport | ✓ |
| You decide | Claude picks | |

**User's choice:** Click + drag-to-pan
**Notes:** Full interactive minimap with pointer capture for drag.

### Q2: How should the loupe rectangle look?

| Option | Description | Selected |
|--------|-------------|----------|
| Semi-transparent fill + border | --accent at 20% opacity fill + 1px solid border | |
| Border only | Hairline --accent border, no fill | |
| Inverted dimming | Area outside loupe dimmed, viewport area clear | ✓ |
| You decide | Claude picks | |

**User's choice:** Inverted dimming
**Notes:** Common in image editors. Most visually clear at small thumbnail sizes.

---

## PAFV Axis Label Presentation

### Q1: What format should the axis label use?

| Option | Description | Selected |
|--------|-------------|----------|
| Compact formula | Abbreviated like `Loc x Time -> Size` | |
| Field names only | Actual field names like `city x created -> count` | |
| Icon + field name pairs | Tiny P/A/F/V glyphs + field name, stacked vertically | ✓ |
| You decide | Claude picks | |

**User's choice:** Icon + field name pairs
**Notes:** Most informative format. Stacked vertically.

### Q2: Where should the label block render?

| Option | Description | Selected |
|--------|-------------|----------|
| Below the thumbnail | Stacked underneath, adds vertical height | |
| Right of the thumbnail | Side-by-side in 160px, tight text | |
| Overlaid on thumbnail | Semi-transparent caption bar at bottom of minimap | ✓ |
| You decide | Claude picks | |

**User's choice:** Overlaid on thumbnail
**Notes:** No extra space consumed. Caption-bar style like video subtitles.

---

## Trigger & Lifecycle

### Q1: When should a thumbnail first render?

| Option | Description | Selected |
|--------|-------------|----------|
| On dock expansion to Icon+Thumbnail | All visible items rendered, staggered via requestIdleCallback | ✓ |
| On hover per item | Each item renders only on hover | |
| Hybrid | Active item on expansion, rest via requestIdleCallback | |
| You decide | Claude picks | |

**User's choice:** On dock expansion
**Notes:** All visible dock items get thumbnails rendered at once, staggered.

### Q2: How stale can thumbnails be?

| Option | Description | Selected |
|--------|-------------|----------|
| On view switch only | No re-render on filter/PAFV changes | |
| On any state change | Always current, debounced re-renders | |
| On expansion + state change | Fresh while visible, stale while collapsed | ✓ |
| You decide | Claude picks | |

**User's choice:** On expansion + state change
**Notes:** Re-render on state changes only while dock is in Icon+Thumbnail state. Stale while collapsed — no wasted renders.

---

## Claude's Discretion

- Mini-renderer function signatures and module organization
- requestIdleCallback stagger strategy
- Debounce interval for state-change re-renders
- Pointer capture implementation for drag-to-pan
- Dimming overlay SVG structure
- Caption bar opacity and text styling
- How to obtain viewport position from each view type

## Deferred Ideas

None — discussion stayed within phase scope.
