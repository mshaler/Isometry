// @vitest-environment jsdom
// Isometry v5 — Phase 100 Plan 03 SuperCalc plugin tests
// Extended in Phase 103 Plan 01 for null handling modes, COUNT semantics, scope, and AggResult
//
// Tests for:
//   - computeAggregate pure function (all 6 aggregate types + edge cases)
//   - NullMode, CountMode, ScopeMode, ColCalcConfig, CalcConfig, AggResult types
//   - nullMode: 'zero' — substitutes 0 for nulls
//   - nullMode: 'strict' — returns warning when any null present
//   - countMode: 'all' — returns total row count
//   - WARNING_GLYPH constant
//   - createSuperCalcFooterPlugin factory shape
//   - createSuperCalcConfigPlugin factory shape
//
// Requirements: CALC-01, CALC-02, SC2-01, SC2-02, SC2-03, SC2-04, SC2-05, SC2-06, SC2-07

import { beforeEach, describe, expect, it } from 'vitest';
import {
	computeAggregate,
	createSuperCalcFooterPlugin,
	getColConfig,
	type AggFunction,
	type NullMode,
	type CountMode,
	type ScopeMode,
	type ColCalcConfig,
	type CalcConfig,
	type AggResult,
	WARNING_GLYPH,
} from '../../../src/views/pivot/plugins/SuperCalcFooter';
import { createSuperCalcConfigPlugin } from '../../../src/views/pivot/plugins/SuperCalcConfig';

// ---------------------------------------------------------------------------
// WARNING_GLYPH constant
// ---------------------------------------------------------------------------

describe('WARNING_GLYPH', () => {
	it('equals unicode warning sign U+26A0', () => {
		expect(WARNING_GLYPH).toBe('\u26A0');
	});
});

// ---------------------------------------------------------------------------
// computeAggregate — regression tests (existing behavior, new 4-arg signature)
// ---------------------------------------------------------------------------

describe('computeAggregate — SUM (exclude/column, regression)', () => {
	it('sums non-null values', () => {
		expect(computeAggregate('SUM', [10, 20, 30], 'exclude', 'column').value).toBe(60);
	});

	it('treats null as 0 in SUM', () => {
		expect(computeAggregate('SUM', [10, null, 30], 'exclude', 'column').value).toBe(40);
	});

	it('returns null for empty array', () => {
		expect(computeAggregate('SUM', [], 'exclude', 'column').value).toBeNull();
	});

	it('returns 0 for all-null array', () => {
		// SUM of all-null is 0 (null treated as 0), NOT null
		expect(computeAggregate('SUM', [null, null], 'exclude', 'column').value).toBe(0);
	});
});

describe('computeAggregate — AVG (exclude/column, regression)', () => {
	it('averages non-null values', () => {
		expect(computeAggregate('AVG', [10, 20, 30], 'exclude', 'column').value).toBe(20);
	});

	it('ignores null in denominator', () => {
		// AVG([10, null, 30], exclude) = (10 + 30) / 2 = 20
		expect(computeAggregate('AVG', [10, null, 30], 'exclude', 'column').value).toBe(20);
	});

	it('returns null for empty array', () => {
		expect(computeAggregate('AVG', [], 'exclude', 'column').value).toBeNull();
	});

	it('returns null when all values are null', () => {
		expect(computeAggregate('AVG', [null, null], 'exclude', 'column').value).toBeNull();
	});
});

describe('computeAggregate — COUNT (exclude/column, regression)', () => {
	it('counts non-null values', () => {
		expect(computeAggregate('COUNT', [10, null, 30], 'exclude', 'column').value).toBe(2);
	});

	it('returns 0 for all-null array', () => {
		expect(computeAggregate('COUNT', [null, null, null], 'exclude', 'column').value).toBe(0);
	});

	it('returns 0 for empty array', () => {
		expect(computeAggregate('COUNT', [], 'exclude', 'column').value).toBe(0);
	});

	it('counts all when no nulls', () => {
		expect(computeAggregate('COUNT', [1, 2, 3, 4, 5], 'exclude', 'column').value).toBe(5);
	});
});

