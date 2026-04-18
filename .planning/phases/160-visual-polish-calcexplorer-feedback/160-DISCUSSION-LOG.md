# Phase 160: Visual Polish + CalcExplorer Feedback - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 160-Visual Polish + CalcExplorer Feedback
**Areas discussed:** Visual boundaries, Typography hierarchy, Active aggregation indicator, Column type indicators

---

## Visual Boundaries

| Option | Description | Selected |
|--------|-------------|----------|
| Borders only (Recommended) | Keep existing 1px --border-subtle between zones. Add consistent spacing (padding) inside each zone. Clean and minimal. | ✓ |
| Background shifts | Alternate --bg-primary and --bg-surface between zones for depth separation. Borders optional. | |
| Borders + spacing bump | Keep borders, add a small gap (--space-2) between zones for breathing room. | |

**User's choice:** Borders only (Recommended)
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Current is fine | DockNav already has its own background and border — no changes needed. | ✓ |
| Subtle background | Give DockNav a slightly different background (--bg-surface). | |
| You decide | Claude uses judgment. | |

**User's choice:** Current is fine
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Standardize at slot level | Add consistent padding to .workbench-slot-top and .workbench-slot-bottom. | ✓ |
| Keep per-explorer | Let each explorer handle its own padding. | |
| You decide | Claude picks based on approach. | |

**User's choice:** Standardize at slot level
**Notes:** None

---

## Typography Hierarchy

| Option | Description | Selected |
|--------|-------------|----------|
| --text-base for headers (Recommended) | Explorer panel headers at 13px, labels at 11px, meta at 10px. Compact and data-dense. | ✓ |
| --text-lg for headers | Headers at 16px, labels at 13px, meta at 11px. More prominent headers. | |
| You decide | Claude picks best hierarchy. | |

**User's choice:** --text-base for headers (Recommended)
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Semi-bold headers (600) | Headers at font-weight 600, labels at 400. Clear visual anchor. | ✓ |
| Size only | All weights stay at 400. Hierarchy from font-size only. | |
| You decide | Claude picks based on hierarchy. | |

**User's choice:** Semi-bold headers (600)
**Notes:** None

---

## Active Aggregation Indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Bold label + accent color | Active column labels get font-weight 600 and --text-primary. Subtle but clear. | ✓ |
| Glyph prefix (Sigma) | Prepend sigma/checkmark glyph before active aggregate mode label. | |
| Background highlight | Active rows get subtle background tint. | |
| You decide | Claude picks best approach. | |

**User's choice:** Bold label + accent color
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Label only (Recommended) | Just the column name label changes weight/color. Select stays neutral. | ✓ |
| Both label and select | Select border also shifts to --accent when active. | |
| You decide | Claude picks based on noise level. | |

**User's choice:** Label only (Recommended)
**Notes:** None

---

## Column Type Indicators

| Option | Description | Selected |
|--------|-------------|----------|
| Glyph prefix (# / Aa) | Prepend # before numeric, Aa before text column names. Universal, accessible. | ✓ |
| Muted suffix tag | Append (num) or (text) after column name. | |
| Color-only | Numeric in one color, text in another. Relies on color perception. | |
| You decide | Claude picks best approach. | |

**User's choice:** Glyph prefix (# / Aa)
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Muted color (--text-muted) | Glyph in --text-muted, visible but secondary. Doesn't compete with active state. | ✓ |
| Same as label | Glyph matches label color, inherits active/inactive state. | |
| You decide | Claude picks based on balance. | |

**User's choice:** Muted color (--text-muted)
**Notes:** None

---

## Claude's Discretion

- Exact padding token for slot-level standardization
- Whether type glyph is separate `<span>` or inline text
- Order of CSS changes across 8 explorer files
- Whether `.calc-row` hardcoded padding migrates to tokens in this phase

## Deferred Ideas

None — discussion stayed within phase scope.
