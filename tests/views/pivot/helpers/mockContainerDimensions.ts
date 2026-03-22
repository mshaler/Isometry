// Isometry v5 — Phase 104 Plan 01
// jsdom layout dimension mocking utility.
//
// jsdom does not implement layout, so element.clientHeight etc. always return 0.
// mockContainerDimensions() uses Object.defineProperty to mock these values on
// a per-element basis without per-file prototype patching.
//
// Requirements: INFR-03

/** Dimension options for mockContainerDimensions(). All fields are optional. */
export interface ContainerDimensions {
	clientHeight?: number;
	clientWidth?: number;
	scrollTop?: number;
	scrollLeft?: number;
}

/**
 * Mock layout dimensions on a jsdom HTMLElement.
 *
 * Uses Object.defineProperty with configurable: true so tests can re-mock
 * the same element multiple times without getting "Cannot redefine property" errors.
 *
 * Also overrides getBoundingClientRect to return a DOMRect-like object with
 * height/width/bottom/right values matching the provided dimensions.
 */
export function mockContainerDimensions(el: HTMLElement, dims: ContainerDimensions): void {
	if (dims.clientHeight !== undefined) {
		Object.defineProperty(el, 'clientHeight', {
			get: () => dims.clientHeight,
			configurable: true,
		});
	}

	if (dims.clientWidth !== undefined) {
		Object.defineProperty(el, 'clientWidth', {
			get: () => dims.clientWidth,
			configurable: true,
		});
	}

	if (dims.scrollTop !== undefined) {
		Object.defineProperty(el, 'scrollTop', {
			get: () => dims.scrollTop,
			set: () => {},
			configurable: true,
		});
	}

	if (dims.scrollLeft !== undefined) {
		Object.defineProperty(el, 'scrollLeft', {
			get: () => dims.scrollLeft,
			set: () => {},
			configurable: true,
		});
	}

	const height = dims.clientHeight ?? 0;
	const width = dims.clientWidth ?? 0;

	el.getBoundingClientRect = () => ({
		top: 0,
		left: 0,
		bottom: height,
		right: width,
		width,
		height,
		x: 0,
		y: 0,
		toJSON() {
			return {
				top: 0,
				left: 0,
				bottom: height,
				right: width,
				width,
				height,
				x: 0,
				y: 0,
			};
		},
	});
}
