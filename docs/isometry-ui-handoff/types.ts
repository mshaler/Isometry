// ============================================================================
// Isometry Type Definitions
// ============================================================================
// Core TypeScript interfaces for the data model, state, and operations
// ============================================================================

// ============================================================================
// DATABASE MODELS
// ============================================================================

/** Node types supported by the system */
export type NodeType = 'note' | 'task' | 'contact' | 'event' | 'project' | 'resource';

/** Task status values */
export type TaskStatus = 'active' | 'pending' | 'completed' | 'archived';

/** Edge types in GRAPH vocabulary */
export type EdgeType = 'LINK' | 'NEST' | 'SEQUENCE' | 'AFFINITY';

/** 
 * Node (Card) - The primary data unit
 * Represents notes, tasks, contacts, events, etc.
 */
export interface Node {
  // Identity
  id: string;
  nodeType: NodeType;
  
  // Content
  name: string;
  content: string | null;
  summary: string | null;
  
  // LATCH: Location
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  locationAddress: string | null;
  
  // LATCH: Time
  createdAt: string;  // ISO 8601
  modifiedAt: string;
  dueAt: string | null;
  completedAt: string | null;
  eventStart: string | null;
  eventEnd: string | null;
  
  // LATCH: Category
  folder: string | null;
  tags: string[];  // Stored as JSON in SQLite
  status: TaskStatus | null;
  
  // LATCH: Hierarchy
  priority: number;  // 0-5
  importance: number;
  sortOrder: number;
  
  // Metadata
  source: string | null;
  sourceId: string | null;
  sourceUrl: string | null;
  
  // Soft delete
  deletedAt: string | null;
  
  // Versioning
  version: number;
}

/**
 * Edge - Relationship between nodes
 * In LPG model, edges are first-class entities with properties
 */
export interface Edge {
  id: string;
  edgeType: EdgeType;
  
  sourceId: string;
  targetId: string;
  
  label: string | null;
  weight: number;  // 0-1
  directed: boolean;
  
  // For SEQUENCE edges
  sequenceOrder: number | null;
  
  // For communication edges
  channel: string | null;
  timestamp: string | null;
  subject: string | null;
  
  createdAt: string;
}

/**
 * Facet - A filterable/sortable property
 * Used for PAFV axis assignment
 */
export interface Facet {
  id: string;
  name: string;
  facetType: 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'location';
  axis: 'L' | 'A' | 'T' | 'C' | 'H';
  sourceColumn: string;
  options: string[] | null;
  icon: string | null;
  color: string | null;
  enabled: boolean;
  sortOrder: number;
}

/**
 * View - Saved view configuration
 */
export interface View {
  id: string;
  name: string;
  viewType: ViewType;
  
  xAxis: string | null;  // Facet ID
  yAxis: string | null;
  zAxis: string | null;
  
  filters: string | null;  // Serialized filter state
  
  sortFacet: string | null;
  sortDirection: 'asc' | 'desc';
  
  cardSize: 'small' | 'medium' | 'large';
  showPreview: boolean;
  
  createdAt: string;
  modifiedAt: string;
  isDefault: boolean;
}

/**
 * App - Collection of views with base filter
 */
export interface App {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  defaultViewId: string | null;
  baseFilter: string | null;
  nodeTypes: NodeType[];
  createdAt: string;
  sortOrder: number;
  enabled: boolean;
}

// ============================================================================
// VIEW TYPES
// ============================================================================

/** Supported view types */
export type ViewType = 
  | 'grid'      // 2D grid, X and Y axes
  | 'list'      // Single column, sorted
  | 'kanban'    // Columns by status/category
  | 'timeline'  // Horizontal time axis
  | 'calendar'  // Month/week calendar
  | 'network'   // Force-directed graph
  | 'tree';     // Hierarchical tree

// ============================================================================
// LATCH FILTER TYPES
// ============================================================================

