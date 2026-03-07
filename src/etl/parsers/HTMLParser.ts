// Isometry v5 — Phase 9 HTML Parser
// Parses HTML web clippings into canonical cards with XSS prevention.
//
// Per CONTEXT.md locked decisions:
// - Regex-based stripping (Worker-safe, no DOM dependencies)
// - Script/style tags stripped before content extraction
// - Metadata extracted from OpenGraph and article meta tags
// - HTML converted to Markdown (not plain text)
// - Source URL from canonical link or og:url

import type { CanonicalCard, CanonicalConnection, ParseError } from '../types';

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
		options?: HTMLParseOptions,
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

		// Convert HTML to Markdown
		const markdown = this.htmlToMarkdown(cleaned);

		// Main note card
		const noteCard: CanonicalCard = {
			id: noteId,
			card_type: 'note',
			name: title,
			content: markdown,
			summary: markdown.slice(0, 200),

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

		// Extract iframe embeds as resource cards
		const iframes = this.extractIframes(cleaned);
		for (const iframe of iframes) {
			const resourceId = crypto.randomUUID();
			const resourceCard: CanonicalCard = {
				id: resourceId,
				card_type: 'resource',
				name: iframe.title || 'Embedded Content',
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
				url: iframe.src,
				mime_type: 'text/html',
				is_collective: false,
				source: 'html',
				source_id: iframe.src,
				source_url: iframe.src,
				deleted_at: null,
			};
			cards.push(resourceCard);

			connections.push({
				id: crypto.randomUUID(),
				source_id: noteId,
				target_id: resourceId,
				via_card_id: null,
				label: 'embeds',
				weight: 0.3,
				created_at: new Date().toISOString(),
			});
		}

		return { cards, connections };
	}

	/**
	 * Strip script and style tags, plus inline event handlers.
	 */
	private stripScripts(html: string): string {
		return (
			html
				// Remove script tags and content
				.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
				// Remove style tags and content
				.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
				// Remove inline event handlers
				.replace(/\s+on\w+="[^"]*"/gi, '')
				.replace(/\s+on\w+='[^']*'/gi, '')
				.replace(/\s+on\w+=\w+/gi, '')
		); // onclick=handler without quotes
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

		if (ogTitle && genericTitles.some((g) => titleTag.toLowerCase().includes(g))) {
			return ogTitle;
		}

		return titleTag;
	}

	/**
	 * Extract meta tag content by property name.
	 */
	private extractMeta(html: string, property: string): string | null {
		// Try property="..." format (OpenGraph)
		const propMatch = html.match(new RegExp(`<meta\\s+property=["']${property}["']\\s+content=["']([^"']+)["']`, 'i'));
		if (propMatch?.[1]) return propMatch[1];

		// Try name="..." format
		const nameMatch = html.match(new RegExp(`<meta\\s+name=["']${property}["']\\s+content=["']([^"']+)["']`, 'i'));
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
			return bylineMatch[1]
				.replace(/<[^>]+>/g, '')
				.replace(/^By\s+/i, '')
				.trim();
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
	 * Convert HTML to Markdown using regex-based transformation.
	 * Handles common HTML elements while remaining Worker-safe.
	 */
	private htmlToMarkdown(html: string): string {
		let md = html;

		// Code blocks (must be before inline code)
		md = md.replace(
			/<pre[^>]*><code[^>]*class=["']language-(\w+)["'][^>]*>([\s\S]*?)<\/code><\/pre>/gi,
			'```$1\n$2\n```\n',
		);
		md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n');

		// Tables (before other conversions to avoid interference)
		md = this.convertTablesToMarkdown(md);

		// Headings (h1-h6)
		md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
		md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
		md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
		md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
		md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
		md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');

		// Bold and Italic
		md = md.replace(/<(strong|b)[^>]*>(.*?)<\/\1>/gi, '**$2**');
		md = md.replace(/<(em|i)[^>]*>(.*?)<\/\1>/gi, '*$2*');

		// Links (multiple patterns for different attribute orders)
		md = md.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');

		// Images (multiple patterns for src/alt ordering)
		md = md.replace(/<img\s+[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*?)["'][^>]*\/?>/gi, '![$2]($1)');
		md = md.replace(/<img\s+[^>]*alt=["']([^"']*?)["'][^>]*src=["']([^"']+)["'][^>]*\/?>/gi, '![$1]($2)');
		md = md.replace(/<img\s+[^>]*src=["']([^"']+)["'][^>]*\/?>/gi, '![]($1)');

		// Inline code
		md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

		// Lists
		md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
		md = md.replace(/<\/?[uo]l[^>]*>/gi, '\n');

		// Blockquotes
		md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content: string) => {
			return (
				content
					.split('\n')
					.map((line: string) => line.trim())
					.filter(Boolean)
					.map((line: string) => `> ${line}`)
					.join('\n') + '\n'
			);
		});

		// Horizontal rules
		md = md.replace(/<hr\s*\/?>/gi, '\n---\n');

		// Paragraphs and line breaks
		md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
		md = md.replace(/<br\s*\/?>/gi, '\n');

		// Strip remaining tags
		md = md.replace(/<[^>]+>/g, '');

		// Decode HTML entities
		md = this.decodeEntities(md);

		// Clean up excessive whitespace
		md = md.replace(/\n{3,}/g, '\n\n').trim();

		return md;
	}

	/**
	 * Convert HTML tables to GFM (GitHub Flavored Markdown) table format.
	 */
	private convertTablesToMarkdown(html: string): string {
		return html.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableContent: string) => {
			const rows: string[][] = [];
			const rowMatches = tableContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);

			for (const match of rowMatches) {
				const cells = [...match[1]!.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((m) =>
					m[1]!.replace(/<[^>]+>/g, '').trim(),
				);
				if (cells.length) rows.push(cells);
			}

			if (rows.length === 0) return '';

			const header = '| ' + rows[0]!.join(' | ') + ' |';
			const separator = '| ' + rows[0]!.map(() => '---').join(' | ') + ' |';
			const body = rows
				.slice(1)
				.map((row) => '| ' + row.join(' | ') + ' |')
				.join('\n');

			return `\n${header}\n${separator}\n${body ? '\n' + body : ''}\n`;
		});
	}

	/**
	 * Extract iframe embeds from HTML.
	 */
	private extractIframes(html: string): Array<{ src: string; title: string }> {
		const iframes: Array<{ src: string; title: string }> = [];
		const matches = html.matchAll(/<iframe[^>]*>/gi);

		for (const match of matches) {
			const tag = match[0];
			const srcMatch = tag.match(/src=["']([^"']+)["']/i);
			const titleMatch = tag.match(/title=["']([^"']+)["']/i);

			if (srcMatch?.[1]) {
				iframes.push({
					src: srcMatch[1],
					title: titleMatch?.[1] || '',
				});
			}
		}

		return iframes;
	}

	/**
	 * Create person card and connection for author.
	 * Deduplicates by name within parse session.
	 */
	private createPersonConnection(
		sourceNoteId: string,
		name: string,
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
