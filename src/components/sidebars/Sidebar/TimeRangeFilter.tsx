/**
 * TimeRangeFilter Component
 *
 * Time-based filter options (Today, This Week, etc.).
 * Extracted from Sidebar.tsx lines 189-238.
 */

import { useTheme } from '@/contexts/ThemeContext';

// ============================================
// Types
// ============================================

export interface DateRangeInfo {
  min_date: string | null;
  max_date: string | null;
  has_created: number;
  has_due: number;
}

export interface TimeRangeFilterProps {
  dateRange: DateRangeInfo[] | null | undefined;
  onSelect: (field: string, operator: string, value: string) => void;
}

// ============================================
// Component
// ============================================

export function TimeRangeFilter({ dateRange, onSelect }: TimeRangeFilterProps) {
  const { theme } = useTheme();

  // Check if we have valid date data
  if (
    !dateRange ||
    dateRange.length === 0 ||
    (!dateRange[0]?.has_created && !dateRange[0]?.has_due)
  ) {
    return <div className="text-xs text-gray-400 p-2">No date fields in data</div>;
  }

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Calculate date boundaries
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    .toISOString()
    .split('T')[0];
  const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    .toISOString()
    .split('T')[0];

  interface TimeRange {
    label: string;
    start: string;
    end: string;
    field?: string;
  }

  const timeRanges: TimeRange[] = [
    { label: 'Today', start: today, end: today },
    { label: 'This Week', start: weekAgo, end: today },
    { label: 'This Month', start: monthAgo, end: today },
    { label: 'This Year', start: yearAgo, end: today },
  ];

  if (dateRange[0]?.has_due) {
    timeRanges.push({ label: 'Overdue', start: '1900-01-01', end: today, field: 'due' });
  }

  const itemStyles =
    theme === 'NeXTSTEP'
      ? 'bg-[#d4d4d4] hover:bg-black hover:text-white'
      : 'bg-white hover:bg-blue-500 hover:text-white rounded';

  const handleSelect = (range: TimeRange) => {
    const dateField = range.field || (dateRange[0]?.has_created ? 'created' : 'due');
    const operator = range.label === 'Overdue' ? '<' : '>=';
    const value = range.label === 'Overdue' ? today : range.start;
    onSelect(dateField, operator, value);
  };

  return (
    <div className="space-y-1">
      {timeRanges.map((range) => (
        <button
          key={range.label}
          onClick={() => handleSelect(range)}
          className={`w-full h-7 px-2 text-left text-sm ${itemStyles}`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}

export default TimeRangeFilter;
