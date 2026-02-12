/**
 * WordImporter Unit Tests
 *
 * TDD tests for DOCX file import using mammoth.js.
 * Mocks mammoth to test transformation logic.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock mammoth before importing WordImporter
vi.mock('mammoth', () => ({
  default: {
    convertToHtml: vi.fn(),
  },
}));

import mammoth from 'mammoth';
import { WordImporter } from '../importers/WordImporter';
import { CanonicalNodeSchema } from '../types/canonical';
import { FileSource } from '../importers/BaseImporter';

describe('WordImporter', () => {
  let importer: WordImporter;

  beforeEach(() => {
    importer = new WordImporter();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('basic parsing', () => {
    it('should convert DOCX to HTML', async () => {
      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '<h1>Document Title</h1><p>Document content here.</p>',
        messages: [],
      });

      const nodes = await importer.import({
        filename: 'test.docx',
        content: 'base64-encoded-content',
        encoding: 'base64',
      });

      expect(nodes).toHaveLength(1);
      expect(nodes[0].content).toContain('<h1>Document Title</h1>');
      expect(nodes[0].content).toContain('<p>Document content');
    });

    it('should extract title from first <h1>', async () => {
      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '<h1>Extracted Title</h1><p>Content</p>',
        messages: [],
      });

      const nodes = await importer.import({
        filename: 'titled.docx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(nodes[0].name).toBe('Extracted Title');
    });

    it('should fallback to filename when no heading', async () => {
      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '<p>Just paragraphs, no heading</p>',
        messages: [],
      });

      const nodes = await importer.import({
        filename: 'no-heading.docx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(nodes[0].name).toBe('no-heading');
    });
  });

  describe('content handling', () => {
    it('should preserve HTML formatting', async () => {
      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '<h1>Title</h1><p><strong>Bold</strong> and <em>italic</em></p><ul><li>Item 1</li></ul>',
        messages: [],
      });

      const nodes = await importer.import({
        filename: 'formatted.docx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(nodes[0].content).toContain('<strong>Bold</strong>');
      expect(nodes[0].content).toContain('<em>italic</em>');
      expect(nodes[0].content).toContain('<ul>');
    });

    it('should generate summary from first paragraph', async () => {
      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '<h1>Title</h1><p>This is the first paragraph that should become the summary.</p><p>Second paragraph.</p>',
        messages: [],
      });

      const nodes = await importer.import({
        filename: 'summary.docx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(nodes[0].summary).toContain('This is the first paragraph');
    });
  });

  describe('encoding handling', () => {
    it('should handle base64 encoded content', async () => {
      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '<p>Content</p>',
        messages: [],
      });

      await importer.import({
        filename: 'base64.docx',
        content: 'SGVsbG8gV29ybGQ=', // "Hello World" in base64
        encoding: 'base64',
      });

      expect(mammoth.convertToHtml).toHaveBeenCalled();
      // Verify buffer was created correctly
      const call = vi.mocked(mammoth.convertToHtml).mock.calls[0];
      expect(call[0]).toHaveProperty('buffer');
    });

    it('should handle UTF-8 string content', async () => {
      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '<p>Content</p>',
        messages: [],
      });

      await importer.import({
        filename: 'utf8.docx',
        content: 'string content',
        encoding: 'utf8',
      });

      expect(mammoth.convertToHtml).toHaveBeenCalled();
    });
  });

  describe('conversion warnings', () => {
    it('should store conversion warnings in properties', async () => {
      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '<p>Content</p>',
        messages: [
          { type: 'warning', message: 'Unknown element: w:drawing' },
          { type: 'warning', message: 'Unsupported feature' },
        ],
      });

      const nodes = await importer.import({
        filename: 'warnings.docx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(nodes[0].properties).toHaveProperty('conversionWarnings');
      expect(nodes[0].properties.conversionWarnings).toHaveLength(2);
    });
  });

  describe('deterministic IDs', () => {
    it('should generate deterministic sourceId', async () => {
      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '<h1>Test</h1><p>Content</p>',
        messages: [],
      });

      const source: FileSource = {
        filename: 'deterministic.docx',
        content: 'base64content',
        encoding: 'base64',
      };

      const nodes1 = await importer.import(source);
      const nodes2 = await importer.import(source);

      expect(nodes1[0].sourceId).toBe(nodes2[0].sourceId);
      expect(nodes1[0].sourceId).toMatch(/^word-importer-/);
    });
  });

  describe('validation', () => {
    it('should produce valid CanonicalNode', async () => {
      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '<h1>Valid</h1><p>Content</p>',
        messages: [],
      });

      const nodes = await importer.import({
        filename: 'valid.docx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(() => CanonicalNodeSchema.parse(nodes[0])).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should throw descriptive error on conversion failure', async () => {
      vi.mocked(mammoth.convertToHtml).mockRejectedValue(
        new Error('Invalid DOCX file')
      );

      await expect(
        importer.import({
          filename: 'invalid.docx',
          content: 'bad-content',
          encoding: 'base64',
        })
      ).rejects.toThrow(/invalid\.docx.*Invalid DOCX/i);
    });
  });
});

describe('WordImporter integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should work with ImportCoordinator', async () => {
    vi.mocked(mammoth.convertToHtml).mockResolvedValue({
      value: '<h1>Integration Test</h1><p>Content</p>',
      messages: [],
    });

    const { ImportCoordinator } = await import('../coordinator/ImportCoordinator');
    const { WordImporter } = await import('../importers/WordImporter');

    const coordinator = new ImportCoordinator();
    coordinator.registerImporter(['.docx'], new WordImporter());

    const nodes = await coordinator.importFile({
      filename: 'integration.docx',
      content: 'base64content',
      encoding: 'base64',
    });

    expect(nodes).toHaveLength(1);
    expect(nodes[0].name).toBe('Integration Test');
    expect(() => CanonicalNodeSchema.parse(nodes[0])).not.toThrow();
  });
});
