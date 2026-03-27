# Architecture Research

**Domain:** Smart Defaults + Layout Presets + Guided Tour — v10.0 milestone integration
**Researched:** 2026-03-27
**Confidence:** HIGH (full codebase read, confirmed against existing patterns)

---

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                           Main Thread (UI)                                    │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────┐  ┌───────────────────────┐  ┌──────────────────────┐ │
│  │  ViewDefaultsRegistry│  │  LayoutPresetManager  │  │  TourEngine          │ │
│  │  (NEW)               │  │  (NEW)                │  │  (NEW)               │ │
│  │  dataset_type →      │  │  swap panel sections  │  │  annotate DOM,       │ │
│  │  {view, pafv config} │  │  + pafv config        │  │  advance steps       │ │
│  └──────────┬───────────┘  └──────────┬────────────┘  └──────────┬───────────┘ │
│             │                         │                           │            │
│  ┌──────────▼─────────────────────────▼─────────────────────────▼───────────┐ │
│  │                      Provider Layer                                       │ │
│  │  PAFVProvider (MODIFIED — applyDefaults())                                │ │
│  │  FilterProvider │ SchemaProvider │ StateManager (MODIFIED — loadPreset()) │ │
│  │  SuperDensityProvider │ AliasProvider │ SelectionProvider                 │ │
│  └──────────┬──────────────────────────────────────────────────────────────┘  │
│             │                                                                  │
│  ┌──────────▼──────────────────────────────────────────────────────────────┐  │
│  │  WorkbenchShell (MODIFIED — presetSectionOrder())                        │  │
│  │  CollapsibleSection[] — section ordering and default collapsed states    │  │
│  └──────────┬──────────────────────────────────────────────────────────────┘  │
│             │                                                                  │
│  ┌──────────▼──────────────────────────────────────────────────────────────┐  │
│  │  ViewManager (MODIFIED — applyViewDefaults() after switchTo())           │  │
│  └──────────┬──────────────────────────────────────────────────────────────┘  │
│             │                                                                  │
│  ┌──────────▼──────────────────────────────────────────────────────────────┐  │
│  │  WorkerBridge (singleton)                                                │  │
│  │  Typed messages, correlation IDs, rAF coalescing                        │  │
│  └──────────┬──────────────────────────────────────────────────────────────┘  │
└─────────────┼──────────────────────────────────────────────────────────────────┘
              │ postMessage (structured clone boundary)
┌─────────────▼──────────────────────────────────────────────────────────────────┐
│                           Web Worker                                           │
├───────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  sql.js Database (WASM)                                                  │  │
│  │  cards | connections | graph_metrics | FTS5                              │  │
│  │  ui_state (key: 'layout:preset', 'tour:progress', 'view:defaults:v1')   │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `ViewDefaultsRegistry` (new) | Maps `source_type` + dataset characteristics to `{viewType, pafvConfig, filterConfig}` recommendation objects | NEW |
| `LayoutPresetManager` (new) | Owns named preset definitions, applies a preset by calling `WorkbenchShell.presetSectionOrder()` + `PAFVProvider.applyDefaults()` + `StateManager.persist()` | NEW |
| `TourEngine` (new) | Step sequencer that highlights DOM elements via overlay `<div>`, advances on user interaction, stores progress in `ui_state['tour:progress']` | NEW |
| `PAFVProvider` (modified) | Add `applyDefaults(config: ViewDefaultsConfig)` — sets axes, groupBy, and viewType without triggering normal persistence flow | MODIFIED |
| `StateManager` (modified) | Add `loadPreset(presetKey: string)` — bulk-restores multiple provider states from a preset snapshot in a single transaction | MODIFIED |
| `WorkbenchShell` (modified) | Add `presetSectionOrder(order: string[], collapsedSet: Set<string>)` — reorders CollapsibleSection DOM children and sets collapse states | MODIFIED |
| `ViewManager` (modified) | After `switchTo()`, call `viewDefaultsRegistry.getBestView(activeDatasetSourceType)` if no persisted view state for this dataset | MODIFIED |
| `DataExplorerPanel` (modified) | After a successful import, fire `onDatasetImported(sourceType)` callback so `ViewDefaultsRegistry` can suggest a default configuration | MODIFIED |

---

## Recommended Project Structure

