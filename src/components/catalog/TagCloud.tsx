/**
 * TagCloud Component
 *
 * Tag cloud with weighted sizing based on count distribution.
 * Tags with higher counts appear larger.
 *
 * Phase 79-02: Catalog Browser UI components
 */

import { Tag } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { FacetCount } from '../../hooks/data/useFacetAggregates';

interface TagCloudProps {
  tags: FacetCount[];
  activeTags: string[];
  onTagClick: (tag: string) => void;
}

type TagSize = 'sm' | 'base' | 'lg' | 'xl';

/**
 * Calculate size bucket based on count distribution.
 * Uses normalized ratio between min and max counts.
 */
function calculateSize(
  count: number,
  minCount: number,
  maxCount: number
): TagSize {
  const range = maxCount - minCount;
  const ratio = range > 0 ? (count - minCount) / range : 0.5;

  if (ratio > 0.75) return 'xl';
  if (ratio > 0.5) return 'lg';
  if (ratio > 0.25) return 'base';
  return 'sm';
}

const sizeClasses: Record<TagSize, string> = {
  sm: 'text-xs px-2 py-0.5',
  base: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1',
  xl: 'text-lg px-3.5 py-1.5',
};

export function TagCloud({ tags, activeTags, onTagClick }: TagCloudProps) {
  // Calculate size distribution
  const counts = tags.map((t) => t.count);
  const maxCount = Math.max(...counts, 1);
  const minCount = Math.min(...counts, 1);

  if (tags.length === 0) {
    return (
      <div className="text-sm text-gray-400 italic px-2 py-4">
        No tags found
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map(({ value, count }) => {
        const isActive = activeTags.includes(value);
        const size = calculateSize(count, minCount, maxCount);

        return (
          <button
            key={value}
            onClick={() => onTagClick(value)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border transition-colors',
              sizeClasses[size],
              isActive
                ? 'bg-blue-500 text-white border-blue-600'
                : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
            )}
          >
            <Tag className="w-3 h-3" />
            <span>{value}</span>
            <span className="text-xs opacity-70">({count})</span>
          </button>
        );
      })}
    </div>
  );
}

export default TagCloud;
