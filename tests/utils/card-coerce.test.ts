// Tests for coerceFieldValue — Phase 93 Plan 01

import { describe, expect, it } from 'vitest';
import { coerceFieldValue, isCoercionError } from '../../src/utils/card-coerce';

describe('coerceFieldValue — nullable text fields', () => {
	it('coerceFieldValue("summary", "") returns null', () => {
		expect(coerceFieldValue('summary', '')).toBe(null);
	});
	it('coerceFieldValue("folder", "") returns null', () => {
		expect(coerceFieldValue('folder', '')).toBe(null);
	});
	it('coerceFieldValue("status", "") returns null', () => {
		expect(coerceFieldValue('status', '')).toBe(null);
	});
	it('coerceFieldValue("url", "") returns null', () => {
		expect(coerceFieldValue('url', '')).toBe(null);
	});
	it('coerceFieldValue("mime_type", "") returns null', () => {
		expect(coerceFieldValue('mime_type', '')).toBe(null);
	});
	it('coerceFieldValue("source", "") returns null', () => {
		expect(coerceFieldValue('source', '')).toBe(null);
	});
	it('coerceFieldValue("source_id", "") returns null', () => {
		expect(coerceFieldValue('source_id', '')).toBe(null);
	});
	it('coerceFieldValue("source_url", "") returns null', () => {
		expect(coerceFieldValue('source_url', '')).toBe(null);
	});
	it('coerceFieldValue("location_name", "") returns null', () => {
		expect(coerceFieldValue('location_name', '')).toBe(null);
	});
	it('coerceFieldValue("summary", "some text") returns "some text"', () => {
		expect(coerceFieldValue('summary', 'some text')).toBe('some text');
	});
});

describe('coerceFieldValue — name field validation', () => {
	it('coerceFieldValue("name", "") returns error object', () => {
		const result = coerceFieldValue('name', '');
		expect(isCoercionError(result)).toBe(true);
		expect((result as { error: string }).error).toBe('Name is required');
	});
	it('coerceFieldValue("name", "   ") returns error object', () => {
		const result = coerceFieldValue('name', '   ');
		expect(isCoercionError(result)).toBe(true);
		expect((result as { error: string }).error).toBe('Name is required');
	});
	it('coerceFieldValue("name", "Valid Name") returns "Valid Name"', () => {
		expect(coerceFieldValue('name', 'Valid Name')).toBe('Valid Name');
	});
});

describe('coerceFieldValue — date fields', () => {
	it('coerceFieldValue("due_at", "") returns null', () => {
		expect(coerceFieldValue('due_at', '')).toBe(null);
	});
	it('coerceFieldValue("due_at", "2026-03-18") returns "2026-03-18"', () => {
		expect(coerceFieldValue('due_at', '2026-03-18')).toBe('2026-03-18');
	});
	it('coerceFieldValue("completed_at", "") returns null', () => {
		expect(coerceFieldValue('completed_at', '')).toBe(null);
	});
	it('coerceFieldValue("event_start", "2026-03-18") returns "2026-03-18"', () => {
		expect(coerceFieldValue('event_start', '2026-03-18')).toBe('2026-03-18');
	});
	it('coerceFieldValue("event_end", "") returns null', () => {
		expect(coerceFieldValue('event_end', '')).toBe(null);
	});
});

describe('coerceFieldValue — nullable number fields', () => {
	it('coerceFieldValue("latitude", "") returns null', () => {
		expect(coerceFieldValue('latitude', '')).toBe(null);
	});
	it('coerceFieldValue("longitude", "") returns null', () => {
		expect(coerceFieldValue('longitude', '')).toBe(null);
	});
	it('coerceFieldValue("latitude", "40.7128") returns 40.7128', () => {
		expect(coerceFieldValue('latitude', '40.7128')).toBe(40.7128);
	});
	it('coerceFieldValue("longitude", "-74.006") returns -74.006', () => {
		expect(coerceFieldValue('longitude', '-74.006')).toBe(-74.006);
	});
});

describe('coerceFieldValue — non-nullable number fields', () => {
	it('coerceFieldValue("priority", "5") returns 5', () => {
		expect(coerceFieldValue('priority', '5')).toBe(5);
	});
	it('coerceFieldValue("sort_order", "10") returns 10', () => {
		expect(coerceFieldValue('sort_order', '10')).toBe(10);
	});
	it('coerceFieldValue("priority", "") returns 0', () => {
		expect(coerceFieldValue('priority', '')).toBe(0);
	});
	it('coerceFieldValue("sort_order", "") returns 0', () => {
		expect(coerceFieldValue('sort_order', '')).toBe(0);
	});
});

describe('coerceFieldValue — boolean field', () => {
	it('coerceFieldValue("is_collective", true) returns true', () => {
		expect(coerceFieldValue('is_collective', true)).toBe(true);
	});
	it('coerceFieldValue("is_collective", false) returns false', () => {
		expect(coerceFieldValue('is_collective', false)).toBe(false);
	});
});

describe('coerceFieldValue — card_type passthrough', () => {
	it('coerceFieldValue("card_type", "task") returns "task"', () => {
		expect(coerceFieldValue('card_type', 'task')).toBe('task');
	});
	it('coerceFieldValue("card_type", "event") returns "event"', () => {
		expect(coerceFieldValue('card_type', 'event')).toBe('event');
	});
});

describe('coerceFieldValue — tags passthrough', () => {
	it('coerceFieldValue("tags", ["a", "b"]) returns ["a", "b"]', () => {
		expect(coerceFieldValue('tags', ['a', 'b'])).toEqual(['a', 'b']);
	});
	it('coerceFieldValue("tags", []) returns []', () => {
		expect(coerceFieldValue('tags', [])).toEqual([]);
	});
});

describe('isCoercionError type guard', () => {
	it('returns true for error objects', () => {
		expect(isCoercionError({ error: 'Name is required' })).toBe(true);
	});
	it('returns false for null', () => {
		expect(isCoercionError(null)).toBe(false);
	});
	it('returns false for strings', () => {
		expect(isCoercionError('some string')).toBe(false);
	});
	it('returns false for numbers', () => {
		expect(isCoercionError(42)).toBe(false);
	});
	it('returns false for arrays', () => {
		expect(isCoercionError(['a', 'b'])).toBe(false);
	});
});
