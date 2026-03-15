# Isometry D3 UI Implementation Spec v2

Date: 2026-03-07  
Source design: `https://www.figma.com/make/aRUksAazmRiAvzJabzqsSG/Isometry-v5-Design`  
Scope: Translate Figma Make UI (ignoring React-specific scaffolding) into Isometry's existing D3/DOM architecture.  
Revision: v2 — open decisions resolved, DOM boundary specified, StateCoordinator call-sites documented, DnD contract clarified.

---

## 1. Objectives

- Implement the new shell + explorer-driven UI from Figma in plain TypeScript + D3/DOM (no React runtime).
- Reuse existing Isometry architectural patterns:
  - Theme + token system: `src/styles/design-tokens.css`
  - View lifecycle and update model: `src/views/ViewManager.ts`
  - SuperGrid rendering model and interaction idioms: `src/views/SuperGrid.ts`
  - Existing overlays/toasts/menus where possible: `src/ui/*`, `src/shortcuts/*`
- Preserve current performance characteristics (especially SuperGrid), avoid large rewrite churn.

---

## 2. Figma UI Model to Preserve

Derived from Make source:
- Shell is a vertical stack:
  1. Command bar (app/menu trigger, command input, settings menu)
  2. Notebook explorer panel
  3. Properties explorer
  4. Projection explorer
  5. Visual explorer (SuperGrid + vertical zoom slider rail)
  6. LATCH explorers / Time explorer section
- Explorer sections are collapsible with common header treatment.
- Projection editing model:
  - Available properties well
  - X plane / Y plane / Z plane wells
  - Z-plane controls (display field, audit toggle, density, aggregation)
- SuperGrid visual style:
  - Sticky row/column headers
  - Corner cell containing axis labels + transpose action
  - Dense grid cells with card-density-dependent rendering
- Theme: one canonical token-driven theme (see §13 — resolved decision).

---

## 3. Remove React/Figma-Make Artifacts

Do not implement:
- React hooks/state primitives (`useState`, `useEffect`, etc.)
- React DnD provider/backend and component wrappers
- shadcn/ui component imports from Make (`src/app/components/ui/*`)
- Tailwind utility-class dependency and generated theme layer

Replace with:
- Existing Isometry providers (`PAFVProvider`, `FilterProvider`, `SelectionProvider`, `DensityProvider`, `StateCoordinator`)
- Native DOM events + D3 joins
- Existing CSS tokenized styling strategy

---

## 4. Architecture Integration

### 4.1 New Shell Controller

Create:
- `src/ui/WorkbenchShell.ts` (new)

Responsibilities:
- Own top-level shell DOM and panel composition.
- Mount/unmount explorer modules.
- Dispatch user actions to existing providers/coordinator.
- Keep current view area under `ViewManager` as primary rendering host.

Constraints:
- Keep `main.ts` as composition root.
- `WorkbenchShell` should be a thin orchestrator; business state remains in providers.

#### 4.1.1 DOM Hierarchy (Authoritative)

`WorkbenchShell` receives the `#app` root, creates a child host element for the shell layout, and hands an inner content element to `ViewManager`. `ViewManager` must not own `#app` directly after this change — it mounts into `.workbench-view-content` instead.

```
#app
  └─ .workbench-shell                  ← WorkbenchShell owns; flex column, full height
       ├─ .workbench-command-bar        ← CommandBar.ts
       ├─ .workbench-panel-rail         ← collapsible explorer sections (flex column, overflow-y: auto)
       │    ├─ .explorer-notebook       ← NotebookExplorer.ts
       │    ├─ .explorer-properties     ← PropertiesExplorer.ts
       │    ├─ .explorer-projection     ← ProjectionExplorer.ts
       │    └─ .explorer-latch          ← LatchExplorers.ts
       └─ .workbench-view-content       ← ViewManager mounts here (flex: 1 1 auto, overflow: hidden)
            └─ [SuperGrid / other views render here unchanged]
```

**main.ts wiring:**

```typescript
// main.ts
const shell = new WorkbenchShell(document.getElementById('app')!);
shell.mount();

// WorkbenchShell exposes the view content host
const viewHost = shell.getViewContentEl();
viewManager.mount(viewHost);   // ViewManager now receives a sub-element, not #app
```

