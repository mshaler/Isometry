/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { HtmlImporter } from '../importers/HtmlImporter';
import { CanonicalNodeSchema } from '../types/canonical';
import { FileSource } from '../importers/BaseImporter';

describe('HtmlImporter', () => {
  let importer: HtmlImporter;

  beforeEach(() => {
    importer = new HtmlImporter();
  });

  describe('title extraction', () => {
    it('should extract title from <title> tag', async () => {
      const html = `<!DOCTYPE html>
<html>
<head><title>Page Title</title></head>
<body><p>Content</p></body>
</html>`;

      const nodes = await importer.import({
        filename: 'page.html',
        content: html,
      });

      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('Page Title');
    });

    it('should extract title from <h1> when no <title>', async () => {
      const html = `<html>
<body><h1>Heading Title</h1><p>Content</p></body>
</html>`;

      const nodes = await importer.import({
        filename: 'no-title.html',
        content: html,
      });

      expect(nodes[0].name).toBe('Heading Title');
    });

    it('should fallback to filename when no title found', async () => {
      const html = `<html><body><p>Just content</p></body></html>`;

      const nodes = await importer.import({
        filename: 'untitled.html',
        content: html,
      });

      expect(nodes[0].name).toBe('untitled');
    });
  });

  describe('meta tag extraction', () => {
    it('should extract description from meta tag', async () => {
      const html = `<html>
<head>
  <title>Test</title>
  <meta name="description" content="This is a page description">
</head>
<body><p>Content</p></body>
</html>`;

      const nodes = await importer.import({
        filename: 'meta.html',
        content: html,
      });

      expect(nodes[0].summary).toBe('This is a page description');
    });

    it('should extract keywords as tags', async () => {
      const html = `<html>
<head>
  <title>Test</title>
  <meta name="keywords" content="typescript, react, testing">
</head>
<body><p>Content</p></body>
</html>`;

      const nodes = await importer.import({
        filename: 'keywords.html',
        content: html,
      });

      expect(nodes[0].tags).toEqual(['typescript', 'react', 'testing']);
    });

    it('should extract author', async () => {
      const html = `<html>
<head>
  <title>Test</title>
  <meta name="author" content="John Doe">
</head>
<body><p>Content</p></body>
</html>`;

      const nodes = await importer.import({
        filename: 'author.html',
        content: html,
      });

      expect(nodes[0].properties).toHaveProperty('author', 'John Doe');
    });
  });

  describe('content extraction', () => {
    it('should extract content from <main> element', async () => {
      const html = `<html>
<head><title>Test</title></head>
<body>
  <nav>Navigation</nav>
  <main>
    <h1>Main Content</h1>
    <p>Important paragraph</p>
  </main>
  <footer>Footer</footer>
</body>
</html>`;

      const nodes = await importer.import({
        filename: 'main.html',
        content: html,
      });

      expect(nodes[0].content).toContain('Main Content');
      expect(nodes[0].content).toContain('Important paragraph');
      expect(nodes[0].content).not.toContain('Navigation');
      expect(nodes[0].content).not.toContain('Footer');
    });

    it('should extract content from <article> element', async () => {
      const html = `<html>
<body>
  <article>
    <h1>Article Title</h1>
    <p>Article content</p>
  </article>
</body>
</html>`;

      const nodes = await importer.import({
        filename: 'article.html',
        content: html,
      });

      expect(nodes[0].content).toContain('Article content');
    });

    it('should fallback to <body> content', async () => {
      const html = `<html>
<head><title>Test</title></head>
<body>
  <div>Some content here</div>
</body>
</html>`;

      const nodes = await importer.import({
        filename: 'body.html',
        content: html,
      });

      expect(nodes[0].content).toContain('Some content here');
    });
  });

  describe('edge cases', () => {
    it('should handle empty HTML', async () => {
      const nodes = await importer.import({
        filename: 'empty.html',
        content: '',
      });

      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('empty');
    });

    it('should handle malformed HTML gracefully', async () => {
      const html = `<html><body><p>Unclosed paragraph`;

      const nodes = await importer.import({
        filename: 'malformed.html',
        content: html,
      });

      expect(nodes).toHaveLength(1);
      expect(nodes[0].content).toContain('Unclosed paragraph');
    });

    it('should preserve HTML in content field', async () => {
      const html = `<html>
<body>
  <main>
    <p><strong>Bold</strong> and <em>italic</em></p>
  </main>
</body>
</html>`;

      const nodes = await importer.import({
        filename: 'formatted.html',
        content: html,
      });

      expect(nodes[0].content).toContain('<strong>');
      expect(nodes[0].content).toContain('<em>');
    });
  });

  describe('deterministic IDs', () => {
    it('should generate deterministic sourceId', async () => {
      const html = `<html><head><title>Test</title></head><body>Content</body></html>`;
      const source: FileSource = { filename: 'test.html', content: html };

      const nodes1 = await importer.import(source);
      const nodes2 = await importer.import(source);

      expect(nodes1[0].sourceId).toBe(nodes2[0].sourceId);
      expect(nodes1[0].sourceId).toMatch(/^html-importer-/);
    });
  });

  describe('validation', () => {
    it('should produce valid CanonicalNode', async () => {
      const html = `<html>
<head><title>Valid Page</title></head>
<body><main><p>Content</p></main></body>
</html>`;

      const nodes = await importer.import({
        filename: 'valid.html',
        content: html,
      });

      expect(() => CanonicalNodeSchema.parse(nodes[0])).not.toThrow();
    });
  });

  describe('integration', () => {
    it('should work with ImportCoordinator', async () => {
      const { ImportCoordinator } = await import('../coordinator/ImportCoordinator');
      const coordinator = new ImportCoordinator();
      coordinator.registerImporter(['.html', '.htm'], new HtmlImporter());

      const html = `<html>
<head><title>Integration Test</title></head>
<body><main><p>Test content</p></main></body>
</html>`;

      const nodes = await coordinator.importFile({
        filename: 'integration.html',
        content: html,
      });

      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('Integration Test');
      expect(() => CanonicalNodeSchema.parse(nodes[0])).not.toThrow();
    });

    it('should work with .htm extension', async () => {
      const { ImportCoordinator } = await import('../coordinator/ImportCoordinator');
      const coordinator = new ImportCoordinator();
      coordinator.registerImporter(['.html', '.htm'], new HtmlImporter());

      const html = `<html>
<head><title>HTM File</title></head>
<body><p>Content</p></body>
</html>`;

      const nodes = await coordinator.importFile({
        filename: 'legacy.htm',
        content: html,
      });

      expect(nodes).toHaveLength(1);
      expect(nodes[0].name).toBe('HTM File');
    });
  });
});
