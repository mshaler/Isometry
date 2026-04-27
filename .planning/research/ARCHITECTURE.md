# Architecture Patterns: v15.0 Formulas Explorer Integration

**Domain:** Three-explorer architecture (Formulas, Marks, Audits) with DSL-to-SQL compilation pipeline
**Researched:** 2026-04-27
**Confidence:** HIGH — based on reading the existing codebase and handoff document directly

---

## Recommended Architecture

### How the new explorers sit in the existing system

The three new explorers are **operator surfaces**, not PAFV views. They produce typed configuration that existing views consume. The existing architecture already has a slot for exactly this kind of component:

```
┌─────────────────────────────────────────────────────────┐
│  DockNav (Analyze section → "Formulas" dock item)       │
│  Already wired in DOCK_DEFS / section-defs.ts           │
└────────────────────────┬────────────────────────────────┘
                         │ toggles bottom slot
                         ▼
┌─────────────────────────────────────────────────────────┐
│  FormulasExplorerPanel (replaces FormulasPanelStub)      │
│  PanelRegistry slot 'formulas', bottom-slot              │
│                                                          │
│  ┌─────────────┐ ┌────────────┐ ┌──────────────┐        │
│  │ Formulas    │ │ Marks      │ │ Audits       │        │
│  │ Sub-explorer│ │ Sub-explorer│ │ Sub-explorer │        │
│  └──────┬──────┘ └─────┬──────┘ └──────┬───────┘        │
│         │              │               │                 │
│    [chip wells]   [chip wells]   [chip wells]            │
│    (ChipWell      (ChipWell      (ChipWell               │
│     geometry       geometry       geometry               │
│     primitive)     primitive)     primitive)             │
└─────────┼──────────────┼───────────────┼─────────────────┘
          │              │               │
          ▼              ▼               ▼
┌──────────────────────────────────────────────────────────┐
│  FormulasProvider  MarksProvider  AuditsProvider         │
│  (new providers: compile() + subscribe() + persistence)  │
└──────────────────┬───────────────────────────────────────┘
                   │ registers with StateCoordinator (no changes)
                   ▼
┌──────────────────────────────────────────────────────────┐
│  StateCoordinator → rAF-batched supergrid:query trigger  │
└──────────────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  QueryBuilder (extended: injects FormulasProvider output)│
│  SELECT / WHERE / ORDER BY composed with existing        │
│  FilterProvider + PAFVProvider + DensityProvider output  │
└──────────────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│  WorkerBridge → supergrid:query handler (unchanged)      │
└──────────────────────────────────────────────────────────┘
          │
          ▼ (post-query)
┌──────────────────────────────────────────────────────────┐
│  ViewManager calls:                                      │
│  MarksProvider.annotate(rows) → CSS class assignments    │
│  AuditsProvider.annotate(rows) → flag annotations        │
│  (same pattern as existing AuditState CSS overlay)       │
└──────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

### New Components

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `FormulasProvider` | Owns chip arrangement state for Calculations/Filters/Sorts; compiles to `(sql, bindValues)` tuple pairs for SELECT/WHERE/ORDER BY injection | StateCoordinator (subscribe), QueryBuilder (compile()), StateManager (persist) |
| `MarksProvider` | Owns conditional encoding chip state; compiles predicates to `{predicate, cssClass}[]` pairs for post-query annotation | StateCoordinator (subscribe), ViewManager post-query (annotate()), StateManager (persist) |
| `AuditsProvider` | Owns anomaly/validation rule chip state; compiles predicates to `{predicate, flagType}[]` pairs for post-query annotation | StateCoordinator (subscribe), ViewManager post-query (annotate()), StateManager (persist) |
| `DslCompiler` | Pure function: chip arrangement → `{sql_text, bind_values[]}` tuple. Never concatenates user input into SQL strings. Validates field names against SchemaProvider allowlist | FormulasProvider, MarksProvider, AuditsProvider |
| `FormulasExplorerPanel` | Tab container hosting three sub-explorer UIs; implements PanelHook (mount/destroy); replaces `FormulasPanelStub` | PanelRegistry (PanelHook interface), FormulasProvider, MarksProvider, AuditsProvider |
| `ChipWell` | Geometry primitive: spatial layout for draggable chip tokens in typed category wells. Pointer-event DnD only (WKWebView constraint). Reusable across all three sub-explorers. | Sub-explorer UIs, DslCompiler (output consumer) |
| `formula_cards` SQL table | Persisted named formula cards: id, title, dsl, sql, version, scope, type_signature, dependencies, provenance, performance_hint, visibility | CloudKit sync (checkpoint), DslCompiler (load), ChipWell (drag source), Worker CRUD handlers |

### Existing Components — Extended (not replaced)

| Component | Current Behavior | Required Extension |
|-----------|-----------------|-----------------|
| `QueryBuilder` | Composes `FilterProvider + PAFVProvider + DensityProvider` compile() outputs | Add `FormulasProvider.compile()` injection: `selectFragments` go into SELECT clause; `whereFragments` + bind values go into WHERE with AND composition alongside FilterProvider; `orderFragments` go into ORDER BY. QueryBuilder is the **only** assembly point — no SQL is assembled elsewhere. |
| `WorkerRequestType` (protocol.ts) | Union of 35 message types | Add `'formula:card:create'`, `'formula:card:list'`, `'formula:card:update'`, `'formula:card:delete'` for formula card CRUD with typed request/response shapes. Optionally add `'formula:compile-check'` for async type-signature validation. Formula Card CRUD can alternatively reuse `'db:exec'`/`'db:query'` — only add typed messages if structured responses are needed. |
| `StateCoordinator` | Subscribes to providers, fires rAF-batched notification | Register `FormulasProvider`, `MarksProvider`, `AuditsProvider` via `registerProvider(key, provider)`. Zero changes to StateCoordinator implementation. |
| `StateManager` | Tier 2 persistence via `ui_state` table | Register FormulasProvider for chip arrangement persistence. Formula Cards persist to dedicated `formula_cards` table, not `ui_state`. |
| `PanelRegistry` | Plugin-based panel lifecycle | `formulasPanelFactory` in `FormulasPanelStub.ts` is replaced with one pointing at the real `FormulasExplorerPanel`. No registry API changes. |
| `supergrid:query` Worker handler | Executes parameterized GROUP BY query | Receives enriched `{ sql, params }` from QueryBuilder. The handler itself is unchanged — it already accepts arbitrary SQL+params. The enrichment comes from QueryBuilder composition, not from handler changes. |
| `ViewManager` | Fetches data, calls IView.render() | After `supergrid:query` response arrives: call `MarksProvider.annotate(rows)` and `AuditsProvider.annotate(rows)`, then pass class/flag maps to the view for D3 data join application. This is the same post-render pattern as existing `AuditState` CSS overlay. |

### Existing Components — Unchanged

| Component | Why Unchanged |
|-----------|--------------|
| `FilterProvider` | Formulas filter chips compile to the same SQL shape as FilterProvider filters but are a **separate provider**. FilterProvider owns LATCH-surface filters (histogram scrubbers, category chips, checkboxes). FormulasProvider owns user-authored DSL predicates. They coexist via AND composition in QueryBuilder. |
| `PAFVProvider` | GROUP BY ownership never transfers to FormulasProvider (FE-RG-01). FormulasProvider may inject SELECT fragments (aggregations, window functions) but never owns `GROUP BY`. |
| `SchemaProvider` | DslCompiler reads `SchemaProvider.getAllAxisColumns()` to validate field names and type signatures at chip-drop time. No SchemaProvider changes required. |
| `WorkerBridge` | Typed message protocol with correlation IDs is unchanged. New message types extend the WorkerRequestType union only. |
| `MutationManager` | Formula Card CRUD goes through Worker directly. MutationManager is not extended. |
| `AliasProvider` | Derived column names from Calculations may participate in aliases, but AliasProvider needs no changes. It already handles dynamic column names. |
| `DockNav` / `section-defs.ts` | The `DOCK_DEFS` array already has `{ key: 'formula', label: 'Formulas' }` in the Analyze section. The dock button already toggles the bottom slot panel. No navigation changes needed. |
| `SuperWidget` / `PanelManager` | Panel slot wiring already exists. `FormulasPanelStub` already occupies the bottom-slot panel position. Replacing the stub with the real panel requires only changing the `formulasPanelFactory` function. |

---

## Data Flow

### Formula chip → SQL → result set

```
User drops chip in ChipWell (pointer events)
    │
