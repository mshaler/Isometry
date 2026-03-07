// Isometry v5 — Phase 4 Plan 07 (Task 1)
// SQL injection test suite: verifies the safety model end-to-end.
//
// Requirements: PROV-02 (SAFE-06)
//
// Safety model:
//   - Field names and operators are validated against frozen allowlists BEFORE
//     being interpolated into SQL strings.
//   - User-supplied VALUES are NEVER interpolated — always placed in params[].
//   - Any attempt to use an invalid field or operator THROWS with "SQL safety violation:".
//
// Each test verifies ONE of TWO things:
//   (1) The operation throws with message starting "SQL safety violation:", OR
//   (2) The payload appears in params[] and NOT in the SQL string.

import { describe, expect, it } from 'vitest';
import { DensityProvider } from '../../src/providers/DensityProvider';
import { FilterProvider } from '../../src/providers/FilterProvider';
import { PAFVProvider } from '../../src/providers/PAFVProvider';
import type { AxisField, FilterField, FilterOperator } from '../../src/providers/types';

// ---------------------------------------------------------------------------
// FilterProvider — value injection (values must be parameterized)
// ---------------------------------------------------------------------------

describe('SQL injection — FilterProvider value safety', () => {
	it('SQL in filter value is safely parameterized (not interpolated in sql)', () => {
		const provider = new FilterProvider();
		const injectionPayload = "'; DROP TABLE cards; --";
		provider.addFilter({ field: 'folder', operator: 'eq', value: injectionPayload });
		const { where, params } = provider.compile();

		// Value must be in params, NOT in the SQL string
		expect(params).toContain(injectionPayload);
		expect(where).not.toContain(injectionPayload);
		expect(where).not.toContain('DROP TABLE');
	});

	it('Bobby Tables value is safely parameterized', () => {
		const provider = new FilterProvider();
		const bobbyTables = "Robert'); DROP TABLE students;--";
		provider.addFilter({ field: 'name', operator: 'eq', value: bobbyTables });
		const { where, params } = provider.compile();

		expect(params).toContain(bobbyTables);
		expect(where).not.toContain(bobbyTables);
		expect(where).not.toContain('DROP TABLE');
	});

	it('escaped single-quote in value is safely parameterized', () => {
		const provider = new FilterProvider();
		const payload = "O'Reilly";
		provider.addFilter({ field: 'name', operator: 'eq', value: payload });
		const { where, params } = provider.compile();

		expect(params).toContain(payload);
		expect(where).not.toContain("O'Reilly");
	});

	it('double-dash comment in value is safely parameterized', () => {
		const provider = new FilterProvider();
		const payload = 'valid -- DROP TABLE cards';
		provider.addFilter({ field: 'folder', operator: 'eq', value: payload });
		const { where, params } = provider.compile();

		expect(params).toContain(payload);
		expect(where).not.toContain('DROP TABLE');
	});

	it('semicolons in value are safely parameterized', () => {
		const provider = new FilterProvider();
		const payload = 'foo; SELECT * FROM cards; --';
		provider.addFilter({ field: 'status', operator: 'eq', value: payload });
		const { where, params } = provider.compile();

		expect(params).toContain(payload);
		expect(where).not.toContain('SELECT * FROM cards');
	});

	it('UNION injection in value is safely parameterized', () => {
		const provider = new FilterProvider();
		const payload = "' UNION SELECT * FROM cards --";
		provider.addFilter({ field: 'status', operator: 'eq', value: payload });
		const { where, params } = provider.compile();

		expect(params).toContain(payload);
		expect(where).not.toContain('UNION SELECT');
	});

	it('nested quotes in value are safely parameterized', () => {
		const provider = new FilterProvider();
		const payload = '"test" OR 1=1 --';
		provider.addFilter({ field: 'folder', operator: 'eq', value: payload });
		const { where, params } = provider.compile();

		expect(params).toContain(payload);
		expect(where).not.toContain('OR 1=1');
	});
});

// ---------------------------------------------------------------------------
// FilterProvider — field injection (must throw)
// ---------------------------------------------------------------------------

describe('SQL injection — FilterProvider field allowlist enforcement', () => {
	it('unknown field name throws SQL safety violation', () => {
		const provider = new FilterProvider();
		expect(() => {
			provider.addFilter({
				field: 'DROP TABLE cards' as FilterField,
				operator: 'eq',
				value: 'x',
			});
		}).toThrow(/SQL safety violation/);
	});

	it('SQL injection in field name throws SQL safety violation', () => {
		const provider = new FilterProvider();
		expect(() => {
			provider.addFilter({
				field: 'name; DROP TABLE cards' as FilterField,
				operator: 'eq',
				value: 'x',
			});
		}).toThrow(/SQL safety violation/);
	});

	it('empty string as field throws SQL safety violation', () => {
		const provider = new FilterProvider();
		expect(() => {
			provider.addFilter({
				field: '' as FilterField,
				operator: 'eq',
				value: 'x',
			});
		}).toThrow(/SQL safety violation/);
	});

	it('wildcard (* ) as field throws SQL safety violation', () => {
		const provider = new FilterProvider();
		expect(() => {
			provider.addFilter({
				field: '* FROM cards WHERE 1=1' as FilterField,
				operator: 'eq',
				value: 'x',
			});
		}).toThrow(/SQL safety violation/);
	});
});

// ---------------------------------------------------------------------------
// FilterProvider — operator injection (must throw)
// ---------------------------------------------------------------------------

