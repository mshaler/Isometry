// @vitest-environment jsdom
/**
 * Isometry v11.1 — Phase 154 Plan 01
 * Inline embedding seam tests: top-slot and bottom-slot visibility logic.
 *
 * Covers:
 *   - Top-slot Data Explorer toggle (show/hide .workbench-slot-top based on children)
 *   - Top-slot Projections auto-visibility (SuperGrid-only conditional)
 *   - Bottom-slot LATCH Filters toggle (show/hide .workbench-slot-bottom)
 *   - Bottom-slot LATCH Filters persistence across view switch
 *
 * Strategy: Replicate the syncTopSlotVisibility / syncBottomSlotVisibility closure
 * logic from main.ts directly in the test (module-scoped closures cannot be imported).
 * Exercises WorkbenchShell for DOM structure, then tests the sync logic inline.
 *
 * Requirements: REGR-01
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandBarConfig } from '../../../src/ui/CommandBar';
import { PanelRegistry } from '../../../src/ui/panels/PanelRegistry';
import { WorkbenchShell } from '../../../src/ui/WorkbenchShell';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCommandBarConfig(overrides?: Partial<CommandBarConfig>): CommandBarConfig {
	return {
		onMenuAction: vi.fn(),
		...overrides,
	};
}

function makeConfig() {
	return {
		commandBarConfig: makeCommandBarConfig(),
		panelRegistry: new PanelRegistry(),
		bridge: { send: (_cmd: string, _payload: unknown): Promise<unknown> => Promise.resolve(null) },
	};
}

/**
 * Build the slot child structure that main.ts creates at boot (Phase 152/153).
 * Returns the child elements and sync functions replicating main.ts closure logic.
 */
function buildSlots(shell: WorkbenchShell): {
	topSlotEl: HTMLElement;
	dataExplorerChildEl: HTMLDivElement;
	propertiesChildEl: HTMLDivElement;
	projectionChildEl: HTMLDivElement;
	bottomSlotEl: HTMLElement;
	latchFiltersChildEl: HTMLDivElement;
	formulasChildEl: HTMLDivElement;
	syncTopSlotVisibility: () => void;
	syncBottomSlotVisibility: () => void;
} {
	const topSlotEl = shell.getTopSlotEl();

	const dataExplorerChildEl = document.createElement('div');
	dataExplorerChildEl.className = 'slot-top__data-explorer';
	dataExplorerChildEl.style.display = 'none';
	topSlotEl.appendChild(dataExplorerChildEl);

	const propertiesChildEl = document.createElement('div');
	propertiesChildEl.className = 'slot-top__properties-explorer';
	propertiesChildEl.style.display = 'none';
	topSlotEl.appendChild(propertiesChildEl);

	const projectionChildEl = document.createElement('div');
	projectionChildEl.className = 'slot-top__projection-explorer';
	projectionChildEl.style.display = 'none';
	topSlotEl.appendChild(projectionChildEl);

	const bottomSlotEl = shell.getBottomSlotEl();

	const latchFiltersChildEl = document.createElement('div');
	latchFiltersChildEl.className = 'slot-bottom__latch-filters';
	latchFiltersChildEl.style.display = 'none';
	bottomSlotEl.appendChild(latchFiltersChildEl);

	const formulasChildEl = document.createElement('div');
	formulasChildEl.className = 'slot-bottom__formulas-explorer';
	formulasChildEl.style.display = 'none';
	bottomSlotEl.appendChild(formulasChildEl);

	/** Replicates main.ts syncTopSlotVisibility closure logic (Phase 152). */
	function syncTopSlotVisibility(): void {
		const anyVisible =
			dataExplorerChildEl.style.display !== 'none' ||
			propertiesChildEl.style.display !== 'none' ||
			projectionChildEl.style.display !== 'none';
		topSlotEl.style.display = anyVisible ? 'block' : 'none';
	}

	/** Replicates main.ts syncBottomSlotVisibility closure logic (Phase 153). */
	function syncBottomSlotVisibility(): void {
		const anyVisible =
			latchFiltersChildEl.style.display !== 'none' ||
			formulasChildEl.style.display !== 'none';
		bottomSlotEl.style.display = anyVisible ? '' : 'none';
	}

	return {
		topSlotEl,
		dataExplorerChildEl,
		propertiesChildEl,
		projectionChildEl,
		bottomSlotEl,
		latchFiltersChildEl,
		formulasChildEl,
		syncTopSlotVisibility,
		syncBottomSlotVisibility,
	};
}

// ---------------------------------------------------------------------------
// Top-slot: Data Explorer toggle
// ---------------------------------------------------------------------------

