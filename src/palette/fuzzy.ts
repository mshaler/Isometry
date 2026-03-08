/**
 * Fuzzy match scorer for command palette search.
 *
 * Checks if all characters of the query appear in order within the target
 * string and returns a relevance score. Higher scores indicate better matches.
 *
 * Scoring strategy:
 *   - Substring match (target contains query): base 1000 - target.length,
 *     plus starts-with bonus (100) and query length bonus (query.length * 10)
 *   - Character-by-character fuzzy: only word-boundary or consecutive matches
 *     count. Consecutive match bonus (consecutive * 2), word boundary bonus (+10).
 *   - Returns null when no match or empty query
 *
 * @param query - The search string entered by the user
 * @param target - The label to match against
 * @returns A positive score (higher = better) or null if no match
 */
export function fuzzyMatch(query: string, target: string): number | null {
	if (query.length === 0) return null;

	const q = query.toLowerCase();
	const t = target.toLowerCase();

	// Substring match shortcut (highest quality match)
	if (t.includes(q)) {
		return 1000 - t.length + (t.indexOf(q) === 0 ? 100 : 0) + q.length * 10;
	}

	// Character-by-character fuzzy match.
	// Each matched character must be at a word boundary (position 0, after
	// space/hyphen) OR consecutive with the previous matched character.
	// This prevents false positives like "lv" matching "Ca[l]endar [V]iew"
	// where "l" is mid-word.
	let qi = 0;
	let score = 0;
	let consecutive = 0;
	let lastMatchIndex = -2; // -2 so first match is never "consecutive" by default

	for (let ti = 0; ti < t.length && qi < q.length; ti++) {
		if (t[ti] === q[qi]) {
			const isWordBoundary = ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-';
			const isConsecutive = ti === lastMatchIndex + 1;

			if (!isWordBoundary && !isConsecutive) {
				// Mid-word non-consecutive match -- skip this position
				consecutive = 0;
				continue;
			}

			qi++;
			lastMatchIndex = ti;

			if (isConsecutive) {
				consecutive++;
			} else {
				consecutive = 1;
			}

			score += consecutive * 2; // Consecutive bonus
			if (isWordBoundary) {
				score += 10; // Word boundary bonus
			}
		} else {
			consecutive = 0;
		}
	}

	return qi === q.length ? score : null;
}
