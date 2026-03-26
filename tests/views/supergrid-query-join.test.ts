// Isometry v9.0 — Phase 116 Plan 01
// TDD tests for SuperGridQuery LEFT JOIN graph_metrics.
//
// Tests cover:
//   - buildSuperGridQuery with no metricsColumns: SQL has no JOIN (backward compat)
//   - buildSuperGridQuery with metricsColumns=['community_id']: SQL contains LEFT JOIN
//   - buildSuperGridQuery with metric + regular axis: both appear correctly
//   - buildSuperGridQuery with invalid metric column: filtered silently
//   - buildSuperGridCalcQuery with metricsColumns: SQL contains LEFT JOIN
//   - SchemaProvider wired via setSchemaProvider for metric column validation

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setSchemaProvider } from '../../src/providers/allowlist';
import { SchemaProvider } from '../../src/providers/SchemaProvider';
import type { AxisMapping } from '../../src/providers/types';
import { buildSuperGridCalcQuery, buildSuperGridQuery } from '../../src/views/supergrid/SuperGridQuery';
import type { ColumnInfo } from '../../src/worker/protocol';

// ---------------------------------------------------------------------------
// Test fixtures — SchemaProvider with graph metrics enabled
// ---------------------------------------------------------------------------

const CARD_COLUMNS: ColumnInfo[] = [
	{ name: 'name', type: 'TEXT', notnull: true, latchFamily: 'Alphabet', isNumeric: false },
	{ name: 'card_type', type: 'TEXT', notnull: true, latchFamily: 'Category', isNumeric: false },
	{ name: 'folder', type: 'TEXT', notnull: false, latchFamily: 'Category', isNumeric: false },
	{ name: 'priority', type: 'INTEGER', notnull: true, latchFamily: 'Hierarchy', isNumeric: true },
	{ name: 'created_at', type: 'TEXT', notnull: true, latchFamily: 'Time', isNumeric: false },
];

const CONN_COLUMNS: ColumnInfo[] = [
	{ name: 'source_id', type: 'TEXT', notnull: true, latchFamily: 'Alphabet', isNumeric: false },
];

let sp: SchemaProvider;

beforeEach(() => {
	sp = new SchemaProvider();
	sp.initialize({ cards: CARD_COLUMNS, connections: CONN_COLUMNS });
	sp.addGraphMetricColumns();
	setSchemaProvider(sp);
});

afterEach(() => {
	setSchemaProvider(null);
});

// ---------------------------------------------------------------------------
// buildSuperGridQuery — no metricsColumns (backward compat)
// ---------------------------------------------------------------------------

describe('buildSuperGridQuery — no metricsColumns', () => {
	it('SQL has no JOIN when metricsColumns is undefined', () => {
		const result = buildSuperGridQuery({
			colAxes: [{ field: 'card_type' as any, direction: 'asc' }],
			rowAxes: [],
			where: '',
			params: [],
		});
		expect(result.sql).not.toContain('JOIN');
		expect(result.sql).toContain('FROM cards');
	});

	it('SQL has no JOIN when metricsColumns is empty', () => {
		const result = buildSuperGridQuery({
			colAxes: [{ field: 'card_type' as any, direction: 'asc' }],
			rowAxes: [],
			where: '',
			params: [],
			metricsColumns: [],
		});
		expect(result.sql).not.toContain('JOIN');
	});
});

// ---------------------------------------------------------------------------
// buildSuperGridQuery — with metricsColumns
// ---------------------------------------------------------------------------

describe('buildSuperGridQuery — with metricsColumns', () => {
	it('SQL contains LEFT JOIN graph_metrics when community_id is a metric column', () => {
		const result = buildSuperGridQuery({
			colAxes: [{ field: 'community_id' as any, direction: 'asc' }],
			rowAxes: [],
			where: '',
			params: [],
			metricsColumns: ['community_id'],
		});
		expect(result.sql).toContain('LEFT JOIN graph_metrics ON cards.id = graph_metrics.card_id');
	});

	it('metric column appears with graph_metrics prefix in SELECT', () => {
		const result = buildSuperGridQuery({
			colAxes: [{ field: 'community_id' as any, direction: 'asc' }],
			rowAxes: [],
			where: '',
			params: [],
			metricsColumns: ['community_id'],
		});
		expect(result.sql).toContain('graph_metrics.community_id');
	});

	it('metric column appears with graph_metrics prefix in GROUP BY', () => {
		const result = buildSuperGridQuery({
			colAxes: [{ field: 'community_id' as any, direction: 'asc' }],
			rowAxes: [],
			where: '',
			params: [],
			metricsColumns: ['community_id'],
		});
		expect(result.sql).toContain('GROUP BY graph_metrics.community_id');
	});

	it('mixed metric + regular axes both appear correctly', () => {
		const result = buildSuperGridQuery({
			colAxes: [{ field: 'community_id' as any, direction: 'asc' }],
			rowAxes: [{ field: 'card_type' as any, direction: 'asc' }],
			where: '',
			params: [],
			metricsColumns: ['community_id'],
		});
		expect(result.sql).toContain('LEFT JOIN graph_metrics');
		expect(result.sql).toContain('graph_metrics.community_id');
		expect(result.sql).toContain('card_type');
		// card_type should NOT have graph_metrics prefix
		expect(result.sql).not.toContain('graph_metrics.card_type');
	});

	it('invalid metric column name is filtered out silently', () => {
		const result = buildSuperGridQuery({
			colAxes: [{ field: 'card_type' as any, direction: 'asc' }],
			rowAxes: [],
			where: '',
			params: [],
			metricsColumns: ['bogus_column'],
		});
		expect(result.sql).not.toContain('JOIN');
	});

	it('card_ids and card_names use cards.id and cards.name when JOIN active', () => {
		const result = buildSuperGridQuery({
			colAxes: [{ field: 'community_id' as any, direction: 'asc' }],
			rowAxes: [],
			where: '',
			params: [],
			metricsColumns: ['community_id'],
		});
		expect(result.sql).toContain('GROUP_CONCAT(cards.id)');
		expect(result.sql).toContain('GROUP_CONCAT(cards.name)');
	});

	it('ORDER BY includes metric column with graph_metrics prefix', () => {
		const result = buildSuperGridQuery({
			colAxes: [{ field: 'community_id' as any, direction: 'asc' }],
			rowAxes: [],
			where: '',
			params: [],
			metricsColumns: ['community_id'],
		});
		expect(result.sql).toContain('ORDER BY graph_metrics.community_id ASC');
	});
});

// ---------------------------------------------------------------------------
// buildSuperGridCalcQuery — with metricsColumns
// ---------------------------------------------------------------------------

describe('buildSuperGridCalcQuery — with metricsColumns', () => {
	it('SQL contains LEFT JOIN when metric column is a row axis', () => {
		const result = buildSuperGridCalcQuery({
			rowAxes: [{ field: 'community_id' as any, direction: 'asc' }],
			where: '',
			params: [],
			aggregates: { priority: 'sum' },
			metricsColumns: ['community_id'],
		});
		expect(result.sql).toContain('LEFT JOIN graph_metrics ON cards.id = graph_metrics.card_id');
	});

	it('no JOIN when metricsColumns empty', () => {
		const result = buildSuperGridCalcQuery({
			rowAxes: [{ field: 'card_type' as any, direction: 'asc' }],
			where: '',
			params: [],
			aggregates: { priority: 'sum' },
			metricsColumns: [],
		});
		expect(result.sql).not.toContain('JOIN');
	});
});
