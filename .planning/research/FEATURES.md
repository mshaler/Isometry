# Feature Research

**Domain:** Local-first polymorphic data projection platform (in-browser SQLite + D3 visualization)
**Researched:** 2026-02-27
**Confidence:** HIGH (architecture is locked in CLAUDE-v5.md; feature scope derived from spec + competitor analysis)

---

## Context: What This Platform Is

Isometry v5 is not a general-purpose knowledge management app. It is a **data projection platform**: the same SQLite dataset renders through PAFV spatial projection as grid, kanban, network, timeline, or gallery — with zero serialization between sql.js and D3.js. The competitive context is Notion, Airtable, and Obsidian, but the differentiating insight is that **switching views changes the SQL projection, not the data**.

The scope of this document is the **TypeScript web runtime only**: database, CRUD, search, providers, worker bridge, views, and ETL. The native Swift shell (WKWebView, CloudKit, Keychain) is explicitly out of scope here.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Card CRUD with soft delete | Every knowledge tool has create/edit/delete; soft delete is expected for recovery | LOW | Soft delete via `deleted_at`; `UNIQUE(source, source_id)` for ETL dedup. All queries filter `deleted_at IS NULL`. |
| Full-text search with instant results | Notion, Obsidian, Airtable all have instant search; users type and expect live results | MEDIUM | FTS5 with BM25 ranking, porter+unicode61 tokenizer, rowid joins. Debounce 150ms on input. Results in <100ms for 10K cards. |
| Multiple view types (list, grid, kanban) | Notion users expect at minimum list + board + table; any less feels underpowered | HIGH | Nine views total. Free tier: list + grid. Pro tier: kanban, calendar, timeline, gallery, network, tree. Workbench: table. |
| Filter and sort controls | Every database tool has column filters and sort. Without this, data is unnavigable | MEDIUM | FilterProvider compiles allowlisted fields + parameterized values to SQL WHERE. AxisProvider compiles ORDER BY. |
| Data import from common formats | Users have data elsewhere (notes, spreadsheets, markdown). Import is expected day one | MEDIUM | Apple Notes (alto-index JSON), Markdown with frontmatter, Excel/CSV. Source tracking for idempotent re-imports. |
| Undo/redo | Every desktop-class tool has Cmd+Z. Absence is jarring and trust-destroying | HIGH | Command log with inverse SQL operations. In-memory stack (Tier 3). Stack cleared on sync conflict. |
| Keyboard navigation | Power users expect keyboard shortcuts for search, navigation, and card operations | LOW | Arrow navigation in search results, Escape to clear, Enter to execute. Tab/Shift-Tab for explorer panels. |
| Soft delete + recovery | Users delete things accidentally. Recovery is a trust feature | LOW | `deleted_at` field. Undelete is an inverse operation in the command log. |
| Import deduplication | Re-importing the same source should not create duplicates | MEDIUM | DedupEngine checks `source + source_id` uniqueness. Updates modified_at if newer. Idempotent by design. |
| Search result snippets with highlighting | Users need context around the matched term, not just the card title | LOW | FTS5 `snippet()` function with `<mark>` tags. 32-token window. Already in spec. |
| Three-tier state persistence | Filter state and view config survive navigation (session), but selection does not | MEDIUM | Tier 1: SQLite `cards`/`connections`. Tier 2: SQLite `app_state`/`view_state`. Tier 3: in-memory only. |
| Connection CRUD (graph edges) | Users who see a "network" view expect to create and delete connections | MEDIUM | Lightweight `connections` table. `via_card_id` for rich edges. Freeform labels. `UNIQUE(source_id, target_id, via_card_id, label)`. |
| Export to common formats | Data portability is a trust signal. Users want to get their data out | LOW | Markdown (with frontmatter), JSON, CSV. Selection-scoped export supported. |
| Performance that does not stall UI | Any blocking operation kills perceived quality. In-browser SQLite must not freeze the tab | HIGH | All database operations run in a Web Worker. Main thread is never blocked. WorkerBridge uses correlation IDs. |
| Error states that don't crash | A failed query should show a graceful message, not a blank screen | LOW | WorkerResponse always has `success` flag. UI checks before rendering. |

