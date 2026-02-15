/**
 * Facet Discovery Integration Tests
 *
 * Phase 100-02 Task 3: Test facet value discovery with real sql.js database
 *
 * Tests cover:
 * - Standard facet discovery (folder, status)
 * - Multi-select facet discovery (tags via json_each)
 * - Edge cases (empty data, malformed JSON, null values)
 * - Generic discovery function
 */

import { describe, it, expect, beforeEach } from 'vitest';
import initSqlJs, { type Database } from 'sql.js';
import {
  discoverFolderValues,
  discoverStatusValues,
  discoverFacetValues,
  buildFacetDiscoveryQuery,
  type DiscoveredValue,
} from '../facet-discovery';

describe('Facet Discovery Service', () => {
  let db: Database;

  beforeEach(async () => {
    // Initialize sql.js
    const SQL = await initSqlJs({
      locateFile: (file: string) => `/wasm/${file}`,
    });

    // Create in-memory database with cards table
    db = new SQL.Database();
    db.exec(`
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        name TEXT,
        folder TEXT,
        status TEXT,
        tags TEXT, -- JSON array
        priority INTEGER DEFAULT 0,
        deleted_at INTEGER
      );
    `);

    // Insert test data
    db.exec(`
      INSERT INTO cards (id, name, folder, status, tags, priority) VALUES
        ('card1', 'Card 1', 'work', 'active', '["urgent", "review"]', 1),
        ('card2', 'Card 2', 'work', 'active', '["urgent"]', 2),
        ('card3', 'Card 3', 'personal', 'done', '["review", "completed"]', 0),
        ('card4', 'Card 4', 'personal', 'waiting', '["urgent"]', 1),
        ('card5', 'Card 5', 'work', 'done', NULL, 0),
        ('card6', 'Card 6', '', 'active', '[]', 0), -- empty folder
        ('card7', 'Card 7', 'work', NULL, '["urgent"]', 0), -- null status
        ('card8', 'Card 8', 'archive', 'done', '["archived"]', 0);
    `);

    // Insert deleted card (should be excluded)
    // Note: deleted_at must be non-NULL to be filtered out
    db.exec(`
      INSERT INTO cards (id, name, folder, status, deleted_at) VALUES
        ('deleted1', 'Deleted Card', 'work', 'active', 1);
    `);
  });

  describe('buildFacetDiscoveryQuery', () => {
    it('builds query for standard column', () => {
      const { sql, params } = buildFacetDiscoveryQuery('folder');

      expect(sql).toContain('SELECT DISTINCT folder as value');
      expect(sql).toContain('FROM cards');
      expect(sql).toContain('WHERE deleted_at IS NULL');
      expect(sql).toContain('AND folder IS NOT NULL');
      expect(sql).toContain('GROUP BY folder');
      expect(sql).toContain('ORDER BY count DESC');
      expect(params).toEqual([100]); // default limit
    });

    it('builds query for multi-select column', () => {
      const { sql, params } = buildFacetDiscoveryQuery('tags', { isMultiSelect: true });

      expect(sql).toContain('CROSS JOIN json_each(cards.tags)');
      expect(sql).toContain('json_valid(tags)');
      expect(sql).toContain('GROUP BY je.value');
      expect(params).toEqual([100]);
    });

    it('respects excludeNull option', () => {
      const { sql } = buildFacetDiscoveryQuery('folder', { excludeNull: false });
      expect(sql).not.toContain('AND folder IS NOT NULL');
    });

    it('respects custom limit', () => {
      const { params } = buildFacetDiscoveryQuery('folder', { limit: 50 });
      expect(params).toEqual([50]);
    });
  });

  describe('discoverFolderValues', () => {
    it('returns distinct folders ordered by count', () => {
      const values = discoverFolderValues(db);

      expect(values).toHaveLength(3); // work, personal, archive (empty excluded)
      expect(values[0]).toEqual({ value: 'work', count: 4 }); // card1, card2, card5, card7
      expect(values[1]).toEqual({ value: 'personal', count: 2 }); // card3, card4
      expect(values[2]).toEqual({ value: 'archive', count: 1 }); // card8
    });

    it('excludes null and empty folders', () => {
      const values = discoverFolderValues(db);

      const folders = values.map(v => v.value);
      expect(folders).not.toContain('');
      expect(folders).not.toContain(null);
    });

    it('excludes deleted cards', () => {
      const values = discoverFolderValues(db);

      // 'work' should have count 4 (card1, card2, card5, card7), not 5 (deleted card excluded)
      const workFolder = values.find(v => v.value === 'work');
      expect(workFolder?.count).toBe(4);
    });

    it('returns empty array for empty table', () => {
      db.exec('DELETE FROM cards');
      const values = discoverFolderValues(db);

      expect(values).toEqual([]);
    });
  });

  describe('discoverStatusValues', () => {
    it('returns distinct statuses ordered by count', () => {
      const values = discoverStatusValues(db);

      expect(values).toHaveLength(3); // active, done, waiting (null excluded)

      // Both active and done have count 3, order may vary
      const statusCounts = values.map(v => ({ value: v.value, count: v.count }));
      const activeOrDone = statusCounts.filter(s => s.value === 'active' || s.value === 'done');
      const waiting = statusCounts.find(s => s.value === 'waiting');

      expect(activeOrDone).toHaveLength(2);
      expect(activeOrDone.every(s => s.count === 3)).toBe(true);
      expect(waiting).toEqual({ value: 'waiting', count: 1 });
    });

    it('excludes null status', () => {
      const values = discoverStatusValues(db);

      const statuses = values.map(v => v.value);
      expect(statuses).not.toContain(null);
    });
  });

  describe('discoverFacetValues (generic)', () => {
    it('works for any column', () => {
      const values = discoverFacetValues(db, 'folder');

      expect(values).toHaveLength(3);
      expect(values[0].value).toBe('work');
    });

    it('respects custom limit', () => {
      const values = discoverFacetValues(db, 'folder', { limit: 2 });

      expect(values).toHaveLength(2);
      expect(values.map(v => v.value)).toEqual(['work', 'personal']);
    });

    it('handles non-existent column gracefully', () => {
      const values = discoverFacetValues(db, 'nonexistent_column');

      expect(values).toEqual([]); // Should return empty, not crash
    });

    it('returns empty array for column with all nulls', () => {
      // Add column with all nulls
      db.exec('ALTER TABLE cards ADD COLUMN empty_column TEXT');
      const values = discoverFacetValues(db, 'empty_column');

      expect(values).toEqual([]);
    });
  });

  describe('Multi-select facets (tags)', () => {
    it('explodes JSON arrays via json_each', () => {
      const values = discoverFacetValues(db, 'tags', { isMultiSelect: true });

      // Expected tags: urgent(4), review(2), completed(1), archived(1)
      expect(values).toHaveLength(4);
      expect(values[0]).toEqual({ value: 'urgent', count: 4 });
      expect(values[1]).toEqual({ value: 'review', count: 2 });
    });

    it('handles cards with multiple tags', () => {
      const values = discoverFacetValues(db, 'tags', { isMultiSelect: true });

      // card1 has ['urgent', 'review'] — both should be counted
      const urgent = values.find(v => v.value === 'urgent');
      const review = values.find(v => v.value === 'review');

      expect(urgent).toBeDefined();
      expect(review).toBeDefined();
    });

    it('handles empty JSON arrays', () => {
      const values = discoverFacetValues(db, 'tags', { isMultiSelect: true });

      // card6 has empty array [] — should not add any values
      // We should have 4 distinct tags, not 5
      expect(values).toHaveLength(4);
    });

    it('handles null tags safely', () => {
      const values = discoverFacetValues(db, 'tags', { isMultiSelect: true });

      // card5 has NULL tags — should be excluded by json_valid
      // No crash, query still works
      expect(values.length).toBeGreaterThan(0);
    });

    it('handles malformed JSON gracefully', () => {
      // Insert card with malformed JSON
      db.exec(`
        INSERT INTO cards (id, name, folder, tags) VALUES
          ('malformed', 'Bad JSON', 'test', 'not-a-json-array');
      `);

      const values = discoverFacetValues(db, 'tags', { isMultiSelect: true });

      // json_valid guard should exclude malformed JSON
      // Query should not crash
      expect(values).toBeDefined();
      expect(Array.isArray(values)).toBe(true);
    });
  });

  describe('Count accuracy', () => {
    it('returns correct counts for overlapping values', () => {
      const statusValues = discoverStatusValues(db);

      // Count totals should match non-deleted cards
      const totalCount = statusValues.reduce((sum, v) => sum + v.count, 0);

      // 8 cards total, minus 1 deleted, minus 1 with null status = 6
      const expectedNonDeletedWithStatus = 7; // card1-8 except deleted1
      expect(totalCount).toBe(expectedNonDeletedWithStatus);
    });

    it('returns count per value for multi-select', () => {
      const tagValues = discoverFacetValues(db, 'tags', { isMultiSelect: true });

      // Verify counts match actual tag occurrences
      const urgentCount = tagValues.find(v => v.value === 'urgent')?.count;
      const reviewCount = tagValues.find(v => v.value === 'review')?.count;

      expect(urgentCount).toBe(4); // card1, card2, card4, card7
      expect(reviewCount).toBe(2); // card1, card3
    });
  });
});
