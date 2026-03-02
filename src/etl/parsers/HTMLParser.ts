// Isometry v5 — Phase 9 HTML Parser
// Parses HTML web clippings into canonical cards with XSS prevention.
//
// Per CONTEXT.md locked decisions:
// - Regex-based stripping (Worker-safe, no DOM dependencies)
// - Script/style tags stripped before content extraction
// - Metadata extracted from OpenGraph and article meta tags
// - HTML converted to Markdown (not plain text)
// - Source URL from canonical link or og:url

import type {
  CanonicalCard,
  CanonicalConnection,
  ParseError,
} from '../types';

export interface HTMLParseOptions {
  preserveScripts?: boolean; // Debug only - never use in production
}

export interface HTMLParseResult {
  cards: CanonicalCard[];
  connections: CanonicalConnection[];
  errors: ParseError[];
}

/**
 * HTMLParser transforms HTML web clippings into canonical cards.
 * Uses regex-based parsing for Worker compatibility (no DOM required).
 */
export class HTMLParser {
  private personMap = new Map<string, string>(); // name -> personCardId

  /**
   * Parse an array of HTML strings into canonical types.
   *
   * @param htmlStrings - Array of HTML content
   * @param options - Parse options
   * @returns Parse result with cards, connections, and errors
   */
  parse(htmlStrings: string[], options?: HTMLParseOptions): HTMLParseResult {
    const cards: CanonicalCard[] = [];
    const connections: CanonicalConnection[] = [];
    const errors: ParseError[] = [];

    // Reset person dedup map for this parse session
    this.personMap.clear();

    for (let i = 0; i < htmlStrings.length; i++) {
      const html = htmlStrings[i];
      if (!html) continue;

      try {
        const result = this.parseHtml(html, i, options);
        cards.push(...result.cards);
        connections.push(...result.connections);
      } catch (error) {
        errors.push({
          index: i,
          source_id: null,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { cards, connections, errors };
  }

  /**
   * Parse a single HTML string.
   */
  private parseHtml(
    html: string,
    index: number,
    options?: HTMLParseOptions
  ): { cards: CanonicalCard[]; connections: CanonicalConnection[] } {
    const cards: CanonicalCard[] = [];
    const connections: CanonicalConnection[] = [];

    // Strip scripts and styles FIRST (XSS prevention - P29)
    const cleaned = options?.preserveScripts ? html : this.stripScripts(html);

    // Extract metadata
    const ogTitle = this.extractMeta(cleaned, 'og:title');
    const titleTag = this.extractTitle(cleaned);
    const title = this.chooseBestTitle(titleTag, ogTitle);

    const createdAt = this.extractMeta(cleaned, 'article:published_time') ?? new Date().toISOString();
    const sourceUrl = this.extractMeta(cleaned, 'og:url') ?? this.extractCanonical(cleaned);
    const author = this.extractAuthor(cleaned);

    // Generate note card ID
    const noteId = crypto.randomUUID();

    // Main note card (content will be added in Task 2)
    const noteCard: CanonicalCard = {
      id: noteId,
      card_type: 'note',
      name: title,
      content: cleaned, // Temporary - will be converted to Markdown in Task 2
      summary: cleaned.slice(0, 200),

      latitude: null,
      longitude: null,
      location_name: null,

      created_at: createdAt,
      modified_at: new Date().toISOString(),
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,

      folder: null,
      tags: [],
      status: null,

      priority: 0,
      sort_order: index,

      url: null,
      mime_type: 'text/html',
      is_collective: false,

      source: 'html',
      source_id: sourceUrl ?? noteId,
      source_url: sourceUrl,

      deleted_at: null,
    };

    cards.push(noteCard);

    // Create person card for author
    if (author) {
      const { personCard, connection } = this.createPersonConnection(noteId, author);
      if (personCard) {
        cards.push(personCard);
      }
      connections.push(connection);
    }

    return { cards, connections };
  }

  /**
   * Strip script and style tags, plus inline event handlers.
   */
  private stripScripts(html: string): string {
    return html
      // Remove script tags and content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove style tags and content
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // Remove inline event handlers
      .replace(/\s+on\w+="[^"]*"/gi, '')
      .replace(/\s+on\w+='[^']*'/gi, '')
      .replace(/\s+on\w+=\w+/gi, ''); // onclick=handler without quotes
  }

  /**
   * Extract title from <title> tag.
   */
  private extractTitle(html: string): string {
    // Try <title> tag
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch?.[1]?.trim()) {
      return this.decodeEntities(titleMatch[1].trim());
    }

    // Fallback to <h1>
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (h1Match?.[1]?.trim()) {
      return this.decodeEntities(h1Match[1].replace(/<[^>]+>/g, '').trim());
    }

    // Fallback to first substantial text
    const textMatch = html.match(/<p[^>]*>(.*?)<\/p>/i);
    if (textMatch?.[1]) {
      const text = this.decodeEntities(textMatch[1].replace(/<[^>]+>/g, '').trim());
      if (text.length > 0) {
        return text.slice(0, 100);
      }
    }

    return 'Untitled';
  }

  /**
   * Choose the best title from <title> and og:title.
   * Prefer og:title if <title> is generic.
   */
  private chooseBestTitle(titleTag: string, ogTitle: string | null): string {
    // Generic titles that should use og:title instead
    const genericTitles = ['page', 'untitled', 'document', 'home'];

    if (ogTitle && genericTitles.some(g => titleTag.toLowerCase().includes(g))) {
      return ogTitle;
    }

    return titleTag;
  }

  /**
   * Extract meta tag content by property name.
   */
  private extractMeta(html: string, property: string): string | null {
    // Try property="..." format (OpenGraph)
    const propMatch = html.match(
      new RegExp(`<meta\\s+property=["']${property}["']\\s+content=["']([^"']+)["']`, 'i')
    );
    if (propMatch?.[1]) return propMatch[1];

    // Try name="..." format
    const nameMatch = html.match(
      new RegExp(`<meta\\s+name=["']${property}["']\\s+content=["']([^"']+)["']`, 'i')
    );
    return nameMatch?.[1] ?? null;
  }

  /**
   * Extract canonical URL from <link rel="canonical">.
   */
  private extractCanonical(html: string): string | null {
    const match = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
    return match?.[1] ?? null;
  }

  /**
   * Extract author from meta tags or byline.
   */
  private extractAuthor(html: string): string | null {
    // Try meta tags
    const metaAuthor = this.extractMeta(html, 'article:author') ?? this.extractMeta(html, 'author');
    if (metaAuthor) return metaAuthor;

    // Try common byline patterns
    const bylineMatch = html.match(/<[^>]*class=["'][^"']*(?:author|byline)[^"']*["'][^>]*>(.*?)<\/[^>]+>/i);
    if (bylineMatch?.[1]) {
      return bylineMatch[1].replace(/<[^>]+>/g, '').replace(/^By\s+/i, '').trim();
    }

    return null;
  }

  /**
   * Decode HTML entities.
   */
  private decodeEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  /**
   * Create person card and connection for author.
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
        source: 'html',
        source_id: `author:${name}`,
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
}
