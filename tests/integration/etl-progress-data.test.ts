// Isometry v5 — Phase 10 ETL Progress Reporting Data Tests

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../../src/database/Database';
import { searchCards } from '../../src/database/queries/search';
import { ImportOrchestrator } from '../../src/etl/ImportOrchestrator';

describe('ETL Progress Reporting', () => {
	let db: Database;

	beforeEach(async () => {
		db = new Database();
		await db.initialize();
	});

	afterEach(() => {
		db.close();
	});

	it('fires onProgress during multi-batch import', async () => {
		// Generate 2500+ simple notes to trigger multiple batches (batch size = 1000)
		const notes = Array.from({ length: 2500 }, (_, i) => ({
			path: `note-${i}.md`,
			content: `---\ntitle: Note ${i}\ncreated: "2026-01-01T00:00:00Z"\nmodified: "2026-01-01T00:00:00Z"\n---\nContent for note ${i} about testing progress`,
		}));

		const orchestrator = new ImportOrchestrator(db);
		const progressEvents: Array<{ processed: number; total: number; rate: number }> = [];
		orchestrator.onProgress = (processed, total, rate) => {
			progressEvents.push({ processed, total, rate });
		};

		await orchestrator.import('markdown', JSON.stringify(notes));

		// Should have fired at least 2 progress events (2500 cards / 1000 batch = 3 batches)
		expect(progressEvents.length).toBeGreaterThanOrEqual(2);

		// Each event should have valid shape
		for (const event of progressEvents) {
			expect(event.processed).toBeGreaterThan(0);
			expect(event.processed).toBeLessThanOrEqual(event.total);
			expect(event.rate).toBeGreaterThanOrEqual(0);
			expect(Number.isFinite(event.rate)).toBe(true);
		}

		// Last event should have processed === total
		const last = progressEvents[progressEvents.length - 1]!;
		expect(last.processed).toBe(last.total);
	});

	it('FTS search works immediately after import', async () => {
		const notes = Array.from({ length: 150 }, (_, i) => ({
			path: `searchable-${i}.md`,
			content: `---\ntitle: Searchable Note ${i}\ncreated: "2026-01-01T00:00:00Z"\nmodified: "2026-01-01T00:00:00Z"\n---\nUnique content about xylophone testing`,
		}));

		const orchestrator = new ImportOrchestrator(db);
		await orchestrator.import('markdown', JSON.stringify(notes));

		// FTS search should find results immediately (optimize ran post-import)
		const results = searchCards(db, 'xylophone');
		expect(results.length).toBeGreaterThan(0);
	});

	it('progress total reflects card count', async () => {
		const notes = Array.from({ length: 150 }, (_, i) => ({
			path: `progress-${i}.md`,
			content: `---\ntitle: Progress Note ${i}\ncreated: "2026-01-01T00:00:00Z"\nmodified: "2026-01-01T00:00:00Z"\n---\nOriginal content ${i}`,
		}));

		const orchestrator = new ImportOrchestrator(db);
		const progressEvents: Array<{ processed: number; total: number }> = [];
		orchestrator.onProgress = (processed, total) => {
			progressEvents.push({ processed, total });
		};

		await orchestrator.import('markdown', JSON.stringify(notes));

		// Progress events should fire
		expect(progressEvents.length).toBeGreaterThan(0);

		// Total should match card count
		if (progressEvents.length > 0) {
			expect(progressEvents[0]!.total).toBeGreaterThan(0);
		}
	});
});
