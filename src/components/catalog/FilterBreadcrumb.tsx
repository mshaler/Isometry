/**
 * FilterBreadcrumb - Visual representation of active LATCH filters
 *
 * Shows the current filter state as a navigable breadcrumb trail.
 * Users can click segments to navigate/remove filters, or clear all.
 *
 * Uses the LATCH filter model:
 * - activeFilters.category (folders, tags, statuses)
 * - activeFilters.alphabet (search/text filters)
 * - activeFilters.time (date range filters)
 * - activeFilters.hierarchy (priority filters)
 * - activeFilters.location (geo filters)
 *
 * @see Phase 79-03: Catalog Browser - Breadcrumb Navigation
 */
import React, { useCallback, useMemo } from 'react';
import { ChevronRight, X, Home } from 'lucide-react';
import { useFilters } from '../../state/FilterContext';
import { cn } from '../../lib/utils';

/**
 * Represents a single breadcrumb segment
 */
interface BreadcrumbSegment {
  type: 'folder' | 'tag' | 'status' | 'search' | 'time' | 'hierarchy' | 'location';
  value: string;
  label: string;
}

/**
 * FilterBreadcrumb Component
 *
 * Displays active filters as clickable breadcrumb segments.
 * - Folder segments navigate to that folder level (removes deeper paths)
 * - Other segments can be removed by clicking
 * - Clear all button resets to default state
 * - Empty state shows "All Cards"
 */
