# Isometry v4 — Claude Code Operating Instructions

## Identity

**Isometry** is a polymorphic data projection platform. The same LATCH-filtered, GRAPH-connected dataset renders through PAFV spatial projection as grid, kanban, network, or timeline — with view transitions that change the SQL projection, not the data. The keystone feature is **SuperGrid**: nested dimensional headers, orthogonal density controls, and direct sql.js→D3.js rendering with zero serialization.

**This is v4.** It inherits architecture from CardBoard-v3 but eliminates the 40KB Swift↔JavaScript MessageBridge by using sql.js (SQLite compiled to WASM). D3.js queries SQLite directly in the same memory space. No promises, no callback IDs, no serialization boundaries.

---

## Architecture Truth

### The Vocabulary

Every Claude Code session in this repo must speak this language:

**PAFV** — Planes → Axes → Facets → Values. The spatial projection system.
- **Planes**: x, y, z (screen coordinates)
- **Axes**: LATCH dimensions mapped to planes
- **Facets**: Specific attributes within an axis (e.g., `created_at` within Time)
- **Values**: Cards (Nodes + Edges in the LPG)

**LATCH** — Location, Alphabet, Time, Category, Hierarchy. The five filtering/sorting dimensions. LATCH *separates* data into groups.

**GRAPH** — Link, Nest, Sequence, Affinity. The four edge types connecting nodes. GRAPH *joins* data across groups.

**LPG** — Labeled Property Graph. Nodes and edges are both first-class entities with properties, stored in SQLite. Edges are cards.

### Core Principles

1. **LATCH separates, GRAPH joins** — fundamental duality
2. **Edges are Cards** — LPG semantics, not a join table
3. **Any axis maps to any plane** — view transitions are PAFV remappings
4. **D3's enter/update/exit IS state management** — no Redux, no Zustand
5. **Boring stack wins** — SQLite + D3.js + TypeScript
6. **Swift is plumbing, D3 is UI** — all visual rendering in D3.js via WKWebView
7. **Bridge elimination** — sql.js puts SQLite in the same JS runtime as D3.js

### Five-Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│  5. Swift/Tauri Wrapper (future)                        │
│     Window management, menus, file I/O, CloudKit sync   │
│     ~50 lines of bridge code (base64 load/save)         │
├─────────────────────────────────────────────────────────┤
│  4. React Control Chrome                                │
│     FilterNav, toolbars, view switchers, pane layout    │
│     shadcn/ui components, Tailwind CSS                  │
│     Tells D3 WHAT to render (dispatches LATCH filters)  │
│     Does NOT touch data directly                        │
├─────────────────────────────────────────────────────────┤
│  3. D3.js Data Plane                                    │
│     ALL visualization and interaction lives here        │
│     SuperGrid, Network, Kanban, Timeline renderers      │
│     Binds directly to sql.js query results              │
│     Uses .join() with key functions — always            │
├─────────────────────────────────────────────────────────┤
│  2. sql.js (SQLite in WASM)                             │
│     Runs INSIDE the browser JS runtime                  │
│     db.exec() returns results to D3 synchronously       │
│     FTS5, recursive CTEs, graph traversal — all here    │
│     No bridge overhead, no serialization                │
├─────────────────────────────────────────────────────────┤
│  1. SQLite File (Source of Truth)                       │
│     isometry.db on disk                                 │
│     Schema: nodes, edges, facets, notebook_cards        │
│     Loaded as ArrayBuffer at startup                    │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

**Read:** User clicks filter → React dispatches → D3.js calls `db.exec(SQL)` → D3 re-renders. One function call. Same memory space.

**Write:** User edits card → D3.js calls `db.run(INSERT/UPDATE)` → sql.js updates in-memory → debounced save to disk (base64).

**View transition:** LATCH filter change → different SQL WHERE clause → same D3 renderer re-binds. Or: view switch → different SQL SELECT projection → different D3 renderer binds same data.

