# Isometry - Claude Code Context

## Quick Start
```bash
npm install
npm run dev
```

## Architecture
- **PAFV**: Planes → Axes → Facets → Values (spatial projection)
- **LATCH**: Location, Alphabet, Time, Category, Hierarchy (filtering)
- **GRAPH**: Links, Nesting, Sequence (connections)

## Tech Stack
- React 18 + TypeScript
- D3.js for visualization
- sql.js (SQLite in browser)
- Tailwind CSS
- Vite

## Key Files
- `src/types/` - All TypeScript interfaces
- `src/db/` - SQLite schema, init, context
- `src/hooks/` - useSQLiteQuery, useD3, etc.
- `src/state/` - FilterContext, PAFVContext, SelectionContext
- `src/views/` - GridView, ListView, ViewRenderer interface
- `src/filters/` - Filter compiler (LATCH → SQL)
- `docs/` - Architecture docs, gap analysis

## Current Phase
Phase 1: Data Pipeline (MVP)
- [x] SQLite schema
- [x] Type definitions
- [x] Database initialization
- [x] Sample data
- [x] Provider hierarchy
- [ ] Canvas D3 rendering
- [ ] View switching

## Important Docs
1. `docs/cardboard-architecture-truth.md` - Core concepts
2. `docs/ISOMETRY-MVP-GAP-ANALYSIS.md` - Full roadmap
3. `docs/INTEGRATION-CONTRACT.md` - How pieces connect
4. `design/isometry-ui-handoff/FIGMA-HANDOFF.md` - UI integration

## Coding Patterns
- Use `useSQLiteQuery` for data fetching
- Use `useD3` for D3 container management
- Use contexts for shared state
- Views implement `ViewRenderer` interface
- Filter changes trigger query recompilation

## Theme System
Two themes: NeXTSTEP (retro) and Modern (glass)
Toggle via ThemeContext, CSS variables in index.css
