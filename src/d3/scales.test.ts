/**
 * LATCH Scale Factories Tests
 *
 * TDD tests for PAFV-aware scale factories.
 */

import { describe, it, expect } from 'vitest';
import {
  createLATCHScale,
  createCategoryScale,
  createTimeScale,
  createHierarchyScale,
  createAlphabetScale,
  createLocationScale,
} from './scales';
import type { NodeValue } from '@/types/lpg';

// ============================================
// Test Data
// ============================================

const testNodes: NodeValue[] = [
  {
    id: '1',
    type: 'node',
    nodeType: 'Task',
    name: 'Alpha Task',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    latch: {
      location: [40.7128, -74.0060], // NYC
      alphabet: 'Alpha Task',
      time: new Date('2024-01-15'),
      category: 'Development',
      hierarchy: 1,
    },
    properties: {},
  },
  {
    id: '2',
    type: 'node',
    nodeType: 'Task',
    name: 'Beta Task',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
    latch: {
      location: [34.0522, -118.2437], // LA
      alphabet: 'Beta Task',
      time: new Date('2024-02-01'),
      category: 'Design',
      hierarchy: 3,
    },
    properties: {},
  },
  {
    id: '3',
    type: 'node',
    nodeType: 'Note',
    name: 'Gamma Note',
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
    latch: {
      location: 'San Francisco',
      alphabet: 'Gamma Note',
      time: new Date('2024-01-20'),
      category: 'Development',
      hierarchy: 2,
    },
    properties: {},
  },
  {
    id: '4',
    type: 'node',
    nodeType: 'Task',
    name: 'Delta Task',
    createdAt: new Date('2024-01-04'),
    updatedAt: new Date('2024-01-04'),
    latch: {
      alphabet: 'Delta Task',
      time: new Date('2024-03-01'),
      category: ['Design', 'Research'],
      hierarchy: 5,
    },
    properties: {},
  },
];

// ============================================
// createCategoryScale Tests
// ============================================

describe('createCategoryScale', () => {
  it('creates a band scale for categories', () => {
    const scale = createCategoryScale(testNodes, [0, 400]);

    expect(scale).toBeDefined();
    expect(typeof scale).toBe('function');
  });

  it('extracts unique categories from data', () => {
    const scale = createCategoryScale(testNodes, [0, 400]);

    // Should have Development, Design, Research
    const domain = scale.domain();
    expect(domain).toContain('Development');
    expect(domain).toContain('Design');
  });

  it('handles array categories (flattens)', () => {
    const scale = createCategoryScale(testNodes, [0, 400]);
    const domain = scale.domain();

    // Node 4 has ['Design', 'Research']
    expect(domain).toContain('Research');
  });

  it('applies padding option', () => {
    const scaleNoPad = createCategoryScale(testNodes, [0, 400]);
    const scaleWithPad = createCategoryScale(testNodes, [0, 400], { padding: 0.2 });

    // Bandwidth should be different
    expect(scaleWithPad.bandwidth()).toBeLessThan(scaleNoPad.bandwidth());
  });

  it('returns position for known category', () => {
    const scale = createCategoryScale(testNodes, [0, 400]);
    const pos = scale('Development');

    expect(typeof pos).toBe('number');
    expect(pos).toBeGreaterThanOrEqual(0);
    expect(pos).toBeLessThanOrEqual(400);
  });

  it('returns undefined for unknown category', () => {
    const scale = createCategoryScale(testNodes, [0, 400]);
    const pos = scale('Unknown');

    expect(pos).toBeUndefined();
  });
});

// ============================================
// createTimeScale Tests
// ============================================

