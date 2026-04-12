# Phase 147: 3-State Collapse + Accessibility - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 147-3-state-collapse-accessibility
**Areas discussed:** Collapse cycling UX, Animation approach, Icon+Thumbnail state layout, Keyboard navigation model

---

## Collapse Cycling UX

### Toggle button placement

| Option | Description | Selected |
|--------|-------------|----------|
| Top of dock | First element, always visible even in icon-only mode | ✓ |
| Bottom of dock | Pinned to bottom, out of the way of nav items | |
| Outside the dock | Small tab/chevron on dock's right edge, always visible | |

**User's choice:** Top of dock, standard sidebar icon (provided reference image of rectangle-with-sidebar glyph)
**Notes:** None

### Cycling behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Linear 3-state cycle | Click rotates Hidden → Icon-only → Icon+Thumbnail → Hidden | ✓ |
| Toggle + mode | Click toggles Hidden ↔ expanded; separate control for Icon-only vs Icon+Thumbnail | |

**User's choice:** Linear 3-state cycle
**Notes:** None

### Hidden state recovery

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle button stays visible | Button persists at top-left even when dock content is hidden | ✓ |
| Keyboard shortcut only | Hotkey reveals the dock, no visible affordance | |
| Edge hover | Hovering left edge reveals toggle or dock temporarily | |

**User's choice:** Toggle button stays visible
**Notes:** None

### Toggle button icon behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Static icon | Always the sidebar glyph regardless of state | ✓ |
| Rotates per state | Icon hints at next state | |

**User's choice:** Static icon
**Notes:** None

---

## Animation Approach

### What animates for Hidden↔visible

| Option | Description | Selected |
|--------|-------------|----------|
| grid-template-rows 0fr→1fr | Smooth reveal/collapse of dock content | ✓ |

**User's choice:** grid-template-rows specifically for Hidden→visible transition (per success criteria)
**Notes:** Confirmed this is for the Hidden↔visible transition, not individual sections

### Width change behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Animated width | transition: width 200ms ease, smooth expansion | |
| Instant width | Width snaps via class swap, no transition | ✓ |

**User's choice:** Instant width
**Notes:** Avoids layout reflow jank during animation

---

## Icon+Thumbnail State Layout

### Content in wider state

| Option | Description | Selected |
|--------|-------------|----------|
| Icon + full label | Wider dock with text labels, thumbnail area reserved but empty | |
| Icon + label + placeholder box | Same plus visible 96×48 placeholder rectangle | ✓ |
| Icon + label only, no placeholder | Just wider layout with text, Phase 148 adds thumbnail element | |

**User's choice:** Icon + label + placeholder box
**Notes:** Makes the thumbnail slot visible and intentional before Phase 148 fills it

### Width

| Option | Description | Selected |
|--------|-------------|----------|
| 160px | Compact. Icon + label stacked, placeholder below | ✓ |
| 200px | Matches old SidebarNav width | |
| You decide | Claude picks based on fit | |

**User's choice:** 160px
**Notes:** None

---

## Keyboard Navigation Model

### Focus behavior in Hidden state

| Option | Description | Selected |
|--------|-------------|----------|
| Tab lands on toggle button only | Toggle focusable, arrow keys do nothing, items not in tab order | ✓ |
| Tab skips dock entirely | Dock removed from tab order, only toggle remains | |

**User's choice:** Tab lands on toggle button only
**Notes:** Essentially confirmed: when Hidden, only toggle button is focusable

### Arrow key behavior in expanded states

| Option | Description | Selected |
|--------|-------------|----------|
| Arrow keys skip section headers | Up/Down moves between actionable items only | ✓ |
| Arrow keys include section headers | Headers are inert but announced by VoiceOver | |

**User's choice:** Arrow keys skip section headers
**Notes:** None

### VoiceOver state announcements

| Option | Description | Selected |
|--------|-------------|----------|
| State name only | "Icon only" / "Icon and thumbnail" / "Hidden" | ✓ |
| State name + hint | "Icon only — click to expand" etc. | |
| You decide | Claude picks phrasing | |

**User's choice:** State name only
**Notes:** None

---

## Claude's Discretion

- CSS class naming for the 3 states
- Toggle button DOM placement (child of .dock-nav or sibling)
- Animation duration and easing
- 160px layout structure (flexbox vs grid)
- tabindex management during state changes

## Deferred Ideas

None — discussion stayed within phase scope.