ChipWell.onChipDrop({ well, chip })
    │
FormulasProvider.addChip(well, chip)  [validates type via SchemaProvider]
    │
FormulasProvider._scheduleNotify()    [queueMicrotask, same as FilterProvider]
    │
StateCoordinator fires after microtask drain
    │
WorkerBridge.send('supergrid:query', QueryBuilder.build())
    │  QueryBuilder now calls FormulasProvider.compile() alongside
    │  FilterProvider.compile() + PAFVProvider.compile()
    │
Worker executes parameterized SQL (bind values, never string concat)
    │
supergrid:query response: CellDatum[]
    │
ViewManager receives rows
    │
MarksProvider.annotate(rows)  → {cardId, cssClasses[]}[]
AuditsProvider.annotate(rows) → {cardId, flagType}[]
    │
D3 data join applies classes and flags to cells
(same mechanism as SuperAudit plugin CSS overlay in v8.1)
```

### Formula Card promotion (bottom-up)

```
User clicks "Save as Formula" on a chip well
    │
FormulasExplorerPanel.onSaveAsFormula(well)
    │
DslCompiler.serializeChips(well.chips) → {dsl, sql, typeSignature}
    │
Worker.send('formula:card:create', { title, dsl, sql, typeSignature, ... })
    │
Worker inserts into formula_cards table
    │
