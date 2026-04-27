# Stack Research

**Domain:** DSL compiler, dependency graph, chip-well geometry — Formulas Explorer Architecture (v15.0)
**Researched:** 2026-04-27
**Confidence:** HIGH (all new capabilities verified against codebase inspection and npm registry; no new runtime deps required)

---

## Context

This milestone is a *clarification milestone* — no code ships. But the architecture specs it produces (WA-1 through WA-6) will directly drive two downstream implementation milestones: the DSL compiler and the chip-well UI. This document answers: when those milestones begin, what are the zero-surprise technology choices?

The existing stack is locked (TypeScript 5.9.3 strict, sql.js 1.14.0, D3.js v7.9, Vite 7.3, Vitest 4.0, Biome 2.4.6). This document covers only new capabilities required by the Formulas Explorer architecture.

---

## Recommended Stack

### Core Technologies (Unchanged)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TypeScript | 5.9.3 (strict) | All new modules | Locked |
| sql.js | 1.14.0 (FTS5 WASM) | `formula_cards` table, golden corpus tests | Same WASM instance; no schema migration library needed |
| Vitest | 4.0.18 | Golden test corpus (`it.each()`) | `it.each()` + `realDb()` factory from v6.1 is the right foundation |
| Biome | 2.4.6 | Lint gate | Unchanged |

### New Dependencies

**None.** All three new capabilities (DSL parsing, dependency graph, type validation) are implementable with zero new npm packages. Rationale per capability below.

---

## Capability Analysis

### Capability 1: DSL Parser — Hand-Written Recursive Descent

**Verdict: write it, do not import a library.**

The Formulas DSL grammar is structurally simple:
- **Filters:** `<field> <op> <literal>` composed AND-only across chips (no cross-chip OR, no nesting)
- **Sorts:** `<field> ASC|DESC` per chip, composed lexicographically
- **Calculations:** `<expression>` with column references and SQL function calls; dependency annotations reference other chip IDs

This grammar is decidable with 1-token lookahead and has no left recursion. A recursive descent parser fits in ~250 LOC. The existing `FilterProvider.compile()` and `allowlist.ts` already implement the validating, parameterizing half of this pipeline; the DSL parser is the *input* side of that same pipeline.

**Why not Chevrotain (~60KB parser library, ~5K stars):**
Chevrotain is the right choice when a grammar has ambiguity, multi-token error recovery needs, or a visitor pattern requirement. The Formulas DSL has none of these. Adding ~60KB for a grammar that needs 1-token lookahead is not justified. The codebase already has precedent for hand-writing this layer — `QueryBuilder.ts` assembles SQL from typed provider fragments with zero library dependency.

**Why not nearley / PEG.js:**
Both require a separate grammar file compilation step (grammar source → generated JS), which conflicts with the zero-extra-tooling constraint enforced since v4.2.

**Why not `expr-eval` or `mathjs`:**
General-purpose expression evaluators accept arbitrary user input and produce numeric values. They have no concept of the allowlist boundary in `allowlist.ts`. Plugging one in would bypass `validateFilterField()` / `validateOperator()`, violating FE-RG-02.

**Integration seam with existing code:**

The DSL parser produces typed AST nodes. The compiler walks those nodes and emits `{ sql: string, params: unknown[] }` — the existing `CompiledQuery` shape from `QueryBuilder.ts`. No new boundary types are needed. Field and operator validation flows through the existing `validateFilterField()` / `validateOperator()` assertion functions in `allowlist.ts`. SQL injection is structurally impossible because the compiler never concatenates user input into SQL strings (FE-RG-02).

**Token vocabulary sufficient for the DSL:**

```typescript
type Token =
  | { kind: 'IDENT';    value: string }
  | { kind: 'STRING';   value: string }
  | { kind: 'NUMBER';   value: number }
  | { kind: 'OP';       value: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'in' | 'isNull' | 'isNotNull' }
  | { kind: 'KEYWORD';  value: 'ASC' | 'DESC' | 'AND' | 'NOT' | 'NULL' }
  | { kind: 'EOF' }
```

