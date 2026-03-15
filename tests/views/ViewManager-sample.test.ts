// @vitest-environment jsdom
// Isometry v5 -- Phase 52 ViewManager Sample Data Integration Tests
// Tests for sample data CTA in welcome panel: rendering, click handlers, dropdown toggle, fallback.
//
// Requirements: SMPL-01, SMPL-04

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IView, PAFVProviderLike } from '../../src/views/types';
import type { FilterProviderLike } from '../../src/views/ViewManager';
import { ViewManager } from '../../src/views/ViewManager';

// ---------------------------------------------------------------------------
// Mock factories (reused from ViewManager.test.ts patterns)
// ---------------------------------------------------------------------------

function makeMockView(): IView {
	return {
		mount: vi.fn(),
		render: vi.fn(),
		destroy: vi.fn(),
	};
}

function makeMockCoordinator() {
	const callbacks = new Set<() => void>();
	return {
		subscribe: vi.fn((cb: () => void): (() => void) => {
			callbacks.add(cb);
			return () => {
				callbacks.delete(cb);
			};
		}),
		destroy: vi.fn(),
	};
}

function makeMockQueryBuilder() {
	return {
		buildCardQuery: vi.fn(() => ({
			sql: 'SELECT * FROM cards WHERE deleted_at IS NULL',
			params: [],
		})),
	};
}

/**
 * Create a mock bridge returning empty card rows and 0 total count.
 * This ensures the welcome panel is displayed.
 */
function makeMockBridgeEmpty() {
	return {
		send: vi.fn((_type: string, payload: unknown): Promise<unknown> => {
			const sql = (payload as { sql?: string }).sql ?? '';
			if (sql.includes('COUNT')) {
				return Promise.resolve({ rows: [{ count: 0 }] });
			}
			return Promise.resolve({ rows: [] });
		}),
	};
}

function makeMockFilter(): FilterProviderLike {
	return { resetToDefaults: vi.fn() };
}

