# Phase 37: SuperAudit - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Visual intelligence overlay for all 9 views: change tracking (new/modified/deleted cards after import), source provenance color coding, and calculated-vs-raw value distinction in SuperGrid. Session-only persistence (clears on app restart). Togglable via toolbar + keyboard shortcut with a floating legend panel.

</domain>

<decisions>
## Implementation Decisions

### Change indicators
- Left border stripe: 3-4px colored left border on cards (green=new, orange=modified, red=deleted)
- Deleted cards additionally get reduced opacity (~50%) for a "ghosted" appearance
- In SuperGrid aggregation cells: dominant status wins (deleted > modified > new) for the cell's left stripe
- Change data comes from ImportResult IDs — track insertedIds, updatedIds, and deletedIds during import as session-only in-memory sets (no schema change)

### Source provenance
- Bottom border color per source type — thin colored bottom border on cards
- Muted/pastel color palette designed for dark theme (--bg-card: #1e1e2e) background
- 9 source types need 9 distinct muted hues (apple_notes, markdown, csv, json, excel, html, native_reminders, native_calendar, native_notes)
- In SuperGrid aggregation cells: dominant source wins (most card_ids determines the cell's bottom border color)
- Cards with source=null (manually created) get no bottom border — only imported cards show provenance
- `source` field exists in Card DB type but NOT in CardDatum — needs to be projected to views

### Aggregation styling
- SQL-calculated values (count badges, summary cells) render in italic + --text-secondary color
- Applies only to cells with count > 1 or SQL-aggregated summaries, NOT single-card cells in spreadsheet mode
- Always visible — independent of the audit toggle (inherent data-type distinction, not change-tracking overlay)

### Toggle & legend UX
- Toolbar icon (eye/audit style) + keyboard shortcut to toggle audit mode on/off
- Toggle OFF = all change stripes and source borders disappear (clean cards). Aggregation styling stays (always-on)
- Floating legend panel appears near the toggle when audit is ON
- Legend shows two sections: "Changes" (green/orange/red stripe meanings) and "Sources" (color-to-source mapping)
- Legend is dismissible or auto-hides

### Claude's Discretion
- Exact keyboard shortcut choice (Shift+A, Cmd+Shift+A, etc.)
- Toolbar icon design (eye, magnifying glass, etc.)
- Exact muted/pastel color values for 9 source types
- Legend panel positioning and dismiss behavior
- How to extend CardDatum to include source (add field vs. separate lookup)
- CSS class naming and implementation approach for stripes/borders
- Exact opacity value for deleted cards
- Animation/transition when toggling audit on/off

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CardRenderer.ts` (renderSvgCard/renderHtmlCard): Central card rendering — change stripe and source border can be added here for 6 views (List, Grid, Kanban, Calendar, Timeline, Gallery)
- `design-tokens.css`: Existing CSS custom property system — audit colors should follow same pattern (--audit-new, --audit-modified, --audit-deleted, --source-*)
- `ImportOrchestrator.ts`: Already returns `insertedIds` in ImportResult — needs extension to also track updatedIds and deletedIds
- `CatalogWriter.ts` + `import_sources`/`import_runs` tables: Provenance data already stored in DB
- `Card.source` field: Already exists in database schema — just not projected into CardDatum

### Established Patterns
- IView interface (mount/render/destroy): All 9 views follow this — audit overlay must work through this lifecycle
- D3 data join with `d => d.id` key function: Mandatory on every .data() call — audit classes should be set during join update
- CSS custom properties for theming: All colors use var(--token) — audit colors should too
- SuperGrid CellDatum: Has `count` and `card_ids` fields — aggregation detection is `count > 1`
- StateCoordinator subscription: Views re-render on provider changes — audit toggle could be a new provider or simpler pub/sub
- ViewManager: Orchestrates view lifecycle — could be the natural place to inject audit state

### Integration Points
- `toCardDatum()` in types.ts: Maps Worker rows to CardDatum — needs `source` field added
- SuperGrid `_renderCells()`: Where aggregation styling and cell-level change/source indicators would be applied
- `src/styles/views.css`: Where audit CSS classes would live
- `src/ui/ImportToast.ts`: Existing UI component — audit toggle could follow similar DOM patterns
- Worker protocol: May need to carry source field in card queries if not already included

</code_context>

<specifics>
## Specific Ideas

- Change indicators use the same visual language as Linear's status indicators — subtle left border stripe
- The audit overlay is an all-or-nothing toggle: ON = full visual intelligence (stripes + source borders), OFF = clean cards
- Aggregation styling is NOT part of the toggle — it's always visible because it communicates data type, not change history
- Deleted cards should feel "ghosted" (stripe + opacity) to clearly distinguish from active cards

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 37-superaudit*
*Context gathered: 2026-03-06*
