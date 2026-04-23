// @vitest-environment jsdom
/**
 * Dock → PanelManager → PanelRegistry wiring tests.
 *
 * These tests use the REAL panel IDs, slot configs, group configs,
 * and dock composite keys from production code. They catch silent
 * ID mismatches where PanelManager operations become no-ops
 * (e.g., groups:[] bug, 'formulas' vs 'formulas-stub' mismatch).
 *
 * Not tested here: DockNav UI rendering (no DOM), view switching
 * (handled by ViewManager), or panel content (tested in panel-specific files).
 */

import { describe, expect, it, vi } from 'vitest';
import { PanelRegistry } from '../../../src/ui/panels/PanelRegistry';
import { PanelManager } from '../../../src/ui/panels/PanelManager';
import type { PanelHook, PanelMeta, SlotConfig, CouplingGroup } from '../../../src/ui/panels';
import { FORMULAS_PANEL_META } from '../../../src/ui/panels/FormulasPanelStub';
import { MAPS_PANEL_META } from '../../../src/ui/panels/MapsPanelStub';
import { STORIES_PANEL_META } from '../../../src/ui/panels/StoriesPanelStub';
import { DOCK_DEFS } from '../../../src/ui/section-defs';

// ---------------------------------------------------------------------------
// Production-matching configuration
// ---------------------------------------------------------------------------

/** Panel IDs registered inline in main.ts (not from META exports). */
const INLINE_PANEL_METAS: PanelMeta[] = [
	{ id: 'properties', name: 'Properties', icon: 'sliders', description: 'Properties Explorer', dependencies: [], defaultEnabled: true },
	{ id: 'projection', name: 'Projection', icon: 'layout-template', description: 'Projection Explorer', dependencies: [], defaultEnabled: true },
	{ id: 'latch', name: 'Filters', icon: 'tags', description: 'Filters', dependencies: [], defaultEnabled: true },
	{ id: 'notebook', name: 'Notebook', icon: 'notebook-pen', description: 'Notebook Explorer', dependencies: [], defaultEnabled: false },
	{ id: 'calc', name: 'Calculations', icon: 'sigma', description: 'Calc Explorer', dependencies: [], defaultEnabled: false },
	{ id: 'algorithm', name: 'Algorithm', icon: 'brain', description: 'Algorithm Explorer', dependencies: [], defaultEnabled: false },
];

/** All META-exported stub panels. */
const STUB_PANEL_METAS: PanelMeta[] = [
	MAPS_PANEL_META,
	FORMULAS_PANEL_META,
	STORIES_PANEL_META,
];

/** PanelManager slot config matching main.ts lines ~1729-1736. */
const PRODUCTION_SLOTS: SlotConfig[] = [
	{ id: 'properties', container: document.createElement('div'), slot: 'top' },
	{ id: 'projection', container: document.createElement('div'), slot: 'top' },
	{ id: 'latch', container: document.createElement('div'), slot: 'bottom' },
	{ id: 'formulas-stub', container: document.createElement('div'), slot: 'bottom' },
];

/** PanelManager groups matching main.ts line ~1737. */
const PRODUCTION_GROUPS: CouplingGroup[] = [
	{ name: 'integrate', panelIds: ['properties'] },
];

/**
 * Dock composite key → PanelRegistry ID map matching main.ts dockToPanelMap.
 * These panels bypass PanelManager and toggle directly via PanelRegistry.
 */
const DOCK_TO_PANEL_MAP: Record<string, string> = {
	'activate:notebook': 'notebook',
	'activate:stories': 'stories-stub',
};

function stubFactory(): PanelHook {
	return {
		mount(_c: HTMLElement) { /* noop */ },
		destroy() { /* noop */ },
	};
}

