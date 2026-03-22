# Handoff: UAT Bugs + Design Workbench Restructure
**Source:** Isometry UAT Notes (March 2026)
**Target:** Claude Code (CC)
**Status:** Ready for implementation

---

## Context

This handoff translates UAT field notes into actionable CC work items. It covers two tracks:

- **Track A — Bug Fixes:** Two cross-cutting regressions that need immediate resolution
- **Track B — Design Workbench Restructure:** Significant layout, navigation, and UX changes across the shell and all Explorer panels

Work items are ordered by dependency. Track A should be verified before Track B begins.

---

## Track A — Bug Fixes (Resolve First)

### A1: Expand/Collapse Chevrons Not Collapsing Sections

**Symptom:** Clicking a chevron toggle in any sidebar or explorer panel updates chevron icon state but does not actually collapse the section content vertically. The panel remains fully expanded.

**Likely root cause:** The chevron is wired to a visual state variable (icon rotation) but the container's `height` or `display` is not bound to the same state. The collapse animation or conditional render is missing or disconnected.

**Acceptance criteria:**
- [ ] Clicking a collapsed chevron expands the section and content is visible
- [ ] Clicking an expanded chevron collapses the section — content is hidden and takes zero vertical space
- [ ] Chevron rotates correctly in both directions
- [ ] Collapse/expand is animated (150–200ms ease) — no jarring snap
- [ ] State persists per-section during the session (expanding one section does not collapse another unless they are in an accordion group — clarify with Michael if accordion behavior is intended)

---

### A2: Dataset Bleed Between Views

**Symptom:** When switching datasets (e.g., via Command-K into Northwind), the previous dataset's nodes remain visible in the grid, producing a mixed/interleaved view. The Projection Explorer also shows axis properties (`card_type`, `folder`) that belong to the old dataset, not Northwind.

**This is the most serious bug in the UAT.** It indicates that dataset loading is append-only rather than replace — the prior in-memory state is not being evicted before the new query runs.

**Likely root cause options (investigate in order):**
1. The query pipeline runs against the new dataset but the D3 data join is `enter()`-only — old nodes are not `exit()`-removed before the new render
2. The Projection Explorer's axis configuration is not reset when a new dataset loads — it retains the previous PAFV axis-to-plane mappings
3. The sql.js query runs correctly but the result is merged into an existing array rather than replacing it

**Acceptance criteria:**
- [ ] Loading a new dataset via Command-K completely evicts the prior dataset from all active views before rendering the new one
- [ ] Projection Explorer x-plane and y-plane reset to the new dataset's intrinsic properties when a new dataset loads
- [ ] SuperGrid shows only Northwind data after a Northwind Command-K load — no synthetic data visible
- [ ] If the eviction takes >100ms, a loading state is shown so the user does not see a flash of the old data
- [ ] Regression test: load Dataset A → Command-K load Dataset B → confirm zero rows from Dataset A appear in any view

---

## Track B — Design Workbench Restructure

This track implements significant structural changes to the shell layout, sidebar navigation, and individual Explorer panels. Read all sections before beginning implementation — there are dependencies between them.

---

### B1: Menubar Reorganization

**Changes:**

1. **Left zone:** Panel selector, Import button, Cloud sync status indicator (already present — verify positioning)
2. **Center zone:** Remove the Settings gear icon. Replace the current window title with the string `"Isometry"` (static, centered). Make the existing settings icon (to the right of Command Palette) larger — increase by ~1.5× to improve tap/click target
3. **View Switcher:** Remove from Menubar entirely. Move to the top of the Visualization Explorer panel (see B3-Viz for placement)

**Acceptance criteria:**
- [ ] Center of Menubar shows "Isometry" wordmark, not settings gear
- [ ] Settings icon to the right of Command Palette is noticeably larger (suggestion: 24px → 36px icon)
- [ ] View Switcher is absent from Menubar
- [ ] No visual gap or layout shift where View Switcher was removed

---

### B2: Sidebar — Full Navigation Restructure

The sidebar is the primary navigation shell. Each item is a launcher: icon on the left, label text to the right, toggled/highlighted state when active.

**New sidebar structure (implement in this order, top to bottom):**

```
1. Data Explorer
   └─ Catalog / CAS
   └─ Extensions

2. Properties Explorer

3. Projection Explorer

4. Visualization Explorer
   └─ List
   └─ Gallery
   └─ Kanban
   └─ Grid
   └─ SuperGrid
   └─ Map
   └─ Timeline
   └─ Charts
   └─ Graphs

5. LATCH Explorers
   └─ Location Explorer  (Map)
   └─ Alphanumeric Explorer  (Search)
   └─ Time Explorer
   └─ Category Explorer  (Property)
   └─ Hierarchy Explorer  (Projection)

6. GRAPH Explorers
   └─ Path
   └─ Centrality
   └─ Community
   └─ Similarity
   └─ Link
   └─ Embed

7. Formula Explorer
   └─ DSL Formulas
   └─ SQL Queries
   └─ Graph Queries
   └─ Audit View

8. Interface Builder
   └─ Formats
   └─ Templates
   └─ Apps
```

