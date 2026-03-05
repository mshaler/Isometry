# Phase 15: PAFVProvider Stacked Axes - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend PAFVProvider with `colAxes`/`rowAxes` array state and `getStackedGroupBySQL()` method for SuperGrid multi-axis configuration. All 8 non-SuperGrid views continue using `compile()` completely unaffected. No UI changes — this is pure provider plumbing.

</domain>

<decisions>
## Implementation Decisions

### State shape coexistence
- Add `colAxes: AxisMapping[]` and `rowAxes: AxisMapping[]` as NEW fields on PAFVState alongside existing `xAxis`/`yAxis`/`groupBy`
- SuperGrid reads colAxes/rowAxes; other views read xAxis/yAxis/groupBy — no interference
- All VIEW_DEFAULTS entries get `colAxes: []` and `rowAxes: []` — uniform state shape, no null checks
- colAxes/rowAxes participate in view family suspension (LATCH <-> GRAPH) — suspended and restored with the rest of the state
- xAxis/yAxis/groupBy are left as-is when switching to supergrid — SuperGrid simply ignores them
- No convenience getter like getActiveAxes() — keep PAFVProvider lean, each consumer knows what it needs

### Setter API
- Array setters: `setColAxes(axes: AxisMapping[])` and `setRowAxes(axes: AxisMapping[])` — caller provides full array, atomic update
- SuperDynamic (Phase 18) can build reorder helpers on top of the array setter

### Default supergrid axes
- VIEW_DEFAULTS.supergrid pre-populates: `colAxes: [{ field: 'card_type', direction: 'asc' }]`, `rowAxes: [{ field: 'folder', direction: 'asc' }]`
- Matches current hardcoded DEFAULT_COL_FIELD/DEFAULT_ROW_FIELD in SuperGrid.ts
- Provides seamless transition when Phase 17 removes those hardcoded constants

### Backward compatibility (legacy JSON)
- If persisted JSON lacks colAxes/rowAxes fields, setState() defaults them to `[]` — no throw, no reset
- isPAFVState type guard accepts legacy shape and fills in defaults

### Axis limits & validation
- Maximum 3 axes per dimension (colAxes and rowAxes each capped at 3)
- Matches SuperGridQuery's existing support for up to 3 axes per dimension
- Throw immediately on overflow: "Maximum 3 axes per dimension"
- Throw immediately on invalid field via validateAxisField() — consistent with existing setXAxis() pattern
- Reject duplicate fields within same dimension — throw "Duplicate axis field"
- Allow cross-dimension duplicates (same field in both colAxes and rowAxes) — supports correlation matrix pivots

### getStackedGroupBySQL() contract
- Returns `{ colAxes: AxisMapping[], rowAxes: AxisMapping[] }` — the axes portion of SuperGridQueryConfig
- Caller (Phase 16 Worker) combines with FilterProvider's WHERE clause and passes to buildSuperGridQuery()
- Works for any viewType (no supergrid gate) — returns arrays regardless, may be empty for non-supergrid views
- Validates all axis fields via validateAxisField() at call time — catches corrupt JSON-restored state early, consistent with compile()
- Returns defensive copies (`[...this._state.colAxes]`) — matches getState()'s shallow-copy pattern

### Claude's Discretion
- Exact error message wording for overflow and duplicate violations
- Whether to deep-copy or shallow-copy AxisMapping objects within the defensive copy
- Internal helper method organization

</decisions>

<specifics>
## Specific Ideas

- State shape should mirror the interface SuperGridQueryConfig already defines in SuperGridQuery.ts — `{ colAxes: AxisMapping[], rowAxes: AxisMapping[] }`
- The setter pattern should feel identical to existing setXAxis/setYAxis — validate, assign, scheduleNotify

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `validateAxisField()` in `src/providers/allowlist.ts`: Runtime SQL safety validation — reuse for colAxes/rowAxes field validation
- `AxisMapping` interface in `src/providers/types.ts`: `{ field: AxisField, direction: SortDirection }` — colAxes/rowAxes use this exact type
- `SuperGridQueryConfig` in `src/views/supergrid/SuperGridQuery.ts`: Already defines `colAxes: AxisMapping[]` and `rowAxes: AxisMapping[]` — getStackedGroupBySQL() return shape matches this
- `buildSuperGridQuery()` in `src/views/supergrid/SuperGridQuery.ts`: Downstream consumer of getStackedGroupBySQL() output — already validates and builds GROUP BY SQL
- `isPAFVState()` type guard in `src/providers/PAFVProvider.ts`: Needs extension to optionally accept colAxes/rowAxes arrays

### Established Patterns
- Setter → validateAxisField() → assign → _scheduleNotify(): All axis setters follow this pattern
- structuredClone for suspension: Deep copy on family boundary crossing
- toJSON() serializes active state only; setState() clears suspended states
- queueMicrotask batching: Multiple synchronous mutations produce one subscriber notification
- Defensive copies in getState(): Returns `{ ...this._state }` — getStackedGroupBySQL() should follow same pattern

### Integration Points
- PAFVState interface (line 30-35): Needs colAxes/rowAxes fields added
- VIEW_DEFAULTS constant (line 45-61): Needs colAxes/rowAxes on all entries, with supergrid having non-empty defaults
- isPAFVState type guard (line 304-316): Needs extension for optional colAxes/rowAxes arrays
- PAFVProvider.test.ts: Needs new test groups for stacked axes, regression tests for existing 8 views

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-pafvprovider-stacked-axes*
*Context gathered: 2026-03-03*