---

## Tech Stack (What's Actually In Use)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | TypeScript (strict mode) | No `any`. Fix all errors before committing. |
| Data | sql.js (SQLite in WASM) | FTS5 + recursive CTEs required |
| Visualization | D3.js v7 | All rendering. `.join()` with key functions always. |
| UI Chrome | React 18 | Controls and layout only. Not for data display. |
| Styling | Tailwind CSS + shadcn/ui | Two themes: NeXTSTEP (retro), Modern (glass) |
| Build | Vite | `npm run dev` for development |
| Test | Vitest | TDD. Tests first. `npm run test` |
| Package mgr | npm | See `package.json` in Isometry repo |

### What Is NOT in the Stack

- ❌ Redux / Zustand / MobX — D3's data join IS state management
- ❌ React Native — this is a web app in a native shell
- ❌ SQLite.swift — replaced by sql.js
- ❌ MessageBridge.swift — eliminated entirely
- ❌ KuzuDB or any graph database — SQLite recursive CTEs handle graph queries
- ❌ Next.js / Remix / server frameworks — this is a local-first app

---

## Repository Structure

### Active Code Lives in the Isometry Repo

The main working codebase is at:
```
/Users/mshaler/Developer/Projects/Isometry/
```

This v4 directory (`Isometry v4/`) contains **specs and planning documents only** — no source code. All implementation happens in the Isometry repo.

### Isometry Repo: Where to Write Code

```
src/
├── db/                     # sql.js initialization, schema, queries
│   ├── schema.sql          # ★ THE schema — nodes, edges, facets, notebook_cards
│   ├── init.ts             # sql.js database initialization
│   ├── types.ts            # TypeScript types for LPG model
│   ├── sample-data.ts      # Test/demo data
│   └── schemaLoader.ts     # Schema loading utilities
├── d3/                     # D3.js renderers (SuperGrid, Network, etc.)
├── filters/                # LATCH filter → SQL compilation
├── hooks/                  # useSQLiteQuery, useD3, etc.
├── state/                  # React contexts (FilterContext, PAFVContext)
├── components/             # React UI chrome (FilterNav, toolbars)
├── types/                  # Shared TypeScript interfaces
├── services/               # Data services wrapping sql.js
├── dsl/                    # PEG.js grammar, command parsing
├── contexts/               # Additional React contexts
├── features/               # Feature-specific modules
├── pages/                  # Page-level React components
├── styles/                 # CSS/Tailwind styles
├── utils/                  # Shared utilities
└── lib/                    # shadcn/ui component library
```

### Key Files

| File | Purpose |
|------|---------|
| `src/db/schema.sql` | The real LPG schema — nodes, edges, facets, notebook_cards, FTS5 |
| `src/db/init.ts` | sql.js database initialization |
| `src/db/types.ts` | TypeScript types matching the schema |
| `src/filters/` | LATCH filter compilation to SQL WHERE clauses |
| `src/d3/` | D3.js renderers — SuperGrid is the keystone |
| `src/hooks/useSQLiteQuery.ts` | React hook for sql.js queries |
| `src/state/` | FilterContext, PAFVContext, SelectionContext |
| `vitest.config.ts` | Test configuration |
| `vite.config.ts` | Build configuration |
| `package.json` | Dependencies and scripts |

### Reference-Only Repos (Do NOT Modify)

| Repo | Path | Use For |
|------|------|---------|
| CardBoard-v3 | `../CardBoard-v3/` | Pattern mining — notebook, shell, MCP, D3.js views |
| CardBoard archive | `../CardBoard archive/` | Historical reference only |
| CardBoard | `../CardBoard/` | Archived v2 codebase — do not touch |

---

## The Schema (What's Actually in SQLite)

The LPG lives in four core tables:

