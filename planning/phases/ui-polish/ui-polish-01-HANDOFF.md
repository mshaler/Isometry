# Isometry UI Polish — CC Handoff
**Date:** 2026-03-15  
**Source:** Codex external review (UI-IMPROVEMENTS-REVIEW.md), arbitrated and grounded in source by Claude  
**Scope:** 6 targeted UI improvements across correctness, accessibility, and polish  
**Execution order:** Work areas are numbered in dependency order. Complete and verify each before starting the next.

---

## Context and Constraints

These are surgical fixes to the live web layer. The following architectural rules apply to every work area and are non-negotiable:

- No new provider singletons or global state. All state flows through existing providers.
- No changes to the Worker boundary (`worker/protocol.ts`, `WorkerBridge.ts`) except what is explicitly specified.
- `SuperGrid._fetchAndRender()` is the single query entrypoint — do not introduce secondary query paths.
- All tests use behavioral assertions. No pixel snapshots. No mock leakage across tests.
- The `SuperGridProviderLike` and `SuperGridDensityLike` interfaces in `src/views/types.ts` are the authoritative contracts for what SuperGrid can see. Do not reach around them.

---

## Work Area 1 — Wire `aggregation` and `displayField` into `superGridQuery`

**Priority:** P1 — correctness gap  
**Files:** `src/views/types.ts`, `src/views/SuperGrid.ts`, tests

### Problem

`ProjectionExplorer` exposes Aggregation and Display Field controls that write to `PAFVProvider` and `SuperDensityProvider` respectively. `SuperGridQuery` already has typed `aggregation` and `displayField` fields (Phase 55, lines 103–114 of `SuperGridQuery.ts`). But `_fetchAndRender()` never reads or passes them — the query always runs with default `'count'`/`'name'` regardless of what the user selected in the UI.

### Root cause (two separate issues)

**1. `displayField`** → already reachable via `this._densityProvider.getState().displayField` (it is part of `SuperDensityState`). It is simply not spread into the `superGridQuery(...)` call at line 1369. One-line fix.

**2. `aggregation`** → NOT currently reachable from SuperGrid. It lives on `PAFVProvider.getAggregation()` (confirmed at `PAFVProvider.ts:592`), but SuperGrid holds `_provider: SuperGridProviderLike` and that interface has no `getAggregation()` method. Requires extending the interface first.

### Fix — Step 1: Extend `SuperGridProviderLike` in `src/views/types.ts`

```typescript
export interface SuperGridProviderLike {
  // ... all existing methods unchanged ...

  /** Phase 55 PROJ-06 — aggregation mode for Z-plane computation.
   *  PAFVProvider.getAggregation() satisfies this. */
  getAggregation(): AggregationMode;
}
```

`AggregationMode` is already imported in `src/views/types.ts` (line 124). No new imports needed.

### Fix — Step 2: Update the no-op density stub in `SuperGrid.ts`

The `_noOpDensityProvider` constant (around line 84) needs `displayField: undefined` in its `getState()` return so it continues to satisfy the full `SuperDensityState` shape:

```typescript
const _noOpDensityProvider: SuperGridDensityLike = {
  getState: () => ({
    axisGranularity: null,
    hideEmpty: false,
    viewMode: 'matrix' as const,
    regionConfig: null,
    displayField: undefined,   // add this
  }),
  setGranularity: () => {},
  setHideEmpty: () => {},
  setViewMode: () => {},
  subscribe: () => () => {},
};
```

### Fix — Step 3: Read and spread in `_fetchAndRender()`

Add a `projectionOpt` spread immediately after the existing `searchTermOpt` pattern (around line 1368), before the `Promise.all(...)` call:

