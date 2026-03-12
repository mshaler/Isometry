// Isometry v5 — Phase 16 SuperGrid Handler
// Handlers for supergrid:query and db:distinct-values Worker message types.
//
// supergrid:query: Executes buildSuperGridQuery() and returns cells with card_ids as string[].
// db:distinct-values: Returns sorted distinct values for a valid axis column.
//
// Both handlers validate axis fields via the allowlist (D-003 SQL safety).

import type { Database } from '../../database/Database';
import { validateAxisField } from '../../providers/allowlist';
import { buildSuperGridCalcQuery, buildSuperGridQuery } from '../../views/supergrid/SuperGridQuery';
import type { CellDatum, WorkerPayloads, WorkerResponses } from '../protocol';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum number of card_ids returned per cell in supergrid:query responses.
 * Truncation keeps postMessage payload under 100KB at 20K card scale (RNDR-05).
 * Full card_ids are available via supergrid:cell-detail for drill-down.
 */
const CARD_IDS_LIMIT = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert columnar result set (from db.exec) to row objects.
 * Zips column names with each row's values array.
 */
function _columnarToRows(results: { columns: string[]; values: unknown[][] }[]): Record<string, unknown>[] {
	if (results.length === 0 || !results[0]!.values || results[0]!.values.length === 0) {
		return [];
	}

	const { columns, values } = results[0]!;
	return values.map((row) => {
		const obj: Record<string, unknown> = {};
		for (let i = 0; i < columns.length; i++) {
			obj[columns[i]!] = row[i];
		}
		return obj;
	});
}

// ---------------------------------------------------------------------------
// supergrid:query
// ---------------------------------------------------------------------------

/**
 * Handle supergrid:query request.
 * Calls buildSuperGridQuery() to get parameterized SQL, executes it,
 * and transforms GROUP_CONCAT card_ids from comma-string to string[].
 *
 * @throws {Error} "SQL safety violation:..." if any axis field is invalid
 *   (thrown by buildSuperGridQuery → validateAxisField internally)
 */
export function handleSuperGridQuery(
	db: Database,
	payload: WorkerPayloads['supergrid:query'],
): WorkerResponses['supergrid:query'] {
	// buildSuperGridQuery validates axes internally via validateAxisField (DRY)
	const { sql, params } = buildSuperGridQuery(payload);

	// Execute the compiled query using prepare+all pattern (same as handleDbQuery).
	// db.exec() in the Vite-prebundled sql.js browser build returns results with
	// missing `values` property, causing columnarToRows to crash. The prepare().all()
	// loop uses step()+getAsObject() which reliably returns row objects in all environments.
	const stmt = db.prepare<Record<string, unknown>>(sql);
	const rows = params.length > 0 ? stmt.all(...params) : stmt.all();
	stmt.free();

	// Transform rows to CellDatum[] — split card_ids/card_names and cast count
	const cells: CellDatum[] = rows.map((row) => {
		const cardIdsRaw = row['card_ids'];
		const card_ids_full: string[] = typeof cardIdsRaw === 'string' ? cardIdsRaw.split(',').filter(Boolean) : [];

		// Phase 76 RNDR-05: Truncate card_ids to CARD_IDS_LIMIT per cell.
		// card_ids_total reflects the true count before truncation for "50 of N" display.
		const card_ids = card_ids_full.slice(0, CARD_IDS_LIMIT);
		const card_ids_total = card_ids_full.length;

		const cardNamesRaw = row['card_names'];
		// Also truncate card_names to match card_ids truncation (parallel arrays must align)
		const card_names_full: string[] =
			typeof cardNamesRaw === 'string' ? cardNamesRaw.split(',').filter(Boolean) : [];
		const card_names = card_names_full.slice(0, CARD_IDS_LIMIT);

		const count = typeof row['count'] === 'number' ? row['count'] : 0;

		// Build CellDatum with all axis columns + count + card_ids + card_names + card_ids_total
		const cell: CellDatum = { ...row, count, card_ids, card_names, card_ids_total };
		return cell;
	});

	// Phase 25 SRCH-04 — compute matchedCardIds per cell when search is active
	const trimmedSearch = payload.searchTerm?.trim() ?? '';
	if (trimmedSearch) {
		// Secondary FTS5 query: get all card IDs that match the search term
		const ftsResults = db.exec(
			'SELECT c.id FROM cards_fts JOIN cards c ON c.rowid = cards_fts.rowid WHERE cards_fts MATCH ? AND c.deleted_at IS NULL',
			[trimmedSearch],
		);
		const matchedSet = new Set<string>();
		if (ftsResults.length > 0 && ftsResults[0]!.values) {
			for (const row of ftsResults[0]!.values) {
				if (typeof row[0] === 'string') matchedSet.add(row[0]);
			}
		}

		// Annotate each cell with which of its card_ids matched FTS
		for (const cell of cells) {
			cell['matchedCardIds'] = cell.card_ids.filter((id) => matchedSet.has(id));
		}

		return { cells, searchTerms: [trimmedSearch] };
	}

	return { cells };
}