**`nodes`** — Cards. Every piece of data is a node.
- LATCH columns: location (lat/lng/name), time (created/modified/due/event), category (folder/tags/status), hierarchy (priority/importance/sort_order)
- Metadata: source, source_id, source_url, version, deleted_at (soft delete)

**`edges`** — Relationships. Edges are first-class with properties.
- Types: `LINK`, `NEST`, `SEQUENCE`, `AFFINITY`
- Properties: label, weight, directed, sequence_order, channel, timestamp, subject
- Unique constraint: (source_id, target_id, edge_type)

**`facets`** — Available filtering dimensions for PAFV projection.
- Maps axis (L/A/T/C/H) to source_column on nodes table
- Pre-seeded with folder, tags, status, priority, created, modified, due, name, location

**`notebook_cards`** — Extended functionality for the notebook sidecar.
- Links to nodes via node_id (one-to-one)
- card_type: capture, shell, or preview
- markdown_content, rendered_content, properties (JSON)

**FTS5 virtual tables**: `nodes_fts` and `notebook_cards_fts` with sync triggers.

There is no `cards` table. There is no `canvases` table in the current schema. Nodes ARE cards.

---

## Build & Test Commands

```bash
# Development server (React + Vite)
npm run dev

# Type checking (must pass with zero errors)
npm run typecheck

# Run tests (Vitest — TDD workflow)
npm run test              # Watch mode
npm run test:run          # Single run
npm run test:coverage     # With coverage

# Build for production
npm run build

# Lint
npm run lint
```

All commands run from the Isometry repo root (`/Users/mshaler/Developer/Projects/Isometry/`).

---

## SuperGrid: The Keystone Feature

SuperGrid is the polymorphic data projection system. It's not "a view" — it's the view continuum.

### Grid Continuum

| View | Axes | What Changes |
|------|------|-------------|
| Gallery | 0 explicit | Position only (icon view) |
| List | 1 | Single axis, hierarchical |
| Kanban | 1 facet | Single facet columns |
| 2D Grid | 2 | Row axis × Column axis |
| nD SuperGrid | n | Stacked PAFV headers, z-axis depth |

Each is a different PAFV axis allocation. The SQL projection changes, not the data.

### Super* Feature Family

| Feature | What It Does |
|---------|-------------|
| SuperStack | Nested PAFV headers with visual spanning across hierarchy levels |
| SuperDensity | Four-level Janus model: Value (zoom), Extent (pan), View, Region — all orthogonal |
| SuperSize | Inline cell expansion, count badges on multi-card cells |
| SuperDynamic | Drag-and-drop axis repositioning with animated grid reflow |
| SuperZoom | Cartographic navigation with pinned upper-left anchor |
| SuperCalc | Formula bar with PAFV-aware functions (SUMOVER) |
| SuperAudit | Toggle to highlight computed cells, show formulas |

### Density × Sparsity (The Janus Model)

Pan (extent) and Zoom (value) are orthogonal controls:
- **Extent density** (Pan): ultra-sparse (full Cartesian) ↔ populated-only
- **Value density** (Zoom): leaf values (Jan, Feb, Mar) ↔ collapsed (Q1)
- All four quadrants of Pan×Zoom are valid and useful

---

## Three-Canvas Notebook

The UI container for SuperGrid and everything else:

```
┌──────────────┬──────────────────┬────────────────────────────┐
│   CAPTURE    │      SHELL       │          PREVIEW           │
│              │                  │                            │
│  TipTap      │  Tab 1: Claude   │  Tab 1: SuperGrid ★       │
│  editor      │  AI (MCP)        │  Tab 2: Network Graph     │
│              │                  │  Tab 3: Data Inspector    │
│  /save-card  │  Tab 2: Claude   │                            │
│  /send-to-   │  Code (terminal) │  ← Direct sql.js queries  │
│   shell      │                  │  ← D3.js rendering         │
│              │  Tab 3: GSD GUI  │                            │
└──────────────┴──────────────────┴────────────────────────────┘
```

---

## Development Workflow

