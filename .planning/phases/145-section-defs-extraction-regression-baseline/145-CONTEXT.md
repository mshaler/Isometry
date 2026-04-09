# Phase 145: SECTION_DEFS Extraction + Regression Baseline - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract shared section/item key constants and view order from SidebarNav.ts and main.ts into a dedicated `src/ui/section-defs.ts` module, define the dock verb-noun taxonomy alongside the existing sidebar taxonomy, and establish a two-level regression test suite for all Cmd+1-9 keyboard shortcuts — before any navigation swap begins in Phase 146.

No user-facing behavioral changes. This is a preparatory extraction + test coverage phase.

</domain>

<decisions>
## Implementation Decisions

### Export Scope
- **D-01:** `section-defs.ts` exports SECTION_DEFS array, SidebarSectionDef/SidebarItemDef interfaces, AND viewOrder array. Both constants move out of their current locations (SidebarNav.ts and main.ts respectively).
- **D-02:** SidebarNav.ts imports SECTION_DEFS from section-defs.ts — no key string literals remain in SidebarNav (per success criteria SC-4).
- **D-03:** main.ts imports viewOrder from section-defs.ts — the Cmd+1-9 binding loop and CommandRegistry registration loop use the imported constant.

### Dock Taxonomy
- **D-04:** section-defs.ts also defines and exports a parallel `DOCK_DEFS` array with the Phase 146 verb-noun taxonomy (Integrate, Visualize, Analyze, Activate, Help). This front-loads the dock data model so Phase 146 can consume it directly.
- **D-05:** Both SECTION_DEFS (sidebar grouping) and DOCK_DEFS (dock grouping) coexist in the same module, referencing the same item key namespace. Phase 146 swaps which definition drives rendering.

### Regression Test Strategy
- **D-06:** Two-level test coverage for Cmd+1-9 shortcuts:
  - **Unit level:** ShortcutRegistry dispatch tests — register Cmd+1-9 with mock handlers, dispatch key events, verify correct handler fires for each binding. Matches existing test patterns in tests/shortcuts/ShortcutRegistry.test.ts (no jsdom needed).
  - **Integration level:** Mock sidebarNav + viewManager, wire the real binding loop from main.ts, dispatch keys, verify `setActiveItem('visualization', viewType)` and `switchTo(viewType, factory)` are called with correct arguments for each Cmd+N.
- **D-07:** All 9 bindings (Cmd+1 through Cmd+9) must have individual test cases at both levels — no loop-based "it works for one so it works for all" shortcuts.

### Claude's Discretion
- File organization within section-defs.ts (type exports first vs constants first)
- Whether DOCK_DEFS items reference SidebarItemDef or introduce a DockItemDef type
- Test file naming and placement within tests/ directory structure
- How to structure the integration test's mock of the main.ts binding loop (extract a testable function vs inline mock)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Navigation Source Code
- `src/ui/SidebarNav.ts` — Current SECTION_DEFS array (lines 47-122), SidebarSectionDef/SidebarItemDef interfaces (lines 23-35), composite key pattern ("sectionKey:itemKey")
- `src/main.ts` lines 298-403 — viewOrder array (lines 301-311), Cmd+1-9 shortcut registration loop (lines 386-403), CommandRegistry view registration (lines 425-430+)

### Shortcut System
- `src/shortcuts/ShortcutRegistry.ts` — Centralized keyboard shortcut registry with input field guard, platform-aware Cmd mapping
- `tests/shortcuts/ShortcutRegistry.test.ts` — Existing unit test patterns (document stub, KeyboardEvent factory, mock dispatch)

### Phase 146 Requirements (dock taxonomy target)
- `.planning/ROADMAP.md` Phase 146 — DockNav Shell + SidebarNav Swap (DOCK-01..04, A11Y-03)
- `.planning/REQUIREMENTS.md` — DOCK-06 (keyboard shortcuts must work without regression)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ShortcutRegistry` class: well-tested, single document keydown listener, platform-aware Cmd mapping — test patterns directly reusable for unit-level regression tests
- `SidebarNavConfig.onActivateItem(sectionKey, itemKey)` callback — integration tests should verify this fires correctly
- `tests/shortcuts/ShortcutRegistry.test.ts` document stub + KeyboardEvent factory — copy/extend for new test file

### Established Patterns
- Document stub with `createDocumentStub()` and `makeKeyEvent()` for keyboard tests without jsdom
- Forward-declared variable capture in main.ts closures (viewManager, sidebarNav assigned after creation)
- `viewOrder.forEach((viewType, index) => ...)` loop pattern for both shortcuts and commands

### Integration Points
- SidebarNav constructor takes `SidebarNavConfig` — importing types from section-defs.ts
- main.ts imports viewOrder for shortcut + command registration loops
- Phase 146 DockNav will import DOCK_DEFS from section-defs.ts

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 145-section-defs-extraction-regression-baseline*
*Context gathered: 2026-04-09*
