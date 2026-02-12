import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SQLiteProvider, useSQLite } from '../SQLiteProvider';
import React from 'react';

// Mock sql.js to avoid WASM loading in tests
// Use a class-based mock to properly support the `new` operator
class MockDatabase {
  exec = vi.fn((sql: string) => {
    // Mock FTS5 and JSON1 verification queries
    if (sql.includes('fts5_version')) return [{ columns: ['version'], values: [['3.42.0']] }];
    if (sql.includes('json(')) return [{ columns: ['result'], values: [['{}']]}];
    if (sql.includes('test_cte')) return [{ columns: ['count'], values: [[3]] }];
    if (sql.includes('SELECT 1')) return [{ columns: ['1'], values: [[1]] }];
    if (sql.includes('facets')) return []; // Mock empty facets for seed check
    return [];
  });
  prepare = vi.fn(() => ({
    step: vi.fn(() => false),
    getAsObject: vi.fn(() => ({})),
    free: vi.fn(),
    bind: vi.fn()
  }));
  run = vi.fn();
  export = vi.fn(() => new Uint8Array());
  close = vi.fn();
}

vi.mock('sql.js', () => ({
  default: vi.fn(() => Promise.resolve({
    Database: MockDatabase
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
            console.warn('Query results:', results);
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
    const executeResults: unknown[] = [];

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

  it('should log initialization complete message', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    render(
      <SQLiteProvider>
        <TestComponent />
      </SQLiteProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('Ready');
    });

    // Check that initialization complete was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[SQLiteProvider]')
    );

    consoleSpy.mockRestore();
  });

  it('should throw error when useSQLite is called outside provider', () => {
    // Test the hook behavior directly outside of React render
    // The hook should throw an error when context is undefined
    const originalError = console.error;
    console.error = vi.fn(); // Suppress React error boundary logs

    function TestOutsideProvider() {
      const { db } = useSQLite();
      return <div>DB: {db ? 'exists' : 'null'}</div>;
    }

    // React will catch the error and re-throw it during render
    // Using expect with a try-catch wrapper to verify the error
    let thrownError: Error | null = null;
    try {
      render(<TestOutsideProvider />);
    } catch (error) {
      thrownError = error as Error;
    }

    expect(thrownError).not.toBeNull();
    expect(thrownError?.message).toContain('useSQLite must be used within a SQLiteProvider');

    console.error = originalError;
  });
});

// Note: useSQLiteQuery hook doesn't exist in SQLiteProvider
// Tests for query functionality should use the execute() function from useSQLite() hook