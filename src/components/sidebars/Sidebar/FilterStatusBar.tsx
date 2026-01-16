/**
 * FilterStatusBar Component
 *
 * Displays active filters with remove/clear functionality.
 * Extracted from Sidebar.tsx lines 299-336.
 */

import { X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useFilters, type Filter } from '@/contexts/FilterContext';

// ============================================
// Component
// ============================================

export function FilterStatusBar() {
  const { theme } = useTheme();
  const { filters, removeFilter, clearFilters } = useFilters();

  if (filters.length === 0) {
    return null;
  }

  const containerStyles =
    theme === 'NeXTSTEP'
      ? 'border-[#808080] bg-[#b8b8b8]'
      : 'border-gray-200 bg-blue-50';

  const clearButtonStyles =
    theme === 'NeXTSTEP'
      ? 'text-[#404040] hover:underline'
      : 'text-blue-500 hover:underline';

  const chipStyles =
    theme === 'NeXTSTEP'
      ? 'bg-[#d4d4d4] border border-[#808080]'
      : 'bg-blue-100 text-blue-700 rounded-full';

  return (
    <div className={`p-2 border-b ${containerStyles}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium">Active Filters</span>
        <button
          onClick={clearFilters}
          className={`text-xs ${clearButtonStyles}`}
        >
          Clear All
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {filters.map((filter: Filter, index: number) => (
          <span
            key={index}
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs ${chipStyles}`}
          >
            {filter.field} {filter.operator} {String(filter.value)}
            <button
              onClick={() => removeFilter(index)}
              className="hover:text-red-500"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default FilterStatusBar;