```typescript
// Phase 55 PROJ-05/06 — aggregation and display field from provider state.
// Only spread when aggregation is non-default: SuperGridQuery.ts:222 treats
// undefined/absent as 'count', so we omit the spread for the default case
// to preserve backward compat with all existing tests.
const projectionOpt: { aggregation?: AggregationMode; displayField?: AxisField } = {};
const aggregation = this._provider.getAggregation();
if (aggregation !== 'count') {
  projectionOpt.aggregation = aggregation;
  const displayField = densityState.displayField;
  if (displayField) projectionOpt.displayField = displayField;
}

const [cells, calcResult] = await Promise.all([
  this._bridge.superGridQuery({
    colAxes,
    rowAxes,
    where,
    params,
    granularity: densityState.axisGranularity,
    sortOverrides: this._sortState.getSorts(),
    ...searchTermOpt,
    ...schemaMetaOpt,
    ...projectionOpt,   // ← add this spread
  }),
  this._bridge.calcQuery({
    // calcQuery unchanged
  }),
]);
```

### Fix — Step 4: Verify `PAFVProvider.setAggregation()` notifies StateCoordinator

Check `PAFVProvider.ts` around line 603. `setAggregation()` must call `this._scheduleNotify()` after mutating `this._state.aggregation`. If it does not, `_fetchAndRender()` won't fire when the aggregation select changes and the UI control will appear to have no effect. Add the notify call if absent.

### Tests to add

```typescript
it('passes aggregation=sum from provider into superGridQuery', async () => {
  // Arrange: provider.getAggregation() returns 'sum'
  // Act: trigger _fetchAndRender()
  // Assert: bridge.superGridQuery was called with aggregation: 'sum'
});

it('passes displayField from densityState when aggregation is non-count', async () => {
  // Arrange: provider.getAggregation() returns 'sum'
  //          densityProvider.getState() returns { displayField: 'priority', ... }
  // Assert: bridge.superGridQuery called with displayField: 'priority'
});

it('omits aggregation/displayField spread when aggregation is count (default)', async () => {
  // Arrange: provider.getAggregation() returns 'count' (default)
  // Assert: bridge.superGridQuery called WITHOUT aggregation or displayField keys
});
```

### Success criteria

- [ ] Changing Aggregation select in ProjectionExplorer visibly changes SuperGrid cell values
- [ ] Changing Display Field select changes which column is aggregated for non-count modes
- [ ] All three new tests pass
- [ ] TypeScript compiles clean — no-op stub satisfies `SuperGridDensityLike`, PAFVProvider satisfies `SuperGridProviderLike`
- [ ] All existing SuperGrid tests pass (the `projectionOpt` spread is a no-op for default state)

---

## Work Area 2 — Fix `:has()` behavioral dependency in `LatchExplorers`

**Priority:** P2 (elevated to fix now) — runtime correctness risk in WKWebView  
**Files:** `src/ui/LatchExplorers.ts`, `src/styles/workbench.css`

### Problem

Two uses of `:has()` in the codebase:

**1. `LatchExplorers.ts:695` — behavioral (fix now):** Uses `:has(button[data-field="..."])` to query the DOM for the presets container belonging to a specific time field. WKWebView on macOS 12 / iOS 15 (the deployment minimum) has incomplete `:has()` support. If this fails silently, the preset active-state UI breaks with no error.

**2. `workbench.css:125` — layout (add fallback):** Uses `:has(> .properties-explorer)` etc. to override `max-height` on collapsible section bodies during open/close animation. Degrades more gracefully (wrong animation height, not broken functionality), but still warrants a class-based fallback.

### Fix — `LatchExplorers.ts` (behavioral, must fix)

At mount time, when rendering each time-field presets container, add a `data-time-field` attribute directly to the container element:

```typescript
// When creating the presets container (find the mount site for .latch-time-presets):
presetsContainer.dataset['timeField'] = field;
// equivalent: presetsContainer.setAttribute('data-time-field', field);
```

Then replace the `:has()` DOM query at line ~695:

```typescript
// Before:
const presetsContainer = this._rootEl.querySelector(
  `.latch-time-presets:has(button[data-field="${field}"])`
) as HTMLElement | null;

// After:
const presetsContainer = this._rootEl.querySelector(
  `.latch-time-presets[data-time-field="${field}"]`
) as HTMLElement | null;
```

### Fix — `workbench.css` (layout, add class-based primary rule)

When each explorer mounts into its section body, `WorkbenchShell` (or the explorer itself) should add the class `collapsible-section__body--has-explorer` to the `.collapsible-section__body` element. This class becomes the primary max-height rule; the `:has()` rule is kept but demoted to progressive enhancement only:

