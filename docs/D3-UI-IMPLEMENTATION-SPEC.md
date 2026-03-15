# Isometry D3 UI Implementation Spec (From Figma Make)

Date: 2026-03-07  
Source design: `https://www.figma.com/make/aRUksAazmRiAvzJabzqsSG/Isometry-v5-Design`  
Scope: Translate Figma Make UI (ignoring React-specific scaffolding) into Isometry’s existing D3/DOM architecture.

## 1. Objectives

- Implement the new shell + explorer-driven UI from Figma in plain TypeScript + D3/DOM (no React runtime).
- Reuse existing Isometry architectural patterns:
  - Theme + token system: `src/styles/design-tokens.css`
  - View lifecycle and update model: `src/views/ViewManager.ts`
  - SuperGrid rendering model and interaction idioms: `src/views/SuperGrid.ts`
  - Existing overlays/toasts/menus where possible: `src/ui/*`, `src/shortcuts/*`
- Preserve current performance characteristics (especially SuperGrid), avoid large rewrite churn.

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
- Theme variants in design include multiple styles, but Isometry should map them onto existing token system rather than importing Make’s theme engine.

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

## 4. Architecture Integration

## 4.1 New Shell Controller

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

## 4.2 Collapsible Section Primitive

Create:
- `src/ui/CollapsibleSection.ts`

Pattern:
- Match Make `CollapsibleExplorer` behavior with existing tokenized styles.
- Reusable for Notebook/Properties/Projection/Visual/Time explorers.

API:
- `constructor(opts: { title: string | HTMLElement; defaultCollapsed?: boolean; fillRemaining?: boolean })`
- `mount(container: HTMLElement): void`
- `setCollapsed(v: boolean): void`
- `onToggle(cb: (collapsed: boolean) => void): () => void`
- `getBodyEl(): HTMLElement`

## 4.3 Command Bar

Create:
- `src/ui/CommandBar.ts`

Features:
- Left app icon/menu trigger.
- Command input (placeholder `Command palette...`).
- Right settings/menu trigger.

Integration:
- Reuse or extend `ShortcutRegistry` + HelpOverlay discovery entry points.
- Menu actions should route into existing app actions (import, view switch, preferences stubs) without introducing new state stores.

## 5. Explorer Modules

Each explorer should be an isolated module with `mount/destroy/update` API.

## 5.1 Notebook Explorer

Create:
- `src/ui/NotebookExplorer.ts`

Behavior:
- Split pane: markdown editor + preview.
- Lightweight formatting toolbar.
- Optional D3 preview region for embedded chart blocks.

Implementation notes:
- Keep parser/rendering minimal in v1 (no full markdown engine migration required if existing deps absent).
- D3 preview can start with simple supported chart schema (`bar`), matching Make concept.

## 5.2 Properties Explorer

Create:
- `src/ui/PropertiesExplorer.ts`

Behavior:
- Six grouped columns by LATCH axis families.
- Per-property toggle checkbox.
- Inline display name edit.
- Column collapse/expand.
- Count badges per axis group.

Data source:
- Property catalog should be derived from provider metadata (not static mock data).

Events:
- `property:toggled`
- `property:renamed`
- `axis:group-collapsed`

## 5.3 Projection Explorer

Create:
- `src/ui/ProjectionExplorer.ts`

Behavior:
- Four wells: available, x, y, z.
- Drag/drop property chips between wells.
- Reorder within well.
- Z controls:
  - display property select
  - audit toggle
  - card density select
  - aggregation mode select

State mapping (must use existing providers):
- wells -> `PAFVProvider` stacked axes
- audit toggle -> existing audit state
- density/aggregation -> `DensityProvider`/SuperGrid-compatible state

DnD implementation:
- Reuse existing SuperGrid drag/drop idioms where practical:
  - dataset payload + event delegation
  - guard rails for duplicates and min-axis constraints

## 5.4 Visual Explorer

Current SuperGrid stays core. Extend wrapper behavior only.

Behavior:
- Left vertical rail slider for zoom/pan affordance.
- Main area hosts existing `SuperGrid`.
- Transpose and axis labels remain in SuperGrid corner cell.

Mapping:
- Slider updates `SuperPositionProvider.zoomLevel` (already integrated in SuperGrid).
- No secondary visualization implementation in explorer container.

## 5.5 LATCH / Time Explorer

Create:
- `src/ui/LatchExplorers.ts` (or `TimeExplorerPanel.ts`)

Behavior (phased):
- Phase A: skeleton + controls wired to filters (location, alpha, time, category, hierarchy).
- Phase B: richer subpanes (histogram scrubber, category chips, hierarchy band).

Important:
- Keep semantics aligned with existing filter/query pipeline.
- Do not introduce parallel filtering stack.

## 6. Styling & Design System Mapping

Use existing tokens in `src/styles/design-tokens.css`.

## 6.1 Token Mapping Rules

