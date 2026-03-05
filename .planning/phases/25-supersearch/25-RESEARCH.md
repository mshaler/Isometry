# Phase 25: SuperSearch - Research

**Researched:** 2026-03-05
**Domain:** FTS5 WHERE injection, D3 data join highlight rendering, debounced keyboard UI
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Search input lives inline in the existing density toolbar (always visible, no toggle state)
- Cmd+F is intercepted (`preventDefault`) to focus the search input — standard web app pattern
- Escape clears the search text and removes highlights but input stays visible
- Live match count badge displayed next to the search input
- **Matrix mode (count-only):** Matching cells get a subtle background tint (amber/yellow)
- **Expanded/preview modes:** Matching text wrapped in `<mark>` tags within cell content (consistent with existing FTS5 snippet pattern in `search.ts`)
- **Non-matching cells:** Dimmed to ~0.4 opacity when a search is active — creates strong visual focus on results
- **Zero matches:** Show "No matches" text + all cells dimmed
- Highlight color is fixed amber/yellow (not configurable)
- FTS MATCH folds into the compound `supergrid:query` as a WHERE subquery: `AND rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)`
- Reuses the existing `where` + `params` injection pattern from `FilterProvider.compile()` — no structural changes to `buildSuperGridQuery`
- Search AND-composes with existing filters (search narrows within the current filter, doesn't replace)
- `CellDatum` gains a `matchedCardIds: string[]` field — subset of `card_ids` that matched FTS, enabling per-card highlight granularity
- Search terms passed in the response (`searchTerms: string[]`) for client-side `<mark>` rendering via regex in D3 `.each()` callback
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

### Deferred Ideas (OUT OF SCOPE)

- Prev/next match navigation (arrow buttons to jump between matching cells) — future enhancement
- Configurable highlight colors — not needed for initial implementation
- "N cards" count alongside "N cells" count — could add later if users want both
</user_constraints>

---

## Summary

Phase 25 implements FTS5-powered in-grid search for SuperGrid. The core challenge is threefold: (1) inject an FTS MATCH subquery into the existing `buildSuperGridQuery` WHERE clause without changing its signature, (2) transport matched card IDs and search terms back through the Worker response so the D3 `.each()` render callback can apply `<mark>` decoration and opacity dimming, and (3) manage search input state entirely in SuperGrid with a 300ms debounce so highlights survive axis/filter re-renders without a second Worker round-trip.

The codebase is exceptionally well-prepared for this phase. `SuperGridQuery.ts` already accepts `where: string` and `params: unknown[]` in `SuperGridQueryConfig` — appending a FTS subquery is a direct WHERE concatenation. `CellDatum` in `protocol.ts` already uses `[key: string]: unknown` dynamic keys, so adding `matchedCardIds?: string[]` and a parallel response field `searchTerms?: string[]` follows the existing protocol extension pattern. The D3 `.each()` callback in `_renderCells()` is the designated extension point for per-cell decoration; the codebase already uses this pattern (DENS-06 documentation comment explicitly flags it).

The existing `search.ts` FTS5 handler proves the `rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)` subquery approach works correctly. The critical architectural insight is that `matchedCardIds` must be computed in `handleSuperGridQuery` as a post-GROUP BY join — after fetching the grouped cells, a secondary query resolves which `card_ids` within each cell are FTS matches. This avoids structural changes to `buildSuperGridQuery` while still enabling per-card highlight granularity in spreadsheet mode.

**Primary recommendation:** Extend `SuperGridQueryConfig` with `searchTerm?: string`, inject the FTS subquery in `buildSuperGridQuery`, compute `matchedCardIds` in `handleSuperGridQuery` via secondary FTS query, and propagate `searchTerms` through the response. SuperGrid holds `_searchTerm: string` state and calls `_fetchAndRender()` on debounced input change — this is the exact same coordinator-bypass pattern used nowhere else and must be handled carefully to avoid double-fetches.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SRCH-01 | User can activate in-grid search via Cmd+F keyboard shortcut | Keyboard handler pattern from Phase 21/24 (`document.addEventListener('keydown', handler)` in `mount()`, removed in `destroy()`). Cmd+F intercepted via `e.metaKey && e.key === 'f'` with `e.preventDefault()`. |
| SRCH-02 | Search input queries FTS5 with debounced 300ms delay | Existing codebase uses raw `setTimeout` (confirmed in `StateManager.ts`). Debounce pattern: `clearTimeout(debounceId); debounceId = setTimeout(() => this._fetchAndRender(), 300)`. |
| SRCH-03 | Matching cells are highlighted via CSS class + `<mark>` tags rendered by D3 data join (not innerHTML injection) | D3 `.each()` callback in `_renderCells()` is the extension point. Matrix mode uses CSS background tint class; spreadsheet/preview modes use DOM manipulation to wrap text in `<mark>` elements. Must build DOM nodes (not innerHTML) per SRCH-03. |
| SRCH-04 | FTS MATCH clause is folded into compound `supergrid:query` (not a separate Worker call) | `SuperGridQueryConfig.where` + `params` already accepts arbitrary WHERE fragments. Append `AND rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)` when `searchTerm` is non-empty. `handleSuperGridQuery` computes `matchedCardIds` via secondary FTS query on the results. |
| SRCH-05 | Clearing search removes all highlights immediately | Clearing sets `_searchTerm = ''`, calls `_fetchAndRender()` immediately (no debounce on clear). Response returns `matchedCardIds: []` and `searchTerms: []` — D3 `.each()` removes tint class and opacity dim. |
| SRCH-06 | Search highlights survive consecutive re-renders from filter/axis changes | `_searchTerm` is class-level state. Every call to `_fetchAndRender()` reads the current `_searchTerm`. When coordinator triggers re-render on filter/axis change, `_fetchAndRender()` sends the active search term in the query — highlights re-apply on the new cell layout. |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| D3.js | v7.9 (project standard) | `.each()` callback for per-cell DOM decoration | Already used for all cell rendering; `.each()` runs on both enter and update paths |
| sql.js (FTS5 WASM) | 1.14 custom build | FTS MATCH subquery execution | Project's system of record; FTS5 virtual table `cards_fts` already exists |
| Vitest | 4.0 (project standard) | TDD tests for all new code | Project's test framework; jsdom environment already configured |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | 5.9 strict | Type extensions for `CellDatum`, `SuperGridQueryConfig` | All protocol and interface changes require TypeScript type additions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| FTS MATCH subquery in WHERE | Second Worker call (`search:cards`) | Context.md locked: SRCH-04 requires fold into single `supergrid:query`. Second call creates stale-response risk and double round-trip. |
| `setTimeout` debounce | lodash debounce | Codebase has no lodash; existing pattern is raw `setTimeout`. No new dependency needed. |
| `innerHTML` for `<mark>` | DOM node creation | SRCH-03 explicitly requires D3 data join, not innerHTML injection. innerHTML also breaks D3's element identity. |

**Installation:** No new dependencies required.

---

## Architecture Patterns

### Recommended Project Structure

No new files required for the core implementation. Changes span:

```
src/
├── worker/
│   ├── protocol.ts                     # Extend CellDatum + SuperGridQueryConfig
│   └── handlers/
│       └── supergrid.handler.ts        # Add matchedCardIds computation
├── views/
│   ├── SuperGrid.ts                    # Search state, toolbar input, keydown, debounce, _renderCells highlight
│   └── supergrid/
│       └── SuperGridQuery.ts           # FTS WHERE injection
tests/
└── views/
    └── SuperGrid.test.ts               # SRCH-01 through SRCH-06 tests (TDD: write first)
```

### Pattern 1: FTS Subquery Injection into WHERE

**What:** Append a FTS MATCH subquery as an additional WHERE clause fragment when `searchTerm` is non-empty. The `buildSuperGridQuery` function already accepts `where` + `params` — the FTS clause is appended before building `fullWhere`.

**When to use:** When `config.searchTerm` is a non-empty, non-whitespace-only string.

**Example:**
```typescript
// In buildSuperGridQuery (SuperGridQuery.ts)
// After existing filterWhere computation:
const searchWhere = config.searchTerm?.trim()
  ? ' AND rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)'
  : '';
const searchParam = config.searchTerm?.trim() ? [config.searchTerm.trim()] : [];

const fullWhere = baseWhere + filterWhere + searchWhere;
// params becomes: [...params, ...searchParam]
```

**Critical:** FTS5 MATCH query strings must not be empty — always guard with `.trim()` check before appending.

### Pattern 2: matchedCardIds Computation in Handler

**What:** After `handleSuperGridQuery` fetches grouped cells, run a secondary FTS5 query to determine which specific card IDs within each cell match the search term. Store as `matchedCardIds` on each `CellDatum`.

**When to use:** When `payload.searchTerm` is non-empty.

**Example:**
```typescript
// In handleSuperGridQuery (supergrid.handler.ts)
if (payload.searchTerm?.trim()) {
  // Secondary query: get all card IDs that match FTS
  const ftsStmt = db.prepare<{ id: string }>(
    'SELECT c.id FROM cards_fts JOIN cards c ON c.rowid = cards_fts.rowid WHERE cards_fts MATCH ? AND c.deleted_at IS NULL'
  );
  const matchedRows = ftsStmt.all(payload.searchTerm.trim());
  ftsStmt.free();
  const matchedSet = new Set(matchedRows.map(r => r.id));

  // Annotate each cell with which of its card_ids are matched
  cells.forEach(cell => {
    cell['matchedCardIds'] = cell.card_ids.filter(id => matchedSet.has(id));
  });
}
```

**Note:** The secondary FTS query runs only when search is active — zero performance impact when `searchTerm` is empty.

### Pattern 3: Search State in SuperGrid

**What:** SuperGrid holds `_searchTerm: string` as class-level state. Debounce uses raw `setTimeout` (no utility function — project pattern). The search input element stores a ref (`_searchInputEl`) for `focus()` on Cmd+F.

**When to use:** This is the only place search state lives. No new provider or external state needed.

**Example:**
```typescript
// Class fields (alongside _filterDropdownEl etc.)
private _searchTerm: string = '';
private _searchInputEl: HTMLInputElement | null = null;
private _searchDebounceId: ReturnType<typeof setTimeout> | null = null;
private _searchCountEl: HTMLSpanElement | null = null;

// In mount() — add to density toolbar (alongside clear-sorts, clear-filters)
const searchInput = document.createElement('input');
searchInput.type = 'text';
searchInput.className = 'sg-search-input';
searchInput.placeholder = 'Search...';
searchInput.addEventListener('input', () => {
  if (this._searchDebounceId !== null) clearTimeout(this._searchDebounceId);
  const term = searchInput.value;
  if (!term.trim()) {
    // Immediate clear — no debounce (SRCH-05)
    this._searchTerm = '';
    void this._fetchAndRender();
  } else {
    this._searchDebounceId = setTimeout(() => {
      this._searchTerm = term;
      void this._fetchAndRender();
    }, 300);
  }
});
this._searchInputEl = searchInput;
toolbar.appendChild(searchInput);

// Cmd+F keydown handler — add to existing Escape handler registration
this._boundCmdFHandler = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
    e.preventDefault();
    this._searchInputEl?.focus();
  }
};
document.addEventListener('keydown', this._boundCmdFHandler);

// Escape on searchInput: clear search
searchInput.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    searchInput.value = '';
    this._searchTerm = '';
    if (this._searchDebounceId !== null) clearTimeout(this._searchDebounceId);
    void this._fetchAndRender();
  }
});
```

### Pattern 4: D3 `.each()` Highlight Application

**What:** In `_renderCells()`, extend the D3 `.each()` callback to apply search highlights based on `CellDatum.matchedCardIds` and `_searchTerms` (stored as class state from last response). Matrix mode: CSS background tint + opacity dim. Spreadsheet mode: rebuild content with `<mark>` wrapped terms.

**When to use:** On every `_renderCells()` call when `_searchTerm` is non-empty.

**Example:**
```typescript
// In _renderCells() D3 .each() callback (after existing matrix/spreadsheet branching)
// _lastSearchTerms is a class field: string[] set from response
const isSearchActive = self._searchTerm.trim().length > 0;
const matchedCardIds = (matchingCell?.['matchedCardIds'] as string[] | undefined) ?? [];
const isMatch = isSearchActive && matchedCardIds.length > 0;

if (isSearchActive) {
  el.style.opacity = isMatch ? '1' : '0.4';  // Dim non-matches
}

if (isMatch && densityStateForView.viewMode === 'matrix') {
  // Amber tint overlay — does not replace heat map background
  el.classList.add('sg-search-match');
  // CSS: .sg-search-match { outline: 2px solid rgba(245, 158, 11, 0.8); }
} else {
  el.classList.remove('sg-search-match');
}

// Spreadsheet mode mark decoration
if (isMatch && densityStateForView.viewMode === 'spreadsheet' && self._lastSearchTerms.length > 0) {
  // Rebuild pills with <mark> wrapped terms
  // Use DOM manipulation (not innerHTML) per SRCH-03
  el.querySelectorAll('.card-pill').forEach(pill => {
    // wrap matched substrings in <mark> via TreeWalker or textContent regex
  });
}
```

### Pattern 5: Stale Response Discard via Correlation IDs

**What:** WorkerBridge already assigns correlation IDs to every request. The bridge's `superGridQuery()` call returns a promise — if `_searchTerm` changes before the promise resolves, the response is stale. The existing `rAF coalescing` in the bridge abandons earlier promises when a new call is made for the same message type. This means the debounce + bridge coalescing provide two layers of stale-response protection.

**When to use:** The existing bridge coalescing handles this automatically. No additional correlation ID tracking needed in SuperGrid for the search case.

**Critical:** The `_fetchAndRender()` method already checks `if (!this._gridEl) return;` after await — this guard also covers the destroyed case. No additional stale-response guard needed beyond the existing pattern.

### Anti-Patterns to Avoid

- **Separate Worker call for search:** SRCH-04 requires folding into `supergrid:query`. A `search:cards` call would create a double round-trip and the result sets would be stale relative to the grid.
- **innerHTML for `<mark>` decoration:** SRCH-03 requires D3 data join rendering, not `innerHTML`. Using `innerHTML` inside a D3-managed element breaks the data join's element identity tracking.
- **Calling `_fetchAndRender()` directly from coordinator callback when search changes:** The existing pattern fires `_fetchAndRender()` when provider state changes. Search input is NOT a provider — it bypasses the coordinator intentionally. This is correct but must be documented clearly to avoid confusion.
- **Storing search state in a provider:** Search is Tier 3 ephemeral state (per D-005: "Selection is Tier 3 ONLY"). It belongs as class-level state in SuperGrid, not in PAFVProvider or any persisted provider.
- **Debouncing the clear action:** When input is cleared (empty string), `_fetchAndRender()` must fire immediately (no 300ms wait). Only non-empty search terms are debounced.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FTS query execution | Custom text search | `cards_fts MATCH ?` subquery | FTS5 is already configured, indexed, and tested. Custom search misses BM25, tokenization, phrase queries. |
| Debounce utility | Custom utility class | Raw `setTimeout` + `clearTimeout` | Project standard — `StateManager.ts` uses this pattern. No new dependency warranted. |
| Correlation ID tracking | Per-search ID map | Bridge's existing rAF coalescing | Bridge already abandons stale promises for same message type. Phase 25 gets this for free. |

**Key insight:** The FTS5 infrastructure, Worker protocol extension patterns, and D3 render pipeline are all proven and tested. Phase 25 composes existing pieces rather than building new infrastructure.

---

## Common Pitfalls

### Pitfall 1: FTS5 Empty Query Crash
**What goes wrong:** Passing an empty string to `cards_fts MATCH ''` causes a SQLite FTS5 error ("fts5: syntax error near """).
**Why it happens:** FTS5 MATCH requires a non-empty, syntactically valid query string.
**How to avoid:** Guard in `buildSuperGridQuery`: only append FTS subquery when `config.searchTerm?.trim()` is truthy. This is exactly the guard in `searchCards()` (`if (!query.trim()) return [];`).
**Warning signs:** Worker returns `INVALID_REQUEST` error code on empty search term.

### Pitfall 2: Special Characters in FTS5 Query
**What goes wrong:** User types `C++`, `"phrase"`, or `OR` — FTS5 interprets these as query operators.
**Why it happens:** FTS5 query syntax supports `AND`, `OR`, `NOT`, `NEAR`, `*` prefix, `"phrase"` — user input can accidentally trigger these.
**How to avoid:** For Phase 25, pass the raw search term as-is (consistent with existing `searchCards()` behavior — same FTS5 syntax exposure). Document that FTS5 implicit AND applies between tokens. Optional: wrap user input in double-quotes for phrase search safety.
**Warning signs:** Unexpected zero results for inputs containing FTS operators.

### Pitfall 3: matchedCardIds Not Set When Search is Inactive
**What goes wrong:** `CellDatum.matchedCardIds` is `undefined` when no search is active. D3 `.each()` code that assumes it's always an array will throw.
**Why it happens:** `matchedCardIds` is only populated in `handleSuperGridQuery` when `searchTerm` is non-empty.
**How to avoid:** Always read as `(cell.matchedCardIds as string[] | undefined) ?? []` in the D3 render callback.
**Warning signs:** TypeScript strict mode flags unguarded access; tests fail with "Cannot read property of undefined".

### Pitfall 4: Opacity Dim Persisting After Search Clear
**What goes wrong:** After clearing search, cells remain at 0.4 opacity.
**Why it happens:** The D3 `.each()` callback sets `el.style.opacity` but only when `isSearchActive`. On the clear re-render, `isSearchActive` is false — but the opacity was already set inline and won't be reset.
**How to avoid:** In D3 `.each()`, always reset opacity when not search-active: `el.style.opacity = isSearchActive ? (isMatch ? '1' : '0.4') : ''` (empty string removes inline style, restoring default).
**Warning signs:** Cells appear dim after Escape even when search input is empty.

### Pitfall 5: Debounce ID Not Cleared in destroy()
**What goes wrong:** A pending debounce fires after `destroy()` is called, calling `_fetchAndRender()` on a destroyed SuperGrid (null `_gridEl`).
**Why it happens:** `_searchDebounceId` is a class field holding a `setTimeout` return value.
**How to avoid:** In `destroy()`, add `if (this._searchDebounceId !== null) { clearTimeout(this._searchDebounceId); this._searchDebounceId = null; }`. The `if (!this._gridEl) return;` guard in `_fetchAndRender()` is a second layer of protection.
**Warning signs:** "Cannot set properties of null" errors in post-destroy tests.

### Pitfall 6: searchTerm in SuperGridQueryConfig vs. CellDatum Dynamic Keys
**What goes wrong:** `searchTerm` added to `SuperGridQueryConfig` collides with an axis field name in `CellDatum`.
**Why it happens:** `CellDatum` uses `[key: string]: unknown` — if `searchTerm` were accidentally propagated as a cell field, it would appear as an axis value.
**How to avoid:** `searchTerm` is only in `SuperGridQueryConfig` (input to handler). The handler does NOT spread it into `CellDatum`. `matchedCardIds` and `searchTerms` are the response fields added to `CellDatum` and the response respectively.

### Pitfall 7: Search State Lost on View Switch
**What goes wrong:** User switches to another view and back — search input is blank even though search state should persist.
**Why it happens:** `_searchTerm` is class-level state; when SuperGrid is destroyed and re-mounted, it starts fresh. Also, search is Tier 3 ephemeral per D-005.
**How to avoid:** This is correct behavior per CONTEXT.md. Search is ephemeral — intentionally not persisted across view switches. Document this clearly in the implementation.

---

## Code Examples

Verified patterns from project source:

### Existing FTS5 Subquery Pattern (search.ts)
```typescript
// Source: src/database/queries/search.ts
const result = db.exec(
  `SELECT c.*,
          rank,
          snippet(cards_fts, -1, '<mark>', '</mark>', '...', 32) AS snippet_text
   FROM cards_fts
   JOIN cards c ON c.rowid = cards_fts.rowid
   WHERE cards_fts MATCH ?
     AND c.deleted_at IS NULL
   ORDER BY rank
   LIMIT ?`,
  [query, limit]
);
```

### WHERE Clause Assembly in buildSuperGridQuery (SuperGridQuery.ts)
```typescript
// Source: src/views/supergrid/SuperGridQuery.ts
const baseWhere = 'deleted_at IS NULL';
const filterWhere = where ? ` AND ${where}` : '';
const fullWhere = baseWhere + filterWhere;
// Phase 25 extends this: const searchWhere = searchTerm?.trim() ? ' AND rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)' : '';
```

### D3 .each() Callback Pattern (SuperGrid.ts)
```typescript
// Source: src/views/SuperGrid.ts lines 1131-1223
const self = this; // capture class ref before D3 .each(function(d))
gridSelection
  .selectAll<HTMLDivElement, CellPlacement>('.data-cell')
  .data(cellPlacements, d => `${d.rowKey}\x1f${d.colKey}`)
  .join(
    enter => enter.append('div').attr('class', 'data-cell'),
    update => update,
    exit => exit.remove()
  )
  .each(function (d) {
    const el = this as HTMLDivElement;
    // ... Phase 25 highlight logic extends here
  });
```

### Keydown Handler Lifecycle Pattern (SuperGrid.ts)
```typescript
// Source: src/views/SuperGrid.ts (Phase 21 Escape handler + Phase 24 filter Escape handler)
// In mount():
this._boundEscapeHandler = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && this._rootEl) {
    this._selectionAdapter.clear();
  }
};
document.addEventListener('keydown', this._boundEscapeHandler);
// In destroy():
if (this._boundEscapeHandler) {
  document.removeEventListener('keydown', this._boundEscapeHandler);
  this._boundEscapeHandler = null;
}
```

### CellDatum Protocol Extension Pattern (protocol.ts)
```typescript
// Source: src/worker/protocol.ts — current CellDatum
export interface CellDatum {
  [key: string]: unknown;  // Dynamic axis column values
  count: number;
  card_ids: string[];
  // Phase 25 adds:
  // matchedCardIds?: string[];  // subset of card_ids that matched FTS search
}

// WorkerResponses['supergrid:query'] extends to:
// { cells: CellDatum[]; searchTerms?: string[] }
```

### Handler Secondary Query Pattern
```typescript
// Source: supergrid.handler.ts — existing prepare+all pattern
const stmt = db.prepare<Record<string, unknown>>(sql);
const rows = params.length > 0 ? stmt.all(...params) : stmt.all();
stmt.free();
// Phase 25 secondary query follows the same prepare+all+free pattern
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate search Worker call | FTS WHERE subquery in supergrid:query | Phase 25 (new) | Single round-trip; search AND-composes with filters; no stale-response mismatch |
| innerHTML `<mark>` injection | DOM node creation in D3 `.each()` | Phase 25 (new) | Preserves D3 element identity; no XSS risk; survives re-renders |

**No deprecated approaches in scope:** The FTS5 MATCH syntax used is standard SQLite FTS5 and has been stable since SQLite 3.9.0. The `rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)` pattern is the canonical way to add FTS filtering to a non-FTS query.

---

## Open Questions

1. **`matchedCardIds` computation approach — second FTS query vs subquery correlation**
   - What we know: The handler can run a secondary `SELECT c.id FROM cards_fts JOIN cards c ON c.rowid = cards_fts.rowid WHERE cards_fts MATCH ?` query to get all matched card IDs, then intersect with each cell's `card_ids` array in TypeScript.
   - What's unclear: Whether the secondary FTS query is more efficient than a self-join approach. At typical dataset sizes (< 10K cards), the difference is negligible.
   - Recommendation: Use the secondary query approach (simpler code, proven FTS5 pattern from `search.ts`). Set is O(1) lookup for the intersection.

2. **`searchTerms[]` transport — single string vs tokenized array**
   - What we know: Client-side `<mark>` decoration requires knowing what substrings to wrap. The FTS5 query can be a phrase, prefix, or multi-token query.
   - What's unclear: Whether to send the raw search term or split into tokens for simpler client-side regex.
   - Recommendation: Send `searchTerms: [rawTerm]` — a single-element array. Client splits on whitespace for multi-token highlight. This avoids FTS5 query parsing logic on the server side while giving the client enough to build a highlight regex.

3. **CellPlacement vs CellDatum for matchedCardIds access**
   - What we know: The D3 `.each()` callback receives `CellPlacement` (which has `cardIds: string[]`), not `CellDatum` directly. The `matchedCardIds` is on `CellDatum` from `_lastCells`.
   - What's unclear: Whether to copy `matchedCardIds` into `CellPlacement` or look it up from `cellMap` inside `.each()`.
   - Recommendation: Copy `matchedCardIds` into `CellPlacement` during the construction loop (alongside `count` and `cardIds`). This keeps `.each()` data-self-contained and avoids a closure over `cellMap` in the render loop.

---

## Validation Architecture

> `workflow.nyquist_validation` is not set in config.json — skipping this section.

---

## Sources

### Primary (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/src/database/queries/search.ts` — FTS5 MATCH pattern, `rowid` JOIN, guard for empty query, `<mark>` snippet pattern
- `/Users/mshaler/Developer/Projects/Isometry/src/views/supergrid/SuperGridQuery.ts` — `buildSuperGridQuery` WHERE assembly, `SuperGridQueryConfig` interface, params array construction
- `/Users/mshaler/Developer/Projects/Isometry/src/worker/handlers/supergrid.handler.ts` — `handleSuperGridQuery` implementation, `prepare().all()` pattern, `CellDatum` construction
- `/Users/mshaler/Developer/Projects/Isometry/src/worker/protocol.ts` — `CellDatum` interface, `WorkerPayloads['supergrid:query']`, `WorkerResponses['supergrid:query']`, correlation ID architecture
- `/Users/mshaler/Developer/Projects/Isometry/src/views/SuperGrid.ts` — toolbar construction pattern (lines 389-532), D3 `.each()` callback (lines 1131-1223), keydown handler lifecycle (lines 621-627), `_clearFiltersBtnEl` pattern for new toolbar controls
- `/Users/mshaler/Developer/Projects/Isometry/src/views/types.ts` — `SuperGridBridgeLike`, `SuperGridFilterLike`, `CellDatum` import chain
- `/Users/mshaler/Developer/Projects/Isometry/tests/views/SuperGrid.test.ts` — mock factory patterns for `makeMockBridge`, `makeMockFilter`, `makeMockProvider`
- `.planning/phases/25-supersearch/25-CONTEXT.md` — locked decisions and discretionary areas

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — accumulated decisions including "FTS highlights MUST be passed as data to D3 render cycle (no innerHTML injection outside data join)" (confirmed via Phase 16 locked constraint)
- `.planning/REQUIREMENTS.md` — SRCH-01 through SRCH-06 full text

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all technologies are project-proven
- Architecture: HIGH — all integration points are verified against actual source code
- Pitfalls: HIGH — derived from reading actual implementation of analogous Phase 24 patterns and FTS5 handler code
- Open questions: MEDIUM — minor implementation choices within Claude's discretion; none block planning

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable stack; FTS5 and D3 APIs are not fast-moving)