export function FilterBreadcrumb() {
  const { activeFilters, setCategory, clearAll } = useFilters();

  // Build breadcrumb segments from active LATCH filters
  const segments = useMemo<BreadcrumbSegment[]>(() => {
    const result: BreadcrumbSegment[] = [];

    // Category filters: folders, tags, statuses
    if (activeFilters.category) {
      const { folders, tags, statuses } = activeFilters.category;

      // Folder path segments (first folder only, split by path)
      if (folders && folders.length > 0) {
        // Take first folder and split into path segments
        const folder = folders[0];
        const parts = folder.split('/');
        let path = '';
        parts.forEach(part => {
          path = path ? `${path}/${part}` : part;
          result.push({
            type: 'folder',
            value: path,
            label: part
          });
        });

        // Additional folders shown as separate segments
        if (folders.length > 1) {
          folders.slice(1).forEach(f => {
            result.push({
              type: 'folder',
              value: f,
              label: `+${f.split('/').pop() || f}`
            });
          });
        }
      }

      // Status filter
      if (statuses && statuses.length > 0) {
        statuses.forEach(status => {
          result.push({
            type: 'status',
            value: status,
            label: `Status: ${status}`
          });
        });
      }

      // Tags (show first 3, then count)
      if (tags && tags.length > 0) {
        tags.slice(0, 3).forEach(tag => {
          result.push({
            type: 'tag',
            value: tag,
            label: `#${tag}`
          });
        });
        if (tags.length > 3) {
          result.push({
            type: 'tag',
            value: '__more__',
            label: `+${tags.length - 3} more`
          });
        }
      }
    }

    // Alphabet filter (search/text)
    if (activeFilters.alphabet) {
      const { value, type } = activeFilters.alphabet;
      if (value) {
        result.push({
          type: 'search',
          value: value,
          label: type === 'search' ? `"${value}"` : `${type}: ${value}`
        });
      }
    }

    // Time filter
    if (activeFilters.time) {
      const { preset, start, end, field } = activeFilters.time;
      let label = '';
      if (preset) {
        label = `${field}: ${preset}`;
      } else if (start && end) {
        label = `${field}: ${start} - ${end}`;
      } else if (start) {
        label = `${field}: from ${start}`;
      } else if (end) {
        label = `${field}: until ${end}`;
      }
      if (label) {
        result.push({
          type: 'time',
          value: preset || `${start}-${end}`,
          label
        });
      }
    }

    // Hierarchy filter
    if (activeFilters.hierarchy) {
      const { type, minPriority, maxPriority, limit } = activeFilters.hierarchy;
      let label = '';
      if (type === 'priority' && (minPriority !== undefined || maxPriority !== undefined)) {
        if (minPriority !== undefined && maxPriority !== undefined) {
          label = `Priority: ${minPriority}-${maxPriority}`;
        } else if (minPriority !== undefined) {
          label = `Priority >= ${minPriority}`;
        } else if (maxPriority !== undefined) {
          label = `Priority <= ${maxPriority}`;
        }
      } else if (type === 'top-n' && limit) {
        label = `Top ${limit}`;
      }
      if (label) {
        result.push({
          type: 'hierarchy',
          value: String(minPriority || maxPriority || limit),
          label
        });
      }
    }

    // Location filter
    if (activeFilters.location) {
      const { type } = activeFilters.location;
      result.push({
        type: 'location',
        value: type,
        label: `Location: ${type}`
      });
    }

    return result;
  }, [activeFilters]);

  // Handle segment click - navigate or remove filter
  const handleSegmentClick = useCallback((segment: BreadcrumbSegment) => {
    switch (segment.type) {
      case 'folder':
        // Navigate to this folder level (replaces folder filter)
        if (activeFilters.category) {
          setCategory({
            ...activeFilters.category,
            folders: [segment.value]
          });
        } else {
          setCategory({
            type: 'include',
            folders: [segment.value]
          });
        }
        break;

      case 'status':
        // Remove this status from filter
        if (activeFilters.category?.statuses) {
          const newStatuses = activeFilters.category.statuses.filter(s => s !== segment.value);
          setCategory({
            ...activeFilters.category,
            statuses: newStatuses.length > 0 ? newStatuses : undefined
          });
        }
        break;

      case 'tag':
        // Remove this tag (skip if it's the "+N more" placeholder)
        if (segment.value !== '__more__' && activeFilters.category?.tags) {
          const newTags = activeFilters.category.tags.filter(t => t !== segment.value);
          setCategory({
            ...activeFilters.category,
            tags: newTags.length > 0 ? newTags : undefined
          });
        }
        break;

      case 'search':
        // Alphabet filter uses setAlphabet which isn't exposed for partial removal
        // Clear all alphabet filters for now
        // TODO: When setAlphabet is available, use it
        clearAll();
        break;

      case 'time':
      case 'hierarchy':
      case 'location':
        // These don't have partial removal in current API
        // Clear all for now
        clearAll();
        break;
    }
  }, [activeFilters, setCategory, clearAll]);

  // Clear all filters
  const handleClearAll = useCallback(() => {
    clearAll();
  }, [clearAll]);

  // Go home (clear all filters)
  const handleGoHome = useCallback(() => {
    clearAll();
  }, [clearAll]);

  // Empty state - no active filters
  if (segments.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Home className="w-4 h-4" />
        <span>All Cards</span>
      </div>
    );
  }

  return (
    <nav className="flex items-center gap-1 text-sm" aria-label="Filter breadcrumb">
      {/* Home button */}
      <button
        type="button"
        onClick={handleGoHome}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
        title="Clear all filters"
        aria-label="Clear all filters and show all cards"
      >
        <Home className="w-4 h-4" />
      </button>

      {/* Breadcrumb segments */}
      {segments.map((segment, index) => (
        <React.Fragment key={`${segment.type}-${segment.value}-${index}`}>
          <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" aria-hidden="true" />

          <button
            type="button"
            onClick={() => handleSegmentClick(segment)}
            className={cn(
              'px-2 py-1 rounded flex items-center gap-1',
              'hover:bg-gray-100 dark:hover:bg-gray-800',
              'transition-colors',
              segment.type === 'folder' && 'text-blue-600 dark:text-blue-400',
              segment.type === 'tag' && 'text-green-600 dark:text-green-400',
              segment.type === 'status' && 'text-purple-600 dark:text-purple-400',
              segment.type === 'search' && 'text-orange-600 dark:text-orange-400',
              segment.type === 'time' && 'text-cyan-600 dark:text-cyan-400',
              segment.type === 'hierarchy' && 'text-pink-600 dark:text-pink-400',
              segment.type === 'location' && 'text-emerald-600 dark:text-emerald-400'
            )}
            title={`Click to ${segment.type === 'folder' ? 'navigate to' : 'remove'} ${segment.label}`}
            aria-label={`${segment.type === 'folder' ? 'Navigate to' : 'Remove'} ${segment.label}`}
          >
            <span>{segment.label}</span>
            {segment.type !== 'folder' && segment.value !== '__more__' && (
              <X className="w-3 h-3 opacity-50 hover:opacity-100" aria-hidden="true" />
            )}
          </button>
        </React.Fragment>
      ))}

      {/* Clear all button - show when multiple filters active */}
      {segments.length > 1 && (
        <>
          <span className="mx-2 text-gray-300 dark:text-gray-600" aria-hidden="true">|</span>
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
            aria-label="Clear all active filters"
          >
            Clear all
          </button>
        </>
      )}
    </nav>
  );
}

export default FilterBreadcrumb;
