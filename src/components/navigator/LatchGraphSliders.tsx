/**
 * LatchGraphSliders - LATCH*GRAPH filtering controls
 *
 * Provides slider-based filtering for LATCH dimensions:
 * - Time: Filter by date range (created_at, modified_at)
 * - Hierarchy: Filter by priority/importance level
 * - Category: Filter by specific values (future: multi-select)
 *
 * And GRAPH dimensions (future):
 * - Link: Filter by connection degree
 * - Affinity: Filter by relationship strength
 */

import { useState, useCallback, useMemo } from 'react';
import { Slider } from '@/components/ui/slider';

export interface SliderFilter {
  id: string;
  label: string;
  dimension: 'L' | 'A' | 'T' | 'C' | 'H' | 'G';
  property: string;
  min: number;
  max: number;
  value: [number, number];
  formatLabel?: (value: number) => string;
}

export interface LatchGraphSlidersProps {
  /** Available filters based on current data */
  filters: SliderFilter[];
  /** Callback when filter values change */
  onFilterChange: (filterId: string, value: [number, number]) => void;
  /** Whether to show collapsed or expanded view */
  collapsed?: boolean;
}

/**
 * Format a timestamp for display
 */
function formatTimestamp(timestamp: number): string {
  if (timestamp === 0) return 'Any';
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Format a priority level for display
 */
function formatPriority(value: number): string {
  const labels = ['None', 'Low', 'Medium', 'High', 'Critical'];
  return labels[Math.min(value, labels.length - 1)] || String(value);
}

/**
 * Single slider filter control
 */
function SliderFilterControl({
  filter,
  onChange
}: {
  filter: SliderFilter;
  onChange: (value: [number, number]) => void;
}) {
  const formatLabel = filter.formatLabel || ((v: number) => String(v));

  // Dimension icons
  const dimensionIcons: Record<string, string> = {
    'L': '📍',
    'A': '🔤',
    'T': '⏰',
    'C': '📁',
    'H': '📊',
    'G': '🔗',
  };

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2 bg-card/50 rounded border border-border/50">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <span>{dimensionIcons[filter.dimension] || '•'}</span>
          {filter.label}
        </span>
        <span className="text-muted-foreground">
          {formatLabel(filter.value[0])} — {formatLabel(filter.value[1])}
        </span>
      </div>
      <Slider
        min={filter.min}
        max={filter.max}
        step={1}
        value={filter.value}
        onValueChange={(v) => onChange(v as [number, number])}
        className="w-full"
      />
    </div>
  );
}

/**
 * LatchGraphSliders Component
 *
 * Displays filtering sliders for LATCH dimensions based on
 * the current data's property classification.
 */
export function LatchGraphSliders({
  filters,
  onFilterChange,
  collapsed = false,
}: LatchGraphSlidersProps) {
  if (collapsed || filters.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 p-2 bg-muted/30 border-t border-border">
      <div className="flex items-center gap-2 px-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Filters
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {filters.map((filter) => (
          <SliderFilterControl
            key={filter.id}
            filter={filter}
            onChange={(value) => onFilterChange(filter.id, value)}
          />
        ))}
      </div>
    </div>
  );
}

/** Classification input type (matches PropertyClassification) */
export interface SliderClassification {
  T: Array<{ sourceColumn: string; name: string }>;
  H: Array<{ sourceColumn: string; name: string }>;
}

/**
 * Hook to generate slider filters from data statistics
 */
export function useSliderFilters(
  data: Array<Record<string, unknown>> | null,
  classification: SliderClassification | null
): {
  filters: SliderFilter[];
  activeFilters: Map<string, [number, number]>;
  setFilterValue: (id: string, value: [number, number]) => void;
  buildWhereClause: () => { clause: string; params: (string | number)[] };
  resetFilters: () => void;
} {
  const [activeFilters, setActiveFilters] = useState<Map<string, [number, number]>>(new Map());

  // Generate filters from data and classification
  const filters = useMemo<SliderFilter[]>(() => {
    if (!data || data.length === 0 || !classification) return [];

    const result: SliderFilter[] = [];

    // Time filters (created_at, modified_at)
    for (const prop of classification.T) {
      const timestamps = data
        .map(d => d[prop.sourceColumn])
        .filter((v): v is string => typeof v === 'string')
        .map(v => new Date(v).getTime())
        .filter(t => !isNaN(t));

      if (timestamps.length > 0) {
        const min = Math.min(...timestamps);
        const max = Math.max(...timestamps);

        if (min !== max) {
          const currentValue = activeFilters.get(`time-${prop.sourceColumn}`) || [min, max];
          result.push({
            id: `time-${prop.sourceColumn}`,
            label: prop.name,
            dimension: 'T',
            property: prop.sourceColumn,
            min,
            max,
            value: currentValue,
            formatLabel: formatTimestamp,
          });
        }
      }
    }

    // Hierarchy filters (priority, importance)
    for (const prop of classification.H) {
      const values = data
        .map(d => d[prop.sourceColumn])
        .filter((v): v is number => typeof v === 'number');

      if (values.length > 0) {
        const min = Math.min(...values);
        const max = Math.max(...values);

        if (min !== max) {
          const currentValue = activeFilters.get(`hierarchy-${prop.sourceColumn}`) || [min, max];
          result.push({
            id: `hierarchy-${prop.sourceColumn}`,
            label: prop.name,
            dimension: 'H',
            property: prop.sourceColumn,
            min,
            max,
            value: currentValue,
            formatLabel: prop.sourceColumn === 'priority' ? formatPriority : undefined,
          });
        }
      }
    }

    return result;
  }, [data, classification, activeFilters]);

  // Update filter value
  const setFilterValue = useCallback((id: string, value: [number, number]) => {
    setActiveFilters(prev => {
      const next = new Map(prev);
      next.set(id, value);
      return next;
    });
  }, []);

  // Build SQL WHERE clause from active filters
  const buildWhereClause = useCallback((): { clause: string; params: (string | number)[] } => {
    const clauses: string[] = [];
    const params: (string | number)[] = [];

    for (const filter of filters) {
      const filterValue = activeFilters.get(filter.id);
      if (!filterValue) continue;

      const [min, max] = filterValue;
      // Only add clause if range is narrower than full range
      if (min > filter.min || max < filter.max) {
        if (filter.dimension === 'T') {
          // For time columns, compare ISO strings
          const minDate = new Date(min).toISOString();
          const maxDate = new Date(max).toISOString();
          clauses.push(`${filter.property} >= ? AND ${filter.property} <= ?`);
          params.push(minDate, maxDate);
        } else if (filter.dimension === 'H') {
          clauses.push(`${filter.property} >= ? AND ${filter.property} <= ?`);
          params.push(min, max);
        }
      }
    }

    return {
      clause: clauses.length > 0 ? clauses.join(' AND ') : '',
      params,
    };
  }, [filters, activeFilters]);

  // Reset all filters to full range
  const resetFilters = useCallback(() => {
    setActiveFilters(new Map());
  }, []);

  return {
    filters,
    activeFilters,
    setFilterValue,
    buildWhereClause,
    resetFilters,
  };
}

export default LatchGraphSliders;
