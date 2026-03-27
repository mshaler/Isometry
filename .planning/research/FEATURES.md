# Feature Research

**Domain:** Smart Defaults + Layout Presets + Guided Tour — adding dataset-aware default view configurations, named layout presets (panel visibility/order/size), and in-app guided tour to an existing local-first polymorphic data projection platform
**Researched:** 2026-03-27
**Confidence:** HIGH (grounded in PROJECT.md codebase inspection, web research on VS Code/Photoshop/Premiere Pro workspace systems, Notion/Airtable/Linear view defaults patterns, and product tour UX literature)

---

## Context: What Already Exists

This is an additive milestone on a fully shipped product. None of the surfaces being extended are being rebuilt — they are being augmented.

**Already shipped in Isometry:**
- 9 D3 views with full rendering pipelines (list, grid, kanban, calendar, timeline, gallery, network, tree, supergrid)
- WorkbenchShell with 6 collapsible explorer panels (Properties, Projection, Visual, LATCH, DataExplorer, Notebook, CalcExplorer)
- StateManager persists ui_state to sql.js (durable layer — survives sessions)
- PAFVProvider (row/column/filter/view axis configuration) with full serialization round-trip
- SchemaProvider introspects column names and LATCH family via PRAGMA — knows data shape
- 20 importable dataset types (alto-index 11 subtypes + 6 file formats + 3 native Apple sources)
- import_sources + import_runs catalog tables written by CatalogWriter
- CommandPalette (Cmd+K) with fuzzy search
- 5 design themes, ShortcutRegistry, empty states per view
- SidebarNav VisualizationExplorer is the sole view-switch UI (Cmd+1-9 shortcuts)