FormulasExplorerPanel refreshes card library panel
```

---

## Patterns to Follow

### Pattern 1: Provider compile() interface

Every existing provider exposes a synchronous pure `compile()` method. `FormulasProvider` follows the identical contract. `QueryBuilder` accepts it by extending the constructor signature.

```typescript
interface CompiledFormulas {
  selectFragments: string[];   // ["revenue - cost AS profit", "SUM(quantity)"]
  whereFragments: string[];    // ["priority > ?", "status = ?"]
  orderFragments: string[];    // ["company ASC", "created_at DESC"]
  params: unknown[];           // bind values in order
}

class FormulasProvider implements PersistableProvider {
  compile(): CompiledFormulas { /* pure, sync */ }
  subscribe(cb: () => void): () => void { /* returns unsubscribe */ }
  getState(): unknown { /* StateManager Tier 2 */ }
  setState(state: unknown): void { /* boot restore */ }
}
```

### Pattern 2: DslCompiler produces tuples — never concatenates

DslCompiler is a pure function. Every code path that produces SQL must return `{ sql: string, params: unknown[] }`. String concatenation of user input into SQL text is a structural bug, not a style choice. Field names are allowlist-validated via `validateFilterField` (same gate as FilterProvider).

```typescript
// Correct: parameterized
function compileFilterChip(chip: FilterChip): { sql: string; params: unknown[] } {
  const safeField = validateFilterField(chip.field); // throws on unknown field
  return { sql: `${safeField} > ?`, params: [chip.value] };
}

// Never: string concatenation of user value
function compileFilterChip(chip: FilterChip): string {
  return `${chip.field} > ${chip.value}`; // SQL injection
}
```

### Pattern 3: Post-query annotation for Marks and Audits

Marks and Audits never alter row membership or order. They annotate rows after the SQL query returns. This is identical to the existing `AuditState` CSS overlay from v4.1/v8.1.

```typescript
// MarksProvider.annotate() — pure JS predicate evaluation, no Worker involvement
interface MarkAnnotation {
  cardId: string;
  cssClasses: string[]; // ["urgent", "flagged"]
}

// Called in ViewManager after supergrid:query response:
const marks = marksProvider.annotate(rows);      // O(n) JS predicate scan
const audits = auditsProvider.annotate(rows);    // O(n) JS predicate scan

