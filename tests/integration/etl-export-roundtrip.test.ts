// Isometry v5 — Phase 9 ETL Export Round-Trip Integration Tests
// Verify export/import round-trip maintains data integrity

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../src/database/Database';
import { ImportOrchestrator } from '../../src/etl/ImportOrchestrator';
import { ExportOrchestrator } from '../../src/etl/ExportOrchestrator';
import { MarkdownParser } from '../../src/etl/parsers/MarkdownParser';
import { JSONParser } from '../../src/etl/parsers/JSONParser';
import { CSVParser } from '../../src/etl/parsers/CSVParser';
import type { ParsedFile } from '../../src/etl/parsers/MarkdownParser';

describe('ETL Export Round-Trip', () => {
  let db: Database;
  let importOrchestrator: ImportOrchestrator;
  let exportOrchestrator: ExportOrchestrator;

  beforeEach(async () => {
    db = new Database();
    await db.initialize();
    importOrchestrator = new ImportOrchestrator(db);
    exportOrchestrator = new ExportOrchestrator(db);

    // Seed with test data
    db.run(`
      INSERT INTO cards (id, card_type, name, content, tags, source, source_id, created_at, modified_at)
      VALUES
        ('card-1', 'note', 'Note One', 'Content one', '["tag1","tag2"]', 'test', '1', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
        ('card-2', 'note', 'Note Two', 'Content two', '["tag3"]', 'test', '2', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z')
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('markdown export round-trips through parser', async () => {
    const result = exportOrchestrator.export('markdown', {});

    expect(result.data).toBeTruthy();
    expect(result.filename).toContain('.md');
    expect(result.format).toBe('markdown');
    expect(result.cardCount).toBe(2);

    // Parse exported markdown back
    const parser = new MarkdownParser();

    // Split markdown by frontmatter sections
    const sections = result.data.split(/\n---\n\n/).filter(s => s.trim());
    const files: ParsedFile[] = sections.map((section, i) => ({
      path: `note-${i}.md`,
      content: section.startsWith('---\n') ? section : `---\n${section}`,
    }));

    const parseResult = parser.parse(files);

    expect(parseResult.cards.length).toBeGreaterThanOrEqual(2);
    const names = parseResult.cards.map(c => c.name).sort();
    expect(names).toContain('Note One');
    expect(names).toContain('Note Two');
  });

  it('JSON export round-trips through parser', async () => {
    const result = exportOrchestrator.export('json', {});

    expect(result.data).toBeTruthy();
    expect(result.filename).toContain('.json');
    expect(result.format).toBe('json');
    expect(result.cardCount).toBe(2);

    // Parse exported JSON back
    const parser = new JSONParser();
    const parseResult = parser.parse(result.data);

    expect(parseResult.cards.length).toBe(2);
    const names = parseResult.cards.map(c => c.name).sort();
    expect(names).toEqual(['Note One', 'Note Two']);
  });

  it('CSV export round-trips through parser', async () => {
    const result = exportOrchestrator.export('csv', {});

    expect(result.data).toBeTruthy();
    expect(result.filename).toContain('.csv');
    expect(result.format).toBe('csv');
    expect(result.cardCount).toBe(2);

    // Parse exported CSV back
    const parser = new CSVParser();
    const files: ParsedFile[] = [{ path: 'export.csv', content: result.data }];
    const parseResult = parser.parse(files);

    expect(parseResult.cards.length).toBe(2);
    const names = parseResult.cards.map(c => c.name).sort();
    expect(names).toEqual(['Note One', 'Note Two']);
  });

  it('export with cardIds filter exports only specified cards', async () => {
    const result = exportOrchestrator.export('json', { cardIds: ['card-1'] });

    const data = JSON.parse(result.data);
    expect(data.cards.length).toBe(1);
    expect(data.cards[0].name).toBe('Note One');
  });

  it('export excludes deleted cards', async () => {
    db.run("UPDATE cards SET deleted_at = '2024-01-15T00:00:00Z' WHERE id = 'card-1'");

    const result = exportOrchestrator.export('json', {});

    const data = JSON.parse(result.data);
    expect(data.cards.length).toBe(1);
    expect(data.cards[0].name).toBe('Note Two');
  });
});
