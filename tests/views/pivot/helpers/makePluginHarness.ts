// Isometry v5 — Phase 104 Plan 01
// Shared Vitest harness factory for plugin system tests.
//
// Eliminates duplicated makeCtx() helpers across test files by providing
// a single one-call factory that returns a fully wired FeatureCatalog +
// PluginRegistry + shared state in one call.
//
// Requirements: INFR-01

import { FEATURE_CATALOG, registerCatalog } from '../../../../src/views/pivot/plugins/FeatureCatalog';
import { PluginRegistry } from '../../../../src/views/pivot/plugins/PluginRegistry';
import type { CellPlacement, GridLayout, RenderContext } from '../../../../src/views/pivot/plugins/PluginTypes';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options for customizing the harness fixture. */
export interface HarnessOptions {
	/** Number of visible rows to generate. Default: 10. */
	rows?: number;
	/** Column names. Default: ['Col1', 'Col2']. */
	cols?: string[];
	/** clientHeight applied to rootEl. Default: 400. */
	containerHeight?: number;
	/** Initial data map. Default: empty. */
	data?: Map<string, number | null>;
}

/** Return type of makePluginHarness(). */
export interface PluginHarness {
	/** The fully wired PluginRegistry with all 27 catalog plugins registered. */
	registry: PluginRegistry;
	/** FEATURE_CATALOG reference (read-only catalog metadata). */
	catalog: typeof FEATURE_CATALOG;
	/** Pre-built RenderContext using generated row/col data. */
	ctx: RenderContext;
	/** Enable a plugin by ID (delegates to registry.enable). */
	enable(id: string): void;
	/** Disable a plugin by ID (delegates to registry.disable). */
	disable(id: string): void;
	/** Run the full pipeline: transformData → transformLayout → afterRender. Returns { cells, layout }. */
	runPipeline(): { cells: CellPlacement[]; layout: GridLayout };
}

// ---------------------------------------------------------------------------
// Default layout
// ---------------------------------------------------------------------------

function makeDefaultLayout(): GridLayout {
	return {
		headerWidth: 120,
		headerHeight: 30,
		cellWidth: 80,
		cellHeight: 24,
		colWidths: new Map<number, number>(),
		rowHeaderWidths: new Map<number, number>(),
		zoom: 1,
	};
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a fully wired plugin harness in one call.
 *
 * The harness:
 *   - Creates a fresh PluginRegistry
 *   - Calls registerCatalog() to wire all 27 plugins + shared state
 *   - Builds a RenderContext from opts (generated rows/cols, etc.)
 *   - Provides enable/disable/runPipeline convenience methods
 */
export function makePluginHarness(opts?: HarnessOptions): PluginHarness {
	const rows = opts?.rows ?? 10;
	const colNames = opts?.cols ?? ['Col1', 'Col2'];
	const containerHeight = opts?.containerHeight ?? 400;
	const data = opts?.data ?? new Map<string, number | null>();

	// Build registry and register all 27 catalog plugins
	const registry = new PluginRegistry();
	registerCatalog(registry);

	// Build generated row/col data
	const visibleRows: string[][] = Array.from({ length: rows }, (_, i) => [`Row${i}`]);
	const allRows: string[][] = [...visibleRows];
	const visibleCols: string[][] = colNames.map((name) => [name]);

	// Build HeaderDimensions from generated data
	const rowDimensions = [
		{
			id: 'row-dim',
			type: 'folder' as const,
			name: 'Row',
			values: visibleRows.map((r) => r[0]).filter((v): v is string => v !== undefined),
		},
	];
	const colDimensions = colNames.map((name, i) => ({
		id: `col-dim-${i}`,
		type: 'tag' as const,
		name,
		values: [name],
	}));

	// Build rootEl with containerHeight applied
	const rootEl = document.createElement('div');
	Object.defineProperty(rootEl, 'clientHeight', {
		get: () => containerHeight,
		configurable: true,
	});
	Object.defineProperty(rootEl, 'clientWidth', {
		get: () => 800,
		configurable: true,
	});

	// Build RenderContext (isPluginEnabled delegates to registry)
	const ctx: RenderContext = {
		rowDimensions,
		colDimensions,
		visibleRows,
		allRows,
		visibleCols,
		data,
		cells: [],
		rootEl,
		scrollLeft: 0,
		scrollTop: 0,
		isPluginEnabled: (id: string) => registry.isEnabled(id),
	};

	// Convenience methods
	function enable(id: string): void {
		registry.enable(id);
	}

	function disable(id: string): void {
		registry.disable(id);
	}

	function runPipeline(): { cells: CellPlacement[]; layout: GridLayout } {
		// Build initial cells from data map
		let cells: CellPlacement[] = [];
		let colIdx = 0;
		for (const colName of colNames) {
			let rowIdx = 0;
			for (const row of visibleRows) {
				const key = `${row[0]}:${colName}`;
				cells.push({
					key,
					rowIdx,
					colIdx,
					value: data.get(key) ?? null,
				});
				rowIdx++;
			}
			colIdx++;
		}

		// Run pipeline in order
		cells = registry.runTransformData(cells, ctx);
		const layout = registry.runTransformLayout(makeDefaultLayout(), ctx);
		registry.runAfterRender(rootEl, ctx);

		return { cells, layout };
	}

	return {
		registry,
		catalog: FEATURE_CATALOG,
		ctx,
		enable,
		disable,
		runPipeline,
	};
}