describe('createTimeScale', () => {
  it('creates a time scale', () => {
    const scale = createTimeScale(testNodes, [0, 800]);

    expect(scale).toBeDefined();
    expect(typeof scale).toBe('function');
  });

  it('extracts time extent from data', () => {
    const scale = createTimeScale(testNodes, [0, 800]);
    const domain = scale.domain();

    // Should span from Jan 15 to Mar 1
    expect(domain.length).toBe(2);
    expect(domain[0]).toBeInstanceOf(Date);
    expect(domain[1]).toBeInstanceOf(Date);
  });

  it('handles date objects and strings', () => {
    const mixedData: NodeValue[] = [
      {
        id: '1',
        type: 'node',
        nodeType: 'Task',
        name: 'Task 1',
        createdAt: new Date(),
        updatedAt: new Date(),
        latch: { time: new Date('2024-01-01') },
        properties: {},
      },
      {
        id: '2',
        type: 'node',
        nodeType: 'Task',
        name: 'Task 2',
        createdAt: new Date(),
        updatedAt: new Date(),
        latch: { time: '2024-02-01' },
        properties: {},
      },
    ];

    const scale = createTimeScale(mixedData, [0, 400]);
    expect(scale.domain().length).toBe(2);
  });

  it('returns position for date', () => {
    const scale = createTimeScale(testNodes, [0, 800]);
    const pos = scale(new Date('2024-02-01'));

    expect(typeof pos).toBe('number');
    expect(pos).toBeGreaterThanOrEqual(0);
    expect(pos).toBeLessThanOrEqual(800);
  });

  it('applies nice option for rounded domain', () => {
    const scale = createTimeScale(testNodes, [0, 800], { nice: true });
    const domain = scale.domain();

    // Nice should round to month/day boundaries
    expect(domain[0]).toBeInstanceOf(Date);
  });
});

// ============================================
// createHierarchyScale Tests
// ============================================

describe('createHierarchyScale', () => {
  it('creates a linear scale for hierarchy', () => {
    const scale = createHierarchyScale(testNodes, [0, 500]);

    expect(scale).toBeDefined();
    expect(typeof scale).toBe('function');
  });

  it('extracts hierarchy extent from data', () => {
    const scale = createHierarchyScale(testNodes, [0, 500]);
    const domain = scale.domain();

    // Should span from 1 to 5
    expect(domain[0]).toBe(1);
    expect(domain[1]).toBe(5);
  });

  it('returns position for hierarchy value', () => {
    const scale = createHierarchyScale(testNodes, [0, 500]);
    const pos = scale(3);

    expect(typeof pos).toBe('number');
    expect(pos).toBeGreaterThanOrEqual(0);
    expect(pos).toBeLessThanOrEqual(500);
  });

  it('invert option reverses scale direction', () => {
    const normalScale = createHierarchyScale(testNodes, [0, 500]);
    const invertedScale = createHierarchyScale(testNodes, [0, 500], { invert: true });

    // Higher priority should be at top (lower y) when inverted
    expect(invertedScale(5)).toBeLessThan(invertedScale(1));
    expect(normalScale(5)).toBeGreaterThan(normalScale(1));
  });
});

// ============================================
// createAlphabetScale Tests
// ============================================

describe('createAlphabetScale', () => {
  it('creates a band scale for alphabetical sorting', () => {
    const scale = createAlphabetScale(testNodes, [0, 400]);

    expect(scale).toBeDefined();
    expect(typeof scale).toBe('function');
  });

  it('sorts domain alphabetically', () => {
    const scale = createAlphabetScale(testNodes, [0, 400]);
    const domain = scale.domain();

    // Should be sorted: Alpha, Beta, Delta, Gamma
    expect(domain[0]).toBe('Alpha Task');
    expect(domain[1]).toBe('Beta Task');
    expect(domain[2]).toBe('Delta Task');
    expect(domain[3]).toBe('Gamma Note');
  });

  it('applies padding option', () => {
    const scaleNoPad = createAlphabetScale(testNodes, [0, 400]);
    const scaleWithPad = createAlphabetScale(testNodes, [0, 400], { padding: 0.2 });

    expect(scaleWithPad.bandwidth()).toBeLessThan(scaleNoPad.bandwidth());
  });

  it('returns position for name', () => {
    const scale = createAlphabetScale(testNodes, [0, 400]);
    const pos = scale('Beta Task');

    expect(typeof pos).toBe('number');
    expect(pos).toBeGreaterThanOrEqual(0);
  });
});

// ============================================
// createLocationScale Tests
// ============================================

describe('createLocationScale', () => {
  it('creates a band scale for named locations', () => {
    const scale = createLocationScale(testNodes, [0, 600]);

    expect(scale).toBeDefined();
    expect(typeof scale).toBe('function');
  });

  it('extracts unique locations from data', () => {
    const scale = createLocationScale(testNodes, [0, 600]);
    const domain = scale.domain();

    // Should have coordinates and named location
    expect(domain.length).toBeGreaterThan(0);
  });

  it('handles coordinate arrays by converting to string', () => {
    const scale = createLocationScale(testNodes, [0, 600]);
    const domain = scale.domain();

    // NYC coordinates should be converted to string
    expect(domain.some((loc) => loc.includes('40.71'))).toBe(true);
  });

  it('returns position for location', () => {
    const scale = createLocationScale(testNodes, [0, 600]);
    const pos = scale('San Francisco');

    expect(typeof pos).toBe('number');
    expect(pos).toBeGreaterThanOrEqual(0);
  });
});

