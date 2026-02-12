/**
 * Word Importer for Isometry ETL
 *
 * Parses .docx files using mammoth.js.
 * Converts Word documents to semantic HTML.
 *
 * Handles binary content via base64 encoding.
 *
 * @module etl/importers/WordImporter
 */

import mammoth from 'mammoth';
import { v4 as uuidv4 } from 'uuid';
import { BaseImporter, FileSource } from './BaseImporter';
import { CanonicalNode } from '../types/canonical';
import { generateDeterministicSourceId } from '../id-generation/deterministic';

interface MammothMessage {
  type: string;
  message: string;
}

interface ParsedWord {
  html: string;
  messages: MammothMessage[];
  filename: string;
}

export class WordImporter extends BaseImporter {
  protected async parse(source: FileSource): Promise<unknown> {
    try {
      // Convert content to buffer
      const buffer = this.toBuffer(source.content, source.encoding);

      // Convert DOCX to HTML
      const result = await mammoth.convertToHtml({ buffer });

      return {
        html: result.value,
        messages: result.messages as MammothMessage[],
        filename: source.filename,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to parse ${source.filename}: ${message}`);
    }
  }

  protected async transform(data: unknown): Promise<CanonicalNode[]> {
    const { html, messages, filename } = data as ParsedWord;
    const now = new Date().toISOString();

    // Extract title from first heading
    const title = this.extractTitle(html) || this.extractFilename(filename);

    // Extract summary from first paragraph
    const summary = this.extractSummary(html);

    // Extract text content for word count
    const textContent = this.stripHtml(html);

    const sourceId = generateDeterministicSourceId(
      filename,
      { title, contentHash: this.hashContent(textContent) },
      'word-importer'
    );

    // Collect warnings
    const warnings = messages.filter(m => m.type === 'warning');

    const node: CanonicalNode = {
      id: uuidv4(),
      sourceId,
      source: 'word-importer',
      nodeType: 'note',
      name: title,
      content: html,
      summary,

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
      tags: [],
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
        originalFormat: 'docx',
        wordCount: textContent.split(/\s+/).filter(Boolean).length,
        ...(warnings.length > 0 ? { conversionWarnings: warnings } : {}),
      },
    };

    return [node];
  }

  private toBuffer(content: string, encoding?: 'utf8' | 'base64'): Buffer {
    if (encoding === 'base64') {
      return Buffer.from(content, 'base64');
    }
    return Buffer.from(content);
  }

  private extractTitle(html: string): string | null {
    // Match first H1, H2, or H3
    const headingMatch = html.match(/<h[123][^>]*>([^<]+)<\/h[123]>/i);
    return headingMatch ? headingMatch[1].trim() : null;
  }

  private extractSummary(html: string): string | null {
    // Find first paragraph after heading (or first paragraph)
    const paragraphs = html.match(/<p[^>]*>([^<]+)<\/p>/gi);
    if (!paragraphs || paragraphs.length === 0) return null;

    // Get first paragraph content
    const firstP = paragraphs[0].replace(/<[^>]+>/g, '').trim();
    return firstP.slice(0, 200) || null;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private extractFilename(filepath: string): string {
    const parts = filepath.split(/[/\\]/);
    const filename = parts[parts.length - 1] || 'untitled';
    return filename.replace(/\.docx?$/i, '');
  }

  private hashContent(text: string): string {
    let hash = 0;
    for (let i = 0; i < Math.min(text.length, 1000); i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}
