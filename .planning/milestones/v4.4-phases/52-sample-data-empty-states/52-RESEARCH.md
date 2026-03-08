# Phase 52: Sample Data + Empty States - Research

**Researched:** 2026-03-08
**Domain:** Sample data loading, empty state UX, ETL pipeline integration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Three curated demo datasets (not generic placeholders):
  1. **Apple historical revenue** -- product family evolution over time
  2. **Northwind graph** -- graph-focused update of the classic demo (SQL already written)
  3. **Meryl Streep film career** -- graph/timeline format (SQL already written)
- Each dataset varies in natural size (not constrained to ~25 cards each)
- All LATCH axes fully populated per card (category, time, hierarchy, location, alphabet)
- Connections curated for visual impact -- hub nodes, clusters, chains
- Data bundled as static JSON files (one per dataset, ~3-5KB each), loaded via INSERT into sql.js
- Existing SQL needs transformation/mapping to Isometry card schema during research/planning
- "Rotating default + browse" pattern: `Try: Apple Revenue v` -- click loads, chevron opens picker
- Sample data CTA appears ABOVE import buttons on welcome panel (hero position)
- Instant transition on load -- sub-100ms INSERT, no loading indicator
- After loading, navigate to dataset-specific best view (Apple -> Timeline, Northwind -> Network, Meryl Streep -> Timeline)
- Each dataset JSON includes a `defaultView` field specifying its showcase view
- Sample cards use `source='sample'` and `source_id='dataset-name:card-id'`
- CloudKit sync exclusion: filter at sync boundary -- `export-all-cards` adds `WHERE source != 'sample'`
- No confirmation dialog when clearing -- instant clear
- "Clear Sample Data" discoverable via command palette only (Actions category, visible when sample cards exist)
- On first real import while sample data loaded: prompt user "Clear sample data?" with Yes/No
- Welcome panel redesigned: "Explore Isometry" heading, sample data hero CTA, import buttons secondary
- Filtered-empty state: keep as-is from Phase 43 (no changes needed)
- Welcome panel reappears whenever card count drops to zero

### Claude's Discretion
- Default dataset rotation order/logic
- Exact dropdown component implementation for dataset picker
- Card schema mapping details for each dataset
- Exact copy for the import prompt when sample data is present

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Summary

Phase 52 adds three curated sample datasets to Isometry's welcome experience, allowing first-time users to explore all 9 views immediately. The implementation touches four layers: (1) static JSON data files bundled at build time, (2) a SampleDataManager module that INSERTs cards and connections into sql.js via the existing Worker bridge, (3) a redesigned welcome panel in ViewManager with a dataset picker dropdown, and (4) integration points in the command palette, sync boundary, and import flow.

The existing ETL pipeline (`source`/`source_id` fields, DedupEngine, SQLiteWriter) provides a proven pattern for source-tagged data. Sample cards use `source='sample'` which naturally integrates with AuditState for visual identification and enables surgical deletion via `DELETE FROM cards WHERE source = 'sample'`. The sync exclusion is a single WHERE clause addition in `NativeBridge.ts`'s `exportAllCards` function. The command palette's `visible` predicate pattern (already used by "Clear Filters") supports conditional "Clear Sample Data" visibility.

