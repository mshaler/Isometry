# Phase 30: Collapse System - Research

**Researched:** 2026-03-05
**Domain:** SuperGrid collapse state management, aggregate summary rendering, Tier 2 persistence
**Confidence:** HIGH

## Summary

Phase 30 is primarily a wiring and extension phase. The core collapse infrastructure already exists: `_collapsedSet` is a live `Set<string>` on the SuperGrid class, `buildHeaderCells()` in SuperStackHeader.ts already processes collapsed keys to determine slot visibility and mark `isCollapsed` on HeaderCell objects, and the click handler at line 3064 of SuperGrid.ts already toggles collapse and re-renders from cached `_lastCells`. What Phase 30 must add is: (1) a collapse mode map (aggregate vs. hide) alongside `_collapsedSet`, (2) aggregate summary row/column insertion when a group is collapsed in aggregate mode, (3) inline count badge on collapsed header labels matching the existing "January (47)" pattern, (4) a mode-switching affordance (context menu integration or collapse indicator), and (5) Tier 2 persistence of both collapse state and mode state via PAFVProvider or a dedicated wrapper.

The two architecturally distinct behaviors — aggregate mode (shows summary row/column with heat-map count) vs. hide mode (group disappears, slot collapses to zero) — affect `buildHeaderCells()` differently. Hide mode is already what `buildHeaderCells()` implements: collapsed groups reduce leafCount by their child count and contribute exactly one slot. Aggregate mode requires a different slot contribution: the collapsed parent still shows as a single slot (correct) but an aggregate summary row/column must be injected into the rendered grid body. This summary cell computes a cross-axis count by summing `_lastCells` data and renders with `d3.interpolateBlues` heat-map coloring identical to normal cells.

**Primary recommendation:** Keep `buildHeaderCells()` unchanged for slot computation (it already handles hide mode correctly). Implement aggregate mode as a post-processing step in `_renderCells()` that injects summary data cells for collapsed-in-aggregate headers. Store collapse state as `{ collapsedSet: Set<string>, modeMap: Map<string, 'aggregate' | 'hide'> }` on the SuperGrid instance and add to PAFVProvider's serialized state.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Aggregate Mode Display**
- Collapsed header in aggregate mode shows inline count badge on the header label: "Engineering (5)" — matches existing time-axis header pattern (`January (47)`)
- Additionally, a single summary row (for collapsed row groups) or summary column (for collapsed column groups) remains visible in the grid body
- Summary cells show aggregated card count per cross-axis position (e.g., if 3 rows collapse and a column had 2, 0, 1 cards → summary cell shows "3")
- Summary cells also apply the existing `d3.interpolateBlues` heat map coloring — visual density information survives the collapse

**Mode Switching UX**
- Per-header only — no global "Collapse All" / "Expand All" action in Phase 30 scope
- Each header independently tracks its own mode (aggregate vs hide) — "Engineering" can be in aggregate while "Marketing" is in hide

**Collapse Visual Treatment**
- Full row/column symmetry: same click behavior, visual indicators, and aggregate/hide modes on both row and column headers

### Claude's Discretion
- Mode switching mechanism (context menu, toggle icon, click cycle, or hybrid)
- Default collapse mode on first click (aggregate-first vs hide-first)
- Visual indicator type (chevron, plus/minus, or none)
- Animation vs instant snap on collapse/expand
- Collapsed header background treatment (subtle tint vs same as expanded)
- Summary cell click behavior (expand group, select cards, or no special action)
- Persistence storage location (inside PAFVProvider state vs separate CollapseProvider)
- Whether collapse state survives view type transitions (grid→calendar→grid)
- Axis change invalidation strategy (invalidate affected keys vs clear all)
- Whether collapse state persists across full app reloads (Tier 2 round-trip) or is session-only

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

