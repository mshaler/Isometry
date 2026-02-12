import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import {
  CanonicalNodeSchema,
  CanonicalNode,
  SQL_COLUMN_MAP,
  toSQLRecord,
  fromSQLRecord,
} from '../types/canonical';

describe('CanonicalNodeSchema', () => {
  const validNode: CanonicalNode = {
    id: uuidv4(),
    nodeType: 'note',
    name: 'Test Node',
    content: 'Test content',
    summary: null,
    latitude: null,
    longitude: null,
    locationName: null,
    locationAddress: null,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    dueAt: null,
    completedAt: null,
    eventStart: null,
    eventEnd: null,
    folder: 'Test Folder',
    tags: ['tag1', 'tag2'],
    status: 'active',
    priority: 3,
    importance: 2,
    sortOrder: 0,
    gridX: 0,
    gridY: 0,
    source: 'test',
    sourceId: 'test-123',
    sourceUrl: null,
    deletedAt: null,
    version: 1,
    properties: {},
  };

  it('validates a complete valid node', () => {
    const result = CanonicalNodeSchema.safeParse(validNode);
    expect(result.success).toBe(true);
  });

  it('applies defaults for optional fields', () => {
    const minimal = {
      id: uuidv4(),
      name: 'Minimal Node',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };
    const result = CanonicalNodeSchema.parse(minimal);
    expect(result.nodeType).toBe('note');
    expect(result.content).toBeNull();
    expect(result.tags).toEqual([]);
    expect(result.priority).toBe(0);
    expect(result.version).toBe(1);
    expect(result.properties).toEqual({});
  });

  it('rejects invalid UUID', () => {
    const invalid = { ...validNode, id: 'not-a-uuid' };
    const result = CanonicalNodeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const invalid = { ...validNode, name: '' };
    const result = CanonicalNodeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects priority out of range', () => {
    const invalid = { ...validNode, priority: 10 };
    const result = CanonicalNodeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid datetime format', () => {
    const invalid = { ...validNode, createdAt: '2024-01-01' }; // Missing time component
    const result = CanonicalNodeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('accepts valid ISO datetime strings', () => {
    const withDates = {
      ...validNode,
      dueAt: '2024-12-31T23:59:59.999Z',
      eventStart: '2024-06-15T09:00:00Z',
      eventEnd: '2024-06-15T17:00:00Z',
    };
    const result = CanonicalNodeSchema.safeParse(withDates);
    expect(result.success).toBe(true);
  });

  it('stores arbitrary properties', () => {
    const withProps = {
      ...validNode,
      properties: {
        customField: 'custom value',
        nestedObject: { a: 1, b: 2 },
        arrayField: [1, 2, 3],
      },
    };
    const result = CanonicalNodeSchema.parse(withProps);
    expect(result.properties.customField).toBe('custom value');
    expect(result.properties.nestedObject).toEqual({ a: 1, b: 2 });
  });
});

describe('SQL_COLUMN_MAP', () => {
  it('maps all TypeScript fields to SQL columns', () => {
    const tsKeys = Object.keys(SQL_COLUMN_MAP);
    // Should have all CanonicalNode keys except 'properties'
    expect(tsKeys).toContain('nodeType');
    expect(tsKeys).toContain('createdAt');
    expect(tsKeys).toContain('locationName');
    expect(tsKeys).not.toContain('properties');
  });

  it('uses snake_case for SQL columns', () => {
    expect(SQL_COLUMN_MAP.nodeType).toBe('node_type');
    expect(SQL_COLUMN_MAP.createdAt).toBe('created_at');
    expect(SQL_COLUMN_MAP.locationName).toBe('location_name');
    expect(SQL_COLUMN_MAP.sourceUrl).toBe('source_url');
  });
});

describe('toSQLRecord', () => {
  it('converts camelCase to snake_case', () => {
    const node: CanonicalNode = {
      id: uuidv4(),
      nodeType: 'calendar',
      name: 'Test Event',
      content: null,
      summary: null,
      latitude: 40.7128,
      longitude: -74.006,
      locationName: 'New York',
      locationAddress: null,
      createdAt: '2024-01-01T00:00:00Z',
      modifiedAt: '2024-01-01T00:00:00Z',
      dueAt: null,
      completedAt: null,
      eventStart: '2024-06-15T09:00:00Z',
      eventEnd: '2024-06-15T17:00:00Z',
      folder: 'Work',
      tags: ['meeting', 'important'],
      status: 'confirmed',
      priority: 3,
      importance: 4,
      sortOrder: 1,
      gridX: 5,
      gridY: 10,
      source: 'test',
      sourceId: 'evt-123',
      sourceUrl: null,
      deletedAt: null,
      version: 1,
      properties: {},
    };

    const sql = toSQLRecord(node);
    expect(sql.node_type).toBe('calendar');
    expect(sql.location_name).toBe('New York');
    expect(sql.event_start).toBe('2024-06-15T09:00:00Z');
    expect(sql.grid_x).toBe(5);
    expect(sql.tags).toBe('["meeting","important"]');
  });

  it('converts empty tags to null', () => {
    const node = CanonicalNodeSchema.parse({
      id: uuidv4(),
      name: 'No Tags',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      tags: [],
    });
    const sql = toSQLRecord(node);
    expect(sql.tags).toBeNull();
  });
});

describe('fromSQLRecord', () => {
  it('converts snake_case to camelCase', () => {
    const sql = {
      id: uuidv4(),
      node_type: 'contact',
      name: 'John Doe',
      content: null,
      summary: null,
      latitude: null,
      longitude: null,
      location_name: null,
      location_address: null,
      created_at: '2024-01-01T00:00:00Z',
      modified_at: '2024-01-02T00:00:00Z',
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,
      folder: 'Contacts',
      tags: '["friend","colleague"]',
      status: null,
      priority: 0,
      importance: 0,
      sort_order: 0,
      grid_x: 0,
      grid_y: 0,
      source: 'contacts',
      source_id: 'c-123',
      source_url: null,
      deleted_at: null,
      version: 1,
    };

    const node = fromSQLRecord(sql);
    expect(node.nodeType).toBe('contact');
    expect(node.locationName).toBeNull();
    expect(node.modifiedAt).toBe('2024-01-02T00:00:00Z');
    expect(node.tags).toEqual(['friend', 'colleague']);
  });

  it('parses null tags to empty array', () => {
    const sql = {
      id: uuidv4(),
      node_type: 'note',
      name: 'No Tags',
      content: null,
      summary: null,
      latitude: null,
      longitude: null,
      location_name: null,
      location_address: null,
      created_at: '2024-01-01T00:00:00Z',
      modified_at: '2024-01-01T00:00:00Z',
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,
      folder: null,
      tags: null,
      status: null,
      priority: 0,
      importance: 0,
      sort_order: 0,
      grid_x: 0,
      grid_y: 0,
      source: null,
      source_id: null,
      source_url: null,
      deleted_at: null,
      version: 1,
    };

    const node = fromSQLRecord(sql);
    expect(node.tags).toEqual([]);
    expect(node.properties).toEqual({});
  });
});
