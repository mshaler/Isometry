// Isometry v5 — Phase 102 Plan 01 SuperDensityCountBadge Plugin
// Numeric count badge in cells at lowest density (compact).
//
// Design:
//   - When density is 'compact', adds .pv-count-badge span to each .pv-data-cell
//     showing the count of child elements (or data-value attribute)
//   - When density changes to non-compact, removes all .pv-count-badge elements
//   - Registers as DensityState listener to react to toolbar toggles
//   - destroy: removes badges and unregisters listener
//
// Requirements: DENS-03

import type { PluginHook, RenderContext } from './PluginTypes';
import type { DensityState } from './SuperDensityModeSwitch';

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Factory for the superdensity.count-badge plugin.
 *
 * @param densityState - Shared density state from createDensityState(). Must be
 *   the same object reference passed to createSuperDensityModeSwitchPlugin().
 */
export function createSuperDensityCountBadgePlugin(densityState: DensityState): PluginHook {
	let _root: HTMLElement | null = null;

	function _removeBadges(): void {
		if (!_root) return;
		const badges = _root.querySelectorAll('.pv-count-badge');
		for (const badge of badges) {
			badge.parentElement?.removeChild(badge);
		}
	}

	function _applyBadges(): void {
		if (!_root) return;

		// Remove existing badges first to avoid duplicates
		_removeBadges();

		if (densityState.level !== 'compact') return;

		const cells = _root.querySelectorAll('.pv-data-cell');
		for (const cell of cells) {
			// Determine count: prefer data-value attribute, fall back to child count
			const dataValue = cell.getAttribute('data-value');
			let count: number;

			if (dataValue !== null) {
				count = Number(dataValue);
			} else {
				// Count child elements (card items in the cell)
				count = cell.children.length;
			}

			const badge = document.createElement('span');
			badge.className = 'pv-count-badge';
			badge.setAttribute('aria-label', `${count} items`);
			badge.textContent = String(count);
			cell.appendChild(badge);
		}
	}

	const _onDensityChange = (_level: string): void => {
		_applyBadges();
	};

	return {
		afterRender(root: HTMLElement, _ctx: RenderContext): void {
			_root = root;

			// Register as density listener if not already registered
			if (!densityState.listeners.has(_onDensityChange)) {
				densityState.listeners.add(_onDensityChange);
			}

			_applyBadges();
		},

		destroy(): void {
			densityState.listeners.delete(_onDensityChange);
			_removeBadges();
			_root = null;
		},
	};
}
