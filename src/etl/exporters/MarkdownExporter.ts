// Isometry v5 — MarkdownExporter
// Phase 09-04 ETL-14: Export cards to Markdown with YAML frontmatter
//
// Purpose: Enable round-trip export (can be re-imported via MarkdownParser)
// Format: gray-matter YAML frontmatter + Markdown body + [[Wikilinks]]

import matter from 'gray-matter';
import type { Card, Connection } from '../../database/queries/types';

/**
 * Exports cards to Markdown format with YAML frontmatter.
 *
 * Features:
 * - YAML frontmatter includes ALL non-null card fields
 * - Tags exported as YAML array (not JSON string)
 * - Round-trip compatible (can be parsed back with gray-matter)
 * - Connections appended as [[Wikilinks]] in Related section
 * - Multiple cards joined with --- separator
 *
 * Requirements: ETL-14 (Markdown export)
 */
export class MarkdownExporter {
	/**
	 * Export cards to Markdown format with YAML frontmatter.
	 *
	 * @param cards Cards to export
	 * @param connections Optional connections for wikilink generation
	 * @param cardNameMap Map of card ID to name for wikilink resolution
	 * @returns Markdown string with YAML frontmatter
	 */
	export(cards: Card[], connections?: Connection[], cardNameMap?: Map<string, string>): string {
		const files: string[] = [];

		for (const card of cards) {
			// Build frontmatter with ALL non-null fields
			const frontmatter: Record<string, any> = {};

			// Required fields (always present)
			frontmatter['title'] = card.name;
			frontmatter['card_type'] = card.card_type;
			frontmatter['created'] = card.created_at;
			frontmatter['modified'] = card.modified_at;
			frontmatter['priority'] = card.priority;

			// Optional fields (only if non-null/non-empty)
			if (card.summary) frontmatter['summary'] = card.summary;
			if (card.folder) frontmatter['folder'] = card.folder;
			if (card.tags && card.tags.length > 0) frontmatter['tags'] = card.tags;
			if (card.status) frontmatter['status'] = card.status;
			if (card.source) frontmatter['source'] = card.source;
			if (card.source_id) frontmatter['source_id'] = card.source_id;
			if (card.source_url) frontmatter['source_url'] = card.source_url;
			if (card.url) frontmatter['url'] = card.url;
			if (card.mime_type) frontmatter['mime_type'] = card.mime_type;
			if (card.due_at) frontmatter['due_at'] = card.due_at;
			if (card.completed_at) frontmatter['completed_at'] = card.completed_at;
			if (card.event_start) frontmatter['event_start'] = card.event_start;
			if (card.event_end) frontmatter['event_end'] = card.event_end;
			if (card.latitude !== null) frontmatter['latitude'] = card.latitude;
			if (card.longitude !== null) frontmatter['longitude'] = card.longitude;
			if (card.location_name) frontmatter['location_name'] = card.location_name;
			if (card.is_collective) frontmatter['is_collective'] = card.is_collective;
			if (card.sort_order !== 0) frontmatter['sort_order'] = card.sort_order;

			// Build content with wikilinks
			let content = card.content ?? '';

			// Append connections as wikilinks if provided
			if (connections && cardNameMap) {
				const cardConnections = connections.filter((c) => c.source_id === card.id);
				if (cardConnections.length > 0) {
					const links = cardConnections
						.map((c) => cardNameMap.get(c.target_id))
						.filter((name): name is string => Boolean(name))
						.map((name) => `[[${name}]]`);

					if (links.length > 0) {
						content += '\n\n## Related\n\n' + links.join('\n');
					}
				}
			}

			// Generate markdown file with YAML frontmatter
			const file = matter.stringify(content, frontmatter);
			files.push(file);
		}

		// Join multiple files with separator
		return files.join('\n\n---\n\n');
	}
}
