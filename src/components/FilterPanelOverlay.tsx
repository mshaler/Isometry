import { useFilters } from '@/state/FilterContext';
import { useFilterPreview } from '@/hooks/useFilterPreview';
import { LATCHFilter } from './LATCHFilter';

/**
 * FilterPanelOverlay - LATCH filter control panel for overlay
 *
 * Displays 5 filter sections (one per LATCH axis) with preview/apply pattern.
 * User adjusts filters, sees real-time preview count, then applies or cancels.
 *
 * Architecture:
 * - Each LATCH axis gets its own control section
 * - Preview filters stored separately from active filters
 * - Real-time preview count shows "N notes match these filters" (debounced 300ms)
 * - Apply button commits preview to active filters
 * - Cancel button discards preview
 * - Clear All button resets all preview filters
 *
 * LATCH Axes:
 * - Location: Bounding box or text input (MVP: text input)
 * - Alphabet: Text search with prefix matching
 * - Time: Date range picker
 * - Category: Multi-select dropdown
 * - Hierarchy: Parent/child selector (MVP: text input)
 */

interface FilterPanelOverlayProps {
  onApply: () => void;
  onCancel: () => void;
}

export function FilterPanelOverlay({
  onApply,
  onCancel,
}: FilterPanelOverlayProps) {
  const { previewFilters, clearPreviewFilters } = useFilters();
  const { count, isLoading } = useFilterPreview(previewFilters);

  if (!previewFilters) {
    return null;
  }

  return (
    <div
      className="bg-white rounded-lg shadow-2xl border border-gray-300"
      style={{
        width: '600px',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Filter Controls</h2>
        <p className="text-sm text-gray-500 mt-1">
          Adjust LATCH filters to narrow down your notes
        </p>
      </div>

      {/* Filter Sections - Scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Location Filter */}
        <LATCHFilter
          axis="location"
          label="Location"
          description="Filter by geographic location or city name"
        />

        {/* Alphabet Filter */}
        <LATCHFilter
          axis="alphabet"
          label="Alphabet"
          description="Search by title or content"
        />

        {/* Time Filter */}
        <LATCHFilter
          axis="time"
          label="Time"
          description="Filter by date range"
        />

        {/* Category Filter */}
        <LATCHFilter
          axis="category"
          label="Category"
          description="Filter by tags, folders, or status"
        />

        {/* Hierarchy Filter */}
        <LATCHFilter
          axis="hierarchy"
          label="Hierarchy"
          description="Filter by parent/child relationships"
        />
      </div>

      {/* Footer - Preview Count + Actions */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        {/* Preview Count */}
        <div className="text-sm text-gray-600 mb-3">
          {isLoading ? (
            <span className="text-gray-400">Calculating...</span>
          ) : count !== null ? (
            <>
              <span className="font-medium">{count.toLocaleString()}</span>{' '}
              {count === 1 ? 'note matches' : 'notes match'} these filters
            </>
          ) : (
            <span className="text-gray-400">Adjust filters to see preview</span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={clearPreviewFilters}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
          >
            Clear All
          </button>

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onApply}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