### Differentiators (Competitive Advantage)

Features that set this product apart. Not expected from competitors, but highly valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| PAFV spatial projection (SuperGrid) | No other tool maps any LATCH dimension to any screen axis. Nested dimensional headers change what the data *means* without changing the data | HIGH | SuperGrid is the keystone. D3 data joins with key functions. Axis swapping changes SQL ORDER BY/GROUP BY, not the cards. Zero serialization between sql.js and D3. |
| View transitions that animate cards between projections | Most tools reload the page or replace content instantly. Animated transitions make the "same data, different view" insight visceral and delightful | HIGH | D3 `.transition()` on data joins with stable identity keys (`d.id`). Cards animate from prior position to new position. Duration ~300ms with ease-in-out. |
| BM25-weighted FTS with field-specific boosts | Notion search is full-text but does not expose ranking. Obsidian ranks by recency. Isometry ranks by relevance with configurable field weights | MEDIUM | `bm25(cards_fts, 2.0, 1.0, 1.5, 0.5)` — title weighted 2x, tags 1.5x. Users feel the search "understands" intent. |
| Faceted search refinement from FTS results | Clicking a facet chip (Type: note x12, Folder: Projects x8) narrows results without leaving search. Notion does not have this. | MEDIUM | Facet counts derived from FTS result set via GROUP BY on `card_type`, `folder`, `status`, `source`, year, tags. Facets auto-update as query changes. |
| LATCH/GRAPH duality in one schema | Every competitor is either a database (Airtable) or a graph (Obsidian). Isometry is both simultaneously, using the same cards and connections | HIGH | FilterProvider (LATCH) and graph traversal queries (GRAPH) operate on identical schema. View family (latch/graph) determines which SQL path is compiled. |
| SQL-compiled provider state | No React state, no Redux, no Zustand. D3's data join IS state management. Provider state compiles to SQL, SQL output feeds D3 directly | HIGH | Eliminates an entire class of stale state bugs. The database is the single source of truth. Requires discipline: no parallel entity stores. |
| Source-tracking ETL with connection extraction | Apple Notes checklist items become task cards. Mentions become person cards with `mentions` connections. Links become graph edges. The graph emerges from import. | HIGH | ETL parsers extract structural relationships as `CanonicalConnection[]`. Graph is populated automatically, not manually built. |
| Idempotent re-import (source deduplication) | Users can re-run import without fear of duplicates. `source + source_id` is the natural key. Updates if `modified_at` is newer. | MEDIUM | DedupEngine batches lookups. `INSERT OR IGNORE` for connections. Critical for sync workflows and repeated ETL runs. |
| Allowlist-enforced SQL safety without ORM | No ORM overhead, but no injection risk. The allowlist IS the security boundary — not a library, not a framework, not user trust. | MEDIUM | `ALLOWED_FILTER_COLUMNS` set. `validateColumn()` throws on unknown fields. Values always use `?` placeholders. Column names and table names are hardcoded. Tests include injection attempts. |
| Command log undo/redo with inverse SQL | Most in-browser tools have no undo. Notion's undo is partial. Isometry records the inverse SQL for every mutation, enabling full undo/redo without event sourcing infrastructure. | HIGH | `Command` interface with `forward` and `inverse` SQL + params. In-memory stack. Undo replays inverse; redo replays forward. Stack cleared on sync conflict. |
| Worker Bridge with typed correlation IDs | All database operations are async, typed, and correlated. No raw SQL strings cross the bridge. No fire-and-forget mutations. | MEDIUM | `WorkerMessage` envelope: `id` (UUID), `type`, `payload`. `WorkerResponse`: `id` (matches), `success`, `data`, `error`, `timing`. Pending requests tracked in a `Map<string, {resolve, reject}>`. |
| Graph algorithms on local data | Dijkstra, Jaccard, Louvain, PageRank, Adamic-Adar, Node2vec — running client-side on your own data without a cloud API call | HIGH | Graph queries via `connections` JOIN `cards`. Algorithms run in the Web Worker. Results feed D3 network/tree views. No server required. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this architecture.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Parallel state store (MobX/Redux/Zustand) | Developers reach for these automatically. Seems like "correct" React practice | Duplicates SQLite data into JavaScript memory. Two sources of truth diverge. Cache invalidation bugs. Defeats the point of sql.js as the system of record. | D3's data join IS state. Query sql.js directly. Providers compile to SQL. No entity mirroring. |
| Raw SQL from UI layer | Seems powerful for power users (like a "custom query" field) | SQL injection surface. Impossible to parameterize column names. Breaks the allowlist safety model entirely. | Provider system: FilterProvider + AxisProvider compile UI state to validated, parameterized SQL. Power users get filter chains, not raw SQL. |
| Persisting selection to SQLite | Seems convenient ("remember what I had selected") | Selection is inherently ephemeral (multi-tab conflicts, sync conflicts, stale state on restart). Changes the semantics of what "selected" means. | SelectionProvider is Tier 3 (in-memory only). This is explicitly a design decision (D-005). |
| Storing OAuth tokens in SQLite | Seems simpler than Keychain | Tokens in SQLite files are readable by anyone with file access. SQLite is synced via CloudKit — tokens would leave the device. | Keychain only for credentials. SQLite stores metadata (last sync timestamp, source name) only. ETL requests tokens via WorkerBridge native action. |
| Real-time collaborative editing | Users always want collaboration | Requires CRDTs or OT, server infrastructure, conflict resolution UI. Fundamentally changes the local-first architecture. Out of scope for v5. | CloudKit sync (dirty flag + debounce) for eventual consistency across one user's devices. Collaboration is v2. |
| Schema-on-write / custom columns | Users ask for "add a custom field" | Forces schema migrations, complicates ETL mapping, breaks the PAFV projection model. EAV tables add query complexity. | Schema-on-read: PAFV maps existing LATCH fields to axes. EAV (`card_properties` table) deferred to Phase 2 per D-008. v5 uses fixed schema. |
| Fuzzy/typo-tolerant search | Users misspell things | FTS5 does not support fuzzy matching natively. Adding it requires external libraries (trigram indexes, Levenshtein UDF). Significant complexity for marginal gain. | Porter stemmer (already configured) handles morphological variants. Prefix search (`deploy*`) handles partial terms. Document this limitation clearly. |
| Semantic/vector search | AI-powered "find similar" is highly requested | Requires embedding models, vector indexes, either server calls or WASM embedding (large download). Fundamentally different pipeline from FTS5. | FTS5 BM25 with field boosts. Tag-based facets surface related content. Semantic search is v2 or a plugin. |
| Saved search as first-class UI object | Power users want to bookmark search queries | Adds UI surface area, persistence schema, and navigation complexity. Distraction from core flow. | Search history (recent + frequent queries) stored in localStorage. This satisfies 80% of the use case with 10% of the complexity. |
| Formula fields (Airtable-style) | Users want computed properties | Formula evaluation requires a formula parser, AST, sandboxed execution environment, and FTS index update on every dependency change. Extremely high complexity. | Views compile SQL projections. SQL expressions (e.g., `strftime('%Y', created_at)`) handle computed groupings directly. |
| Realtime sync between browser tabs | Seems like a quality feature | Requires SharedWorker or BroadcastChannel coordination. Adds significant complexity to the worker bridge. Out of scope for WKWebView (single-tab context). | WKWebView is single-tab. One Worker, one database. Multi-device sync is CloudKit (native shell concern). |
| Block-level editing (Notion-style) | Users want rich block editors | A full block editor (ProseMirror/Tiptap) is a product in itself. Cards have `content` (text). Rendering rich content is a display concern, not a database concern. | `content` field stores Markdown. Render in D3 card components. Block editor is a v2 surface (Notebook module). |