// ============================================
// createLATCHScale (Universal Factory) Tests
// ============================================

describe('createLATCHScale', () => {
  it('creates category scale for category axis', () => {
    const scale = createLATCHScale('category', testNodes, [0, 400]);

    expect(scale.type).toBe('category');
    expect(scale.axis).toBe('category');
    expect(scale.domain()).toContain('Development');
  });

  it('creates time scale for time axis', () => {
    const scale = createLATCHScale('time', testNodes, [0, 800]);

    expect(scale.type).toBe('time');
    expect(scale.axis).toBe('time');
    expect(scale.domain()[0]).toBeInstanceOf(Date);
  });

  it('creates linear scale for hierarchy axis', () => {
    const scale = createLATCHScale('hierarchy', testNodes, [0, 500]);

    expect(scale.type).toBe('hierarchy');
    expect(scale.axis).toBe('hierarchy');
    expect(scale.domain()).toEqual([1, 5]);
  });

  it('creates band scale for alphabet axis', () => {
    const scale = createLATCHScale('alphabet', testNodes, [0, 400]);

    expect(scale.type).toBe('alphabet');
    expect(scale.axis).toBe('alphabet');
    // Domain should be sorted
    expect(scale.domain()[0]).toBe('Alpha Task');
  });

  it('creates band scale for location axis', () => {
    const scale = createLATCHScale('location', testNodes, [0, 600]);

    expect(scale.type).toBe('location');
    expect(scale.axis).toBe('location');
  });

  it('passes options through to underlying scale', () => {
    const scale = createLATCHScale('hierarchy', testNodes, [0, 500], { invert: true });

    // Higher value should map to lower position
    const pos5 = scale(5);
    const pos1 = scale(1);
    expect(pos5).toBeDefined();
    expect(pos1).toBeDefined();
    expect(pos5!).toBeLessThan(pos1!);
  });

  it('getValue helper returns correct values', () => {
    const scale = createLATCHScale('category', testNodes, [0, 400]);
    const value = scale.getValue(testNodes[0]);

    expect(value).toBe('Development');
  });

  it('getPosition helper returns scaled position', () => {
    const scale = createLATCHScale('category', testNodes, [0, 400]);
    const pos = scale.getPosition(testNodes[0]);

    expect(typeof pos).toBe('number');
    expect(pos).toBeGreaterThanOrEqual(0);
  });
});

// ============================================
// Edge Cases
// ============================================

describe('edge cases', () => {
  it('handles empty data gracefully', () => {
    const scale = createCategoryScale([], [0, 400]);
    expect(scale.domain()).toEqual([]);
  });

  it('handles missing LATCH values', () => {
    const dataWithMissing: NodeValue[] = [
      {
        id: '1',
        type: 'node',
        nodeType: 'Task',
        name: 'Task 1',
        createdAt: new Date(),
        updatedAt: new Date(),
        latch: {}, // All empty
        properties: {},
      },
    ];

    // Should not throw
    const catScale = createCategoryScale(dataWithMissing, [0, 400]);
    const timeScale = createTimeScale(dataWithMissing, [0, 400]);
    const hierScale = createHierarchyScale(dataWithMissing, [0, 400]);

    expect(catScale.domain()).toEqual([]);
    expect(timeScale.domain().length).toBe(2); // Will use default dates
    expect(hierScale.domain()).toEqual([0, 0]); // Default to 0
  });

  it('handles single item data', () => {
    const singleItem: NodeValue[] = [testNodes[0]];

    const catScale = createCategoryScale(singleItem, [0, 400]);
    const timeScale = createTimeScale(singleItem, [0, 400]);
    const hierScale = createHierarchyScale(singleItem, [0, 400]);

    expect(catScale.domain().length).toBe(1);
    expect(timeScale.domain().length).toBe(2);
    expect(hierScale.domain()).toEqual([1, 1]);
  });
});
