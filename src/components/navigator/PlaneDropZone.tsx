/**
 * PlaneDropZone Component
 *
 * A drop zone that accepts dragged facets and maps them to PAFV planes.
 * Converts LATCH bucket to LATCHAxis and calls setMapping on the PAFV context.
 */

import { useDrop } from 'react-dnd';
import { X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { usePAFV } from '@/state/PAFVContext';
import type { Plane, AxisMapping } from '@/types/pafv';
import { FACET_ITEM_TYPE, BUCKET_TO_AXIS, type DraggedFacetItem } from './types';

// ============================================================================
// Props
// ============================================================================

export interface PlaneDropZoneProps {
  /** The plane this drop zone represents (x, y, color, size, shape) */
  plane: Plane;
  /** Current axis mapping for this plane, if any */
  currentMapping: AxisMapping | null;
}

// ============================================================================
// Component
// ============================================================================

export function PlaneDropZone({ plane, currentMapping }: PlaneDropZoneProps) {
  const { theme } = useTheme();
  const { setMapping, removeMapping } = usePAFV();

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: FACET_ITEM_TYPE,
    drop: (item: DraggedFacetItem) => {
      // GRAPH facets are not yet supported for axis mapping
      if (item.bucket === 'GRAPH') {
        console.log('GRAPH facets not yet supported for axis mapping');
        return;
      }

      // Map the single-letter bucket to full axis name
      const axis = BUCKET_TO_AXIS[item.bucket];

      // Create the axis mapping
      const mapping: AxisMapping = {
        plane,
        axis,
        facet: item.sourceColumn,
      };

      setMapping(mapping);
    },
    canDrop: (item: DraggedFacetItem) => {
      // Only LATCH facets can be dropped (not GRAPH)
      return item.bucket !== 'GRAPH';
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  // Handle remove button click
  const handleRemove = () => {
    removeMapping(plane);
  };

  // Capitalize first letter for display
  const capitalizeFirst = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // Theme-aware container styling
  const containerClasses = `
    min-h-[80px] p-3 flex flex-col gap-2 transition-colors
    ${theme === 'NeXTSTEP'
      ? 'bg-[#a0a0a0] border-t-2 border-l-2 border-[#606060] border-b-2 border-r-2 border-r-[#d0d0d0] border-b-[#d0d0d0]'
      : 'bg-gray-50 border border-gray-300 rounded-lg'
    }
    ${isOver && canDrop
      ? theme === 'NeXTSTEP'
        ? 'bg-[#90a090]'
        : 'bg-blue-50 border-blue-300'
      : ''
    }
  `;

  // Theme-aware label styling
  const labelClasses = `
    text-[10px] font-medium uppercase tracking-wide
    ${theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-500'}
  `;

  // Theme-aware placeholder styling
  const placeholderClasses = `
    text-xs flex items-center justify-center h-full
    ${theme === 'NeXTSTEP' ? 'text-[#707070]' : 'text-gray-400'}
  `;

  // Theme-aware mapped facet styling
  const mappedFacetClasses = `
    flex items-center justify-between px-2 py-1.5 text-sm
    ${theme === 'NeXTSTEP'
      ? 'bg-[#d4d4d4] border-t border-l border-[#ffffff] border-b border-r border-b-[#707070] border-r-[#707070]'
      : 'bg-white rounded-md border border-gray-200 shadow-sm'
    }
  `;

  // Theme-aware remove button styling
  const removeButtonClasses = `
    p-0.5 transition-colors
    ${theme === 'NeXTSTEP'
      ? 'hover:bg-[#c0c0c0]'
      : 'hover:bg-gray-100 rounded'
    }
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
        {currentMapping ? (
          <div className={mappedFacetClasses.trim().replace(/\s+/g, ' ')}>
            <span className="truncate">
              {capitalizeFirst(currentMapping.axis)}
              {currentMapping.facet && (
                <span className="text-gray-500 ml-1">
                  ({currentMapping.facet})
                </span>
              )}
            </span>
            <button
              onClick={handleRemove}
              className={removeButtonClasses.trim().replace(/\s+/g, ' ')}
              title={`Remove ${plane} mapping`}
              type="button"
            >
              <X className="w-3.5 h-3.5" />
            </button>
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
