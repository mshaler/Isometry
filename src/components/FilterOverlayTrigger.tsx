import { useState } from 'react';
import { Filter as FilterIcon } from 'lucide-react';
import { useFilters } from '@/state/FilterContext';
import { OverlayControls } from './OverlayControls';
import { FilterPanelOverlay } from './FilterPanelOverlay';

/**
 * FilterOverlayTrigger - Integration component for overlay controls
 *
 * Provides:
 * - Trigger button for MiniNav (with active filter badge)
 * - State management for overlay open/close
 * - Preview initialization and cleanup
 * - Apply/Cancel handler integration
 *
 * Usage in MiniNav:
 * ```tsx
 * <FilterOverlayTrigger />
 * ```
 *
 * Architecture:
 * - Trigger button at z=1 (DENSITY layer - MiniNav)
 * - Overlay controls at z=2 (OVERLAY layer)
 * - Preview filters separate from active filters
 * - Apply commits preview to active
 * - Cancel discards preview
 */

export function FilterOverlayTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    activeCount,
    startPreview,
    applyPreviewFilters,
    cancelPreview,
  } = useFilters();

  const handleOpen = () => {
    startPreview(); // Initialize preview with current active filters
    setIsOpen(true);
  };

  const handleClose = () => {
    cancelPreview(); // Discard preview
    setIsOpen(false);
  };

  const handleApply = () => {
    applyPreviewFilters(); // Commit preview to active filters
    setIsOpen(false);
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={handleOpen}
        className="relative px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors flex items-center gap-2"
        title="Open filter controls"
      >
        <FilterIcon className="w-4 h-4" />
        <span>Filters</span>
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-xs font-semibold rounded-full flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {/* Overlay Controls */}
      <OverlayControls isOpen={isOpen} onClose={handleClose}>
        <FilterPanelOverlay onApply={handleApply} onCancel={handleClose} />
      </OverlayControls>
    </>
  );
}
