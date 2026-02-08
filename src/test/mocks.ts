/**
 * Test Mocks for SQLiteProvider and Related Services
 *
 * Comprehensive mocking patterns for sql.js testing infrastructure,
 * supporting TDD workflows and isolated unit testing.
 */

import { vi, type MockedFunction } from 'vitest';
import type { Database } from 'sql.js-fts5';
import type { SQLiteContextValue } from '../db/SQLiteProvider';
import { createTestDB, execTestQuery } from './db-utils';
import { TEST_NODES, TEST_EDGES, loadTestFixtures } from './fixtures';

// Simple test interfaces
interface TestLPGNode {
  id: string;
  name: string;
  content?: string;
  folder?: string;
  status?: string;
  priority?: number;
  created_at?: string;
}

interface TestLPGEdge {
  id: string;
  edge_type: string;
  source_id: string;
  target_id: string;
  label?: string;
  weight?: number;
}

/**
 * Mock SQLiteProvider Context
 */
export interface MockSQLiteContextValue extends SQLiteContextValue {
  // Additional test utilities
  __testUtils: {
    injectData: (data: { nodes?: Partial<TestLPGNode>[]; edges?: Partial<TestLPGEdge>[] }) => void;
    clearData: () => void;
    simulateError: (error: Error) => void;
    simulateLoading: (loading: boolean) => void;
    getQueryHistory: () => Array<{ sql: string; params: unknown[] }>;
    resetQueryHistory: () => void;
  };
}

/**
 * Create a mock SQLite context for testing
 */