**Confidence: HIGH.** Hand-written recursive descent is the production choice for domain-specific grammars at this scale. Reference: Microsoft Power Query parser (TypeScript, hand-written RD), Ruff Python parser (hand-written RD at v0.4.0), Sigma Computing formula layer.

---

### Capability 2: Dependency Graph — Inline Kahn's Algorithm

**Verdict: write it (~30 LOC), do not import a library.**

The dependency graph for Calculation chips is bounded: a realistic session has 5–20 formula chips. The graph is a DAG or cycles are a compile-time error (FE-RG-05). Kahn's algorithm is O(V + E) and produces cycle detection for free — if `order.length < nodes.length` after the algorithm, the residual nodes are in a cycle.

**Why not `toposort` npm (2.0.2, ~4.9M weekly downloads, MIT):**
- Requires a separate `@types/toposort` devDependency — dual-package friction for 30 lines.
- Input format is array-of-pairs `[from, to][]` which requires adapting chip descriptor objects anyway.
- The package was last published in 2016 with no active maintenance.
- The codebase adds algorithmic library dependencies only when the algorithm itself is complex (graphology for Louvain / betweenness centrality at v9.0). A topological sort does not clear that bar.

**Why not `@n1ru4l/toposort` (TypeScript-native, modern Map/Set):**
Better package hygiene but same conclusion: 30 lines of Kahn's algorithm inline has no version drift risk, no transitive deps, and is directly testable in the golden corpus.

**Kahn's algorithm implementation pattern (inline in `src/formulas/graph.ts`):**

```typescript
/** Returns ordered chip IDs, or the cycle participants if a cycle exists. */
function topoSort(
  nodes: string[],
  edges: ReadonlyArray<[from: string, to: string]>
): { order: string[] } | { cycle: string[] } {
  const inDegree = new Map<string, number>(nodes.map(n => [n, 0]));
  const adj = new Map<string, string[]>(nodes.map(n => [n, []]));
  for (const [from, to] of edges) {
    adj.get(from)!.push(to);
    inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
  }
  const queue = nodes.filter(n => inDegree.get(n) === 0);
  const order: string[] = [];
  while (queue.length) {
    const n = queue.shift()!;
    order.push(n);
    for (const m of adj.get(n)!) {
      const deg = inDegree.get(m)! - 1;
      inDegree.set(m, deg);
      if (deg === 0) queue.push(m);
    }
  }
  if (order.length < nodes.length) {
    const inOrder = new Set(order);
    return { cycle: nodes.filter(n => !inOrder.has(n)) };
  }
  return { order };
}
```

Cycle participants are returned by ID so the chip-well UI can highlight them (WA-5/WA-6 error state for dependency cycles).

**Confidence: HIGH.** Standard algorithm; zero version drift risk; ~5 test cases cover all branches.

---

### Capability 3: Type Signature Validation — Extend Existing Allowlist Pattern

**Verdict: no new library. Extend `allowlist.ts` with a `TYPE_COMPATIBILITY` record.**

Formula Card type signatures (`text | number | date | boolean | select | multi_select`) map directly to the `facet_type` values already tracked by `SchemaProvider`. Type validation at chip-drop time is a compatibility lookup: "does this chip's output type match this well's accepted input types?"

This is the same frozen-set + assertion pattern already in `allowlist.ts`. A new `validateChipType()` assertion follows `validateFilterField()` identically.

**Type compatibility table pattern:**

