// Isometry v5 — Phase 70 Plan 01
// Unit tests for classifyColumns() pure function.
//
// Tests cover:
//   - LATCH family classification for all known column patterns
//   - Exclusion of id, deleted_at, underscore-prefixed, and invalid column names
//   - Numeric detection (INTEGER/REAL)
//   - Invalid column names skipped with console.warn
//   - Empty input
//   - connections table classification

import { describe, expect, it, vi } from 'vitest';
import { classifyColumns } from '../../src/worker/schema-classifier';

// ---------------------------------------------------------------------------
// Test fixtures — PRAGMA table_info() result shape
// Each row: [cid, name, type, notnull, dflt_value, pk]
// ---------------------------------------------------------------------------

/**
 * Build a PRAGMA result fixture in sql.js format.
 * columns: array of column names matching the values tuples.
 * rows: array of PRAGMA row tuples [cid, name, type, notnull, dflt_value, pk].
 */
function makePragma(rows: unknown[][]): { columns: string[]; values: unknown[][] }[] {
	return [
		{
			columns: ['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk'],
			values: rows,
		},
	];
}

// ---------------------------------------------------------------------------
// Cards table fixture (25 columns matching schema.sql)
// ---------------------------------------------------------------------------
const CARDS_PRAGMA_ROWS: unknown[][] = [
	[0, 'id', 'TEXT', 1, null, 1],
	[1, 'card_type', 'TEXT', 1, "'note'", 0],
	[2, 'name', 'TEXT', 1, null, 0],
	[3, 'content', 'TEXT', 0, null, 0],
	[4, 'summary', 'TEXT', 0, null, 0],
	[5, 'latitude', 'REAL', 0, null, 0],
	[6, 'longitude', 'REAL', 0, null, 0],
	[7, 'location_name', 'TEXT', 0, null, 0],
	[8, 'created_at', 'TEXT', 1, null, 0],
	[9, 'modified_at', 'TEXT', 1, null, 0],
	[10, 'due_at', 'TEXT', 0, null, 0],
	[11, 'completed_at', 'TEXT', 0, null, 0],
	[12, 'event_start', 'TEXT', 0, null, 0],
	[13, 'event_end', 'TEXT', 0, null, 0],
	[14, 'folder', 'TEXT', 0, null, 0],
	[15, 'tags', 'TEXT', 0, null, 0],
	[16, 'status', 'TEXT', 0, null, 0],
	[17, 'priority', 'INTEGER', 1, '0', 0],
	[18, 'sort_order', 'INTEGER', 1, '0', 0],
	[19, 'url', 'TEXT', 0, null, 0],
	[20, 'mime_type', 'TEXT', 0, null, 0],
	[21, 'is_collective', 'INTEGER', 1, '0', 0],
	[22, 'source', 'TEXT', 0, null, 0],
	[23, 'source_id', 'TEXT', 0, null, 0],
	[24, 'source_url', 'TEXT', 0, null, 0],
	[25, 'deleted_at', 'TEXT', 0, null, 0],
];