/** Location filter */
export interface LocationFilter {
  type: 'point' | 'box' | 'radius';
  // Point (exact match)
  latitude?: number;
  longitude?: number;
  // Box (bounding box)
  north?: number;
  south?: number;
  east?: number;
  west?: number;
  // Radius (requires SpatiaLite)
  centerLat?: number;
  centerLon?: number;
  radiusKm?: number;
}

/** Alphabet filter */
export interface AlphabetFilter {
  type: 'startsWith' | 'range' | 'search';
  value: string;  // "A" or "A-M" or search query
}

/** Time filter */
export interface TimeFilter {
  type: 'preset' | 'range' | 'relative';
  // Preset
  preset?: TimePreset;
  // Range
  start?: string;  // ISO 8601
  end?: string;
  // Relative
  amount?: number;
  unit?: 'day' | 'week' | 'month' | 'year';
  direction?: 'past' | 'future';
  // Which field to filter
  field: 'created' | 'modified' | 'due';
}

/** Time preset values */
export type TimePreset = 
  | 'today'
  | 'yesterday'
  | 'this-week'
  | 'last-week'
  | 'this-month'
  | 'last-month'
  | 'this-year'
  | 'last-7-days'
  | 'last-30-days'
  | 'last-90-days'
  | 'next-week'
  | 'overdue';

/** Category filter */
export interface CategoryFilter {
  type: 'include' | 'exclude';
  folders?: string[];
  tags?: string[];
  statuses?: TaskStatus[];
  nodeTypes?: NodeType[];
}

/** Hierarchy filter */
export interface HierarchyFilter {
  type: 'priority' | 'top-n' | 'range';
  // Priority threshold
  minPriority?: number;
  maxPriority?: number;
  // Top N
  limit?: number;
  // Custom sort
  sortBy?: 'priority' | 'importance' | 'sortOrder';
}

/** Combined filter state */
export interface FilterState {
  location: LocationFilter | null;
  alphabet: AlphabetFilter | null;
  time: TimeFilter | null;
  category: CategoryFilter | null;
  hierarchy: HierarchyFilter | null;
  dsl: string | null;  // Raw DSL string (overrides above if set)
}

// ============================================================================
// PAFV STATE
// ============================================================================

/** PAFV axis assignment state */
export interface PAFVState {
  xAxis: string | null;  // Facet ID assigned to X plane
  yAxis: string | null;  // Facet ID assigned to Y plane
  zAxis: string | null;  // Facet ID assigned to Z plane
  available: string[];   // Facet IDs not assigned to any plane
}

// ============================================================================
// UI STATE
// ============================================================================

/** Theme options */
export type Theme = 'NeXTSTEP' | 'Modern';

/** UI state (ephemeral, not persisted to URL) */
export interface UIState {
  theme: Theme;
  sidebarCollapsed: boolean;
  rightSidebarCollapsed: boolean;
  footerExpanded: boolean;
  footerTab: 'map' | 'slider';
  commandBarFocused: boolean;
}

// ============================================================================
// SELECTION STATE
// ============================================================================

/** Card selection state */
export interface SelectionState {
  selectedIds: Set<string>;
  lastSelectedId: string | null;
  anchorId: string | null;  // For shift-click range selection
}

// ============================================================================
// COMBINED APP STATE
// ============================================================================

/** Complete application state */
export interface IsometryState {
  // Data
  nodes: Node[];
  edges: Edge[];
  facets: Facet[];
  
  // Navigation
  activeAppId: string;
  activeViewId: string;
  
  // PAFV
  pafv: PAFVState;
  
  // Filters
  filters: FilterState;
  
  // Selection
  selection: SelectionState;
  
  // UI
  ui: UIState;
}

// ============================================================================
// QUERY TYPES
// ============================================================================

/** Compiled SQL query with params */
export interface CompiledQuery {
  sql: string;
  params: (string | number | boolean | null)[];
}