// Applied via D3 data join (same pattern as AuditPlugin.afterRender):
cells.classed('urgent', d => marks.get(d.cardId)?.includes('urgent') ?? false);
```

### Pattern 4: PanelHook for FormulasExplorerPanel

`FormulasExplorerPanel` implements `PanelHook` (mount/update/destroy). This is identical to how `CalcExplorer`, `NotebookExplorer`, `AlgorithmExplorer` work. The three sub-explorer UIs are created inside `mount()` and torn down in `destroy()`.

```typescript
export const formulasPanelFactory: PanelFactory = (): PanelHook => {
  let panel: FormulasExplorerPanel | null = null;
  return {
    mount(container: HTMLElement): void {
      panel = new FormulasExplorerPanel(container, {
        formulasProvider, marksProvider, auditsProvider
      });
    },
    update(): void { panel?.render(); },
    destroy(): void { panel?.destroy(); panel = null; },
  };
};
```

### Pattern 5: ChipWell as geometry primitive

`ProjectionExplorer` already implements pointer-event chip DnD for 4 wells (v7.2). The `ChipWell` primitive extracts that pattern:

- **Authority:** well container owns layout; chips are subordinate
- **Units:** chip token (variable width, fixed height ~28px)
- **DnD:** pointer events only, no HTML5 DnD (WKWebView constraint, D-017)
- **Data binding input:** ordered `Chip[]` per well, each `{ id, dslFragment, typeSignature, displayLabel }`
- **Data binding output:** same shape mutated by user; consumed by DslCompiler
- **Cross-well drag:** copy by default, modifier key for move; never silently change chip category

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: FormulasProvider owns GROUP BY

Formulas/Calculations may include aggregation expressions (SUM, COUNT, RANK) but must never inject `GROUP BY`. Grouping comes exclusively from PAFVProvider. If no GROUP BY is active, aggregate functions compile as scalar subqueries or window functions.

**Why bad:** Breaks the polymorphic view contract (FE-RG-01). The same Calculation chip must produce correct SQL whether SuperGrid has 0 or 5 axes stacked. If FormulasProvider owns GROUP BY, it would conflict with PAFVProvider's stacked axis grouping.

**Instead:** `FormulasProvider.compile()` returns `selectFragments` only. QueryBuilder places them after the PAFVProvider-driven SELECT columns. GROUP BY comes solely from PAFVProvider.

### Anti-Pattern 2: Marks or Audits touching the WHERE clause

Any predicate that affects row membership is a Filter, not a Mark or Audit. If MarksProvider or AuditsProvider generates WHERE fragments, the chip is misclassified.

**Why bad:** Violates FE-RG-07 and FE-RG-08. Post-query annotation is O(n) JS evaluation — idempotent, reversible, no Worker round-trip. WHERE-clause side effects change the result set and require a Worker re-query.

**Instead:** MarksProvider and AuditsProvider run predicates against the already-fetched `CellDatum[]` in JavaScript, assigning classes and flags without Worker involvement.

### Anti-Pattern 3: Extending FilterProvider for formula filter chips

Formula filter chips are not added to FilterProvider. They live in FormulasProvider. FilterProvider owns the LATCH-surface filter controls (histogram scrubbers, category chips, text-search checkboxes). FormulasProvider owns user-authored DSL predicates that may look like filters.

**Why bad:** Conflates UI-driven LATCH membership filters with user-authored predicate logic. They have different UX, different persistence semantics, and in future different DSL grammar.

**Instead:** QueryBuilder ANDs `FilterProvider.compile().whereFragments` and `FormulasProvider.compile().whereFragments` together. They are independent providers that compose at the QueryBuilder boundary.

### Anti-Pattern 4: String concatenation anywhere in DslCompiler

Every value a user provides in a chip's DSL fragment must become a `?` placeholder with a corresponding bind value. Field names must be allowlist-validated. There is no exception for "safe-looking" values.

**Why bad:** One string concatenation breaks the structural injection-safety invariant. Safety must be enforceable at code-review time via structure, not vigilance.

**Instead:** DslCompiler returns `{ sql: string, params: unknown[] }` for every chip. The tuple shape makes it structurally impossible to pass an unbound value to the Worker.

### Anti-Pattern 5: New Worker messages for simple CRUD

Formula Card CRUD does not require new typed Worker messages if `'db:exec'`/`'db:query'` suffice. Inflating WorkerRequestType unnecessarily couples the formula system to the Worker protocol.

**Why bad:** Each new message type requires changes to `protocol.ts`, `handlers/index.ts`, a new handler file, and tests. For simple INSERT/SELECT operations this overhead exceeds the benefit.

**Instead:** Use `'db:exec'` for writes and `'db:query'` for reads, exactly as MutationManager card mutations do. Add typed Worker messages only for operations that need structured response validation (e.g., `'formula:compile-check'` for server-side type-signature validation against live schema data).

---

## Build Order (Dependency-Driven)

```
Phase 1: DslCompiler
  Pure function, no dependencies. Full Vitest coverage before any UI.

