/**
 * Header Discovery Query Generator Tests
 *
 * Tests for buildHeaderDiscoveryQuery and buildStackedHeaderQuery.
 * Includes mandatory performance benchmark for 10K node dataset.
 *
 * Phase 90-01: SQL Integration for SuperStack headers
 */

import { describe, it, expect, beforeAll } from 'vitest';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import {
  buildHeaderDiscoveryQuery,
  buildStackedHeaderQuery,
  buildFacetSelect,
} from '../header-discovery';
import type { FacetConfig } from '../../../superstack/types/superstack';

// Mock FacetConfig objects for testing
const yearFacet: FacetConfig = {
  id: 'created_year',
  name: 'Year',
  axis: 'T',
  sourceColumn: 'created_at',
  dataType: 'date',
  timeFormat: '%Y',
  sortOrder: 'desc',
};

const quarterFacet: FacetConfig = {
  id: 'created_quarter',
  name: 'Quarter',
  axis: 'T',
  sourceColumn: 'created_at',
  dataType: 'date',
  timeFormat: '%Q',
  sortOrder: 'desc',
};

const monthFacet: FacetConfig = {
  id: 'created_month',
  name: 'Month',
  axis: 'T',
  sourceColumn: 'created_at',
  dataType: 'date',
  timeFormat: '%B',
  sortOrder: 'asc',
};

const weekFacet: FacetConfig = {
  id: 'created_week',
  name: 'Week',
  axis: 'T',
  sourceColumn: 'created_at',
  dataType: 'date',
  timeFormat: '%W',
  sortOrder: 'desc',
};

const tagsFacet: FacetConfig = {
  id: 'tags',
  name: 'Tags',
  axis: 'C',
  sourceColumn: 'tags',
  dataType: 'multi_select',
  sortOrder: 'desc',
};

const folderFacet: FacetConfig = {
  id: 'folder',
  name: 'Folder',
  axis: 'C',
  sourceColumn: 'folder',
  dataType: 'text',
  sortOrder: 'desc',
};

const statusFacet: FacetConfig = {
  id: 'status',
  name: 'Status',
  axis: 'C',
  sourceColumn: 'status',
  dataType: 'select',
  options: ['active', 'archived', 'completed'],
  sortOrder: 'custom',
};

const priorityFacet: FacetConfig = {
  id: 'priority',
  name: 'Priority',
  axis: 'H',
  sourceColumn: 'priority',
  dataType: 'number',
  sortOrder: 'desc',
};

