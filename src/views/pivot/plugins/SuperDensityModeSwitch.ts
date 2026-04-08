// Isometry v5 — Phase 102 Plan 01 SuperDensityModeSwitch Plugin
// Segmented density toolbar plugin for the pivot grid.
//
// Design:
//   - Creates .pv-density-toolbar inside .pv-toolbar
//   - 4 density levels: compact / normal / comfortable / spacious
//   - Shared DensityState object notifies sibling plugins (mini-cards, count-badge)
//   - density CSS class applied to .pv-grid-wrapper (skipped for 'normal')
//   - destroy: removes toolbar, unregisters listener
//
// Requirements: DENS-01

import type { PluginHook, RenderContext } from './PluginTypes';

// ---------------------------------------------------------------------------
// DensityState types
// ---------------------------------------------------------------------------

export type DensityLevel = 'compact' | 'normal' | 'comfortable' | 'spacious';

export interface DensityState {
	level: DensityLevel;
	listeners: Set<(level: DensityLevel) => void>;
}

export function createDensityState(): DensityState {
	return { level: 'normal', listeners: new Set() };
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

const DENSITY_LEVELS: DensityLevel[] = ['compact', 'normal', 'comfortable', 'spacious'];
const DENSITY_LABELS: Record<DensityLevel, string> = {
	compact: 'Compact',
	normal: 'Normal',
	comfortable: 'Comfortable',
	spacious: 'Spacious',
};

/**
 * Factory for the superdensity.mode-switch plugin.
 *
 * @param densityState - Shared density state. Must be the same object reference
 *   passed to createSuperDensityMiniCardsPlugin() and createSuperDensityCountBadgePlugin()
 *   to keep all 3 density plugins in sync.
 */
export function createSuperDensityModeSwitchPlugin(densityState: DensityState): PluginHook {
	let _toolbar: HTMLElement | null = null;
	let _rootRef: HTMLElement | null = null;

	function _applyDensityClass(el: HTMLElement | null): void {
		if (!el) return;
		// Remove all density classes
		for (const level of DENSITY_LEVELS) {
			el.classList.remove(`pv-density--${level}`);
		}
		// Apply current level class (skip for 'normal' — no class = normal)
		if (densityState.level !== 'normal') {
			el.classList.add(`pv-density--${densityState.level}`);
		}
	}

	function _updateActiveButton(): void {
		if (!_toolbar) return;
		const buttons = _toolbar.querySelectorAll('.pv-density-btn');
		for (const btn of buttons) {
			const level = btn.getAttribute('data-density');
			if (level === densityState.level) {
				btn.classList.add('pv-density-btn--active');
			} else {
				btn.classList.remove('pv-density-btn--active');
			}
		}
	}

	return {
		afterRender(root: HTMLElement, _ctx: RenderContext): void {
			// Find toolbar container
			const toolbar = root.querySelector('.pv-toolbar');
			if (!toolbar) return;

			_rootRef = root;

			// If toolbar already exists, update active state and return
			const existing = toolbar.querySelector('.pv-density-toolbar');
			if (existing) {
				_toolbar = existing as HTMLElement;
				_updateActiveButton();
				_applyDensityClass(root);
				return;
			}

			// Create density toolbar container
			_toolbar = document.createElement('div');
			_toolbar.className = 'pv-density-toolbar';
			_toolbar.setAttribute('data-tour-target', 'supergrid-density');

			// Label
			const label = document.createElement('span');
			label.className = 'pv-density-label';
			label.textContent = 'DENSITY';
			_toolbar.appendChild(label);

			// Segmented button group
			const segmented = document.createElement('div');
			segmented.className = 'pv-density-segmented';

			for (const level of DENSITY_LEVELS) {
				const btn = document.createElement('button');
				btn.type = 'button';
				btn.className = 'pv-density-btn';
				btn.setAttribute('data-density', level);
				btn.textContent = DENSITY_LABELS[level];

				if (level === densityState.level) {
					btn.classList.add('pv-density-btn--active');
				}

				btn.addEventListener('click', () => {
					densityState.level = level;
					_updateActiveButton();
					_applyDensityClass(_rootRef);
					// Notify sibling plugins
					for (const listener of densityState.listeners) {
						listener(level);
					}
				});

				segmented.appendChild(btn);
			}

			_toolbar.appendChild(segmented);
			toolbar.appendChild(_toolbar);

			// Apply initial density class to root (scroll container)
			_applyDensityClass(root);
		},

		destroy(): void {
			if (_toolbar?.parentElement) {
				_toolbar.parentElement.removeChild(_toolbar);
			}
			_toolbar = null;
		},
	};
}
