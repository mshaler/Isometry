/**
 * Property Classifier Service Tests
 *
 * Tests schema-on-read property classification into LATCH buckets.
 * This is Task 0.1 from the Navigators GSD Plan.
 *
 * Test requirements from the plan:
 * - Given the default facets table, returns 9 LATCH properties in correct buckets
 * - GRAPH bucket contains 4 edge types + 2 computed metrics
 * - Disabled facets are excluded
 * - Sort order is respected within each bucket
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  classifyProperties,
  type PropertyClassification,
  type PropertyBucket,
  type LATCHBucket,
} from '../property-classifier';

describe('Property Classifier Service', () => {
  let SQL: SqlJsStatic;
  let db: Database;

  beforeEach(async () => {
    // Load WASM directly for Node.js/Vitest environment
    const wasmPath = join(process.cwd(), 'public/wasm/sql-wasm.wasm');
    const wasmBinary = readFileSync(wasmPath);

    SQL = await initSqlJs({
      wasmBinary,
    });
    db = new SQL.Database();

    // Set up the facets table matching schema.sql
    db.exec(`
      CREATE TABLE IF NOT EXISTS facets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        facet_type TEXT NOT NULL,
        axis TEXT NOT NULL,
        source_column TEXT NOT NULL,
        options TEXT,
        icon TEXT,
        color TEXT,
        enabled INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0
      );

      -- Insert default facets from schema.sql
      INSERT INTO facets (id, name, facet_type, axis, source_column, sort_order) VALUES
        ('folder', 'Folder', 'select', 'C', 'folder', 0),
        ('tags', 'Tags', 'multi_select', 'C', 'tags', 1),
        ('status', 'Status', 'select', 'C', 'status', 2),
        ('priority', 'Priority', 'number', 'H', 'priority', 0),
        ('created', 'Created', 'date', 'T', 'created_at', 0),
        ('modified', 'Modified', 'date', 'T', 'modified_at', 1),
        ('due', 'Due Date', 'date', 'T', 'due_at', 2),
        ('name', 'Name', 'text', 'A', 'name', 0),
        ('location', 'Location', 'location', 'L', 'location_name', 0);

      -- Set up nodes table for dynamic property tests
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Set up node_properties table for dynamic property tests
      CREATE TABLE IF NOT EXISTS node_properties (
        id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        value TEXT,
        value_type TEXT NOT NULL DEFAULT 'string',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(node_id, key)
      );
    `);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('classifyProperties', () => {
    test('returns 9 LATCH properties in correct buckets from default facets', () => {
      const classification = classifyProperties(db);

      // Count total LATCH properties
      const latchCount =
        classification.L.length +
        classification.A.length +
        classification.T.length +
        classification.C.length +
        classification.H.length;

      expect(latchCount).toBe(9);

      // Verify bucket assignments
      expect(classification.L).toHaveLength(1); // location
      expect(classification.A).toHaveLength(1); // name
      expect(classification.T).toHaveLength(3); // created, modified, due
      expect(classification.C).toHaveLength(3); // folder, tags, status
      expect(classification.H).toHaveLength(1); // priority
    });

    test('GRAPH bucket contains 4 edge types + 2 computed metrics', () => {
      const classification = classifyProperties(db);

      expect(classification.GRAPH).toHaveLength(6);

      // Verify edge types
      const edgeTypes = classification.GRAPH.filter((p) => p.isEdgeProperty);
      expect(edgeTypes).toHaveLength(4);

      const edgeTypeNames = edgeTypes.map((p) => p.id);
      expect(edgeTypeNames).toContain('edge_type_LINK');
      expect(edgeTypeNames).toContain('edge_type_NEST');
      expect(edgeTypeNames).toContain('edge_type_SEQUENCE');
      expect(edgeTypeNames).toContain('edge_type_AFFINITY');

      // Verify computed metrics
      const metrics = classification.GRAPH.filter((p) => !p.isEdgeProperty);
      expect(metrics).toHaveLength(2);

      const metricNames = metrics.map((p) => p.id);
      expect(metricNames).toContain('metric_degree');
      expect(metricNames).toContain('metric_weight');
    });

    test('disabled facets are excluded', () => {
      // Disable the 'tags' facet
      db.run('UPDATE facets SET enabled = 0 WHERE id = ?', ['tags']);

      const classification = classifyProperties(db);

      // Should now have only 2 Category properties instead of 3
      expect(classification.C).toHaveLength(2);

      // Verify 'tags' is not in the result
      const tagsFacet = classification.C.find((p) => p.id === 'tags');
      expect(tagsFacet).toBeUndefined();
    });

    test('sort order is respected within each bucket', () => {
      const classification = classifyProperties(db);

      // Time bucket should be ordered: created (0), modified (1), due (2)
      expect(classification.T[0].id).toBe('created');
      expect(classification.T[1].id).toBe('modified');
      expect(classification.T[2].id).toBe('due');

      // Category bucket should be ordered: folder (0), tags (1), status (2)
      expect(classification.C[0].id).toBe('folder');
      expect(classification.C[1].id).toBe('tags');
      expect(classification.C[2].id).toBe('status');
    });

    test('returns correct ClassifiedProperty structure', () => {
      const classification = classifyProperties(db);

      // Check a LATCH property
      const folderProp = classification.C.find((p) => p.id === 'folder');
      expect(folderProp).toBeDefined();
      expect(folderProp!.id).toBe('folder');
      expect(folderProp!.name).toBe('Folder');
      expect(folderProp!.bucket).toBe('C');
      expect(folderProp!.sourceColumn).toBe('folder');
      expect(folderProp!.facetType).toBe('select');
      expect(folderProp!.enabled).toBe(true);
      expect(folderProp!.sortOrder).toBe(0);
      expect(folderProp!.isEdgeProperty).toBe(false);

      // Check a GRAPH property
      const linkProp = classification.GRAPH.find(
        (p) => p.id === 'edge_type_LINK'
      );
      expect(linkProp).toBeDefined();
      expect(linkProp!.bucket).toBe('GRAPH');
      expect(linkProp!.isEdgeProperty).toBe(true);
    });
  });

  describe('type safety', () => {
    test('LATCHBucket type covers all LATCH axes', () => {
      const buckets: LATCHBucket[] = ['L', 'A', 'T', 'C', 'H'];
      expect(buckets).toHaveLength(5);
    });

    test('PropertyBucket type includes GRAPH', () => {
      const allBuckets: PropertyBucket[] = ['L', 'A', 'T', 'C', 'H', 'GRAPH'];
      expect(allBuckets).toHaveLength(6);
    });
  });

  /**
   * Dynamic Property Discovery Tests (Phase 65)
   *
   * Tests for schema-on-read dynamic property discovery from node_properties table.
   */
  describe('Dynamic Property Discovery', () => {
    test('classifyProperties includes dynamic properties from node_properties', () => {
      // Setup: Create test nodes with custom properties
      db.run('INSERT INTO nodes (id, name) VALUES (?, ?)', ['node-1', 'Test Node 1']);
      db.run('INSERT INTO nodes (id, name) VALUES (?, ?)', ['node-2', 'Test Node 2']);
      db.run('INSERT INTO nodes (id, name) VALUES (?, ?)', ['node-3', 'Test Node 3']);

      // Add custom properties (3 nodes with same key to meet threshold)
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['prop-1', 'node-1', 'contact_email', '"user@example.com"', 'string']
      );
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['prop-2', 'node-2', 'contact_email', '"admin@example.com"', 'string']
      );
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['prop-3', 'node-3', 'contact_email', '"test@example.com"', 'string']
      );

      const classification = classifyProperties(db);

      // Should find the dynamic property
      const dynamicProps = [
        ...classification.L,
        ...classification.A,
        ...classification.T,
        ...classification.C,
        ...classification.H,
      ].filter((p) => p.isDynamic);

      expect(dynamicProps.length).toBeGreaterThan(0);

      const contactEmail = dynamicProps.find((p) => p.id === 'dynamic-contact_email');
      expect(contactEmail).toBeDefined();
      expect(contactEmail!.name).toBe('Contact Email');
      expect(contactEmail!.isDynamic).toBe(true);
      expect(contactEmail!.nodeCount).toBe(3);
      expect(contactEmail!.sourceColumn).toBe('node_properties.contact_email');
      expect(contactEmail!.bucket).toBe('A'); // String defaults to Alphabet
    });

    test('dynamic properties are filtered by node count threshold', () => {
      // Setup: One property with 5 nodes, one with only 1 node
      for (let i = 1; i <= 5; i++) {
        db.run('INSERT INTO nodes (id, name) VALUES (?, ?)', [`node-${i}`, `Node ${i}`]);
        db.run(
          'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
          [`prop-popular-${i}`, `node-${i}`, 'popular_field', '"value"', 'string']
        );
      }

      // Only 1 node with rare_field
      db.run('INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)', [
        'prop-rare-1',
        'node-1',
        'rare_field',
        '"rare"',
        'string',
      ]);

      const classification = classifyProperties(db);

      const allDynamicProps = [
        ...classification.L,
        ...classification.A,
        ...classification.T,
        ...classification.C,
        ...classification.H,
      ].filter((p) => p.isDynamic);

      // Should find popular_field (5 nodes >= 3 threshold)
      const popularProp = allDynamicProps.find((p) => p.id === 'dynamic-popular_field');
      expect(popularProp).toBeDefined();
      expect(popularProp!.nodeCount).toBe(5);

      // Should NOT find rare_field (1 node < 3 threshold)
      const rareProp = allDynamicProps.find((p) => p.id === 'dynamic-rare_field');
      expect(rareProp).toBeUndefined();
    });

    test('inferLATCHBucket maps value types correctly', () => {
      // Create test nodes
      for (let i = 1; i <= 3; i++) {
        db.run('INSERT INTO nodes (id, name) VALUES (?, ?)', [`node-${i}`, `Node ${i}`]);
      }

      // Number -> H
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['num-1', 'node-1', 'score', '100', 'number']
      );
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['num-2', 'node-2', 'score', '95', 'number']
      );
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['num-3', 'node-3', 'score', '88', 'number']
      );

      // Array -> C
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['arr-1', 'node-1', 'categories', '["a","b"]', 'array']
      );
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['arr-2', 'node-2', 'categories', '["c"]', 'array']
      );
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['arr-3', 'node-3', 'categories', '["d","e"]', 'array']
      );

      // Boolean -> C
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['bool-1', 'node-1', 'is_active', 'true', 'boolean']
      );
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['bool-2', 'node-2', 'is_active', 'false', 'boolean']
      );
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['bool-3', 'node-3', 'is_active', 'true', 'boolean']
      );

      // String with date key -> T
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['date-1', 'node-1', 'created_date', '"2024-01-15"', 'string']
      );
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['date-2', 'node-2', 'created_date', '"2024-01-16"', 'string']
      );
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['date-3', 'node-3', 'created_date', '"2024-01-17"', 'string']
      );

      // String with location key -> L
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['loc-1', 'node-1', 'address', '"123 Main St"', 'string']
      );
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['loc-2', 'node-2', 'address', '"456 Oak Ave"', 'string']
      );
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['loc-3', 'node-3', 'address', '"789 Elm Blvd"', 'string']
      );

      // Default string -> A
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['str-1', 'node-1', 'custom_field', '"value1"', 'string']
      );
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['str-2', 'node-2', 'custom_field', '"value2"', 'string']
      );
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['str-3', 'node-3', 'custom_field', '"value3"', 'string']
      );

      const classification = classifyProperties(db);

      // Verify bucket assignments
      const scoreProp = classification.H.find((p) => p.id === 'dynamic-score');
      expect(scoreProp).toBeDefined();
      expect(scoreProp!.bucket).toBe('H');

      const categoriesProp = classification.C.find((p) => p.id === 'dynamic-categories');
      expect(categoriesProp).toBeDefined();
      expect(categoriesProp!.bucket).toBe('C');

      const isActiveProp = classification.C.find((p) => p.id === 'dynamic-is_active');
      expect(isActiveProp).toBeDefined();
      expect(isActiveProp!.bucket).toBe('C');

      const createdDateProp = classification.T.find((p) => p.id === 'dynamic-created_date');
      expect(createdDateProp).toBeDefined();
      expect(createdDateProp!.bucket).toBe('T');

      const addressProp = classification.L.find((p) => p.id === 'dynamic-address');
      expect(addressProp).toBeDefined();
      expect(addressProp!.bucket).toBe('L');

      const customFieldProp = classification.A.find((p) => p.id === 'dynamic-custom_field');
      expect(customFieldProp).toBeDefined();
      expect(customFieldProp!.bucket).toBe('A');
    });

    test('dynamic property with collision gets renamed', () => {
      // Create test nodes
      for (let i = 1; i <= 3; i++) {
        db.run('INSERT INTO nodes (id, name) VALUES (?, ?)', [`node-${i}`, `Node ${i}`]);
      }

      // Add "priority" as a dynamic property (collides with schema facet "priority")
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['dyn-pri-1', 'node-1', 'priority', '10', 'number']
      );
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['dyn-pri-2', 'node-2', 'priority', '20', 'number']
      );
      db.run(
        'INSERT INTO node_properties (id, node_id, key, value, value_type) VALUES (?, ?, ?, ?, ?)',
        ['dyn-pri-3', 'node-3', 'priority', '30', 'number']
      );

      const classification = classifyProperties(db);

      // Schema priority should be unchanged
      const schemaPriority = classification.H.find((p) => p.id === 'priority');
      expect(schemaPriority).toBeDefined();
      expect(schemaPriority!.name).toBe('Priority');
      expect(schemaPriority!.isDynamic).toBeUndefined();

      // Dynamic priority should have "(custom)" suffix
      const dynamicPriority = classification.H.find((p) => p.id === 'dynamic-priority');
      expect(dynamicPriority).toBeDefined();
      expect(dynamicPriority!.name).toBe('Priority (custom)');
      expect(dynamicPriority!.isDynamic).toBe(true);
    });
  });

  /**
   * Phase 50 Requirements Traceability
   *
   * These tests explicitly map to Phase 50 FOUND-XX requirements to ensure
   * the implementation satisfies the schema-on-read property classification spec.
   */
  describe('Phase 50 Requirements Traceability', () => {
    // FOUND-01: Property classification service reads facets table and buckets into L, A, T, C, H, GRAPH
    test('[FOUND-01] buckets properties into L, A, T, C, H, GRAPH from facets table', () => {
      const classification = classifyProperties(db);

      // All buckets exist
      expect(classification).toHaveProperty('L');
      expect(classification).toHaveProperty('A');
      expect(classification).toHaveProperty('T');
      expect(classification).toHaveProperty('C');
      expect(classification).toHaveProperty('H');
      expect(classification).toHaveProperty('GRAPH');

      // Properties come from facets table (verified by count matching expected 9 default facets)
      const totalLATCH =
        classification.L.length +
        classification.A.length +
        classification.T.length +
        classification.C.length +
        classification.H.length;
      expect(totalLATCH).toBe(9);
    });

    // FOUND-02: GRAPH bucket contains 4 edge types + 2 computed metrics
    test('[FOUND-02] GRAPH contains 4 edge types and 2 metrics', () => {
      const classification = classifyProperties(db);

      const edgeTypes = classification.GRAPH.filter((p) => p.isEdgeProperty);
      const metrics = classification.GRAPH.filter((p) => !p.isEdgeProperty);

      // 4 edge types: Link, Nest, Sequence, Affinity (display names are capitalized)
      expect(edgeTypes.map((e) => e.name)).toEqual(['Link', 'Nest', 'Sequence', 'Affinity']);

      // 2 metrics: Degree, Weight
      expect(metrics.map((m) => m.name)).toEqual(['Degree', 'Weight']);
    });

    // FOUND-04: Disabled facets excluded from classification
    test('[FOUND-04] excludes disabled facets', () => {
      db.run('UPDATE facets SET enabled = 0 WHERE id = ?', ['tags']);
      const classification = classifyProperties(db);

      // Gather all property IDs across all buckets
      const allIds = [
        ...classification.L,
        ...classification.A,
        ...classification.T,
        ...classification.C,
        ...classification.H,
      ].map((p) => p.id);

      expect(allIds).not.toContain('tags');
    });

    // FOUND-05: Sort order from facets table is respected within each bucket
    test('[FOUND-05] respects sort_order within buckets', () => {
      const classification = classifyProperties(db);

      // Verify Time bucket is sorted by sort_order: created=0, modified=1, due=2
      const timeSortOrders = classification.T.map((p) => p.sortOrder);
      expect(timeSortOrders).toEqual([0, 1, 2]);

      // Verify Category bucket is sorted: folder=0, tags=1, status=2
      const categorySortOrders = classification.C.map((p) => p.sortOrder);
      expect(categorySortOrders).toEqual([0, 1, 2]);
    });
  });
});
