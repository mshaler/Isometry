import * as d3 from 'd3';
import type { TimeGranularity } from '../../providers/types';

// Three parsers in fallback order (CONTEXT.md locked decision):
// 1. ISO 8601: %Y-%m-%d  (e.g., '2025-03-15')
// 2. US:       %m/%d/%Y  (e.g., '03/15/2025')
// 3. EU:       %d/%m/%Y  (e.g., '15/03/2025')
// First successful parse wins. Module-level singletons avoid re-creating on every call.
const _ISO_PARSER = d3.timeParse('%Y-%m-%d');
const _US_PARSER = d3.timeParse('%m/%d/%Y');
const _EU_PARSER = d3.timeParse('%d/%m/%Y');

// Regex to extract the first numeric segment of a slash-delimited date string.
// Used to guard the US parser against month-overflow false positives.
// d3.timeParse('%m/%d/%Y') will silently overflow month 15 → next year, producing
// an incorrect but non-null result. We pre-reject if the first segment (month) > 12.
const _SLASH_FIRST_SEG = /^(\d{1,2})\//;

/**
 * Parse a date string using sequential format fallback.
 * Order: ISO 8601 → US (MM/DD/YYYY) → EU (DD/MM/YYYY).
 * Returns null for unparseable strings ('TBD', 'ASAP', '', etc.)
 * — these map to the 'No Date' group in SuperGrid time axes.
 *
 * Date-only precision per CONTEXT.md: time components are stripped before parsing.
 * '2025-03-05T14:30:00' → stripped to '2025-03-05' → returns March 5, 2025.
 *
 * US/EU disambiguation: if the first slash-delimited segment is > 12, the US parser
 * is skipped (month > 12 is unambiguously a day, not a month) and EU parser is tried.
 */
export function parseDateString(s: string): Date | null {
  if (!s || s.trim() === '') return null;
  // Strip ISO datetime suffix (date-only precision per CONTEXT.md)
  const dateOnly = s.split('T')[0]!;

  // Try ISO parser first (dash-separated — unambiguous)
  const isoResult = _ISO_PARSER(dateOnly);
  if (isoResult) return isoResult;

  // For slash-separated formats, determine whether the first segment could be a month (1-12).
  // If the first segment > 12, skip the US parser to prevent month-overflow false positives.
  const firstSegMatch = _SLASH_FIRST_SEG.exec(dateOnly);
  const firstSeg = firstSegMatch ? parseInt(firstSegMatch[1]!, 10) : 0;
  const firstSegCouldBeMonth = firstSeg >= 1 && firstSeg <= 12;

  if (firstSegCouldBeMonth) {
    // Ambiguous: first segment could be either a US month or an EU day <= 12.
    // Try US parser first per CONTEXT.md locked decision (first successful parse wins).
    const usResult = _US_PARSER(dateOnly);
    if (usResult) return usResult;
  }

  // Try EU parser (either first segment was > 12, proving it's a day, or US parser failed)
  const euResult = _EU_PARSER(dateOnly);
  if (euResult) return euResult;

  return null;
}

/**
 * Select the appropriate time hierarchy level for ~10-20 columns.
 *
 * Threshold breakpoints (targeting ~10-20 columns):
 *   day:     ≤20 days   → max 20 day-columns
 *   week:    ≤140 days  → max ~20 week-columns (7×20=140)
 *   month:   ≤610 days  → max ~20 month-columns (~30.5×20=610)
 *   quarter: ≤1825 days → max ~20 quarter-columns (~91×20≈1825)
 *   year:    >1825 days → year-level columns
 *
 * Uses d3.timeDay.count for DST-safe day counting.
 * Single-date dataset (minDate === maxDate) returns 'day' (0 days ≤ 20).
 */
export function smartHierarchy(minDate: Date, maxDate: Date): TimeGranularity {
  const days = d3.timeDay.count(minDate, maxDate);
  if (days <= 20) return 'day';
  if (days <= 140) return 'week';
  if (days <= 610) return 'month';
  if (days <= 1825) return 'quarter';
  return 'year';
}
