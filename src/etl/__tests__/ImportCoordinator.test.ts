/**
 * Unit tests for ImportCoordinator
 *
 * Tests format detection, importer registration, single file import,
 * and batch import with error collection.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ImportCoordinator } from '../coordinator/ImportCoordinator';
import { BaseImporter, FileSource } from '../importers/BaseImporter';
import { CanonicalNode } from '../types/canonical';
import { v4 as uuidv4 } from 'uuid';

/**
 * Helper function to create valid CanonicalNode for testing.
 */
function createValidNode(name: string): CanonicalNode {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    nodeType: 'note',
    name,
    content: null,
    summary: null,
    latitude: null,
    longitude: null,
    locationName: null,
    locationAddress: null,
    createdAt: now,
    modifiedAt: now,
    dueAt: null,
    completedAt: null,
    eventStart: null,
    eventEnd: null,
    folder: null,
    tags: [],
    status: null,
    priority: 0,
    importance: 0,
    sortOrder: 0,
    gridX: 0,
    gridY: 0,
    source: 'test',
    sourceId: null,
    sourceUrl: null,
    deletedAt: null,
    version: 1,
    properties: {},
  };
}

/**
 * Mock importer for testing.
 * Returns pre-defined nodes, optionally throws errors.
 */
class MockImporter extends BaseImporter {
  constructor(
    private returnNodes: CanonicalNode[],
    private shouldFailParse = false
  ) {
    super();
  }

  protected async parse(_source: FileSource): Promise<unknown> {
    if (this.shouldFailParse) {
      throw new Error('Parse failed');
    }
    return { data: 'mock parsed data' };
  }

  protected async transform(_data: unknown): Promise<CanonicalNode[]> {
    return this.returnNodes;
  }
}