```css
/* Primary rule — class-based, always works: */
.collapsible-section__body--has-explorer {
  max-height: 2000px;
}

/* Progressive enhancement only — keep but not load-bearing: */
.collapsible-section__body:has(> .properties-explorer),
.collapsible-section__body:has(> .projection-explorer),
.collapsible-section__body:has(> .latch-explorers),
.collapsible-section__body:has(> .notebook-explorer),
.collapsible-section__body:has(> .calc-explorer) {
  max-height: 2000px;
}
```

Set the class in `WorkbenchShell.ts` after appending each explorer's root element to the section body:

```typescript
sectionBody.classList.add('collapsible-section__body--has-explorer');
```

### Tests

```typescript
it('finds time presets container by data-time-field attribute without :has()', () => {
  // Mount a time field section
  // Assert: presetsContainer is found via [data-time-field] selector
  // Assert: UI updates correctly when preset is activated
});
```

### Success criteria

- [ ] No `:has()` in any behavioral JS/TS code path
- [ ] `_syncTimePresetUI()` (or equivalent) correctly finds preset containers
- [ ] Collapsible section max-height works via class even if `:has()` CSS is stripped
- [ ] All existing LATCH explorer and filter tests pass unmodified

---

## Work Area 3 — Replace `alert`/`confirm` with in-app dialog primitive

**Priority:** P1 UX  
**Files:** `src/ui/CommandBar.ts` (line 136), `src/ui/PropertiesExplorer.ts` (line 468), `src/main.ts` (line 793), new `src/ui/AppDialog.ts`, new `src/styles/app-dialog.css`

### Problem

Three call sites use native browser blocking dialogs that break the NeXTSTEP visual language and block the JS thread:
- `CommandBar.ts:136` → `alert('Isometry v5\nLocal-first...')`
- `PropertiesExplorer.ts:468` → `window.confirm(...)`
- `main.ts:793` → `confirm(...)`

### New file: `src/ui/AppDialog.ts`

Lightweight imperative dialog, pure DOM, no framework. Single public API, self-cleaning:

```typescript
export interface AppDialogOptions {
  title: string;
  message: string;
  /** 'info' = single OK button. 'confirm' = Cancel + Confirm buttons. */
  variant: 'info' | 'confirm';
  confirmLabel?: string;  // default: 'Confirm'
  cancelLabel?: string;   // default: 'Cancel'
}

/**
 * Show a non-blocking in-app dialog. Returns a Promise:
 *   - 'info'    → resolves true on OK, false on Escape/backdrop
 *   - 'confirm' → resolves true on Confirm, false on Cancel/Escape/backdrop
 */
export const AppDialog = {
  show(options: AppDialogOptions): Promise<boolean> { /* ... */ }
};
```

Implementation requirements:
- Use a native `<dialog>` element (supported in all WKWebView targets, accessible by default)
- Append to `document.body`; remove self on resolution
- Trap focus inside (Tab/Shift-Tab cycle between interactive elements only)
- Escape key → resolves `false`
- Backdrop click → resolves `false`
- Apply CSS variables from `design-tokens.css` for theming

### New file: `src/styles/app-dialog.css`

Minimal styles using existing CSS variables. Import in `AppDialog.ts`. Example structure:

```css
.app-dialog-backdrop { /* overlay */ }
.app-dialog { /* panel */ }
.app-dialog__title { /* heading */ }
.app-dialog__message { /* body text */ }
.app-dialog__actions { /* button row */ }
.app-dialog__btn { /* shared button base */ }
.app-dialog__btn--confirm { /* primary action */ }
.app-dialog__btn--cancel { /* secondary action */ }
```

### Migration of call sites

**`CommandBar.ts:136`** — the About action (sync context, fire-and-forget):
```typescript
// Before:
alert('Isometry v5\nLocal-first polymorphic data projection platform');

// After:
void AppDialog.show({
  variant: 'info',
  title: 'About Isometry',
  message: 'Version 5 — Local-first polymorphic data projection platform',
});
```