describe('buildHeaderDiscoveryQuery', () => {
  describe('date facets', () => {
    it('generates year extraction query', () => {
      const sql = buildHeaderDiscoveryQuery(yearFacet);

      expect(sql).toContain(`strftime('%Y', created_at)`);
      expect(sql).toContain('as value');
      expect(sql).toContain('COUNT(*) as card_count');
      expect(sql).toContain('GROUP BY value');
      expect(sql).toContain('deleted_at IS NULL');
      expect(sql).toContain('created_at IS NOT NULL');
      expect(sql).toContain('ORDER BY value DESC');
    });

    it('generates quarter calculation query', () => {
      const sql = buildHeaderDiscoveryQuery(quarterFacet);

      expect(sql).toContain(`'Q' ||`);
      expect(sql).toContain(`strftime('%m', created_at)`);
      expect(sql).toContain('/ 3 + 1');
      expect(sql).toContain('as value');
      expect(sql).toContain('COUNT(*) as card_count');
      expect(sql).toContain('GROUP BY value');
      expect(sql).toContain('deleted_at IS NULL');
    });

    it('generates month name query with numeric ordering', () => {
      const sql = buildHeaderDiscoveryQuery(monthFacet);

      expect(sql).toContain(`strftime('%B', created_at)`);
      expect(sql).toContain('as value');
      expect(sql).toContain('COUNT(*) as card_count');
      expect(sql).toContain('GROUP BY value');
      expect(sql).toContain(`ORDER BY strftime('%m', created_at)`);
      expect(sql).toContain('deleted_at IS NULL');
    });

    it('generates week number query', () => {
      const sql = buildHeaderDiscoveryQuery(weekFacet);

      expect(sql).toContain(`strftime('%W', created_at)`);
      expect(sql).toContain('as value');
      expect(sql).toContain('COUNT(*) as card_count');
      expect(sql).toContain('GROUP BY value');
      expect(sql).toContain('deleted_at IS NULL');
    });

    it('throws error for date facet without timeFormat', () => {
      const invalidFacet: FacetConfig = {
        ...yearFacet,
        timeFormat: undefined,
      };

      expect(() => buildHeaderDiscoveryQuery(invalidFacet)).toThrow(
        'Missing timeFormat for date facet'
      );
    });
  });

  describe('multi_select facets', () => {
    it('generates json_each explosion query', () => {
      const sql = buildHeaderDiscoveryQuery(tagsFacet);

      expect(sql).toContain('json_each.value');
      expect(sql).toContain('COUNT(*) as card_count');
      expect(sql).toContain('FROM nodes, json_each(nodes.tags)');
      expect(sql).toContain('GROUP BY json_each.value');
      expect(sql).toContain('nodes.deleted_at IS NULL');
      expect(sql).toContain('nodes.tags IS NOT NULL');
      expect(sql).toContain(`nodes.tags != '[]'`);
      expect(sql).toContain('ORDER BY card_count DESC');
    });
  });

  describe('simple facets', () => {
    it('generates text facet query with COALESCE', () => {
      const sql = buildHeaderDiscoveryQuery(folderFacet);

      expect(sql).toContain('COALESCE(folder, \'Unassigned\')');
      expect(sql).toContain('as value');
      expect(sql).toContain('COUNT(*) as card_count');
      expect(sql).toContain('FROM nodes');
      expect(sql).toContain('GROUP BY value');
      expect(sql).toContain('deleted_at IS NULL');
      expect(sql).toContain('ORDER BY card_count DESC');
    });

    it('generates select facet query with COALESCE', () => {
      const sql = buildHeaderDiscoveryQuery(statusFacet);

      expect(sql).toContain('COALESCE(status, \'Unassigned\')');
      expect(sql).toContain('as value');
      expect(sql).toContain('COUNT(*) as card_count');
      expect(sql).toContain('deleted_at IS NULL');
    });

    it('generates number facet query with COALESCE', () => {
      const sql = buildHeaderDiscoveryQuery(priorityFacet);

      expect(sql).toContain('COALESCE(priority, \'Unassigned\')');
      expect(sql).toContain('as value');
      expect(sql).toContain('COUNT(*) as card_count');
      expect(sql).toContain('deleted_at IS NULL');
    });
  });

  describe('error handling', () => {
    it('throws error for unsupported dataType', () => {
      const invalidFacet = {
        ...folderFacet,
        dataType: 'invalid' as any,
      };

      expect(() => buildHeaderDiscoveryQuery(invalidFacet)).toThrow(
        'Unsupported dataType: invalid'
      );
    });

    it('returns empty result for empty sourceColumn', () => {
      const emptyFacet: FacetConfig = {
        ...folderFacet,
        sourceColumn: '',
      };

      const sql = buildHeaderDiscoveryQuery(emptyFacet);
      expect(sql).toContain('WHERE 1=0');
    });
  });

  describe('deleted_at filter', () => {
    it('includes deleted_at IS NULL in all queries', () => {
      const facets = [yearFacet, quarterFacet, monthFacet, tagsFacet, folderFacet];

      facets.forEach(facet => {
        const sql = buildHeaderDiscoveryQuery(facet);
        expect(sql).toContain('deleted_at IS NULL');
      });
    });
  });
});

