import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { SuperGridV4 } from '../d3/SuperGridV4';
import type { Database } from 'sql.js-fts5';
import type {
  GridConfig,
  ProgressiveDisclosureConfig,
  LevelGroup
} from '../types/supergrid';
import { DEFAULT_PROGRESSIVE_CONFIG } from '../types/supergrid';
import { devLogger } from '../utils/logging';

interface SuperGridV4DemoProps {
  database?: Database;
  className?: string;
}

/**
 * SuperGrid v4 Demo Component
 *
 * Demonstrates the bridge-free architecture:
 * - Direct sql.js → D3.js data binding
 * - Progressive Disclosure for deep hierarchies
 * - PAFV axis mapping
 * - Zero serialization overhead
 */

export function SuperGridV4Demo({ database, className }: SuperGridV4DemoProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const superGridRef = useRef<SuperGridV4 | null>(null);

  // Component state
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedAxis, setSelectedAxis] = useState({ x: 'status', y: 'priority' });
  const [availableLevelGroups, setAvailableLevelGroups] = useState<LevelGroup[]>([]);
  const [currentLevels, setCurrentLevels] = useState<number[]>([0, 1, 2]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Grid configuration
  const gridConfig: GridConfig = {
    xAxisRange: { min: 0, max: 10, count: 11 },
    yAxisRange: { min: 0, max: 10, count: 11 },
    cellWidth: 80,
    cellHeight: 60,
    headerWidth: 120,
    headerHeight: 40
  };

  const progressiveConfig: ProgressiveDisclosureConfig = {
    ...DEFAULT_PROGRESSIVE_CONFIG,
    maxVisibleLevels: 4,
    autoGroupThreshold: 8,
    transitionDuration: 250
  };

  // Initialize SuperGrid with database
  const initializeGrid = useCallback(async () => {
    if (!svgRef.current || !database) return;

    try {
      setIsLoading(true);
      setError(null);

      const svg = d3.select(svgRef.current);

      // Create SuperGrid instance - cast SVGSVGElement to SVGElement for compatibility
      const grid = new SuperGridV4(svg as any, database, gridConfig, progressiveConfig);

      // Set up callbacks
      grid.setCallbacks({
        onCellClick: (cell, position) => {
          devLogger.debug('Cell clicked', { component: 'SuperGridV4Demo', cell, position });
        },
        onCellHover: (cell) => {
          if (cell) {
            devLogger.debug('Cell hover', { component: 'SuperGridV4Demo', cardCount: cell.cards.length });
          }
        },
        onLevelChange: (newLevels, groupId) => {
          devLogger.debug('Level changed', { component: 'SuperGridV4Demo', newLevels, groupId });
          setCurrentLevels(newLevels);
        },
        onZoomChange: (zoomLevel, direction) => {
          devLogger.debug('Zoom changed', { component: 'SuperGridV4Demo', zoomLevel, direction });
        }
      });

      // Load initial data
      await grid.loadData(selectedAxis.x, selectedAxis.y);

      // Update component state
      setAvailableLevelGroups(grid.getAvailableLevelGroups());
      superGridRef.current = grid;
      setIsInitialized(true);

    } catch (err: any) {
      console.error('[SuperGrid] Initialization failed:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [database, selectedAxis, gridConfig, progressiveConfig]);

  // Handle axis changes
  const handleAxisChange = useCallback(async (axis: 'x' | 'y', field: string) => {
    if (!superGridRef.current) return;

    const newAxis = { ...selectedAxis, [axis]: field };
    setSelectedAxis(newAxis);

    try {
      setIsLoading(true);
      await superGridRef.current.loadData(newAxis.x, newAxis.y);
      setAvailableLevelGroups(superGridRef.current.getAvailableLevelGroups());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedAxis]);

  // Handle level group selection
  const handleLevelGroupChange = useCallback((groupId: string) => {
    if (!superGridRef.current) return;

    const group = availableLevelGroups.find(g => g.id === groupId);
    if (group) {
      superGridRef.current.setVisibleLevels(group.levels, groupId);
    }
  }, [availableLevelGroups]);

  // Initialize on mount
  useEffect(() => {
    initializeGrid();

    return () => {
      if (superGridRef.current) {
        superGridRef.current.destroy();
        superGridRef.current = null;
      }
    };
  }, [initializeGrid]);

  return (
    <div className={`supergrid-v4-demo ${className || ''}`}>
      {/* Controls */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
        <h3 className="text-lg font-semibold mb-3">SuperGrid v4 Controls</h3>

        {/* PAFV Axis Mapping */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              X-Axis (Columns)
            </label>
            <select
              value={selectedAxis.x}
              onChange={(e) => handleAxisChange('x', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md text-sm"
              disabled={isLoading}
            >
              <option value="status">Status (Category)</option>
              <option value="priority">Priority (Hierarchy)</option>
              <option value="created_at">Created Date (Time)</option>
              <option value="modified_at">Modified Date (Time)</option>
              <option value="location_name">Location (Location)</option>
              <option value="name">Name (Alphabet)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Y-Axis (Rows)
            </label>
            <select
              value={selectedAxis.y}
              onChange={(e) => handleAxisChange('y', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md text-sm"
              disabled={isLoading}
            >
              <option value="priority">Priority (Hierarchy)</option>
              <option value="status">Status (Category)</option>
              <option value="created_at">Created Date (Time)</option>
              <option value="modified_at">Modified Date (Time)</option>
              <option value="location_name">Location (Location)</option>
              <option value="name">Name (Alphabet)</option>
            </select>
          </div>
        </div>

        {/* Progressive Disclosure Controls */}
        {availableLevelGroups.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Level Groups (Progressive Disclosure)
            </label>
            <div className="flex flex-wrap gap-2">
              {availableLevelGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => handleLevelGroupChange(group.id)}
                  className={`px-3 py-1 rounded-md text-sm border ${
                    group.isRecommended
                      ? 'bg-blue-100 border-blue-300 text-blue-800'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                  disabled={isLoading}
                >
                  {group.name}
                  <span className="ml-1 text-xs opacity-75">
                    ({group.nodeCount} nodes)
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-2 text-xs text-gray-600">
              Current levels: [{currentLevels.join(', ')}]
            </div>
          </div>
        )}

        {/* Status Display */}
        <div className="mt-4 flex items-center gap-4 text-sm">
          <div className={`px-2 py-1 rounded ${
            isInitialized ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {isInitialized ? '✅ SuperGrid Ready' : '⏳ Initializing...'}
          </div>

          {isLoading && (
            <div className="px-2 py-1 rounded bg-blue-100 text-blue-800">
              🔄 Loading Data...
            </div>
          )}

          {error && (
            <div className="px-2 py-1 rounded bg-red-100 text-red-800">
              ❌ {error}
            </div>
          )}
        </div>
      </div>

      {/* SuperGrid Visualization */}
      <div className="border rounded-lg bg-white overflow-hidden">
        <svg
          ref={svgRef}
          width="800"
          height="600"
          className="w-full"
          style={{ minHeight: '400px' }}
        >
          {!isInitialized && (
            <text
              x="400"
              y="300"
              textAnchor="middle"
              className="text-gray-400"
              fontSize="16"
            >
              {isLoading ? 'Initializing SuperGrid...' : 'SuperGrid will appear here'}
            </text>
          )}
        </svg>
      </div>

      {/* Architecture Info */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
        <strong>🔧 v4 Architecture:</strong> This SuperGrid uses direct sql.js → D3.js binding with zero serialization.
        Data flows: SQLite WASM → D3 enter/update/exit → SVG DOM. No MessageBridge, no async complexity.
        <div className="mt-1 text-blue-700">
          <strong>PAFV Mapping:</strong> {selectedAxis.x} (X) × {selectedAxis.y} (Y) → Spatial projection
        </div>
      </div>
    </div>
  );
}

// Export for use in other components
export default SuperGridV4Demo;