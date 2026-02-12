/**
 * DraggablePropertyChip Component
 *
 * Visual representation of a property that can be dragged to PAFV planes.
 * Displays visual distinction for dynamic properties discovered from node_properties table.
 */

import { useDrag } from 'react-dnd';
import { GripVertical, Sparkles } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import type { ClassifiedProperty, PropertyBucket } from '@/services/property-classifier';

// ============================================================================
// Constants
// ============================================================================

const PAFV_ITEM_TYPE = 'PAFV_CHIP';

// ============================================================================
// Types
// ============================================================================

export interface DragItem {
  id: string;
  name: string;
  bucket: PropertyBucket;
  sourceColumn: string;
  sourceWell: 'available' | 'x' | 'y' | 'z';
}

export interface DraggablePropertyChipProps {
  property: ClassifiedProperty;
  sourceWell: 'available' | 'x' | 'y' | 'z';
}

// ============================================================================
// Component
// ============================================================================

export function DraggablePropertyChip({ property, sourceWell }: DraggablePropertyChipProps) {
  const { theme } = useTheme();
  const isNeXTSTEP = theme === 'NeXTSTEP';

  const [{ isDragging }, drag] = useDrag(() => ({
    type: PAFV_ITEM_TYPE,
    item: {
      id: property.id,
      name: property.name,
      bucket: property.bucket,
      sourceColumn: property.sourceColumn,
      sourceWell,
    } as DragItem,
    canDrag: property.bucket !== 'GRAPH',
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [property, sourceWell]);

  const isGraph = property.bucket === 'GRAPH';
  const isDynamic = property.isDynamic ?? false;
  const nodeCount = property.nodeCount ?? 0;

  return (
    <div
      ref={isGraph ? undefined : drag}
      className={`
        flex items-center gap-1.5 h-7 px-2 rounded text-[11px]
        ${isDynamic ? 'border border-dashed' : ''}
        ${isGraph ? 'cursor-not-allowed opacity-50' : 'cursor-grab active:cursor-grabbing'}
        ${isDragging ? 'opacity-40 scale-95' : ''}
        transition-all
        ${isNeXTSTEP
          ? 'bg-[#3A3A3A] hover:bg-[#454545]'
          : 'bg-white border border-gray-200 hover:bg-gray-50'
        }
      `}
      title={isGraph ? 'GRAPH properties not yet supported' : property.name}
    >
      {isDynamic && (
        <Sparkles className={`w-3 h-3 flex-shrink-0 ${
          isNeXTSTEP ? 'text-yellow-400' : 'text-yellow-500'
        }`} />
      )}
      {!isGraph && !isDynamic && (
        <GripVertical className={`w-3 h-3 flex-shrink-0 ${
          isNeXTSTEP ? 'text-[#666]' : 'text-gray-400'
        }`} />
      )}
      <span className={`truncate flex-1 ${isNeXTSTEP ? 'text-[#E0E0E0]' : 'text-gray-700'}`}>
        {property.name}
      </span>
      {isDynamic && nodeCount > 0 && (
        <span className={`text-[9px] opacity-60 ml-auto ${
          isNeXTSTEP ? 'text-[#999]' : 'text-gray-400'
        }`}>
          {nodeCount}
        </span>
      )}
    </div>
  );
}
