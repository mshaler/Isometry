# Phase 73: User-Configurable LATCH Mappings - Research

**Researched:** 2026-03-11
**Domain:** SchemaProvider override layer, PropertiesExplorer UI extension, ui_state persistence
**Confidence:** HIGH — all findings based on direct codebase inspection of existing patterns

## Summary

Phase 73 adds a user override layer on top of SchemaProvider's heuristic LATCH classification. The core challenge is not "how to build this" — the project already has all necessary primitives — but "where to insert the override layer so it is cleanest." SchemaProvider is the single source of truth for LATCH families, and all consumers (`getLatchFamily()`, `LatchExplorers._getFieldsForFamily()`, `PropertiesExplorer._createColumn()`) read from it. The override layer therefore belongs inside SchemaProvider itself, not as a separate provider.

Persistence follows the established `ui:set` / `ui:get` pattern (keys like `notebook:{cardId}`) via `WorkerBridge.send()`. The natural key names are `latch:overrides` (JSON map of `fieldName → LatchFamily full-name`) and `latch:disabled` (JSON array of disabled field names). Both are Tier 2 (survive session restart).

The PropertiesExplorer already has per-field row DOM with D3 selection.join, so adding a chip badge and a dropdown to each row is an additive change to the `_renderColumnProperties` / `_createColumn` flow. The key gotcha is that reassigning a field to a new family requires rebuilding which column the field appears in — the `_columns` array is built once at mount time. This means `update()` needs to recalculate field-to-column membership when overrides change, not just re-render existing rows.

**Primary recommendation:** Add `setOverrides(overrides, disabled)` to SchemaProvider; have PropertiesExplorer call it, persist via `bridge.send('ui:set', ...)`, and call `LatchExplorers.update()` / `PropertiesExplorer.update()` through the existing SchemaProvider subscriber notification chain.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Phase Boundary:**
- Users can override automatic LATCH family assignments for any column and toggle individual field visibility, with overrides persisted across sessions via ui_state (Tier 2). LatchExplorers and PropertiesExplorer reflect changes immediately. This phase does NOT add new LATCH families, new field types, or per-view overrides — configuration is global.

**Reassignment interaction:**
- Dropdown picker triggered from a LATCH chip badge on each field row in PropertiesExplorer
- Chip shows current family letter (e.g., [C]) — click opens dropdown with all 5 LATCH families
- Dropdown marks the heuristic-assigned family with "(default)" suffix for reference
- Reassignment available in PropertiesExplorer only — LatchExplorers just reflect the result
- Instant re-render on reassignment: field disappears from old column, appears in new column immediately (no animation)

**Override visibility:**
- Overridden fields get a dot indicator on the LATCH chip badge (e.g., [C•] vs [C]) to distinguish from heuristic assignments
- No aggregate override count or summary in headers — dot indicators are sufficient
- Disabled fields shown greyed out in place within their LATCH column (reduced opacity, unchecked toggle)

**Reset behavior:**
- Per-field reset: selecting the "(default)" family in the dropdown clears the override — no extra UI needed
- Bulk "Reset all LATCH mappings" button in PropertiesExplorer footer, visible only when ≥1 override exists
- Confirmation dialog before bulk reset: "Reset N custom mappings to defaults?"
- "Reset all" only restores LATCH family assignments — does NOT re-enable disabled fields (separate concerns)

**Field disable scope:**
- Disabled fields removed entirely from LatchExplorers filter sections (not greyed out)
- Disabling a field auto-clears any active filters on it (FilterProvider.removeFilter() on disable)
- Disabled fields excluded from PropertiesExplorer and ProjectionExplorer available pools (per UCFG-02)
- SuperGrid continues to show all columns regardless of disabled state — it's a data view, not a configuration surface
- "Enable all" button in PropertiesExplorer footer (next to "Reset all"), visible only when ≥1 field is disabled