```
src/
├── defaults/
│   ├── ViewDefaultsRegistry.ts    # NEW — source_type → default view + PAFV config
│   ├── LayoutPresets.ts           # NEW — named preset definitions (pure data, no DOM)
│   └── types.ts                   # NEW — ViewDefaultsConfig, LayoutPreset, TourStep shapes
├── tour/
│   └── TourEngine.ts              # NEW — DOM overlay step sequencer
├── ui/
│   ├── LayoutPresetManager.ts     # NEW — preset application orchestrator
│   ├── WorkbenchShell.ts          # MODIFIED — presetSectionOrder()
│   └── ...                        # (existing files unchanged)
├── providers/
│   ├── PAFVProvider.ts            # MODIFIED — applyDefaults()
│   ├── StateManager.ts            # MODIFIED — loadPreset()
│   └── ...
└── views/
    └── ViewManager.ts             # MODIFIED — post-switchTo defaults hook
```

### Structure Rationale

- **`src/defaults/`:** Isolates the registry and preset data from the UI and provider layers. `ViewDefaultsConfig` objects are pure data — no DOM, no async. The registry is a lookup table, not a coordinator. This keeps it testable in pure unit tests with no DOM setup.
- **`src/tour/`:** Tour concerns (DOM overlay, step sequencing, progress persistence) are self-contained. TourEngine is the only component that touches DOM outside its own element (it annotates arbitrary elements), so isolating it prevents it from entangling with WorkbenchShell.
- **`src/ui/LayoutPresetManager.ts`:** Sits in `ui/` because it orchestrates DOM changes (WorkbenchShell section reordering) alongside provider changes. It depends on WorkbenchShell, PAFVProvider, and StateManager — the same wiring tier as the existing explorer panels.

---

## Architectural Patterns

### Pattern 1: View Defaults via Registry Lookup (Not Hardcoded View-Switch Logic)

**What:** `ViewDefaultsRegistry` is a pure lookup table keyed by `SourceType` (the `source_type` field from the `datasets` table). Each entry specifies a `ViewDefaultsConfig` — the recommended `viewType` and PAFV axis assignments for that data shape.

**When to use:** On first dataset import, or when the user explicitly requests "apply smart defaults" for the active dataset.

**Trade-offs:** Registry is statically defined at build time. Dynamic/learned defaults are out of scope. The registry does NOT run automatically on every import — it provides a recommendation that must be explicitly applied (by user gesture or by `ViewManager` detecting an empty `ui_state` for this dataset).

**Example:**
```typescript
// src/defaults/ViewDefaultsRegistry.ts
export interface ViewDefaultsConfig {
  viewType: ViewType;
  pafv: {
    colAxes?: AxisMapping[];
    rowAxes?: AxisMapping[];
    groupBy?: AxisMapping | null;
  };
  suggestedPreset?: string; // named LayoutPreset key
}

const REGISTRY: Partial<Record<SourceType | 'alto_index', ViewDefaultsConfig>> = {
  native_calendar: {
    viewType: 'calendar',
    pafv: {},
    suggestedPreset: 'latch-analytics',
  },
  native_reminders: {
    viewType: 'kanban',
    pafv: { groupBy: { field: 'status', direction: 'asc' } },
    suggestedPreset: 'latch-analytics',
  },
  native_notes: {
    viewType: 'list',
    pafv: {},
    suggestedPreset: 'writing',
  },
  markdown: {
    viewType: 'list',
    pafv: {},
    suggestedPreset: 'writing',
  },
  csv: {
    viewType: 'supergrid',
    pafv: {
      colAxes: [{ field: 'card_type', direction: 'asc' }],
      rowAxes: [{ field: 'folder', direction: 'asc' }],
    },
    suggestedPreset: 'data-integration',
  },
  excel: {
    viewType: 'supergrid',
    pafv: {
      colAxes: [{ field: 'card_type', direction: 'asc' }],
      rowAxes: [{ field: 'folder', direction: 'asc' }],
    },
    suggestedPreset: 'data-integration',
  },
  alto_index: {
    viewType: 'tree',
    pafv: {},
    suggestedPreset: 'latch-analytics',
  },
};

export class ViewDefaultsRegistry {
  getDefaults(sourceType: string): ViewDefaultsConfig | null {
    return REGISTRY[sourceType as keyof typeof REGISTRY] ?? null;
  }
}
```

### Pattern 2: Layout Presets as Declarative Section Configurations

**What:** A `LayoutPreset` declares which WorkbenchShell sections should be open, which collapsed, and in what order. `LayoutPresetManager.apply(presetKey)` reads this declaration and calls existing `WorkbenchShell` methods + `PAFVProvider.applyDefaults()`.

