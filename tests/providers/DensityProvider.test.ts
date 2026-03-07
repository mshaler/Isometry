// Isometry v5 — Phase 4 Plan 03 (Task 2)
// Tests for DensityProvider: time granularity SQL compilation, subscriber pattern, serialization.
//
// Requirements: PROV-07, PROV-08
// TDD Phase: RED → GREEN → REFACTOR

import { describe, expect, it, vi } from 'vitest';
import { DensityProvider } from '../../src/providers/DensityProvider';

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

describe('DensityProvider — default state', () => {
	it('default timeField is "created_at"', () => {
		const provider = new DensityProvider();
		expect(provider.getState().timeField).toBe('created_at');
	});

	it('default granularity is "month"', () => {
		const provider = new DensityProvider();
		expect(provider.getState().granularity).toBe('month');
	});
});

// ---------------------------------------------------------------------------
// compile() — all five time granularities with default timeField (created_at)
// ---------------------------------------------------------------------------

describe('DensityProvider.compile() — default timeField (created_at)', () => {
	it('default compile() returns strftime for month granularity', () => {
		const provider = new DensityProvider();
		const result = provider.compile();
		expect(result.groupExpr).toBe("strftime('%Y-%m', created_at)");
	});

	it('setGranularity("day") → strftime("%Y-%m-%d", created_at)', () => {
		const provider = new DensityProvider();
		provider.setGranularity('day');
		const result = provider.compile();
		expect(result.groupExpr).toBe("strftime('%Y-%m-%d', created_at)");
	});

	it('setGranularity("week") → strftime("%Y-W%W", created_at)', () => {
		const provider = new DensityProvider();
		provider.setGranularity('week');
		const result = provider.compile();
		expect(result.groupExpr).toBe("strftime('%Y-W%W', created_at)");
	});

	it('setGranularity("month") → strftime("%Y-%m", created_at)', () => {
		const provider = new DensityProvider();
		provider.setGranularity('month');
		const result = provider.compile();
		expect(result.groupExpr).toBe("strftime('%Y-%m', created_at)");
	});

	it('setGranularity("quarter") → contains Q and integer division for quarter calculation', () => {
		const provider = new DensityProvider();
		provider.setGranularity('quarter');
		const result = provider.compile();
		// Must contain 'Q' for the quarter label
		expect(result.groupExpr).toContain('Q');
		// Must use integer division: (CAST(strftime('%m', field) AS INT) - 1) / 3 + 1
		expect(result.groupExpr).toContain('CAST(strftime');
		expect(result.groupExpr).toContain("'%m'");
		expect(result.groupExpr).toContain('AS INT');
		// Must contain the year strftime
		expect(result.groupExpr).toContain("strftime('%Y'");
	});

	it('setGranularity("quarter") → exact expression matches spec', () => {
		const provider = new DensityProvider();
		provider.setGranularity('quarter');
		const result = provider.compile();
		expect(result.groupExpr).toBe(
			"strftime('%Y', created_at) || '-Q' || ((CAST(strftime('%m', created_at) AS INT) - 1) / 3 + 1)",
		);
	});

	it('setGranularity("year") → strftime("%Y", created_at)', () => {
		const provider = new DensityProvider();
		provider.setGranularity('year');
		const result = provider.compile();
		expect(result.groupExpr).toBe("strftime('%Y', created_at)");
	});
});

// ---------------------------------------------------------------------------
// compile() — different timeField values
// ---------------------------------------------------------------------------

describe('DensityProvider.compile() — timeField switching', () => {
	it('setTimeField("due_at") changes field in strftime expressions', () => {
		const provider = new DensityProvider();
		provider.setTimeField('due_at');
		const result = provider.compile();
		expect(result.groupExpr).toContain('due_at');
		expect(result.groupExpr).not.toContain('created_at');
	});

	it('setTimeField("modified_at") + setGranularity("day") → strftime("%Y-%m-%d", modified_at)', () => {
		const provider = new DensityProvider();
		provider.setTimeField('modified_at');
		provider.setGranularity('day');
		const result = provider.compile();
		expect(result.groupExpr).toBe("strftime('%Y-%m-%d', modified_at)");
	});

	it('setTimeField("due_at") + setGranularity("week") → strftime("%Y-W%W", due_at)', () => {
		const provider = new DensityProvider();
		provider.setTimeField('due_at');
		provider.setGranularity('week');
		const result = provider.compile();
		expect(result.groupExpr).toBe("strftime('%Y-W%W', due_at)");
	});

	it('setTimeField("due_at") + setGranularity("quarter") → quarter expr with due_at', () => {
		const provider = new DensityProvider();
		provider.setTimeField('due_at');
		provider.setGranularity('quarter');
		const result = provider.compile();
		expect(result.groupExpr).toBe(
			"strftime('%Y', due_at) || '-Q' || ((CAST(strftime('%m', due_at) AS INT) - 1) / 3 + 1)",
		);
	});
});

// ---------------------------------------------------------------------------
// setTimeField — validation
// ---------------------------------------------------------------------------

