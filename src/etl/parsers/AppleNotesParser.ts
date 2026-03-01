// Isometry v5 — Phase 8 Apple Notes Parser
// Parses alto-index Markdown exports with YAML frontmatter.
//
// Per CONTEXT.md locked decisions:
// - Use alto-index numeric id as source_id
// - Store notes://showNote?identifier=... in source_url
// - Extract hashtags from com.apple.notes.inlinetextattachment.hashtag
// - Parse @mentions via regex (two words or single word)
// - Create resource cards for external URLs

import matter from 'gray-matter';
import type {
  CanonicalCard,
  CanonicalConnection,
  AltoNoteFrontmatter,
  ParseError,
} from '../types';
import {
  extractHashtags,
  extractMentions,
  extractNoteLinks,
  parseTableToMarkdown,
} from './attachments';

export interface ParsedFile {
  path: string;
  content: string;
}

export interface AppleNotesParseResult {
  cards: CanonicalCard[];
  connections: CanonicalConnection[];
  errors: ParseError[];
}

/**
 * AppleNotesParser transforms alto-index Markdown exports
 * into canonical cards and connections.
 */
export class AppleNotesParser {
  private personMap = new Map<string, string>(); // name -> personCardId

  /**
   * Parse an array of Markdown files into canonical types.
   *
   * @param files - Array of {path, content} objects
   * @returns Parse result with cards, connections, and errors
   */
  parse(files: ParsedFile[]): AppleNotesParseResult {
    const cards: CanonicalCard[] = [];
    const connections: CanonicalConnection[] = [];
    const errors: ParseError[] = [];

    // Reset person dedup map for this parse session
    this.personMap.clear();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;

      try {
        const result = this.parseFile(file, i);
        cards.push(...result.cards);
        connections.push(...result.connections);
      } catch (error) {
        // Per CONTEXT.md: continue on error, log and skip problematic files
        errors.push({
          index: i,
          source_id: file.path,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { cards, connections, errors };
  }

  /**
   * Parse a single Markdown file.
   */
  private parseFile(
    file: ParsedFile,
    index: number
  ): { cards: CanonicalCard[]; connections: CanonicalConnection[] } {
    const cards: CanonicalCard[] = [];
    const connections: CanonicalConnection[] = [];

    // Parse frontmatter
    const { data, content } = matter(file.content);
    const fm = data as AltoNoteFrontmatter;

    // Validate required fields
    if (!fm.id) {
      throw new Error('Missing required field: id');
    }

    // Generate note card ID
    const noteId = crypto.randomUUID();

    // Extract title: frontmatter > first heading > first line > fallback
    const title = this.extractTitle(fm, content);

    // Extract hashtags from attachments
    const hashtags = extractHashtags(fm.attachments ?? []);

    // Main note card
    const noteCard: CanonicalCard = {
      id: noteId,
      card_type: 'note',
      name: title,
      content: content.trim(),
      summary: this.generateSummary(content),

      latitude: null,
      longitude: null,
      location_name: null,

      created_at: fm.created || new Date().toISOString(),
      modified_at: fm.modified || new Date().toISOString(),
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,

      folder: fm.folder || this.deriveFolder(file.path),
      tags: hashtags,
      status: null,

      priority: 0,
      sort_order: index,

      url: null,
      mime_type: 'text/markdown',
      is_collective: false,

      source: 'apple_notes',
      source_id: String(fm.id),
      source_url: fm.source || null,

      deleted_at: null,
    };

    cards.push(noteCard);

    // Process @mentions -> person cards + connections
    const mentions = extractMentions(content);
    for (const name of mentions) {
      const { personCard, connection } = this.createPersonConnection(noteId, name);
      if (personCard) {
        cards.push(personCard);
      }
      connections.push(connection);
    }

    // Process external URLs -> resource cards + connections
    const externalUrls = fm.links ?? [];
    for (const url of externalUrls) {
      const { resourceCard, connection } = this.createUrlResourceConnection(noteId, url);
      cards.push(resourceCard);
      connections.push(connection);
    }

    // Process internal note links -> connections (targets resolved by DedupEngine)
    const noteLinks = extractNoteLinks(fm.attachments ?? []);
    for (const targetNoteId of noteLinks) {
      connections.push({
        id: crypto.randomUUID(),
        source_id: String(fm.id), // Will be resolved by DedupEngine
        target_id: targetNoteId, // Will be resolved by DedupEngine
        via_card_id: null,
        label: 'links_to',
        weight: 0.5,
        created_at: new Date().toISOString(),
      });
    }

    // Process table attachments -> append to content
    const tables = fm.attachments?.filter(a => a.type === 'com.apple.notes.table') ?? [];
    if (tables.length > 0) {
      let tableContent = '';
      for (const table of tables) {
        if (table.content) {
          const mdTable = parseTableToMarkdown(table.content);
          if (mdTable) {
            tableContent += '\n\n' + mdTable;
          }
        }
      }
      if (tableContent) {
        noteCard.content = (noteCard.content ?? '') + tableContent;
      }
    }

    return { cards, connections };
  }

  /**
   * Extract title from frontmatter or content.
   */
  private extractTitle(fm: AltoNoteFrontmatter, content: string): string {
    // Try frontmatter title
    if (fm.title?.trim()) {
      return fm.title.trim();
    }

    // Try first heading
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch && headingMatch[1]) {
      return headingMatch[1].trim();
    }

    // Try first non-empty line
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        return trimmed.slice(0, 100);
      }
    }

    return 'Untitled Note';
  }