### Claude's Discretion
- Exact dropdown component implementation (native select, custom popover, etc.)
- Chip badge styling details (size, font, dot indicator implementation)
- Confirmation dialog styling for bulk reset
- ui_state key naming convention for override persistence
- SchemaProvider merge logic details (user overrides always win per UCFG-05)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UCFG-01 | User can override LATCH family for any column — persisted in ui_state and merged by SchemaProvider | SchemaProvider.setOverrides() + ui:set at key `latch:overrides`; merge in getFieldsByFamily() and getColumns() override path |
| UCFG-02 | User can toggle axis-enabled state for individual fields — disabled fields excluded from PropertiesExplorer and ProjectionExplorer available pools | SchemaProvider.setDisabled() + PropertiesExplorer filters getAxisColumns() through disabled set; ProjectionExplorer does the same |
| UCFG-03 | LATCH family overrides are global (not per-view) and survive session restart via ui_state persistence | bridge.send('ui:set', { key: 'latch:overrides', value: JSON.stringify(map) }) on every change; restore via bridge.send('ui:get', ...) at boot |
| UCFG-04 | LatchExplorers reflect user LATCH family overrides — moving a field from Category to Time causes it to appear in Time section | LatchExplorers._getFieldsForFamily() already reads from SchemaProvider; override merge in SchemaProvider makes this automatic once SchemaProvider is updated |
| UCFG-05 | SchemaProvider merges heuristic classification with user overrides — user overrides always win | Override map stored in SchemaProvider; getFieldsByFamily() and ColumnInfo.latchFamily apply override map before returning results |
</phase_requirements>

---

## Standard Stack

### Core (no new dependencies — all existing project libraries)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| D3 select + join | v7.9 | Update chip badges and dropdown DOM in PropertiesExplorer | Mandatory on every `.data()` call per D-005 |
| WorkerBridge ui:set/ui:get | existing | Persist override and disabled maps to ui_state table | Established Tier 2 pattern (notebook:{cardId} precedent) |
| SchemaProvider subscribe | existing | Notify LatchExplorers and ProjectionExplorer when overrides change | queueMicrotask batching already built |
| native `<select>` | browser | Dropdown for LATCH family reassignment | Simplest implementation; no custom popover complexity |

### No New Installations Required

All building blocks exist. No `npm install` step needed.

---

## Architecture Patterns

### Recommended Structure

```
SchemaProvider.ts          — add setOverrides(), setDisabled(), override-aware accessors
src/ui/PropertiesExplorer.ts — add chip badge UI, dropdown, footer buttons, bridge persistence
src/providers/latch.ts     — getLatchFamily() already delegates to SchemaProvider; automatic
LatchExplorers.ts          — _getFieldsForFamily() already delegates; automatic after SchemaProvider change
ProjectionExplorer.ts      — getAxisColumns() call already goes through SchemaProvider; filter disabled fields
tests/providers/SchemaProvider.test.ts     — new describe block for override merge behavior
tests/ui/PropertiesExplorer.test.ts        — new describe blocks for chip badge, dropdown, footer buttons
```

### Pattern 1: Override Merge Inside SchemaProvider

**What:** SchemaProvider holds two new internal maps — `_latchOverrides: Map<string, LatchFamily>` and `_disabledFields: Set<string>`. The `getFieldsByFamily()` and `getColumns()` methods apply these when building results.

**When to use:** UCFG-05 requires "SchemaProvider merges heuristic + overrides." Keeping merge in SchemaProvider ensures all existing consumers (getLatchFamily, LatchExplorers, PropertiesExplorer, ProjectionExplorer) get correct data with zero changes to their read paths.

