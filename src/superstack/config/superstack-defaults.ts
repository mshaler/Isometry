/**
 * SuperStack Default Configurations
 *
 * Default dimensions and common facet configurations for SuperStack.
 * These provide sensible defaults that can be overridden per-use.
 */

import type { FacetConfig, SuperStackDimensions } from '../types/superstack';

/**
 * Default pixel dimensions for SuperStack layout.
 * Provides reasonable starting point for most screen sizes.
 */
export const DEFAULT_DIMENSIONS: SuperStackDimensions = {
  rowHeaderLevelWidth: 120,
  colHeaderLevelHeight: 28,
  cellMinWidth: 80,
  cellMinHeight: 28,
  zoom: 1.0,
};

/**
 * Common LATCH facet configurations.
 * These map to typical columns in the cards table.
 */
export const COMMON_FACETS: Record<string, FacetConfig> = {
  // Category facets (C in LATCH)
  folder: {
    id: 'folder',
    name: 'Folder',
    axis: 'C',
    sourceColumn: 'folder',
    dataType: 'select',
    sortOrder: 'asc',
  },
  tags: {
    id: 'tags',
    name: 'Tags',
    axis: 'C',
    sourceColumn: 'tags',
    dataType: 'multi_select',
    sortOrder: 'asc',
  },
  status: {
    id: 'status',
    name: 'Status',
    axis: 'C',
    sourceColumn: 'status',
    dataType: 'select',
    options: ['inbox', 'active', 'waiting', 'completed', 'archived'],
    sortOrder: 'custom',
  },
  type: {
    id: 'type',
    name: 'Type',
    axis: 'C',
    sourceColumn: 'type',
    dataType: 'select',
    options: ['note', 'person', 'event', 'resource'],
    sortOrder: 'custom',
  },

  // Hierarchy facets (H in LATCH)
  priority: {
    id: 'priority',
    name: 'Priority',
    axis: 'H',
    sourceColumn: 'priority',
    dataType: 'number',
    sortOrder: 'desc',
  },
  importance: {
    id: 'importance',
    name: 'Importance',
    axis: 'H',
    sourceColumn: 'importance',
    dataType: 'number',
    sortOrder: 'desc',
  },

  // Time facets (T in LATCH)
  year: {
    id: 'year',
    name: 'Year',
    axis: 'T',
    sourceColumn: 'created_at',
    dataType: 'date',
    timeFormat: '%Y',
    sortOrder: 'asc',
  },
  quarter: {
    id: 'quarter',
    name: 'Quarter',
    axis: 'T',
    sourceColumn: 'created_at',
    dataType: 'date',
    timeFormat: '%Y-Q', // Post-processed to add quarter number
    sortOrder: 'asc',
  },
  month: {
    id: 'month',
    name: 'Month',
    axis: 'T',
    sourceColumn: 'created_at',
    dataType: 'date',
    timeFormat: '%m',
    sortOrder: 'asc',
  },
  week: {
    id: 'week',
    name: 'Week',
    axis: 'T',
    sourceColumn: 'created_at',
    dataType: 'date',
    timeFormat: '%W',
    sortOrder: 'asc',
  },
  day: {
    id: 'day',
    name: 'Day',
    axis: 'T',
    sourceColumn: 'created_at',
    dataType: 'date',
    timeFormat: '%d',
    sortOrder: 'asc',
  },

  // Alphabet facets (A in LATCH)
  name: {
    id: 'name',
    name: 'Name',
    axis: 'A',
    sourceColumn: 'name',
    dataType: 'text',
    sortOrder: 'asc',
  },
  firstLetter: {
    id: 'firstLetter',
    name: 'First Letter',
    axis: 'A',
    sourceColumn: 'name',
    dataType: 'text',
    sortOrder: 'asc',
  },

  // Location facets (L in LATCH)
  location: {
    id: 'location',
    name: 'Location',
    axis: 'L',
    sourceColumn: 'location_name',
    dataType: 'text',
    sortOrder: 'asc',
  },
};

/**
 * Month name lookup for formatting.
 */
export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Format a value for display based on facet configuration.
 */
export function formatLabel(facet: FacetConfig, value: string): string {
  if (facet.axis === 'T') {
    // Format time values nicely
    if (facet.id === 'month') {
      const monthIndex = parseInt(value, 10) - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        return MONTH_NAMES[monthIndex];
      }
    }
    if (facet.id === 'quarter') {
      // Convert "2024-Q" + month to "Q1", "Q2", etc.
      const month = parseInt(value.slice(-2), 10);
      const quarter = Math.ceil(month / 3);
      return `Q${quarter}`;
    }
    if (facet.id === 'week') {
      return `W${value}`;
    }
  }
  return value;
}

/**
 * Get depth-based background color for headers.
 * Provides visual hierarchy through subtle shading.
 */
export const HEADER_COLORS = [
  '#f8f9fa', // Depth 0 (outermost) - lightest
  '#f1f3f4', // Depth 1
  '#e8eaed', // Depth 2
  '#dadce0', // Depth 3
  '#d2d5d9', // Depth 4 (innermost) - darkest
];

export function getHeaderColor(depth: number): string {
  return HEADER_COLORS[Math.min(depth, HEADER_COLORS.length - 1)];
}
