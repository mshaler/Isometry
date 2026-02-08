/**
 * SuperStack Progressive Disclosure Demo
 *
 * Demonstrates the progressive disclosure system for deep hierarchical headers.
 * Shows how the system automatically manages visual complexity and provides
 * navigation controls when header depth exceeds thresholds.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HeaderLevelPicker } from '../HeaderLevelPicker';
import { SuperGridHeaders } from '../../d3/SuperGridHeaders';
import { HeaderLayoutService } from '../../services/HeaderLayoutService';
import type {
  ProgressiveDisclosureState,
  LevelPickerTab,
  ZoomControlState
} from '../../types/supergrid';

// Mock data generators for demo
const generateDeepHierarchyData = (maxDepth: number) => {
  const data: any[] = [];
  let id = 1;

  // Generate deep hierarchy: Year > Quarter > Month > Week > Day > Hour
  for (let year = 2023; year <= 2024; year++) {
    for (let quarter = 1; quarter <= 4; quarter++) {
      for (let month = 1; month <= 3; month++) {
        const monthIndex = (quarter - 1) * 3 + month;
        for (let week = 1; week <= 4; week++) {
          for (let day = 1; day <= 7; day++) {
            if (maxDepth >= 6) {
              for (let hour = 0; hour < 24; hour += 4) {
                data.push({
                  id: id++,
                  title: `Task ${id}`,
                  year: year.toString(),
                  quarter: `Q${quarter}`,
                  month: `Month ${monthIndex}`,
                  week: `Week ${week}`,
                  day: `Day ${day}`,
                  hour: `${hour}:00`,
                  status: 'active',
                  priority: Math.floor(Math.random() * 3) + 1,
                  created_at: new Date(year, monthIndex - 1, day + week * 7, hour).toISOString()
                });
              }
            } else if (maxDepth >= 5) {
              data.push({
                id: id++,
                title: `Task ${id}`,
                year: year.toString(),
                quarter: `Q${quarter}`,
                month: `Month ${monthIndex}`,
                week: `Week ${week}`,
                day: `Day ${day}`,
                status: 'active',
                priority: Math.floor(Math.random() * 3) + 1,
                created_at: new Date(year, monthIndex - 1, day + week * 7).toISOString()
              });
            } else {
              // Continue reducing depth as needed...
              data.push({
                id: id++,
                title: `Task ${id}`,
                year: year.toString(),
                quarter: `Q${quarter}`,
                month: `Month ${monthIndex}`,
                status: 'active',
                priority: Math.floor(Math.random() * 3) + 1,
                created_at: new Date(year, monthIndex - 1, month).toISOString()
              });
            }
          }
        }
      }
    }
  }

  return data.slice(0, 500); // Limit for demo performance
};

interface SuperStackProgressiveDemoProps {
  maxDepth?: number;
  className?: string;
}

export const SuperStackProgressiveDemo: React.FC<SuperStackProgressiveDemoProps> = ({
  maxDepth = 6,
  className = ''
}) => {
  // State management
  const [headerSystem, setHeaderSystem] = useState<SuperGridHeaders | null>(null);
  const [progressiveState, setProgressiveState] = useState<ProgressiveDisclosureState | null>(null);
  const [levelPickerTabs, setLevelPickerTabs] = useState<LevelPickerTab[]>([]);
  const [zoomState, setZoomState] = useState<ZoomControlState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDepth, setSelectedDepth] = useState(maxDepth);

  // Refs
  const svgRef = useRef<SVGSVGElement>(null);
  const layoutServiceRef = useRef<HeaderLayoutService | null>(null);

  // Initialize header system
  useEffect(() => {
    if (!svgRef.current) return;

    try {
      // Create layout service
      const layoutService = new HeaderLayoutService();
      layoutServiceRef.current = layoutService;

      // Create header system with progressive disclosure enabled
      const headers = new SuperGridHeaders(
        svgRef.current,
        layoutService,
        {
          defaultHeaderHeight: 40,
          expandIconSize: 16,
          animationDuration: 300,
          maxVisibleLevels: 3,
          enableProgressiveRendering: true,
          performanceBudgetMs: 16,
          progressiveDisclosure: {
            maxVisibleLevels: 3,
            autoGroupThreshold: 4, // Trigger at 4+ levels
            semanticGroupingEnabled: true,
            dataGroupingFallback: true,
            transitionDuration: 300,
            lazyLoadingBuffer: 2,
            enableZoomControls: true,
            enableLevelPicker: true,
            persistLevelState: false // Disable for demo
          }
        }
      );

      setHeaderSystem(headers);
      setIsLoading(false);

    } catch (error) {
      console.error('Failed to initialize header system:', error);
      setIsLoading(false);
    }
  }, []);

  // Generate and render data when depth or system changes
  useEffect(() => {
    if (!headerSystem) return;

    try {
      const data = generateDeepHierarchyData(selectedDepth);

      console.log(`Generated ${data.length} items with max depth ${selectedDepth}`);

      // Render headers with time axis (deep hierarchy)
      headerSystem.renderHeaders(data, 'time', 'year', 800);

      // Update state from header system
      updateStateFromHeaders();

    } catch (error) {
      console.error('Failed to render headers:', error);
    }
  }, [headerSystem, selectedDepth]);

  // Update state from header system
  const updateStateFromHeaders = useCallback(() => {
    if (!headerSystem) return;

    try {
      const progressive = headerSystem.getProgressiveState();
      const tabs = headerSystem.getLevelPickerTabs();
      const zoom = headerSystem.getZoomControlState();

      setProgressiveState(progressive);
      setLevelPickerTabs(tabs);
      setZoomState(zoom);

      console.log('Progressive state updated:', {
        isActive: headerSystem.isProgressiveDisclosureActive(),
        currentLevels: progressive.currentLevels,
        tabCount: tabs.length,
        zoomLevel: zoom.currentLevel
      });

    } catch (error) {
      console.error('Failed to update state from headers:', error);
    }
  }, [headerSystem]);

  // Event handlers for HeaderLevelPicker
  const handleTabSelect = useCallback((tabIndex: number) => {
    if (!headerSystem) return;

    console.log('Tab selected:', tabIndex);
    headerSystem.selectLevelTab(tabIndex);
    updateStateFromHeaders();
  }, [headerSystem, updateStateFromHeaders]);

  const handleZoomIn = useCallback(() => {
    if (!headerSystem) return;

    console.log('Zooming in');
    headerSystem.zoomIn();
    updateStateFromHeaders();
  }, [headerSystem, updateStateFromHeaders]);

  const handleZoomOut = useCallback(() => {
    if (!headerSystem) return;

    console.log('Zooming out');
    headerSystem.zoomOut();
    updateStateFromHeaders();
  }, [headerSystem, updateStateFromHeaders]);

  const handleStepUp = useCallback(() => {
    if (!headerSystem) return;

    console.log('Stepping up');
    headerSystem.stepUp();
    updateStateFromHeaders();
  }, [headerSystem, updateStateFromHeaders]);

  const handleStepDown = useCallback(() => {
    if (!headerSystem) return;

    console.log('Stepping down');
    headerSystem.stepDown();
    updateStateFromHeaders();
  }, [headerSystem, updateStateFromHeaders]);

  // Handle depth selection change
  const handleDepthChange = useCallback((newDepth: number) => {
    console.log('Changing depth to:', newDepth);
    setSelectedDepth(newDepth);
  }, []);

  if (isLoading) {
    return (
      <div className={`superstack-demo ${className}`}>
        <div className="loading">
          <div className="spinner" />
          <span>Initializing SuperStack Progressive Disclosure...</span>
        </div>
      </div>
    );
  }

  const isProgressiveActive = headerSystem?.isProgressiveDisclosureActive() || false;

  return (
    <div className={`superstack-demo ${className}`}>
      {/* Demo Controls */}
      <div className="demo-controls">
        <h3>SuperStack Progressive Disclosure Demo</h3>

        <div className="depth-selector">
          <label>
            Hierarchy Depth:
            <select value={selectedDepth} onChange={(e) => handleDepthChange(parseInt(e.target.value))}>
              <option value={3}>3 levels (Year → Quarter → Month)</option>
              <option value={4}>4 levels (... → Week)</option>
              <option value={5}>5 levels (... → Day)</option>
              <option value={6}>6 levels (... → Hour)</option>
            </select>
          </label>
        </div>

        <div className="progressive-status">
          <span className={`status-indicator ${isProgressiveActive ? 'active' : 'inactive'}`}>
            Progressive Disclosure: {isProgressiveActive ? 'ACTIVE' : 'Inactive'}
          </span>
          {progressiveState && (
            <span className="current-levels">
              Showing levels: {progressiveState.currentLevels.join(', ')}
            </span>
          )}
        </div>
      </div>

      {/* Progressive Controls */}
      {isProgressiveActive && progressiveState && zoomState && (
        <HeaderLevelPicker
          tabs={levelPickerTabs}
          currentTab={progressiveState.activeLevelTab}
          onTabSelect={handleTabSelect}
          zoomState={zoomState}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onStepUp={handleStepUp}
          onStepDown={handleStepDown}
          showZoomControls={true}
          showLevelPicker={true}
          className="demo-level-picker"
        />
      )}

      {/* Header Visualization */}
      <div className="header-visualization">
        <svg
          ref={svgRef}
          width="100%"
          height="300"
          className="headers-svg"
        >
          {/* Headers will be rendered here by D3 */}
        </svg>
      </div>

      {/* State Information */}
      <div className="state-info">
        <h4>Current State</h4>
        {progressiveState && (
          <div className="state-details">
            <div>
              <strong>Visible Levels:</strong> {progressiveState.currentLevels.join(', ')}
            </div>
            <div>
              <strong>Active Tab:</strong> {progressiveState.activeLevelTab}
            </div>
            <div>
              <strong>Zoom Level:</strong> {progressiveState.zoomLevel}
            </div>
            <div>
              <strong>Level Groups:</strong> {progressiveState.availableLevelGroups.length}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .superstack-demo {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 20px;
          background: #f9fafb;
          border-radius: 8px;
        }

        .demo-controls {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
          background: white;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }

        .demo-controls h3 {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 600;
          color: #374151;
        }

        .depth-selector label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 500;
        }

        .depth-selector select {
          padding: 4px 8px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-size: 14px;
        }

        .progressive-status {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .status-indicator {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-indicator.active {
          background: #dcfce7;
          color: #166534;
        }

        .status-indicator.inactive {
          background: #fef3c7;
          color: #92400e;
        }

        .current-levels {
          font-size: 12px;
          color: #6b7280;
          font-family: monospace;
        }

        .demo-level-picker {
          background: white;
          border-radius: 6px;
        }

        .header-visualization {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          overflow: hidden;
        }

        .headers-svg {
          display: block;
        }

        .state-info {
          background: white;
          padding: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
        }

        .state-info h4 {
          margin: 0 0 8px 0;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
        }

        .state-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 13px;
          color: #6b7280;
        }

        .state-details strong {
          color: #374151;
        }

        .loading {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 40px;
          text-align: center;
          color: #6b7280;
        }

        .spinner {
          width: 16px;
          height: 16px;
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
      `}</style>
    </div>
  );
};

export default SuperStackProgressiveDemo;