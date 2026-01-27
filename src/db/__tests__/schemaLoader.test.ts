// ============================================================================
// Schema Loader Tests
// ============================================================================
// Tests for dynamic schema loading from SQLite database
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadTableSchema,
  loadDatabaseSchema,
  getSchemaFields,
  clearSchemaCache
} from '../schemaLoader';

// Mock database interfaces
interface MockTableInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

// Mock database function
type DatabaseFunction = <T = Record<string, unknown>>(sql: string, params: unknown[]) => T[] | Promise<T[]>;

const createMockExecute = (mockData: Record<string, MockTableInfo[]>): DatabaseFunction => {
  return vi.fn(async (sql: string, __params: unknown[]) => {
    // Handle PRAGMA table_info queries
    if (sql.includes('PRAGMA table_info')) {
      const tableMatch = sql.match(/PRAGMA table_info\((\w+)\)/);
      if (tableMatch) {
        const tableName = tableMatch[1];
        return mockData[tableName] || [];
      }
    }
    return [];
  });
};

describe('Schema Loader', () => {
  beforeEach(() => {
    clearSchemaCache();
  });

  describe('loadTableSchema', () => {
    it('should load table schema correctly', async () => {
      const mockExecute = createMockExecute({
        nodes: [
          { cid: 0, name: 'id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 },
          { cid: 1, name: 'name', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
          { cid: 2, name: 'priority', type: 'INTEGER', notnull: 0, dflt_value: '0', pk: 0 },
          { cid: 3, name: 'created_at', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
          { cid: 4, name: 'status', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
          { cid: 5, name: 'tags', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 }
        ]
      });

      const result = await loadTableSchema(mockExecute, 'nodes');

      expect(result).toBeDefined();
      expect(result!.name).toBe('nodes');
      expect(result!.fields).toHaveLength(6);

      // Check specific field mappings
      const nameField = result!.fields.find(f => f.name === 'name');
      expect(nameField).toEqual({
        name: 'name',
        type: 'text',
        sqlType: 'TEXT',
        table: 'nodes'
      });

      const priorityField = result!.fields.find(f => f.name === 'priority');
      expect(priorityField).toEqual({
        name: 'priority',
        type: 'number',
        sqlType: 'INTEGER',
        table: 'nodes'
      });

      const createdField = result!.fields.find(f => f.name === 'created_at');
      expect(createdField).toEqual({
        name: 'created_at',
        type: 'date',
        sqlType: 'TEXT',
        table: 'nodes'
      });

      const statusField = result!.fields.find(f => f.name === 'status');
      expect(statusField).toEqual({
        name: 'status',
        type: 'select',
        sqlType: 'TEXT',
        table: 'nodes',
        values: ['active', 'pending', 'archived', 'completed', 'draft']
      });

      const tagsField = result!.fields.find(f => f.name === 'tags');
      expect(tagsField).toEqual({
        name: 'tags',
        type: 'array',
        sqlType: 'TEXT',
        table: 'nodes'
      });
    });

    it('should return null for non-existent table', async () => {
      const mockExecute = createMockExecute({});

      const result = await loadTableSchema(mockExecute, 'nonexistent');

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      const mockExecute = vi.fn().mockRejectedValue(new Error('Database error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await loadTableSchema(mockExecute, 'nodes');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error loading schema for table nodes:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('loadDatabaseSchema', () => {
    it('should load schema from multiple tables', async () => {
      const mockExecute = createMockExecute({
        nodes: [
          { cid: 0, name: 'id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 },
          { cid: 1, name: 'name', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 }
        ],
        notebook_cards: [
          { cid: 0, name: 'id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 },
          { cid: 1, name: 'content', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 }
        ]
      });

      const result = await loadDatabaseSchema(mockExecute);

      expect(result).toHaveLength(4);

      // Check for qualified names where there are conflicts
      const nodeId = result.find(f => f.name === 'nodes.id');
      const cardId = result.find(f => f.name === 'notebook_cards.id');
      expect(nodeId).toBeDefined();
      expect(cardId).toBeDefined();

      // Check for unique names
      const nameField = result.find(f => f.name === 'name');
      const contentField = result.find(f => f.name === 'content');
      expect(nameField).toBeDefined();
      expect(contentField).toBeDefined();
    });

    it('should handle empty database', async () => {
      const mockExecute = createMockExecute({});

      const result = await loadDatabaseSchema(mockExecute);

      expect(result).toEqual([]);
    });
  });

  describe('getSchemaFields', () => {
    it('should cache schema results', async () => {
      const mockExecute = createMockExecute({
        nodes: [
          { cid: 0, name: 'id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 }
        ]
      });

      // First call should execute database queries
      const result1 = await getSchemaFields(mockExecute);
      expect(result1).toHaveLength(1);
      expect(mockExecute).toHaveBeenCalled();

      // Second call should use cached data
      mockExecute.mockClear();
      const result2 = await getSchemaFields(mockExecute);
      expect(result2).toEqual(result1);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should return cached data on database error', async () => {
      const mockExecute = createMockExecute({
        nodes: [
          { cid: 0, name: 'id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 }
        ]
      });

      // First call succeeds
      const result1 = await getSchemaFields(mockExecute);
      expect(result1).toHaveLength(1);

      // Second call fails but returns cached data
      mockExecute.mockRejectedValue(new Error('Database error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result2 = await getSchemaFields(mockExecute);
      expect(result2).toEqual(result1);

      consoleSpy.mockRestore();
    });

    it('should return empty array if no cache and error occurs', async () => {
      const mockExecute = vi.fn().mockRejectedValue(new Error('Database error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await getSchemaFields(mockExecute);

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('clearSchemaCache', () => {
    it('should clear cached schema data', async () => {
      const mockExecute = createMockExecute({
        nodes: [
          { cid: 0, name: 'id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 }
        ]
      });

      // Load data into cache
      await getSchemaFields(mockExecute);
      expect(mockExecute).toHaveBeenCalled();

      // Clear cache
      clearSchemaCache();

      // Next call should query database again
      mockExecute.mockClear();
      await getSchemaFields(mockExecute);
      expect(mockExecute).toHaveBeenCalled();
    });
  });
});