# Requirements: Isometry v5

**Defined:** 2026-02-28
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v1.0 Requirements

Requirements for the Web Runtime milestone. Each maps to roadmap phases.

### Worker Bridge

- [ ] **BRIDGE-01**: Worker entry initializes sql.js WASM and applies schema before processing messages
- [ ] **BRIDGE-02**: WorkerBridge sends typed messages with UUID correlation IDs and receives matched responses
- [ ] **BRIDGE-03**: Worker queues messages during WASM initialization and replays them once ready
- [ ] **BRIDGE-04**: WorkerBridge exposes an `isReady` promise that all public methods await before sending
- [ ] **BRIDGE-05**: Every pending promise has a configurable timeout that rejects on silent Worker errors
- [ ] **BRIDGE-06**: Message router dispatches to typed handlers (query, mutate, graph, fts, export)
- [ ] **BRIDGE-07**: Worker reuses existing query modules (cards, connections, search, graph) without wrappers

### Providers

- [ ] **PROV-01**: FilterProvider compiles filter state to `{where, params}` SQL fragments with allowlisted columns only
- [ ] **PROV-02**: FilterProvider rejects unknown fields and operators, passing SQL injection tests
- [ ] **PROV-03**: PAFVProvider maps LATCH dimensions to screen planes and compiles to ORDER BY / GROUP BY fragments
- [ ] **PROV-04**: PAFVProvider suspends and restores view family state when switching between LATCH and GRAPH
- [ ] **PROV-05**: SelectionProvider manages selected card IDs as Tier 3 ephemeral state (never persisted)
- [ ] **PROV-06**: SelectionProvider supports Cmd+click toggle, Shift+click range, and select-all
- [ ] **PROV-07**: DensityProvider compiles density levels to SQL strftime() expressions for time axes
- [ ] **PROV-08**: DensityProvider supports all five time granularities (day, week, month, quarter, year)
- [ ] **PROV-09**: StateCoordinator batches cross-provider updates within 16ms frames
- [ ] **PROV-10**: Tier 2 provider state (filter, axis, density, view) persists to SQLite ui_state and restores on launch
- [ ] **PROV-11**: Providers expose subscribe/unsubscribe and return cleanup functions to prevent subscriber leaks

### Mutations

- [ ] **MUT-01**: MutationManager is the sole write gate — all entity writes go through `exec()`
- [ ] **MUT-02**: Every mutation generates inverse SQL for undo and stores it in a Command object
- [ ] **MUT-03**: Undo replays inverse SQL; redo replays forward SQL
- [ ] **MUT-04**: Batch mutations produce a single undo step with correctly ordered inverse operations
- [ ] **MUT-05**: MutationManager sets dirty flag on every write for CloudKit sync (D-010)
- [ ] **MUT-06**: Subscriber notifications are batched per animation frame via requestAnimationFrame
- [ ] **MUT-07**: Cmd+Z triggers undo, Cmd+Shift+Z triggers redo (keyboard shortcut integration)

### Views

- [ ] **VIEW-01**: ListView renders cards as a single-column list with sort controls
- [ ] **VIEW-02**: GridView renders cards in a two-axis grid with PAFVProvider axis mappings
- [ ] **VIEW-03**: KanbanView renders cards in columns grouped by a category field with drag-drop reordering
- [ ] **VIEW-04**: CalendarView renders cards on a month/week/day grid based on date fields with DensityProvider
- [ ] **VIEW-05**: TimelineView renders cards on a continuous time axis with swimlane grouping
- [ ] **VIEW-06**: GalleryView renders cards as visual tiles with image/cover display
- [ ] **VIEW-07**: NetworkView renders force-directed graph with simulation running in the Worker (not main thread)
- [ ] **VIEW-08**: TreeView renders hierarchical layout from contains/parent connections with collapsible nodes
- [ ] **VIEW-09**: Every D3 `.data()` call uses a stable key function (`d => d.id`)
- [ ] **VIEW-10**: ViewManager mounts/unmounts views and calls `destroy()` before switching to prevent subscriber leaks
- [ ] **VIEW-11**: Each view applies view-specific defaults from a VIEW_DEFAULTS map on first mount
- [ ] **VIEW-12**: KanbanView drag-drop triggers mutations through MutationManager (undoable)

