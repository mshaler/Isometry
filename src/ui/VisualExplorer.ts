// Isometry v5 — Phase 56 Plan 01
// VisualExplorer: zoom rail + SuperGrid wrapper with mount/destroy lifecycle.
//
// Design:
//   - Creates horizontal flex container: [zoom-rail | view-content]
//   - Zoom rail contains vertical range slider, percentage label, min/max labels
//   - Bidirectional sync: slider <-> SuperPositionProvider via onZoomChange callback
//   - setZoomRailVisible() toggles rail display based on active view type
//   - getContentEl() returns inner content div for ViewManager mounting
//
// Requirements: VISL-01, VISL-02, VISL-03

import '../styles/visual-explorer.css';

import type { SuperPositionProvider } from '../providers/SuperPositionProvider';
import { ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN } from '../providers/SuperPositionProvider';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface VisualExplorerConfig {
	positionProvider: SuperPositionProvider;
}

// ---------------------------------------------------------------------------
// VisualExplorer
// ---------------------------------------------------------------------------

export class VisualExplorer {
	private readonly _positionProvider: SuperPositionProvider;
	private _rootEl: HTMLElement | null = null;
	private _railEl: HTMLElement | null = null;
	private _contentEl: HTMLElement | null = null;
	private _sliderEl: HTMLInputElement | null = null;
	private _labelEl: HTMLElement | null = null;

	constructor(config: VisualExplorerConfig) {
		this._positionProvider = config.positionProvider;
	}

	/**
	 * Mount the VisualExplorer into the given container.
	 * Creates the .visual-explorer root with zoom-rail and content children.
	 */
	mount(container: HTMLElement): void {
		// Root: horizontal flex container
		this._rootEl = document.createElement('div');
		this._rootEl.className = 'visual-explorer';

		// Zoom rail: vertical column with slider
		this._railEl = document.createElement('div');
		this._railEl.className = 'visual-explorer__zoom-rail';

		// Max label at top
		const maxLabel = document.createElement('span');
		maxLabel.className = 'visual-explorer__zoom-max-label';
		maxLabel.textContent = `${Math.round(ZOOM_MAX * 100)}%`;
		this._railEl.appendChild(maxLabel);

		// Slider
		this._sliderEl = document.createElement('input');
		this._sliderEl.type = 'range';
		this._sliderEl.className = 'visual-explorer__zoom-slider';
		this._sliderEl.min = String(ZOOM_MIN);
		this._sliderEl.max = String(ZOOM_MAX);
		this._sliderEl.step = '0.01';
		this._sliderEl.value = String(this._positionProvider.zoomLevel);
		this._sliderEl.setAttribute('aria-label', 'Zoom level');
		this._railEl.appendChild(this._sliderEl);

		// 1x baseline tick mark
		const tick = document.createElement('div');
		tick.className = 'visual-explorer__zoom-tick';
		this._railEl.appendChild(tick);

		// Zoom percentage label
		this._labelEl = document.createElement('span');
		this._labelEl.className = 'visual-explorer__zoom-label';
		this._updateLabel();
		this._railEl.appendChild(this._labelEl);

		// Min label at bottom
		const minLabel = document.createElement('span');
		minLabel.className = 'visual-explorer__zoom-min-label';
		minLabel.textContent = `${Math.round(ZOOM_MIN * 100)}%`;
		this._railEl.appendChild(minLabel);

		// Content area: ViewManager mounts views here
		this._contentEl = document.createElement('div');
		this._contentEl.className = 'visual-explorer__content';

		// Assemble
		this._rootEl.appendChild(this._railEl);
		this._rootEl.appendChild(this._contentEl);
		container.appendChild(this._rootEl);

		// Wire slider input event -> positionProvider + label
		this._sliderEl.addEventListener('input', this._onSliderInput);

		// Wire label click -> reset zoom
		this._labelEl.addEventListener('click', this._onLabelClick);

		// Wire onZoomChange callback for bidirectional sync (external zoom -> slider)
		this._positionProvider.setOnZoomChange(this._onExternalZoomChange);
	}

	/**
	 * Returns the inner .visual-explorer__content element for ViewManager mounting.
	 */
	getContentEl(): HTMLElement {
		if (!this._contentEl) {
			throw new Error('[VisualExplorer] Not mounted — call mount() first');
		}
		return this._contentEl;
	}

	/**
	 * Toggle zoom rail visibility based on active view type.
	 * Zoom rail is only shown when SuperGrid is the active view.
	 */
	setZoomRailVisible(visible: boolean): void {
		if (this._railEl) {
			this._railEl.style.display = visible ? 'flex' : 'none';
		}
	}

	/**
	 * Tear down: remove DOM, clear onZoomChange callback.
	 */
	destroy(): void {
		this._positionProvider.setOnZoomChange(null);

		if (this._sliderEl) {
			this._sliderEl.removeEventListener('input', this._onSliderInput);
		}
		if (this._labelEl) {
			this._labelEl.removeEventListener('click', this._onLabelClick);
		}

		this._rootEl?.remove();
		this._rootEl = null;
		this._railEl = null;
		this._contentEl = null;
		this._sliderEl = null;
		this._labelEl = null;
	}

	// ---------------------------------------------------------------------------
	// Private handlers
	// ---------------------------------------------------------------------------

	private _onSliderInput = (): void => {
		if (!this._sliderEl) return;
		this._positionProvider.zoomLevel = parseFloat(this._sliderEl.value);
		this._updateLabel();
	};

	private _onLabelClick = (): void => {
		this._positionProvider.zoomLevel = ZOOM_DEFAULT;
		this._syncSliderFromProvider();
		this._updateLabel();
	};

	private _onExternalZoomChange = (_zoom: number): void => {
		this._syncSliderFromProvider();
		this._updateLabel();
	};

	private _syncSliderFromProvider(): void {
		if (this._sliderEl) {
			this._sliderEl.value = String(this._positionProvider.zoomLevel);
		}
	}

	private _updateLabel(): void {
		if (this._labelEl) {
			this._labelEl.textContent = `${Math.round(this._positionProvider.zoomLevel * 100)}%`;
		}
	}
}