**Primary recommendation:** Build a thin SampleDataManager class that accepts the WorkerBridge, loads bundled JSON, and uses `db:exec` for batch INSERT (bypassing DedupEngine entirely since sample data is ephemeral and never re-imported). Wire it into ViewManager's welcome panel and CommandRegistry for lifecycle management.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SMPL-01 | Welcome panel shows "Try with sample data" CTA that loads curated cards populating all 9 views | ViewManager._showWelcome() is the modification point (lines 503-555); dataset JSON files provide cards+connections; SampleDataManager handles INSERT via db:exec; after load, switchTo(defaultView) navigates to showcase |
| SMPL-02 | Sample data visually identifiable in audit overlay (source='sample') | AuditState._cardSourceMap already tracks source per card ID; source='sample' naturally appears in audit legend; no AuditState changes needed |
| SMPL-03 | Sample data excluded from CloudKit sync | NativeBridge.ts exportAllCards query (line 279) needs WHERE source != 'sample' filter; single line change |
| SMPL-04 | User can clear all sample data without affecting real imported data | DELETE FROM cards WHERE source = 'sample' + DELETE FROM connections WHERE source_id NOT IN (SELECT id FROM cards) cascades connections; CommandRegistry gets "Clear Sample Data" with visible predicate |
| SMPL-05 | View-specific empty states show guided CTAs | Already implemented in Phase 43 (VIEW_EMPTY_MESSAGES + _showFilteredEmpty); no changes needed per CONTEXT.md |
| SMPL-06 | Three curated datasets with connections for visual impact | Static JSON files with CanonicalCard[] + CanonicalConnection[] per dataset; defaultView field for post-load navigation |
| SMPL-07 | Sample data prompt on first real import: "Clear sample data?" with Yes/No | Import flow wrapper in main.ts checks for source='sample' cards before import; simple confirm() dialog or inline prompt |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sql.js | 1.14 | Database engine -- sample cards inserted via db:exec | Already the system of record |
| D3.js | v7.9 | View rendering -- no changes, sample data triggers normal render pipeline | Already powers all 9 views |
| TypeScript | 5.9 | Type-safe SampleDataManager, dataset interfaces | Already the project language |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vite | 7.3 | Bundle static JSON files via `?raw` or standard import | JSON imports work out of the box |
| Vitest | 4.0 | Unit tests for SampleDataManager, integration tests for welcome panel | TDD per project convention |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| db:exec raw SQL | etl:import pipeline | DedupEngine overhead is unnecessary for ephemeral sample data that is never re-imported; db:exec is simpler and faster |
| Static JSON bundled | Fetched from network | Network dependency breaks offline-first principle; JSON files are <5KB each |
| confirm() for import prompt | Custom modal | confirm() is blocking and ugly but sufficient; custom modal is over-engineering for a single prompt |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── sample/                    # NEW: Sample data module
│   ├── SampleDataManager.ts   # Load/clear logic, dataset registry
│   ├── datasets/              # Static JSON data files
│   │   ├── apple-revenue.json
│   │   ├── northwind.json
│   │   └── meryl-streep.json
│   └── types.ts               # SampleDataset interface
├── views/
│   └── ViewManager.ts         # Modified: welcome panel redesign
├── native/
│   └── NativeBridge.ts        # Modified: sync exclusion filter
└── main.ts                    # Modified: SampleDataManager wiring
```

### Pattern 1: SampleDataManager as Thin Orchestrator
**What:** A class that loads bundled JSON datasets and executes SQL INSERTs via the Worker bridge, then triggers a view switch. It also provides a `clear()` method and a `hasSampleData()` check.
**When to use:** Called from welcome panel button click and command palette actions.
**Key design points:**
- Uses `db:exec` (not `etl:import`) to avoid DedupEngine overhead -- sample data is write-once, never re-imported
- Constructs parameterized INSERT statements for cards and connections
- Returns a Promise that resolves after all INSERTs complete
- `hasSampleData()` queries `SELECT COUNT(*) FROM cards WHERE source = 'sample'` -- used by CommandRegistry visibility predicate and import prompt guard
- `clear()` executes `DELETE FROM cards WHERE source = 'sample'` (connections cascade via FK ON DELETE CASCADE)

```typescript
interface SampleDataset {
  id: string;              // e.g., 'apple-revenue'
  name: string;            // e.g., 'Apple Revenue'
  defaultView: ViewType;   // e.g., 'timeline'
  cards: CanonicalCard[];
  connections: CanonicalConnection[];
}
```

### Pattern 2: Static JSON Import via Vite
**What:** JSON files imported directly via ES module import (Vite handles JSON modules natively).
**When to use:** Bundling dataset files at build time.
**Example:**
```typescript
// Vite resolves JSON imports to parsed objects at build time
import appleRevenue from './datasets/apple-revenue.json';
import northwind from './datasets/northwind.json';
import merylStreep from './datasets/meryl-streep.json';
```
**Confidence:** HIGH -- Vite JSON imports are a standard feature documented in Vite's static asset handling.

### Pattern 3: Welcome Panel Redesign
**What:** Modify `ViewManager._showWelcome()` to add sample data CTA above import buttons. The CTA uses the "rotating default + browse" dropdown pattern.
**When to use:** When `totalCount === 0` (welcome panel condition already exists).
**Key elements:**
- Hero section: `<button class="sample-data-btn">Try: Apple Revenue <span class="chevron">▾</span></button>`
- Dropdown: `<div class="sample-data-dropdown">` with three dataset options
- Import buttons move below: "Or import your own data" subheading
- New heading: "Explore Isometry" replaces "Welcome to Isometry"
- New description: more exploratory copy

### Pattern 4: Sync Boundary Filter
**What:** Add `WHERE source != 'sample'` to the export-all-cards query in NativeBridge.ts.
**When to use:** Always -- sample data must never sync to CloudKit.
**Implementation:**
```typescript
// In NativeBridge.ts exportAllCards:
const rows = await unwrappedSend('db:query', {
  sql: "SELECT * FROM cards WHERE deleted_at IS NULL AND source != 'sample'",
  params: [],
});
```
**Confidence:** HIGH -- single line change, pattern is straightforward.

### Pattern 5: Import Prompt Guard
**What:** Before real import completes, check if sample data exists. If yes, prompt user to clear it.
**When to use:** In the bridge.importFile / bridge.importNative wrappers in main.ts (lines 599-612).
**Implementation:**
```typescript
// In the import wrapper in main.ts, BEFORE calling originalImportFile:
const hasSample = await bridge.send('db:query', {
  sql: "SELECT COUNT(*) as count FROM cards WHERE source = 'sample'",
  params: [],
});
if (hasSample.rows[0].count > 0) {
  const clear = confirm('Clear sample data before importing?');
  if (clear) {
    await sampleManager.clear();
  }
}
```

### Anti-Patterns to Avoid
- **Using DedupEngine for sample data:** Sample data is ephemeral, never re-imported, and has known-good IDs. DedupEngine's source_id lookup and modified_at comparison adds unnecessary overhead and complexity.
- **Storing dataset selection state in sql.js:** The current/selected dataset is UI-only state. Use a module-level variable or localStorage, not the database.
- **Creating a new Worker message type for sample data:** `db:exec` already handles arbitrary SQL. Adding a dedicated `sample:load` type would bloat the protocol for a one-off use case.
- **Modifying AuditState for sample data:** AuditState already tracks source via `_cardSourceMap`. Sample cards with `source='sample'` are automatically identifiable. No AuditState changes needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON bundling | Custom loader/fetcher | Vite native JSON import | Vite handles JSON modules, tree-shaking, and bundling automatically |
| Dropdown UI | Full select component | Simple DOM dropdown with click-outside close | Project already uses this pattern in CommandBar settings dropdown (Phase 54) |
| Source-scoped deletion | Custom cascade logic | SQL `DELETE FROM cards WHERE source = 'sample'` + FK ON DELETE CASCADE | connections table has `ON DELETE CASCADE` on source_id FK -- deleting cards automatically removes their connections |
| Dataset rotation | Complex state machine | Simple array index with modulo | Three datasets, rotate on each app launch via `Date.now() % 3` or similar |

**Key insight:** The existing ETL pipeline (`source`/`source_id` pattern), command palette (`visible` predicates), and FK cascade constraints already solve the hard problems. This phase is primarily data authoring and UI wiring, not infrastructure.

## Common Pitfalls

### Pitfall 1: Connection FK Cascade Gotcha
**What goes wrong:** Deleting sample cards but leaving orphaned connections, or connections referencing deleted sample card IDs causing FK constraint errors.
**Why it happens:** If connections are inserted with source_id/target_id referencing sample card UUIDs, deleting those cards must cascade to connections.
**How to avoid:** The schema already has `ON DELETE CASCADE` on connections.source_id and connections.target_id. A simple `DELETE FROM cards WHERE source = 'sample'` will cascade to remove all connections involving sample cards.
**Warning signs:** Leftover connections after clearing sample data; FK constraint errors on subsequent imports.

### Pitfall 2: Sample Data Triggering CloudKit Sync
**What goes wrong:** Loading sample data in native shell triggers mutation hook, which posts 'mutated' to Swift, which queues sample cards for CloudKit upload.
**Why it happens:** `db:exec` is in the MUTATING_TYPES set (line 110 of NativeBridge.ts). Any db:exec call triggers the mutation hook.
**How to avoid:** Two-pronged approach: (1) Use the unwrapped bridge.send (captured before mutation hook installation) if loading from native context, OR (2) more practically, filter at the sync boundary (exportAllCards WHERE source != 'sample'). The sync boundary filter is the simpler and more robust approach -- even if mutation hook fires, exportAllCards won't include sample cards.
**Warning signs:** Sample cards appearing on other devices after sync.

### Pitfall 3: Welcome Panel Not Reappearing After Sample Data Clear
**What goes wrong:** User clears sample data but the view stays on the last-viewed state instead of showing the welcome panel.
**Why it happens:** Clearing sample data changes db state but ViewManager doesn't know to re-check the empty state.
**How to avoid:** After `sampleManager.clear()`, call `coordinator.scheduleUpdate()` to trigger ViewManager's `_fetchAndRender()`. If the query returns 0 cards, `_showEmpty()` will show the welcome panel automatically.
**Warning signs:** Blank view after clearing sample data.

### Pitfall 4: db:exec vs. db:query for Batch INSERT
**What goes wrong:** Using `db:query` for INSERT statements fails or returns unexpected results.
**Why it happens:** `db:query` is designed for SELECT (returns `{ columns, rows }`). `db:exec` is for write operations (returns `{ changes }`).
**How to avoid:** Always use `db:exec` for INSERT/UPDATE/DELETE operations. Use `db:query` only for SELECT operations (like the hasSampleData check).
**Warning signs:** Empty results from write operations, silent failures.

### Pitfall 5: Dataset JSON Size and Vite Bundling
**What goes wrong:** Large JSON datasets bloat the main bundle, slowing initial page load.
**Why it happens:** Vite inlines JSON imports into the JavaScript bundle.
**How to avoid:** Each dataset is specified as ~3-5KB. At 3 datasets, total is ~9-15KB -- negligible. If datasets grow, use dynamic `import()` for lazy loading. For now, static import is fine.
**Warning signs:** Main bundle growing by >50KB (would indicate datasets are too large).

### Pitfall 6: Sample Card IDs Must Be Deterministic
**What goes wrong:** Using `crypto.randomUUID()` for sample card IDs means each load creates new cards instead of being idempotent. Repeated loads without clearing duplicate the data.
**Why it happens:** UUID generation is random; DedupEngine is not used.
**How to avoid:** Use deterministic IDs in the JSON files (e.g., `sample-apple-001`, `sample-nw-001`). The `source`/`source_id` unique index (`idx_cards_source`) prevents duplicate insertion -- but since we use `db:exec` (not INSERT OR IGNORE), we should check for existing sample data before inserting, or use `INSERT OR REPLACE`.
**Warning signs:** Card count doubling each time user clicks the sample data button.

## Code Examples

### Dataset JSON Structure
```json
{
  "id": "apple-revenue",
  "name": "Apple Revenue",
  "defaultView": "timeline",
  "cards": [
    {
      "id": "sample-apple-001",
      "card_type": "resource",
      "name": "iPod Launch",
      "content": "Apple introduces the iPod, revolutionizing portable music",
      "summary": null,
      "latitude": 37.3318,
      "longitude": -122.0312,
      "location_name": "Cupertino, CA",
      "created_at": "2001-10-23T00:00:00Z",
      "modified_at": "2001-10-23T00:00:00Z",
      "due_at": null,
      "completed_at": null,
      "event_start": "2001-10-23T00:00:00Z",
      "event_end": null,
      "folder": "Hardware",
      "tags": ["product-launch", "music"],
      "status": "shipped",
      "priority": 1,
      "sort_order": 0,
      "url": null,
      "mime_type": null,
      "is_collective": false,
      "source": "sample",
      "source_id": "apple-revenue:ipod-launch",
      "source_url": null,
      "deleted_at": null
    }
  ],
  "connections": [
    {
      "id": "sample-conn-apple-001",
      "source_id": "sample-apple-001",
      "target_id": "sample-apple-002",
      "via_card_id": null,
      "label": "evolved_into",
      "weight": 0.8,
      "created_at": "2001-10-23T00:00:00Z"
    }
  ]
}
```

### SampleDataManager Core Implementation
```typescript
export class SampleDataManager {
  private bridge: WorkerBridgeLike;
  private datasets: SampleDataset[];

