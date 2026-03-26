/**
 * Isometry v6.1 — Phase 83 Plan 02
 * CalcExplorer lifecycle seam tests.
 *
 * Verifies that:
 *   - mount() creates .calc-explorer DOM with dropdown(s) for each axis field
 *   - With no axes assigned, mount() shows empty message
 *   - Axis changes rebuild dropdowns with correct numeric/text options
 *   - Config changes fire onConfigChange callback with updated CalcConfig
 *   - After destroy(), PAFVProvider subscription no longer triggers re-render
 *   - After destroy(), container is cleared
 *
 * Requirements: CALC-01, CALC-02
 */

import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../../src/database/Database';
import type { CalcConfig } from '../../../src/ui/CalcExplorer';
import { CalcExplorer } from '../../../src/ui/CalcExplorer';
import type { WorkerBridge } from '../../../src/worker/WorkerBridge';
import type { ProviderStack } from '../../harness/makeProviders';
import { makeProviders } from '../../harness/makeProviders';
import { realDb } from '../../harness/realDb';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flush queueMicrotask queue — PAFVProvider batches notifications via microtask. */
async function flushMicrotasks(): Promise<void> {
	await Promise.resolve();
}

function makeBridgeStub(): WorkerBridge {
	return {
		send: vi.fn().mockResolvedValue({ value: null }),
	} as unknown as WorkerBridge;
}

// ---------------------------------------------------------------------------
// CALC-01: mount creates correct DOM
// ---------------------------------------------------------------------------