**Implementation notes:**
- Top-level items are collapsible sections (fix A1 first)
- Sub-items are leaf launchers — clicking navigates to that panel/view
- Active item: icon + label highlighted (use existing active state style or define one)
- LATCH Explorers and GRAPH Explorers are new groupings — they surface existing functionality under the LATCH/GRAPH taxonomy explicitly for the first time

**Acceptance criteria:**
- [ ] All 8 top-level sections present in correct order
- [ ] All sub-items present under each section
- [ ] Each top-level section collapses/expands (uses A1 fix)
- [ ] Active state visually distinct for both icon and label
- [ ] Clicking a leaf item activates the corresponding panel/view and sets its sidebar item to active

---

### B3: Visualization Explorer — ViewZipper + View Switcher

The View Switcher is moving from the Menubar into the top of the Visualization Explorer panel. When it lands here, it becomes the **ViewZipper**.

**ViewZipper behavior:**
- Shows all available view types as tabs/buttons (List, Gallery, Kanban, Grid, SuperGrid, Map, Timeline, Charts, Graphs)
- Clicking a view type switches the main canvas to that view
- **Play button:** When pressed, automatically cycles through each view in sequence with D3.js transitions. Each view should hold for ~2 seconds before transitioning to the next. The transitions should visually "follow the cards" — nodes animate from their position in the current view to their position in the next view (PAFV remapping animation)
- Play button toggles to a Stop button while cycling; pressing Stop freezes on the current view

**Acceptance criteria:**
- [ ] ViewZipper renders at the top of the Visualization Explorer panel
- [ ] All 9 view types are represented
- [ ] Clicking any view type switches the canvas view
- [ ] Play button initiates auto-cycling through views
- [ ] D3 transitions animate card positions between views (not a hard cut)
- [ ] Stop button halts cycling and holds current view
- [ ] ViewZipper is absent from Menubar

---

### B4: Data Explorer — Panel Definition

The Data Explorer panel contains four functional areas:

1. **Import / Export / ETL** — file import, export controls, ETL pipeline triggers
2. **Catalog / CAS / MCP** — see detailed spec below
3. **Apps** — Datasets + Views + Controls compositions (app definitions)
4. **Database Utilities** — dump, purge, restore, performance diagnostics

---

#### B4-Catalog: The Introspective Dataset View

**Conceptual model:** The Catalog is not a bespoke dataset-picker widget. It is a **SuperGrid (or user-configured view) pointed at the app's own dataset registry as its data source.** The "rows" are datasets; their Card properties are dataset metadata (name, card count, schema, last modified, source type, etc.). Switching the active dataset is the same interaction as selecting any Card anywhere in the app.

This makes the Catalog the first instance of **Isometry reflecting on itself** — the internal dataset registry surfaced through the same PAFV view engine used for all domain data. Do not implement this as a special-case UI component. Implement it as a view binding against a `datasets` internal table (or equivalent registry).

**Data source:** An internal `datasets` table (or equivalent) that the app maintains automatically. Each row represents one known dataset. Columns at minimum:

| Column | Type | Description |
|--------|------|-------------|
| `name` | text | Human-readable dataset name |
| `source_type` | text | e.g., `alto-index`, `northwind`, `apple-notes`, `csv` |
| `card_count` | integer | Number of cards in the dataset |
| `last_modified` | timestamp | When the dataset was last written to |
| `is_active` | boolean | Whether this is the currently loaded dataset |

