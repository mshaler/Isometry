/**
 * FilterPanel Component
 *
 * Panel showing filter options for a specific filter type.
 * Extracted from Sidebar.tsx lines 172-265.
 */

import { X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { FacetList, type FacetValue } from './FacetList';
import { TimeRangeFilter, type DateRangeInfo } from './TimeRangeFilter';

// ============================================
// Types
// ============================================

export interface FilterPanelProps {
  activePanel: string | null;
  categories: FacetValue[] | null | undefined;
  statuses: FacetValue[] | null | undefined;
  priorities: FacetValue[] | null | undefined;
  tags: FacetValue[] | null | undefined;
  dateRange: DateRangeInfo[] | null | undefined;
  onClose: () => void;
  onFacetSelect: (field: string, value: string) => void;
  onTimeSelect: (field: string, operator: string, value: string) => void;
}

// ============================================
// Component
// ============================================

export function FilterPanel({
  activePanel,
  categories,
  statuses,
  priorities,
  tags,
  dateRange,
  onClose,
  onFacetSelect,
  onTimeSelect,
}: FilterPanelProps) {
  const { theme } = useTheme();

  if (!activePanel) {
    return null;
  }

  const containerStyles =
    theme === 'NeXTSTEP'
      ? 'bg-[#b8b8b8] border-2 border-[#707070]'
      : 'bg-gray-50 rounded-lg border border-gray-200';

  const closeButtonStyles =
    theme === 'NeXTSTEP' ? 'hover:bg-[#a0a0a0]' : 'hover:bg-gray-200 rounded';

  const renderContent = () => {
    switch (activePanel) {
      case 'Category':
        return (
          <FacetList
            data={categories}
            field="category"
            emptyMessage="No categories in data"
            onSelect={onFacetSelect}
          />
        );

      case 'Status':
        return (
          <FacetList
            data={statuses}
            field="status"
            emptyMessage="No statuses in data"
            onSelect={onFacetSelect}
          />
        );

      case 'Priority':
        return (
          <FacetList
            data={priorities}
            field="priority"
            emptyMessage="No priorities in data"
            onSelect={onFacetSelect}
          />
        );

      case 'Tags':
        return (
          <FacetList
            data={tags}
            field="tags"
            emptyMessage="No tags in data"
            onSelect={onFacetSelect}
          />
        );

      case 'Time':
        return <TimeRangeFilter dateRange={dateRange} onSelect={onTimeSelect} />;

      default:
        return null;
    }
  };

  return (
    <div className={`mt-2 p-2 ${containerStyles}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium">{activePanel}</span>
        <button onClick={onClose} className={`p-0.5 ${closeButtonStyles}`}>
          <X className="w-3 h-3" />
        </button>
      </div>
      {renderContent()}
    </div>
  );
}

export default FilterPanel;
