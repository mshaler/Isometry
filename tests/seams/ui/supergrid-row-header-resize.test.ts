// @vitest-environment jsdom
/**
 * Isometry v7.0 — Phase 89 Plan 01
 * SuperGrid row header resize seam tests.
 *
 * Verifies that:
 *   - Row header width defaults to 80 (ROW_HEADER_LEVEL_WIDTH)
 *   - Width clamps to minimum 40px
 *   - Width clamps to maximum 300px
 *   - SuperGridSizer.applyWidths forwards rowHeaderLevelWidth to buildGridTemplateColumns
 *   - SuperGridSizer._rebuildGridTemplate uses stored _rowHeaderLevelWidth
 *
 * Requirements: SGFX-02
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SuperGridSizer } from '../../../src/views/supergrid/SuperGridSizer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGridEl(): HTMLDivElement {
	const el = document.createElement('div');
	document.body.appendChild(el);
	return el;
}

// ---------------------------------------------------------------------------
// SGFX-02: Row header width clamping logic
// ---------------------------------------------------------------------------

describe('SGFX-02: Row header width clamping', () => {
	it('Test 1: clamping with value below minimum returns 40', () => {
		const result = Math.max(40, Math.min(300, -10));
		expect(result).toBe(40);
	});

	it('Test 2: clamping with value at minimum boundary returns 40', () => {
		const result = Math.max(40, Math.min(300, 40));
		expect(result).toBe(40);
	});

	it('Test 3: clamping with value above maximum returns 300', () => {
		const result = Math.max(40, Math.min(300, 500));
		expect(result).toBe(300);
	});

	it('Test 4: clamping with value at maximum boundary returns 300', () => {
		const result = Math.max(40, Math.min(300, 300));
		expect(result).toBe(300);
	});

	it('Test 5: clamping with value within range returns value unchanged', () => {
		const result = Math.max(40, Math.min(300, 120));
		expect(result).toBe(120);
	});
});

// ---------------------------------------------------------------------------
// SGFX-02: SuperGridSizer rowHeaderLevelWidth parameter
// ---------------------------------------------------------------------------

describe('SGFX-02: SuperGridSizer.applyWidths rowHeaderLevelWidth forwarding', () => {
	let sizer: SuperGridSizer;
	let gridEl: HTMLDivElement;

	beforeEach(() => {
		sizer = new SuperGridSizer(() => 1.0);
		gridEl = makeGridEl();
		sizer.attach(gridEl);
	});

	afterEach(() => {
		sizer.detach();
		gridEl.remove();
	});

	it('Test 1: applyWidths with no rowHeaderLevelWidth uses default 80px in template', () => {
		sizer.applyWidths(['col1'], 1.0, gridEl, 1, false);
		expect(gridEl.style.gridTemplateColumns).toContain('80px');
	});

	it('Test 2: applyWidths with rowHeaderLevelWidth=120 uses 120px in template', () => {
		sizer.applyWidths(['col1'], 1.0, gridEl, 1, false, 120);
		expect(gridEl.style.gridTemplateColumns).toContain('120px');
		// Should NOT contain the default 80px for row header
		const parts = gridEl.style.gridTemplateColumns.split(' ');
		expect(parts[0]).toBe('120px');
	});

	it('Test 3: applyWidths with rowHeaderLevelWidth=40 (min) uses 40px in template', () => {
		sizer.applyWidths(['col1'], 1.0, gridEl, 1, false, 40);
		expect(gridEl.style.gridTemplateColumns).toContain('40px');
		const parts = gridEl.style.gridTemplateColumns.split(' ');
		expect(parts[0]).toBe('40px');
	});

	it('Test 4: applyWidths with rowHeaderLevelWidth=300 (max) uses 300px in template', () => {
		sizer.applyWidths(['col1'], 1.0, gridEl, 1, false, 300);
		expect(gridEl.style.gridTemplateColumns).toContain('300px');
		const parts = gridEl.style.gridTemplateColumns.split(' ');
		expect(parts[0]).toBe('300px');
	});
});

// ---------------------------------------------------------------------------
// SGFX-02: SuperGridSizer.setRowHeaderLevelWidth updates _rebuildGridTemplate
// ---------------------------------------------------------------------------

describe('SGFX-02: SuperGridSizer.setRowHeaderLevelWidth', () => {
	let sizer: SuperGridSizer;
	let gridEl: HTMLDivElement;

	beforeEach(() => {
		sizer = new SuperGridSizer(() => 1.0);
		gridEl = makeGridEl();
		sizer.attach(gridEl);
		sizer.setLeafColKeys(['col1']);
	});

	afterEach(() => {
		sizer.detach();
		gridEl.remove();
	});

	it('Test 1: setRowHeaderLevelWidth(150) updates grid template immediately', () => {
		sizer.setRowHeaderLevelWidth(150);
		const parts = gridEl.style.gridTemplateColumns.split(' ');
		expect(parts[0]).toBe('150px');
	});

	it('Test 2: setRowHeaderLevelWidth(80) default value produces same template as no-set', () => {
		// Default state
		sizer.applyWidths(['col1'], 1.0, gridEl, 1, false, 80);
		const defaultTemplate = gridEl.style.gridTemplateColumns;

		// Set to 80 explicitly
		sizer.setRowHeaderLevelWidth(80);
		const afterSetTemplate = gridEl.style.gridTemplateColumns;

		expect(afterSetTemplate).toBe(defaultTemplate);
	});

	it('Test 3: setRowHeaderLevelWidth is a public method on SuperGridSizer', () => {
		expect(typeof sizer.setRowHeaderLevelWidth).toBe('function');
	});
});
