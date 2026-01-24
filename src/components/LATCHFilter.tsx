import { useState } from 'react';
import { useFilters } from '@/state/FilterContext';
import type { FilterState } from '@/types/filter';
import { LocationMapWidget } from './LocationMapWidget';
import { HierarchyTreeView } from '@/components/HierarchyTreeView';
import { CategoryColorPicker } from './CategoryColorPicker';
import { useNodes, useSQLiteQuery } from '@/hooks/useSQLiteQuery';
import { useNodeTree } from '@/hooks/useNodeTree';
import { useMapMarkers } from '@/hooks/useMapMarkers';
import { useAllTags } from '@/hooks/useTagColors';

/**
 * LATCHFilter - Individual axis filter component
 *
 * Renders appropriate control type for each LATCH axis:
 * - Location: Text input for city name (MVP - defer map UI to Wave 4)
 * - Alphabet: Text search input with prefix matching
 * - Time: Two date inputs for start/end range
 * - Category: Multi-select checkboxes for tags/folders
 * - Hierarchy: Text input for parent ID (MVP - defer tree UI to Wave 4)
 *
 * Complex UIs (map widget, tree view) are Wave 4 enhancements.
 * For MVP, we use simple text/date inputs.
 */

interface LATCHFilterProps {
  axis: keyof Omit<FilterState, 'dsl'>;
  label: string;
  description: string;
}

