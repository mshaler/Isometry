/**
 * SuperStack SQL Integration Tests
 *
 * Integration tests for SQL query builders using real sql.js database.
 * Verifies query generation, execution, and tree building.
 *
 * Tests run against actual sql.js, not mocks, to ensure SQL is valid.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';

import {
  buildHeaderDiscoveryQuery,
  buildAggregateQuery,
} from '../queries/header-discovery';
import { buildHeaderTree } from '../builders/header-tree-builder';
import { COMMON_FACETS } from '../config/superstack-defaults';
import type { QueryRow, FacetConfig } from '../types/superstack';

// Schema for test database (matches cards table)
const SCHEMA = `
  CREATE TABLE cards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    folder TEXT,
    tags TEXT DEFAULT '[]',
    status TEXT DEFAULT 'active',
    priority INTEGER DEFAULT 0,
    card_type TEXT DEFAULT 'note',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    modified_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  );
`;

// Sample data spanning 2023-2024 with diverse tags
const SAMPLE_DATA = `
  INSERT INTO cards (id, name, folder, tags, status, priority, created_at, deleted_at) VALUES
    ('card-1', 'Meeting Notes', 'Work', '["meetings", "important"]', 'active', 2, '2024-01-15 10:00:00', NULL),
    ('card-2', 'Project Alpha', 'Work', '["projects", "important"]', 'active', 3, '2024-01-20 14:30:00', NULL),
    ('card-3', 'Birthday Party', 'Personal', '["events", "family"]', 'active', 1, '2024-02-10 09:00:00', NULL),
    ('card-4', 'Grocery List', 'Personal', '["shopping"]', 'completed', 0, '2024-02-15 11:00:00', NULL),
    ('card-5', 'Quarterly Review', 'Work', '["meetings", "review"]', 'active', 2, '2024-03-01 08:00:00', NULL),
    ('card-6', 'Vacation Plans', 'Personal', '["travel", "family"]', 'active', 1, '2024-03-15 16:00:00', NULL),
    ('card-7', 'Old Notes', 'Archive', '["legacy"]', 'archived', 0, '2023-06-01 10:00:00', NULL),
    ('card-8', 'Research Doc', 'Work', '["research", "important"]', 'active', 3, '2023-09-10 09:00:00', NULL),
    ('card-9', 'Holiday Shopping', 'Personal', '["shopping", "family"]', 'completed', 1, '2023-12-20 15:00:00', NULL),
    ('card-10', 'Team Building', 'Work', '["events", "meetings"]', 'active', 2, '2024-04-05 13:00:00', NULL),
    ('card-11', 'Archived Task', 'Archive', '["legacy"]', 'archived', 0, '2023-03-01 10:00:00', NULL),
    ('card-12', 'Deleted Card', 'Trash', '["deleted"]', 'active', 0, '2024-01-01 00:00:00', '2024-01-02 00:00:00');
`;

/**
 * Convert sql.js exec result to QueryRow array.
 */
function execToRows(result: ReturnType<Database['exec']>): QueryRow[] {
  if (result.length === 0) return [];

  const columns = result[0].columns;
  const values = result[0].values;

  return values.map(row => {
    const obj: Record<string, string | number> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i] as string | number;
    });
    return obj as QueryRow;
  });
}

