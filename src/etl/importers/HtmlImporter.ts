/**
 * HTML Importer for Isometry ETL
 *
 * Parses .html and .htm files using native DOMParser.
 * Extracts semantic content from <main>, <article>, or <body>.
 * Maps meta tags to LATCH fields.
 *
 * @module etl/importers/HtmlImporter
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseImporter, FileSource } from './BaseImporter';
import { CanonicalNode } from '../types/canonical';
import { generateDeterministicSourceId } from '../id-generation/deterministic';

interface ParsedHtml {
  title: string | null;
  description: string | null;
  keywords: string[];
  author: string | null;
  mainContent: string;
  textContent: string;
  filename: string;
}

export class HtmlImporter extends BaseImporter {
  protected async parse(source: FileSource): Promise<unknown> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(source.content || '<html></html>', 'text/html');

    // Extract title: prefer <title>, fallback to first <h1>
    const titleTag = doc.querySelector('title');
    const h1 = doc.querySelector('h1');
    const title = titleTag?.textContent?.trim() || h1?.textContent?.trim() || null;

    // Extract meta tags
    const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || null;
    const keywordsStr = doc.querySelector('meta[name="keywords"]')?.getAttribute('content') || '';
    const keywords = keywordsStr
      ? keywordsStr.split(',').map(k => k.trim()).filter(Boolean)
      : [];
    const author = doc.querySelector('meta[name="author"]')?.getAttribute('content') || null;

    // Extract main content (prefer semantic elements)
    const mainElement = doc.querySelector('main') || doc.querySelector('article') || doc.body;
    const mainContent = mainElement?.innerHTML || '';
    const textContent = mainElement?.textContent || '';

    return {
      title,
      description,
      keywords,
      author,
      mainContent,
      textContent,
      filename: source.filename,
    };
  }

  protected async transform(data: unknown): Promise<CanonicalNode[]> {
    const {
      title,
      description,
      keywords,
      author,
      mainContent,
      textContent,
      filename,
    } = data as ParsedHtml;

    const now = new Date().toISOString();

    // Derive name from title or filename
    const name = title || this.extractFilename(filename);

    const sourceId = generateDeterministicSourceId(
      filename,
      { title, description, contentHash: this.hashContent(textContent) },
      'html-importer'
    );

    const node: CanonicalNode = {
      id: uuidv4(),
      sourceId,
      source: 'html-importer',
      nodeType: 'note',
      name,
      content: mainContent,
      summary: description || textContent.slice(0, 200).trim() || null,

      // LATCH: Location
      latitude: null,
      longitude: null,
      locationName: null,
      locationAddress: null,

      // LATCH: Time
      createdAt: now,
      modifiedAt: now,
      dueAt: null,
      completedAt: null,
      eventStart: null,
      eventEnd: null,

      // LATCH: Category
      folder: null,
      tags: keywords,
      status: null,

      // LATCH: Hierarchy
      priority: 0,
      importance: 0,
      sortOrder: 0,

      // Grid
      gridX: 0,
      gridY: 0,

      // Provenance
      sourceUrl: null,
      deletedAt: null,
      version: 1,

      // Extended properties
      properties: {
        originalFormat: 'html',
        wordCount: textContent.split(/\s+/).filter(Boolean).length,
        ...(author ? { author } : {}),
      },
    };

    return [node];
  }

  private extractFilename(filepath: string): string {
    // Extract filename without extension
    const parts = filepath.split(/[/\\]/);
    const filename = parts[parts.length - 1] || 'untitled';
    return filename.replace(/\.(html?|htm)$/i, '');
  }

  private hashContent(text: string): string {
    // Simple hash for deterministic ID
    let hash = 0;
    for (let i = 0; i < Math.min(text.length, 1000); i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}
