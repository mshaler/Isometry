// Filter types for LATCH

export interface LocationFilter {
  type: 'point' | 'box' | 'radius';
  latitude?: number;
  longitude?: number;
  north?: number;
  south?: number;
  east?: number;
  west?: number;
  centerLat?: number;
  centerLon?: number;
  radiusKm?: number;
}

export interface AlphabetFilter {
  type: 'startsWith' | 'range' | 'search';
  value: string;
}

export type TimePreset = 
  | 'today' | 'yesterday' | 'this-week' | 'last-week'
  | 'this-month' | 'last-month' | 'this-year'
  | 'last-7-days' | 'last-30-days' | 'last-90-days'
  | 'next-week' | 'overdue';

export interface TimeFilter {
  type: 'preset' | 'range' | 'relative';
  preset?: TimePreset;
  start?: string;
  end?: string;
  amount?: number;
  unit?: 'day' | 'week' | 'month' | 'year';
  direction?: 'past' | 'future';
  field: 'created' | 'modified' | 'due';
}

export interface CategoryFilter {
  type: 'include' | 'exclude';
  folders?: string[];
  tags?: string[];
  statuses?: string[];
  nodeTypes?: string[];
}

export interface HierarchyFilter {
  type: 'priority' | 'top-n' | 'range';
  minPriority?: number;
  maxPriority?: number;
  limit?: number;
  sortBy?: 'priority' | 'importance' | 'sortOrder';
}

export interface FilterState {
  location: LocationFilter | null;
  alphabet: AlphabetFilter | null;
  time: TimeFilter | null;
  category: CategoryFilter | null;
  hierarchy: HierarchyFilter | null;
  dsl: string | null;
}

export interface CompiledQuery {
  sql: string;
  params: (string | number | boolean | null)[];
}

export const EMPTY_FILTERS: FilterState = {
  location: null,
  alphabet: null,
  time: null,
  category: null,
  hierarchy: null,
  dsl: null,
};

export interface FilterPreset {
  id: string; // UUID
  name: string; // User-provided name
  filters: FilterState; // Active filter state
  createdAt: Date;
  updatedAt: Date;
}
