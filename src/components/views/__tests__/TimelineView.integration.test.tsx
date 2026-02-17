/**
 * TimelineView Integration Tests
 *
 * Tests for TimelineTab SQL data rendering, LATCH filter integration,
 * adaptive zoom labels, selection sync, and event rendering.
 *
 * Phase 114-01: Timeline View SQL Integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// ============================================================================
// Module mocks — declared before any imports of the component under test
// ============================================================================

// Mock useTimeline — prevents loading sql.js / SQLite transitive deps
vi.mock('@/hooks/visualization/useTimeline', () => ({
  useTimeline: vi.fn(() => ({
    events: [],
    loading: false,
    error: null,
    facet: 'created_at',
    setFacet: vi.fn(),
    dateRange: null,
    setDateRange: vi.fn(),
    tracks: [],
    selectedEventId: null,
    setSelectedEventId: vi.fn(),
    refresh: vi.fn(),
    eventCount: 0,
  })),
  FACET_LABELS: { created_at: 'Created', modified_at: 'Modified', due_at: 'Due' },
}));

// Mock SelectionContext
vi.mock('@/state/SelectionContext', () => ({
  useSelection: vi.fn(() => ({
    select: vi.fn(),
    isSelected: vi.fn(() => false),
    registerScrollToNode: vi.fn(),
    unregisterScrollToNode: vi.fn(),
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

// Mock ThemeContext
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: vi.fn(() => ({ theme: 'Modern' })),
}));

// Mock D3 timeline renderer (used directly by TimelineTab)
vi.mock('@/d3/visualizations/timeline', () => {
  return {
    TimelineRenderer: class FakeTimelineRenderer {
      render() {}
      update() {}
      getXScale() { return null; }
      destroy() {}
    },
    createTimelineZoom: () => ({ zoom: {}, resetZoom: () => {}, getTransform: () => ({}) }),
    applyTimelineZoom: () => {},
    getAdaptiveTickFormat: () => '%b %d',
  };
});

// Mock zoom sub-module (also directly imported by TimelineTab)
vi.mock('@/d3/visualizations/timeline/zoom', () => ({
  createTimelineZoom: () => ({ zoom: {}, resetZoom: () => {}, getTransform: () => ({}) }),
  applyTimelineZoom: () => {},
}));

// Mock FilterContext (transitively used by useTimeline, though useTimeline is mocked)
vi.mock('@/state/FilterContext', () => ({
  useFilters: vi.fn(() => ({ activeFilters: {} })),
}));

// Mock compileFilters
vi.mock('@/filters/compiler', () => ({
  compileFilters: vi.fn(() => ({ sql: 'deleted_at IS NULL', params: [] })),
}));

// Mock useSQLiteQuery
vi.mock('@/hooks/database/useSQLiteQuery', () => ({
  useSQLiteQuery: vi.fn(() => ({ data: [], loading: false, error: null, refetch: vi.fn() })),
}));

// ============================================================================
// Component import (after all mocks)
// ============================================================================

import { TimelineTab } from '../../notebook/preview-tabs/TimelineTab';
import { useTimeline } from '@/hooks/visualization/useTimeline';
import { useSelection } from '@/state/SelectionContext';

// ============================================================================
// Test Data
// ============================================================================

const ISO_DATE_1 = '2024-01-15T10:00:00Z';
const ISO_DATE_2 = '2024-06-20T15:30:00Z';

const mockEvents = [
  {
    id: 'event-1',
    label: 'Project Alpha Launch',
    timestamp: new Date(ISO_DATE_1),
    track: 'work',
  },
  {
    id: 'event-2',
    label: 'Team Meeting',
    timestamp: new Date(ISO_DATE_2),
    track: 'work',
  },
  {
    id: 'event-3',
    label: 'Personal Goal',
    timestamp: new Date(ISO_DATE_1),
    track: 'personal',
  },
];

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  });

  // Reset to defaults
  vi.mocked(useTimeline).mockReturnValue({
    events: [],
    loading: false,
    error: null,
    facet: 'created_at',
    setFacet: vi.fn(),
    dateRange: null,
    setDateRange: vi.fn(),
    tracks: [],
    selectedEventId: null,
    setSelectedEventId: vi.fn(),
    refresh: vi.fn(),
    eventCount: 0,
  });

  vi.mocked(useSelection).mockReturnValue({
    select: vi.fn(),
    isSelected: vi.fn(() => false),
    registerScrollToNode: vi.fn(),
    unregisterScrollToNode: vi.fn(),
    selection: { selectedIds: new Set(), anchorId: null, lastSelectedId: null },
    deselect: vi.fn(),
    toggle: vi.fn(),
    selectRange: vi.fn(),
    selectMultiple: vi.fn(),
    clear: vi.fn(),
    setCells: vi.fn(),
    scrollToNode: null,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ============================================================================
// Tests
// ============================================================================

describe('TimelineTab integration', () => {

  // ============================================================================
  // 1. Renders timeline with SQL data
  // ============================================================================

  describe('renders timeline with SQL data', () => {
    it('renders without crashing', () => {
      render(<TimelineTab />);
      expect(document.querySelector('svg')).toBeInTheDocument();
    });

    it('shows loading state when data is loading', () => {
      vi.mocked(useTimeline).mockReturnValue({
        events: [],
        loading: true,
        error: null,
        facet: 'created_at',
        setFacet: vi.fn(),
        dateRange: null,
        setDateRange: vi.fn(),
        tracks: [],
        selectedEventId: null,
        setSelectedEventId: vi.fn(),
        refresh: vi.fn(),
        eventCount: 0,
      });
      render(<TimelineTab />);
      expect(screen.getByText('Loading timeline data...')).toBeInTheDocument();
    });

    it('shows error state when query fails', () => {
      vi.mocked(useTimeline).mockReturnValue({
        events: [],
        loading: false,
        error: new Error('Database error'),
        facet: 'created_at',
        setFacet: vi.fn(),
        dateRange: null,
        setDateRange: vi.fn(),
        tracks: [],
        selectedEventId: null,
        setSelectedEventId: vi.fn(),
        refresh: vi.fn(),
        eventCount: 0,
      });
      render(<TimelineTab />);
      expect(screen.getByText('Error loading timeline')).toBeInTheDocument();
    });

    it('shows empty state when no events', () => {
      render(<TimelineTab />);
      expect(screen.getByText(/No events with/)).toBeInTheDocument();
    });

    it('renders facet selector in empty state', () => {
      render(<TimelineTab />);
      // Empty state renders a facet select
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0);
    });

    it('renders toolbar with facet label when events present', () => {
      vi.mocked(useTimeline).mockReturnValue({
        events: mockEvents,
        loading: false,
        error: null,
        facet: 'created_at',
        setFacet: vi.fn(),
        dateRange: null,
        setDateRange: vi.fn(),
        tracks: ['work', 'personal'],
        selectedEventId: null,
        setSelectedEventId: vi.fn(),
        refresh: vi.fn(),
        eventCount: 3,
      });
      render(<TimelineTab />);
      expect(screen.getByText('Facet:')).toBeInTheDocument();
    });

    it('renders date range inputs when events present', () => {
      vi.mocked(useTimeline).mockReturnValue({
        events: mockEvents,
        loading: false,
        error: null,
        facet: 'created_at',
        setFacet: vi.fn(),
        dateRange: null,
        setDateRange: vi.fn(),
        tracks: ['work'],
        selectedEventId: null,
        setSelectedEventId: vi.fn(),
        refresh: vi.fn(),
        eventCount: 3,
      });
      render(<TimelineTab />);
      const dateInputs = document.querySelectorAll('input[type="date"]');
      expect(dateInputs).toHaveLength(2);
    });
  });

  // ============================================================================
  // 2. Applies LATCH filters
  // ============================================================================

  describe('applies LATCH filters', () => {
    it('calls useTimeline hook', () => {
      render(<TimelineTab />);
      expect(vi.mocked(useTimeline)).toHaveBeenCalled();
    });

    it('passes maxEvents to useTimeline', () => {
      render(<TimelineTab maxEvents={250} />);
      expect(vi.mocked(useTimeline)).toHaveBeenCalledWith(
        expect.objectContaining({ maxEvents: 250 })
      );
    });

    it('calls useTimeline with default maxEvents=500', () => {
      render(<TimelineTab />);
      expect(vi.mocked(useTimeline)).toHaveBeenCalledWith(
        expect.objectContaining({ maxEvents: 500 })
      );
    });

    it('re-renders when LATCH filters produce new events', async () => {
      const { rerender } = render(<TimelineTab />);

      vi.mocked(useTimeline).mockReturnValue({
        events: mockEvents,
        loading: false,
        error: null,
        facet: 'created_at',
        setFacet: vi.fn(),
        dateRange: null,
        setDateRange: vi.fn(),
        tracks: ['work', 'personal'],
        selectedEventId: null,
        setSelectedEventId: vi.fn(),
        refresh: vi.fn(),
        eventCount: 3,
      });

      rerender(<TimelineTab />);

      await waitFor(() => {
        expect(screen.getByText('Facet:')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // 3. Zoom controls
  // ============================================================================

  describe('zoom controls', () => {
    beforeEach(() => {
      vi.mocked(useTimeline).mockReturnValue({
        events: mockEvents,
        loading: false,
        error: null,
        facet: 'created_at',
        setFacet: vi.fn(),
        dateRange: null,
        setDateRange: vi.fn(),
        tracks: ['work'],
        selectedEventId: null,
        setSelectedEventId: vi.fn(),
        refresh: vi.fn(),
        eventCount: 3,
      });
    });

    it('renders zoom reset button', () => {
      render(<TimelineTab />);
      const resetButton = document.querySelector('button[title="Reset zoom"]');
      expect(resetButton).toBeInTheDocument();
    });

    it('renders refresh button', () => {
      render(<TimelineTab />);
      const refreshButton = document.querySelector('button[title="Refresh"]');
      expect(refreshButton).toBeInTheDocument();
    });
  });

  // ============================================================================
  // 4. Syncs selection with SelectionContext
  // ============================================================================

  describe('syncs selection with SelectionContext', () => {
    it('calls useSelection hook', () => {
      render(<TimelineTab />);
      expect(vi.mocked(useSelection)).toHaveBeenCalled();
    });

    it('registers scrollToNode on mount', () => {
      const registerScrollToNode = vi.fn();
      vi.mocked(useSelection).mockReturnValue({
        select: vi.fn(),
        isSelected: vi.fn(() => false),
        registerScrollToNode,
        unregisterScrollToNode: vi.fn(),
        selection: { selectedIds: new Set(), anchorId: null, lastSelectedId: null },
        deselect: vi.fn(),
        toggle: vi.fn(),
        selectRange: vi.fn(),
        selectMultiple: vi.fn(),
        clear: vi.fn(),
        setCells: vi.fn(),
        scrollToNode: null,
      });

      render(<TimelineTab />);
      expect(registerScrollToNode).toHaveBeenCalledWith(expect.any(Function));
    });

    it('unregisters scrollToNode on unmount', () => {
      const unregisterScrollToNode = vi.fn();
      vi.mocked(useSelection).mockReturnValue({
        select: vi.fn(),
        isSelected: vi.fn(() => false),
        registerScrollToNode: vi.fn(),
        unregisterScrollToNode,
        selection: { selectedIds: new Set(), anchorId: null, lastSelectedId: null },
        deselect: vi.fn(),
        toggle: vi.fn(),
        selectRange: vi.fn(),
        selectMultiple: vi.fn(),
        clear: vi.fn(),
        setCells: vi.fn(),
        scrollToNode: null,
      });

      const { unmount } = render(<TimelineTab />);
      unmount();
      expect(unregisterScrollToNode).toHaveBeenCalled();
    });

    it('shows selected event overlay when event is selected', () => {
      vi.mocked(useTimeline).mockReturnValue({
        events: mockEvents,
        loading: false,
        error: null,
        facet: 'created_at',
        setFacet: vi.fn(),
        dateRange: null,
        setDateRange: vi.fn(),
        tracks: ['work', 'personal'],
        selectedEventId: 'event-1',
        setSelectedEventId: vi.fn(),
        refresh: vi.fn(),
        eventCount: 3,
      });

      vi.mocked(useSelection).mockReturnValue({
        select: vi.fn(),
        isSelected: vi.fn(() => false),
        registerScrollToNode: vi.fn(),
        unregisterScrollToNode: vi.fn(),
        selection: {
          selectedIds: new Set(['event-1']),
          anchorId: null,
          lastSelectedId: 'event-1',
        },
        deselect: vi.fn(),
        toggle: vi.fn(),
        selectRange: vi.fn(),
        selectMultiple: vi.fn(),
        clear: vi.fn(),
        setCells: vi.fn(),
        scrollToNode: null,
      });

      render(<TimelineTab />);
      expect(screen.getByText('Selected Event')).toBeInTheDocument();
      expect(screen.getByText('Project Alpha Launch')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // 5. Handles large event datasets
  // ============================================================================

  describe('renders with 500 events', () => {
    it('accepts maxEvents=500 prop without crashing', () => {
      const largeDataset = Array.from({ length: 500 }, (_, i) => ({
        id: `event-${i}`,
        label: `Event ${i}`,
        timestamp: new Date(2024, 0, 1 + (i % 365)),
        track: i % 5 === 0 ? 'work' : 'personal',
      }));

      vi.mocked(useTimeline).mockReturnValue({
        events: largeDataset,
        loading: false,
        error: null,
        facet: 'created_at',
        setFacet: vi.fn(),
        dateRange: null,
        setDateRange: vi.fn(),
        tracks: ['work', 'personal'],
        selectedEventId: null,
        setSelectedEventId: vi.fn(),
        refresh: vi.fn(),
        eventCount: 500,
      });

      expect(() => render(<TimelineTab maxEvents={500} />)).not.toThrow();
    });

    it('passes maxEvents=250 to useTimeline as hook option', () => {
      render(<TimelineTab maxEvents={250} />);
      expect(vi.mocked(useTimeline)).toHaveBeenCalledWith(
        expect.objectContaining({ maxEvents: 250 })
      );
    });
  });

  // ============================================================================
  // 6. Facet selector
  // ============================================================================

  describe('facet selector', () => {
    beforeEach(() => {
      vi.mocked(useTimeline).mockReturnValue({
        events: mockEvents,
        loading: false,
        error: null,
        facet: 'created_at',
        setFacet: vi.fn(),
        dateRange: null,
        setDateRange: vi.fn(),
        tracks: ['work'],
        selectedEventId: null,
        setSelectedEventId: vi.fn(),
        refresh: vi.fn(),
        eventCount: 3,
      });
    });

    it('renders Created facet option', () => {
      render(<TimelineTab />);
      const options = screen.getAllByRole('option', { name: 'Created' });
      expect(options.length).toBeGreaterThan(0);
    });

    it('renders Modified facet option', () => {
      render(<TimelineTab />);
      const options = screen.getAllByRole('option', { name: 'Modified' });
      expect(options.length).toBeGreaterThan(0);
    });

    it('renders Due facet option', () => {
      render(<TimelineTab />);
      const options = screen.getAllByRole('option', { name: 'Due' });
      expect(options.length).toBeGreaterThan(0);
    });
  });
});
