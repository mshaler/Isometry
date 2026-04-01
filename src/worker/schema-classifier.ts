// Isometry v5 — Phase 70 Plan 01
// Pure column classification function for Worker-side PRAGMA introspection.
//
// Design:
//   - Pure function — no side effects, no imports from Worker runtime.
//   - Called after db.initialize() to derive schema metadata from PRAGMA table_info().
//   - Excluded columns: id (PK), deleted_at (internal), rowid/_rowid_/oid (system),
//     underscore-prefixed (internal convention).
//   - Invalid column names (chars outside [a-zA-Z0-9_]) skipped with console.warn.
//   - LATCH classification uses hardcoded heuristics per locked design decisions.

import type { ColumnInfo, LatchFamily } from './protocol';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Columns always excluded from schema metadata, regardless of table. */
const EXCLUDED_COLUMNS = new Set(['id', 'deleted_at', 'rowid', '_rowid_', 'oid']);

/** Safe column name pattern — only alphanumeric and underscore. */
const COLUMN_NAME_RE = /^[a-zA-Z0-9_]+$/;

// ---------------------------------------------------------------------------
// Exported Pure Function
// ---------------------------------------------------------------------------

/**
 * Classify columns from a PRAGMA table_info() result into ColumnInfo objects.
 *
 * @param pragmaResult - sql.js exec() result from `PRAGMA table_info(tableName)`.
 *   Format: `[{ columns: string[], values: unknown[][] }]` (single result set).
 *   An empty array is valid (returned when the table doesn't exist yet).
 *
 * @returns Array of ColumnInfo objects, one per exposed column. Excludes:
 *   - Primary key (id)
 *   - Soft-delete marker (deleted_at)
 *   - SQLite system rowid aliases (rowid, _rowid_, oid)
 *   - Underscore-prefixed columns (internal convention)
 *   - Columns with invalid characters (logged as console.warn)
 */
export function classifyColumns(pragmaResult: { columns: string[]; values: unknown[][] }[]): ColumnInfo[] {
	if (pragmaResult.length === 0) return [];

	const resultSet = pragmaResult[0]!;
	const { columns, values } = resultSet;

	// Resolve column positions by name (defensive — PRAGMA column order is stable
	// but we use indexOf to be safe against future SQLite changes).
	const nameIdx = columns.indexOf('name');
	const typeIdx = columns.indexOf('type');
	const notnullIdx = columns.indexOf('notnull');

	const result: ColumnInfo[] = [];

	for (const row of values) {
		const colName = String(row[nameIdx] ?? '');
		const colType = String(row[typeIdx] ?? '');
		const notnull = Number(row[notnullIdx] ?? 0) !== 0;

		// Skip excluded columns (PK, soft-delete, system)
		if (EXCLUDED_COLUMNS.has(colName)) continue;

		// Skip underscore-prefixed columns (internal convention)
		if (colName.startsWith('_')) continue;

		// Skip columns with invalid characters — potential SQL injection surface
		if (!COLUMN_NAME_RE.test(colName)) {
			console.warn(`[schema-classifier] Skipping column with invalid name: "${colName}"`);
			continue;
		}

		result.push({
			name: colName,
			type: colType,
			notnull,
			latchFamily: classifyLatch(colName, colType),
			isNumeric: isNumericType(colType),
		});
	}

	return result;
}

// ---------------------------------------------------------------------------
// Private Helpers
// ---------------------------------------------------------------------------

/**
 * Classify a column name into a LATCH information architecture family.
 * Heuristics are hardcoded per locked design decisions (D-001..D-011).
 *
 * Priority order:
 *   1. _at suffix -> Time (temporal columns)
 *   2. name -> Alphabet (primary text label)
 *   3. Categorical columns -> Category
 *   4. Ordinal columns -> Hierarchy
 *   5. Geospatial columns -> Location
 *   6. Default -> Alphabet (most permissive fallback)
 */
function classifyLatch(name: string, _type: string): LatchFamily {
	if (name.endsWith('_at')) return 'Time';
	if (name === 'name') return 'Alphabet';
	if (name === 'folder' || name.startsWith('folder_l') || name === 'status' || name === 'card_type' || name === 'source')
		return 'Category';
	if (name === 'priority' || name === 'sort_order' || name === 'weight') return 'Hierarchy';
	if (name === 'latitude' || name === 'longitude' || name === 'location_name') return 'Location';
	return 'Alphabet';
}

/**
 * Returns true if the SQLite type affinity is numeric (INTEGER or REAL).
 * Case-insensitive comparison for robustness.
 */
function isNumericType(type: string): boolean {
	const upper = type.toUpperCase();
	return upper === 'INTEGER' || upper === 'REAL';
}
