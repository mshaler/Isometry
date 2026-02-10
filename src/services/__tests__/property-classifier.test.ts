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

      // 4 edge types: LINK, NEST, SEQUENCE, AFFINITY
      expect(edgeTypes.map((e) => e.name)).toEqual(['LINK', 'NEST', 'SEQUENCE', 'AFFINITY']);

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