The CLPS requirements are not defined in REQUIREMENTS.md (which covers v4.0 Native ETL). Based on the ROADMAP.md success criteria, requirements map as follows:

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLPS-01 | Clicking a collapse toggle on any header at any stacking level collapses that group independently without affecting siblings | `_collapsedSet` already provides per-key isolation; collapse key format `${level}\x1f${parentPath}\x1f${value}` ensures sibling independence |
| CLPS-02 | Collapsed headers in aggregate mode display count/sum of hidden children in place of expanded rows/columns | Requires: inline badge on header label (extend `_createColHeaderCell`/`_createRowHeaderCell`); summary data cell in grid body (inject into `cellPlacements` after `buildHeaderCells()`) |
| CLPS-03 | Collapsed headers in hide mode show no children and no aggregate row — the group simply disappears from the grid | Already implemented by `buildHeaderCells()` hide-mode slot algorithm; Phase 30 must route to this behavior when mode = 'hide' |
| CLPS-04 | User can switch a specific header between aggregate and hide mode (via context menu or toggle indicator) | Requires mode storage (Map<collapseKey, 'aggregate' \| 'hide'>) and a switching affordance — context menu integration recommended (pattern already exists in `_openContextMenu`) |
| CLPS-05 | Collapse state persists within a session across view transitions (Tier 2 via PAFVProvider serialization) | PAFVProvider.toJSON()/setState() pattern is established; collapse state needs to be added to PAFVState and round-tripped through the bridge |
| CLPS-06 | (Inferred from context) Both row and column headers support collapse with full symmetry | `buildHeaderCells()` is shared for both dimensions; row click handlers must mirror column click handlers |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript 5.x (strict) | ~5.9 | Type-safe implementation | Project-wide; all existing code is TypeScript |
| D3.js v7 | ~7.9 | Data join for summary cell rendering, heat-map color scale | Already used for all cell rendering (`d3.interpolateBlues`, `d3.scaleSequential`, D3 `.data()` join) |
| Vitest 4.x | ~4.0 | Unit and integration tests | Existing test infrastructure; all provider/view tests use it |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None — no new deps | — | — | All needs met by existing stack |

**Installation:** No new packages needed. Phase 30 is entirely within the existing codebase.

---

## Architecture Patterns

### Recommended Project Structure

No new files are strictly required. All changes land in:

```
src/
├── providers/
│   └── PAFVProvider.ts         # Add collapseState to PAFVState for Tier 2 persistence
└── views/
    └── SuperGrid.ts            # Collapse mode map, aggregate summary rendering, mode switching
tests/
├── views/
│   ├── SuperGrid.test.ts       # CLPS-01..06 test coverage
│   └── SuperStackHeader.test.ts # No changes needed (buildHeaderCells behavior unchanged)
└── providers/
    └── PAFVProvider.test.ts    # Collapse state round-trip tests
```

A separate `CollapseProvider` (per the discretion area) is NOT recommended — it adds complexity for no gain. Collapse state is view-specific (supergrid) and belongs in PAFVProvider's existing serialization envelope alongside `colWidths` and `sortOverrides`.

### Pattern 1: Collapse Mode Map Alongside `_collapsedSet`

**What:** Two parallel data structures — `_collapsedSet: Set<string>` (already exists) tracks WHICH headers are collapsed; a new `_collapseModeMap: Map<string, 'aggregate' | 'hide'>` tracks the MODE for each collapsed key.

**When to use:** Always — every collapse key in `_collapsedSet` has a corresponding entry in `_collapseModeMap`. Default mode = 'aggregate' (first click collapses in aggregate mode).

**Example:**
```typescript
// Existing:
private _collapsedSet: Set<string> = new Set();

// Add:
private _collapseModeMap: Map<string, 'aggregate' | 'hide'> = new Map();

// On collapse (existing click handler at line 3064):
if (this._collapsedSet.has(collapseKey)) {
  this._collapsedSet.delete(collapseKey);
  this._collapseModeMap.delete(collapseKey);
} else {
  this._collapsedSet.add(collapseKey);
  this._collapseModeMap.set(collapseKey, 'aggregate'); // default mode
}
this._renderCells(this._lastCells, this._lastColAxes, this._lastRowAxes);
```

