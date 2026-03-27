// Isometry v5 — Phase 122 Plan 01
// DataAdapter interface — abstracts PivotGrid's data source.
//
// Design:
//   - Decouples PivotGrid/PivotTable from PivotMockData
//   - BridgeDataAdapter: production path through WorkerBridge + providers
//   - MockDataAdapter: harness path via PivotMockData
//
// Requirements: CONV-01, CONV-03

import type { HeaderDimension } from './PivotTypes';

// ---------------------------------------------------------------------------
// FetchDataResult
// ---------------------------------------------------------------------------

/**
 * Result returned by DataAdapter.fetchData().
 *
 * Includes the cell data map plus pre-extracted unique row/col combinations
 * derived from the query results. This allows PivotGrid to render the actual
 * axis values from the query rather than relying on static HeaderDimension.values
 * (which are intentionally empty in BridgeDataAdapter).
 */
export interface FetchDataResult {
	/** Cell map keyed by getCellKey(rowPath, colPath). */
	data: Map<string, number | null>;
	/** Unique row combinations extracted from query result keys, sorted alphabetically. */
	rowCombinations: string[][];
	/** Unique col combinations extracted from query result keys, sorted alphabetically. */
	colCombinations: string[][];
}

// ---------------------------------------------------------------------------
// DataAdapter
// ---------------------------------------------------------------------------

/**
 * Abstraction over PivotGrid's data source.
 *
 * Two implementations:
 *   - MockDataAdapter: wraps PivotMockData (harness / testing)
 *   - BridgeDataAdapter: wraps WorkerBridge + providers (production)
 */
export interface DataAdapter {
	/** Return all available dimensions this data source provides. */
	getAllDimensions(): HeaderDimension[];
	/** Return current row dimensions. */
	getRowDimensions(): HeaderDimension[];
	/** Return current column dimensions. */
	getColDimensions(): HeaderDimension[];
	/** Set row dimensions (for drag-drop reorder). */
	setRowDimensions(dims: HeaderDimension[]): void;
	/** Set column dimensions (for drag-drop reorder). */
	setColDimensions(dims: HeaderDimension[]): void;
	/**
	 * Fetch data for the current dimension configuration.
	 * Returns FetchDataResult with cell map and unique row/col combinations.
	 */
	fetchData(rows: HeaderDimension[], cols: HeaderDimension[]): Promise<FetchDataResult>;
	/** Subscribe to external data changes (e.g., StateCoordinator updates). Returns unsubscribe. */
	subscribe?(cb: () => void): () => void;
	/** Optional: expose providers for plugin hooks that need them (calc, schema, density). */
	getProviderContext?(): Record<string, unknown>;
}
