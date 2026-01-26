/**
 * WebView Database Client
 *
 * Implements the same interface as NativeAPIClient but routes operations through WebView bridge
 * Provides seamless integration for React components regardless of transport method
 */

import { webViewBridge, Environment } from '../utils/webview-bridge';
import type {
  DatabaseClient,
  QueryResult,
  Node,
  Edge,
  DatabaseStats,
  SearchOptions,
  SearchResult
} from './types';

export class WebViewClient implements DatabaseClient {
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    // Auto-initialize when created
    this.initialize();
  }

  /**
   * Initialize WebView client
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    await this.initializationPromise;
    this.isInitialized = true;
  }

  private async _initialize(): Promise<void> {
    // Wait for bridge to be ready
    await webViewBridge.waitForReady();

    // Verify bridge is working
    if (!webViewBridge.isWebViewEnvironment()) {
      throw new Error('WebView bridge not available');
    }

    try {
      // Test connection with simple query
      await this.execute('SELECT 1 as test', []);
    } catch (error) {
      throw new Error(`WebView bridge initialization failed: ${error}`);
    }
  }

  /**
   * Execute raw SQL query
   */
  async execute(sql: string, params: any[] = []): Promise<QueryResult[]> {
    await this.initialize();

    try {
      const result = await webViewBridge.database.execute(sql, params);
      return result || [];
    } catch (error) {
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  /**
   * Get nodes with optional filtering
   */
  async getNodes(options: {
    limit?: number;
    offset?: number;
    filter?: string;
    sortBy?: string;
  } = {}): Promise<Node[]> {
    await this.initialize();

    try {
      const result = await webViewBridge.database.getNodes(options);
      return result.map(row => this.parseNodeFromRow(row));
    } catch (error) {
      throw new Error(`Failed to get nodes: ${error}`);
    }
  }

  /**
   * Create new node
   */
  async createNode(node: Omit<Node, 'id' | 'createdAt' | 'modifiedAt' | 'version'>): Promise<Node> {
    await this.initialize();

    const newNode: Node = {
      id: this.generateId(),
      createdAt: new Date(),
      modifiedAt: new Date(),
      version: 1,
      syncVersion: 0,
      syncState: 'pending',
      ...node
    };

    try {
      const result = await webViewBridge.database.createNode(newNode);
      return this.parseNodeFromRow(result);
    } catch (error) {
      throw new Error(`Failed to create node: ${error}`);
    }
  }

  /**
   * Update existing node
   */
  async updateNode(node: Node): Promise<Node> {
    await this.initialize();

    const updatedNode = {
      ...node,
      modifiedAt: new Date(),
      version: node.version + 1,
      syncVersion: node.syncVersion + 1,
      syncState: 'pending'
    };

    try {
      const result = await webViewBridge.database.updateNode(updatedNode);
      return this.parseNodeFromRow(result);
    } catch (error) {
      throw new Error(`Failed to update node: ${error}`);
    }
  }

  /**
   * Delete node (soft delete)
   */
  async deleteNode(id: string): Promise<void> {
    await this.initialize();

    try {
      await webViewBridge.database.deleteNode(id);
    } catch (error) {
      throw new Error(`Failed to delete node: ${error}`);
    }
  }

  /**
   * Get node by ID
   */
  async getNode(id: string): Promise<Node | null> {
    await this.initialize();

    try {
      const result = await this.execute(
        'SELECT * FROM nodes WHERE id = ? AND deleted_at IS NULL',
        [id]
      );

      if (result.length === 0) {
        return null;
      }

      return this.parseNodeFromRow(result[0]);
    } catch (error) {
      throw new Error(`Failed to get node: ${error}`);
    }
  }

  /**
   * Full-text search
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    await this.initialize();

    const searchOptions = {
      limit: options.limit || 50,
      ...options
    };

    try {
      const result = await webViewBridge.database.search(query, searchOptions);
      return result.map(row => ({
        node: this.parseNodeFromRow(row),
        snippet: row.snippet || '',
        rank: row.rank || 0
      }));
    } catch (error) {
      throw new Error(`Search failed: ${error}`);
    }
  }

  /**
   * Get edges for a node
   */
  async getEdges(nodeId?: string): Promise<Edge[]> {
    await this.initialize();

    let sql = 'SELECT * FROM edges WHERE deleted_at IS NULL';
    const params: any[] = [];

    if (nodeId) {
      sql += ' AND (from_id = ? OR to_id = ?)';
      params.push(nodeId, nodeId);
    }

    sql += ' ORDER BY created_at DESC';

    try {
      const result = await this.execute(sql, params);
      return result.map(row => this.parseEdgeFromRow(row));
    } catch (error) {
      throw new Error(`Failed to get edges: ${error}`);
    }
  }

  /**
   * Create edge between nodes
   */
  async createEdge(edge: Omit<Edge, 'id' | 'createdAt' | 'modifiedAt'>): Promise<Edge> {
    await this.initialize();

    const newEdge: Edge = {
      id: this.generateId(),
      createdAt: new Date(),
      modifiedAt: new Date(),
      ...edge
    };

    try {
      const result = await this.execute(
        `INSERT INTO edges (id, from_id, to_id, type, weight, properties, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newEdge.id,
          newEdge.fromId,
          newEdge.toId,
          newEdge.type,
          newEdge.weight || 1.0,
          JSON.stringify(newEdge.properties || {}),
          newEdge.createdAt.toISOString(),
          newEdge.modifiedAt.toISOString()
        ]
      );

      return newEdge;
    } catch (error) {
      throw new Error(`Failed to create edge: ${error}`);
    }
  }

  /**
   * Get graph data for visualization
   */
  async getGraph(options: { nodeId?: string; depth?: number } = {}): Promise<{
    nodes: Node[];
    edges: Edge[];
  }> {
    await this.initialize();

    try {
      const nodes = await webViewBridge.database.getGraph(options);
      const nodeIds = nodes.map((n: any) => n.id);

      let edges: Edge[] = [];
      if (nodeIds.length > 0) {
        const placeholders = nodeIds.map(() => '?').join(',');
        const edgeResult = await this.execute(
          `SELECT * FROM edges
           WHERE (from_id IN (${placeholders}) OR to_id IN (${placeholders}))
           AND deleted_at IS NULL`,
          [...nodeIds, ...nodeIds]
        );
        edges = edgeResult.map(row => this.parseEdgeFromRow(row));
      }

      return {
        nodes: nodes.map((row: any) => this.parseNodeFromRow(row)),
        edges
      };
    } catch (error) {
      throw new Error(`Failed to get graph: ${error}`);
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<DatabaseStats> {
    await this.initialize();

    try {
      const [nodesResult, edgesResult] = await Promise.all([
        this.execute('SELECT COUNT(*) as count FROM nodes WHERE deleted_at IS NULL'),
        this.execute('SELECT COUNT(*) as count FROM edges WHERE deleted_at IS NULL')
      ]);

      return {
        nodeCount: nodesResult[0]?.count || 0,
        edgeCount: edgesResult[0]?.count || 0,
        lastSync: null, // WebView doesn't track sync separately
        isOnline: true
      };
    } catch (error) {
      return {
        nodeCount: 0,
        edgeCount: 0,
        lastSync: null,
        isOnline: false
      };
    }
  }

  /**
   * Save changes (no-op for WebView - native handles persistence)
   */
  async save(): Promise<void> {
    // WebView automatically persists to native database
    return Promise.resolve();
  }

  /**
   * Reset database (delegates to native)
   */
  async reset(): Promise<void> {
    await this.initialize();

    try {
      await webViewBridge.database.reset();
    } catch (error) {
      throw new Error(`Failed to reset database: ${error}`);
    }
  }

  /**
   * Get environment information
   */
  getEnvironment(): string {
    const env = Environment.info();
    return `WebView (${env.platform}) v${env.version}`;
  }

  // Private helper methods

  private parseNodeFromRow(row: any): Node {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      content: row.content,
      properties: row.properties ? JSON.parse(row.properties) : {},
      createdAt: new Date(row.created_at),
      modifiedAt: new Date(row.modified_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
      version: row.version || 1,
      syncVersion: row.sync_version || 0,
      syncState: row.sync_state || 'synced'
    };
  }

  private parseEdgeFromRow(row: any): Edge {
    return {
      id: row.id,
      fromId: row.from_id,
      toId: row.to_id,
      type: row.type,
      weight: row.weight || 1.0,
      properties: row.properties ? JSON.parse(row.properties) : {},
      createdAt: new Date(row.created_at),
      modifiedAt: new Date(row.modified_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * WebView client singleton
 */
export const webViewClient = new WebViewClient();

/**
 * Factory function for environment-aware client creation
 */
export function createWebViewClient(): WebViewClient {
  return new WebViewClient();
}