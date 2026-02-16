/**
 * PafvNavigator Component
 *
 * 6-column horizontal layout for PAFV axis assignment via drag-and-drop.
 * All columns equal width (16.67%) with consistent two-line titles.
 *
 * Coordinate System (Isometric projection):
 * - X-Plane = Rows (left headers, vertical grouping)
 * - Y-Plane = Columns (top headers, horizontal grouping)
 * - Z-Plane = Depth (layering/stacking)
 *
 * Layout:
 * ┌───────────┬───────────┬───────────┬───────────┬───────────┬───────────┐
 * │ Available │  X-Plane  │  Y-Plane  │  Z-Plane  │ Encoding  │  Density  │
 * │Properties │   Rows    │  Columns  │   Depth   │Color/Size │Sparse/Dens│
 * ├───────────┼───────────┼───────────┼───────────┼───────────┼───────────┤
 * │  [chip]   │  [axis]   │  [axis]   │  [axis]   │  Color:   │  SPARSE   │
 * │  [chip]   │  [axis]   │  [axis]   │  [axis]   │  Size:    │    |||    │
 * │  [chip]   │           │           │           │           │   DENSE   │
 * └───────────┴───────────┴───────────┴───────────┴───────────┴───────────┘
 */

import { useDrag, useDrop } from 'react-dnd';
import { GripVertical, X, MapPin, SortAsc, Clock, Tag, GitBranch } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { usePAFV } from '@/state/PAFVContext';
import { devLogger } from '@/utils/dev-logger';
import { usePropertyClassification } from '@/hooks/data/usePropertyClassification';
import type { Plane, AxisMapping, DensityLevel } from '@/types/pafv';
import type { ClassifiedProperty, LATCHBucket } from '@/services/property-classifier';
import { EncodingDropdown } from './EncodingDropdown';
import { DraggablePropertyChip, type DragItem } from './DraggablePropertyChip';

// ============================================================================
// Constants
// ============================================================================

const PAFV_ITEM_TYPE = 'PAFV_CHIP';

const BUCKET_TO_AXIS: Record<LATCHBucket, AxisMapping['axis']> = {
  L: 'location',
  A: 'alphabet',
  T: 'time',
  C: 'category',
  H: 'hierarchy',
};

/** LATCH axis icons - matches LatchNavigator */
const AXIS_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  location: { icon: <MapPin className="w-3 h-3" />, color: '#22C55E' },
  alphabet: { icon: <SortAsc className="w-3 h-3" />, color: '#3B82F6' },
  time: { icon: <Clock className="w-3 h-3" />, color: '#8B5CF6' },
  category: { icon: <Tag className="w-3 h-3" />, color: '#F59E0B' },
  hierarchy: { icon: <GitBranch className="w-3 h-3" />, color: '#EF4444' },
};

