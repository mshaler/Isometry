// PAFV types

// Chip type for PAFV navigation
export interface Chip {
  id: string;
  label: string;
  hasCheckbox?: boolean;
  checked?: boolean;
}

// LATCH axis types (full names for clarity)
export type LATCHAxis = 'location' | 'alphabet' | 'time' | 'category' | 'hierarchy';

// Legacy abbreviation support
export type LATCHAxisAbbr = 'L' | 'A' | 'T' | 'C' | 'H';

// Plane types (visual dimensions)
export type Plane = 'x' | 'y' | 'color' | 'size' | 'shape';

export type FacetType = 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'location';

export interface Facet {
  id: string;
  name: string;
  facetType: FacetType;
  axis: LATCHAxis;
  sourceColumn: string;
  options: string[] | null;
  icon: string | null;
  color: string | null;
  enabled: boolean;
  sortOrder: number;
}

// Axis mapping: maps a Plane to a LATCH axis and facet
export interface AxisMapping {
  plane: Plane;
  axis: LATCHAxis;
  facet: string; // Facet name (e.g., "year", "tag", "city")
}

// PAFV state with view mode
export interface PAFVState {
  mappings: AxisMapping[];
  viewMode: 'grid' | 'list';
}

// Default PAFV state
export const DEFAULT_PAFV: PAFVState = {
  mappings: [
    { plane: 'x', axis: 'time', facet: 'year' },
    { plane: 'y', axis: 'category', facet: 'tag' },
  ],
  viewMode: 'grid',
};

// Legacy state for backward compatibility
export interface LegacyPAFVState {
  xAxis: string | null;
  yAxis: string | null;
  zAxis: string | null;
  available: string[];
}
