# Pitfalls Research

**Domain:** Adding Smart Defaults + Layout Presets + Guided Tour to Isometry (existing TypeScript/D3.js/sql.js platform)
**Researched:** 2026-03-27
**Confidence:** HIGH (derived from full Isometry codebase source analysis — StateManager, PAFVProvider, SchemaProvider, ViewManager, WorkbenchShell, CollapsibleSection — cross-referenced against prior pitfalls from v4.2, v5.3, v6.1, v9.0 milestones)

---

## Critical Pitfalls

### Pitfall 1: Default Configurations That Assume Columns Exist (Schema Mismatch)

**What goes wrong:**
A named preset like "Calendar Overview" hardcodes `colAxes: [{ field: 'due_date' }]` or `rowAxes: [{ field: 'assignee' }]`. When the user's active dataset is an alto-index contacts import (which has `email` and `name` but no `due_date`), the PAFVProvider `compile()` call succeeds (the allowlist is bypassed at the default-apply stage), but the SuperGridQuery GROUP BY produces zero rows or a SQL error. The view silently renders empty with no explanation.

**Why it happens:**
Developers test presets against the sample dataset that has all 26 schema fields. Real user datasets are narrow — a Calendar EventKit import has `start_date`/`end_date` but no `folder`; a Reminders import has `status` but no `card_type`. The current PAFVProvider `_getSupergridDefaults()` already handles the `card_type`/`folder` case via SchemaProvider introspection, but any *new* preset logic that hard-codes fields repeats the pre-v5.3 mistake that required replacing 15 hardcoded field lists.

**How to avoid:**
Every default axis assignment — whether applied at first-load, on dataset switch, or from a named preset — must route through `PAFVProvider._getSupergridDefaults()` or an equivalent schema-aware selector. The selector pattern is: `schemaProvider.isValidColumn(field, 'cards')` before using it; if invalid, fall back to `schemaProvider.getFieldsByFamily(family)[0]`. Named presets store *intent* (e.g., `{ intentFamily: 'Time', fallbackFamily: 'Category' }`) not hard-coded field names. The field resolution happens at apply-time using the live SchemaProvider.

**Warning signs:**
- Preset applies and SuperGrid renders with zero rows but no "empty state" message
- Console shows `validateAxisField()` errors thrown during preset restore
- A preset that works on the sample dataset silently produces wrong axes on a Reminders import

**Phase to address:**
Smart Defaults / Preset core phase — before any preset UI is built, the intent-over-field-name resolver must be written and tested with a Reminders-only schema (no `folder`, no `card_type`).

---

### Pitfall 2: Layout Preset Serialization That Breaks on Panel Addition

**What goes wrong:**
Preset serialization captures the current `CollapsibleSection` state as a flat array of `{ key: string; collapsed: boolean }`. When a new panel is added to `SECTION_CONFIGS` in WorkbenchShell (e.g., adding an "Insights" panel between "Projection" and "LATCH"), all stored presets have a gap — the new panel is not in any saved preset, and `restoreSectionStates()` applies the stored array by index rather than by key. Result: panels shift, "LATCH" becomes collapsed when "Projection" should be, and the new panel defaults to hidden regardless of what the preset intended.

**Why it happens:**
WorkbenchShell's existing `getSectionStates()` / `restoreSectionStates()` methods already handle session-level focus mode. If preset serialization reuses the same array-indexed approach, it inherits its fragility. Array position is load-bearing even though section keys are stable identifiers.