### Pattern 2: Aggregate Summary Cell Injection

**What:** After `buildHeaderCells()` produces `colHeaders` and `rowHeaders`, iterate collapsed headers to find those in 'aggregate' mode. For each such collapsed group, compute an aggregate count across the cross-axis by summing from `_lastCells`. Inject these as additional entries into `cellPlacements`.

**When to use:** In `_renderCells()`, after the `cellPlacements` loop, before the D3 `.data()` join.

**Example:**
```typescript
// After existing cellPlacements construction:
// For each collapsed col header in 'aggregate' mode, inject a summary column
for (const colCell of leafColCells) {
  if (!colCell.isCollapsed) continue;
  const colKey = colCell.parentPath
    ? `${colCell.parentPath}${UNIT_SEP}${colCell.value}`
    : colCell.value;
  const mode = this._collapseModeMap.get(
    `${colCell.level}\x1f${colCell.parentPath}\x1f${colCell.value}`
  );
  if (mode !== 'aggregate') continue;

  // Sum counts across all cells that belong to this collapsed col group
  for (const rowCell of leafRowCells) {
    const fullRowKey = rowCell.parentPath
      ? `${rowCell.parentPath}${UNIT_SEP}${rowCell.value}`
      : rowCell.value;
    // Aggregate: sum all _lastCells that match both this row and any child of this col group
    const aggregateCount = this._lastCells
      .filter(c => {
        const cellRowKey = colAxes.length === 0
          ? ''
          : rowAxes.map(a => String(c[a.field] ?? 'None')).join(UNIT_SEP);
        return cellRowKey === fullRowKey;
        // AND the cell's col key starts with the collapsed col key prefix
      })
      .reduce((sum, c) => sum + c.count, 0);
    // Push a synthetic CellPlacement with isSummary = true
    cellPlacements.push({
      rowKey: fullRowKey,
      colKey,          // the collapsed col key — maps to the collapsed header's single slot
      count: aggregateCount,
      cardIds: [],     // summary cell has no individual card IDs
      matchedCardIds: [],
      isSummary: true, // flag for rendering
    });
  }
}
```

Key insight: The collapsed header already appears as a single slot in `leafColCells` with its `isCollapsed = true`. The aggregate summary cell uses that same slot's `colStart` for CSS Grid positioning — no new columns are needed.

### Pattern 3: Aggregate Count Badge on Header Label

**What:** When a header is collapsed in 'aggregate' mode, compute the total card count across all hidden children and display "Value (N)" inline on the header label — matching the existing "January (47)" time-axis pattern.

**When to use:** In `_createColHeaderCell()` and `_createRowHeaderCell()` when `cell.isCollapsed` is true and mode is 'aggregate'.

**Example (col header — mirroring existing aggregateCount pattern at line 1288-1294):**
```typescript
// In _renderCells, before calling _createColHeaderCell:
let collapseAggregateCount: number | undefined;
if (cell.isCollapsed) {
  const collapseKey = `${cell.level}\x1f${cell.parentPath}\x1f${cell.value}`;
  const mode = this._collapseModeMap.get(collapseKey);
  if (mode === 'aggregate') {
    collapseAggregateCount = cells
      .filter(c => {
        // Match cells whose col value starts with this header's value path
        const colVal = String(c[levelAxisField] ?? 'unknown');
        return colVal === cell.value; // For single-level; extend for multi-level path matching
      })
      .reduce((sum, c) => sum + c.count, 0);
  }
}
const el = this._createColHeaderCell(cell, gridRow, levelAxisField, levelIdx, collapseAggregateCount);
```

The existing `_createColHeaderCell` signature already accepts `aggregateCount?: number` and renders `${cell.value} (${aggregateCount})` when defined. This pattern requires zero changes to the method itself.

### Pattern 4: Mode Switching via Context Menu

**What:** Add a "Switch to aggregate mode" / "Switch to hide mode" item to the existing `_openContextMenu()` that appears when right-clicking a collapsed header. This requires passing the collapse key to `_openContextMenu`.

