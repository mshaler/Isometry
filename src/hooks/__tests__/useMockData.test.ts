import { renderHook, waitFor } from '@testing-library/react';
import { useMockData } from '../useMockData';

describe('useMockData', () => {
  it('should return loading state initially', () => {
    const { result } = renderHook(() => useMockData());

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should return mock data after loading delay', async () => {
    const { result } = renderHook(() => useMockData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 1000 });

    expect(result.current.data).not.toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('should return exactly 6 mock nodes', async () => {
    const { result } = renderHook(() => useMockData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(6);
  });

  it('should return nodes with required PAFV fields', async () => {
    const { result } = renderHook(() => useMockData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const nodes = result.current.data!;

    nodes.forEach(node => {
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('name');
      expect(node).toHaveProperty('folder'); // PAFV Category axis
      expect(node).toHaveProperty('status'); // PAFV Status axis
      expect(node).toHaveProperty('priority'); // LATCH Priority filter
      expect(node).toHaveProperty('createdAt'); // PAFV Time axis
      expect(node).toHaveProperty('deletedAt', null); // Not deleted
    });
  });

  it('should return nodes with diverse data for PAFV testing', async () => {
    const { result } = renderHook(() => useMockData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const nodes = result.current.data!;
    const folders = new Set(nodes.map(n => n.folder));
    const statuses = new Set(nodes.map(n => n.status));
    const priorities = new Set(nodes.map(n => n.priority));

    // Should have multiple categories for grid organization
    expect(folders.size).toBeGreaterThan(1);
    expect(statuses.size).toBeGreaterThan(1);
    expect(priorities.size).toBeGreaterThan(1);
  });
});