**Key methods to add:**
```typescript
// Source: codebase pattern — matches setSchemaProvider() setter injection
setOverrides(overrides: Map<string, SchemaLatchFamily>): void {
  this._latchOverrides = new Map(overrides);
  this._scheduleNotify(); // triggers LatchExplorers/ProjectionExplorer re-render
}

setDisabled(disabled: Set<string>): void {
  this._disabledFields = new Set(disabled);
  this._scheduleNotify();
}

// Modified getFieldsByFamily() applies override before returning
getFieldsByFamily(family: LatchFamily): readonly ColumnInfo[] {
  return this._cards.filter((c) => {
    const effectiveFamily = this._latchOverrides.get(c.name) ?? c.latchFamily;
    return effectiveFamily === family && !this._disabledFields.has(c.name);
  });
}

// New accessor for all columns WITH override applied (for getColumns consumers)
getAxisColumns(): readonly ColumnInfo[] {
  return this._cards
    .filter((c) => !this._disabledFields.has(c.name))
    .map((c) => ({
      ...c,
      latchFamily: this._latchOverrides.get(c.name) ?? c.latchFamily,
    }));
}

// Override query methods
getLatchOverride(field: string): SchemaLatchFamily | undefined {
  return this._latchOverrides.get(field);
}

getHeuristicFamily(field: string): SchemaLatchFamily | undefined {
  return this._cards.find((c) => c.name === field)?.latchFamily;
}

hasAnyOverride(): boolean {
  return this._latchOverrides.size > 0;
}

hasAnyDisabled(): boolean {
  return this._disabledFields.size > 0;
}
```

**Important:** `getColumns('cards')` (raw PRAGMA results) should NOT filter disabled fields — it is used for validation (isValidColumn). Only `getAxisColumns()` / `getFieldsByFamily()` apply the user config layer.

### Pattern 2: PropertiesExplorer Chip Badge + Dropdown

**What:** Each field row in PropertiesExplorer gains a chip badge element `<span class="prop-latch-chip" data-field="...">` that shows the current family letter. A `<select>` child inside it (hidden until click, or visible inline) lists the 5 LATCH families.

**Implementation notes:**
- The chip badge can use a `<select>` directly — change event fires `_handleFamilyChange(field, newFamily)`.
- The "(default)" suffix in dropdown options is computed by comparing option value to `schema.getHeuristicFamily(field)`.
- The dot indicator `[C•]` is a CSS `::after` on the chip with `content: '•'` when `data-overridden="true"`.

**Column rebuild on reassignment:** PropertiesExplorer builds `_columns[].fields` once in `_createColumn()`. When a LATCH override changes, `_columns` must be rebuilt. The cleanest approach:
- Add `_rebuildColumnFields()` private method that re-queries `getLatchFamily()` for each field and redistributes.
- Call it inside the SchemaProvider subscriber (already wired via `_unsubAlias`; add `_unsubSchema`).

### Pattern 3: Persistence via WorkerBridge

**What:** Override and disabled state are JSON-serialized and stored in ui_state via `bridge.send('ui:set', ...)`. This is identical to the NotebookExplorer pattern.

