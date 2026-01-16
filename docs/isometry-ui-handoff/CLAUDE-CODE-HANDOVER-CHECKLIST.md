# Claude Code Handover Checklist

*What Claude Code needs to effectively implement Isometry MVP*

---

## Checklist Status

### ✅ Complete

| Item | Location | Purpose |
|------|----------|---------|
| CLAUDE.md | `/CLAUDE.md` | Project context, auto-read on startup |
| Architecture Truth | `/docs/cardboard-architecture-truth.md` | PAFV/LATCH/GRAPH concepts |
| D3 Skill | `/docs/D3JS-SKILL.md` | D3 patterns and best practices |
| Figma Handoff | `/design/isometry-ui-handoff/FIGMA-HANDOFF.md` | UI integration guide |
| UI Components | `/design/isometry-ui-handoff/components/` | 9 TSX component shells |
| DSL Grammar | `/src/dsl/grammar/IsometryDSL.pegjs` | Query language spec |
| DSL Types | `/src/dsl/types.ts` | TypeScript interfaces |
| DSL Stubs | `/src/dsl/*.ts` | Parser, compiler, autocomplete |
| Gap Analysis | `/docs/ISOMETRY-MVP-GAP-ANALYSIS.md` | Roadmap and scope |
| Theme Context | `/src/contexts/ThemeContext.tsx` | Dual theme system |
| useSQLiteQuery stub | `/src/hooks/useSQLiteQuery.ts` | Data fetching pattern |
| UI primitives | `/src/components/ui/` | Skeleton, EmptyState, ErrorBoundary |

### 🔴 Missing (Critical)

| Item | Why It's Needed | Priority |
|------|-----------------|----------|
| **SQLite Schema** | Can't build data layer without it | P0 |
| **Type Definitions** | No Card, Node, Edge types | P0 |
| **Sample Data** | Need data to test with | P0 |
| **Package dependencies** | sql.js, d3 not installed | P0 |
| **View interfaces** | No ViewRenderer contract | P1 |
| **Filter types** | No FilterState definition | P1 |

### 🟡 Missing (Helpful)

| Item | Why It's Needed | Priority |
|------|-----------------|----------|
| Test setup | Vitest config, example tests | P2 |
| ESLint/Prettier config | Code consistency | P2 |
| Git hooks | Pre-commit checks | P3 |
| VS Code tasks | Common commands | P3 |

---

## Files to Create Before Handover

The following files should exist (even as stubs) so Claude Code knows the expected structure:

```
src/
├── types/
│   ├── index.ts           # Re-exports all types
│   ├── card.ts            # Card, Node, Edge types
│   ├── filter.ts          # FilterState, filter types
│   ├── view.ts            # ViewState, ViewRenderer
│   └── pafv.ts            # PAFVState, Facet, Axis
│
├── db/
│   ├── schema.sql         # DDL statements
│   ├── init.ts            # sql.js initialization
│   ├── queries.ts         # Named query constants
│   ├── sample-data.ts     # Test data
│   └── DatabaseContext.tsx # React context
│
├── hooks/
│   ├── useSQLiteQuery.ts  # ✅ Exists (stub)
│   ├── useD3.ts           # D3 container management
│   ├── useFilters.ts      # Filter state hook
│   ├── usePAFV.ts         # PAFV state hook
│   └── useURLState.ts     # URL sync hook
│
├── views/
│   ├── types.ts           # ViewRenderer interface
│   ├── GridView.ts        # Grid layout
│   ├── ListView.ts        # List layout
│   └── index.ts           # View registry
│
├── filters/
│   ├── types.ts           # Filter type definitions
│   ├── compiler.ts        # Filter → SQL
│   ├── CategoryFilter.tsx # Category UI
│   ├── TimeFilter.tsx     # Time UI
│   └── index.ts           # Filter registry
│
├── state/
│   ├── FilterContext.tsx  # Filter state provider
│   ├── PAFVContext.tsx    # PAFV state provider
│   └── SelectionContext.tsx # Selection state
│
└── components/
    ├── Canvas.tsx         # ✅ Exists (needs D3)
    ├── Card.tsx           # ✅ Exists (template)
    └── ... (other Figma components)
```

---

## Critical Missing Files

### 1. SQLite Schema (`src/db/schema.sql`)

```sql
-- See separate file: add-sqlite-schema.sh
```

### 2. Core Type Definitions (`src/types/`)

```typescript
// See separate file: add-core-types.sh
```

### 3. Sample Data (`src/db/sample-data.ts`)

```typescript
// See separate file: add-sample-data.sh
```

---

## Handover Prompt for Claude Code

Once all files are in place, start Claude Code with this prompt:

```
Read CLAUDE.md, then read docs/ISOMETRY-MVP-GAP-ANALYSIS.md.

We're starting Phase 1: Data Pipeline. The first task is P1.2 (sql.js initialization) 
since P1.1 (schema) is already done.

Please:
1. Implement src/db/init.ts to initialize sql.js
2. Create src/db/DatabaseContext.tsx to provide the database to React
3. Update src/App.tsx to wrap with DatabaseProvider
4. Verify by logging a test query result

The schema is in src/db/schema.sql and sample data in src/db/sample-data.ts.
```

---

## Environment Verification

Before handing over, verify:

```bash
cd ~/Developer/Projects/Isometry

# Dependencies installed?
npm install

# Dev server runs?
npm run dev

# TypeScript compiles?
npx tsc --noEmit

# All expected files exist?
ls -la src/db/
ls -la src/types/
ls -la src/hooks/
```

---

## Summary: What's Left to Create

| Script | Creates | Run Order |
|--------|---------|-----------|
| `add-sqlite-schema.sh` | Schema + init stubs | 1 |
| `add-core-types.sh` | All TypeScript types | 2 |
| `add-sample-data.sh` | 100 sample notes | 3 |
| `add-view-stubs.sh` | View interfaces + stubs | 4 |
| `add-filter-stubs.sh` | Filter types + stubs | 5 |

After running these, Claude Code has everything needed to start Phase 1.
