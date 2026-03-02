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

describe('HTMLParser - Full Parse with Author and Resources', () => {
  let parser: HTMLParser;
  let webClippingHtml: string;

  beforeEach(() => {
    parser = new HTMLParser();
    webClippingHtml = readFileSync(
      join(__dirname, '../fixtures/html-web-clipping.html'),
      'utf-8'
    );
  });

  it('returns full parse result with card, content, title, metadata', () => {
    const result = parser.parse([webClippingHtml]);
    expect(result.cards.length).toBeGreaterThan(0);
    expect(result.cards[0].name).toBe('Complete Web Article');
    expect(result.cards[0].content).toContain('# Complete Web Article');
    expect(result.cards[0].created_at).toBe('2024-02-20T08:00:00Z');
    expect(result.cards[0].source_url).toBe('https://example.com/articles/complete');
  });

  it('creates person card for author from metadata', () => {
    const result = parser.parse([webClippingHtml]);
    const personCards = result.cards.filter(c => c.card_type === 'person');
    expect(personCards.length).toBe(1);
    expect(personCards[0].name).toBe('Jane Doe');
  });

  it('links person card via mentions connection', () => {
    const result = parser.parse([webClippingHtml]);
    const mentionsConnections = result.connections.filter(c => c.label === 'mentions');
    expect(mentionsConnections.length).toBe(1);
    expect(mentionsConnections[0].label).toBe('mentions');
  });

  it('creates resource cards for iframe embeds', () => {
    const result = parser.parse([webClippingHtml]);
    const resourceCards = result.cards.filter(c => c.card_type === 'resource');
    expect(resourceCards.length).toBe(1);
    expect(resourceCards[0].name).toBe('Demo Video');
    expect(resourceCards[0].url).toBe('https://www.youtube.com/embed/abc123');
  });

  it('links resource cards to main card via embeds connection', () => {
    const result = parser.parse([webClippingHtml]);
    const embedConnections = result.connections.filter(c => c.label === 'embeds');
    expect(embedConnections.length).toBe(1);
  });

  it('parses multiple HTML strings in batch', () => {
    const html1 = '<html><head><title>Article 1</title></head><body><p>Content 1</p></body></html>';
    const html2 = '<html><head><title>Article 2</title></head><body><p>Content 2</p></body></html>';
    const result = parser.parse([html1, html2]);
    expect(result.cards.length).toBe(2);
    expect(result.cards[0].name).toBe('Article 1');
    expect(result.cards[1].name).toBe('Article 2');
  });

  it('handles malformed HTML gracefully', () => {
    const malformedHtml = '<html><head><title>Bad HTML</head><body><p>Unclosed tag<body>';
    const result = parser.parse([malformedHtml]);
    expect(result.errors.length).toBe(0);
    expect(result.cards.length).toBe(1);
  });

  it('returns empty result for empty HTML', () => {
    const result = parser.parse(['']);
    expect(result.cards.length).toBe(0);
  });

  it('uses source_url as source_id when available', () => {
    const result = parser.parse([webClippingHtml]);
    expect(result.cards[0].source_id).toBe('https://example.com/articles/complete');
  });
});