**Key naming convention (Claude's discretion):**
- `latch:overrides` — JSON `Record<string, SchemaLatchFamily>` (field → full family name)
- `latch:disabled` — JSON `string[]` (list of disabled field names)

**Boot sequence:**
1. WorkerBridge.isReady resolves → SchemaProvider.initialize() already called
2. Restore overrides: `bridge.send('ui:get', { key: 'latch:overrides' })` → parse JSON → `schemaProvider.setOverrides(map)`
3. Restore disabled: `bridge.send('ui:get', { key: 'latch:disabled' })` → parse JSON → `schemaProvider.setDisabled(set)`
4. This fires SchemaProvider.subscribe() → triggers PropertiesExplorer and LatchExplorers re-render

**Who calls bridge.send?** PropertiesExplorer has the bridge in its config (needs to be added — currently it only has `alias`, `container`, `onCountChange`, `schema`). Alternatively, the boot sequence in `main.ts` or `WorkbenchShell` handles restore, and PropertiesExplorer persists on change.

The better pattern (consistent with NotebookExplorer): PropertiesExplorer receives a `bridge` config prop and calls `ui:set` on every override or disable change. Restore happens in the boot sequence outside PropertiesExplorer.

### Pattern 4: FilterProvider Integration on Field Disable

**What:** When a field is disabled via `_handleToggle`, any active filters on that field must be cleared.

**Implementation:**
```typescript
// PropertiesExplorer receives filter: FilterProvider in config
private _handleDisableField(field: string): void {
  this._schema!.setDisabled(new Set([...this._schema!.getDisabledFields(), field]));
  // Clear active filters for this field
  const filters = this._config.filter!.getFilters();
  for (let i = filters.length - 1; i >= 0; i--) {
    if (filters[i]!.field === field) this._config.filter!.removeFilter(i);
  }
  this._config.filter!.clearRangeFilter(field);
  // Persist
  void this._persistDisabled();
}
```

Note: `clearRangeFilter` exists on FilterProvider (used in LatchExplorers._handleClearAll). `removeFilter(index)` also exists.

### Anti-Patterns to Avoid

- **Re-running initialize() to inject overrides:** SchemaProvider.initialize() replaces the entire column list from PRAGMA. Overrides must survive re-initialization (e.g., if Worker restarts). Keep `_latchOverrides` and `_disabledFields` independent of `initialize()` — they persist across re-init.
- **Storing overrides in localStorage:** The project uses ui_state (sql.js) for Tier 2 persistence, not localStorage. localStorage is only used for Tier 1 (UI collapse state). This is a design boundary.
- **Rebuilding LatchExplorers DOM on every override change:** LatchExplorers builds per-family bodies at `mount()` time. Calling `destroy()` + `mount()` to reflect a family change would lose all existing chip data. Instead, `_getFieldsForFamily()` must be called at render time (already does this), and `update()` must be called after override change. For histogram and chip groups, they are also built at mount time — a field that moves family will need the section body rebuilt. The simplest safe approach: call `destroy()` + `mount()` on the relevant family section only. But since LatchExplorers uses `CollapsibleSection` wrappers that persist collapse state to localStorage, destroy+remount is safe for the body. Alternatively, since overrides are rare events, a full destroy+remount of LatchExplorers is acceptable.
- **Mutating ColumnInfo objects:** `ColumnInfo.latchFamily` is derived from PRAGMA and should not be mutated. The override is a separate map; `getFieldsByFamily()` applies it at query time.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subscriber notification on override change | Custom event emitter | SchemaProvider._scheduleNotify() | Already built; queueMicrotask batching prevents cascade |
| Persist/restore overrides | Custom storage | bridge.send('ui:set/ui:get') | Established pattern; survives across native app restarts |
| Dropdown for family selection | Custom popover | Native `<select>` | Zero complexity, accessible by default, sufficient for this UI |
| Confirmation dialog | Custom modal | `window.confirm()` | Used elsewhere in project for destructive actions; consistent |

---

## Common Pitfalls

### Pitfall 1: Override Does Not Survive SchemaProvider.initialize() Re-call
**What goes wrong:** SchemaProvider.initialize() is called on Worker restart (or future re-import). If overrides are stored inside `initialize()` scope, they get wiped.
**Why it happens:** initialize() replaces `_cards` from fresh PRAGMA results.
**How to avoid:** `_latchOverrides` and `_disabledFields` are instance fields initialized to empty in constructor, set ONLY via `setOverrides()` / `setDisabled()`. initialize() does NOT touch them.
**Warning signs:** After reload, fields return to heuristic families even though ui_state has saved overrides.

### Pitfall 2: PropertiesExplorer Column Fields Not Rebuilt After Override
**What goes wrong:** User reassigns "priority" from Hierarchy to Category. PropertiesExplorer still shows "priority" in the Hierarchy column.
**Why it happens:** `_createColumn()` builds `col.fields` from `getLatchFamily()` at mount time. The D3 join updates existing rows but does not move them between columns.
**How to avoid:** Add `_rebuildColumnFields()` that re-derives fields for each column from the current SchemaProvider state. Call it before `_renderColumns()` when SchemaProvider notifies.
**Warning signs:** Override takes effect in LatchExplorers (which calls `_getFieldsForFamily()` fresh) but not PropertiesExplorer.

### Pitfall 3: Disabled Fields Still Appear in ProjectionExplorer
**What goes wrong:** User disables "sort_order". It still shows in ProjectionExplorer's available pool.
**Why it happens:** ProjectionExplorer calls `schemaProvider.getAxisColumns()` — if `getAxisColumns()` does not filter disabled fields, they appear.
**How to avoid:** `SchemaProvider.getAxisColumns()` filters out disabled fields. ProjectionExplorer needs no changes because it reads from SchemaProvider. Verify getAxisColumns() is the method ProjectionExplorer uses (confirmed: DYNM-06 migrated ProjectionExplorer to read from SchemaProvider.getAxisColumns()).
**Warning signs:** Disabled field still available in axis dropdowns.

### Pitfall 4: Boot Restore Race — Overrides Applied Before SchemaProvider.initialize()
**What goes wrong:** Boot sequence tries to restore overrides from ui_state before schema PRAGMA has arrived, so `setOverrides()` is called on empty `_cards`.
**Why it happens:** ui:get is async; if called before bridge.isReady, schema may not be loaded.
**How to avoid:** Restore overrides AFTER `await bridge.isReady` (which guarantees SchemaProvider.initialize() has been called). The existing boot pattern in main.ts already gates everything behind `await bridge.isReady`.
**Warning signs:** Override appears to load (no errors) but has no visible effect.

### Pitfall 5: LatchExplorers Family Section Shows Moved Field in Old Section
**What goes wrong:** "priority" moved from Hierarchy to Category. LatchExplorers still shows "priority" in the Hierarchy chip group.
**Why it happens:** LatchExplorers builds chip containers per-field in `_populateHierarchy()` at mount time. The chip container map `_chipContainers` still has "priority" mapped to a DOM element inside the H section body.
**How to avoid:** After a LATCH override change, call `LatchExplorers.destroy()` + `LatchExplorers.mount()`. Since overrides are a rare user-initiated event (not a frequent data refresh), full remount is acceptable. The SchemaProvider subscriber in the upstream orchestrator (WorkbenchShell or main.ts) triggers this.
**Warning signs:** Field appears in both sections (old body still has it; new body was added by update()).

### Pitfall 6: "Reset All" Clears Disabled Fields Too
**What goes wrong:** User clicks "Reset all LATCH mappings" and also loses their disabled-field configuration.
**Why it happens:** Implementation conflates override reset with disabled reset.
**How to avoid:** Per locked decision: "Reset all" only clears `_latchOverrides` map; `_disabledFields` is untouched. The "Enable all" button separately clears `_disabledFields`. Separate persistence keys (`latch:overrides` vs `latch:disabled`) reinforce this separation.
**Warning signs:** After "Reset all", previously hidden fields reappear.

---

## Code Examples

### SchemaProvider: setOverrides and override-aware getFieldsByFamily

```typescript
// Source: codebase pattern — SchemaProvider.ts (existing initialize() pattern)

// New private fields (add to class body):
private _latchOverrides: Map<string, SchemaLatchFamily> = new Map();
private _disabledFields: Set<string> = new Set();

setOverrides(overrides: Map<string, SchemaLatchFamily>): void {
  this._latchOverrides = new Map(overrides);
  this._scheduleNotify();
}

setDisabled(disabled: Set<string>): void {
  this._disabledFields = new Set(disabled);
  this._scheduleNotify();
}

// Modified getFieldsByFamily — applies override, excludes disabled
getFieldsByFamily(family: SchemaLatchFamily): readonly ColumnInfo[] {
  return this._cards.filter((c) => {
    if (this._disabledFields.has(c.name)) return false;
    const effective = this._latchOverrides.get(c.name) ?? c.latchFamily;
    return effective === family;
  });
}

// Modified getAxisColumns — excludes disabled, applies override in returned latchFamily
getAxisColumns(): readonly ColumnInfo[] {
  return this._cards
    .filter((c) => !this._disabledFields.has(c.name))
    .map((c) => ({
      ...c,
      latchFamily: (this._latchOverrides.get(c.name) ?? c.latchFamily) as SchemaLatchFamily,
    }));
}

// Read accessor for override (needed by PropertiesExplorer to know heuristic vs override)
getHeuristicFamily(field: string): SchemaLatchFamily | undefined {
  return this._cards.find((c) => c.name === field)?.latchFamily;
}

getLatchOverride(field: string): SchemaLatchFamily | undefined {
  return this._latchOverrides.get(field);
}

hasAnyOverride(): boolean { return this._latchOverrides.size > 0; }
hasAnyDisabled(): boolean { return this._disabledFields.size > 0; }
getDisabledFields(): ReadonlySet<string> { return this._disabledFields; }
```

### PropertiesExplorer: Chip badge with native select

```typescript
// Source: codebase — PropertiesExplorer._renderColumnProperties enter callback pattern

// Inside the D3 enter callback, after the checkbox:
const chipWrapper = document.createElement('span');
chipWrapper.className = 'prop-latch-chip';

const isOverridden = !!self._config.schema?.getLatchOverride(field);
chipWrapper.dataset['overridden'] = String(isOverridden);

const select = document.createElement('select');
select.className = 'prop-latch-chip__select';
for (const fam of LATCH_ORDER) {
  const opt = document.createElement('option');
  opt.value = fam; // letter form
  const heuristic = self._config.schema?.getHeuristicFamily(field);
  const heuristicLetter = heuristic ? toLetter(heuristic) : 'A';
  opt.textContent = fam === heuristicLetter
    ? `${LATCH_LABELS[fam]} (default)`
    : LATCH_LABELS[fam];
  opt.selected = getLatchFamily(field) === fam;
  select.appendChild(opt);
}
select.addEventListener('change', () => {
  self._handleFamilyChange(field, select.value as LatchFamily);
});
chipWrapper.appendChild(select);
row.appendChild(chipWrapper);
```

### Persistence: save overrides

```typescript
// Source: NotebookExplorer.ts pattern (bridge.send ui:set)
private async _persistOverrides(): Promise<void> {
  const overridesRecord: Record<string, string> = {};
  for (const [field, family] of this._schema!.getOverrides()) {
    overridesRecord[field] = family;
  }
  await this._config.bridge!.send('ui:set', {
    key: 'latch:overrides',
    value: JSON.stringify(overridesRecord),
  });
}
```

### Restore at Boot (main.ts or WorkbenchShell)

```typescript
// After await bridge.isReady — schema already populated
const overridesRow = await bridge.send('ui:get', { key: 'latch:overrides' });
if (overridesRow.value) {
  const parsed = JSON.parse(overridesRow.value) as Record<string, SchemaLatchFamily>;
  schemaProvider.setOverrides(new Map(Object.entries(parsed)));
}
const disabledRow = await bridge.send('ui:get', { key: 'latch:disabled' });
if (disabledRow.value) {
  const parsed = JSON.parse(disabledRow.value) as string[];
  schemaProvider.setDisabled(new Set(parsed));
}
```

---

## Open Questions

1. **Where does the `bridge` reference live for PropertiesExplorer persistence?**
   - What we know: PropertiesExplorer config currently has `alias`, `container`, `onCountChange`, `schema`. It does NOT have `bridge`.
   - What's unclear: Should `bridge` be added to `PropertiesExplorerConfig`, or should a callback pattern (e.g., `onOverrideChange`) be used so the caller (WorkbenchShell) handles persistence?
   - Recommendation: Add `bridge?: WorkerBridgeLike` to `PropertiesExplorerConfig` (same pattern as other explorers receive optional dependencies). WorkbenchShell already has a bridge reference and wires all explorers.

2. **How does LatchExplorers handle a field moving between LATCH families?**
   - What we know: LatchExplorers builds per-family sections (chip groups, time presets, histograms) at `mount()` time. `_getFieldsForFamily()` is called at mount, not at `update()`.
   - What's unclear: Is a full `destroy()` + `mount()` acceptable as the response to override change, or must partial section rebuild be supported?
   - Recommendation: Full destroy + remount is acceptable. Override changes are rare (user-initiated, not data-driven). The SchemaProvider subscriber that WorkbenchShell wires to LatchExplorers can call `latchExplorers.destroy(); latchExplorers.mount(container)` on schema change triggered by an override. CollapsibleSection collapse state is persisted to localStorage so it survives.

3. **Does ProjectionExplorer need explicit wiring changes?**
   - What we know: DYNM-06 migrated ProjectionExplorer to read from `schemaProvider.getAxisColumns()`. If `getAxisColumns()` now filters disabled fields, ProjectionExplorer inherits the change automatically.
   - What's unclear: Whether ProjectionExplorer holds a cached copy of fields at mount time (like PropertiesExplorer's `_columns[].fields`) or reads fresh from SchemaProvider on every render.
   - Recommendation: Inspect `ProjectionExplorer.ts` during implementation. If it caches, add a SchemaProvider subscriber. If it reads fresh on each `update()`, it works automatically.

