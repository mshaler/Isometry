import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SQLiteProvider, useSQLite } from '../SQLiteProvider';
import React from 'react';

// Mock sql.js to avoid WASM loading in tests
vi.mock('sql.js', () => ({
  default: vi.fn(() => Promise.resolve({
    Database: vi.fn().mockImplementation(() => ({
      exec: vi.fn((sql) => {
        // Mock FTS5 and JSON1 verification queries
        if (sql.includes('fts5_version')) return [{ columns: ['version'], values: [['3.42.0']] }];
        if (sql.includes('json(')) return [{ columns: ['result'], values: [['{}']]}];
        if (sql.includes('test_cte')) return [{ columns: ['count'], values: [[3]] }];
        return [];
      }),
      prepare: vi.fn(() => ({
        step: vi.fn(() => false),
        getAsObject: vi.fn(() => ({})),
        free: vi.fn(),
        bind: vi.fn()
      })),
      run: vi.fn(),
      export: vi.fn(() => new Uint8Array()),
      close: vi.fn()
    }))
  }))
}));

// Test component that uses the SQLite context
function TestComponent() {
  const { db, loading, error, execute } = useSQLite();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!db) return <div>No database</div>;

  return (
    <div>
      <div data-testid="status">Ready</div>
      <button
        data-testid="test-query"
        onClick={() => {
          try {
            const results = execute('SELECT COUNT(*) as count FROM nodes');
            console.log('Query results:', results);
          } catch (err) {
            console.error('Query failed:', err);
          }
        }}
      >
        Test Query
      </button>
    </div>
  );
}

describe('SQLiteProvider', () => {
  beforeEach(() => {
    // Clear mocks
    vi.clearAllMocks();

    // Mock fetch for schema loading
    global.fetch = vi.fn((url) => {
      if (url.toString().includes('schema.sql')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('CREATE TABLE nodes (id TEXT PRIMARY KEY);')
        } as Response);
      }
      // Mock database file fetch (should fail to trigger new db creation)
      return Promise.resolve({
        ok: false,
        status: 404
      } as Response);
    });
  });

  it('should initialize sql.js database with required features', async () => {
    render(
      <SQLiteProvider>
        <TestComponent />
      </SQLiteProvider>
    );

    // Should show loading initially
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Should show ready state after initialization
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('Ready');
    }, { timeout: 5000 });
  });

  it('should provide synchronous execute function', async () => {
    const executeResults: any[] = [];

    function TestExecuteComponent() {
      const { execute, loading } = useSQLite();

      React.useEffect(() => {
        if (!loading) {
          try {
            const results = execute('SELECT * FROM nodes WHERE deleted_at IS NULL');
            executeResults.push(results);
          } catch (err) {
            console.error('Execute error:', err);
          }
        }
      }, [execute, loading]);

      return loading ? <div>Loading...</div> : <div>Executed</div>;
    }

    render(
      <SQLiteProvider>
        <TestExecuteComponent />
      </SQLiteProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Executed')).toBeInTheDocument();
    });

    // Verify execute was called synchronously
    expect(executeResults).toHaveLength(1);
  });

  it('should verify FTS5 support during initialization', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    render(
      <SQLiteProvider enableLogging={true}>
        <TestComponent />
      </SQLiteProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('Ready');
    });

    // Check that FTS5 verification was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('FTS5 support verified')
    );

    consoleSpy.mockRestore();
  });

  it('should verify JSON1 support during initialization', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    render(
      <SQLiteProvider enableLogging={true}>
        <TestComponent />
      </SQLiteProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('Ready');
    });

    // Check that JSON1 verification was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('JSON1 support verified')
    );

    consoleSpy.mockRestore();
  });

  it('should verify recursive CTE support during initialization', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    render(
      <SQLiteProvider enableLogging={true}>
        <TestComponent />
      </SQLiteProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('Ready');
    });

    // Check that recursive CTE verification was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Recursive CTE support verified')
    );

    consoleSpy.mockRestore();
  });

  it('should handle database initialization errors', async () => {
    // Mock sql.js initialization failure
    vi.doMock('sql.js', () => ({
      default: vi.fn(() => Promise.reject(new Error('WASM load failed')))
    }));

    // Re-import after mocking
    const { SQLiteProvider: FailingSQLiteProvider } = await import('../SQLiteProvider');

    render(
      <FailingSQLiteProvider>
        <TestComponent />
      </FailingSQLiteProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });
  });
});

describe('useSQLiteQuery hook', () => {
  it('should execute queries and return typed results', async () => {
    const { useSQLiteQuery } = await import('../SQLiteProvider');

    function TestQueryComponent() {
      const { data, loading, error } = useSQLiteQuery<{ id: string; name: string }>(
        'SELECT id, name FROM nodes WHERE deleted_at IS NULL'
      );

      if (loading) return <div>Loading query...</div>;
      if (error) return <div>Query error: {error.message}</div>;

      return (
        <div data-testid="query-results">
          Results: {data.length}
        </div>
      );
    }

    render(
      <SQLiteProvider>
        <TestQueryComponent />
      </SQLiteProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('query-results')).toBeInTheDocument();
    });
  });
});