---

## Feature Dependencies

```
[sql.js Database + Schema]
    └──requires──> [Card CRUD]
                       └──requires──> [FTS5 Index + Triggers]
                                          └──requires──> [FTS Search UX]
                                                             └──enhances──> [Faceted Search]

[Card CRUD]
    └──requires──> [WorkerBridge Protocol]
                       └──requires──> [Web Worker (sql.js in worker thread)]

[WorkerBridge Protocol]
    └──requires──> [Correlation ID tracking (Map<id, {resolve, reject}>)]

[FilterProvider + AxisProvider]
    └──requires──> [SQL Allowlist + Parameterization]
    └──requires──> [WorkerBridge Protocol]
    └──compiles-to──> [SQL WHERE / ORDER BY clauses]

[D3 Views (any)]
    └──requires──> [WorkerBridge Protocol] (for data queries)
    └──requires──> [Provider System] (for compiled SQL)
    └──requires──> [D3 data join with key function]

[View Transitions]
    └──requires──> [D3 Views (at least 2)]
    └──requires──> [Stable card identity keys (d.id)]

[SuperGrid / PAFV Projection]
    └──requires──> [AxisProvider] (axis→plane mapping)
    └──requires──> [DensityProvider] (row/column density)
    └──requires──> [D3 views] (rendering target)

[Undo/Redo (Command Log)]
    └──requires──> [Card CRUD]
    └──requires──> [MutationManager with inverse SQL generation]
    └──conflicts──> [CloudKit sync during conflict] (stack cleared on conflict)

[ETL Import Pipeline]
    └──requires──> [Card CRUD] (writer)
    └──requires──> [WorkerBridge Protocol] (ETL runs in worker)
    └──requires──> [DedupEngine] (source+source_id lookup)
    └──produces──> [Connections] (graph edges from links, mentions, attachments)

[Connection CRUD]
    └──requires──> [Card CRUD] (cards must exist first)
    └──enables──> [Graph Views (network, tree)]

[Graph Views (network, tree)]
    └──requires──> [Connection CRUD]
    └──requires──> [D3 force simulation (network) or hierarchy layout (tree)]

[Three-Tier State Persistence]
    └──requires──> [sql.js Database + Schema] (Tier 1 and 2)
    └──Tier 3: ephemeral──> [SelectionProvider] (no persistence)

[SQL Safety (Allowlist + Parameters)]
    └──requires──> [ALLOWED_FILTER_COLUMNS set]
    └──requires──> [validateColumn() function]
    └──must-precede──> [FilterProvider compilation]
    └──must-precede──> [any dynamic SQL generation]
```

