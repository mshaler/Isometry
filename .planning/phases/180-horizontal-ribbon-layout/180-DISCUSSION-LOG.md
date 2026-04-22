# Phase 180: Horizontal Ribbon Layout - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 180-horizontal-ribbon-layout
**Areas discussed:** Section dividers & labels, Collapse/thumbnail fate, Ribbon density & overflow

---

## Section Dividers & Labels

### Q1: How should verb-noun sections be visually separated?

| Option | Description | Selected |
|--------|-------------|----------|
| Section label + gap | Each group has a small uppercase label above/left, with wider gap between groups | ✓ |
| Vertical pipe dividers only | Thin 1px vertical lines between groups, no text labels | |
| Labels inline with items | Section name as non-interactive text inline in the row | |

**User's choice:** Section label + gap (Recommended)
**Notes:** Similar to current vertical headers but rotated to horizontal flow.

### Q2: Where should the section label sit relative to items?

| Option | Description | Selected |
|--------|-------------|----------|
| Above the items | Small uppercase label centered above each group, Office-ribbon style | ✓ |
| Left of items, inline | Label at left edge of each group, vertically centered with buttons | |

**User's choice:** Above the items (Recommended)
**Notes:** Two visual rows: labels on top, icons+text below.

---

## Collapse/Thumbnail Fate

### Q3: What happens to the icon-only ↔ icon-thumbnail toggle and thumbnails?

| Option | Description | Selected |
|--------|-------------|----------|
| Drop both | Remove collapse toggle and thumbnail rendering entirely. Ribbon always shows icon+label. | ✓ |
| Keep thumbnails as tooltip previews | Drop toggle but show minimap thumbnails as hover tooltips on Visualize items | |
| You decide | Claude picks best approach | |

**User's choice:** Drop both (Recommended)
**Notes:** Clean cut — removes CollapseState, _thumbnailDataSource, MinimapRenderer integration, loupe interaction from DockNav.

---

## Ribbon Density & Overflow

### Q4: How should the ribbon handle overflow?

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal scroll | Scrolls horizontally with subtle indicators (fade edges or chevrons). Never wraps. | ✓ |
| Wrap to second row | Items flow to additional rows. Ribbon height grows. | |
| Truncate labels | Labels shortened with ellipsis to always fit single row | |

**User's choice:** Horizontal scroll (Recommended)
**Notes:** Single row, consistent height, canvas never shrinks due to wrapping.

---

## Claude's Discretion

- Scroll indicator implementation (CSS fade masks vs JS chevrons)
- Exact ribbon height
- SuperWidget grid area naming for ribbon row
- Whether dock-nav.css is refactored in-place or replaced

## Deferred Ideas

None — discussion stayed within phase scope
