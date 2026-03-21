// @vitest-environment jsdom
// Isometry v5 — Phase 99 SuperStackSpans Tests
// Tests for the ported buildHeaderCells spanning algorithm and createSuperStackSpansPlugin factory.
//
// Design:
//   - buildHeaderCells algorithm unit tests (no DOM required)
//   - Cardinality guard tests (60 → 50 + "Other" bucket)
//   - Plugin factory tests (createSuperStackSpansPlugin returns valid PluginHook)
//   - PivotTable constructor accepts optional PluginRegistry
//
// Requirements: SSP-01, SSP-02, SSP-03, SSP-04, SSP-05, SSP-06

import { describe, expect, it, vi } from 'vitest';
import type { HeaderDimension } from '../../../src/views/pivot/PivotTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDim(id: string, values: string[]): HeaderDimension {
	return { id, type: 'folder', name: id, values };
}

// Build axis value tuples from dimensions (same as generateCombinations)
function buildAxisValues(dimensions: HeaderDimension[]): string[][] {
	if (dimensions.length === 0) return [];
	const result: string[][] = [];
	function recurse(dimIdx: number, current: string[]): void {
		if (dimIdx >= dimensions.length) {
			result.push(current);
			return;
		}
		for (const v of dimensions[dimIdx].values) {
			recurse(dimIdx + 1, [...current, v]);
		}
	}
	recurse(0, []);
	return result;
}

// ---------------------------------------------------------------------------
// Test 1: 2-level spans — parent spans merge consecutive children
// ---------------------------------------------------------------------------

