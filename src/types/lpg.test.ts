/**
 * LPG Types Tests
 *
 * TDD tests for Labeled Property Graph types and adapters.
 */

import { describe, it, expect } from 'vitest';
import {
  isNode,
  isEdge,
  nodeToCardValue,
  edgeToCardValue,
  cardValueToNode,
  getLATCHValue,
} from './lpg';
import type { NodeValue, EdgeValue } from './lpg';
import type { Node, Edge } from './node';

// Test fixtures
const mockIsometryNode: Node = {
  id: 'node-1',
  nodeType: 'task',
  name: 'Test Task',
  content: 'Task description',
  summary: 'Short summary',
  latitude: 37.7749,
  longitude: -122.4194,
  locationName: 'San Francisco',
  locationAddress: '123 Main St',
  createdAt: '2024-01-15T10:00:00Z',
  modifiedAt: '2024-01-15T12:00:00Z',
  dueAt: '2024-01-20T17:00:00Z',
  completedAt: null,
  eventStart: null,
  eventEnd: null,
  folder: 'Work',
  tags: ['urgent', 'review'],
  status: 'active',
  priority: 1,
  importance: 3,
  sortOrder: 10,
  source: 'manual',
  sourceId: null,
  sourceUrl: null,
  deletedAt: null,
  version: 1,
};

const mockIsometryEdge: Edge = {
  id: 'edge-1',
  edgeType: 'LINK',
  sourceId: 'node-1',
  targetId: 'node-2',
  label: 'related to',
  weight: 0.8,
  directed: true,
  sequenceOrder: null,
  channel: null,
  timestamp: null,
  subject: null,
  createdAt: '2024-01-15T10:00:00Z',
};

const mockNodeValue: NodeValue = {
  id: 'node-1',
  type: 'node',
  nodeType: 'Task',
  name: 'Test Task',
  content: 'Task description',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T12:00:00Z'),
  latch: {
    location: [37.7749, -122.4194],
    alphabet: 'Test Task',
    time: new Date('2024-01-20T17:00:00Z'),
    category: ['Work', 'urgent', 'review'],
    hierarchy: 1,
  },
  properties: {
    summary: 'Short summary',
    status: 'active',
    importance: 3,
    sortOrder: 10,
  },
};

const mockEdgeValue: EdgeValue = {
  id: 'edge-1',
  type: 'edge',
  edgeType: 'LINK',
  sourceId: 'node-1',
  targetId: 'node-2',
  label: 'related to',
  weight: 0.8,
  directed: true,
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T10:00:00Z'),
  latch: {},
  properties: {},
};

describe('type guards', () => {
  describe('isNode', () => {
    it('returns true for NodeValue', () => {
      expect(isNode(mockNodeValue)).toBe(true);
    });

    it('returns false for EdgeValue', () => {
      expect(isNode(mockEdgeValue)).toBe(false);
    });
  });

  describe('isEdge', () => {
    it('returns true for EdgeValue', () => {
      expect(isEdge(mockEdgeValue)).toBe(true);
    });

    it('returns false for NodeValue', () => {
      expect(isEdge(mockNodeValue)).toBe(false);
    });
  });
});