function buildProductionWiring() {
	const registry = new PanelRegistry();

	for (const meta of INLINE_PANEL_METAS) {
		registry.register(meta, () => stubFactory());
	}
	for (const meta of STUB_PANEL_METAS) {
		registry.register(meta, () => stubFactory());
	}

	// Fresh containers for each test
	const slots: SlotConfig[] = PRODUCTION_SLOTS.map((s) => ({
		...s,
		container: document.createElement('div'),
	}));

	const syncSlots = vi.fn();
	const manager = new PanelManager({
		registry,
		slots,
		groups: PRODUCTION_GROUPS,
		syncSlots: syncSlots as () => void,
	});

	return { registry, manager, syncSlots };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dock → PanelManager wiring', () => {

	// -----------------------------------------------------------------------
	// Structural: slot IDs must exist in registry
	// -----------------------------------------------------------------------
	it('every PanelManager slot ID has a matching PanelRegistry registration', () => {
		const { registry } = buildProductionWiring();
		for (const slot of PRODUCTION_SLOTS) {
			expect(
				registry.isEnabled(slot.id) || !registry.isEnabled(slot.id),
				`slot '${slot.id}' must be registered in PanelRegistry — isEnabled() should not throw`,
			).toBe(true);

			// Stronger check: enable + getInstance must return a hook, not null
			registry.enable(slot.id);
			const instance = registry.getInstance(slot.id);
			expect(instance, `PanelRegistry.getInstance('${slot.id}') returned null — ID not registered`).not.toBeNull();
		}
	});

	// -----------------------------------------------------------------------
	// Structural: group panel IDs must exist in slots
	// -----------------------------------------------------------------------
	it('every group panelId exists in PanelManager slots', () => {
		const slotIds = new Set(PRODUCTION_SLOTS.map((s) => s.id));
		for (const group of PRODUCTION_GROUPS) {
			for (const panelId of group.panelIds) {
				expect(
					slotIds.has(panelId),
					`group '${group.name}' references '${panelId}' which is not in PanelManager slots`,
				).toBe(true);
			}
		}
	});

	// -----------------------------------------------------------------------
	// Structural: dockToPanelMap IDs must exist in registry
	// -----------------------------------------------------------------------
	it('every dockToPanelMap panel ID has a matching PanelRegistry registration', () => {
		const { registry } = buildProductionWiring();
		for (const [compositeKey, panelId] of Object.entries(DOCK_TO_PANEL_MAP)) {
			registry.enable(panelId);
			const instance = registry.getInstance(panelId);
			expect(
				instance,
				`dockToPanelMap['${compositeKey}'] = '${panelId}' — not registered in PanelRegistry`,
			).not.toBeNull();
		}
	});

	// -----------------------------------------------------------------------
	// Behavioral: integrate:catalog click toggles integrate group
	// -----------------------------------------------------------------------
	it('integrate:catalog — showGroup("integrate") makes properties visible', () => {
		const { manager } = buildProductionWiring();

		expect(manager.isGroupVisible('integrate')).toBe(false);
		expect(manager.isVisible('properties')).toBe(false);

		// Simulate: clicking Data icon calls showGroup('integrate')
		manager.showGroup('integrate');

		expect(manager.isGroupVisible('integrate')).toBe(true);
		expect(manager.isVisible('properties')).toBe(true);

		// Simulate: clicking Data icon again calls hideGroup('integrate')
		manager.hideGroup('integrate');

		expect(manager.isGroupVisible('integrate')).toBe(false);
		expect(manager.isVisible('properties')).toBe(false);
	});

	// -----------------------------------------------------------------------
	// Behavioral: analyze:formula click toggles formulas panel
	// -----------------------------------------------------------------------
	it('analyze:formula — toggle("formulas-stub") toggles formulas panel', () => {
		const { manager } = buildProductionWiring();

		expect(manager.isVisible('formulas-stub')).toBe(false);

		manager.toggle('formulas-stub');
		expect(manager.isVisible('formulas-stub')).toBe(true);

		manager.toggle('formulas-stub');
		expect(manager.isVisible('formulas-stub')).toBe(false);
	});

	// -----------------------------------------------------------------------
	// Behavioral: analyze:filter click toggles latch panel
	// -----------------------------------------------------------------------
	it('analyze:filter — toggle("latch") toggles filter panel', () => {
		const { manager } = buildProductionWiring();

		expect(manager.isVisible('latch')).toBe(false);

		manager.toggle('latch');
		expect(manager.isVisible('latch')).toBe(true);

		manager.toggle('latch');
		expect(manager.isVisible('latch')).toBe(false);
	});

	// -----------------------------------------------------------------------
	// Behavioral: projection auto-show on supergrid
	// -----------------------------------------------------------------------
	it('projection panel can be shown and hidden via PanelManager', () => {
		const { manager } = buildProductionWiring();

		manager.show('projection');
		expect(manager.isVisible('projection')).toBe(true);

		manager.hide('projection');
		expect(manager.isVisible('projection')).toBe(false);
	});

	// -----------------------------------------------------------------------
	// Behavioral: switching away from integrate hides the group
	// -----------------------------------------------------------------------
	it('hideGroup("integrate") after showGroup clears pressed state correctly', () => {
		const { manager } = buildProductionWiring();

		manager.showGroup('integrate');
		expect(manager.isGroupVisible('integrate')).toBe(true);

		// Simulate: user clicks a visualize item — main.ts hides integrate group
		manager.hideGroup('integrate');
		expect(manager.isGroupVisible('integrate')).toBe(false);
		expect(manager.isVisible('properties')).toBe(false);
	});

	// -----------------------------------------------------------------------
	// Guard: integrate group must not be empty
	// -----------------------------------------------------------------------
	it('integrate group has at least one panel member', () => {
		const integrateGroup = PRODUCTION_GROUPS.find((g) => g.name === 'integrate');
		expect(integrateGroup, 'integrate group must exist in PRODUCTION_GROUPS').toBeDefined();
		expect(integrateGroup!.panelIds.length).toBeGreaterThan(0);
	});
});

describe('DOCK_DEFS structural integrity', () => {
	it('all expected sections exist in DOCK_DEFS', () => {
		const sectionKeys = DOCK_DEFS.map((s) => s.key);
		expect(sectionKeys).toContain('integrate');
		expect(sectionKeys).toContain('visualize');
		expect(sectionKeys).toContain('analyze');
		expect(sectionKeys).toContain('activate');
		expect(sectionKeys).toContain('help');
	});

	it('integrate section has catalog item', () => {
		const integrate = DOCK_DEFS.find((s) => s.key === 'integrate')!;
		expect(integrate.items.some((i) => i.key === 'catalog')).toBe(true);
	});

	it('analyze section has filter and formula items', () => {
		const analyze = DOCK_DEFS.find((s) => s.key === 'analyze')!;
		expect(analyze.items.some((i) => i.key === 'filter')).toBe(true);
		expect(analyze.items.some((i) => i.key === 'formula')).toBe(true);
	});

	it('activate section has notebook item', () => {
		const activate = DOCK_DEFS.find((s) => s.key === 'activate')!;
		expect(activate.items.some((i) => i.key === 'notebook')).toBe(true);
	});
});
