/**
 * Enhanced MiniNav with SuperDynamic Integration
 *
 * Extended MiniNav component with drag-and-drop axis repositioning,
 * real-time grid reflow, and staging area for axis management.
 *
 * Key features:
 * - Drag axis headers to plane drop zones
 * - Visual feedback during drag operations
 * - Axis staging area for repositioning
 * - Integration with SuperDynamic engine
 * - Performance monitoring and metrics
 *
 * @module components/MiniNavEnhanced
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import type { CoordinateSystem, OriginPattern } from '../types/coordinates';
import type { ViewAxisMapping } from '../types/views';
import { ViewType } from '../types/views';
import type { PAFVState } from '../types/pafv';
import type { SuperDynamicConfig } from '../types/supergrid';
import { useDragDrop } from '../hooks/ui/useDragDrop';
import { createSuperDynamicEngine, DEFAULT_SUPERDYNAMIC_CONFIG } from '../d3/SuperDynamic';
import { createPAFVAxisService } from '../services/PAFVAxisService';
import ViewSwitcher from './ViewSwitcher';
import OriginPatternSelector from './OriginPatternSelector';
import ZoomControls from './ZoomControls';
import '../styles/MiniNav.css';
import '../styles/SuperDynamic.css';

export interface MiniNavEnhancedProps {
  /** Current coordinate system configuration */
  coordinateSystem: CoordinateSystem;

  /** Current PAFV state (axis mappings + view mode) */
  pafvState: PAFVState;

  /** Current view axis mapping from SuperGrid */
  axisMapping: ViewAxisMapping;

  /** sql.js database instance for persistence */
  database?: any;

  /** Canvas/dataset ID for scoped persistence */
  canvasId: string;

  /** Callback when PAFV state changes (axis mapping) */
  onPAFVChange: (newState: PAFVState) => void;

  /** Callback when view axis mapping changes */
  onAxisMappingChange: (mapping: ViewAxisMapping) => void;

  /** Callback when origin pattern changes */
  onOriginChange: (pattern: OriginPattern) => void;

  /** Callback when zoom level changes */
  onZoom: (scale: number) => void;

  /** Callback when grid reflow starts */
  onReflowStart?: () => void;

  /** Callback when grid reflow completes */
  onReflowComplete?: () => void;
}

interface AxisSlot {
  id: 'x' | 'y' | 'z';
  label: string;
  icon: string;
  description: string;
  position: { x: number; y: number };
}

interface AvailableAxis {
  id: string;
  facet: string;
  label: string;
  description: string;
  latchDimension: string;
  isInUse: boolean;
}

/**
 * Enhanced MiniNav with SuperDynamic axis repositioning
 */
