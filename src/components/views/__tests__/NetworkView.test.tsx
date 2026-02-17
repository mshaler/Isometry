/**
 * NetworkView Unit Tests
 *
 * Tests for SQL integration, filter reactivity, simulation lifecycle,
 * and selection sync.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// ============================================================================
// Mocks
// ============================================================================

// Mock useSQLiteQuery
const useSQLiteQueryMock = vi.fn();
vi.mock('@/hooks/database/useSQLiteQuery', () => ({
  useSQLiteQuery: (...args: unknown[]) => useSQLiteQueryMock(...args),
}));

// Mock FilterContext
vi.mock('@/state/FilterContext', () => ({
  useFilters: vi.fn(() => ({
    activeFilters: {},
  })),
}));

// Mock SelectionContext
const mockSelect = vi.fn();
const mockIsSelected = vi.fn(() => false);
const mockRegisterScrollToNode = vi.fn();
const mockUnregisterScrollToNode = vi.fn();

vi.mock('@/state/SelectionContext', () => ({
  useSelection: vi.fn(() => ({
    select: mockSelect,
    isSelected: mockIsSelected,
    registerScrollToNode: mockRegisterScrollToNode,
    unregisterScrollToNode: mockUnregisterScrollToNode,
    selection: { selectedIds: new Set(), anchorId: null, lastSelectedId: null },
    deselect: vi.fn(),
    toggle: vi.fn(),
    selectRange: vi.fn(),
    selectMultiple: vi.fn(),
    clear: vi.fn(),
    setCells: vi.fn(),
    scrollToNode: null,
  })),
}));

// Mock useForceSimulation
const mockReheat = vi.fn();
const mockStop = vi.fn();
vi.mock('@/hooks/visualization/useForceSimulation', () => ({
  useForceSimulation: vi.fn(() => ({
    reheat: mockReheat,
    stop: mockStop,
    state: 'stopped' as const,
  })),
}));

// Mock compileFilters
vi.mock('@/filters/compiler', () => ({
  compileFilters: vi.fn(() => ({
    sql: 'deleted_at IS NULL',
    params: [],
  })),
}));

// Mock ThemeContext
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: vi.fn(() => ({ theme: 'Modern' })),
}));

// Mock hooks
vi.mock('@/hooks', () => ({
  useCanvasTheme: vi.fn(() => ({ emptyState: 'text-gray-500' })),
}));

// Mock D3 hooks
vi.mock('@/d3/hooks', () => ({
  createColorScale: vi.fn(() => () => '#3b82f6'),
  setupZoom: vi.fn(),
}));

// Mock theme utilities
vi.mock('@/styles/themes', () => ({
  getTheme: vi.fn(() => ({
    chart: { axis: '#666', grid: '#ddd', stroke: '#ccc', axisText: '#333' },
    text: { secondary: '#666' },
  })),
}));

// Mock graph analytics
vi.mock('@/services/analytics/GraphAnalyticsAdapter', () => ({
  graphAnalytics: {
    suggestConnections: vi.fn().mockResolvedValue([]),
    getGraphMetrics: vi.fn().mockResolvedValue({
      totalNodes: 10,
      totalEdges: 5,
      graphDensity: 0.1,
      averageTagsPerNode: 2.5,
    }),
  },
}));

// Mock devLogger
vi.mock('@/utils/logging/dev-logger', () => ({
  devLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock ResizeObserver as a class
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ============================================================================
// Test Data
// ============================================================================

const mockNodes = [
  { id: 'node-1', name: 'Node A', folder: 'work', priority: 1 },
  { id: 'node-2', name: 'Node B', folder: 'personal', priority: 2 },
  { id: 'node-3', name: 'Node C', folder: 'work', priority: 3 },
];

const mockEdges = [
  { id: 'edge-1', source_id: 'node-1', target_id: 'node-2', edge_type: 'LINK', weight: 1, label: null },
  { id: 'edge-2', source_id: 'node-2', target_id: 'node-3', edge_type: 'NEST', weight: 2, label: 'parent' },
];

// ============================================================================
// Import after mocks
// ============================================================================

import { NetworkView } from '../NetworkView';
import { useFilters } from '@/state/FilterContext';
import { useSelection } from '@/state/SelectionContext';
import { useForceSimulation } from '@/hooks/visualization/useForceSimulation';
import { compileFilters } from '@/filters/compiler';

// ============================================================================
// Tests
// ============================================================================

describe('NetworkView', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock: return nodes for first call, edges for second
    useSQLiteQueryMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM nodes')) {
        return {
          data: mockNodes,
          loading: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      if (sql.includes('FROM edges')) {
        return {
          data: mockEdges,
          loading: false,
          error: null,
          refetch: vi.fn(),
        };
      }
      return { data: [], loading: false, error: null, refetch: vi.fn() };
    });
  });

  describe('rendering', () => {
    it('renders without crashing', () => {
      render(<NetworkView />);

      // SVG should be in the document
      expect(document.querySelector('svg')).toBeInTheDocument();
    });

    it('shows loading state when data is loading', () => {
      useSQLiteQueryMock.mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: vi.fn(),
      });

      render(<NetworkView />);

      expect(screen.getByText('Loading network...')).toBeInTheDocument();
    });

    it('shows error state when query fails', () => {
      useSQLiteQueryMock.mockImplementation((sql: string) => {
        if (sql.includes('FROM nodes')) {
          return {
            data: null,
            loading: false,
            error: new Error('Database error'),
            refetch: vi.fn(),
          };
        }
        return { data: mockEdges, loading: false, error: null, refetch: vi.fn() };
      });

      render(<NetworkView />);

      expect(screen.getByText('Error loading network data')).toBeInTheDocument();
    });

    it('shows empty state when no edges', () => {
      useSQLiteQueryMock.mockImplementation((sql: string) => {
        if (sql.includes('FROM nodes')) {
          return { data: mockNodes, loading: false, error: null, refetch: vi.fn() };
        }
        return { data: [], loading: false, error: null, refetch: vi.fn() };
      });

      render(<NetworkView />);

      expect(screen.getByText(/No edges defined/)).toBeInTheDocument();
    });
  });

  describe('SQL integration', () => {
    it('calls useSQLiteQuery for nodes and edges', () => {
      render(<NetworkView />);

      // Should have called useSQLiteQuery at least twice (nodes and edges)
      // May be called more times due to React strict mode or re-renders
      expect(useSQLiteQueryMock.mock.calls.length).toBeGreaterThanOrEqual(2);

      // Verify nodes query was called
      expect(useSQLiteQueryMock).toHaveBeenCalledWith(
        expect.stringContaining('FROM nodes'),
        expect.any(Array),
        expect.objectContaining({ transform: expect.any(Function) })
      );

      // Verify edges query was called
      expect(useSQLiteQueryMock).toHaveBeenCalledWith(
        expect.stringContaining('FROM edges'),
        expect.any(Array),
        expect.objectContaining({ transform: expect.any(Function) })
      );
    });

    it('transforms data to GraphNode/GraphLink format', () => {
      // The transform functions are called internally
      render(<NetworkView />);

      // Verify the query was made with transform option
      const nodesCall = useSQLiteQueryMock.mock.calls.find(
        (call: unknown[]) => (call[0] as string).includes('FROM nodes')
      );
      expect(nodesCall).toBeDefined();
      expect(nodesCall[2]).toHaveProperty('transform');
    });
  });

  describe('LATCH filter integration', () => {
    it('integrates with FilterContext', () => {
      render(<NetworkView />);

      // useFilters should be called
      expect(useFilters).toHaveBeenCalled();
    });

    it('compiles filters to SQL WHERE clause', () => {
      render(<NetworkView />);

      // compileFilters should be called with activeFilters
      expect(compileFilters).toHaveBeenCalledWith({});
    });

    it('re-queries when filters change', async () => {
      const { rerender } = render(<NetworkView />);

      // Clear mock call counts
      useSQLiteQueryMock.mockClear();

      // Change filters (mock returns different values)
      vi.mocked(useFilters).mockReturnValue({
        activeFilters: { category: { folders: ['work'] } },
      } as ReturnType<typeof useFilters>);

      vi.mocked(compileFilters).mockReturnValue({
        sql: "folder = ?",
        params: ['work'],
      });

      rerender(<NetworkView />);

      // useSQLiteQuery should be called again with new filter
      expect(useSQLiteQueryMock).toHaveBeenCalled();
    });
  });

  describe('simulation lifecycle', () => {
    it('calls useForceSimulation with correct config', () => {
      render(<NetworkView />);

      expect(useForceSimulation).toHaveBeenCalledWith(
        expect.objectContaining({
          containerRef: expect.any(Object),
          nodes: expect.any(Array),
          links: expect.any(Array),
          config: expect.objectContaining({ width: 800, height: 600 }),
          enabled: expect.any(Boolean),
          onTick: expect.any(Function),
        })
      );
    });

    it('enables simulation when nodes exist', () => {
      render(<NetworkView />);

      const lastCall = vi.mocked(useForceSimulation).mock.calls[
        vi.mocked(useForceSimulation).mock.calls.length - 1
      ];
      expect(lastCall[0].enabled).toBe(true);
    });

    it('disables simulation when loading', () => {
      useSQLiteQueryMock.mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: vi.fn(),
      });

      render(<NetworkView />);

      const lastCall = vi.mocked(useForceSimulation).mock.calls[
        vi.mocked(useForceSimulation).mock.calls.length - 1
      ];
      expect(lastCall[0].enabled).toBe(false);
    });
  });

  describe('selection integration', () => {
    it('integrates with SelectionContext', () => {
      render(<NetworkView />);

      expect(useSelection).toHaveBeenCalled();
    });

    it('registers scrollToNode on mount', () => {
      render(<NetworkView />);

      expect(mockRegisterScrollToNode).toHaveBeenCalledWith(expect.any(Function));
    });

    it('unregisters scrollToNode on unmount', () => {
      const { unmount } = render(<NetworkView />);

      unmount();

      expect(mockUnregisterScrollToNode).toHaveBeenCalled();
    });

    it('highlights selected nodes', () => {
      // Mock isSelected to return true for node-1
      mockIsSelected.mockImplementation((id: string) => id === 'node-1');

      render(<NetworkView />);

      // The selection styling is applied in the D3 rendering effect
      // We verify isSelected is called during render
      expect(mockIsSelected).toHaveBeenCalled();
    });
  });

  describe('graph analytics', () => {
    it('displays graph metrics overlay', async () => {
      render(<NetworkView />);

      // Wait for metrics to load
      await waitFor(() => {
        expect(screen.getByText('Graph Metrics')).toBeInTheDocument();
      });

      expect(screen.getByText('Nodes: 10')).toBeInTheDocument();
      expect(screen.getByText('Edges: 5')).toBeInTheDocument();
    });
  });
});

describe('ViewDispatcher network routing', () => {
  // Import ViewDispatcher in this describe block
  beforeEach(() => {
    vi.clearAllMocks();

    useSQLiteQueryMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM nodes')) {
        return { data: mockNodes, loading: false, error: null, refetch: vi.fn() };
      }
      return { data: mockEdges, loading: false, error: null, refetch: vi.fn() };
    });
  });

  it('routes to NetworkView for network mode', async () => {
    // Dynamic import to get fresh module
    const { ViewDispatcher } = await import('../ViewDispatcher');

    render(<ViewDispatcher activeView="network" />);

    // NetworkView renders an SVG
    expect(document.querySelector('svg')).toBeInTheDocument();
  });
});