describe('SuperStackSpans — buildHeaderCells', () => {
	it('2-level dimensions produce correct parent spans', async () => {
		const { buildHeaderCells } = await import(
			'../../../src/views/pivot/plugins/SuperStackSpans'
		);

		// Level 0: ['A', 'B'] × Level 1: ['x', 'y'] = 4 leaf columns
		// A/x, A/y, B/x, B/y
		const axisValues = [['A', 'x'], ['A', 'y'], ['B', 'x'], ['B', 'y']];
		const { headers, leafCount } = buildHeaderCells(axisValues, new Set());

		expect(leafCount).toBe(4);
		expect(headers).toHaveLength(2);

		// Level 0: A spans 2, B spans 2
		expect(headers[0]).toHaveLength(2);
		expect(headers[0][0]).toMatchObject({ value: 'A', colSpan: 2, colStart: 1, level: 0 });
		expect(headers[0][1]).toMatchObject({ value: 'B', colSpan: 2, colStart: 3, level: 0 });

		// Level 1: x, y, x, y each span 1
		expect(headers[1]).toHaveLength(4);
		expect(headers[1][0]).toMatchObject({ value: 'x', colSpan: 1, colStart: 1, level: 1 });
		expect(headers[1][1]).toMatchObject({ value: 'y', colSpan: 1, colStart: 2, level: 1 });
		expect(headers[1][2]).toMatchObject({ value: 'x', colSpan: 1, colStart: 3, level: 1 });
		expect(headers[1][3]).toMatchObject({ value: 'y', colSpan: 1, colStart: 4, level: 1 });
	});

	// -------------------------------------------------------------------------
	// Test 2: Cardinality guard — 60 leaf columns reduces to 50 + "Other"
	// -------------------------------------------------------------------------

	it('cardinality guard: 60 columns reduces to 50 with "Other" bucket', async () => {
		const { buildHeaderCells, MAX_LEAF_COLUMNS } = await import(
			'../../../src/views/pivot/plugins/SuperStackSpans'
		);

		expect(MAX_LEAF_COLUMNS).toBe(50);

		// Create 60 single-level leaf columns
		const axisValues = Array.from({ length: 60 }, (_, i) => [`col${i}`]);
		const { headers, leafCount } = buildHeaderCells(axisValues, new Set());

		expect(leafCount).toBe(50);
		expect(headers).toHaveLength(1);
		expect(headers[0]).toHaveLength(50);

		// Last cell should be "Other"
		const lastCell = headers[0][49];
		expect(lastCell?.value).toBe('Other');
	});

	// -------------------------------------------------------------------------
	// Test 3: Single-level dimensions produce 1:1 spans (no merging)
	// -------------------------------------------------------------------------

	it('single-level dimensions produce 1:1 spans', async () => {
		const { buildHeaderCells } = await import(
			'../../../src/views/pivot/plugins/SuperStackSpans'
		);

		const axisValues = [['January'], ['February'], ['March']];
		const { headers, leafCount } = buildHeaderCells(axisValues, new Set());

		expect(leafCount).toBe(3);
		expect(headers).toHaveLength(1);
		expect(headers[0]).toHaveLength(3);

		expect(headers[0][0]).toMatchObject({ value: 'January', colSpan: 1, colStart: 1 });
		expect(headers[0][1]).toMatchObject({ value: 'February', colSpan: 1, colStart: 2 });
		expect(headers[0][2]).toMatchObject({ value: 'March', colSpan: 1, colStart: 3 });
	});

	// -------------------------------------------------------------------------
	// Test 4: Empty input returns empty spans
	// -------------------------------------------------------------------------

	it('empty input returns empty headers and zero leafCount', async () => {
		const { buildHeaderCells } = await import(
			'../../../src/views/pivot/plugins/SuperStackSpans'
		);

		const { headers, leafCount } = buildHeaderCells([], new Set());

		expect(leafCount).toBe(0);
		expect(headers).toHaveLength(0);
	});

	// -------------------------------------------------------------------------
	// Test 5: 3-level dimensions with varying cardinality
	// -------------------------------------------------------------------------

	it('3-level dimensions merge at all levels correctly', async () => {
		const { buildHeaderCells } = await import(
			'../../../src/views/pivot/plugins/SuperStackSpans'
		);

		// Year/Month/Day: 2024/Jan/1, 2024/Jan/2, 2024/Feb/1, 2025/Jan/1
		const axisValues = [
			['2024', 'Jan', '1'],
			['2024', 'Jan', '2'],
			['2024', 'Feb', '1'],
			['2025', 'Jan', '1'],
		];
		const { headers, leafCount } = buildHeaderCells(axisValues, new Set());

		expect(leafCount).toBe(4);
		expect(headers).toHaveLength(3);

		// Level 0: 2024 spans 3, 2025 spans 1
		expect(headers[0]).toHaveLength(2);
		expect(headers[0][0]).toMatchObject({ value: '2024', colSpan: 3 });
		expect(headers[0][1]).toMatchObject({ value: '2025', colSpan: 1 });

		// Level 1: Jan spans 2 (under 2024), Feb spans 1 (under 2024), Jan spans 1 (under 2025)
		// Jan under 2024 ≠ Jan under 2025, so they don't merge
		expect(headers[1]).toHaveLength(3);
		expect(headers[1][0]).toMatchObject({ value: 'Jan', colSpan: 2, parentPath: '2024' });
		expect(headers[1][1]).toMatchObject({ value: 'Feb', colSpan: 1, parentPath: '2024' });
		expect(headers[1][2]).toMatchObject({ value: 'Jan', colSpan: 1, parentPath: '2025' });

		// Level 2: all leaf, span 1 each
		expect(headers[2]).toHaveLength(4);
	});
});

// ---------------------------------------------------------------------------
// Test 6: createSuperStackSpansPlugin returns PluginHook with afterRender
// ---------------------------------------------------------------------------