// ---------------------------------------------------------------------------
// supergrid:cell-detail (Phase 76 RNDR-05 — lazy-fetch full card_ids for a cell)
// ---------------------------------------------------------------------------

/**
 * Handle supergrid:cell-detail request.
 * Returns the full (untruncated) card_ids for a single cell identified by axis values.
 * Used for drill-down when a cell's card_ids were truncated in the supergrid:query response.
 *
 * @param db - Database instance
 * @param payload - Axis field/value pairs + optional filter WHERE clause
 * @returns { card_ids: string[], total: number } — full card_ids for the specified cell
 * @throws {Error} "SQL safety violation:..." if any axis field name is invalid
 */
export function handleSuperGridCellDetail(
	db: Database,
	payload: WorkerPayloads['supergrid:cell-detail'],
): WorkerResponses['supergrid:cell-detail'] {
	const { axisValues, where, params } = payload;

	// Validate all axis field names before interpolating into SQL (D-003 SQL safety)
	for (const field of Object.keys(axisValues)) {
		validateAxisField(field);
	}

	// Build WHERE conditions for axis equality
	// Column names are interpolated (validated above); values are bound parameters
	const axisConditions: string[] = ['deleted_at IS NULL'];
	const bindParams: unknown[] = [...params];

	for (const [field, value] of Object.entries(axisValues)) {
		// NULL axis values require IS NULL, string values use = ?
		if (value === null || value === undefined) {
			axisConditions.push(`${field} IS NULL`);
		} else {
			axisConditions.push(`${field} = ?`);
			bindParams.push(value);
		}
	}

	// Append optional filter WHERE fragment (from FilterProvider.compile())
	if (where) {
		axisConditions.push(where);
	}

	const sql = `SELECT id FROM cards WHERE ${axisConditions.join(' AND ')}`;

	const stmt = db.prepare<Record<string, unknown>>(sql);
	const rows = bindParams.length > 0 ? stmt.all(...bindParams) : stmt.all();
	stmt.free();

	const card_ids: string[] = rows.map((row) => row['id']).filter((id): id is string => typeof id === 'string');

	return { card_ids, total: card_ids.length };
}

// ---------------------------------------------------------------------------
// supergrid:calc (Phase 62 — aggregate footer rows)
// ---------------------------------------------------------------------------

/**
 * Handle supergrid:calc request.
 * Calls buildSuperGridCalcQuery() to get parameterized SQL, executes it,
 * and transforms rows into { groupKey, values } shape for footer rendering.
 *
 * @throws {Error} "SQL safety violation:..." if any field is invalid
 */
export function handleSuperGridCalc(
	db: Database,
	payload: WorkerPayloads['supergrid:calc'],
): WorkerResponses['supergrid:calc'] {
	const { sql, params } = buildSuperGridCalcQuery(payload);
	const stmt = db.prepare<Record<string, unknown>>(sql);
	const rows = params.length > 0 ? stmt.all(...params) : stmt.all();
	stmt.free();

	// Transform rows: separate group-key fields (row + col axes) from aggregate value fields.
	// Aggregate columns use __agg__ prefix to avoid collision with axis columns of the
	// same name (e.g. priority as GROUP BY axis AND SUM(priority) aggregate).
	const AGG_PREFIX = '__agg__';
	const result = rows.map((row) => {
		const groupKey: Record<string, unknown> = {};
		const values: Record<string, number | null> = {};
		for (const [key, val] of Object.entries(row)) {
			if (key.startsWith(AGG_PREFIX)) {
				// Strip prefix → original field name
				const field = key.slice(AGG_PREFIX.length);
				values[field] = typeof val === 'number' ? val : null;
			} else {
				groupKey[key] = val;
			}
		}
		return { groupKey, values };
	});

	return { rows: result };
}

// ---------------------------------------------------------------------------
// db:distinct-values
// ---------------------------------------------------------------------------

/**
 * Handle db:distinct-values request.
 * Returns sorted distinct string values for a valid axis column,
 * scoped to the optional WHERE filter.
 *
 * @throws {Error} "SQL safety violation:..." if column is not in the axis allowlist
 */
export function handleDistinctValues(
	db: Database,
	payload: WorkerPayloads['db:distinct-values'],
): WorkerResponses['db:distinct-values'] {
	// Validate column against allowlist FIRST (SQL injection defense — column interpolated)
	validateAxisField(payload.column);

	// Build query with optional WHERE filter
	const whereClause = payload.where ? ` AND ${payload.where}` : '';

	const sql = `SELECT DISTINCT ${payload.column} FROM cards WHERE deleted_at IS NULL${whereClause} ORDER BY ${payload.column} ASC`;
	const params = payload.params ?? [];

	// Execute and extract flat string array
	const results = db.exec(sql, params as import('sql.js').BindParams);

	if (results.length === 0 || results[0]!.values.length === 0) {
		return { values: [] };
	}

	// Extract first column values, filtering nulls
	const values: string[] = results[0]!.values.map((row) => row[0]).filter((v): v is string => typeof v === 'string');

	return { values };
}