describe('SuperStack SQL Integration', () => {
  let SQL: SqlJsStatic;
  let db: Database;

  beforeEach(async () => {
    SQL = await initSqlJs({
      locateFile: (file: string) => `public/wasm/${file}`,
    });
    db = new SQL.Database();
    db.exec(SCHEMA);
    db.exec(SAMPLE_DATA);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('buildHeaderDiscoveryQuery', () => {
    test('builds valid SQL for folder + tags rows, year + month columns', () => {
      const { sql, params } = buildHeaderDiscoveryQuery(
        [COMMON_FACETS.folder, COMMON_FACETS.tags],
        [COMMON_FACETS.year, COMMON_FACETS.month]
      );

      // SQL should contain expected clauses
      expect(sql).toContain('SELECT');
      expect(sql).toContain('json_each');
      expect(sql).toContain("strftime('%Y'");
      expect(sql).toContain("strftime('%m'");
      expect(sql).toContain('GROUP BY');
      expect(sql).toContain('HAVING card_count > 0');

      // Should be valid SQL (no syntax errors)
      expect(() => db.prepare(sql)).not.toThrow();

      // No params expected without filters
      expect(params).toHaveLength(0);
    });

    test('executes and returns expected result columns', () => {
      const { sql } = buildHeaderDiscoveryQuery(
        [COMMON_FACETS.folder],
        [COMMON_FACETS.year]
      );

      const result = db.exec(sql);
      expect(result.length).toBeGreaterThan(0);

      const columns = result[0].columns;
      expect(columns).toContain('folder');
      expect(columns).toContain('year');
      expect(columns).toContain('card_count');
    });

    test('excludes deleted cards by default', () => {
      const { sql } = buildHeaderDiscoveryQuery([COMMON_FACETS.folder], []);

      expect(sql).toContain('deleted_at IS NULL');

      const result = db.exec(sql);
      const rows = execToRows(result);
      const folders = rows.map(r => r.folder);

      // Trash folder (deleted card) should not appear
      expect(folders).not.toContain('Trash');
    });

    test('includes deleted cards when requested', () => {
      const { sql } = buildHeaderDiscoveryQuery(
        [COMMON_FACETS.folder],
        [],
        [],
        { includeDeleted: true }
      );

      expect(sql).not.toContain('deleted_at IS NULL');

      const result = db.exec(sql);
      const rows = execToRows(result);
      const folders = rows.map(r => r.folder);

      // Trash folder should appear
      expect(folders).toContain('Trash');
    });

    test('handles multi_select facets with json_each', () => {
      const { sql } = buildHeaderDiscoveryQuery([COMMON_FACETS.tags], []);

      // Should use CROSS JOIN json_each for tags
      expect(sql).toContain('CROSS JOIN json_each');
      expect(sql).toContain('je0.value');

      const result = db.exec(sql);
      const rows = execToRows(result);

      // Tags should be exploded - each tag becomes a separate row
      const tagValues = rows.map(r => r.tags);
      expect(tagValues).toContain('meetings');
      expect(tagValues).toContain('important');
      expect(tagValues).toContain('projects');
      expect(tagValues).toContain('family');
    });

    test('applies filters correctly', () => {
      const { sql, params } = buildHeaderDiscoveryQuery(
        [COMMON_FACETS.folder],
        [],
        [{ facetId: 'status', operator: 'eq', value: 'active' }]
      );

      expect(sql).toContain('cards.status = ?');
      expect(params).toContain('active');

      const result = db.exec(sql, params);
      const rows = execToRows(result);

      // Should only return active cards
      expect(rows.length).toBeGreaterThan(0);
      // Personal folder has both active and completed, so this filters
    });

    test('returns correct card counts', () => {
      const { sql } = buildHeaderDiscoveryQuery([COMMON_FACETS.folder], []);

      const result = db.exec(sql);
      const rows = execToRows(result);

      // Find Work folder count
      const workRow = rows.find(r => r.folder === 'Work');
      expect(workRow).toBeDefined();
      // Work has 5 cards (excluding deleted)
      expect(workRow!.card_count).toBe(5);

      // Find Personal folder count
      const personalRow = rows.find(r => r.folder === 'Personal');
      expect(personalRow).toBeDefined();
      // Personal has 4 cards
      expect(personalRow!.card_count).toBe(4);
    });

    test('handles multiple multi_select facets', () => {
      // Create a second multi_select facet for testing
      const tagsFacet2: FacetConfig = {
        id: 'tags2',
        name: 'Tags2',
        axis: 'C',
        sourceColumn: 'tags',
        dataType: 'multi_select',
        sortOrder: 'asc',
      };

      const { sql } = buildHeaderDiscoveryQuery(
        [COMMON_FACETS.tags, tagsFacet2],
        []
      );

      // Should have two CROSS JOINs with different aliases
      expect(sql).toContain('je0.value');
      expect(sql).toContain('je1.value');
      expect(sql.match(/CROSS JOIN json_each/g)?.length).toBe(2);

      // Should execute without error
      expect(() => db.exec(sql)).not.toThrow();
    });
  });

  describe('buildHeaderTree with SQL results', () => {
    test('builds correct tree from SQL results', () => {
      const { sql } = buildHeaderDiscoveryQuery([COMMON_FACETS.folder], []);
      const result = db.exec(sql);
      const rows = execToRows(result);

      const tree = buildHeaderTree(rows, [COMMON_FACETS.folder], 'row');

      expect(tree.axis).toBe('row');
      expect(tree.maxDepth).toBe(1);
      expect(tree.roots.length).toBeGreaterThan(0);

      // Each root should have correct structure
      tree.roots.forEach(node => {
        expect(node.depth).toBe(0);
        expect(node.facet.id).toBe('folder');
        expect(node.value).toBeDefined();
        expect(node.aggregate?.count).toBeGreaterThan(0);
      });
    });

    test('calculates spans correctly from SQL data', () => {
      const { sql } = buildHeaderDiscoveryQuery(
        [COMMON_FACETS.folder, COMMON_FACETS.status],
        []
      );
      const result = db.exec(sql);
      const rows = execToRows(result);

      const tree = buildHeaderTree(
        rows,
        [COMMON_FACETS.folder, COMMON_FACETS.status],
        'row'
      );

      // Parent span should equal sum of children spans
      tree.roots.forEach(parent => {
        if (parent.children.length > 0) {
          const childrenSpanSum = parent.children.reduce(
            (sum, child) => sum + child.span,
            0
          );
          expect(parent.span).toBe(childrenSpanSum);
        } else {
          expect(parent.span).toBe(1);
        }
      });
    });

    test('accumulates counts correctly from SQL data', () => {
      const { sql } = buildHeaderDiscoveryQuery(
        [COMMON_FACETS.folder, COMMON_FACETS.status],
        []
      );
      const result = db.exec(sql);
      const rows = execToRows(result);

      const tree = buildHeaderTree(
        rows,
        [COMMON_FACETS.folder, COMMON_FACETS.status],
        'row'
      );

      // Parent count should equal sum of children counts
      tree.roots.forEach(parent => {
        if (parent.children.length > 0) {
          const childrenCountSum = parent.children.reduce(
            (sum, child) => sum + (child.aggregate?.count || 0),
            0
          );
          expect(parent.aggregate?.count).toBe(childrenCountSum);
        }
      });
    });
  });

  describe('Time facet extraction', () => {
    test('extracts year correctly', () => {
      const { sql } = buildHeaderDiscoveryQuery(
        [COMMON_FACETS.year],
        []
      );

      expect(sql).toContain("strftime('%Y'");

      const result = db.exec(sql);
      const rows = execToRows(result);
      const years = rows.map(r => r.year);

      expect(years).toContain('2024');
      expect(years).toContain('2023');
    });

    test('extracts month correctly', () => {
      const { sql } = buildHeaderDiscoveryQuery(
        [COMMON_FACETS.month],
        []
      );

      expect(sql).toContain("strftime('%m'");

      const result = db.exec(sql);
      const rows = execToRows(result);
      const months = rows.map(r => r.month);

      // Sample data has cards in various months
      expect(months.length).toBeGreaterThan(0);
      // Months should be in 01-12 format
      months.forEach(month => {
        const monthNum = parseInt(String(month), 10);
        expect(monthNum).toBeGreaterThanOrEqual(1);
        expect(monthNum).toBeLessThanOrEqual(12);
      });
    });
  });

  describe('Performance', () => {
    test('completes query in reasonable time (<100ms)', () => {
      const { sql } = buildHeaderDiscoveryQuery(
        [COMMON_FACETS.folder, COMMON_FACETS.tags],
        [COMMON_FACETS.year, COMMON_FACETS.month]
      );

      const startTime = performance.now();
      db.exec(sql);
      const duration = performance.now() - startTime;

      // Query should complete in under 100ms for test dataset
      expect(duration).toBeLessThan(100);
    });
  });

  describe('buildAggregateQuery', () => {
    test('returns correct aggregate stats', () => {
      const { sql } = buildAggregateQuery();

      const result = db.exec(sql);
      expect(result.length).toBe(1);

      const columns = result[0].columns;
      expect(columns).toContain('total_cards');
      expect(columns).toContain('unique_folders');
      expect(columns).toContain('earliest_date');
      expect(columns).toContain('latest_date');

      const row = result[0].values[0];
      const totalCards = row[columns.indexOf('total_cards')] as number;
      const uniqueFolders = row[columns.indexOf('unique_folders')] as number;

      // 11 non-deleted cards in sample data
      expect(totalCards).toBe(11);
      // Work, Personal, Archive folders
      expect(uniqueFolders).toBe(3);
    });

    test('respects includeDeleted option', () => {
      const { sql: sqlExcluding } = buildAggregateQuery([], {
        includeDeleted: false,
      });
      const { sql: sqlIncluding } = buildAggregateQuery([], {
        includeDeleted: true,
      });

      const excludingResult = db.exec(sqlExcluding);
      const includingResult = db.exec(sqlIncluding);

      const excludingCount = excludingResult[0].values[0][0] as number;
      const includingCount = includingResult[0].values[0][0] as number;

      // Including deleted should have one more card
      expect(includingCount).toBe(excludingCount + 1);
    });
  });

  describe('Edge cases', () => {
    test('handles empty result set', () => {
      const { sql, params } = buildHeaderDiscoveryQuery(
        [COMMON_FACETS.folder],
        [],
        [{ facetId: 'folder', operator: 'eq', value: 'NonExistent' }]
      );

      const result = db.exec(sql, params);

      // Should return empty but not throw
      expect(result.length === 0 || result[0].values.length === 0).toBe(true);

      // Tree builder should handle empty results
      const rows = execToRows(result);
      const tree = buildHeaderTree(rows, [COMMON_FACETS.folder], 'row');

      expect(tree.roots).toHaveLength(0);
      expect(tree.leafCount).toBe(0);
    });

    test('handles NULL values in facets', () => {
      // Insert card with NULL folder
      db.run("INSERT INTO cards (id, name, folder) VALUES ('null-test', 'Null Folder', NULL)");

      const { sql } = buildHeaderDiscoveryQuery([COMMON_FACETS.folder], []);
      const result = db.exec(sql);
      const rows = execToRows(result);

      // NULL should appear as empty string or be filtered
      // This behavior depends on SQL COALESCE usage
      expect(rows.length).toBeGreaterThan(0);
    });
  });
});