describe('createSuperStackSpansPlugin', () => {
	it('returns a PluginHook with afterRender function', async () => {
		const { createSuperStackSpansPlugin } = await import(
			'../../../src/views/pivot/plugins/SuperStackSpans'
		);

		const plugin = createSuperStackSpansPlugin();
		expect(plugin).toBeDefined();
		expect(typeof plugin.afterRender).toBe('function');
	});

	it('afterRender clears and re-renders col span headers in overlay', async () => {
		const { createSuperStackSpansPlugin } = await import(
			'../../../src/views/pivot/plugins/SuperStackSpans'
		);
		const { PluginRegistry } = await import(
			'../../../src/views/pivot/plugins/PluginRegistry'
		);

		const plugin = createSuperStackSpansPlugin();
		const overlay = document.createElement('div');
		overlay.innerHTML = '<div class="pv-col-span">OLD</div>';

		const reg = new PluginRegistry();
		const ctx = {
			rowDimensions: [{ id: 'folder', type: 'folder', name: 'Folders', values: ['A', 'B'] }],
			colDimensions: [
				{ id: 'year', type: 'year', name: 'Years', values: ['2024', '2025'] },
				{ id: 'month', type: 'month', name: 'Months', values: ['Jan', 'Feb'] },
			],
			visibleRows: [['A'], ['B']],
			visibleCols: [['2024', 'Jan'], ['2024', 'Feb'], ['2025', 'Jan'], ['2025', 'Feb']],
			data: new Map(),
			rootEl: overlay,
			scrollLeft: 0,
			scrollTop: 0,
			isPluginEnabled: reg.isEnabled.bind(reg),
			layout: {
				headerWidth: 120,
				headerHeight: 36,
				cellWidth: 72,
				cellHeight: 32,
				colWidths: new Map(),
				zoom: 1.0,
			},
		};

		plugin.afterRender!(overlay, ctx as any);

		// Old header should be replaced
		const spans = overlay.querySelectorAll('.pv-col-span');
		expect(spans.length).toBeGreaterThan(0);

		// Should not contain "OLD" text — old headers were cleared
		const hasOld = Array.from(spans).some((el) => el.textContent?.includes('OLD'));
		expect(hasOld).toBe(false);
	});

	it('afterRender with empty dimensions does not throw', async () => {
		const { createSuperStackSpansPlugin } = await import(
			'../../../src/views/pivot/plugins/SuperStackSpans'
		);

		const plugin = createSuperStackSpansPlugin();
		const overlay = document.createElement('div');

		const ctx = {
			rowDimensions: [],
			colDimensions: [],
			visibleRows: [],
			visibleCols: [],
			data: new Map(),
			rootEl: overlay,
			scrollLeft: 0,
			scrollTop: 0,
			isPluginEnabled: () => false,
			layout: {
				headerWidth: 120,
				headerHeight: 36,
				cellWidth: 72,
				cellHeight: 32,
				colWidths: new Map(),
				zoom: 1.0,
			},
		};

		expect(() => plugin.afterRender!(overlay, ctx as any)).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Test 7: PivotTable constructor accepts optional PluginRegistry
// ---------------------------------------------------------------------------

describe('PivotTable — registry injection', () => {
	it('PivotTable constructor accepts optional registry without error', async () => {
		const { PivotTable } = await import('../../../src/views/pivot/PivotTable');
		const { PluginRegistry } = await import(
			'../../../src/views/pivot/plugins/PluginRegistry'
		);

		const registry = new PluginRegistry();
		const table = new PivotTable({ registry });
		expect(table).toBeDefined();
		// Cleanup
		table.destroy();
	});

	it('PivotTable constructor works without registry (backwards compat)', async () => {
		const { PivotTable } = await import('../../../src/views/pivot/PivotTable');

		const table = new PivotTable();
		expect(table).toBeDefined();
		table.destroy();
	});

	it('PivotTable exposes rerender() method', async () => {
		const { PivotTable } = await import('../../../src/views/pivot/PivotTable');

		const table = new PivotTable();
		expect(typeof table.rerender).toBe('function');
		table.destroy();
	});
});

// ---------------------------------------------------------------------------
// Test 8: PluginRegistry.setFactory() replaces a registered factory
// ---------------------------------------------------------------------------

describe('PluginRegistry — setFactory', () => {
	it('setFactory replaces the factory for an existing plugin', async () => {
		const { PluginRegistry } = await import(
			'../../../src/views/pivot/plugins/PluginRegistry'
		);

		const reg = new PluginRegistry();
		const log: string[] = [];

		// Register with noop factory
		reg.register(
			{ id: 'test', name: 'Test', category: 'Test', description: '', dependencies: [], defaultEnabled: false },
			() => ({}),
		);

		// Enable first
		reg.enable('test');
		expect(reg.isEnabled('test')).toBe(true);

		// Replace with a factory that logs
		reg.setFactory('test', () => ({
			afterRender() {
				log.push('real');
			},
		}));

		// Run the pipeline — should use new factory
		reg.runAfterRender(document.createElement('div'), {
			rowDimensions: [],
			colDimensions: [],
			visibleRows: [],
			visibleCols: [],
			data: new Map(),
			rootEl: document.createElement('div'),
			scrollLeft: 0,
			scrollTop: 0,
			isPluginEnabled: () => false,
		});

		expect(log).toContain('real');
	});

	it('setFactory on unknown id is a no-op', async () => {
		const { PluginRegistry } = await import(
			'../../../src/views/pivot/plugins/PluginRegistry'
		);

		const reg = new PluginRegistry();
		// Should not throw
		expect(() => reg.setFactory('unknown', () => ({}))).not.toThrow();
	});
});