### Dependency Notes

- **WorkerBridge requires Web Worker**: sql.js must run off the main thread. All database access is async via postMessage + correlation IDs.
- **FTS5 requires rowid joins**: The canonical join pattern (`c.rowid = fts.rowid`) must be established before any FTS query is written. Using `c.id = fts.rowid` is a type mismatch bug.
- **ETL produces Connections**: The graph is not manually built — it emerges from ETL. This means Connection CRUD and ETL are not independent; ETL tests require Connection write support.
- **AxisProvider enhances SuperGrid**: SuperGrid is not functional without AxisProvider providing PAFV plane-to-axis mappings.
- **SQL Safety must precede FilterProvider**: The allowlist validation is a hard prerequisite. FilterProvider cannot be implemented without it — there's no safe path to dynamic SQL without the allowlist.
- **Undo/Redo conflicts with sync**: When CloudKit sync encounters a conflict, the undo stack is cleared. This is a deliberate tradeoff (D-009). The user must resolve conflicts manually; the undo history from before the conflict is discarded.
- **View Transitions require stable identity**: D3 transitions only work correctly when `.data(items, d => d.id)` key functions are present. Without them, DOM elements are not reused across view switches, breaking animation.

---

## MVP Definition

### Launch With (v1)

Minimum viable — what's needed to prove the "same data, different view" insight.

