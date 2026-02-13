/**
 * StatusChips Component
 *
 * Status filter chips with color-coded visual indicators.
 * Includes "All" chip to clear status filter.
 *
 * Phase 79-02: Catalog Browser UI components
 */

import { Circle, CheckCircle, Clock, Archive } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { FacetCount } from '../../hooks/data/useFacetAggregates';

interface StatusChipsProps {
  statuses: FacetCount[];
  activeStatus: string | null;
  onStatusClick: (status: string | null) => void;
}

type StatusIconType = typeof Circle;

const statusIcons: Record<string, StatusIconType> = {
  active: Circle,
  done: CheckCircle,
  pending: Clock,
  archived: Archive,
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700',
  done: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700',
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700',
  archived: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600',
};

const defaultColor =
  'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600';

export function StatusChips({
  statuses,
  activeStatus,
  onStatusClick,
}: StatusChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* All statuses chip */}
      <button
        onClick={() => onStatusClick(null)}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors',
          activeStatus === null
            ? 'bg-gray-800 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-gray-100'
            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-800'
        )}
      >
        <span>All</span>
      </button>

      {statuses.map(({ value, count }) => {
        const isActive = activeStatus === value;
        const IconComponent = statusIcons[value] || Circle;
        const colorClass = statusColors[value] || defaultColor;

        return (
          <button
            key={value}
            onClick={() => onStatusClick(value)}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors',
              isActive ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-900' : '',
              colorClass
            )}
          >
            <IconComponent className="w-4 h-4" />
            <span className="capitalize">{value}</span>
            <span className="text-xs opacity-70">({count})</span>
          </button>
        );
      })}
    </div>
  );
}

export default StatusChips;
