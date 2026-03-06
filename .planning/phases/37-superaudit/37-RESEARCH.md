# Phase 37: SuperAudit - Research

**Researched:** 2026-03-06
**Domain:** Visual audit overlay (change tracking, source provenance, aggregation styling) across 9 views
**Confidence:** HIGH

## Summary

SuperAudit is a purely additive JavaScript/CSS phase that adds three layers of visual intelligence to all 9 views: (1) change tracking indicators showing new/modified/deleted cards after import, (2) source provenance color coding showing where each card came from, and (3) aggregation styling distinguishing SQL-calculated values from raw data in SuperGrid. All audit indicators are session-only (Tier 3 ephemeral) and togglable via a toolbar button and keyboard shortcut.

The implementation builds on well-understood codebase patterns. Change tracking requires extending `ImportResult` to include `updatedIds` (currently only `insertedIds` exists), and adding deleted card detection to `DedupEngine`. Source provenance requires projecting the existing `cards.source` column into `CardDatum` (it exists in the DB schema but is not currently mapped to the view type). Aggregation styling targets SuperGrid's existing `isSummary` flag and `count > 1` cells. The toggle, legend, and CSS overlay are standard UI patterns with no novel technical challenges.

**Primary recommendation:** Implement as 3 plans: (1) data infrastructure (extend ImportResult + DedupEngine + add source to CardDatum), (2) CSS overlay + CardRenderer changes for all 9 views, (3) toggle/legend UI + SuperGrid aggregation styling.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Change indicators: Left border stripe (3-4px, green=new, orange=modified, red=deleted)
- Deleted cards: additionally get reduced opacity (~50%) for ghosted appearance
- SuperGrid aggregation cells: dominant status wins (deleted > modified > new) for cell's left stripe
- Change data from ImportResult IDs: track insertedIds, updatedIds, deletedIds as session-only in-memory sets
- Source provenance: bottom border color per source type (thin colored bottom border on cards)
- Muted/pastel color palette designed for dark theme (--bg-card: #1e1e2e) background
- 9 source types need 9 distinct muted hues
- SuperGrid aggregation cells: dominant source wins (most card_ids determines cell's bottom border color)
- Cards with source=null (manually created) get no bottom border
- Source field exists in Card DB type but NOT in CardDatum -- needs to be projected to views
- Aggregation styling: italic + --text-secondary color for SQL-calculated values
- Aggregation styling: applies to cells with count > 1 or SQL-aggregated summaries, NOT single-card cells
- Aggregation styling: always visible, independent of audit toggle
- Toggle: toolbar icon + keyboard shortcut to toggle audit mode on/off
- Toggle OFF: all change stripes and source borders disappear; aggregation styling stays
- Floating legend panel appears near toggle when audit is ON
- Legend: two sections -- "Changes" (green/orange/red meanings) and "Sources" (color-to-source mapping)
- Legend: dismissible or auto-hides

### Claude's Discretion
- Exact keyboard shortcut choice (Shift+A, Cmd+Shift+A, etc.)
- Toolbar icon design (eye, magnifying glass, etc.)
- Exact muted/pastel color values for 9 source types
- Legend panel positioning and dismiss behavior
- How to extend CardDatum to include source (add field vs. separate lookup)
- CSS class naming and implementation approach for stripes/borders
- Exact opacity value for deleted cards
- Animation/transition when toggling audit on/off

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUDIT-01 | User can see new cards via green visual indicator across all 9 views | Change tracking sets (insertedIds) + CSS left-border stripe via CardRenderer/view-specific rendering |
| AUDIT-02 | User can see modified cards via orange visual indicator across all 9 views | Extend ImportResult with updatedIds + CSS left-border stripe |
| AUDIT-03 | User can see deleted cards via red visual indicator across all 9 views | Extend DedupEngine to detect deleted cards + CSS left-border + opacity reduction |
| AUDIT-04 | Change indicators persist for current session only, clear on app restart | In-memory Set<string> for each category -- Tier 3 ephemeral, no persistence |
| AUDIT-05 | User can see source provenance color coding on cards based on import origin | Add source to CardDatum + CSS bottom-border with 9-color palette |
| AUDIT-06 | User can see source legend showing color-to-source mapping | Floating legend panel component |
| AUDIT-07 | User can distinguish SQL-calculated values from raw data in SuperGrid | Aggregation styling using existing isSummary/count fields |
| AUDIT-08 | User can toggle audit overlay on/off | Toggle state + CSS class on root container + keyboard shortcut |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9 | All implementation code | Project standard |
| D3.js | v7.9 | Data join for card rendering, class manipulation | Project standard |
| CSS Custom Properties | N/A | Design token system for audit colors | Follows existing design-tokens.css pattern |
| Vitest | 4.0 | Unit tests | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| No new dependencies | - | - | This phase requires zero new npm packages |

**Installation:**
```bash
# No new packages needed -- purely additive to existing stack
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  audit/
    AuditState.ts          # Session-only change tracking + source provenance state
    AuditOverlay.ts        # Toggle logic + CSS class injection + legend component
    audit-colors.ts        # Color constants for source types + change indicators
  views/
    types.ts               # CardDatum extended with `source` field
    CardRenderer.ts        # Modified to apply audit CSS classes
    SuperGrid.ts           # Modified for aggregation styling + cell-level audit
  styles/
    audit.css              # All audit-related CSS rules
    design-tokens.css      # Extended with --audit-* and --source-* tokens
```

### Pattern 1: Session-Only State Manager (AuditState)
**What:** A singleton class holding three `Set<string>` collections (insertedIds, updatedIds, deletedIds) and methods to query audit status for any card ID. Also holds `auditEnabled` toggle boolean.
**When to use:** After every import completes, the import result handler adds IDs to the appropriate sets. Views query during render.
**Example:**
```typescript
// AuditState.ts -- Tier 3 ephemeral, no persistence
export class AuditState {
  private _insertedIds = new Set<string>();
  private _updatedIds = new Set<string>();
  private _deletedIds = new Set<string>();
  private _enabled = false;
  private _listeners: Array<() => void> = [];

  /** Returns 'new' | 'modified' | 'deleted' | null for a given card ID */
  getChangeStatus(id: string): 'new' | 'modified' | 'deleted' | null {
    if (this._deletedIds.has(id)) return 'deleted';
    if (this._updatedIds.has(id)) return 'modified';
    if (this._insertedIds.has(id)) return 'new';
    return null;
  }

  /** Accumulate import results (called after each import) */
  addImportResult(result: { insertedIds: string[]; updatedIds: string[]; deletedIds: string[] }): void {
    for (const id of result.insertedIds) this._insertedIds.add(id);
    for (const id of result.updatedIds) this._updatedIds.add(id);
    for (const id of result.deletedIds) this._deletedIds.add(id);
    this._notify();
  }

  get enabled(): boolean { return this._enabled; }
  toggle(): void { this._enabled = !this._enabled; this._notify(); }

  subscribe(cb: () => void): () => void {
    this._listeners.push(cb);
    return () => { this._listeners = this._listeners.filter(l => l !== cb); };
  }

  private _notify(): void {
    for (const cb of this._listeners) cb();
  }
}
```

### Pattern 2: CSS Class Injection for Toggle
**What:** When audit is toggled ON, add a CSS class to the root container (e.g., `#app.audit-mode`). All audit CSS rules are scoped under `.audit-mode`, so toggling the class on/off instantly shows/hides all indicators.
**When to use:** This is the standard approach for feature toggles that affect visual presentation across many views.
**Example:**
```css
/* Audit change stripe -- only visible when .audit-mode is active */
.audit-mode .card[data-audit="new"] {
  border-left: 3px solid var(--audit-new);
}
.audit-mode .card[data-audit="modified"] {
  border-left: 3px solid var(--audit-modified);
}
.audit-mode .card[data-audit="deleted"] {
  border-left: 3px solid var(--audit-deleted);
  opacity: 0.5;
}

/* Source provenance -- only visible when .audit-mode is active */
.audit-mode .card[data-source="apple_notes"] {
  border-bottom: 2px solid var(--source-apple-notes);
}
/* ... one rule per source type ... */

/* Aggregation styling -- ALWAYS visible (not scoped under .audit-mode) */
.supergrid-card[data-aggregate="true"],
.data-cell[data-summary="true"] .supergrid-card {
  font-style: italic;
  color: var(--text-secondary);
}
```

### Pattern 3: CardDatum Source Extension
**What:** Add `source: string | null` field to `CardDatum` interface and map it in `toCardDatum()`.
**When to use:** This is the cleanest approach -- the field already exists in the database schema and in Worker query results. Just needs to be included in the projection.
**Example:**
```typescript
// In views/types.ts -- extend CardDatum
export interface CardDatum {
  // ... existing fields ...
  /** Import source type for provenance color coding; null for manually created cards */
  source: string | null;
}

// In toCardDatum()
export function toCardDatum(row: Record<string, unknown>): CardDatum {
  return {
    // ... existing mappings ...
    source: row['source'] != null ? String(row['source']) : null,
  };
}
```

### Pattern 4: View-Specific Audit Application
**What:** Each view type applies audit indicators differently based on its rendering approach.
**When to use:** During the D3 data join or DOM construction in each view's render method.

| View | Rendering | Change Stripe | Source Border | Mechanism |
|------|-----------|---------------|---------------|-----------|
| ListView | SVG (renderSvgCard) | SVG rect left border | SVG rect bottom border | Extra rect elements in renderSvgCard |
| GridView | SVG (renderSvgCard) | SVG rect left border | SVG rect bottom border | Same as ListView |
| TimelineView | SVG (renderSvgCard) | SVG rect left border | SVG rect bottom border | Same as ListView |
| KanbanView | HTML (renderHtmlCard) | CSS border-left | CSS border-bottom | CSS data attributes |
| CalendarView | HTML (renderHtmlCard) | CSS border-left | CSS border-bottom | CSS data attributes |
| GalleryView | HTML (pure DOM) | CSS border-left | CSS border-bottom | CSS data attributes on tiles |
| NetworkView | SVG (circles) | Circle stroke color | Circle stroke-dasharray | SVG stroke styling on node circles |
| TreeView | SVG (circles + text) | Circle stroke color | Circle stroke-dasharray | SVG stroke styling on node circles |
| SuperGrid | HTML (CSS Grid cells) | CSS border-left on data-cell | CSS border-bottom on data-cell | CSS data attributes on cells |

### Anti-Patterns to Avoid
- **Storing audit state in SQLite:** This is Tier 3 ephemeral data. Do not persist it. Session-only means in-memory `Set<string>` objects that are GC'd on page unload.
- **Using separate DOM overlay layer:** Do not create a second DOM tree overlaid on the view. Apply audit styling directly to existing card elements via data attributes and CSS.
- **Re-querying on audit toggle:** Toggle is pure CSS class swap on the container. No Worker re-query needed. The audit data attributes are already on the elements.
- **Modifying database schema for audit:** No new tables, no new columns. Change tracking uses in-memory sets. Source provenance uses the existing `cards.source` column.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color palette generation | Manual hex picking for 9 colors | Pre-defined palette optimized for dark backgrounds | Color perception on dark backgrounds is tricky; use researched palette |
| Toggle state management | Custom pub/sub system | Simple class + subscribe pattern matching existing providers | Consistency with SelectionProvider (Tier 3) pattern |
| CSS scoping | Manual show/hide on each element | Parent class toggle (.audit-mode) with descendant selectors | One DOM operation toggles everything; no per-element iteration |

**Key insight:** The audit overlay is a rendering concern, not a data concern. All data already exists (cards.source in DB, ImportResult.insertedIds from imports). The phase is about surfacing this data visually with minimal code.

## Common Pitfalls

### Pitfall 1: ImportResult Missing updatedIds and deletedIds
**What goes wrong:** Currently `ImportResult` only has `insertedIds: string[]`. The `updated` count exists but individual IDs are not tracked. `deletedIds` doesn't exist at all.
**Why it happens:** Original ETL design only needed insertedIds for post-import actions.
**How to avoid:** Extend `ImportResult` interface to include `updatedIds: string[]` and `deletedIds: string[]`. Extend `DedupEngine` to return `toUpdate` IDs. For deleted cards: after DedupEngine runs, query cards with matching source type that were NOT in the incoming set -- those are candidates for deletion marking.
**Warning signs:** Tests pass for insert/update counts but audit overlay shows no orange/red indicators.

### Pitfall 2: SVG Views Cannot Use CSS border-left
**What goes wrong:** SVG elements (used by ListView, GridView, TimelineView) do not support CSS `border-left`. Attempting to set `border-left` on an SVG `<rect>` or `<g>` does nothing.
**Why it happens:** SVG has its own styling model (stroke, fill) separate from CSS box model.
**How to avoid:** For SVG-based views, add a thin `<rect>` element (3-4px wide, full height) positioned at x=0 as the change stripe. For source provenance, add a thin `<rect>` at the bottom. These are additional SVG child elements inside the card's `<g>` group, not CSS properties.
**Warning signs:** Change indicators work in Kanban/Calendar but not in List/Grid/Timeline.

### Pitfall 3: Source Not in CardDatum Means Views Can't Render Provenance
**What goes wrong:** Views receive `CardDatum[]` which currently lacks the `source` field. Without it, views cannot determine which source border color to apply.
**Why it happens:** `CardDatum` was designed as a minimal projection for rendering. `source` was not needed before.
**How to avoid:** Add `source: string | null` to `CardDatum` interface and map it in `toCardDatum()`. The `source` column is already selected in card queries (it's in the cards table schema).
**Warning signs:** Change indicators work but source provenance borders are always missing.

### Pitfall 4: SuperGrid Cells Have card_ids, Not Individual Card Source/Status
**What goes wrong:** SuperGrid cells aggregate multiple cards. A single cell may contain cards from different sources with different change statuses. Applying a single border color requires a "dominant wins" resolution.
**Why it happens:** SuperGrid uses `GROUP_CONCAT` to collect card_ids per cell. Individual card metadata is not included in the cell query result.
**How to avoid:** For change status: lookup each card_id in AuditState, apply priority (deleted > modified > new). For source provenance: need to lookup source for each card_id. Two approaches: (a) maintain a card-id-to-source map in AuditState populated during import, or (b) query the source for card_ids at render time. Option (a) is more efficient since it avoids per-cell queries.
**Warning signs:** SuperGrid cells always show neutral styling even when constituent cards have audit data.

### Pitfall 5: Deleted Card Detection Requires Source-Scoped Comparison
**What goes wrong:** Simply marking cards not in the incoming set as "deleted" would flag ALL cards from other sources as deleted.
**Why it happens:** DedupEngine processes one source type at a time. Cards from unrelated sources should not be affected.
**How to avoid:** Deleted detection must be scoped to the same source type: "cards with source=X AND source_id NOT IN (incoming source_ids from this import)". This gives the set of cards that existed previously for this source but are now absent.
**Warning signs:** Importing Apple Notes marks all CSV-imported cards as deleted.

### Pitfall 6: NetworkView and TreeView Don't Use CardRenderer
**What goes wrong:** These views render circles/nodes, not card rectangles. The CardRenderer approach (left border stripe, bottom border) doesn't apply.
**Why it happens:** Graph views use a fundamentally different visual representation.
**How to avoid:** For NetworkView/TreeView, use SVG circle stroke color for change status and a secondary visual indicator (e.g., ring/outline) for source provenance. The indicators should be visually analogous but adapted to the circular form factor.
**Warning signs:** Audit works in 7 views but NetworkView and TreeView show no indicators.

### Pitfall 7: Aggregation Styling Conflicts with Existing SuperCard Styling
**What goes wrong:** SuperCard elements already have `fontStyle: 'italic'` set inline. Adding a CSS class for aggregation italic styling would be redundant or could conflict.
**Why it happens:** SuperGrid renders SuperCards with inline styles for font-style and font-size.
**How to avoid:** The aggregation styling should change the `color` to `var(--text-secondary)` to visually distinguish from raw data. The italic is already applied. Ensure the CSS rule targets `[data-aggregate="true"]` on the SuperCard element and sets `color` only (not re-setting font-style).
**Warning signs:** SuperCards look the same before and after aggregation styling because italic was already applied.

## Code Examples

### Extending ImportResult with updatedIds and deletedIds
```typescript
// In etl/types.ts
export interface ImportResult {
  // ... existing fields ...
  insertedIds: string[];
  updatedIds: string[];    // NEW: IDs of cards that were updated
  deletedIds: string[];    // NEW: IDs of cards no longer in source
}
```

### DedupEngine Deleted Detection
```typescript
// After dedup.process() returns, detect deleted cards
// Cards that exist in DB for this source but were NOT in the incoming set
const existingSourceIds = new Set(
  db.prepare<{ id: string }>(
    'SELECT id FROM cards WHERE source = ? AND deleted_at IS NULL'
  ).all(sourceType).map(r => r.id)
);
const incomingIds = new Set(dedupResult.sourceIdMap.values());
const deletedIds = [...existingSourceIds].filter(id => !incomingIds.has(id));
```

### Audit Color Tokens
```css
/* In design-tokens.css or audit.css */
:root {
  /* Change indicators */
  --audit-new: #4ade80;         /* Green -- muted for dark theme */
  --audit-modified: #fb923c;    /* Orange */
  --audit-deleted: #f87171;     /* Red */

  /* Source provenance (muted pastels for dark background) */
  --source-apple-notes: #fbbf24;    /* Warm amber */
  --source-markdown: #a78bfa;       /* Soft purple */
  --source-csv: #34d399;            /* Teal green */
  --source-json: #60a5fa;           /* Sky blue */
  --source-excel: #2dd4bf;          /* Cyan */
  --source-html: #f472b6;           /* Pink */
  --source-native-reminders: #c084fc; /* Lavender */
  --source-native-calendar: #fcd34d;  /* Yellow gold */
  --source-native-notes: #fdba74;    /* Peach */
}
```

### HTML Card Audit Attributes (KanbanView/CalendarView/GalleryView)
```typescript
// In renderHtmlCard or view-specific render
function applyAuditAttributes(el: HTMLElement, d: CardDatum, auditState: AuditState): void {
  const status = auditState.getChangeStatus(d.id);
  if (status) {
    el.dataset['audit'] = status;
  } else {
    delete el.dataset['audit'];
  }
  if (d.source) {
    el.dataset['source'] = d.source;
  } else {
    delete el.dataset['source'];
  }
}
```

### SVG Card Audit Elements (ListView/GridView/TimelineView)
```typescript
// In renderSvgCard -- add audit stripe and source border as child SVG elements
function renderAuditOverlay(
  g: d3.Selection<SVGGElement, CardDatum, SVGElement | null, unknown>,
  d: CardDatum,
  auditState: AuditState,
  width: number,
  height: number
): void {
  const status = auditState.getChangeStatus(d.id);

  // Change stripe (left border)
  g.selectAll<SVGRectElement, CardDatum>('rect.audit-stripe')
    .data(status ? [d] : [], d => d.id)
    .join(
      enter => enter.append('rect')
        .attr('class', 'audit-stripe')
        .attr('width', 3)
        .attr('height', height)
        .attr('rx', 2),
      update => update,
      exit => exit.remove()
    )
    .attr('fill', status === 'new' ? 'var(--audit-new)'
      : status === 'modified' ? 'var(--audit-modified)'
      : 'var(--audit-deleted)');

  // Source provenance (bottom border)
  const sourceColor = d.source ? getSourceColor(d.source) : null;
  g.selectAll<SVGRectElement, CardDatum>('rect.source-stripe')
    .data(sourceColor ? [d] : [], d => d.id)
    .join(
      enter => enter.append('rect')
        .attr('class', 'source-stripe')
        .attr('y', height - 2)
        .attr('width', width)
        .attr('height', 2),
      update => update,
      exit => exit.remove()
    )
    .attr('fill', sourceColor ?? 'transparent');
}
```

### SuperGrid Cell Audit
```typescript
// Inside SuperGrid._renderCells D3 .each() callback
// After existing cell content rendering:

// Audit: change status stripe (left border)
if (auditState.enabled) {
  const dominantStatus = getDominantChangeStatus(d.cardIds, auditState);
  if (dominantStatus) {
    el.dataset['audit'] = dominantStatus;
  } else {
    delete el.dataset['audit'];
  }
  // Source provenance (bottom border)
  const dominantSource = getDominantSource(d.cardIds, cardSourceMap);
  if (dominantSource) {
    el.dataset['source'] = dominantSource;
  } else {
    delete el.dataset['source'];
  }
}

function getDominantChangeStatus(
  cardIds: string[],
  auditState: AuditState
): 'deleted' | 'modified' | 'new' | null {
  let hasNew = false, hasModified = false, hasDeleted = false;
  for (const id of cardIds) {
    const s = auditState.getChangeStatus(id);
    if (s === 'deleted') hasDeleted = true;
    else if (s === 'modified') hasModified = true;
    else if (s === 'new') hasNew = true;
  }
  if (hasDeleted) return 'deleted';
  if (hasModified) return 'modified';
  if (hasNew) return 'new';
  return null;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ImportResult has insertedIds only | Need insertedIds + updatedIds + deletedIds | Phase 37 | Enables change tracking overlay |
| CardDatum has 11 fields (no source) | CardDatum needs source field (12 fields) | Phase 37 | Enables provenance color coding |
| SuperGrid aggregation cells styled same as raw | Aggregation cells styled italic + secondary color | Phase 37 | Visual distinction for calculated values |

**Deprecated/outdated:**
- None -- this phase is purely additive with no deprecations.

## Open Questions

1. **Card-to-source map for SuperGrid cells**
   - What we know: SuperGrid cells have `card_ids` but not per-card source values. Need source lookup for dominant-source calculation.
   - What's unclear: Whether to maintain an in-memory `Map<string, string>` (cardId -> source) populated during imports, or to query the Worker for source values per cell on render.
   - Recommendation: Maintain the map in AuditState. It's populated once per import (same time as insertedIds) and read many times during render. Avoids per-cell Worker queries which would violate the <16ms render budget.

2. **Deleted card detection timing**
   - What we know: Deleted cards are those present in DB for a source type but absent from the latest import. Detection requires comparing DB state with incoming data.
   - What's unclear: Should deletion detection happen in the Worker (inside DedupEngine) or on the main thread after the import result returns?
   - Recommendation: Extend DedupEngine to detect deletions in the Worker. It already loads all existing cards for the source type in `process()`. Adding a deletion check there is natural and avoids a second query.

3. **Audit state persistence across view switches**
   - What we know: AuditState must survive view switches (user toggles audit ON, switches from List to Grid, audit should still be ON). Similar to SelectionProvider (Tier 3).
   - What's unclear: Whether to make AuditState a provider registered with StateCoordinator, or keep it independent.
   - Recommendation: Keep it independent with its own subscribe pattern (like SuperPositionProvider). Audit toggle should NOT trigger a re-query -- it's a CSS class toggle. Registering with StateCoordinator would trigger unnecessary Worker calls.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/views/types.ts` - CardDatum interface and toCardDatum() mapping
- Existing codebase: `src/etl/types.ts` - ImportResult interface (insertedIds exists, updatedIds/deletedIds missing)
- Existing codebase: `src/etl/DedupEngine.ts` - Classification logic (toInsert/toUpdate/toSkip)
- Existing codebase: `src/etl/ImportOrchestrator.ts` - Import pipeline wiring
- Existing codebase: `src/views/CardRenderer.ts` - SVG and HTML card rendering
- Existing codebase: `src/views/SuperGrid.ts` - Cell rendering with isSummary, CellPlacement
- Existing codebase: `src/styles/design-tokens.css` - CSS custom property system
- Existing codebase: `src/database/schema.sql` - cards.source column already exists

### Secondary (MEDIUM confidence)
- CSS `data-*` attribute selectors are well-supported in all target browsers (Safari 17+)
- CSS custom properties cascade correctly within `.audit-mode` scoping

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, uses existing patterns
- Architecture: HIGH - Follows established codebase patterns (providers, CSS tokens, CardRenderer)
- Pitfalls: HIGH - Identified through direct codebase inspection of all 9 view implementations
- Data flow: HIGH - ImportResult and DedupEngine code examined in detail

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- all patterns are internal codebase patterns, no external dependency drift)
