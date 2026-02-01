import {
  importJSONFile,
  previewJSONFile,
  analyzeJSONStructure,
  type JSONImportOptions,
  type FieldMapping,
  type JSONSchema
} from '../utils/jsonProcessor';

// Mock File class for testing
class MockFile extends File {
  constructor(content: string, filename: string) {
    super([content], filename, { type: 'application/json' });
  }
}

// Helper to create a mock file with JSON content
function createJSONFile(content: any, filename = 'test.json'): File {
  return new MockFile(JSON.stringify(content), filename);
}

describe('JSON Processor', () => {
  describe('analyzeJSONStructure', () => {
    test('analyzes simple object structure', () => {
      const data = {
        name: 'Test Item',
        content: 'Test content',
        createdAt: '2024-01-01T00:00:00Z',
        priority: 1,
        tags: ['test', 'sample']
      };

      const schema = analyzeJSONStructure(data, 'test.json');

      expect(schema.type).toBe('object');
      expect(schema.estimatedNodeCount).toBe(1);
      expect(schema.properties).toHaveProperty('name');
      expect(schema.properties).toHaveProperty('content');
      expect(schema.properties).toHaveProperty('createdAt');
      expect(schema.properties).toHaveProperty('priority');
      expect(schema.properties).toHaveProperty('tags');

      // Check LATCH inference
      expect(schema.properties.name.inferredLATCH).toBe('name');
      expect(schema.properties.content.inferredLATCH).toBe('content');
      expect(schema.properties.createdAt.inferredLATCH).toBe('createdAt');
      expect(schema.properties.priority.inferredLATCH).toBe('priority');
      expect(schema.properties.tags.inferredLATCH).toBe('tags');
    });

    test('analyzes array of objects structure', () => {
      const data = [
        {
          id: 1,
          title: 'First Item',
          description: 'First description',
          latitude: 37.7749,
          longitude: -122.4194
        },
        {
          id: 2,
          title: 'Second Item',
          description: 'Second description',
          latitude: 40.7128,
          longitude: -74.0060
        }
      ];

      const schema = analyzeJSONStructure(data, 'items.json');

      expect(schema.type).toBe('array');
      expect(schema.arrayItemType).toBe('object');
      expect(schema.estimatedNodeCount).toBe(2);
      expect(schema.properties).toHaveProperty('id');
      expect(schema.properties).toHaveProperty('title');
      expect(schema.properties).toHaveProperty('description');
      expect(schema.properties).toHaveProperty('latitude');
      expect(schema.properties).toHaveProperty('longitude');

      // Check LATCH inference
      expect(schema.properties.title.inferredLATCH).toBe('name');
      expect(schema.properties.description.inferredLATCH).toBe('summary');
      expect(schema.properties.latitude.inferredLATCH).toBe('latitude');
      expect(schema.properties.longitude.inferredLATCH).toBe('longitude');
    });

    test('analyzes nested object structure', () => {
      const data = {
        user: {
          name: 'John Doe',
          email: 'john@example.com',
          profile: {
            bio: 'Software developer',
            location: 'San Francisco'
          }
        },
        posts: [
          { title: 'Post 1', content: 'Content 1' },
          { title: 'Post 2', content: 'Content 2' }
        ]
      };

      const schema = analyzeJSONStructure(data, 'user.json');

      expect(schema.rootStructure.hasNestedObjects).toBe(true);
      expect(schema.rootStructure.hasArrays).toBe(true);
      expect(schema.rootStructure.maxDepth).toBeGreaterThan(1);
    });

    test('analyzes primitive array', () => {
      const data = ['apple', 'banana', 'cherry', 'date'];

      const schema = analyzeJSONStructure(data, 'fruits.json');

      expect(schema.type).toBe('array');
      expect(schema.arrayItemType).toBe('primitive');
      expect(schema.estimatedNodeCount).toBe(4);
    });

    test('analyzes empty array', () => {
      const data: any[] = [];

      const schema = analyzeJSONStructure(data, 'empty.json');

      expect(schema.type).toBe('array');
      expect(schema.estimatedNodeCount).toBe(0);
      expect(schema.rootStructure.sampleSize).toBe(0);
    });
  });

  describe('previewJSONFile', () => {
    test('generates preview for object file', async () => {
      const data = {
        name: 'Sample Note',
        content: 'This is sample content',
        createdAt: '2024-01-01T10:00:00Z',
        tags: ['sample', 'test'],
        priority: 2
      };

      const file = createJSONFile(data, 'sample.json');
      const preview = await previewJSONFile(file);

      expect(preview.estimatedNodeCount).toBe(1);
      expect(preview.sampleData).toHaveLength(1);
      expect(preview.sampleData[0]).toEqual(data);
      expect(preview.inferredMappings.length).toBeGreaterThan(0);

      // Check that key fields are mapped
      const mappingTargets = preview.inferredMappings.map(m => m.targetProperty);
      expect(mappingTargets).toContain('name');
      expect(mappingTargets).toContain('content');
      expect(mappingTargets).toContain('createdAt');
      expect(mappingTargets).toContain('tags');
      expect(mappingTargets).toContain('priority');
    });

    test('generates preview for array file', async () => {
      const data = [
        { name: 'Item 1', description: 'First item' },
        { name: 'Item 2', description: 'Second item' },
        { name: 'Item 3', description: 'Third item' }
      ];

      const file = createJSONFile(data, 'items.json');
      const preview = await previewJSONFile(file);

      expect(preview.estimatedNodeCount).toBe(3);
      expect(preview.sampleData).toHaveLength(3);
      expect(preview.inferredMappings.length).toBeGreaterThan(0);
    });

    test('generates warnings for large dataset', async () => {
      const data = Array.from({ length: 1500 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random()
      }));

      const file = createJSONFile(data, 'large.json');
      const preview = await previewJSONFile(file);

      expect(preview.warnings).toContain(
        expect.stringContaining('Large dataset: 1500 items will be imported')
      );
    });

    test('generates warnings for complex nested structure', async () => {
      const data = {
        level1: {
          level2: {
            level3: {
              data: 'nested value'
            }
          }
        }
      };

      const file = createJSONFile(data, 'nested.json');
      const preview = await previewJSONFile(file);

      expect(preview.warnings).toContain(
        expect.stringContaining('Complex nested structure detected')
      );
    });

    test('handles invalid JSON gracefully', async () => {
      const invalidFile = new MockFile('{ invalid json', 'invalid.json');

      await expect(previewJSONFile(invalidFile)).rejects.toThrow(
        expect.stringContaining('Failed to preview JSON')
      );
    });
  });

  describe('importJSONFile', () => {
    test('imports simple object with default options', async () => {
      const data = {
        name: 'Test Note',
        content: 'This is test content',
        folder: 'test-folder',
        priority: 1
      };

      const file = createJSONFile(data, 'note.json');
      const result = await importJSONFile(file);

      expect(result.nodes).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.totalItems).toBe(1);
      expect(result.metadata.processedItems).toBe(1);

      const node = result.nodes[0];
      expect(node.name).toBe('Test Note');
      expect(node.content).toBe('This is test content');
      expect(node.folder).toBe('test-folder');
      expect(node.priority).toBe(1);
      expect(node.tags).toContain('json-import');
      expect(node.source).toBe('json-import');
    });

    test('imports array of objects', async () => {
      const data = [
        {
          title: 'First Item',
          description: 'First description',
          status: 'active'
        },
        {
          title: 'Second Item',
          description: 'Second description',
          status: 'pending'
        }
      ];

      const file = createJSONFile(data, 'items.json');
      const result = await importJSONFile(file);

      expect(result.nodes).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.totalItems).toBe(2);
      expect(result.metadata.processedItems).toBe(2);

      expect(result.nodes[0].name).toBe('First Item');
      expect(result.nodes[1].name).toBe('Second Item');
      expect(result.nodes[0].summary).toBe('First description');
      expect(result.nodes[1].summary).toBe('Second description');
    });

    test('imports with custom field mappings', async () => {
      const data = {
        user_name: 'John Doe',
        bio: 'Software engineer',
        created_date: '2024-01-01T10:00:00Z',
        user_priority: 3
      };

      const fieldMappings: FieldMapping[] = [
        { jsonPath: 'user_name', targetProperty: 'name' },
        { jsonPath: 'bio', targetProperty: 'content' },
        { jsonPath: 'created_date', targetProperty: 'createdAt', transform: { type: 'date' } },
        { jsonPath: 'user_priority', targetProperty: 'priority', transform: { type: 'number' } }
      ];

      const options: JSONImportOptions = {
        fieldMappings,
        nodeType: 'person',
        folder: 'users'
      };

      const file = createJSONFile(data, 'user.json');
      const result = await importJSONFile(file, options);

      expect(result.nodes).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const node = result.nodes[0];
      expect(node.name).toBe('John Doe');
      expect(node.content).toBe('Software engineer');
      expect(node.nodeType).toBe('person');
      expect(node.folder).toBe('users');
      expect(node.priority).toBe(3);
      expect(node.createdAt).toBeInstanceOf(Date);
    });

    test('imports primitive array', async () => {
      const data = ['apple', 'banana', 'cherry'];

      const file = createJSONFile(data, 'fruits.json');
      const result = await importJSONFile(file);

      expect(result.nodes).toHaveLength(3);
      expect(result.errors).toHaveLength(0);

      expect(result.nodes[0].content).toBe('apple');
      expect(result.nodes[1].content).toBe('banana');
      expect(result.nodes[2].content).toBe('cherry');
    });

    test('handles location data correctly', async () => {
      const data = {
        name: 'Golden Gate Bridge',
        latitude: 37.8199,
        longitude: -122.4783,
        address: 'Golden Gate Bridge, San Francisco, CA'
      };

      const file = createJSONFile(data, 'location.json');
      const result = await importJSONFile(file);

      expect(result.nodes).toHaveLength(1);
      const node = result.nodes[0];

      expect(node.name).toBe('Golden Gate Bridge');
      expect(node.latitude).toBe(37.8199);
      expect(node.longitude).toBe(-122.4783);
      expect(node.locationAddress).toBe('Golden Gate Bridge, San Francisco, CA');
    });

    test('handles date parsing', async () => {
      const data = {
        name: 'Event',
        createdAt: '2024-01-01T10:00:00Z',
        modifiedAt: '2024-01-02T15:30:00Z',
        dueAt: '2024-01-03T09:00:00Z'
      };

      const file = createJSONFile(data, 'event.json');
      const result = await importJSONFile(file);

      expect(result.nodes).toHaveLength(1);
      const node = result.nodes[0];

      expect(node.createdAt).toBeInstanceOf(Date);
      expect(node.modifiedAt).toBeInstanceOf(Date);
      expect(node.dueAt).toBeInstanceOf(Date);
      expect(node.createdAt.toISOString()).toBe('2024-01-01T10:00:00.000Z');
    });

    test('handles tag arrays and string conversion', async () => {
      const data = [
        {
          name: 'Item with tag array',
          tags: ['important', 'work', 'project']
        },
        {
          name: 'Item with tag string',
          categories: 'personal,hobby,creative'  // Should be converted to array
        }
      ];

      const fieldMappings: FieldMapping[] = [
        { jsonPath: 'categories', targetProperty: 'tags', transform: { type: 'array' } }
      ];

      const options: JSONImportOptions = { fieldMappings };

      const file = createJSONFile(data, 'tagged-items.json');
      const result = await importJSONFile(file, options);

      expect(result.nodes).toHaveLength(2);

      const node1 = result.nodes[0];
      const node2 = result.nodes[1];

      expect(node1.tags).toEqual(expect.arrayContaining(['important', 'work', 'project']));
      expect(node2.tags).toEqual(expect.arrayContaining(['personal', 'hobby', 'creative']));
    });

    test('generates markdown content for unmapped fields', async () => {
      const data = {
        name: 'Complex Object',
        metadata: {
          version: '1.0',
          author: 'John Doe'
        },
        settings: ['option1', 'option2', 'option3'],
        description: 'A complex object with various fields'
      };

      const file = createJSONFile(data, 'complex.json');
      const result = await importJSONFile(file);

      expect(result.nodes).toHaveLength(1);
      const node = result.nodes[0];

      expect(node.content).toContain('**metadata:**');
      expect(node.content).toContain('**settings:**');
      expect(node.content).not.toContain('**name:**'); // Should be mapped to node.name
      expect(node.content).not.toContain('**description:**'); // Should be mapped to node.summary
    });

    test('handles empty and null values gracefully', async () => {
      const data = {
        name: 'Test Item',
        content: null,
        tags: [],
        metadata: {},
        description: ''
      };

      const file = createJSONFile(data, 'sparse.json');
      const result = await importJSONFile(file);

      expect(result.nodes).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const node = result.nodes[0];
      expect(node.name).toBe('Test Item');
    });

    test('handles import errors gracefully', async () => {
      const invalidFile = new MockFile('{ invalid json', 'invalid.json');
      const result = await importJSONFile(invalidFile);

      expect(result.nodes).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Unexpected token');
      expect(result.metadata.processedItems).toBe(0);
    });

    test('applies streaming mode configuration', async () => {
      const data = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        name: `Item ${i}`
      }));

      const options: JSONImportOptions = {
        streamingMode: true,
        batchSize: 10
      };

      const file = createJSONFile(data, 'large.json');
      const result = await importJSONFile(file, options);

      expect(result.nodes).toHaveLength(50);
      expect(result.metadata.streamingMode).toBe(true);
    });

    test('preserves custom source and folder options', async () => {
      const data = { name: 'Test Item' };
      const options: JSONImportOptions = {
        source: 'custom-import',
        folder: 'custom-folder',
        nodeType: 'custom-type'
      };

      const file = createJSONFile(data, 'custom.json');
      const result = await importJSONFile(file, options);

      expect(result.nodes).toHaveLength(1);
      const node = result.nodes[0];

      expect(node.source).toBe('custom-import');
      expect(node.folder).toBe('custom-folder');
      expect(node.nodeType).toBe('custom-type');
    });

    test('generates unique source IDs for array items', async () => {
      const data = [
        { name: 'Item 1' },
        { name: 'Item 2' },
        { name: 'Item 3' }
      ];

      const file = createJSONFile(data, 'items.json');
      const result = await importJSONFile(file);

      expect(result.nodes).toHaveLength(3);

      const sourceIds = result.nodes.map(node => node.sourceId);
      expect(sourceIds).toEqual(['items.json[0]', 'items.json[1]', 'items.json[2]']);

      // Check that all IDs are unique
      expect(new Set(sourceIds).size).toBe(3);
    });

    test('calculates processing metadata correctly', async () => {
      const data = [
        { name: 'Item 1' },
        { name: 'Item 2' }
      ];

      const file = createJSONFile(data, 'test.json');
      const startTime = Date.now();
      const result = await importJSONFile(file);
      const endTime = Date.now();

      expect(result.metadata.totalItems).toBe(2);
      expect(result.metadata.processedItems).toBe(2);
      expect(result.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata.processingTimeMs).toBeLessThanOrEqual(endTime - startTime);
      expect(result.metadata.schema).toBeDefined();
      expect(result.metadata.inferredMappings).toBeDefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('handles very large numeric values', async () => {
      const data = {
        name: 'Large Number Test',
        bigNumber: Number.MAX_SAFE_INTEGER,
        priority: 999999999
      };

      const file = createJSONFile(data, 'bignums.json');
      const result = await importJSONFile(file);

      expect(result.nodes).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    test('handles unicode and special characters', async () => {
      const data = {
        name: '测试项目 🚀',
        content: 'Content with émojis and spëcial characters: ñáéíóú',
        description: 'Ключевые слова на русском языке'
      };

      const file = createJSONFile(data, 'unicode.json');
      const result = await importJSONFile(file);

      expect(result.nodes).toHaveLength(1);
      const node = result.nodes[0];

      expect(node.name).toBe('测试项目 🚀');
      expect(node.content).toContain('émojis and spëcial characters');
    });

    test('handles deeply nested objects', async () => {
      const data = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  deepValue: 'Found at level 5'
                }
              }
            }
          }
        }
      };

      const file = createJSONFile(data, 'deep.json');
      const result = await importJSONFile(file);

      expect(result.nodes).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    test('handles circular reference-like structures', async () => {
      const data = {
        name: 'Self Reference',
        parent: 'root',
        children: [
          { name: 'child1', parent: 'Self Reference' },
          { name: 'child2', parent: 'Self Reference' }
        ]
      };

      const file = createJSONFile(data, 'circular.json');
      const result = await importJSONFile(file);

      expect(result.nodes).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });
  });
});