**Guard:** Do not move SuperGrid's existing CSS Grid layout. The `.workbench-view-content` container must have `overflow: hidden` and a defined height (via flex) so SuperGrid's sticky headers continue to work correctly.

### 4.2 Collapsible Section Primitive

Create:
- `src/ui/CollapsibleSection.ts`

Pattern:
- Match Make `CollapsibleExplorer` behavior with existing tokenized styles.
- Reusable for Notebook/Properties/Projection/Visual/Time explorers.

API:
```typescript
constructor(opts: {
  title: string | HTMLElement;
  defaultCollapsed?: boolean;
  fillRemaining?: boolean;   // flex: 1 1 auto for the Visual explorer section
})
mount(container: HTMLElement): void
setCollapsed(v: boolean): void
onToggle(cb: (collapsed: boolean) => void): () => void   // returns unsubscribe fn
getBodyEl(): HTMLElement
destroy(): void
```

### 4.3 Command Bar

Create:
- `src/ui/CommandBar.ts`

Features:
- Left app icon/menu trigger.
- Command input (placeholder `Command palette...`).
- Right settings/menu trigger.

Integration:
- Reuse or extend `ShortcutRegistry` + HelpOverlay discovery entry points.
- Menu actions should route into existing app actions (import, view switch, preferences stubs) without introducing new state stores.

---

## 5. Explorer Modules

Each explorer should be an isolated module with `mount/destroy/update` API.

### 5.1 Notebook Explorer

Create:
- `src/ui/NotebookExplorer.ts`

**v1 scope (Phase 4):** Resizable two-pane layout only.
- Left pane: plain `<textarea>` — no contenteditable, no formatting toolbar in v1.
- Right pane: sanitized HTML preview rendered via `element.innerHTML = sanitize(marked(content))`. Use an existing or minimal sanitizer dependency; do not roll a custom one.
- D3 preview region: stub only in v1 — reserved `<div class="notebook-chart-preview">` container, no chart rendering until Phase 4 polish.

**Deferred to Phase 4:**
- Formatting toolbar
- D3 chart block rendering (`bar` schema)
- Full markdown engine migration

**Persistence:** Session-only in v1. Content lives in component state only. No writes to `IsometryDatabase` until the native SwiftUI/`IsometryDatabase` actor migration is complete. (Resolved: see §13.)

### 5.2 Properties Explorer

Create:
- `src/ui/PropertiesExplorer.ts`

Behavior:
- Six grouped columns by LATCH axis families.
- Per-property toggle checkbox.
- Inline display name edit.
- Column collapse/expand.
- Count badges per axis group.

Data source:
- Property catalog must be derived from provider metadata — not static mock data. Read from `PAFVProvider.getAvailableProperties()` or equivalent. Do not duplicate property definitions.