describe('buildFacetSelect', () => {
  it('generates date facet SELECT fragment', () => {
    const fragment = buildFacetSelect(yearFacet, 'year');
    expect(fragment).toBe(`strftime('%Y', created_at) as year`);
  });

  it('generates quarter facet SELECT fragment', () => {
    const fragment = buildFacetSelect(quarterFacet, 'quarter');
    expect(fragment).toContain(`'Q' ||`);
    expect(fragment).toContain(`strftime('%m', created_at)`);
    expect(fragment).toContain('as quarter');
  });

  it('generates multi_select SELECT fragment', () => {
    const fragment = buildFacetSelect(tagsFacet, 'tag');
    expect(fragment).toBe('json_each.value as tag');
  });

  it('generates simple facet SELECT fragment', () => {
    const fragment = buildFacetSelect(folderFacet, 'folder_val');
    expect(fragment).toBe(`COALESCE(folder, 'Unassigned') as folder_val`);
  });

  it('uses facet.id as default alias', () => {
    const fragment = buildFacetSelect(folderFacet);
    expect(fragment).toBe(`COALESCE(folder, 'Unassigned') as folder`);
  });
});

describe('buildStackedHeaderQuery', () => {
  it('delegates to buildHeaderDiscoveryQuery for single facet', () => {
    const sql = buildStackedHeaderQuery([folderFacet]);
    const expected = buildHeaderDiscoveryQuery(folderFacet);
    expect(sql).toBe(expected);
  });

  it('generates two-level stacked query (folder > status)', () => {
    const sql = buildStackedHeaderQuery([folderFacet, statusFacet]);

    expect(sql).toContain('COALESCE(folder, \'Unassigned\') as facet_0');
    expect(sql).toContain('COALESCE(status, \'Unassigned\') as facet_1');
    expect(sql).toContain('COUNT(*) as card_count');
    expect(sql).toContain('FROM nodes');
    expect(sql).toContain('nodes.deleted_at IS NULL');
    expect(sql).toContain('nodes.folder IS NOT NULL');
    expect(sql).toContain('nodes.status IS NOT NULL');
    expect(sql).toContain('GROUP BY');
  });

  it('generates three-level time hierarchy (year > quarter > month)', () => {
    const sql = buildStackedHeaderQuery([yearFacet, quarterFacet, monthFacet]);

    expect(sql).toContain(`strftime('%Y', created_at) as facet_0`);
    expect(sql).toContain(`'Q' ||`); // Quarter formula
    expect(sql).toContain(`strftime('%B', created_at) as facet_2`);
    expect(sql).toContain('COUNT(*) as card_count');
    expect(sql).toContain('deleted_at IS NULL');
    expect(sql).toContain('GROUP BY');
  });

  it('handles empty facet array', () => {
    const sql = buildStackedHeaderQuery([]);
    expect(sql).toContain('WHERE 1=0');
  });

  it('handles multi_select in FROM clause', () => {
    const sql = buildStackedHeaderQuery([folderFacet, tagsFacet]);

    expect(sql).toContain('FROM nodes, json_each(nodes.tags)');
    expect(sql).toContain('json_each.value as facet_1');
    expect(sql).toContain(`nodes.tags != '[]'`);
  });
});

describe('SQL snapshots', () => {
  it('matches year facet SQL snapshot', () => {
    const sql = buildHeaderDiscoveryQuery(yearFacet);
    expect(sql).toMatchInlineSnapshot(`
      "SELECT strftime('%Y', created_at) as value, COUNT(*) as card_count
          FROM nodes
          WHERE deleted_at IS NULL AND created_at IS NOT NULL
          GROUP BY value
          ORDER BY value DESC"
    `);
  });

  it('matches tags facet SQL snapshot', () => {
    const sql = buildHeaderDiscoveryQuery(tagsFacet);
    expect(sql).toMatchInlineSnapshot(`
      "SELECT json_each.value, COUNT(*) as card_count
          FROM nodes, json_each(nodes.tags)
          WHERE nodes.deleted_at IS NULL
            AND nodes.tags IS NOT NULL
            AND nodes.tags != '[]'
          GROUP BY json_each.value
          ORDER BY card_count DESC"
    `);
  });

  it('matches folder facet SQL snapshot', () => {
    const sql = buildHeaderDiscoveryQuery(folderFacet);
    expect(sql).toMatchInlineSnapshot(`
      "SELECT COALESCE(folder, 'Unassigned') as value, COUNT(*) as card_count
          FROM nodes
          WHERE deleted_at IS NULL
          GROUP BY value
          ORDER BY card_count DESC"
    `);
  });
});

