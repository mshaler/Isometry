// Isometry v5 — Phase 97 PivotSpans
// Run-length span calculation for grouped pivot table headers.
//
// Design:
//   - calculateSpans: converts dimension combinations into SpanInfo[][] for header rendering
//   - Consecutive identical values under same parent path are merged into spanning cells
//   - Pure function — no side effects, no DOM, fully testable
//
// Requirements: PIV-04

import type { HeaderDimension, SpanInfo } from './PivotTypes';

/**
 * Calculate header spans for a list of dimensions and their value combinations.
 *
 * For each dimension level, consecutive identical values (under the same parent
 * values at earlier levels) are merged into a single SpanInfo with the combined span.
 *
 * Example:
 *   dimensions = [Year, Month]
 *   combinations = [['2024','Jan'], ['2024','Feb'], ['2025','Jan']]
 *   → level 0: [{span:2, label:'2024'}, {span:1, label:'2025'}]
 *   → level 1: [{span:1, label:'Jan'}, {span:1, label:'Feb'}, {span:1, label:'Jan'}]
 */
export function calculateSpans(dimensions: HeaderDimension[], combinations: string[][]): SpanInfo[][] {
	const spans: SpanInfo[][] = [];

	for (let dimIdx = 0; dimIdx < dimensions.length; dimIdx++) {
		const spanRow: SpanInfo[] = [];
		let i = 0;

		while (i < combinations.length) {
			const currentValue = combinations[i]![dimIdx]!;
			let span = 1;

			// Count consecutive same values where all previous dimensions match
			while (i + span < combinations.length && combinations[i + span]![dimIdx] === currentValue) {
				// Check if all previous dimensions still match
				let prevMatch = true;
				for (let prevDim = 0; prevDim < dimIdx; prevDim++) {
					if (combinations[i + span]![prevDim] !== combinations[i]![prevDim]) {
						prevMatch = false;
						break;
					}
				}
				if (!prevMatch) break;
				span++;
			}

			spanRow.push({ span, label: currentValue as string });
			i += span;
		}

		spans.push(spanRow);
	}

	return spans;
}

/**
 * Filter combinations to exclude rows/cols where ALL data cells are empty.
 *
 * Used for hide-empty-rows and hide-empty-cols toggles.
 */
export function filterEmptyCombinations(
	combinations: string[][],
	crossCombinations: string[][],
	data: Map<string, number | null>,
	buildKey: (a: string[], b: string[]) => string,
	isRow: boolean,
): string[][] {
	return combinations.filter((path) =>
		crossCombinations.some((crossPath) => {
			const key = isRow ? buildKey(path, crossPath) : buildKey(crossPath, path);
			const value = data.get(key);
			return value !== null && value !== undefined;
		}),
	);
}
