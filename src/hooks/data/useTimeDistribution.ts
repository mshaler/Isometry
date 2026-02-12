import { useMemo } from 'react';
import { useDatabaseService } from '@/hooks';

export interface TimeBucket {
  start: Date;
  end: Date;
  count: number;
  label: string;
}

export interface TimeDistribution {
  buckets: TimeBucket[];
  minDate: Date | null;
  maxDate: Date | null;
  totalCount: number;
  granularity: 'year' | 'quarter' | 'month' | 'week' | 'day';
}

/**
 * useTimeDistribution - Hook for computing time distribution of cards
 *
 * Queries card timestamps from sql.js and aggregates into buckets.
 * Auto-selects granularity based on date range span.
 *
 * @param facet - The time facet to analyze (e.g., 'created_at', 'modified_at')
 * @param bucketCount - Target number of buckets (default: 12)
 */
export function useTimeDistribution(
  facet: string = 'created_at',
  bucketCount: number = 12
): TimeDistribution {
  const databaseService = useDatabaseService();

  return useMemo(() => {
    const emptyResult: TimeDistribution = {
      buckets: [],
      minDate: null,
      maxDate: null,
      totalCount: 0,
      granularity: 'month',
    };

    if (!databaseService?.isReady()) {
      return emptyResult;
    }

    try {
      // Map facet names to actual column names
      const columnMap: Record<string, string> = {
        created_at: 'created_at',
        modified_at: 'modified_at',
        due_date: 'due_date',
        event_date: 'event_date',
      };

      const column = columnMap[facet] || 'created_at';

      // Get min/max dates
      const rangeResult = databaseService.query(`
        SELECT
          MIN(${column}) as min_date,
          MAX(${column}) as max_date,
          COUNT(*) as total
        FROM nodes
        WHERE ${column} IS NOT NULL AND deleted_at IS NULL
      `);

      if (!rangeResult || rangeResult.length === 0) {
        return emptyResult;
      }

      const { min_date, max_date, total } = rangeResult[0] as {
        min_date: string | null;
        max_date: string | null;
        total: number;
      };

      if (!min_date || !max_date) {
        return emptyResult;
      }

      const minDate = new Date(min_date);
      const maxDate = new Date(max_date);
      const daySpan = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);

      // Auto-select granularity based on date span
      let granularity: TimeDistribution['granularity'];
      let sqlFormat: string;
      let labelFormat: (date: Date) => string;

      if (daySpan > 730) {
        // > 2 years → yearly
        granularity = 'year';
        sqlFormat = `strftime('%Y', ${column})`;
        labelFormat = (d) => d.getFullYear().toString();
      } else if (daySpan > 180) {
        // > 6 months → quarterly
        granularity = 'quarter';
        sqlFormat = `strftime('%Y', ${column}) || '-Q' || ((CAST(strftime('%m', ${column}) AS INTEGER) - 1) / 3 + 1)`;
        labelFormat = (d) => {
          const q = Math.floor(d.getMonth() / 3) + 1;
          return `Q${q} ${d.getFullYear()}`;
        };
      } else if (daySpan > 60) {
        // > 2 months → monthly
        granularity = 'month';
        sqlFormat = `strftime('%Y-%m', ${column})`;
        labelFormat = (d) => d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      } else if (daySpan > 14) {
        // > 2 weeks → weekly
        granularity = 'week';
        sqlFormat = `strftime('%Y-W%W', ${column})`;
        labelFormat = (d) => `W${getWeekNumber(d)} ${d.getFullYear()}`;
      } else {
        // ≤ 2 weeks → daily
        granularity = 'day';
        sqlFormat = `strftime('%Y-%m-%d', ${column})`;
        labelFormat = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }

      // Query bucket counts
      const bucketResult = databaseService.query(`
        SELECT
          ${sqlFormat} as bucket,
          COUNT(*) as count
        FROM nodes
        WHERE ${column} IS NOT NULL AND deleted_at IS NULL
        GROUP BY bucket
        ORDER BY bucket ASC
      `);

      if (!bucketResult || bucketResult.length === 0) {
        return { ...emptyResult, minDate, maxDate, totalCount: total, granularity };
      }

      // Convert to TimeBucket array
      const buckets: TimeBucket[] = bucketResult.map((row: Record<string, unknown>) => {
        const bucket = row.bucket as string;
        const count = row.count as number;
        const bucketDate = parseBucketDate(bucket, granularity);
        const endDate = getNextBucketDate(bucketDate, granularity);

        return {
          start: bucketDate,
          end: endDate,
          count,
          label: labelFormat(bucketDate),
        };
      });

      return {
        buckets,
        minDate,
        maxDate,
        totalCount: total,
        granularity,
      };
    } catch (error) {
      console.error('useTimeDistribution error:', error);
      return emptyResult;
    }
  }, [databaseService, facet, bucketCount]);
}

// Helper: Parse bucket string to Date
function parseBucketDate(bucket: string, granularity: string): Date {
  switch (granularity) {
    case 'year':
      return new Date(parseInt(bucket), 0, 1);
    case 'quarter': {
      const [year, q] = bucket.split('-Q');
      const month = (parseInt(q) - 1) * 3;
      return new Date(parseInt(year), month, 1);
    }
    case 'month': {
      const [year, month] = bucket.split('-');
      return new Date(parseInt(year), parseInt(month) - 1, 1);
    }
    case 'week': {
      // Approximate - get first day of that week
      const [year, week] = bucket.split('-W');
      const jan1 = new Date(parseInt(year), 0, 1);
      const weekStart = new Date(jan1.getTime() + (parseInt(week) - 1) * 7 * 24 * 60 * 60 * 1000);
      return weekStart;
    }
    case 'day':
    default:
      return new Date(bucket);
  }
}

// Helper: Get next bucket start date
function getNextBucketDate(date: Date, granularity: string): Date {
  const next = new Date(date);
  switch (granularity) {
    case 'year':
      next.setFullYear(next.getFullYear() + 1);
      break;
    case 'quarter':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'month':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'week':
      next.setDate(next.getDate() + 7);
      break;
    case 'day':
    default:
      next.setDate(next.getDate() + 1);
  }
  return next;
}

// Helper: Get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