**When to use:** Right-click on any collapsed header.

**Example:**
```typescript
// In _openContextMenu, add a mode-switch item when headerValue is a collapsed key:
const collapseKey = /* derived from headerValue and dimension context */;
if (this._collapsedSet.has(collapseKey)) {
  const currentMode = this._collapseModeMap.get(collapseKey) ?? 'aggregate';
  const newMode = currentMode === 'aggregate' ? 'hide' : 'aggregate';
  const modeItem = document.createElement('div');
  modeItem.className = 'sg-context-menu-item';
  modeItem.textContent = currentMode === 'aggregate'
    ? 'Switch to hide mode'
    : 'Switch to aggregate mode';
  modeItem.addEventListener('click', () => {
    this._collapseModeMap.set(collapseKey, newMode);
    this._closeContextMenu();
    this._renderCells(this._lastCells, this._lastColAxes, this._lastRowAxes);
  });
  menu.appendChild(modeItem);
}
```

The `_openContextMenu` method already receives `headerValue` (line 1943) and builds context-sensitive items. Adding a mode-switch item follows the exact same pattern as the existing hide/show item.

### Pattern 5: Tier 2 Persistence via PAFVProvider

**What:** Extend `PAFVState` in PAFVProvider.ts with optional `collapseState` field (backward-compatible). Serialize collapse set and mode map as arrays of `[key, mode]` pairs.

**When to use:** PAFVProvider.toJSON() / setState() — existing pattern for colWidths and sortOverrides shows how to add new optional fields.

**Example:**
```typescript
// In PAFVState:
interface PAFVState {
  // ... existing fields ...
  /** Phase 30 — collapse state per header key. Optional for backward compat. */
  collapseState?: Array<{ key: string; mode: 'aggregate' | 'hide' }>;
}

// In toJSON(): add collapseState from SuperGrid to PAFVProvider
// DESIGN NOTE: SuperGrid does NOT own PAFVProvider — it reads from it.
// Collapse state is SuperGrid-local. It should be persisted by SuperGrid directly
// via a dedicated ui_state key ('supergrid-collapse') through the bridge,
// OR stored inside PAFVProvider via a new accessor/mutator pair.
```