/** Capitalize first letter of each word */
function capitalizeWords(str: string): string {
  return str
    .split(/[_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ============================================================================
// Types
// ============================================================================

// DragItem is now imported from DraggablePropertyChip

// ============================================================================
// AxisChip Component (for assigned axes in wells) - DRAGGABLE & DROPPABLE
// ============================================================================

interface ReorderDragItem extends DragItem {
  index: number;
}

interface AxisChipProps {
  mapping: AxisMapping;
  sourceWell: 'x' | 'y' | 'z';
  index: number;
  onRemove: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  /** Handle cross-plane drops with positional insertion */
  onCrossPlaneDropAtIndex?: (item: ReorderDragItem, targetIndex: number) => void;
}

function AxisChip({ mapping, sourceWell, index, onRemove, onReorder, onCrossPlaneDropAtIndex }: AxisChipProps) {
  const { theme } = useTheme();
  const isNeXTSTEP = theme === 'NeXTSTEP';

  // Make the chip draggable for cross-plane movement AND reordering
  const [{ isDragging }, drag] = useDrag(() => ({
    type: PAFV_ITEM_TYPE,
    item: {
      id: `${mapping.axis}-${mapping.facet}`,
      name: mapping.facet,
      bucket: mapping.axis.charAt(0).toUpperCase(),
      sourceColumn: mapping.facet,
      sourceWell,
      index, // Include index for reordering
    } as ReorderDragItem,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [mapping, sourceWell, index]);

  // Make the chip a drop target for:
  // 1. Reordering within the same well
  // 2. Cross-plane drops with positional insertion (SuperDynamic)
  const [{ isOver, canDrop: canDropHere }, drop] = useDrop(() => ({
    accept: PAFV_ITEM_TYPE,
    hover: (item: ReorderDragItem) => {
      // Same-well reordering: update order on hover
      if (item.sourceWell === sourceWell) {
        if (item.index === index) return;
        onReorder(item.index, index);
        item.index = index;
      }
      // Cross-plane drops handled on drop, not hover
    },
    drop: (item: ReorderDragItem) => {
      // Cross-plane drop: insert at this position
      if (item.sourceWell !== sourceWell && onCrossPlaneDropAtIndex) {
        if (item.bucket === 'GRAPH') return; // Don't accept GRAPH items
        onCrossPlaneDropAtIndex(item, index);
      }
      // Same-well drops already handled via hover
    },
    canDrop: (item: ReorderDragItem) => {
      // Can drop if: same well (reordering) OR different well (cross-plane)
      if (item.bucket === 'GRAPH') return false;
      return true;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [sourceWell, index, onReorder, onCrossPlaneDropAtIndex]);

  // Combine drag and drop refs
  const ref = (node: HTMLDivElement | null) => {
    drag(node);
    drop(node);
  };

  // Visual feedback: different highlight for same-well vs cross-plane drops
  const getDropHighlight = () => {
    if (!isOver || !canDropHere) return '';
    // Cross-plane drop indicator (green glow)
    return 'ring-2 ring-green-400 ring-offset-1 bg-green-50/20';
  };

  // Get axis icon and color
  const axisInfo = AXIS_ICONS[mapping.axis] || { icon: null, color: '#888' };

  return (
    <div
      ref={ref}
      className={`
        flex items-center justify-between gap-1 h-7 px-2 rounded text-[11px]
        cursor-grab active:cursor-grabbing
        ${isDragging ? 'opacity-40 scale-95' : ''}
        ${getDropHighlight()}
        transition-all
        ${isNeXTSTEP
          ? 'bg-[#4A90D9] text-white'
          : 'bg-blue-100 text-blue-800 border border-blue-200'
        }
      `}
      title={`${mapping.axis}: ${mapping.facet}`}
    >
      <GripVertical className={`w-3 h-3 flex-shrink-0 ${isNeXTSTEP ? 'text-white/60' : 'text-blue-400'}`} />
      {/* LATCH icon */}
      <span style={{ color: isNeXTSTEP ? 'white' : axisInfo.color }} className="flex-shrink-0">
        {axisInfo.icon}
      </span>
      {/* Capitalized facet name only */}
      <span className="truncate flex-1">
        {capitalizeWords(mapping.facet)}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className={`
          p-0.5 rounded transition-colors
          ${isNeXTSTEP ? 'hover:bg-[#5A9FE9]' : 'hover:bg-blue-200'}
        `}
        type="button"
        title="Remove axis"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ============================================================================
// DropWell Component
// ============================================================================

interface DropWellProps {
  wellId: 'available' | 'x' | 'y' | 'z';
  label: string;
  sublabel?: string;
  width: string;
  children: React.ReactNode;
  onDrop: (item: DragItem) => void;
  acceptFrom?: ('available' | 'x' | 'y' | 'z')[];
}

function DropWell({ wellId, label, sublabel, width, children, onDrop, acceptFrom }: DropWellProps) {
  const { theme } = useTheme();
  const isNeXTSTEP = theme === 'NeXTSTEP';

  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: PAFV_ITEM_TYPE,
    drop: (item: DragItem) => {
      // Don't drop on same well
      if (item.sourceWell === wellId) return;
      onDrop(item);
    },
    canDrop: (item: DragItem) => {
      // Don't accept GRAPH items
      if (item.bucket === 'GRAPH') return false;
      // If acceptFrom specified, only accept from those wells
      if (acceptFrom && !acceptFrom.includes(item.sourceWell)) return false;
      // Don't drop on same well
      return item.sourceWell !== wellId;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [wellId, onDrop, acceptFrom]);

  return (
    <div className={`${width} flex flex-col`}>
      {/* Well Header - consistent h-[32px] for all columns */}
      <div className="mb-1 px-1 h-[32px] flex flex-col justify-end">
        <div className={`text-[10px] font-semibold uppercase tracking-wide ${
          isNeXTSTEP ? 'text-[#999]' : 'text-gray-500'
        }`}>
          {label}
        </div>
        <div className={`text-[9px] ${isNeXTSTEP ? 'text-[#666]' : 'text-gray-400'}`}>
          {sublabel || '\u00A0'}
        </div>
      </div>

      {/* Well Content */}
      <div
        ref={drop}
        className={`
          flex-1 min-h-[140px] max-h-[200px] p-1.5 rounded overflow-y-auto
          border-2 transition-all
          ${isNeXTSTEP
            ? `bg-[#2D2D2D] ${isOver && canDrop ? 'border-[#4A90D9] bg-[#3A4A5A]' : 'border-[#3A3A3A]'}`
            : `bg-gray-50 ${isOver && canDrop ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`
          }
        `}
      >
        <div className="flex flex-col gap-1">
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DensityColumnEqual Component (accepts width prop for equal-width layout)
// ============================================================================

interface DensityColumnEqualProps {
  densityLevel: DensityLevel;
  onDensityChange: (level: DensityLevel) => void;
  width: string;
}

function DensityColumnEqual({ densityLevel, onDensityChange, width }: DensityColumnEqualProps) {
  const { theme } = useTheme();
  const isNeXTSTEP = theme === 'NeXTSTEP';

  return (
    <div className={`${width} flex flex-col`}>
      {/* Header - consistent height with other columns */}
      <div className="mb-1 px-1 h-[32px] flex flex-col justify-end">
        <div className={`text-[10px] font-semibold uppercase tracking-wide ${
          isNeXTSTEP ? 'text-[#999]' : 'text-gray-500'
        }`}>
          Density
        </div>
        <div className={`text-[9px] ${isNeXTSTEP ? 'text-[#666]' : 'text-gray-400'}`}>
          Sparse/Dense
        </div>
      </div>

      {/* Slider Container */}
      <div className={`
        flex-1 min-h-[140px] p-2 rounded flex flex-col items-center justify-between
        border-2
        ${isNeXTSTEP ? 'bg-[#2D2D2D] border-[#3A3A3A]' : 'bg-gray-50 border-gray-200'}
      `}>
        {/* Sparse Label */}
        <div className={`text-[9px] font-semibold uppercase ${isNeXTSTEP ? 'text-[#999]' : 'text-gray-400'}`}>
          Sparse
        </div>

        {/* Vertical Slider */}
        <div className="flex-1 flex items-center justify-center py-2">
          <input
            type="range"
            min="1"
            max="4"
            step="1"
            value={densityLevel}
            onChange={(e) => onDensityChange(Number(e.target.value) as DensityLevel)}
            className="h-20 appearance-none cursor-pointer"
            style={{
              writingMode: 'vertical-lr',
              direction: 'rtl',
              width: '8px',
            }}
          />
        </div>

        {/* Dense Label */}
        <div className={`text-[9px] font-semibold uppercase ${isNeXTSTEP ? 'text-[#999]' : 'text-gray-400'}`}>
          Dense
        </div>

        {/* Level Indicator */}
        <div className={`mt-1 text-[11px] font-mono ${isNeXTSTEP ? 'text-[#E0E0E0]' : 'text-gray-700'}`}>
          L{densityLevel}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PafvNavigator Component
// ============================================================================

export interface PafvNavigatorProps {
  /** Set of enabled property IDs (from LatchNavigator checkboxes) */
  enabledProperties?: Set<string>;
  /** Node type filter for schema-on-read (e.g., 'notes', 'contacts') */
  nodeType?: string;
}

export function PafvNavigator({ enabledProperties, nodeType }: PafvNavigatorProps = {}) {
  const { theme } = useTheme();
  const { classification } = usePropertyClassification(nodeType);
  const {
    state: pafvState,
    addMappingToPlane,
    removeFacetFromPlane,
    getMappingsForPlane,
    reorderMappingsInPlane,
    moveFacetToPlane,
    moveFacetToPlaneAtIndex,
    setDensityLevel,
    setColorEncoding,
    setSizeEncoding,
  } = usePAFV();

  const isNeXTSTEP = theme === 'NeXTSTEP';

  // Get available properties (all LATCH, exclude those assigned to X/Y/Z)
  const getAllLatchProperties = (): ClassifiedProperty[] => {
    if (!classification) return [];
    return [
      ...classification.L,
      ...classification.A,
      ...classification.T,
      ...classification.C,
      ...classification.H,
    ];
  };

  // Get assigned facets for filtering
  const xMappings = getMappingsForPlane('x');
  const yMappings = getMappingsForPlane('y');
  const zMappings = getMappingsForPlane('z');
  const assignedFacets = new Set([
    ...xMappings.map(m => m.facet),
    ...yMappings.map(m => m.facet),
    ...zMappings.map(m => m.facet),
  ]);

  // Available = LATCH properties that are:
  // 1. Enabled in LatchNavigator (if enabledProperties is provided)
  // 2. Not already assigned to X/Y/Z planes
  const availableProperties = getAllLatchProperties().filter(p => {
    // If enabledProperties is provided, only include enabled properties
    if (enabledProperties && !enabledProperties.has(p.id)) {
      return false;
    }
    // Exclude properties already assigned to planes
    return !assignedFacets.has(p.sourceColumn);
  });

  // Handle drop on X/Y/Z wells - use atomic moveFacetToPlane for cross-plane moves
  const handleDropOnPlane = (plane: Plane) => (item: DragItem) => {
    devLogger.debug('[PafvNavigator] handleDropOnPlane called', { plane, item: item.sourceColumn, from: item.sourceWell });

    // Map bucket to axis
    if (item.bucket === 'GRAPH') return;
    const axis = BUCKET_TO_AXIS[item.bucket as LATCHBucket];

    // If coming from another plane, use atomic move (prevents copy bug)
    if (item.sourceWell === 'x' || item.sourceWell === 'y' || item.sourceWell === 'z') {
      devLogger.debug('[PafvNavigator] Moving between planes', { from: item.sourceWell, to: plane });
      moveFacetToPlane(item.sourceWell as Plane, plane, item.sourceColumn, axis);
      return;
    }

    // Coming from Available well - just add (STACKING happens here)
    devLogger.debug('[PafvNavigator] Adding from Available to plane', { plane });
    const mapping: AxisMapping = {
      plane,
      axis,
      facet: item.sourceColumn,
    };
    addMappingToPlane(mapping);
  };

  // Handle drop back to Available
  const handleDropOnAvailable = (item: DragItem) => {
    if (item.sourceWell === 'x' || item.sourceWell === 'y' || item.sourceWell === 'z') {
      removeFacetFromPlane(item.sourceWell as Plane, item.sourceColumn);
    }
  };

  // Handle cross-plane drop at specific index (SuperDynamic positional insertion)
  const handleCrossPlaneDropAtIndex = (targetPlane: Plane) => (item: ReorderDragItem, targetIndex: number) => {
    if (item.bucket === 'GRAPH') return;
    const axis = BUCKET_TO_AXIS[item.bucket as LATCHBucket];

    // If coming from another plane, move with position
    if (item.sourceWell === 'x' || item.sourceWell === 'y' || item.sourceWell === 'z') {
      devLogger.debug('[PafvNavigator] Cross-plane drop at index', {
        from: item.sourceWell,
        to: targetPlane,
        facet: item.sourceColumn,
        targetIndex
      });
      moveFacetToPlaneAtIndex(item.sourceWell as Plane, targetPlane, item.sourceColumn, axis, targetIndex);
    }
  };

  // Container styling
  const containerClasses = `
    w-full p-2
    ${isNeXTSTEP
      ? 'bg-[#252525] border-b border-[#3A3A3A]'
      : 'bg-white/50 backdrop-blur-xl border-b border-gray-200'
    }
  `;

  // Equal width for all 6 columns
  const columnWidth = 'w-[16.67%]';

  return (
    <div className={containerClasses.trim().replace(/\s+/g, ' ')}>
      <div className="flex gap-2">
          {/* Available Properties Well */}
          <DropWell
            wellId="available"
            label="Available"
            sublabel="Properties"
            width={columnWidth}
            onDrop={handleDropOnAvailable}
            acceptFrom={['x', 'y', 'z']}
          >
            {availableProperties.length === 0 ? (
              <div className={`text-[10px] italic p-1 ${isNeXTSTEP ? 'text-[#666]' : 'text-gray-400'}`}>
                All assigned
              </div>
            ) : (
              availableProperties.map(prop => (
                <DraggablePropertyChip
                  key={prop.id}
                  property={prop}
                  sourceWell="available"
                />
              ))
            )}
          </DropWell>

          {/* X-Plane Well */}
          <DropWell
            wellId="x"
            label="X-Plane"
            sublabel="Rows"
            width={columnWidth}
            onDrop={handleDropOnPlane('x')}
          >
            {xMappings.length === 0 ? (
              <div className={`text-[10px] italic p-1 ${isNeXTSTEP ? 'text-[#666]' : 'text-gray-400'}`}>
                Drop facet
              </div>
            ) : (
              xMappings.map((mapping, index) => (
                <AxisChip
                  key={`${mapping.axis}-${mapping.facet}`}
                  mapping={mapping}
                  sourceWell="x"
                  index={index}
                  onRemove={() => removeFacetFromPlane('x', mapping.facet)}
                  onReorder={(fromIndex, toIndex) => reorderMappingsInPlane('x', fromIndex, toIndex)}
                  onCrossPlaneDropAtIndex={handleCrossPlaneDropAtIndex('x')}
                />
              ))
            )}
          </DropWell>

          {/* Y-Plane Well */}
          <DropWell
            wellId="y"
            label="Y-Plane"
            sublabel="Columns"
            width={columnWidth}
            onDrop={handleDropOnPlane('y')}
          >
            {yMappings.length === 0 ? (
              <div className={`text-[10px] italic p-1 ${isNeXTSTEP ? 'text-[#666]' : 'text-gray-400'}`}>
                Drop facet
              </div>
            ) : (
              yMappings.map((mapping, index) => (
                <AxisChip
                  key={`${mapping.axis}-${mapping.facet}`}
                  mapping={mapping}
                  sourceWell="y"
                  index={index}
                  onRemove={() => removeFacetFromPlane('y', mapping.facet)}
                  onReorder={(fromIndex, toIndex) => reorderMappingsInPlane('y', fromIndex, toIndex)}
                  onCrossPlaneDropAtIndex={handleCrossPlaneDropAtIndex('y')}
                />
              ))
            )}
          </DropWell>

          {/* Z-Plane Well (Depth) */}
          <DropWell
            wellId="z"
            label="Z-Plane"
            sublabel="Depth"
            width={columnWidth}
            onDrop={handleDropOnPlane('z')}
          >
            {zMappings.length === 0 ? (
              <div className={`text-[10px] italic p-1 ${isNeXTSTEP ? 'text-[#666]' : 'text-gray-400'}`}>
                Drop facet
              </div>
            ) : (
              zMappings.map((mapping, index) => (
                <AxisChip
                  key={`${mapping.axis}-${mapping.facet}`}
                  mapping={mapping}
                  sourceWell="z"
                  index={index}
                  onRemove={() => removeFacetFromPlane('z', mapping.facet)}
                  onReorder={(fromIndex, toIndex) => reorderMappingsInPlane('z', fromIndex, toIndex)}
                  onCrossPlaneDropAtIndex={handleCrossPlaneDropAtIndex('z')}
                />
              ))
            )}
          </DropWell>

          {/* Encoding Column */}
          <div className={`${columnWidth} flex flex-col`}>
            <div className="mb-1 px-1 h-[32px] flex flex-col justify-end">
              <div className={`text-[10px] font-semibold uppercase tracking-wide ${
                isNeXTSTEP ? 'text-[#999]' : 'text-gray-500'
              }`}>
                Encoding
              </div>
              <div className={`text-[9px] ${isNeXTSTEP ? 'text-[#666]' : 'text-gray-400'}`}>
                Color/Size
              </div>
            </div>
            <div className={`
              flex-1 min-h-[140px] p-1.5 rounded flex flex-col gap-2
              border-2
              ${isNeXTSTEP ? 'bg-[#2D2D2D] border-[#3A3A3A]' : 'bg-gray-50 border-gray-200'}
            `}>
              {/* Color Encoding */}
              <EncodingDropdown
                label="Color"
                value={pafvState.colorEncoding}
                availableProperties={getAllLatchProperties()}
                onChange={setColorEncoding}
                encodingType="color"
              />

              {/* Size Encoding */}
              <EncodingDropdown
                label="Size"
                value={pafvState.sizeEncoding}
                availableProperties={getAllLatchProperties()}
                onChange={setSizeEncoding}
                encodingType="size"
              />
            </div>
          </div>

          {/* Density Column */}
          <DensityColumnEqual
            densityLevel={pafvState.densityLevel}
            onDensityChange={setDensityLevel}
            width={columnWidth}
          />
        </div>
      </div>
  );
}