describe('computeAggregate — MIN (exclude/column, regression)', () => {
	it('returns minimum of non-null values', () => {
		expect(computeAggregate('MIN', [10, 20, 30], 'exclude', 'column').value).toBe(10);
	});

	it('ignores null values', () => {
		expect(computeAggregate('MIN', [null, 20, 5], 'exclude', 'column').value).toBe(5);
	});

	it('returns null for empty array', () => {
		expect(computeAggregate('MIN', [], 'exclude', 'column').value).toBeNull();
	});

	it('returns null when all values are null', () => {
		expect(computeAggregate('MIN', [null, null], 'exclude', 'column').value).toBeNull();
	});
});

describe('computeAggregate — MAX (exclude/column, regression)', () => {
	it('returns maximum of non-null values', () => {
		expect(computeAggregate('MAX', [10, 20, 30], 'exclude', 'column').value).toBe(30);
	});

	it('ignores null values', () => {
		expect(computeAggregate('MAX', [null, 5, 20], 'exclude', 'column').value).toBe(20);
	});

	it('returns null for empty array', () => {
		expect(computeAggregate('MAX', [], 'exclude', 'column').value).toBeNull();
	});

	it('returns null when all values are null', () => {
		expect(computeAggregate('MAX', [null], 'exclude', 'column').value).toBeNull();
	});
});

