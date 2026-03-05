# Phase 25: SuperSearch - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

FTS5-powered in-grid search for SuperGrid. Users activate via Cmd+F, type a query with 300ms debounce, and see matching cells highlighted with `<mark>` tags managed by the D3 data join. The FTS MATCH clause folds into the existing compound `supergrid:query` — no second Worker round-trip. Highlights survive re-renders from filter/axis changes. Clearing the input removes all highlights immediately.

</domain>

<decisions>
## Implementation Decisions

### Search panel UX
- Search input lives inline in the existing density toolbar (always visible, no toggle state)
- Cmd+F is intercepted (`preventDefault`) to focus the search input — standard web app pattern
- Escape clears the search text and removes highlights but input stays visible
- Live match count badge displayed next to the search input

### Highlight rendering
- **Matrix mode (count-only):** Matching cells get a subtle background tint (amber/yellow)
- **Expanded/preview modes:** Matching text wrapped in `<mark>` tags within cell content (consistent with existing FTS5 snippet pattern in `search.ts`)
- **Non-matching cells:** Dimmed to ~0.4 opacity when a search is active — creates strong visual focus on results
- **Zero matches:** Show "No matches" text + all cells dimmed
- Highlight color is fixed amber/yellow (not configurable)

### Query folding strategy
- FTS MATCH folds into the compound `supergrid:query` as a WHERE subquery: `AND rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)`
- Reuses the existing `where` + `params` injection pattern from `FilterProvider.compile()` — no structural changes to `buildSuperGridQuery`
- Search AND-composes with existing filters (search narrows within the current filter, doesn't replace)
- `CellDatum` gains a `matchedCardIds: string[]` field — subset of `card_ids` that matched FTS, enabling per-card highlight granularity
- Search terms passed in the response (`searchTerms: string[]`) for client-side `<mark>` rendering via regex in D3 `.each()` callback

### Navigation & match count
- No prev/next match navigation (keeps Phase 25 scope tight — future enhancement)
- Match count displays "N cells" (count of grid cells containing matches, not individual cards)
- "No matches" text shown when zero results
- Search state persists across axis/filter changes — search re-runs automatically on re-render (SRCH-06)

### Claude's Discretion
- Exact amber/yellow color values for cell tint and `<mark>` styling (must be accessible)
- Debounce implementation approach (existing codebase uses raw `setTimeout`)
- How `matchedCardIds` is computed in the handler (second query vs subquery correlation)
- Stale response discard mechanism (correlation IDs already exist in WorkerBridge)
- Exact opacity value for non-match dimming (~0.4 suggested)
- Search input placeholder text and styling

</decisions>

<specifics>
## Specific Ideas

- Match count should say "N cells" not "N cards" — maps to what's visually highlighted
- Dimming non-matches creates a "spotlight" effect — like data tools that fade context when filtering
- The `<mark>` pattern is already proven in `src/database/queries/search.ts` with FTS5 snippets — reuse the same visual language

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/database/queries/search.ts`: Existing FTS5 search with BM25 ranking, `<mark>` snippet generation, rowid JOIN pattern — proves the FTS5 approach works
- `src/worker/handlers/search.handler.ts`: Thin Worker handler for `search:cards` — pattern for search-related handlers
- `src/views/supergrid/SuperGridQuery.ts`: `buildSuperGridQuery()` already accepts `where` + `params` config — WHERE subquery injection is straightforward
- `src/worker/protocol.ts`: `CellDatum` interface with `[key: string]: unknown` dynamic keys — `matchedCardIds` fits naturally
- Existing density toolbar in `SuperGrid.ts`: Created in `mount()`, has granularity picker, hide-empty, view-mode, clear-sorts, clear-filters — search input slots in here

### Established Patterns
- **Keyboard event handling:** `document.addEventListener('keydown', handler)` in `mount()`, removed in `destroy()` — used for Escape (selection clear), Escape (filter dropdown)
- **Worker protocol:** Typed `WorkerPayloads` / `WorkerResponses` with correlation IDs for stale response handling
- **D3 data join:** `_renderCells()` manages all cell rendering — `.each()` callback is the natural extension point for `<mark>` decoration
- **Toolbar controls:** All toolbar elements created in `mount()`, state synced in `_updateDensityToolbar()` on every `_renderCells()` call
- **No debounce utility:** Codebase uses raw `setTimeout` (see `StateManager.ts`)

### Integration Points
- `SuperGrid.mount()`: Add search input to density toolbar, wire Cmd+F keydown listener
- `SuperGrid._fetchAndRender()`: Inject search WHERE clause into `buildSuperGridQuery` config
- `supergrid.handler.ts`: Compute `matchedCardIds` per cell when search is active
- `protocol.ts`: Extend `CellDatum` with `matchedCardIds`, extend `WorkerPayloads['supergrid:query']` with optional search term
- `SuperGrid._renderCells()`: Apply cell tint, opacity dimming, and `<mark>` decoration based on `matchedCardIds`

</code_context>

<deferred>
## Deferred Ideas

- Prev/next match navigation (arrow buttons to jump between matching cells) — future enhancement
- Configurable highlight colors — not needed for initial implementation
- "N cards" count alongside "N cells" count — could add later if users want both

</deferred>

---

*Phase: 25-supersearch*
*Context gathered: 2026-03-05*
