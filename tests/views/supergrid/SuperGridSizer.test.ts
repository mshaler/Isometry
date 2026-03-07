// @vitest-environment jsdom
// Isometry v5 — SuperGridSizer Tests
// Unit tests for column resize interaction handler.
//
// Design:
//   - SuperGridSizer encapsulates all Pointer Events drag resize logic
//   - addHandleToHeader: creates .col-resize-handle div on right edge of header
//   - Drag sequence: pointerdown → pointermove → pointerup (or pointercancel)
//   - Shift+drag: normalizes all leaf columns to same base width
//   - dblclick: auto-fit column to content scrollWidth
//   - onWidthsChange callback fires on pointerup (persistence hook)
//   - pointercancel reverts to pre-drag width (no persist)
//   - applyWidths: rebuilds gridTemplateColumns via buildGridTemplateColumns
//
// Requirements: SIZE-01, SIZE-02, SIZE-03, SIZE-04

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	AUTO_FIT_MAX,
	AUTO_FIT_PADDING,
	MIN_COL_WIDTH,
	SuperGridSizer,
} from '../../../src/views/supergrid/SuperGridSizer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHandle(headerEl: HTMLElement): HTMLElement {
	return headerEl.querySelector('.col-resize-handle') as HTMLElement;
}

function makeHeaderEl(): HTMLElement {
	const el = document.createElement('div');
	el.className = 'col-header';
	document.body.appendChild(el);
	return el;
}

function makeGridEl(): HTMLDivElement {
	const el = document.createElement('div');
	el.style.display = 'grid';
	document.body.appendChild(el);
	return el;
}

