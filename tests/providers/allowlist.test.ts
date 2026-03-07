// Isometry v5 — Phase 4 Plan 01 (Task 1)
// Tests for provider type system and allowlist validation.
//
// Requirements: PROV-01, PROV-02
// TDD Phase: RED → GREEN → REFACTOR

import { describe, expect, it } from 'vitest';
import {
	ALLOWED_AXIS_FIELDS,
	ALLOWED_FILTER_FIELDS,
	ALLOWED_OPERATORS,
	isValidAxisField,
	isValidFilterField,
	isValidOperator,
	validateAxisField,
	validateFilterField,
	validateOperator,
} from '../../src/providers/allowlist';

// ---------------------------------------------------------------------------
// ALLOWED_FILTER_FIELDS
// ---------------------------------------------------------------------------

describe('ALLOWED_FILTER_FIELDS', () => {
	it('contains card_type', () => {
		expect(ALLOWED_FILTER_FIELDS.has('card_type')).toBe(true);
	});

	it('contains name', () => {
		expect(ALLOWED_FILTER_FIELDS.has('name')).toBe(true);
	});

	it('contains folder', () => {
		expect(ALLOWED_FILTER_FIELDS.has('folder')).toBe(true);
	});

	it('contains status', () => {
		expect(ALLOWED_FILTER_FIELDS.has('status')).toBe(true);
	});

	it('contains source', () => {
		expect(ALLOWED_FILTER_FIELDS.has('source')).toBe(true);
	});

	it('contains created_at', () => {
		expect(ALLOWED_FILTER_FIELDS.has('created_at')).toBe(true);
	});

	it('contains modified_at', () => {
		expect(ALLOWED_FILTER_FIELDS.has('modified_at')).toBe(true);
	});

	it('contains due_at', () => {
		expect(ALLOWED_FILTER_FIELDS.has('due_at')).toBe(true);
	});

	it('contains completed_at', () => {
		expect(ALLOWED_FILTER_FIELDS.has('completed_at')).toBe(true);
	});

	it('contains event_start', () => {
		expect(ALLOWED_FILTER_FIELDS.has('event_start')).toBe(true);
	});

	it('contains event_end', () => {
		expect(ALLOWED_FILTER_FIELDS.has('event_end')).toBe(true);
	});

	it('contains latitude', () => {
		expect(ALLOWED_FILTER_FIELDS.has('latitude')).toBe(true);
	});

	it('contains longitude', () => {
		expect(ALLOWED_FILTER_FIELDS.has('longitude')).toBe(true);
	});

	it('contains location_name', () => {
		expect(ALLOWED_FILTER_FIELDS.has('location_name')).toBe(true);
	});

	it('contains priority', () => {
		expect(ALLOWED_FILTER_FIELDS.has('priority')).toBe(true);
	});

	it('contains sort_order', () => {
		expect(ALLOWED_FILTER_FIELDS.has('sort_order')).toBe(true);
	});

	it('is frozen (Object.isFrozen)', () => {
		expect(Object.isFrozen(ALLOWED_FILTER_FIELDS)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// ALLOWED_OPERATORS
// ---------------------------------------------------------------------------

describe('ALLOWED_OPERATORS', () => {
	const expected = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'startsWith', 'in', 'isNull', 'isNotNull'];

	for (const op of expected) {
		it(`contains ${op}`, () => {
			expect((ALLOWED_OPERATORS as Set<string>).has(op)).toBe(true);
		});
	}

	it('is frozen (Object.isFrozen)', () => {
		expect(Object.isFrozen(ALLOWED_OPERATORS)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// ALLOWED_AXIS_FIELDS
// ---------------------------------------------------------------------------

describe('ALLOWED_AXIS_FIELDS', () => {
	const expected = [
		'created_at',
		'modified_at',
		'due_at',
		'folder',
		'status',
		'card_type',
		'priority',
		'sort_order',
		'name',
	];

	for (const field of expected) {
		it(`contains ${field}`, () => {
			expect((ALLOWED_AXIS_FIELDS as Set<string>).has(field)).toBe(true);
		});
	}

	it('is frozen (Object.isFrozen)', () => {
		expect(Object.isFrozen(ALLOWED_AXIS_FIELDS)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// isValidFilterField
// ---------------------------------------------------------------------------

describe('isValidFilterField', () => {
	it('returns true for a valid field', () => {
		expect(isValidFilterField('folder')).toBe(true);
	});

	it('returns false for an invalid field', () => {
		expect(isValidFilterField('DROP TABLE')).toBe(false);
	});

	it('returns false for empty string', () => {
		expect(isValidFilterField('')).toBe(false);
	});

	it('returns false for SQL injection attempt', () => {
		expect(isValidFilterField("'; DROP TABLE cards; --")).toBe(false);
	});

	it('returns false for a valid-looking but unlisted field', () => {
		expect(isValidFilterField('content')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// isValidOperator
// ---------------------------------------------------------------------------

describe('isValidOperator', () => {
	it('returns true for eq', () => {
		expect(isValidOperator('eq')).toBe(true);
	});

	it('returns false for UNION SELECT', () => {
		expect(isValidOperator('UNION SELECT')).toBe(false);
	});

	it('returns false for raw SQL operator', () => {
		expect(isValidOperator('=')).toBe(false);
	});

	it('returns false for empty string', () => {
		expect(isValidOperator('')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// isValidAxisField
// ---------------------------------------------------------------------------

describe('isValidAxisField', () => {
	it('returns true for created_at', () => {
		expect(isValidAxisField('created_at')).toBe(true);
	});

	it('returns false for evil', () => {
		expect(isValidAxisField('evil')).toBe(false);
	});

	it('returns false for unlisted field', () => {
		expect(isValidAxisField('content')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// validateFilterField
// ---------------------------------------------------------------------------

describe('validateFilterField', () => {
	it('passes silently for a valid field', () => {
		expect(() => validateFilterField('folder')).not.toThrow();
	});

	it('throws Error for invalid field with "SQL safety violation" prefix', () => {
		expect(() => validateFilterField('unknown')).toThrowError(/SQL safety violation/);
	});

	it('throws for DROP TABLE injection', () => {
		expect(() => validateFilterField('DROP TABLE')).toThrowError(/SQL safety violation/);
	});

	it('error message contains the invalid field name', () => {
		try {
			validateFilterField('malicious_field');
			expect.fail('should have thrown');
		} catch (e) {
			expect((e as Error).message).toContain('malicious_field');
		}
	});
});

// ---------------------------------------------------------------------------
// validateOperator
// ---------------------------------------------------------------------------

describe('validateOperator', () => {
	it('passes silently for a valid operator', () => {
		expect(() => validateOperator('eq')).not.toThrow();
	});

	it('throws Error for invalid operator with "SQL safety violation" prefix', () => {
		expect(() => validateOperator('bad')).toThrowError(/SQL safety violation/);
	});

	it('throws for UNION SELECT injection', () => {
		expect(() => validateOperator('UNION SELECT')).toThrowError(/SQL safety violation/);
	});

	it('error message contains the invalid operator name', () => {
		try {
			validateOperator('EXECUTE');
			expect.fail('should have thrown');
		} catch (e) {
			expect((e as Error).message).toContain('EXECUTE');
		}
	});
});

// ---------------------------------------------------------------------------
// validateAxisField
// ---------------------------------------------------------------------------

describe('validateAxisField', () => {
	it('passes silently for a valid axis field', () => {
		expect(() => validateAxisField('name')).not.toThrow();
	});

	it('throws Error for invalid axis field with "SQL safety violation" prefix', () => {
		expect(() => validateAxisField('bad')).toThrowError(/SQL safety violation/);
	});

	it('throws for empty string', () => {
		expect(() => validateAxisField('')).toThrowError(/SQL safety violation/);
	});
});
