// Isometry v5 -- Phase 65 ChartParser Tests
// Unit tests for YAML-style chart config parsing and validation.
//
// Pure logic tests (no DOM needed). Tests all 4 chart types,
// required field validation, comment/whitespace handling, and type coercion.

import { describe, expect, it } from 'vitest';
import { parseChartConfig } from './ChartParser';

// ---------------------------------------------------------------------------
// Valid Configs
// ---------------------------------------------------------------------------

describe('parseChartConfig — valid configs', () => {
	it('parses bar chart with x and y=count', () => {
		const result = parseChartConfig('type: bar\nx: folder\ny: count');
		expect(result).toEqual({ type: 'bar', x: 'folder', y: 'count' });
	});

	it('parses pie chart with value field', () => {
		const result = parseChartConfig('type: pie\nvalue: card_type');
		expect(result).toEqual({ type: 'pie', value: 'card_type' });
	});

	it('parses line chart with x, y=count, and title', () => {
		const result = parseChartConfig('type: line\nx: created_at\ny: count\ntitle: Trends');
		expect(result).toEqual({ type: 'line', x: 'created_at', y: 'count', title: 'Trends' });
	});

	it('parses scatter chart with x and y', () => {
		const result = parseChartConfig('type: scatter\nx: priority\ny: sort_order');
		expect(result).toEqual({ type: 'scatter', x: 'priority', y: 'sort_order' });
	});

	it('defaults y to count for bar chart when y is omitted', () => {
		const result = parseChartConfig('type: bar\nx: folder');
		expect(result).toEqual({ type: 'bar', x: 'folder', y: 'count' });
	});

	it('defaults y to count for line chart when y is omitted', () => {
		const result = parseChartConfig('type: line\nx: created_at');
		expect(result).toEqual({ type: 'line', x: 'created_at', y: 'count' });
	});
});

// ---------------------------------------------------------------------------
// Error Cases
// ---------------------------------------------------------------------------

describe('parseChartConfig — error cases', () => {
	it('returns error for empty string', () => {
		const result = parseChartConfig('');
		expect(result).toEqual({ error: 'Missing required key: type' });
	});

	it('returns error for unknown chart type', () => {
		const result = parseChartConfig('type: treemap');
		expect(result).toEqual({ error: 'Unknown chart type: treemap' });
	});

	it('returns error when bar chart missing x field', () => {
		const result = parseChartConfig('type: bar');
		expect(result).toEqual({ error: 'Bar chart requires x field' });
	});

	it('returns error when pie chart missing value field', () => {
		const result = parseChartConfig('type: pie');
		expect(result).toEqual({ error: 'Pie chart requires value field' });
	});

	it('returns error when scatter chart missing y field', () => {
		const result = parseChartConfig('type: scatter\nx: priority');
		expect(result).toEqual({ error: 'Scatter chart requires both x and y fields' });
	});

	it('returns error when scatter chart missing x field', () => {
		const result = parseChartConfig('type: scatter\ny: sort_order');
		expect(result).toEqual({ error: 'Scatter chart requires both x and y fields' });
	});

	it('returns error when scatter chart missing both fields', () => {
		const result = parseChartConfig('type: scatter');
		expect(result).toEqual({ error: 'Scatter chart requires both x and y fields' });
	});
});

// ---------------------------------------------------------------------------
// Comment and Whitespace Handling
// ---------------------------------------------------------------------------

describe('parseChartConfig — tolerant parsing', () => {
	it('ignores lines starting with #', () => {
		const result = parseChartConfig('# This is a comment\ntype: bar\nx: folder');
		expect(result).toEqual({ type: 'bar', x: 'folder', y: 'count' });
	});

	it('ignores lines without a colon', () => {
		const result = parseChartConfig('type: bar\nthis line has no colon\nx: folder');
		expect(result).toEqual({ type: 'bar', x: 'folder', y: 'count' });
	});

	it('trims whitespace around keys and values', () => {
		const result = parseChartConfig('  type  :  bar  \n  x  :  folder  ');
		expect(result).toEqual({ type: 'bar', x: 'folder', y: 'count' });
	});

	it('ignores empty lines', () => {
		const result = parseChartConfig('type: bar\n\n\nx: folder');
		expect(result).toEqual({ type: 'bar', x: 'folder', y: 'count' });
	});
});

// ---------------------------------------------------------------------------
// Type Coercion
// ---------------------------------------------------------------------------

describe('parseChartConfig — type coercion', () => {
	it('parses legend: true as boolean true', () => {
		const result = parseChartConfig('type: bar\nx: folder\nlegend: true');
		expect('error' in result).toBe(false);
		if (!('error' in result)) {
			expect(result.legend).toBe(true);
		}
	});

	it('parses legend: false as boolean false', () => {
		const result = parseChartConfig('type: bar\nx: folder\nlegend: false');
		expect('error' in result).toBe(false);
		if (!('error' in result)) {
			expect(result.legend).toBe(false);
		}
	});

	it('parses limit: 10 as number 10', () => {
		const result = parseChartConfig('type: bar\nx: folder\nlimit: 10');
		expect('error' in result).toBe(false);
		if (!('error' in result)) {
			expect(result.limit).toBe(10);
		}
	});
});
