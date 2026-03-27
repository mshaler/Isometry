// Isometry v10 — Phase 133 Plan 01
// LayoutPresetManager: core preset data layer.
//
// Manages 4 built-in presets (immutable) + custom presets persisted to ui_state.
// Serialization format: Record<storageKey, boolean> stored as JSON string.
//
// Storage key conventions:
//   - Custom preset data:    preset:name:{presetName}
//   - Dataset association:   preset:association:{datasetId}
//
// Requirements: PRST-01, PRST-04

import { BUILT_IN_PRESETS } from './builtInPresets';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Bridge {
	send(cmd: string, args: Record<string, unknown>): Promise<unknown>;
}

interface UiGetAllRow {
	key: string;
	value: string;
}

// ---------------------------------------------------------------------------
// LayoutPresetManager
// ---------------------------------------------------------------------------

export class LayoutPresetManager {
	/** Custom presets loaded from ui_state, keyed by preset name */
	private readonly _custom = new Map<string, Record<string, boolean>>();

	private readonly _getSectionStates: () => Map<string, boolean>;
	private readonly _restoreSectionStates: (states: Map<string, boolean>) => void;
	private readonly _bridge: Bridge;

	constructor(
		getSectionStates: () => Map<string, boolean>,
		restoreSectionStates: (states: Map<string, boolean>) => void,
		bridge: Bridge,
	) {
		this._getSectionStates = getSectionStates;
		this._restoreSectionStates = restoreSectionStates;
		this._bridge = bridge;
	}

	/**
	 * Load all custom presets from ui_state. Call once at boot.
	 */
	async loadCustomPresets(): Promise<void> {
		const rows = (await this._bridge.send('ui:getAll', {})) as UiGetAllRow[];
		this._custom.clear();
		for (const row of rows) {
			if (row.key.startsWith('preset:name:')) {
				const name = row.key.slice('preset:name:'.length);
				try {
					const panels = JSON.parse(row.value) as Record<string, boolean>;
					this._custom.set(name, panels);
				} catch {
					// Corrupt entry — skip
				}
			}
		}
	}

	/**
	 * Returns all presets: built-ins first (in definition order), then custom (alphabetically).
	 */
	listAll(): Array<{ name: string; isBuiltIn: boolean }> {
		const builtIns = BUILT_IN_PRESETS.map((p) => ({ name: p.name, isBuiltIn: true }));
		const customNames = Array.from(this._custom.keys()).sort();
		const customs = customNames.map((name) => ({ name, isBuiltIn: false }));
		return [...builtIns, ...customs];
	}

	/**
	 * Returns the panel dict for a built-in or custom preset, or null if not found.
	 */
	getPreset(name: string): Record<string, boolean> | null {
		const builtIn = BUILT_IN_PRESETS.find((p) => p.name === name);
		if (builtIn) return { ...builtIn.panels };
		return this._custom.get(name) ?? null;
	}

	/**
	 * Returns true if name matches a built-in preset.
	 */
	isBuiltIn(name: string): boolean {
		return BUILT_IN_PRESETS.some((p) => p.name === name);
	}

	/**
	 * Applies a preset by name. Calls restoreSectionStates with the preset's Map.
	 * Returns the previous states as a Record for undo, or null if preset not found.
	 */
	applyPreset(name: string): Record<string, boolean> | null {
		const panels = this.getPreset(name);
		if (panels === null) return null;

		// Capture current state before applying
		const prev = this.captureCurrentState();

		// Convert Record to Map and restore
		const stateMap = new Map<string, boolean>(Object.entries(panels));
		this._restoreSectionStates(stateMap);

		return prev;
	}

	/**
	 * Save a custom preset. If states not provided, captures the current section states.
	 * Persists to ui_state as `preset:name:{name}`.
	 */
	async saveCustom(name: string, states?: Record<string, boolean>): Promise<void> {
		const panels = states ?? this.captureCurrentState();
		this._custom.set(name, panels);
		await this._bridge.send('ui:set', { key: `preset:name:${name}`, value: JSON.stringify(panels) });
	}

	/**
	 * Delete a custom preset. No-ops and returns false if name is a built-in.
	 * Returns true on success.
	 */
	async deleteCustom(name: string): Promise<boolean> {
		if (this.isBuiltIn(name)) return false;
		if (!this._custom.has(name)) return false;
		this._custom.delete(name);
		await this._bridge.send('ui:delete', { key: `preset:name:${name}` });
		return true;
	}

	/**
	 * Persist a dataset-to-preset association.
	 */
	async setAssociation(datasetId: string, presetName: string): Promise<void> {
		await this._bridge.send('ui:set', { key: `preset:association:${datasetId}`, value: presetName });
	}

	/**
	 * Read a dataset-to-preset association. Returns null if not found.
	 */
	async getAssociation(datasetId: string): Promise<string | null> {
		const result = (await this._bridge.send('ui:get', { key: `preset:association:${datasetId}` })) as { value: string } | null;
		return result?.value ?? null;
	}

	/**
	 * Capture the current section states as a Record<storageKey, boolean>.
	 */
	captureCurrentState(): Record<string, boolean> {
		const stateMap = this._getSectionStates();
		const record: Record<string, boolean> = {};
		for (const [k, v] of stateMap) {
			record[k] = v;
		}
		return record;
	}
}