describe('DensityProvider.setTimeField() — validation', () => {
	it('throws for invalid timeField', () => {
		const provider = new DensityProvider();
		expect(() => {
			provider.setTimeField('evil_column' as never);
		}).toThrow();
	});

	it('accepts "created_at"', () => {
		const provider = new DensityProvider();
		expect(() => provider.setTimeField('created_at')).not.toThrow();
	});

	it('accepts "modified_at"', () => {
		const provider = new DensityProvider();
		expect(() => provider.setTimeField('modified_at')).not.toThrow();
	});

	it('accepts "due_at"', () => {
		const provider = new DensityProvider();
		expect(() => provider.setTimeField('due_at')).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// subscribe() / unsubscribe pattern (PROV-11)
// ---------------------------------------------------------------------------

describe('DensityProvider.subscribe()', () => {
	it('returns an unsubscribe function', () => {
		const provider = new DensityProvider();
		const unsubscribe = provider.subscribe(() => {});
		expect(typeof unsubscribe).toBe('function');
	});

	it('calls subscriber after setGranularity (via queueMicrotask)', async () => {
		const provider = new DensityProvider();
		const cb = vi.fn();
		provider.subscribe(cb);
		provider.setGranularity('week');
		await Promise.resolve();
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('calls subscriber after setTimeField (via queueMicrotask)', async () => {
		const provider = new DensityProvider();
		const cb = vi.fn();
		provider.subscribe(cb);
		provider.setTimeField('due_at');
		await Promise.resolve();
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('two rapid mutations produce only ONE notification', async () => {
		const provider = new DensityProvider();
		const cb = vi.fn();
		provider.subscribe(cb);
		provider.setGranularity('week');
		provider.setTimeField('due_at');
		await Promise.resolve();
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('unsubscribe removes the subscriber', async () => {
		const provider = new DensityProvider();
		const cb = vi.fn();
		const unsubscribe = provider.subscribe(cb);
		unsubscribe();
		provider.setGranularity('year');
		await Promise.resolve();
		expect(cb).not.toHaveBeenCalled();
	});

	it('multiple subscribers all notified', async () => {
		const provider = new DensityProvider();
		const cb1 = vi.fn();
		const cb2 = vi.fn();
		provider.subscribe(cb1);
		provider.subscribe(cb2);
		provider.setGranularity('day');
		await Promise.resolve();
		expect(cb1).toHaveBeenCalledTimes(1);
		expect(cb2).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// Serialization (toJSON / setState / resetToDefaults)
// ---------------------------------------------------------------------------

describe('DensityProvider serialization', () => {
	it('toJSON() returns a valid JSON string', () => {
		const provider = new DensityProvider();
		const json = provider.toJSON();
		expect(typeof json).toBe('string');
		expect(() => JSON.parse(json)).not.toThrow();
	});

	it('toJSON/setState round-trips granularity', () => {
		const provider = new DensityProvider();
		provider.setGranularity('quarter');
		const json = provider.toJSON();

		const provider2 = new DensityProvider();
		provider2.setState(JSON.parse(json));
		expect(provider2.getState().granularity).toBe('quarter');
	});

	it('toJSON/setState round-trips timeField', () => {
		const provider = new DensityProvider();
		provider.setTimeField('modified_at');
		const json = provider.toJSON();

		const provider2 = new DensityProvider();
		provider2.setState(JSON.parse(json));
		expect(provider2.getState().timeField).toBe('modified_at');
	});

	it('toJSON/setState round-trips and produces correct compile() output', () => {
		const provider = new DensityProvider();
		provider.setTimeField('due_at');
		provider.setGranularity('year');
		const json = provider.toJSON();

		const provider2 = new DensityProvider();
		provider2.setState(JSON.parse(json));
		expect(provider2.compile().groupExpr).toBe("strftime('%Y', due_at)");
	});

	it('setState() with invalid state shape throws', () => {
		const provider = new DensityProvider();
		expect(() => provider.setState('not an object')).toThrow();
	});

	it('setState() with invalid granularity throws', () => {
		const provider = new DensityProvider();
		expect(() => provider.setState({ timeField: 'created_at', granularity: 'decade' })).toThrow();
	});

	it('setState() with invalid timeField throws', () => {
		const provider = new DensityProvider();
		expect(() => provider.setState({ timeField: 'evil_column', granularity: 'month' })).toThrow();
	});

	it('resetToDefaults() returns to created_at + month', () => {
		const provider = new DensityProvider();
		provider.setTimeField('due_at');
		provider.setGranularity('year');
		provider.resetToDefaults();

		const state = provider.getState();
		expect(state.timeField).toBe('created_at');
		expect(state.granularity).toBe('month');
	});

	it('resetToDefaults() compile() returns month expression for created_at', () => {
		const provider = new DensityProvider();
		provider.setTimeField('due_at');
		provider.setGranularity('year');
		provider.resetToDefaults();
		expect(provider.compile().groupExpr).toBe("strftime('%Y-%m', created_at)");
	});
});
