# Phase 52: Sample Data + Empty States - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

First-time users can explore the app immediately with curated sample data, and every empty state guides them toward the next productive action. Three real-world demo datasets ship bundled as static JSON. Welcome panel is redesigned to lead with exploration. Sample data is tagged, sync-excluded, and clearable via command palette.

</domain>

<decisions>
## Implementation Decisions

### Sample data content
- Three curated demo datasets (not generic placeholders):
  1. **Apple historical revenue** — product family evolution over time
  2. **Northwind graph** — graph-focused update of the classic demo (SQL already written)
  3. **Meryl Streep film career** — graph/timeline format (SQL already written)
- Each dataset varies in natural size (not constrained to ~25 cards each)
- All LATCH axes fully populated per card (category, time, hierarchy, location, alphabet)
- Connections curated for visual impact — deliberately include hub nodes, clusters, and chains so NetworkView and TreeView look impressive
- Data bundled as static JSON files (one per dataset, ~3-5KB each), loaded via INSERT into sql.js
- Existing SQL needs transformation/mapping to Isometry card schema during research/planning

### Loading & discovery UX
- "Rotating default + browse" pattern: one dataset is pre-selected, dropdown chevron reveals the other two
- Button format: `Try: Apple Revenue ▾` — clicking loads immediately, chevron opens picker for Northwind / Meryl Streep
- Sample data CTA appears ABOVE import buttons on the welcome panel (hero position)
- Instant transition on load: INSERT into sql.js, re-render, no loading indicator (sub-100ms for these sizes)
- After loading, navigate to the dataset-specific best view:
  - Apple Revenue → Timeline
  - Northwind → Network
  - Meryl Streep → Timeline
- Each dataset's JSON includes a `defaultView` field specifying its showcase view

### Lifecycle & cleanup
- Sample cards use `source='sample'` and `source_id='dataset-name:card-id'` — fits existing ETL source/source_id pattern
- AuditOverlay already tracks source, so sample cards are visually identifiable in audit mode
- CloudKit sync exclusion: filter at sync boundary — `export-all-cards` query adds `WHERE source != 'sample'`
- No confirmation dialog when clearing — sample data is ephemeral, just clear instantly
- "Clear Sample Data" discoverable via command palette only (Actions category, visible when source='sample' cards exist)
- On first real import while sample data is loaded: prompt user "Clear sample data?" with Yes/No
- Sample cards and real cards can coexist if user declines the prompt

### Empty state CTAs
- Welcome panel (zero cards) redesigned: "Explore Isometry" heading, sample data button is hero CTA, import buttons are secondary below ("Or import your own data")
- Filtered-empty state: keep as-is from Phase 43 (VIEW_EMPTY_MESSAGES + Clear Filters button already satisfies EMPTY-02/03)
- Welcome panel reappears whenever card count drops to zero (no special "returning user" state)

### Claude's Discretion
- Default dataset rotation order/logic
- Exact dropdown component implementation for dataset picker
- Card schema mapping details for each dataset (during research)
- Exact copy for the import prompt when sample data is present

</decisions>

<specifics>
## Specific Ideas

- User has SQL already written for Northwind and Meryl Streep datasets — these need mapping to Isometry's card/connection schema
- Apple Revenue dataset covers product family evolution (iPod → iPhone → Services, etc.) — natural timeline + hierarchy
- Connections should be topology-conscious: hub nodes for major product lines, clusters for related films/actors, chains for revenue evolution
- The dropdown pattern (`Try: Apple Revenue ▾`) should feel native and lightweight, not a full modal picker

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ViewManager._showWelcome()`: Current welcome panel with Import File + Import from Mac buttons — will be extended with sample data CTA above
- `ViewManager._showFilteredEmpty()`: Filtered-empty with VIEW_EMPTY_MESSAGES — no changes needed
- `CommandRegistry`: Supports `Actions` category with `visible` predicates — ideal for conditional "Clear Sample Data" command
- `AuditState`: Tracks source for audit overlay — sample cards with `source='sample'` will be visually distinguished automatically
- `WorkerBridge.send('etl:import-native')`: Existing import pipeline for native shell
- `MutationManager.setToast()`: ActionToast system (available but not needed — no confirmation on clear)

### Established Patterns
- ETL source/source_id pattern: all imported cards already use `source` and `source_id` fields — sample data follows the same convention
- D3 data join: views re-render via `StateCoordinator.scheduleUpdate()` — sample data insertion triggers normal render pipeline
- Command palette visibility predicates: commands can be conditionally shown (e.g., clear only visible when sample data exists)

### Integration Points
- `src/views/ViewManager.ts` — welcome panel modification (lines 498-555)
- `src/palette/CommandRegistry.ts` — register "Clear Sample Data" and "Load Sample Data" commands
- `src/main.ts` — wire sample data loading to welcome panel CTA (lines 411+)
- `native/Isometry/Isometry/SyncManager.swift` — sync boundary filter for source != 'sample'
- `src/worker/WorkerBridge.ts` — potential new message type for sample data insertion

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 52-sample-data-empty-states*
*Context gathered: 2026-03-08*