export function createMockSQLiteContext(options: {
  withRealDatabase?: boolean;
  initialData?: boolean;
  simulateLoading?: boolean;
  simulateError?: Error;
  capabilities?: {
    fts5?: boolean;
    json1?: boolean;
    recursiveCte?: boolean;
  };
} = {}): MockSQLiteContextValue {
  const {
    withRealDatabase = true,
    initialData = true,
    simulateLoading = false,
    simulateError = null,
    capabilities = { fts5: true, json1: true, recursiveCte: true },
  } = options;

  // Track queries for testing verification
  const queryHistory: Array<{ sql: string; params: unknown[] }> = [];

  let mockDatabase: Database | null = null;
  let mockError: Error | null = simulateError;
  let mockLoading = simulateLoading;

  // Initialize real database if requested
  if (withRealDatabase && !simulateError) {
    createTestDB({ loadSampleData: initialData }).then(db => {
      mockDatabase = db;
      if (initialData) {
        loadTestFixtures(db);
      }
    }).catch(error => {
      console.warn('[Mock] Failed to create real test database, using mock:', error);
      mockDatabase = null;
    });
  }

  const execute: MockedFunction<SQLiteContextValue['execute']> = vi.fn((sql: string, params: unknown[] = []) => {
    queryHistory.push({ sql, params });

    if (mockError) {
      throw mockError;
    }

    if (mockLoading) {
      throw new Error('Database is loading');
    }

    // If we have a real database, use it
    if (mockDatabase) {
      return execTestQuery(mockDatabase, sql, params);
    }

    // Otherwise, return mock data based on the query
    return mockQueryResults(sql, params);
  });

  const run: MockedFunction<SQLiteContextValue['run']> = vi.fn((sql: string, params: unknown[] = []) => {
    queryHistory.push({ sql, params });

    if (mockError) {
      throw mockError;
    }

    if (mockLoading) {
      throw new Error('Database is loading');
    }

    // For INSERT/UPDATE/DELETE operations, just log
    if (mockDatabase) {
      if (params.length > 0) {
        mockDatabase.run(sql, params);
      } else {
        mockDatabase.exec(sql);
      }
    }
  });

  const save = vi.fn().mockResolvedValue(undefined);
  const reset = vi.fn().mockResolvedValue(undefined);
  const loadFromFile = vi.fn().mockResolvedValue(undefined);

  const mockContext: MockSQLiteContextValue = {
    db: mockDatabase,
    loading: mockLoading,
    error: mockError,
    execute,
    run,
    save,
    reset,
    loadFromFile,
    capabilities: {
      fts5: capabilities?.fts5 ?? true,
      json1: capabilities?.json1 ?? true,
      recursiveCte: capabilities?.recursiveCte ?? true,
    },
    telemetry: [],

    // Test utilities
    __testUtils: {
      injectData: (data) => {
        if (data.nodes && mockDatabase) {
          const stmt = mockDatabase.prepare(`
            INSERT OR REPLACE INTO nodes (id, name, content, folder, status, priority, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          for (const node of data.nodes) {
            stmt.run([
              node.id, node.name, node.content, node.folder, node.status,
              node.priority, node.created_at
            ]);
          }
          stmt.free();
        }
        if (data.edges && mockDatabase) {
          const stmt = mockDatabase.prepare(`
            INSERT OR REPLACE INTO edges (id, edge_type, source_id, target_id, label, weight)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          for (const edge of data.edges) {
            stmt.run([
              edge.id, edge.edge_type, edge.source_id, edge.target_id,
              edge.label, edge.weight
            ]);
          }
          stmt.free();
        }
      },

      clearData: () => {
        if (mockDatabase) {
          mockDatabase.exec('DELETE FROM nodes');
          mockDatabase.exec('DELETE FROM edges');
          mockDatabase.exec('DELETE FROM notebook_cards');
        }
      },

      simulateError: (error) => {
        mockError = error;
      },

      simulateLoading: (loading) => {
        mockLoading = loading;
      },

      getQueryHistory: () => [...queryHistory],

      resetQueryHistory: () => {
        queryHistory.length = 0;
      },
    },
  };

  return mockContext;
}

/**
 * Mock query results for when not using real database
 */
function mockQueryResults(sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const normalizedSql = sql.toLowerCase().trim();

  // Handle SELECT queries
  if (normalizedSql.startsWith('select')) {
    // Mock common queries
    if (normalizedSql.includes('from nodes')) {
      if (normalizedSql.includes('count(*)')) {
        return [{ count: TEST_NODES.length }];
      }

      if (normalizedSql.includes('where')) {
        // Apply simple filtering for common WHERE clauses
        let filteredNodes = [...TEST_NODES];

        if (normalizedSql.includes('folder = ')) {
          const folderParam = params[0] as string;
          filteredNodes = filteredNodes.filter(n => n.folder === folderParam);
        }

        if (normalizedSql.includes('status = ')) {
          const statusParam = params.find(p => typeof p === 'string' &&
            ['active', 'completed', 'in_progress', 'blocked'].includes(p as string)) as string;
          filteredNodes = filteredNodes.filter(n => n.status === statusParam);
        }

        return filteredNodes.map(n => ({ ...n }));
      }

      return TEST_NODES.map(n => ({ ...n }));
    }

    if (normalizedSql.includes('from edges')) {
      if (normalizedSql.includes('count(*)')) {
        return [{ count: TEST_EDGES.length }];
      }
      return TEST_EDGES.map(e => ({ ...e }));
    }

    // Mock FTS5 queries
    if (normalizedSql.includes('match')) {
      const searchTerm = params[0] as string;
      const matchingNodes = TEST_NODES.filter(n =>
        n.name?.toLowerCase().includes(searchTerm?.toLowerCase() || '') ||
        n.content?.toLowerCase().includes(searchTerm?.toLowerCase() || '')
      );
      return matchingNodes.map(n => ({ ...n }));
    }

    // Mock recursive CTE queries
    if (normalizedSql.includes('recursive')) {
      // Return mock graph traversal results
      return [
        { id: 'fixture-node-1', path: 'fixture-node-1', depth: 0 },
        { id: 'fixture-node-2', path: 'fixture-node-1 -> fixture-node-2', depth: 1 },
        { id: 'fixture-node-3', path: 'fixture-node-1 -> fixture-node-3', depth: 1 },
      ];
    }

    // Mock schema queries
    if (normalizedSql.includes('sqlite_master')) {
      return [
        { name: 'nodes', type: 'table' },
        { name: 'edges', type: 'table' },
        { name: 'facets', type: 'table' },
        { name: 'notebook_cards', type: 'table' },
      ];
    }

    // Mock capability tests
    if (normalizedSql.includes('json(')) {
      return [{ json_result: '{"test":true}' }];
    }

    if (normalizedSql.includes('test_cte')) {
      return [{ count: 3 }];
    }
  }

  // Default empty result
  return [];
}

/**
 * Mock the useSQLite hook
 */
export function mockUseSQLite(context?: Partial<SQLiteContextValue>): MockSQLiteContextValue {
  const defaultContext = createMockSQLiteContext();
  return { ...defaultContext, ...context } as MockSQLiteContextValue;
}

/**
 * Mock the useSQLiteQuery hook
 */
export function mockUseSQLiteQuery<T = Record<string, unknown>>(
  mockData: T[] = [],
  options: { loading?: boolean; error?: Error | null } = {}
) {
  return {
    data: mockData,
    loading: options.loading || false,
    error: options.error || null,
  };
}

/**
 * Vitest mock setup for SQLiteProvider
 */
export function setupSQLiteProviderMocks() {
  // Mock the SQLiteProvider component
  vi.mock('../db/SQLiteProvider', async (importOriginal) => {
    const original = await importOriginal();

    return {
      ...original,
      SQLiteProvider: ({ children }: { children: React.ReactNode }) => {
        return children;
      },
      useSQLite: () => createMockSQLiteContext(),
      useSQLiteQuery: (sql: string, params: unknown[] = []) => {
        const results = mockQueryResults(sql, params);
        return {
          data: results,
          loading: false,
          error: null,
        };
      },
    };
  });
}

/**
 * Mock sql.js initialization for faster tests
 */
export function mockSqlJsInit() {
  vi.mock('sql.js-fts5', () => ({
    default: vi.fn().mockResolvedValue({
      Database: vi.fn().mockImplementation(() => ({
        exec: vi.fn().mockReturnValue([]),
        prepare: vi.fn().mockReturnValue({
          run: vi.fn(),
          step: vi.fn().mockReturnValue(false),
          getAsObject: vi.fn().mockReturnValue({}),
          free: vi.fn(),
        }),
        run: vi.fn(),
        close: vi.fn(),
        export: vi.fn().mockReturnValue(new Uint8Array()),
      })),
    }),
  }));
}

/**
 * Test helper: Create a mock database with specific test scenario
 */
export async function createMockDBWithScenario(scenario: {
  nodes: Partial<TestLPGNode>[];
  edges: Partial<TestLPGEdge>[];
}): Promise<MockSQLiteContextValue> {
  const context = createMockSQLiteContext({ withRealDatabase: true, initialData: false });

  // Wait for database to be ready
  await new Promise(resolve => {
    const checkDB = () => {
      if (context.db && !context.loading) {
        context.__testUtils.injectData(scenario);
        resolve(undefined);
      } else {
        setTimeout(checkDB, 10);
      }
    };
    checkDB();
  });

  return context;
}

/**
 * Test helper: Assert SQL queries were executed
 */
export function expectSQLQuery(
  context: MockSQLiteContextValue,
  expectedSql: string | RegExp,
  expectedParams?: unknown[]
) {
  const queries = context.__testUtils.getQueryHistory();

  const matchingQuery = queries.find(q => {
    if (typeof expectedSql === 'string') {
      return q.sql.includes(expectedSql);
    } else {
      return expectedSql.test(q.sql);
    }
  });

  if (!matchingQuery) {
    throw new Error(
      `Expected SQL query "${expectedSql}" not found. Executed queries:\n${
        queries.map(q => `  - ${q.sql}`).join('\n')
      }`
    );
  }

  if (expectedParams) {
    expect(matchingQuery.params).toEqual(expectedParams);
  }

  return matchingQuery;
}

/**
 * Test helper: Clear all mocks and reset state
 */
export function resetAllMocks() {
  vi.clearAllMocks();
  vi.resetAllMocks();
}

/**
 * Performance testing mock - simulates slow queries
 */
export function createPerformanceTestMock(options: {
  queryDelay?: number;
  memoryUsage?: number;
} = {}): MockSQLiteContextValue {
  const { queryDelay = 0 } = options;

  const context = createMockSQLiteContext({ withRealDatabase: false });

  // Wrap execute to add delay
  const originalExecute = context.execute;
  context.execute = vi.fn().mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (queryDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, queryDelay));
    }
    return originalExecute(sql, params);
  });

  return context;
}

// Export common test patterns
export const TEST_PATTERNS = {
  // Empty database state
  EMPTY_DB: () => createMockSQLiteContext({ withRealDatabase: true, initialData: false }),

  // Database with sample data
  SAMPLE_DB: () => createMockSQLiteContext({ withRealDatabase: true, initialData: true }),

  // Loading state
  LOADING_DB: () => createMockSQLiteContext({ simulateLoading: true }),

  // Error state
  ERROR_DB: (error: Error) => createMockSQLiteContext({ simulateError: error }),

  // No FTS5 support
  NO_FTS5_DB: () => createMockSQLiteContext({
    capabilities: { fts5: false, json1: true, recursiveCte: true }
  }),

  // No recursive CTE support
  NO_CTE_DB: () => createMockSQLiteContext({
    capabilities: { fts5: true, json1: true, recursiveCte: false }
  }),
};