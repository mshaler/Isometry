// Isometry v5 — FolderHierarchyEnricher Tests

import { describe, expect, it } from 'vitest';
import {
	folderHierarchyEnricher,
	splitFolderPath,
} from '../../../src/etl/enrichment/FolderHierarchyEnricher';
import type { CanonicalCard } from '../../../src/etl/types';

// ---------------------------------------------------------------------------
// splitFolderPath — pure function tests
// ---------------------------------------------------------------------------

describe('splitFolderPath', () => {
	it('returns all nulls for null folder', () => {
		expect(splitFolderPath(null)).toEqual([null, null, null, null]);
	});

	it('returns all nulls for empty string', () => {
		expect(splitFolderPath('')).toEqual([null, null, null, null]);
	});

	it('handles single-level folder', () => {
		expect(splitFolderPath('Work')).toEqual(['Work', null, null, null]);
	});

	it('handles two-level folder', () => {
		expect(splitFolderPath('Work/BairesDev')).toEqual(['Work', 'BairesDev', null, null]);
	});

	it('handles three-level folder', () => {
		expect(splitFolderPath('Work/BairesDev/MSFT')).toEqual(['Work', 'BairesDev', 'MSFT', null]);
	});

	it('handles four-level folder', () => {
		expect(splitFolderPath('Work/BairesDev/MSFT/Teams')).toEqual([
			'Work',
			'BairesDev',
			'MSFT',
			'Teams',
		]);
	});

	it('joins excess depth into level 4', () => {
		expect(splitFolderPath('A/B/C/D/E/F')).toEqual(['A', 'B', 'C', 'D/E/F']);
	});

	it('handles leading slash (empty first segment filtered)', () => {
		expect(splitFolderPath('/Work/BairesDev')).toEqual(['Work', 'BairesDev', null, null]);
	});

	it('handles trailing slash (empty last segment filtered)', () => {
		expect(splitFolderPath('Work/BairesDev/')).toEqual(['Work', 'BairesDev', null, null]);
	});

	it('handles consecutive slashes', () => {
		expect(splitFolderPath('Work//BairesDev')).toEqual(['Work', 'BairesDev', null, null]);
	});
});

// ---------------------------------------------------------------------------
// folderHierarchyEnricher.enrich() — integration tests
// ---------------------------------------------------------------------------

function makeCard(folder: string | null): CanonicalCard {
	return {
		id: crypto.randomUUID(),
		card_type: 'note',
		name: 'Test',
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
		folder,
		tags: [],
		status: null,
		priority: 0,
		sort_order: 0,
		url: null,
		mime_type: null,
		is_collective: false,
		source: 'test',
		source_id: 'test-1',
		source_url: null,
		deleted_at: null,
	};
}

/** Extract enriched fields from a card using bracket notation (TS strict mode). */
function getLevel(card: CanonicalCard, field: string): unknown {
	return (card as unknown as Record<string, unknown>)[field];
}

describe('folderHierarchyEnricher', () => {
	it('has correct metadata', () => {
		expect(folderHierarchyEnricher.id).toBe('folder-hierarchy');
		expect(folderHierarchyEnricher.appliesTo).toBe('*');
	});

	it('enriches cards with folder hierarchy levels', () => {
		const cards = [makeCard('Work/BairesDev/MSFT')];
		folderHierarchyEnricher.enrich(cards);

		expect(getLevel(cards[0]!, 'folder_l1')).toBe('Work');
		expect(getLevel(cards[0]!, 'folder_l2')).toBe('BairesDev');
		expect(getLevel(cards[0]!, 'folder_l3')).toBe('MSFT');
		expect(getLevel(cards[0]!, 'folder_l4')).toBeNull();
	});

	it('sets all levels to null for null folder', () => {
		const cards = [makeCard(null)];
		folderHierarchyEnricher.enrich(cards);

		expect(getLevel(cards[0]!, 'folder_l1')).toBeNull();
		expect(getLevel(cards[0]!, 'folder_l2')).toBeNull();
		expect(getLevel(cards[0]!, 'folder_l3')).toBeNull();
		expect(getLevel(cards[0]!, 'folder_l4')).toBeNull();
	});

	it('is idempotent — running twice produces same result', () => {
		const cards = [makeCard('A/B/C')];
		folderHierarchyEnricher.enrich(cards);
		folderHierarchyEnricher.enrich(cards);

		expect(getLevel(cards[0]!, 'folder_l1')).toBe('A');
		expect(getLevel(cards[0]!, 'folder_l2')).toBe('B');
		expect(getLevel(cards[0]!, 'folder_l3')).toBe('C');
		expect(getLevel(cards[0]!, 'folder_l4')).toBeNull();
	});

	it('handles batch of mixed cards', () => {
		const cards = [makeCard('X/Y'), makeCard(null), makeCard('A/B/C/D/E')];
		folderHierarchyEnricher.enrich(cards);

		expect(getLevel(cards[0]!, 'folder_l1')).toBe('X');
		expect(getLevel(cards[0]!, 'folder_l2')).toBe('Y');

		expect(getLevel(cards[1]!, 'folder_l1')).toBeNull();

		expect(getLevel(cards[2]!, 'folder_l1')).toBe('A');
		expect(getLevel(cards[2]!, 'folder_l4')).toBe('D/E');
	});
});
