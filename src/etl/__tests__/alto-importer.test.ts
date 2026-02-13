/**
 * TDD tests for AltoImporter
 *
 * Tests cover:
 * - AltoImporter extends BaseImporter
 * - import() returns CanonicalNode[] validated by schema
 * - LATCH field mapping from alto-index frontmatter
 * - Unknown properties extraction using SQL_COLUMN_MAP
 * - Backward-compatible importAltoFile() wrapper
 * - Error handling for malformed frontmatter
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AltoImporter, importAltoFile } from '../alto-importer';
import { CanonicalNodeSchema, SQL_COLUMN_MAP } from '../types/canonical';
import { FileSource, BaseImporter } from '../importers/BaseImporter';
import { createTestDB, cleanupTestDB, execTestQuery } from '@/test/db-utils';
import type { Database } from 'sql.js-fts5';

describe('AltoImporter', () => {
  let importer: AltoImporter;

  beforeEach(() => {
    importer = new AltoImporter();
  });

  describe('class structure', () => {
    it('extends BaseImporter', () => {
      expect(importer).toBeInstanceOf(BaseImporter);
    });
  });

  describe('basic parsing', () => {
    it('returns CanonicalNode array', async () => {
      const source: FileSource = {
        filename: '/notes/test.md',
        content: `---
title: Test Note
created: 2024-01-15T10:00:00Z
---

This is the body content.`,
      };

      const nodes = await importer.import(source);

      expect(nodes).toBeInstanceOf(Array);
      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toBeDefined();
      expect(nodes[0].name).toBe('Test Note');
    });

    it('extracts body content', async () => {
      const source: FileSource = {
        filename: '/notes/content-test.md',
        content: `---
title: Content Test
---

# Heading

This is the body content.

- List item 1
- List item 2`,
      };

      const nodes = await importer.import(source);

      expect(nodes[0].content).toContain('# Heading');
      expect(nodes[0].content).toContain('This is the body content.');
    });

    it('uses filename as fallback for title', async () => {
      const source: FileSource = {
        filename: '/notes/fallback-title.md',
        content: `---
created: 2024-01-15T10:00:00Z
---

Body without title.`,
      };

      const nodes = await importer.import(source);

      expect(nodes[0].name).toBe('/notes/fallback-title.md');
    });
  });

  describe('validates against CanonicalNodeSchema', () => {
    it('produces valid CanonicalNode', async () => {
      const source: FileSource = {
        filename: '/notes/valid-test.md',
        content: `---
title: Valid Node Test
created: 2024-01-15T10:00:00Z
folder: Test
priority: 3
---

This is valid content.`,
      };

      const nodes = await importer.import(source);

      // Should not throw
      expect(() => CanonicalNodeSchema.parse(nodes[0])).not.toThrow();
      expect(CanonicalNodeSchema.safeParse(nodes[0]).success).toBe(true);
    });

    it('sets source to alto-index', async () => {
      const source: FileSource = {
        filename: '/notes/source-test.md',
        content: `---
title: Source Test
---

Content.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].source).toBe('alto-index');
    });

    it('generates deterministic sourceId', async () => {
      const source: FileSource = {
        filename: '/notes/deterministic.md',
        content: `---
title: Deterministic Test
---

Content.`,
      };

      const nodes1 = await importer.import(source);
      const nodes2 = await importer.import(source);

      expect(nodes1[0].sourceId).toBe(nodes2[0].sourceId);
      expect(nodes1[0].sourceId).toMatch(/^alto-/);
    });
  });

  describe('LATCH field mapping', () => {
    it('maps title to name', async () => {
      const source: FileSource = {
        filename: '/notes/title-test.md',
        content: `---
title: My Title
---

Content.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].name).toBe('My Title');
    });

    it('maps created to createdAt (ISO 8601 string)', async () => {
      const source: FileSource = {
        filename: '/notes/created-test.md',
        content: `---
title: Created Test
created: 2024-01-15T10:00:00Z
---

Content.`,
      };

      const nodes = await importer.import(source);
      // gray-matter parses ISO dates as Date objects, may add .000Z suffix
      expect(nodes[0].createdAt).toMatch(/^2024-01-15T10:00:00/);
    });

    it('maps folder to folder', async () => {
      const source: FileSource = {
        filename: '/notes/folder-test.md',
        content: `---
title: Folder Test
folder: Projects
---

Content.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].folder).toBe('Projects');
    });

    it('extracts tags from attachments (notes-specific)', async () => {
      const source: FileSource = {
        filename: '/notes/tags-test.md',
        content: `---
title: Tags Test
attachments:
  - type: com.apple.notes.inlinetextattachment.hashtag
    content: "#work<br>"
  - type: com.apple.notes.inlinetextattachment.hashtag
    content: "#important<br>"
  - type: other
    content: not-a-tag
---

Content with tags.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].tags).toEqual(['work', 'important']);
    });

    it('maps numeric priority', async () => {
      const source: FileSource = {
        filename: '/notes/priority-test.md',
        content: `---
title: Priority Test
priority: 4
---

Content.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].priority).toBe(4);
    });

    it('maps string priority to number', async () => {
      const testCases = [
        { input: 'high', expected: 5 },
        { input: 'medium', expected: 3 },
        { input: 'low', expected: 1 },
      ];

      for (const { input, expected } of testCases) {
        const source: FileSource = {
          filename: `/notes/priority-${input}.md`,
          content: `---
title: Priority ${input}
priority: ${input}
---

Content.`,
        };

        const nodes = await importer.import(source);
        expect(nodes[0].priority).toBe(expected);
      }
    });

    it('maps is_flagged to priority 4', async () => {
      const source: FileSource = {
        filename: '/reminders/flagged-test.md',
        content: `---
title: Flagged Test
is_flagged: true
---

Content.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].priority).toBe(4);
    });
  });

  describe('data type detection', () => {
    it('detects notes from path', async () => {
      const source: FileSource = {
        filename: '/notes/note-type.md',
        content: `---
title: Note Type Test
---

Content.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].nodeType).toBe('notes');
    });

    it('detects calendar from path', async () => {
      const source: FileSource = {
        filename: '/calendar/event.md',
        content: `---
title: Calendar Event
location: 123 Main St
---

Event details.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].nodeType).toBe('calendar');
      expect(nodes[0].folder).toBe('Calendar');
      expect(nodes[0].locationAddress).toBe('123 Main St');
    });

    it('detects contacts from path', async () => {
      const source: FileSource = {
        filename: '/contacts/john-doe.md',
        content: `---
title: John Doe
organization: Acme Corp
---

Contact info.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].nodeType).toBe('contacts');
      expect(nodes[0].folder).toBe('Acme Corp');
    });

    it('detects messages from path', async () => {
      const source: FileSource = {
        filename: '/messages/chat-123.md',
        content: `---
title: Chat with Alice
participants: [Alice, Bob]
is_group: false
---

Chat content.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].nodeType).toBe('messages');
      expect(nodes[0].folder).toBe('Messages');
      expect(nodes[0].summary).toBe('Alice, Bob');
    });

    it('detects reminders from path', async () => {
      const source: FileSource = {
        filename: '/reminders/task.md',
        content: `---
title: Task Reminder
list: Shopping
is_flagged: true
---

Reminder content.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].nodeType).toBe('reminders');
      expect(nodes[0].folder).toBe('Shopping');
      expect(nodes[0].status).toBe('flagged');
    });
  });

  describe('extracts unknown properties', () => {
    it('stores unknown frontmatter keys in properties', async () => {
      const source: FileSource = {
        filename: '/notes/custom-props.md',
        content: `---
title: Custom Props Test
custom_field: custom_value
another_key: 123
---

Content.`,
      };

      const nodes = await importer.import(source);

      // custom_field and another_key should be in properties
      expect(nodes[0].properties.custom_field).toBe('custom_value');
      expect(nodes[0].properties.another_key).toBe(123);
    });

    it('does not include canonical keys in properties', async () => {
      const source: FileSource = {
        filename: '/notes/canonical-exclusion.md',
        content: `---
title: Canonical Exclusion Test
created: 2024-01-15T10:00:00Z
folder: Test
priority: 3
custom_only: should_be_in_properties
---

Content.`,
      };

      const nodes = await importer.import(source);

      // Canonical fields should NOT be in properties
      expect(nodes[0].properties).not.toHaveProperty('title');
      expect(nodes[0].properties).not.toHaveProperty('created');
      expect(nodes[0].properties).not.toHaveProperty('folder');
      expect(nodes[0].properties).not.toHaveProperty('priority');

      // But custom key should be
      expect(nodes[0].properties.custom_only).toBe('should_be_in_properties');
    });

    it('excludes known frontmatter aliases from properties', async () => {
      const source: FileSource = {
        filename: '/notes/alias-exclusion.md',
        content: `---
title: Alias Exclusion Test
created: 2024-01-15T10:00:00Z
modified: 2024-01-16T10:00:00Z
location: 123 Main St
calendar: Work
really_custom: yes
---

Content.`,
      };

      const nodes = await importer.import(source);

      // Known aliases should NOT be in properties
      expect(nodes[0].properties).not.toHaveProperty('title');
      expect(nodes[0].properties).not.toHaveProperty('created');
      expect(nodes[0].properties).not.toHaveProperty('modified');
      expect(nodes[0].properties).not.toHaveProperty('location');
      expect(nodes[0].properties).not.toHaveProperty('calendar');

      // But truly custom keys should be
      expect(nodes[0].properties.really_custom).toBe('yes');
    });

    it('returns empty object for no unknown properties', async () => {
      const source: FileSource = {
        filename: '/notes/no-custom.md',
        content: `---
title: No Custom Props
folder: Test
---

Content.`,
      };

      const nodes = await importer.import(source);

      // Properties should be empty object
      expect(nodes[0].properties).toEqual({});
    });
  });

  describe('error handling', () => {
    it('handles missing frontmatter gracefully', async () => {
      const source: FileSource = {
        filename: '/notes/no-frontmatter.md',
        content: `Just content without any frontmatter.

More content here.`,
      };

      const nodes = await importer.import(source);

      // Should still parse successfully with defaults
      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('/notes/no-frontmatter.md'); // filename fallback
    });

    it('handles malformed multi-line quoted frontmatter values', async () => {
      const source: FileSource = {
        filename: '/calendar/malformed-location.md',
        content: `---
title: Calendar Event
calendar: Work
location: "123 Main St
Suite 400
Denver, CO"
start_date: 2025-05-27T10:00:00Z
---

Event details.`,
      };

      const nodes = await importer.import(source);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('Calendar Event');
      expect(nodes[0].folder).toBe('Work');
      expect(nodes[0].locationAddress).toContain('123 Main St');
      expect(nodes[0].eventStart).toMatch(/^2025-05-27T10:00:00/);
    });
  });
});

describe('importAltoFile (backward compatibility)', () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDB({ loadSampleData: false });
  });

  afterEach(async () => {
    if (db) {
      await cleanupTestDB(db);
    }
  });

  it('inserts node into database and returns nodeId', async () => {
    const result = await importAltoFile(
      db,
      '/notes/backward-compat.md',
      `---
title: Backward Compatibility Test
folder: Test
priority: 3
---

Test content.`
    );

    expect(result.nodeId).toBeTruthy();
    expect(result.errors).toHaveLength(0);

    // Verify node exists in database
    const rows = execTestQuery(db, 'SELECT * FROM nodes WHERE id = ?', [
      result.nodeId,
    ]);
    expect(rows).toHaveLength(1);

    const dbNode = rows[0] as Record<string, unknown>;
    expect(dbNode.name).toBe('Backward Compatibility Test');
    expect(dbNode.folder).toBe('Test');
    expect(dbNode.priority).toBe(3);
    expect(dbNode.source).toBe('alto-index');
  });

  it('handles missing frontmatter in backward-compatible wrapper', async () => {
    // gray-matter is lenient with YAML - missing frontmatter still works
    const result = await importAltoFile(
      db,
      '/notes/no-frontmatter.md',
      `Just content without frontmatter.`
    );

    // Should still succeed - gray-matter returns empty object for missing frontmatter
    expect(result.nodeId).toBeTruthy();
    expect(result.errors).toHaveLength(0);

    // Verify node uses filename as name
    const rows = execTestQuery(db, 'SELECT name FROM nodes WHERE id = ?', [
      result.nodeId,
    ]);
    expect((rows[0] as { name: string }).name).toBe('/notes/no-frontmatter.md');
  });

  it('stores properties in node_properties table', async () => {
    const result = await importAltoFile(
      db,
      '/notes/properties-test.md',
      `---
title: Properties Test
custom_field: custom_value
---

Content.`
    );

    expect(result.nodeId).toBeTruthy();

    // Check node_properties table
    const props = execTestQuery(
      db,
      'SELECT key, value FROM node_properties WHERE node_id = ?',
      [result.nodeId]
    );

    expect(props).toHaveLength(1);
    const prop = props[0] as { key: string; value: string };
    expect(prop.key).toBe('custom_field');
    expect(JSON.parse(prop.value)).toBe('custom_value');
  });
});

describe('SQL_COLUMN_MAP coverage', () => {
  it('SQL_COLUMN_MAP has all CanonicalNode keys (except properties)', () => {
    // All canonical fields should be mappable to SQL columns
    const schemaShape = CanonicalNodeSchema.shape;
    const schemaKeys = Object.keys(schemaShape).filter((k) => k !== 'properties');
    const mapKeys = Object.keys(SQL_COLUMN_MAP);

    expect(mapKeys.sort()).toEqual(schemaKeys.sort());
  });
});
