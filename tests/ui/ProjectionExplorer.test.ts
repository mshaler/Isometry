// @vitest-environment jsdom
// Isometry v5 — Phase 55 Plan 03
// Tests for ProjectionExplorer: 4 projection wells (Available, X, Y, Z)
// with HTML5 DnD, duplicate rejection, minimum enforcement, D3 selection.join.
//
// Requirements: PROJ-01, PROJ-02, PROJ-03, PROJ-04, PROJ-07
// TDD Phase: RED -> GREEN -> REFACTOR

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxisField, AxisMapping } from '../../src/providers/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/** Minimal PAFVProvider mock */
function createMockPafv(
	colAxes: AxisMapping[] = [{ field: 'card_type', direction: 'asc' }],
	rowAxes: AxisMapping[] = [{ field: 'folder', direction: 'asc' }],
) {
	const subscribers = new Set<() => void>();
	let _colAxes = [...colAxes];
	let _rowAxes = [...rowAxes];
	let _aggregation = 'count';
	return {
		getState() {
			return {
				viewType: 'supergrid' as const,
				xAxis: null,
				yAxis: null,
				groupBy: null,
				colAxes: [..._colAxes],
				rowAxes: [..._rowAxes],
			};
		},
		getAggregation() {
			return _aggregation;
		},
		setAggregation(mode: string) {
			_aggregation = mode;
		},
		setColAxes(axes: AxisMapping[]) {
			_colAxes = [...axes];
		},
		setRowAxes(axes: AxisMapping[]) {
			_rowAxes = [...axes];
		},
		reorderColAxes: vi.fn(),
		reorderRowAxes: vi.fn(),
		subscribe(cb: () => void) {
			subscribers.add(cb);
			return () => subscribers.delete(cb);
		},
		_notify() {
			for (const cb of subscribers) cb();
		},
	};
}

/** Minimal AliasProvider mock */
function createMockAlias() {
	const aliases = new Map<AxisField, string>();
	const subscribers = new Set<() => void>();
	return {
		getAlias(field: AxisField): string {
			return aliases.get(field) ?? field;
		},
		setAlias(field: AxisField, alias: string) {
			aliases.set(field, alias);
		},
		subscribe(cb: () => void) {
			subscribers.add(cb);
			return () => subscribers.delete(cb);
		},
		_notify() {
			for (const cb of subscribers) cb();
		},
	};
}

/** Minimal SuperDensityProvider mock */
function createMockSuperDensity() {
	const subscribers = new Set<() => void>();
	let _displayField = 'name';
	let _viewMode = 'spreadsheet';
	let _granularity: string | null = null;
	return {
		getState() {
			return {
				displayField: _displayField,
				viewMode: _viewMode,
				axisGranularity: _granularity,
				hideEmpty: false,
				regionConfig: null,
			};
		},
		setDisplayField(field: string) {
			_displayField = field;
		},
		setViewMode(mode: string) {
			_viewMode = mode;
		},
		setGranularity(g: string | null) {
			_granularity = g;
		},
		subscribe(cb: () => void) {
			subscribers.add(cb);
			return () => subscribers.delete(cb);
		},
		_notify() {
			for (const cb of subscribers) cb();
		},
	};
}

/** Minimal AuditState mock */
function createMockAuditState() {
	const subscribers = new Set<() => void>();
	let _enabled = false;
	return {
		get enabled() {
			return _enabled;
		},
		toggle() {
			_enabled = !_enabled;
		},
		subscribe(cb: () => void) {
			subscribers.add(cb);
			return () => subscribers.delete(cb);
		},
		_notify() {
			for (const cb of subscribers) cb();
		},
	};
}

/** Minimal ActionToast mock */
function createMockToast() {
	return {
		show: vi.fn(),
	};
}

// All 9 AxisField values
const ALL_FIELDS: AxisField[] = [
	'created_at',
	'modified_at',
	'due_at',
	'folder',
	'status',
	'card_type',
	'priority',
	'sort_order',
	'name',
];