Events (typed, dispatched on the module's root element):
```typescript
'property:toggled'     // detail: { propertyId: string; enabled: boolean }
'property:renamed'     // detail: { propertyId: string; name: string }
'axis:group-collapsed' // detail: { axis: 'L'|'A'|'T'|'C'|'H'; collapsed: boolean }
```

### 5.3 Projection Explorer

Create:
- `src/ui/ProjectionExplorer.ts`

Behavior:
- Four wells: `available`, `x`, `y`, `z`.
- Drag/drop property chips between wells.
- Reorder within a well.
- Z controls:
  - display property select
  - audit toggle
  - card density select
  - aggregation mode select (see §13 — resolved to query semantics)

**State mapping (providers — authoritative):**

| Explorer control | Provider |
|---|---|
| Wells (x/y/z assignments) | `PAFVProvider.setAxes(axes)` |
| Audit toggle | existing audit state (existing mechanism) |
| Card density | `DensityProvider.setDensity(level)` |
| Aggregation mode | `PAFVProvider.setAggregation(mode)` → flows to SQL GROUP BY |

**Aggregation semantics:** Aggregation mode maps to real query semantics immediately (GROUP BY / aggregate SQL). It is not a visual-only hint. The `PAFVProvider` must translate the selected aggregation mode into the query pipeline before `StateCoordinator.scheduleUpdate()` is called. Do not implement a visual-only aggregation path. (Resolved: see §13.)

#### 5.3.1 DnD Implementation

**Do not extend `SuperGridSelect.ts` for projection DnD.** SuperGrid's drag handles row/column reorder; Projection handles chip-well assignment. These are independent implementations that share only naming conventions.

Shared naming conventions (to be consistent across both):
- Drag payload: `data-drag-payload` dataset attribute (JSON string)
- Drop zone: `data-drop-zone` dataset attribute

**ProjectionExplorer DnD payload shape:**
```typescript
interface ProjectionDragPayload {
  propertyId: string;
  sourceWell: 'available' | 'x' | 'y' | 'z';
  sourceIndex: number;
}
```

**Drop target resolution:**
```typescript
interface ProjectionDropTarget {
  targetWell: 'available' | 'x' | 'y' | 'z';
  targetIndex?: number;   // undefined = append to end
}
```

**Validation guards (enforce at drop handler):**
- Prevent duplicate property insertion into the same well.
- Maintain minimum axis count: x and y wells must each contain at least one property.
- z well may be empty (collapses to single-plane projection).

**Implementation pattern:** Use `dragstart`/`dragover`/`drop` native events with event delegation on each well container. Do not import an external DnD library. Keep consistent with the dataset-payload pattern already used in SuperGrid column reorder.

### 5.4 Visual Explorer

Current SuperGrid stays core. Extend wrapper behavior only.

Behavior:
- Left vertical rail slider for zoom/pan affordance.
- Main area hosts existing `SuperGrid` (unchanged).
- Transpose and axis labels remain in SuperGrid corner cell.

Mapping:
- Slider updates `SuperPositionProvider.zoomLevel` (already integrated).
- No secondary visualization implementation in this container.
- This section uses `fillRemaining: true` in `CollapsibleSection` so it takes all available vertical space after other panels.

### 5.5 LATCH / Time Explorer

Create:
- `src/ui/LatchExplorers.ts`

Phase A (ship with Phase 3): skeleton + controls wired to existing `FilterProvider` for each axis (location, alpha, time, category, hierarchy).

Phase B (future polish): richer subpanes — histogram scrubber for time, category chips, hierarchy band.

**Critical:** Do not introduce a parallel filtering stack. All filter mutations go through the existing `FilterProvider`. Explorer UI is a view into provider state, not an alternate state store.

---

## 6. State Coordinator Call-Site Contract

This section is authoritative. All explorer modules must follow this pattern exactly. Violations (direct query triggers, ad-hoc `grid.render()` calls) are the primary architectural failure mode to prevent.

**The pattern:**

```typescript
// ✅ CORRECT — every explorer control change follows this sequence:

// 1. Update the relevant provider(s)
pafvProvider.setAxes(updatedAxes);

// 2. Schedule the view refresh via StateCoordinator
stateCoordinator.scheduleUpdate();

// ❌ NEVER call SuperGrid or ViewManager directly from explorer modules:
// grid.render()           — WRONG
// viewManager.refresh()  — WRONG
// grid.query(...)         — WRONG
```

**Per-explorer examples:**

```typescript
// ProjectionExplorer — well drop handler
onWellDrop(payload: ProjectionDragPayload, target: ProjectionDropTarget): void {
  const updatedAxes = this.computeNewAxes(payload, target);
  pafvProvider.setAxes(updatedAxes);           // 1. provider
  stateCoordinator.scheduleUpdate();            // 2. schedule
}

// ProjectionExplorer — aggregation mode change
onAggregationChange(mode: AggregationMode): void {
  pafvProvider.setAggregation(mode);           // 1. provider (flows to SQL GROUP BY)
  stateCoordinator.scheduleUpdate();            // 2. schedule
}

// PropertiesExplorer — property toggle
onPropertyToggle(propertyId: string, enabled: boolean): void {
  pafvProvider.setPropertyEnabled(propertyId, enabled);  // 1. provider
  stateCoordinator.scheduleUpdate();                      // 2. schedule
}

// LatchExplorers — filter change
onFilterChange(axis: LatchAxis, filter: FilterValue): void {
  filterProvider.setFilter(axis, filter);      // 1. provider
  stateCoordinator.scheduleUpdate();            // 2. schedule
}
```

Explorer modules receive provider references via constructor injection from `WorkbenchShell` / `main.ts`. They do not import providers as singletons directly.

---

## 7. Styling & Design System Mapping

Use existing tokens in `src/styles/design-tokens.css` exclusively.

### 7.1 Token Mapping Rules

| Make token | Isometry token |
|---|---|
| `theme.colors.background` | `var(--bg-primary)` |
| `theme.colors.surface` | `var(--bg-secondary)` |
| `theme.colors.surfaceElevated` | `var(--bg-surface)` |
| `theme.colors.border` | `var(--border-muted)` or `var(--border-subtle)` by density |
| `theme.colors.text` | `var(--text-primary)` |
| `theme.colors.textSecondary` | `var(--text-secondary)` |
| `theme.colors.textMuted` | `var(--text-muted)` |
| `theme.colors.primary/focus` | `var(--accent)` |

Typography: use existing scale only: `--text-xs`, `--text-sm`, `--text-base`, `--text-md`, `--text-lg`.

### 7.2 CSS Files

Create:
- `src/styles/workbench-shell.css`
- `src/styles/explorers.css`

Keep (no changes):
- `src/styles/supergrid.css`
- `src/styles/views.css`
- `src/styles/accessibility.css`

**Selector scoping rule:** All selectors in `workbench-shell.css` and `explorers.css` must be scoped under `.workbench-shell` or a child class. No bare element selectors (e.g., `div`, `button`, `input`) at the top level. This prevents bleed into SuperGrid's CSS Grid layout.

**Import order in entry CSS / `main.ts`:**
```
design-tokens.css       (first — variables)
accessibility.css
views.css
supergrid.css
workbench-shell.css     (after existing, before explorers)
explorers.css           (last)
```

**box-sizing guard:** Do not add a bare `* { box-sizing: border-box }` rule in new CSS files. SuperGrid relies on the current box model. If needed, scope to `.workbench-shell *`.

No Tailwind classes in runtime code.

---

## 8. D3/DOM Implementation Pattern

Use a consistent pattern per module:
- Container creation once in `mount`.
- D3 `selection.join(...)` for list-like repeated structures (chips, rows, menu items).
- Event delegation for high-frequency dynamic content.
- Explicit `destroy` cleanup for all `document`/`window` listeners.

Performance:
- Avoid rebuilding whole explorer DOM on every provider update.
- Incremental update methods per module:
  - `updateProperties(properties: PropertyDescriptor[]): void`
  - `updateWells(wells: WellState): void`
  - `updateControls(controls: ControlState): void`

---

## 9. Interaction Contracts

### 9.1 Command & Menus

- App menu actions emit typed events consumed by `main.ts` composition layer.
- No direct calls to bridge/provider from deeply nested menu DOM handlers.

### 9.2 Projection DnD (see §5.3.1 for full spec)

Summary of constraints:
- Drag source payload: `{ propertyId, sourceWell, sourceIndex }`
- Drop target: `{ targetWell, targetIndex? }`
- Validation: no duplicate axis insertion; x/y wells must each retain ≥1 property

### 9.3 SuperGrid Linkage

- All well/control changes flow through providers + `StateCoordinator.scheduleUpdate()` (see §6).
- SuperGrid remains subscriber-driven; no direct ad-hoc query trigger from explorer modules.
- Never import or call `SuperGrid.ts` APIs from explorer modules.

---

## 10. Accessibility & Keyboard

Must-haves:
- `:focus-visible` ring via existing `accessibility.css` styles — do not re-implement.
- Collapsible headers keyboard operable (`Enter`/`Space` on the header element).
- Menu keyboard navigation baseline: `ArrowDown` + `Escape` for command/settings menus.
- Proper ARIA roles: `role="menu"` / `role="menuitem"` for menus; `role="listbox"` / `role="option"` for well DnD lists.
- `aria-expanded` on collapsible section headers.

---

## 11. Rollout Plan

### Phase 1: Shell Scaffolding (Low Risk)
- Add `WorkbenchShell`, `CollapsibleSection`, `CommandBar`.
- Wire `main.ts` to use new DOM hierarchy (§4.1.1).
- `ViewManager` mounts into `.workbench-view-content` instead of `#app`.
- Keep old UI controls active where needed during transition.
- **Gate:** Verify SuperGrid renders identically in new mount point before Phase 2.

### Phase 2: Properties + Projection Explorers
- Implement `PropertiesExplorer` and `ProjectionExplorer` with provider wiring.
- Replace legacy scattered control surfaces.
- Add unit tests for move/reorder/toggle flows.
- **Gate:** All existing SuperGrid tests remain green.

### Phase 3: Visual + Time Explorer Integration
- Add zoom rail wrapper around existing SuperGrid.
- Implement `LatchExplorers` Phase A (skeleton + filter wiring).
- **Gate:** No regression in SuperGrid performance benchmarks.

### Phase 4: Notebook Explorer and Polish
- Add `NotebookExplorer` v1 (textarea + preview pane).
- Final spacing/typography polish.
- Keyboard accessibility pass.
- LATCH Phase B subpanes (histogram scrubber, etc.) if time permits.

---

## 12. Test Plan

Add:
- `tests/ui/WorkbenchShell.test.ts`
- `tests/ui/CollapsibleSection.test.ts`
- `tests/ui/CommandBar.test.ts`
- `tests/ui/PropertiesExplorer.test.ts`
- `tests/ui/ProjectionExplorer.test.ts`

Update:
- `tests/views/ViewManager.test.ts` — new shell mount path (ViewManager now receives `.workbench-view-content`)

Regression:
- SuperGrid test suite must remain green after Phase 1 DOM changes.
- No new React/Tailwind runtime dependencies (CI lint check recommended).

Acceptance criteria:
- Explorer state changes correctly update providers and drive view refresh via `StateCoordinator.scheduleUpdate()` only.
- No direct `SuperGrid` or `ViewManager` calls from explorer modules.
- Existing token and accessibility patterns preserved.
- Current test/type/build health remains green.

---

## 13. Resolved Decisions

All open decisions from v1 are resolved here. Do not re-open without a product discussion.

| # | Decision | Resolution | Rationale |
|---|---|---|---|
| 1 | Notebook explorer persistence | **Session-only in v1.** No writes to `IsometryDatabase`. | Deferred until native SwiftUI / `IsometryDatabase` actor migration is complete. Adding a web-side persistence path now would create a second competing write path. |
| 2 | Aggregation semantics | **Maps to query semantics immediately** (SQL GROUP BY / aggregate). | LATCH = SQL WHERE/GROUP BY is a foundational architecture principle. A visual-only aggregation would be a horseless carriage — an imitation of the concept without the actual capability. |
| 3 | Multi-theme switch | **Ship one canonical token-driven theme.** Multi-theme deferred to a later polish phase. | The token system already supports theming structurally. A runtime theme switcher is cosmetic scope at this stage and not required for v3.0. |

---

## 14. File-Level Implementation Checklist

- [ ] `src/ui/WorkbenchShell.ts`
- [ ] `src/ui/CollapsibleSection.ts`
- [ ] `src/ui/CommandBar.ts`
- [ ] `src/ui/NotebookExplorer.ts`
- [ ] `src/ui/PropertiesExplorer.ts`
- [ ] `src/ui/ProjectionExplorer.ts`
- [ ] `src/ui/LatchExplorers.ts`
- [ ] `src/styles/workbench-shell.css`
- [ ] `src/styles/explorers.css`
- [ ] `src/main.ts` — composition updates (ViewManager mount point change)
- [ ] New UI tests under `tests/ui/*`
- [ ] `tests/views/ViewManager.test.ts` — mount path update

---

*Spec Version: 2.0*  
*Based on Figma Make design intent, not implementation source code.*  
*v2 changes: DOM hierarchy specified (§4.1.1), StateCoordinator call-sites documented (§6), DnD contract separated from SuperGrid (§5.3.1), NotebookExplorer v1 scope narrowed (§5.1), CSS scoping rules added (§7.2), open decisions resolved (§13).*
