// Isometry v5 — MarkdownExporter Tests
// Phase 09-04 ETL-14: Markdown export with YAML frontmatter

import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import type { Card, Connection } from '../../../src/database/queries/types';
import { MarkdownExporter } from '../../../src/etl/exporters/MarkdownExporter';

describe('MarkdownExporter', () => {
	const exporter = new MarkdownExporter();

	const sampleCard: Card = {
		id: 'card-001',
		card_type: 'note',
		name: 'Sample Note',
		content: 'This is the note content.\n\nWith multiple paragraphs.',
		summary: 'A sample note for testing',
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

	it('exports card with valid YAML frontmatter', () => {
		const result = exporter.export([sampleCard]);

		// Should parse without error
		const parsed = matter(result);

		// Should have frontmatter
		expect(parsed.data).toBeDefined();
		expect(parsed.data['title']).toBe('Sample Note');
	});

	it('includes ALL non-null card fields in frontmatter', () => {
		const result = exporter.export([sampleCard]);
		const parsed = matter(result);

		expect(parsed.data['title']).toBe('Sample Note');
		expect(parsed.data['created']).toBe('2024-01-01T12:00:00Z');
		expect(parsed.data['modified']).toBe('2024-01-02T15:30:00Z');
		expect(parsed.data['folder']).toBe('Projects');
		expect(parsed.data['card_type']).toBe('note');
		expect(parsed.data['source']).toBe('test');
		expect(parsed.data['source_id']).toBe('test-001');
		expect(parsed.data['status']).toBe('active');
		expect(parsed.data['priority']).toBe(5);
		expect(parsed.data['summary']).toBe('A sample note for testing');
	});

	it('exports tags as YAML array (not JSON string)', () => {
		const result = exporter.export([sampleCard]);
		const parsed = matter(result);

		// Should be array, not string
		expect(Array.isArray(parsed.data['tags'])).toBe(true);
		expect(parsed.data['tags']).toEqual(['test', 'export']);
	});

	it('round-trip: exported markdown parses back with gray-matter', () => {
		const result = exporter.export([sampleCard]);

		// Should parse without throwing
		const parsed = matter(result);

		// Parsed data should be accessible
		expect(parsed.data).toBeDefined();
		expect(parsed.content).toBeDefined();
	});

	it('round-trip: parsed data matches original card fields', () => {
		const result = exporter.export([sampleCard]);
		const parsed = matter(result);

		// Verify key fields match
		expect(parsed.data['title']).toBe(sampleCard.name);
		expect(parsed.data['created']).toBe(sampleCard.created_at);
		expect(parsed.data['modified']).toBe(sampleCard.modified_at);
		expect(parsed.data['folder']).toBe(sampleCard.folder);
		expect(parsed.data['tags']).toEqual(sampleCard.tags);
		expect(parsed.data['card_type']).toBe(sampleCard.card_type);
		expect(parsed.data['status']).toBe(sampleCard.status);
		expect(parsed.data['priority']).toBe(sampleCard.priority);

		// Content should match
		expect(parsed.content.trim()).toBe(sampleCard.content);
	});

	it('joins multiple cards with separator', () => {
		const card2: Card = {
			...sampleCard,
			id: 'card-002',
			name: 'Second Note',
			content: 'Second note content',
		};

		const result = exporter.export([sampleCard, card2]);

		// Should contain separator
		expect(result).toContain('---');

		// Should contain both cards
		expect(result).toContain('Sample Note');
		expect(result).toContain('Second Note');
	});

	it('appends connections as [[Wikilinks]] at bottom', () => {
		const connections: Connection[] = [
			{
				id: 'conn-001',
				source_id: 'card-001',
				target_id: 'card-002',
				via_card_id: null,
				label: null,
				weight: 1.0,
				created_at: '2024-01-01T12:00:00Z',
			},
			{
				id: 'conn-002',
				source_id: 'card-001',
				target_id: 'card-003',
				via_card_id: null,
				label: null,
				weight: 1.0,
				created_at: '2024-01-01T12:00:00Z',
			},
		];

		const cardNameMap = new Map([
			['card-002', 'Connected Note A'],
			['card-003', 'Connected Note B'],
		]);

		const result = exporter.export([sampleCard], connections, cardNameMap);

		// Should contain Related section
		expect(result).toContain('## Related');

		// Should contain wikilinks
		expect(result).toContain('[[Connected Note A]]');
		expect(result).toContain('[[Connected Note B]]');
	});

	it('handles special characters in title properly', () => {
		const cardWithSpecialChars: Card = {
			...sampleCard,
			name: 'Note with "quotes" and: colons',
		};

		const result = exporter.export([cardWithSpecialChars]);
		const parsed = matter(result);

		// Title should be preserved correctly
		expect(parsed.data['title']).toBe('Note with "quotes" and: colons');
	});

	it('handles empty content gracefully', () => {
		const cardWithNoContent: Card = {
			...sampleCard,
			content: null,
		};

		const result = exporter.export([cardWithNoContent]);
		const parsed = matter(result);

		// Should still have frontmatter
		expect(parsed.data['title']).toBe('Sample Note');

		// Content should be empty or just whitespace
		expect(parsed.content.trim()).toBe('');
	});
});