- [ ] **sql.js database with canonical schema** — The foundation. No product without it. Cards, connections, FTS5, app_state, view_state tables. Performance thresholds verified.
- [ ] **Card CRUD with soft delete** — Users must be able to create, read, update, and delete cards. Soft delete for recovery. Parameterized queries only.
- [ ] **WorkerBridge with typed correlation IDs** — All database operations off the main thread. Non-negotiable for UI responsiveness. `WorkerMessage` / `WorkerResponse` envelope.
- [ ] **FilterProvider + AxisProvider + SQL allowlist** — The safety boundary and the projection engine. Must exist before any dynamic SQL is written.
- [ ] **FTS5 search with ranked results and snippets** — Users need to find their data. BM25 ranking, rowid joins, `snippet()` output. Debounced input (150ms).
- [ ] **Three views: list, grid, kanban** — Proves the "same data, different view" insight. List (LATCH: hierarchy/alphabet), Grid/SuperGrid (LATCH: two axes), Kanban (LATCH: category).
- [ ] **View transitions animating cards between projections** — The keystone differentiator. Without animation, the projection insight is intellectual rather than felt.
- [ ] **Apple Notes ETL importer** — Primary data source. Demonstrates graph extraction from real data (mentions → person cards, links → connections).
- [ ] **Undo/redo (Cmd+Z)** — Trust feature. Without it, users fear editing. Command log with inverse SQL. In-memory stack.
- [ ] **Three-tier state persistence** — Filter state and view config survive navigation. Selection is ephemeral. Verified by tests.
- [ ] **SQL safety test suite** — Injection attempts rejected. Unknown fields throw. Unknown operators throw. Required before any dynamic SQL ships.

### Add After Validation (v1.x)

Features to add once core is working and tested.