**`PropertiesExplorer.ts:468`** — `_handleResetAll()` must become async:
```typescript
// Before:
private _handleResetAll(): void {
  const count = this._config.schema?.getOverrides().size ?? 0;
  if (count === 0) return;
  if (!window.confirm(`Reset ${count} custom mapping${count > 1 ? 's' : ''} to defaults?`)) return;
  // ...

// After:
private async _handleResetAll(): Promise<void> {
  const count = this._config.schema?.getOverrides().size ?? 0;
  if (count === 0) return;
  const confirmed = await AppDialog.show({
    variant: 'confirm',
    title: 'Reset Mappings',
    message: `Reset ${count} custom mapping${count > 1 ? 's' : ''} to defaults?`,
    confirmLabel: 'Reset',
  });
  if (!confirmed) return;
  this._config.schema!.setOverrides(new Map());
  void this._persistOverrides();
}
```

Update the button's event listener to `() => { void this._handleResetAll(); }`.

**`main.ts:793`** — inside the `bridge.importFile` override (already async context):
```typescript
// Before:
const clearIt = confirm('You have sample data loaded. Clear it before importing?');

// After:
const clearIt = await AppDialog.show({
  variant: 'confirm',
  title: 'Sample Data',
  message: 'You have sample data loaded. Clear it before importing?',
  confirmLabel: 'Clear and Import',
  cancelLabel: 'Keep Sample Data',
});
```

### Tests

```typescript
it('AppDialog.show resolves true when Confirm clicked', async () => { /* ... */ });
it('AppDialog.show resolves false when Escape pressed', async () => { /* ... */ });
it('AppDialog.show resolves false when Cancel clicked', async () => { /* ... */ });
it('dialog element is removed from DOM after resolution', async () => { /* ... */ });
```

### Success criteria

- [ ] Zero `alert()` or `confirm()` calls anywhere in `src/`
- [ ] All three migrated call sites use `AppDialog`
- [ ] Dialog is keyboard-navigable: Tab cycles focus, Enter activates focused button, Escape dismisses
- [ ] Dialog uses CSS variables and is visually consistent with current theme
- [ ] All four unit tests pass

---

## Work Area 4 — Keyboard navigation for `CommandBar` menu and `ViewTabBar`

**Priority:** P1 accessibility  
**Files:** `src/ui/CommandBar.ts`, `src/ui/ViewTabBar.ts`

### Problem

**`CommandBar`:** Declares `role="menu"` on the dropdown but `_onDocumentKeydown` only handles `Escape`. A keyboard user can open the menu but cannot navigate or activate items — arrow keys do nothing.

**`ViewTabBar`:** Declares `role="tablist"` and `role="tab"` on each button but only wires click handlers. `ArrowLeft`/`ArrowRight` switching (the expected ARIA `tablist` keyboard pattern) is absent.

### Fix — `CommandBar.ts`: Roving tabindex menu navigation

Ensure `_createMenuItem()` sets `role="menuitem"` and `tabindex="-1"` on each item (add if not already present).

Add private helpers and extend `_onDocumentKeydown`:

```typescript
private _getMenuItems(): HTMLElement[] {
  return Array.from(
    this._dropdownEl?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
  );
}

private _focusItem(index: number): void {
  const items = this._getMenuItems();
  items.forEach((el, i) =>
    el.setAttribute('tabindex', i === index ? '0' : '-1')
  );
  items[index]?.focus();
}

private _moveFocus(delta: 1 | -1): void {
  const items = this._getMenuItems();
  const current = items.indexOf(document.activeElement as HTMLElement);
  const next = (current + delta + items.length) % items.length;
  this._focusItem(next);
}
```

In `_openDropdown()`, after showing the menu, focus the first item:
```typescript
const items = this._getMenuItems();
items.forEach((el, i) => el.setAttribute('tabindex', i === 0 ? '0' : '-1'));
items[0]?.focus();
```

