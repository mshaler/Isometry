/**
 * PlaneDropZone Component
 *
 * A drop zone that accepts dragged facets and maps them to PAFV planes.
 * Supports stacked axes (multiple mappings per plane) with within-well reordering.
 * Converts LATCH bucket to LATCHAxis and calls setMapping on the PAFV context.
 */

import { useRef } from 'react';
import { useDrop, useDrag } from 'react-dnd';
import { X, GripVertical } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { usePAFV } from '@/state/PAFVContext';
import type { Plane, AxisMapping } from '@/types/pafv';
import {
  FACET_ITEM_TYPE,
  WELL_CHIP_ITEM_TYPE,
  BUCKET_TO_AXIS,
  type DraggedFacetItem,
  type DraggedWellChipItem,
} from './types';

// ============================================================================
// Props
// ============================================================================

export interface PlaneDropZoneProps {
  /** The plane this drop zone represents (x, y, color, size, shape) */
  plane: Plane;
  /** Current axis mapping for this plane, if any (legacy single-mapping support) */
  currentMapping?: AxisMapping | null;
}

// ============================================================================
// WellChip - Draggable chip within a well
// ============================================================================

interface WellChipProps {
  mapping: AxisMapping;
  index: number;
  plane: Plane;
  onRemove: () => void;
  isOnly: boolean;
}

