/**
 * useTimeline Unit Tests
 *
 * Tests for LATCH filter integration, temporal facet filtering,
 * date range filtering, and selection state management.
 *
 * Phase 114-01: Timeline View SQL Integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ============================================================================
// Mocks
// ============================================================================

// Mock useSQLiteQuery
const useSQLiteQueryMock = vi.fn();
vi.mock('../../database/useSQLiteQuery', () => ({
  useSQLiteQuery: (...args: unknown[]) => useSQLiteQueryMock(...args),
}));

// Mock FilterContext
const mockActiveFilters = vi.fn(() => ({}));
vi.mock('../../../state/FilterContext', () => ({
  useFilters: vi.fn(() => ({
    activeFilters: mockActiveFilters(),
  })),
}));

// Mock compileFilters
const mockCompileFilters = vi.fn(() => ({
  sql: 'deleted_at IS NULL',
  params: [],
}));
vi.mock('../../../filters/compiler', () => ({
  compileFilters: (...args: unknown[]) => mockCompileFilters(...args),
}));

// ============================================================================
// Import after mocks
// ============================================================================

import { useTimeline } from '../useTimeline';
import { useFilters } from '../../../state/FilterContext';

// ============================================================================
// Test Data
// ============================================================================

const ISO_DATE_1 = '2024-01-15T10:00:00Z';
const ISO_DATE_2 = '2024-02-20T15:30:00Z';
const ISO_DATE_3 = '2024-03-10T08:00:00Z';

const mockNodeRows = [
  {
    id: 'node-1',
    name: 'Project Alpha',
    folder: 'work',
    created_at: ISO_DATE_1,
    modified_at: ISO_DATE_2,
    due_at: null,
  },
  {
    id: 'node-2',
    name: 'Meeting Notes',
    folder: 'personal',
    created_at: ISO_DATE_2,
    modified_at: ISO_DATE_3,
    due_at: ISO_DATE_3,
  },
  {
    id: 'node-3',
    name: 'Untitled',
    folder: null,
    created_at: null, // No created_at — should be filtered
    modified_at: ISO_DATE_1,
    due_at: null,
  },
];

// ============================================================================
// Tests
// ============================================================================

describe('useTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock: return node rows
    useSQLiteQueryMock.mockReturnValue({
      data: mockNodeRows,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    mockActiveFilters.mockReturnValue({});
    mockCompileFilters.mockReturnValue({
      sql: 'deleted_at IS NULL',
      params: [],
    });
  });

  // ============================================================================
  // 1. Returns events from SQL query
  // ============================================================================

  describe('returns events from SQL query', () => {
    it('returns timeline events from query data', () => {
      const { result } = renderHook(() => useTimeline());

      // node-1 and node-2 have created_at, node-3 does not
      expect(result.current.events).toHaveLength(2);
      expect(result.current.events[0].id).toBe('node-1');
      expect(result.current.events[1].id).toBe('node-2');
    });

    it('transforms rows to TimelineEvent format', () => {
      const { result } = renderHook(() => useTimeline());

      const event = result.current.events[0];
      expect(event).toMatchObject({
        id: 'node-1',
        label: 'Project Alpha',
        track: 'work',
      });
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('sets track to "default" when folder is null', () => {
      useSQLiteQueryMock.mockReturnValue({
        data: [
          {
            id: 'node-null-folder',
            name: 'No Folder',
            folder: null,
            created_at: ISO_DATE_1,
            modified_at: null,
            due_at: null,
          },
        ],
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useTimeline());

      expect(result.current.events[0].track).toBe('default');
    });

    it('returns eventCount matching events length', () => {
      const { result } = renderHook(() => useTimeline());

      expect(result.current.eventCount).toBe(result.current.events.length);
    });

    it('handles empty results gracefully', () => {
      useSQLiteQueryMock.mockReturnValue({
        data: [],
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useTimeline());

      expect(result.current.events).toHaveLength(0);
      expect(result.current.eventCount).toBe(0);
      expect(result.current.tracks).toHaveLength(0);
    });

    it('returns loading state from query', () => {
      useSQLiteQueryMock.mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useTimeline());

      expect(result.current.loading).toBe(true);
      expect(result.current.events).toHaveLength(0);
    });

    it('returns error state from query', () => {
      const testError = new Error('Database connection failed');
      useSQLiteQueryMock.mockReturnValue({
        data: null,
        loading: false,
        error: testError,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useTimeline());

      expect(result.current.error).toBe(testError);
      expect(result.current.events).toHaveLength(0);
    });
  });

  // ============================================================================
  // 2. Filters by temporal facet
  // ============================================================================

  describe('filters by temporal facet', () => {
    it('queries with created_at facet by default', () => {
      renderHook(() => useTimeline());

      const sqlCall = useSQLiteQueryMock.mock.calls[0][0] as string;
      expect(sqlCall).toContain('created_at IS NOT NULL');
    });

    it('uses timestamp from the selected facet', () => {
      // Default facet is created_at, so timestamps should use created_at values
      const { result } = renderHook(() => useTimeline());

      const event1 = result.current.events.find(e => e.id === 'node-1');
      expect(event1?.timestamp).toEqual(new Date(ISO_DATE_1));
    });

    it('changes facet when setFacet is called', () => {
      const { result } = renderHook(() => useTimeline());

      expect(result.current.facet).toBe('created_at');

      act(() => {
        result.current.setFacet('modified_at');
      });

      expect(result.current.facet).toBe('modified_at');

      // Verify new query uses modified_at
      const lastSqlCall =
        useSQLiteQueryMock.mock.calls[useSQLiteQueryMock.mock.calls.length - 1][0] as string;
      expect(lastSqlCall).toContain('modified_at IS NOT NULL');
    });

    it('uses due_at timestamps when due_at facet is selected', () => {
      const { result } = renderHook(() =>
        useTimeline({ initialFacet: 'due_at' })
      );

      // Only node-2 has due_at
      // node-3 has no due_at — but useSQLiteQuery filters at DB level
      // Our mock returns all rows, so we filter in transform
      const event2 = result.current.events.find(e => e.id === 'node-2');
      expect(event2?.timestamp).toEqual(new Date(ISO_DATE_3));
    });

    it('excludes events with invalid/null timestamps for current facet', () => {
      const { result } = renderHook(() =>
        useTimeline({ initialFacet: 'due_at' })
      );

      // node-1 has no due_at, node-3 has no due_at → they should be excluded
      const eventIds = result.current.events.map(e => e.id);
      expect(eventIds).not.toContain('node-1');
      expect(eventIds).not.toContain('node-3');
    });
  });

  // ============================================================================
  // 3. Applies LATCH filters via compileFilters
  // ============================================================================

  describe('applies LATCH filters via compileFilters', () => {
    it('calls useFilters to get active filters', () => {
      renderHook(() => useTimeline());

      expect(useFilters).toHaveBeenCalled();
    });

    it('calls compileFilters with activeFilters', () => {
      const testFilters = { category: { folders: ['work'] } };
      mockActiveFilters.mockReturnValue(testFilters);
      vi.mocked(useFilters).mockReturnValue({ activeFilters: testFilters });

      renderHook(() => useTimeline());

      // mockCompileFilters is the spy underlying the vi.mock
      expect(mockCompileFilters).toHaveBeenCalledWith(testFilters);
    });

    it('includes compiled filter SQL in the query', () => {
      mockCompileFilters.mockReturnValue({
        sql: "deleted_at IS NULL AND folder = ?",
        params: ['work'],
      });

      renderHook(() => useTimeline());

      const sqlCall = useSQLiteQueryMock.mock.calls[0][0] as string;
      expect(sqlCall).toContain("deleted_at IS NULL AND folder = ?");
    });

    it('includes compiled filter params in query params', () => {
      mockCompileFilters.mockReturnValue({
        sql: "deleted_at IS NULL AND folder = ?",
        params: ['work'],
      });

      renderHook(() => useTimeline());

      const paramsCall = useSQLiteQueryMock.mock.calls[0][1] as unknown[];
      // params = [...filterParams, limit] = ['work', 500]
      expect(paramsCall).toContain('work');
    });
  });

  // ============================================================================
  // 4. Updates when filters change
  // ============================================================================

  describe('updates when filters change', () => {
    it('re-runs query when filters change', () => {
      const { rerender } = renderHook(() => useTimeline());

      const initialCallCount = useSQLiteQueryMock.mock.calls.length;

      // Simulate filter change
      mockActiveFilters.mockReturnValue({ category: { folders: ['personal'] } });
      mockCompileFilters.mockReturnValue({
        sql: "deleted_at IS NULL AND folder = ?",
        params: ['personal'],
      });
      vi.mocked(useFilters).mockReturnValue({
        activeFilters: { category: { folders: ['personal'] } },
      });

      rerender();

      // useSQLiteQuery should be called again
      expect(useSQLiteQueryMock.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  // ============================================================================
  // 5. Handles empty results gracefully
  // ============================================================================

  describe('handles null data gracefully', () => {
    it('returns empty events when data is null', () => {
      useSQLiteQueryMock.mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useTimeline());

      expect(result.current.events).toEqual([]);
    });

    it('returns empty tracks when no events', () => {
      useSQLiteQueryMock.mockReturnValue({
        data: [],
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useTimeline());

      expect(result.current.tracks).toEqual([]);
    });
  });

  // ============================================================================
  // 6. Applies date range filter
  // ============================================================================

  describe('applies date range filter', () => {
    it('includes date range in SQL when dateRange is set', () => {
      const { result } = renderHook(() => useTimeline());

      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');

      act(() => {
        result.current.setDateRange([start, end]);
      });

      const lastSqlCall =
        useSQLiteQueryMock.mock.calls[useSQLiteQueryMock.mock.calls.length - 1][0] as string;
      expect(lastSqlCall).toContain('>= ?');
      expect(lastSqlCall).toContain('<= ?');
    });

    it('includes date range params in query', () => {
      const { result } = renderHook(() => useTimeline());

      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');

      act(() => {
        result.current.setDateRange([start, end]);
      });

      const lastParamsCall =
        useSQLiteQueryMock.mock.calls[useSQLiteQueryMock.mock.calls.length - 1][1] as unknown[];
      expect(lastParamsCall).toContain(start.toISOString());
      expect(lastParamsCall).toContain(end.toISOString());
    });

    it('normalizes inverted date ranges (start > end)', () => {
      const { result } = renderHook(() => useTimeline());

      const later = new Date('2024-12-31');
      const earlier = new Date('2024-01-01');

      act(() => {
        result.current.setDateRange([later, earlier]); // inverted
      });

      // Should normalize to [earlier, later]
      expect(result.current.dateRange![0]).toEqual(earlier);
      expect(result.current.dateRange![1]).toEqual(later);
    });

    it('clears date range when setDateRange(null) is called', () => {
      const { result } = renderHook(() => useTimeline());

      act(() => {
        result.current.setDateRange([new Date('2024-01-01'), new Date('2024-12-31')]);
      });

      expect(result.current.dateRange).not.toBeNull();

      act(() => {
        result.current.setDateRange(null);
      });

      expect(result.current.dateRange).toBeNull();
    });
  });

  // ============================================================================
  // 7. Tracks selected event ID
  // ============================================================================

  describe('tracks selected event ID', () => {
    it('initializes with null selectedEventId', () => {
      const { result } = renderHook(() => useTimeline());

      expect(result.current.selectedEventId).toBeNull();
    });

    it('updates selectedEventId when setSelectedEventId is called', () => {
      const { result } = renderHook(() => useTimeline());

      act(() => {
        result.current.setSelectedEventId('node-1');
      });

      expect(result.current.selectedEventId).toBe('node-1');
    });

    it('clears selectedEventId when set to null', () => {
      const { result } = renderHook(() => useTimeline());

      act(() => {
        result.current.setSelectedEventId('node-1');
      });

      act(() => {
        result.current.setSelectedEventId(null);
      });

      expect(result.current.selectedEventId).toBeNull();
    });
  });

  // ============================================================================
  // 8. Tracks extraction
  // ============================================================================

  describe('track extraction', () => {
    it('extracts unique tracks from events', () => {
      const { result } = renderHook(() => useTimeline());

      // work, personal from node-1 and node-2
      expect(result.current.tracks).toContain('work');
      expect(result.current.tracks).toContain('personal');
    });

    it('sorts tracks alphabetically', () => {
      const { result } = renderHook(() => useTimeline());

      const tracks = result.current.tracks;
      const sorted = [...tracks].sort();
      expect(tracks).toEqual(sorted);
    });
  });
});