Extend the `if (this._dropdownOpen)` block in `_onDocumentKeydown`:
```typescript
switch (e.key) {
  case 'Escape':
    this._closeDropdown();
    this._triggerEl?.focus();  // return focus to trigger
    break;
  case 'ArrowDown':
    e.preventDefault();
    this._moveFocus(1);
    break;
  case 'ArrowUp':
    e.preventDefault();
    this._moveFocus(-1);
    break;
  case 'Home':
    e.preventDefault();
    this._focusItem(0);
    break;
  case 'End':
    e.preventDefault();
    this._focusItem(this._getMenuItems().length - 1);
    break;
}
```

### Fix — `ViewTabBar.ts`: Arrow-key tab switching

Apply roving tabindex to tab buttons. Update `setActive()` to manage tabindex alongside the existing `aria-selected` logic:

```typescript
setActive(viewType: ViewType): void {
  const prevBtn = this._buttons.get(this._activeType);
  if (prevBtn) {
    prevBtn.classList.remove('view-tab--active');
    prevBtn.setAttribute('aria-selected', 'false');
    prevBtn.setAttribute('tabindex', '-1');        // add
  }
  const nextBtn = this._buttons.get(viewType);
  if (nextBtn) {
    nextBtn.classList.add('view-tab--active');
    nextBtn.setAttribute('aria-selected', 'true');
    nextBtn.setAttribute('tabindex', '0');         // add
  }
  this._activeType = viewType;
}
```

Also set initial tabindex on all buttons in the constructor (active tab = `0`, rest = `-1`). Then add a `keydown` listener on the `nav` element:

```typescript
this._el.addEventListener('keydown', (e: KeyboardEvent) => {
  const types = VIEW_LABELS.map((v) => v.type);
  const currentIndex = types.indexOf(this._activeType);

  let nextIndex: number | null = null;
  if (e.key === 'ArrowRight') {
    nextIndex = (currentIndex + 1) % types.length;
  } else if (e.key === 'ArrowLeft') {
    nextIndex = (currentIndex - 1 + types.length) % types.length;
  } else if (e.key === 'Home') {
    nextIndex = 0;
  } else if (e.key === 'End') {
    nextIndex = types.length - 1;
  }

  if (nextIndex !== null) {
    e.preventDefault();
    const nextType = types[nextIndex]!;
    config.onSwitch(nextType);
    this._buttons.get(nextType)?.focus();
  }
});
```

### Tests

```typescript
// CommandBar:
it('ArrowDown moves focus to next menu item', () => { /* ... */ });
it('ArrowUp wraps to last item when on first item', () => { /* ... */ });
it('Home focuses first menu item', () => { /* ... */ });
it('End focuses last menu item', () => { /* ... */ });
it('Escape closes menu and returns focus to trigger', () => { /* ... */ });

// ViewTabBar:
it('ArrowRight switches to next tab and focuses its button', () => { /* ... */ });
it('ArrowLeft wraps from first tab to last', () => { /* ... */ });
it('Home/End jump to first and last tabs', () => { /* ... */ });
it('active tab button has tabindex=0, others have tabindex=-1', () => { /* ... */ });
```

### Success criteria

- [ ] Keyboard-only user can open, navigate, and activate all CommandBar menu items
- [ ] Keyboard-only user can switch all ViewTabBar tabs using arrow keys
- [ ] Escape in menu returns focus to the trigger button
- [ ] Roving tabindex is correct at all times (exactly one `tabindex="0"` per component)
- [ ] All keyboard tests pass
- [ ] No regression to existing click-based tests

---

## Work Area 5 — `HistogramScrubber` inline error state

**Priority:** P3  
**Files:** `src/ui/HistogramScrubber.ts`, adjacent CSS file for histogram styles

### Problem

`_fetchAndRender()` (line ~157) catches errors, logs to console, and falls through to `this._render([])`. A failed query renders an empty histogram — visually identical to a legitimately empty dataset. Degradation is invisible to the user and to a developer watching the UI.

### Fix

Add a private `_errorEl: HTMLElement | null = null` field. Replace the silent `_render([])` fallback with a `_showError()` method that renders an inline error with a Retry button:

```typescript
private _errorEl: HTMLElement | null = null;

private _showError(message: string): void {
  this._render([]);  // clear any stale chart

  if (!this._errorEl) {
    const el = document.createElement('div');
    el.className = 'histogram-scrubber__error';

    const msg = document.createElement('span');
    msg.className = 'histogram-scrubber__error-msg';
    el.appendChild(msg);

    const retryBtn = document.createElement('button');
    retryBtn.className = 'histogram-scrubber__retry';
    retryBtn.textContent = 'Retry';
    retryBtn.type = 'button';
    retryBtn.addEventListener('click', () => {
      this._clearError();
      void this._fetchAndRender();
    });
    el.appendChild(retryBtn);

    this._wrapperEl?.appendChild(el);
    this._errorEl = el;
  }

  const msgEl = this._errorEl.querySelector('.histogram-scrubber__error-msg');
  if (msgEl) msgEl.textContent = message;
  this._errorEl.style.display = '';
}

private _clearError(): void {
  if (this._errorEl) this._errorEl.style.display = 'none';
}
```

Update `_fetchAndRender()`:

```typescript
try {
  // ... existing fetch logic ...
  this._clearError();          // clear any previous error on success
  this._bins = response.bins;
  this._render(response.bins);
} catch (err) {
  console.error(`[HistogramScrubber] ${field} (${fieldType}):`, err);
  this._showError('Failed to load data');   // replaces: this._render([])
}
```

Add CSS in the adjacent histogram/latch stylesheet:

```css
.histogram-scrubber__error {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  font-size: var(--font-size-sm);
  color: var(--color-error, #e53e3e);
}

.histogram-scrubber__retry {
  font-size: var(--font-size-sm);
  padding: 2px var(--space-sm);
  cursor: pointer;
  border: 1px solid currentColor;
  border-radius: 3px;
  background: transparent;
  color: inherit;
}
```

### Tests

```typescript
it('shows inline error element when histogram fetch fails', async () => {
  // Arrange: bridge rejects histogram:query
  // Assert: .histogram-scrubber__error is visible in the DOM
});

it('retry button triggers re-fetch and hides error on success', async () => {
  // Arrange: bridge rejects once, then resolves with bins
  // Act: click .histogram-scrubber__retry
  // Assert: error element hidden, bins rendered
});

it('successful fetch clears any previous error state', async () => {
  // Arrange: first fetch fails, second succeeds
  // Assert: .histogram-scrubber__error not visible after second fetch
});

it('empty dataset (zero bins, no error) does not show error element', async () => {
  // Arrange: bridge resolves with { bins: [] }
  // Assert: .histogram-scrubber__error absent or hidden
});
```

### Success criteria

- [ ] Failed histogram fetch shows visible inline error + Retry button
- [ ] Retry button triggers `_fetchAndRender()` and hides error on success
- [ ] Successful fetch (including empty bins) never shows the error element
- [ ] All four tests pass

---

## Work Area 6 — Replace `WorkbenchShell` stub strings with explicit section state

**Priority:** P3  
**Files:** `src/ui/WorkbenchShell.ts`

### Problem

`SECTION_CONFIGS` at line 33 embeds hardcoded `stubContent` strings for three sections that will have explorers mounted into them:

```typescript
{ title: 'Properties', ..., stubContent: 'Properties explorer coming soon' },
{ title: 'Projection', ..., stubContent: 'Projection explorer coming soon' },
{ title: 'LATCH',      ..., stubContent: 'LATCH explorer coming soon'       },
```

These strings appear if explorer mount ordering ever drifts, or if a mount silently fails — including during demos. The fundamental problem is that `stubContent` is being used as a placeholder for explorers that haven't mounted yet, when it should only exist for sections that are intentionally empty by design.

### Fix

Replace the `stubContent` placeholder pattern with an explicit section state model. Add a `setState(state: 'loading' | 'ready' | 'empty')` method to `CollapsibleSection` (or whatever component manages each section body):

- **`loading`** → neutral: blank or minimal spinner. No stub text.
- **`ready`** → explorer is mounted and visible: hide any loading UI.
- **`empty`** → intentionally unpopulated: show `emptyContent` message if provided in config.

Remove `stubContent` from the three explorer-backed section configs. Keep the field in `CollapsibleSectionConfig` as the optional `emptyContent` — used only for sections where an empty state is a legitimate permanent condition (none of the current three qualify):

