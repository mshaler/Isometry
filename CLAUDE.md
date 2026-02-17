# Isometry v4 — Claude Code Operating Instructions

## ⚠️ MANDATORY: GSD Automation Loop

**Before writing ANY code, run:**
```bash
npm run gsd
```

**After EVERY code change, run:**
```bash
npm run gsd
```

This is non-negotiable. The GSD automation module handles build → test → fix cycles automatically. Do NOT manually run `npm run build`, `npm run test`, or `tsc` separately. Use `npm run gsd` for the full loop.

**If GSD fails:**
1. Read the JSON output (it's token-efficient)
2. Apply the suggested fix or use the auto-fix that was attempted
3. Run `npm run gsd` again
4. Repeat until status is `"success"`

**Quick variants:**
- `npm run gsd:build` — Type check only (fastest)
- `npm run gsd:test` — Tests only (skip build)
- `npm run gsd "task description"` — Full cycle with context

---

## ⚠️ MANDATORY: GSD Workflow (Non-Negotiable)

**ALL work in this repository MUST be formalized as GSD milestones.** No exceptions unless the user explicitly says otherwise.

Before starting ANY implementation work:
1. **Check if a milestone exists** — Read `.planning/PROJECT.md` and `.planning/STATE.md`
2. **If no milestone** — Run `/gsd:new-milestone` to create one BEFORE writing code
3. **If milestone exists but no phase plan** — Run `/gsd:plan-phase` BEFORE writing code
4. **Never skip GSD artifacts** — ROADMAP.md, REQUIREMENTS.md, phase folders are required

**Violation indicators (STOP and formalize if you catch yourself):**
- Writing code without a phase plan in `.planning/phases/`
- Using a basic todo list instead of GSD task tracking
- Creating files without REQ-IDs mapped in REQUIREMENTS.md
- Starting "exploration" that turns into implementation

**The rule:** If you're about to write production code, there MUST be a GSD plan for it.

---

## Session Startup: Screenshot Monitoring

At the start of each session, start fswatch to monitor `~/Downloads` for screenshots:

```bash
fswatch -1 ~/Downloads/*.png &
```

When the user says "check the screenshot" or similar:
1. Read the most recent PNG from `~/Downloads` using the Read tool
2. The Read tool handles images natively — just read the file path

**Pattern:**
```bash
# Find most recent screenshot
ls -t ~/Downloads/*.png | head -1
```

Then use Read tool on that path to view the screenshot.

---

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
| Fix all TypeScript compilation errors | P0 | ✅ Zero TS errors |
| Static analysis ratchet (10-level pipeline) | P0 | ✅ Operational |
| ESLint errors → 0 | P0 | 🔄 102 errors remaining (CC handoff) |
| ESLint warnings → budget (700) | P1 | 🔄 749 warnings (49 over budget) |
| Delete dead bridge code | P1 | ❌ |
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

## Specification Documents (MUST READ)

These specs are authoritative. When in doubt, the spec wins.

| Spec | Location | When to Read |
|------|----------|-------------|
| **SuperGrid Specification** | `specs/SuperGrid-Specification.md` | Before ANY SuperGrid work. Contains all Super* features, acceptance criteria, testing requirements. |
| **Static Analysis Ratchet** | `specs/Static-Analysis-Ratchet.md` | When `npm run check` fails or ratchet thresholds need adjustment. |
| **Alto-Index ETL** | `specs/GSD-ALTO-INDEX-ETL.md` | When working with Apple Notes import pipeline. |
| **Product Positioning** | `specs/isometry-product-positioning.md` | For understanding why we're building what we're building. |

### SuperGrid Specification Is Authoritative

The `specs/SuperGrid-Specification.md` document is the **single source of truth** for SuperGrid behavior. It contains:
- All 14 Super* features with detailed behavior specs
- Testing criteria tables for each feature
- MVP acceptance checklist (Section 11)
- Performance targets
- Edge case handling

**Rule:** If code behavior differs from the spec, the code is wrong. Fix the code, not the spec.

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

When Claude Code operates in this repo, it follows the GSD pattern.

### Feature GSD (building new capabilities)

1. **Spec** — Understand the requirement, reference architecture truth
2. **Plan** — Break into atomic tasks, identify files to create/modify
3. **Implement** — Write failing test → implement → green → refactor
4. **Test** — Verify all tests pass, typecheck clean
5. **Check** — Run `npm run check` — all checks must pass (see Quality Gate below)
6. **Commit** — Atomic commit with conventional prefix

Every task should be completable in a single GSD cycle. If it's too big, split it.

### Refactor GSD (improving existing structure)

Triggered by: `npm run check` failures, ratchet tightening, or explicit cleanup tasks.

1. **Diagnose** — Run `npm run check`, identify the specific violation(s)
2. **Scope** — Define the refactoring boundary. One concern per cycle:
   - File too long → extract module
   - Function too complex → decompose
   - Directory over limit → reorganize into focused subdirectories
   - Duplicate code → extract shared utility
   - Circular dependency → invert or introduce interface
   - Unused exports → delete dead code
3. **Verify pre-state** — Run existing tests. They must pass BEFORE refactoring begins. If tests don't exist for the code being refactored, write characterization tests first (separate commit).
4. **Refactor** — Change structure only, not behavior. No new features. No bug fixes. Pure restructuring.
5. **Verify post-state** — All existing tests still pass. `npm run check` passes. The violation that triggered this cycle is resolved.
6. **Commit** — `refactor:` prefix. Message names the structural change, not a feature.

**Key rules for Refactor GSD:**
- Never mix refactoring with feature work in the same commit
- If a refactoring reveals a bug, note it and fix it in a separate Feature GSD cycle
- If a file split requires updating imports across many files, that's ONE refactor commit (the split), not spread across multiple
- Characterization tests ("tests that describe current behavior, even if imperfect") are acceptable as a pre-refactoring safety net

### Analysis GSD (understanding before acting)

Triggered by: starting a new phase, onboarding to unfamiliar code, or planning a large refactoring.

1. **Survey** — Run `npm run check` for structural health. Run `depcruise --output-type dot src | dot -T svg > dependency-graph.svg` for visual dependency map.
2. **Identify** — List specific structural problems with locations and severity:
   - Which files exceed length limits?
   - Which functions exceed complexity limits?
   - Where are circular dependencies?
   - What's the duplication percentage?
   - Which directories are over their file count limits?
3. **Prioritize** — Rank by impact on the next planned feature work. Refactoring that unblocks Phase 35 implementation comes first. Cosmetic cleanup comes last.
4. **Plan** — Break into individual Refactor GSD cycles, each independently committable.
5. **Document** — Write findings as a checklist in a GitHub issue or spec file. Each item becomes a Refactor GSD cycle.

**When to run Analysis GSD:**
- Before starting any new implementation phase
- When `npm run check` starts failing on pre-existing code
- When you've been away from the codebase for >1 week
- After a major merge or dependency update

### Cleanup GSD (systematic lint/error elimination)

Triggered by: ESLint error count > 0, warning budget exceeded, or pre-handoff to Claude Code for batch fixes.

1. **Scan** — Run `npm run check`, capture baseline counts (errors, warnings, by rule)
2. **Categorize** — Group violations by rule, estimate effort per category:
   - **Surgical** (1-2 min each): `prefer-const`, `no-useless-escape`, `no-case-declarations`
   - **Mechanical** (2-5 min each): `max-len` line wrapping, `no-empty-object-type`
   - **Structural** (5-15 min each): `complexity`, `max-lines`, `no-explicit-any` (needs real types)
3. **Execute** — Fix by category in priority order (surgical → mechanical → structural). Run `npm run check:types` after each batch to prevent regressions.
4. **Verify** — Full `npm run check` passes. Error count = 0. Warning count ≤ budget.
5. **Commit** — One commit per rule category: `fix(lint): resolve {rule} errors ({count})`

**Rules for Cleanup GSD:**
- Fix only the targeted rule category per batch — no drive-by refactors
- Never change behavior, only fix lint violations
- If a lint fix requires understanding business logic, skip it and note for Refactor GSD
- Ideal for Claude Code handoff — provide the scan results and let CC execute mechanically

### Claude Code Handoff Template

When handing batch cleanup work to Claude Code, provide this structure:

```
Run `npm run check:lint` and systematically fix all {rule} violations.

Files affected: {list or "see output"}
Current count: {N} errors / {N} warnings for this rule
Fix pattern: {description of the mechanical fix}

Rules:
- Run `npm run check:types` after each batch to ensure no regressions
- Do NOT change warning-level rules unless explicitly told to
- Do NOT refactor or change behavior — lint fixes only
- Commit after each category: "fix(lint): resolve {rule} errors ({count})"
```

### Choosing the Right GSD Variant

| Signal | GSD Type | Commit Prefix |
|--------|----------|---------------|
| New user-facing capability | Feature | `feat:` |
| `npm run check` failure in code you wrote | Feature (fix before committing) | `feat:` |
| `npm run check` failure in pre-existing code | Refactor | `refactor:` |
| Ratchet tightening (lowering thresholds) | Refactor | `refactor:` |
| "I don't understand this code" | Analysis | (no commit — produces plan) |
| Bug discovered during refactoring | Feature (separate cycle) | `fix:` |
| Starting a new phase | Analysis → Refactor(s) → Feature(s) | mixed |
| ESLint errors > 0 or warnings > budget | Cleanup | `fix(lint):` |
| Batch mechanical fixes (CC handoff) | Cleanup | `fix(lint):` |

---

## Quality Gate (MANDATORY)

Before marking ANY task as complete, run:

```bash
npm run check
```

This runs the full static analysis ratchet: typecheck → lint (with complexity/length limits) → unused export detection → duplication detection → module boundary enforcement → directory health.

All checks must pass. The lint warning budget is currently **700** (ratchet down as cleanup progresses). If a check fails:
1. Fix the violation in code you wrote during this task
2. If the violation is in pre-existing code you didn't touch, note it but don't fix it (avoid scope creep)
3. Re-run `npm run check` until clean

For rapid iteration during development, use `npm run check:quick` (types + lint only). Full `check` before commit.

Never commit with `--no-verify`. The pre-commit hook exists as a safety net.

### Structural Limits

| Rule | Threshold | Rationale |
|------|-----------|----------|
| Max file length | 300 lines (warn), 500 (error) | Files you can read in <60s |
| Cyclomatic complexity | 15 (warn), 25 (error) | Functions that fit in your head |
| Cognitive complexity | 20 (warn), 30 (error) | Readability, not just branches |
| Max line length | 120 chars | No horizontal scrolling |
| Max function params | 4 (warn) | Use options object instead |
| Max nesting depth | 4 (warn) | Extract early returns |

---

## GSD Automation Module

The `tools/gsd/` directory contains a fully autonomous build → test → fix cycle for Claude Code.

### Quick Start

```bash
# Full GSD cycle (build + test + auto-fix)
npm run gsd

# With task description
npm run gsd "implement SuperStack headers"

# Build only (quick type check)
npm run gsd:build

# Test only (skip build)
npm run gsd:test
```

### What It Does

1. **BUILD** — TypeScript compilation + Vite build, parses errors
2. **LAUNCH** — Dev server (if needed for E2E)
3. **VERIFY** — Vitest JSON output + DOM snapshots + hash comparison
4. **FIX** — Applies auto-fix patterns (missing imports, semicolons, etc.)
5. **RETRY** — Up to 3 attempts with fixes applied between cycles

### Token-Efficient Design

The GSD module is designed for Claude Code's token constraints:

| Output Type | Tokens (approx) | Strategy |
|-------------|-----------------|----------|
| Build errors | 50-200 per error | Limit to 5 errors |
| Test failures | 100-300 per failure | Limit to 3 failures |
| DOM snapshots | 200-500 | Text structure only |
| Visual regression | 32 chars | MD5 hash comparison |
| Full result JSON | 200-400 | Structured summary |

**vs Playwright screenshots:** 50-80% token reduction per debug cycle.

### Auto-Fix Patterns

The fixer module includes Isometry-specific patterns:

| Pattern | Trigger | Fix |
|---------|---------|-----|
| `missing-d3-import` | Cannot find name 'd3' | Prepend `import * as d3 from 'd3'` |
| `missing-vitest-import` | Cannot find name 'describe' | Prepend vitest imports |
| `missing-superstack-types` | Cannot find 'HeaderNode' | Prepend type imports |
| `missing-latch-type` | Cannot find 'LATCHAxis' | Prepend LATCH imports |
| `missing-react-hooks` | Cannot find 'useState' | Prepend React hook imports |
| `unused-variable` | TS6133 declared but never used | Prefix with `_` |

### DOM Snapshots (No Screenshots)

Instead of Playwright screenshots, use text-based DOM verification:

```bash
# Snapshots live here
tests/gsd/snapshots/
  superstack-headers.html      # Input HTML
  superstack-headers.expected.txt  # Expected DOM structure
```

DOM structure is extracted as text:
```
body
  div#superstack-container
    svg.superstack-headers
      g.header-group.row-headers
        g.header-node.depth-0
          rect.header-bg
          text.header-label
```

### Visual Regression via Hashing

SVG outputs are compared via perceptual hash:

```bash
# Hash files live here
tests/gsd/hashes/
  graph-layout.svg   # SVG output
  graph-layout.hash  # MD5 hash (32 chars)
```

Clause Code sees a 32-char hash, not megabytes of image data.

### State & History

```bash
.gsd/
  state.json       # Current run state (consecutive failures, last build)
  history.jsonl    # Run history for pattern learning
```

### Output Format

GSD outputs structured JSON for Claude Code:

```json
{
  "status": "success",
  "attempts": 1,
  "timestamp": "2026-02-15T10:30:00Z",
  "data": {
    "passed": 47,
    "total": 47,
    "duration": 5432
  },
  "summary": "✅ GSD Complete: 47/47 tests passed in 5432ms"
}
```

### When to Use GSD

| Scenario | Command |
|----------|--------|
| Starting implementation | `npm run gsd "implement X"` |
| Quick type check | `npm run gsd:build` |
| Verify tests pass | `npm run gsd:test` |
| Full cycle before commit | `npm run gsd` |
| Debug build failure | Check `.gsd/history.jsonl` for patterns |

### Files

```
tools/gsd/
  cli.ts        # Entry point
  runner.ts     # Orchestrator
  builder.ts    # TypeScript + Vite build
  launcher.ts   # Dev server management
  monitor.ts    # Console capture
  verifier.ts   # Vitest + DOM + hash verification
  fixer.ts      # Auto-fix patterns
  parser.ts     # Error parsing
  config.ts     # Types and defaults
```

---

*Last updated: 2026-02-15*
*Architecture: Bridge Elimination — sql.js direct access*
*Keystone: SuperGrid polymorphic data projection*
*Status: Phase 1 Stabilization*
