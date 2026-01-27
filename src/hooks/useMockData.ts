import { useState, useEffect } from 'react';
import type { Node, NodeType } from '../types/node';

// Helper function to create complete Node objects
const createMockNode = (
  id: string,
  name: string,
  content: string,
  overrides: Partial<Node> = {}
): Node => ({
  id,
  nodeType: 'note' as NodeType,
  name,
  content,
  summary: null,
  latitude: null,
  longitude: null,
  locationName: null,
  locationAddress: null,
  createdAt: '2024-01-15T10:00:00Z',
  modifiedAt: '2024-01-20T15:30:00Z',
  dueAt: null,
  completedAt: null,
  eventStart: null,
  eventEnd: null,
  folder: null,
  tags: [],
  status: null,
  priority: 1,
  importance: 1,
  sortOrder: 1,
  source: null,
  sourceId: null,
  sourceUrl: null,
  deletedAt: null,
  version: 1,
  ...overrides,
});

// Simple mock data for MVP demonstration
const MOCK_NODES: Node[] = [
  {
    id: '1',
    nodeType: 'project',
    name: 'Project Alpha',
    content: 'Initial project planning',
    summary: null,
    latitude: null,
    longitude: null,
    locationName: null,
    locationAddress: null,
    createdAt: '2024-01-15T10:00:00Z',
    modifiedAt: '2024-01-20T15:30:00Z',
    dueAt: null,
    completedAt: null,
    eventStart: null,
    eventEnd: null,
    folder: 'Projects',
    tags: [],
    status: 'active',
    priority: 3,
    importance: 3,
    sortOrder: 1,
    source: null,
    sourceId: null,
    sourceUrl: null,
    deletedAt: null,
    version: 1,
  },
  createMockNode('2', 'Meeting Notes', 'Weekly team sync', {
    folder: 'Meetings',
    status: 'completed',
    priority: 2,
    createdAt: '2024-01-10T09:00:00Z',
    modifiedAt: '2024-01-10T16:00:00Z',
  }),
  createMockNode('3', 'Research Task', 'Market analysis', {
    folder: 'Research',
    status: 'pending',
    priority: 1,
    createdAt: '2024-01-08T14:00:00Z',
    modifiedAt: '2024-01-12T11:00:00Z',
  }),
  {
    id: '4',
    name: 'Bug Fix #123',
    content: 'Critical production issue',
    folder: 'Development',
    status: 'active',
    priority: 3,
    createdAt: '2024-01-22T08:00:00Z',
    modifiedAt: '2024-01-22T08:30:00Z',
    deletedAt: null,
  },
  {
    id: '5',
    name: 'Feature Spec',
    content: 'New user dashboard',
    folder: 'Projects',
    status: 'pending',
    priority: 2,
    createdAt: '2024-01-05T13:00:00Z',
    modifiedAt: '2024-01-18T10:00:00Z',
    deletedAt: null,
  },
  {
    id: '6',
    name: 'Documentation Update',
    content: 'API reference docs',
    folder: 'Documentation',
    status: 'completed',
    priority: 1,
    createdAt: '2024-01-12T16:00:00Z',
    modifiedAt: '2024-01-19T14:00:00Z',
    deletedAt: null,
  }
];

export interface MockQueryState {
  data: Node[] | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Mock data hook for MVP demonstration - bypasses all database complexity
 * Returns data in same format as useFilteredNodes for drop-in replacement
 */
export function useMockData(): MockQueryState {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate async loading
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return {
    data: loading ? null : MOCK_NODES,
    loading,
    error: null,
  };
}