**When to use:** When the user selects a preset from the CommandBar dropdown or from a TourEngine prompt. Presets are named to match workflow archetypes: "Data Integration" (supergrid-forward), "Writing" (notebook-forward), "LATCH Analytics" (filters prominent), "GRAPH Synthetics" (algorithm explorer prominent).

**Trade-offs:** Section reordering requires DOM manipulation — CollapsibleSection children must be physically reordered in the `panel-rail` container. This is a rare operation (user-initiated) so performance is not a concern. The order is persisted to `ui_state` immediately after applying so it survives reload.

**Example:**
```typescript
// src/defaults/LayoutPresets.ts
export interface LayoutPreset {
  key: string;
  label: string;
  description: string;
  sectionOrder: string[];       // CollapsibleSection storageKeys in desired order
  collapsedSections: string[];  // storageKeys of sections that start collapsed
  pafvHints?: ViewDefaultsConfig['pafv'];  // optional axis hints applied alongside
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    key: 'data-integration',
    label: 'Data Integration',
    description: 'SuperGrid front-and-center for bulk data exploration.',
    sectionOrder: ['projection', 'properties', 'latch', 'calc', 'algorithm', 'notebook'],
    collapsedSections: ['algorithm', 'notebook'],
  },
  {
    key: 'writing',
    label: 'Writing',
    description: 'Notebook panel expanded, filters hidden.',
    sectionOrder: ['notebook', 'properties', 'latch', 'projection', 'calc', 'algorithm'],
    collapsedSections: ['projection', 'calc', 'algorithm'],
  },
  {
    key: 'latch-analytics',
    label: 'LATCH Analytics',
    description: 'Histogram scrubbers and category chips up front.',
    sectionOrder: ['latch', 'projection', 'properties', 'calc', 'notebook', 'algorithm'],
    collapsedSections: ['calc', 'notebook', 'algorithm'],
  },
  {
    key: 'graph-synthetics',
    label: 'GRAPH Synthetics',
    description: 'Algorithm explorer prominent for graph analysis.',
    sectionOrder: ['algorithm', 'projection', 'latch', 'properties', 'calc', 'notebook'],
    collapsedSections: ['notebook'],
  },
];
```

### Pattern 3: TourEngine as Pure DOM Overlay (No Provider Dependencies)

**What:** TourEngine manages a floating overlay `<div class="tour-overlay">` with a spotlight cutout highlighting the target element, a tooltip card with step copy, and Prev/Next/Skip controls. It does NOT modify provider state — it annotates existing UI and advances on user acknowledgment.

**When to use:** On first launch (after sample data loads) or when the user clicks "Show Tour" in the CommandBar settings dropdown. Tour progress is persisted to `ui_state['tour:progress']` so a dismissed/completed tour does not replay.

**Trade-offs:** The overlay cutout (spotlight effect) requires knowing the bounding box of target elements. All target elements are DOM nodes already in the workbench. TourEngine reads `getBoundingClientRect()` and positions the spotlight using CSS `clip-path: path()` or a `box-shadow` inset technique. This must account for `panel-rail` scrolling when the target element is scrolled into view.

**Example:**
```typescript
// src/tour/TourEngine.ts
export interface TourStep {
  id: string;
  targetSelector: string;       // CSS selector for the element to highlight
  title: string;
  body: string;                 // Markdown-lite: bold, inline code only
  position: 'top' | 'right' | 'bottom' | 'left';
  scrollTargetIntoView?: boolean;
}

export class TourEngine {
  private _overlay: HTMLElement | null = null;
  private _currentStep = 0;
  private _steps: TourStep[] = [];

  // Persisted to ui_state['tour:progress'] — written after each step advance
  // Shape: { completedTourId: string | null, lastStep: number }

  constructor(
    private readonly bridge: WorkerBridgeLike,
    steps: TourStep[],
  ) {
    this._steps = steps;
  }

  async start(fromStep = 0): Promise<void> { /* ... */ }
  advance(): void { /* ... */ }
  dismiss(): void { /* destroy overlay, persist completion */ }
  destroy(): void { /* remove overlay from DOM, clear listeners */ }
}
```

### Pattern 4: PAFVProvider.applyDefaults() — Non-Persisting Setter

**What:** `PAFVProvider` gains an `applyDefaults(config: ViewDefaultsConfig['pafv'])` method that applies the config to the current view type's state WITHOUT triggering the `StateManager` dirty-mark path. The caller (LayoutPresetManager or ViewManager) is responsible for deciding whether to persist.

