// @vitest-environment jsdom
/**
 * Isometry v12.0 — Phase 158 Plan 02
 * Explorer accessibility seam tests.
 *
 * Verifies that:
 *   - ProjectionExplorer well bodies have descriptive aria-label attributes
 *   - CalcExplorer labels are programmatically associated with their selects via htmlFor/id
 *   - CalcExplorer selects retain aria-label as fallback
 *   - PropertiesExplorer checkbox change events are handled via delegation on column body
 *
 * Requirements: EXPX-02, EXPX-03, EXPX-10
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AliasProvider } from '../../../src/providers/AliasProvider';
import { CalcExplorer } from '../../../src/ui/CalcExplorer';
import { ProjectionExplorer } from '../../../src/ui/ProjectionExplorer';
import { PropertiesExplorer } from '../../../src/ui/PropertiesExplorer';
import type { WorkerBridge } from '../../../src/worker/WorkerBridge';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAliasStub(): AliasProvider {
	return {
		getAlias: (field: string) => field,
		setAlias: vi.fn(),
		clearAlias: vi.fn(),
		subscribe: vi.fn().mockReturnValue(() => {}),
	} as unknown as AliasProvider;
}

function makeBridgeStub(): WorkerBridge {
	return {
		send: vi.fn().mockResolvedValue({ value: null }),
	} as unknown as WorkerBridge;
}

function makePafvStub() {
	const subscribers: Array<() => void> = [];
	return {
		getState: vi.fn().mockReturnValue({ colAxes: [], rowAxes: [] }),
		getAggregation: vi.fn().mockReturnValue('count'),
		setAggregation: vi.fn(),
		setColAxes: vi.fn(),
		setRowAxes: vi.fn(),
		reorderColAxes: vi.fn(),
		reorderRowAxes: vi.fn(),
		subscribe: vi.fn((cb: () => void) => {
			subscribers.push(cb);
			return () => {};
		}),
		// CalcExplorer uses getStackedGroupBySQL
		getStackedGroupBySQL: vi.fn().mockReturnValue({ colAxes: [], rowAxes: [] }),
	};
}

function makeSuperDensityStub() {
	return {
		getState: vi.fn().mockReturnValue({ displayField: 'name', viewMode: 'spreadsheet', axisGranularity: null }),
		setDisplayField: vi.fn(),
		setViewMode: vi.fn(),
		setGranularity: vi.fn(),
		subscribe: vi.fn().mockReturnValue(() => {}),
	};
}

function makeAuditStateStub() {
	return {
		toggle: vi.fn(),
		get enabled() { return false; },
		subscribe: vi.fn().mockReturnValue(() => {}),
	};
}

function makeActionToastStub() {
	return { show: vi.fn() };
}

// ---------------------------------------------------------------------------
// EXPX-02: ProjectionExplorer well bodies have aria-label attributes
// ---------------------------------------------------------------------------

describe('EXPX-02: ProjectionExplorer well aria-labels', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it('EXPX-02a: Available well body has aria-label "Available fields"', () => {
		const pafv = makePafvStub();
		const explorer = new ProjectionExplorer({
			pafv,
			alias: makeAliasStub(),
			superDensity: makeSuperDensityStub(),
			auditState: makeAuditStateStub(),
			actionToast: makeActionToastStub(),
			container,
			enabledFieldsGetter: () => new Set(),
		});
		explorer.mount();

		const well = container.querySelector('[data-well="available"] .projection-explorer__well-body');
		expect(well).not.toBeNull();
		expect(well!.getAttribute('aria-label')).toBe('Available fields');

		explorer.destroy();
	});

	it('EXPX-02b: X well body has aria-label "X fields"', () => {
		const pafv = makePafvStub();
		const explorer = new ProjectionExplorer({
			pafv,
			alias: makeAliasStub(),
			superDensity: makeSuperDensityStub(),
			auditState: makeAuditStateStub(),
			actionToast: makeActionToastStub(),
			container,
			enabledFieldsGetter: () => new Set(),
		});
		explorer.mount();

		const well = container.querySelector('[data-well="x"] .projection-explorer__well-body');
		expect(well).not.toBeNull();
		expect(well!.getAttribute('aria-label')).toBe('X fields');

		explorer.destroy();
	});

	it('EXPX-02c: Y well body has aria-label "Y fields"', () => {
		const pafv = makePafvStub();
		const explorer = new ProjectionExplorer({
			pafv,
			alias: makeAliasStub(),
			superDensity: makeSuperDensityStub(),
			auditState: makeAuditStateStub(),
			actionToast: makeActionToastStub(),
			container,
			enabledFieldsGetter: () => new Set(),
		});
		explorer.mount();

		const well = container.querySelector('[data-well="y"] .projection-explorer__well-body');
		expect(well).not.toBeNull();
		expect(well!.getAttribute('aria-label')).toBe('Y fields');

		explorer.destroy();
	});

	it('EXPX-02d: Z well body has aria-label "Z fields"', () => {
		const pafv = makePafvStub();
		const explorer = new ProjectionExplorer({
			pafv,
			alias: makeAliasStub(),
			superDensity: makeSuperDensityStub(),
			auditState: makeAuditStateStub(),
			actionToast: makeActionToastStub(),
			container,
			enabledFieldsGetter: () => new Set(),
		});
		explorer.mount();

		const well = container.querySelector('[data-well="z"] .projection-explorer__well-body');
		expect(well).not.toBeNull();
		expect(well!.getAttribute('aria-label')).toBe('Z fields');

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// EXPX-03: CalcExplorer label-select association
// ---------------------------------------------------------------------------

describe('EXPX-03: CalcExplorer label-select association', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it('EXPX-03a: label.htmlFor matches select.id for each field row', async () => {
		const pafv = makePafvStub();
		// Provide a field in axes so _render() creates a row
		pafv.getStackedGroupBySQL.mockReturnValue({
			colAxes: [{ field: 'priority', direction: 'asc' }],
			rowAxes: [],
		});

		const explorer = new CalcExplorer({
			bridge: makeBridgeStub(),
			pafv: pafv as any,
			container,
			onConfigChange: vi.fn(),
		});

		await explorer.mount();

		const labels = Array.from(container.querySelectorAll('label'));
		expect(labels.length).toBeGreaterThan(0);

		for (const label of labels) {
			const htmlFor = label.htmlFor;
			expect(htmlFor).toBeTruthy();
			const select = container.querySelector(`#${htmlFor}`);
			expect(select).not.toBeNull();
			expect(select!.tagName).toBe('SELECT');
		}

		explorer.destroy();
	});

	it('EXPX-03b: select retains aria-label as fallback', async () => {
		const pafv = makePafvStub();
		pafv.getStackedGroupBySQL.mockReturnValue({
			colAxes: [{ field: 'priority', direction: 'asc' }],
			rowAxes: [],
		});

		const explorer = new CalcExplorer({
			bridge: makeBridgeStub(),
			pafv: pafv as any,
			container,
			onConfigChange: vi.fn(),
		});

		await explorer.mount();

		const select = container.querySelector('select.calc-select');
		expect(select).not.toBeNull();
		expect(select!.getAttribute('aria-label')).toBeTruthy();

		explorer.destroy();
	});

	it('EXPX-03c: select id uses stable "calc-select-{field}" pattern', async () => {
		const pafv = makePafvStub();
		pafv.getStackedGroupBySQL.mockReturnValue({
			colAxes: [{ field: 'folder', direction: 'asc' }],
			rowAxes: [],
		});

		const explorer = new CalcExplorer({
			bridge: makeBridgeStub(),
			pafv: pafv as any,
			container,
			onConfigChange: vi.fn(),
		});

		await explorer.mount();

		const select = container.querySelector('select.calc-select') as HTMLSelectElement | null;
		expect(select).not.toBeNull();
		expect(select!.id).toBe('calc-select-folder');

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// EXPX-10: PropertiesExplorer checkbox delegation
// ---------------------------------------------------------------------------

describe('EXPX-10: PropertiesExplorer checkbox event delegation', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it('EXPX-10a: clicking a checkbox toggles the field in enabledFields', async () => {
		const explorer = new PropertiesExplorer({
			alias: makeAliasStub(),
			container,
		});
		await explorer.mount();

		// Find first checkbox in a property row
		const checkbox = container.querySelector<HTMLInputElement>('.properties-explorer__property input[type="checkbox"]');
		expect(checkbox).not.toBeNull();

		const row = checkbox!.closest<HTMLElement>('.properties-explorer__property');
		expect(row).not.toBeNull();
		const field = row!.getAttribute('data-field')!;
		expect(field).toBeTruthy();

		const wasEnabled = checkbox!.checked;

		// Simulate user clicking the checkbox (change event bubbles)
		checkbox!.checked = !wasEnabled;
		checkbox!.dispatchEvent(new Event('change', { bubbles: true }));

		// After toggle, the field should be removed or added from enabledFields
		const enabled = explorer.getEnabledFields();
		if (wasEnabled) {
			expect(enabled.has(field as any)).toBe(false);
		} else {
			expect(enabled.has(field as any)).toBe(true);
		}

		explorer.destroy();
	});

	it('EXPX-10b: dispatching change on body element with checkbox target triggers toggle', async () => {
		const explorer = new PropertiesExplorer({
			alias: makeAliasStub(),
			container,
		});
		await explorer.mount();

		// Find a body that actually contains checkboxes (skip empty columns)
		const allBodies = Array.from(container.querySelectorAll<HTMLElement>('.properties-explorer__column-body'));
		const bodyEl = allBodies.find((b) => b.querySelector('input[type="checkbox"]') !== null);
		expect(bodyEl).not.toBeNull();

		// Find a checkbox inside it
		const checkbox = bodyEl!.querySelector<HTMLInputElement>('input[type="checkbox"]');
		expect(checkbox).not.toBeNull();

		const row = checkbox!.closest<HTMLElement>('.properties-explorer__property');
		const field = row!.getAttribute('data-field')!;

		const beforeEnabled = explorer.getEnabledFields().has(field as any);

		// Dispatch change directly on checkbox (bubbles to body via delegation)
		checkbox!.checked = !beforeEnabled;
		checkbox!.dispatchEvent(new Event('change', { bubbles: true }));

		const afterEnabled = explorer.getEnabledFields().has(field as any);
		expect(afterEnabled).toBe(!beforeEnabled);

		explorer.destroy();
	});

	it('EXPX-10c: non-checkbox change events on body are ignored', async () => {
		const explorer = new PropertiesExplorer({
			alias: makeAliasStub(),
			container,
		});
		await explorer.mount();

		const initialCount = explorer.getEnabledFields().size;

		// Dispatch change on the body element itself (not from a checkbox)
		const bodyEl = container.querySelector<HTMLElement>('.properties-explorer__column-body');
		expect(bodyEl).not.toBeNull();
		bodyEl!.dispatchEvent(new Event('change', { bubbles: true }));

		// enabledFields count should be unchanged
		expect(explorer.getEnabledFields().size).toBe(initialCount);

		explorer.destroy();
	});
});