Phase 2: FormulasProvider + MarksProvider + AuditsProvider
  Depend on DslCompiler. Follow FilterProvider provider pattern exactly.
  Register with StateCoordinator + StateManager. Seam tests against real sql.js.

Phase 3: formula_cards SQL table + Worker CRUD
  DDL that runs cleanly in test DB. CRUD via 'db:exec'/'db:query' or typed messages.
  CloudKit sync: formula_cards records added to checkpoint export.

Phase 4: ChipWell geometry primitive
  Extract pointer-event DnD from ProjectionExplorer pattern.
  Must pass Vitest unit tests for drag state machine before UI integration.

Phase 5: FormulasExplorerPanel (three sub-explorer tabs)
  Depends on ChipWell + all three providers.
  Replaces FormulasPanelStub. PanelRegistry unchanged.

Phase 6: QueryBuilder extension
  Inject FormulasProvider.compile() into SELECT/WHERE/ORDER BY.
  Integration tests: chip arrangement → SQL round-trip against real sql.js.

Phase 7: Post-query annotation wiring in ViewManager
  MarksProvider.annotate() + AuditsProvider.annotate() after supergrid:query.
  Seam tests for annotation → D3 class assignment.

Phase 8: Golden-test corpus
  Fixture dataset SQL. 30+ test cases for DslCompiler + integration.
  Anti-patching rule: bug fixes add cases, never weaken assertions.
```

Phases 1-3 have no jsdom dependency — pure Vitest (same pattern as v6.1 seam tests). Phases 4-5 require jsdom. Phases 6-8 require real sql.js via `realDb()` factory.

---

## Scalability Considerations

| Concern | Impact with new explorers |
|---------|--------------------------|
| Worker query latency | Formulas adds SELECT fragments and WHERE clauses. Same indexed columns, same bind-param path. DslCompiler is synchronous and sub-millisecond. No new performance risk. |
| StateCoordinator rAF batching | 3 new provider subscriptions. rAF coalescing absorbs them without behavior change. Worst case: one extra 16ms window before query fires. |
| Post-query annotation | O(n) JS predicate evaluation over CellDatum[]. At 2500 cells (50×50 SuperGrid max), this is negligible (<1ms). No Worker round-trip. |
| Formula Card library size | Hundreds of versioned rows in formula_cards is acceptable. Full library is a single `SELECT * FROM formula_cards WHERE scope = ?`. No per-card Worker messages on load. |
| Chip arrangement persistence | Serializes to JSON via getState(), stores in ui_state. Same cost as existing FilterProvider/PAFVProvider state. No new infrastructure. |

---

## Sources

- `/Users/mshaler/Developer/Projects/Isometry/.planning/formulas-explorer-handoff-v2.md` — primary architecture decision document (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/src/providers/FilterProvider.ts` — provider pattern reference implementation
- `/Users/mshaler/Developer/Projects/Isometry/src/providers/QueryBuilder.ts` — SQL assembly boundary
- `/Users/mshaler/Developer/Projects/Isometry/src/providers/StateCoordinator.ts` — cross-provider notification pattern
- `/Users/mshaler/Developer/Projects/Isometry/src/worker/protocol.ts` — WorkerRequestType union (35 existing types)
- `/Users/mshaler/Developer/Projects/Isometry/src/ui/panels/PanelTypes.ts` — PanelHook/PanelFactory interface
- `/Users/mshaler/Developer/Projects/Isometry/src/ui/panels/FormulasPanelStub.ts` — existing stub to replace
- `/Users/mshaler/Developer/Projects/Isometry/src/ui/section-defs.ts` — dock navigation (formula item already wired)
- `/Users/mshaler/Developer/Projects/Isometry/.planning/PROJECT.md` — milestone context and locked architectural decisions (D-001..D-020)
- `/Users/mshaler/Developer/Projects/Isometry/.planning/geometry-contract-template.md` — geometry contract structure

---
*Architecture research for: v15.0 Formulas Explorer Architecture*
*Researched: 2026-04-27*
