import { useState, useEffect } from 'react';
import type { Node } from '../types/node';

// Simple mock data for MVP demonstration
const MOCK_NODES: Node[] = [
  {
    id: '1',
    name: 'Project Alpha',
    content: 'Initial project planning',
    folder: 'Projects',
    status: 'active',
    priority: 'high',
    createdAt: '2024-01-15T10:00:00Z',
    modifiedAt: '2024-01-20T15:30:00Z',
    deletedAt: null,
  },
  {
    id: '2',
    name: 'Meeting Notes',
    content: 'Weekly team sync',
    folder: 'Meetings',
    status: 'completed',
    priority: 'medium',
    createdAt: '2024-01-10T09:00:00Z',
    modifiedAt: '2024-01-10T16:00:00Z',
    deletedAt: null,
  },
  {
    id: '3',
    name: 'Research Task',
    content: 'Market analysis',
    folder: 'Research',
    status: 'pending',
    priority: 'low',
    createdAt: '2024-01-08T14:00:00Z',
    modifiedAt: '2024-01-12T11:00:00Z',
    deletedAt: null,
  },
  {
    id: '4',
    name: 'Bug Fix #123',
    content: 'Critical production issue',
    folder: 'Development',
    status: 'active',
    priority: 'high',
    createdAt: '2024-01-22T08:00:00Z',
    modifiedAt: '2024-01-22T08:30:00Z',
    deletedAt: null,
  },
  {
    id: '5',
    name: 'Feature Spec',
    content: 'New user dashboard',
    folder: 'Projects',
    status: 'draft',
    priority: 'medium',
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
    priority: 'low',
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