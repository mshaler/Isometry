/**
 * LatchGraphSliders.test.tsx - Tests for LATCH*GRAPH slider filtering
 *
 * Tests:
 * - Component rendering (empty state, with filters)
 * - Slider interaction callbacks
 * - useSliderFilters hook filter generation
 * - WHERE clause compilation
 * - Reset functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import {
  LatchGraphSliders,
  useSliderFilters,
  type SliderFilter,
  type SliderClassification,
} from '../LatchGraphSliders';

// Mock compileFilterPredicates
vi.mock('@/services/query/filterAst', () => ({
  compileFilterPredicates: vi.fn((predicates) => ({
    whereClause: predicates.map((p: { field: string; value: [number, number] }) =>
      `${p.field} BETWEEN ? AND ?`
    ).join(' AND '),
    parameters: predicates.flatMap((p: { value: [number, number] }) => p.value),
  })),
}));

describe('LatchGraphSliders Component', () => {
  const mockOnFilterChange = vi.fn();
  const mockOnResetFilters = vi.fn();

  const sampleFilters: SliderFilter[] = [
    {
      id: 'time-created_at',
      label: 'Created',
      dimension: 'T',
      property: 'created_at',
      min: 1704067200000, // 2024-01-01
      max: 1735689600000, // 2025-01-01
      value: [1704067200000, 1735689600000],
      formatLabel: (v) => new Date(v).toLocaleDateString(),
    },
    {
      id: 'hierarchy-priority',
      label: 'Priority',
      dimension: 'H',
      property: 'priority',
      min: 0,
      max: 4,
      value: [1, 3],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no filters provided', () => {
    render(
      <LatchGraphSliders
        filters={[]}
        onFilterChange={mockOnFilterChange}
        emptyStateMessage="No filters available"
      />
    );

    expect(screen.getByText('No filters available')).toBeInTheDocument();
  });

  it('renders filter controls when filters provided', () => {
    render(
      <LatchGraphSliders
        filters={sampleFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
  });

  it('shows dimension icons for each filter', () => {
    render(
      <LatchGraphSliders
        filters={sampleFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    // Time and Hierarchy icons
    expect(screen.getByText('⏰')).toBeInTheDocument();
    expect(screen.getByText('📊')).toBeInTheDocument();
  });

  it('renders nothing when collapsed', () => {
    const { container } = render(
      <LatchGraphSliders
        filters={sampleFilters}
        onFilterChange={mockOnFilterChange}
        collapsed
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('shows reset button in empty state when onResetFilters provided', () => {
    render(
      <LatchGraphSliders
        filters={[]}
        onFilterChange={mockOnFilterChange}
        onResetFilters={mockOnResetFilters}
      />
    );

    const resetButton = screen.getByRole('button', { name: /reset/i });
    expect(resetButton).toBeInTheDocument();

    fireEvent.click(resetButton);
    expect(mockOnResetFilters).toHaveBeenCalledTimes(1);
  });

  it('renders sliders in responsive grid layout', () => {
    render(
      <LatchGraphSliders
        filters={sampleFilters}
        onFilterChange={mockOnFilterChange}
      />
    );

    // Check for grid container
    const gridContainer = document.querySelector('.grid');
    expect(gridContainer).toBeInTheDocument();
    expect(gridContainer).toHaveClass('grid-cols-2', 'lg:grid-cols-4');
  });
});

describe('useSliderFilters Hook', () => {
  const sampleClassification: SliderClassification = {
    L: [{ sourceColumn: 'latitude', name: 'Latitude' }],
    A: [{ sourceColumn: 'title', name: 'Title' }],
    T: [{ sourceColumn: 'created_at', name: 'Created' }],
    C: [{ sourceColumn: 'tags', name: 'Tags' }],
    H: [{ sourceColumn: 'priority', name: 'Priority' }],
    GRAPH: [{ sourceColumn: 'graph_degree', name: 'Connections' }],
  };

  const sampleData = [
    {
      id: '1',
      title: 'Short',
      created_at: '2024-01-15T10:00:00Z',
      priority: 1,
      tags: 'work,project',
      latitude: 40.7128,
      graph_degree: 3,
    },
    {
      id: '2',
      title: 'Medium length title',
      created_at: '2024-06-15T10:00:00Z',
      priority: 3,
      tags: 'personal',
      latitude: 34.0522,
      graph_degree: 5,
    },
    {
      id: '3',
      title: 'A very long title that has many characters',
      created_at: '2024-12-15T10:00:00Z',
      priority: 2,
      tags: 'archive,old,backup',
      latitude: 51.5074,
      graph_degree: 1,
    },
  ];

  it('returns empty filters when data is null', () => {
    const { result } = renderHook(() =>
      useSliderFilters(null, sampleClassification)
    );

    expect(result.current.filters).toHaveLength(0);
  });

  it('returns empty filters when classification is null', () => {
    const { result } = renderHook(() =>
      useSliderFilters(sampleData, null)
    );

    expect(result.current.filters).toHaveLength(0);
  });

  it('generates Time filters from date columns', () => {
    const { result } = renderHook(() =>
      useSliderFilters(sampleData, sampleClassification)
    );

    const timeFilter = result.current.filters.find(f => f.dimension === 'T');
    expect(timeFilter).toBeDefined();
    expect(timeFilter?.label).toBe('Created');
    expect(timeFilter?.property).toBe('created_at');
  });

  it('generates Hierarchy filters from numeric columns', () => {
    const { result } = renderHook(() =>
      useSliderFilters(sampleData, sampleClassification)
    );

    const hierarchyFilter = result.current.filters.find(f => f.dimension === 'H');
    expect(hierarchyFilter).toBeDefined();
    expect(hierarchyFilter?.min).toBe(1);
    expect(hierarchyFilter?.max).toBe(3);
  });

  it('generates Alphabet filters for string length', () => {
    const { result } = renderHook(() =>
      useSliderFilters(sampleData, sampleClassification)
    );

    const alphabetFilter = result.current.filters.find(f => f.dimension === 'A');
    expect(alphabetFilter).toBeDefined();
    expect(alphabetFilter?.label).toBe('Title Length');
    expect(alphabetFilter?.derivedField).toBe('len:title');
  });

  it('generates Category filters for tag count', () => {
    const { result } = renderHook(() =>
      useSliderFilters(sampleData, sampleClassification)
    );

    const categoryFilter = result.current.filters.find(f => f.dimension === 'C');
    expect(categoryFilter).toBeDefined();
    expect(categoryFilter?.label).toBe('Tag Count');
    expect(categoryFilter?.derivedField).toBe('tagcount:tags');
  });

  it('generates GRAPH filters for connection degree', () => {
    const { result } = renderHook(() =>
      useSliderFilters(sampleData, sampleClassification)
    );

    const graphFilter = result.current.filters.find(f => f.dimension === 'G');
    expect(graphFilter).toBeDefined();
    expect(graphFilter?.min).toBe(1);
    expect(graphFilter?.max).toBe(5);
  });

  it('generates Location filters for latitude/longitude', () => {
    const { result } = renderHook(() =>
      useSliderFilters(sampleData, sampleClassification)
    );

    const locationFilter = result.current.filters.find(f => f.dimension === 'L');
    expect(locationFilter).toBeDefined();
    expect(locationFilter?.property).toBe('latitude');
    // Floor/ceil rounding applied
    expect(locationFilter?.min).toBe(34);
    expect(locationFilter?.max).toBe(52);
  });

  it('updates active filters via setFilterValue', () => {
    const { result } = renderHook(() =>
      useSliderFilters(sampleData, sampleClassification)
    );

    act(() => {
      result.current.setFilterValue('hierarchy-priority', [2, 3]);
    });

    expect(result.current.activeFilters.get('hierarchy-priority')).toEqual([2, 3]);
  });

  it('resets all filters via resetFilters', () => {
    const { result } = renderHook(() =>
      useSliderFilters(sampleData, sampleClassification)
    );

    // Set some filters
    act(() => {
      result.current.setFilterValue('hierarchy-priority', [2, 3]);
      result.current.setFilterValue('graph-degree', [2, 4]);
    });

    expect(result.current.activeFilters.size).toBe(2);

    // Reset all
    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.activeFilters.size).toBe(0);
  });

  it('builds empty WHERE clause when no filters are narrowed', () => {
    const { result } = renderHook(() =>
      useSliderFilters(sampleData, sampleClassification)
    );

    const { clause, params } = result.current.buildWhereClause();
    expect(clause).toBe('');
    expect(params).toHaveLength(0);
  });

  it('builds WHERE clause for narrowed filters', () => {
    const { result } = renderHook(() =>
      useSliderFilters(sampleData, sampleClassification)
    );

    // Narrow the priority filter (not full range)
    act(() => {
      result.current.setFilterValue('hierarchy-priority', [2, 3]);
    });

    const { clause, params } = result.current.buildWhereClause();
    expect(clause).toContain('priority');
    expect(params).toContain(2);
    expect(params).toContain(3);
  });
});

describe('Tag Count Extraction', () => {
  const classificationWithTags: SliderClassification = {
    L: [],
    A: [],
    T: [],
    C: [{ sourceColumn: 'tags', name: 'Tags' }],
    H: [],
    GRAPH: [],
  };

  it('extracts count from comma-separated string', () => {
    const data = [
      { tags: 'a,b,c' },
      { tags: 'd' },
      { tags: 'e,f' },
    ];

    const { result } = renderHook(() =>
      useSliderFilters(data, classificationWithTags)
    );

    const filter = result.current.filters.find(f => f.dimension === 'C');
    expect(filter?.min).toBe(1);
    expect(filter?.max).toBe(3);
  });

  it('extracts count from JSON array string', () => {
    const data = [
      { tags: '["a","b","c"]' },
      { tags: '["d"]' },
    ];

    const { result } = renderHook(() =>
      useSliderFilters(data, classificationWithTags)
    );

    const filter = result.current.filters.find(f => f.dimension === 'C');
    expect(filter?.min).toBe(1);
    expect(filter?.max).toBe(3);
  });

  it('handles empty strings', () => {
    const data = [
      { tags: '' },
      { tags: 'a' },
    ];

    const { result } = renderHook(() =>
      useSliderFilters(data, classificationWithTags)
    );

    const filter = result.current.filters.find(f => f.dimension === 'C');
    expect(filter?.min).toBe(0);
    expect(filter?.max).toBe(1);
  });
});
