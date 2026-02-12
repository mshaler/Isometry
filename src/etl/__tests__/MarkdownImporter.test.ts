/**
 * TDD tests for MarkdownImporter
 *
 * Tests cover:
 * - Frontmatter parsing with gray-matter
 * - Markdown-to-HTML conversion with marked
 * - LATCH field mapping with flexible key detection
 * - Deterministic sourceId generation
 * - Extended properties for unknown keys
 * - Edge cases (empty files, no frontmatter, etc.)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownImporter } from '../importers/MarkdownImporter';
import { CanonicalNodeSchema } from '../types/canonical';
import { FileSource } from '../importers/BaseImporter';

describe('MarkdownImporter', () => {
  let importer: MarkdownImporter;

  beforeEach(() => {
    importer = new MarkdownImporter();
  });

  describe('basic parsing', () => {
    it('should parse frontmatter and content', async () => {
      const source: FileSource = {
        filename: 'test.md',
        content: `---
title: Test Note
tags: [work, important]
created: 2024-01-15T10:00:00Z
---

# Test Note

This is the body content.`,
      };

      const nodes = await importer.import(source);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('Test Note');
      expect(nodes[0].tags).toEqual(['work', 'important']);
      // gray-matter parses ISO dates as Date objects, so we may get .000Z suffix
      expect(nodes[0].createdAt).toMatch(/^2024-01-15T10:00:00/);
      expect(nodes[0].content).toContain('<h1');
      expect(nodes[0].content).toContain('Test Note');
    });

    it('should extract title from H1 when no frontmatter title', async () => {
      const source: FileSource = {
        filename: 'no-title.md',
        content: `# Extracted Title

Body text.`,
      };

      const nodes = await importer.import(source);

      expect(nodes[0].name).toBe('Extracted Title');
    });

    it('should use filename as fallback when no title or H1', async () => {
      const source: FileSource = {
        filename: 'just-body.md',
        content: `Just some body text without any headings.`,
      };

      const nodes = await importer.import(source);

      expect(nodes[0].name).toBe('Untitled');
    });

    it('should handle empty markdown content', async () => {
      const source: FileSource = {
        filename: 'empty.md',
        content: '',
      };

      const nodes = await importer.import(source);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('Untitled');
      expect(nodes[0].content).toBe('');
    });

    it('should handle frontmatter-only without body', async () => {
      const source: FileSource = {
        filename: 'frontmatter-only.md',
        content: `---
title: Frontmatter Only
tags: [test]
---`,
      };

      const nodes = await importer.import(source);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('Frontmatter Only');
      expect(nodes[0].tags).toEqual(['test']);
    });
  });

  describe('deterministic sourceId', () => {
    it('should generate deterministic sourceId', async () => {
      const source: FileSource = {
        filename: 'deterministic.md',
        content: `---
title: Deterministic Test
---

Content.`,
      };

      const nodes1 = await importer.import(source);
      const nodes2 = await importer.import(source);

      expect(nodes1[0].sourceId).toBe(nodes2[0].sourceId);
      expect(nodes1[0].sourceId).toMatch(/^markdown-importer-/);
    });

    it('should generate different sourceId for different content', async () => {
      const source1: FileSource = {
        filename: 'file1.md',
        content: `---
title: File One
---

Content 1.`,
      };

      const source2: FileSource = {
        filename: 'file2.md',
        content: `---
title: File Two
---

Content 2.`,
      };

      const nodes1 = await importer.import(source1);
      const nodes2 = await importer.import(source2);

      expect(nodes1[0].sourceId).not.toBe(nodes2[0].sourceId);
    });
  });

  describe('LATCH field mapping - Time', () => {
    it('should map created/createdAt/created_at to createdAt', async () => {
      const variants = [
        { key: 'created', value: '2024-01-15T10:00:00Z' },
        { key: 'createdAt', value: '2024-02-15T10:00:00Z' },
        { key: 'created_at', value: '2024-03-15T10:00:00Z' },
        { key: 'date', value: '2024-04-15T10:00:00Z' },
      ];

      for (const { key, value } of variants) {
        const source: FileSource = {
          filename: `${key}-test.md`,
          content: `---
title: Time Test
${key}: ${value}
---

Content.`,
        };

        const nodes = await importer.import(source);
        // gray-matter parses ISO dates as Date objects, may add .000Z suffix
        expect(nodes[0].createdAt).toMatch(new RegExp(`^${value.replace('Z', '')}`));
      }
    });

    it('should map due/dueAt/due_at/deadline to dueAt', async () => {
      const source: FileSource = {
        filename: 'due-test.md',
        content: `---
title: Due Test
deadline: 2024-12-31T23:59:59Z
---

Content.`,
      };

      const nodes = await importer.import(source);
      // gray-matter parses ISO dates as Date objects, may add .000Z suffix
      expect(nodes[0].dueAt).toMatch(/^2024-12-31T23:59:59/);
    });

    it('should handle Date objects in frontmatter', async () => {
      // gray-matter parses YAML dates as Date objects
      const source: FileSource = {
        filename: 'date-object.md',
        content: `---
title: Date Object Test
created: 2024-01-15
---

Content.`,
      };

      const nodes = await importer.import(source);
      // Should be converted to ISO string
      expect(nodes[0].createdAt).toMatch(/^2024-01-15T/);
    });
  });

  describe('LATCH field mapping - Category', () => {
    it('should map tags array', async () => {
      const source: FileSource = {
        filename: 'tags-array.md',
        content: `---
title: Tags Test
tags: [work, urgent, project-x]
---

Content.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].tags).toEqual(['work', 'urgent', 'project-x']);
    });

    it('should parse comma-separated tags string', async () => {
      const source: FileSource = {
        filename: 'tags-string.md',
        content: `---
title: Tags String Test
tags: work, urgent, project-x
---

Content.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].tags).toEqual(['work', 'urgent', 'project-x']);
    });

    it('should map folder/category to folder', async () => {
      const source: FileSource = {
        filename: 'folder-test.md',
        content: `---
title: Folder Test
folder: Projects/Active
---

Content.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].folder).toBe('Projects/Active');
    });

    it('should map status/state to status', async () => {
      const source: FileSource = {
        filename: 'status-test.md',
        content: `---
title: Status Test
status: in-progress
---

Content.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].status).toBe('in-progress');
    });
  });

  describe('LATCH field mapping - Hierarchy', () => {
    it('should map numeric priority', async () => {
      const source: FileSource = {
        filename: 'priority-num.md',
        content: `---
title: Priority Test
priority: 4
---

Content.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].priority).toBe(4);
    });

    it('should map string priority to number', async () => {
      const testCases = [
        { input: 'high', expected: 5 },
        { input: 'urgent', expected: 5 },
        { input: 'medium', expected: 3 },
        { input: 'normal', expected: 3 },
        { input: 'low', expected: 1 },
      ];

      for (const { input, expected } of testCases) {
        const source: FileSource = {
          filename: `priority-${input}.md`,
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

    it('should clamp priority to 0-5 range', async () => {
      const source: FileSource = {
        filename: 'priority-overflow.md',
        content: `---
title: Priority Overflow
priority: 10
---

Content.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].priority).toBe(5);
    });
  });

  describe('extended properties', () => {
    it('should store unknown frontmatter keys in properties', async () => {
      const source: FileSource = {
        filename: 'custom-props.md',
        content: `---
title: Custom Props Test
custom_field: custom_value
another_key: 123
nested:
  deep: value
---

Content.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].properties.custom_field).toBe('custom_value');
      expect(nodes[0].properties.another_key).toBe(123);
      expect(nodes[0].properties.nested).toEqual({ deep: 'value' });
    });

    it('should mark originalFormat as markdown', async () => {
      const source: FileSource = {
        filename: 'format.md',
        content: `---
title: Format Test
---

Content.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].properties.originalFormat).toBe('markdown');
    });
  });

  describe('HTML conversion', () => {
    it('should convert markdown to HTML', async () => {
      const source: FileSource = {
        filename: 'html-conversion.md',
        content: `---
title: HTML Test
---

# Heading

This is a **bold** and *italic* paragraph.

- List item 1
- List item 2

\`\`\`javascript
const code = 'test';
\`\`\``,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].content).toContain('<h1');
      expect(nodes[0].content).toContain('<strong>bold</strong>');
      expect(nodes[0].content).toContain('<em>italic</em>');
      expect(nodes[0].content).toContain('<li>');
      expect(nodes[0].content).toContain('<code');
    });
  });

  describe('summary extraction', () => {
    it('should use summary from frontmatter if provided', async () => {
      const source: FileSource = {
        filename: 'summary-frontmatter.md',
        content: `---
title: Summary Test
summary: This is the explicit summary.
---

# Heading

Body content here.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].summary).toBe('This is the explicit summary.');
    });

    it('should extract summary from first paragraph if not in frontmatter', async () => {
      const source: FileSource = {
        filename: 'summary-auto.md',
        content: `---
title: Auto Summary Test
---

This is the first paragraph that should become the summary.

# Some Heading

More content here.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].summary).toBe(
        'This is the first paragraph that should become the summary.'
      );
    });
  });

  describe('schema validation', () => {
    it('should produce valid CanonicalNode', async () => {
      const source: FileSource = {
        filename: 'valid-node.md',
        content: `---
title: Valid Node Test
tags: [test]
created: 2024-01-15T10:00:00Z
folder: Test
priority: 3
---

# Valid Node Test

This is valid content.`,
      };

      const nodes = await importer.import(source);

      // Should not throw
      expect(() => CanonicalNodeSchema.parse(nodes[0])).not.toThrow();
    });

    it('should set correct source field', async () => {
      const source: FileSource = {
        filename: 'source-test.md',
        content: `---
title: Source Test
---

Content.`,
      };

      const nodes = await importer.import(source);
      expect(nodes[0].source).toBe('markdown-importer');
    });
  });

  describe('integration with ImportCoordinator', () => {
    it('should integrate with ImportCoordinator', async () => {
      const { ImportCoordinator } = await import(
        '../coordinator/ImportCoordinator'
      );
      const coordinator = new ImportCoordinator();
      coordinator.registerImporter(
        ['.md', '.markdown', '.mdx'],
        new MarkdownImporter()
      );

      const source: FileSource = {
        filename: 'integration-test.md',
        content: `---
title: Integration Test
tags: [integration]
created: 2024-01-15T10:00:00Z
---

Content here.`,
      };

      const nodes = await coordinator.importFile(source);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('Integration Test');
      // Validates against CanonicalNodeSchema (throws if invalid)
      expect(() => CanonicalNodeSchema.parse(nodes[0])).not.toThrow();
    });
  });
});
