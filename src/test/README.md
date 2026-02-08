# Isometry v4 Testing Infrastructure

Comprehensive testing infrastructure for sql.js-based development, supporting the TDD workflow required for Phase 2 SuperGrid implementation.

## Overview

This testing infrastructure provides:

- ✅ **Mock-based testing** for isolated component testing
- ⚠️ **Real sql.js testing** (requires WASM setup) for integration testing
- ✅ **Test fixtures** for LPG (Labeled Property Graph) data
- ✅ **TDD patterns** for SuperGrid development
- ✅ **Performance testing** utilities

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Vitest Configuration | ✅ Complete | Optimized for sql.js and WASM |
| Test Database Utils | ✅ Complete | Database initialization and cleanup |
| Test Fixtures | ✅ Complete | LPG data for comprehensive testing |
| Mocking Infrastructure | ✅ Complete | SQLiteProvider mocks and patterns |
| TDD Examples | ✅ Complete | Example tests demonstrating patterns |
| WASM Loading | ⚠️ Needs Setup | Requires public/wasm/ directory |

## Quick Start

### Running Mock-Based Tests (Available Now)

```bash
# Run all mock-based tests (no WASM required)
npm run test -- --testNamePattern="Mocked Component Testing"

# Run specific TDD pattern examples
npm run test -- src/test/examples/tdd-patterns.test.ts --testNamePattern="Mock"
```

### Setting Up Real sql.js Testing

1. **Copy WASM files to public directory:**
   ```bash
   mkdir -p public/wasm
   cp node_modules/sql.js-fts5/dist/sql-wasm.wasm public/wasm/
   cp node_modules/sql.js-fts5/dist/sql-wasm-fts5.wasm public/wasm/
   ```

2. **Run real sql.js tests:**
   ```bash
   npm run test -- src/test/examples/tdd-patterns.test.ts
   npm run test -- src/db/__tests__/sql-capabilities.test.ts
   ```

## File Structure

```
src/test/
├── README.md                 # This guide
├── setup.ts                  # Global test setup (mocks, utilities)
├── sqljs-setup.ts            # sql.js WASM initialization
├── db-utils.ts               # Database test utilities
├── fixtures.ts               # Test data fixtures
├── mocks.ts                  # Mocking patterns for SQLiteProvider
└── examples/
    ├── tdd-patterns.test.ts      # Basic TDD patterns
    └── supergrid-tdd.test.ts     # SuperGrid-specific TDD patterns
```

## Available Test Utilities

### Database Testing

```typescript
import { createTestDB, cleanupTestDB, execTestQuery } from '../test/db-utils';

// Create test database with sample data
const db = await createTestDB({ loadSampleData: true });

// Execute queries with convenient result format
const results = execTestQuery(db, 'SELECT * FROM nodes WHERE folder = ?', ['work']);

// Clean up
await cleanupTestDB(db);
```

### Mocked Testing

```typescript
import { createMockSQLiteContext, TEST_PATTERNS } from '../test/mocks';

// Create mock context for component testing
const mockContext = createMockSQLiteContext({
  withRealDatabase: false,
  initialData: true
});

// Use predefined test patterns
const loadingContext = TEST_PATTERNS.LOADING_DB();
const errorContext = TEST_PATTERNS.ERROR_DB(new Error('Test error'));
```

### Test Fixtures

```typescript
import { loadTestFixtures, TEST_SCENARIOS } from '../test/fixtures';

// Load comprehensive test fixtures
await loadTestFixtures(db, {
  nodes: true,
  edges: true,
  facets: true,
  notebookCards: true
});

// Load specific test scenarios
await loadTestScenario(db, 'SUPERGRID_BASIC');
await loadTestScenario(db, 'PERFORMANCE_LARGE', { nodeCount: 1000 });
```

## TDD Workflow

### 1. Write Failing Test First

```typescript
test('should filter nodes by LATCH Category dimension', async () => {
  // Arrange: Set up test database
  const db = await createTestDB();

  // Act: Execute LATCH filtering query
  const workNodes = execTestQuery(db,
    'SELECT * FROM nodes WHERE folder = ? AND deleted_at IS NULL',
    ['work']
  );

  // Assert: Results match expected structure
  expect(workNodes.length).toBeGreaterThan(0);
  workNodes.forEach(node => {
    expect(node.folder).toBe('work');
  });

  await cleanupTestDB(db);
});
```

### 2. Implement to Make Test Pass

```typescript
// Implement the actual filtering logic in SuperGrid
export function filterNodesByCategory(nodes: LPGNode[], category: string): LPGNode[] {
  return nodes.filter(node =>
    node.folder === category &&
    node.deleted_at === null
  );
}
```

### 3. Refactor While Green

```typescript
// Refactor to support all LATCH dimensions
export function filterNodesByLATCH(
  nodes: LPGNode[],
  filters: LATCHFilters
): LPGNode[] {
  return nodes.filter(node => {
    // Category filtering
    if (filters.category && node.folder !== filters.category) return false;

    // Time filtering
    if (filters.timeRange) {
      const nodeDate = new Date(node.created_at);
      if (nodeDate < filters.timeRange.start || nodeDate > filters.timeRange.end) {
        return false;
      }
    }

    // Hierarchy filtering
    if (filters.priority && node.priority < filters.priority) return false;

    return node.deleted_at === null;
  });
}
```

## Test Patterns

### Basic Database Operations

