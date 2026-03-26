// Isometry v5 — Phase 97 PivotMockData
// Mock dimension catalog and data generator for standalone pivot table testing.
//
// Design:
//   - allDimensions: 6 pre-configured dimensions matching Figma design
//   - generateMockData: produces Map<string, number|null> keyed by rowPath::colPath
//   - getCellKey: stable key function for data lookup
//   - generateCombinations: cartesian product of dimension values
//
// Requirements: PIV-02

import type { HeaderDimension } from './PivotTypes';

// ---------------------------------------------------------------------------
// Dimension catalog
// ---------------------------------------------------------------------------

/** All available dimensions — superset from which rows/cols/available are drawn. */
export const allDimensions: HeaderDimension[] = [
	{
		id: 'folder',
		type: 'folder',
		name: 'Folders',
		values: ['Documents', 'Photos', 'Projects'],
	},
	{
		id: 'subfolder',
		type: 'subfolder',
		name: 'Subfolders',
		values: ['Work', 'Personal', 'Archive', 'Backup'],
	},
	{
		id: 'tag',
		type: 'tag',
		name: 'Tags',
		values: ['Important', 'Draft', 'Final', 'Review'],
	},
	{
		id: 'year',
		type: 'year',
		name: 'Years',
		values: ['2023', '2024', '2025'],
	},
	{
		id: 'month',
		type: 'month',
		name: 'Months',
		values: [
			'January',
			'February',
			'March',
			'April',
			'May',
			'June',
			'July',
			'August',
			'September',
			'October',
			'November',
			'December',
		],
	},
	{
		id: 'day',
		type: 'day',
		name: 'Days',
		values: Array.from({ length: 31 }, (_, i) => `${i + 1}`),
	},
];

// ---------------------------------------------------------------------------
// Combination generator
// ---------------------------------------------------------------------------

/**
 * Generate the cartesian product of all dimension values.
 *
 * Given dimensions [{values:['A','B']}, {values:['x','y']}], returns:
 * [['A','x'], ['A','y'], ['B','x'], ['B','y']]
 */
export function generateCombinations(dimensions: HeaderDimension[], index = 0, current: string[] = []): string[][] {
	if (index >= dimensions.length) return [current];
	const results: string[][] = [];
	for (const value of dimensions[index]!.values) {
		results.push(...generateCombinations(dimensions, index + 1, [...current, value]));
	}
	return results;
}

// ---------------------------------------------------------------------------
// Cell key
// ---------------------------------------------------------------------------

/** Build a stable lookup key from row and column path arrays. */
export function getCellKey(rowPath: string[], colPath: string[]): string {
	return `${rowPath.join('|')}::${colPath.join('|')}`;
}

// ---------------------------------------------------------------------------
// Mock data generator
// ---------------------------------------------------------------------------

/**
 * Generate a sparse mock dataset for the given row/col dimension configuration.
 *
 * Each cell has a 30% chance of being null (empty), otherwise a random integer 1–100.
 * Uses a seeded approach for reproducibility when seed is provided.
 */
export function generateMockData(
	rowDimensions: HeaderDimension[],
	colDimensions: HeaderDimension[],
	seed?: number,
): Map<string, number | null> {
	const data = new Map<string, number | null>();

	// Simple seedable PRNG (mulberry32)
	let s = seed ?? Math.floor(Math.random() * 2 ** 32);
	function rand(): number {
		s |= 0;
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	const rowCombinations = generateCombinations(rowDimensions);
	const colCombinations = generateCombinations(colDimensions);

	for (const rowPath of rowCombinations) {
		for (const colPath of colCombinations) {
			const key = getCellKey(rowPath, colPath);
			const isEmpty = rand() < 0.3;
			data.set(key, isEmpty ? null : Math.floor(rand() * 100) + 1);
		}
	}

	return data;
}
