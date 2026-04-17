// Isometry v5 — Phase 56 Plan 01
// VisualExplorer: zoom rail + SuperGrid wrapper with mount/destroy lifecycle.
//
// Design:
//   - Creates horizontal flex container: [zoom-rail | view-content]
//   - Zoom rail contains vertical range slider, percentage label, min/max labels
//   - Bidirectional sync: slider <-> SuperPositionProvider via onZoomChange callback
//   - setZoomRailVisible() toggles rail display based on active view type
//   - getContentEl() returns inner content div for ViewManager mounting
//   - Phase 94: Dimension switcher section with segmented 1x|2x|5x buttons
//
// Requirements: VISL-01, VISL-02, VISL-03, DIMS-03

import '../styles/visual-explorer.css';

import type { SuperPositionProvider } from '../providers/SuperPositionProvider';
import { ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN } from '../providers/SuperPositionProvider';
import type { WorkerBridgeLike } from '../views/types';

// ---------------------------------------------------------------------------
// Dimension level type
// ---------------------------------------------------------------------------

export type DimensionLevel = '1x' | '2x' | '5x';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface VisualExplorerConfig {
	positionProvider: SuperPositionProvider;
	/** Phase 94: WorkerBridge for dimension ui:set / ui:get persistence */
	bridge?: WorkerBridgeLike;
	/** Phase 94: Callback invoked when user selects a dimension level */
	onDimensionChange?: (level: DimensionLevel) => void;
}

// ---------------------------------------------------------------------------
// VisualExplorer
// ---------------------------------------------------------------------------

export class VisualExplorer {
	private readonly _positionProvider: SuperPositionProvider;
	private readonly _bridge: WorkerBridgeLike | null;
	private readonly _onDimensionChange: ((level: DimensionLevel) => void) | null;

	private _rootEl: HTMLElement | null = null;
	private _railEl: HTMLElement | null = null;
	private _contentEl: HTMLElement | null = null;
	private _sliderEl: HTMLInputElement | null = null;
	private _labelEl: HTMLElement | null = null;

	// Phase 94 — Dimension switcher
	private _dimSwitcherEl: HTMLElement | null = null;
	private _currentDimension: DimensionLevel = '2x';