### TDD Pattern (Non-Negotiable)

1. Write failing test in `tests/` or co-located `__tests__/`
2. Run: `npm run test`
3. Implement minimal code to pass
4. Refactor while green
5. Commit

### Commit Convention

```
feat(supergrid): add nested PAFV headers with spanning
fix(filters): correct time axis SQL compilation
test(db): add recursive CTE graph traversal tests
refactor(d3): simplify data binding in grid renderer
chore(deps): update sql.js to latest WASM build
```

Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`
Scopes: `supergrid`, `d3`, `db`, `filters`, `notebook`, `shell`, `mcp`, `gsd`

### Code Quality

- TypeScript strict mode — no `any`, all errors resolved
- Max file size: 500 lines (split if larger)
- D3.js: always use `.join()` with key functions (`d => d.id`)
- sql.js: synchronous queries, no bridge API
- React: controls/chrome only, never data rendering

### D3.js Patterns (Canonical)

```typescript
// ALWAYS: key function in data binding
d3.selectAll(".card")
  .data(cards, d => d.id)
  .join("div")
    .attr("class", "card")
    .text(d => d.name);

// ALWAYS: .join() over manual enter/update/exit
selection.join(
  enter => enter.append("div").attr("class", "card"),
  update => update,
  exit => exit.remove()
);

// SINGLE DATA SOURCE: same cards, different projections
const cards = db.exec("SELECT * FROM nodes WHERE deleted_at IS NULL");
d3.select("#grid").selectAll(".cell").data(cards, d => d.id).join("div");
d3.select("#kanban").selectAll(".card").data(cards, d => d.id).join("div");
d3.select("#graph").selectAll(".node").data(cards, d => d.id).join("circle");
```

### sql.js Patterns (Canonical)

```typescript
// Direct synchronous query — no bridge, no promises
const results = db.exec(
  "SELECT * FROM nodes WHERE folder = ? AND deleted_at IS NULL",
  ["work"]
);

// Graph traversal with recursive CTE
const connected = db.exec(`
  WITH RECURSIVE reachable(id, depth) AS (
    SELECT ?, 0
    UNION ALL
    SELECT e.target_id, r.depth + 1
    FROM reachable r JOIN edges e ON e.source_id = r.id
    WHERE r.depth < ?
  )
  SELECT DISTINCT n.* FROM reachable r
  JOIN nodes n ON n.id = r.id
`, [startId, maxDepth]);

