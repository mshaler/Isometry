// Isometry v10 — Phase 133 Plan 01
// LayoutPresetManager unit tests
//
// Requirements: PRST-01, PRST-04

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILT_IN_PRESETS } from '../../src/presets/builtInPresets';
import type { BuiltInPreset } from '../../src/presets/builtInPresets';
import { LayoutPresetManager } from '../../src/presets/LayoutPresetManager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECTION_KEYS = ['notebook', 'properties', 'projection', 'latch', 'calc', 'algorithm'];

function makeBridge(uiStateStore: Map<string, string> = new Map()) {
	const send = vi.fn().mockImplementation((cmd: string, args: Record<string, unknown>) => {
		if (cmd === 'ui:getAll') {
			const rows = Array.from(uiStateStore.entries()).map(([key, value]) => ({ key, value }));
			return Promise.resolve(rows);
		}
		if (cmd === 'ui:get') {
			const key = args['key'] as string;
			const value = uiStateStore.get(key) ?? null;
			return Promise.resolve(value != null ? { value } : null);
		}
		if (cmd === 'ui:set') {
			const key = args['key'] as string;
			const value = args['value'] as string;
			uiStateStore.set(key, value);
			return Promise.resolve(undefined);
		}
		if (cmd === 'ui:delete') {
			const key = args['key'] as string;
			uiStateStore.delete(key);
			return Promise.resolve(undefined);
		}
		return Promise.resolve(undefined);
	});
	return { send };
}

function makeShell(initial?: Map<string, boolean>) {
	const state: Map<string, boolean> = initial ?? new Map([
		['notebook', true],
		['properties', false],
		['projection', false],
		['latch', false],
		['calc', true],
		['algorithm', true],
	]);
	const getSectionStates = vi.fn(() => new Map(state));
	const restoreSectionStates = vi.fn((states: Map<string, boolean>) => {
		for (const [k, v] of states) {
			state.set(k, v);
		}
	});
	return { getSectionStates, restoreSectionStates, state };
}

// ---------------------------------------------------------------------------
// Built-in presets
// ---------------------------------------------------------------------------

describe('BUILT_IN_PRESETS', () => {
	it('has exactly 4 entries', () => {
		expect(BUILT_IN_PRESETS).toHaveLength(4);
	});

	it('has the correct preset names', () => {
		const names = BUILT_IN_PRESETS.map((p: BuiltInPreset) => p.name);
		expect(names).toContain('Data Integration');
		expect(names).toContain('Writing');
		expect(names).toContain('LATCH Analytics');
		expect(names).toContain('GRAPH Synthetics');
	});

	it('each preset has a panels object with exactly 6 keys', () => {
		for (const preset of BUILT_IN_PRESETS) {
			const keys = Object.keys(preset.panels);
			expect(keys).toHaveLength(6);
			for (const k of SECTION_KEYS) {
				expect(keys).toContain(k);
			}
		}
	});

	it('each panels value is a boolean', () => {
		for (const preset of BUILT_IN_PRESETS) {
			for (const v of Object.values(preset.panels)) {
				expect(typeof v).toBe('boolean');
			}
		}
	});
});

// ---------------------------------------------------------------------------
// LayoutPresetManager — list and get
// ---------------------------------------------------------------------------

describe('LayoutPresetManager.listAll', () => {
	it('returns all 4 built-in presets when no custom presets exist', async () => {
		const bridge = makeBridge();
		const shell = makeShell();
		const mgr = new LayoutPresetManager(shell.getSectionStates, shell.restoreSectionStates, bridge);
		await mgr.loadCustomPresets();
		const list = mgr.listAll();
		expect(list).toHaveLength(4);
		const names = list.map((p) => p.name);
		expect(names).toContain('Data Integration');
		expect(names).toContain('Writing');
		expect(names).toContain('LATCH Analytics');
		expect(names).toContain('GRAPH Synthetics');
	});

	it('returns built-ins first, then custom presets alphabetically', async () => {
		const store = new Map([
			['preset:name:Zebra', JSON.stringify({ notebook: false, properties: false, projection: false, latch: false, calc: false, algorithm: false })],
			['preset:name:Alpha', JSON.stringify({ notebook: true, properties: true, projection: true, latch: true, calc: true, algorithm: true })],
		]);
		const bridge = makeBridge(store);
		const shell = makeShell();
		const mgr = new LayoutPresetManager(shell.getSectionStates, shell.restoreSectionStates, bridge);
		await mgr.loadCustomPresets();
		const list = mgr.listAll();
		expect(list).toHaveLength(6);
		// First 4 are built-ins
		const builtInNames = BUILT_IN_PRESETS.map((p: BuiltInPreset) => p.name);
		for (let i = 0; i < 4; i++) {
			expect(builtInNames).toContain(list[i]!.name);
			expect(list[i]!.isBuiltIn).toBe(true);
		}
		// Custom presets are alphabetical
		expect(list[4]!.name).toBe('Alpha');
		expect(list[5]!.name).toBe('Zebra');
		expect(list[4]!.isBuiltIn).toBe(false);
		expect(list[5]!.isBuiltIn).toBe(false);
	});
});