**When to use:** When smart defaults are applied on first import. The defaults are provisional — if the user immediately changes axes, the provider's normal `_scheduleNotify()` fires and `StateManager` marks the provider dirty, persisting the user's override instead.

**Trade-offs:** This is a one-time application (idempotent if called with same config). The `applyDefaults()` method sets state directly and calls `_scheduleNotify()` but does NOT call through the setter injection path (so allowlist validation still runs on individual setters). Internally it calls `setColAxes()` / `setRowAxes()` / `setGroupBy()` — the existing validated setters — rather than writing `_state` directly.

**Example:**
```typescript
// In PAFVProvider.ts — new method
applyDefaults(config: ViewDefaultsConfig['pafv']): void {
  if (config.colAxes !== undefined) {
    this.setColAxes(config.colAxes);  // uses existing allowlist-validated setter
  }
  if (config.rowAxes !== undefined) {
    this.setRowAxes(config.rowAxes);
  }
  if (config.groupBy !== undefined) {
    this.setGroupBy(config.groupBy);
  }
  // _scheduleNotify() already called by each setter — no extra notification needed
}
```

### Pattern 5: WorkbenchShell Section Reordering via DOM Reparenting

**What:** WorkbenchShell gains `presetSectionOrder(order: string[], collapsedSet: Set<string>)`. It reads the current `_sections` array, maps storageKey → CollapsibleSection, and re-appends children to `_panelRailEl` in the new order. It also sets the collapse state on each section.

**When to use:** Called by `LayoutPresetManager.apply()`. Not called during normal operation — only on explicit preset application.

**Trade-offs:** DOM reparenting is safe for CollapsibleSection because each section's internal DOM references (`_headerEl`, `_bodyEl`) are bound to its own root element, not to parent-relative positions. Re-appending the root element is sufficient — no event listener rewiring needed. The new order is written to `ui_state['layout:section-order']` immediately after DOM change so it survives page reload.

**Example:**
```typescript
// In WorkbenchShell.ts — new method
presetSectionOrder(order: string[], collapsedSet: Set<string>): void {
  const sectionMap = new Map(
    this._sections.map(s => [s.getStorageKey(), s])
  );

  // Reorder DOM by re-appending in the desired order
  for (const key of order) {
    const section = sectionMap.get(key);
    if (section) {
      this._panelRailEl.appendChild(section.getRootEl()); // moves in DOM
      if (collapsedSet.has(key)) {
        section.setCollapsed(true);
      } else {
        section.setCollapsed(false);
      }
    }
  }

  // Re-sync internal _sections array to match DOM order
  this._sections = order
    .map(key => sectionMap.get(key))
    .filter((s): s is CollapsibleSection => s !== undefined);
}
```

Note: CollapsibleSection requires two small additions: `getStorageKey(): string` and `getRootEl(): HTMLElement` accessors. These are one-line additions to an existing class.

---

## Data Flow

### Smart Defaults Application Flow (First Import)

```
User imports a dataset (e.g., native_calendar)
    ↓
DataExplorerPanel fires onDatasetImported('native_calendar')
    ↓
ViewDefaultsRegistry.getDefaults('native_calendar')
    → returns { viewType: 'calendar', pafv: {}, suggestedPreset: 'latch-analytics' }
    ↓
ViewManager.switchTo('calendar')  [if not already on calendar]
    ↓
PAFVProvider.applyDefaults({})    [axes already match calendar defaults]
    ↓
LayoutPresetManager.apply('latch-analytics')
    → WorkbenchShell.presetSectionOrder([...], new Set([...]))
    → StateManager.persist('layout:preset')
    ↓
ui_state['layout:preset'] = 'latch-analytics'
ui_state['layout:section-order'] = ['latch', 'projection', ...]
    ↓
StateCoordinator fires → explorers re-render in new order
```

### Layout Preset Application Flow (User-Initiated)

```
User selects "Data Integration" from preset picker in CommandBar dropdown
    ↓
CommandBar fires onApplyPreset('data-integration') callback
    ↓
LayoutPresetManager.apply('data-integration')
    ↓
    ├── WorkbenchShell.presetSectionOrder(
    │     ['projection', 'properties', 'latch', 'calc', 'algorithm', 'notebook'],
    │     new Set(['algorithm', 'notebook'])
    │   )
    ├── PAFVProvider.applyDefaults(preset.pafvHints)  // if present
    └── bridge.send('ui:set', { key: 'layout:preset', value: 'data-integration' })
        bridge.send('ui:set', { key: 'layout:section-order', value: JSON.stringify([...]) })
    ↓
DOM reorders, sections collapse → visible immediately
```

