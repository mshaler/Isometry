/**
 * Search Benchmark Tests
 *
 * Measures FTS5 search performance at scale.
 * Target from SuperGrid-Specification.md Section 12:
 * - FTS5 search (10k cards): < 100ms
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import initSqlJs, { type Database } from 'sql.js';
import { generateBenchmarkData, insertBenchmarkNodes } from './test-data-generator';
import type { Node } from '@/types/node';

// Performance threshold from spec
const FTS5_THRESHOLD_MS = 100;

describe('Search Performance Benchmarks', () => {
  let db: Database;
  let nodes10k: Node[];

  beforeAll(async () => {
    // Initialize sql.js
    const SQL = await initSqlJs();
    db = new SQL.Database();

    // Create schema with FTS5
    db.run(`
      CREATE TABLE nodes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        content TEXT,
        folder TEXT,
        tags TEXT,
        status TEXT,
        priority INTEGER,
        created_at TEXT,
        modified_at TEXT,
        source TEXT,
        source_id TEXT,
        deleted_at TEXT
      )
    `);

    db.run(`
      CREATE VIRTUAL TABLE nodes_fts USING fts5(
        name,
        content,
        folder,
        tags,
        content=nodes,
        content_rowid=rowid
      )
    `);

    // Create triggers for FTS sync
    db.run(`
      CREATE TRIGGER nodes_ai AFTER INSERT ON nodes BEGIN
        INSERT INTO nodes_fts(rowid, name, content, folder, tags)
        VALUES (NEW.rowid, NEW.name, NEW.content, NEW.folder, NEW.tags);
      END
    `);

    // Generate and insert 10k nodes
    nodes10k = generateBenchmarkData('10k', { includeContent: true, contentLength: 50 });
    insertBenchmarkNodes(db, nodes10k);
  });

  afterAll(() => {
    db?.close();
  });

  describe('FTS5 Search Performance', () => {
    it('searches 10k nodes within threshold', () => {
      const searchTerms = ['project', 'meeting', 'review', 'design'];

      for (const term of searchTerms) {
        const start = performance.now();

        const results = db.exec(`
          SELECT nodes.id, nodes.name, rank
          FROM nodes
          JOIN nodes_fts ON nodes.rowid = nodes_fts.rowid
          WHERE nodes_fts MATCH ?
          ORDER BY rank
          LIMIT 100
        `, [term]);

        const duration = performance.now() - start;

        expect(duration).toBeLessThan(FTS5_THRESHOLD_MS);
        const resultCount = results[0]?.values.length || 0;
        console.log(`FTS5 search "${term}": ${duration.toFixed(2)}ms (threshold: ${FTS5_THRESHOLD_MS}ms), results: ${resultCount}`);
      }
    });

    it('handles phrase search within threshold', () => {
      const start = performance.now();

      const results = db.exec(`
        SELECT nodes.id, nodes.name, rank
        FROM nodes
        JOIN nodes_fts ON nodes.rowid = nodes_fts.rowid
        WHERE nodes_fts MATCH '"project meeting"'
        ORDER BY rank
        LIMIT 100
      `);

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(FTS5_THRESHOLD_MS);
      console.log(`FTS5 phrase search: ${duration.toFixed(2)}ms, results: ${results[0]?.values.length || 0}`);
    });

    it('handles prefix search within threshold', () => {
      const start = performance.now();

      const results = db.exec(`
        SELECT nodes.id, nodes.name, rank
        FROM nodes
        JOIN nodes_fts ON nodes.rowid = nodes_fts.rowid
        WHERE nodes_fts MATCH 'proj*'
        ORDER BY rank
        LIMIT 100
      `);

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(FTS5_THRESHOLD_MS);
      console.log(`FTS5 prefix search: ${duration.toFixed(2)}ms, results: ${results[0]?.values.length || 0}`);
    });

    it('handles AND/OR queries within threshold', () => {
      const start = performance.now();

      const results = db.exec(`
        SELECT nodes.id, nodes.name, rank
        FROM nodes
        JOIN nodes_fts ON nodes.rowid = nodes_fts.rowid
        WHERE nodes_fts MATCH 'project AND meeting OR review'
        ORDER BY rank
        LIMIT 100
      `);

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(FTS5_THRESHOLD_MS);
      console.log(`FTS5 AND/OR query: ${duration.toFixed(2)}ms, results: ${results[0]?.values.length || 0}`);
    });

    it('handles no-match queries quickly', () => {
      const start = performance.now();

      const results = db.exec(`
        SELECT nodes.id, nodes.name, rank
        FROM nodes
        JOIN nodes_fts ON nodes.rowid = nodes_fts.rowid
        WHERE nodes_fts MATCH 'xyznonexistent123'
        ORDER BY rank
        LIMIT 100
      `);

      const duration = performance.now() - start;

      // No-match should be even faster
      expect(duration).toBeLessThan(FTS5_THRESHOLD_MS / 2);
      expect(results[0]?.values.length || 0).toBe(0);
      console.log(`FTS5 no-match query: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Search Result Processing', () => {
    it('processes search results into highlight IDs quickly', () => {
      // Simulate what SuperSearch does
      const start = performance.now();

      const results = db.exec(`
        SELECT nodes.id, nodes.name, rank
        FROM nodes
        JOIN nodes_fts ON nodes.rowid = nodes_fts.rowid
        WHERE nodes_fts MATCH 'project'
        ORDER BY rank
        LIMIT 100
      `);

      // Convert to highlight IDs (what onHighlight receives)
      const highlightIds = results[0]?.values.map(row => row[0] as string) || [];

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(FTS5_THRESHOLD_MS);
      expect(highlightIds.length).toBeGreaterThan(0);
      console.log(`Search + ID extraction: ${duration.toFixed(2)}ms, IDs: ${highlightIds.length}`);
    });
  });

  describe('Concurrent Search', () => {
    it('handles rapid successive searches', async () => {
      const searchTerms = ['project', 'meeting', 'review', 'design', 'testing'];
      const results: number[] = [];

      for (const term of searchTerms) {
        const start = performance.now();

        db.exec(`
          SELECT nodes.id FROM nodes
          JOIN nodes_fts ON nodes.rowid = nodes_fts.rowid
          WHERE nodes_fts MATCH ?
          LIMIT 100
        `, [term]);

        results.push(performance.now() - start);
      }

      // All searches should be fast
      const maxTime = Math.max(...results);
      const avgTime = results.reduce((a, b) => a + b, 0) / results.length;

      expect(maxTime).toBeLessThan(FTS5_THRESHOLD_MS);
      console.log(`Rapid searches - max: ${maxTime.toFixed(2)}ms, avg: ${avgTime.toFixed(2)}ms`);
    });
  });
});
