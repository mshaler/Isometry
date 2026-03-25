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
	 * Returns cell map keyed by rowPath::colPath.
	 */
	fetchData(rows: HeaderDimension[], cols: HeaderDimension[]): Promise<Map<string, number | null>>;
	/** Subscribe to external data changes (e.g., StateCoordinator updates). Returns unsubscribe. */
	subscribe?(cb: () => void): () => void;
	/** Optional: expose providers for plugin hooks that need them (calc, schema, density). */
	getProviderContext?(): Record<string, unknown>;
}
