// Phase 137 Plan 01 — formatTimeBucket
// Pure function: converts SQL time bucket strings into human-readable display labels.
//
// Pattern detection is regex-based on the bucket string shape, not granularity parameter.
// Uses d3.utcFormat (not d3.timeFormat) for consistent UTC-based label generation.
//
// Requirements: TIME-03, TVIS-01

import * as d3 from 'd3';
import { NO_DATE_SENTINEL } from './SuperGridQuery';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEK_RE = /^\d{4}-W(\d{2})$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const QUARTER_RE = /^\d{4}-Q([1-4])$/;
const YEAR_RE = /^\d{4}$/;

const fmtDay = d3.utcFormat('%b %d, %Y');
const fmtMonth = d3.utcFormat('%b %Y');

/**
 * Convert a SQL time bucket string to a human-readable display label.
 *
 * Examples:
 *   '2026-03-15' → 'Mar 15, 2026'
 *   '2026-W14'   → 'Week 14, 2026'
 *   '2026-03'    → 'Mar 2026'
 *   '2026-Q1'    → 'Q1 2026'
 *   '2026'       → '2026'
 *   '__NO_DATE__'→ 'No Date'
 *   'Work'       → 'Work'  (passthrough)
 */
export function formatTimeBucket(bucketLabel: string): string {
	if (bucketLabel === NO_DATE_SENTINEL) return 'No Date';

	if (DAY_RE.test(bucketLabel)) {
		return fmtDay(new Date(bucketLabel + 'T00:00:00Z'));
	}

	const weekMatch = WEEK_RE.exec(bucketLabel);
	if (weekMatch) {
		const year = bucketLabel.slice(0, 4);
		const week = weekMatch[1]!;
		return `Week ${week}, ${year}`;
	}

	if (MONTH_RE.test(bucketLabel)) {
		return fmtMonth(new Date(bucketLabel + '-01T00:00:00Z'));
	}

	const quarterMatch = QUARTER_RE.exec(bucketLabel);
	if (quarterMatch) {
		const year = bucketLabel.slice(0, 4);
		const q = quarterMatch[1]!;
		return `Q${q} ${year}`;
	}

	if (YEAR_RE.test(bucketLabel)) {
		return bucketLabel;
	}

	return bucketLabel;
}
