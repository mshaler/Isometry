// Isometry v10 — Phase 133 Plan 02
// Preset commands factory: wires LayoutPresetManager into the command palette.
//
// Creates apply/save/delete PaletteCommands from LayoutPresetManager's preset list.
// Custom presets refresh dynamically after save/delete.
//
// Requirements: PRST-02, PRST-03

import type { ActionToast } from '../ui/ActionToast';
import type { CommandPalette } from '../palette/CommandPalette';
import type { CommandRegistry } from '../palette/CommandRegistry';
import type { MutationManager } from '../mutations/MutationManager';
import type { LayoutPresetManager } from './LayoutPresetManager';

// ---------------------------------------------------------------------------
// createPresetCommands
// ---------------------------------------------------------------------------

export interface PresetCommandsDeps {
	presetManager: LayoutPresetManager;
	registry: CommandRegistry;
	palette: CommandPalette;
	actionToast: ActionToast;
	/** MutationManager for registering undoable preset apply (D-11). Optional for backward compat. */
	mutationManager?: MutationManager;
	/** Restores section states — required when mutationManager is provided. */
	restoreSectionStates?: (states: Map<string, boolean>) => void;
	/** Returns the active dataset ID for setAssociation wiring. Optional. */
	getActiveDatasetId?: () => string | null;
}

/**
 * Registers preset commands in the command registry.
 *
 * Generates:
 * - "Apply Preset: {name}" for every preset (built-in + custom)
 * - "Delete Preset: {name}" for custom presets only
 * - "Save Layout as Preset" (always present)
 *
 * Commands refresh dynamically after save/delete via internal refreshCommands().
 */
export function createPresetCommands(deps: PresetCommandsDeps): void {
	const { presetManager, registry, palette, actionToast, mutationManager, restoreSectionStates, getActiveDatasetId } = deps;

	function refreshCommands(): void {
		// Remove all previously registered preset:* commands
		registry.unregisterByPrefix('preset:');

		const presets = presetManager.listAll();

		for (const preset of presets) {
			const name = preset.name;

			// Apply command for every preset
			registry.register({
				id: `preset:apply:${name}`,
				label: `Apply Preset: ${name}`,
				category: 'Presets',
				execute: () => {
					const previousStates = presetManager.applyPreset(name);
					if (previousStates && mutationManager && restoreSectionStates) {
						// Register as undoable mutation per D-11
						const presetPanels = presetManager.getPreset(name);
						if (presetPanels) {
							const presetMap = new Map(Object.entries(presetPanels));
							const prevMap = new Map(Object.entries(previousStates));
							void mutationManager.execute({
								id: crypto.randomUUID(),
								timestamp: Date.now(),
								description: `Applied preset \u201C${name}\u201D`,
								forward: () => restoreSectionStates(presetMap),
								inverse: () => restoreSectionStates(prevMap),
							});
						}
					}
					actionToast.show(`Applied preset \u201C${name}\u201D`);
					const datasetId = getActiveDatasetId?.();
					if (datasetId) {
						void presetManager.setAssociation(datasetId, name);
					}
				},
			});

			// Delete command only for custom presets
			if (!preset.isBuiltIn) {
				registry.register({
					id: `preset:delete:${name}`,
					label: `Delete Preset: ${name}`,
					category: 'Presets',
					execute: () => {
						void presetManager.deleteCustom(name).then(() => {
							actionToast.show(`Preset \u201C${name}\u201D deleted`);
							refreshCommands();
						});
					},
				});
			}
		}

		// Save command — always present
		registry.register({
			id: 'preset:save',
			label: 'Save Layout as Preset',
			category: 'Presets',
			execute: () => {
				palette.promptForInput('Name your preset\u2026', (inputName) => {
					void presetManager.saveCustom(inputName).then(() => {
						actionToast.show(`Preset \u201C${inputName}\u201D saved`);
						refreshCommands();
					});
				});
			},
		});
	}

	// Initial population
	refreshCommands();
}