```typescript
// src/formulas/type-compat.ts
type ChipOutputType = 'boolean' | 'number' | 'text' | 'date' | 'select' | 'multi_select';
type ChipWellKind   = 'filter' | 'sort' | 'calculation' | 'mark' | 'audit';

const TYPE_COMPATIBILITY: Readonly<Record<ChipOutputType, ChipWellKind[]>> = {
  boolean:      ['filter', 'mark', 'audit'],   // predicates work in all three
  number:       ['calculation', 'sort'],
  text:         ['calculation', 'filter', 'sort'],
  date:         ['calculation', 'filter', 'sort'],
  select:       ['filter'],
  multi_select: ['filter'],
} as const;

export function isCompatibleWithWell(
  chipOutputType: ChipOutputType,
  well: ChipWellKind
): boolean {
  return TYPE_COMPATIBILITY[chipOutputType]?.includes(well) ?? false;
}

/** Assertion variant — throws with a UI-surfaceable message */
export function assertCompatibleWithWell(
  chipOutputType: ChipOutputType,
  well: ChipWellKind,
  chipLabel: string
): void {
  if (!isCompatibleWithWell(chipOutputType, well)) {
    throw new TypeError(
      `Type mismatch: chip "${chipLabel}" (output: ${chipOutputType}) ` +
      `is not compatible with well "${well}".`
    );
  }
}
```

**Integration with SchemaProvider:** `SchemaProvider.getAllAxisColumns()` already returns columns with `latchFamily` and SQLite type affinity. The type validator reads from the same source — no new PRAGMA queries needed. The `(string & {})` widening trick from v5.3 covers dynamic schema fields at compile time.

**Confidence: HIGH.** Directly extends the existing validated allowlist pattern; no additional library surface.

---

### Capability 4: Golden Test Corpus — Extend Existing Vitest Infrastructure

**Verdict: `it.each()` with typed fixture objects. No new library.**

Vitest 4.0 `it.each()` over a typed array is the idiomatic approach for a golden corpus. The existing `realDb()` factory (v6.1), `makeProviders()` wired stack, and `tests/seams/` directory structure are the right foundation.

**Corpus test pattern:**

```typescript
// tests/seams/formulas/golden-corpus.test.ts
interface GoldenCase {
  name: string;
  chips: ChipDescriptor[];
  expectedSql: string;
  expectedParams: unknown[];
}

const CORPUS: GoldenCase[] = [
  {
    name: 'simple eq filter',
    chips: [{ well: 'filter', field: 'status', op: 'eq', value: 'active' }],
    expectedSql: 'deleted_at IS NULL AND status = ?',
    expectedParams: ['active'],
  },
  // ...30+ cases
];

it.each(CORPUS)('$name', ({ chips, expectedSql, expectedParams }) => {
  const { sql, params } = compileChips(chips);
  expect(sql).toBe(expectedSql);
  expect(params).toEqual(expectedParams);
});
```

Anti-patching rule from v6.1 applies verbatim (FE-RG-12): corpus assertions are immutable. Bug fixes add cases; they never weaken existing assertions. The `tests/seams/formulas/` subdirectory mirrors the production module boundary `src/formulas/`.

**Confidence: HIGH.** Pattern already validated in `tests/seams/` (v6.1) and `tests/plugins/` (v8.3).

---

### Capability 5: Chip-Well DnD — Extend Existing Pointer-Event Infrastructure

**Verdict: no new library. Reuse pointer-event DnD pattern from ProjectionExplorer (v7.2).**

The ProjectionExplorer's chip drag was migrated to pointer events in v7.2 specifically because HTML5 DnD is unreliable in WKWebView (D-017: "Pointer events only for DnD"). The chip-well geometry contract (WA-6) will specify the coordinate system and hit-region rules; the implementation reuses `pointerdown/pointermove/pointerup` with `elementsFromPoint()` hit-testing.

**Existing utilities to reuse:**
- Module-level `dragPayload` singleton pattern — HTML5 DnD `dataTransfer.getData()` is blocked during `dragover`; pointer-event DnD uses module-level state (validated v3.0)
- 40px enlarged drop zones during active drag (v7.2 decision)
- FLIP animation via WAAPI for chip reorder within a well (v3.1 decision)
- `data-drag-active` attribute + CSS `opacity: 0.5` ghost (v7.2 pattern)

**Confidence: HIGH.** Identical constraints, identical solution, validated twice (ProjectionExplorer v7.2, SuperGrid axis grip v7.2).

---

### Capability 6: Formula Card Schema — New SQLite Table, No Libraries

**Verdict: DDL-only change. No ORM, no migration library.**