**Design decision (Claude's discretion):** Store collapse state directly in PAFVProvider via accessor methods, matching the colWidths/sortOverrides pattern:
- `getCollapseState()` → returns `{ collapsedKeys: string[]; modeMap: Record<string, 'aggregate' | 'hide'> }`
- `setCollapseState(state)` → stores without triggering notify (layout-only change, like colWidths)
- SuperGrid calls `setCollapseState()` after every collapse toggle and reads `getCollapseState()` on init
- PAFVProvider includes this in `toJSON()` and restores in `setState()` with backward-compat guard

This is identical to how `colWidths` works: SuperGrid-local state that rides the existing PAFVProvider checkpoint without triggering re-query.

### Anti-Patterns to Avoid

- **Modifying `buildHeaderCells()` for aggregate-vs-hide distinction:** buildHeaderCells should stay pure and mode-agnostic. It already handles hide mode (collapsed slot = 1 leaf, children omitted). Aggregate mode is a rendering concern, not a slot-computation concern.
- **Triggering `_fetchAndRender()` on collapse toggle:** Collapse is client-side; it re-renders from `_lastCells`. The existing click handler correctly calls `_renderCells()` only — never `_fetchAndRender()`. Preserve this.
- **Creating a new D3 data join for summary cells:** Summary cells belong in the same `cellPlacements` array fed to the existing D3 `.data()` join. Add an `isSummary` flag to CellPlacement to distinguish rendering.
- **Using `innerHTML` for summary cell content:** All existing cell DOM construction uses explicit `createElement`. Match this pattern.
- **Separate CollapseProvider:** Unnecessary indirection. Collapse state is supergrid-view-only and fits cleanly in PAFVProvider's existing optional-field pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Summary cell color | Custom color interpolation | Existing `heatScale(count)` from `d3.scaleSequential().interpolator(d3.interpolateBlues)` | Already computed in `_renderCells()` — share the same scale |
| Collapse key format | New key format | Existing `${level}\x1f${parentPath}\x1f${value}` format | Already used by `_collapsedSet`, `buildHeaderCells()`, and all tests |
| Context menu infrastructure | New menu component | Existing `_openContextMenu()` / `_closeContextMenu()` in SuperGrid.ts | Pattern is complete — just add menu items |
| Persistence debounce | New timer/debounce | Existing `StateManager.markDirty()` + `enableAutoPersist()` subscription | PAFVProvider.subscribe() already wired to StateManager |

---

## Common Pitfalls

### Pitfall 1: Summary Cells Appearing Outside Their Collapsed Slot

**What goes wrong:** Aggregate summary cells get assigned a `colStart`/`rowStart` that doesn't match the collapsed header's single visible slot, causing misalignment.

**Why it happens:** `colValueToStart` is built from `leafColCells` AFTER `buildHeaderCells()` runs. A collapsed col header in `leafColCells` has `colStart` equal to its position in the visible slot sequence. Summary cells must use the SAME `colStart` that the collapsed parent occupies — not a freshly-computed position.

**How to avoid:** Build summary cell positions from `colValueToStart` and `leafRowCells` (which are already built in `_renderCells()`) using the collapsed cell's `colKey` (full compound key). The collapsed slot already appears in `colValueToStart`.

**Warning signs:** Summary cells render outside the grid or overlap with non-collapsed columns.

### Pitfall 2: Collapse Mode State Lost on `teardown()` / View Transitions

**What goes wrong:** `_collapsedSet` and `_collapseModeMap` are cleared in `teardown()` (line 1011), which is called on view transitions. Without Tier 2 persistence, collapse state disappears when switching from grid to calendar and back.

**Why it happens:** `teardown()` resets all internal state with `new Set()`. See line 1011: `this._collapsedSet = new Set()`.

**How to avoid:** On teardown, save collapse state to PAFVProvider via `setCollapseState()` BEFORE clearing. On mount (in `_fetchAndRender()` after data arrives), restore from `getCollapseState()`. This mirrors how `colWidths` survives view transitions.

**Warning signs:** Collapse state disappears after switching views even within the same session.

### Pitfall 3: Row Header Aggregate Count Computed Against Wrong Axis

**What goes wrong:** When a ROW header is collapsed in aggregate mode, the count badge on the row header shows the total across ALL columns — but the count that matters is across the cross-axis (columns), not a flat sum.

**Why it happens:** The time-axis aggregate count pattern (line 1288-1294) computes `cells.filter(c => c[levelAxisField] === cell.value).reduce(sum, c => sum + c.count, 0)` — this gives a flat total, which is correct for the badge (it shows "how many cards are in this collapsed group total"). For row headers, the same pattern applies: filter `_lastCells` by the row header's value at its axis level, sum counts.

**How to avoid:** For the header count badge, always compute total count for the collapsed group (flat sum across the cross-axis). For summary cells, compute per-cross-axis-position count. Keep these two computations distinct.

### Pitfall 4: `collapseKey` Construction Differs Between Context Menu and Click Handler

**What goes wrong:** The click handler on column headers builds `collapseKey` using `cell.level`, `cell.parentPath`, `cell.value` (line 3024). The context menu handler must use the same key format when adding the mode-switch item — but the context menu currently receives `axisField` and `headerValue` (not a HeaderCell object), so parentPath is not available.

**Why it happens:** `_openContextMenu()` signature at line 1943 takes `(clientX, clientY, axisField, dimension, headerValue)`. The HeaderCell's `parentPath` is not passed.

**How to avoid:** Pass the full `collapseKey` string to `_openContextMenu()` as an additional optional parameter when the click originates from a collapsed header. Alternatively, add `data-collapse-key` to the header DOM element and read it in the contextmenu event delegation handler. The contextmenu handler (around line 879) uses event delegation and has access to `e.target` — add `data-collapse-key` attribute to header elements.

### Pitfall 5: D3 Key Function Conflict for Summary Cells

**What goes wrong:** The D3 data join at line 1402 uses `d => ${d.rowKey}${RECORD_SEP}${d.colKey}` as the key function. If a summary cell has the same `rowKey`+`colKey` as a normal cell (because it occupies the same grid slot), D3 sees a key collision and updates rather than enters.

**Why it happens:** The collapsed col group's key IS the parent key. A normal data cell in that slot might have the same compound key if the parent and child share values.

**How to avoid:** Add `isSummary` to CellPlacement and use `${d.isSummary ? 'summary:' : ''}${d.rowKey}${RECORD_SEP}${d.colKey}` as the D3 key. This ensures summary cells have unique keys that never collide with normal cells.

### Pitfall 6: Axis Change Does Not Invalidate Stale Collapse Keys

**What goes wrong:** User collapses "Engineering" under `folder` axis, then changes the row axis to `status`. The collapse key `1\x1fEngineering\x1fDesign` is now stale (the `folder` axis no longer maps to level 1), but `_collapsedSet` still has it. `buildHeaderCells()` never matches this key, so it's silently ignored — which is correct. But the stale key persists in the persisted state, polluting future restore.

**Why it happens:** `setColAxes()` and `setRowAxes()` clear `colWidths` and `sortOverrides` on axis change (PAFVProvider lines 188-193). Collapse state should receive the same treatment.

**How to avoid:** When PAFVProvider's `setColAxes()` or `setRowAxes()` is called, also clear collapse state. This requires collapse state to live in PAFVProvider (not in SuperGrid-local variables) so the provider can clear it atomically with axis changes.

---

## Code Examples

### Existing Collapse Toggle (SuperGrid.ts line 3064)
```typescript
// Source: src/views/SuperGrid.ts
// Plain click: toggle collapse/expand
if (this._collapsedSet.has(collapseKey)) {
  this._collapsedSet.delete(collapseKey);
} else {
  this._collapsedSet.add(collapseKey);
}
// Re-render from cached cells (no re-query)
this._renderCells(this._lastCells, this._lastColAxes, this._lastRowAxes);
```

### Existing Aggregate Count Pattern for Time Axis (SuperGrid.ts lines 1288-1296)
```typescript
// Source: src/views/SuperGrid.ts
let aggregateCount: number | undefined;
if (isTimeAxisCol) {
  aggregateCount = cells
    .filter(c => String(c[levelAxisField] ?? 'unknown') === cell.value)
    .reduce((sum, c) => sum + c.count, 0);
}
const el = this._createColHeaderCell(cell, gridRow, levelAxisField, levelIdx, aggregateCount);
```

### Existing Heat-Map Color Scale (SuperGrid.ts lines 1390-1394)
```typescript
// Source: src/views/SuperGrid.ts
const maxCount = Math.max(...cellPlacements.map(c => c.count), 1);
const heatScale = d3.scaleSequential()
  .domain([0, maxCount])
  .interpolator(d3.interpolateBlues);
```

### Existing Context Menu Pattern (SuperGrid.ts lines 2025-2049)
```typescript
// Source: src/views/SuperGrid.ts — hide/show item pattern to replicate for mode-switch
const hideItem = document.createElement('div');
hideItem.className = 'sg-context-menu-item';
hideItem.textContent = isHidden ? `Show ${isCol ? 'column' : 'row'}` : `Hide ${isCol ? 'column' : 'row'}`;
hideItem.addEventListener('click', () => {
  if (isHidden) { hiddenSet.delete(hideKey); } else { hiddenSet.add(hideKey); }
  this._closeContextMenu();
  void this._fetchAndRender();
});
```

### Existing PAFVProvider Optional Field Pattern (PAFVProvider.ts)
```typescript
// Source: src/providers/PAFVProvider.ts — colWidths pattern to replicate for collapseState
// In PAFVState interface:
colWidths?: Record<string, number>;

// In setState():
colWidths: (typeof restored.colWidths === 'object' && ...) ? { ...restored.colWidths } : {},

// Accessor that doesn't trigger notify (SuperGrid calls this without causing re-query):
setColWidths(widths: Record<string, number>): void {
  this._state.colWidths = { ...widths };
  // Do NOT call _scheduleNotify — width changes don't trigger re-query
}
```

### Collapse Key Format (Established — do not change)
```typescript
// Source: src/views/SuperGrid.ts line 3024, SuperStackHeader.ts lines 117-119
const collapseKey = `${cell.level}\x1f${cell.parentPath}\x1f${cell.value}`;
// Example: level 0, no parent, value "Engineering" → "0\x1f\x1fEngineering"
// Example: level 1, parent "Work", value "Design"  → "1\x1fWork\x1fDesign"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-level row headers | N-level via `buildHeaderCells()` for both dims | Phase 29 | Collapse system must handle N levels for both rows and columns symmetrically |
| `_collapsedSet` ephemeral | Ephemeral (needs Tier 2 wiring) | Phase 30 adds | Collapse state currently cleared on every `teardown()` call |
| No collapse mode distinction | Phase 30 adds aggregate vs. hide | Phase 30 | The slot algorithm in `buildHeaderCells()` already produces hide behavior; aggregate needs post-processing |

---

## Open Questions

1. **Summary cell click behavior**
   - What we know: User discretion per CONTEXT.md
   - What's unclear: Click on summary cell — expand group? Select cards? No-op?
   - Recommendation: No-op for Phase 30 (simplest). Plain click on the summary cell does nothing; the collapsed header itself is the click target to expand. This avoids the complexity of selecting undefined card IDs.

2. **Default collapse mode**
   - What we know: User discretion per CONTEXT.md
   - What's unclear: First click: aggregate or hide?
   - Recommendation: Aggregate-first. This is the safer default — data is never fully hidden, only compressed. Users can switch to hide via context menu if desired.

3. **Visual indicator type**
   - What we know: User discretion per CONTEXT.md
   - What's unclear: Chevron, plus/minus, or none?
   - Recommendation: Chevron (▶ collapsed, ▼ expanded) prepended to the label, replacing or preceding the existing collapse-driven `opacity: 0.6` treatment. The chevron is a universal disclosure pattern and requires no explanation.

4. **Axis-change invalidation strategy**
   - What we know: `setColAxes()`/`setRowAxes()` already clear `colWidths` and `sortOverrides` atomically
   - What's unclear: Should collapse state clear ALL keys or only keys that reference the changed axis field?
   - Recommendation: Clear ALL collapse state on any axis change. Selective invalidation is complex and error-prone; stale collapse state is visually confusing. This matches how `colWidths` clears entirely on axis change.

5. **Whether collapse state survives full app reloads**
   - What we know: CLPS-05 requires persistence "within a session across view transitions" — the phrasing suggests session-only is acceptable
   - What's unclear: Does Tier 2 persistence (PAFVProvider round-trip) mean it survives app reload too?
   - Recommendation: Implement Tier 2 persistence (rides the existing PAFVProvider checkpoint, which writes to `ui_state` table and survives reload). This is not harder than session-only and is strictly better.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run tests/views/SuperGrid.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLPS-01 | Clicking col/row header at any level collapses that group without affecting siblings | unit | `npx vitest run tests/views/SuperGrid.test.ts` | ✅ (add new `describe` block) |
| CLPS-02 | Collapsed header in aggregate mode shows "(N)" count badge + summary cell in grid body | unit | `npx vitest run tests/views/SuperGrid.test.ts` | ✅ (add new tests) |
| CLPS-03 | Collapsed header in hide mode shows no children, no summary row | unit | `npx vitest run tests/views/SuperGrid.test.ts` | ✅ (add new tests) |
| CLPS-04 | User can switch mode via context menu; right-click collapsed header shows mode-switch item | unit | `npx vitest run tests/views/SuperGrid.test.ts` | ✅ (add new tests) |
| CLPS-05 | Collapse state serializes to PAFVProvider.toJSON() and restores via setState() | unit | `npx vitest run tests/providers/PAFVProvider.test.ts` | ✅ (add new tests) |
| CLPS-06 | Row headers support same collapse behavior as col headers (symmetry) | unit | `npx vitest run tests/views/SuperGrid.test.ts` | ✅ (add new tests) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/views/SuperGrid.test.ts tests/views/SuperStackHeader.test.ts tests/providers/PAFVProvider.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/views/SuperGrid.test.ts` — new `describe('SuperGrid — collapse system CLPS')` block with CLPS-01..06 tests (file exists; add tests)
- [ ] `tests/providers/PAFVProvider.test.ts` — new collapse state serialization/restoration tests (file exists; add tests)

*(Note: No new test files needed — all tests extend existing files. No framework install needed.)*

---

## Recommended Plan Structure

Based on research, 2-3 plans are appropriate:

**Plan 01 (TDD setup + PAFVProvider collapse state):**
- Add `collapseState` to PAFVState (backward-compat optional field)
- Add `getCollapseState()` / `setCollapseState()` accessors to PAFVProvider (no notify, like colWidths)
- Clear collapse state in `setColAxes()`/`setRowAxes()` (like colWidths/sortOverrides)
- Write PAFVProvider collapse persistence tests (RED → GREEN)
- Write CLPS-01..06 failing tests in SuperGrid.test.ts (RED, all fail — no implementation yet)

**Plan 02 (SuperGrid collapse implementation):**
- Add `_collapseModeMap: Map<string, 'aggregate' | 'hide'>` to SuperGrid
- Extend click handler to set default 'aggregate' mode on first collapse
- Implement aggregate count badge in `_createColHeaderCell` / `_createRowHeaderCell`
- Implement aggregate summary cell injection in `_renderCells()` (inject into `cellPlacements`)
- Summary cells rendered with `isSummary` flag, using existing heat-map `heatScale(count)`
- Save/restore collapse state to/from PAFVProvider on `teardown()`/`mount()`
- CLPS-01, CLPS-02, CLPS-03, CLPS-06 tests go GREEN

**Plan 03 (Mode switching + persistence):**
- Add collapse key to header element as `data-collapse-key` attribute
- Extend `_openContextMenu()` to include mode-switch item for collapsed headers
- Wire Tier 2 persistence: collapse state flows through existing PAFVProvider checkpoint
- Clear collapse state on teardown (save first), restore on mount
- CLPS-04, CLPS-05 tests go GREEN
- Full suite green

---

## Sources

### Primary (HIGH confidence)
- `src/views/SuperGrid.ts` — direct codebase read; collapse infrastructure, click handler, aggregate count pattern, context menu pattern
- `src/views/supergrid/SuperStackHeader.ts` — direct codebase read; `buildHeaderCells()` behavior, `HeaderCell` interface, collapse key format
- `src/providers/PAFVProvider.ts` — direct codebase read; `PAFVState`, `toJSON()`/`setState()`, colWidths/sortOverrides optional field pattern
- `src/providers/StateManager.ts` — direct codebase read; Tier 2 persistence coordination pattern
- `tests/views/SuperStackHeader.test.ts` — direct codebase read; existing collapse test expectations, key format verification
- `tests/views/SuperGrid.test.ts` — direct codebase read; existing collapse test patterns, integration test structure
- `.planning/phases/30-collapse-system/30-CONTEXT.md` — direct read; locked decisions and discretion areas

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` — phase success criteria (source of requirement descriptions since REQUIREMENTS.md covers v4.0 only)
- `.planning/phases/29-multi-level-row-headers/29-02-PLAN.md` — Phase 29 plan patterns for row header implementation

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all needs met by existing codebase
- Architecture: HIGH — all patterns derived from direct codebase reads; the collapse infrastructure is already 70% built
- Pitfalls: HIGH — derived from careful reading of existing collapse code paths and the established patterns for colWidths/sortOverrides persistence

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable codebase; no fast-moving external dependencies)
