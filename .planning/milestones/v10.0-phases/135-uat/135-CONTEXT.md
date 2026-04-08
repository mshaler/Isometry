# Phase 135: UAT - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Manual acceptance testing of all v10.0 smart defaults, layout presets, and guided tour flows against real data. Import each of the 20 dataset types, verify default view/axis configuration and recommended views, cycle all 4 built-in presets for round-trip fidelity, then fix any regressions found. Two requirements: UATX-01 (default view × dataset type), UATX-02 (preset switching).

</domain>

<decisions>
## Implementation Decisions

### Test Matrix Scope
- **D-01:** All 20 dataset types tested with real user data (alto-index, Apple Notes, Reminders, Calendar, Contacts, CSV, Excel, JSON, Markdown, HTML, plus Alto Index variants and other SQLite databases). No synthetic fixtures needed — user has sample files for every type.
- **D-02:** Coverage level: default auto-switched view + all ✦-recommended views per dataset type. Not the full 180-combo (20 × 9) matrix unless the initial pass surfaces issues that suggest broader coverage is needed.
- **D-03:** Alto-index is the preferred proxy/test dataset — disposable and reloadable.

### Pass/Fail Criteria
- **D-04:** Functional bar: a dataset type passes if it renders with real data in rows/columns/cells, no empty grids, no schema-mismatch errors, and the correct view auto-switch fires. Suboptimal-but-functional axis defaults are acceptable (not a UAT fail).
- **D-05:** "Incorrect view auto-switch" means the auto-switched view doesn't match what ViewDefaultsRegistry specifies for that source type, OR the auto-switch fails silently.

### Fix Iteration Workflow
- **D-06:** Inline fix mode by default — find issue, fix immediately, move to next dataset type. If findings accumulate to 10+, switch to batch mode: log all remaining findings first, then fix as a batch. Claude adapts the workflow as findings accumulate.
- **D-07:** Claude may recommend switching to batch mode earlier if patterns emerge (e.g., same root cause across multiple dataset types).

### Preset Round-Trip Verification
- **D-08:** Claude's discretion on verification method — visual inspection, ui_state key snapshot diff, or both. Claude picks the approach that gives confidence without over-engineering a one-time test.
- **D-09:** Test from both starting states: (a) fresh app default with no customization, and (b) a manually customized panel layout. Claude determines the specific customization to apply before cycling.

### Exit Criteria
- **D-10:** Zero functional defects. UAT passes when a full clean pass completes with no empty grids, no errors, no wrong auto-switches, and presets round-trip cleanly.
- **D-11:** Cosmetic nits (e.g., "this column would look better wider") are logged but do not block the milestone.
- **D-12:** No iteration cap. Keep passing until clean. The functional bar (D-04) makes zero defects a finite, achievable target.

### Claude's Discretion
- Exact ordering of dataset types in the test pass (alto-index first as warm-up is suggested)
- Whether to snapshot ui_state keys programmatically or rely on visual inspection for preset round-trip
- When to switch from inline to batch fix mode (10-finding threshold is guidance, not rigid)
- Specific panel customization for the "customized starting state" preset test
- Whether to expand to full 180-combo matrix based on initial pass findings

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Defaults & Registry
- `src/providers/ViewDefaultsRegistry.ts` — All 20 source-type mappings, resolveDefaults(), resolveRecommendation()
- `src/providers/PAFVProvider.ts` — applySourceDefaults(), axis validation through SchemaProvider.isValidColumn()

### Presets
- `src/presets/builtInPresets.ts` — 4 built-in preset definitions (Data Integration, Writing, LATCH Analytics, GRAPH Synthetics)
- `src/presets/LayoutPresetManager.ts` — Preset apply/save/delete lifecycle
- `src/presets/presetCommands.ts` — Command palette integration

### View Infrastructure
- `src/views/ViewManager.ts` — switchTo(), isSwitching guard, view lifecycle
- `src/ui/SidebarNav.ts` — ✦ recommendation badges, view switching UI

### Tour
- Phase 134 implementation files (driver.js integration, data-tour-target anchoring, TourEngine)

### Requirements
- `.planning/REQUIREMENTS.md` — UATX-01, UATX-02 definitions
- `.planning/phases/131-supergrid-defaults/131-CONTEXT.md` — SuperGrid defaults decisions
- `.planning/phases/132-other-view-defaults/132-CONTEXT.md` — Other view defaults decisions
- `.planning/phases/133-named-layout-presets/133-CONTEXT.md` — Preset decisions
- `.planning/phases/134-guided-tour/134-CONTEXT.md` — Tour decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ViewDefaultsRegistry` — Static Map with resolveDefaults() and resolveRecommendation() covering all 20 source types
- `LayoutPresetManager` — Full preset CRUD with undo support via CallbackMutation
- `builtInPresets.ts` — 4 preset definitions with panel visibility as Record<string, boolean>
- Existing E2E specs in `e2e/` directory (15 Playwright specs) — patterns for import flows, view switching

### Established Patterns
- Worker bridge `ui:get`/`ui:set` for reading/writing ui_state keys — usable for snapshot-based verification
- `SchemaProvider.isValidColumn()` validation gate on all axis assignments
- `SidebarNav` ✦ badge rendering driven by resolveRecommendation() return value

### Integration Points
- Import flow triggers auto-switch via ViewManager.switchTo() → PAFVProvider.applySourceDefaults()
- Preset apply via LayoutPresetManager.apply() → WorkbenchShell section restore → MutationManager undo registration
- Tour prompt via PresetSuggestionToast pattern after first import

</code_context>

<specifics>
## Specific Ideas

- Alto-index as first/warm-up dataset — disposable and reloadable, good for establishing the testing rhythm
- User has real data files for all 20 types — no fixture generation needed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 135-uat*
*Context gathered: 2026-03-27*
