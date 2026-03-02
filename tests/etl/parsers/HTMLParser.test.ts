// Isometry v5 — Phase 9 HTMLParser Tests
// Tests for HTML web clipping import with XSS prevention

import { describe, it, expect, beforeEach } from 'vitest';
import { HTMLParser } from '../../../src/etl/parsers/HTMLParser';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('HTMLParser - Stripping and Metadata', () => {
  let parser: HTMLParser;
  let fixtureHtml: string;

  beforeEach(() => {
    parser = new HTMLParser();
    fixtureHtml = readFileSync(
      join(__dirname, '../fixtures/html-with-scripts.html'),
      'utf-8'
    );
  });

  it('strips script tags completely', () => {
    const result = parser.parse([fixtureHtml]);
    expect(result.cards[0].content).not.toContain('alert');
    expect(result.cards[0].content).not.toContain('XSS');
    expect(result.cards[0].content).not.toContain('stolen');
  });

  it('strips style tags completely', () => {
    const result = parser.parse([fixtureHtml]);
    expect(result.cards[0].content).not.toContain('color: red');
    expect(result.cards[0].content).not.toContain('display: none');
  });

  it('extracts title from <title> tag', () => {
    const result = parser.parse([fixtureHtml]);
    expect(result.cards[0].name).toBe('Test Article');
  });

  it('uses og:title when <title> is generic', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Page</title>
        <meta property="og:title" content="Better Title">
      </head>
      <body><p>Content</p></body>
      </html>
    `;
    const result = parser.parse([html]);
    expect(result.cards[0].name).toBe('Better Title');
  });

  it('falls back to first <h1> when no <title>', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <body>
        <h1>Heading Title</h1>
        <p>Content</p>
      </body>
      </html>
    `;
    const result = parser.parse([html]);
    expect(result.cards[0].name).toBe('Heading Title');
  });

  it('falls back to first substantial text when no <h1>', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <body>
        <p>First paragraph text</p>
        <p>Second paragraph</p>
      </body>
      </html>
    `;
    const result = parser.parse([html]);
    expect(result.cards[0].name).toBe('First paragraph text');
  });

  it('extracts article:published_time as created_at', () => {
    const result = parser.parse([fixtureHtml]);
    expect(result.cards[0].created_at).toBe('2024-01-15T10:00:00Z');
  });

  it('extracts og:url as source_url', () => {
    const result = parser.parse([fixtureHtml]);
    expect(result.cards[0].source_url).toBe('https://example.com/article');
  });

  it('extracts canonical link as source_url fallback', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Article</title>
        <link rel="canonical" href="https://example.com/canonical">
      </head>
      <body><p>Content</p></body>
      </html>
    `;
    const result = parser.parse([html]);
    expect(result.cards[0].source_url).toBe('https://example.com/canonical');
  });

  it('prevents XSS - no script content survives', () => {
    const result = parser.parse([fixtureHtml]);
    expect(result.cards[0].content).not.toContain('alert');
    expect(result.cards[0].content).not.toContain('console.log');
    expect(result.cards[0].content).not.toContain('document.cookie');
  });

  it('strips inline event handlers', () => {
    const result = parser.parse([fixtureHtml]);
    expect(result.cards[0].content).not.toContain('onclick');
    expect(result.cards[0].content).not.toContain('onerror');
  });
});

describe('HTMLParser - Markdown Conversion', () => {
  let parser: HTMLParser;
  let articleHtml: string;

  beforeEach(() => {
    parser = new HTMLParser();
    articleHtml = readFileSync(
      join(__dirname, '../fixtures/html-article.html'),
      'utf-8'
    );
  });

  it('converts h1-h6 headings to Markdown', () => {
    const result = parser.parse([articleHtml]);
    expect(result.cards[0].content).toContain('# Main Heading');
    expect(result.cards[0].content).toContain('## Subheading');
  });

  it('converts bold tags to **text**', () => {
    const result = parser.parse([articleHtml]);
    expect(result.cards[0].content).toContain('**bold**');
  });

  it('converts italic tags to *text*', () => {
    const result = parser.parse([articleHtml]);
    expect(result.cards[0].content).toContain('*italic*');
  });

  it('converts links to [text](url)', () => {
    const result = parser.parse([articleHtml]);
    expect(result.cards[0].content).toContain('[link](https://example.com)');
  });

  it('converts inline code to `code`', () => {
    const result = parser.parse([articleHtml]);
    expect(result.cards[0].content).toContain('`inline code`');
  });

  it('converts code blocks to ```code```', () => {
    const result = parser.parse([articleHtml]);
    expect(result.cards[0].content).toContain('```javascript');
    expect(result.cards[0].content).toContain('function hello()');
  });

  it('converts lists to - items', () => {
    const result = parser.parse([articleHtml]);
    expect(result.cards[0].content).toContain('- Item 1');
    expect(result.cards[0].content).toContain('- Item 2');
  });

  it('converts blockquotes to > prefixed lines', () => {
    const result = parser.parse([articleHtml]);
    expect(result.cards[0].content).toContain('> This is a quote');
  });

  it('converts tables to GFM Markdown tables', () => {
    const result = parser.parse([articleHtml]);
    expect(result.cards[0].content).toContain('| Header 1 | Header 2 |');
    expect(result.cards[0].content).toContain('| --- | --- |');
    expect(result.cards[0].content).toContain('| Cell 1 | Cell 2 |');
  });

  it('converts images to ![alt](src)', () => {
    const result = parser.parse([articleHtml]);
    expect(result.cards[0].content).toContain('![An image](image.jpg)');
  });

  it('converts horizontal rules to ---', () => {
    const result = parser.parse([articleHtml]);
    expect(result.cards[0].content).toContain('---');
  });

  it('decodes HTML entities', () => {
    const result = parser.parse([articleHtml]);
    expect(result.cards[0].content).toContain('& < > " \'');
  });

  it('strips remaining tags for clean text output', () => {
    const result = parser.parse([articleHtml]);
    expect(result.cards[0].content).not.toContain('<p>');
    expect(result.cards[0].content).not.toContain('</p>');
    expect(result.cards[0].content).not.toContain('<body>');
  });
});