### Tour Flow

```
First launch after sample data loads (TourEngine.start())
    ↓
bridge.send('ui:get', { key: 'tour:progress' })
    → null (never shown) → proceed
    ↓
TourEngine mounts .tour-overlay on document.body
    ↓
Step 1: highlight SidebarNav Visualization Explorer
    → getBoundingClientRect() on '[data-section="visualization"]'
    → position spotlight + tooltip
    ↓
User clicks "Next" / presses Escape to skip
    ↓
bridge.send('ui:set', { key: 'tour:progress', value: JSON.stringify({ step: 1 }) })
    ↓
[...steps advance...]
    ↓
Last step: highlight LayoutPresetManager preset picker
    ↓
User clicks "Finish"
    ↓
bridge.send('ui:set', { key: 'tour:progress', value: JSON.stringify({ completed: true }) })
TourEngine.destroy()
```

### State Persistence: What Lives Where

| State | Storage | Key | Notes |
|-------|---------|-----|-------|
| Active preset name | `ui_state` table | `layout:preset` | Durable (Tier 2). Set by LayoutPresetManager. |
| Section order array | `ui_state` table | `layout:section-order` | Durable. JSON array of storageKey strings. |
| Section collapse states | `localStorage` | `workbench:{storageKey}` | Existing CollapsibleSection behavior — unchanged. |
| Tour progress | `ui_state` table | `tour:progress` | Durable. JSON `{ completed: boolean, lastStep: number }`. |
| View defaults applied flag | `ui_state` table | `view:defaults:applied:{datasetId}` | Durable. Prevents re-applying defaults on subsequent loads. |
| PAFVProvider state (axes, groupBy) | `ui_state` table | `axis` | Existing Tier 2 provider persistence — unchanged. |

The key design decision: **section order and the active preset live in `ui_state`, not `localStorage`**. This is consistent with all other Tier 2 state — it flows through `StateManager` and is included in the CloudKit checkpoint. `localStorage` is reserved for `CollapsibleSection` per-section collapse states (already established — do not change).

---

## New Components

### `src/defaults/ViewDefaultsRegistry.ts`

Pure lookup class. No DOM, no async, no dependencies. Contains:
- `REGISTRY: Partial<Record<string, ViewDefaultsConfig>>` static map
- `getDefaults(sourceType: string): ViewDefaultsConfig | null`
- `getDefaultsForDataset(dataset: { source_type: string; card_count: number }): ViewDefaultsConfig | null` — future extension point for card-count-aware defaults (e.g., large CSVs always get supergrid)

### `src/defaults/LayoutPresets.ts`

Pure data module. Exports `LAYOUT_PRESETS: LayoutPreset[]` and `getPreset(key: string): LayoutPreset | undefined`. No class needed — it is a data file, not a service.

### `src/defaults/types.ts`

Shared type definitions: `ViewDefaultsConfig`, `LayoutPreset`, `TourStep`. Referenced by registry, presets, LayoutPresetManager, and TourEngine.

### `src/ui/LayoutPresetManager.ts`

Orchestrator class. Depends on: `WorkbenchShell`, `PAFVProvider`, `WorkerBridgeLike`. Constructor receives all three via setter injection (matching existing pattern). Primary method: `apply(presetKey: string): Promise<void>`.

### `src/tour/TourEngine.ts`

Self-contained class. Depends only on `WorkerBridgeLike` for persistence. All DOM interactions are through a single `.tour-overlay` root it mounts on `document.body`. Exposes: `start(fromStep?)`, `advance()`, `back()`, `dismiss()`, `destroy()`.

---

## Modified Components

### `PAFVProvider.ts`

Add `applyDefaults(config: ViewDefaultsConfig['pafv']): void`. Internally calls through existing validated setters (`setColAxes`, `setRowAxes`, `setGroupBy`). No new public state — this is a convenience orchestrator over existing setters.

**Lines changed estimate:** ~25 lines (method + interface import)

### `StateManager.ts`

No structural changes needed. `LayoutPresetManager` calls `bridge.send('ui:set', ...)` directly for its two keys (`layout:preset`, `layout:section-order`) — these are not provider-backed state, they are metadata about which preset was applied. `StateManager` is not the right coordinator here because LayoutPresetManager is the source of truth for the preset, not a provider.

### `WorkbenchShell.ts`

