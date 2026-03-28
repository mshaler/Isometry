// Tests for presetCommands factory — Phase 133 Plan 02
// Covers command generation, save-custom flow, delete flow, and category assignment.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPresetCommands } from '../../src/presets/presetCommands';
import type { LayoutPresetManager } from '../../src/presets/LayoutPresetManager';
import type { CommandRegistry } from '../../src/palette/CommandRegistry';
import type { CommandPalette } from '../../src/palette/CommandPalette';
import type { ActionToast } from '../../src/ui/ActionToast';
import type { MutationManager } from '../../src/mutations/MutationManager';
import type { AnyMutation } from '../../src/mutations/types';

// ---------------------------------------------------------------------------
// Minimal mocks
// ---------------------------------------------------------------------------

function makePresetManager(presets: Array<{ name: string; isBuiltIn: boolean }>): LayoutPresetManager {
	return {
		listAll: vi.fn().mockReturnValue(presets),
		applyPreset: vi.fn().mockReturnValue({}),
		saveCustom: vi.fn().mockResolvedValue(undefined),
		deleteCustom: vi.fn().mockResolvedValue(true),
		setAssociation: vi.fn().mockResolvedValue(undefined),
		getAssociation: vi.fn().mockResolvedValue(null),
		captureCurrentState: vi.fn().mockReturnValue({}),
		loadCustomPresets: vi.fn().mockResolvedValue(undefined),
		getPreset: vi.fn().mockReturnValue(null),
		isBuiltIn: vi.fn((name: string) => presets.find(p => p.name === name)?.isBuiltIn ?? false),
	} as unknown as LayoutPresetManager;
}

function makeRegistry(): CommandRegistry & { _registered: Array<{ id: string; category: string; label: string; execute: () => void }> } {
	const _registered: Array<{ id: string; category: string; label: string; execute: () => void }> = [];
	return {
		_registered,
		register: vi.fn((cmd: { id: string; category: string; label: string; execute: () => void }) => {
			_registered.push(cmd);
		}),
		registerAll: vi.fn((cmds: Array<{ id: string; category: string; label: string; execute: () => void }>) => {
			for (const cmd of cmds) {
				_registered.push(cmd);
			}
		}),
		unregisterByPrefix: vi.fn((prefix: string) => {
			const toRemove = _registered.filter(c => c.id.startsWith(prefix));
			for (const cmd of toRemove) {
				_registered.splice(_registered.indexOf(cmd), 1);
			}
		}),
		search: vi.fn().mockReturnValue([]),
		getVisible: vi.fn().mockReturnValue([]),
		getById: vi.fn().mockReturnValue(undefined),
	} as unknown as CommandRegistry & { _registered: Array<{ id: string; category: string; label: string; execute: () => void }> };
}

function makePalette(): CommandPalette {
	return {
		open: vi.fn(),
		close: vi.fn(),
		isVisible: vi.fn().mockReturnValue(false),
		mount: vi.fn(),
		destroy: vi.fn(),
		promptForInput: vi.fn(),
	} as unknown as CommandPalette;
}

function makeToast(): ActionToast {
	return {
		show: vi.fn(),
		dismiss: vi.fn(),
		destroy: vi.fn(),
	} as unknown as ActionToast;
}

