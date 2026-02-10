/**
 * Type definitions for database operations
 * Shared between sql.js, HTTP API, and WebView bridge implementations
 */

export interface Node {
  id: string;
  type: string;
  title: string;
  content: string;
  properties: Record<string, unknown>;
  createdAt: Date;
  modifiedAt: Date;
  deletedAt?: Date;
  version: number;
  syncVersion: number;
  syncState: 'synced' | 'pending' | 'conflict';
}

export interface Edge {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  weight?: number;
  properties?: Record<string, unknown>;
  createdAt: Date;
  modifiedAt: Date;
  deletedAt?: Date;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  type?: string;
}

export interface SearchResult {
  node: Node;
  snippet: string;
  rank: number;
}

export interface DatabaseStats {
  nodeCount: number;
  edgeCount: number;
  lastSync: Date | null;
  isOnline: boolean;
}

export type QueryResult = Record<string, unknown>;

/**
 * Error telemetry structure for Claude Code integration
 * Tracks sql.js capability failures for automated debugging
 */
export interface SQLiteCapabilityError {
  capability: 'fts5' | 'json1' | 'recursive_cte' | 'storage';
  error: string;
  timestamp: string;
  context: Record<string, unknown>;
  stackTrace?: string;
  browserInfo?: {
    userAgent: string;
    vendor: string;
    platform: string;
  };
}

/**
 * Grid cell data structure for SuperGrid foundation
 * Implements Janus density model with orthogonal Pan × Zoom controls
 * Extends D3 selection types for type-safe data binding
 */
export interface GridCellData {
  /** Primary data: cards in this cell */
  cards: QueryResult[];
  /** Density level (0=sparse single card, 3=collapsed summary) */
  densityLevel: number;
  /** Aggregation type for dense cells */
  aggregationType: 'none' | 'group' | 'rollup';
  /** Pan level - extent control (0=all data, 3=viewport only) */
  panLevel: number;
  /** Zoom level - value control (0=leaf values, 3=summary) */
  zoomLevel: number;
  /** Cell position coordinates */
  x: number;
  y: number;
  /** Cell dimensions */
  width: number;
  height: number;
  /** Unique identifier for D3 data binding */
  id: string;
}

/**
 * Database client interface
 * Implemented by sql.js, HTTP API, and WebView bridge clients
 */
export interface DatabaseClient {
  execute(sql: string, params?: unknown[]): Promise<QueryResult[]>;
  getNodes(options?: SearchOptions): Promise<Node[]>;
  createNode(node: Omit<Node, 'id' | 'createdAt' | 'modifiedAt' | 'version'>): Promise<Node>;
  updateNode(node: Node): Promise<Node>;
  deleteNode(id: string): Promise<void>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  getGraph(options?: { nodeId?: string; depth?: number; }): Promise<{ nodes: Node[]; edges: Edge[] }>;
  getStats(): Promise<DatabaseStats>;
  save(): Promise<void>;
  reset(): Promise<void>;
}