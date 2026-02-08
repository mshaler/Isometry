/**
 * TDD Pattern Examples for Isometry v4
 *
 * Demonstrates comprehensive testing patterns for the sql.js-based
 * testing infrastructure, following CLAUDE.md TDD requirements.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Database } from 'sql.js-fts5';
import {
  createTestDB,
  cleanupTestDB,
  execTestQuery,
  insertTestData,
  TestDatabaseManager,
} from '../db-utils';
import { loadTestFixtures, TEST_SCENARIOS, loadTestScenario } from '../fixtures';
import {
  createMockSQLiteContext,
  mockUseSQLite,
  expectSQLQuery,
  TEST_PATTERNS,
  type MockSQLiteContextValue,
} from '../mocks';

/**
 * Example 1: Basic TDD Pattern with sql.js
 *
 * Pattern: Red -> Green -> Refactor
 * Shows: Database setup, query testing, cleanup
 */
describe('TDD Example 1: Basic Database Operations', () => {
  let db: Database;

  beforeEach(async () => {
    // Arrange: Create fresh test database
    db = await createTestDB({ loadSampleData: true });
  });

  afterEach(async () => {
    // Cleanup: Always clean up test resources
    await cleanupTestDB(db);
  });

  test('should count nodes in test database', () => {
    // Act: Execute query synchronously (CLAUDE.md requirement)
    const results = execTestQuery(db, 'SELECT COUNT(*) as count FROM nodes');

    // Assert: Verify results
    expect(results).toHaveLength(1);
    expect(results[0].count).toBeGreaterThan(0);
  });

  test('should filter nodes by folder', () => {
    // Arrange: Known test data structure
    const expectedFolder = 'work';

    // Act: Query with parameters
    const results = execTestQuery(db,
      'SELECT * FROM nodes WHERE folder = ? AND deleted_at IS NULL',
      [expectedFolder]
    );

    // Assert: All results match filter
    expect(results.length).toBeGreaterThan(0);
    results.forEach(node => {
      expect(node.folder).toBe(expectedFolder);
      expect(node.deleted_at).toBeNull();
    });
  });

  test('should insert and retrieve new node', () => {
    // Arrange: Test data
    const testNode = {
      id: 'test-insert-node',
      name: 'Test Insert Node',
      content: 'Content for testing insertion',
      folder: 'test',
      status: 'active',
      priority: 3,
    };

    // Act: Insert new node
    const insertCount = insertTestData(db, `
      INSERT INTO nodes (id, name, content, folder, status, priority)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [testNode.id, testNode.name, testNode.content, testNode.folder, testNode.status, testNode.priority]);

    // Assert: Insert was successful
    expect(insertCount).toBe(1);

    // Act: Retrieve the inserted node
    const retrieved = execTestQuery(db, 'SELECT * FROM nodes WHERE id = ?', [testNode.id]);

    // Assert: Retrieved data matches inserted data
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].name).toBe(testNode.name);
    expect(retrieved[0].content).toBe(testNode.content);
    expect(retrieved[0].folder).toBe(testNode.folder);
  });
});

/**
 * Example 2: LATCH Filter Testing Pattern
 *
 * Pattern: Test each LATCH dimension separately
 * Shows: Category, Time, Hierarchy filtering
 */
describe('TDD Example 2: LATCH Filter Patterns', () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDB();
    await loadTestFixtures(db);
  });

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  describe('Category (C) filtering', () => {
    test('should filter by folder category', () => {
      // Act: Filter by work folder
      const workItems = execTestQuery(db,
        'SELECT * FROM nodes WHERE folder = ? ORDER BY priority DESC',
        ['work']
      );

      // Assert: All items are work-related
      expect(workItems.length).toBeGreaterThan(0);
      workItems.forEach(item => {
        expect(item.folder).toBe('work');
      });

      // Assert: Results are ordered by priority
      for (let i = 1; i < workItems.length; i++) {
        expect(workItems[i-1].priority).toBeGreaterThanOrEqual(workItems[i].priority);
      }
    });

    test('should filter by status category', () => {
      // Act: Filter by active status
      const activeItems = execTestQuery(db,
        'SELECT * FROM nodes WHERE status = ?',
        ['active']
      );

      // Assert: All items are active
      activeItems.forEach(item => {
        expect(item.status).toBe('active');
      });
    });
  });

  describe('Time (T) filtering', () => {
    test('should filter by creation date range', () => {
      // Arrange: Date range
      const startDate = '2024-01-15';
      const endDate = '2024-01-20';

      // Act: Filter by date range
      const recentItems = execTestQuery(db, `
        SELECT * FROM nodes
        WHERE created_at >= ? AND created_at <= ?
        ORDER BY created_at DESC
      `, [startDate, endDate]);

      // Assert: All items are in date range
      recentItems.forEach(item => {
        const itemDate = new Date(item.created_at as string);
        expect(itemDate).toBeGreaterThanOrEqual(new Date(startDate));
        expect(itemDate).toBeLessThanOrEqual(new Date(endDate));
      });
    });
  });

  describe('Hierarchy (H) filtering', () => {
    test('should filter by priority hierarchy', () => {
      // Act: Filter high priority items
      const highPriorityItems = execTestQuery(db,
        'SELECT * FROM nodes WHERE priority >= ? ORDER BY priority DESC, importance DESC',
        [4]
      );

      // Assert: All items have high priority
      highPriorityItems.forEach(item => {
        expect(item.priority).toBeGreaterThanOrEqual(4);
      });

      // Assert: Results are properly ordered
      for (let i = 1; i < highPriorityItems.length; i++) {
        const prev = highPriorityItems[i-1];
        const curr = highPriorityItems[i];

        if (prev.priority === curr.priority) {
          expect(prev.importance).toBeGreaterThanOrEqual(curr.importance);
        } else {
          expect(prev.priority).toBeGreaterThan(curr.priority);
        }
      }
    });
  });
});

/**
 * Example 3: GRAPH Traversal Testing Pattern
 *
 * Pattern: Test all edge types and traversal algorithms
 * Shows: Recursive CTE testing, graph relationship validation
 */
describe('TDD Example 3: GRAPH Traversal Patterns', () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDB();
    await loadTestScenario(db, 'GRAPH_COMPLEX');
  });

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  test('should find direct connections (LINK edges)', () => {
    // Act: Find all nodes linked from a specific node
    const sourceNode = 'fixture-node-1';
    const linkedNodes = execTestQuery(db, `
      SELECT n.*, e.edge_type, e.label, e.weight
      FROM edges e
      JOIN nodes n ON n.id = e.target_id
      WHERE e.source_id = ? AND e.edge_type = 'LINK'
      ORDER BY e.weight DESC
    `, [sourceNode]);

    // Assert: Found linked nodes with correct structure
    expect(linkedNodes.length).toBeGreaterThan(0);
    linkedNodes.forEach(node => {
      expect(node.edge_type).toBe('LINK');
      expect(node.label).toBeDefined();
      expect(node.weight).toBeGreaterThan(0);
    });
  });

  test('should traverse graph with recursive CTE', () => {
    // Arrange: Starting node for traversal
    const startNode = 'fixture-node-1';
    const maxDepth = 3;

    // Act: Perform graph traversal
    const traversalResults = execTestQuery(db, `
      WITH RECURSIVE reachable(id, name, path, depth, edge_type) AS (
        -- Base case: starting node
        SELECT id, name, name as path, 0 as depth, 'START' as edge_type
        FROM nodes
        WHERE id = ?

        UNION ALL

        -- Recursive case: follow edges
        SELECT n.id, n.name,
               r.path || ' -> ' || n.name as path,
               r.depth + 1 as depth,
               e.edge_type
        FROM reachable r
        JOIN edges e ON e.source_id = r.id
        JOIN nodes n ON n.id = e.target_id
        WHERE r.depth < ?
      )
      SELECT * FROM reachable ORDER BY depth, id
    `, [startNode, maxDepth]);

    // Assert: Traversal found multiple levels
    expect(traversalResults.length).toBeGreaterThan(1);

    // Assert: Depth progression is correct
    const depths = traversalResults.map(r => r.depth as number);
    expect(Math.max(...depths)).toBeGreaterThan(0);

    // Assert: Starting node is at depth 0
    const startingNodes = traversalResults.filter(r => r.depth === 0);
    expect(startingNodes).toHaveLength(1);
    expect(startingNodes[0].id).toBe(startNode);
  });

  test('should handle different edge types correctly', () => {
    // Act: Query each edge type separately
    const linkEdges = execTestQuery(db, 'SELECT * FROM edges WHERE edge_type = "LINK"');
    const nestEdges = execTestQuery(db, 'SELECT * FROM edges WHERE edge_type = "NEST"');
    const sequenceEdges = execTestQuery(db, 'SELECT * FROM edges WHERE edge_type = "SEQUENCE"');
    const affinityEdges = execTestQuery(db, 'SELECT * FROM edges WHERE edge_type = "AFFINITY"');

    // Assert: Each edge type has expected properties
    linkEdges.forEach(edge => {
      expect(edge.edge_type).toBe('LINK');
      expect(edge.directed).toBe(1); // LINK edges are typically directed
    });

    nestEdges.forEach(edge => {
      expect(edge.edge_type).toBe('NEST');
      expect(edge.weight).toBe(1.0); // NEST edges have full weight
    });

    sequenceEdges.forEach(edge => {
      expect(edge.edge_type).toBe('SEQUENCE');
      expect(edge.sequence_order).toBeDefined();
    });

    affinityEdges.forEach(edge => {
      expect(edge.edge_type).toBe('AFFINITY');
      expect(edge.directed).toBe(0); // AFFINITY edges are bidirectional
    });
  });
});

/**
 * Example 4: Mocked Testing Pattern
 *
 * Pattern: Use mocks for isolated component testing
 * Shows: SQLiteProvider mocking, React component testing
 */
describe('TDD Example 4: Mocked Component Testing', () => {
  let mockContext: MockSQLiteContextValue;

  beforeEach(() => {
    // Arrange: Create mock SQLite context
    mockContext = createMockSQLiteContext({
      withRealDatabase: false,
      initialData: true,
    });
  });

  test('should handle loading state correctly', () => {
    // Arrange: Mock loading state
    const loadingContext = TEST_PATTERNS.LOADING_DB();

    // Act & Assert: Verify loading state is handled
    expect(loadingContext.loading).toBe(true);
    expect(loadingContext.db).toBeNull();

    // Act: Try to execute query during loading
    expect(() => {
      loadingContext.execute('SELECT * FROM nodes');
    }).toThrow('Database is loading');
  });

  test('should handle error state correctly', () => {
    // Arrange: Mock error state
    const testError = new Error('Database connection failed');
    const errorContext = TEST_PATTERNS.ERROR_DB(testError);

    // Act & Assert: Verify error state is handled
    expect(errorContext.error).toBe(testError);
    expect(() => {
      errorContext.execute('SELECT * FROM nodes');
    }).toThrow(testError);
  });

  test('should track query execution for testing', () => {
    // Act: Execute several queries
    mockContext.execute('SELECT * FROM nodes WHERE folder = ?', ['work']);
    mockContext.execute('SELECT COUNT(*) FROM edges');
    mockContext.run('INSERT INTO nodes (id, name) VALUES (?, ?)', ['test-1', 'Test Node']);

    // Assert: Query history is tracked
    const queries = mockContext.__testUtils.getQueryHistory();
    expect(queries).toHaveLength(3);

    // Assert: Specific queries were executed
    expectSQLQuery(mockContext, 'SELECT * FROM nodes WHERE folder = ?', ['work']);
    expectSQLQuery(mockContext, 'SELECT COUNT(*) FROM edges');
    expectSQLQuery(mockContext, /INSERT INTO nodes/);
  });

  test('should support capability testing patterns', () => {
    // Arrange: Mock without FTS5 support
    const noFtsContext = TEST_PATTERNS.NO_FTS5_DB();

    // Assert: FTS5 capability is disabled
    expect(noFtsContext.capabilities.fts5).toBe(false);
    expect(noFtsContext.capabilities.json1).toBe(true);
    expect(noFtsContext.capabilities.recursiveCte).toBe(true);

    // Arrange: Mock without CTE support
    const noCteContext = TEST_PATTERNS.NO_CTE_DB();

    // Assert: CTE capability is disabled
    expect(noCteContext.capabilities.recursiveCte).toBe(false);
    expect(noCteContext.capabilities.fts5).toBe(true);
  });
});

/**
 * Example 5: Performance Testing Pattern
 *
 * Pattern: Test query performance and optimization
 * Shows: Benchmark testing, memory usage, query optimization
 */
describe('TDD Example 5: Performance Testing Patterns', () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDB();
    // Load large dataset for performance testing
    await loadTestScenario(db, 'PERFORMANCE_LARGE', { nodeCount: 1000 });
  });

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  test('should execute simple queries efficiently', () => {
    // Arrange: Measure execution time
    const startTime = performance.now();

    // Act: Execute query multiple times
    const iterations = 100;
    for (let i = 0; i < iterations; i++) {
      execTestQuery(db, 'SELECT COUNT(*) FROM nodes WHERE folder = ?', ['work']);
    }

    const endTime = performance.now();
    const avgTime = (endTime - startTime) / iterations;

    // Assert: Query performance is acceptable
    expect(avgTime).toBeLessThan(5); // Should average < 5ms per query
  });

  test('should handle large result sets efficiently', () => {
    // Act: Query large dataset
    const startTime = performance.now();
    const allNodes = execTestQuery(db, 'SELECT * FROM nodes ORDER BY created_at DESC');
    const endTime = performance.now();

    // Assert: Large query completes quickly
    expect(allNodes.length).toBe(1000); // Should return all 1000 nodes
    expect(endTime - startTime).toBeLessThan(50); // Should complete < 50ms

    // Assert: Results are properly ordered
    for (let i = 1; i < Math.min(allNodes.length, 10); i++) {
      const prevDate = new Date(allNodes[i-1].created_at as string);
      const currDate = new Date(allNodes[i].created_at as string);
      expect(prevDate).toBeGreaterThanOrEqual(currDate);
    }
  });

  test('should optimize complex queries with indexes', () => {
    // Act: Execute complex query that should use indexes
    const startTime = performance.now();
    const complexQuery = execTestQuery(db, `
      SELECT n1.*, COUNT(e.id) as connection_count
      FROM nodes n1
      LEFT JOIN edges e ON e.source_id = n1.id
      WHERE n1.folder = 'work'
        AND n1.priority >= 3
        AND n1.created_at >= date('now', '-30 days')
      GROUP BY n1.id
      HAVING connection_count > 0
      ORDER BY n1.priority DESC, connection_count DESC
      LIMIT 20
    `);
    const endTime = performance.now();

    // Assert: Complex query completes efficiently
    expect(endTime - startTime).toBeLessThan(20); // Should complete < 20ms
    expect(complexQuery.length).toBeLessThanOrEqual(20); // Should respect LIMIT
  });
});

/**
 * Example 6: FTS5 Full-Text Search Testing Pattern
 *
 * Pattern: Test full-text search capabilities
 * Shows: FTS5 queries, ranking, phrase matching
 */
describe('TDD Example 6: FTS5 Search Testing Patterns', () => {
  let db: Database;
  let manager: TestDatabaseManager;

  beforeEach(async () => {
    manager = await TestDatabaseManager.getInstance();
    db = await manager.createTestDatabase({ enableFTS5: true });

    // Add test content for FTS5 testing
    db.exec(`
      CREATE VIRTUAL TABLE search_test USING fts5(title, content);
      INSERT INTO search_test VALUES
        ('SuperGrid Architecture', 'PAFV projection system with D3.js rendering'),
        ('Janus Density Model', 'Four-level density controls: Value, Extent, View, Region'),
        ('LATCH Filtering System', 'Location, Alphabet, Time, Category, Hierarchy filters'),
        ('Graph Traversal', 'Recursive CTEs for efficient graph algorithms'),
        ('sql.js Integration', 'Bridge elimination with WASM SQLite');
    `);
  });

  afterEach(async () => {
    manager.closeDatabase(db);
  });

  test('should perform basic FTS5 search', async () => {
    // Skip if FTS5 not available
    const capabilities = manager.testCapabilities(db);
    if (!capabilities.hasFTS5) {
      console.warn('Skipping FTS5 test - not available');
      return;
    }

    // Act: Search for specific term
    const results = execTestQuery(db, `
      SELECT title, content
      FROM search_test
      WHERE search_test MATCH 'PAFV'
      ORDER BY rank
    `);

    // Assert: Found relevant results
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('SuperGrid Architecture');
  });

  test('should handle phrase queries', async () => {
    // Skip if FTS5 not available
    const capabilities = manager.testCapabilities(db);
    if (!capabilities.hasFTS5) {
      console.warn('Skipping FTS5 test - not available');
      return;
    }

    // Act: Search for exact phrase
    const results = execTestQuery(db, `
      SELECT title
      FROM search_test
      WHERE search_test MATCH '"density controls"'
    `);

    // Assert: Found exact phrase match
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Janus Density Model');
  });

  test('should support AND/OR search operators', async () => {
    // Skip if FTS5 not available
    const capabilities = manager.testCapabilities(db);
    if (!capabilities.hasFTS5) {
      console.warn('Skipping FTS5 test - not available');
      return;
    }

    // Act: Search with AND operator
    const andResults = execTestQuery(db, `
      SELECT title
      FROM search_test
      WHERE search_test MATCH 'Graph AND CTE'
    `);

    // Act: Search with OR operator
    const orResults = execTestQuery(db, `
      SELECT title
      FROM search_test
      WHERE search_test MATCH 'SuperGrid OR Janus'
    `);

    // Assert: AND returns specific matches
    expect(andResults.length).toBe(1);
    expect(andResults[0].title).toBe('Graph Traversal');

    // Assert: OR returns multiple matches
    expect(orResults.length).toBe(2);
    const titles = orResults.map(r => r.title);
    expect(titles).toContain('SuperGrid Architecture');
    expect(titles).toContain('Janus Density Model');
  });
});

/**
 * Example 7: Error Handling and Recovery Testing Pattern
 *
 * Pattern: Test error conditions and recovery mechanisms
 * Shows: SQL errors, constraint violations, transaction rollback
 */
describe('TDD Example 7: Error Handling Patterns', () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDB();
  });

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  test('should handle SQL syntax errors gracefully', () => {
    // Act & Assert: Invalid SQL should throw descriptive error
    expect(() => {
      execTestQuery(db, 'SELEKT * FROM nodes'); // Intentional typo
    }).toThrow(/syntax error/i);

    // Assert: Database remains functional after error
    const validQuery = execTestQuery(db, 'SELECT COUNT(*) as count FROM nodes');
    expect(validQuery).toHaveLength(1);
  });

  test('should enforce foreign key constraints', () => {
    // Act & Assert: Invalid foreign key should throw
    expect(() => {
      insertTestData(db, `
        INSERT INTO edges (id, edge_type, source_id, target_id)
        VALUES ('bad-edge', 'LINK', 'nonexistent-source', 'nonexistent-target')
      `);
    }).toThrow(/foreign key constraint/i);
  });

  test('should enforce unique constraints', () => {
    // Arrange: Insert initial node
    insertTestData(db, `
      INSERT INTO nodes (id, name, content, folder, status)
      VALUES ('duplicate-test', 'Test Node', 'Test content', 'test', 'active')
    `);

    // Act & Assert: Duplicate ID should throw
    expect(() => {
      insertTestData(db, `
        INSERT INTO nodes (id, name, content, folder, status)
        VALUES ('duplicate-test', 'Another Node', 'Different content', 'test', 'active')
      `);
    }).toThrow(/unique constraint/i);
  });

  test('should handle missing table errors', () => {
    // Act & Assert: Query to nonexistent table should throw
    expect(() => {
      execTestQuery(db, 'SELECT * FROM nonexistent_table');
    }).toThrow(/no such table/i);
  });
});