The `formula_cards` table follows the pattern of `cards`, `connections`, and `ui_state` — created at `initialize()` time via `_applySchema()` in `Database.ts`. Schema additions are additive (no breaking changes to existing tables).

**Versioning strategy:** every save inserts a new row with incremented `version` integer. Reads `SELECT ... WHERE id = ? ORDER BY version DESC LIMIT 1` for the latest. Old versions remain for rollback. No separate `formula_card_versions` table at v1 — version column + latest-first query is sufficient.

**Dependencies column:** `TEXT` column storing `JSON.stringify(string[])` — array of formula card IDs. The topological sort algorithm deserializes this at compile time. No graph storage library needed.

**Sync:** Formula cards sync via CKSyncEngine like `cards` and `connections`. The existing `export-all-cards` bridge message is extended to include formula cards, matching the v4.1 pattern for connections.

**Confidence: HIGH.** Matches existing `ui_state` (JSON blobs in TEXT columns) and `connections` (explicit reference tracking) patterns exactly.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Chevrotain | ~60KB bundle for a grammar with 1-token lookahead; library power exceeds grammar complexity | Hand-written recursive descent (~250 LOC) |
| nearley / PEG.js | Grammar file compilation step; conflicts with zero-extra-tooling constraint | Hand-written recursive descent |
| `toposort` (npm 2.0.2) | 30-line Kahn's algorithm does not clear the "add a dependency" bar; `@types/toposort` dual-package friction | Inline Kahn's algorithm in `src/formulas/graph.ts` |
| `@n1ru4l/toposort` | Same conclusion as above — better package, still 30 lines inline wins | Inline Kahn's algorithm |
| HyperFormula | Permanently out-of-scope (PROJECT.md) — ~500KB bundle, PAFV coordinate reference syntax unsolved | SQL DSL compiled by hand |
| `expr-eval` / `mathjs` | General-purpose evaluators bypass the allowlist safety boundary; user input skips `validateFilterField()` | Hand-written parser feeding existing allowlist |
| Zod / io-ts | Runtime schema validation library for a lookup table that is a frozen `Record<>` | Extend `allowlist.ts` with `TYPE_COMPATIBILITY` record |
| HTML5 DnD for chip wells | WKWebView intercepts `dragstart`; architecturally banned (D-017) | Pointer events + `elementsFromPoint()` hit-testing |
| Separate `formula_card_versions` table | Over-engineering for v1 — version integer + ORDER BY DESC LIMIT 1 covers the use case | Version column on `formula_cards` table |

---

## Integration Points with Existing Infrastructure

| New Capability | Existing Seam | Existing Code Location |
|---|---|---|
| DSL parser output `{ sql, params }` | `CompiledQuery` interface | `src/providers/QueryBuilder.ts` |
| Chip field validation | `validateFilterField()` / `isValidFilterField()` | `src/providers/allowlist.ts` |
| Chip operator validation | `validateOperator()` / `isValidOperator()` | `src/providers/allowlist.ts` |
| Dynamic column names for chips | `SchemaProvider.getAllAxisColumns()` | `src/providers/SchemaProvider.ts` |
| Post-query annotation (Marks, Audits) | `CellDatum` augmentation after Worker response | `src/views/pivot/PivotTypes.ts` |
| Formula card CRUD | `Database._applySchema()`, `ui_state` key pattern | `src/database/Database.ts` |
| CloudKit sync for formula cards | `CKSyncEngine` actor, `export-all-cards` message | Swift `SyncMerger.ts`, `NativeBridge.ts` |
| Golden test corpus | `realDb()`, `makeProviders()`, `tests/seams/` | `tests/harness/`, `tests/seams/` |
| Chip-well DnD | `dragPayload` singleton, `elementsFromPoint()` | `src/views/pivot/plugins/` DnD utilities |

---

## Worker Bridge Protocol Implications

The Formulas compiler runs on the **main thread**, not in the Worker. Rationale:

- Compilation is synchronous and CPU-cheap (parsing a handful of chip descriptors is <1ms)
- The compiled `{ sql, params }` tuple is sent to the Worker via the existing `supergrid:query` or `db:exec` message types — no new message type needed for the compiler itself
- Post-query annotations (Marks class assignment, Audits flag assignment) execute on the **main thread** after the Worker returns results — same pattern as `AuditState` CSS overlay (v4.1 decision: "AuditState as CSS overlay — no Worker re-query needed")

Formula card CRUD operations (save, load, delete) use a new `formula_cards:*` Worker message family, following the `cards.handler.ts` pattern. This is the only new Worker protocol surface.

---

## Installation

```bash
# Nothing to install — zero new dependencies
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Hand-written recursive descent parser | Chevrotain | When grammar has genuine ambiguity, multi-token error recovery, or CST visitor requirements — none apply here |
| Inline Kahn's algorithm | `toposort` npm | In a new project with no established codebase conventions; not appropriate here given the 30-line cost |
| `TYPE_COMPATIBILITY` record in `allowlist.ts` | Zod schema validation | When validating external API payloads or user-uploaded JSON where shape is unknown — not applicable to an internal chip descriptor type |
| `formula_cards` version column + ORDER BY DESC | Separate versions table | When audit trail queries must be performant across thousands of cards — not the scale of a formula card library |

---

## Version Compatibility

All new capabilities are implemented in-process with zero new npm packages. No version compatibility surface to manage.

| Capability | Constraint | Status |
|---|---|---|
| `it.each()` golden corpus | Vitest 4.0 stable API | SAFE |
| Kahn's algorithm | ES2020 Map/Set (sql.js WASM environment requirement) | SAFE |
| `TYPE_COMPATIBILITY` frozen record | TypeScript 5.9 `as const` | SAFE |
| `formula_cards` DDL | sql.js 1.14.0 custom WASM | SAFE — additive schema, no migration |
| Pointer events + `elementsFromPoint()` | Safari 13.1+, Chrome 55+, Firefox 59+ | SAFE — iOS 17+ / macOS 14+ deployment target |

---

## Sources

- Codebase inspection: `src/providers/QueryBuilder.ts`, `src/providers/allowlist.ts`, `src/providers/FilterProvider.ts`, `src/providers/SchemaProvider.ts`, `package.json` — HIGH confidence (direct read)
- `.planning/formulas-explorer-handoff-v2.md` — architecture decisions and regression guards FE-RG-01 through FE-RG-14 — HIGH confidence (primary spec)
- `PROJECT.md` — locked decisions D-017 (pointer events), HyperFormula permanent out-of-scope, SQL DSL pattern (v5.2), graphology addition criteria (v9.0) — HIGH confidence
- [npm: toposort 2.0.2](https://www.npmjs.com/package/toposort) — verified ~4.9M weekly downloads, `@types/toposort` separate package, 2016 vintage, array-of-pairs input format — MEDIUM confidence (npm registry)
- [npm: @n1ru4l/toposort](https://www.npmjs.com/package/@n1ru4l/toposort) — TypeScript-native port, modern Map/Set — MEDIUM confidence (npm registry)
- [Topological sort + cycle detection: Kahn's algorithm](https://labuladong.online/en/algo/data-structure/topological-sort/) — O(V+E) correctness, cycle detection via residual node count — HIGH confidence (algorithmic reference)
- [Ruff v0.4.0: hand-written recursive descent](https://astral.sh/blog/ruff-v0.4.0) — production evidence for hand-written RD parser at domain-grammar scale — MEDIUM confidence (official blog)
- [WebSearch: Chevrotain performance benchmark](https://chevrotain.io/performance/) — confirmed ~60KB footprint for parser library — MEDIUM confidence (official Chevrotain site)
- [TypeScript 5.5 type predicate inference](https://effectivetypescript.com/2024/04/16/inferring-a-type-predicate/) — confirmed `is` predicate pattern + inference in 5.5; relevant to type-compat validation pattern — MEDIUM confidence

---

*Stack research for: Isometry v15.0 Formulas Explorer Architecture*
*Researched: 2026-04-27*