```typescript
describe('Database Operations', () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDB({ loadSampleData: true });
  });

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  test('should execute synchronous queries', () => {
    const results = execTestQuery(db, 'SELECT COUNT(*) as count FROM nodes');
    expect(results[0].count).toBeGreaterThan(0);
  });
});
```

### PAFV Projection Testing

```typescript
test('should map LATCH dimensions to PAFV axes', () => {
  const projection = { x: 'C', y: 'H' }; // Category × Hierarchy

  const gridData = execTestQuery(db, `
    SELECT folder, priority, COUNT(*) as count
    FROM nodes
    GROUP BY folder, priority
    ORDER BY folder, priority DESC
  `);

  expect(gridData.length).toBeGreaterThan(0);
  gridData.forEach(cell => {
    expect(cell.folder).toBeDefined();    // X-axis (Category)
    expect(cell.priority).toBeGreaterThan(0); // Y-axis (Hierarchy)
  });
});
```

### Graph Traversal Testing

```typescript
test('should perform recursive graph traversal', () => {
  const traversal = execTestQuery(db, `
    WITH RECURSIVE reachable(id, depth) AS (
      SELECT 'start-node', 0
      UNION ALL
      SELECT e.target_id, r.depth + 1
      FROM reachable r
      JOIN edges e ON e.source_id = r.id
      WHERE r.depth < 3
    )
    SELECT * FROM reachable
  `);

  expect(traversal.length).toBeGreaterThan(1);
  expect(traversal.some(node => node.depth > 0)).toBe(true);
});
```

### Mocked Component Testing

```typescript
test('should handle SQLiteProvider errors gracefully', () => {
  const errorContext = createMockSQLiteContext({
    simulateError: new Error('Database connection failed')
  });

  expect(() => {
    errorContext.execute('SELECT * FROM nodes');
  }).toThrow('Database connection failed');
});
```

## Performance Testing

```typescript
test('should execute queries efficiently', async () => {
  const db = await createTestDB();
  await loadTestScenario(db, 'PERFORMANCE_LARGE', { nodeCount: 1000 });

  const startTime = performance.now();

  for (let i = 0; i < 100; i++) {
    execTestQuery(db, 'SELECT * FROM nodes WHERE folder = ? LIMIT 10', ['work']);
  }

  const avgTime = (performance.now() - startTime) / 100;
  expect(avgTime).toBeLessThan(5); // < 5ms per query

  await cleanupTestDB(db);
});
```

## Available Test Scenarios

| Scenario | Description | Use Case |
|----------|-------------|----------|
| `SUPERGRID_BASIC` | Basic SuperGrid with work/personal folders | Grid projection testing |
| `LATCH_TIME_RANGE` | Time-based filtering scenarios | Time axis testing |
| `GRAPH_COMPLEX` | Complex graph with all edge types | Graph traversal testing |
| `PERFORMANCE_LARGE` | Large dataset (configurable size) | Performance testing |

## Running Tests

### Development Workflow

```bash
# Watch mode for TDD
npm run test -- --watch src/test/examples/

# Run specific test suites
npm run test -- --testNamePattern="LATCH"
npm run test -- --testNamePattern="SuperGrid"

# Coverage reports
npm run test:coverage
```

### CI/CD Integration

```bash
# Run all tests with coverage
npm run test:run --coverage

# Type checking
npm run check:types

# Full quality gate
npm run check
```

## Troubleshooting

### sql.js WASM Loading Issues

If you see errors like `"Cannot read properties of undefined (reading 'buffer')"`:

1. **Verify WASM files exist:**
   ```bash
   ls -la public/wasm/
   # Should show sql-wasm.wasm and sql-wasm-fts5.wasm
   ```

2. **Use mock-based tests during development:**
   ```bash
   npm run test -- --testNamePattern="Mock"
   ```

3. **Check console for detailed error messages** in test output

### Test Timeouts

If tests timeout waiting for database initialization:

1. **Increase test timeout** in specific tests:
   ```typescript
   test('slow test', async () => {
     // test implementation
   }, 30000); // 30 second timeout
   ```

2. **Use mocks for faster tests:**
   ```typescript
   const mockContext = createMockSQLiteContext({ withRealDatabase: false });
   ```

### Memory Issues

For tests that create many databases:

1. **Always clean up in afterEach:**
   ```typescript
   afterEach(async () => {
     await cleanupTestDB(db);
   });
   ```

2. **Use global cleanup:**
   ```typescript
   import { globalTestCleanup } from '../test/db-utils';

   afterAll(async () => {
     await globalTestCleanup();
   });
   ```

## Next Steps for Phase 2

1. **Set up WASM files** in public directory for full sql.js testing
2. **Verify FTS5 and recursive CTE capabilities** with real database
3. **Implement SuperGrid core classes** using TDD patterns shown in examples
4. **Add performance benchmarks** for grid rendering and data queries
5. **Create integration tests** for complete PAFV projection workflows

## Architecture Compliance

This testing infrastructure supports all CLAUDE.md requirements:

- ✅ **TDD workflow**: Write failing test → implement → green → refactor
- ✅ **sql.js direct access**: Synchronous queries, no bridge overhead
- ✅ **LATCH/GRAPH testing**: Comprehensive filtering and traversal patterns
- ✅ **D3.js preparation**: Data structures ready for D3 enter/update/exit
- ✅ **Performance focus**: Query optimization and efficiency testing
- ✅ **Zero tolerance**: All tests must pass before committing