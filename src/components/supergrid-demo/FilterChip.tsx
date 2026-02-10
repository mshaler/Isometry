/**
 * Filter chip component for SuperGridDemo
 */

import type { FilterChipProps } from './types';

export function FilterChip({ filter, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
      {filter.label}
      <button
        onClick={onRemove}
        className="ml-2 w-4 h-4 text-blue-600 hover:text-blue-800"
        aria-label="Remove filter"
      >
        ×
      </button>
    </span>
  );
}