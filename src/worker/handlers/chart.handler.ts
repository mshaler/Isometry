// Isometry v5 -- Phase 65 Chart Query Handler
// SQL GROUP BY query builder for chart data aggregation.
//
// Follows the supergrid.handler.ts pattern:
//   - validateAxisField() for SQL safety (D-003)
//   - db.prepare() + all() for parameterized query execution
//   - Discriminated union response (labeled vs xy)

import type { Database } from '../../database/Database';
import { validateAxisField } from '../../providers/allowlist';
import type { WorkerPayloads, WorkerResponses } from '../protocol';

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handle chart:query request.
 * Builds SQL aggregation queries based on chart type and executes them.
 *
 * Query patterns:
 *   - bar/pie (yField=null): SELECT xField AS label, COUNT(*) AS value ... GROUP BY xField
 *   - bar (yField set): SELECT xField AS label, SUM(yField) AS value ... GROUP BY xField
 *   - line: SELECT xField AS label, COUNT(*) AS value ... GROUP BY xField ORDER BY xField ASC
 *   - scatter: SELECT xField AS x, yField AS y FROM cards WHERE ...
 *
 * @throws {Error} "SQL safety violation:..." if xField or yField is not in the axis allowlist
 */
export function handleChartQuery(
	db: Database,
	payload: WorkerPayloads['chart:query'],
): WorkerResponses['chart:query'] {
	const { chartType, xField, yField, limit } = payload;

	// Step 1: Validate fields against axis allowlist (SQL injection defense)
	validateAxisField(xField);
	if (yField !== null) {
		validateAxisField(yField);
	}

	// Step 2: Determine WHERE clause
	const baseWhere = payload.where || 'deleted_at IS NULL';

	// Step 3: Build params array (copy to avoid mutating input)
	const params: unknown[] = [...payload.params];

	// Step 4: Build SQL per chart type
	let sql: string;

	if (chartType === 'scatter') {
		// Scatter: raw x/y pairs, no aggregation
		sql =
			`SELECT ${xField} AS x, ${yField} AS y FROM cards` +
			` WHERE ${baseWhere} AND ${xField} IS NOT NULL AND ${yField} IS NOT NULL`;
	} else if (chartType === 'line') {
		// Line: always COUNT by x, ordered by x ASC for trends
		sql =
			`SELECT ${xField} AS label, COUNT(*) AS value FROM cards` +
			` WHERE ${baseWhere} AND ${xField} IS NOT NULL` +
			` GROUP BY ${xField} ORDER BY ${xField} ASC`;
	} else if (yField !== null) {
		// Bar with numeric y: SUM aggregation, ordered by x ASC
		sql =
			`SELECT ${xField} AS label, SUM(${yField}) AS value FROM cards` +
			` WHERE ${baseWhere} AND ${xField} IS NOT NULL` +
			` GROUP BY ${xField} ORDER BY ${xField} ASC`;
	} else {
		// Bar (count) or Pie: COUNT aggregation, ordered by value DESC
		sql =
			`SELECT ${xField} AS label, COUNT(*) AS value FROM cards` +
			` WHERE ${baseWhere} AND ${xField} IS NOT NULL` +
			` GROUP BY ${xField} ORDER BY value DESC`;
	}

	// Step 5: Append LIMIT if specified
	if (limit !== undefined) {
		sql += ' LIMIT ?';
		params.push(limit);
	}

	// Step 6: Execute query
	const stmt = db.prepare<Record<string, unknown>>(sql);
	const rows = params.length > 0 ? stmt.all(...params) : stmt.all();
	stmt.free();

	// Step 7: Return discriminated union response
	if (chartType === 'scatter') {
		return {
			type: 'xy',
			rows: rows as Array<{ x: number; y: number }>,
		};
	}

	return {
		type: 'labeled',
		rows: rows as Array<{ label: string; value: number }>,
	};
}