describe('nodeToCardValue', () => {
  it('converts Isometry Node to LPG NodeValue', () => {
    const result = nodeToCardValue(mockIsometryNode);

    expect(result.id).toBe('node-1');
    expect(result.type).toBe('node');
    expect(result.nodeType).toBe('Task');
    expect(result.name).toBe('Test Task');
    expect(result.content).toBe('Task description');
  });

  it('converts LATCH coordinates correctly', () => {
    const result = nodeToCardValue(mockIsometryNode);

    expect(result.latch.location).toEqual([37.7749, -122.4194]);
    expect(result.latch.alphabet).toBe('Test Task');
    expect(result.latch.hierarchy).toBe(1);
  });

  it('combines folder and tags into category', () => {
    const result = nodeToCardValue(mockIsometryNode);

    expect(result.latch.category).toContain('Work');
    expect(result.latch.category).toContain('urgent');
    expect(result.latch.category).toContain('review');
  });

  it('uses dueAt for time axis when available', () => {
    const result = nodeToCardValue(mockIsometryNode);

    expect(result.latch.time).toEqual(new Date('2024-01-20T17:00:00Z'));
  });

  it('falls back to createdAt when dueAt is null', () => {
    const nodeWithoutDue = { ...mockIsometryNode, dueAt: null };
    const result = nodeToCardValue(nodeWithoutDue);

    expect(result.latch.time).toEqual(new Date('2024-01-15T10:00:00Z'));
  });

  it('handles node without location', () => {
    const nodeWithoutLocation = {
      ...mockIsometryNode,
      latitude: null,
      longitude: null,
      locationName: null,
    };
    const result = nodeToCardValue(nodeWithoutLocation);

    expect(result.latch.location).toBeUndefined();
  });

  it('uses locationName when coordinates not available', () => {
    const nodeWithNameOnly = {
      ...mockIsometryNode,
      latitude: null,
      longitude: null,
      locationName: 'San Francisco',
    };
    const result = nodeToCardValue(nodeWithNameOnly);

    expect(result.latch.location).toBe('San Francisco');
  });

  it('preserves additional properties', () => {
    const result = nodeToCardValue(mockIsometryNode);

    expect(result.properties.summary).toBe('Short summary');
    expect(result.properties.status).toBe('active');
    expect(result.properties.importance).toBe(3);
  });

  it('maps nodeType capitalization correctly', () => {
    const taskNode = { ...mockIsometryNode, nodeType: 'task' as const };
    const noteNode = { ...mockIsometryNode, nodeType: 'note' as const };
    const contactNode = { ...mockIsometryNode, nodeType: 'contact' as const };

    expect(nodeToCardValue(taskNode).nodeType).toBe('Task');
    expect(nodeToCardValue(noteNode).nodeType).toBe('Note');
    expect(nodeToCardValue(contactNode).nodeType).toBe('Person');
  });
});

describe('edgeToCardValue', () => {
  it('converts Isometry Edge to LPG EdgeValue', () => {
    const result = edgeToCardValue(mockIsometryEdge);

    expect(result.id).toBe('edge-1');
    expect(result.type).toBe('edge');
    expect(result.edgeType).toBe('LINK');
    expect(result.sourceId).toBe('node-1');
    expect(result.targetId).toBe('node-2');
    expect(result.label).toBe('related to');
    expect(result.weight).toBe(0.8);
    expect(result.directed).toBe(true);
  });
});

describe('cardValueToNode', () => {
  it('converts LPG NodeValue back to Isometry Node', () => {
    const result = cardValueToNode(mockNodeValue);

    expect(result.id).toBe('node-1');
    expect(result.nodeType).toBe('task');
    expect(result.name).toBe('Test Task');
    expect(result.content).toBe('Task description');
  });

  it('extracts location coordinates from LATCH', () => {
    const result = cardValueToNode(mockNodeValue);

    expect(result.latitude).toBe(37.7749);
    expect(result.longitude).toBe(-122.4194);
  });

  it('handles string location', () => {
    const nodeWithStringLocation: NodeValue = {
      ...mockNodeValue,
      latch: { ...mockNodeValue.latch, location: 'San Francisco' },
    };
    const result = cardValueToNode(nodeWithStringLocation);

    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
    expect(result.locationName).toBe('San Francisco');
  });

  it('extracts folder and tags from category', () => {
    const result = cardValueToNode(mockNodeValue);

    expect(result.folder).toBe('Work');
    expect(result.tags).toContain('urgent');
    expect(result.tags).toContain('review');
  });
});

describe('getLATCHValue', () => {
  it('returns location coordinate array', () => {
    const result = getLATCHValue(mockNodeValue, 'location');
    expect(result).toEqual([37.7749, -122.4194]);
  });

  it('returns alphabet value (name)', () => {
    const result = getLATCHValue(mockNodeValue, 'alphabet');
    expect(result).toBe('Test Task');
  });

  it('returns time value', () => {
    const result = getLATCHValue(mockNodeValue, 'time');
    expect(result).toEqual(new Date('2024-01-20T17:00:00Z'));
  });

  it('returns category array', () => {
    const result = getLATCHValue(mockNodeValue, 'category');
    expect(result).toContain('Work');
    expect(result).toContain('urgent');
  });

  it('returns hierarchy number', () => {
    const result = getLATCHValue(mockNodeValue, 'hierarchy');
    expect(result).toBe(1);
  });

  it('returns undefined for missing values', () => {
    const nodeWithoutLocation: NodeValue = {
      ...mockNodeValue,
      latch: { ...mockNodeValue.latch, location: undefined },
    };
    const result = getLATCHValue(nodeWithoutLocation, 'location');
    expect(result).toBeUndefined();
  });
});
