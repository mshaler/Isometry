/**
 * Unit tests for CsvImporter
 *
 * Tests CSV/TSV parsing, LATCH column mapping, edge cases,
 * deterministic ID generation, and schema validation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CsvImporter } from '../importers/CsvImporter';
import { CanonicalNodeSchema } from '../types/canonical';
import { FileSource } from '../importers/BaseImporter';

describe('CsvImporter', () => {
  let importer: CsvImporter;

  beforeEach(() => {
    importer = new CsvImporter();
  });

  describe('basic parsing', () => {
    it('should import CSV with header row', async () => {
      const csv = `name,status,priority
Task 1,todo,high
Task 2,done,low
Task 3,in-progress,medium`;

      const nodes = await importer.import({
        filename: 'tasks.csv',
        content: csv,
      });

      expect(nodes).toHaveLength(3);
      expect(nodes[0].name).toBe('Task 1');
      expect(nodes[0].status).toBe('todo');
      expect(nodes[0].priority).toBe(5); // 'high' -> 5
      expect(nodes[1].name).toBe('Task 2');
      expect(nodes[2].name).toBe('Task 3');
    });

    it('should handle TSV (tab-separated)', async () => {
      const tsv = `title\tfolder\ttags
Note 1\tWork\turgent,important
Note 2\tPersonal\tlow-priority`;

      const nodes = await importer.import({
        filename: 'notes.tsv',
        content: tsv,
      });

      expect(nodes).toHaveLength(2);
      expect(nodes[0].name).toBe('Note 1');
      expect(nodes[0].folder).toBe('Work');
      expect(nodes[0].tags).toEqual(['urgent', 'important']);
    });
  });

  describe('edge cases', () => {
    it('should handle quoted fields with commas', async () => {
      const csv = `name,description
"Task, with comma","Description with ""quotes"" inside"`;

      const nodes = await importer.import({
        filename: 'quoted.csv',
        content: csv,
      });

      expect(nodes[0].name).toBe('Task, with comma');
      // Content is JSON stringified, so quotes are escaped
      const parsedContent = JSON.parse(nodes[0].content!);
      expect(parsedContent.description).toBe('Description with "quotes" inside');
    });

    it('should skip empty rows', async () => {
      const csv = `name
Row 1

Row 2

`;

      const nodes = await importer.import({
        filename: 'sparse.csv',
        content: csv,
      });

      expect(nodes).toHaveLength(2);
    });

    it('should return empty array for empty CSV', async () => {
      const nodes = await importer.import({
        filename: 'empty.csv',
        content: '',
      });

      expect(nodes).toHaveLength(0);
    });

    it('should return empty array for header-only CSV', async () => {
      const csv = `name,status,priority`;

      const nodes = await importer.import({
        filename: 'header-only.csv',
        content: csv,
      });

      expect(nodes).toHaveLength(0);
    });
  });

  describe('LATCH column mapping', () => {
    it('should detect name from various column headers', async () => {
      const testCases = [
        { header: 'name', expected: 'Test Value' },
        { header: 'title', expected: 'Test Value' },
        { header: 'task', expected: 'Test Value' },
        { header: 'subject', expected: 'Test Value' },
      ];

      for (const { header, expected } of testCases) {
        const csv = `${header}\n${expected}`;
        const nodes = await importer.import({
          filename: 'test.csv',
          content: csv,
        });
        expect(nodes[0].name).toBe(expected);
      }
    });

    it('should detect date columns', async () => {
      const csv = `name,created,due_date,modified
Task 1,2024-01-15T10:00:00Z,2024-02-01T00:00:00Z,2024-01-20T12:00:00Z`;

      const nodes = await importer.import({
        filename: 'dates.csv',
        content: csv,
      });

      expect(nodes[0].createdAt).toBe('2024-01-15T10:00:00.000Z');
      expect(nodes[0].dueAt).toBe('2024-02-01T00:00:00.000Z');
      expect(nodes[0].modifiedAt).toBe('2024-01-20T12:00:00.000Z');
    });

    it('should detect category columns', async () => {
      const csv = `name,folder,category,tags
Task 1,Work,,urgent;important`;

      const nodes = await importer.import({
        filename: 'categories.csv',
        content: csv,
      });

      expect(nodes[0].folder).toBe('Work');
      expect(nodes[0].tags).toEqual(['urgent', 'important']);
    });
  });

  describe('deterministic IDs', () => {
    it('should generate unique sourceId per row', async () => {
      const csv = `name
Row 1
Row 2`;

      const nodes = await importer.import({
        filename: 'rows.csv',
        content: csv,
      });

      expect(nodes[0].sourceId).not.toBe(nodes[1].sourceId);
      expect(nodes[0].sourceId).toMatch(/^csv-importer-/);
    });

    it('should generate consistent sourceId on reimport', async () => {
      const csv = `name\nTest Row`;
      const source: FileSource = { filename: 'consistent.csv', content: csv };

      const nodes1 = await importer.import(source);
      const nodes2 = await importer.import(source);

      expect(nodes1[0].sourceId).toBe(nodes2[0].sourceId);
    });
  });

  describe('validation', () => {
    it('should produce valid CanonicalNode', async () => {
      const csv = `name,created
Valid Task,2024-01-15T10:00:00Z`;

      const nodes = await importer.import({
        filename: 'valid.csv',
        content: csv,
      });

      expect(() => CanonicalNodeSchema.parse(nodes[0])).not.toThrow();
    });
  });

  describe('CsvImporter integration', () => {
    it('should work with ImportCoordinator', async () => {
      const { ImportCoordinator } = await import('../coordinator/ImportCoordinator');
      const coordinator = new ImportCoordinator();
      coordinator.registerImporter(['.csv', '.tsv'], new CsvImporter());

      const csv = `name,status
Task 1,todo
Task 2,done`;

      const nodes = await coordinator.importFile({
        filename: 'integration.csv',
        content: csv,
      });

      expect(nodes).toHaveLength(2);
      nodes.forEach(node => {
        expect(() => CanonicalNodeSchema.parse(node)).not.toThrow();
      });
    });
  });
});