// FTS5 full-text search
const matches = db.exec(`
  SELECT n.* FROM nodes_fts
  JOIN nodes n ON nodes_fts.rowid = n.rowid
  WHERE nodes_fts MATCH ?
  ORDER BY rank
`, [searchQuery]);
```

---

## What NOT to Touch

| Item | Why |
|------|-----|
| `../CardBoard-v3/` | Reference only — mine patterns, don't modify |
| `../CardBoard/` | Archived v2 — historical reference |
| `../CardBoard archive/` | Old archives |
| `packages/` (if present) | Python ETL code, separate concern |
| Any `MessageBridge.swift` patterns | Eliminated by sql.js architecture |
| Any `SQLite.swift` patterns | Replaced by sql.js |
| `src/db/NativeAPIClient.ts` | Legacy native API approach — being replaced |
| `src/db/WebViewClient.ts` | Legacy bridge approach — being replaced |
| Performance monitoring over-engineering | Simplify, don't expand |

---

## Current Phase & Priorities

### Phase 1: Foundation Stabilization (NOW)

| Task | Priority | Status |
|------|----------|--------|
| Fix all TypeScript compilation errors | P0 | ❌ ~50+ errors |
| Delete dead bridge code | P0 | ❌ |
| Verify FTS5 works in sql.js | P0 | ❌ Gates everything |
| Verify recursive CTEs in sql.js | P0 | ❌ Gates everything |
| Set up Vitest with sql.js | P1 | ❌ |
| Vendor sql.js WASM binary (FTS5+JSON1) | P1 | ❌ |

**Gate:** Phase 2 does not start until sql.js runs FTS5, recursive CTEs, and feeds results synchronously to D3.js.

### Phase 2: SuperGrid with sql.js (NEXT)

4 weeks. Grid Continuum → SuperStack headers → Janus Density → Super* features. This is 44% of total development effort because it IS the product.

### Phase 3: Three-Canvas Integration

2 weeks. SuperGrid becomes the Preview canvas. Build Capture (TipTap) and Shell (Claude AI, Claude Code, GSD) around it.

### Phase 4: Platform & Tooling

3 weeks. Tauri desktop shell, GSD GUI wrapper, polish.

---

## Module Status

| Module | Status | Notes |
|--------|--------|-------|
| sql.js Foundation | ⚠️ STABILIZE | FTS5 verification gates everything |
| **SuperGrid** | ⭐ KEYSTONE | Grid Continuum + PAFV + Janus Density |
| D3.js Visualization | ✅ KEEP | Gains direct sql.js access |
| Three-Canvas Notebook | ❌ IMPLEMENT | Container for SuperGrid + Capture + Shell |
| Shell System | ⚠️ PORT | Good patterns in v3, adapt to sql.js |
| MCP Integration | ❌ ADAPT | Port patterns, eliminate bridge deps |
| GSD GUI Wrapper | ❌ BUILD | Parse Claude Code output → rich UI |
| Tauri Desktop Shell | ❌ IMPLEMENT | Lightweight native wrapper |
| Bridge Infrastructure | 🗑️ ELIMINATE | Delete all MessageBridge code |
| Happy iOS Companion | 📋 DEFERRED | Separate project after desktop ships |

---

## Architecture References (in this directory)

| Document | What It Covers |
|----------|---------------|
| `BRIDGE-ELIMINATION-ARCHITECTURE.md` | Why sql.js replaces 40KB of bridge code |
| `GSD-BRIDGE-ELIMINATION-PROMPT.md` | Implementation roadmap for sql.js approach |
| `REVISED-PHASE-DESCRIPTIONS.md` | SuperGrid-centric phase plan with Janus density model |
| `ISOMETRY-V4-GSD-EXECUTION-PLAN.md` | Full GSD execution plan across all phases |
| `isometry-notebook-gsd-frontend-spec-COMPLETED.md` | Three-canvas + GSD GUI specification |
| `specs/UPSTREAM-REVIEW-2026-02.md` | Assessment of what to keep/port/eliminate from v3 |

---

## Anti-Patterns to Avoid

- ❌ External state management (Redux, Zustand, MobX) — D3's data join handles it
- ❌ Building any Swift↔JS bridge infrastructure — sql.js eliminated this
- ❌ Using `SQLite.swift` or native SQLite for data queries — sql.js only
- ❌ Manual D3 enter/update/exit without `.join()`
- ❌ Missing key functions in D3 data binding
- ❌ Running GB-scale algorithms in browser (LATCH filters in SQLite, GRAPH algorithms in D3 on filtered subsets)
- ❌ Over-engineering performance monitoring
- ❌ Creating files >500 lines
- ❌ Committing with TypeScript errors
- ❌ Writing code without tests first

---

## GSD Executor Pattern

When Claude Code operates in this repo, it follows the GSD pattern:

1. **Spec** — Understand the requirement, reference architecture truth
2. **Plan** — Break into atomic tasks, identify files to create/modify
3. **Implement** — Write failing test → implement → green → refactor
4. **Test** — Verify all tests pass, typecheck clean
5. **Commit** — Atomic commit with conventional prefix

Every task should be completable in a single GSD cycle. If it's too big, split it.

---

*Last updated: 2026-02-05*
*Architecture: Bridge Elimination — sql.js direct access*
*Keystone: SuperGrid polymorphic data projection*
*Status: Phase 1 Stabilization*
