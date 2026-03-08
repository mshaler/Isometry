// @vitest-environment jsdom
// Isometry v5 — Phase 56 Plan 01 (Task 1)
// Tests for VisualExplorer: zoom rail + SuperGrid wrapper with mount/destroy lifecycle.
//
// Requirements: VISL-01, VISL-02, VISL-03
// TDD Phase: RED -> GREEN -> REFACTOR

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	SuperPositionProvider,
	ZOOM_DEFAULT,
	ZOOM_MAX,
	ZOOM_MIN,
} from '../../src/providers/SuperPositionProvider';

// Dynamic import to allow RED phase to fail gracefully
let VisualExplorer: typeof import('../../src/ui/VisualExplorer').VisualExplorer;

beforeEach(async () => {
	const mod = await import('../../src/ui/VisualExplorer');
	VisualExplorer = mod.VisualExplorer;
});

// ---------------------------------------------------------------------------
// DOM structure after mount
// ---------------------------------------------------------------------------

describe('VisualExplorer — mount DOM structure', () => {
	let container: HTMLDivElement;
	let positionProvider: SuperPositionProvider;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		positionProvider = new SuperPositionProvider();
	});

	afterEach(() => {
		container.remove();
	});

	it('mount() creates .visual-explorer root element', () => {
		const explorer = new VisualExplorer({ positionProvider });
		explorer.mount(container);

		const root = container.querySelector('.visual-explorer');
		expect(root).not.toBeNull();

		explorer.destroy();
	});

	it('mount() creates .visual-explorer__zoom-rail child', () => {
		const explorer = new VisualExplorer({ positionProvider });
		explorer.mount(container);

		const rail = container.querySelector('.visual-explorer__zoom-rail');
		expect(rail).not.toBeNull();

		explorer.destroy();
	});

	it('mount() creates .visual-explorer__content child', () => {
		const explorer = new VisualExplorer({ positionProvider });
		explorer.mount(container);

		const content = container.querySelector('.visual-explorer__content');
		expect(content).not.toBeNull();

		explorer.destroy();
	});

	it('mount() creates a range input slider inside zoom rail', () => {
		const explorer = new VisualExplorer({ positionProvider });
		explorer.mount(container);

		const slider = container.querySelector(
			'.visual-explorer__zoom-rail input[type="range"]',
		);
		expect(slider).not.toBeNull();

		explorer.destroy();
	});

	it('slider has correct min/max/step attributes', () => {
		const explorer = new VisualExplorer({ positionProvider });
		explorer.mount(container);

		const slider = container.querySelector(
			'.visual-explorer__zoom-slider',
		) as HTMLInputElement;
		expect(slider).not.toBeNull();
		expect(slider.min).toBe(String(ZOOM_MIN));
		expect(slider.max).toBe(String(ZOOM_MAX));
		expect(slider.step).toBe('0.01');

		explorer.destroy();
	});

	it('slider initial value matches positionProvider.zoomLevel', () => {
		positionProvider.zoomLevel = 1.5;
		const explorer = new VisualExplorer({ positionProvider });
		explorer.mount(container);

		const slider = container.querySelector(
			'.visual-explorer__zoom-slider',
		) as HTMLInputElement;
		expect(slider.value).toBe('1.5');

		explorer.destroy();
	});

	it('zoom label shows current percentage', () => {
		positionProvider.zoomLevel = 1.5;
		const explorer = new VisualExplorer({ positionProvider });
		explorer.mount(container);

		const label = container.querySelector('.visual-explorer__zoom-label');
		expect(label).not.toBeNull();
		expect(label!.textContent).toBe('150%');

		explorer.destroy();
	});

	it('max label shows "300%"', () => {
		const explorer = new VisualExplorer({ positionProvider });
		explorer.mount(container);

		const maxLabel = container.querySelector(
			'.visual-explorer__zoom-max-label',
		);
		expect(maxLabel).not.toBeNull();
		expect(maxLabel!.textContent).toBe('300%');

		explorer.destroy();
	});

	it('min label shows "50%"', () => {
		const explorer = new VisualExplorer({ positionProvider });
		explorer.mount(container);

		const minLabel = container.querySelector(
			'.visual-explorer__zoom-min-label',
		);
		expect(minLabel).not.toBeNull();
		expect(minLabel!.textContent).toBe('50%');

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// getContentEl
// ---------------------------------------------------------------------------

describe('VisualExplorer — getContentEl', () => {
	let container: HTMLDivElement;
	let positionProvider: SuperPositionProvider;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		positionProvider = new SuperPositionProvider();
	});

	afterEach(() => {
		container.remove();
	});

	it('getContentEl() returns the .visual-explorer__content element', () => {
		const explorer = new VisualExplorer({ positionProvider });
		explorer.mount(container);

		const contentEl = explorer.getContentEl();
		expect(contentEl.classList.contains('visual-explorer__content')).toBe(
			true,
		);

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// setZoomRailVisible
// ---------------------------------------------------------------------------

describe('VisualExplorer — setZoomRailVisible', () => {
	let container: HTMLDivElement;
	let positionProvider: SuperPositionProvider;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		positionProvider = new SuperPositionProvider();
	});

	afterEach(() => {
		container.remove();
	});

	it('setZoomRailVisible(false) hides the zoom rail', () => {
		const explorer = new VisualExplorer({ positionProvider });
		explorer.mount(container);

		explorer.setZoomRailVisible(false);

		const rail = container.querySelector(
			'.visual-explorer__zoom-rail',
		) as HTMLElement;
		expect(rail.style.display).toBe('none');

		explorer.destroy();
	});

	it('setZoomRailVisible(true) shows the zoom rail', () => {
		const explorer = new VisualExplorer({ positionProvider });
		explorer.mount(container);

		explorer.setZoomRailVisible(false);
		explorer.setZoomRailVisible(true);

		const rail = container.querySelector(
			'.visual-explorer__zoom-rail',
		) as HTMLElement;
		expect(rail.style.display).toBe('flex');

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// Slider input updates positionProvider and label
// ---------------------------------------------------------------------------

describe('VisualExplorer — slider input updates', () => {
	let container: HTMLDivElement;
	let positionProvider: SuperPositionProvider;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		positionProvider = new SuperPositionProvider();
	});

	afterEach(() => {
		container.remove();
	});

	it('slider input event updates positionProvider.zoomLevel', () => {
		const explorer = new VisualExplorer({ positionProvider });
		explorer.mount(container);

		const slider = container.querySelector(
			'.visual-explorer__zoom-slider',
		) as HTMLInputElement;
		// Simulate user dragging slider to 2.0
		// jsdom doesn't natively update .value via events, so we set it manually then dispatch
		slider.value = '2';
		slider.dispatchEvent(new Event('input', { bubbles: true }));

		expect(positionProvider.zoomLevel).toBe(2.0);

		explorer.destroy();
	});

	it('slider input event updates label text', () => {
		const explorer = new VisualExplorer({ positionProvider });
		explorer.mount(container);

		const slider = container.querySelector(
			'.visual-explorer__zoom-slider',
		) as HTMLInputElement;
		slider.value = '2';
		slider.dispatchEvent(new Event('input', { bubbles: true }));

		const label = container.querySelector('.visual-explorer__zoom-label');
		expect(label!.textContent).toBe('200%');

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// Label click resets zoom
// ---------------------------------------------------------------------------

describe('VisualExplorer — label click resets zoom', () => {
	let container: HTMLDivElement;
	let positionProvider: SuperPositionProvider;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		positionProvider = new SuperPositionProvider();
	});

	afterEach(() => {
		container.remove();
	});

	it('clicking percentage label resets zoom to ZOOM_DEFAULT (1.0)', () => {
		positionProvider.zoomLevel = 2.5;
		const explorer = new VisualExplorer({ positionProvider });
		explorer.mount(container);

		const label = container.querySelector(
			'.visual-explorer__zoom-label',
		) as HTMLElement;
		label.click();

		expect(positionProvider.zoomLevel).toBe(ZOOM_DEFAULT);

		explorer.destroy();
	});

	it('clicking percentage label updates slider value to ZOOM_DEFAULT', () => {
		positionProvider.zoomLevel = 2.5;
		const explorer = new VisualExplorer({ positionProvider });
		explorer.mount(container);

		const label = container.querySelector(
			'.visual-explorer__zoom-label',
		) as HTMLElement;
		label.click();

		const slider = container.querySelector(
			'.visual-explorer__zoom-slider',
		) as HTMLInputElement;
		expect(parseFloat(slider.value)).toBe(ZOOM_DEFAULT);

		explorer.destroy();
	});

	it('clicking percentage label updates label text to "100%"', () => {
		positionProvider.zoomLevel = 2.5;
		const explorer = new VisualExplorer({ positionProvider });
		explorer.mount(container);

		const label = container.querySelector(
			'.visual-explorer__zoom-label',
		) as HTMLElement;
		label.click();

		expect(label.textContent).toBe('100%');

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// Bidirectional sync via onZoomChange callback
// ---------------------------------------------------------------------------

describe('VisualExplorer — bidirectional zoom sync', () => {
	let container: HTMLDivElement;
	let positionProvider: SuperPositionProvider;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		positionProvider = new SuperPositionProvider();
	});

	afterEach(() => {
		container.remove();
	});

	it('external zoomLevel change updates slider value via onZoomChange', () => {
		const explorer = new VisualExplorer({ positionProvider });
		explorer.mount(container);

		// Simulate external zoom change (e.g., wheel zoom via SuperZoom)
		positionProvider.zoomLevel = 2.0;

		const slider = container.querySelector(
			'.visual-explorer__zoom-slider',
		) as HTMLInputElement;
		expect(parseFloat(slider.value)).toBe(2.0);

		explorer.destroy();
	});

	it('external zoomLevel change updates label text via onZoomChange', () => {
		const explorer = new VisualExplorer({ positionProvider });
		explorer.mount(container);

		positionProvider.zoomLevel = 2.0;

		const label = container.querySelector('.visual-explorer__zoom-label');
		expect(label!.textContent).toBe('200%');

		explorer.destroy();
	});
});

// ---------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------

describe('VisualExplorer — destroy', () => {
	let container: HTMLDivElement;
	let positionProvider: SuperPositionProvider;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		positionProvider = new SuperPositionProvider();
	});

	afterEach(() => {
		container.remove();
	});

	it('destroy() removes root element from DOM', () => {
		const explorer = new VisualExplorer({ positionProvider });
		explorer.mount(container);

		expect(container.querySelector('.visual-explorer')).not.toBeNull();
		explorer.destroy();
		expect(container.querySelector('.visual-explorer')).toBeNull();
	});

	it('destroy() clears onZoomChange callback (external zoom change does not throw)', () => {
		const explorer = new VisualExplorer({ positionProvider });
		explorer.mount(container);
		explorer.destroy();

		// After destroy, setting zoomLevel should NOT throw (callback was cleared)
		expect(() => {
			positionProvider.zoomLevel = 2.0;
		}).not.toThrow();
	});
});