describe('Top-slot: Data Explorer toggle', () => {
	let root: HTMLElement;
	let shell: WorkbenchShell;

	beforeEach(() => {
		root = document.createElement('div');
		document.body.appendChild(root);
		shell = new WorkbenchShell(root, makeConfig());
	});

	afterEach(() => {
		shell.destroy();
		root.remove();
	});

	it('top-slot container (.workbench-slot-top) is hidden by default', () => {
		const topSlotEl = shell.getTopSlotEl();
		expect(topSlotEl.style.display).toBe('none');
	});

	it('shows .workbench-slot-top when a child becomes visible and syncTopSlotVisibility is called', () => {
		const { topSlotEl, dataExplorerChildEl, syncTopSlotVisibility } = buildSlots(shell);
		// Make data-explorer child visible
		dataExplorerChildEl.style.display = '';
		syncTopSlotVisibility();
		expect(topSlotEl.style.display).toBe('block');
	});

	it('hides .workbench-slot-top when all children are hidden and syncTopSlotVisibility is called', () => {
		const { topSlotEl, dataExplorerChildEl, syncTopSlotVisibility } = buildSlots(shell);
		// First make visible, then hide
		dataExplorerChildEl.style.display = '';
		syncTopSlotVisibility();
		expect(topSlotEl.style.display).toBe('block');

		dataExplorerChildEl.style.display = 'none';
		syncTopSlotVisibility();
		expect(topSlotEl.style.display).toBe('none');
	});
});

// ---------------------------------------------------------------------------
// Top-slot: Projections auto-visibility
// ---------------------------------------------------------------------------

describe('Top-slot: Projections auto-visibility', () => {
	let root: HTMLElement;
	let shell: WorkbenchShell;

	beforeEach(() => {
		root = document.createElement('div');
		document.body.appendChild(root);
		shell = new WorkbenchShell(root, makeConfig());
	});

	afterEach(() => {
		shell.destroy();
		root.remove();
	});

	it('.slot-top__projection-explorer has display:none by default', () => {
		const { projectionChildEl } = buildSlots(shell);
		expect(projectionChildEl.style.display).toBe('none');
	});

	it('shows top-slot when projection-explorer becomes visible and syncTopSlotVisibility is called', () => {
		const { topSlotEl, projectionChildEl, syncTopSlotVisibility } = buildSlots(shell);
		projectionChildEl.style.display = 'block';
		syncTopSlotVisibility();
		expect(topSlotEl.style.display).toBe('block');
	});

	it('hides top-slot when projection-explorer is hidden and no other child is visible', () => {
		const { topSlotEl, projectionChildEl, syncTopSlotVisibility } = buildSlots(shell);
		projectionChildEl.style.display = 'block';
		syncTopSlotVisibility();
		expect(topSlotEl.style.display).toBe('block');

		projectionChildEl.style.display = 'none';
		syncTopSlotVisibility();
		expect(topSlotEl.style.display).toBe('none');
	});
});

// ---------------------------------------------------------------------------
// Bottom-slot: LATCH Filters toggle
// ---------------------------------------------------------------------------

describe('Bottom-slot: LATCH Filters toggle', () => {
	let root: HTMLElement;
	let shell: WorkbenchShell;

	beforeEach(() => {
		root = document.createElement('div');
		document.body.appendChild(root);
		shell = new WorkbenchShell(root, makeConfig());
	});

	afterEach(() => {
		shell.destroy();
		root.remove();
	});

	it('bottom-slot container (.workbench-slot-bottom) is hidden by default', () => {
		const bottomSlotEl = shell.getBottomSlotEl();
		expect(bottomSlotEl.style.display).toBe('none');
	});

	it('shows .workbench-slot-bottom when latch-filters child becomes visible', () => {
		const { bottomSlotEl, latchFiltersChildEl, syncBottomSlotVisibility } = buildSlots(shell);
		latchFiltersChildEl.style.display = '';
		syncBottomSlotVisibility();
		expect(bottomSlotEl.style.display).not.toBe('none');
	});

	it('hides .workbench-slot-bottom when latch-filters child is hidden', () => {
		const { bottomSlotEl, latchFiltersChildEl, syncBottomSlotVisibility } = buildSlots(shell);
		latchFiltersChildEl.style.display = '';
		syncBottomSlotVisibility();
		expect(bottomSlotEl.style.display).not.toBe('none');

		latchFiltersChildEl.style.display = 'none';
		syncBottomSlotVisibility();
		expect(bottomSlotEl.style.display).toBe('none');
	});
});

// ---------------------------------------------------------------------------
// Bottom-slot: LATCH Filters persistence across view switch
// ---------------------------------------------------------------------------

describe('Bottom-slot: LATCH Filters persistence across view switch', () => {
	let root: HTMLElement;
	let shell: WorkbenchShell;

	beforeEach(() => {
		root = document.createElement('div');
		document.body.appendChild(root);
		shell = new WorkbenchShell(root, makeConfig());
	});

	afterEach(() => {
		shell.destroy();
		root.remove();
	});

	it('latch-filters remains visible after simulated view switch', () => {
		const { bottomSlotEl, latchFiltersChildEl, syncBottomSlotVisibility } = buildSlots(shell);

		// Make LATCH filters visible (simulates analyze:filter dock click)
		latchFiltersChildEl.style.display = '';
		syncBottomSlotVisibility();
		expect(bottomSlotEl.style.display).not.toBe('none');
		expect(latchFiltersChildEl.style.display).not.toBe('none');

		// Simulate a view switch: remove and re-append view content
		// (bottom-slot and latch-filters live outside view-content, so they survive)
		const viewContentEl = shell.getViewContentEl();
		const placeholder = document.createElement('div');
		placeholder.className = 'new-view-content';
		viewContentEl.textContent = '';
		viewContentEl.appendChild(placeholder);

		// Verify bottom-slot and latch-filters display is unchanged
		expect(bottomSlotEl.style.display).not.toBe('none');
		expect(latchFiltersChildEl.style.display).not.toBe('none');
	});
});