describe('ImportCoordinator', () => {
  let coordinator: ImportCoordinator;

  beforeEach(() => {
    coordinator = new ImportCoordinator();
  });

  describe('Format detection', () => {
    it('should detect .md extension', () => {
      const format = coordinator.detectFormat('README.md');
      expect(format).toBe('.md');
    });

    it('should normalize extension to lowercase', () => {
      const format = coordinator.detectFormat('README.MD');
      expect(format).toBe('.md');
    });

    it('should detect .markdown extension', () => {
      const format = coordinator.detectFormat('README.markdown');
      expect(format).toBe('.markdown');
    });

    it('should throw for unsupported extension', () => {
      expect(() => coordinator.detectFormat('file.xyz')).toThrow(
        'Unsupported file format: .xyz'
      );
    });

    it('should throw for file with no extension', () => {
      expect(() => coordinator.detectFormat('noextension')).toThrow(
        'File has no extension'
      );
    });
  });

  describe('Importer registration', () => {
    it('should allow importing for registered extension', async () => {
      const nodes = [createValidNode('Test Node')];
      const importer = new MockImporter(nodes);

      coordinator.registerImporter(['.md'], importer);

      const source: FileSource = {
        filename: 'test.md',
        content: 'test content',
      };

      const result = await coordinator.importFile(source);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Node');
    });

    it('should handle multiple extensions for one importer', () => {
      const nodes = [createValidNode('Test')];
      const importer = new MockImporter(nodes);

      coordinator.registerImporter(['.md', '.markdown', '.mdx'], importer);

      const extensions = coordinator.getSupportedExtensions();
      expect(extensions).toContain('.md');
      expect(extensions).toContain('.markdown');
      expect(extensions).toContain('.mdx');
    });

    it('should throw for unregistered extension', () => {
      expect(() => coordinator.getImporter('.md')).toThrow(
        'No importer registered for extension: .md'
      );
    });

    it('should return registered extensions', () => {
      const importer = new MockImporter([]);
      coordinator.registerImporter(['.md', '.json'], importer);

      const extensions = coordinator.getSupportedExtensions();
      expect(extensions).toEqual(expect.arrayContaining(['.md', '.json']));
    });
  });

  describe('Single file import', () => {
    it('should return validated CanonicalNode array', async () => {
      const nodes = [createValidNode('Node 1'), createValidNode('Node 2')];
      const importer = new MockImporter(nodes);

      coordinator.registerImporter(['.md'], importer);

      const source: FileSource = {
        filename: 'test.md',
        content: 'content',
      };

      const result = await coordinator.importFile(source);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Node 1');
      expect(result[1].name).toBe('Node 2');
    });

    it('should validate nodes with CanonicalNodeSchema', async () => {
      // Create an invalid node (missing required field)
      const invalidNode = {
        id: uuidv4(),
        // Missing 'name' field - required by schema
        nodeType: 'note',
      } as unknown as CanonicalNode;

      const importer = new MockImporter([invalidNode]);
      coordinator.registerImporter(['.md'], importer);

      const source: FileSource = {
        filename: 'test.md',
        content: 'content',
      };

      await expect(coordinator.importFile(source)).rejects.toThrow(
        /Node 0 from test.md failed validation/
      );
    });

    it('should throw if node fails validation', async () => {
      const invalidNode = {
        id: 'not-a-uuid', // Invalid UUID format
        name: 'Test',
      } as unknown as CanonicalNode;

      const importer = new MockImporter([invalidNode]);
      coordinator.registerImporter(['.md'], importer);

      const source: FileSource = {
        filename: 'invalid.md',
        content: 'content',
      };

      await expect(coordinator.importFile(source)).rejects.toThrow(
        /Node 0 from invalid.md failed validation/
      );
    });

    it('should route to correct importer by extension', async () => {
      const mdNodes = [createValidNode('Markdown Node')];
      const jsonNodes = [createValidNode('JSON Node')];

      const mdImporter = new MockImporter(mdNodes);
      const jsonImporter = new MockImporter(jsonNodes);

      coordinator.registerImporter(['.md'], mdImporter);
      coordinator.registerImporter(['.json'], jsonImporter);

      const mdSource: FileSource = {
        filename: 'doc.md',
        content: 'markdown content',
      };

      const jsonSource: FileSource = {
        filename: 'data.json',
        content: '{"test": "data"}',
      };

      const mdResult = await coordinator.importFile(mdSource);
      expect(mdResult[0].name).toBe('Markdown Node');

      const jsonResult = await coordinator.importFile(jsonSource);
      expect(jsonResult[0].name).toBe('JSON Node');
    });
  });

  describe('Batch import', () => {
    it('should process multiple files', async () => {
      const nodes1 = [createValidNode('File 1')];
      const nodes2 = [createValidNode('File 2')];

      const importer = new MockImporter([...nodes1, ...nodes2]);
      coordinator.registerImporter(['.md'], importer);

      const sources: FileSource[] = [
        { filename: 'file1.md', content: 'content 1' },
        { filename: 'file2.md', content: 'content 2' },
      ];

      const result = await coordinator.importFiles(sources);
      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect errors without failing entire batch', async () => {
      const goodNodes = [createValidNode('Good File')];
      const goodImporter = new MockImporter(goodNodes);
      const badImporter = new MockImporter([], true); // Will fail on parse

      coordinator.registerImporter(['.md'], goodImporter);
      coordinator.registerImporter(['.json'], badImporter);

      const sources: FileSource[] = [
        { filename: 'good.md', content: 'good content' },
        { filename: 'bad.json', content: 'bad content' },
      ];

      const result = await coordinator.importFiles(sources);
      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].file).toBe('bad.json');
      expect(result.errors[0].error).toContain('Parse failed');
    });

    it('should return correct imported/skipped counts', async () => {
      const nodes = [createValidNode('Node')];
      const goodImporter = new MockImporter(nodes);
      const badImporter = new MockImporter([], true);

      coordinator.registerImporter(['.md'], goodImporter);
      coordinator.registerImporter(['.json'], badImporter);

      const sources: FileSource[] = [
        { filename: 'file1.md', content: 'content' },
        { filename: 'file2.md', content: 'content' },
        { filename: 'bad.json', content: 'content' },
      ];

      const result = await coordinator.importFiles(sources);
      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(1);
    });

    it('should include duration in result', async () => {
      const nodes = [createValidNode('Node')];
      const importer = new MockImporter(nodes);

      coordinator.registerImporter(['.md'], importer);

      const sources: FileSource[] = [
        { filename: 'file.md', content: 'content' },
      ];

      const result = await coordinator.importFiles(sources);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe('number');
    });

    it('should return all nodes in nodes array', async () => {
      const nodes1 = [createValidNode('Node 1')];
      const nodes2 = [createValidNode('Node 2'), createValidNode('Node 3')];

      // Mock importer that returns different nodes based on filename
      class SelectiveMockImporter extends BaseImporter {
        protected async parse(source: FileSource): Promise<unknown> {
          return { filename: source.filename };
        }

        protected async transform(data: unknown): Promise<CanonicalNode[]> {
          const { filename } = data as { filename: string };
          if (filename.includes('file1')) return nodes1;
          if (filename.includes('file2')) return nodes2;
          return [];
        }
      }

      const importer = new SelectiveMockImporter();
      coordinator.registerImporter(['.md'], importer);

      const sources: FileSource[] = [
        { filename: 'file1.md', content: 'content' },
        { filename: 'file2.md', content: 'content' },
      ];

      const result = await coordinator.importFiles(sources);
      expect(result.nodes).toHaveLength(3);
      expect(result.nodes[0].name).toBe('Node 1');
      expect(result.nodes[1].name).toBe('Node 2');
      expect(result.nodes[2].name).toBe('Node 3');
    });
  });
});