```typescript
// Before:
const SECTION_CONFIGS: CollapsibleSectionConfig[] = [
  { title: 'Notebook',    icon: '📓', storageKey: 'notebook',    defaultCollapsed: true },
  { title: 'Properties',  icon: '🔧', storageKey: 'properties',  stubContent: 'Properties explorer coming soon' },
  { title: 'Projection',  icon: '📐', storageKey: 'projection',  stubContent: 'Projection explorer coming soon' },
  { title: 'LATCH',       icon: '🏷️', storageKey: 'latch',       stubContent: 'LATCH explorer coming soon'      },
  { title: 'Calc',        icon: 'Σ',  storageKey: 'calc',        defaultCollapsed: true },
];

// After:
const SECTION_CONFIGS: CollapsibleSectionConfig[] = [
  { title: 'Notebook',   icon: '📓', storageKey: 'notebook',   defaultCollapsed: true },
  { title: 'Properties', icon: '🔧', storageKey: 'properties' },  // loading until explorer mounts
  { title: 'Projection', icon: '📐', storageKey: 'projection' },  // loading until explorer mounts
  { title: 'LATCH',      icon: '🏷️', storageKey: 'latch'      },  // loading until explorer mounts
  { title: 'Calc',       icon: 'Σ',  storageKey: 'calc',        defaultCollapsed: true },
];
```

In `WorkbenchShell.ts`, after each explorer is appended to its section body, call `section.setState('ready')`. Before mount (at section creation time), call `section.setState('loading')` for the three explorer-backed sections.

Also add `collapsible-section__body--has-explorer` class to the section body at `setState('ready')` time (syncing with the Work Area 2 CSS fix):

```typescript
// When mounting Properties explorer:
propertiesSection.setState('loading');
// ... mount explorer into propertiesSection.body ...
propertiesSection.setState('ready');
propertiesSection.body.classList.add('collapsible-section__body--has-explorer');
```

### Tests

```typescript
it('Properties section shows loading state (no stub text) before explorer mounts', () => {
  // Assert: 'coming soon' text not present in DOM
  // Assert: loading indicator or blank body present
});

it('Properties section transitions to ready state after explorer mount', () => {
  // Act: call section.setState('ready')
  // Assert: loading UI gone, section body visible
});

it('ready state is stable after repeated provider notifications', () => {
  // Act: fire multiple subscriber callbacks after setState('ready')
  // Assert: stub text never reappears
});
```

### Success criteria

- [ ] Zero `'coming soon'` strings anywhere in `src/ui/WorkbenchShell.ts`
- [ ] Explorer sections show loading (not stub text) before mount
- [ ] `setState('ready')` called after each explorer mounts
- [ ] All three tests pass
- [ ] Existing WorkbenchShell and CollapsibleSection tests unaffected

---

## Permanent Out of Scope (this handoff)

| Item | Reason |
|---|---|
| Responsive media queries (`workbench.css`, `projection-explorer.css`, `visual-explorer.css`) | WKWebView viewport is Swift-controlled; web responsive layout is not a v3.0 concern |
| SuperGrid inline style extraction to CSS classes | Mid-v3.0 refactor risk against live rendering pipeline; schedule post-Phase 27 |
| D3.js or Worker boundary changes | Not required by any work area above |
| New providers or singleton state | All state flows through existing providers |
| `calcQuery` aggregation wiring | `calcQuery` uses its own per-field `aggregates` map (Phase 62 CALC-05); this is correct and separate from the Z-plane aggregation wired in Work Area 1 |

---

## Full Regression Gate

Run after all work areas are complete, before closing this handoff:

- [ ] `tsc --noEmit` — zero type errors
- [ ] Biome lint — zero new warnings
- [ ] Full Vitest suite — all existing tests pass
- [ ] All new tests from Work Areas 1–6 pass
- [ ] Manual smoke: change aggregation in ProjectionExplorer → SuperGrid values change
- [ ] Manual smoke: keyboard-only navigation through CommandBar menu and ViewTabBar
- [ ] Manual smoke: trigger histogram query failure → error + Retry shown → retry succeeds