  constructor(bridge: WorkerBridgeLike, datasets: SampleDataset[]) {
    this.bridge = bridge;
    this.datasets = datasets;
  }

  async load(datasetId: string): Promise<void> {
    const dataset = this.datasets.find(d => d.id === datasetId);
    if (!dataset) throw new Error(`Unknown dataset: ${datasetId}`);

    // Clear any existing sample data first (idempotent reload)
    await this.clear();

    // Insert cards via db:exec in a single transaction-like batch
    for (const card of dataset.cards) {
      await this.bridge.send('db:exec', {
        sql: `INSERT OR REPLACE INTO cards (
          id, card_type, name, content, summary,
          latitude, longitude, location_name,
          created_at, modified_at, due_at, completed_at,
          event_start, event_end,
          folder, tags, status,
          priority, sort_order,
          url, mime_type, is_collective,
          source, source_id, source_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          card.id, card.card_type, card.name, card.content, card.summary,
          card.latitude, card.longitude, card.location_name,
          card.created_at, card.modified_at, card.due_at, card.completed_at,
          card.event_start, card.event_end,
          card.folder, JSON.stringify(card.tags), card.status,
          card.priority, card.sort_order,
          card.url, card.mime_type, card.is_collective ? 1 : 0,
          card.source, card.source_id, card.source_url,
        ],
      });
    }

    // Insert connections
    for (const conn of dataset.connections) {
      await this.bridge.send('db:exec', {
        sql: `INSERT OR IGNORE INTO connections
          (id, source_id, target_id, via_card_id, label, weight, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [conn.id, conn.source_id, conn.target_id, conn.via_card_id, conn.label, conn.weight, conn.created_at],
      });
    }
  }

  async clear(): Promise<void> {
    await this.bridge.send('db:exec', {
      sql: "DELETE FROM cards WHERE source = 'sample'",
      params: [],
    });
    // Connections cascade via FK ON DELETE CASCADE -- no separate delete needed
  }

  async hasSampleData(): Promise<boolean> {
    const result = await this.bridge.send('db:query', {
      sql: "SELECT COUNT(*) as count FROM cards WHERE source = 'sample'",
      params: [],
    });
    // Extract count from result
    const rows = (result as { rows: Array<{ count: number }> }).rows;
    return rows.length > 0 && rows[0].count > 0;
  }

  getDatasets(): SampleDataset[] {
    return this.datasets;
  }

  getDefaultDataset(): SampleDataset {
    // Rotate based on day of year
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return this.datasets[dayOfYear % this.datasets.length];
  }
}
```

### Welcome Panel Modification
```typescript
// In ViewManager._showWelcome() -- restructured layout:
// 1. "Explore Isometry" heading
// 2. Sample data hero CTA: Try: Apple Revenue ▾
// 3. Divider text: "Or import your own data"
// 4. Import File + Import from Mac buttons (secondary)

private _showWelcome(): void {
  // ... heading: 'Explore Isometry'
  // ... description: 'Try sample data or import your own'

  // Sample data CTA (hero position)
  const sampleBtn = document.createElement('button');
  sampleBtn.className = 'sample-data-btn';
  sampleBtn.innerHTML = `Try: ${defaultDataset.name} <span class="sample-chevron">▾</span>`;
  sampleBtn.addEventListener('click', () => {
    this.onLoadSample?.(defaultDataset.id);
  });

  // Dropdown for other datasets
  const dropdown = document.createElement('div');
  dropdown.className = 'sample-data-dropdown';
  // ... render other dataset options

  // Separator
  const separator = document.createElement('p');
  separator.className = 'view-empty-separator';
  separator.textContent = 'Or import your own data';

  // Import buttons (secondary, below separator)
  // ... existing Import File + Import from Mac buttons
}
```

### Command Palette Registration
```typescript
// In main.ts, after sampleManager creation:
commandRegistry.register({
  id: 'action:clear-sample-data',
  label: 'Clear Sample Data',
  category: 'Actions',
  visible: () => {
    // Synchronous check -- need to cache hasSampleData result
    return sampleDataLoaded; // module-level boolean flag
  },
  execute: () => {
    void sampleManager.clear().then(() => {
      sampleDataLoaded = false;
      coordinator.scheduleUpdate();
    });
  },
});
```

### Sync Boundary Filter (NativeBridge.ts)
```typescript
// Line 279 change:
// Before:
const rows = await unwrappedSend('db:query', {
  sql: 'SELECT * FROM cards WHERE deleted_at IS NULL',
  params: [],
});

// After:
const rows = await unwrappedSend('db:query', {
  sql: "SELECT * FROM cards WHERE deleted_at IS NULL AND (source IS NULL OR source != 'sample')",
  params: [],
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic "no data" messages | Contextual empty states (Phase 43) | 2026-03-07 | Already implemented -- this phase extends welcome panel only |
| No sample data | Curated dataset exploration | This phase | First-time user experience transformation |
| Simple welcome panel | Sample data hero CTA + import secondary | This phase | Welcome panel becomes exploration-first |

## Open Questions

1. **Dataset content authoring**
   - What we know: User has SQL for Northwind and Meryl Streep; Apple Revenue is conceptually described
   - What's unclear: Exact card-by-card content, connection topology, LATCH axis values for each dataset
   - Recommendation: Define a schema mapping during planning (plan wave 1), with dataset authoring as a dedicated task. Keep datasets modest (15-30 cards each) for fast load and clear visual impact across all 9 views.

2. **db:exec batch performance for sample data**
   - What we know: Each db:exec call is a separate Worker round-trip. 25-30 cards = 25-30 round-trips.
   - What's unclear: Whether this is fast enough for "sub-100ms" requirement.
   - Recommendation: Use a single db:exec with multiple INSERT statements separated by semicolons (sql.js `Database.run()` supports this), OR build all INSERTs into a single transaction block. The Worker handler for db:exec already uses `db.run()` which can handle multi-statement SQL.

3. **Sample data and FTS index**
   - What we know: FTS triggers fire on INSERT, which is correct -- sample cards should be searchable.
   - What's unclear: Whether FTS optimize is needed after sample data load.
   - Recommendation: Skip FTS optimize for sample data (too few cards to benefit). The triggers will keep the index correct.

4. **Mutation hook and sample data in native shell**
   - What we know: db:exec is in MUTATING_TYPES -- loading sample data triggers 'mutated' to Swift.
   - What's unclear: Whether the mutation hook should be bypassed for sample data loads.
   - Recommendation: Don't bypass the mutation hook. The sync boundary filter (exportAllCards WHERE source != 'sample') is the correct exclusion point. The mutation hook firing is harmless -- it triggers a checkpoint and sync attempt, but exportAllCards will exclude sample cards. This is simpler and more robust than conditional mutation hook bypass.

5. **Dropdown component for dataset picker**
   - What we know: Phase 54 implemented a settings dropdown in CommandBar with click-outside-close.
   - What's unclear: Whether to reuse that exact pattern or build a simpler inline dropdown.
   - Recommendation: Build a simple inline dropdown following the same click-outside-close pattern from CommandBar. The dropdown only has 2 additional options (the other datasets) -- keep it minimal.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all integration points:
  - `src/views/ViewManager.ts` -- welcome panel implementation (lines 503-555)
  - `src/native/NativeBridge.ts` -- sync boundary (exportAllCards, lines 276-308) and mutation hook (lines 103-113, 749-774)
  - `src/main.ts` -- app bootstrap and import flow wiring (662 lines)
  - `src/palette/CommandRegistry.ts` -- command registration with visible predicates
  - `src/database/schema.sql` -- cards table with source/source_id columns, FK ON DELETE CASCADE on connections
  - `src/etl/types.ts` -- CanonicalCard interface (source is `string`, not null, for ETL)
  - `src/etl/DedupEngine.ts` -- source-scoped dedup pattern
  - `src/etl/SQLiteWriter.ts` -- batch INSERT pattern
  - `src/audit/AuditState.ts` -- _cardSourceMap tracking
  - `src/worker/protocol.ts` -- db:exec and db:query message types
  - `src/styles/views.css` -- empty state CSS classes

### Secondary (MEDIUM confidence)
- Vite JSON import behavior -- standard feature per Vite documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing libraries
- Architecture: HIGH -- all integration points verified in codebase, patterns well-established
- Pitfalls: HIGH -- sync exclusion, FK cascade, idempotency all verified against actual schema and code
- Dataset content: MEDIUM -- schema mapping is clear but actual dataset authoring requires creative work

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable -- no external dependency changes expected)