describe('SQL injection — FilterProvider operator allowlist enforcement', () => {
	it('unknown operator throws SQL safety violation', () => {
		const provider = new FilterProvider();
		expect(() => {
			provider.addFilter({
				field: 'folder',
				operator: 'UNION SELECT' as FilterOperator,
				value: 'x',
			});
		}).toThrow(/SQL safety violation/);
	});

	it('SQL injection as operator throws SQL safety violation', () => {
		const provider = new FilterProvider();
		expect(() => {
			provider.addFilter({
				field: 'folder',
				operator: '= 1 OR 1=1 --' as FilterOperator,
				value: 'x',
			});
		}).toThrow(/SQL safety violation/);
	});

	it('raw SQL as operator throws SQL safety violation', () => {
		const provider = new FilterProvider();
		expect(() => {
			provider.addFilter({
				field: 'status',
				operator: 'IS NOT NULL; DROP TABLE cards; --' as FilterOperator,
				value: 'x',
			});
		}).toThrow(/SQL safety violation/);
	});
});

// ---------------------------------------------------------------------------
// PAFVProvider — axis field injection (must throw)
// ---------------------------------------------------------------------------

describe('SQL injection — PAFVProvider axis field allowlist enforcement', () => {
	it('SQL injection in x-axis field throws SQL safety violation', () => {
		const provider = new PAFVProvider();
		expect(() => {
			provider.setXAxis({
				field: 'name; DROP TABLE cards' as AxisField,
				direction: 'asc',
			});
		}).toThrow(/SQL safety violation/);
	});

	it('SQL injection in y-axis field throws SQL safety violation', () => {
		const provider = new PAFVProvider();
		expect(() => {
			provider.setYAxis({
				field: '* FROM cards LIMIT 1 --' as AxisField,
				direction: 'desc',
			});
		}).toThrow(/SQL safety violation/);
	});

	it('SQL injection in groupBy field throws SQL safety violation', () => {
		const provider = new PAFVProvider();
		expect(() => {
			provider.setGroupBy({
				field: 'status; DROP TABLE cards; --' as AxisField,
				direction: 'asc',
			});
		}).toThrow(/SQL safety violation/);
	});

	it('compile() with JSON-restored invalid x-axis field throws SQL safety violation', () => {
		const provider = new PAFVProvider();
		// Bypass addFilter validation by restoring directly via setState
		provider.setState({
			viewType: 'list',
			xAxis: { field: 'malicious; DROP TABLE', direction: 'asc' },
			yAxis: null,
			groupBy: null,
		});
		expect(() => provider.compile()).toThrow(/SQL safety violation/);
	});
});

// ---------------------------------------------------------------------------
// DensityProvider — no injection surface (strftime expressions only)
// ---------------------------------------------------------------------------

describe('SQL injection — DensityProvider strftime safety', () => {
	it('compile() with valid inputs produces only strftime() expressions', () => {
		const provider = new DensityProvider();
		provider.setState({ timeField: 'created_at', granularity: 'month' });
		const { groupExpr } = provider.compile();

		// Must contain strftime()
		expect(groupExpr).toContain('strftime(');
		// Must reference the valid field name
		expect(groupExpr).toContain('created_at');
		// Must NOT contain any SQL injection patterns
		expect(groupExpr).not.toContain('DROP TABLE');
		expect(groupExpr).not.toContain('SELECT');
		expect(groupExpr).not.toContain(';');
	});

	it('DensityProvider rejects invalid timeField in setState', () => {
		const provider = new DensityProvider();
		expect(() => {
			provider.setState({ timeField: 'injected_field; DROP TABLE', granularity: 'month' });
		}).toThrow();
	});

	it('DensityProvider rejects invalid granularity in setState', () => {
		const provider = new DensityProvider();
		expect(() => {
			provider.setState({ timeField: 'created_at', granularity: 'nanosecond' });
		}).toThrow();
	});

	it('all valid timeFields × granularities produce strftime() expressions without injection surface', () => {
		const timeFields: Array<'created_at' | 'modified_at' | 'due_at'> = ['created_at', 'modified_at', 'due_at'];
		const granularities: Array<'day' | 'week' | 'month' | 'quarter' | 'year'> = [
			'day',
			'week',
			'month',
			'quarter',
			'year',
		];

		for (const timeField of timeFields) {
			for (const granularity of granularities) {
				const provider = new DensityProvider();
				provider.setState({ timeField, granularity });
				const { groupExpr } = provider.compile();

				expect(groupExpr).toContain('strftime(');
				expect(groupExpr).toContain(timeField);
				expect(groupExpr).not.toContain(';');
				expect(groupExpr).not.toContain('DROP');
			}
		}
	});
});

// ---------------------------------------------------------------------------
// FilterProvider — compile() validates restored state (double-validation)
// ---------------------------------------------------------------------------

describe('SQL injection — FilterProvider compile() re-validates state', () => {
	it('compile() throws if internal state has invalid field (double-validation guard)', () => {
		const provider = new FilterProvider();
		// Directly mutate the public _filters array (simulates tampered/JSON-restored state
		// that bypassed addFilter's validation — the second line of defence is compile()).
		provider._filters.push({ field: 'malicious_field' as FilterField, operator: 'eq', value: 'x' });
		expect(() => provider.compile()).toThrow(/SQL safety violation/);
	});

	it('compile() throws if internal state has invalid operator (double-validation guard)', () => {
		const provider = new FilterProvider();
		// Directly mutate the public _filters array
		provider._filters.push({ field: 'folder', operator: 'UNION SELECT' as FilterOperator, value: 'x' });
		expect(() => provider.compile()).toThrow(/SQL safety violation/);
	});
});