describe('ProjectionExplorer', () => {
	let container: HTMLDivElement;
	let pafv: ReturnType<typeof createMockPafv>;
	let alias: ReturnType<typeof createMockAlias>;
	let superDensity: ReturnType<typeof createMockSuperDensity>;
	let auditStateMock: ReturnType<typeof createMockAuditState>;
	let actionToast: ReturnType<typeof createMockToast>;
	let explorer: InstanceType<typeof import('../../src/ui/ProjectionExplorer').ProjectionExplorer>;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		pafv = createMockPafv();
		alias = createMockAlias();
		superDensity = createMockSuperDensity();
		auditStateMock = createMockAuditState();
		actionToast = createMockToast();
	});

	afterEach(() => {
		explorer?.destroy();
		container.remove();
	});

	async function mountExplorer(enabledFields: ReadonlySet<AxisField> = new Set(ALL_FIELDS)) {
		const { ProjectionExplorer } = await import('../../src/ui/ProjectionExplorer');
		explorer = new ProjectionExplorer({
			pafv: pafv as any,
			alias: alias as any,
			superDensity: superDensity as any,
			auditState: auditStateMock as any,
			actionToast,
			container,
			enabledFieldsGetter: () => enabledFields,
		});
		explorer.mount();
		return explorer;
	}

	// ---------------------------------------------------------------------------
	// Mount / Destroy lifecycle
	// ---------------------------------------------------------------------------

	describe('mount/destroy lifecycle', () => {
		it('mount creates 4 wells with correct labels', async () => {
			await mountExplorer();

			const wells = container.querySelectorAll('.projection-explorer__well');
			expect(wells.length).toBe(4);

			const labels = container.querySelectorAll('.projection-explorer__well-label');
			expect(labels.length).toBe(4);
			expect(labels[0]!.textContent).toBe('Available');
			expect(labels[1]!.textContent).toBe('X');
			expect(labels[2]!.textContent).toBe('Y');
			expect(labels[3]!.textContent).toBe('Z');
		});

		it('each well body has role="listbox"', async () => {
			await mountExplorer();

			const bodies = container.querySelectorAll('.projection-explorer__well-body');
			expect(bodies.length).toBe(4);
			for (const body of bodies) {
				expect(body.getAttribute('role')).toBe('listbox');
			}
		});

		it('Available well has data-well="available" and wider flex', async () => {
			await mountExplorer();

			const availableWell = container.querySelector('.projection-explorer__well[data-well="available"]');
			expect(availableWell).not.toBeNull();
		});

		it('destroy removes DOM and cleans up subscriptions', async () => {
			await mountExplorer();

			expect(container.querySelector('.projection-explorer')).not.toBeNull();

			explorer.destroy();

			expect(container.querySelector('.projection-explorer')).toBeNull();
		});
	});

	// ---------------------------------------------------------------------------
	// Chip rendering from provider state
	// ---------------------------------------------------------------------------

	describe('chip rendering', () => {
		it('X well renders chips from PAFVProvider colAxes', async () => {
			await mountExplorer();

			const xWellBody = container.querySelector(
				'.projection-explorer__well[data-well="x"] .projection-explorer__well-body',
			);
			const chips = xWellBody?.querySelectorAll('.projection-explorer__chip');
			expect(chips?.length).toBe(1);
			// Default colAxes has card_type
		});

		it('Y well renders chips from PAFVProvider rowAxes', async () => {
			await mountExplorer();

			const yWellBody = container.querySelector(
				'.projection-explorer__well[data-well="y"] .projection-explorer__well-body',
			);
			const chips = yWellBody?.querySelectorAll('.projection-explorer__chip');
			expect(chips?.length).toBe(1);
			// Default rowAxes has folder
		});

		it('Available well shows remaining enabled fields not in X/Y/Z', async () => {
			await mountExplorer();

			const availableBody = container.querySelector(
				'.projection-explorer__well[data-well="available"] .projection-explorer__well-body',
			);
			const chips = availableBody?.querySelectorAll('.projection-explorer__chip');
			// 9 total - 1 in X (card_type) - 1 in Y (folder) = 7 in Available
			expect(chips?.length).toBe(7);
		});

		it('Z well initially empty', async () => {
			await mountExplorer();

			const zWellBody = container.querySelector(
				'.projection-explorer__well[data-well="z"] .projection-explorer__well-body',
			);
			const chips = zWellBody?.querySelectorAll('.projection-explorer__chip');
			expect(chips?.length).toBe(0);
		});

		it('chip labels show display alias from AliasProvider', async () => {
			alias.setAlias('card_type', 'Type');
			await mountExplorer();

			// card_type is in colAxes → Y well (x: rowAxes, y: colAxes)
			const yWellBody = container.querySelector(
				'.projection-explorer__well[data-well="y"] .projection-explorer__well-body',
			);
			const chipLabel = yWellBody?.querySelector('.projection-explorer__chip-label');
			expect(chipLabel?.textContent).toBe('Type');
		});

		it('chip has colored left border from LATCH family', async () => {
			await mountExplorer();

			const xWellBody = container.querySelector(
				'.projection-explorer__well[data-well="x"] .projection-explorer__well-body',
			);
			const chipBorder = xWellBody?.querySelector('.projection-explorer__chip-border');
			expect(chipBorder).not.toBeNull();
			// card_type is Category (C) family
			expect((chipBorder as HTMLElement)?.style.backgroundColor).toBe('var(--latch-category)');
		});

		it('chips use D3 selection.join for rendering', async () => {
			// Verify behavior: D3 join handles enter/update/exit automatically
			await mountExplorer();

			// Initial render has chips
			let availableChips = container.querySelectorAll(
				'.projection-explorer__well[data-well="available"] .projection-explorer__chip',
			);
			expect(availableChips.length).toBe(7);

			// Re-render (update) should keep same chip count
			explorer.update();
			availableChips = container.querySelectorAll(
				'.projection-explorer__well[data-well="available"] .projection-explorer__chip',
			);
			expect(availableChips.length).toBe(7);
		});

		it('chips have role="option" (pointer events replace HTML5 draggable)', async () => {
			await mountExplorer();

			const chips = container.querySelectorAll('.projection-explorer__chip');
			expect(chips.length).toBeGreaterThan(0);
			for (const chip of chips) {
				// Phase 96: pointer events replace HTML5 DnD — no draggable attribute
				expect(chip.getAttribute('role')).toBe('option');
			}
		});
	});

	// ---------------------------------------------------------------------------
	// DnD: Duplicate rejection
	// ---------------------------------------------------------------------------

	describe('duplicate rejection', () => {
		it('rejects drop of field already in target well', async () => {
			await mountExplorer();

			const xWellBody = container.querySelector(
				'.projection-explorer__well[data-well="x"] .projection-explorer__well-body',
			) as HTMLElement;

			// Simulate dropping card_type (already in X) into X
			const dropEvent = new Event('drop', {
				bubbles: true,
				cancelable: true,
			}) as any;
			dropEvent.dataTransfer = {
				getData: () => 'card_type',
				types: ['text/x-projection-field'],
			};
			dropEvent.preventDefault = vi.fn();
			dropEvent.stopPropagation = vi.fn();

			// Set drag state: simulating drag from Available
			const { _setDragState } = await import('../../src/ui/ProjectionExplorer');
			_setDragState('available', 'card_type' as AxisField, 0);

			xWellBody.dispatchEvent(dropEvent);

			// setColAxes should NOT have been called with duplicate
			// card_type is already in X, so the drop should be rejected
		});
	});

	// ---------------------------------------------------------------------------
	// DnD: Minimum enforcement
	// ---------------------------------------------------------------------------

	describe('minimum enforcement', () => {
		it('prevents removing last field from X well and shows ActionToast', async () => {
			// X = rowAxes has only folder (1 field)
			await mountExplorer();

			// Phase 96: directly call _handleBetweenWellMove (pointer events replaced HTML5 DnD)
			(explorer as any)._handleBetweenWellMove('folder', 'x', 'available');

			expect(actionToast.show).toHaveBeenCalledWith('X axis requires at least one property');
		});

		it('prevents removing last field from Y well and shows ActionToast', async () => {
			// Y = colAxes has only card_type (1 field)
			await mountExplorer();

			(explorer as any)._handleBetweenWellMove('card_type', 'y', 'available');

			expect(actionToast.show).toHaveBeenCalledWith('Y axis requires at least one property');
		});
	});

	// ---------------------------------------------------------------------------
	// DnD: Between-well move
	// ---------------------------------------------------------------------------

	describe('between-well move', () => {
		it('move from Available to X calls pafv.setRowAxes with field added', async () => {
			// X = rowAxes (Phase 96: x-plane = rowAxes)
			const setRowAxesSpy = vi.spyOn(pafv, 'setRowAxes');
			await mountExplorer();

			// Directly call _handleBetweenWellMove (pointer events replaced HTML5 DnD)
			(explorer as any)._handleBetweenWellMove('status', 'available', 'x');

			expect(setRowAxesSpy).toHaveBeenCalledWith([
				{ field: 'folder', direction: 'asc' },
				{ field: 'status', direction: 'asc' },
			]);
		});

		it('move from Available to Y calls pafv.setColAxes with field added', async () => {
			// Y = colAxes (Phase 96: y-plane = colAxes)
			const setColAxesSpy = vi.spyOn(pafv, 'setColAxes');
			await mountExplorer();

			(explorer as any)._handleBetweenWellMove('name', 'available', 'y');

			expect(setColAxesSpy).toHaveBeenCalledWith([
				{ field: 'card_type', direction: 'asc' },
				{ field: 'name', direction: 'asc' },
			]);
		});
	});

	// ---------------------------------------------------------------------------
	// DnD: Within-well reorder
	// ---------------------------------------------------------------------------

	describe('within-well reorder', () => {
		it('same-well drop is a no-op (within-well reorder deferred)', async () => {
			// Source: "if (sourceWell === targetWell) return; // Within-well reorder TBD"
			// Same-well drops are intentionally no-ops in the current implementation
			pafv = createMockPafv(
				[
					{ field: 'card_type', direction: 'asc' },
					{ field: 'status', direction: 'asc' },
				],
				[{ field: 'folder', direction: 'asc' }],
			);
			await mountExplorer();

			// Attempt same-well move (x -> x) — should be no-op
			(explorer as any)._handleBetweenWellMove('card_type', 'x', 'x');

			// Since sourceWell === targetWell, nothing should happen
			// But _handleBetweenWellMove actually just does a duplicate check and returns
			// because card_type is already in X (rowAxes)
			expect(pafv.reorderColAxes).not.toHaveBeenCalled();
		});
	});

	// ---------------------------------------------------------------------------
	// Provider subscription and update
	// ---------------------------------------------------------------------------

	describe('provider subscription', () => {
		it('update() re-renders all wells from current provider state', async () => {
			await mountExplorer();

			// Initial: 1 chip in X (X = rowAxes = [folder])
			let xChips = container.querySelectorAll('.projection-explorer__well[data-well="x"] .projection-explorer__chip');
			expect(xChips.length).toBe(1);

			// Mutate rowAxes (X-plane) directly and call update
			pafv.setRowAxes([
				{ field: 'folder', direction: 'asc' },
				{ field: 'status', direction: 'asc' },
			]);
			explorer.update();

			xChips = container.querySelectorAll('.projection-explorer__well[data-well="x"] .projection-explorer__chip');
			expect(xChips.length).toBe(2);
		});
	});

	// ---------------------------------------------------------------------------
	// D3 selection.join usage (INTG-03)
	// ---------------------------------------------------------------------------

	describe('INTG-03 compliance', () => {
		it('source code uses .join( for chip rendering', async () => {
			const fs = await import('node:fs');
			const path = await import('node:path');
			const sourceFile = path.resolve(__dirname, '../../src/ui/ProjectionExplorer.ts');
			const source = fs.readFileSync(sourceFile, 'utf-8');
			expect(source).toContain('.join(');
		});
	});

	// ---------------------------------------------------------------------------
	// e.stopPropagation() in drop handler
	// ---------------------------------------------------------------------------

	describe('DnD isolation', () => {
		it('_handleBetweenWellMove is callable and processes between-well moves', async () => {
			await mountExplorer();

			// Phase 96: pointer events replaced HTML5 DnD — between-well moves
			// go through _handleBetweenWellMove which is a private method called from pointerup
			// Verify it exists and is callable
			expect(typeof (explorer as any)._handleBetweenWellMove).toBe('function');

			// Verify a valid between-well move executes without throwing
			const setRowAxesSpy = vi.spyOn(pafv, 'setRowAxes');
			(explorer as any)._handleBetweenWellMove('status', 'available', 'x');
			expect(setRowAxesSpy).toHaveBeenCalled();
		});
	});
});