Add three items:
1. `presetSectionOrder(order: string[], collapsedSet: Set<string>): void`
2. `getActivePresetKey(): string | null` — reads from ui_state on mount for persistence restore
3. Expose `_sections` access for `LayoutPresetManager` to read the current order

**Lines changed estimate:** ~60 lines

### `CollapsibleSection.ts`

Add two read-only accessors:
1. `getStorageKey(): string` — returns `this._config.storageKey`
2. `getRootEl(): HTMLElement` — returns `this._rootEl`
3. Add `setCollapsed(collapsed: boolean): void` — programmatic collapse without localStorage write (tour and preset need to collapse without user gesture)

**Lines changed estimate:** ~20 lines

### `ViewManager.ts`

In `switchTo()`, after view is mounted: check `ui_state['view:defaults:applied:{datasetId}']`. If absent and a registry entry exists for the current dataset's source_type, call `viewDefaultsRegistry.getDefaults(sourceType)` and apply via PAFVProvider + LayoutPresetManager. Mark the flag as applied.

This requires `ViewManager` to accept `ViewDefaultsRegistry` and `LayoutPresetManager` as optional setter-injected dependencies (matching the setter injection pattern used by PAFVProvider for SchemaProvider).

**Lines changed estimate:** ~40 lines

### `DataExplorerPanel.ts`

Add `onDatasetImported?: (sourceType: string, datasetId: string) => void` callback to its config. Fire it after a successful import completes and CatalogSuperGrid refreshes. This is the trigger that allows main.ts to coordinate the first-import defaults flow.

**Lines changed estimate:** ~15 lines

### `CommandBar.ts`

Add preset picker dropdown section (radio group pattern, matching the existing theme picker radiogroup). Calls a new `onApplyPreset: (presetKey: string) => void` callback. The selected preset label appears as a subtitle badge (matching the existing `_subtitleEl` dataset name pattern).

**Lines changed estimate:** ~50 lines

---

## Integration Points

### Existing Systems Modified

| Module | Change | Why |
|--------|--------|-----|
| `src/providers/PAFVProvider.ts` | `applyDefaults()` convenience method | Registry applies PAFV config without breaking setter injection pattern |
| `src/ui/WorkbenchShell.ts` | `presetSectionOrder()`, section-order restore on mount | Preset application and persistence restore |
| `src/ui/CollapsibleSection.ts` | `getStorageKey()`, `getRootEl()`, `setCollapsed()` | WorkbenchShell needs to read and programmatically set each section |
| `src/views/ViewManager.ts` | `applyViewDefaults()` hook after `switchTo()` | First-import automatic default view selection |
| `src/ui/DataExplorerPanel.ts` | `onDatasetImported` callback in config | Trigger smart defaults flow after import completes |
| `src/ui/CommandBar.ts` | Preset picker radiogroup in settings dropdown | User-initiated preset selection |

### New Files

| Module | Depends On | Notes |
|--------|-----------|-------|
| `src/defaults/ViewDefaultsRegistry.ts` | `src/defaults/types.ts` | Pure data lookup, no DOM dependencies |
| `src/defaults/LayoutPresets.ts` | `src/defaults/types.ts` | Pure data, no class needed |
| `src/defaults/types.ts` | `src/providers/types.ts` (for ViewType, AxisMapping) | Shared type contract for all defaults/tour code |
| `src/ui/LayoutPresetManager.ts` | `WorkbenchShell`, `PAFVProvider`, `WorkerBridgeLike`, `LayoutPresets` | Orchestrator — wired in main.ts via setter injection |
| `src/tour/TourEngine.ts` | `WorkerBridgeLike`, `src/defaults/types.ts` | Isolated DOM overlay, no provider coupling |

---

## Suggested Build Order

Phase dependencies are strict — each step unblocks the next. Four phases match the four feature areas in the milestone requirements.

**Phase A — Types + Registry Foundation (no UI, fully testable)**
1. `src/defaults/types.ts` — `ViewDefaultsConfig`, `LayoutPreset`, `TourStep` interfaces
2. `src/defaults/ViewDefaultsRegistry.ts` — static registry with all 9 `SourceType` entries + `alto_index`
3. `src/defaults/LayoutPresets.ts` — 4 named presets (`data-integration`, `writing`, `latch-analytics`, `graph-synthetics`)

Tests: Unit tests on `ViewDefaultsRegistry.getDefaults()` for all source types. Verify `suggestedPreset` values map to real `LayoutPreset` keys. Verify no typos in storageKey references.

