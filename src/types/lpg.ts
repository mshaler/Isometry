/**
 * CardBoard LPG Types - Labeled Property Graph
 *
 * Core types aligned with PAFV + LATCH + GRAPH architecture.
 * Includes adapters for bidirectional conversion with Isometry's Node type.
 *
 * PAFV: Planes → Axes → Facets → Values
 * LATCH: Location, Alphabet, Time, Category, Hierarchy
 * GRAPH: Link, Nest, Sequence, Affinity
 */

import type { Node, Edge, NodeType as IsometryNodeType } from './node';

// ============================================
// LATCH Types
// ============================================

/** The five fundamental organizing axes (full names for CardBoard D3 components) */
export type CardBoardLATCHAxis = 'location' | 'alphabet' | 'time' | 'category' | 'hierarchy';

/** LATCH coordinates for any Value (Node or Edge) */
export interface LATCHCoordinates {
  /** Spatial position - coordinates or named location */
  location?: string | [number, number];
  /** Lexical ordering - name, title, label */
  alphabet?: string;
  /** Temporal position - any date field */
  time?: Date | string;
  /** Taxonomic membership - project, status, tags */
  category?: string | string[];
  /** Ordinal ranking - priority, importance (1-5 typically) */
  hierarchy?: number;
}

// ============================================
// GRAPH Types
// ============================================

/** Edge types in the graph (GRAPH joins, LATCH separates) */
export type GraphEdgeType = 'LINK' | 'NEST' | 'SEQUENCE' | 'AFFINITY';

// ============================================
// LPG Value Types
// ============================================

/** Base properties shared by all Values */
export interface BaseValue {
  /** Unique identifier */
  id: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Soft delete timestamp (if deleted) */
  deletedAt?: Date;
  /** LATCH coordinates for this value */
  latch: LATCHCoordinates;
}

/** Node types in CardBoard (capitalized) */
export type CardBoardNodeType =
  | 'Task'
  | 'Note'
  | 'Person'
  | 'Project'
  | 'Event'
  | 'Resource'
  | 'Custom';

/** A Node value - entities like tasks, people, projects */
export interface NodeValue extends BaseValue {
  type: 'node';
  /** Classification of the node */
  nodeType: CardBoardNodeType;
  /** Display name */
  name: string;
  /** Rich text content (markdown) */
  content?: string;
  /** Arbitrary properties */
  properties: Record<string, unknown>;
}

/** An Edge value - relationships between nodes */
export interface EdgeValue extends BaseValue {
  type: 'edge';
  /** Type of relationship */
  edgeType: GraphEdgeType;
  /** Source node ID */
  sourceId: string;
  /** Target node ID */
  targetId: string;
  /** Human-readable label */
  label?: string;
  /** Relationship strength (0-1) */
  weight?: number;
  /** Is this a directed relationship? */
  directed: boolean;
  /** Arbitrary properties */
  properties: Record<string, unknown>;
}

/** Union type: all Values are either Nodes or Edges */
export type CardValue = NodeValue | EdgeValue;

// ============================================
// Type Guards
// ============================================

/** Type guard for NodeValue */
export function isNode(value: CardValue): value is NodeValue {
  return value.type === 'node';
}

/** Type guard for EdgeValue */
export function isEdge(value: CardValue): value is EdgeValue {
  return value.type === 'edge';
}

// ============================================
// Type Mapping
// ============================================

/** Map Isometry nodeType (lowercase) to CardBoard nodeType (capitalized) */
const nodeTypeToCardBoard: Record<IsometryNodeType, CardBoardNodeType> = {
  task: 'Task',
  note: 'Note',
  contact: 'Person',
  event: 'Event',
  project: 'Project',
  resource: 'Resource',
};

/** Map CardBoard nodeType back to Isometry */
const nodeTypeToIsometry: Record<CardBoardNodeType, IsometryNodeType> = {
  Task: 'task',
  Note: 'note',
  Person: 'contact',
  Event: 'event',
  Project: 'project',
  Resource: 'resource',
  Custom: 'note', // Fallback
};

// ============================================
// Adapters: Isometry → CardBoard
// ============================================

/**
 * Convert Isometry Node to CardBoard NodeValue
 */
export function nodeToCardValue(node: Node): NodeValue {
  // Build location
  let location: string | [number, number] | undefined;
  if (node.latitude != null && node.longitude != null) {
    location = [node.latitude, node.longitude];
  } else if (node.locationName) {
    location = node.locationName;
  }

  // Build category (folder + tags)
  const categories: string[] = [];
  if (node.folder) categories.push(node.folder);
  if (node.tags && node.tags.length > 0) categories.push(...node.tags);

  // Determine time (prefer dueAt, fall back to createdAt)
  const timeValue = node.dueAt || node.eventStart || node.createdAt;

  return {
    id: node.id,
    type: 'node',
    nodeType: nodeTypeToCardBoard[node.nodeType] || 'Custom',
    name: node.name,
    content: node.content || undefined,
    createdAt: new Date(node.createdAt),
    updatedAt: new Date(node.modifiedAt),
    deletedAt: node.deletedAt ? new Date(node.deletedAt) : undefined,
    latch: {
      location,
      alphabet: node.name,
      time: timeValue ? new Date(timeValue) : undefined,
      category: categories.length > 0 ? categories : undefined,
      hierarchy: node.priority,
    },
    properties: {
      summary: node.summary,
      status: node.status,
      importance: node.importance,
      sortOrder: node.sortOrder,
      source: node.source,
      sourceId: node.sourceId,
      sourceUrl: node.sourceUrl,
    },
  };
}

