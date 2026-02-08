/**
 * Header Level Picker Component
 *
 * React component providing UI controls for SuperStack progressive disclosure.
 * Renders level picker tabs and zoom controls for navigating deep hierarchies.
 *
 * Features:
 * - Level picker tabs for switching between depth ranges
 * - Zoom in/out controls for 3D camera navigation
 * - Real-time level indicators and node counts
 * - Smooth animations coordinated with D3 transitions
 * - Responsive design for various screen sizes
 */

import React, { useCallback, useState } from 'react';
import { ChevronUp, ChevronDown, ZoomIn, ZoomOut } from 'lucide-react';
import type { LevelPickerTab, ZoomControlState } from '../d3/SuperStackProgressive';

export interface HeaderLevelPickerProps {
  // Level picker state
  tabs: LevelPickerTab[];
  currentTab: number;
  onTabSelect: (tabIndex: number) => void;

  // Zoom controls state
  zoomState: ZoomControlState;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onStepUp: () => void;
  onStepDown: () => void;

  // Visual configuration
  showZoomControls?: boolean;
  showLevelPicker?: boolean;
  compact?: boolean;
  className?: string;
}

export interface HeaderLevelPickerState {
  isAnimating: boolean;
  hoveredTab: number | null;
}

export const HeaderLevelPicker: React.FC<HeaderLevelPickerProps> = ({
  tabs,
  currentTab,
  onTabSelect,
  zoomState,
  onZoomIn,
  onZoomOut,
  onStepUp,
  onStepDown,
  showZoomControls = true,
  showLevelPicker = true,
  compact = false,
  className = ''
}) => {
  const [state, setState] = useState<HeaderLevelPickerState>({
    isAnimating: false,
    hoveredTab: null
  });

  // Handle tab selection with animation coordination
  const handleTabSelect = useCallback((tabIndex: number) => {
    if (tabIndex === currentTab || state.isAnimating) return;

    setState(prev => ({ ...prev, isAnimating: true }));

    // Trigger tab change
    onTabSelect(tabIndex);

    // Reset animation state after D3 transition completes
    setTimeout(() => {
      setState(prev => ({ ...prev, isAnimating: false }));
    }, 350); // Slightly longer than D3 transition duration
  }, [currentTab, onTabSelect, state.isAnimating]);

  // Handle zoom controls
  const handleZoomIn = useCallback(() => {
    if (!zoomState.canZoomIn || state.isAnimating) return;
    setState(prev => ({ ...prev, isAnimating: true }));
    onZoomIn();
    setTimeout(() => setState(prev => ({ ...prev, isAnimating: false })), 350);
  }, [zoomState.canZoomIn, onZoomIn, state.isAnimating]);

  const handleZoomOut = useCallback(() => {
    if (!zoomState.canZoomOut || state.isAnimating) return;
    setState(prev => ({ ...prev, isAnimating: true }));
    onZoomOut();
    setTimeout(() => setState(prev => ({ ...prev, isAnimating: false })), 350);
  }, [zoomState.canZoomOut, onZoomOut, state.isAnimating]);

  // Handle step navigation
  const handleStepUp = useCallback(() => {
    if (state.isAnimating) return;
    setState(prev => ({ ...prev, isAnimating: true }));
    onStepUp();
    setTimeout(() => setState(prev => ({ ...prev, isAnimating: false })), 350);
  }, [onStepUp, state.isAnimating]);

  const handleStepDown = useCallback(() => {
    if (state.isAnimating) return;
    setState(prev => ({ ...prev, isAnimating: true }));
    onStepDown();
    setTimeout(() => setState(prev => ({ ...prev, isAnimating: false })), 350);
  }, [onStepDown, state.isAnimating]);

  // Handle mouse events
  const handleTabMouseEnter = useCallback((tabIndex: number) => {
    setState(prev => ({ ...prev, hoveredTab: tabIndex }));
  }, []);

  const handleTabMouseLeave = useCallback(() => {
    setState(prev => ({ ...prev, hoveredTab: null }));
  }, []);

  // Early return if no controls to show
  if (!showZoomControls && !showLevelPicker) {
    return null;
  }

  // Base classes
  const containerClasses = `
    header-level-picker
    ${compact ? 'compact' : ''}
    ${state.isAnimating ? 'animating' : ''}
    ${className}
  `.trim();

  return (
    <div className={containerClasses}>
      {/* Level Picker Tabs */}
      {showLevelPicker && tabs.length > 1 && (
        <div className="level-picker-tabs">
          <div className="tabs-container">
            {tabs.map((tab, index) => {
              const isActive = index === currentTab;
              const isHovered = state.hoveredTab === index;
              const isDisabled = state.isAnimating;

              const tabClasses = `
                level-tab
                ${isActive ? 'active' : ''}
                ${isHovered ? 'hovered' : ''}
                ${isDisabled ? 'disabled' : ''}
              `.trim();

              return (
                <button
                  key={tab.id}
                  className={tabClasses}
                  onClick={() => handleTabSelect(index)}
                  onMouseEnter={() => handleTabMouseEnter(index)}
                  onMouseLeave={handleTabMouseLeave}
                  disabled={isDisabled}
                  aria-pressed={isActive}
                  title={`Show ${tab.label} (${tab.nodeCount} nodes)`}
                >
                  <div className="tab-content">
                    <span className="tab-label">
                      {tab.label}
                    </span>
                    {!compact && (
                      <span className="tab-levels">
                        Levels {Math.min(...tab.levels)}-{Math.max(...tab.levels)}
                      </span>
                    )}
                    <span className="tab-badge">
                      {tab.nodeCount}
                    </span>
                  </div>

                  {/* Active indicator */}
                  {isActive && (
                    <div className="active-indicator" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Current level indicator */}
          <div className="current-levels">
            <span className="levels-label">
              Showing levels: {tabs[currentTab]?.levels.join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* Zoom Controls */}
      {showZoomControls && (
        <div className="zoom-controls">
          {/* Step navigation (3D camera) */}
          <div className="step-controls">
            <button
              className="step-button step-up"
              onClick={handleStepUp}
              disabled={state.isAnimating}
              title="Step up hierarchy"
            >
              <ChevronUp className="step-icon" />
              {!compact && <span>Up</span>}
            </button>

            <div className="current-zoom">
              <span className="zoom-level">
                {zoomState.levelLabels[zoomState.currentLevel] || 'Detail'}
              </span>
              {!compact && (
                <span className="zoom-info">
                  {zoomState.currentLevel + 1} of {zoomState.maxLevel + 1}
                </span>
              )}
            </div>

            <button
              className="step-button step-down"
              onClick={handleStepDown}
              disabled={state.isAnimating}
              title="Step down hierarchy"
            >
              <ChevronDown className="step-icon" />
              {!compact && <span>Down</span>}
            </button>
          </div>

          {/* Zoom in/out controls */}
          <div className="zoom-buttons">
            <button
              className="zoom-button zoom-in"
              onClick={handleZoomIn}
              disabled={!zoomState.canZoomIn || state.isAnimating}
              title="Zoom in (more detail)"
            >
              <ZoomIn className="zoom-icon" />
              {!compact && <span>Zoom In</span>}
            </button>

            <button
              className="zoom-button zoom-out"
              onClick={handleZoomOut}
              disabled={!zoomState.canZoomOut || state.isAnimating}
              title="Zoom out (less detail)"
            >
              <ZoomOut className="zoom-icon" />
              {!compact && <span>Zoom Out</span>}
            </button>
          </div>
        </div>
      )}

      {/* Animation state indicator (for debugging) */}
      {state.isAnimating && (
        <div className="animation-indicator">
          <div className="spinner" />
        </div>
      )}
    </div>
  );
};

// CSS-in-JS styles (could be moved to external stylesheet)
const styles = `
  .header-level-picker {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    position: relative;
  }

  .header-level-picker.compact {
    padding: 8px 12px;
    gap: 8px;
  }

  .header-level-picker.animating {
    pointer-events: none;
    opacity: 0.8;
  }

  /* Level Picker Tabs */
  .level-picker-tabs {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tabs-container {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .tabs-container::-webkit-scrollbar {
    display: none;
  }

  .level-tab {
    position: relative;
    flex-shrink: 0;
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 8px 12px;
    cursor: pointer;
    transition: all 200ms ease;
    min-width: 100px;
  }

  .level-tab:hover:not(.disabled) {
    border-color: #6b7280;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .level-tab.active {
    background: #3b82f6;
    border-color: #3b82f6;
    color: white;
  }

  .level-tab.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tab-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: center;
  }

  .tab-label {
    font-weight: 600;
    font-size: 13px;
    line-height: 1.2;
  }

  .tab-levels {
    font-size: 11px;
    opacity: 0.7;
  }

  .tab-badge {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 10px;
    padding: 2px 6px;
    font-size: 10px;
    font-weight: 500;
    align-self: center;
    min-width: 20px;
  }

  .level-tab.active .tab-badge {
    background: rgba(255, 255, 255, 0.2);
  }

  .active-indicator {
    position: absolute;
    bottom: -1px;
    left: 50%;
    transform: translateX(-50%);
    width: 20px;
    height: 2px;
    background: currentColor;
    border-radius: 1px;
  }

  .current-levels {
    display: flex;
    justify-content: center;
    padding: 4px 8px;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 4px;
  }

  .levels-label {
    font-size: 11px;
    color: #374151;
    font-weight: 500;
  }

  /* Zoom Controls */
  .zoom-controls {
    display: flex;
    gap: 12px;
    justify-content: space-between;
    align-items: center;
  }

  .step-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .step-button {
    display: flex;
    align-items: center;
    gap: 4px;
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 6px 10px;
    cursor: pointer;
    transition: all 150ms ease;
    font-size: 12px;
  }

  .step-button:hover:not(:disabled) {
    border-color: #6b7280;
    background: #f9fafb;
  }

  .step-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .step-icon {
    width: 14px;
    height: 14px;
  }

  .current-zoom {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 80px;
  }

  .zoom-level {
    font-weight: 600;
    font-size: 12px;
    color: #374151;
  }

  .zoom-info {
    font-size: 10px;
    color: #6b7280;
  }

  .zoom-buttons {
    display: flex;
    gap: 4px;
  }

  .zoom-button {
    display: flex;
    align-items: center;
    gap: 4px;
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 6px 10px;
    cursor: pointer;
    transition: all 150ms ease;
    font-size: 12px;
  }

  .zoom-button:hover:not(:disabled) {
    border-color: #3b82f6;
    color: #3b82f6;
  }

  .zoom-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .zoom-icon {
    width: 14px;
    height: 14px;
  }

  /* Animation indicator */
  .animation-indicator {
    position: absolute;
    top: 8px;
    right: 8px;
  }

  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Compact mode adjustments */
  .header-level-picker.compact .tab-content {
    gap: 1px;
  }

  .header-level-picker.compact .tab-label {
    font-size: 12px;
  }

  .header-level-picker.compact .tab-badge {
    font-size: 9px;
    padding: 1px 4px;
  }

  .header-level-picker.compact .current-levels {
    display: none;
  }

  .header-level-picker.compact .current-zoom {
    min-width: 60px;
  }

  .header-level-picker.compact .zoom-info {
    display: none;
  }

  /* Responsive design */
  @media (max-width: 640px) {
    .zoom-controls {
      flex-direction: column;
      gap: 8px;
    }

    .step-controls,
    .zoom-buttons {
      width: 100%;
      justify-content: space-between;
    }

    .current-zoom {
      order: -1;
      margin-bottom: 4px;
    }
  }
`;

// Inject styles if not already present
if (typeof document !== 'undefined' && !document.getElementById('header-level-picker-styles')) {
  const styleElement = document.createElement('style');
  styleElement.id = 'header-level-picker-styles';
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

export default HeaderLevelPicker;