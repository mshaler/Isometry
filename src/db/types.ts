/**
 * Type definitions for database operations
 * Shared between sql.js, HTTP API, and WebView bridge implementations
 */

export interface Node {
  id: string;
  type: string;
  title: string;
  content: string;
  properties: Record<string, any>;
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
  properties?: Record<string, any>;
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

export type QueryResult = Record<string, any>;

/**
 * Database client interface
 * Implemented by sql.js, HTTP API, and WebView bridge clients
 */
export interface DatabaseClient {
  execute(sql: string, params?: any[]): Promise<QueryResult[]>;
  getNodes(options?: any): Promise<Node[]>;
  createNode(node: Omit<Node, 'id' | 'createdAt' | 'modifiedAt' | 'version'>): Promise<Node>;
  updateNode(node: Node): Promise<Node>;
  deleteNode(id: string): Promise<void>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  getGraph(options?: any): Promise<{ nodes: Node[]; edges: Edge[] }>;
  getStats(): Promise<DatabaseStats>;
  save(): Promise<void>;
  reset(): Promise<void>;
}