function WellChip({ mapping, index, plane, onRemove, isOnly }: WellChipProps) {
  const { theme } = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const { reorderMappingsInPlane } = usePAFV();

  const isNeXTSTEP = theme === 'NeXTSTEP';

  // Drag source for reordering
  const [{ isDragging }, drag, preview] = useDrag({
    type: WELL_CHIP_ITEM_TYPE,
    item: (): DraggedWellChipItem => ({
      index,
      plane,
      facet: mapping.facet,
      axis: mapping.axis,
    }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Drop target for reordering within same well
  const [{ isOver }, drop] = useDrop({
    accept: WELL_CHIP_ITEM_TYPE,
    hover: (item: DraggedWellChipItem, monitor) => {
      if (!ref.current) return;
      // Only accept from same plane
      if (item.plane !== plane) return;

      const dragIndex = item.index;
      const hoverIndex = index;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) return;

      // Determine rectangle on screen
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      // Get vertical middle
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      // Get mouse position
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      // Get pixels to top
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      // Only perform move when mouse crosses half of item's height
      // Dragging downward: only move when cursor below 50%
      // Dragging upward: only move when cursor above 50%
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      // Perform the move
      reorderMappingsInPlane(plane, dragIndex, hoverIndex);

      // Update the item's index for subsequent hovers
      item.index = hoverIndex;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  // Connect both drag and drop to same ref
  drag(drop(ref));
  preview(ref);

  // Capitalize first letter for display
  const capitalizeFirst = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // Theme-aware chip styling
  const chipClasses = `
    flex items-center justify-between px-2 py-1.5 text-sm gap-1
    ${isNeXTSTEP
      ? 'bg-[#d4d4d4] border-t border-l border-[#ffffff] border-b border-r border-b-[#707070] border-r-[#707070]'
      : 'bg-white rounded-md border border-gray-200 shadow-sm'
    }
    ${isDragging ? 'opacity-50' : ''}
    ${isOver ? (isNeXTSTEP ? 'bg-[#c4d4c4]' : 'bg-blue-50 border-blue-300') : ''}
    transition-colors cursor-grab active:cursor-grabbing
  `;

  const removeButtonClasses = `
    p-0.5 transition-colors
    ${isNeXTSTEP
      ? 'hover:bg-[#c0c0c0]'
      : 'hover:bg-gray-100 rounded'
    }
  `;

  return (
    <div
      ref={ref}
      className={chipClasses.trim().replace(/\s+/g, ' ')}
    >
      {/* Grip handle - only show if not the only chip */}
      {!isOnly && (
        <GripVertical className={`w-3.5 h-3.5 flex-shrink-0 ${isNeXTSTEP ? 'text-[#606060]' : 'text-gray-400'}`} />
      )}
      <span className="truncate flex-1">
        {capitalizeFirst(mapping.axis)}
        {mapping.facet && (
          <span className="text-gray-500 ml-1">
            ({mapping.facet})
          </span>
        )}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className={removeButtonClasses.trim().replace(/\s+/g, ' ')}
        title={`Remove ${plane} mapping`}
        type="button"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ============================================================================
// PlaneDropZone Component
// ============================================================================

export function PlaneDropZone({ plane, currentMapping }: PlaneDropZoneProps) {
  const { theme } = useTheme();
  const { removeFacetFromPlane, getMappingsForPlane, addMappingToPlane } = usePAFV();

  const isNeXTSTEP = theme === 'NeXTSTEP';

  // Get all mappings for this plane (stacked axes)
  const planeMappings = getMappingsForPlane(plane);

  // Fallback to currentMapping for backward compatibility
  const mappings = planeMappings.length > 0
    ? planeMappings
    : currentMapping
      ? [currentMapping]
      : [];

  const [{ isOver, canDrop, isInvalid }, drop] = useDrop({
    accept: [FACET_ITEM_TYPE, WELL_CHIP_ITEM_TYPE],
    drop: (item: DraggedFacetItem | DraggedWellChipItem, monitor) => {
      // Handle well chip from another plane (move between wells)
      if (monitor.getItemType() === WELL_CHIP_ITEM_TYPE) {
        const wellChip = item as DraggedWellChipItem;
        // If from same plane, reordering is handled by WellChip hover
        if (wellChip.plane === plane) return;

        // Moving from another plane - remove from source, add to target
        removeFacetFromPlane(wellChip.plane as Plane, wellChip.facet);
        const mapping: AxisMapping = {
          plane,
          axis: wellChip.axis as AxisMapping['axis'],
          facet: wellChip.facet,
        };
        addMappingToPlane(mapping);
        return;
      }

      // Handle facet from LATCH bucket
      const facetItem = item as DraggedFacetItem;

      // GRAPH facets are not yet supported for axis mapping
      if (facetItem.bucket === 'GRAPH') {
        console.log('GRAPH facets not yet supported for axis mapping');
        return;
      }

      // Map the single-letter bucket to full axis name
      const axis = BUCKET_TO_AXIS[facetItem.bucket];

      // Create the axis mapping
      const mapping: AxisMapping = {
        plane,
        axis,
        facet: facetItem.sourceColumn,
      };

      // Use addMappingToPlane for stacking (multiple facets on same plane)
      addMappingToPlane(mapping);
    },
    canDrop: (item: DraggedFacetItem | DraggedWellChipItem, monitor) => {
      if (monitor.getItemType() === WELL_CHIP_ITEM_TYPE) {
        return true; // Well chips can always be moved/reordered
      }
      const facetItem = item as DraggedFacetItem;
      // Only LATCH facets can be dropped (not GRAPH)
      return facetItem.bucket !== 'GRAPH';
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
      isInvalid: monitor.isOver({ shallow: true }) && !monitor.canDrop(),
    }),
  });

  // Handle remove button click for a specific mapping
  const handleRemove = (facet: string) => {
    removeFacetFromPlane(plane, facet);
  };

  // Capitalize first letter for display
  const capitalizeFirst = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // Theme-aware container styling - flexible height for stacked axes
  const containerClasses = `
    min-h-12 max-h-72 p-3 flex flex-col gap-2 transition-colors flex-grow overflow-y-auto
    ${isNeXTSTEP
      ? 'bg-[#a0a0a0] border-t-2 border-l-2 border-[#606060] border-b-2 border-r-2 border-r-[#d0d0d0] border-b-[#d0d0d0]'
      : 'bg-gray-50 border border-gray-300 rounded-lg'
    }
    ${isOver && canDrop
      ? isNeXTSTEP
        ? 'bg-[#90a090]'
        : 'bg-blue-50 border-blue-300'
      : ''
    }
    ${isInvalid
      ? isNeXTSTEP
        ? 'bg-[#c08080] border-[#a04040]'
        : 'bg-red-50 border-red-400'
      : ''
    }
  `;

  // Theme-aware label styling
  const labelClasses = `
    text-[10px] font-medium uppercase tracking-wide
    ${isNeXTSTEP ? 'text-[#404040]' : 'text-gray-500'}
  `;

  // Theme-aware placeholder styling
  const placeholderClasses = `
    text-xs flex items-center justify-center h-full
    ${isNeXTSTEP ? 'text-[#707070]' : 'text-gray-400'}
  `;

  return (
    <div className="flex-1 min-w-0">
      <div className={labelClasses.trim().replace(/\s+/g, ' ')}>
        {capitalizeFirst(plane)}
      </div>
      <div
        ref={drop}
        className={containerClasses.trim().replace(/\s+/g, ' ')}
      >
        {mappings.length > 0 ? (
          <div className="space-y-1">
            {mappings.map((mapping, index) => (
              <WellChip
                key={`${mapping.axis}-${mapping.facet}`}
                mapping={mapping}
                index={index}
                plane={plane}
                onRemove={() => handleRemove(mapping.facet)}
                isOnly={mappings.length === 1}
              />
            ))}
          </div>
        ) : (
          <div className={placeholderClasses.trim().replace(/\s+/g, ' ')}>
            Drop facet here
          </div>
        )}
      </div>
    </div>
  );
}
