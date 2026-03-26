// Isometry v5 — Phase 7 SuperGridQuery
// Multi-axis GROUP BY query builder for SuperGrid.
//
// Design:
//   - Builds a parameterized SQL query that groups cards by both column and row axes
//   - All field names validated against ALLOWED_AXIS_FIELDS (D-003 SQL safety)
//   - Values are always parameterized (no dynamic SQL construction from user input)
//   - SuperGridQuery is a standalone utility — NOT imported by SuperGrid.ts in this plan
//   - SuperGrid.ts uses in-memory card filtering (cards come from coordinator)
//   - SuperGridQuery will be wired in a future plan when SuperGrid queries the Worker directly
//
// Requirements: REND-02

import { validateAxisField } from '../../providers/allowlist';
import type { AggregationMode, AxisField, AxisMapping, TimeGranularity } from '../../providers/types';

// ---------------------------------------------------------------------------
// Phase 116 — Graph metrics column allowlist
// ---------------------------------------------------------------------------

/**
 * Frozen set of allowed graph_metrics column names.
 * Used to validate metricsColumns parameter and determine table-prefixing.
 */
const ALLOWED_METRIC_COLUMNS: ReadonlySet<string> = Object.freeze(
	new Set(['community_id', 'pagerank', 'centrality', 'clustering_coeff', 'sp_depth', 'in_spanning_tree']),
);

// ---------------------------------------------------------------------------
// Internal constants (Phase 22 Plan 02 — DENS-01)
// ---------------------------------------------------------------------------

/**
 * Time fields fallback — used when no timeFields metadata is provided in query config.
 * Phase 71 DYNM-10: renamed to _FALLBACK; config.timeFields takes precedence when provided.
 */
const ALLOWED_TIME_FIELDS_FALLBACK = new Set(['created_at', 'modified_at', 'due_at']);

/**
 * strftime() patterns for time hierarchy collapse (DENS-01).
 * Mirrors DensityProvider.STRFTIME_PATTERNS — kept local to avoid cross-module coupling.
 * Validation happens on raw field name BEFORE these patterns are applied.
 */
const STRFTIME_PATTERNS: Record<string, (field: string) => string> = {
	day: (field: string) => `strftime('%Y-%m-%d', ${field})`,
	week: (field: string) => `strftime('%Y-W%W', ${field})`,
	month: (field: string) => `strftime('%Y-%m', ${field})`,
	quarter: (field: string) =>
		`strftime('%Y', ${field}) || '-Q' || ((CAST(strftime('%m', ${field}) AS INT) - 1) / 3 + 1)`,
	year: (field: string) => `strftime('%Y', ${field})`,
};

/**
 * Compile an axis field expression.
 * If granularity is set AND the field is a time field, wraps it in the
 * appropriate strftime() expression. Otherwise returns the raw field name.
 *
 * CRITICAL: validateAxisField(field) MUST be called BEFORE this function.
 * The strftime expression is NOT in the allowlist — validation must happen
 * on the raw field name to avoid false SQL safety violations.
 */
