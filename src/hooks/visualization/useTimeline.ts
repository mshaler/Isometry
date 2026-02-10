/**
 * useTimeline Hook
 *
 * React hook for managing timeline data from sql.js database.
 * Queries nodes by temporal LATCH facets (created_at, modified_at, due_at),
 * transforms to TimelineEvent format, and manages facet/date filtering.
 */

import { useState, useMemo, useCallback } from 'react';
import { useSQLiteQuery } from '../database/useSQLiteQuery';
import type { TimelineEvent } from '../../d3/visualizations/timeline/types';

// ============================================================================
// Types
// ============================================================================

/** Temporal LATCH facets available for timeline */
export type TemporalFacet = 'created_at' | 'modified_at' | 'due_at';

/** Hook options */
export interface UseTimelineOptions {
  /** Initial temporal facet (default: 'created_at') */
  initialFacet?: TemporalFacet;
  /** Maximum events to load (default: 500) */
  maxEvents?: number;
  /** Enable/disable the hook (default: true) */
  enabled?: boolean;
}

/** Hook result */
export interface UseTimelineResult {
  /** Timeline events transformed from nodes */
  events: TimelineEvent[];
  /** Loading state */
  loading: boolean;
  /** Error if any */
  error: Error | null;
  /** Current temporal facet */
  facet: TemporalFacet;
  /** Change facet */
  setFacet: (facet: TemporalFacet) => void;
  /** Date range filter [start, end] or null for all */
  dateRange: [Date, Date] | null;
  /** Set date range filter */
  setDateRange: (range: [Date, Date] | null) => void;
  /** Unique track names (folders) */
  tracks: string[];
  /** Currently selected event ID */
  selectedEventId: string | null;
  /** Set selected event */
  setSelectedEventId: (id: string | null) => void;
  /** Refresh data from database */
  refresh: () => void;
  /** Event count */
  eventCount: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: Required<UseTimelineOptions> = {
  initialFacet: 'created_at',
  maxEvents: 500,
  enabled: true,
};

/** Facet display names */
export const FACET_LABELS: Record<TemporalFacet, string> = {
  created_at: 'Created',
  modified_at: 'Modified',
  due_at: 'Due',
};

// ============================================================================
// Row Types
// ============================================================================

interface NodeRow {
  id: string;
  name: string;
  folder: string | null;
  created_at: string | null;
  modified_at: string | null;
  due_at: string | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useTimeline(options: UseTimelineOptions = {}): UseTimelineResult {
  // Merge with defaults
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Local state
  const [facet, setFacet] = useState<TemporalFacet>(opts.initialFacet);
  const [dateRange, setDateRangeInternal] = useState<[Date, Date] | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Date range setter that normalizes order
  const setDateRange = useCallback((range: [Date, Date] | null) => {
    if (!range) {
      setDateRangeInternal(null);
      return;
    }
    // Ensure start <= end
    const [start, end] = range;
    if (start > end) {
      setDateRangeInternal([end, start]);
    } else {
      setDateRangeInternal([start, end]);
    }
  }, []);

  // Build SQL query based on facet and date range
  const sql = useMemo(() => {
    const baseQuery = `
      SELECT id, name, folder, created_at, modified_at, due_at
      FROM nodes
      WHERE ${facet} IS NOT NULL
        AND deleted_at IS NULL
    `;

    if (dateRange) {
      return `${baseQuery}
        AND ${facet} >= ?
        AND ${facet} <= ?
      ORDER BY ${facet} DESC
      LIMIT ?`;
    }

    return `${baseQuery}
      ORDER BY ${facet} DESC
      LIMIT ?`;
  }, [facet, dateRange]);

  // Build query params
  const params = useMemo(() => {
    if (dateRange) {
      return [
        dateRange[0].toISOString(),
        dateRange[1].toISOString(),
        opts.maxEvents,
      ];
    }
    return [opts.maxEvents];
  }, [dateRange, opts.maxEvents]);

  // Query database
  const query = useSQLiteQuery<NodeRow>(sql, params, { enabled: opts.enabled });

  // Transform rows to TimelineEvent format
  const events: TimelineEvent[] = useMemo(() => {
    if (!query.data) return [];

    return query.data
      .map(row => {
        // Get timestamp from selected facet
        const timestampStr = row[facet];
        if (!timestampStr) return null;

        const timestamp = new Date(timestampStr);
        // Filter out invalid dates (NaN check)
        if (isNaN(timestamp.getTime())) return null;

        return {
          id: row.id,
          timestamp,
          label: row.name || 'Untitled',
          track: row.folder || 'default',
        };
      })
      .filter((event): event is TimelineEvent => event !== null);
  }, [query.data, facet]);

  // Extract unique tracks for Y-axis
  const tracks = useMemo(() => {
    const trackSet = new Set(events.map(e => e.track));
    return [...trackSet].sort();
  }, [events]);

  // Refresh function
  const refresh = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    events,
    loading: query.loading,
    error: query.error,
    facet,
    setFacet,
    dateRange,
    setDateRange,
    tracks,
    selectedEventId,
    setSelectedEventId,
    refresh,
    eventCount: events.length,
  };
}

export default useTimeline;
