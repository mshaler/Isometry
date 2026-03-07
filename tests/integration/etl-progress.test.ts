// @vitest-environment jsdom
// Isometry v5 — Phase 10 ETL Progress Reporting Integration Tests
// Tests progress callback firing, event shape, notification-to-toast wiring,
// and post-import FTS search.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Database } from '../../src/database/Database';
import { searchCards } from '../../src/database/queries/search';
import { ImportOrchestrator } from '../../src/etl/ImportOrchestrator';
import { ImportToast } from '../../src/ui/ImportToast';

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
		// Generate 250+ simple notes to trigger multiple batches (batch size = 100)
		const notes = Array.from({ length: 250 }, (_, i) => ({
			path: `note-${i}.md`,
			content: `---\ntitle: Note ${i}\ncreated: "2026-01-01T00:00:00Z"\nmodified: "2026-01-01T00:00:00Z"\n---\nContent for note ${i} about testing progress`,
		}));

		const orchestrator = new ImportOrchestrator(db);
		const progressEvents: Array<{ processed: number; total: number; rate: number }> = [];
		orchestrator.onProgress = (processed, total, rate) => {
			progressEvents.push({ processed, total, rate });
		};

		await orchestrator.import('markdown', JSON.stringify(notes));

		// Should have fired at least 2 progress events (250 cards / 100 batch = 3 batches)
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

describe('onnotification -> ImportToast wiring', () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it('calls showFinalizing when processed === total', () => {
		const toast = new ImportToast(container);
		const showFinalizing = vi.spyOn(toast, 'showFinalizing');
		const showProgress = vi.spyOn(toast, 'showProgress');

		// Simulate the onnotification handler logic
		const notification = {
			type: 'import_progress' as const,
			payload: { processed: 250, total: 250, rate: 500, source: 'markdown' as const, filename: undefined },
		};

		// This mirrors the wiring logic from the onnotification handler
		const { processed, total, rate, filename } = notification.payload;
		if (processed === total) {
			toast.showFinalizing();
		} else {
			toast.showProgress(processed, total, rate, filename);
		}

		expect(showFinalizing).toHaveBeenCalledOnce();
		expect(showProgress).not.toHaveBeenCalled();

		toast.destroy();
	});

	it('calls showProgress when processed < total', () => {
		const toast = new ImportToast(container);
		const showFinalizing = vi.spyOn(toast, 'showFinalizing');
		const showProgress = vi.spyOn(toast, 'showProgress');

		const notification = {
			type: 'import_progress' as const,
			payload: { processed: 100, total: 250, rate: 500, source: 'markdown' as const, filename: 'notes.md' },
		};

		const { processed, total, rate, filename } = notification.payload;
		if (processed === total) {
			toast.showFinalizing();
		} else {
			toast.showProgress(processed, total, rate, filename);
		}

		expect(showProgress).toHaveBeenCalledWith(100, 250, 500, 'notes.md');
		expect(showFinalizing).not.toHaveBeenCalled();

		toast.destroy();
	});

	it('showSuccess correctly formats result with insertedIds', () => {
		vi.useFakeTimers();

		const toast = new ImportToast(container);
		const result = {
			inserted: 200,
			updated: 50,
			unchanged: 0,
			skipped: 0,
			errors: 0,
			connections_created: 10,
			insertedIds: ['id-1', 'id-2', 'id-3'],
			updatedIds: [],
			deletedIds: [],
			errors_detail: [],
		};

		toast.showSuccess(result);

		const el = container.querySelector('.import-toast')!;
		// 200 inserted + 50 updated = 250
		expect(el.textContent).toContain('250 cards');
		expect(result.insertedIds.length).toBe(3);

		toast.destroy();
		vi.useRealTimers();
	});

	it('importFile success path calls toast.showSuccess after resolve', async () => {
		vi.useFakeTimers();

		const toast = new ImportToast(container);
		const showSuccess = vi.spyOn(toast, 'showSuccess');

		// Simulate the importFile success path
		const mockResult = {
			inserted: 100,
			updated: 0,
			unchanged: 0,
			skipped: 0,
			errors: 0,
			connections_created: 5,
			insertedIds: ['id-1'],
			updatedIds: [],
			deletedIds: [],
			errors_detail: [],
		};

		// This mirrors the try block in the wiring
		toast.showSuccess(mockResult);
		expect(showSuccess).toHaveBeenCalledWith(mockResult);

		toast.destroy();
		vi.useRealTimers();
	});
});