function makeMockPAFV(): PAFVProviderLike {
	return { setViewType: vi.fn() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ViewManager sample data welcome panel', () => {
	let container: HTMLElement;
	let coordinator: ReturnType<typeof makeMockCoordinator>;
	let queryBuilder: ReturnType<typeof makeMockQueryBuilder>;
	let bridge: ReturnType<typeof makeMockBridgeEmpty>;
	let filter: ReturnType<typeof makeMockFilter>;
	let pafv: ReturnType<typeof makeMockPAFV>;
	let viewManager: ViewManager;

	beforeEach(() => {
		vi.useFakeTimers();
		container = document.createElement('div');
		document.body.appendChild(container);
		coordinator = makeMockCoordinator();
		queryBuilder = makeMockQueryBuilder();
		bridge = makeMockBridgeEmpty();
		filter = makeMockFilter();
		pafv = makeMockPAFV();

		viewManager = new ViewManager({
			container,
			coordinator: coordinator as never,
			queryBuilder: queryBuilder as never,
			bridge,
			pafv,
			filter,
		});

		// Default: two sample datasets available
		viewManager.sampleDatasets = [
			{ id: 'test-a', name: 'Test A' },
			{ id: 'test-b', name: 'Test B' },
		];
	});

	afterEach(() => {
		viewManager.destroy();
		document.body.removeChild(container);
		vi.useRealTimers();
	});

	// -----------------------------------------------------------------------
	// Rendering
	// -----------------------------------------------------------------------

	it('renders sample-data-btn with default dataset name', async () => {
		await viewManager.switchTo('list', () => makeMockView());
		await vi.runAllTimersAsync();

		const btn = container.querySelector('.sample-data-btn');
		expect(btn).not.toBeNull();
		expect(btn!.textContent).toContain('Test A');
	});

	it('renders sample-data-chevron button', async () => {
		await viewManager.switchTo('list', () => makeMockView());
		await vi.runAllTimersAsync();

		const chevron = container.querySelector('.sample-data-chevron');
		expect(chevron).not.toBeNull();
	});

	it('renders "Or import your own data" separator text', async () => {
		await viewManager.switchTo('list', () => makeMockView());
		await vi.runAllTimersAsync();

		const separator = container.querySelector('.view-empty-separator');
		expect(separator).not.toBeNull();
		expect(separator!.textContent).toBe('Or import your own data');
	});

	it('renders import buttons below the separator', async () => {
		await viewManager.switchTo('list', () => makeMockView());
		await vi.runAllTimersAsync();

		const importBtn = container.querySelector('.import-file-btn');
		expect(importBtn).not.toBeNull();
		expect(importBtn!.textContent).toBe('Import File');
	});

	// -----------------------------------------------------------------------
	// Click interactions
	// -----------------------------------------------------------------------

	it('clicking sample-data-btn fires onLoadSample with default dataset ID', async () => {
		const spy = vi.fn();
		viewManager.onLoadSample = spy;

		await viewManager.switchTo('list', () => makeMockView());
		await vi.runAllTimersAsync();

		const btn = container.querySelector<HTMLButtonElement>('.sample-data-btn');
		btn!.click();

		expect(spy).toHaveBeenCalledOnce();
		expect(spy).toHaveBeenCalledWith('test-a');
	});

	it('clicking chevron toggles dropdown visibility', async () => {
		await viewManager.switchTo('list', () => makeMockView());
		await vi.runAllTimersAsync();

		const chevron = container.querySelector<HTMLButtonElement>('.sample-data-chevron');
		const dropdown = container.querySelector('.sample-data-dropdown');
		expect(dropdown).not.toBeNull();
		expect(dropdown!.classList.contains('open')).toBe(false);

		// First click opens
		chevron!.click();
		expect(dropdown!.classList.contains('open')).toBe(true);

		// Second click closes
		chevron!.click();
		expect(dropdown!.classList.contains('open')).toBe(false);
	});

	it('clicking a dropdown option fires onLoadSample with that dataset ID', async () => {
		const spy = vi.fn();
		viewManager.onLoadSample = spy;

		await viewManager.switchTo('list', () => makeMockView());
		await vi.runAllTimersAsync();

		// Open dropdown first
		const chevron = container.querySelector<HTMLButtonElement>('.sample-data-chevron');
		chevron!.click();

		// Click the dropdown option (Test B)
		const option = container.querySelector<HTMLButtonElement>('.sample-data-option');
		expect(option).not.toBeNull();
		expect(option!.textContent).toBe('Test B');
		option!.click();

		expect(spy).toHaveBeenCalledOnce();
		expect(spy).toHaveBeenCalledWith('test-b');
	});

	it('clicking a dropdown option closes the dropdown', async () => {
		viewManager.onLoadSample = vi.fn();

		await viewManager.switchTo('list', () => makeMockView());
		await vi.runAllTimersAsync();

		const chevron = container.querySelector<HTMLButtonElement>('.sample-data-chevron');
		const dropdown = container.querySelector('.sample-data-dropdown');
		chevron!.click();
		expect(dropdown!.classList.contains('open')).toBe(true);

		const option = container.querySelector<HTMLButtonElement>('.sample-data-option');
		option!.click();
		expect(dropdown!.classList.contains('open')).toBe(false);
	});

	// -----------------------------------------------------------------------
	// sampleDatasets property controls rendering
	// -----------------------------------------------------------------------

	it('sampleDatasets property controls which datasets appear', async () => {
		viewManager.sampleDatasets = [
			{ id: 'ds-1', name: 'Dataset One' },
			{ id: 'ds-2', name: 'Dataset Two' },
			{ id: 'ds-3', name: 'Dataset Three' },
		];

		await viewManager.switchTo('list', () => makeMockView());
		await vi.runAllTimersAsync();

		const mainBtn = container.querySelector('.sample-data-btn');
		expect(mainBtn!.textContent).toContain('Dataset One');

		const options = container.querySelectorAll('.sample-data-option');
		expect(options).toHaveLength(2);
		expect(options[0]!.textContent).toBe('Dataset Two');
		expect(options[1]!.textContent).toBe('Dataset Three');
	});

	// -----------------------------------------------------------------------
	// Fallback with empty sampleDatasets
	// -----------------------------------------------------------------------

	it('with empty sampleDatasets, welcome panel has no sample CTA', async () => {
		viewManager.sampleDatasets = [];

		await viewManager.switchTo('list', () => makeMockView());
		await vi.runAllTimersAsync();

		const cta = container.querySelector('.sample-data-cta');
		expect(cta).toBeNull();
	});

	it('with empty sampleDatasets, import buttons still appear', async () => {
		viewManager.sampleDatasets = [];

		await viewManager.switchTo('list', () => makeMockView());
		await vi.runAllTimersAsync();

		const importBtn = container.querySelector('.import-file-btn');
		expect(importBtn).not.toBeNull();
	});

	it('with empty sampleDatasets, separator text still appears', async () => {
		viewManager.sampleDatasets = [];

		await viewManager.switchTo('list', () => makeMockView());
		await vi.runAllTimersAsync();

		const separator = container.querySelector('.view-empty-separator');
		expect(separator).not.toBeNull();
		expect(separator!.textContent).toBe('Or import your own data');
	});
});
