// Phase 137 Plan 01 — formatTimeBucket TDD tests
// Tests for all 5 granularity patterns + NO_DATE_SENTINEL + passthrough

import { describe, it, expect } from 'vitest';
import { formatTimeBucket } from '../../../src/views/supergrid/formatTimeBucket';

describe('formatTimeBucket', () => {
	describe('day granularity', () => {
		it('formats YYYY-MM-DD as "Mon DD, YYYY"', () => {
			expect(formatTimeBucket('2026-03-15')).toBe('Mar 15, 2026');
		});

		it('formats another day correctly', () => {
			expect(formatTimeBucket('2025-01-01')).toBe('Jan 01, 2025');
		});

		it('formats end-of-year day', () => {
			expect(formatTimeBucket('2026-12-31')).toBe('Dec 31, 2026');
		});
	});

	describe('week granularity', () => {
		it('formats YYYY-Www as "Week WW, YYYY"', () => {
			expect(formatTimeBucket('2026-W14')).toBe('Week 14, 2026');
		});

		it('formats single-digit week number', () => {
			expect(formatTimeBucket('2026-W01')).toBe('Week 01, 2026');
		});

		it('formats week 52', () => {
			expect(formatTimeBucket('2025-W52')).toBe('Week 52, 2025');
		});
	});

	describe('month granularity', () => {
		it('formats YYYY-MM as "Mon YYYY"', () => {
			expect(formatTimeBucket('2026-03')).toBe('Mar 2026');
		});

		it('formats January', () => {
			expect(formatTimeBucket('2025-01')).toBe('Jan 2025');
		});

		it('formats December', () => {
			expect(formatTimeBucket('2026-12')).toBe('Dec 2026');
		});
	});

	describe('quarter granularity', () => {
		it('formats YYYY-Qn as "Qn YYYY"', () => {
			expect(formatTimeBucket('2026-Q1')).toBe('Q1 2026');
		});

		it('formats Q2', () => {
			expect(formatTimeBucket('2026-Q2')).toBe('Q2 2026');
		});

		it('formats Q4', () => {
			expect(formatTimeBucket('2025-Q4')).toBe('Q4 2025');
		});
	});

	describe('year granularity', () => {
		it('passes through 4-digit year as-is', () => {
			expect(formatTimeBucket('2026')).toBe('2026');
		});

		it('passes through another year as-is', () => {
			expect(formatTimeBucket('2000')).toBe('2000');
		});
	});

	describe('NO_DATE_SENTINEL', () => {
		it('formats __NO_DATE__ as "No Date"', () => {
			expect(formatTimeBucket('__NO_DATE__')).toBe('No Date');
		});
	});

	describe('passthrough for non-time values', () => {
		it('passes through category strings unchanged', () => {
			expect(formatTimeBucket('some_category')).toBe('some_category');
		});

		it('passes through arbitrary strings', () => {
			expect(formatTimeBucket('Work')).toBe('Work');
		});

		it('passes through empty string', () => {
			expect(formatTimeBucket('')).toBe('');
		});
	});
});
