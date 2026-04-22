// Isometry v10 — Phase 133 Plan 01
// Built-in preset definitions for named layout presets.
//
// Requirements: PRST-01

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BuiltInPreset {
	name: string;
	panels: Record<string, boolean>; // storageKey -> collapsed (true = collapsed)
}

// ---------------------------------------------------------------------------
// Built-in presets
// ---------------------------------------------------------------------------

/**
 * 4 built-in presets. Panel keys correspond to PanelRegistry panel IDs
 * storageKeys: notebook, properties, projection, latch, calc, algorithm.
 *
 * Value: true = collapsed (hidden), false = expanded (visible).
 */
export const BUILT_IN_PRESETS: readonly BuiltInPreset[] = [
	{
		name: 'Data Integration',
		panels: {
			notebook: true,
			properties: true,
			projection: true,
			latch: true,
			calc: true,
			algorithm: true,
		},
	},
	{
		name: 'Writing',
		panels: {
			notebook: false,
			properties: false,
			projection: true,
			latch: true,
			calc: true,
			algorithm: true,
		},
	},
	{
		name: 'LATCH Analytics',
		panels: {
			notebook: true,
			properties: false,
			projection: false,
			latch: false,
			calc: true,
			algorithm: true,
		},
	},
	{
		name: 'GRAPH Synthetics',
		panels: {
			notebook: true,
			properties: true,
			projection: false,
			latch: true,
			calc: true,
			algorithm: false,
		},
	},
] as const;
