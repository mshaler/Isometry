// @vitest-environment jsdom
// Isometry v5 — Phase 159 Plan 01
// Unit tests for CatalogSuperGrid field value rendering and active row highlight.
//
// Design:
//   - Tests DOM-observable outcomes: data-col-key stamping, cell text replacement,
//     date formatting, actions cell emptiness
//   - No WASM needed — testing DOM manipulation only
//   - Uses minimal WorkerBridge mock and direct lastDatasets injection to avoid
//     the PivotTable hasAxes guard preventing fetchData from being called
//
// Requirements: EXPX-04, EXPX-07

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as d3 from 'd3';

// ---------------------------------------------------------------------------
// Import the module under test
// ---------------------------------------------------------------------------

import { CatalogSuperGrid } from '../../src/views/CatalogSuperGrid';

// ---------------------------------------------------------------------------
// Helpers — minimal bridge mock
// ---------------------------------------------------------------------------

function makeTestDataset(overrides: Record<string, unknown> = {}) {
	return {
		id: '1',
		name: 'My Dataset',
		source_type: 'csv',
		card_count: 42,
		connection_count: 7,
		last_imported_at: '2024-03-15T10:00:00.000Z',
		is_active: 1,
		...overrides,
	};
}

function makeBridge(datasets: unknown[]) {
	return {
		send: vi.fn(async (_type: string, _payload: unknown) => {
			return datasets;
		}),
	};
}

// ---------------------------------------------------------------------------
// Helpers — directly populate lastDatasets on the bridge adapter
// ---------------------------------------------------------------------------

/**
 * Directly set lastDatasets and activeRowKey on the CatalogBridgeAdapter.
 * CatalogBridgeAdapter.lastDatasets is a public field but lives on a private
 * instance. We use a type assertion to bypass TypeScript's access control.
 *
 * This is needed because PivotTable's hasAxes guard prevents fetchData from
 * being called when rowDimensions is empty at construction time (the catalog
 * starts with no row dimensions before first fetch).
 */
function setLastDatasets(catalog: CatalogSuperGrid, datasets: Array<Record<string, unknown>>): void {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const bridgeAdapter = (catalog as any)._bridgeAdapter;
	bridgeAdapter.lastDatasets = datasets;
	const activeDs = datasets.find((d) => d['is_active']);
	bridgeAdapter.activeRowKey = activeDs ? String(activeDs['id']) : null;
}

// ---------------------------------------------------------------------------
// Helpers — build a minimal PivotGrid-like table structure
// ---------------------------------------------------------------------------

/**
 * Creates a minimal table structure matching PivotGrid output:
 * table > tbody > tr > td.pv-data-cell[data-col="N"]
 * Binds D3 datum (rowPath) to each <tr> element.
 */
function buildPivotTableDOM(
	container: HTMLElement,
	rows: Array<{ datasetId: string; colCount?: number }>,
): HTMLTableElement {
	const table = document.createElement('table');
	const tbody = document.createElement('tbody');
	table.appendChild(tbody);
	container.appendChild(table);

	for (const { datasetId, colCount = 6 } of rows) {
		const tr = document.createElement('tr');
		// Bind D3 datum (rowPath) — PivotGrid binds string[] arrays
		d3.select(tr).datum([datasetId]);

		for (let i = 0; i < colCount; i++) {
			const td = document.createElement('td');
			td.className = 'pv-data-cell';
			td.dataset['col'] = String(i);
			// PivotGrid sets numeric counts as textContent
			td.textContent = '0';
			tr.appendChild(td);
		}
		tbody.appendChild(tr);
	}

	return table;
}

// ---------------------------------------------------------------------------
// Tests for CATALOG_FIELD_LABELS
// ---------------------------------------------------------------------------

describe('CATALOG_FIELD_LABELS — human-readable column header mapping', () => {
	it('maps source_type to Source and actions to empty string via _renderColumnHeaders on real PivotGrid overlay', () => {
		// Test _renderColumnHeaders by injecting spans into PivotGrid's real overlay element,
		// which is inside the container mounted by PivotTable. querySelector('.pv-overlay')
		// returns PivotGrid's overlay, so we populate THAT overlay with raw field names.

		const bridge = makeBridge([makeTestDataset()]);
		const catalog = new CatalogSuperGrid({ bridge: bridge as never, onDatasetClick: vi.fn() });

		const container = document.createElement('div');
		document.body.appendChild(container);

		catalog.mount(container);

		// Find the real .pv-overlay element that PivotGrid added
		const overlay = container.querySelector('.pv-overlay');
		expect(overlay).not.toBeNull();

		// Inject raw field-name spans into PivotGrid's overlay (simulating header spans)
		const fields = ['name', 'source_type', 'card_count', 'connection_count', 'last_imported_at', 'actions'];
		const injectedSpans: HTMLElement[] = [];
		for (const f of fields) {
			const span = document.createElement('span');
			span.textContent = f;
			overlay!.appendChild(span);
			injectedSpans.push(span);
		}

		// Call _renderColumnHeaders directly to test synchronously
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(catalog as any)._renderColumnHeaders();

		// After _renderColumnHeaders: 'source_type' span should be replaced with 'Source'
		const sourceSpan = injectedSpans.find((s) => s.textContent === 'Source');
		expect(sourceSpan).toBeDefined();

		// 'actions' span should become '' (empty string label)
		const actionsSpan = injectedSpans.find((s) => s.textContent === '');
		expect(actionsSpan).toBeDefined();

		catalog.destroy();
		document.body.removeChild(container);
	});
});

// ---------------------------------------------------------------------------
// Tests for data-col-key stamping
// ---------------------------------------------------------------------------