  /**
   * Generate a summary from content (first 200 chars).
   */
  private generateSummary(content: string): string | null {
    const text = content.replace(/^#.*$/gm, '').trim();
    if (!text) return null;
    return text.slice(0, 200);
  }

  /**
   * Derive folder from file path.
   */
  private deriveFolder(path: string): string | null {
    const parts = path.split('/');
    if (parts.length <= 1) return null;
    return parts.slice(0, -1).join('/');
  }

  /**
   * Create person card and connection for @mention.
   * Deduplicates by name within parse session.
   */
  private createPersonConnection(
    sourceNoteId: string,
    name: string
  ): { personCard: CanonicalCard | null; connection: CanonicalConnection } {
    let personId = this.personMap.get(name);
    let personCard: CanonicalCard | null = null;

    if (!personId) {
      // Create new person card
      personId = crypto.randomUUID();
      this.personMap.set(name, personId);

      personCard = {
        id: personId,
        card_type: 'person',
        name: name,
        content: null,
        summary: null,
        latitude: null,
        longitude: null,
        location_name: null,
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        due_at: null,
        completed_at: null,
        event_start: null,
        event_end: null,
        folder: null,
        tags: [],
        status: null,
        priority: 0,
        sort_order: 0,
        url: null,
        mime_type: null,
        is_collective: false,
        source: 'apple_notes',
        source_id: `mention:${name}`,
        source_url: null,
        deleted_at: null,
      };
    }

    const connection: CanonicalConnection = {
      id: crypto.randomUUID(),
      source_id: sourceNoteId,
      target_id: personId,
      via_card_id: null,
      label: 'mentions',
      weight: 0.5,
      created_at: new Date().toISOString(),
    };

    return { personCard, connection };
  }

  /**
   * Create resource card and connection for external URL.
   */
  private createUrlResourceConnection(
    sourceNoteId: string,
    url: string
  ): { resourceCard: CanonicalCard; connection: CanonicalConnection } {
    const resourceId = crypto.randomUUID();

    const resourceCard: CanonicalCard = {
      id: resourceId,
      card_type: 'resource',
      name: this.extractUrlTitle(url),
      content: null,
      summary: null,
      latitude: null,
      longitude: null,
      location_name: null,
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,
      folder: null,
      tags: [],
      status: null,
      priority: 0,
      sort_order: 0,
      url: url,
      mime_type: this.guessMimeType(url),
      is_collective: false,
      source: 'apple_notes',
      source_id: `url:${url}`,
      source_url: url,
      deleted_at: null,
    };

    const connection: CanonicalConnection = {
      id: crypto.randomUUID(),
      source_id: sourceNoteId,
      target_id: resourceId,
      via_card_id: null,
      label: 'links_to',
      weight: 0.3,
      created_at: new Date().toISOString(),
    };

    return { resourceCard, connection };
  }

  /**
   * Extract a title from URL (domain or email address).
   */
  private extractUrlTitle(url: string): string {
    try {
      if (url.startsWith('mailto:')) {
        return url.replace('mailto:', '');
      }
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return url.slice(0, 50);
    }
  }

  /**
   * Guess MIME type from URL.
   */
  private guessMimeType(url: string): string | null {
    if (url.startsWith('mailto:')) return 'text/x-email';
    if (url.endsWith('.pdf')) return 'application/pdf';
    return 'text/x-url';
  }
}
