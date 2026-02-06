import React, { useState, useRef, useCallback } from 'react';
import './SuperDynamic.css';

interface SuperDynamicProps {
  xAxis: string;
  yAxis: string;
  zAxis?: string;
  onAxisChange: (axis: 'x' | 'y' | 'z', value: string) => void;
  availableAxes: { id: string; label: string; description: string }[];
  className?: string;
}

interface DragState {
  isDragging: boolean;
  draggedAxis: string | null;
  draggedAxisType: 'x' | 'y' | 'z' | null;
  dropTarget: 'x' | 'y' | 'z' | null;
  dragOffset: { x: number; y: number };
  dragStartPos: { x: number; y: number };
}

/**
 * SuperDynamic: Drag-and-Drop Axis Repositioning
 *
 * Allows dynamic rearrangement of PAFV axis mappings with:
 * - Visual drag feedback with ghost elements
 * - Animated grid reflow on axis changes
 * - Axis swap and reposition operations
 * - Real-time preview of layout changes
 *
 * Part of the Super* feature family for SuperGrid.
 */
export const SuperDynamic: React.FC<SuperDynamicProps> = ({
  xAxis,
  yAxis,
  zAxis,
  onAxisChange,
  availableAxes,
  className = ''
}) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedAxis: null,
    draggedAxisType: null,
    dropTarget: null,
    dragOffset: { x: 0, y: 0 },
    dragStartPos: { x: 0, y: 0 }
  });

  const dragRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get axis configuration by ID
  const getAxisConfig = (axisId: string) => {
    return availableAxes.find(axis => axis.id === axisId);
  };

  // Handle drag start
  const handleDragStart = useCallback((
    e: React.MouseEvent,
    axisId: string,
    axisType: 'x' | 'y' | 'z'
  ) => {
    e.preventDefault();

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setDragState({
      isDragging: true,
      draggedAxis: axisId,
      draggedAxisType: axisType,
      dropTarget: null,
      dragOffset: { x: offsetX, y: offsetY },
      dragStartPos: { x: e.clientX, y: e.clientY }
    });

    // Add global mouse event listeners
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Handle global mouse move (for drag feedback)
  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.isDragging) return;

    // Update drag position for ghost element
    if (dragRef.current) {
      dragRef.current.style.left = `${e.clientX - dragState.dragOffset.x}px`;
      dragRef.current.style.top = `${e.clientY - dragState.dragOffset.y}px`;
    }

    // Determine drop target
    const element = document.elementFromPoint(e.clientX, e.clientY);
    const dropZone = element?.closest('[data-axis-drop-zone]');
    const dropTarget = dropZone?.getAttribute('data-axis-drop-zone') as 'x' | 'y' | 'z' | null;

    setDragState(prev => ({
      ...prev,
      dropTarget
    }));
  }, [dragState.isDragging, dragState.dragOffset]);

  // Handle global mouse up (complete drag)
  const handleGlobalMouseUp = useCallback((e: MouseEvent) => {
    if (!dragState.isDragging || !dragState.draggedAxis || !dragState.draggedAxisType) return;

    // Remove global listeners
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);

    // Determine final drop target
    const element = document.elementFromPoint(e.clientX, e.clientY);
    const dropZone = element?.closest('[data-axis-drop-zone]');
    const dropTarget = dropZone?.getAttribute('data-axis-drop-zone') as 'x' | 'y' | 'z' | null;

    // Perform axis repositioning
    if (dropTarget && dropTarget !== dragState.draggedAxisType) {
      performAxisSwap(dragState.draggedAxisType, dropTarget);
    }

    // Reset drag state
    setDragState({
      isDragging: false,
      draggedAxis: null,
      draggedAxisType: null,
      dropTarget: null,
      dragOffset: { x: 0, y: 0 },
      dragStartPos: { x: 0, y: 0 }
    });
  }, [dragState]);

  // Perform axis swap operation
  const performAxisSwap = (fromAxis: 'x' | 'y' | 'z', toAxis: 'x' | 'y' | 'z') => {
    const currentX = xAxis;
    const currentY = yAxis;
    const currentZ = zAxis || '';

    // Get the axis values to swap
    let fromValue = '';
    let toValue = '';

    switch (fromAxis) {
      case 'x': fromValue = currentX; break;
      case 'y': fromValue = currentY; break;
      case 'z': fromValue = currentZ; break;
    }

    switch (toAxis) {
      case 'x': toValue = currentX; break;
      case 'y': toValue = currentY; break;
      case 'z': toValue = currentZ; break;
    }

    // Perform the swap
    onAxisChange(fromAxis, toValue);
    onAxisChange(toAxis, fromValue);
  };

  // Handle axis clear (drop to remove)
  const handleAxisClear = (axisType: 'x' | 'y' | 'z') => {
    onAxisChange(axisType, '');
  };

  // Handle axis assignment from available list
  const handleAxisAssign = (axisType: 'x' | 'y' | 'z', axisId: string) => {
    onAxisChange(axisType, axisId);
  };

  const renderAxisSlot = (
    axisType: 'x' | 'y' | 'z',
    axisValue: string,
    label: string,
    icon: string
  ) => {
    const axisConfig = getAxisConfig(axisValue);
    const isDropTarget = dragState.dropTarget === axisType;
    const isDraggedFrom = dragState.draggedAxisType === axisType;

    return (
      <div
        data-axis-drop-zone={axisType}
        className={`superdynamic__axis-slot superdynamic__axis-slot--${axisType} ${
          isDropTarget ? 'superdynamic__axis-slot--drop-target' : ''
        } ${isDraggedFrom ? 'superdynamic__axis-slot--dragging-from' : ''}`}
      >
        <div className="superdynamic__axis-label">
          <span className="superdynamic__axis-icon">{icon}</span>
          <span className="superdynamic__axis-name">{label}</span>
        </div>

        {axisConfig ? (
          <div
            className="superdynamic__axis-chip"
            draggable={true}
            onMouseDown={(e) => handleDragStart(e, axisConfig.id, axisType)}
          >
            <span className="superdynamic__chip-label">{axisConfig.label}</span>
            <button
              className="superdynamic__chip-remove"
              onClick={() => handleAxisClear(axisType)}
              title={`Remove ${axisConfig.label} from ${label} axis`}
            >
              ×
            </button>
          </div>
        ) : (
          <div className="superdynamic__axis-empty">
            <span>Drop axis here</span>
            <div className="superdynamic__axis-suggestions">
              {availableAxes.slice(0, 3).map(axis => (
                <button
                  key={axis.id}
                  className="superdynamic__axis-suggestion"
                  onClick={() => handleAxisAssign(axisType, axis.id)}
                  title={axis.description}
                >
                  {axis.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAvailableAxes = () => (
    <div className="superdynamic__available-axes">
      <h4>Available LATCH Axes</h4>
      <div className="superdynamic__axes-grid">
        {availableAxes.map(axis => {
          const isInUse = [xAxis, yAxis, zAxis].includes(axis.id);

          return (
            <div
              key={axis.id}
              className={`superdynamic__available-axis ${
                isInUse ? 'superdynamic__available-axis--in-use' : ''
              }`}
              draggable={!isInUse}
              onMouseDown={!isInUse ? (e) => {
                // Allow dragging from available axes to assign
                handleDragStart(e, axis.id, 'x'); // Temporary, will be updated on drop
              } : undefined}
            >
              <div className="superdynamic__available-label">{axis.label}</div>
              <div className="superdynamic__available-description">{axis.description}</div>
              {isInUse && <div className="superdynamic__in-use-badge">In Use</div>}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderDragGhost = () => {
    if (!dragState.isDragging || !dragState.draggedAxis) return null;

    const axisConfig = getAxisConfig(dragState.draggedAxis);
    if (!axisConfig) return null;

    return (
      <div
        ref={dragRef}
        className="superdynamic__drag-ghost"
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          zIndex: 1000,
          left: dragState.dragStartPos.x - dragState.dragOffset.x,
          top: dragState.dragStartPos.y - dragState.dragOffset.y
        }}
      >
        <div className="superdynamic__ghost-chip">
          {axisConfig.label}
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className={`superdynamic ${className}`}>
      <div className="superdynamic__header">
        <h3>🎯 SuperDynamic: Axis Control</h3>
        <p>Drag and drop to rearrange PAFV axis mappings</p>
      </div>

      <div className="superdynamic__axis-layout">
        {renderAxisSlot('y', yAxis, 'Y-Axis (Rows)', '📊')}

        <div className="superdynamic__axis-cross">
          {renderAxisSlot('z', zAxis || '', 'Z-Axis (Depth)', '🔍')}
          {renderAxisSlot('x', xAxis, 'X-Axis (Columns)', '📈')}
        </div>
      </div>

      {renderAvailableAxes()}
      {renderDragGhost()}

      <div className="superdynamic__stats">
        <div className="superdynamic__stat">
          <span className="superdynamic__stat-label">Active Axes</span>
          <span className="superdynamic__stat-value">
            {[xAxis, yAxis, zAxis].filter(Boolean).length}/3
          </span>
        </div>
        <div className="superdynamic__stat">
          <span className="superdynamic__stat-label">Layout</span>
          <span className="superdynamic__stat-value">
            {xAxis && yAxis ? '2D Grid' :
             xAxis || yAxis ? '1D List' :
             '0D Gallery'}
          </span>
        </div>
        <div className="superdynamic__stat">
          <span className="superdynamic__stat-label">Complexity</span>
          <span className="superdynamic__stat-value">
            {xAxis && yAxis && zAxis ? 'SuperGrid' :
             xAxis && yAxis ? 'Grid' :
             xAxis || yAxis ? 'Simple' : 'Basic'}
          </span>
        </div>
      </div>

      {dragState.isDragging && (
        <div className="superdynamic__drag-overlay">
          <div className="superdynamic__drag-instructions">
            Drop on axis slot to assign or swap
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperDynamic;