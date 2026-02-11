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
  facet: string; // Database column name (e.g., "created_at", "folder", "tags")
}

// Density level for Janus model (sparsity ↔ density)
// 1: Value Sparsity — Full Cartesian product, every intersection shown
// 2: Extent Density — Populated-only, hide empty rows/columns
// 3: View Density — Matrix view, aggregation rows visible
// 4: Region Density — Mixed sparse + dense regions
export type DensityLevel = 1 | 2 | 3 | 4;

// Encoding type for visual properties (color, size)
export type EncodingType = 'categorical' | 'numeric' | 'ordinal';

export interface EncodingConfig {
  /** Property/facet to encode */
  property: string;
  /** Type of encoding scale */
  type: EncodingType;
  /** Scale configuration */
  scale?: {
    /** Input domain (values from data) */
    domain?: unknown[];
    /** Output range (colors for color encoding, [min, max] for size) */
    range?: string[] | number[];
  };
}

export const DENSITY_LEVEL_INFO: Record<DensityLevel, { label: string; description: string }> = {
  1: { label: 'Value Sparsity', description: 'Full Cartesian product. Every intersection shown.' },
  2: { label: 'Extent Density', description: 'Populated-only. Hide empty rows/columns.' },
  3: { label: 'View Density', description: 'Matrix view. Aggregation rows visible.' },
  4: { label: 'Region Density', description: 'Mixed sparse + dense regions. Power user mode.' },
};

// PAFV state with view mode, density, and encodings
export interface PAFVState {
  mappings: AxisMapping[];
  viewMode: 'grid' | 'list';
  densityLevel: DensityLevel;
  /** Color encoding configuration (property → color gradient) */
  colorEncoding: EncodingConfig | null;
  /** Size encoding configuration (numeric property → card size) */
  sizeEncoding: EncodingConfig | null;
}

// Default PAFV state
// NOTE: Facet values MUST match source_column names in the facets table:
// - Time (T): created_at, modified_at, due_at
// - Category (C): folder, tags, status
// - Hierarchy (H): priority
// - Alphabet (A): name
// - Location (L): location_name
export const DEFAULT_PAFV: PAFVState = {
  mappings: [
    // Single Y-axis = Kanban-style rows by folder
    { plane: 'y', axis: 'category', facet: 'folder' },
  ],
  viewMode: 'grid',
  densityLevel: 2, // Default to Extent Density (populated-only)
  colorEncoding: null,
  sizeEncoding: null,
};

/** Configuration for multi-facet stacked axis hierarchy */
export interface StackedAxisConfig {
  axis: LATCHAxis;
  facets: string[]; // Ordered from parent to child (e.g., ['year', 'quarter', 'month'])
}

// Legacy state for backward compatibility
export interface LegacyPAFVState {
  xAxis: string | null;
  yAxis: string | null;
  zAxis: string | null;
  available: string[];
}