describe('_stampRowKeys — stamps data-col-key on .pv-data-cell', () => {
	let container: HTMLElement;
	let catalog: CatalogSuperGrid;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);

		const bridge = makeBridge([makeTestDataset()]);
		catalog = new CatalogSuperGrid({ bridge: bridge as never, onDatasetClick: vi.fn() });
		catalog.mount(container);
	});

	afterEach(() => {
		catalog.destroy();
		document.body.removeChild(container);
	});

	it('stamps data-col-key on each .pv-data-cell matching CATALOG_FIELDS[colIdx]', async () => {
		buildPivotTableDOM(container, [{ datasetId: '1' }]);

		await new Promise((r) => setTimeout(r, 20));

		const cells = container.querySelectorAll<HTMLElement>('.pv-data-cell');
		const expectedKeys = ['name', 'source_type', 'card_count', 'connection_count', 'last_imported_at', 'actions'];

		expect(cells.length).toBe(6);
		cells.forEach((cell, i) => {
			expect(cell.dataset['colKey']).toBe(expectedKeys[i]);
		});
	});

	it('stamps data-row-key on the tr element and its .pv-data-cell children', async () => {
		buildPivotTableDOM(container, [{ datasetId: 'ds-42' }]);

		await new Promise((r) => setTimeout(r, 20));

		const tr = container.querySelector('tbody tr') as HTMLElement;
		expect(tr.dataset['rowKey']).toBe('ds-42');

		const cells = tr.querySelectorAll<HTMLElement>('.pv-data-cell');
		cells.forEach((cell) => {
			expect(cell.dataset['rowKey']).toBe('ds-42');
		});
	});
});

// ---------------------------------------------------------------------------
// Tests for _renderFieldValues
// ---------------------------------------------------------------------------

describe('_renderFieldValues — replaces numeric cell text with field values', () => {
	let container: HTMLElement;
	let catalog: CatalogSuperGrid;
	const ds = makeTestDataset({ id: '1', name: 'Alpha Dataset', source_type: 'json', card_count: 99 });

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);

		const bridge = makeBridge([ds]);
		catalog = new CatalogSuperGrid({ bridge: bridge as never, onDatasetClick: vi.fn() });
		catalog.mount(container);

		// Directly populate lastDatasets to bypass PivotTable hasAxes guard
		setLastDatasets(catalog, [ds]);
	});

	afterEach(() => {
		catalog.destroy();
		document.body.removeChild(container);
	});

	it('replaces cell text with dataset name for name column', async () => {
		buildPivotTableDOM(container, [{ datasetId: '1' }]);
		await new Promise((r) => setTimeout(r, 20));

		const cells = container.querySelectorAll<HTMLElement>('.pv-data-cell');
		const nameCell = cells[0]; // name is index 0
		expect(nameCell?.textContent).toBe('Alpha Dataset');
	});

	it('replaces cell text with source_type for source_type column', async () => {
		buildPivotTableDOM(container, [{ datasetId: '1' }]);
		await new Promise((r) => setTimeout(r, 20));

		const cells = container.querySelectorAll<HTMLElement>('.pv-data-cell');
		const sourceCell = cells[1]; // source_type is index 1
		expect(sourceCell?.textContent).toBe('json');
	});

	it('replaces cell text with card_count as string', async () => {
		buildPivotTableDOM(container, [{ datasetId: '1' }]);
		await new Promise((r) => setTimeout(r, 20));

		const cells = container.querySelectorAll<HTMLElement>('.pv-data-cell');
		const countCell = cells[2]; // card_count is index 2
		expect(countCell?.textContent).toBe('99');
	});

	it('formats last_imported_at as locale date string', async () => {
		buildPivotTableDOM(container, [{ datasetId: '1' }]);
		await new Promise((r) => setTimeout(r, 20));

		const cells = container.querySelectorAll<HTMLElement>('.pv-data-cell');
		const dateCell = cells[4]; // last_imported_at is index 4

		// Should be a locale date string (not the raw ISO string or '0')
		expect(dateCell?.textContent).not.toBe('0');
		expect(dateCell?.textContent).not.toBe('2024-03-15T10:00:00.000Z');
		// Should not be empty
		expect(dateCell?.textContent?.length).toBeGreaterThan(0);
	});

	it('formats last_imported_at as em dash when null/empty', async () => {
		const container2 = document.createElement('div');
		document.body.appendChild(container2);
		const ds2 = makeTestDataset({ id: '2', last_imported_at: null, is_active: 0 });
		const bridge = makeBridge([ds2]);
		const cat2 = new CatalogSuperGrid({ bridge: bridge as never, onDatasetClick: vi.fn() });
		cat2.mount(container2);
		setLastDatasets(cat2, [ds2]);

		buildPivotTableDOM(container2, [{ datasetId: '2' }]);
		await new Promise((r) => setTimeout(r, 20));

		const cells = container2.querySelectorAll<HTMLElement>('.pv-data-cell');
		const dateCell = cells[4]; // last_imported_at is index 4
		expect(dateCell?.textContent).toBe('\u2014'); // em dash

		cat2.destroy();
		document.body.removeChild(container2);
	});

	it('leaves actions cell without field value text (buttons rendered separately)', async () => {
		buildPivotTableDOM(container, [{ datasetId: '1' }]);
		await new Promise((r) => setTimeout(r, 20));

		const cells = container.querySelectorAll<HTMLElement>('.pv-data-cell');
		const actionsCell = cells[5]; // actions is index 5

		// Actions cell should not have raw numeric '0' text after _renderFieldValues
		// (button text ↺ and ✕ may be present from _renderActionButtons)
		const textWithoutButtons = actionsCell?.textContent?.trim().replace(/[↺✕]/g, '') ?? '';
		expect(textWithoutButtons).toBe('');
	});
});
