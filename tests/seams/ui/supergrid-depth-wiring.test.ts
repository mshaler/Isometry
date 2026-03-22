// @vitest-environment jsdom
/**
 * Isometry v7.0 — Phase 89 Plan 04
 * SuperGrid depth wiring seam tests.
 *
 * Verifies that SuperGrid._fetchAndRender() correctly limits colAxes
 * based on the depth getter injected via setDepthGetter().
 *
 * These tests use a mock bridge whose superGridQuery/calcQuery captures
 * the colAxes arg. A mock provider returns 3 configured col axes so we
 * can verify slicing at each depth level.
 *
 * Requirements: SGFX-01
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SuperGrid } from '../../../src/views/SuperGrid';
import type { AxisField } from '../../../src/providers/types';

// ---------------------------------------------------------------------------
// Types / stubs
// ---------------------------------------------------------------------------

type ColAxesArg = { field: AxisField }[];

/** Three col axes used for all tests — enough to verify slicing at 1, 2, and 3. */
const THREE_COL_AXES: ColAxesArg = [
	{ field: 'card_type' as AxisField },
	{ field: 'folder' as AxisField },
	{ field: 'priority' as AxisField },
];

/** Minimal stub row axis. */
const ONE_ROW_AXIS: ColAxesArg = [{ field: 'status' as AxisField }];

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeMockProvider() {
	return {
		getStackedGroupBySQL: vi.fn().mockReturnValue({
			colAxes: THREE_COL_AXES,
			rowAxes: ONE_ROW_AXIS,
		}),
		getColWidths: vi.fn().mockReturnValue({}),
		setColWidths: vi.fn(),
		getCollapseState: vi.fn().mockReturnValue([]),
		getSortOverrides: vi.fn().mockReturnValue([]),
		getAggregation: vi.fn().mockReturnValue('count'),
		getRowHeaderWidth: vi.fn().mockReturnValue(null),
		setRowHeaderWidth: vi.fn(),
	};
}

function makeMockBridge() {
	const capturedColAxes: ColAxesArg[] = [];
	const bridge = {
		superGridQuery: vi.fn().mockImplementation((opts: { colAxes: ColAxesArg }) => {
			capturedColAxes.push(opts.colAxes);
			return Promise.resolve([]);
		}),
		calcQuery: vi.fn().mockResolvedValue({ rows: [] }),
		capturedColAxes,
	};
	return bridge;
}

function makeMockFilter() {
	return {
		compile: vi.fn().mockReturnValue({ where: '', params: [] }),
		subscribe: vi.fn().mockReturnValue(() => {}),
	};
}

function makeMockCoordinator() {
	return {
		subscribe: vi.fn().mockReturnValue(() => {}),
	};
}

/** Build a minimal SuperGrid with mocks and mount a grid element so _fetchAndRender() can run. */
async function buildGrid(depthGetter?: () => number) {
	const provider = makeMockProvider();
	const bridge = makeMockBridge();
	const filter = makeMockFilter();
	const coordinator = makeMockCoordinator();

	const sg = new SuperGrid(
		// biome-ignore lint/suspicious/noExplicitAny: test harness
		provider as any,
		// biome-ignore lint/suspicious/noExplicitAny: test harness
		filter as any,
		// biome-ignore lint/suspicious/noExplicitAny: test harness
		bridge as any,
		// biome-ignore lint/suspicious/noExplicitAny: test harness
		coordinator as any,
	);

	if (depthGetter !== undefined) {
		sg.setDepthGetter(depthGetter);
	}

	// Mount into a real DOM so _gridEl is set (required for _fetchAndRender to proceed)
	const container = document.createElement('div');
	document.body.appendChild(container);
	sg.mount(container);

	return { sg, bridge, container };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SGFX-01: SuperGrid depth wiring via setDepthGetter()', () => {
	const containers: HTMLElement[] = [];

	afterEach(() => {
		for (const c of containers) {
			c.remove();
		}
		containers.length = 0;
		vi.clearAllMocks();
	});

	it('SGFX-01g: depth=1 (Shallow) passes at most 1 colAxis to superGridQuery', async () => {
		const { bridge, container } = await buildGrid(() => 1);
		containers.push(container);

		// Wait for superGridQuery to be called (mounted grids fire _fetchAndRender via coordinator sub)
		await vi.waitFor(() => bridge.superGridQuery.mock.calls.length > 0, { timeout: 2000 });

		const lastCall = bridge.superGridQuery.mock.calls.at(-1)![0];
		expect(lastCall.colAxes).toHaveLength(1);
		expect(lastCall.colAxes[0].field).toBe('card_type');
	});

	it('SGFX-01h: depth=0 (All) passes all 3 colAxes unchanged', async () => {
		const { bridge, container } = await buildGrid(() => 0);
		containers.push(container);

		await vi.waitFor(() => bridge.superGridQuery.mock.calls.length > 0, { timeout: 2000 });

		const lastCall = bridge.superGridQuery.mock.calls.at(-1)![0];
		expect(lastCall.colAxes).toHaveLength(3);
	});

	it('SGFX-01i: depth=2 with 3 configured colAxes passes exactly 2', async () => {
		const { bridge, container } = await buildGrid(() => 2);
		containers.push(container);

		await vi.waitFor(() => bridge.superGridQuery.mock.calls.length > 0, { timeout: 2000 });

		const lastCall = bridge.superGridQuery.mock.calls.at(-1)![0];
		expect(lastCall.colAxes).toHaveLength(2);
		expect(lastCall.colAxes[0].field).toBe('card_type');
		expect(lastCall.colAxes[1].field).toBe('folder');
	});

	it('SGFX-01j: no depthGetter set passes all colAxes (backward compatible)', async () => {
		const { bridge, container } = await buildGrid(); // no depthGetter
		containers.push(container);

		await vi.waitFor(() => bridge.superGridQuery.mock.calls.length > 0, { timeout: 2000 });

		const lastCall = bridge.superGridQuery.mock.calls.at(-1)![0];
		expect(lastCall.colAxes).toHaveLength(3);
	});
});
