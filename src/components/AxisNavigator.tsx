/**
 * AxisNavigator - Drag LATCH axes to plane drop zones
 *
 * Displays available LATCH axes as draggable chips and plane drop zones.
 * Dragging an axis to a plane updates PAFV state.
 *
 * @module components/AxisNavigator
 */

import React, { useMemo } from 'react';
import type { PAFVState, LATCHAxis, Plane, AxisMapping } from '../types/pafv';
import { useDragDrop } from '../hooks/useDragDrop';
import '../styles/AxisNavigator.css';

export interface AxisNavigatorProps {
  /** Current PAFV state */
  pafvState: PAFVState;

  /** Callback when PAFV state changes */
  onPAFVChange: (newState: PAFVState) => void;
}

// Available LATCH axes
const LATCH_AXES: LATCHAxis[] = ['location', 'alphabet', 'time', 'category', 'hierarchy'];

// Available planes for mapping (shape disabled for MVP)
const PLANES: { id: Plane; label: string; disabled?: boolean }[] = [
  { id: 'x', label: 'X-Axis' },
  { id: 'y', label: 'Y-Axis' },
  { id: 'color', label: 'Color' },
  { id: 'size', label: 'Size' },
  { id: 'shape', label: 'Shape', disabled: true },
];

// Axis display configuration
const AXIS_CONFIG: Record<LATCHAxis, { label: string; icon: string }> = {
  location: { label: 'Location', icon: '📍' },
  alphabet: { label: 'Alphabet', icon: '🔤' },
  time: { label: 'Time', icon: '⏰' },
  category: { label: 'Category', icon: '🏷️' },
  hierarchy: { label: 'Hierarchy', icon: '🌳' },
};

/**
 * AxisNavigator component - drag-and-drop axis-to-plane mapper.
 *
 * @example
 * ```tsx
 * <AxisNavigator
 *   pafvState={pafv.state}
 *   onPAFVChange={pafv.setState}
 * />
 * ```
 */
export function AxisNavigator({ pafvState, onPAFVChange }: AxisNavigatorProps) {
  const {
    dragState,
    handleDragStart,
    handleDragEnd,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  } = useDragDrop();

  // Get currently assigned axes (axes that are mapped to planes)
  const assignedAxes = useMemo(() => {
    return new Set(pafvState.mappings.map((m) => m.axis));
  }, [pafvState.mappings]);

  // Get available axes (not yet assigned)
  const availableAxes = useMemo(() => {
    return LATCH_AXES.filter((axis) => !assignedAxes.has(axis));
  }, [assignedAxes]);

  // Get mapping for a specific plane
  const getMappingForPlane = (plane: Plane): AxisMapping | null => {
    return pafvState.mappings.find((m) => m.plane === plane) || null;
  };

  // Handle dropping an axis on a plane
  const handleAxisDrop = (axisId: string, planeId: string) => {
    const axis = axisId as LATCHAxis;
    const plane = planeId as Plane;

    // Remove any existing mapping for this plane
    const newMappings = pafvState.mappings.filter((m) => m.plane !== plane);

    // Add new mapping (with default facet - will be customizable in Step 4)
    const defaultFacet = axis === 'time' ? 'year' : axis === 'category' ? 'tag' : axis;
    newMappings.push({ plane, axis, facet: defaultFacet });

    onPAFVChange({ ...pafvState, mappings: newMappings });
  };

  // Remove mapping from a plane
  const handleRemoveMapping = (plane: Plane) => {
    const newMappings = pafvState.mappings.filter((m) => m.plane !== plane);
    onPAFVChange({ ...pafvState, mappings: newMappings });
  };

  return (
    <div className="axis-navigator">
      {/* Available axes to drag */}
      <div className="axis-chips">
        <div className="axis-chips-label">Available Axes</div>
        <div className="axis-chips-container">
          {availableAxes.length === 0 && (
            <div className="axis-chips-empty">All axes assigned</div>
          )}
          {availableAxes.map((axis) => (
            <div
              key={axis}
              className={`axis-chip ${dragState.draggedId === axis ? 'dragging' : ''}`}
              draggable
              onDragStart={handleDragStart(axis)}
              onDragEnd={handleDragEnd}
              title={`Drag ${AXIS_CONFIG[axis].label} to a plane`}
            >
              <span className="axis-chip-icon">{AXIS_CONFIG[axis].icon}</span>
              <span className="axis-chip-label">{AXIS_CONFIG[axis].label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Plane drop zones */}
      <div className="plane-zones">
        <div className="plane-zones-label">Planes</div>
        {PLANES.map((plane) => {
          const mapping = getMappingForPlane(plane.id);
          const isHovered = dragState.hoveredZone === plane.id;

          return (
            <div
              key={plane.id}
              className={`plane-zone ${mapping ? 'has-mapping' : ''} ${isHovered ? 'hovered' : ''} ${plane.disabled ? 'disabled' : ''}`}
              onDragEnter={!plane.disabled ? handleDragEnter(plane.id) : undefined}
              onDragLeave={!plane.disabled ? handleDragLeave(plane.id) : undefined}
              onDragOver={!plane.disabled ? handleDragOver : undefined}
              onDrop={
                !plane.disabled ? handleDrop(plane.id, handleAxisDrop) : undefined
              }
              title={plane.disabled ? `${plane.label} (coming soon)` : `Drop axis on ${plane.label}`}
            >
              <div className="plane-zone-header">
                <span className="plane-zone-label">{plane.label}</span>
                {mapping && (
                  <button
                    className="plane-zone-remove"
                    onClick={() => handleRemoveMapping(plane.id)}
                    aria-label={`Remove ${AXIS_CONFIG[mapping.axis].label} from ${plane.label}`}
                  >
                    ×
                  </button>
                )}
              </div>

              {mapping ? (
                <div className="plane-zone-content">
                  <div className="axis-chip assigned">
                    <span className="axis-chip-icon">{AXIS_CONFIG[mapping.axis].icon}</span>
                    <span className="axis-chip-label">{AXIS_CONFIG[mapping.axis].label}</span>
                  </div>
                </div>
              ) : (
                <div className="plane-zone-content empty">
                  {!plane.disabled && <span className="plane-zone-hint">Drop axis here</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AxisNavigator;
