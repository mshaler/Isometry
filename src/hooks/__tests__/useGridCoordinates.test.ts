/**
 * Tests for useGridCoordinates hook
 *
 * @module hooks/__tests__/useGridCoordinates.test
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGridCoordinates, getUniqueAxisValues } from '../useGridCoordinates';
import type { Node } from '@/types/node';
import type { OriginPattern } from '@/types/coordinates';

// Sample test nodes
const testNodes: Node[] = [
  {
    id: '1',
    name: 'Node A',
    summary: 'First node',
    folder: 'ProjectAlpha',
    tags: ['urgent'],
    priority: 1,
    importance: 8,
    nodeType: 'note',
    createdAt: '2024-01-15T10:00:00Z',
    modifiedAt: '2024-01-20T15:30:00Z',
    status: 'active',
  },
  {
    id: '2',
    name: 'Node B',
    summary: 'Second node',
    folder: 'ProjectBeta',
    tags: ['review'],
    priority: 5,
    importance: 5,
    nodeType: 'task',
    createdAt: '2024-02-10T09:00:00Z',
    modifiedAt: '2024-02-15T12:00:00Z',
    status: 'pending',
  },
  {
    id: '3',
    name: 'Node C',
    summary: 'Third node',
    folder: 'ProjectAlpha',
    tags: ['urgent'],
    priority: 10,
    importance: 3,
    nodeType: 'note',
    createdAt: '2024-01-20T14:00:00Z',
    modifiedAt: '2024-01-25T11:00:00Z',
    status: 'active',
  },
];

describe('useGridCoordinates', () => {
  it('should map nodes to coordinates based on time axis (year)', () => {
    const { result } = renderHook(() =>
      useGridCoordinates({
        nodes: testNodes,
        xAxis: 'time',
        xFacet: 'year',
        yAxis: 'category',
        yFacet: 'tag',
        originPattern: 'anchor',
      })
    );

    const coordinates = result.current;

    // All nodes should have coordinates
    expect(coordinates.size).toBe(3);

    // All nodes are from 2024, so all should have same X coordinate (0 with anchor pattern)
    const node1 = coordinates.get('1');
    const node2 = coordinates.get('2');
    const node3 = coordinates.get('3');

    expect(node1?.xLabel).toBe('2024');
    expect(node2?.xLabel).toBe('2024');
    expect(node3?.xLabel).toBe('2024');

    // With anchor pattern, all should have x = 0 (since min = max = 2024)
    expect(node1?.x).toBe(0);
    expect(node2?.x).toBe(0);
    expect(node3?.x).toBe(0);
  });

  it('should map nodes to coordinates based on category axis (tag)', () => {
    const { result } = renderHook(() =>
      useGridCoordinates({
        nodes: testNodes,
        xAxis: 'category',
        xFacet: 'tag',
        yAxis: 'hierarchy',
        yFacet: 'level',
        originPattern: 'anchor',
      })
    );

    const coordinates = result.current;

    expect(coordinates.size).toBe(3);

    // Nodes with same tag should have same X coordinate
    const node1 = coordinates.get('1');
    const node3 = coordinates.get('3');

    expect(node1?.xLabel).toBe('urgent');
    expect(node3?.xLabel).toBe('urgent');
    expect(node1?.x).toBe(node3?.x); // Same tag = same coordinate

    // Node 2 has different tag
    const node2 = coordinates.get('2');
    expect(node2?.xLabel).toBe('review');
    expect(node2?.x).not.toBe(node1?.x);
  });

  it('should map hierarchy axis to priority values', () => {
    const { result } = renderHook(() =>
      useGridCoordinates({
        nodes: testNodes,
        xAxis: 'hierarchy',
        xFacet: 'level',
        yAxis: 'alphabet',
        yFacet: 'letter',
        originPattern: 'anchor',
      })
    );

    const coordinates = result.current;

    const node1 = coordinates.get('1');
    const node2 = coordinates.get('2');
    const node3 = coordinates.get('3');

    // Priority values: 1, 5, 10
    // With anchor pattern: min = 1, so coordinates are 0, 4, 9
    expect(node1?.x).toBe(0); // priority 1 - 1 = 0
    expect(node2?.x).toBe(4); // priority 5 - 1 = 4
    expect(node3?.x).toBe(9); // priority 10 - 1 = 9

    expect(node1?.xLabel).toBe('Priority 1');
    expect(node2?.xLabel).toBe('Priority 5');
    expect(node3?.xLabel).toBe('Priority 10');
  });

  it('should map alphabet axis to first letter', () => {
    const { result } = renderHook(() =>
      useGridCoordinates({
        nodes: testNodes,
        xAxis: 'alphabet',
        xFacet: 'letter',
        yAxis: 'time',
        yFacet: 'month',
        originPattern: 'anchor',
      })
    );

    const coordinates = result.current;

    const node1 = coordinates.get('1');
    const node2 = coordinates.get('2');
    const node3 = coordinates.get('3');

    // Names: "Node A", "Node B", "Node C"
    // First letters: N, N, N (all same)
    expect(node1?.xLabel).toBe('N');
    expect(node2?.xLabel).toBe('N');
    expect(node3?.xLabel).toBe('N');

    // All should have same X coordinate
    expect(node1?.x).toBe(node2?.x);
    expect(node2?.x).toBe(node3?.x);
  });

  it('should apply anchor origin pattern (min becomes 0)', () => {
    const { result } = renderHook(() =>
      useGridCoordinates({
        nodes: testNodes,
        xAxis: 'hierarchy',
        xFacet: 'level',
        yAxis: 'hierarchy',
        yFacet: 'level',
        originPattern: 'anchor',
      })
    );

    const coordinates = result.current;

    const node1 = coordinates.get('1');
    const node3 = coordinates.get('3');

    // Min priority = 1, max = 10
    // Anchor: shift so min is at 0
    expect(node1?.x).toBe(0); // 1 - 1 = 0
    expect(node3?.x).toBe(9); // 10 - 1 = 9
  });

  it('should apply bipolar origin pattern (center becomes 0)', () => {
    const { result } = renderHook(() =>
      useGridCoordinates({
        nodes: testNodes,
        xAxis: 'hierarchy',
        xFacet: 'level',
        yAxis: 'hierarchy',
        yFacet: 'level',
        originPattern: 'bipolar',
      })
    );

    const coordinates = result.current;

    const node1 = coordinates.get('1');
    const node2 = coordinates.get('2');
    const node3 = coordinates.get('3');

    // Min = 1, max = 10, center = 5.5
    // Bipolar: shift so center is at 0
    expect(node1?.x).toBe(-4.5); // 1 - 5.5 = -4.5
    expect(node2?.x).toBe(-0.5); // 5 - 5.5 = -0.5
    expect(node3?.x).toBe(4.5); // 10 - 5.5 = 4.5
  });

  it('should handle missing values with default to 0', () => {
    const nodesWithMissing: Node[] = [
      {
        id: '1',
        name: 'Node A',
        summary: '',
        folder: 'ProjectAlpha',
        tags: [],
        priority: 1,
        importance: 5,
        nodeType: 'note',
        createdAt: '',
        modifiedAt: '',
        status: 'active',
      },
    ];

    const { result } = renderHook(() =>
      useGridCoordinates({
        nodes: nodesWithMissing,
        xAxis: 'time',
        xFacet: 'year',
        yAxis: 'category',
        yFacet: 'tag',
        originPattern: 'anchor',
      })
    );

    const coordinates = result.current;
    const node = coordinates.get('1');

    // Missing time and tag should default to 0
    expect(node?.x).toBe(0);
    expect(node?.y).toBe(0);
  });

  it('should memoize results for same inputs', () => {
    const { result, rerender } = renderHook(
      ({ originPattern }: { originPattern: OriginPattern }) =>
        useGridCoordinates({
          nodes: testNodes,
          xAxis: 'time',
          xFacet: 'year',
          yAxis: 'category',
          yFacet: 'tag',
          originPattern,
        }),
      { initialProps: { originPattern: 'anchor' as OriginPattern } }
    );

    const firstResult = result.current;

    // Re-render with same inputs
    rerender({ originPattern: 'anchor' });

    // Should return same reference (memoized)
    expect(result.current).toBe(firstResult);

    // Re-render with different origin pattern
    rerender({ originPattern: 'bipolar' });

    // Should return new reference
    expect(result.current).not.toBe(firstResult);
  });

  it('should return empty map for empty nodes array', () => {
    const { result } = renderHook(() =>
      useGridCoordinates({
        nodes: [],
        xAxis: 'time',
        xFacet: 'year',
        yAxis: 'category',
        yFacet: 'tag',
        originPattern: 'anchor',
      })
    );

    expect(result.current.size).toBe(0);
  });
});

describe('getUniqueAxisValues', () => {
  it('should extract unique X axis values', () => {
    const coordinates = new Map([
      ['1', { x: 0, y: 5, xLabel: '2024', yLabel: 'urgent' }],
      ['2', { x: 1, y: 3, xLabel: '2025', yLabel: 'review' }],
      ['3', { x: 0, y: 8, xLabel: '2024', yLabel: 'urgent' }],
    ]);

    const uniqueX = getUniqueAxisValues(coordinates, 'x');

    expect(uniqueX).toHaveLength(2);
    expect(uniqueX).toEqual([
      { value: 0, label: '2024' },
      { value: 1, label: '2025' },
    ]);
  });

  it('should extract unique Y axis values', () => {
    const coordinates = new Map([
      ['1', { x: 0, y: 5, xLabel: '2024', yLabel: 'urgent' }],
      ['2', { x: 1, y: 3, xLabel: '2025', yLabel: 'review' }],
      ['3', { x: 0, y: 8, xLabel: '2024', yLabel: 'complete' }],
    ]);

    const uniqueY = getUniqueAxisValues(coordinates, 'y');

    expect(uniqueY).toHaveLength(3);
    expect(uniqueY[0].value).toBe(3);
    expect(uniqueY[1].value).toBe(5);
    expect(uniqueY[2].value).toBe(8);
  });

  it('should sort values numerically', () => {
    const coordinates = new Map([
      ['1', { x: 10, y: 0, xLabel: 'Nov', yLabel: 'A' }],
      ['2', { x: 2, y: 0, xLabel: 'Feb', yLabel: 'A' }],
      ['3', { x: 5, y: 0, xLabel: 'May', yLabel: 'A' }],
    ]);

    const uniqueX = getUniqueAxisValues(coordinates, 'x');

    expect(uniqueX.map(v => v.value)).toEqual([2, 5, 10]);
    expect(uniqueX.map(v => v.label)).toEqual(['Feb', 'May', 'Nov']);
  });

  it('should handle empty coordinates map', () => {
    const coordinates = new Map();

    const uniqueX = getUniqueAxisValues(coordinates, 'x');

    expect(uniqueX).toEqual([]);
  });
});
