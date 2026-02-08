/**
 * SuperZoomControls - Separate zoom and pan control interface
 *
 * Provides distinct UI controls for cartographic navigation with
 * Apple Numbers-style zoom/pan separation and visual feedback.
 *
 * Features:
 * - Separate zoom and pan slider controls
 * - Visual feedback for boundary constraints
 * - Real-time scale and position display
 * - Keyboard shortcuts support
 * - Accessibility compliance
 */

import React, { useCallback, useEffect, useState } from 'react';
import type {
  CartographicState,
  CartographicControlInterface,
  CartographicVisualFeedback
} from '../types/supergrid';

export interface SuperZoomControlsProps {
  /** Cartographic navigation engine instance */
  cartographic: CartographicControlInterface;

  /** Show/hide individual control sections */
  showZoomControls?: boolean;
  showPanControls?: boolean;
  showStateDisplay?: boolean;
  showBoundaryIndicators?: boolean;

  /** Control positioning */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  /** Compact mode for reduced UI footprint */
  compact?: boolean;

  /** Enable keyboard shortcuts */
  enableKeyboardShortcuts?: boolean;

  /** Custom styling classes */
  className?: string;
}

export const SuperZoomControls: React.FC<SuperZoomControlsProps> = ({
  cartographic,
  showZoomControls = true,
  showPanControls = true,
  showStateDisplay = true,
  showBoundaryIndicators = true,
  position = 'top-right',
  compact = false,
  enableKeyboardShortcuts = true,
  className = ''
}) => {
  const [state, setState] = useState<CartographicState>(cartographic.getState());
  const [visualFeedback, setVisualFeedback] = useState<CartographicVisualFeedback>(
    cartographic.getVisualFeedback()
  );

  // Update state when cartographic engine changes
  useEffect(() => {
    const updateState = () => {
      setState(cartographic.getState());
      setVisualFeedback(cartographic.getVisualFeedback());
    };

    // Set up polling for state updates (could be improved with proper event system)
    const interval = setInterval(updateState, 100);

    return () => clearInterval(interval);
  }, [cartographic]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case '+':
          case '=':
            event.preventDefault();
            cartographic.zoomIn();
            break;
          case '-':
            event.preventDefault();
            cartographic.zoomOut();
            break;
          case '0':
            event.preventDefault();
            cartographic.resetZoom();
            break;
        }
      }

      // Pan with arrow keys (when focused)
      if (document.activeElement?.closest('.super-zoom-controls')) {
        const panStep = 50;
        switch (event.key) {
          case 'ArrowLeft':
            event.preventDefault();
            cartographic.panBy(-panStep, 0);
            break;
          case 'ArrowRight':
            event.preventDefault();
            cartographic.panBy(panStep, 0);
            break;
          case 'ArrowUp':
            event.preventDefault();
            cartographic.panBy(0, -panStep);
            break;
          case 'ArrowDown':
            event.preventDefault();
            cartographic.panBy(0, panStep);
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [cartographic, enableKeyboardShortcuts]);

  // Zoom control handlers
  const handleZoomChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const scale = parseFloat(event.target.value);
    cartographic.zoomTo(scale);
  }, [cartographic]);

  const handleZoomIn = useCallback(() => {
    cartographic.zoomIn();
  }, [cartographic]);

  const handleZoomOut = useCallback(() => {
    cartographic.zoomOut();
  }, [cartographic]);

  const handleZoomReset = useCallback(() => {
    cartographic.resetZoom();
  }, [cartographic]);

  // Pan control handlers
  const handlePanReset = useCallback(() => {
    cartographic.resetPan();
  }, [cartographic]);

  const handleCenterGrid = useCallback(() => {
    cartographic.centerOnGrid();
  }, [cartographic]);

  // Format helpers
  const formatScale = (scale: number): string => {
    return `${Math.round(scale * 100)}%`;
  };

  const formatPosition = (x: number, y: number): string => {
    return `(${Math.round(x)}, ${Math.round(y)})`;
  };

  const config = cartographic.getConfig();
  const canZoomIn = cartographic.canZoomIn();
  const canZoomOut = cartographic.canZoomOut();

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  const compactClass = compact ? 'super-zoom-controls--compact' : '';
  const positionClass = positionClasses[position];

  return (
    <div
      className={`super-zoom-controls ${compactClass} ${positionClass} ${className}`}
      tabIndex={0}
      role="group"
      aria-label="Grid navigation controls"
      style={{
        position: 'absolute',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: compact ? '8px' : '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(4px)',
        fontSize: compact ? '12px' : '14px',
        minWidth: compact ? '200px' : '280px',
        zIndex: 1000
      }}
    >
      {/* Zoom Controls Section */}
      {showZoomControls && (
        <div className="zoom-section" style={{ marginBottom: '12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px'
            }}
          >
            <label
              style={{
                fontWeight: 600,
                color: '#1f2937',
                minWidth: '40px',
                fontSize: compact ? '11px' : '13px'
              }}
            >
              Zoom:
            </label>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={handleZoomOut}
                disabled={!canZoomOut}
                title="Zoom out (Ctrl+-)"
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  background: '#f9fafb',
                  color: '#374151',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canZoomOut ? 'pointer' : 'not-allowed',
                  opacity: canZoomOut ? 1 : 0.5
                }}
              >
                −
              </button>

              <input
                type="range"
                min={config.zoomExtent[0]}
                max={config.zoomExtent[1]}
                step={0.1}
                value={state.scale}
                onChange={handleZoomChange}
                style={{
                  flex: 1,
                  accentColor: '#3b82f6',
                  height: '4px'
                }}
                aria-label="Zoom level"
              />

              <button
                onClick={handleZoomIn}
                disabled={!canZoomIn}
                title="Zoom in (Ctrl++)"
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  background: '#f9fafb',
                  color: '#374151',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canZoomIn ? 'pointer' : 'not-allowed',
                  opacity: canZoomIn ? 1 : 0.5
                }}
              >
                +
              </button>
            </div>

            <button
              onClick={handleZoomReset}
              title="Reset zoom (Ctrl+0)"
              style={{
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                background: '#f9fafb',
                color: '#374151',
                padding: '2px 6px',
                fontSize: compact ? '10px' : '11px',
                cursor: 'pointer'
              }}
            >
              {formatScale(state.scale)}
            </button>
          </div>
        </div>
      )}

      {/* Pan Controls Section */}
      {showPanControls && (
        <div className="pan-section" style={{ marginBottom: '12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px'
            }}
          >
            <label
              style={{
                fontWeight: 600,
                color: '#1f2937',
                minWidth: '40px',
                fontSize: compact ? '11px' : '13px'
              }}
            >
              Pan:
            </label>
            <div style={{ flex: 1, display: 'flex', gap: '6px' }}>
              <button
                onClick={handlePanReset}
                title="Reset pan position"
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  background: '#f9fafb',
                  color: '#374151',
                  padding: '2px 8px',
                  fontSize: compact ? '10px' : '11px',
                  cursor: 'pointer'
                }}
              >
                Reset
              </button>

              <button
                onClick={handleCenterGrid}
                title="Center grid in viewport"
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  background: '#f9fafb',
                  color: '#374151',
                  padding: '2px 8px',
                  fontSize: compact ? '10px' : '11px',
                  cursor: 'pointer'
                }}
              >
                Center
              </button>
            </div>
          </div>

          {/* Pan direction controls */}
          {!compact && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '4px', maxWidth: '120px' }}>
              <div></div>
              <button
                onClick={() => cartographic.panBy(0, -50)}
                title="Pan up"
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  background: '#f9fafb',
                  color: '#374151',
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ↑
              </button>
              <div></div>

              <button
                onClick={() => cartographic.panBy(-50, 0)}
                title="Pan left"
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  background: '#f9fafb',
                  color: '#374151',
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ←
              </button>
              <div></div>
              <button
                onClick={() => cartographic.panBy(50, 0)}
                title="Pan right"
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  background: '#f9fafb',
                  color: '#374151',
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                →
              </button>

              <div></div>
              <button
                onClick={() => cartographic.panBy(0, 50)}
                title="Pan down"
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  background: '#f9fafb',
                  color: '#374151',
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ↓
              </button>
              <div></div>
            </div>
          )}
        </div>
      )}

      {/* State Display Section */}
      {showStateDisplay && (
        <div className="state-section" style={{ marginBottom: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: compact ? '10px' : '11px' }}>
            <div>
              <span style={{ fontWeight: 500, color: '#6b7280' }}>Scale:</span>
              <span style={{ marginLeft: '4px', color: '#1f2937' }}>{formatScale(state.scale)}</span>
            </div>
            <div>
              <span style={{ fontWeight: 500, color: '#6b7280' }}>Position:</span>
              <span style={{ marginLeft: '4px', color: '#1f2937', fontFamily: 'monospace' }}>
                {formatPosition(state.transform.x, state.transform.y)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Boundary Indicators */}
      {showBoundaryIndicators && visualFeedback.showBoundaryIndicators && (
        <div
          className="boundary-indicators"
          style={{
            padding: '6px 8px',
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '4px',
            fontSize: compact ? '10px' : '11px',
            color: '#92400e'
          }}
        >
          <div style={{ fontWeight: 500, marginBottom: '2px' }}>
            Boundary reached
          </div>
          {state.boundaryStatus.atLeftBoundary && <div>• Left edge</div>}
          {state.boundaryStatus.atRightBoundary && <div>• Right edge</div>}
          {state.boundaryStatus.atTopBoundary && <div>• Top edge</div>}
          {state.boundaryStatus.atBottomBoundary && <div>• Bottom edge</div>}
        </div>
      )}

      {/* Animation indicator */}
      {state.isAnimating && (
        <div
          style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#3b82f6',
            animation: 'pulse 1s infinite'
          }}
          title="Animation in progress"
        />
      )}

      {/* Keyboard shortcuts hint */}
      {enableKeyboardShortcuts && !compact && (
        <div
          style={{
            fontSize: '10px',
            color: '#6b7280',
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid #e5e7eb'
          }}
        >
          <div>Ctrl+/- to zoom, arrows to pan</div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default SuperZoomControls;