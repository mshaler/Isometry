/**
 * JsonImporter Tests
 *
 * TDD tests for JSON file import functionality.
 * Covers single objects, arrays, edge cases, and LATCH mapping.
 *
 * @module etl/__tests__/JsonImporter.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JsonImporter } from '../importers/JsonImporter';
import { CanonicalNodeSchema } from '../types/canonical';
import { FileSource } from '../importers/BaseImporter';

describe('JsonImporter', () => {
  let importer: JsonImporter;

  beforeEach(() => {
    importer = new JsonImporter();
  });

  describe('single object', () => {
    it('should import single object as one node', async () => {
      const source: FileSource = {
        filename: 'single.json',
        content: JSON.stringify({
          name: 'Test Task',
          created: '2024-01-15T10:00:00Z',
          tags: ['work', 'urgent'],
          priority: 'high',
        }),
      };

      const nodes = await importer.import(source);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('Test Task');
      expect(nodes[0].createdAt).toBe('2024-01-15T10:00:00Z');
      expect(nodes[0].tags).toEqual(['work', 'urgent']);
      expect(nodes[0].priority).toBe(5); // 'high' maps to 5
    });

    it('should preserve original JSON in content field', async () => {
      const original = { name: 'Content Test', custom: 'value' };
      const source: FileSource = {
        filename: 'content.json',
        content: JSON.stringify(original),
      };

      const nodes = await importer.import(source);

      expect(nodes[0].content).toBe(JSON.stringify(original, null, 2));
    });
  });

  describe('array of objects', () => {
    it('should import array as multiple nodes', async () => {
      const source: FileSource = {
        filename: 'tasks.json',
        content: JSON.stringify([
          { title: 'Task 1', status: 'todo' },
          { title: 'Task 2', status: 'done' },
          { title: 'Task 3', status: 'in-progress' },
        ]),
      };

      const nodes = await importer.import(source);

      expect(nodes).toHaveLength(3);
      expect(nodes[0].name).toBe('Task 1');
      expect(nodes[1].name).toBe('Task 2');
      expect(nodes[2].name).toBe('Task 3');
    });

    it('should generate unique sourceIds per array item', async () => {
      const source: FileSource = {
        filename: 'array.json',
        content: JSON.stringify([
          { name: 'Item 1' },
          { name: 'Item 2' },
        ]),
      };

      const nodes = await importer.import(source);

      expect(nodes[0].sourceId).not.toBe(nodes[1].sourceId);
      // Verify sourceIds are deterministic (contain source prefix)
      expect(nodes[0].sourceId).toContain('json-importer-');
      expect(nodes[1].sourceId).toContain('json-importer-');
    });

    it('should preserve status from array items', async () => {
      const source: FileSource = {
        filename: 'statuses.json',
        content: JSON.stringify([
          { name: 'Todo', status: 'todo' },
          { name: 'Done', status: 'done' },
        ]),
      };

      const nodes = await importer.import(source);

      expect(nodes[0].status).toBe('todo');
      expect(nodes[1].status).toBe('done');
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty JSON array', async () => {
      const source: FileSource = {
        filename: 'empty.json',
        content: '[]',
      };

      const nodes = await importer.import(source);

      expect(nodes).toHaveLength(0);
    });

    it('should throw on invalid JSON', async () => {
      const source: FileSource = {
        filename: 'invalid.json',
        content: '{ not valid json }',
      };

      await expect(importer.import(source)).rejects.toThrow(/invalid json/i);
    });

    it('should handle nested objects gracefully', async () => {
      const source: FileSource = {
        filename: 'nested.json',
        content: JSON.stringify({
          name: 'Nested Test',
          metadata: {
            author: 'Test Author',
            settings: { theme: 'dark' },
          },
        }),
      };

      const nodes = await importer.import(source);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('Nested Test');
      // Nested structure preserved in content
      expect(nodes[0].content).toContain('metadata');
      expect(nodes[0].content).toContain('author');
    });

    it('should handle primitive JSON values', async () => {
      const source: FileSource = {
        filename: 'primitive.json',
        content: '"just a string"',
      };

      const nodes = await importer.import(source);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('just a string');
    });
  });

  describe('LATCH mapping', () => {
    it('should detect name from various keys', async () => {
      const cases = [
        { name: 'From name' },
        { title: 'From title' },
        { subject: 'From subject' },
        { label: 'From label' },
      ];

      for (const obj of cases) {
        const nodes = await importer.import({
          filename: 'test.json',
          content: JSON.stringify(obj),
        });
        expect(nodes[0].name).toBe(Object.values(obj)[0]);
      }
    });

    it('should fallback to Item N when no name found', async () => {
      const source: FileSource = {
        filename: 'noname.json',
        content: JSON.stringify([
          { status: 'todo' },
          { status: 'done' },
        ]),
      };

      const nodes = await importer.import(source);

      expect(nodes[0].name).toBe('Item 1');
      expect(nodes[1].name).toBe('Item 2');
    });

    it('should detect dates from various keys', async () => {
      const source: FileSource = {
        filename: 'dates.json',
        content: JSON.stringify({
          name: 'Date Test',
          created: '2024-01-15T10:00:00Z',
          modified: '2024-01-16T10:00:00Z',
          deadline: '2024-02-01T00:00:00Z',
        }),
      };

      const nodes = await importer.import(source);

      expect(nodes[0].createdAt).toBe('2024-01-15T10:00:00Z');
      expect(nodes[0].modifiedAt).toBe('2024-01-16T10:00:00Z');
      expect(nodes[0].dueAt).toBe('2024-02-01T00:00:00Z');
    });

    it('should detect tags from array and comma-string', async () => {
      const arraySource: FileSource = {
        filename: 'tags-array.json',
        content: JSON.stringify({ name: 'Array Tags', tags: ['a', 'b', 'c'] }),
      };
      const stringSource: FileSource = {
        filename: 'tags-string.json',
        content: JSON.stringify({ name: 'String Tags', tags: 'a, b, c' }),
      };

      const arrayNodes = await importer.import(arraySource);
      const stringNodes = await importer.import(stringSource);

      expect(arrayNodes[0].tags).toEqual(['a', 'b', 'c']);
      expect(stringNodes[0].tags).toEqual(['a', 'b', 'c']);
    });

    it('should detect folder from various keys', async () => {
      const cases = [
        { name: 'Test', folder: 'work' },
        { name: 'Test', category: 'personal' },
        { name: 'Test', group: 'archive' },
      ];

      for (const obj of cases) {
        const nodes = await importer.import({
          filename: 'folder.json',
          content: JSON.stringify(obj),
        });
        const expected = obj.folder || obj.category || obj.group;
        expect(nodes[0].folder).toBe(expected);
      }
    });

    it('should map priority strings to numbers', async () => {
      const cases: Array<{ priority: string | number; expected: number }> = [
        { priority: 'high', expected: 5 },
        { priority: 'urgent', expected: 5 },
        { priority: 'critical', expected: 5 },
        { priority: 'medium', expected: 3 },
        { priority: 'normal', expected: 3 },
        { priority: 'low', expected: 1 },
        { priority: 3, expected: 3 },
        { priority: '4', expected: 4 },
      ];

      for (const { priority, expected } of cases) {
        const nodes = await importer.import({
          filename: 'priority.json',
          content: JSON.stringify({ name: 'Test', priority }),
        });
        expect(nodes[0].priority).toBe(expected);
      }
    });

    it('should detect location fields', async () => {
      const source: FileSource = {
        filename: 'location.json',
        content: JSON.stringify({
          name: 'Location Test',
          lat: 40.7128,
          lng: -74.006,
          place: 'New York City',
          address: '123 Main St',
        }),
      };

      const nodes = await importer.import(source);

      expect(nodes[0].latitude).toBe(40.7128);
      expect(nodes[0].longitude).toBe(-74.006);
      expect(nodes[0].locationName).toBe('New York City');
      expect(nodes[0].locationAddress).toBe('123 Main St');
    });
  });

  describe('validation', () => {
    it('should produce valid CanonicalNode', async () => {
      const source: FileSource = {
        filename: 'validate.json',
        content: JSON.stringify({ name: 'Validation Test' }),
      };

      const nodes = await importer.import(source);

      expect(() => CanonicalNodeSchema.parse(nodes[0])).not.toThrow();
    });

    it('should produce valid nodes for array import', async () => {
      const source: FileSource = {
        filename: 'validate-array.json',
        content: JSON.stringify([
          { name: 'Node 1' },
          { name: 'Node 2' },
          { title: 'Node 3', tags: ['important'] },
        ]),
      };

      const nodes = await importer.import(source);

      nodes.forEach((node) => {
        expect(() => CanonicalNodeSchema.parse(node)).not.toThrow();
      });
    });

    it('should include source and sourceId', async () => {
      const source: FileSource = {
        filename: 'provenance.json',
        content: JSON.stringify({ name: 'Provenance Test' }),
      };

      const nodes = await importer.import(source);

      expect(nodes[0].source).toBe('json-importer');
      expect(nodes[0].sourceId).toBeTruthy();
      expect(nodes[0].sourceId).toContain('json-importer-');
    });
  });

  describe('ImportCoordinator integration', () => {
    it('should work with ImportCoordinator', async () => {
      const { ImportCoordinator } = await import('../coordinator/ImportCoordinator');
      const coordinator = new ImportCoordinator();
      coordinator.registerImporter(['.json'], new JsonImporter());

      const source: FileSource = {
        filename: 'integration.json',
        content: JSON.stringify([
          { name: 'Task 1' },
          { name: 'Task 2' },
        ]),
      };

      const nodes = await coordinator.importFile(source);

      expect(nodes).toHaveLength(2);
      // All nodes validated by CanonicalNodeSchema in coordinator
      nodes.forEach((node) => {
        expect(() => CanonicalNodeSchema.parse(node)).not.toThrow();
      });
    });
  });
});