**View behavior:**
- Default view is SuperGrid, but the user should be able to switch to any configured view (the Catalog obeys ViewZipper like any other data surface)
- The first row is always the **alto-index** (Isometry's own synthetic seed dataset / demo data)
- Selecting (clicking) a Card row sets that dataset as active in the main canvas — this triggers the same eviction path as Command-K (A2 fix)
- The active dataset Card should be visually distinguished (highlighted row, or `is_active` property rendered as a badge)

**Acceptance criteria:**
- [ ] Catalog renders as a view (SuperGrid by default) bound to the internal dataset registry
- [ ] Each dataset is a Card with at minimum: name, source type, card count, last modified
- [ ] Alto-index is always the first Card
- [ ] Clicking a dataset Card loads it into the main canvas and evicts the prior dataset (uses A2 fix)
- [ ] Active dataset is visually distinguished
- [ ] View type is user-switchable (Catalog obeys ViewZipper)
- [ ] **No bespoke picker widget** — this is a standard view binding, not a custom component

---

**Acceptance criteria (rest of B4):**
- [ ] Data Explorer panel has four distinct sections in the order listed
- [ ] Database Utilities section exposes at minimum: dump, purge, restore, performance info

---

### B5: SuperGrid — Three Specific Fixes

These are distinct from A2 (dataset bleed) though related. Address A2 first, then these.

**B5a: Display Pop-up — Property Depth Doesn't Update**

The Display pop-up has a "Property Depth of Cards" control (or similar label). When changed, the SuperGrid should re-render cards showing the selected depth of properties. Currently the control stays locked on "Title" regardless of selection.

*Acceptance criteria:*
- [ ] Changing Property Depth in Display pop-up re-renders cards with correct depth
- [ ] At depth 0 (Title only): cards show only the card name
- [ ] At depth 1: cards show name + one level of properties
- [ ] At deeper depths: additional properties render as configured
- [ ] Control reflects current state on open — does not reset to "Title" each time

**B5b: Row Headers — Abbreviation and Resize**

Row headers are truncating to first initial + period (e.g., "M." instead of the full value). Additionally, row headers cannot be horizontally resized.

*Acceptance criteria:*
- [ ] Row headers display full text by default (no truncation to initials)
- [ ] If text overflows the column width, truncate with ellipsis (not abbreviation)
- [ ] Row header columns are horizontally resizable via drag
- [ ] Minimum width enforced (e.g., 80px) to prevent collapse to zero

**B5c: Command-K Dataset Load — Eviction Confirmation (UX)**

When loading Northwind via Command-K, there is no clear signal that the previous dataset has been evicted. The user cannot tell if the new data is loaded correctly or if old data is still present.

*Acceptance criteria:*
- [ ] When a new dataset loads via Command-K, SuperGrid briefly shows a loading state (spinner or skeleton rows)
- [ ] After load completes, the dataset name is visible somewhere in the SuperGrid header or toolbar (e.g., "Northwind Traders")
- [ ] Projection Explorer axis labels update to reflect the new dataset's properties immediately after load

---

### B6: Notebook — Card Creation Verification

**Symptom:** When creating notes in Notebook view, it is unclear whether a Card is actually being persisted to the database.

**Required:** Database Utilities (B4) must include a card count or recent-cards viewer that lets Michael verify cards are being written. This is a diagnostics ask, not necessarily a Notebook bug — but the Notebook flow should write to the database and the utilities should confirm it.

**Acceptance criteria:**
- [ ] Database Utilities shows current card count (total and by type)
- [ ] After creating a card in Notebook, card count increments
- [ ] Optionally: "Recent cards" view in utilities shows the last N cards written with timestamps

---

### B7: Theme System — Missing Themes + Laggy Switching

**Symptom:** Modern, NeXTSTEP, and Material themes appear to be missing from the theme selector. Light/dark switching is present but laggy.

**Acceptance criteria:**
- [ ] Theme selector includes at minimum: NeXTSTEP, Modern, Material (in addition to any existing options)
- [ ] Selecting a theme applies it immediately — no perceptible lag (target: <100ms to full repaint)
- [ ] Light/dark toggle is not laggy — if the lag is from a CSS variable cascade, profile and optimize
- [ ] Active theme persists across app restarts (already in settings table as `theme` key)

---

## Implementation Order

```
A1 (chevron collapse)
  ↓
A2 (dataset eviction)
  ↓
B1 (menubar)  ←→  B2 (sidebar restructure)   [can run in parallel]
  ↓
B4 (Data Explorer + Catalog)
  ↓
B5a, B5b, B5c (SuperGrid fixes)   [can run in parallel]
  ↓
B3 (ViewZipper)
  ↓
B6 (Notebook/DB utilities)
B7 (themes)   [independent — can run any time after A2]
```

---

## Permanent Out of Scope (This Handoff)

| Item | Reason |
|------|--------|
| LATCH/GRAPH Explorer internal implementations | Navigation structure only — content TBD in future handoffs |
| Interface Builder (Formats/Templates/Apps) | Structure present in sidebar; full implementation is post-v3.0 |
| ViewZipper physics/spring tuning | Functional animation required; tuning is polish |
| CloudKit sync in Data Explorer | Status indicator only; full sync is separate milestone |

---

## Success Criteria Checklist

Before closing this handoff:
- [ ] A1: Chevrons collapse sections vertically
- [ ] A2: Zero dataset bleed confirmed via regression test
- [ ] B1: Menubar matches spec
- [ ] B2: Sidebar has all 8 sections and sub-items, active state works
- [ ] B3: ViewZipper in Viz Explorer with Play/Stop
- [ ] B4: Data Explorer 4-section layout, Catalog as Cards
- [ ] B5a: Display pop-up Property Depth updates correctly
- [ ] B5b: Row headers show full text, are resizable
- [ ] B5c: Dataset name shown after Command-K load
- [ ] B6: DB Utilities confirms card creation
- [ ] B7: Three themes present, no switching lag

---

*Handoff authored: March 2026*
*From: UAT field notes → CC implementation spec*