- `theme.colors.background` -> `var(--bg-primary)`
- `theme.colors.surface` -> `var(--bg-secondary)` / section surfaces
- `theme.colors.surfaceElevated` -> `var(--bg-surface)`
- `theme.colors.border` -> `var(--border-muted)` or `var(--border-subtle)` by density
- `theme.colors.text` -> `var(--text-primary)`
- `theme.colors.textSecondary` -> `var(--text-secondary)`
- `theme.colors.textMuted` -> `var(--text-muted)`
- `theme.colors.primary/focus` -> `var(--accent)`

Typography:
- Use existing scale only: `--text-xs`, `--text-sm`, `--text-base`, `--text-md`, `--text-lg`.

## 6.2 CSS Files

Create:
- `src/styles/workbench-shell.css`
- `src/styles/explorers.css`

Keep:
- `src/styles/supergrid.css`
- `src/styles/views.css`
- `src/styles/accessibility.css`

No Tailwind classes in runtime code.

## 7. D3/DOM Implementation Pattern

Use a consistent pattern per module:
- Container creation once in `mount`.
- D3 `selection.join(...)` for list-like repeated structures (chips, rows, menu items).
- Event delegation for high-frequency dynamic content.
- Explicit `destroy` cleanup for document/window listeners.

Performance:
- Avoid rebuilding whole explorer DOM on every provider update.
- Incremental update methods:
  - `updateProperties(...)`
  - `updateWells(...)`
  - `updateControls(...)`

## 8. Interaction Contracts

## 8.1 Command & Menus

- App menu actions emit typed events consumed by `main.ts` composition layer.
- No direct calls to bridge/provider from deeply nested menu DOM handlers.

## 8.2 Projection Editing

- Drag source payload:
  - `propertyId`, `sourceWell`, `sourceIndex`
- Drop target:
  - `targetWell`, optional `targetIndex`
- Validation:
  - prevent duplicate axis insertion
  - maintain required minimum axis counts where applicable

## 8.3 SuperGrid Linkage

- Any well/control change must flow through providers + `StateCoordinator.scheduleUpdate()`.
- SuperGrid remains subscriber-driven; no direct ad-hoc query trigger from explorer modules.

## 9. Accessibility & Keyboard

Must-haves:
- `:focus-visible` ring usage via existing accessibility styles.
- Collapsible headers keyboard operable (`Enter`/`Space`).
- Menu keyboard navigation baseline (arrow/down + escape) for command/settings menus.
- Proper ARIA roles for menus, listbox/select-like controls where custom.

## 10. Rollout Plan

## Phase 1: Shell Scaffolding (Low Risk)
- Add `WorkbenchShell`, `CollapsibleSection`, `CommandBar`.
- Mount around existing `ViewManager` + current views.
- Keep old UI controls active where needed.

## Phase 2: Properties + Projection Explorers
- Implement explorers with provider wiring.
- Replace legacy scattered control surfaces.
- Add unit tests for move/reorder/toggle flows.

## Phase 3: Visual + Time Explorer Integration
- Add zoom rail wrapper and LATCH explorer panel.
- Wire filter interactions.
- Validate no regression in SuperGrid performance and behavior.

## Phase 4: Notebook Explorer and Polish
- Add notebook pane with markdown + D3 preview.
- Final spacing/typography polish and keyboard pass.

## 11. Test Plan

Add:
- `tests/ui/WorkbenchShell.test.ts`
- `tests/ui/CollapsibleSection.test.ts`
- `tests/ui/CommandBar.test.ts`
- `tests/ui/PropertiesExplorer.test.ts`
- `tests/ui/ProjectionExplorer.test.ts`

Integration:
- `tests/views/ViewManager.test.ts` updates for new shell mount path.
- SuperGrid regression checks remain in existing suite.

Acceptance criteria:
- Explorer state changes correctly update providers and drive view refresh.
- No React/Tailwind runtime dependency introduced.
- Existing token and accessibility patterns preserved.
- Current test/type/build health remain green outside ETL WIP scope.

## 12. File-Level Implementation Checklist

- [ ] `src/ui/WorkbenchShell.ts`
- [ ] `src/ui/CollapsibleSection.ts`
- [ ] `src/ui/CommandBar.ts`
- [ ] `src/ui/NotebookExplorer.ts`
- [ ] `src/ui/PropertiesExplorer.ts`
- [ ] `src/ui/ProjectionExplorer.ts`
- [ ] `src/ui/LatchExplorers.ts`
- [ ] `src/styles/workbench-shell.css`
- [ ] `src/styles/explorers.css`
- [ ] `src/main.ts` composition updates
- [ ] New UI tests under `tests/ui/*`

## 13. Open Decisions (Need Product/Design Confirmation)

- Should Notebook explorer persist note content in app state or remain session-only initially?
- Is aggregation mode in Projection explorer purely visual for now, or must it map to query aggregation semantics immediately?
- Do we ship one canonical theme (token-driven) now, or preserve a selectable multi-theme switch from Make?

---
This spec intentionally treats Figma Make output as design intent, not implementation source code.
