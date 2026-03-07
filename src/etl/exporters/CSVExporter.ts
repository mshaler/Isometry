// Isometry v5 — CSVExporter
// Phase 09-04 ETL-16: Export cards to CSV via PapaParse
//
// Purpose: Excel-compatible export for spreadsheet analysis
// Format: RFC 4180 compliant CSV with Windows line endings

import Papa from 'papaparse';
import type { Card } from '../../database/queries/types';

/**
 * Exports cards to CSV format via PapaParse.
 *
 * Features:
 * - RFC 4180 compliant (proper quoting and escaping)
 * - All card columns included
 * - Tags as semicolon-separated string
 * - Windows line endings (\r\n) for Excel compatibility
 * - Header row always included
 *
 * Requirements: ETL-16 (CSV export)
 */
export class CSVExporter {
	/**
	 * Export cards to CSV format.
	 *
	 * @param cards Cards to export
	 * @returns CSV string with header row
	 */
	export(cards: Card[]): string {
		// Convert cards to plain objects suitable for CSV
		const rows = cards.map((card) => ({
			id: card.id,
			card_type: card.card_type,
			name: card.name,
			content: card.content ?? '',
			summary: card.summary ?? '',
			latitude: card.latitude ?? '',
			longitude: card.longitude ?? '',
			location_name: card.location_name ?? '',
			created_at: card.created_at,
			modified_at: card.modified_at,
			due_at: card.due_at ?? '',
			completed_at: card.completed_at ?? '',
			event_start: card.event_start ?? '',
			event_end: card.event_end ?? '',
			folder: card.folder ?? '',
			tags: card.tags ? card.tags.join(';') : '', // Semicolon-separated
			status: card.status ?? '',
			priority: card.priority,
			sort_order: card.sort_order,
			url: card.url ?? '',
			mime_type: card.mime_type ?? '',
			is_collective: card.is_collective ? '1' : '0',
			source: card.source ?? '',
			source_id: card.source_id ?? '',
			source_url: card.source_url ?? '',
			deleted_at: card.deleted_at ?? '',
		}));

		return Papa.unparse(rows, {
			quotes: true, // Always quote fields
			quoteChar: '"',
			escapeChar: '"', // RFC 4180 double-quote escaping
			delimiter: ',',
			header: true,
			newline: '\r\n', // Windows line endings for Excel
		});
	}
}