function makeMutationManager(): MutationManager & { _executed: AnyMutation[] } {
	const _executed: AnyMutation[] = [];
	return {
		_executed,
		execute: vi.fn((m: AnyMutation) => {
			_executed.push(m);
			return Promise.resolve();
		}),
		undo: vi.fn(),
		redo: vi.fn(),
		canUndo: vi.fn().mockReturnValue(false),
		canRedo: vi.fn().mockReturnValue(false),
		isDirty: vi.fn().mockReturnValue(false),
		clearDirty: vi.fn(),
		subscribe: vi.fn().mockReturnValue(() => {}),
		setToast: vi.fn(),
		getHistory: vi.fn().mockReturnValue([]),
	} as unknown as MutationManager & { _executed: AnyMutation[] };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createPresetCommands', () => {
	const BUILT_IN_PRESETS = [
		{ name: 'Data Integration', isBuiltIn: true },
		{ name: 'Writing', isBuiltIn: true },
		{ name: 'LATCH Analytics', isBuiltIn: true },
		{ name: 'GRAPH Synthetics', isBuiltIn: true },
	];

	let presetManager: LayoutPresetManager;
	let registry: ReturnType<typeof makeRegistry>;
	let palette: CommandPalette;
	let toast: ActionToast;

	beforeEach(() => {
		presetManager = makePresetManager(BUILT_IN_PRESETS);
		registry = makeRegistry();
		palette = makePalette();
		toast = makeToast();
	});

	it('registers apply commands for all 4 built-in presets', () => {
		createPresetCommands({ presetManager, registry, palette, actionToast: toast });
		const applyCommands = registry._registered.filter(c => c.id.startsWith('preset:apply:'));
		expect(applyCommands).toHaveLength(4);
		expect(applyCommands.map(c => c.label)).toEqual([
			'Apply Preset: Data Integration',
			'Apply Preset: Writing',
			'Apply Preset: LATCH Analytics',
			'Apply Preset: GRAPH Synthetics',
		]);
	});

	it('registers a Save Layout as Preset command', () => {
		createPresetCommands({ presetManager, registry, palette, actionToast: toast });
		const saveCmd = registry._registered.find(c => c.id === 'preset:save');
		expect(saveCmd).toBeDefined();
		expect(saveCmd!.label).toBe('Save Layout as Preset');
	});

	it('all registered preset commands have category Presets', () => {
		createPresetCommands({ presetManager, registry, palette, actionToast: toast });
		const presetCmds = registry._registered.filter(c => c.id.startsWith('preset:'));
		expect(presetCmds.length).toBeGreaterThan(0);
		for (const cmd of presetCmds) {
			expect(cmd.category).toBe('Presets');
		}
	});

	it('does not register delete commands for built-in presets', () => {
		createPresetCommands({ presetManager, registry, palette, actionToast: toast });
		const deleteCommands = registry._registered.filter(c => c.id.startsWith('preset:delete:'));
		expect(deleteCommands).toHaveLength(0);
	});

	it('registers delete commands for custom presets after they appear in listAll', () => {
		const presetsWithCustom = [
			...BUILT_IN_PRESETS,
			{ name: 'My Custom', isBuiltIn: false },
		];
		const managerWithCustom = makePresetManager(presetsWithCustom);
		createPresetCommands({ presetManager: managerWithCustom, registry, palette, actionToast: toast });
		const deleteCommands = registry._registered.filter(c => c.id.startsWith('preset:delete:'));
		expect(deleteCommands).toHaveLength(1);
		expect(deleteCommands[0]!.label).toBe('Delete Preset: My Custom');
	});

	it('apply command calls presetManager.applyPreset with the preset name', () => {
		createPresetCommands({ presetManager, registry, palette, actionToast: toast });
		const applyCmd = registry._registered.find(c => c.id === 'preset:apply:Writing');
		expect(applyCmd).toBeDefined();
		applyCmd!.execute();
		expect(presetManager.applyPreset).toHaveBeenCalledWith('Writing');
	});

	it('apply command shows toast with preset name', () => {
		createPresetCommands({ presetManager, registry, palette, actionToast: toast });
		const applyCmd = registry._registered.find(c => c.id === 'preset:apply:Writing');
		applyCmd!.execute();
		expect(toast.show).toHaveBeenCalledWith('Applied preset \u201CWriting\u201D');
	});

	it('delete command calls presetManager.deleteCustom with the preset name', async () => {
		const presetsWithCustom = [
			...BUILT_IN_PRESETS,
			{ name: 'My Custom', isBuiltIn: false },
		];
		const managerWithCustom = makePresetManager(presetsWithCustom);
		createPresetCommands({ presetManager: managerWithCustom, registry, palette, actionToast: toast });
		const deleteCmd = registry._registered.find(c => c.id === 'preset:delete:My Custom');
		expect(deleteCmd).toBeDefined();
		deleteCmd!.execute();
		await vi.waitFor(() => {
			expect(managerWithCustom.deleteCustom).toHaveBeenCalledWith('My Custom');
		});
	});

	it('delete command shows toast after deletion', async () => {
		const presetsWithCustom = [
			...BUILT_IN_PRESETS,
			{ name: 'My Custom', isBuiltIn: false },
		];
		const managerWithCustom = makePresetManager(presetsWithCustom);
		createPresetCommands({ presetManager: managerWithCustom, registry, palette, actionToast: toast });
		const deleteCmd = registry._registered.find(c => c.id === 'preset:delete:My Custom');
		deleteCmd!.execute();
		await vi.waitFor(() => {
			expect(toast.show).toHaveBeenCalledWith('Preset \u201CMy Custom\u201D deleted');
		});
	});

	it('save command calls palette.promptForInput', () => {
		createPresetCommands({ presetManager, registry, palette, actionToast: toast });
		const saveCmd = registry._registered.find(c => c.id === 'preset:save');
		saveCmd!.execute();
		expect(palette.promptForInput).toHaveBeenCalledWith(
			'Name your preset\u2026',
			expect.any(Function),
		);
	});

	it('save onConfirm calls presetManager.saveCustom with the name', async () => {
		let capturedOnConfirm: ((name: string) => void) | null = null;
		(palette.promptForInput as ReturnType<typeof vi.fn>).mockImplementation(
			(_placeholder: string, onConfirm: (name: string) => void) => {
				capturedOnConfirm = onConfirm;
			},
		);
		createPresetCommands({ presetManager, registry, palette, actionToast: toast });
		const saveCmd = registry._registered.find(c => c.id === 'preset:save');
		saveCmd!.execute();
		expect(capturedOnConfirm).not.toBeNull();
		capturedOnConfirm!('My New Preset');
		await vi.waitFor(() => {
			expect(presetManager.saveCustom).toHaveBeenCalledWith('My New Preset');
		});
	});

	it('save onConfirm shows toast with saved name', async () => {
		let capturedOnConfirm: ((name: string) => void) | null = null;
		(palette.promptForInput as ReturnType<typeof vi.fn>).mockImplementation(
			(_placeholder: string, onConfirm: (name: string) => void) => {
				capturedOnConfirm = onConfirm;
			},
		);
		createPresetCommands({ presetManager, registry, palette, actionToast: toast });
		const saveCmd = registry._registered.find(c => c.id === 'preset:save');
		saveCmd!.execute();
		capturedOnConfirm!('My New Preset');
		await vi.waitFor(() => {
			expect(toast.show).toHaveBeenCalledWith('Preset \u201CMy New Preset\u201D saved');
		});
	});

	it('apply command calls setAssociation when getActiveDatasetId returns a value', () => {
		const getActiveDatasetId = vi.fn().mockReturnValue('ds-123');
		createPresetCommands({ presetManager, registry, palette, actionToast: toast, getActiveDatasetId });
		const applyCmd = registry._registered.find(c => c.id === 'preset:apply:Writing');
		applyCmd!.execute();
		expect(presetManager.setAssociation).toHaveBeenCalledWith('ds-123', 'Writing');
	});

	it('apply command does not call setAssociation when getActiveDatasetId returns null', () => {
		const getActiveDatasetId = vi.fn().mockReturnValue(null);
		createPresetCommands({ presetManager, registry, palette, actionToast: toast, getActiveDatasetId });
		const applyCmd = registry._registered.find(c => c.id === 'preset:apply:Writing');
		applyCmd!.execute();
		expect(presetManager.setAssociation).not.toHaveBeenCalled();
	});
});

