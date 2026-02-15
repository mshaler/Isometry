import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCellSizePersistence } from '../useCellSizePersistence';

// Mock SQLite
const mockDb = {
  exec: vi.fn(),
  run: vi.fn(),
};

vi.mock('@/db/SQLiteProvider', () => ({
  useSQLite: () => ({ db: mockDb }),
}));

describe('useCellSizePersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads sizes from SQLite on call', async () => {
    const savedState = {
      cellSizes: { 'cell-1': { width: 200, height: 100 } },
      globalSizeFactor: 1.5,
    };

    mockDb.exec.mockReturnValue([{
      values: [[JSON.stringify(savedState)]],
    }]);

    const { result } = renderHook(() => useCellSizePersistence());

    const loaded = await result.current.loadSizes();

    expect(loaded).toEqual(savedState);
    expect(mockDb.exec).toHaveBeenCalledWith(
      expect.stringContaining('SELECT state_json FROM view_state'),
      expect.any(Array)
    );
  });

  it('saves sizes with debounce', async () => {
    const { result } = renderHook(() => useCellSizePersistence());

    const state = {
      cellSizes: { 'cell-1': { width: 150, height: 80 } },
      globalSizeFactor: 1.0,
    };

    act(() => {
      result.current.saveSizes(state);
    });

    // Should not save immediately (debounced)
    expect(mockDb.run).not.toHaveBeenCalled();

    // Wait for debounce
    await waitFor(() => {
      expect(mockDb.run).toHaveBeenCalled();
    }, { timeout: 600 });
  });

  it('handles missing table gracefully', async () => {
    mockDb.exec.mockImplementation(() => {
      throw new Error('no such table: view_state');
    });

    const { result } = renderHook(() => useCellSizePersistence());

    const loaded = await result.current.loadSizes();

    expect(loaded).toBeNull();
  });

  it('returns null when no saved state exists', async () => {
    mockDb.exec.mockReturnValue([]);

    const { result } = renderHook(() => useCellSizePersistence());

    const loaded = await result.current.loadSizes();

    expect(loaded).toBeNull();
  });

  it('returns null for malformed state without cellSizes', async () => {
    mockDb.exec.mockReturnValue([{
      values: [[JSON.stringify({ globalSizeFactor: 1.0 })]],
    }]);

    const { result } = renderHook(() => useCellSizePersistence());

    const loaded = await result.current.loadSizes();

    expect(loaded).toBeNull();
  });

  it('uses custom dataset_id when provided', async () => {
    const { result } = renderHook(() => useCellSizePersistence('my-dataset'));

    const state = {
      cellSizes: { 'cell-1': { width: 100, height: 50 } },
      globalSizeFactor: 1.0,
    };

    act(() => {
      result.current.saveSizes(state);
    });

    await waitFor(() => {
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE'),
        expect.arrayContaining(['supergrid-cell-sizes', 'my-dataset'])
      );
    }, { timeout: 600 });
  });
});