/**
 * Convert Isometry Edge to CardBoard EdgeValue
 */
export function edgeToCardValue(edge: Edge): EdgeValue {
  return {
    id: edge.id,
    type: 'edge',
    edgeType: edge.edgeType,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    label: edge.label || undefined,
    weight: edge.weight,
    directed: edge.directed,
    createdAt: new Date(edge.createdAt),
    updatedAt: new Date(edge.createdAt), // Edges don't have modifiedAt
    latch: {
      time: edge.timestamp ? new Date(edge.timestamp) : undefined,
    },
    properties: {
      sequenceOrder: edge.sequenceOrder,
      channel: edge.channel,
      subject: edge.subject,
    },
  };
}

// ============================================
// Adapters: CardBoard → Isometry
// ============================================

/**
 * Convert CardBoard NodeValue back to Isometry Node
 */
export function cardValueToNode(value: NodeValue): Node {
  // Extract location
  let latitude: number | null = null;
  let longitude: number | null = null;
  let locationName: string | null = null;

  if (value.latch.location) {
    if (Array.isArray(value.latch.location)) {
      [latitude, longitude] = value.latch.location;
    } else {
      locationName = value.latch.location;
    }
  }

  // Extract folder and tags from category
  let folder: string | null = null;
  let tags: string[] = [];

  if (value.latch.category) {
    const categories = Array.isArray(value.latch.category)
      ? value.latch.category
      : [value.latch.category];

    if (categories.length > 0) {
      folder = categories[0];
      tags = categories.slice(1);
    }
  }

  return {
    id: value.id,
    nodeType: nodeTypeToIsometry[value.nodeType] || 'note',
    name: value.name,
    content: value.content || null,
    summary: (value.properties.summary as string) || null,
    latitude,
    longitude,
    locationName,
    locationAddress: null,
    createdAt: value.createdAt.toISOString(),
    modifiedAt: value.updatedAt.toISOString(),
    dueAt: value.latch.time instanceof Date ? value.latch.time.toISOString() : null,
    completedAt: null,
    eventStart: null,
    eventEnd: null,
    folder,
    tags,
    status: (value.properties.status as Node['status']) || null,
    priority: value.latch.hierarchy || 0,
    importance: (value.properties.importance as number) || 0,
    sortOrder: (value.properties.sortOrder as number) || 0,
    source: (value.properties.source as string) || null,
    sourceId: (value.properties.sourceId as string) || null,
    sourceUrl: (value.properties.sourceUrl as string) || null,
    deletedAt: value.deletedAt?.toISOString() || null,
    version: 1,
  };
}

// ============================================
// LATCH Value Accessor
// ============================================

/**
 * Get the value for a specific LATCH axis from a CardValue
 */
export function getLATCHValue(
  card: CardValue,
  axis: CardBoardLATCHAxis
): string | string[] | number | Date | [number, number] | undefined {
  return card.latch[axis];
}

// ============================================
// View Projection Types (PAFV)
// ============================================

/** How LATCH axes map to visual planes */
export interface CardBoardViewProjection {
  /** Axis mapped to horizontal (x) plane */
  xAxis: CardBoardLATCHAxis;
  /** Axis mapped to vertical (y) plane */
  yAxis: CardBoardLATCHAxis;
  /** Optional axis mapped to depth (z) plane - for stacking/layering */
  zAxis?: CardBoardLATCHAxis;
}

/** Available CardBoard view types (includes 'chart', superset of Isometry's ViewType) */
export type CardBoardViewType = 'grid' | 'kanban' | 'network' | 'timeline' | 'calendar' | 'list' | 'tree' | 'chart';

/** View configuration for CardBoard D3 components */
export interface CardBoardViewConfig {
  type: CardBoardViewType;
  projection: CardBoardViewProjection;
  /** View-specific options */
  options?: Record<string, unknown>;
}

// ============================================
// Event Types
// ============================================

/** CardBoard custom event */
export interface CardboardEvent<TData = unknown> {
  /** Event type name */
  type: string;
  /** The CardValue that triggered the event */
  target: CardValue;
  /** Additional event data */
  data?: TData;
  /** Original DOM event if applicable */
  originalEvent?: Event;
}

/** Event handler function */
export type EventHandler<TData = unknown> = (event: CardboardEvent<TData>) => void;

// ============================================
// Component Types
// ============================================

/** Card visual variants */
export type CardVariant = 'default' | 'glass' | 'elevated' | 'outline';

/** Button variants */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'outline'
  | 'danger'
  | 'success';

/** Size presets */
export type Size = 'sm' | 'md' | 'lg';

/** Background pattern types */
export type BackgroundPattern = 'solid' | 'dots' | 'grid' | 'none';

/** Canvas dimensions */
export interface CanvasDimensions {
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
}

/** Canvas padding */
export interface CanvasPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