export function LATCHFilter({ axis, label, description }: LATCHFilterProps) {
  const {
    previewFilters,
    setPreviewLocation,
    setPreviewAlphabet,
    setPreviewTime,
    setPreviewCategory,
    setPreviewHierarchy,
  } = useFilters();

  // For Hierarchy filter: fetch all nodes and NEST edges
  const { data: allNodes } = useNodes('1=1', [], { enabled: axis === 'hierarchy' });
  const { data: nestEdges } = useSQLiteQuery<{ source_id: string; target_id: string }>(
    'SELECT source_id, target_id FROM edges WHERE edge_type = ?',
    ['NEST'],
    { enabled: axis === 'hierarchy' }
  );

  // Build tree for Hierarchy filter
  const tree = useNodeTree(allNodes || [], nestEdges || []);

  // Priority range state for tree view
  const [priorityRange, setPriorityRange] = useState<[number, number]>([1, 10]);

  // For Location filter: fetch all nodes with location data
  const { markers } = useMapMarkers();

  // For Category filter: fetch all unique tags
  const { tags: allTags, tagCounts } = useAllTags();

  if (!previewFilters) return null;

  const currentFilter = previewFilters[axis];

  // Render different controls based on axis
  const renderControl = () => {
    switch (axis) {
      case 'location':
        return (
          <LocationMapWidget
            center={
              currentFilter &&
              'centerLat' in currentFilter &&
              currentFilter.centerLat !== undefined &&
              currentFilter.centerLon !== undefined
                ? { lat: currentFilter.centerLat, lng: currentFilter.centerLon }
                : null
            }
            radiusMeters={
              currentFilter && 'radiusKm' in currentFilter && currentFilter.radiusKm
                ? currentFilter.radiusKm * 1000
                : 5000
            }
            onChange={(center, radiusMeters) => {
              setPreviewLocation({
                type: 'radius',
                centerLat: center.lat,
                centerLon: center.lng,
                radiusKm: radiusMeters / 1000,
              });
            }}
            markers={markers}
          />
        );

      case 'alphabet':
        return (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Search titles and content..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={
                currentFilter && 'value' in currentFilter
                  ? currentFilter.value
                  : ''
              }
              onChange={(e) => {
                const value = e.target.value;
                if (!value) {
                  setPreviewAlphabet(null);
                } else {
                  setPreviewAlphabet({
                    type: 'search',
                    value,
                  });
                }
              }}
            />
            <div className="text-xs text-gray-500 space-y-1">
              <p className="font-medium">FTS5 full-text search with operators:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li><code className="bg-gray-100 px-1 rounded">test*</code> - prefix search</li>
                <li><code className="bg-gray-100 px-1 rounded">"exact phrase"</code> - phrase match</li>
                <li><code className="bg-gray-100 px-1 rounded">foo AND bar</code> - both terms</li>
                <li><code className="bg-gray-100 px-1 rounded">foo OR bar</code> - either term</li>
                <li><code className="bg-gray-100 px-1 rounded">foo NOT bar</code> - exclude term</li>
              </ul>
            </div>
          </div>
        );

      case 'time':
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={
                    currentFilter && 'start' in currentFilter
                      ? currentFilter.start || ''
                      : ''
                  }
                  onChange={(e) => {
                    const start = e.target.value;
                    const end =
                      currentFilter && 'end' in currentFilter
                        ? currentFilter.end
                        : undefined;
                    if (!start && !end) {
                      setPreviewTime(null);
                    } else {
                      setPreviewTime({
                        type: 'range',
                        field: 'created',
                        start,
                        end,
                      });
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={
                    currentFilter && 'end' in currentFilter
                      ? currentFilter.end || ''
                      : ''
                  }
                  onChange={(e) => {
                    const end = e.target.value;
                    const start =
                      currentFilter && 'start' in currentFilter
                        ? currentFilter.start
                        : undefined;
                    if (!start && !end) {
                      setPreviewTime(null);
                    } else {
                      setPreviewTime({
                        type: 'range',
                        field: 'created',
                        start,
                        end,
                      });
                    }
                  }}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Filter by creation date (future: modified, due dates)
            </p>
          </div>
        );

      case 'category':
        return (
          <CategoryColorPicker
            tags={allTags}
            selectedTags={
              currentFilter && 'tags' in currentFilter && currentFilter.tags
                ? new Set(currentFilter.tags)
                : new Set()
            }
            onSelectedTagsChange={(tags) => {
              if (tags.size === 0) {
                setPreviewCategory(null);
              } else {
                setPreviewCategory({
                  type: 'include',
                  tags: Array.from(tags),
                });
              }
            }}
            tagCounts={tagCounts}
          />
        );

      case 'hierarchy':
        return (
          <HierarchyTreeView
            tree={tree}
            selectedIds={
              currentFilter && 'subtreeRoots' in currentFilter
                ? currentFilter.subtreeRoots || []
                : []
            }
            onSelectionChange={(ids) => {
              if (ids.length === 0) {
                // No selection: clear filter or use priority-only
                if (priorityRange[0] === 1 && priorityRange[1] === 10) {
                  setPreviewHierarchy(null);
                } else {
                  setPreviewHierarchy({
                    type: 'range',
                    minPriority: priorityRange[0],
                    maxPriority: priorityRange[1],
                  });
                }
              } else {
                // Subtree selection with priority range
                setPreviewHierarchy({
                  type: 'subtree',
                  subtreeRoots: ids,
                  minPriority: priorityRange[0],
                  maxPriority: priorityRange[1],
                });
              }
            }}
            priorityRange={priorityRange}
            onPriorityRangeChange={(range) => {
              setPriorityRange(range);
              // Update filter with new priority range
              const subtreeRoots =
                currentFilter && 'subtreeRoots' in currentFilter
                  ? currentFilter.subtreeRoots
                  : undefined;

              if (subtreeRoots && subtreeRoots.length > 0) {
                setPreviewHierarchy({
                  type: 'subtree',
                  subtreeRoots,
                  minPriority: range[0],
                  maxPriority: range[1],
                });
              } else if (range[0] !== 1 || range[1] !== 10) {
                setPreviewHierarchy({
                  type: 'range',
                  minPriority: range[0],
                  maxPriority: range[1],
                });
              } else {
                setPreviewHierarchy(null);
              }
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
        <p className="text-xs text-gray-600 mt-0.5">{description}</p>
      </div>
      {renderControl()}
    </div>
  );
}
