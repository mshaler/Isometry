import { devLogger } from '@/utils/logging';

/**
 * Tool definitions for Claude AI
 * These follow the Anthropic tool format
 */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Database query interface - matches useDatabaseService return
 */
interface QueryExecutor {
  query: (sql: string, params?: unknown[]) => Record<string, unknown>[];
}

/**
 * Available tools for Claude
 */
export const tools: ToolDefinition[] = [
  {
    name: 'search_nodes',
    description: 'Search for nodes (cards) in the database using full-text search. Returns matching nodes with their details.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query text. Uses FTS5 full-text search.'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)'
        },
        folder: {
          type: 'string',
          description: 'Optional folder filter'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_node',
    description: 'Get detailed information about a specific node by ID.',
    input_schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The node ID to retrieve'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'query_edges',
    description: 'Query edges (relationships) between nodes. Can filter by edge type and source/target.',
    input_schema: {
      type: 'object',
      properties: {
        source_id: {
          type: 'string',
          description: 'Filter by source node ID'
        },
        target_id: {
          type: 'string',
          description: 'Filter by target node ID'
        },
        edge_type: {
          type: 'string',
          description: 'Filter by edge type',
          enum: ['LINK', 'NEST', 'SEQUENCE', 'AFFINITY']
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 20)'
        }
      }
    }
  },
  {
    name: 'get_stats',
    description: 'Get statistics about the database - total nodes, edges, folders, tags.',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'list_folders',
    description: 'List all folders in the database with node counts.',
    input_schema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'list_tags',
    description: 'List all tags in the database with usage counts.',
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of tags to return (default: 50)'
        }
      }
    }
  }
];

/**
 * Execute a tool and return the result
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  db: QueryExecutor
): Promise<ToolResult> {
  devLogger.debug('Executing tool', { component: 'tools', name, input });

  try {
    switch (name) {
      case 'search_nodes':
        return searchNodes(input, db);
      case 'get_node':
        return getNode(input, db);
      case 'query_edges':
        return queryEdges(input, db);
      case 'get_stats':
        return getStats(db);
      case 'list_folders':
        return listFolders(db);
      case 'list_tags':
        return listTags(input, db);
      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    devLogger.error('Tool execution failed', { component: 'tools', name, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Tool implementations

function searchNodes(input: Record<string, unknown>, db: QueryExecutor): ToolResult {
  const query = input.query as string;
  const limit = (input.limit as number) || 10;
  const folder = input.folder as string | undefined;

  let sql = `
    SELECT n.id, n.name, n.folder, n.tags, n.status, n.created_at
    FROM nodes_fts
    JOIN nodes n ON nodes_fts.rowid = n.rowid
    WHERE nodes_fts MATCH ?
    AND n.deleted_at IS NULL
  `;
  const params: unknown[] = [query];

  if (folder) {
    sql += ` AND n.folder = ?`;
    params.push(folder);
  }

  sql += ` ORDER BY rank LIMIT ?`;
  params.push(limit);

  const results = db.query(sql, params);
  return { success: true, data: results };
}

function getNode(input: Record<string, unknown>, db: QueryExecutor): ToolResult {
  const id = input.id as string;

  const results = db.query(`
    SELECT n.*, nc.markdown_content
    FROM nodes n
    LEFT JOIN notebook_cards nc ON n.id = nc.node_id
    WHERE n.id = ? AND n.deleted_at IS NULL
  `, [id]);

  if (results.length === 0) {
    return { success: false, error: `Node not found: ${id}` };
  }

  return { success: true, data: results[0] };
}

function queryEdges(input: Record<string, unknown>, db: QueryExecutor): ToolResult {
  const sourceId = input.source_id as string | undefined;
  const targetId = input.target_id as string | undefined;
  const edgeType = input.edge_type as string | undefined;
  const limit = (input.limit as number) || 20;

  let sql = `
    SELECT e.*,
           s.name as source_name,
           t.name as target_name
    FROM edges e
    JOIN nodes s ON e.source_id = s.id
    JOIN nodes t ON e.target_id = t.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (sourceId) {
    sql += ` AND e.source_id = ?`;
    params.push(sourceId);
  }
  if (targetId) {
    sql += ` AND e.target_id = ?`;
    params.push(targetId);
  }
  if (edgeType) {
    sql += ` AND e.edge_type = ?`;
    params.push(edgeType);
  }

  sql += ` LIMIT ?`;
  params.push(limit);

  const results = db.query(sql, params);
  return { success: true, data: results };
}

function getStats(db: QueryExecutor): ToolResult {
  const nodeCount = db.query(`SELECT COUNT(*) as count FROM nodes WHERE deleted_at IS NULL`)[0]?.count ?? 0;
  const edgeCount = db.query(`SELECT COUNT(*) as count FROM edges`)[0]?.count ?? 0;
  const folderCount = db.query(`SELECT COUNT(DISTINCT folder) as count FROM nodes WHERE folder IS NOT NULL AND deleted_at IS NULL`)[0]?.count ?? 0;

  // Get tag count from JSON tags column
  const tagResult = db.query(`
    SELECT COUNT(*) as count FROM (
      SELECT DISTINCT value FROM nodes, json_each(nodes.tags)
      WHERE nodes.deleted_at IS NULL AND nodes.tags IS NOT NULL
    )
  `);
  const tagCount = tagResult[0]?.count ?? 0;

  return {
    success: true,
    data: {
      nodes: nodeCount,
      edges: edgeCount,
      folders: folderCount,
      tags: tagCount
    }
  };
}

function listFolders(db: QueryExecutor): ToolResult {
  const results = db.query(`
    SELECT folder, COUNT(*) as node_count
    FROM nodes
    WHERE folder IS NOT NULL AND deleted_at IS NULL
    GROUP BY folder
    ORDER BY node_count DESC
  `);
  return { success: true, data: results };
}

function listTags(input: Record<string, unknown>, db: QueryExecutor): ToolResult {
  const limit = (input.limit as number) || 50;

  const results = db.query(`
    SELECT value as tag, COUNT(*) as usage_count
    FROM nodes, json_each(nodes.tags)
    WHERE nodes.deleted_at IS NULL AND nodes.tags IS NOT NULL
    GROUP BY value
    ORDER BY usage_count DESC
    LIMIT ?
  `, [limit]);

  return { success: true, data: results };
}