**How to avoid:**
Preset serialization must use `storageKey` as the dictionary key, not array index. `Record<string, boolean>` keyed by `storageKey`, not `Array<boolean>` keyed by position. `restoreSectionStates()` must ignore unknown keys (forward compat for sections added after the preset was saved) and preserve defaults for missing keys (backward compat for sections that didn't exist when the preset was saved). Write a migration test: serialize a preset with N panels, add one panel to `SECTION_CONFIGS`, deserialize — all original panels must restore correctly, new panel must use its `defaultCollapsed` value.

**Warning signs:**
- Adding a new section to `SECTION_CONFIGS` causes existing saved presets to open/collapse wrong panels
- "Restore preset" applies panel states correctly in tests but breaks after any `SECTION_CONFIGS` reorder
- `restoreSectionStates()` called with an array whose length doesn't match `this._sections.length`

**Phase to address:**
Layout preset serialization phase — establish the key-based format before any presets are saved to ui_state. Retrofitting from array-indexed to key-based format after users have saved presets requires a migration step.

---

### Pitfall 3: Provider Teardown Race When Applying a Preset During View Switch

**What goes wrong:**
User triggers "Apply Preset: Contacts Grid" while ViewManager is mid-way through `switchTo('supergrid', ...)`. The preset applies new `PAFVProvider` state (fires `_scheduleNotify()`), which causes `StateCoordinator` to emit a change notification. ViewManager's coordinator subscription fires `_fetchAndRender()` — but `currentView` is in a partial mount state (mount called, coordinator subscription not yet registered). The re-render runs against a partially initialized SuperGrid that has not yet received its first `mount()` call's `_attachCoordinatorSubscription()`, producing a DOM-write into an incomplete component tree.

**Why it happens:**
`PAFVProvider` notifies via `queueMicrotask` (batched, deferred) — the notification fires *after* the current synchronous execution block, including partway through a Promise-chained `switchTo()`. The existing `_fetchAndRender()` guard only checks `this.loadingTimer` for cancellation; it does not check whether `currentView` has completed mount.

**How to avoid:**
Preset application must check `viewManager.isSwitching()` (add a `_isSwitching` flag to ViewManager that is set at the top of `switchTo()` and cleared after mount completes). If switching is in progress, defer preset application via `queueMicrotask(() => applyPreset(preset))` — one extra microtask tick puts the application after the mount completes. Alternatively, the preset system can subscribe to `viewManager.onViewSwitch` and apply only after the switch fires. Never call `pafvProvider.setColAxes()` / `setRowAxes()` while a view switch is in progress.

**Warning signs:**
- Applying a preset during rapid view cycling causes a blank SuperGrid that only recovers on the next manual re-render
- `TypeError: Cannot read property 'update' of null` in SuperGrid update path during automated tests that apply presets mid-switch
- `_fetchAndRender()` is called but `this.currentView` is null at the time of the D3 data join

**Phase to address:**
Preset application phase — add `isSwitching` guard to ViewManager and include a test that calls `applyPreset()` concurrently with `switchTo()` to verify deferral behavior.

---

### Pitfall 4: Guided Tour Overlay Broken by View Switch (Tour State Lost)

**What goes wrong:**
The guided tour highlights a specific element (e.g., the ProjectionExplorer chip wells) by positioning an absolutely-positioned overlay or spotlight element relative to that element's `getBoundingClientRect()`. When the user switches views mid-tour (via keyboard shortcut, Play auto-cycle button, or SidebarNav), ViewManager calls `destroy()` on the current view and clears the container's innerHTML. The tour overlay is a child of `document.body` or `.workbench-shell` — it survives the DOM clear — but the element it was pointing to no longer exists, leaving the spotlight anchored to `{ top: 0, left: 0 }` or pointing to an invisible element.

**Why it happens:**
Tour overlays are typically positioned relative to live DOM nodes. The tour system holds a direct DOM reference to the highlighted element, which becomes detached after ViewManager wipes the view container. The tour step machine does not subscribe to view lifecycle events.

**How to avoid:**
Tour steps must be defined by *logical step ID* and *anchor selector*, not by live DOM reference. The tour engine must re-query the selector on each render/resize: `document.querySelector(step.anchorSelector)`. If the selector returns null (element destroyed), the tour must transition to a "waiting" state: hide the spotlight, show a persistent "Continue" indicator in a fixed safe zone (e.g., top-right corner), and resume when the selector becomes resolvable again. Subscribe to `viewManager.onViewSwitch` to trigger re-query on each view change.

**Warning signs:**
- Tour spotlight moves to top-left corner (0,0) after any view switch
- Clicking "Next" in the tour after a view switch throws `Cannot call getBoundingClientRect on null`
- Tour step targeting `.panel-rail .projection-explorer` breaks because WorkbenchShell rebuilt the panel on dataset eviction

**Phase to address:**
Guided tour phase — the selector-based positioning pattern and view-switch recovery must be built into the tour engine from day one. Retrofitting a DOM-reference-based tour to be re-query-based is a full rewrite.

---

### Pitfall 5: StateManager Preset Key Collision With Existing Provider Keys

**What goes wrong:**
Presets are stored in `ui_state` as JSON blobs, using a key like `preset:contacts` or `layouts`. Existing provider keys are `filter`, `pafv`, `density`, `latch:overrides`, `latch:disabled`, `notebook:{cardId}`. If the preset system uses a key that collides with an existing provider key — or if `StateManager.restore()` iterates all `ui_state` rows and tries to call `setState()` on a preset-format blob via a registered provider — the provider's `setState()` will receive malformed data, trigger the catch block, and reset to defaults, silently erasing the user's filter/axis state.

**Why it happens:**
`StateManager.restore()` is key-matched: it only calls `setState()` if a registered provider exists for the key. But if the preset serialization format uses the same key as a registered provider (e.g., `pafv` for a "default PAFV layout" preset), the provider's `setState()` receives preset-format data instead of provider-format data.

**How to avoid:**
All preset `ui_state` keys must use a namespaced prefix that cannot collide: `preset:name:{presetName}` or `preset:catalog`. Verify no existing `ui_state` key starts with `preset:`. Document the key namespace in StateManager's source comment. Add an assertion in `registerProvider()` that the key does not start with `preset:` (cross-contamination guard).

**Warning signs:**
- After loading a named preset, the FilterProvider resets to defaults unexpectedly
- `StateManager.restore()` logs "Failed to restore provider 'pafv': unexpected shape" after preset save
- `ui_state` contains rows with keys matching both a registered provider and a preset

**Phase to address:**
Preset persistence foundation phase — establish the namespaced key convention before any presets are written to ui_state.

---

### Pitfall 6: Default Provider Reinit Skipping SchemaProvider After Dataset Switch

**What goes wrong:**
When the user switches datasets (the v7.0 dataset eviction pipeline: `SchemaProvider.reNotify()` → `ProjectionExplorer.update()` → `LatchExplorers destroy+remount`), the new "smart default" logic fires to set initial axes for the new dataset. But it fires *before* `schemaProvider.initialize()` is called with the new dataset's schema (or before `reNotify()` propagates). The PAFVProvider `_getSupergridDefaults()` call returns the *old* schema's field list because `this._schema` has not been updated yet. The default axes reference columns that exist in the old dataset but not the new one.

**Why it happens:**
Dataset eviction in v7.0 calls `SchemaProvider.reNotify()` (which uses the existing schema, unchanged, since DDL is constant). But if smart defaults are triggered by the dataset switch event rather than by SchemaProvider subscription, the ordering dependency is invisible. Smart defaults must be downstream of SchemaProvider initialization, not co-scheduled with it.

**How to avoid:**
Smart default application must subscribe to `SchemaProvider.subscribe()` and only fire *after* SchemaProvider emits its notification. Never wire smart-default logic to the dataset-eviction event directly. The PAFVProvider `setSchemaProvider()` setter injection pattern already handles this: `_getSupergridDefaults()` checks `this._schema?.initialized` before using schema data. Extend this pattern to all new default-application code. If SchemaProvider is not yet initialized, return null/empty defaults and let the normal first-fetch populate axes.

**Warning signs:**
- Switching from a Reminders dataset to a Calendar dataset produces axes referencing `status` (Reminders field) in the Calendar view
- `validateAxisField()` throws on auto-applied defaults immediately after dataset switch
- PropertiesExplorer shows correct columns but Projection chips reference wrong fields

**Phase to address:**
Smart defaults phase — add an integration test that: (1) loads dataset A, (2) switches to dataset B, (3) asserts defaults use only dataset B's columns.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hard-code a few "known good" preset field names (e.g., `card_type`, `folder`) | Works immediately for sample data and most imports | Breaks silently on narrow-schema datasets (Reminders, Calendar, plain Markdown) | Never — schema-aware fallback is 10 LOC |
| Store preset panel states as `boolean[]` array | Simple serialization | Breaks on any SECTION_CONFIGS reorder or addition, requires migration | Never — key-based dict is same complexity |
| Attach tour overlay DOM reference once, reuse across steps | Avoids repeated querySelector | Crashes after view switch; tour recovery requires re-engineering | Never — selector-based pattern is required from day one |
| Apply a preset synchronously inside a `switchTo()` call | Simpler call site | Creates race between mid-mount state and provider notification | Never — always defer via `onViewSwitch` callback |
| Use a single `preset` key for all saved presets in ui_state | Simple to read/write | Overwriting the entire catalog on every save causes last-write-wins data loss if two tabs open | Only if single-window use is guaranteed |
| Skip the "preset intent" abstraction; store resolved field names directly | Saves one level of indirection | Every saved preset becomes stale when dataset changes; user loses preset value immediately | Only for a single-dataset demo |

---

## Integration Gotchas

Common mistakes when connecting presets/defaults/tour to the existing system.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| PAFVProvider + presets | Calling `setColAxes()` / `setRowAxes()` directly with field strings from preset JSON | Route through a schema-validation wrapper that calls `schemaProvider.isValidColumn()` before each assignment; drop or substitute invalid fields |
| StateManager + presets | Registering a `PresetProvider` as a Tier 2 provider via `registerProvider('pafv', presetProvider)` | Use a namespaced key (`preset:catalog`) and read/write directly via `bridge.send('ui:set', ...)` outside of StateManager; presets are not the same lifecycle as provider state |
| WorkbenchShell + presets | Calling `shell.restoreSectionStates(preset.sections)` which internally maps by index | Extend `restoreSectionStates()` to accept `Record<string, SectionState>` keyed by `storageKey`; or add `restorePresetSections(map: Record<string, boolean>)` overload |
| Guided tour + ViewManager | Positioning tour tooltip in `mount()` before `getBoundingClientRect()` is valid (element not yet painted) | Use `requestAnimationFrame(() => positionTip())` after mount; or use IntersectionObserver on the anchor element to defer positioning until visible |
| Tour + WKWebView | Using `document.fullscreenElement` or `window.screen` APIs for overlay sizing | WKWebView may not have the same viewport/fullscreen APIs as a browser; use `document.documentElement.clientWidth/Height` for safe sizing |
| Smart defaults + FilterProvider | Setting default filter values alongside default axis values in the same preset | FilterProvider and PAFVProvider have separate `setState()` calls and separate `ui_state` keys; they must be restored in the correct order (filter before axis) to avoid triggering unnecessary re-queries |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Applying a preset triggers separate PAFVProvider + FilterProvider + DensityProvider notifications in sequence | 3 re-queries per preset apply; visible triple-flash on SuperGrid | Batch all provider mutations under a `StateCoordinator.pauseNotifications()` wrapper (or apply all state changes before any provider fires its subscriber) | Every preset apply — visible at any dataset size |
| Preset catalog stored as one large JSON blob per write | With 20+ presets, `ui:set` writes 50KB JSON on every preset rename | Store each preset as a separate `ui_state` row with key `preset:name:{id}`; write only the changed preset | When preset catalog exceeds ~10 entries |
| Tour highlights computed via `getBoundingClientRect()` on every `mousemove` to track dynamic panel resizing | 60fps layout thrash on the main thread | Compute only on `ResizeObserver` callbacks, not on mouse events; cache the computed position | As soon as any panel has resize-drag active |
| Named preset thumbnail renders a mini SuperGrid to generate a preview image | Blocks main thread for thumbnail generation on preset gallery open | Defer thumbnails to `requestIdleCallback`; or use CSS-only visual representations (color swatches + field name chips) instead of live renders | Any dataset over 1K cards |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Preset names are system-generated IDs (`preset_1`, `preset_2`) with no user renaming | Users cannot distinguish presets; they stop using the feature | Require a name on first save; inline-edit name in preset list (same pattern as AliasProvider inline rename in PropertiesExplorer) |
| "Apply Preset" immediately overwrites current axis/filter/panel state with no undo | Users accidentally destroy carefully configured views | MutationManager-style undo: capture current state snapshot before applying preset; register as an undoable mutation with `Cmd+Z` restore |
| Tour advances automatically on a timer regardless of whether the user has interacted | User misses a step because tour moved forward while they were exploring | Step advance is always user-initiated (Next button or explicit interaction); timer-advance is an anti-pattern for a power tool |
| Tour blocks access to the Workbench during steps | Power users feel babied; they cannot interact while touring | Tour is non-blocking; all steps are dismissible with Escape; "resume tour" available from CommandPalette after dismiss |
| Smart defaults always apply card_type/folder axes even when user has configured a dataset-specific projection | User's custom configuration is overwritten every time they switch datasets | Smart defaults only apply when the current PAFV state is *empty* (no colAxes, no rowAxes) or when the user explicitly requests "Reset to defaults"; never overwrite existing user configuration |
| Preset gallery is a modal that blocks the app while the user browses | Users cannot see live data while choosing a preset | Preset picker is a non-modal panel section (CollapsibleSection pattern); preview shows field names, not live render |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Smart defaults:** Works with sample data — verify with a Reminders-only import (no `folder`, no `card_type`) and a plain Markdown import (only `title`, `content`, `source`) before declaring done
- [ ] **Named presets:** Saves and restores locally — verify that a saved preset survives: (a) adding a new CollapsibleSection to SECTION_CONFIGS, (b) switching datasets, (c) Worker re-init after WKWebView process termination
- [ ] **Guided tour:** Highlights correct elements on first render — verify tour step positioning after: (a) mid-tour view switch, (b) WorkbenchShell panel resize via drag, (c) panel collapse/expand toggling the anchor element's height
- [ ] **Preset serialization:** Reads back correctly — verify `JSON.parse(JSON.stringify(preset))` round-trip for every preset field; verify that a preset written by version N is accepted by version N+1 with a new panel added
- [ ] **Undo for preset apply:** `Cmd+Z` restores previous state — verify that the restored state is a deep copy (not an alias of the preset's stored state object) to prevent preset mutations from affecting the undo history
- [ ] **Tour in WKWebView:** Spotlight positioned correctly — verify on physical device (not just jsdom/browser) because WKWebView viewport dimensions and scroll behavior differ from Chrome

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Preset with invalid fields applied (schema mismatch) | LOW | `PAFVProvider.resetToDefaults()` re-runs schema-aware default selection; add validation wrapper to preset apply path going forward |
| Preset serialization broke on SECTION_CONFIGS change (array-indexed) | MEDIUM | Write a one-time `ui_state` migration: read all `preset:*` keys, convert array-indexed sections to key-indexed format, re-write; add format version field to preset schema |
| Tour DOM reference broken after view switch | LOW | Soft-reset tour to current step (re-query selector); if selector still null, advance to next step with a warning log |
| Provider teardown race caused blank SuperGrid after preset apply | MEDIUM | Detect via `currentView === null` guard in `_fetchAndRender()`; force a full `switchTo()` re-mount to recover; add `isSwitching` flag to prevent recurrence |
| `preset:` key collides with provider key in ui_state | MEDIUM | Rename conflicting preset key with a one-time migration; StateManager `registerProvider()` assertion prevents future collisions |
| Smart defaults overwrote user's custom dataset configuration | MEDIUM | MutationManager undo (if preset apply is registered as undoable mutation); add "apply only when axes empty" guard to prevent recurrence |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Default configurations assume columns exist | Smart defaults foundation phase | Integration test: apply defaults with Reminders-only schema; assert no `validateAxisField()` errors; assert axes use only columns in schema |
| Layout preset serialization breaks on panel addition | Preset serialization phase | Snapshot test: serialize preset with N panels, add 1 panel to SECTION_CONFIGS, deserialize, assert all original panels correct |
| Provider teardown race during preset apply + view switch | Preset application phase | Concurrent test: call `applyPreset()` and `switchTo()` simultaneously; assert no blank render, no null dereference |
| Guided tour overlay broken by view switch | Tour engine phase | Integration test: start tour on step 2, call `viewManager.switchTo('list')`, assert tour enters waiting state, assert resumes on view return |
| StateManager preset key collision | Preset persistence foundation phase | Unit test: register provider with key `filter`, attempt to write preset key `filter` to ui_state, assert guard fires |
| Default provider reinit skipping SchemaProvider after dataset switch | Smart defaults phase | Integration test: load dataset A → switch to dataset B → assert PAFVProvider defaults use only dataset B columns |

---

## Sources

- Isometry `src/providers/PAFVProvider.ts` — `_getSupergridDefaults()` schema-aware fallback pattern (v5.3); VIEW_DEFAULTS hard-coded field precedent
- Isometry `src/providers/StateManager.ts` — `_migrateState()` key-based routing, `restore()` catch-and-reset pattern; key namespace design
- Isometry `src/providers/SchemaProvider.ts` — `initialize()` idempotence, `reNotify()` dataset-switch pattern, `_graphMetricColumns` injection precedent
- Isometry `src/views/ViewManager.ts` — `switchTo()` destroy-before-mount guarantee, `_isSwitching` absence (current gap), `loadingTimer` cancellation pattern
- Isometry `src/ui/WorkbenchShell.ts` — `SECTION_CONFIGS` static array, `getSectionStates()` / `restoreSectionStates()` existing session-state pattern
- Isometry `src/providers/FilterProvider.ts` + `src/providers/PAFVProvider.ts` — separate provider state keys; ordering dependency on restore
- Isometry `.planning/MVP-GAP-ANALYSIS.md` — onboarding gap context; welcome sheet vs. guided tour decision
- Isometry `.planning/SHIP-HARDENING-HANDOFF.md` — WA-06 first-run welcome sheet spec; WKWebView environment constraints
- Isometry `MEMORY.md` — v5.3 SchemaProvider: "all 15 hardcoded field lists replaced"; v4.2: ViewManager stale timer race condition fix; v8.4: ViewZipper removed; dataset eviction pipeline (v7.0)
- Prior milestone pitfalls: graph algorithm render token (v9.0 PITFALLS.md), ViewManager stale timer (v4.2 bug fix), PAFVProvider default axis schema-awareness (v5.3 SCHM requirement)

---
*Pitfalls research for: Smart Defaults + Layout Presets + Guided Tour added to existing Isometry platform*
*Researched: 2026-03-27*
