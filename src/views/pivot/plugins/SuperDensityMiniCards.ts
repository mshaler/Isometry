// Isometry v5 — Phase 102 Plan 01 SuperDensityMiniCards Plugin
// Compact icon+title cell layout at high density.
//
// Design:
//   - Adds .pv-cell--mini-card class to all .pv-data-cell elements when density is 'compact'
//   - Removes class when density changes to non-compact
//   - Registers as DensityState listener to react to toolbar toggles
//   - destroy: removes .pv-cell--mini-card from all cells, unregisters listener
//
// Requirements: DENS-02

import type { PluginHook, RenderContext } from './PluginTypes';
import type { DensityState } from './SuperDensityModeSwitch';

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Factory for the superdensity.mini-cards plugin.
 *
 * @param densityState - Shared density state from createDensityState(). Must be
 *   the same object reference passed to createSuperDensityModeSwitchPlugin().
 */
export function createSuperDensityMiniCardsPlugin(densityState: DensityState): PluginHook {
	let _root: HTMLElement | null = null;

	function _applyMiniCards(): void {
		if (!_root) return;
		const cells = _root.querySelectorAll('.pv-data-cell');
		if (densityState.level === 'compact') {
			for (const cell of cells) {
				cell.classList.add('pv-cell--mini-card');
			}
		} else {
			for (const cell of cells) {
				cell.classList.remove('pv-cell--mini-card');
			}
		}
	}

	const _onDensityChange = (_level: string): void => {
		_applyMiniCards();
	};

	return {
		afterRender(root: HTMLElement, _ctx: RenderContext): void {
			_root = root;

			// Register as density listener if not already registered
			if (!densityState.listeners.has(_onDensityChange)) {
				densityState.listeners.add(_onDensityChange);
			}

			_applyMiniCards();
		},

		destroy(): void {
			densityState.listeners.delete(_onDensityChange);

			// Remove mini-card class from all cells
			if (_root) {
				const cells = _root.querySelectorAll('.pv-data-cell');
				for (const cell of cells) {
					cell.classList.remove('pv-cell--mini-card');
				}
			}
			_root = null;
		},
	};
}