**The three features to add:**
1. **Dataset-aware default configs** — when a dataset is first activated, infer the right view + axis configuration from the data shape (calendar if date columns present, kanban if status column present, etc.)
2. **Named layout presets** — user-named snapshots of the WorkbenchShell panel state (which panels are open/collapsed/hidden, sizes) + active view + PAFVProvider axis config, saveable and restorable by name
3. **Guided in-app tour** — step-by-step tooltip annotations on the real UI, walkable from a "Take the tour" entry point, covering the core workflow: import → configure axes → switch views → use LATCH filters

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features expected in any data tool that adds smart defaults, workspace presets, or onboarding tours. Missing these makes the feature feel broken or incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Heuristic view selection on first import** — auto-select the most appropriate view type when a dataset is first activated (calendar for date-heavy data, kanban for status-column data, network for connection-heavy data, supergrid for tabular data with many fields) | Every modern data tool with multiple views (Airtable, Notion, Monday.com) defaults to a sensible view based on data shape rather than a static default. Users expect a calendar dataset to open in Calendar view. | MEDIUM | SchemaProvider already classifies LATCH families. Read `getAllAxisColumns()` and check for date/status/category fields. Map field presence → view type heuristic. Write inferred viewType to ui_state at first activation. |
| **Preset PAFV axis assignment on first import** — populate row/column/filter axes with sensible defaults (e.g. for a calendar import: row=date, column=card_type; for a task import: row=status, column=folder) | Users cannot discover an empty SuperGrid with no axes configured. Every tool that has configurable axes (Pivot tables in Excel/Sheets, Airtable grouped views) ships with reasonable default groupings. | MEDIUM | Uses existing PAFVProvider.setRowAxes() / setColAxes() / setFilterAxes() API. Runs once at dataset activation time if PAFVProvider has no user-saved config for this dataset. Must not override user-edited configs (check ui_state for existing serialized state first). |
| **Per-dataset state isolation** — each dataset remembers its own view + axis config independently | Switching datasets and returning preserves the layout you had for that dataset. Notion, Airtable, and Linear all scope view config per database/project. | HIGH | PAFVProvider currently serializes one flat ui_state key. Needs to namespace by dataset ID (import_sources.id). StateManager ui_state key convention change: `pafv:{datasetId}:rowAxes` instead of `pafv:rowAxes`. |
| **Save named layout preset** — a UI action (button or command palette entry) that captures the current WorkbenchShell panel state (open/collapsed/hidden) + active view + PAFV axes + column widths into a named snapshot | Adobe Photoshop, Premiere Pro, and DaVinci Resolve all have "Save Workspace As..." to create named panel arrangements. VS Code has File > Save Workspace As. This is a well-established professional tool pattern. | MEDIUM | Snapshot is a plain JSON object. Persist to ui_state under `preset:{presetName}:config`. Serialize: CollapsibleSection states, active view type, PAFVProvider axes, SuperGrid column widths (already in localStorage). |
| **Restore named layout preset** — one-click (or command palette) restore of any saved preset by name, snapping the shell + view + axes to the saved state | Save without restore is useless. All workspace preset systems include instant restore. VS Code lists presets in View > Appearances, Photoshop in Window > Workspace. | MEDIUM | Inverse of save: read preset JSON, call CollapsibleSection setters, ViewManager.setViewType(), PAFVProvider setState(), trigger re-render. |
| **Built-in starter presets** — 2-3 factory-provided named presets (e.g. "Focused" = all panels closed except VisualExplorer, "Analysis" = Projection + LATCH panels open, "Overview" = SuperGrid with no panels) shipped with the app | VS Code ships "Zen Mode," Figma ships "Design view" and "Prototype view." Users expect some curated starting points. Makes the preset system discoverable before users have made their own. | LOW | Hard-coded preset JSON objects in the codebase. Shown in the preset list with a "Built-in" badge (non-deletable). Same restore path as user presets. |
| **Preset list UI** — a panel section or command palette category listing all available presets (built-in + user-created) with apply and delete actions | Without a list, presets are not discoverable. The listing pattern exists in every workspace tool: VS Code's Quick Pick, Photoshop's Window > Workspace submenu. | LOW | New `PresetExplorer` section in WorkbenchShell sidebar, OR command palette category (reuses existing fuzzy search). Prefer command palette for minimal new UI surface. |
| **Tour entry point and opt-in launch** — a "Take the tour" button in the welcome empty state and in the command palette | Users must be able to find and launch the tour. Forcing the tour on every new user is an anti-pattern. The welcome state (0 cards) is the correct trigger surface. | LOW | `data-action="start-tour"` on welcome panel CTA. Command palette entry `"Take the tour"`. ShortcutRegistry can fire TourController.start(). |
| **3-5 tour steps with tooltip annotations on real UI elements** — step-through walkthrough anchored to real DOM elements (import button, Projection Explorer wells, SidebarNav view switcher, LATCH filters) covering the core workflow | Product tour research confirms 3-step tours have 72% completion rate vs longer tours. Steps must anchor to real UI elements (not fake overlays). The entire screen should NOT be dimmed — annotate the live interface. | MEDIUM | Tour steps are a JSON array: `[{target: '.data-explorer-import', title, body, position}]`. TourController positions a tooltip card adjacent to the target element, scrolls it into view, and advances on "Next" click. Overlay dims background optionally. |
| **Tour dismissal and "don't show again" persistence** — users can skip any step, exit early, and the tour never auto-starts again after explicit dismissal | Unwanted tours that reappear on every session destroy trust. ui_state key `tour:completed:v1` = true must gate auto-launch. | LOW | Write `tour:completed:v1` to ui_state on tour completion OR dismissal. Check this key at startup before showing tour CTAs. Increment suffix for major re-tours on new milestones. |
| **Tour progress indicator** — "Step 2 of 5" counter visible during the tour | Users need to know the tour length before committing. Progress bars yield 72% completion vs none. | LOW | Simple text counter in the tooltip card. No animated progress bar needed — text is sufficient and zero-dependency. |

### Differentiators (Competitive Advantage)

