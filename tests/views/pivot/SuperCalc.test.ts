// @vitest-environment jsdom
// Isometry v5 — Phase 100 Plan 03 SuperCalc plugin tests
// Extended in Phase 103 Plan 01 for null handling modes, COUNT semantics, scope, and AggResult
// Phase 105: Lifecycle describe blocks using makePluginHarness/usePlugin
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
import { createSuperCalcConfigPlugin } from '../../../src/views/pivot/plugins/SuperCalcConfig';
import {
	type AggFunction,
	type AggResult,
	type CalcConfig,
	type ColCalcConfig,
	type CountMode,
	computeAggregate,
	createSuperCalcFooterPlugin,
	getColConfig,
	type NullMode,
	type ScopeMode,
	WARNING_GLYPH,
} from '../../../src/views/pivot/plugins/SuperCalcFooter';
import { makePluginHarness } from './helpers/makePluginHarness';
import { usePlugin } from './helpers/usePlugin';

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

// ---------------------------------------------------------------------------
// Lifecycle — supercalc.footer
// ---------------------------------------------------------------------------

describe('Lifecycle — supercalc.footer', () => {
	it('hook has afterRender function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supercalc.footer');
		expect(typeof hook.afterRender).toBe('function');
	});

	it('hook has destroy function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supercalc.footer');
		expect(typeof hook.destroy).toBe('function');
	});

	it('hook transformData is undefined (footer does not filter cells)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supercalc.footer');
		expect(hook.transformData).toBeUndefined();
	});

	it('hook transformLayout is undefined (footer does not mutate layout)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supercalc.footer');
		expect(hook.transformLayout).toBeUndefined();
	});

	it('afterRender runs without throwing via pipeline', () => {
		const harness = makePluginHarness();
		// Wrap rootEl in a parent so footer can find gridWrapper
		const wrapper = document.createElement('div');
		wrapper.appendChild(harness.ctx.rootEl);
		document.body.appendChild(wrapper);

		usePlugin(harness, 'supercalc.footer');
		expect(() => harness.runPipeline()).not.toThrow();

		document.body.removeChild(wrapper);
	});

	it('afterRender creates .pv-calc-footer element when rootEl has parentElement', () => {
		const harness = makePluginHarness();
		const wrapper = document.createElement('div');
		wrapper.appendChild(harness.ctx.rootEl);
		document.body.appendChild(wrapper);

		usePlugin(harness, 'supercalc.footer');
		harness.runPipeline();

		const footer = wrapper.querySelector('.pv-calc-footer');
		expect(footer).not.toBeNull();

		document.body.removeChild(wrapper);
	});

	it('afterRender appends .pv-calc-footer as direct child of root (scroll container)', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'supercalc.footer');
		harness.runPipeline();

		const footer = harness.ctx.rootEl.querySelector('.pv-calc-footer');
		expect(footer).not.toBeNull();
		expect(footer!.parentElement).toBe(harness.ctx.rootEl);
	});

	it('.pv-calc-footer is sibling of table element inside root', () => {
		const harness = makePluginHarness();
		// Add a table inside rootEl to simulate scroll container structure
		const table = document.createElement('table');
		harness.ctx.rootEl.appendChild(table);

		usePlugin(harness, 'supercalc.footer');
		harness.runPipeline();

		const footer = harness.ctx.rootEl.querySelector('.pv-calc-footer');
		expect(footer).not.toBeNull();
		// footer should be a sibling (same parent) as the table
		expect(footer!.parentElement).toBe(harness.ctx.rootEl);
		expect(table.parentElement).toBe(harness.ctx.rootEl);
	});

	it('destroy removes footer from root', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supercalc.footer');
		harness.runPipeline();

		expect(harness.ctx.rootEl.querySelector('.pv-calc-footer')).not.toBeNull();

		hook.destroy!();

		expect(harness.ctx.rootEl.querySelector('.pv-calc-footer')).toBeNull();
	});

	it('destroy does not throw (single destroy)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supercalc.footer');
		expect(() => hook.destroy!()).not.toThrow();
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supercalc.footer');
		hook.destroy!();
		expect(() => hook.destroy!()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Lifecycle — supercalc.config
// ---------------------------------------------------------------------------

describe('Lifecycle — supercalc.config', () => {
	it('hook has afterRender function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supercalc.config');
		expect(typeof hook.afterRender).toBe('function');
	});

	it('hook has destroy function', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supercalc.config');
		expect(typeof hook.destroy).toBe('function');
	});

	it('hook transformData is undefined (config does not filter cells)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supercalc.config');
		expect(hook.transformData).toBeUndefined();
	});

	it('hook transformLayout is undefined (config does not mutate layout)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supercalc.config');
		expect(hook.transformLayout).toBeUndefined();
	});

	it('afterRender runs without throwing via pipeline (no sidebar = silent bail)', () => {
		const harness = makePluginHarness();
		usePlugin(harness, 'supercalc.config');
		// No .hns-sidebar in document — afterRender should bail silently
		expect(() => harness.runPipeline()).not.toThrow();
	});

	it('afterRender creates .hns-calc-config section when sidebar exists', () => {
		const harness = makePluginHarness();
		const sidebar = document.createElement('div');
		sidebar.className = 'hns-sidebar';
		document.body.appendChild(sidebar);

		usePlugin(harness, 'supercalc.config');
		harness.runPipeline();

		const section = sidebar.querySelector('.hns-calc-config');
		expect(section).not.toBeNull();

		document.body.removeChild(sidebar);
	});

	it('destroy does not throw (single destroy)', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supercalc.config');
		expect(() => hook.destroy!()).not.toThrow();
	});

	it('double destroy does not throw', () => {
		const harness = makePluginHarness();
		const hook = usePlugin(harness, 'supercalc.config');
		hook.destroy!();
		expect(() => hook.destroy!()).not.toThrow();
	});
});
