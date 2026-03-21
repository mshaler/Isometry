// Isometry v5 — Phase 97 PivotTypes
// Type definitions for the self-contained D3 pivot table module.
//
// Design:
//   - HeaderDimension: a named dimension with discrete values (folder, tag, year, etc.)
//   - SpanInfo: run-length encoded header span for grouped column/row headers
//   - PivotState: mutable state bag driving the pivot table lifecycle
//
// Requirements: PIV-01

// ---------------------------------------------------------------------------
// Dimension types
// ---------------------------------------------------------------------------

/** Semantic category for a dimension — drives default placement and iconography. */
export type DimensionType = 'folder' | 'subfolder' | 'tag' | 'year' | 'month' | 'day';

/** A single configurable dimension with its distinct values. */
export interface HeaderDimension {
	/** Stable unique identifier for DnD keying. */
	id: string;
	/** Semantic type. */
	type: DimensionType;
	/** Human-readable label shown in config panel chips. */
	name: string;
	/** Ordered list of distinct values for this dimension. */
	values: string[];
}

// ---------------------------------------------------------------------------
// Span types
// ---------------------------------------------------------------------------

/** A single header span produced by the run-length encoder. */
export interface SpanInfo {
	/** Number of leaf cells this header covers. */
	span: number;
	/** Display label for this span group. */
	label: string;
}

// ---------------------------------------------------------------------------
// Cell sizing
// ---------------------------------------------------------------------------

/** Pixel sizing for header and data cells — adjustable via resize handles. */
export interface CellSize {
	headerWidth: number;
	headerHeight: number;
	cellWidth: number;
	cellHeight: number;
}

// ---------------------------------------------------------------------------
// Drag payload
// ---------------------------------------------------------------------------

/** Payload attached to a pointer-event drag session. */
export interface DragPayload {
	dimension: HeaderDimension;
	sourceZone: 'available' | 'row' | 'column';
}

// ---------------------------------------------------------------------------
// Pivot state
// ---------------------------------------------------------------------------

/** Full mutable state for the pivot table. */
export interface PivotState {
	rowDimensions: HeaderDimension[];
	colDimensions: HeaderDimension[];
	hideEmptyRows: boolean;
	hideEmptyCols: boolean;
	sizes: CellSize;
}