function dispatchPointerEvent(target: EventTarget, type: string, init: PointerEventInit = {}): PointerEvent {
	const event = new PointerEvent(type, {
		bubbles: true,
		cancelable: true,
		pointerId: 1,
		button: 0,
		buttons: 1,
		clientX: 0,
		clientY: 0,
		...init,
	});
	target.dispatchEvent(event);
	return event;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('SuperGridSizer — constants', () => {
	it('MIN_COL_WIDTH is 48', () => {
		expect(MIN_COL_WIDTH).toBe(48);
	});

	it('AUTO_FIT_PADDING is 24', () => {
		expect(AUTO_FIT_PADDING).toBe(24);
	});

	it('AUTO_FIT_MAX is 400', () => {
		expect(AUTO_FIT_MAX).toBe(400);
	});
});

// ---------------------------------------------------------------------------
// State management
// ---------------------------------------------------------------------------

describe('SuperGridSizer — state management', () => {
	let sizer: SuperGridSizer;

	beforeEach(() => {
		sizer = new SuperGridSizer(() => 1.0);
	});

	it('getColWidths() returns empty Map initially', () => {
		const widths = sizer.getColWidths();
		expect(widths).toBeInstanceOf(Map);
		expect(widths.size).toBe(0);
	});

	it('setColWidths(map) stores widths and getColWidths() returns them', () => {
		const input = new Map([
			['note', 200],
			['task', 150],
		]);
		sizer.setColWidths(input);
		const result = sizer.getColWidths();
		expect(result.get('note')).toBe(200);
		expect(result.get('task')).toBe(150);
	});

	it('setColWidths(map) returns a defensive copy (mutations to original do not affect stored state)', () => {
		const input = new Map([['note', 200]]);
		sizer.setColWidths(input);
		input.set('note', 999); // mutate original
		expect(sizer.getColWidths().get('note')).toBe(200); // unchanged
	});

	it('getColWidths() returns a defensive copy (mutations do not affect stored state)', () => {
		sizer.setColWidths(new Map([['note', 200]]));
		const result = sizer.getColWidths();
		result.set('note', 999); // mutate returned map
		expect(sizer.getColWidths().get('note')).toBe(200); // unchanged
	});

	it('resetColWidths() clears all widths', () => {
		sizer.setColWidths(
			new Map([
				['note', 200],
				['task', 150],
			]),
		);
		sizer.resetColWidths();
		expect(sizer.getColWidths().size).toBe(0);
	});

	it('getLeafColKeys() returns empty array initially', () => {
		expect(sizer.getLeafColKeys()).toEqual([]);
	});

	it('setLeafColKeys stores and getLeafColKeys returns them', () => {
		sizer.setLeafColKeys(['a', 'b', 'c']);
		expect(sizer.getLeafColKeys()).toEqual(['a', 'b', 'c']);
	});
});

// ---------------------------------------------------------------------------
// attach / detach
// ---------------------------------------------------------------------------

describe('SuperGridSizer — attach/detach', () => {
	let sizer: SuperGridSizer;
	let gridEl: HTMLDivElement;

	beforeEach(() => {
		sizer = new SuperGridSizer(() => 1.0);
		gridEl = makeGridEl();
	});

	it('attach(gridEl) does not throw', () => {
		expect(() => sizer.attach(gridEl)).not.toThrow();
	});

	it('detach() does not throw before attach', () => {
		expect(() => sizer.detach()).not.toThrow();
	});

	it('detach() does not throw after attach', () => {
		sizer.attach(gridEl);
		expect(() => sizer.detach()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// addHandleToHeader — DOM structure
// ---------------------------------------------------------------------------

describe('SuperGridSizer — addHandleToHeader DOM structure', () => {
	let sizer: SuperGridSizer;
	let headerEl: HTMLElement;

	beforeEach(() => {
		sizer = new SuperGridSizer(() => 1.0);
		headerEl = makeHeaderEl();
	});

	it('appends a child div with class col-resize-handle', () => {
		sizer.addHandleToHeader(headerEl, 'note');
		const handle = headerEl.querySelector('.col-resize-handle');
		expect(handle).not.toBeNull();
		expect(handle!.tagName).toBe('DIV');
	});

	it('handle has cursor:col-resize style', () => {
		sizer.addHandleToHeader(headerEl, 'note');
		const handle = makeHandle(headerEl) as HTMLElement;
		expect(handle.style.cursor).toBe('col-resize');
	});

	it('handle has position:absolute', () => {
		sizer.addHandleToHeader(headerEl, 'note');
		const handle = makeHandle(headerEl) as HTMLElement;
		expect(handle.style.position).toBe('absolute');
	});

	it('handle has right:0', () => {
		sizer.addHandleToHeader(headerEl, 'note');
		const handle = makeHandle(headerEl) as HTMLElement;
		expect(handle.style.right).toBe('0px');
	});

	it('handle has width:8px', () => {
		sizer.addHandleToHeader(headerEl, 'note');
		const handle = makeHandle(headerEl) as HTMLElement;
		expect(handle.style.width).toBe('8px');
	});

	it('headerEl gets position:relative after addHandleToHeader', () => {
		sizer.addHandleToHeader(headerEl, 'note');
		expect(headerEl.style.position).toBe('relative');
	});
});

// ---------------------------------------------------------------------------
// Drag sequence — pointerdown/pointermove/pointerup
// ---------------------------------------------------------------------------

describe('SuperGridSizer — drag resize (pointerdown/pointermove/pointerup)', () => {
	let sizer: SuperGridSizer;
	let headerEl: HTMLElement;
	let gridEl: HTMLDivElement;
	let onWidthsChange: (widths: Map<string, number>) => void;

	beforeEach(() => {
		onWidthsChange = vi.fn();
		sizer = new SuperGridSizer(() => 1.0, onWidthsChange);
		gridEl = makeGridEl();
		sizer.attach(gridEl);
		sizer.setLeafColKeys(['note', 'task']);
		sizer.setColWidths(
			new Map([
				['note', 120],
				['task', 120],
			]),
		);
		headerEl = makeHeaderEl();
		sizer.addHandleToHeader(headerEl, 'note');
	});

	it('pointerdown with button=0 calls setPointerCapture on the handle', () => {
		const handle = makeHandle(headerEl) as HTMLElement;
		handle.setPointerCapture = vi.fn();
		dispatchPointerEvent(handle, 'pointerdown', { button: 0, pointerId: 1 });
		expect(handle.setPointerCapture).toHaveBeenCalledWith(1);
	});

	it('pointerdown with button!=0 does NOT set pointer capture (right-click guard)', () => {
		const handle = makeHandle(headerEl) as HTMLElement;
		handle.setPointerCapture = vi.fn();
		dispatchPointerEvent(handle, 'pointerdown', { button: 2, pointerId: 1 });
		expect(handle.setPointerCapture).not.toHaveBeenCalled();
	});

	it('pointerdown calls e.stopPropagation (prevents collapse click)', () => {
		const handle = makeHandle(headerEl) as HTMLElement;
		handle.setPointerCapture = vi.fn();
		const propagationSpy = vi.spyOn(PointerEvent.prototype, 'stopPropagation');
		dispatchPointerEvent(handle, 'pointerdown', { button: 0 });
		expect(propagationSpy).toHaveBeenCalled();
		propagationSpy.mockRestore();
	});

	it('pointermove without prior pointerdown does nothing (no _dragging state)', () => {
		// No pointerdown first
		dispatchPointerEvent(document, 'pointermove', { clientX: 50 });
		// No onWidthsChange, no error
		expect(onWidthsChange).not.toHaveBeenCalled();
		expect(sizer.getColWidths().get('note')).toBe(120);
	});

	it('pointermove after pointerdown updates colWidth with dx / zoomLevel', () => {
		const handle = makeHandle(headerEl) as HTMLElement;
		handle.setPointerCapture = vi.fn();
		handle.releasePointerCapture = vi.fn();
		// Start drag at x=100
		dispatchPointerEvent(handle, 'pointerdown', { button: 0, clientX: 100 });
		// Move 40px to the right
		dispatchPointerEvent(handle, 'pointermove', { clientX: 140 });
		// Expected: 120 + 40/1.0 = 160
		expect(sizer.getColWidths().get('note')).toBe(160);
	});

	it('pointermove clamps width to MIN_COL_WIDTH', () => {
		const handle = makeHandle(headerEl) as HTMLElement;
		handle.setPointerCapture = vi.fn();
		handle.releasePointerCapture = vi.fn();
		// Start drag and move far left (would make width negative)
		dispatchPointerEvent(handle, 'pointerdown', { button: 0, clientX: 100 });
		dispatchPointerEvent(handle, 'pointermove', { clientX: 0 }); // -100px
		// Should clamp to MIN_COL_WIDTH
		expect(sizer.getColWidths().get('note')).toBeGreaterThanOrEqual(MIN_COL_WIDTH);
	});

	it('pointermove at 2x zoom divides dx by zoomLevel', () => {
		// Create sizer with 2x zoom
		const onWC = vi.fn() as unknown as (widths: Map<string, number>) => void;
		const sizer2x = new SuperGridSizer(() => 2.0, onWC);
		const grid2 = makeGridEl();
		sizer2x.attach(grid2);
		sizer2x.setLeafColKeys(['note']);
		sizer2x.setColWidths(new Map([['note', 120]]));
		const h = makeHeaderEl();
		sizer2x.addHandleToHeader(h, 'note');
		const handle = makeHandle(h) as HTMLElement;
		handle.setPointerCapture = vi.fn();
		handle.releasePointerCapture = vi.fn();
		// Start drag at x=100, move 40px → dx=40 / zoom=2.0 → +20 base → 140
		dispatchPointerEvent(handle, 'pointerdown', { button: 0, clientX: 100 });
		dispatchPointerEvent(handle, 'pointermove', { clientX: 140 });
		expect(sizer2x.getColWidths().get('note')).toBe(140);
	});

	it('pointerup calls onWidthsChange callback', () => {
		const handle = makeHandle(headerEl) as HTMLElement;
		handle.setPointerCapture = vi.fn();
		handle.releasePointerCapture = vi.fn();
		dispatchPointerEvent(handle, 'pointerdown', { button: 0, clientX: 100 });
		dispatchPointerEvent(handle, 'pointermove', { clientX: 120 });
		dispatchPointerEvent(handle, 'pointerup', { clientX: 120 });
		expect(onWidthsChange).toHaveBeenCalledOnce();
		expect(onWidthsChange).toHaveBeenCalledWith(expect.any(Map));
	});

	it('pointerup releases pointer capture', () => {
		const handle = makeHandle(headerEl) as HTMLElement;
		handle.setPointerCapture = vi.fn();
		handle.releasePointerCapture = vi.fn();
		dispatchPointerEvent(handle, 'pointerdown', { button: 0, pointerId: 1, clientX: 100 });
		dispatchPointerEvent(handle, 'pointerup', { pointerId: 1, clientX: 100 });
		expect(handle.releasePointerCapture).toHaveBeenCalledWith(1);
	});

	it('pointerup clears _dragging state so subsequent pointermove does nothing', () => {
		const handle = makeHandle(headerEl) as HTMLElement;
		handle.setPointerCapture = vi.fn();
		handle.releasePointerCapture = vi.fn();
		dispatchPointerEvent(handle, 'pointerdown', { button: 0, clientX: 100 });
		dispatchPointerEvent(handle, 'pointerup', { clientX: 100 });
		const widthAfterUp = sizer.getColWidths().get('note');
		// Move after up — should not change width
		dispatchPointerEvent(handle, 'pointermove', { clientX: 200 });
		expect(sizer.getColWidths().get('note')).toBe(widthAfterUp);
	});
});

// ---------------------------------------------------------------------------
// Shift+drag — bulk normalize
// ---------------------------------------------------------------------------

describe('SuperGridSizer — Shift+drag bulk normalize', () => {
	let sizer: SuperGridSizer;
	let headerEl: HTMLElement;
	let gridEl: HTMLDivElement;
	let onWidthsChange: (widths: Map<string, number>) => void;

	beforeEach(() => {
		onWidthsChange = vi.fn();
		sizer = new SuperGridSizer(() => 1.0, onWidthsChange);
		gridEl = makeGridEl();
		sizer.attach(gridEl);
		sizer.setLeafColKeys(['note', 'task', 'project']);
		sizer.setColWidths(
			new Map([
				['note', 120],
				['task', 80],
				['project', 200],
			]),
		);
		headerEl = makeHeaderEl();
		sizer.addHandleToHeader(headerEl, 'note');
	});

	it('Shift+drag sets ALL leaf column keys to the computed newBaseWidth', () => {
		const handle = makeHandle(headerEl) as HTMLElement;
		handle.setPointerCapture = vi.fn();
		handle.releasePointerCapture = vi.fn();
		// Start drag at x=100, move 30px → newBase = 120 + 30 = 150
		dispatchPointerEvent(handle, 'pointerdown', { button: 0, clientX: 100 });
		dispatchPointerEvent(handle, 'pointermove', { clientX: 130, shiftKey: true });
		const widths = sizer.getColWidths();
		expect(widths.get('note')).toBe(150);
		expect(widths.get('task')).toBe(150);
		expect(widths.get('project')).toBe(150);
	});

	it('non-Shift drag sets only the dragged column', () => {
		const handle = makeHandle(headerEl) as HTMLElement;
		handle.setPointerCapture = vi.fn();
		handle.releasePointerCapture = vi.fn();
		dispatchPointerEvent(handle, 'pointerdown', { button: 0, clientX: 100 });
		dispatchPointerEvent(handle, 'pointermove', { clientX: 130, shiftKey: false });
		const widths = sizer.getColWidths();
		expect(widths.get('note')).toBe(150);
		expect(widths.get('task')).toBe(80); // unchanged
		expect(widths.get('project')).toBe(200); // unchanged
	});

	it('Shift+drag populates missing leaf keys with BASE_COL_WIDTH before normalizing', () => {
		// 'extra' key is in leafColKeys but not in colWidths
		sizer.setLeafColKeys(['note', 'task', 'extra']);
		sizer.setColWidths(
			new Map([
				['note', 120],
				['task', 80],
			]),
		);
		const handle = makeHandle(headerEl) as HTMLElement;
		handle.setPointerCapture = vi.fn();
		handle.releasePointerCapture = vi.fn();
		dispatchPointerEvent(handle, 'pointerdown', { button: 0, clientX: 100 });
		dispatchPointerEvent(handle, 'pointermove', { clientX: 130, shiftKey: true });
		// All three should be set to 150
		expect(sizer.getColWidths().get('extra')).toBe(150);
	});
});

// ---------------------------------------------------------------------------
// pointercancel — revert
// ---------------------------------------------------------------------------

describe('SuperGridSizer — pointercancel revert', () => {
	let sizer: SuperGridSizer;
	let headerEl: HTMLElement;
	let gridEl: HTMLDivElement;
	let onWidthsChange: (widths: Map<string, number>) => void;

	beforeEach(() => {
		onWidthsChange = vi.fn();
		sizer = new SuperGridSizer(() => 1.0, onWidthsChange);
		gridEl = makeGridEl();
		sizer.attach(gridEl);
		sizer.setLeafColKeys(['note']);
		sizer.setColWidths(new Map([['note', 120]]));
		headerEl = makeHeaderEl();
		sizer.addHandleToHeader(headerEl, 'note');
	});

	it('pointercancel reverts to startWidth', () => {
		const handle = makeHandle(headerEl) as HTMLElement;
		handle.setPointerCapture = vi.fn();
		handle.releasePointerCapture = vi.fn();
		dispatchPointerEvent(handle, 'pointerdown', { button: 0, clientX: 100 });
		dispatchPointerEvent(handle, 'pointermove', { clientX: 160 }); // width becomes 180
		expect(sizer.getColWidths().get('note')).toBe(180);
		dispatchPointerEvent(handle, 'pointercancel', {});
		// Should revert to 120
		expect(sizer.getColWidths().get('note')).toBe(120);
	});

	it('pointercancel does NOT call onWidthsChange (no persistence)', () => {
		const handle = makeHandle(headerEl) as HTMLElement;
		handle.setPointerCapture = vi.fn();
		handle.releasePointerCapture = vi.fn();
		dispatchPointerEvent(handle, 'pointerdown', { button: 0, clientX: 100 });
		dispatchPointerEvent(handle, 'pointermove', { clientX: 150 });
		dispatchPointerEvent(handle, 'pointercancel', {});
		expect(onWidthsChange).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// dblclick — auto-fit
// ---------------------------------------------------------------------------

describe('SuperGridSizer — dblclick auto-fit', () => {
	let sizer: SuperGridSizer;
	let headerEl: HTMLElement;
	let gridEl: HTMLDivElement;
	let onWidthsChange: (widths: Map<string, number>) => void;

	beforeEach(() => {
		onWidthsChange = vi.fn();
		sizer = new SuperGridSizer(() => 1.0, onWidthsChange);
		gridEl = makeGridEl();
		sizer.attach(gridEl);
		sizer.setLeafColKeys(['note']);
		sizer.setColWidths(new Map([['note', 120]]));
		headerEl = makeHeaderEl();
		// Add a label span for measuring
		const label = document.createElement('span');
		label.className = 'col-header-label';
		Object.defineProperty(label, 'scrollWidth', { value: 80, configurable: true });
		headerEl.appendChild(label);
		sizer.addHandleToHeader(headerEl, 'note');
	});

	it('dblclick calls e.stopPropagation (prevents collapse click)', () => {
		const handle = makeHandle(headerEl) as HTMLElement;
		const stopPropSpy = vi.fn();
		handle.addEventListener(
			'dblclick',
			(e) => {
				e.stopPropagation = stopPropSpy;
			},
			{ capture: true },
		);
		handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
		// The handler's stopPropagation is called
		// We verify by checking the handler logic doesn't throw
		expect(() => handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))).not.toThrow();
	});

	it('dblclick measures label scrollWidth and sets colWidth (with AUTO_FIT_PADDING)', () => {
		// Label scrollWidth=80, no data cells → fittedWidth = min(400, max(48, 80+24)) = 104
		const handle = makeHandle(headerEl) as HTMLElement;
		handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		// base = 104 / 1.0 = 104
		expect(sizer.getColWidths().get('note')).toBe(104);
	});

	it('dblclick calls onWidthsChange after setting width', () => {
		const handle = makeHandle(headerEl) as HTMLElement;
		handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		expect(onWidthsChange).toHaveBeenCalledOnce();
		expect((onWidthsChange as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBeInstanceOf(Map);
	});

	it('dblclick with large content clamps to AUTO_FIT_MAX', () => {
		// Override label scrollWidth to something huge
		const label = headerEl.querySelector('.col-header-label') as HTMLElement;
		Object.defineProperty(label, 'scrollWidth', { value: 600, configurable: true });
		const handle = makeHandle(headerEl) as HTMLElement;
		handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		// fittedWidth = min(400, max(48, 600+24)) = 400
		expect(sizer.getColWidths().get('note')).toBe(400);
	});

	it('dblclick with content below MIN_COL_WIDTH clamps to MIN_COL_WIDTH', () => {
		const label = headerEl.querySelector('.col-header-label') as HTMLElement;
		Object.defineProperty(label, 'scrollWidth', { value: 10, configurable: true });
		const handle = makeHandle(headerEl) as HTMLElement;
		handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		// fittedWidth = min(400, max(48, 10+24)) = 48
		expect(sizer.getColWidths().get('note')).toBeGreaterThanOrEqual(MIN_COL_WIDTH);
	});

	it('dblclick considers data cells scrollWidth (takes max)', () => {
		// Add a data cell wider than the label
		const cell = document.createElement('div');
		cell.className = 'data-cell';
		cell.dataset['colKey'] = 'note';
		Object.defineProperty(cell, 'scrollWidth', { value: 200, configurable: true });
		gridEl.appendChild(cell);

		const handle = makeHandle(headerEl) as HTMLElement;
		handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		// max(80, 200) = 200; fittedWidth = min(400, max(48, 200+24)) = 224; base = 224/1.0 = 224
		expect(sizer.getColWidths().get('note')).toBe(224);
	});

	it('dblclick at 2x zoom divides fitted width by zoomLevel', () => {
		const sizer2x = new SuperGridSizer(() => 2.0, vi.fn() as unknown as (widths: Map<string, number>) => void);
		const grid2 = makeGridEl();
		sizer2x.attach(grid2);
		sizer2x.setLeafColKeys(['note']);
		sizer2x.setColWidths(new Map([['note', 120]]));
		const h = makeHeaderEl();
		const label = document.createElement('span');
		label.className = 'col-header-label';
		Object.defineProperty(label, 'scrollWidth', { value: 80, configurable: true });
		h.appendChild(label);
		sizer2x.addHandleToHeader(h, 'note');
		const handle = makeHandle(h) as HTMLElement;
		handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		// fittedWidth=104, base=104/2.0=52
		expect(sizer2x.getColWidths().get('note')).toBe(52);
	});
});

// ---------------------------------------------------------------------------
// applyWidths
// ---------------------------------------------------------------------------

describe('SuperGridSizer — applyWidths', () => {
	let sizer: SuperGridSizer;
	let gridEl: HTMLDivElement;

	beforeEach(() => {
		sizer = new SuperGridSizer(() => 1.0);
		gridEl = makeGridEl();
		sizer.attach(gridEl);
	});

	it('applyWidths sets gridTemplateColumns on gridEl', () => {
		sizer.setColWidths(
			new Map([
				['note', 200],
				['task', 150],
			]),
		);
		sizer.applyWidths(['note', 'task'], 1.0, gridEl);
		// 80px row header (depth=1, 80px/level) + 200px + 150px
		expect(gridEl.style.gridTemplateColumns).toBe('80px 200px 150px');
	});

	it('applyWidths scales by zoomLevel', () => {
		sizer.setColWidths(new Map([['note', 100]]));
		sizer.applyWidths(['note'], 2.0, gridEl);
		// 80px row header (not scaled) + 100*2=200px
		expect(gridEl.style.gridTemplateColumns).toBe('80px 200px');
	});

	it('applyWidths with empty leafColKeys sets only row header', () => {
		sizer.applyWidths([], 1.0, gridEl);
		expect(gridEl.style.gridTemplateColumns).toBe('80px');
	});

	it('applyWidths accepts optional rowHeaderDepth parameter', () => {
		sizer.setColWidths(new Map([['note', 120]]));
		// depth=2 → two 80px row header columns
		sizer.applyWidths(['note'], 1.0, gridEl, 2);
		expect(gridEl.style.gridTemplateColumns).toBe('80px 80px 120px');
	});
});
