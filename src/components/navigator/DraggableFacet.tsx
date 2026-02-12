/**
 * DraggableFacet Component
 *
 * A draggable facet chip that can be dropped onto plane wells.
 * Preserves full ClassifiedProperty metadata through the drag operation.
 */

import { useDrag } from 'react-dnd';
import { useTheme } from '@/contexts/ThemeContext';
import type { ClassifiedProperty } from '@/services/property-classifier';
import { FACET_ITEM_TYPE, type DraggedFacetItem } from './types';

// ============================================================================
// Props
// ============================================================================

export interface DraggableFacetProps {
  /** The classified property to render as a draggable chip */
  property: ClassifiedProperty;
  /** If true, the chip is visible but not draggable (used for GRAPH facets in MVP) */
  disabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function DraggableFacet({ property, disabled = false }: DraggableFacetProps) {
  const { theme } = useTheme();

  // Create the drag item with all property metadata
  const dragItem: DraggedFacetItem = {
    id: property.id,
    name: property.name,
    bucket: property.bucket,
    sourceColumn: property.sourceColumn,
    facetType: property.facetType,
  };

  const [{ isDragging }, drag] = useDrag({
    type: FACET_ITEM_TYPE,
    item: dragItem,
    canDrag: !disabled,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Theme-aware styling with transitions
  const baseClasses = `
    flex items-center gap-1.5 h-7 px-2.5 text-xs w-full
    transition-all duration-200 ease-in-out
    ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-move hover:scale-[1.02]'}
    ${isDragging ? 'opacity-50 scale-95' : ''}
  `;

  const themeClasses =
    theme === 'NeXTSTEP'
      ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070]'
      : 'bg-white hover:bg-gray-50 rounded-md border border-gray-300';

  return (
    <div
      ref={disabled ? undefined : drag}
      className={`${baseClasses} ${themeClasses}`.trim().replace(/\s+/g, ' ')}
      title={disabled ? 'GRAPH facets are not yet supported for axis mapping' : property.name}
    >
      <span className="truncate">{property.name}</span>
    </div>
  );
}