**Phase B — Provider + WorkbenchShell Integration (no new UI)**
4. `CollapsibleSection`: `getStorageKey()`, `getRootEl()`, `setCollapsed()` accessors
5. `WorkbenchShell`: `presetSectionOrder()` method + section-order restore from `ui_state` on mount
6. `PAFVProvider`: `applyDefaults()` convenience method
7. `src/ui/LayoutPresetManager.ts` — `apply(presetKey)` orchestrator wired to WorkbenchShell + PAFVProvider

Tests: WorkbenchShell seam test — call `presetSectionOrder()` and assert DOM order matches. PAFVProvider unit test — `applyDefaults()` with `colAxes` calls through to subscriber notification. LayoutPresetManager integration test with `realDb()` factory confirms `ui:set` calls fire.

**Phase C — View Defaults Wiring + First-Import Flow**
8. `DataExplorerPanel`: `onDatasetImported` callback
9. `ViewManager`: `applyViewDefaults()` hook, setter injection for `ViewDefaultsRegistry` and `LayoutPresetManager`
10. `CommandBar`: preset picker radiogroup in settings dropdown with `onApplyPreset` callback
11. `main.ts`: wire all setter injections — `ViewManager.setViewDefaultsRegistry()`, `ViewManager.setLayoutPresetManager()`, `DataExplorerPanel` config with `onDatasetImported`

Tests: ViewManager seam test — after `switchTo()` with empty `ui_state`, confirm `applyDefaults()` was called with registry-provided config. CommandBar unit test — preset picker fires `onApplyPreset` callback.

**Phase D — TourEngine + Polish**
12. `src/tour/TourEngine.ts` — overlay DOM, step sequencer, spotlight positioning, progress persistence
13. Tour steps authored for 5 target elements: Visualization Explorer, Projection Explorer wells, LATCH histogram, CommandBar preset picker, DataExplorer import button
14. TourEngine wired in `main.ts`: start on first launch (check `ui_state['tour:progress']` = null), expose `startTour()` from CommandBar settings
15. E2E spec: apply preset → observe section order change. First-import → observe view switch. Tour advance through all steps.

---

## Anti-Patterns

### Anti-Pattern 1: Encoding Dataset-Type Logic Inside PAFVProvider's VIEW_DEFAULTS

**What people do:** Add per-source-type overrides directly into `VIEW_DEFAULTS` in `PAFVProvider.ts`, since it already has a `viewType → state` registry.

**Why it's wrong:** `VIEW_DEFAULTS` is indexed by `ViewType`, not by `SourceType`. The two dimensions are orthogonal — a `native_calendar` import and a `csv` import both have a `calendar` view default, but one should default TO the calendar view and the other should not. Mixing source-type logic into `VIEW_DEFAULTS` creates a N×M explosion and violates the provider's single responsibility (axis state management).

**Do this instead:** `ViewDefaultsRegistry` is the correct location for source-type → view recommendations. `PAFVProvider` provides `applyDefaults()` as a passive applicator. The registry is the decider; the provider is the executor.

### Anti-Pattern 2: Persisting Section Order in localStorage Instead of ui_state

**What people do:** Since `CollapsibleSection` already uses `localStorage` for collapse state, store the preset-driven section order in `localStorage` too.

**Why it's wrong:** `localStorage` is device-local and excluded from CloudKit checkpoint. Section order set by a preset should follow the data across devices (Tier 2, not Tier 3). The principle is established in `d3-spec`: `localStorage` is for ephemeral display preferences (individual section collapse), not for configuration derived from deliberate user actions (preset selection).

**Do this instead:** Write `layout:section-order` to `ui_state` via `bridge.send('ui:set', ...)`. On WorkbenchShell mount, read from `ui_state` via `bridge.send('ui:getAll')` and restore order before first render. CollapsibleSection per-section collapse state remains in `localStorage` — that level of detail is correctly ephemeral.

### Anti-Pattern 3: TourEngine Reading Provider State

**What people do:** Make TourEngine advance steps automatically when the user takes specific actions (e.g., "step 3 completes when the user drops a chip into the projection well").

**Why it's wrong:** This requires TourEngine to subscribe to PAFVProvider, FilterProvider, or DOM events on specific elements — creating tight coupling between the tour and internal provider state. If providers change their notification shape, the tour breaks. It also makes the tour non-dismissable mid-step.

