// Isometry v5 -- Phase 66 Histogram Query Handler
// SQL binning query builder for histogram data.
//
// Follows the chart.handler.ts pattern:
//   - validateFilterField() for SQL safety (D-003)
//   - db.prepare() + all() + free() for parameterized query execution
//   - Numeric: CASE-based equal-width bins
//   - Date: strftime('%Y-%m') monthly bucketing

import type { Database } from '../../database/Database';
import { validateFilterField } from '../../providers/allowlist';
import type { WorkerPayloads, WorkerResponses } from '../protocol';

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handle histogram:query request.
 * Bins numeric or date column values into bucket counts for histogram rendering.
 *
 * Numeric strategy: Equal-width bins via CASE WHEN expressions.
 *   1. Query MIN/MAX of field
 *   2. Compute bin width = (max - min) / bins
 *   3. Assign each row to a bin index via CASE WHEN
 *   4. GROUP BY bin index, COUNT(*) per bin
 *
 * Date strategy: strftime('%Y-%m') monthly bucketing.
 *   1. SELECT strftime('%Y-%m', field) AS bucket, COUNT(*) GROUP BY bucket ORDER BY bucket ASC
 *
 * @throws {Error} "SQL safety violation:..." if field is not in the filter allowlist
 */
export function handleHistogramQuery(
	db: Database,
	payload: WorkerPayloads['histogram:query'],
): WorkerResponses['histogram:query'] {
	const { field, fieldType, bins } = payload;

	// Step 1: Validate field against filter allowlist (SQL injection defense)
	validateFilterField(field);

	// Step 2: Determine WHERE clause
	const baseWhere = payload.where || 'deleted_at IS NULL';

	// Step 3: Copy params to avoid mutation
	const params: unknown[] = [...payload.params];

	if (fieldType === 'date') {
		return handleDateHistogram(db, field, baseWhere, params);
	}

	return handleNumericHistogram(db, field, baseWhere, params, bins);
}

// ---------------------------------------------------------------------------
// Numeric Binning
// ---------------------------------------------------------------------------

function handleNumericHistogram(
	db: Database,
	field: string,
	baseWhere: string,
	params: unknown[],
	binCount: number,
): WorkerResponses['histogram:query'] {
	// Step 1: Query MIN and MAX
	const minMaxSql =
		`SELECT MIN(${field}) AS min_val, MAX(${field}) AS max_val FROM cards` +
		` WHERE ${baseWhere} AND ${field} IS NOT NULL`;

	const minMaxStmt = db.prepare<{ min_val: number | null; max_val: number | null }>(minMaxSql);
	const minMaxRows = params.length > 0 ? minMaxStmt.all(...params) : minMaxStmt.all();
	minMaxStmt.free();

	const firstRow = minMaxRows[0];
	if (!firstRow || firstRow.min_val === null || firstRow.max_val === null) {
		return { bins: [] };
	}

	const minVal = firstRow.min_val;
	const maxVal = firstRow.max_val;

	// Single distinct value: return one bin
	if (minVal === maxVal) {
		const countSql = `SELECT COUNT(*) AS count FROM cards WHERE ${baseWhere} AND ${field} IS NOT NULL`;

		const countStmt = db.prepare<{ count: number }>(countSql);
		const countRows = params.length > 0 ? countStmt.all(...params) : countStmt.all();
		countStmt.free();

		const firstCountRow = countRows[0];
		const count = firstCountRow ? firstCountRow.count : 0;
		if (count === 0) return { bins: [] };

		return {
			bins: [{ binStart: minVal, binEnd: maxVal, count }],
		};
	}

	// Step 2: Compute bin width
	const binWidth = (maxVal - minVal) / binCount;

	// Step 3: Build CASE expression for bin index assignment
	// Each row gets assigned a bin index: FLOOR((value - min) / width)
	// Clamp the last bin to include maxVal (which would otherwise be bin N)
	const binIndexExpr = `CASE WHEN ${field} >= ? THEN ? - 1 ELSE CAST((${field} - ?) / ? AS INTEGER) END`;

	const binSql =
		`SELECT ${binIndexExpr} AS bin_idx, COUNT(*) AS count FROM cards` +
		` WHERE ${baseWhere} AND ${field} IS NOT NULL` +
		` GROUP BY bin_idx ORDER BY bin_idx ASC`;

	// Params: original WHERE params + binIndex params (maxVal, binCount, minVal, binWidth)
	const binParams: unknown[] = [...params, maxVal, binCount, minVal, binWidth];

	const binStmt = db.prepare<{ bin_idx: number; count: number }>(binSql);
	const binRows = binParams.length > 0 ? binStmt.all(...binParams) : binStmt.all();
	binStmt.free();

	// Step 4: Map to response format
	const result: Array<{ binStart: number; binEnd: number; count: number }> = [];
	for (const row of binRows) {
		const idx = row.bin_idx;
		const binStart = minVal + idx * binWidth;
		const binEnd = idx === binCount - 1 ? maxVal : minVal + (idx + 1) * binWidth;
		result.push({ binStart, binEnd, count: row.count });
	}

	return { bins: result };
}

// ---------------------------------------------------------------------------
// Date Bucketing
// ---------------------------------------------------------------------------

function handleDateHistogram(
	db: Database,
	field: string,
	baseWhere: string,
	params: unknown[],
): WorkerResponses['histogram:query'] {
	const sql =
		`SELECT strftime('%Y-%m', ${field}) AS bucket, COUNT(*) AS count FROM cards` +
		` WHERE ${baseWhere} AND ${field} IS NOT NULL` +
		` GROUP BY bucket ORDER BY bucket ASC`;

	const stmt = db.prepare<{ bucket: string | null; count: number }>(sql);
	const rows = params.length > 0 ? stmt.all(...params) : stmt.all();
	stmt.free();

	const result: Array<{ binStart: string; binEnd: string; count: number }> = [];
	for (const row of rows) {
		if (row.bucket !== null) {
			result.push({ binStart: row.bucket, binEnd: row.bucket, count: row.count });
		}
	}

	return { bins: result };
}