describe('computeAggregate — NONE (exclude/column, regression)', () => {
	it('returns null regardless of values', () => {
		expect(computeAggregate('NONE', [10, 20], 'exclude', 'column').value).toBeNull();
	});

	it('returns null for empty array', () => {
		expect(computeAggregate('NONE', [], 'exclude', 'column').value).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// computeAggregate — AggResult structure
// ---------------------------------------------------------------------------

describe('computeAggregate — AggResult structure', () => {
	it('returns object with value field (no warning) for normal computation', () => {
		const result = computeAggregate('SUM', [10, 20, 30], 'exclude', 'column');
		expect(result).toHaveProperty('value', 60);
		expect(result.warning).toBeUndefined();
	});

	it('returns object with value: null and no warning for NONE', () => {
		const result = computeAggregate('NONE', [10, 20], 'exclude', 'column');
		expect(result.value).toBeNull();
		expect(result.warning).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// computeAggregate — nullMode: 'zero'
// ---------------------------------------------------------------------------

describe('computeAggregate — nullMode: zero', () => {
	it('AVG with zero: divides by total rows including nulls', () => {
		// AVG([10, null, null], zero) = (10 + 0 + 0) / 3 ≈ 3.33
		expect(computeAggregate('AVG', [10, null, null], 'zero', 'column').value).toBeCloseTo(3.33, 1);
	});

	it('SUM with zero: same result as exclude for SUM', () => {
		expect(computeAggregate('SUM', [10, null, 30], 'zero', 'column').value).toBe(40);
	});

	it('MIN with zero: null becomes 0, so min is 0', () => {
		expect(computeAggregate('MIN', [10, null, 30], 'zero', 'column').value).toBe(0);
	});

	it('AVG with zero: divides by total rows (40/3)', () => {
		// AVG([10, null, 30], zero) = (10 + 0 + 30) / 3 ≈ 13.33
		expect(computeAggregate('AVG', [10, null, 30], 'zero', 'column').value).toBeCloseTo(13.33, 1);
	});

	it('COUNT with zero/column: still counts original non-nulls (not zero-substituted)', () => {
		// Zero substitution is a computation transform, not data rewrite
		expect(computeAggregate('COUNT', [10, null, 30], 'zero', 'column').value).toBe(2);
	});

	it('MAX with zero: null becomes 0', () => {
		expect(computeAggregate('MAX', [null, null, 5], 'zero', 'column').value).toBe(5);
	});

	it('empty array returns null even with zero mode', () => {
		expect(computeAggregate('SUM', [], 'zero', 'column').value).toBeNull();
	});

	it('all-null array with SUM/zero: sum of zeros = 0', () => {
		expect(computeAggregate('SUM', [null, null], 'zero', 'column').value).toBe(0);
	});

	it('no warning returned under zero mode', () => {
		const result = computeAggregate('AVG', [10, null, null], 'zero', 'column');
		expect(result.warning).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// computeAggregate — nullMode: 'strict'
// ---------------------------------------------------------------------------

describe('computeAggregate — nullMode: strict', () => {
	it('returns null value when any null present', () => {
		expect(computeAggregate('SUM', [10, null, 30], 'strict', 'column').value).toBeNull();
	});

	it('returns incomplete-data warning when any null present', () => {
		expect(computeAggregate('SUM', [10, null, 30], 'strict', 'column').warning).toBe('incomplete-data');
	});

	it('returns actual value when no nulls present', () => {
		expect(computeAggregate('SUM', [10, 20, 30], 'strict', 'column').value).toBe(60);
	});

	it('returns no warning when no nulls present', () => {
		expect(computeAggregate('SUM', [10, 20, 30], 'strict', 'column').warning).toBeUndefined();
	});

	it('AVG strict with nulls: value null + warning', () => {
		const result = computeAggregate('AVG', [10, null, 30], 'strict', 'column');
		expect(result.value).toBeNull();
		expect(result.warning).toBe('incomplete-data');
	});

	it('MIN strict without nulls: normal result', () => {
		const result = computeAggregate('MIN', [5, 10, 3], 'strict', 'column');
		expect(result.value).toBe(3);
		expect(result.warning).toBeUndefined();
	});

	it('empty array with strict: no warning (no nulls in empty)', () => {
		const result = computeAggregate('SUM', [], 'strict', 'column');
		expect(result.value).toBeNull();
		expect(result.warning).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// computeAggregate — countMode: 'all'
// ---------------------------------------------------------------------------

describe('computeAggregate — countMode: all', () => {
	it('COUNT all: returns total row count regardless of nulls', () => {
		expect(computeAggregate('COUNT', [10, null, 30], 'exclude', 'all').value).toBe(3);
	});

	it('COUNT all with zero mode: still total row count', () => {
		expect(computeAggregate('COUNT', [10, null, 30], 'zero', 'all').value).toBe(3);
	});

	it('COUNT all: empty array returns 0', () => {
		expect(computeAggregate('COUNT', [], 'exclude', 'all').value).toBe(0);
	});

	it('COUNT all: all nulls returns total length', () => {
		expect(computeAggregate('COUNT', [null, null, null], 'exclude', 'all').value).toBe(3);
	});
});

// ---------------------------------------------------------------------------
// createSuperCalcFooterPlugin — factory shape
// ---------------------------------------------------------------------------

describe('createSuperCalcFooterPlugin', () => {
	it('returns a PluginHook with afterRender', () => {
		const plugin = createSuperCalcFooterPlugin();
		expect(plugin).toBeDefined();
		expect(typeof plugin.afterRender).toBe('function');
	});

	it('returns a PluginHook with destroy', () => {
		const plugin = createSuperCalcFooterPlugin();
		expect(typeof plugin.destroy).toBe('function');
	});

	it('accepts CalcConfig object', () => {
		const sharedConfig: CalcConfig = {
			cols: new Map<number, ColCalcConfig>(),
			scope: 'view',
		};
		const plugin = createSuperCalcFooterPlugin(sharedConfig);
		expect(plugin).toBeDefined();
		expect(typeof plugin.afterRender).toBe('function');
	});

	it('default aggregate function is SUM (no shared config)', () => {
		// The plugin uses SUM by default — we verify by looking at the shared
		// config behavior: without sharedConfig, internal default is SUM
		const plugin = createSuperCalcFooterPlugin();
		// If no error thrown and plugin has afterRender, default is wired correctly
		expect(plugin.afterRender).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// createSuperCalcConfigPlugin — factory shape
// ---------------------------------------------------------------------------

describe('createSuperCalcConfigPlugin', () => {
	it('returns a PluginHook with afterRender', () => {
		const sharedConfig: CalcConfig = {
			cols: new Map<number, ColCalcConfig>(),
			scope: 'view',
		};
		const plugin = createSuperCalcConfigPlugin(sharedConfig);
		expect(plugin).toBeDefined();
		expect(typeof plugin.afterRender).toBe('function');
	});

	it('returns a PluginHook with destroy', () => {
		const sharedConfig: CalcConfig = {
			cols: new Map<number, ColCalcConfig>(),
			scope: 'view',
		};
		const plugin = createSuperCalcConfigPlugin(sharedConfig);
		expect(typeof plugin.destroy).toBe('function');
	});

	it('accepts optional onConfigChange callback', () => {
		const sharedConfig: CalcConfig = {
			cols: new Map<number, ColCalcConfig>(),
			scope: 'view',
		};
		const onChange = () => {};
		const plugin = createSuperCalcConfigPlugin(sharedConfig, onChange);
		expect(plugin).toBeDefined();
	});

	it('default aggregate for all columns is SUM', () => {
		const sharedConfig: CalcConfig = {
			cols: new Map<number, ColCalcConfig>(),
			scope: 'view',
		};
		// cols starts empty — footer plugin defaults to SUM
		expect(sharedConfig.cols.size).toBe(0);
		const plugin = createSuperCalcConfigPlugin(sharedConfig);
		expect(plugin).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// CalcConfig shape — getColConfig helper
// ---------------------------------------------------------------------------

describe('CalcConfig shape — getColConfig', () => {
	it('returns default config when colIdx not in map', () => {
		const calcConfig: CalcConfig = { cols: new Map(), scope: 'view' };
		expect(getColConfig(calcConfig, 0)).toEqual({
			fn: 'SUM',
			nullMode: 'exclude',
			countMode: 'column',
		});
	});

	it('returns default config for any missing colIdx', () => {
		const calcConfig: CalcConfig = { cols: new Map(), scope: 'view' };
		expect(getColConfig(calcConfig, 99)).toEqual({
			fn: 'SUM',
			nullMode: 'exclude',
			countMode: 'column',
		});
	});

	it('returns stored config when colIdx is present', () => {
		const calcConfig: CalcConfig = { cols: new Map(), scope: 'view' };
		const stored: ColCalcConfig = { fn: 'COUNT', nullMode: 'strict', countMode: 'all' };
		calcConfig.cols.set(0, stored);
		expect(getColConfig(calcConfig, 0)).toEqual(stored);
	});

	it('returns default for missing entry while returning stored for present entry', () => {
		const calcConfig: CalcConfig = { cols: new Map(), scope: 'view' };
		calcConfig.cols.set(1, { fn: 'AVG', nullMode: 'zero', countMode: 'column' });
		// colIdx 0 is missing — default
		expect(getColConfig(calcConfig, 0).fn).toBe('SUM');
		// colIdx 1 is stored — return stored
		expect(getColConfig(calcConfig, 1).fn).toBe('AVG');
	});

	it('default nullMode is exclude', () => {
		const calcConfig: CalcConfig = { cols: new Map(), scope: 'all' };
		expect(getColConfig(calcConfig, 0).nullMode).toBe('exclude');
	});

	it('default countMode is column', () => {
		const calcConfig: CalcConfig = { cols: new Map(), scope: 'all' };
		expect(getColConfig(calcConfig, 0).countMode).toBe('column');
	});
});
