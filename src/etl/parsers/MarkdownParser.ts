// Isometry v5 — Phase 9 MarkdownParser
// Parses Markdown files with YAML frontmatter (Obsidian/generic format).
//
// Features:
// - gray-matter for YAML frontmatter extraction
// - Title cascade: frontmatter > first heading > filename
// - Tags from frontmatter array, comma-string, or #hashtags
// - Folder derived from file path
// - [[Wikilinks]] create connections

import matter from 'gray-matter';
import type { CanonicalCard, CanonicalConnection, ParseError } from '../types';

export interface ParsedFile {
	path: string;
	content: string;
}

export interface MarkdownParseOptions {
	/** Default timestamp for notes without frontmatter dates */
	defaultTimestamp?: string;
}

export interface MarkdownParseResult {
	cards: CanonicalCard[];
	connections: CanonicalConnection[];
	errors: ParseError[];
}

/**
 * MarkdownParser transforms Markdown files with YAML frontmatter
 * into canonical cards and connections.
 *
 * Supports Obsidian vault exports and generic Markdown with frontmatter.
 */
export class MarkdownParser {
	/**
	 * Parse an array of Markdown files into canonical types.
	 *
	 * @param files - Array of {path, content} objects
	 * @param options - Optional parsing configuration
	 * @returns Parse result with cards, connections, and errors
	 */
	parse(files: ParsedFile[], options?: MarkdownParseOptions): MarkdownParseResult {
		const cards: CanonicalCard[] = [];
		const connections: CanonicalConnection[] = [];
		const errors: ParseError[] = [];

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			if (!file) continue;

			try {
				const result = this.parseFile(file, i, options);
				cards.push(...result.cards);
				connections.push(...result.connections);
			} catch (error) {
				// Per plan: continue on error, log and skip problematic files
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
		index: number,
		options?: MarkdownParseOptions,
	): { cards: CanonicalCard[]; connections: CanonicalConnection[] } {
		const cards: CanonicalCard[] = [];
		const connections: CanonicalConnection[] = [];

		// Parse frontmatter
		const { data, content } = matter(file.content);

		// Generate card ID
		const cardId = crypto.randomUUID();

		// Extract title using cascade
		const title = this.extractTitle(data, content, file.path);

		// Extract tags
		const tags = this.extractTags(data, content);

		// Extract folder from path
		const folder = this.extractFolder(file.path);

		// Determine timestamps
		const defaultTime = options?.defaultTimestamp || new Date().toISOString();
		const createdAt = this.extractTimestamp(data, 'created', defaultTime);
		const modifiedAt = this.extractTimestamp(data, 'modified', defaultTime);

		// Create main card
		const card: CanonicalCard = {
			id: cardId,
			card_type: 'note',
			name: title,
			content: content.trim() || null,
			summary: this.generateSummary(content),

			latitude: null,
			longitude: null,
			location_name: null,

			created_at: createdAt,
			modified_at: modifiedAt,
			due_at: null,
			completed_at: null,
			event_start: null,
			event_end: null,

			folder: folder,
			tags: tags,
			status: null,

			priority: 0,
			sort_order: index,

			url: null,
			mime_type: 'text/markdown',
			is_collective: false,

			source: 'markdown',
			source_id: file.path,
			source_url: null,

			deleted_at: null,
		};

		cards.push(card);

		// Extract wikilinks and create connections
		const wikilinks = this.extractWikilinks(content);
		for (const target of wikilinks) {
			connections.push({
				id: crypto.randomUUID(),
				source_id: file.path, // Will be resolved by DedupEngine
				target_id: target, // Will be resolved by DedupEngine
				via_card_id: null,
				label: 'links_to',
				weight: 0.5,
				created_at: new Date().toISOString(),
			});
		}

		return { cards, connections };
	}

	/**
	 * Extract title using cascade: frontmatter > first heading > filename.
	 */
	private extractTitle(data: Record<string, unknown>, content: string, path: string): string {
		// Try frontmatter title
		if (typeof data['title'] === 'string' && (data['title'] as string).trim()) {
			return (data['title'] as string).trim();
		}

		// Try first heading
		const headingMatch = content.match(/^#\s+(.+)$/m);
		if (headingMatch?.[1]) {
			return headingMatch[1].trim();
		}

		// Fallback to filename (without extension)
		const filename = path.split('/').pop() || 'Untitled';
		return filename.replace(/\.md$/i, '');
	}

	/**
	 * Extract tags from frontmatter array, comma-string, or #hashtags in content.
	 */
	private extractTags(data: Record<string, unknown>, content: string): string[] {
		const tags = new Set<string>();

		// Try frontmatter tags
		if (Array.isArray(data['tags'])) {
			for (const tag of data['tags'] as unknown[]) {
				if (typeof tag === 'string') {
					tags.add(tag.trim());
				}
			}
		} else if (typeof data['tags'] === 'string') {
			// Comma-separated string - handle quoted values
			// Simple parser: split by comma, then remove quotes
			const parts = (data['tags'] as string).split(',');
			for (const part of parts) {
				const trimmed = part.trim();
				// Remove surrounding quotes if present
				const unquoted = trimmed.replace(/^["'](.*)["']$/, '$1');
				if (unquoted) {
					tags.add(unquoted);
				}
			}
		}

		// If no frontmatter tags, scan for #hashtags
		if (tags.size === 0) {
			const hashtagMatches = Array.from(content.matchAll(/#([\w-]+)/g));
			for (const match of hashtagMatches) {
				if (match[1]) {
					tags.add(match[1]);
				}
			}
		}

		return Array.from(tags);
	}

	/**
	 * Extract folder from file path (all directories except filename).
	 */
	private extractFolder(path: string): string | null {
		const parts = path.split('/');
		if (parts.length <= 1) return null;

		// Remove filename, join rest
		const folder = parts.slice(0, -1).join('/');
		return folder || null;
	}

	/**
	 * Extract timestamp from frontmatter with fallback.
	 */
	private extractTimestamp(data: Record<string, unknown>, field: string, defaultValue: string): string {
		// Try explicit field as string
		if (typeof data[field] === 'string') {
			return data[field];
		}

		// gray-matter might parse dates as Date objects
		if (data[field] instanceof Date) {
			return this.normalizeISOString((data[field] as Date).toISOString());
		}

		// Try common date field
		if (field === 'created') {
			if (typeof data['date'] === 'string') {
				return data['date'] as string;
			}
			if (data['date'] instanceof Date) {
				return this.normalizeISOString((data['date'] as Date).toISOString());
			}
		}

		return defaultValue;
	}

	/**
	 * Normalize ISO string to remove milliseconds if they're .000
	 */
	private normalizeISOString(isoString: string): string {
		return isoString.replace(/\.000Z$/, 'Z');
	}

	/**
	 * Generate summary from content (first 200 chars, no headings).
	 */
	private generateSummary(content: string): string | null {
		const text = content.replace(/^#.*$/gm, '').trim();
		if (!text) return null;
		return text.slice(0, 200);
	}

	/**
	 * Extract [[wikilinks]] from content.
	 */
	private extractWikilinks(content: string): string[] {
		const wikilinks: string[] = [];
		const matches = Array.from(content.matchAll(/\[\[([^\]]+)\]\]/g));

		for (const match of matches) {
			if (match[1]) {
				wikilinks.push(match[1].trim());
			}
		}

		return wikilinks;
	}
}