**Do this instead:** TourEngine is purely user-gesture-driven (Next button or Escape). It does not observe provider state. Steps describe what to do; the user does it; the tour advances when the user clicks Next. The tour is a guided annotation, not a scripted automation.

### Anti-Pattern 4: Applying View Defaults on Every switchTo()

**What people do:** In `ViewManager.switchTo()`, always call `viewDefaultsRegistry.getDefaults(sourceType)` and apply the result — treating defaults as the starting state for every view switch.

**Why it's wrong:** This overrides user-configured axes every time the user switches views. If a user configures custom PAFV axes for their CSV dataset and then switches to network view and back to supergrid, their axes are reset. Defaults must only apply on first encounter (flag-gated by `ui_state['view:defaults:applied:{datasetId}']`).

**Do this instead:** Check the applied flag before applying. Once defaults have been applied for a dataset, never apply them again automatically. Provide "Reset to Smart Defaults" as an explicit user action in CommandBar or the preset picker.

### Anti-Pattern 5: Reordering CollapsibleSection Internal State in WorkbenchShell._sections Without Matching DOM

**What people do:** Update `this._sections` array in `presetSectionOrder()` first, then try to sync DOM to match — leading to off-by-one errors when some sections may already be in the right position.

**Why it's wrong:** DOM reorder and `_sections` array reorder must happen atomically. If they diverge, `getSectionByKey()` and `collapseAll()` iterate `_sections` but DOM has different children, causing visual glitches on subsequent collapseAll() calls.

**Do this instead:** Re-append DOM children first (DOM is the source of truth for visual order), then rebuild `_sections` by reading `_panelRailEl.children` or by map-reordering to match the DOM. Alternatively, re-append DOM and rebuild `_sections` in the same loop iteration.

---

## Scaling Considerations

This milestone adds no new data volume scaling concerns — the registry is a static lookup, presets are applied once, and the tour has a fixed number of steps. The only scaling consideration is:

| Scale | Architecture Adjustment |
|-------|------------------------|
| 4 current presets | Static `LAYOUT_PRESETS` array is sufficient — no dynamic loading needed |
| 10+ future presets | Add `LAYOUT_PRESETS` as a `Map<string, LayoutPreset>` with `getPreset(key)` accessor; no architectural change |
| Per-dataset custom presets | Store as user-defined entries in `ui_state['layout:custom-presets']` (JSON array); `LayoutPresetManager.apply()` accepts preset objects directly, not just keys |

---

## Sources

- Codebase: `src/providers/PAFVProvider.ts` — `VIEW_DEFAULTS` structure, `setColAxes/setRowAxes/setGroupBy` setter pattern, `applyDefaults()` design point
- Codebase: `src/providers/StateManager.ts` — `registerProvider()` / `markDirty()` / `restore()` Tier 2 persistence pattern, `ui_state` table as persistence medium
- Codebase: `src/ui/WorkbenchShell.ts` — `SECTION_CONFIGS`, `CollapsibleSection[]`, `_panelRailEl` DOM structure
- Codebase: `src/ui/CollapsibleSection.ts` — `localStorage` for collapse state, `_rootEl` reference, `getStorageKey()` design point
- Codebase: `src/views/ViewManager.ts` — `switchTo()` lifecycle, `VIEW_EMPTY_MESSAGES` per-view customization pattern, setter injection for `FilterProviderLike`
- Codebase: `src/etl/types.ts` — `SourceType` union (9 values: apple_notes, markdown, excel, csv, json, html, native_reminders, native_calendar, native_notes)
- Codebase: `src/worker/handlers/datasets.handler.ts` — `datasets` table schema (id, name, source_type, card_count, directory_path, last_imported_at)
- Codebase: `src/ui/CommandBar.ts` — existing settings dropdown pattern, theme radiogroup as model for preset picker
- Codebase: `src/ui/DataExplorerPanel.ts` — import completion callback pattern
- Codebase: `src/sample/SampleDataManager.ts` — first-launch sample data flow as model for first-import defaults trigger
- PROJECT.md: v10.0 requirements — "Default SuperGrid configurations for all 20 dataset types", "Named explorer layout presets", "Default view configurations for other view types", "In-app guided Tour"
- Memory: D-001 (sql.js as system of record), setter injection pattern, three-tier state persistence (Tier 2 = ui_state, Tier 3 = SelectionProvider session-only)

---
*Architecture research for: v10.0 Smart Defaults + Layout Presets + Guided Tour — integration with existing Provider/StateManager/WorkbenchShell/ViewManager architecture*
*Researched: 2026-03-27*
