// Isometry v5 — JSONExporter Tests
// Phase 09-04 ETL-15: JSON export with pretty printing

import { describe, expect, it } from 'vitest';
import type { Card, Connection } from '../../../src/database/queries/types';
import { JSONExporter } from '../../../src/etl/exporters/JSONExporter';

describe('JSONExporter', () => {
	const exporter = new JSONExporter();

	const sampleCard: Card = {
		id: 'card-001',
		card_type: 'note',
		name: 'Sample Note',
		content: 'This is the note content.',
		summary: 'A sample note',
		latitude: null,
		longitude: null,
		location_name: null,
		created_at: '2024-01-01T12:00:00Z',
		modified_at: '2024-01-02T15:30:00Z',
		due_at: null,
		completed_at: null,
		event_start: null,
		event_end: null,
		folder: 'Projects',
		tags: ['test', 'export'],
		status: 'active',
		priority: 5,
		sort_order: 0,
		url: null,
		mime_type: null,
		is_collective: false,
		source: 'test',
		source_id: 'test-001',
		source_url: null,
		deleted_at: null,
	};

	const sampleConnection: Connection = {
		id: 'conn-001',
		source_id: 'card-001',
		target_id: 'card-002',
		via_card_id: null,
		label: null,
		weight: 1.0,
		created_at: '2024-01-01T12:00:00Z',
	};

	it('exports cards as JSON array', () => {
		const result = exporter.export([sampleCard]);
		const parsed = JSON.parse(result);

		// Should have cards array
		expect(Array.isArray(parsed.cards)).toBe(true);
		expect(parsed.cards.length).toBe(1);
	});

	it('pretty-prints with 2-space indentation', () => {
		const result = exporter.export([sampleCard]);

		// Should contain indentation
		expect(result).toContain('  "cards"');
		expect(result).toContain('    "id"');

		// Should parse without error
		const parsed = JSON.parse(result);
		expect(parsed).toBeDefined();
	});

	it('parses tags from array to array (no JSON stringification)', () => {
		const result = exporter.export([sampleCard]);
		const parsed = JSON.parse(result);

		// Tags should be array in exported JSON
		expect(Array.isArray(parsed.cards[0].tags)).toBe(true);
		expect(parsed.cards[0].tags).toEqual(['test', 'export']);
	});

	it('includes all card columns', () => {
		const result = exporter.export([sampleCard]);
		const parsed = JSON.parse(result);

		const card = parsed.cards[0];

		// Verify key columns are present
		expect(card.id).toBe('card-001');
		expect(card.name).toBe('Sample Note');
		expect(card.card_type).toBe('note');
		expect(card.content).toBe('This is the note content.');
		expect(card.folder).toBe('Projects');
		expect(card.status).toBe('active');
		expect(card.priority).toBe(5);
		expect(card.source).toBe('test');
		expect(card.source_id).toBe('test-001');
		expect(card.created_at).toBe('2024-01-01T12:00:00Z');
		expect(card.modified_at).toBe('2024-01-02T15:30:00Z');
	});

	it('includes connections as separate array', () => {
		const result = exporter.export([sampleCard], [sampleConnection]);
		const parsed = JSON.parse(result);

		// Should have connections array
		expect(Array.isArray(parsed.connections)).toBe(true);
		expect(parsed.connections.length).toBe(1);

		// Verify connection data
		expect(parsed.connections[0].id).toBe('conn-001');
		expect(parsed.connections[0].source_id).toBe('card-001');
		expect(parsed.connections[0].target_id).toBe('card-002');
	});

	it('returns valid JSON for empty cards array', () => {
		const result = exporter.export([]);
		const parsed = JSON.parse(result);

		// Should have empty arrays
		expect(parsed.cards).toEqual([]);
		expect(parsed.connections).toEqual([]);
	});
});
