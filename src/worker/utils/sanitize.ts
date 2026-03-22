// Isometry v9.0 — Phase 114 Storage Foundation
// sanitizeAlgorithmResult utility
//
// Implements GFND-03: converts NaN/Infinity to null for all 6 algorithm output
// fields before persisting to graph_metrics table.
//
// Rationale: graphology algorithms can produce NaN/Infinity for disconnected
// nodes or degenerate graphs. sql.js stores them as 0 or raises errors.
// This guard ensures only valid numerics (or null) reach the database.

/**
 * The 6 metric field names that require NaN/Infinity sanitization.
 * All other fields (card_id, computed_at, etc.) pass through unchanged.
 */
const METRIC_FIELDS = [
	'centrality',
	'pagerank',
	'community_id',
	'clustering_coeff',
	'sp_depth',
	'in_spanning_tree',
] as const;

/**
 * Sanitize an algorithm result row by converting NaN and ±Infinity to null
 * for all 6 metric fields.
 *
 * Returns a shallow copy of the input — the original object is never mutated.
 * Non-metric fields (card_id, computed_at, etc.) are copied through unchanged.
 *
 * Uses Number.isFinite() which returns false for:
 *   - NaN
 *   - Infinity
 *   - -Infinity
 * All other numbers (0, negatives, very small positives) pass through.
 *
 * @param row - Algorithm result row (may contain NaN/Infinity metric values)
 * @returns   - New object with non-finite metric values replaced by null
 */
export function sanitizeAlgorithmResult(row: Record<string, unknown>): Record<string, unknown> {
	const sanitized = { ...row };
	for (const field of METRIC_FIELDS) {
		const val = sanitized[field];
		if (typeof val === 'number' && !Number.isFinite(val)) {
			sanitized[field] = null;
		}
	}
	return sanitized;
}