describe('CALC-01: mount creates correct DOM and responds to axis changes', () => {
	let db: Database;
	let providers: ProviderStack;
	let container: HTMLElement;
	let bridge: WorkerBridge;
	let onConfigChange: ReturnType<typeof vi.fn<(config: CalcConfig) => void>>;

	beforeEach(async () => {
		db = await realDb();
		providers = makeProviders(db);
		const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
		global.document = dom.window.document as unknown as Document;
		(global as any).Event = dom.window.Event;
		container = document.createElement('div');
		document.body.appendChild(container);
		bridge = makeBridgeStub();
		onConfigChange = vi.fn();
	});

	afterEach(() => {
		providers.coordinator.destroy();
		db.close();
		container.remove();
		delete (global as any).document;
		delete (global as any).Event;
	});

	it('CALC-01a/b: mount() with no axes shows empty message ("Assign axes to configure")', async () => {
		const explorer = new CalcExplorer({
			bridge,
			pafv: providers.pafv,
			container,
			onConfigChange,
			schema: providers.schema,
		});

		await explorer.mount();

		expect(container.querySelector('.calc-explorer')).toBeNull();
		expect(container.textContent).toContain('Assign axes to configure');

		explorer.destroy();
	});

	it('CALC-01c: numeric field (priority) shows SUM/AVG/COUNT/MIN/MAX/OFF (6 options)', async () => {
		// Set priority as a column axis BEFORE mounting
		providers.pafv.setColAxes([{ field: 'priority', direction: 'asc' }]);
		await flushMicrotasks();

		const explorer = new CalcExplorer({
			bridge,
			pafv: providers.pafv,
			container,
			onConfigChange,
			schema: providers.schema,
		});

		await explorer.mount();

		const select = container.querySelector('select') as HTMLSelectElement;
		expect(select).not.toBeNull();

		const optionValues = Array.from(select.options).map((o) => o.value);
		expect(optionValues).toEqual(['sum', 'avg', 'count', 'min', 'max', 'off']);

		explorer.destroy();
	});

	it('CALC-01d: text field (folder) shows COUNT/OFF (2 options only)', async () => {
		providers.pafv.setColAxes([{ field: 'folder', direction: 'asc' }]);
		await flushMicrotasks();

		const explorer = new CalcExplorer({
			bridge,
			pafv: providers.pafv,
			container,
			onConfigChange,
			schema: providers.schema,
		});

		await explorer.mount();

		const select = container.querySelector('select') as HTMLSelectElement;
		expect(select).not.toBeNull();

		const optionValues = Array.from(select.options).map((o) => o.value);
		expect(optionValues).toEqual(['count', 'off']);

		explorer.destroy();
	});

	it('CALC-01e: adding a second axis after mount causes re-render with 2 selects', async () => {
		providers.pafv.setColAxes([{ field: 'priority', direction: 'asc' }]);
		await flushMicrotasks();

		const explorer = new CalcExplorer({
			bridge,
			pafv: providers.pafv,
			container,
			onConfigChange,
			schema: providers.schema,
		});

		await explorer.mount();

		// Initially 1 select
		expect(container.querySelectorAll('select')).toHaveLength(1);

		// Add folder as row axis — triggers PAFVProvider subscription -> _render()
		providers.pafv.setRowAxes([{ field: 'folder', direction: 'asc' }]);
		await flushMicrotasks();

		// Now 2 selects: priority (col) + folder (row)
		expect(container.querySelectorAll('select')).toHaveLength(2);

		explorer.destroy();
	});

	it('CALC-01f: clearing all axes after mount re-renders empty message', async () => {
		providers.pafv.setColAxes([{ field: 'priority', direction: 'asc' }]);
		await flushMicrotasks();

		const explorer = new CalcExplorer({
			bridge,
			pafv: providers.pafv,
			container,
			onConfigChange,
			schema: providers.schema,
		});

		await explorer.mount();

		expect(container.querySelectorAll('select')).toHaveLength(1);

		// Clear all axes
		providers.pafv.setColAxes([]);
		await flushMicrotasks();

		expect(container.querySelector('.calc-explorer')).toBeNull();
		expect(container.textContent).toContain('Assign axes to configure');

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// CALC-02: config change fires callback; destroy cleans up
// ---------------------------------------------------------------------------

describe('CALC-02: config change fires callback and destroy cleans up', () => {
	let db: Database;
	let providers: ProviderStack;
	let container: HTMLElement;
	let bridge: WorkerBridge;
	let onConfigChange: ReturnType<typeof vi.fn<(config: CalcConfig) => void>>;

	beforeEach(async () => {
		db = await realDb();
		providers = makeProviders(db);
		const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
		global.document = dom.window.document as unknown as Document;
		(global as any).Event = dom.window.Event;
		container = document.createElement('div');
		document.body.appendChild(container);
		bridge = makeBridgeStub();
		onConfigChange = vi.fn();
	});

	afterEach(() => {
		providers.coordinator.destroy();
		db.close();
		container.remove();
		delete (global as any).document;
		delete (global as any).Event;
	});

	it('CALC-02a: selecting a dropdown value fires onConfigChange with updated CalcConfig', async () => {
		providers.pafv.setColAxes([{ field: 'priority', direction: 'asc' }]);
		await flushMicrotasks();

		const explorer = new CalcExplorer({
			bridge,
			pafv: providers.pafv,
			container,
			onConfigChange,
			schema: providers.schema,
		});

		await explorer.mount();

		const select = container.querySelector('select') as HTMLSelectElement;
		expect(select).not.toBeNull();

		// Change the select value to 'avg' and dispatch change event
		select.value = 'avg';
		select.dispatchEvent(new Event('change', { bubbles: true }));

		expect(onConfigChange).toHaveBeenCalledOnce();
		const called = onConfigChange.mock.calls[0]![0];
		expect(called).toMatchObject({ columns: { priority: 'avg' } });

		explorer.destroy();
	});

	it('CALC-02b: after destroy(), PAFVProvider subscription no longer triggers re-render', async () => {
		providers.pafv.setColAxes([{ field: 'priority', direction: 'asc' }]);
		await flushMicrotasks();

		const explorer = new CalcExplorer({
			bridge,
			pafv: providers.pafv,
			container,
			onConfigChange,
			schema: providers.schema,
		});

		await explorer.mount();
		explorer.destroy();

		// Container should be cleared by destroy()
		expect(container.textContent).toBe('');

		// Setting new axes after destroy should NOT re-render (subscription removed)
		providers.pafv.setColAxes([{ field: 'folder', direction: 'asc' }]);
		await flushMicrotasks();

		// Still empty — no re-render occurred
		expect(container.textContent).toBe('');
	});

	it('CALC-02c: after destroy(), getConfig() still returns the last config (non-destructive read)', async () => {
		providers.pafv.setColAxes([{ field: 'priority', direction: 'asc' }]);
		await flushMicrotasks();

		const explorer = new CalcExplorer({
			bridge,
			pafv: providers.pafv,
			container,
			onConfigChange,
			schema: providers.schema,
		});

		await explorer.mount();

		// Change config
		const select = container.querySelector('select') as HTMLSelectElement;
		select.value = 'min';
		select.dispatchEvent(new Event('change', { bubbles: true }));

		explorer.destroy();

		// getConfig() should return the last known config
		const config = explorer.getConfig();
		expect(config).toMatchObject({ columns: { priority: 'min' } });
	});
});