- [ ] **Faceted search refinement** — Trigger: users ask "how do I narrow search results?" Counts derived from FTS result set.
- [ ] **Calendar and Timeline views** — Trigger: users with time-based data (tasks, events) arrive. Already designed; implementation follows list/kanban pattern.
- [ ] **Gallery view** — Trigger: users with visual content (photos, resources) arrive. Card-as-image rendering.
- [ ] **Markdown and Excel ETL importers** — Trigger: first users who aren't Apple Notes users. Markdown frontmatter parser, XLSX parser.
- [ ] **Connection CRUD UI** — Trigger: users start asking "how do I link these two cards?" Graph emerges from ETL first; manual connection creation is v1.x.
- [ ] **Network (force-directed) view** — Trigger: connections exist and users want to see the graph. D3 force simulation. Requires Connection CRUD.
- [ ] **Search history (recent + frequent)** — Trigger: power users return to the same queries. localStorage, not SQLite.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Tree (hierarchy) view** — Why defer: requires well-populated `contains` connection labels. ETL must ship and populate hierarchical data first.
- [ ] **Table view (raw data)** — Why defer: Workbench tier only. High complexity (editable cells, column resize, virtual scrolling). Validates Workbench positioning.
- [ ] **Extended ETL sources (Slack, Apple Reminders, Calendar, Contacts, Photos)** — Why defer: high integration complexity, requires native shell coordination. Ship after Apple Notes proves the model.
- [ ] **EAV table (card_properties)** — Why defer: D-008 explicitly defers. Fixed schema is sufficient for v5. EAV adds query complexity.
- [ ] **Semantic/vector search** — Why defer: requires embedding pipeline. FTS5 BM25 is table stakes; semantic search is a differentiator for v2.
- [ ] **Block-level editor (Notebook module)** — Why defer: a full block editor is a product in itself. Markdown in `content` field is sufficient for v5.
- [ ] **Formula fields** — Why defer: requires formula parser, AST, sandboxed execution. SQL GROUP BY expressions cover 80% of grouping use cases.
- [ ] **Collaborative features** — Why defer: requires CRDTs or OT, fundamentally changes local-first architecture. v2 with server infrastructure.
- [ ] **Map view** — Why defer: Workbench tier only. Requires geocoding and mapping library. Low priority relative to time/category views.
- [ ] **Charts view** — Why defer: Workbench tier only. D3 charting is a distinct rendering path from card projections.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| sql.js database + canonical schema | HIGH | MEDIUM | P1 |
| Card CRUD + soft delete | HIGH | LOW | P1 |
| WorkerBridge with correlation IDs | HIGH | MEDIUM | P1 |
| SQL allowlist + parameterization | HIGH | LOW | P1 — Security prerequisite |
| FTS5 search + ranked results | HIGH | MEDIUM | P1 |
| FilterProvider + AxisProvider | HIGH | MEDIUM | P1 |
| List + Grid + Kanban views | HIGH | HIGH | P1 |
| View transitions (D3 animations) | HIGH | HIGH | P1 — Core differentiator |
| Apple Notes ETL | HIGH | HIGH | P1 |
| Undo/redo (command log) | HIGH | HIGH | P1 — Trust feature |
| Three-tier persistence | MEDIUM | MEDIUM | P1 |
| Faceted search refinement | MEDIUM | MEDIUM | P2 |
| Calendar + Timeline views | MEDIUM | MEDIUM | P2 |
| Gallery view | MEDIUM | LOW | P2 |
| Markdown ETL | MEDIUM | LOW | P2 |
| Excel/CSV ETL | MEDIUM | LOW | P2 |
| Connection CRUD UI | MEDIUM | MEDIUM | P2 |
| Network (force-directed) view | MEDIUM | HIGH | P2 |
| Search history (localStorage) | LOW | LOW | P2 |
| Tree (hierarchy) view | MEDIUM | HIGH | P3 |
| Table view | MEDIUM | HIGH | P3 — Workbench tier |
| Extended ETL sources (Slack, etc.) | MEDIUM | HIGH | P3 |
| EAV card_properties table | LOW | HIGH | P3 — Deferred by D-008 |
| Semantic/vector search | MEDIUM | HIGH | P3 |
| Formula fields | LOW | HIGH | P3 |
| Block editor (Notebook) | MEDIUM | HIGH | P3 |
| Map view | LOW | HIGH | P3 — Workbench tier |
| Charts view | LOW | HIGH | P3 — Workbench tier |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Notion | Airtable | Obsidian | Isometry v5 Approach |
|---------|--------|----------|----------|----------------------|
| Multiple views | Table, Board, Calendar, Timeline, Gallery, List | Grid, Kanban, Calendar, Gantt, Gallery | Graph, Files | Nine views (list, grid, kanban, calendar, timeline, gallery, network, tree, table). View is a SQL projection, not a data copy. |
| Full-text search | Full-text, no ranking control | Full-text, basic | Full-text (Omnisearch plugin) | FTS5 BM25 with field-specific weights. Faceted refinement from result set. |
| Relational data | Linked databases (schema-on-write) | Linked records, lookups, rollups (schema-on-write) | Backlinks (implicit, graph-based) | Connections table (lightweight relations). `via_card_id` for rich edges. Schema-on-read via PAFV projection. |
| Local-first / offline | Limited (Notion works offline but data is server-side) | No (cloud only) | Yes (plain Markdown files) | Yes. sql.js in-browser. No server required. CloudKit sync is additive. |
| Graph view | No | No | Yes (bidirectional links) | Network view (D3 force-directed) + Tree view. Graph emerges from ETL, not manual linking only. |
| Undo/redo | Partial (Notion's undo is inconsistent) | Limited | Full (file-based) | Full command log with inverse SQL. In-memory stack. Covers all card/connection mutations. |
| Data import | CSV import, API | CSV, Airtable API | Markdown folder | Apple Notes, Markdown, Excel/CSV, JSON, HTML. ETL extracts graph relationships automatically. |
| Data export | CSV, PDF | CSV, JSON, PDF | Markdown | Markdown (with frontmatter), JSON, CSV. Selection-scoped. |
| Animated view transitions | No (instant replace) | No | No | Yes. D3 data joins with stable card identity. Cards animate between positions when view changes. |
| SQL safety | Not applicable (SaaS) | Not applicable (SaaS) | Not applicable | Column allowlist + parameterized values. Injection attempts throw at compile time. |
| Offline-first architecture | No | No | Yes (files) | Yes. sql.js WASM in Web Worker. Main thread never blocks. |
| Formula/computed fields | Yes (Notion formulas) | Yes (rich formula language) | Via Dataview plugin | Deferred (v2). SQL expressions cover grouping use cases. No formula parser in v5. |

---

## FTS5 Search UX: What Matters

Based on research, the following UX behaviors are table stakes for FTS search in a local-first tool:

**Debouncing:** 150ms debounce on input. Below 150ms causes excessive queries; above 200ms feels laggy. Spec-confirmed: 150ms.

**Result ranking:** BM25 with field boosts. Title matches should outrank content matches. `bm25(cards_fts, 2.0, 1.0, 1.5, 0.5)` — name (2x), content (1x), tags (1.5x), folder (0.5x).

**Snippets:** `snippet(cards_fts, 1, '<mark>', '</mark>', '...', 32)` provides highlighted context. Users need to see *why* a card matched, not just that it did.

**Keyboard navigation:** Arrow keys navigate results. Enter selects. Escape clears. This is non-negotiable for power users.

**Faceted refinement:** Facet counts derived from the current FTS result set (not global counts). Clicking a facet chip narrows results. Facets update as the query changes.

**What FTS5 does NOT support:** Fuzzy/typo-tolerant matching. Semantic similarity. Spelling correction. These are explicitly out of scope for v5 (see Anti-Features). The porter stemmer handles morphological variants (`run` matches `running`). Document this clearly to set expectations.

---

## D3 View Transitions: What Matters

**Stable identity keys are non-negotiable:** `.data(cards, d => d.id)` key function must be present on every data join. Without it, D3 treats every re-render as a full replacement, breaking animation.

**Enter/update/exit pattern:** New cards animate in (enter). Existing cards animate to new positions (update). Removed cards animate out (exit). This is the mechanism for view transitions.

**Transform-based positioning:** Use CSS `transform: translate(x, y)` rather than `x`/`y` attributes for hardware acceleration. Significant performance difference on large datasets.

**Transition duration:** 300ms with `d3.easeCubicInOut` is the sweet spot. Fast enough to feel snappy, slow enough to track.

**Batch updates:** Mutate SVG elements in batches, not one at a time. Collecting all DOM mutations in a single transition pass reduces layout thrashing.

**Canvas hybrid for density:** For extremely dense views (>500 visible cards), a Canvas layer for card bodies with SVG overlay for axes/labels is the performance ceiling. Not needed for typical use, but the architecture should not prevent it.

---

## Data Import Pipelines: What Matters

**Idempotency is the most important property:** Re-running the same import must produce the same result. The `UNIQUE(source, source_id)` constraint plus `INSERT OR IGNORE` / update-if-newer logic is the mechanism.

**Connection extraction from import:** The graph is not manually built — it *emerges* from the import. Apple Notes mentions → person cards + `mentions` connections. Checklist items → task cards + `contains` connections. Internal links → `links_to` connections. This is Isometry's strongest ETL differentiator.

**Batch writes in transactions:** Individual INSERTs are 100x slower than batch transactions. `SQLiteWriter` batches in groups of 100 cards per transaction.

**Import progress reporting:** Users expect to see "Imported: 1,247 new, 83 updated, 12 skipped." The `ImportResult` interface already captures this. Surface it in the UI.

**Source registry + import history:** Users need to know what's been imported and when. `import_history` and `sources` tables in the Data Catalog provide this. This is table stakes once import is live.

---

## SQL Safety: What Matters

**The allowlist IS the security boundary.** Not a library, not a framework — a Set of allowed column names. `validateColumn()` throws on anything not in the set.

**Two categories of SQL injection risk:**
1. **Value injection:** Prevented by `?` parameterization. Always. No exceptions.
2. **Structural injection (column names, table names, operators):** Prevented by the allowlist + hardcoded table names + operator set. Column names cannot be parameterized in SQL — the allowlist is the only defense.

**Test injection attempts explicitly:** The quality gate requires tests that pass injection strings as values (verifying parameterization catches them) and unknown field names (verifying allowlist rejects them).

**No ORM needed:** The allowlist + parameterization provides equivalent safety to an ORM for this schema. Adding an ORM would add abstraction without additional safety.

---

## Undo/Redo: What Matters

**Every mutation needs an inverse:** `INSERT` → inverse is `DELETE`. `UPDATE` → inverse captures the previous values. `DELETE` (soft) → inverse sets `deleted_at = NULL`. This must be designed into `MutationManager` from the start — retrofitting undo is extremely difficult.

**In-memory stack only (Tier 3):** The undo stack does not survive page reload. This is correct for a local-first app. Users who close the app lose their undo history — this is consistent with desktop app conventions.

**Stack clearing on sync conflict:** When CloudKit sync encounters a conflict, the command stack is cleared. The rationale: after a conflict resolution, the "before state" the stack references may no longer exist in the database. Users are informed when this happens.

**Batch operations as one command:** ETL imports should be a single undoable command (batch), not thousands of individual commands. `Command.type = 'batch'` for this case.

**Performance:** Inverse SQL generation must be fast (<1ms per mutation). The inverse for an INSERT is a simple DELETE by ID. The inverse for an UPDATE requires reading the current state before writing — this is the one place where a pre-mutation read is justified.

---

## Sources

- Competitive analysis: [Obsidian vs. Notion (2026)](https://www.nuclino.com/solutions/obsidian-vs-notion), [Airtable vs. Notion (2026)](https://thetoolchief.com/comparisons/airtable-vs-notion/), [Notion database views](https://www.notion.vip/insights/compare-and-configure-notion-s-database-formats-tables-lists-galleries-boards-and-timelines)
- Obsidian differentiators: [Obsidian review](https://www.primeproductiv4.com/apps-tools/obsidian-review), [Graph view docs](https://help.obsidian.md/plugins/graph)
- FTS5 implementation: [SQLite FTS5 official docs](https://sqlite.org/fts5.html), [FTS5 in practice](https://thelinuxcode.com/sqlite-full-text-search-fts5-in-practice-fast-search-ranking-and-real-world-patterns/)
- Local-first SQLite WASM: [Offline-first frontend 2025](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/), [SQLite persistence state 2025](https://www.powersync.com/blog/sqlite-persistence-on-the-web)
- D3 transitions: [d3-transition official](https://d3js.org/d3-transition), [D3 optimization](https://moldstud.com/articles/p-optimizing-d3js-rendering-best-practices-for-faster-graphics-performance)
- Undo/redo patterns: [SQLite undo/redo official](https://www.sqlite.org/undoredo.html), [Command pattern undo](https://dev.to/isaachagoel/you-dont-know-undoredo-4hol)
- SQL injection prevention: [TypeScript SQL injection guide](https://www.stackhawk.com/blog/typescript-sql-injection-guide-examples-and-prevention/), [OWASP SQL injection](https://owasp.org/www-community/attacks/SQL_Injection)
- ETL idempotency: [ETL best practices 2026](https://oneuptime.com/blog/post/2026-02-13-etl-best-practices/view), [Idempotent pipelines](https://datalakehousehub.com/blog/2026-02-de-best-practices-04-idempotent-pipelines/)
- Web Worker patterns: [MDN Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers), [Typed web workers](https://github.com/AndersCan/typed-web-workers)
- Force-directed graphs: [D3 force](https://d3js.org/d3-force), [Force-directed graph 2025](https://dev.to/nigelsilonero/how-to-implement-a-d3js-force-directed-graph-in-2025-5cl1)
- Project spec: `/Users/mshaler/Developer/Projects/Isometry/CLAUDE-v5.md`, `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/Contracts.md`, `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/DataExplorer.md`, `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/SearchExplorer.md`

---

*Feature research for: local-first polymorphic data projection platform (web runtime scope)*
*Researched: 2026-02-27*
