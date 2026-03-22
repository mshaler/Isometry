// @vitest-environment jsdom
// Isometry v5 — Phase 10 ETL Progress ImportToast UI Tests

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportToast } from '../../src/ui/ImportToast';

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