export function MiniNavEnhanced({
  coordinateSystem,
  pafvState,
  axisMapping,
  database,
  canvasId,
  onPAFVChange,
  onAxisMappingChange,
  onOriginChange,
  onZoom,
  onReflowStart,
  onReflowComplete
}: MiniNavEnhancedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const superDynamicEngine = useRef<any>(null);
  const axisService = useRef<any>(null);

  const [availableAxes, setAvailableAxes] = useState<AvailableAxis[]>([]);
  const [stagingAxes, setStagingAxes] = useState<AvailableAxis[]>([]);
  const [isReflowing, setIsReflowing] = useState(false);

  // Drag and drop hook
  const {
    dragState: htmlDragState,
    handleDragStart,
    handleDragEnd,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop
  } = useDragDrop();

  // Axis slot configuration
  const axisSlots: AxisSlot[] = [
    {
      id: 'x',
      label: 'X-Axis (Columns)',
      icon: '📈',
      description: 'Horizontal layout dimension',
      position: { x: 220, y: 280 }
    },
    {
      id: 'y',
      label: 'Y-Axis (Rows)',
      icon: '📊',
      description: 'Vertical layout dimension',
      position: { x: 40, y: 160 }
    },
    {
      id: 'z',
      label: 'Z-Axis (Depth)',
      icon: '🔍',
      description: 'Nested hierarchy dimension',
      position: { x: 220, y: 160 }
    }
  ];

  // Initialize SuperDynamic engine and axis service
  useEffect(() => {
    if (!containerRef.current || !database) return;

    // Initialize PAFV Axis Service
    axisService.current = createPAFVAxisService(database, canvasId, {
      enableMetrics: true,
      persistenceDelay: 500
    });

    // Load available axes
    const updateAvailableAxes = () => {
      const axes = axisService.current?.getAvailableAxes() || [];
      const assignedFacets = new Set([
        axisMapping.xAxis?.facet,
        axisMapping.yAxis?.facet,
        axisMapping.zAxis?.facet
      ].filter(Boolean));

      const mappedAxes = axes.map((axis: any) => ({
        ...axis,
        isInUse: assignedFacets.has(axis.facet)
      }));

      setAvailableAxes(mappedAxes);
    };

    // Listen for axis changes
    const handleAxisChange = (newMapping: ViewAxisMapping) => {
      onAxisMappingChange(newMapping);
      updateAvailableAxes();
    };

    axisService.current?.addChangeListener(handleAxisChange);
    updateAvailableAxes();

    // Initialize SuperDynamic engine
    const dynamicContainer = containerRef.current.querySelector('.superdynamic-container');
    if (dynamicContainer) {
      const config: SuperDynamicConfig = {
        ...DEFAULT_SUPERDYNAMIC_CONFIG,
        axisSlots: {
          x: { x: axisSlots[0].position.x, y: axisSlots[0].position.y, width: 160, height: 50 },
          y: { x: axisSlots[1].position.x, y: axisSlots[1].position.y, width: 160, height: 50 },
          z: { x: axisSlots[2].position.x, y: axisSlots[2].position.y, width: 160, height: 50 }
        }
      };

      superDynamicEngine.current = createSuperDynamicEngine(
        dynamicContainer as HTMLElement,
        config
      );

      // Set up event handlers
      superDynamicEngine.current?.setAxisChangeHandler(handleAxisChange);
      superDynamicEngine.current?.setReflowStartHandler(() => {
        setIsReflowing(true);
        onReflowStart?.();
      });
      superDynamicEngine.current?.setReflowCompleteHandler(() => {
        setIsReflowing(false);
        onReflowComplete?.();
      });
    }

    return () => {
      axisService.current?.removeChangeListener(handleAxisChange);
      axisService.current?.destroy();
      superDynamicEngine.current?.destroy();
    };
  }, [database, canvasId]);


  // Handle axis clearing
  const handleAxisClear = useCallback(async (slot: 'x' | 'y' | 'z') => {
    if (!axisService.current) return;

    try {
      await axisService.current.clearAxis(slot);
    } catch (error) {
      console.error('Failed to clear axis:', error);
    }
  }, []);

  // Handle axis swapping via drag-drop
  const handleAxisSwap = useCallback(async (
    sourceAxis: string,
    targetSlot: 'x' | 'y' | 'z'
  ) => {
    if (!axisService.current) return;

    try {
      // Find source slot
      let sourceSlot: 'x' | 'y' | 'z' | null = null;
      if (axisMapping.xAxis?.facet === sourceAxis) sourceSlot = 'x';
      else if (axisMapping.yAxis?.facet === sourceAxis) sourceSlot = 'y';
      else if (axisMapping.zAxis?.facet === sourceAxis) sourceSlot = 'z';

      if (sourceSlot) {
        await axisService.current.swapAxes(sourceSlot, targetSlot);
      } else {
        await axisService.current.assignAxis(targetSlot, sourceAxis);
      }
    } catch (error) {
      console.error('Failed to swap axes:', error);
    }
  }, [axisMapping]);

  // Add to staging area
  const moveToStaging = useCallback((axisId: string) => {
    const axis = availableAxes.find(a => a.id === axisId);
    if (axis && !axis.isInUse) {
      setStagingAxes(prev => [...prev, axis]);
    }
  }, [availableAxes]);

  // Remove from staging
  const removeFromStaging = useCallback((axisId: string) => {
    setStagingAxes(prev => prev.filter(a => a.id !== axisId));
  }, []);

  // Render axis slot with current assignment
  const renderAxisSlot = (slot: AxisSlot) => {
    const axisProperty = `${slot.id}Axis` as keyof ViewAxisMapping;
    const currentAxis = axisMapping[axisProperty];

    const isDropTarget = htmlDragState.hoveredZone === `axis-slot-${slot.id}`;
    const isDragging = Boolean(htmlDragState.draggedId);

    return (
      <div
        key={slot.id}
        className={`axis-slot axis-slot--${slot.id} ${
          isDropTarget ? 'axis-slot--drop-target' : ''
        }`}
        style={{
          position: 'absolute',
          left: slot.position.x,
          top: slot.position.y,
          width: 160,
          height: 50
        }}
        onDragEnter={handleDragEnter(`axis-slot-${slot.id}`)}
        onDragLeave={handleDragLeave(`axis-slot-${slot.id}`)}
        onDragOver={handleDragOver}
        onDrop={handleDrop(`axis-slot-${slot.id}`, (draggedId, _zoneId) => {
          handleAxisSwap(draggedId, slot.id);
        })}
      >
        <div className="axis-slot__header">
          <span className="axis-slot__icon">{slot.icon}</span>
          <span className="axis-slot__label">{slot.label}</span>
        </div>

        {currentAxis ? (
          <div
            className="axis-slot__content axis-slot__content--filled"
            draggable
            onDragStart={handleDragStart(currentAxis.facet)}
            onDragEnd={handleDragEnd}
          >
            <span className="axis-chip__label">
              {'label' in currentAxis ? currentAxis.label : currentAxis.facet}
            </span>
            <button
              className="axis-chip__remove"
              onClick={() => handleAxisClear(slot.id)}
              title={`Remove ${'label' in currentAxis ? currentAxis.label : currentAxis.facet} from ${slot.label}`}
            >
              ×
            </button>
          </div>
        ) : (
          <div className="axis-slot__content axis-slot__content--empty">
            <span className="axis-slot__empty-text">Drop here</span>
            {isDragging && (
              <div className="axis-slot__drop-indicator">
                <div className="axis-slot__drop-pulse"></div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render available axes pool
  const renderAvailableAxes = () => (
    <div className="available-axes">
      <h4 className="available-axes__title">
        Available Axes ({availableAxes.filter(a => !a.isInUse).length})
      </h4>
      <div className="available-axes__grid">
        {availableAxes
          .filter(axis => !axis.isInUse)
          .map(axis => (
            <div
              key={axis.id}
              className="available-axis"
              draggable
              onDragStart={handleDragStart(axis.id)}
              onDragEnd={handleDragEnd}
              onClick={() => moveToStaging(axis.id)}
              title={axis.description}
            >
              <div className="available-axis__label">{axis.label}</div>
              <div className="available-axis__latch">
                LATCH-{axis.latchDimension}
              </div>
            </div>
        ))}
      </div>
    </div>
  );

  // Render staging area
  const renderStagingArea = () => (
    <div className="staging-area">
      <h4 className="staging-area__title">
        Staging ({stagingAxes.length})
        {stagingAxes.length > 0 && (
          <button
            className="staging-area__clear"
            onClick={() => setStagingAxes([])}
            title="Clear staging area"
          >
            Clear
          </button>
        )}
      </h4>

      {stagingAxes.length === 0 ? (
        <div className="staging-area__empty">
          <span>Drag axes here to stage for assignment</span>
        </div>
      ) : (
        <div className="staging-area__items">
          {stagingAxes.map(axis => (
            <div
              key={axis.id}
              className="staging-axis"
              draggable
              onDragStart={handleDragStart(axis.id)}
              onDragEnd={handleDragEnd}
            >
              <span className="staging-axis__label">{axis.label}</span>
              <button
                className="staging-axis__remove"
                onClick={() => removeFromStaging(axis.id)}
                title="Remove from staging"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <aside className="mininav mininav--enhanced" role="navigation" aria-label="Enhanced SuperGrid Navigation">
      <div className="mininav-container" ref={containerRef}>
        {/* Section 1: View Mode Toggle */}
        <section className="mininav-section">
          <h2 className="mininav-section-title">View</h2>
          <ViewSwitcher
            currentView={pafvState.viewMode === 'grid' ? ViewType.SUPERGRID : ViewType.LIST}
            onViewChange={(mode) => {
              // Map ViewType to PAFVState viewMode
              if (mode === ViewType.SUPERGRID) {
                onPAFVChange({ ...pafvState, viewMode: 'grid' });
              } else if (mode === ViewType.LIST) {
                onPAFVChange({ ...pafvState, viewMode: 'list' });
              }
            }}
          />
        </section>

        {/* Section 2: SuperDynamic Axis Control */}
        <section className="mininav-section mininav-section--superdynamic">
          <h2 className="mininav-section-title">
            🎯 SuperDynamic
            {isReflowing && (
              <span className="mininav-section-status">Reflowing...</span>
            )}
          </h2>

          {/* Axis assignment area with visual layout */}
          <div className="superdynamic-container" style={{ position: 'relative', height: 350 }}>
            {axisSlots.map(renderAxisSlot)}

            {/* Central PAFV indicator */}
            <div className="pafv-center" style={{ position: 'absolute', left: 130, top: 220 }}>
              <div className="pafv-center__label">PAFV</div>
              <div className="pafv-center__sublabel">Control</div>
            </div>

            {/* Connection lines (handled by D3) */}
            <div className="connection-lines"></div>
          </div>
        </section>

        {/* Section 3: Available Axes Pool */}
        <section className="mininav-section">
          <div className="mininav-section-header">
            <h2 className="mininav-section-title">Axes</h2>
          </div>
          {renderAvailableAxes()}
        </section>

        {/* Section 4: Staging Area */}
        <section className="mininav-section">
          {renderStagingArea()}
        </section>

        {/* Section 5: Origin Pattern Selection */}
        <section className="mininav-section">
          <h2 className="mininav-section-title">Origin</h2>
          <OriginPatternSelector
            currentPattern={coordinateSystem.pattern}
            onPatternChange={onOriginChange}
          />
        </section>

        {/* Section 6: Zoom Controls */}
        <section className="mininav-section">
          <h2 className="mininav-section-title">Zoom</h2>
          <ZoomControls currentScale={coordinateSystem.scale} onZoom={onZoom} />
        </section>

        {/* Performance Metrics (dev mode) */}
        {process.env.NODE_ENV === 'development' && (
          <section className="mininav-section mininav-section--debug">
            <h2 className="mininav-section-title">Debug</h2>
            <div className="debug-info">
              <div className="debug-metric">
                <span className="debug-metric__label">Axes:</span>
                <span className="debug-metric__value">
                  {Object.values(axisMapping).filter(Boolean).length}/3
                </span>
              </div>
              <div className="debug-metric">
                <span className="debug-metric__label">Staging:</span>
                <span className="debug-metric__value">{stagingAxes.length}</span>
              </div>
              <div className="debug-metric">
                <span className="debug-metric__label">Available:</span>
                <span className="debug-metric__value">
                  {availableAxes.filter(a => !a.isInUse).length}
                </span>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Global drag overlay */}
      {htmlDragState.draggedId && (
        <div className="drag-overlay">
          <div className="drag-overlay__instructions">
            Drop on axis slot to assign or swap axes
          </div>
        </div>
      )}
    </aside>
  );
}

export default MiniNavEnhanced;