describe('Performance benchmark (MANDATORY)', () => {
  let SQL: any;
  let db: SqlJsDatabase;

  beforeAll(async () => {
    // Initialize sql.js
    SQL = await initSqlJs();
    db = new SQL.Database();

    // Create nodes table with schema
    db.run(`
      CREATE TABLE nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        folder TEXT,
        status TEXT,
        priority INTEGER,
        tags TEXT,
        created_at TEXT,
        modified_at TEXT,
        deleted_at TEXT
      )
    `);

    // Generate 10,000 mock nodes with varied data
    const folders = ['Work', 'Personal', 'Projects', 'Archive', 'Ideas'];
    const statuses = ['active', 'completed', 'archived', 'pending'];
    const tagSets = [
      '["meeting", "urgent"]',
      '["research", "reading"]',
      '["dev", "backend"]',
      '["design", "ui"]',
      '[]',
    ];
    const priorities = [1, 2, 3, 4, 5];

    // Create dates across 3 years (2023-2025)
    const startDate = new Date('2023-01-01');
    const endDate = new Date('2025-12-31');
    const dateRange = endDate.getTime() - startDate.getTime();

    const stmt = db.prepare(`
      INSERT INTO nodes (name, folder, status, priority, tags, created_at, modified_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    `);

    for (let i = 0; i < 10000; i++) {
      const folder = folders[i % folders.length];
      const status = statuses[i % statuses.length];
      const priority = priorities[i % priorities.length];
      const tags = tagSets[i % tagSets.length];

      // Random date in range
      const randomTime = startDate.getTime() + Math.random() * dateRange;
      const createdAt = new Date(randomTime).toISOString();
      const modifiedAt = new Date(randomTime + Math.random() * 86400000).toISOString();

      stmt.run([
        `Card ${i}`,
        folder,
        status,
        priority,
        tags,
        createdAt,
        modifiedAt,
      ]);
    }

    stmt.free();
  }, 30000); // 30s timeout for setup

  it('executes simple facet query in <100ms', () => {
    const sql = buildHeaderDiscoveryQuery(folderFacet);

    const start = performance.now();
    const result = db.exec(sql);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
    expect(result.length).toBe(1);
    expect(result[0].columns).toEqual(['value', 'card_count']);
    expect(result[0].values.length).toBeGreaterThan(0);
  });

  it('executes date facet query (year) in <100ms', () => {
    const sql = buildHeaderDiscoveryQuery(yearFacet);

    const start = performance.now();
    const result = db.exec(sql);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
    expect(result.length).toBe(1);
    expect(result[0].columns).toEqual(['value', 'card_count']);
    expect(result[0].values.length).toBeGreaterThan(0);

    // Verify years are present (2023, 2024, 2025)
    const years = result[0].values.map(row => row[0]);
    expect(years).toContain('2023');
    expect(years).toContain('2024');
    expect(years).toContain('2025');
  });

  it('executes multi_select facet query (tags) in <100ms', () => {
    const sql = buildHeaderDiscoveryQuery(tagsFacet);

    const start = performance.now();
    const result = db.exec(sql);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
    expect(result.length).toBe(1);
    expect(result[0].columns).toEqual(['value', 'card_count']);
    expect(result[0].values.length).toBeGreaterThan(0);

    // Verify tag values are extracted
    const tags = result[0].values.map(row => row[0]);
    expect(tags).toContain('meeting');
    expect(tags).toContain('urgent');
    expect(tags).toContain('research');
  });

  it('executes stacked query (folder > status) in <100ms', () => {
    const sql = buildStackedHeaderQuery([folderFacet, statusFacet]);

    const start = performance.now();
    const result = db.exec(sql);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
    expect(result.length).toBe(1);
    expect(result[0].columns).toEqual(['facet_0', 'facet_1', 'card_count']);
    expect(result[0].values.length).toBeGreaterThan(0);
  });

  it('executes three-level time hierarchy in <100ms', () => {
    const sql = buildStackedHeaderQuery([yearFacet, quarterFacet, monthFacet]);

    const start = performance.now();
    const result = db.exec(sql);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
    expect(result.length).toBe(1);
    expect(result[0].values.length).toBeGreaterThan(0);
  });
});