function compileAxisExpr(
	field: string,
	granularity: TimeGranularity | null | undefined,
	timeFieldSet?: Set<string>,
): string {
	const effectiveTimeFields = timeFieldSet ?? ALLOWED_TIME_FIELDS_FALLBACK;
	if (granularity && effectiveTimeFields.has(field)) {
		const pattern = STRFTIME_PATTERNS[granularity];
		if (pattern) return pattern(field);
	}
	return field;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for building a SuperGrid GROUP BY query.
 */
export interface SuperGridQueryConfig {
	/** Column axis mappings (any number, N-level stacking supported) */
	colAxes: AxisMapping[];
	/** Row axis mappings (any number, N-level stacking supported) */
	rowAxes: AxisMapping[];
	/** SQL WHERE clause fragment from FilterProvider.compile() (may be empty string) */
	where: string;
	/** Parameterized values corresponding to the WHERE clause placeholders */
	params: unknown[];
	/**
	 * Phase 22 DENS-01 — optional time hierarchy granularity.
	 * When set and a time-field axis (created_at / modified_at / due_at) is present,
	 * rewrites GROUP BY via strftime() to collapse day-level rows into the requested level.
	 * Non-time axes are unaffected. Null or undefined = no granularity wrapping.
	 */
	granularity?: TimeGranularity | null;
	/**
	 * Phase 23 SORT-04 — additional ORDER BY fields applied within groups.
	 * Appended AFTER axis ORDER BY parts to preserve group boundaries.
	 * Each field is validated against the axis allowlist (D-003 SQL safety).
	 * Sort overrides use raw field names — NOT wrapped in strftime even when
	 * granularity is set (sorting on raw values, not time buckets).
	 * Optional — undefined or empty array = no sort overrides (backward compat).
	 */
	sortOverrides?: Array<{ field: AxisField; direction: 'asc' | 'desc' }>;
	/**
	 * Phase 25 SRCH-04 — optional FTS5 search term.
	 * When non-empty (after trim), appends `AND rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)`
	 * to the WHERE clause. Search AND-composes with existing filters — narrows within current filter, doesn't replace.
	 * Empty string or whitespace-only = no FTS filtering (guard against FTS5 empty query crash).
	 */
	searchTerm?: string;
	/**
	 * Phase 55 PROJ-06 — aggregation mode for Z-plane computation.
	 * 'count' (default): COUNT(*) AS count
	 * 'sum'/'avg'/'min'/'max': AGG(displayField) AS count (reuses 'count' alias for backward compat)
	 * Optional — undefined or 'count' = existing behavior.
	 */
	aggregation?: AggregationMode;
	/**
	 * Phase 55 PROJ-05 — display field for non-count aggregation modes.
	 * When aggregation is 'sum'/'avg'/'min'/'max', this field is the column aggregated.
	 * Defaults to 'name' when undefined.
	 */
	displayField?: AxisField;
	/**
	 * Phase 71 DYNM-10 — schema-derived time field names from SchemaProvider.getFieldsByFamily('Time').
	 * When provided, replaces the ALLOWED_TIME_FIELDS_FALLBACK frozen set for strftime() eligibility.
	 * Passed from SuperGrid._fetchAndRender() via schemaProvider.getFieldsByFamily('Time').map(c => c.name).
	 * Undefined = use fallback frozen set (boot-time / schema not yet ready).
	 */
	timeFields?: string[];
	/**
	 * Phase 71 DYNM-10 — schema-derived numeric field names from SchemaProvider.getNumericColumns().
	 * When provided, replaces the NUMERIC_FIELDS_FALLBACK frozen set for aggregate mode defaults.
	 * Passed from SuperGrid._fetchAndRender() via schemaProvider.getNumericColumns().map(c => c.name).
	 * Undefined = use fallback frozen set (boot-time / schema not yet ready).
	 */
	numericFields?: string[];
	/**
	 * Phase 116 — graph_metrics column names used as axes.
	 * When non-empty, adds LEFT JOIN graph_metrics ON cards.id = graph_metrics.card_id
	 * and prefixes metric column references with graph_metrics. table qualifier.
	 * Validated against ALLOWED_METRIC_COLUMNS — invalid names silently filtered.
	 */
	metricsColumns?: string[];
}

/**
 * Compiled SuperGrid query ready for Worker execution.
 */
export interface CompiledSuperGridQuery {
	sql: string;
	params: unknown[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a parameterized GROUP BY SQL query for SuperGrid.
 *
 * The query returns one row per unique (col_axis..., row_axis...) combination
 * with COUNT(*) and GROUP_CONCAT(id) for client-side card assignment.
 *
 * @param config - Column axes, row axes, WHERE clause, and params
 * @returns Compiled SQL + params ready for Worker
 * @throws {Error} If any axis field fails allowlist validation (SQL safety violation)
 *
 * @example
 * buildSuperGridQuery({
 *   colAxes: [{ field: 'card_type', direction: 'asc' }],
 *   rowAxes: [{ field: 'folder', direction: 'asc' }],
 *   where: '',
 *   params: [],
 * })
 * // → SELECT card_type, folder, COUNT(*) AS count, GROUP_CONCAT(id) AS card_ids
 * //    FROM cards WHERE deleted_at IS NULL GROUP BY card_type, folder
 * //    ORDER BY card_type ASC, folder ASC
 */
export function buildSuperGridQuery(config: SuperGridQueryConfig): CompiledSuperGridQuery {
	const { colAxes, rowAxes, where, params } = config;
	const granularity = config.granularity ?? null;
	const sortOverrides = config.sortOverrides ?? [];

	// Phase 71 DYNM-10: Build config-derived field sets (fall back to frozen sets when not provided).
	const timeFieldSet = config.timeFields ? new Set(config.timeFields) : undefined;

	// Phase 116: Determine active metric columns (validated against frozen allowlist)
	const activeMetrics = new Set(config.metricsColumns?.filter((c) => ALLOWED_METRIC_COLUMNS.has(c)) ?? []);
	const needsJoin = activeMetrics.size > 0;

	// Validate all axis fields against the allowlist FIRST (D-003 SQL safety).
	// CRITICAL: Validation MUST use raw field names — strftime expressions are not in the
	// allowlist. compileAxisExpr() is called AFTER validation.
	for (const axis of [...colAxes, ...rowAxes]) {
		validateAxisField(axis.field); // throws "SQL safety violation:..." if invalid
	}

	// Validate sort override fields against the allowlist (D-003 SQL safety).
	// Sort overrides use raw field names — validation runs on raw field before any expression compilation.
	for (const s of sortOverrides) {
		validateAxisField(s.field); // throws "SQL safety violation:..." if invalid
	}

	// Phase 116 helper: prefix metric columns with graph_metrics. table qualifier
	const qualifyField = (field: string): string => (activeMetrics.has(field) ? `graph_metrics.${field}` : field);

	// Build SELECT fields: compile each axis field (may wrap in strftime for time fields)
	// Raw field name used as alias (e.g., `strftime('%Y-%m', created_at) AS created_at`)
	const allAxes = [...colAxes, ...rowAxes];
	const selectParts = allAxes.map((ax) => {
		const qualified = qualifyField(ax.field);
		const expr = compileAxisExpr(qualified, granularity, timeFieldSet);
		// If expression differs from raw field name, use field name as alias for downstream consumers
		return expr !== ax.field ? `${expr} AS ${ax.field}` : qualified;
	});

	const selectClause = selectParts.length > 0 ? selectParts.join(', ') : 'NULL';

	// Build WHERE clause
	const baseWhere = 'deleted_at IS NULL';
	const filterWhere = where ? ` AND ${where}` : '';

	// Phase 25 SRCH-04 — FTS5 search subquery injection
	// CRITICAL: FTS5 MATCH requires non-empty query string. Guard with .trim() check.
	const trimmedSearch = config.searchTerm?.trim() ?? '';
	const searchWhere = trimmedSearch ? ' AND rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)' : '';

	const fullWhere = baseWhere + filterWhere + searchWhere;

	// Build GROUP BY clause using qualified/compiled expressions
	const groupByExprs = allAxes.map((ax) => {
		const qualified = qualifyField(ax.field);
		return compileAxisExpr(qualified, granularity, timeFieldSet);
	});
	const groupByClause = groupByExprs.length > 0 ? `GROUP BY ${groupByExprs.join(', ')}` : '';

	// Build ORDER BY: axis parts first (group ordering), then sortOverrides (within-group ordering).
	// Sort overrides use raw field names (no granularity wrapping — sorting by raw values not time buckets).
	const axisOrderByParts = allAxes.map((ax) => {
		const qualified = qualifyField(ax.field);
		const expr = compileAxisExpr(qualified, granularity, timeFieldSet);
		return `${expr} ${ax.direction.toUpperCase()}`;
	});
	const overrideParts = sortOverrides.map((s) => `${s.field} ${s.direction.toUpperCase()}`);
	const orderByParts = [...axisOrderByParts, ...overrideParts];
	const orderByClause = orderByParts.length > 0 ? `ORDER BY ${orderByParts.join(', ')}` : '';

	// Phase 55 PROJ-06 — aggregation mode for Z-plane
	const aggregation = config.aggregation ?? 'count';
	const displayField = config.displayField ?? 'name';
	let aggExpr: string;
	if (aggregation === 'count' || aggregation === undefined) {
		aggExpr = 'COUNT(*) AS count';
	} else {
		const aggFn = aggregation.toUpperCase();
		aggExpr = `${aggFn}(${displayField}) AS count`;
	}

	// Phase 116: Use explicit table prefixes for card_ids/card_names when JOIN is active
	const cardIdExpr = needsJoin ? 'GROUP_CONCAT(cards.id)' : 'GROUP_CONCAT(id)';
	const cardNameExpr = needsJoin ? 'GROUP_CONCAT(cards.name)' : 'GROUP_CONCAT(name)';
	const fromClause = needsJoin
		? 'FROM cards LEFT JOIN graph_metrics ON cards.id = graph_metrics.card_id'
		: 'FROM cards';

	const sql = [
		`SELECT ${selectClause}, ${aggExpr}, ${cardIdExpr} AS card_ids, ${cardNameExpr} AS card_names`,
		fromClause,
		`WHERE ${fullWhere}`,
		groupByClause,
		orderByClause,
	]
		.filter(Boolean)
		.join('\n');

	// Search params MUST be appended AFTER filter params (positional SQL parameters)
	const searchParams = trimmedSearch ? [trimmedSearch] : [];
	return { sql, params: [...params, ...searchParams] };
}

// ---------------------------------------------------------------------------
// Phase 62 — SuperCalc Aggregation Query Builder
// ---------------------------------------------------------------------------

/**
 * Numeric fields fallback — used when no numericFields metadata is provided in query config.
 * Phase 71 DYNM-10: renamed to _FALLBACK; config.numericFields takes precedence when provided.
 * Text fields (everything else) are locked to COUNT + OFF only.
 * Date fields (created_at, modified_at, due_at) classified as text —
 * MIN/MAX on dates is a niche use case deferred to SuperCalc Extended.
 */
const NUMERIC_FIELDS_FALLBACK: ReadonlySet<string> = new Set(['priority', 'sort_order']);

/**
 * Check if a field is numeric (supports SUM/AVG/MIN/MAX).
 * Non-numeric fields are safety-netted to COUNT regardless of requested mode.
 * Phase 71 DYNM-10: accepts optional Set from config metadata, falls back to frozen set.
 */
function isNumericField(field: string, numericFieldSet?: Set<string> | ReadonlySet<string>): boolean {
	return (numericFieldSet ?? NUMERIC_FIELDS_FALLBACK).has(field);
}

/**
 * Build a parameterized GROUP BY SQL query for SuperGrid footer row aggregation.
 *
 * Unlike buildSuperGridQuery (which groups by ALL axes and returns card_ids),
 * this function groups by ROW axes only and computes per-column aggregate values
 * (SUM/AVG/COUNT/MIN/MAX) for footer display.
 *
 * @param config - Row axes, WHERE clause, params, granularity, searchTerm, and per-column aggregates
 * @returns Compiled SQL + params ready for Worker
 * @throws {Error} If any row axis field or aggregate field fails allowlist validation
 *
 * @example
 * buildSuperGridCalcQuery({
 *   rowAxes: [{ field: 'folder', direction: 'asc' }],
 *   where: '',
 *   params: [],
 *   aggregates: { sort_order: 'sum', priority: 'avg', name: 'count' },
 * })
 * // => SELECT folder, SUM(sort_order) AS "sort_order", AVG(priority) AS "priority", COUNT(*) AS "name"
 * //    FROM cards WHERE deleted_at IS NULL GROUP BY folder ORDER BY folder ASC
 */
export function buildSuperGridCalcQuery(config: {
	rowAxes: import('../../providers/types').AxisMapping[];
	colAxes?: import('../../providers/types').AxisMapping[];
	where: string;
	params: unknown[];
	granularity?: import('../../providers/types').TimeGranularity | null;
	searchTerm?: string;
	aggregates: Record<string, import('../../providers/types').AggregationMode | 'off'>;
	/** Phase 71 DYNM-10: schema-derived time fields (falls back to ALLOWED_TIME_FIELDS_FALLBACK) */
	timeFields?: string[];
	/** Phase 71 DYNM-10: schema-derived numeric fields (falls back to NUMERIC_FIELDS_FALLBACK) */
	numericFields?: string[];
	/** Phase 116: graph_metrics column names used as axes (triggers LEFT JOIN) */
	metricsColumns?: string[];
}): CompiledSuperGridQuery {
	const { rowAxes, where, params, aggregates } = config;
	const colAxes = config.colAxes ?? [];
	const granularity = config.granularity ?? null;

	// Phase 71 DYNM-10: Build config-derived field sets (fall back to frozen sets when not provided).
	const timeFieldSet = config.timeFields ? new Set(config.timeFields) : undefined;
	const numericFieldSet = config.numericFields ? new Set(config.numericFields) : undefined;

	// Phase 116: Determine active metric columns for LEFT JOIN
	const activeMetrics = new Set(config.metricsColumns?.filter((c) => ALLOWED_METRIC_COLUMNS.has(c)) ?? []);
	const needsJoin = activeMetrics.size > 0;
	const qualifyField = (field: string): string => (activeMetrics.has(field) ? `graph_metrics.${field}` : field);

	// Validate all row axis fields against the allowlist (D-003 SQL safety)
	for (const axis of rowAxes) {
		validateAxisField(axis.field);
	}
	// Validate column axis fields (Phase 68: per-column footer aggregation)
	for (const axis of colAxes) {
		validateAxisField(axis.field);
	}

	// Build SELECT: row axis fields + column axis fields (group keys) + aggregate expressions
	const selectParts: string[] = [];

	// Row axis fields for group key
	for (const ax of rowAxes) {
		const qualified = qualifyField(ax.field);
		const expr = compileAxisExpr(qualified, granularity, timeFieldSet);
		selectParts.push(expr !== ax.field ? `${expr} AS ${ax.field}` : qualified);
	}

	// Column axis fields for group key (Phase 68: per-column footer aggregation)
	for (const ax of colAxes) {
		const qualified = qualifyField(ax.field);
		const expr = compileAxisExpr(qualified, granularity, timeFieldSet);
		selectParts.push(expr !== ax.field ? `${expr} AS ${ax.field}` : qualified);
	}

	// Per-column aggregate expressions.
	// Aliases use __agg__ prefix to avoid column name collision when the
	// aggregated field is also a GROUP BY axis (both produce a column with
	// the same name, causing the Worker handler to misclassify the value).
	for (const [field, mode] of Object.entries(aggregates)) {
		if (mode === 'off') continue;

		// Validate aggregate field against allowlist (D-003 SQL safety)
		validateAxisField(field);

		// Determine the effective aggregation mode.
		// Text columns are safety-netted to COUNT regardless of requested mode.
		let effectiveMode = mode;
		if (!isNumericField(field, numericFieldSet) && mode !== 'count') {
			effectiveMode = 'count';
		}

		const qualifiedAggField = qualifyField(field);
		const alias = `__agg__${field}`;
		if (effectiveMode === 'count') {
			// COUNT always uses COUNT(*) — counts all rows including NULLs
			selectParts.push(`COUNT(*) AS "${alias}"`);
		} else {
			// SUM/AVG/MIN/MAX operate on column directly (NULLs excluded by SQL standard)
			const aggFn = effectiveMode.toUpperCase();
			selectParts.push(`${aggFn}(${qualifiedAggField}) AS "${alias}"`);
		}
	}

	const selectClause = selectParts.length > 0 ? selectParts.join(', ') : '1';

	// Build WHERE clause (same pattern as buildSuperGridQuery)
	const baseWhere = 'deleted_at IS NULL';
	const filterWhere = where ? ` AND ${where}` : '';

	// FTS5 search subquery injection (same as buildSuperGridQuery)
	const trimmedSearch = config.searchTerm?.trim() ?? '';
	const searchWhere = trimmedSearch ? ' AND rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)' : '';

	const fullWhere = baseWhere + filterWhere + searchWhere;

	// Build GROUP BY from row axes + column axes (Phase 68: per-column footer aggregation)
	const allGroupAxes = [...rowAxes, ...colAxes];
	const groupByExprs = allGroupAxes.map((ax) => {
		const qualified = qualifyField(ax.field);
		return compileAxisExpr(qualified, granularity, timeFieldSet);
	});
	const groupByClause = groupByExprs.length > 0 ? `GROUP BY ${groupByExprs.join(', ')}` : '';

	// Build ORDER BY from row axes
	const orderByParts = rowAxes.map((ax) => {
		const qualified = qualifyField(ax.field);
		const expr = compileAxisExpr(qualified, granularity, timeFieldSet);
		return `${expr} ${ax.direction.toUpperCase()}`;
	});
	const orderByClause = orderByParts.length > 0 ? `ORDER BY ${orderByParts.join(', ')}` : '';

	// Phase 116: FROM clause with optional LEFT JOIN
	const fromClause = needsJoin
		? 'FROM cards LEFT JOIN graph_metrics ON cards.id = graph_metrics.card_id'
		: 'FROM cards';

	const sql = [`SELECT ${selectClause}`, fromClause, `WHERE ${fullWhere}`, groupByClause, orderByClause]
		.filter(Boolean)
		.join('\n');

	// Search params MUST be appended AFTER filter params (positional SQL parameters)
	const searchParams = trimmedSearch ? [trimmedSearch] : [];
	return { sql, params: [...params, ...searchParams] };
}