describe('createPresetCommands — CallbackMutation undo wiring (D-11)', () => {
	const BUILT_IN_PRESETS = [
		{ name: 'Data Integration', isBuiltIn: true },
		{ name: 'Writing', isBuiltIn: true },
		{ name: 'LATCH Analytics', isBuiltIn: true },
		{ name: 'GRAPH Synthetics', isBuiltIn: true },
	];

	it('apply command calls mutationManager.execute with a CallbackMutation', () => {
		const presetManager = makePresetManager(BUILT_IN_PRESETS);
		// Return a non-null previousStates so the undo path executes
		(presetManager.applyPreset as ReturnType<typeof vi.fn>).mockReturnValue({ supergrid: true });
		(presetManager.getPreset as ReturnType<typeof vi.fn>).mockReturnValue({ supergrid: false });
		const registry = makeRegistry();
		const palette = makePalette();
		const toast = makeToast();
		const mm = makeMutationManager();
		const restoreSectionStates = vi.fn();

		createPresetCommands({
			presetManager,
			registry,
			palette,
			actionToast: toast,
			mutationManager: mm,
			restoreSectionStates,
		});

		const applyCmd = registry._registered.find(c => c.id === 'preset:apply:Writing');
		applyCmd!.execute();

		expect(mm.execute).toHaveBeenCalledTimes(1);
		const mutation = mm._executed[0]!;
		expect(mutation.description).toContain('Writing');
		// forward and inverse are functions (CallbackMutation), not arrays
		expect(typeof mutation.forward).toBe('function');
		expect(typeof mutation.inverse).toBe('function');
	});

	it('CallbackMutation forward calls restoreSectionStates with preset map', () => {
		const presetManager = makePresetManager(BUILT_IN_PRESETS);
		(presetManager.applyPreset as ReturnType<typeof vi.fn>).mockReturnValue({ old: true });
		(presetManager.getPreset as ReturnType<typeof vi.fn>).mockReturnValue({ supergrid: false });
		const registry = makeRegistry();
		const palette = makePalette();
		const toast = makeToast();
		const mm = makeMutationManager();
		const restoreSectionStates = vi.fn();

		createPresetCommands({
			presetManager,
			registry,
			palette,
			actionToast: toast,
			mutationManager: mm,
			restoreSectionStates,
		});

		const applyCmd = registry._registered.find(c => c.id === 'preset:apply:Writing');
		applyCmd!.execute();

		const mutation = mm._executed[0]!;
		(mutation.forward as () => void)();
		expect(restoreSectionStates).toHaveBeenCalledWith(
			expect.any(Map),
		);
	});

	it('CallbackMutation inverse calls restoreSectionStates with previous states', () => {
		const previousStates = { latch: true, notebook: false };
		const presetManager = makePresetManager(BUILT_IN_PRESETS);
		(presetManager.applyPreset as ReturnType<typeof vi.fn>).mockReturnValue(previousStates);
		(presetManager.getPreset as ReturnType<typeof vi.fn>).mockReturnValue({ supergrid: false });
		const registry = makeRegistry();
		const palette = makePalette();
		const toast = makeToast();
		const mm = makeMutationManager();
		const restoreSectionStates = vi.fn();

		createPresetCommands({
			presetManager,
			registry,
			palette,
			actionToast: toast,
			mutationManager: mm,
			restoreSectionStates,
		});

		const applyCmd = registry._registered.find(c => c.id === 'preset:apply:Writing');
		applyCmd!.execute();

		const mutation = mm._executed[0]!;
		(mutation.inverse as () => void)();
		const calledWith = restoreSectionStates.mock.calls[0]![0] as Map<string, boolean>;
		expect(calledWith.get('latch')).toBe(true);
		expect(calledWith.get('notebook')).toBe(false);
	});

	it('apply command does NOT export undoPresetApply', async () => {
		// Verify the module has no undoPresetApply export
		const mod = await import('../../src/presets/presetCommands');
		expect((mod as Record<string, unknown>)['undoPresetApply']).toBeUndefined();
	});
});