Features that go beyond standard workspace presets and onboarding tours. These exploit Isometry's unique architecture — PAFV axis configuration, SchemaProvider data awareness, sql.js persistence — in ways Notion, Airtable, and VS Code cannot replicate.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Dataset-type inference from CatalogWriter metadata** — use import_sources.source_type (the 20 known types: notes_json, markdown, excel, csv, alto_index, calendar, reminders, etc.) as the primary signal for default view, not just field name heuristics | Isometry already writes source_type to import_sources at import time. This is stronger signal than field name heuristics alone. A CalendarAdapter import always means date data — Calendar view default is guaranteed correct. Field name inference is a fallback for unknown sources. | LOW | Read `source_type` from import_sources for the dataset being activated. Map source_type → (view_type, axis_config) in a lookup table. Fallback to SchemaProvider field heuristics if source_type = 'json' or 'csv' (ambiguous). |
| **Named presets that include PAFV axis configuration** — presets snapshot not just panel visibility but the full PAFVProvider axis state (which fields are in which wells) so applying "Task Analysis" preset restores axes too | VS Code layout presets are panel positions only — they do not capture editor content state. Premiere Pro presets are panel visibility only. Isometry presets can capture axis semantics (the "what am I analyzing" question). This is unique to a PAFV system. | MEDIUM | Extend preset JSON to include `pafvState: { rowAxes, colAxes, filterAxes, viewAxes }`. On restore, call PAFVProvider.setState() with the preset pafvState. Axis names in presets are field names — warn (but do not fail) if the current dataset lacks those fields. |
| **Preset validation on restore** — when restoring a preset, validate axis field names against SchemaProvider for the current dataset; grey out or omit invalid axes silently | Most workspace systems crash or silently ignore invalid state on restore. Isometry already has StateManager field migration logic (v5.3) that filters unknown fields. Preset restore can reuse this migration path. | LOW | Run preset pafvState through the same migration logic as StateManager._migrateState(). Unknown axis fields are dropped, valid ones applied. Show a toast if any axes were dropped: "2 axis fields not available in this dataset." |
| **"Apply as default for this dataset type" option** — when saving a preset, option to mark it as the default for a source_type (e.g. "use this layout whenever a Reminders dataset is activated") | Notion templates assign default views per database type. Monday.com lets you set per-project-type defaults. Isometry can go further: presets can be typed to source_type. | MEDIUM | Extend preset JSON with optional `defaultForSourceType: string[]`. On dataset activation, check for a user preset with matching defaultForSourceType before falling back to built-in heuristics. |
| **Tour step targeting by data-gsd attribute** — tour targets resolve via data-tour-target attribute on DOM elements rather than CSS class selectors (classes change, data attributes are stable) | Product tour libraries that use CSS class selectors break on every visual refactor. data-attribute targeting is more stable. Isometry already uses data-attribute patterns throughout (data-view-mode, data-audit-state, data-theme). | LOW | Add `data-tour-target="import-trigger"`, `data-tour-target="projection-row-well"` etc. to the 5-8 UI elements the tour references. TourController resolves steps via `document.querySelector('[data-tour-target="X"]')`. |
| **Tour that adapts to current state** — if the user already has data imported, skip the "import data" step; if they already have axes configured, skip the "set up axes" step | Most product tours are scripted sequences that run the same steps regardless of user state. State-aware tours skip irrelevant steps and feel respectful of what users already know. | MEDIUM | Before starting tour, audit pre-conditions per step (e.g. `cards.count > 0` → skip import step). TourController builds a filtered steps array. Document in code: each step has an optional `skipIf: () => boolean` predicate. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Auto-launch tour on every first session** — show the tour automatically when the app opens with no data | Seems like a natural onboarding flow; "how will users know where to start?" | Research shows forced tours have lower completion rates than opt-in tours. Users who are exploring independently resent the interruption. The welcome panel with an explicit "Take the tour" CTA is more respectful and still highly visible. | Show "Take the tour" as a prominent CTA in the welcome empty state. Pair with a sample dataset "Quick start" button. Do not auto-launch. |
| **Tooltip tour that blocks the UI with a full-screen overlay** — darken everything except the targeted element (spotlight effect) | Spotlight overlays look polished and focus attention dramatically | Isometry's UI has many layers (SVG, canvas, fixed panels). A CSS overlay that correctly cuts out irregular shapes (WorkbenchShell panel borders, SVG nodes) is difficult to implement correctly. The overlay interaction model also disables all keyboard shortcuts during the tour, which breaks ShortcutRegistry. The simpler tooltip card approach (no overlay) works on real DOM and does not block keyboard navigation. | Tooltip card adjacent to target element with a pointer arrow. Light semi-transparent backdrop only if needed. Never full overlay. |
| **Preset sync via CloudKit** — user presets sync across devices alongside card data | Users work on multiple devices; naturally expect settings to sync | Presets are stored in ui_state, which lives in the local sql.js database. CloudKit sync sends CKRecord updates for card and connection rows, not arbitrary key-value pairs from ui_state. Extending CloudKit sync to cover ui_state would require a new record zone and conflict resolution strategy for settings, which is a large scope addition disproportionate to a preset feature. | Presets are local-first (consistent with Isometry's architecture). Export preset as JSON file (one additional command) for manual sharing across devices. Defer CloudKit ui_state sync to a dedicated sync milestone. |
| **Preset sharing / marketplace** — share preset configurations with other users, browse community-created presets | Notion and Airtable have template galleries; seems like a logical extension | Isometry is a local-first, single-user app. A sharing infrastructure requires a server, auth, a moderation layer, and significant UX work for a feature that is far beyond the current milestone scope. No user-generated content distribution system exists in Isometry. | Export preset as JSON file (shareable as a text file via any channel). Import preset from JSON file. File-based sharing is zero-infrastructure and consistent with the local-first philosophy. |
| **AI-suggested axis configuration** — "smart" defaults powered by an LLM that reads column names and suggests the best projection | Column name analysis for axis recommendation sounds valuable | Isometry already has SchemaProvider with LATCH heuristic classification (name patterns + type affinity). Rule-based heuristics cover the 90% case (date column → calendar view, status column → kanban) without network latency, privacy concerns, or LLM API dependencies. Isometry is a local-first app and should not require network calls for core features. | Extend SchemaProvider's existing heuristic logic with 10-15 more source_type / field-name patterns. Rule-based classification is deterministic, fast, and works offline. |
| **Infinite named presets with folder organization** — hierarchical preset tree with folders, tags, search | Power users with complex workflows may want this | The majority of users will have 2-5 presets. Folder hierarchy adds navigation complexity before the feature has proven value. Start flat. | Flat list of presets, sorted by most recently used. If users report having 10+ presets and needing organization, add folders in a follow-on. |
| **Animated tour transitions** — fancy crossfade/slide animations when advancing tour steps, spotlight circle expands | More polished-looking tour experience | Animation requires timed delays and CSS transitions coordinated with TourController state. It creates race conditions (user presses Next before animation completes), breaks on accessibility motion-reduce preferences, and adds test surface. MotionProvider (already shipped in v4.4) gates animations — but the correct answer here is: simple tooltip positioning is the feature, not the animation. | Instant step transitions. The tooltip repositions to the new target element immediately on "Next" click. Optionally fade the tooltip card itself (opacity only, 150ms — no layout shift). |

---

## Feature Dependencies

```
[SchemaProvider field introspection (already exists)]
    └──required by──> [Heuristic view selection on first import]
    └──required by──> [Preset PAFV axis assignment on first import]
    └──required by──> [Preset validation on restore]

[import_sources.source_type in CatalogWriter (already exists)]
    └──required by──> [Dataset-type inference from CatalogWriter metadata]
    └──enhances──> [Heuristic view selection on first import] (stronger signal than field names alone)

[PAFVProvider.setState() (already exists)]
    └──required by──> [Preset PAFV axis assignment on first import]
    └──required by──> [Named presets that include PAFV axis configuration]
    └──required by──> [Restore named layout preset]

[StateManager ui_state (already exists)]
    └──required by──> [Per-dataset state isolation] (namespace change to pafv:{datasetId}:*)
    └──required by──> [Save named layout preset] (storage backend)
    └──required by──> [Tour dismissal persistence] (tour:completed:v1 key)

[StateManager._migrateState() (already exists, v5.3)]
    └──required by──> [Preset validation on restore] (reuse migration logic for unknown fields)

[CollapsibleSection open/close API (already exists)]
    └──required by──> [Save named layout preset] (capture panel states)
    └──required by──> [Restore named layout preset] (apply panel states)

[WorkbenchShell panel structure (already exists)]
    └──required by──> [Named layout presets] (the thing being snapshotted)
    └──required by──> [Tour step targeting] (data-tour-target attributes added to panel elements)

[data-tour-target attributes (new, LOW complexity)]
    └──required by──> [Tour step tooltip positioning] (TourController resolution)
    └──required by──> [Tour that adapts to current state] (stable selectors for predicate checks)

[TourController (new)]
    └──required by──> [Tour entry point and opt-in launch]
    └──required by──> [3-5 tour steps with tooltip annotations]
    └──required by──> [Tour dismissal]
    └──required by──> [Tour progress indicator]
    └──required by──> [Tour that adapts to current state]
    NOTE: TourController has no dependency on preset system — these are parallel features.

[Per-dataset state isolation]
    └──required by──> ["Apply as default for this dataset type"]
    NOTE: Per-dataset isolation must come before dataset-typed defaults to avoid overwriting
    shared state when multiple datasets exist.

[Save/Restore named layout preset]
    └──required by──> ["Apply as default for this dataset type" option]
    NOTE: Typed defaults are just presets with an additional metadata field.
```

### Dependency Notes

- **Per-dataset state isolation is the highest-risk structural change:** Changing the ui_state key convention from flat (`pafv:rowAxes`) to namespaced (`pafv:{datasetId}:rowAxes`) affects StateManager, PAFVProvider serialization, and any existing persisted state. This must include a migration path for users upgrading from the current format. It is a prerequisite for dataset-aware defaults and preset-per-dataset behavior.
- **Heuristics require no new infrastructure:** SchemaProvider already classifies all fields. import_sources already records source_type. The heuristic lookup table is ~50 lines of switch/case logic. The work is defining the mapping, not building plumbing.
- **TourController is fully independent:** The tour has no data dependencies and no provider dependencies. It reads DOM elements via data-tour-target selectors and persists one flag to ui_state. It can be built in any phase without blocking other features.
- **Built-in presets should be shipped alongside the preset save/restore system:** They share the same restore code path and validate the preset format before user-created presets exist. Ship them together.
- **Preset export/import (JSON file) is table stakes for the anti-cloud concern:** Given CloudKit sync is deliberately excluded, file export is the safety valve. It should be in the same phase as save/restore.

---

## MVP Definition

### Launch With (Phase 1 — heuristics + presets working end-to-end)

- [ ] Per-dataset state isolation (namespaced ui_state keys with migration for existing state) — prerequisite for everything else in this milestone
- [ ] Dataset-type heuristic view selection on first activation (source_type → view_type lookup table)
- [ ] Preset PAFV axis defaults on first activation (source_type → axis_config lookup table)
- [ ] Save named layout preset (panel states + view type + PAFV axes → ui_state)
- [ ] Restore named layout preset (read from ui_state → apply to shell + providers)
- [ ] Built-in starter presets (2-3 factory presets: Focused / Analysis / Overview)
- [ ] Preset list in command palette (new category "Presets" in Cmd+K)
- [ ] Preset export as JSON file / import from JSON file

### Add After Validation (Phase 2 — tour + typed defaults)

- [ ] data-tour-target attributes on 6-8 key UI elements
- [ ] TourController with 4-5 state-aware tour steps
- [ ] Tour entry point in welcome empty state + command palette
- [ ] Tour dismissal + `tour:completed:v1` persistence
- [ ] Tour progress counter ("Step N of M")
- [ ] "Apply as default for this dataset type" option on preset save

### Future Consideration (Phase 3+)

- [ ] Preset validation toast ("N fields not available in current dataset")
- [ ] Inline PresetExplorer panel in WorkbenchShell (if command palette list proves insufficient)
- [ ] Per-step skipIf predicates for full state-aware tour (Phase 2 ships static steps)
- [ ] Preset JSON file share-by-drag-drop integration with DataExplorer import surface

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Per-dataset state isolation | HIGH — required for multi-dataset workflows | HIGH — key convention migration, all provider serialization | P1 |
| Heuristic view selection on first import | HIGH — first impression of new dataset | LOW — 50-line lookup table using existing SchemaProvider | P1 |
| Preset PAFV axis defaults on first import | HIGH — empty SuperGrid is confusing | LOW — same lookup table, PAFVProvider.setState() | P1 |
| Save named layout preset | HIGH — core preset system | MEDIUM — snapshot CollapsibleSection + PAFVProvider state | P1 |
| Restore named layout preset | HIGH — save is useless without restore | MEDIUM — inverse of save, apply to all providers | P1 |
| Built-in starter presets | MEDIUM — discoverability of preset system | LOW — 3 hard-coded JSON objects | P1 |
| Preset list in command palette | MEDIUM — discovery surface | LOW — new category in existing Cmd+K fuzzy search | P1 |
| Preset JSON export/import | MEDIUM — safety valve for no-cloud policy | LOW — JSON.stringify/parse + file picker | P1 |
| data-tour-target attributes | HIGH (prerequisite) — stable tour anchors | LOW — add 6-8 data attributes to existing elements | P2 |
| TourController + 4-5 steps | HIGH — onboarding path for new users | MEDIUM — tooltip positioning, step state machine | P2 |
| Tour entry point + dismissal persistence | HIGH — opt-in launch + no-spam guarantee | LOW — welcome panel CTA + one ui_state key | P2 |
| "Apply as default for this dataset type" | MEDIUM — power user quality of life | LOW — one extra metadata field on preset JSON | P2 |
| Preset validation toast on restore | LOW — nice error feedback | LOW — reuse StateManager migration logic | P3 |
| State-aware tour step skipping | MEDIUM — respectful onboarding | MEDIUM — skipIf predicates per step | P3 |

**Priority key:**
- P1: Phase 1 — heuristics and presets
- P2: Phase 2 — tour and typed defaults
- P3: Phase 3+ — polish and edge cases

---

## Competitor Feature Analysis

| Feature | VS Code | Photoshop / Premiere Pro | Notion / Airtable | Isometry Approach |
|---------|---------|--------------------------|-------------------|-------------------|
| Smart defaults on new file | No per-file-type defaults; global defaults only | No; all new files open with the same workspace | View defaults per database type (board groups by status, calendar groups by date) | source_type lookup table in CatalogWriter metadata; SchemaProvider field heuristics as fallback |
| Named presets | "Save Workspace As..." (panel positions only, per-workspace folder) | "Save Workspace As..." (panel positions + tool options, global) | No user-named layout presets; templates are whole-database snapshots | Presets capture panel state + active view + PAFV axes; stored in sql.js ui_state; global (not per-dataset) |
| Preset scope | Per-workspace folder | Global across all projects | Per-database (implicit, not named) | Global named presets + optional typed default per source_type |
| Preset content | Panel positions only | Panel positions + tool options | View config (filter/sort/group) per named view tab | Panel visibility/collapse state + active view type + PAFVProvider axis state |
| Built-in starter presets | Yes (VS Code: Zen Mode, Minimal; Premiere: Assembly/Color/Audio/etc.) | Yes (Photography, Painting, Web, etc.) | Yes (table/board/calendar as view type options) | Focused / Analysis / Overview — 3 factory presets |
| Product tour | No | No | Yes, modal onboarding cards on first use | Opt-in tooltip tour anchored to real DOM elements; state-aware step skipping |
| Tour dismissal | N/A | N/A | Dismiss on click, never shown again | `tour:completed:v1` key in ui_state; opt-in relaunch via command palette |
| Export/import presets | Manual .code-workspace file sharing | Manual .psw file export | No | JSON export/import via DataExplorer file picker |

---

## Sources

- [VS Code Custom Layout docs](https://code.visualstudio.com/docs/configure/custom-layout) — panel arrangement, Customize Layout, Save Workspace As patterns (HIGH confidence — official docs)
- [VS Code Workspace docs](https://code.visualstudio.com/docs/editing/workspaces/workspaces) — workspace vs global layout scope (HIGH confidence — official docs)
- [Photoshop Save Custom Workspaces](https://helpx.adobe.com/photoshop/desktop/get-started/learn-the-basics/save-custom-workspaces.html) — named workspace save/restore pattern (HIGH confidence — official docs)
- [Premiere Pro Workspaces](https://helpx.adobe.com/premiere-pro/using/workspaces.html) — preset named workspaces (Assembly/Color/Audio), Reset Workspace (HIGH confidence — official docs)
- [Notion Views, Filters, Sorts & Groups](https://www.notion.com/help/views-filters-and-sorts) — default view config per property type; board groups by status, calendar groups by date (HIGH confidence — official docs)
- [Notion When to Use Each View Type](https://www.notion.com/help/guides/when-to-use-each-type-of-database-view) — view selection guidance by data shape (HIGH confidence — official docs)
- [Appcues Product Tour UX Patterns](https://www.appcues.com/blog/product-tours-ui-patterns) — tooltip types, action-driven vs passive, completion rates (MEDIUM confidence — industry SaaS, WebSearch verified)
- [WhatFix Product Tours 2025](https://whatfix.com/product-tour/) — 3-5 steps for best completion rates, progressive disclosure, hotspot patterns (MEDIUM confidence — WebSearch, product onboarding tool vendor)
- [Userpilot Product Tour Patterns](https://userpilot.com/blog/create-product-tours/) — opt-in vs forced, tooltip positioning, skip/dismiss patterns (MEDIUM confidence — WebSearch, product onboarding tool vendor)
- [UI Patterns: Guided Tour](https://ui-patterns.com/patterns/Guided-tour) — canonical pattern definition; overlay vs tooltip approaches, keyboard accessibility (MEDIUM confidence — WebSearch, pattern library)
- Isometry PROJECT.md — confirmed shipped infrastructure: StateManager ui_state, SchemaProvider PRAGMA introspection, CatalogWriter import_sources, CollapsibleSection, PAFVProvider.setState(), ShortcutRegistry, CommandPalette (HIGH confidence — direct codebase inspection)

---

*Feature research for: Smart Defaults + Layout Presets + Guided Tour (Isometry next milestone)*
*Researched: 2026-03-27*
