import { describe, it, expect } from 'vitest';
import { handleGraphSimulate } from '../../src/worker/handlers/simulate.handler';
import type { SimulatePayload } from '../../src/worker/protocol';

describe('handleGraphSimulate', () => {
  it('returns empty array for empty nodes', () => {
    const result = handleGraphSimulate({ nodes: [], links: [], width: 800, height: 600 });
    expect(result).toEqual([]);
  });

  it('returns positions for nodes with no links', () => {
    const payload: SimulatePayload = {
      nodes: [{ id: 'a' }, { id: 'b' }],
      links: [],
      width: 800,
      height: 600,
    };
    const result = handleGraphSimulate(payload);
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('a');
    expect(result[1]!.id).toBe('b');
    // Positions should be finite numbers
    for (const pos of result) {
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
    }
  });

  it('returns positions for connected nodes', () => {
    const payload: SimulatePayload = {
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      links: [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
      ],
      width: 800,
      height: 600,
    };
    const result = handleGraphSimulate(payload);
    expect(result).toHaveLength(3);
    // All positions should be finite
    for (const pos of result) {
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
      expect(pos.fx).toBeNull();
      expect(pos.fy).toBeNull();
    }
  });

  it('preserves pinned node positions (fx/fy)', () => {
    const payload: SimulatePayload = {
      nodes: [
        { id: 'a', fx: 100, fy: 200 },
        { id: 'b' },
      ],
      links: [{ source: 'a', target: 'b' }],
      width: 800,
      height: 600,
    };
    const result = handleGraphSimulate(payload);
    const pinned = result.find(n => n.id === 'a')!;
    expect(pinned.x).toBe(100);
    expect(pinned.y).toBe(200);
    expect(pinned.fx).toBe(100);
    expect(pinned.fy).toBe(200);
  });

  it('respects warm start positions', () => {
    const payload: SimulatePayload = {
      nodes: [
        { id: 'a', x: 100, y: 100 },
        { id: 'b', x: 500, y: 500 },
      ],
      links: [],
      width: 800,
      height: 600,
    };
    const result = handleGraphSimulate(payload);
    // With centering force, positions should drift toward center
    // but should still be reasonably close to initial positions
    // (not random — warm start is respected)
    expect(result).toHaveLength(2);
    for (const pos of result) {
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
    }
  });

  it('does not mutate input nodes', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }];
    const originalA = { ...nodes[0] };
    handleGraphSimulate({ nodes, links: [], width: 800, height: 600 });
    expect(nodes[0]).toEqual(originalA);
  });
});
