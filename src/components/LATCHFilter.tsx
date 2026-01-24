import { useFilters } from '@/state/FilterContext';
import type { FilterState } from '@/types/filter';

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

  if (!previewFilters) return null;

  const currentFilter = previewFilters[axis];

  // Render different controls based on axis
  const renderControl = () => {
    switch (axis) {
      case 'location':
        return (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="City name (e.g., San Francisco)"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={
                currentFilter && 'latitude' in currentFilter
                  ? `${currentFilter.latitude}, ${currentFilter.longitude}`
                  : ''
              }
              onChange={(e) => {
                const value = e.target.value.trim();
                if (!value) {
                  setPreviewLocation(null);
                } else {
                  // For MVP, store as text (future: geocode to lat/lng)
                  // Using placeholder coordinates for now
                  setPreviewLocation({
                    type: 'point',
                    latitude: 0,
                    longitude: 0,
                  });
                }
              }}
            />
            <p className="text-xs text-gray-500">
              Complex location filtering (map widget) coming in Wave 4
            </p>
          </div>
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
                const value = e.target.value.trim();
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
            <p className="text-xs text-gray-500">
              Uses SQLite FTS5 for fast full-text search
            </p>
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
          <div className="space-y-2">
            <div className="space-y-1">
              {['Work', 'Personal', 'Projects', 'Archive'].map((tag) => (
                <label key={tag} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={
                      !!(currentFilter &&
                      'tags' in currentFilter &&
                      currentFilter.tags?.includes(tag))
                    }
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const currentTags =
                        currentFilter && 'tags' in currentFilter
                          ? currentFilter.tags || []
                          : [];

                      const newTags = checked
                        ? [...currentTags, tag]
                        : currentTags.filter((t) => t !== tag);

                      if (newTags.length === 0) {
                        setPreviewCategory(null);
                      } else {
                        setPreviewCategory({
                          type: 'include',
                          tags: newTags,
                        });
                      }
                    }}
                  />
                  {tag}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              Future: Load tags dynamically from database
            </p>
          </div>
        );

      case 'hierarchy':
        return (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Parent node ID or breadcrumb path"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={
                currentFilter && 'minPriority' in currentFilter
                  ? currentFilter.minPriority?.toString() || ''
                  : ''
              }
              onChange={(e) => {
                const value = e.target.value.trim();
                if (!value) {
                  setPreviewHierarchy(null);
                } else {
                  // For MVP, use as priority filter (future: tree navigation)
                  const priority = parseInt(value, 10);
                  if (!isNaN(priority)) {
                    setPreviewHierarchy({
                      type: 'priority',
                      minPriority: priority,
                    });
                  }
                }
              }}
            />
            <p className="text-xs text-gray-500">
              Complex hierarchy UI (tree view) coming in Wave 4
            </p>
          </div>
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