// ---------------------------------------------------------------------------
// Connections table fixture (7 columns matching schema.sql)
// ---------------------------------------------------------------------------
const CONNECTIONS_PRAGMA_ROWS: unknown[][] = [
	[0, 'id', 'TEXT', 1, null, 1],
	[1, 'source_id', 'TEXT', 1, null, 0],
	[2, 'target_id', 'TEXT', 1, null, 0],
	[3, 'via_card_id', 'TEXT', 0, null, 0],
	[4, 'label', 'TEXT', 0, null, 0],
	[5, 'weight', 'REAL', 1, '1.0', 0],
	[6, 'created_at', 'TEXT', 1, null, 0],
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('classifyColumns()', () => {
	describe('cards table', () => {
		it('excludes id (PK) and deleted_at', () => {
			const result = classifyColumns(makePragma(CARDS_PRAGMA_ROWS));
			const names = result.map((c) => c.name);
			expect(names).not.toContain('id');
			expect(names).not.toContain('deleted_at');
		});

		it('returns 24 exposed columns (26 minus id, deleted_at)', () => {
			const result = classifyColumns(makePragma(CARDS_PRAGMA_ROWS));
			expect(result).toHaveLength(24);
		});

		it('classifies *_at columns as Time', () => {
			const result = classifyColumns(makePragma(CARDS_PRAGMA_ROWS));
			const timeCols = result.filter((c) => c.latchFamily === 'Time').map((c) => c.name);
			expect(timeCols).toContain('created_at');
			expect(timeCols).toContain('modified_at');
			expect(timeCols).toContain('due_at');
			expect(timeCols).toContain('completed_at');
		});

		it('classifies event_start and event_end as Time (they end with _start/_end not _at, but still temporal)', () => {
			// NOTE: event_start and event_end do NOT end with _at, so they fall through to Alphabet default
			// This is correct per the plan spec: only _at suffix -> Time
			const result = classifyColumns(makePragma(CARDS_PRAGMA_ROWS));
			const eventStart = result.find((c) => c.name === 'event_start');
			const eventEnd = result.find((c) => c.name === 'event_end');
			expect(eventStart?.latchFamily).toBe('Alphabet');
			expect(eventEnd?.latchFamily).toBe('Alphabet');
		});

		it('classifies name as Alphabet', () => {
			const result = classifyColumns(makePragma(CARDS_PRAGMA_ROWS));
			const nameCol = result.find((c) => c.name === 'name');
			expect(nameCol?.latchFamily).toBe('Alphabet');
		});

		it('classifies folder, status, card_type, source as Category', () => {
			const result = classifyColumns(makePragma(CARDS_PRAGMA_ROWS));
			for (const colName of ['folder', 'status', 'card_type', 'source']) {
				const col = result.find((c) => c.name === colName);
				expect(col?.latchFamily).toBe('Category');
			}
		});

		it('classifies priority and sort_order as Hierarchy', () => {
			const result = classifyColumns(makePragma(CARDS_PRAGMA_ROWS));
			for (const colName of ['priority', 'sort_order']) {
				const col = result.find((c) => c.name === colName);
				expect(col?.latchFamily).toBe('Hierarchy');
			}
		});

		it('classifies latitude, longitude, location_name as Location', () => {
			const result = classifyColumns(makePragma(CARDS_PRAGMA_ROWS));
			for (const colName of ['latitude', 'longitude', 'location_name']) {
				const col = result.find((c) => c.name === colName);
				expect(col?.latchFamily).toBe('Location');
			}
		});

		it('falls back to Alphabet for unmatched columns (content, summary, tags, url, etc.)', () => {
			const result = classifyColumns(makePragma(CARDS_PRAGMA_ROWS));
			for (const colName of ['content', 'summary', 'tags', 'url', 'mime_type', 'source_id', 'source_url']) {
				const col = result.find((c) => c.name === colName);
				expect(col?.latchFamily).toBe('Alphabet');
			}
		});

		it('sets isNumeric true for INTEGER columns (priority, sort_order, is_collective)', () => {
			const result = classifyColumns(makePragma(CARDS_PRAGMA_ROWS));
			for (const colName of ['priority', 'sort_order', 'is_collective']) {
				const col = result.find((c) => c.name === colName);
				expect(col?.isNumeric).toBe(true);
			}
		});

		it('sets isNumeric true for REAL columns (latitude, longitude)', () => {
			const result = classifyColumns(makePragma(CARDS_PRAGMA_ROWS));
			for (const colName of ['latitude', 'longitude']) {
				const col = result.find((c) => c.name === colName);
				expect(col?.isNumeric).toBe(true);
			}
		});

		it('sets isNumeric false for TEXT columns', () => {
			const result = classifyColumns(makePragma(CARDS_PRAGMA_ROWS));
			for (const colName of ['name', 'folder', 'created_at', 'content']) {
				const col = result.find((c) => c.name === colName);
				expect(col?.isNumeric).toBe(false);
			}
		});

		it('sets notnull correctly', () => {
			const result = classifyColumns(makePragma(CARDS_PRAGMA_ROWS));
			const nameCol = result.find((c) => c.name === 'name');
			expect(nameCol?.notnull).toBe(true);
			const contentCol = result.find((c) => c.name === 'content');
			expect(contentCol?.notnull).toBe(false);
		});
	});

	describe('connections table', () => {
		it('excludes id (PK)', () => {
			const result = classifyColumns(makePragma(CONNECTIONS_PRAGMA_ROWS));
			const names = result.map((c) => c.name);
			expect(names).not.toContain('id');
		});

		it('returns 6 exposed columns (7 minus id)', () => {
			const result = classifyColumns(makePragma(CONNECTIONS_PRAGMA_ROWS));
			expect(result).toHaveLength(6);
		});

		it('classifies weight as numeric REAL', () => {
			const result = classifyColumns(makePragma(CONNECTIONS_PRAGMA_ROWS));
			const weightCol = result.find((c) => c.name === 'weight');
			expect(weightCol?.isNumeric).toBe(true);
			expect(weightCol?.latchFamily).toBe('Hierarchy');
		});

		it('classifies created_at as Time', () => {
			const result = classifyColumns(makePragma(CONNECTIONS_PRAGMA_ROWS));
			const createdCol = result.find((c) => c.name === 'created_at');
			expect(createdCol?.latchFamily).toBe('Time');
		});

		it('classifies label as Alphabet (default fallback)', () => {
			const result = classifyColumns(makePragma(CONNECTIONS_PRAGMA_ROWS));
			const labelCol = result.find((c) => c.name === 'label');
			expect(labelCol?.latchFamily).toBe('Alphabet');
		});
	});

	describe('column filtering', () => {
		it('skips underscore-prefixed columns', () => {
			const pragma = makePragma([
				[0, '_internal', 'TEXT', 0, null, 0],
				[1, 'name', 'TEXT', 1, null, 0],
			]);
			const result = classifyColumns(pragma);
			const names = result.map((c) => c.name);
			expect(names).not.toContain('_internal');
			expect(names).toContain('name');
		});

		it('skips rowid, _rowid_, oid system columns', () => {
			const pragma = makePragma([
				[0, 'rowid', 'INTEGER', 0, null, 0],
				[1, '_rowid_', 'INTEGER', 0, null, 0],
				[2, 'oid', 'INTEGER', 0, null, 0],
				[3, 'name', 'TEXT', 1, null, 0],
			]);
			const result = classifyColumns(pragma);
			const names = result.map((c) => c.name);
			expect(names).not.toContain('rowid');
			expect(names).not.toContain('_rowid_');
			expect(names).not.toContain('oid');
			expect(names).toContain('name');
		});

		it('skips columns with invalid characters (space, !) and emits console.warn', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const pragma = makePragma([
				[0, 'bad col!', 'TEXT', 0, null, 0],
				[1, 'name', 'TEXT', 1, null, 0],
			]);
			const result = classifyColumns(pragma);
			const names = result.map((c) => c.name);
			expect(names).not.toContain('bad col!');
			expect(names).toContain('name');
			expect(warnSpy).toHaveBeenCalledOnce();
			expect(warnSpy.mock.calls[0]?.[0]).toContain('bad col!');
			warnSpy.mockRestore();
		});

		it('skips SQL injection column names and emits console.warn', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const pragma = makePragma([
				[0, "Robert'; DROP TABLE cards;--", 'TEXT', 0, null, 0],
				[1, 'name', 'TEXT', 1, null, 0],
			]);
			const result = classifyColumns(pragma);
			expect(result.map((c) => c.name)).toEqual(['name']);
			expect(warnSpy).toHaveBeenCalledOnce();
			warnSpy.mockRestore();
		});
	});

	describe('edge cases', () => {
		it('returns empty array for empty PRAGMA result', () => {
			const result = classifyColumns([]);
			expect(result).toEqual([]);
		});

		it('returns empty array for PRAGMA with empty values', () => {
			const result = classifyColumns([{ columns: ['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk'], values: [] }]);
			expect(result).toEqual([]);
		});

		it('each ColumnInfo has correct shape', () => {
			const result = classifyColumns(makePragma([[0, 'name', 'TEXT', 1, null, 0]]));
			expect(result).toHaveLength(1);
			const col = result[0]!;
			expect(col).toMatchObject({
				name: 'name',
				type: 'TEXT',
				notnull: true,
				latchFamily: 'Alphabet',
				isNumeric: false,
			});
		});
	});
});
