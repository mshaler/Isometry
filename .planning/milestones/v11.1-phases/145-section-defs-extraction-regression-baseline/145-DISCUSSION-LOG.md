# Phase 145: SECTION_DEFS Extraction + Regression Baseline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 145-section-defs-extraction-regression-baseline
**Areas discussed:** Export scope, Regression test strategy, Dock taxonomy mapping

---

## Export Scope

| Option | Description | Selected |
|--------|-------------|----------|
| SECTION_DEFS + types only | Extract the array and its interfaces. viewOrder stays in main.ts. Minimal change, clean extraction. Phase 146 extends section-defs.ts with dock taxonomy when it arrives. | |
| SECTION_DEFS + types + viewOrder | Also move viewOrder into section-defs.ts since it's semantically tied to the visualization section items. Centralizes all nav-related constants. | ✓ |
| Full key constants module | Export SECTION_DEFS, types, viewOrder, AND named composite key constants. Eliminates all string literals upfront. | |

**User's choice:** SECTION_DEFS + types + viewOrder
**Notes:** Both SECTION_DEFS and viewOrder move into section-defs.ts. SidebarNav and main.ts import from there.

---

## Regression Test Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Unit: ShortcutRegistry dispatch | Register Cmd+1-9 with mock handlers, dispatch key events, verify correct handler fires. Matches existing test patterns — no jsdom needed. | |
| Integration: verify side effects | Mock sidebarNav + viewManager, register real handlers from binding loop, dispatch keys, verify setActiveItem and switchTo called with correct args. | |
| Both levels | Unit tests for registry dispatch correctness + integration tests for main.ts binding loop side effects. Maximum regression safety before Phase 146 swap. | ✓ |

**User's choice:** Both levels
**Notes:** All 9 bindings must have individual test cases at both levels.

---

## Dock Taxonomy Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar-only now | section-defs.ts exports current SECTION_DEFS as-is. Phase 146 adds DOCK_DEFS alongside it when dock is built. | |
| Define both taxonomies now | Add a parallel DOCK_DEFS array with verb-noun taxonomy (Integrate/Visualize/Analyze/Activate/Help) and mapping from old section keys to new dock groups. | ✓ |
| Abstract shared item pool | Extract items into a flat shared pool, then let SECTION_DEFS and DOCK_DEFS be different groupings over the same pool. | |

**User's choice:** Define both taxonomies now
**Notes:** Front-loads Phase 146 data modeling. Both taxonomies coexist in section-defs.ts.

---

## Claude's Discretion

- File organization within section-defs.ts
- Whether DOCK_DEFS uses SidebarItemDef or introduces a DockItemDef type
- Test file naming and placement
- How to structure integration test mock of main.ts binding loop

## Deferred Ideas

None — discussion stayed within phase scope.
