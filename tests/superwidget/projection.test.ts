// Isometry v13.0 — Phase 163 Projection State Machine Tests
// Tests for PROJ-01 through PROJ-05.
// No jsdom annotation needed — pure data, node environment is fine.
//
// Reference equality contract: all no-op transitions MUST return the exact
// same object reference (toBe), not a structurally equal copy. This is
// load-bearing for Phase 164 render bail-out logic.

import { describe, expect, it } from 'vitest';
import {
	type CanvasBinding,
	type CanvasType,
	type Projection,
	type ZoneRole,
	setBinding,
	setCanvas,
	switchTab,
	toggleTabEnabled,
} from '../../src/superwidget/projection';

// ---------------------------------------------------------------------------
// Shared fixture factory
// ---------------------------------------------------------------------------

function makeProjection(overrides: Partial<Projection> = {}): Projection {
	return {
		canvasType: 'View',
		canvasBinding: 'Unbound',
		zoneRole: 'primary',
		canvasId: 'canvas-1',
		activeTabId: 'tab-1',
		enabledTabIds: ['tab-1', 'tab-2'],
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// PROJ-01: Projection type shape and JSON round-trip
// ---------------------------------------------------------------------------

describe('PROJ-01: Projection type', () => {
	it('PROJ-01: Projection has all 6 required fields', () => {
		const proj = makeProjection();
		expect(proj).toHaveProperty('canvasType');
		expect(proj).toHaveProperty('canvasBinding');
		expect(proj).toHaveProperty('zoneRole');
		expect(proj).toHaveProperty('canvasId');
		expect(proj).toHaveProperty('activeTabId');
		expect(proj).toHaveProperty('enabledTabIds');
	});

	it('PROJ-01: Projection round-trips through JSON serialization without data loss', () => {
		const proj = makeProjection();
		const restored = JSON.parse(JSON.stringify(proj)) as Projection;
		expect(restored).toEqual(proj);
	});

	it('PROJ-01: enabledTabIds is an array after JSON round-trip', () => {
		const proj = makeProjection();
		const restored = JSON.parse(JSON.stringify(proj)) as Projection;
		expect(Array.isArray(restored.enabledTabIds)).toBe(true);
	});

	it('PROJ-01: all literal union types have correct values', () => {
		const ct: CanvasType = 'View';
		const cb: CanvasBinding = 'Unbound';
		const zr: ZoneRole = 'primary';
		expect(ct).toBe('View');
		expect(cb).toBe('Unbound');
		expect(zr).toBe('primary');
	});
});

// ---------------------------------------------------------------------------
// PROJ-02: switchTab reference equality
// ---------------------------------------------------------------------------

describe('PROJ-02: switchTab', () => {
	it('PROJ-02: switchTab with invalid tabId returns original reference', () => {
		const proj = makeProjection();
		const result = switchTab(proj, 'tab-99'); // not in enabledTabIds
		expect(result).toBe(proj);
	});

	it('PROJ-02: switchTab with already-active tabId returns original reference', () => {
		const proj = makeProjection({ activeTabId: 'tab-1' });
		const result = switchTab(proj, 'tab-1');
		expect(result).toBe(proj);
	});

	it('PROJ-02: switchTab to a valid enabled tab produces a new Projection', () => {
		const proj = makeProjection({ activeTabId: 'tab-1', enabledTabIds: ['tab-1', 'tab-2'] });
		const result = switchTab(proj, 'tab-2');
		expect(result).not.toBe(proj);
		expect(result.activeTabId).toBe('tab-2');
	});

	it('PROJ-02: switchTab result has correct structure', () => {
		const proj = makeProjection({ activeTabId: 'tab-1', enabledTabIds: ['tab-1', 'tab-2'] });
		const result = switchTab(proj, 'tab-2');
		expect(result).toEqual({ ...proj, activeTabId: 'tab-2' });
	});
});

// ---------------------------------------------------------------------------
// PROJ-03: setCanvas transitions
// ---------------------------------------------------------------------------

describe('PROJ-03: setCanvas', () => {
	it('PROJ-03: setCanvas with new canvasId and canvasType produces new Projection', () => {
		const proj = makeProjection({ canvasId: 'canvas-1', canvasType: 'View' });
		const result = setCanvas(proj, 'canvas-2', 'Editor');
		expect(result).not.toBe(proj);
		expect(result.canvasId).toBe('canvas-2');
		expect(result.canvasType).toBe('Editor');
	});

	it('PROJ-03: setCanvas with same canvasId and canvasType returns original reference (no-op)', () => {
		const proj = makeProjection({ canvasId: 'canvas-1', canvasType: 'View' });
		const result = setCanvas(proj, 'canvas-1', 'View');
		expect(result).toBe(proj);
	});

	it('PROJ-03: setCanvas does not change other fields', () => {
		const proj = makeProjection({
			canvasId: 'canvas-1',
			canvasType: 'View',
			activeTabId: 'tab-1',
			enabledTabIds: ['tab-1', 'tab-2'],
			zoneRole: 'secondary',
			canvasBinding: 'Unbound',
		});
		const result = setCanvas(proj, 'canvas-2', 'Explorer');
		expect(result.activeTabId).toBe(proj.activeTabId);
		expect(result.enabledTabIds).toBe(proj.enabledTabIds);
		expect(result.zoneRole).toBe(proj.zoneRole);
		expect(result.canvasBinding).toBe(proj.canvasBinding);
	});
});

// ---------------------------------------------------------------------------
// PROJ-04: setBinding reference equality
// ---------------------------------------------------------------------------

describe('PROJ-04: setBinding', () => {
	it('PROJ-04: setBinding Bound on Explorer (non-View) returns original reference', () => {
		const proj = makeProjection({ canvasType: 'Explorer', canvasBinding: 'Unbound' });
		const result = setBinding(proj, 'Bound');
		expect(result).toBe(proj);
	});

	it('PROJ-04: setBinding Bound on Editor (non-View) returns original reference', () => {
		const proj = makeProjection({ canvasType: 'Editor', canvasBinding: 'Unbound' });
		const result = setBinding(proj, 'Bound');
		expect(result).toBe(proj);
	});

	it('PROJ-04: setBinding Bound on View produces a new Projection', () => {
		const proj = makeProjection({ canvasType: 'View', canvasBinding: 'Unbound' });
		const result = setBinding(proj, 'Bound');
		expect(result).not.toBe(proj);
		expect(result.canvasBinding).toBe('Bound');
	});

	it('PROJ-04: setBinding with the same binding as current returns original reference', () => {
		const proj = makeProjection({ canvasType: 'View', canvasBinding: 'Unbound' });
		const result = setBinding(proj, 'Unbound');
		expect(result).toBe(proj);
	});

	it('PROJ-04: setBinding Unbound always transitions (binding guard only applies to Bound)', () => {
		const proj = makeProjection({ canvasType: 'Explorer', canvasBinding: 'Bound' });
		// Note: Bound on Explorer is an invalid state per validateProjection, but setBinding
		// only guards against setting Bound on non-View — Unbound always allowed if different
		const result = setBinding(proj, 'Unbound');
		expect(result).not.toBe(proj);
		expect(result.canvasBinding).toBe('Unbound');
	});
});

// ---------------------------------------------------------------------------
// PROJ-05: toggleTabEnabled reference equality and mutations
// ---------------------------------------------------------------------------

describe('PROJ-05: toggleTabEnabled', () => {
	it('PROJ-05: toggleTabEnabled on already-enabled tab returns original reference (no-op)', () => {
		const proj = makeProjection({ enabledTabIds: ['tab-1', 'tab-2'], activeTabId: 'tab-1' });
		const result = toggleTabEnabled(proj, 'tab-1');
		expect(result).toBe(proj);
	});

	it('PROJ-05: toggleTabEnabled to add a new tab produces new Projection', () => {
		const proj = makeProjection({ enabledTabIds: ['tab-1', 'tab-2'], activeTabId: 'tab-1' });
		const result = toggleTabEnabled(proj, 'tab-99');
		expect(result).not.toBe(proj);
	});

	it('PROJ-05: after adding, enabledTabIds contains the new tab', () => {
		const proj = makeProjection({ enabledTabIds: ['tab-1', 'tab-2'], activeTabId: 'tab-1' });
		const result = toggleTabEnabled(proj, 'tab-99');
		expect(result.enabledTabIds).toContain('tab-99');
	});

	it('PROJ-05: toggleTabEnabled to remove a non-active enabled tab removes it', () => {
		const proj = makeProjection({ enabledTabIds: ['tab-1', 'tab-2'], activeTabId: 'tab-1' });
		const result = toggleTabEnabled(proj, 'tab-2');
		expect(result).not.toBe(proj);
		expect(result.enabledTabIds).not.toContain('tab-2');
	});

	it('PROJ-05: toggleTabEnabled does NOT remove the active tab (guard)', () => {
		const proj = makeProjection({ enabledTabIds: ['tab-1', 'tab-2'], activeTabId: 'tab-1' });
		const result = toggleTabEnabled(proj, 'tab-1');
		// Attempting to remove the active tab returns original reference
		expect(result).toBe(proj);
	});

	it('PROJ-05: toggleTabEnabled preserves other fields when adding tab', () => {
		const proj = makeProjection({ enabledTabIds: ['tab-1'], activeTabId: 'tab-1' });
		const result = toggleTabEnabled(proj, 'tab-2');
		expect(result.canvasType).toBe(proj.canvasType);
		expect(result.canvasBinding).toBe(proj.canvasBinding);
		expect(result.canvasId).toBe(proj.canvasId);
		expect(result.activeTabId).toBe(proj.activeTabId);
		expect(result.zoneRole).toBe(proj.zoneRole);
	});
});