---

## Integration Map

```
boot sequence (main.ts / WorkbenchShell)
  └── await bridge.isReady
      └── schemaProvider.initialize(schema)     [PRAGMA results, no overrides yet]
      └── restore latch:overrides from ui_state → schemaProvider.setOverrides()
      └── restore latch:disabled from ui_state  → schemaProvider.setDisabled()
          └── schemaProvider._scheduleNotify()
              ├── PropertiesExplorer subscriber  → _rebuildColumnFields() + _renderColumns()
              ├── LatchExplorers subscriber      → destroy() + mount() [if needed]
              └── ProjectionExplorer subscriber  → update()

user changes family assignment (PropertiesExplorer chip select)
  └── _handleFamilyChange(field, newFamily)
      └── schemaProvider.setOverrides(updated map)  → notifies all subscribers
      └── bridge.send('ui:set', { key: 'latch:overrides', value: JSON })

user disables field (PropertiesExplorer checkbox)
  └── _handleToggle(field)
      └── schemaProvider.setDisabled(updated set)   → notifies all subscribers
      └── FilterProvider.removeFilter() for any active filters on field
      └── bridge.send('ui:set', { key: 'latch:disabled', value: JSON })

user clicks "Reset all LATCH mappings"
  └── window.confirm("Reset N custom mappings to defaults?")
      └── schemaProvider.setOverrides(new Map())    → notifies all subscribers
      └── bridge.send('ui:set', { key: 'latch:overrides', value: '{}' })

user clicks "Enable all"
  └── schemaProvider.setDisabled(new Set())         → notifies all subscribers
  └── bridge.send('ui:set', { key: 'latch:disabled', value: '[]' })
```

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — SchemaProvider.ts, latch.ts, PropertiesExplorer.ts, LatchExplorers.ts, ui-state.handler.ts, NotebookExplorer.ts, FilterProvider.ts
- .planning/REQUIREMENTS.md — UCFG-01..05 requirements verbatim
- .planning/phases/73-user-configurable-latch-mappings/73-CONTEXT.md — locked user decisions

### No External Sources Required
This phase is entirely within the existing codebase. All patterns, APIs, and integration points were verified by reading the actual source files. No external library research was needed.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing project patterns, zero new dependencies
- Architecture: HIGH — SchemaProvider override layer is the natural insertion point, confirmed by reading all consumer call paths
- Pitfalls: HIGH — identified from direct inspection of where fields are cached at mount time vs read dynamically

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable codebase; all findings based on source inspection, not training data)
