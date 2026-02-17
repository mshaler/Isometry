/**
 * Diagnostic test to find the phantom Stacey card in BairesDev/Operations
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { Database } from 'sql.js-fts5';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { TestDatabaseManager } from './db-utils';
import { parseAltoFile, mapToNodeRecord } from '../etl/alto-importer';

describe('Diagnostic: Stacey + BairesDev query', () => {
  let db: Database;

  beforeAll(async () => {
    // Use the test database manager
    const manager = await TestDatabaseManager.getInstance();
    db = await manager.createTestDatabase({ loadSampleData: false });

    // Import all Apple Notes from docs/notes/apple-notes
    const notesDir = join(process.cwd(), 'docs/notes/apple-notes');
    if (existsSync(notesDir)) {
      importNotesRecursively(db, notesDir);
    }
  });

  it('finds cards with folder containing BairesDev and tags containing Stacey', () => {
    const results = db.exec(`
      SELECT id, name, folder, tags
      FROM nodes
      WHERE folder LIKE '%BairesDev%'
        AND tags LIKE '%Stacey%'
    `);

    console.log('\n=== Cards with BairesDev folder AND Stacey tag ===');
    if (results.length > 0 && results[0].values.length > 0) {
      results[0].values.forEach(row => {
        console.log({
          id: row[0],
          name: row[1],
          folder: row[2],
          tags: row[3]
        });
      });
    } else {
      console.log('No cards found with both BairesDev folder and Stacey tag');
    }

    // This test just reports - doesn't assert
    expect(true).toBe(true);
  });

  it('finds all cards with Stacey tag (any folder)', () => {
    const results = db.exec(`
      SELECT id, name, folder, tags
      FROM nodes
      WHERE tags LIKE '%Stacey%'
      ORDER BY folder
    `);

    console.log('\n=== All cards with Stacey tag ===');
    if (results.length > 0 && results[0].values.length > 0) {
      results[0].values.forEach(row => {
        console.log({
          id: row[0],
          name: String(row[1]).substring(0, 50),
          folder: row[2],
          tags: row[3]
        });
      });
      console.log(`Total: ${results[0].values.length} cards`);
    } else {
      console.log('No cards found with Stacey tag');
    }

    expect(true).toBe(true);
  });

  it('finds all cards in BairesDev/Operations folder', () => {
    const results = db.exec(`
      SELECT id, name, folder, tags
      FROM nodes
      WHERE folder LIKE '%BairesDev%Operations%'
      ORDER BY name
    `);

    console.log('\n=== All cards in BairesDev/Operations ===');
    if (results.length > 0 && results[0].values.length > 0) {
      results[0].values.forEach(row => {
        console.log({
          id: row[0],
          name: String(row[1]).substring(0, 50),
          folder: row[2],
          tags: row[3]
        });
      });
      console.log(`Total: ${results[0].values.length} cards`);
    } else {
      console.log('No cards found in BairesDev/Operations');
    }

    expect(true).toBe(true);
  });

  it('shows header discovery SQL result for folder×tags', () => {
    const results = db.exec(`
      SELECT
        folder,
        json_each.value as tag,
        COUNT(*) as card_count
      FROM nodes, json_each(nodes.tags)
      WHERE nodes.deleted_at IS NULL
        AND nodes.tags IS NOT NULL
        AND nodes.tags != '[]'
        AND folder LIKE '%BairesDev%'
      GROUP BY folder, json_each.value
      ORDER BY folder, tag
    `);

    console.log('\n=== Header discovery: BairesDev folders × tags ===');
    if (results.length > 0 && results[0].values.length > 0) {
      results[0].values.forEach(row => {
        console.log(`${row[0]} | ${row[1]} | count: ${row[2]}`);
      });
    } else {
      console.log('No BairesDev folder×tag combinations found');
    }

    expect(true).toBe(true);
  });
});

/**
 * Recursively import markdown files from a directory
 */
function importNotesRecursively(db: Database, dir: string) {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      importNotesRecursively(db, fullPath);
    } else if (entry.name.endsWith('.md')) {
      try {
        const content = readFileSync(fullPath, 'utf-8');
        const parsed = parseAltoFile(content, fullPath);

        if (parsed) {
          const node = mapToNodeRecord(parsed, fullPath, parsed.frontmatter as Record<string, unknown>);

          db.run(`
            INSERT OR REPLACE INTO nodes (
              id, node_type, name, content, folder, tags,
              created_at, modified_at, source, source_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            node.id,
            node.node_type,
            node.name,
            node.content,
            node.folder,
            node.tags,
            node.created_at,
            node.modified_at,
            node.source,
            node.source_id
          ]);
        }
      } catch (e) {
        // Skip files that fail to parse
      }
    }
  }
}