describe('LayoutPresetManager.getPreset', () => {
	it('returns the correct Record for a built-in preset', async () => {
		const bridge = makeBridge();
		const shell = makeShell();
		const mgr = new LayoutPresetManager(shell.getSectionStates, shell.restoreSectionStates, bridge);
		await mgr.loadCustomPresets();
		const panels = mgr.getPreset('Writing');
		expect(panels).not.toBeNull();
		expect(typeof panels).toBe('object');
		// Writing: notebook=false, properties=false open
		expect(panels!['notebook']).toBe(false);
		expect(panels!['properties']).toBe(false);
	});

	it('returns null for unknown preset name', async () => {
		const bridge = makeBridge();
		const shell = makeShell();
		const mgr = new LayoutPresetManager(shell.getSectionStates, shell.restoreSectionStates, bridge);
		await mgr.loadCustomPresets();
		expect(mgr.getPreset('NonExistent')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// LayoutPresetManager — isBuiltIn
// ---------------------------------------------------------------------------

describe('LayoutPresetManager.isBuiltIn', () => {
	it('returns true for built-in preset names', async () => {
		const bridge = makeBridge();
		const shell = makeShell();
		const mgr = new LayoutPresetManager(shell.getSectionStates, shell.restoreSectionStates, bridge);
		expect(mgr.isBuiltIn('Writing')).toBe(true);
		expect(mgr.isBuiltIn('Data Integration')).toBe(true);
		expect(mgr.isBuiltIn('LATCH Analytics')).toBe(true);
		expect(mgr.isBuiltIn('GRAPH Synthetics')).toBe(true);
	});

	it('returns false for custom or unknown names', async () => {
		const bridge = makeBridge();
		const shell = makeShell();
		const mgr = new LayoutPresetManager(shell.getSectionStates, shell.restoreSectionStates, bridge);
		expect(mgr.isBuiltIn('My Custom')).toBe(false);
		expect(mgr.isBuiltIn('')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// LayoutPresetManager — saveCustom / deleteCustom
// ---------------------------------------------------------------------------

describe('LayoutPresetManager.saveCustom', () => {
	it('persists via bridge and appears in listAll()', async () => {
		const store = new Map<string, string>();
		const bridge = makeBridge(store);
		const shell = makeShell();
		const mgr = new LayoutPresetManager(shell.getSectionStates, shell.restoreSectionStates, bridge);
		await mgr.loadCustomPresets();

		await mgr.saveCustom('My Layout');
		const list = mgr.listAll();
		expect(list.find((p) => p.name === 'My Layout')).toBeDefined();
		expect(store.has('preset:name:My Layout')).toBe(true);
	});

	it('persists provided states instead of reading current', async () => {
		const store = new Map<string, string>();
		const bridge = makeBridge(store);
		const shell = makeShell();
		const mgr = new LayoutPresetManager(shell.getSectionStates, shell.restoreSectionStates, bridge);
		await mgr.loadCustomPresets();

		const customStates: Record<string, boolean> = {
			notebook: false, properties: false, projection: true, latch: true, calc: false, algorithm: false,
		};
		await mgr.saveCustom('Explicit', customStates);
		const saved = JSON.parse(store.get('preset:name:Explicit')!);
		expect(saved).toEqual(customStates);
		// getSectionStates should NOT be called when states provided
		expect(shell.getSectionStates).not.toHaveBeenCalled();
	});
});

describe('LayoutPresetManager.deleteCustom', () => {
	it('removes from persistence and listAll()', async () => {
		const store = new Map([
			['preset:name:Temp', JSON.stringify({ notebook: false, properties: false, projection: false, latch: false, calc: false, algorithm: false })],
		]);
		const bridge = makeBridge(store);
		const shell = makeShell();
		const mgr = new LayoutPresetManager(shell.getSectionStates, shell.restoreSectionStates, bridge);
		await mgr.loadCustomPresets();

		const result = await mgr.deleteCustom('Temp');
		expect(result).toBe(true);
		expect(mgr.listAll().find((p) => p.name === 'Temp')).toBeUndefined();
		expect(store.has('preset:name:Temp')).toBe(false);
	});

	it('no-ops and returns false for built-in names', async () => {
		const bridge = makeBridge();
		const shell = makeShell();
		const mgr = new LayoutPresetManager(shell.getSectionStates, shell.restoreSectionStates, bridge);
		await mgr.loadCustomPresets();

		const result = await mgr.deleteCustom('Writing');
		expect(result).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// LayoutPresetManager — applyPreset
// ---------------------------------------------------------------------------

describe('LayoutPresetManager.applyPreset', () => {
	it('calls restoreSectionStates with correct Map for built-in', async () => {
		const bridge = makeBridge();
		const shell = makeShell();
		const mgr = new LayoutPresetManager(shell.getSectionStates, shell.restoreSectionStates, bridge);
		await mgr.loadCustomPresets();

		const prev = mgr.applyPreset('Data Integration');
		expect(prev).not.toBeNull();
		expect(shell.restoreSectionStates).toHaveBeenCalledOnce();
		const appliedMap = shell.restoreSectionStates.mock.calls[0]![0] as Map<string, boolean>;
		// Data Integration: all collapsed
		expect(appliedMap.get('notebook')).toBe(true);
		expect(appliedMap.get('properties')).toBe(true);
		expect(appliedMap.get('projection')).toBe(true);
		expect(appliedMap.get('latch')).toBe(true);
		expect(appliedMap.get('calc')).toBe(true);
		expect(appliedMap.get('algorithm')).toBe(true);
	});

	it('returns null for unknown preset', async () => {
		const bridge = makeBridge();
		const shell = makeShell();
		const mgr = new LayoutPresetManager(shell.getSectionStates, shell.restoreSectionStates, bridge);
		await mgr.loadCustomPresets();

		const result = mgr.applyPreset('DoesNotExist');
		expect(result).toBeNull();
	});

	it('returns the previous states before applying', async () => {
		const initial = new Map([
			['notebook', false],
			['properties', false],
			['projection', true],
			['latch', true],
			['calc', false],
			['algorithm', false],
		]);
		const bridge = makeBridge();
		const shell = makeShell(initial);
		const mgr = new LayoutPresetManager(shell.getSectionStates, shell.restoreSectionStates, bridge);
		await mgr.loadCustomPresets();

		const prev = mgr.applyPreset('Writing');
		expect(prev).not.toBeNull();
		// prev should reflect the state BEFORE apply
		expect(prev!['notebook']).toBe(false);
		expect(prev!['projection']).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// LayoutPresetManager — setAssociation / getAssociation
// ---------------------------------------------------------------------------

describe('LayoutPresetManager.setAssociation / getAssociation', () => {
	it('persists to ui_state as preset:association:{datasetId}', async () => {
		const store = new Map<string, string>();
		const bridge = makeBridge(store);
		const shell = makeShell();
		const mgr = new LayoutPresetManager(shell.getSectionStates, shell.restoreSectionStates, bridge);

		await mgr.setAssociation('ds-123', 'Writing');
		expect(store.get('preset:association:ds-123')).toBe('Writing');
	});

	it('getAssociation returns preset name or null', async () => {
		const store = new Map([['preset:association:ds-456', 'LATCH Analytics']]);
		const bridge = makeBridge(store);
		const shell = makeShell();
		const mgr = new LayoutPresetManager(shell.getSectionStates, shell.restoreSectionStates, bridge);

		expect(await mgr.getAssociation('ds-456')).toBe('LATCH Analytics');
		expect(await mgr.getAssociation('ds-000')).toBeNull();
	});
});
