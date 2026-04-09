# Phase 146: DockNav Shell + SidebarNav Swap - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 146-docknav-shell-sidebarnav-swap
**Areas discussed:** Dock layout & sizing, Section header treatment, Active item indicator style, SidebarNav removal strategy

---

## Dock Layout & Sizing

| Option | Description | Selected |
|--------|-------------|----------|
| Narrow vertical strip (~80px) | Icon stacked above label, macOS Dock feel | |
| Medium sidebar (~160px) | Icon left, label right inline | |
| Same 200px slot | Drop-in replacement, no grid changes | |

**User's choice:** User clarified the 3-state collapse model (Collapsed / Icon-only ~48px / Icon+Thumbnail ~144px) from Phase 147 spec. For Phase 146, ship icon-only at 48px. Phase 147 adds toggle cycling.
**Notes:** The width options are defined by the Phase 147 collapse spec, not arbitrary. Phase 146 implements only the 48px icon-only state.

---

## Section Header Treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Small text dividers | Section name as tiny muted label between groups (Finder sidebar style) | ✓ |
| Visual separators only | Thin line or spacing, no text labels | |
| No grouping visible | Flat icon list, taxonomy in data only | |

**User's choice:** Small text dividers, like Finder sidebar
**Notes:** Success criteria SC-4 requires visible section headers. Finder style balances visibility with narrow width.

---

## Active Item Indicator Style

| Option | Description | Selected |
|--------|-------------|----------|
| Background fill | Subtle rounded rect behind active icon | |
| Left-edge accent bar | 3px colored bar (VS Code activity bar style) | |
| Icon color change | Active uses --accent, inactive stays --text-secondary | ✓ |
| Combination | e.g., accent bar + icon color shift | |

**User's choice:** Icon color change
**Notes:** Simplest approach, no additional layout elements needed.

---

## SidebarNav Removal Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Delete entirely | Clean break, remove SidebarNav.ts and sidebar-nav.css | ✓ |
| Keep dormant | Comment out or feature-flag, delete later | |
| Swap at mount point | Mount DockNav instead, keep file in repo | |

**User's choice:** Delete SidebarNav entirely
**Notes:** Clean break. No need to preserve old code for Phase 149 decoupling.

---

## Claude's Discretion

- DockNav class structure and CSS file naming
- Whether to reuse SidebarNavConfig or define DockNavConfig
- Cmd+1-9 binding wiring approach (must pass Phase 145 regression tests)

## Deferred Ideas

None — discussion stayed within phase scope.
