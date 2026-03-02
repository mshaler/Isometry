// Isometry v5 — Phase 9 MarkdownParser Tests
// Tests for parsing Markdown files with YAML frontmatter (Obsidian format)

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MarkdownParser } from '../../../src/etl/parsers/MarkdownParser';

const fixturesPath = join(__dirname, '../fixtures/obsidian-vault');

function loadFixture(filename: string): string {
  return readFileSync(join(fixturesPath, filename), 'utf-8');
}

describe('MarkdownParser', () => {
  describe('Frontmatter parsing', () => {
    it('Test 1: parses frontmatter with title, tags as array, created/modified dates', () => {
      const parser = new MarkdownParser();
      const content = loadFixture('simple-note.md');

      const result = parser.parse([{ path: 'simple-note.md', content }]);

      expect(result.cards).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const card = result.cards[0];
      expect(card?.name).toBe('My Simple Note');
      expect(card?.tags).toEqual(['todo', 'important']);
      expect(card?.created_at).toBe('2024-01-15T10:00:00Z');
      expect(card?.modified_at).toBe('2024-01-20T15:30:00Z');
    });
  });

  describe('Title extraction cascade', () => {
    it('Test 2: uses frontmatter title when available', () => {
      const parser = new MarkdownParser();
      const content = loadFixture('simple-note.md');

      const result = parser.parse([{ path: 'simple-note.md', content }]);

      expect(result.cards[0]?.name).toBe('My Simple Note');
    });

    it('Test 2b: falls back to first heading when no frontmatter title', () => {
      const parser = new MarkdownParser();
      const content = loadFixture('no-frontmatter.md');

      const result = parser.parse([{ path: 'no-frontmatter.md', content }]);

      expect(result.cards[0]?.name).toBe('Heading Only Note');
    });

    it('Test 2c: uses filename when no frontmatter or heading', () => {
      const parser = new MarkdownParser();
      const content = 'Just some content without title.';

      const result = parser.parse([{ path: 'untitled-note.md', content }]);

      expect(result.cards[0]?.name).toBe('untitled-note');
    });
  });

  describe('Tags extraction', () => {
    it('Test 3: extracts tags from frontmatter array', () => {
      const parser = new MarkdownParser();
      const content = loadFixture('simple-note.md');

      const result = parser.parse([{ path: 'simple-note.md', content }]);

      expect(result.cards[0]?.tags).toEqual(['todo', 'important']);
    });

    it('Test 4: extracts tags from comma-separated string', () => {
      const parser = new MarkdownParser();
      const content = loadFixture('complex-frontmatter.md');

      const result = parser.parse([{ path: 'complex-frontmatter.md', content }]);

      expect(result.cards[0]?.tags).toContain('work');
      expect(result.cards[0]?.tags).toContain('personal');
      expect(result.cards[0]?.tags).toContain('tag with spaces');
    });

    it('Test 5: falls back to hashtag body scan when no frontmatter tags', () => {
      const parser = new MarkdownParser();
      const content = loadFixture('no-frontmatter.md');

      const result = parser.parse([{ path: 'no-frontmatter.md', content }]);

      expect(result.cards[0]?.tags).toContain('some');
      expect(result.cards[0]?.tags).toContain('tags');
    });
  });

  describe('Folder and path handling', () => {
    it('Test 6: extracts folder from file path', () => {
      const parser = new MarkdownParser();
      const content = loadFixture('nested/subfolder-note.md');

      const result = parser.parse([{ path: 'vault/projects/note.md', content }]);

      expect(result.cards[0]?.folder).toBe('vault/projects');
    });

    it('Test 7: uses file path as source_id', () => {
      const parser = new MarkdownParser();
      const content = loadFixture('simple-note.md');

      const result = parser.parse([{ path: 'vault/simple-note.md', content }]);

      expect(result.cards[0]?.source_id).toBe('vault/simple-note.md');
      expect(result.cards[0]?.source).toBe('markdown');
    });
  });

  describe('Timestamp handling', () => {
    it('Test 8: uses file timestamps when frontmatter dates missing', () => {
      const parser = new MarkdownParser();
      const content = 'No frontmatter at all.';
      const defaultTimestamp = '2024-03-01T12:00:00Z';

      const result = parser.parse([{ path: 'note.md', content }], {
        defaultTimestamp,
      });

      expect(result.cards[0]?.created_at).toBe(defaultTimestamp);
      expect(result.cards[0]?.modified_at).toBe(defaultTimestamp);
    });
  });

  describe('Error handling', () => {
    it('Test 9: isolates per-file errors without aborting batch', () => {
      const parser = new MarkdownParser();
      const files = [
        { path: 'good.md', content: '# Valid Note' },
        { path: 'bad.md', content: '---\ntags: [unclosed\n---\n# Malformed YAML' },
        { path: 'good2.md', content: '# Another Valid Note' },
      ];

      const result = parser.parse(files);

      expect(result.cards).toHaveLength(2); // Only good files parsed
      expect(result.errors).toHaveLength(1); // Bad file logged
      expect(result.errors[0]?.source_id).toBe('bad.md');
    });
  });

  describe('Wikilink connections', () => {
    it('Test 10: creates connections for [[Wikilinks]] with label=links_to', () => {
      const parser = new MarkdownParser();
      const content = loadFixture('complex-frontmatter.md');

      const result = parser.parse([{ path: 'note.md', content }]);

      expect(result.connections).toHaveLength(1);
      expect(result.connections[0]?.label).toBe('links_to');
      expect(result.connections[0]?.target_id).toBe('Internal Link');
    });

    it('Test 10b: handles multiple wikilinks', () => {
      const parser = new MarkdownParser();
      const content = 'See [[Note A]] and [[Note B]] for details.';

      const result = parser.parse([{ path: 'note.md', content }]);

      expect(result.connections).toHaveLength(2);
    });
  });

  describe('Edge cases', () => {
    it('handles empty file list', () => {
      const parser = new MarkdownParser();

      const result = parser.parse([]);

      expect(result.cards).toHaveLength(0);
      expect(result.connections).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('handles empty file content', () => {
      const parser = new MarkdownParser();

      const result = parser.parse([{ path: 'empty.md', content: '' }]);

      expect(result.cards).toHaveLength(1);
      expect(result.cards[0]?.name).toBe('empty');
    });
  });
});
