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
	validateProjection,
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

// ---------------------------------------------------------------------------
// PROJ-06: validateProjection — catches all four invalid states, never throws
// Each test violates exactly ONE condition to avoid ordering dependence (Pitfall 4).
// ---------------------------------------------------------------------------

describe('PROJ-06: validateProjection', () => {
	it('PROJ-06: activeTabId not in enabledTabIds returns {valid: false, reason contains "activeTabId"}', () => {
		const invalid: Projection = {
			activeTabId: 'missing',
			enabledTabIds: ['tab-1'],
			canvasType: 'View',
			canvasBinding: 'Unbound',
			zoneRole: 'primary',
			canvasId: 'c1',
		};
		const result = validateProjection(invalid);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.reason).toContain('activeTabId');
		}
	});

	it('PROJ-06: canvasBinding=Bound with canvasType=Explorer returns {valid: false, reason contains "Bound"}', () => {
		const invalid: Projection = {
			canvasType: 'Explorer',
			canvasBinding: 'Bound',
			activeTabId: 'tab-1',
			enabledTabIds: ['tab-1'],
			zoneRole: 'primary',
			canvasId: 'c1',
		};
		const result = validateProjection(invalid);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.reason).toContain('Bound');
		}
	});

	it('PROJ-06: canvasBinding=Bound with canvasType=Editor returns {valid: false, reason contains "Bound"}', () => {
		const invalid: Projection = {
			canvasType: 'Editor',
			canvasBinding: 'Bound',
			activeTabId: 'tab-1',
			enabledTabIds: ['tab-1'],
			zoneRole: 'primary',
			canvasId: 'c1',
		};
		const result = validateProjection(invalid);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.reason).toContain('Bound');
		}
	});

	it('PROJ-06: canvasId="" returns {valid: false, reason contains "canvasId"}', () => {
		const invalid: Projection = {
			canvasId: '',
			activeTabId: 'tab-1',
			enabledTabIds: ['tab-1'],
			canvasType: 'View',
			canvasBinding: 'Unbound',
			zoneRole: 'primary',
		};
		const result = validateProjection(invalid);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.reason).toContain('canvasId');
		}
	});

	it('PROJ-06: enabledTabIds=[] returns {valid: false, reason contains "enabledTabIds"}', () => {
		// Note: with empty enabledTabIds, activeTabId='tab-1' is also invalid, but
		// check order (enabledTabIds.length first) ensures this returns enabledTabIds reason.
		const invalid: Projection = {
			enabledTabIds: [],
			activeTabId: 'tab-1',
			canvasType: 'View',
			canvasBinding: 'Unbound',
			zoneRole: 'primary',
			canvasId: 'c1',
		};
		const result = validateProjection(invalid);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.reason).toContain('enabledTabIds');
		}
	});

	it('PROJ-06: well-formed Projection returns {valid: true}', () => {
		const valid = makeProjection();
		const result = validateProjection(valid);
		expect(result.valid).toBe(true);
	});

	it('PROJ-06: validateProjection does not throw for invalid activeTabId', () => {
		const invalid: Projection = {
			activeTabId: 'missing',
			enabledTabIds: ['tab-1'],
			canvasType: 'View',
			canvasBinding: 'Unbound',
			zoneRole: 'primary',
			canvasId: 'c1',
		};
		expect(() => validateProjection(invalid)).not.toThrow();
	});

	it('PROJ-06: validateProjection does not throw for Bound on non-View', () => {
		const invalid: Projection = {
			canvasType: 'Explorer',
			canvasBinding: 'Bound',
			activeTabId: 'tab-1',
			enabledTabIds: ['tab-1'],
			zoneRole: 'primary',
			canvasId: 'c1',
		};
		expect(() => validateProjection(invalid)).not.toThrow();
	});

	it('PROJ-06: validateProjection does not throw for empty canvasId', () => {
		const invalid: Projection = {
			canvasId: '',
			activeTabId: 'tab-1',
			enabledTabIds: ['tab-1'],
			canvasType: 'View',
			canvasBinding: 'Unbound',
			zoneRole: 'primary',
		};
		expect(() => validateProjection(invalid)).not.toThrow();
	});

	it('PROJ-06: validateProjection does not throw for empty enabledTabIds', () => {
		const invalid: Projection = {
			enabledTabIds: [],
			activeTabId: 'tab-1',
			canvasType: 'View',
			canvasBinding: 'Unbound',
			zoneRole: 'primary',
			canvasId: 'c1',
		};
		expect(() => validateProjection(invalid)).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// PROJ-07: Purity — all 5 functions produce consistent output for identical input
// No captured mutable state; frozen-input verifies no mutation of the Projection.
// ---------------------------------------------------------------------------

describe('PROJ-07: purity', () => {
	it('PROJ-07: switchTab (no-op) returns same reference across 3 calls', () => {
		const proj = makeProjection();
		const r1 = switchTab(proj, 'tab-99');
		const r2 = switchTab(proj, 'tab-99');
		const r3 = switchTab(proj, 'tab-99');
		expect(r1).toBe(proj);
		expect(r2).toBe(proj);
		expect(r3).toBe(proj);
	});

	it('PROJ-07: setCanvas (state-changing) produces structurally equal results across 3 calls', () => {
		const proj = makeProjection({ canvasId: 'canvas-1', canvasType: 'View' });
		const r1 = setCanvas(proj, 'canvas-2', 'Editor');
		const r2 = setCanvas(proj, 'canvas-2', 'Editor');
		const r3 = setCanvas(proj, 'canvas-2', 'Editor');
		expect(r1).toEqual(r2);
		expect(r2).toEqual(r3);
	});

	it('PROJ-07: setBinding (no-op) returns same reference across 3 calls', () => {
		const proj = makeProjection({ canvasType: 'View', canvasBinding: 'Unbound' });
		const r1 = setBinding(proj, 'Unbound');
		const r2 = setBinding(proj, 'Unbound');
		const r3 = setBinding(proj, 'Unbound');
		expect(r1).toBe(proj);
		expect(r2).toBe(proj);
		expect(r3).toBe(proj);
	});

	it('PROJ-07: toggleTabEnabled (state-changing) produces structurally equal results across 3 calls', () => {
		const proj = makeProjection({ enabledTabIds: ['tab-1'], activeTabId: 'tab-1' });
		const r1 = toggleTabEnabled(proj, 'tab-2');
		const r2 = toggleTabEnabled(proj, 'tab-2');
		const r3 = toggleTabEnabled(proj, 'tab-2');
		expect(r1).toEqual(r2);
		expect(r2).toEqual(r3);
	});

	it('PROJ-07: validateProjection produces consistent results across 3 calls', () => {
		const proj = makeProjection();
		const r1 = validateProjection(proj);
		const r2 = validateProjection(proj);
		const r3 = validateProjection(proj);
		expect(r1).toEqual(r2);
		expect(r2).toEqual(r3);
	});

	it('PROJ-07: frozen input — switchTab does not throw or mutate', () => {
		const proj = makeProjection();
		const frozenProj = Object.freeze({ ...proj, enabledTabIds: Object.freeze([...proj.enabledTabIds]) as ReadonlyArray<string> });
		expect(() => switchTab(frozenProj, 'tab-99')).not.toThrow();
		expect(() => switchTab(frozenProj, 'tab-2')).not.toThrow();
	});

	it('PROJ-07: frozen input — setCanvas does not throw or mutate', () => {
		const proj = makeProjection();
		const frozenProj = Object.freeze({ ...proj, enabledTabIds: Object.freeze([...proj.enabledTabIds]) as ReadonlyArray<string> });
		expect(() => setCanvas(frozenProj, 'canvas-2', 'Editor')).not.toThrow();
	});

	it('PROJ-07: frozen input — setBinding does not throw or mutate', () => {
		const proj = makeProjection({ canvasType: 'View', canvasBinding: 'Unbound' });
		const frozenProj = Object.freeze({ ...proj, enabledTabIds: Object.freeze([...proj.enabledTabIds]) as ReadonlyArray<string> });
		expect(() => setBinding(frozenProj, 'Bound')).not.toThrow();
	});

	it('PROJ-07: frozen input — toggleTabEnabled does not throw or mutate', () => {
		const proj = makeProjection();
		const frozenProj = Object.freeze({ ...proj, enabledTabIds: Object.freeze([...proj.enabledTabIds]) as ReadonlyArray<string> });
		// Adding a new tab on frozen input — must construct a new array, not mutate
		expect(() => toggleTabEnabled(frozenProj, 'tab-99')).not.toThrow();
	});

	it('PROJ-07: frozen input — validateProjection does not throw or mutate', () => {
		const proj = makeProjection();
		const frozenProj = Object.freeze({ ...proj, enabledTabIds: Object.freeze([...proj.enabledTabIds]) as ReadonlyArray<string> });
		expect(() => validateProjection(frozenProj)).not.toThrow();
	});
});
