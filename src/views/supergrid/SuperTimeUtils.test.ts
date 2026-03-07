import { describe, expect, it } from 'vitest';
import { parseDateString, smartHierarchy } from './SuperTimeUtils';

// ============================================================
// parseDateString
// ============================================================

describe('parseDateString', () => {
	// --- Null / empty inputs ---
	it('returns null for empty string', () => {
		expect(parseDateString('')).toBeNull();
	});

	it('returns null for whitespace-only string', () => {
		expect(parseDateString('  ')).toBeNull();
	});

	it('returns null for null-like value cast to string', () => {
		// Guard: passing empty preserves null contract
		expect(parseDateString('')).toBeNull();
	});

	// --- Unparseable strings ---
	it('returns null for TBD', () => {
		expect(parseDateString('TBD')).toBeNull();
	});

	it('returns null for ASAP', () => {
		expect(parseDateString('ASAP')).toBeNull();
	});

	it('returns null for N/A', () => {
		expect(parseDateString('N/A')).toBeNull();
	});

	it('returns null for garbage text', () => {
		expect(parseDateString('pending')).toBeNull();
	});

	// --- ISO 8601 format ---
	it('parses ISO 8601 date: 2025-03-15', () => {
		const result = parseDateString('2025-03-15');
		expect(result).not.toBeNull();
		expect(result!.getFullYear()).toBe(2025);
		expect(result!.getMonth()).toBe(2); // 0-indexed: March = 2
		expect(result!.getDate()).toBe(15);
	});

	it('parses ISO 8601 January edge: 2025-01-01', () => {
		const result = parseDateString('2025-01-01');
		expect(result).not.toBeNull();
		expect(result!.getFullYear()).toBe(2025);
		expect(result!.getMonth()).toBe(0); // January = 0
		expect(result!.getDate()).toBe(1);
	});

	it('strips ISO datetime suffix (time component): 2025-03-05T14:30:00', () => {
		const result = parseDateString('2025-03-05T14:30:00');
		expect(result).not.toBeNull();
		expect(result!.getFullYear()).toBe(2025);
		expect(result!.getMonth()).toBe(2);
		expect(result!.getDate()).toBe(5);
	});

	it('strips ISO datetime with timezone suffix: 2025-03-05T14:30:00Z', () => {
		const result = parseDateString('2025-03-05T14:30:00Z');
		expect(result).not.toBeNull();
		expect(result!.getFullYear()).toBe(2025);
		expect(result!.getMonth()).toBe(2);
		expect(result!.getDate()).toBe(5);
	});

	// --- US format (MM/DD/YYYY) ---
	it('parses US format: 03/15/2025', () => {
		const result = parseDateString('03/15/2025');
		expect(result).not.toBeNull();
		expect(result!.getFullYear()).toBe(2025);
		expect(result!.getMonth()).toBe(2); // March = 2
		expect(result!.getDate()).toBe(15);
	});

	it('parses US format December edge: 12/31/2025', () => {
		const result = parseDateString('12/31/2025');
		expect(result).not.toBeNull();
		expect(result!.getFullYear()).toBe(2025);
		expect(result!.getMonth()).toBe(11); // December = 11
		expect(result!.getDate()).toBe(31);
	});

	// --- EU format (DD/MM/YYYY) ---
	it('parses EU format: 15/03/2025', () => {
		const result = parseDateString('15/03/2025');
		expect(result).not.toBeNull();
		expect(result!.getFullYear()).toBe(2025);
		expect(result!.getMonth()).toBe(2); // March = 2
		expect(result!.getDate()).toBe(15);
	});

	// --- ISO wins over US (first-wins chain) ---
	it('ISO wins over US format for 2025-03-15 (dash separators)', () => {
		// ISO parser tries first — dash format matches ISO
		const result = parseDateString('2025-03-15');
		expect(result).not.toBeNull();
		expect(result!.getFullYear()).toBe(2025);
	});
});

// ============================================================
// smartHierarchy
// ============================================================

describe('smartHierarchy', () => {
	// Helper: create a date N days after a fixed start
	const START = new Date(2025, 0, 1); // 2025-01-01

	function daysAfter(n: number): Date {
		const d = new Date(START);
		d.setDate(d.getDate() + n);
		return d;
	}

	// --- Day level (0–20 days) ---
	it('returns day for 0-day span (same date = single-date dataset)', () => {
		expect(smartHierarchy(START, START)).toBe('day');
	});

	it('returns day for 1-day span', () => {
		expect(smartHierarchy(START, daysAfter(1))).toBe('day');
	});

	it('returns day for 15-day span', () => {
		expect(smartHierarchy(START, daysAfter(15))).toBe('day');
	});

	it('returns day at boundary: 20 days', () => {
		expect(smartHierarchy(START, daysAfter(20))).toBe('day');
	});

	// --- Week level (21–140 days) ---
	it('returns week one past boundary: 21 days', () => {
		expect(smartHierarchy(START, daysAfter(21))).toBe('week');
	});

	it('returns week for 100-day span', () => {
		expect(smartHierarchy(START, daysAfter(100))).toBe('week');
	});

	it('returns week at boundary: 140 days', () => {
		expect(smartHierarchy(START, daysAfter(140))).toBe('week');
	});

	// --- Month level (141–610 days) ---
	it('returns month one past boundary: 141 days', () => {
		expect(smartHierarchy(START, daysAfter(141))).toBe('month');
	});

	it('returns month for 400-day span', () => {
		expect(smartHierarchy(START, daysAfter(400))).toBe('month');
	});

	it('returns month at boundary: 610 days', () => {
		expect(smartHierarchy(START, daysAfter(610))).toBe('month');
	});

	// --- Quarter level (611–1825 days) ---
	it('returns quarter one past boundary: 611 days', () => {
		expect(smartHierarchy(START, daysAfter(611))).toBe('quarter');
	});

	it('returns quarter for 1200-day span', () => {
		expect(smartHierarchy(START, daysAfter(1200))).toBe('quarter');
	});

	it('returns quarter at boundary: 1825 days', () => {
		expect(smartHierarchy(START, daysAfter(1825))).toBe('quarter');
	});

	// --- Year level (>1825 days) ---
	it('returns year one past boundary: 1826 days', () => {
		expect(smartHierarchy(START, daysAfter(1826))).toBe('year');
	});

	it('returns year for 3650-day span (10 years)', () => {
		expect(smartHierarchy(START, daysAfter(3650))).toBe('year');
	});
});
