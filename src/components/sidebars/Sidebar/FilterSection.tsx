/**
 * FilterSection Component
 *
 * Collapsible filter category section with items.
 * Extracted from Sidebar.tsx lines 342-377.
 */

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

// ============================================
// Types
// ============================================

export interface FilterSectionProps {
  title: string;
  items: string[];
  expanded: boolean;
  activeItem: string | null;
  availableFilters: string[];
  onToggle: () => void;
  onItemClick: (item: string) => void;
}

// ============================================
// Component
// ============================================

export function FilterSection({
  title,
  items,
  expanded,
  activeItem,
  availableFilters,
  onToggle,
  onItemClick,
}: FilterSectionProps) {
  const { theme } = useTheme();

  const headerStyles =
    theme === 'NeXTSTEP'
      ? 'bg-[#a8a8a8] border-t-2 border-l-2 border-[#c8c8c8] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050]'
      : 'bg-gray-100 hover:bg-gray-200 rounded-lg';

  const getItemStyles = (item: string) => {
    const isActive = activeItem === item;
    const isFilterable = availableFilters.includes(item);

    if (isActive) {
      return theme === 'NeXTSTEP'
        ? 'bg-black text-white'
        : 'bg-blue-500 text-white rounded-md';
    }

    return theme === 'NeXTSTEP'
      ? `bg-[#d4d4d4] border border-[#a0a0a0] hover:bg-black hover:text-white ${
          !isFilterable ? 'opacity-60' : ''
        }`
      : `bg-white hover:bg-blue-500 hover:text-white rounded-md border border-gray-200 ${
          !isFilterable ? 'opacity-60' : ''
        }`;
  };

  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className={`w-full h-8 px-2 flex items-center gap-2 ${headerStyles}`}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        <span className="font-medium text-sm">{title}</span>
      </button>

      {expanded && (
        <div className="mt-1 ml-2 space-y-0.5">
          {items.map((item) => (
            <button
              key={item}
              onClick={() => onItemClick(item)}
              className={`w-full h-7 px-3 text-left text-sm ${getItemStyles(item)}`}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default FilterSection;