/** Query hook return type */
export interface QueryState<T> {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

// ============================================================================
// VIEW RENDERER INTERFACE
// ============================================================================

/** Dimensions for rendering */
export interface Dimensions {
  width: number;
  height: number;
}

/** D3 selection type alias */
export type D3Selection = d3.Selection<SVGGElement, unknown, null, undefined>;

/** Interface that all view renderers must implement */
export interface ViewRenderer {
  /** View type identifier */
  readonly type: ViewType;
  
  /** Display name */
  readonly name: string;
  
  /** Configure X axis facet */
  setXAxis(facetId: string | null): void;
  
  /** Configure Y axis facet */
  setYAxis(facetId: string | null): void;
  
  /** Main render function */
  render(
    container: D3Selection,
    nodes: Node[],
    dimensions: Dimensions
  ): void;
  
  /** Clean up before switching views */
  destroy(): void;
  
  /** Handle card click */
  onCardClick?(node: Node, event: MouseEvent): void;
  
  /** Handle card hover */
  onCardHover?(node: Node | null): void;
  
  /** Handle card drag */
  onCardDrag?(node: Node, position: { x: number; y: number }): void;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/** Filter change event */
export interface FilterChangeEvent {
  axis: 'L' | 'A' | 'T' | 'C' | 'H' | 'dsl';
  value: LocationFilter | AlphabetFilter | TimeFilter | CategoryFilter | HierarchyFilter | string | null;
}

/** PAFV change event */
export interface PAFVChangeEvent {
  plane: 'x' | 'y' | 'z' | 'available';
  facetId: string;
  fromPlane: 'x' | 'y' | 'z' | 'available';
}

/** Selection change event */
export interface SelectionChangeEvent {
  type: 'select' | 'deselect' | 'toggle' | 'clear' | 'range';
  nodeIds: string[];
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/** Database row to Node conversion */
export function rowToNode(row: Record<string, unknown>): Node {
  return {
    id: row.id as string,
    nodeType: row.node_type as NodeType,
    name: row.name as string,
    content: row.content as string | null,
    summary: row.summary as string | null,
    latitude: row.latitude as number | null,
    longitude: row.longitude as number | null,
    locationName: row.location_name as string | null,
    locationAddress: row.location_address as string | null,
    createdAt: row.created_at as string,
    modifiedAt: row.modified_at as string,
    dueAt: row.due_at as string | null,
    completedAt: row.completed_at as string | null,
    eventStart: row.event_start as string | null,
    eventEnd: row.event_end as string | null,
    folder: row.folder as string | null,
    tags: row.tags ? JSON.parse(row.tags as string) : [],
    status: row.status as TaskStatus | null,
    priority: row.priority as number,
    importance: row.importance as number,
    sortOrder: row.sort_order as number,
    source: row.source as string | null,
    sourceId: row.source_id as string | null,
    sourceUrl: row.source_url as string | null,
    deletedAt: row.deleted_at as string | null,
    version: row.version as number,
  };
}

/** Node to database row conversion */
export function nodeToRow(node: Node): Record<string, unknown> {
  return {
    id: node.id,
    node_type: node.nodeType,
    name: node.name,
    content: node.content,
    summary: node.summary,
    latitude: node.latitude,
    longitude: node.longitude,
    location_name: node.locationName,
    location_address: node.locationAddress,
    created_at: node.createdAt,
    modified_at: node.modifiedAt,
    due_at: node.dueAt,
    completed_at: node.completedAt,
    event_start: node.eventStart,
    event_end: node.eventEnd,
    folder: node.folder,
    tags: JSON.stringify(node.tags),
    status: node.status,
    priority: node.priority,
    importance: node.importance,
    sort_order: node.sortOrder,
    source: node.source,
    source_id: node.sourceId,
    source_url: node.sourceUrl,
    deleted_at: node.deletedAt,
    version: node.version,
  };
}
