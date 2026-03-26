// Isometry v5 — Phase 122 Plan 01
// MockDataAdapter — wraps PivotMockData for harness and test use.
//
// Design:
//   - Defaults to allDimensions from PivotMockData
//   - Default row/col dims match what PivotTable previously used as hardcoded defaults
//   - fetchData() calls generateMockData with stable seed 12345
//   - No subscribe() — mock data is static
//
// Requirements: CONV-03

import type { DataAdapter } from './DataAdapter';
import { allDimensions, generateMockData } from './PivotMockData';
import type { HeaderDimension } from './PivotTypes';

// ---------------------------------------------------------------------------
// Default dimensions (match the previous PivotTable hardcoded defaults)
// ---------------------------------------------------------------------------

const DEFAULT_ROW_DIMS: HeaderDimension[] = [
	allDimensions.find((d) => d.type === 'folder')!,
	allDimensions.find((d) => d.type === 'subfolder')!,
	allDimensions.find((d) => d.type === 'tag')!,
];

const DEFAULT_COL_DIMS: HeaderDimension[] = [
	allDimensions.find((d) => d.type === 'year')!,
	allDimensions.find((d) => d.type === 'month')!,
	allDimensions.find((d) => d.type === 'day')!,
];

// ---------------------------------------------------------------------------
// MockDataAdapter
// ---------------------------------------------------------------------------

/**
 * DataAdapter implementation backed by PivotMockData.
 * Used in HarnessShell and tests — no real WorkerBridge dependency.
 */
export class MockDataAdapter implements DataAdapter {
	private _rowDimensions: HeaderDimension[];
	private _colDimensions: HeaderDimension[];

	constructor() {
		this._rowDimensions = [...DEFAULT_ROW_DIMS];
		this._colDimensions = [...DEFAULT_COL_DIMS];
	}

	getAllDimensions(): HeaderDimension[] {
		return allDimensions;
	}

	getRowDimensions(): HeaderDimension[] {
		return this._rowDimensions;
	}

	getColDimensions(): HeaderDimension[] {
		return this._colDimensions;
	}

	setRowDimensions(dims: HeaderDimension[]): void {
		this._rowDimensions = dims;
	}

	setColDimensions(dims: HeaderDimension[]): void {
		this._colDimensions = dims;
	}

	fetchData(rows: HeaderDimension[], cols: HeaderDimension[]): Promise<Map<string, number | null>> {
		const data = generateMockData(rows, cols, 12345);
		return Promise.resolve(data);
	}
}
