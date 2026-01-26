/**
 * FacetList Component
 *
 * Renders a list of facet values with counts.
 * Extracted from Sidebar.tsx lines 141-170.
 */

import { useTheme } from '@/contexts/ThemeContext';

// ============================================
// Types
// ============================================

export interface FacetValue {
  value: string;
  count: number;
}

export interface FacetListProps {
  data: FacetValue[] | null | undefined;
  field: string;
  emptyMessage?: string;
  onSelect: (field: string, _value: string) => void;
}

// ============================================
// Component
// ============================================

export function FacetList({
  data,
  field,
  emptyMessage = 'No values available',
  onSelect,
}: FacetListProps) {
  const { theme } = useTheme();

  if (!data || data.length === 0) {
    return <div className="text-xs text-gray-400 p-2">{emptyMessage}</div>;
  }

  const itemStyles =
    theme === 'NeXTSTEP'
      ? 'bg-[#d4d4d4] hover:bg-black hover:text-white'
      : 'bg-white hover:bg-blue-500 hover:text-white rounded';

  const countStyles =
    theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-400';

  return (
    <div className="space-y-1">
      {data
        .filter((item) => item.value)
        .map((item) => (
          <button
            key={item.value}
            onClick={() => onSelect(field, item.value)}
            className={`w-full h-7 px-2 flex items-center justify-between text-sm ${itemStyles}`}
          >
            <span>{item.value}</span>
            <span className={`text-xs ${countStyles}`}>{item.count}</span>
          </button>
        ))}
    </div>
  );
}

export default FacetList;
