// Isometry v5 — Phase 100 Plan 01 SuperZoomSlider Plugin
// Zoom slider plugin for the feature harness sidebar.
//
// Design:
//   - Creates .hns-zoom-control container in harness sidebar
//   - Slider range: min=0.5, max=3, step=0.05
//   - Input event updates zoomState.zoom and notifies listeners
//   - Registered as zoom state listener: updates slider when wheel zoom changes
//   - destroy: removes control container and unregisters listener
//
// Requirements: ZOOM-02

import type { PluginHook, RenderContext } from './PluginTypes';
import type { ZoomState } from './SuperZoomWheel';

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Factory for the superzoom.slider plugin.
 *
 * @param zoomState - Shared zoom state. Must be the same object reference passed
 *   to createSuperZoomWheelPlugin() to keep slider and wheel in sync.
 *
 * Returns a PluginHook whose:
 *   - afterRender: creates or updates the zoom control in the harness sidebar
 *   - destroy: removes the zoom control and unregisters the listener
 */
export function createSuperZoomSliderPlugin(zoomState: ZoomState): PluginHook {
	let _container: HTMLElement | null = null;
	let _slider: HTMLInputElement | null = null;
	let _valueDisplay: HTMLSpanElement | null = null;

	// Listener function: update slider when wheel zoom changes
	const _onZoomChange = (zoom: number): void => {
		if (_slider) {
			_slider.value = String(zoom);
		}
		if (_valueDisplay) {
			_valueDisplay.textContent = `${zoom.toFixed(1)}x`;
		}
	};

	return {
		afterRender(_root: HTMLElement, _ctx: RenderContext): void {
			// Find harness sidebar
			const sidebar = document.querySelector('.hns-sidebar');
			if (!sidebar) return;

			// If container already exists, just update slider value
			const existing = sidebar.querySelector('.hns-zoom-control');
			if (existing) {
				const existingSlider = existing.querySelector('.hns-zoom-slider') as HTMLInputElement | null;
				if (existingSlider) {
					existingSlider.value = String(zoomState.zoom);
				}
				const existingValue = existing.querySelector('.hns-zoom-value') as HTMLSpanElement | null;
				if (existingValue) {
					existingValue.textContent = `${zoomState.zoom.toFixed(1)}x`;
				}
				return;
			}

			// Create zoom control container
			_container = document.createElement('div');
			_container.className = 'hns-zoom-control';

			// Label
			const label = document.createElement('span');
			label.className = 'hns-data-label';
			label.textContent = 'ZOOM';

			// Slider
			_slider = document.createElement('input');
			_slider.type = 'range';
			_slider.className = 'hns-zoom-slider';
			_slider.min = '0.5';
			_slider.max = '3';
			_slider.step = '0.05';
			_slider.value = String(zoomState.zoom);
			_slider.style.accentColor = 'var(--pv-accent)';

			// Value display
			_valueDisplay = document.createElement('span');
			_valueDisplay.className = 'hns-zoom-value';
			_valueDisplay.textContent = `${zoomState.zoom.toFixed(1)}x`;

			// Slider input event: update zoom state and notify listeners
			_slider.addEventListener('input', () => {
				if (!_slider) return;
				const newZoom = parseFloat(_slider.value);
				zoomState.zoom = newZoom;
				if (_valueDisplay) {
					_valueDisplay.textContent = `${newZoom.toFixed(1)}x`;
				}
				// Notify other listeners (e.g., wheel plugin to trigger re-render)
				for (const listener of zoomState.listeners) {
					if (listener !== _onZoomChange) {
						listener(newZoom);
					}
				}
			});

			_container.appendChild(label);
			_container.appendChild(_slider);
			_container.appendChild(_valueDisplay);
			sidebar.appendChild(_container);

			// Register as zoom state listener for wheel -> slider sync
			zoomState.listeners.add(_onZoomChange);
		},

		destroy(): void {
			// Unregister listener
			zoomState.listeners.delete(_onZoomChange);

			// Remove control from DOM
			if (_container?.parentElement) {
				_container.parentElement.removeChild(_container);
			}
			_container = null;
			_slider = null;
			_valueDisplay = null;
		},
	};
}