	constructor(config: VisualExplorerConfig) {
		this._positionProvider = config.positionProvider;
		this._bridge = config.bridge ?? null;
		this._onDimensionChange = config.onDimensionChange ?? null;
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

		// Phase 94 — Dimension switcher section (Size: 1×|2×|5×)
		const dimSection = document.createElement('div');
		dimSection.className = 'visual-explorer__dim-section';

		const dimLabel = document.createElement('span');
		dimLabel.className = 'visual-explorer__dim-label';
		dimLabel.textContent = 'Size';
		dimSection.appendChild(dimLabel);

		const dimSwitcher = document.createElement('div');
		dimSwitcher.className = 'visual-explorer__dim-switcher';
		dimSwitcher.setAttribute('role', 'group');
		dimSwitcher.setAttribute('aria-label', 'Card size');

		const levels: DimensionLevel[] = ['1x', '2x', '5x'];
		for (const level of levels) {
			const btn = document.createElement('button');
			btn.className = 'visual-explorer__dim-btn';
			if (level === this._currentDimension) {
				btn.classList.add('visual-explorer__dim-btn--active');
			}
			btn.dataset['size'] = level;
			btn.textContent = level.replace('x', '\u00D7'); // 1x -> 1×
			btn.setAttribute('aria-pressed', level === this._currentDimension ? 'true' : 'false');
			btn.setAttribute('tabindex', level === this._currentDimension ? '0' : '-1');
			btn.addEventListener('click', () => this._setDimension(level));
			dimSwitcher.appendChild(btn);
		}

		// Roving tabindex: arrow key navigation within segmented control
		dimSwitcher.addEventListener('keydown', (e: KeyboardEvent) => {
			const btns = Array.from(dimSwitcher.querySelectorAll<HTMLButtonElement>('.visual-explorer__dim-btn'));
			const currentIdx = btns.findIndex((b) => b.dataset['size'] === this._currentDimension);
			let nextIdx = currentIdx;
			if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
				e.preventDefault();
				nextIdx = Math.min(currentIdx + 1, btns.length - 1);
			} else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
				e.preventDefault();
				nextIdx = Math.max(currentIdx - 1, 0);
			}
			if (nextIdx !== currentIdx) {
				btns[currentIdx]!.setAttribute('tabindex', '-1');
				btns[nextIdx]!.setAttribute('tabindex', '0');
				btns[nextIdx]!.focus();
			}
		});

		dimSection.appendChild(dimSwitcher);
		this._dimSwitcherEl = dimSection;

		// Assemble: [zoom-rail | dim-section + content vertically stacked]
		// Use a flex column wrapper for the right side so dim-section sits above content
		const rightPanel = document.createElement('div');
		rightPanel.className = 'visual-explorer__right-panel';
		rightPanel.appendChild(dimSection);
		rightPanel.appendChild(this._contentEl);

		this._rootEl.appendChild(this._railEl);
		this._rootEl.appendChild(rightPanel);
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
		this._dimSwitcherEl = null;
	}

	// ---------------------------------------------------------------------------
	// Phase 94 — Dimension switcher public API
	// ---------------------------------------------------------------------------

	/**
	 * Set dimension from external source (e.g., restored from ui_state on view mount).
	 * Updates button states without triggering onDimensionChange callback.
	 */
	setDimension(level: DimensionLevel): void {
		this._setDimension(level, /* silent */ true);
	}

	/**
	 * Get the current dimension level.
	 */
	getDimension(): DimensionLevel {
		return this._currentDimension;
	}

	// ---------------------------------------------------------------------------
	// Phase 94 — Dimension switcher private methods
	// ---------------------------------------------------------------------------

	/**
	 * Set dimension level, update button states, and optionally fire callback.
	 * @param level - New dimension level
	 * @param silent - If true, skip onDimensionChange callback (used for external restore)
	 */
	private _setDimension(level: DimensionLevel, silent = false): void {
		if (level === this._currentDimension && !silent) return;
		this._currentDimension = level;

		// Update button visual states
		if (this._dimSwitcherEl) {
			const btns = this._dimSwitcherEl.querySelectorAll<HTMLButtonElement>('.visual-explorer__dim-btn');
			for (const btn of btns) {
				const isActive = btn.dataset['size'] === level;
				btn.classList.toggle('visual-explorer__dim-btn--active', isActive);
				btn.setAttribute('aria-pressed', String(isActive));
				btn.setAttribute('tabindex', isActive ? '0' : '-1');
			}
		}

		if (!silent) {
			this._onDimensionChange?.(level);
		}
	}

	// ---------------------------------------------------------------------------
	// Private handlers
	// ---------------------------------------------------------------------------

	private _onSliderInput = (): void => {
		if (!this._sliderEl) return;
		this._positionProvider.zoomLevel = parseFloat(this._sliderEl.value);
		this._applyZoomToContent();
		this._updateLabel();
	};

	private _onLabelClick = (): void => {
		this._positionProvider.zoomLevel = ZOOM_DEFAULT;
		this._syncSliderFromProvider();
		this._applyZoomToContent();
		this._updateLabel();
	};

	private _onExternalZoomChange = (_zoom: number): void => {
		this._syncSliderFromProvider();
		this._applyZoomToContent();
		this._updateLabel();
	};

	/** Set --sg-zoom CSS custom property on the content element so SuperGrid cells inherit it. */
	private _applyZoomToContent(): void {
		if (this._contentEl) {
			this._contentEl.style.setProperty('--sg-zoom', String(this._positionProvider.zoomLevel));
		}
	}

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
