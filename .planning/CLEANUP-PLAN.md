# Codebase Cleanup Plan

Generated: 2026-02-10
Analysis Session: Phase 51 completion context

## Summary

| Category | Count | Priority | Owner |
|----------|-------|----------|-------|
| TypeScript errors | ~1,254 | P0 | Phase 52-55 |
| ESLint errors | 2 | P0 | This session |
| ESLint warnings | 637 | P1 | Ongoing |
| Files >300 lines | 115 | P2 | Refactor cycle |
| High complexity | 20+ | P2 | Refactor cycle |
| Hard-coded values | 10+ | P1 | This session |
| TODO/FIXME | 58 | P3 | Tech debt |

## P0: Critical (Fix Now)

### ESLint Errors (2)

```
src/utils/performance/performance-benchmarks.ts:432
  - TS18004: No value exists in scope for shorthand property 'errorCount'

src/utils/webview/connection-manager.ts:36
  - TS2420: Class incorrectly implements interface (return type mismatch)
```

### Action: Fix these 2 errors before any other work.

## P1: Hard-coded Values to Extract

### URLs/Ports (create `src/config/endpoints.ts`)

| File | Line | Current Value | Proposed Constant |
|------|------|---------------|-------------------|
| src/contexts/EnvironmentContext.tsx | 243 | `http://localhost:8080` | `API_BASE_URL` |
| src/config/environment.ts | 79 | `http://localhost:3000` | `DEV_API_URL` |
| src/hooks/database/useOptimizedQueries.ts | 109,232,362 | `http://localhost:8080` | `API_BASE_URL` |
| src/db/PerformanceMonitor.ts | 371 | `http://localhost:8080` | `API_BASE_URL` |
| src/services/claude-code/claudeCodeWebSocketDispatcher.ts | 80,655 | `ws://localhost:8080` | `WS_BASE_URL` |

### Magic Numbers (create `src/config/constants.ts`)

| File | Line | Value | Proposed Constant |
|------|------|-------|-------------------|
| src/types/shell.ts | 66 | 1000 | `MAX_HISTORY_ENTRIES` (exists) |
| src/types/shell.ts | 68 | 300 | `HISTORY_SEARCH_DEBOUNCE` (exists) |
| src/utils/database/query-builder.ts | 95 | 1000 | `DEFAULT_MAX_ROWS` |
| src/utils/database/query-builder.ts | 401 | 300000 | `CACHE_TTL_MS` |
| src/utils/commandParsing.ts | 100 | 2000 | `MAX_COMMAND_LENGTH` |
| src/d3-render-optimizer.ts | 295 | 100 | `MAX_POOL_SIZE` |

## P2: Refactoring Opportunities

### Files >300 Lines (Top 20 by Size)

| File | Lines | Action |
|------|-------|--------|
| src/utils/security/security-validator.ts | 552 | Split validation by domain |
| src/utils/d3-visualization/d3Performance.ts | ~490 | Extract metrics/monitoring |
| src/utils/performance/rendering-performance.ts | 473 | Extract render modes |
| src/utils/filter-serialization.ts | 459 | Split by format type |
| src/utils/import-export/exportUtils.ts | 448 | Split by export format |
| src/utils/d3-visualization/d3Parsers.ts | 436 | Split parser types |
| src/utils/d3-visualization/d3Testing.ts | 427 | Extract test utilities |
| src/utils/d3-visualization/d3Scales.ts | 411 | Split scale types |
| src/utils/performance/performance-monitor.ts | 397 | Extract collectors |
| src/utils/import-export/office/WordProcessor.ts | 356 | Split read/write |

### High Complexity Functions (Cyclomatic >15)

| File | Function | Complexity | Action |
|------|----------|------------|--------|
| src/components/SuperGridSQLDemo.tsx | SuperGridSQLDemo | 61 | Decompose into hooks |
| src/utils/filter-serialization.ts | createOptimizedBridgeFormat | 56 | Extract format handlers |
| src/components/D3Visualization/Visualization.tsx | Arrow function | 29 | Extract into named functions |
| src/components/SuperGridDemo/SuperDensityDemo.tsx | SuperDensityDemo | 28 | Split into components |
| src/components/SuperGridView.tsx | SuperGridView | 27 | Extract render logic |
| src/components/D3Visualization/Visualization.tsx | Arrow function | 26 | Extract handlers |

## P3: Technical Debt (TODO/FIXME)

### By Category

| Category | Count | Priority |
|----------|-------|----------|
| Missing implementations | 23 | Medium |
| Future integrations | 15 | Low |
| Type improvements | 8 | Phase 52 |
| Error handling | 7 | Medium |
| Performance | 5 | Low |

### Notable TODOs

```
src/components/Navigator.tsx:21
  // TODO: Replace with SQLite queries

src/components/D3Canvas.tsx:290
  // TODO: Implement full hierarchical header rendering in next phase

src/components/D3Canvas.tsx:441
  // TODO: Replace with sql.js direct access patterns
```

## Execution Order

### Session 1: P0 Critical Fixes
1. Fix 2 ESLint errors
2. Run `npm run check:lint` to verify

### Session 2: P1 Configuration Extraction
1. Create `src/config/endpoints.ts` with URL constants
2. Create `src/config/constants.ts` with magic numbers
3. Update imports across affected files
4. Run `npm run check` to verify

### Session 3+: P2 Refactoring (Future)
- One file per session
- Extract, test, commit pattern
- Maintain <300 line limit

## Quality Gates

After each session:
```bash
npm run check:types   # Must pass (or improve error count)
npm run check:lint    # Errors must be 0, warnings ≤ budget
npm run test:run      # All tests pass
```

## Notes

- TypeScript errors are being addressed in Phase 52-55
- This cleanup plan focuses on code quality beyond type errors
- Each P1/P2 item should be a separate GSD cycle with test → fix → commit