### Rendering

- [ ] **REND-01**: SuperGrid renders nested dimensional headers with PAFVProvider stacked axis assignments
- [ ] **REND-02**: SuperGrid parent headers visually span child groups (SuperStack)
- [ ] **REND-03**: Animated view transitions morph cards between LATCH views using d3-transition
- [ ] **REND-04**: Cross-family transitions (LATCH↔GRAPH) use crossfade instead of morph
- [ ] **REND-05**: Render performance meets <16ms threshold for 100 visible cards in SuperGrid
- [ ] **REND-06**: Network view posts only stable `{id, x, y}` positions from Worker, not per-tick updates
- [ ] **REND-07**: Views show loading state during Worker query execution
- [ ] **REND-08**: Failed queries display error messages in views, not blank screens

## v1.1 Requirements

Deferred to future release. Tracked but not in current roadmap.

### ETL

- **ETL-01**: User can import Apple Notes into the card schema
- **ETL-02**: User can import Apple Reminders into the card schema
- **ETL-03**: User can import Slack messages into the card schema

### Advanced Views

- **ADV-01**: TableView with virtual scroll, editable cells, and column resize (Workbench tier)
- **ADV-02**: Graph algorithm suite: PageRank node sizing, Louvain community coloring, centrality metrics

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| ETL importers | v1.1 milestone — runtime must be stable before importing real data |
| Native Swift shell | Separate effort, not in this build |
| CloudKit sync | Native shell handles this |
| Table view | Workbench tier, virtual scroll + editable cells is high complexity |
| Schema-on-read extras (EAV) | Deferred per D-008 |
| Parallel entity stores (MobX/Redux/Zustand) | Violates D3 data join architecture |
| Raw SQL from UI | Violates SQL safety model (D-003) |
| Persisting selection to SQLite | D-005 mandates Tier 3 ephemeral |
| Real OAuth credential flows | Web runtime uses bridge to native Keychain |
| Collaborative features | v2 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRIDGE-01 | — | Pending |
| BRIDGE-02 | — | Pending |
| BRIDGE-03 | — | Pending |
| BRIDGE-04 | — | Pending |
| BRIDGE-05 | — | Pending |
| BRIDGE-06 | — | Pending |
| BRIDGE-07 | — | Pending |
| PROV-01 | — | Pending |
| PROV-02 | — | Pending |
| PROV-03 | — | Pending |
| PROV-04 | — | Pending |
| PROV-05 | — | Pending |
| PROV-06 | — | Pending |
| PROV-07 | — | Pending |
| PROV-08 | — | Pending |
| PROV-09 | — | Pending |
| PROV-10 | — | Pending |
| PROV-11 | — | Pending |
| MUT-01 | — | Pending |
| MUT-02 | — | Pending |
| MUT-03 | — | Pending |
| MUT-04 | — | Pending |
| MUT-05 | — | Pending |
| MUT-06 | — | Pending |
| MUT-07 | — | Pending |
| VIEW-01 | — | Pending |
| VIEW-02 | — | Pending |
| VIEW-03 | — | Pending |
| VIEW-04 | — | Pending |
| VIEW-05 | — | Pending |
| VIEW-06 | — | Pending |
| VIEW-07 | — | Pending |
| VIEW-08 | — | Pending |
| VIEW-09 | — | Pending |
| VIEW-10 | — | Pending |
| VIEW-11 | — | Pending |
| VIEW-12 | — | Pending |
| REND-01 | — | Pending |
| REND-02 | — | Pending |
| REND-03 | — | Pending |
| REND-04 | — | Pending |
| REND-05 | — | Pending |
| REND-06 | — | Pending |
| REND-07 | — | Pending |
| REND-08 | — | Pending |

**Coverage:**
- v1.0 requirements: 43 total
- Mapped to phases: 0
- Unmapped: 43 ⚠️

---
*Requirements defined: 2026-02-28*
*Last updated: 2026-02-28 after initial definition*
