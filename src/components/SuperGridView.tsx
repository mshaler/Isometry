/**
 * SuperGridView - Complete Super* Feature Integration for Unified UI
 *
 * Revolutionary polymorphic data projection platform with:
 * - SuperGrid: Grid Continuum (Gallery → List → Kanban → 2D Grid → SuperGrid)
 * - SuperStack: Nested PAFV headers with visual spanning
 * - SuperDynamic: Drag-and-drop axis repositioning
 * - Janus Density Model: Four-quadrant Pan × Zoom orthogonal control
 * - SuperCalc: PAFV-aware formula bar
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import { contextLogger } from '../utils/logging/dev-logger';
import { D3SparsityLayer } from './D3SparsityLayer';
import { D3Canvas } from './d3/Canvas';
import { SuperGrid } from './supergrid/SuperGrid';
import { SuperDynamic } from './supergrid/SuperDynamic';
import { SuperCalc } from './supergrid/SuperCalc';
import { SuperDensity } from './supergrid/SuperDensity';
import type { DensityChangeEvent } from '@/types/supergrid';
import { createD3CoordinateSystem } from '@/utils/coordinate-system/coordinates';
import { useFilteredNodes, useLiveQuery, usePAFV } from '@/hooks';
import type { Node } from '@/types/node';
import type { AxisMapping } from '@/types/pafv';
import type { OriginPattern } from '@/types/coordinates';
import type { ZoomTransform } from '@/hooks/visualization/useD3Zoom';

interface SuperGridViewProps {
  /** SQL query to execute for live data */
  sql?: string;
  /** Parameters for the SQL query */
  queryParams?: unknown[];
  /** Callback when node is clicked */
  onNodeClick?: (node: Node) => void;
  /** Render mode: 'supergrid' for full features, 'legacy' for compatibility */
  renderMode?: 'supergrid' | 'legacy' | 'canvas';
  /** Enable all Super* features */
  enableSuperFeatures?: boolean;
}

// Available LATCH axes for SuperDynamic
const AVAILABLE_AXES = [
  { id: 'category-folder', label: 'Category → Folder', description: 'Organize by folder/project grouping' },
  { id: 'category-status', label: 'Category → Status', description: 'Group by completion status' },
  { id: 'category-tags', label: 'Category → Tags', description: 'Group by tag categories' },
  { id: 'time-month', label: 'Time → Month', description: 'Chronological by month' },
  { id: 'time-year', label: 'Time → Year', description: 'Chronological by year' },
  { id: 'time-quarter', label: 'Time → Quarter', description: 'Chronological by quarter' },
  { id: 'alphabet-name', label: 'Alphabet → Name', description: 'Alphabetical by first letter' },
  { id: 'hierarchy-priority', label: 'Hierarchy → Priority', description: 'By importance/priority level' },
  { id: 'hierarchy-size', label: 'Hierarchy → Size', description: 'By file/content size' },
  { id: 'location-geographic', label: 'Location → Geographic', description: 'By geographic location' },
  { id: 'location-virtual', label: 'Location → Virtual', description: 'By URL domain or path' }
];

/**
 * SuperGrid integration for Unified UI Canvas with complete Super* features
 */
// Helper functions to reduce main component complexity

/** Get the appropriate data source based on render mode */
function useDataSource(renderMode: string, sql: string) {
  const { data: filterNodes, loading: filterLoading, error: filterError } = useFilteredNodes();
  const { data: queryNodes, error: queryError } = useLiveQuery<Node>(sql, {
    autoStart: renderMode === 'canvas'
  });

  return {
    nodes: renderMode === 'canvas' ? queryNodes : filterNodes,
    loading: renderMode === 'canvas' ? false : filterLoading,
    error: renderMode === 'canvas' ? queryError : filterError
  };
}

/** Extract current axis mappings from PAFV state */
function useAxisMappings(pafvState: unknown) {
  const xMapping = pafvState.mappings.find((m: AxisMapping) => m.plane === 'x');
  const yMapping = pafvState.mappings.find((m: AxisMapping) => m.plane === 'y');

  return {
    currentXAxis: xMapping?.axis || 'category',
    currentXFacet: xMapping?.facet || 'folder',
    currentYAxis: yMapping?.axis || 'time',
    currentYFacet: yMapping?.facet || 'month'
  };
}

/** Render loading state */
function LoadingState() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-600">
        Loading SuperGrid with Super* features...
      </div>
    </div>
  );
}

/** Render error state */
function ErrorState({ error }: { error: unknown }) {
  const errorMessage = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : 'Unknown error';

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-red-600">
        SuperGrid Error: {errorMessage}
      </div>
    </div>
  );
}

/** Render empty state */
function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-400 text-center">
        <div className="text-4xl mb-4">📊</div>
        <div>No data found for SuperGrid</div>
        <div className="text-sm mt-2">Connect a data source to begin</div>
      </div>
    </div>
  );
}

/** Render node count indicator */
function NodeCountIndicator({ count, mode, color }: { count: number; mode: string; color: string }) {
  return (
    <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-sm p-2 text-xs">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span>{count} nodes</span>
        <span className="text-gray-500">|</span>
        <span>{mode}</span>
      </div>
    </div>
  );
}

/** Render legacy mode view */
function LegacyModeView({
  nodes,
  d3CoordinateSystem,
  currentXAxis,
  currentXFacet,
  currentYAxis,
  currentYFacet,
  originPattern,
  onCellClick,
  onZoomChange
}: {
  nodes: Node[];
  d3CoordinateSystem: unknown;
  currentXAxis: string;
  currentXFacet: string;
  currentYAxis: string;
  currentYFacet: string;
  originPattern: OriginPattern;
  onCellClick: (node: Node) => void;
  onZoomChange: (transform: ZoomTransform) => void;
}) {
  return (
    <div className="w-full h-full relative">
      <NodeCountIndicator
        count={nodes.length}
        mode="Legacy Mode"
        color="bg-orange-500"
      />
      <D3SparsityLayer
        data={nodes}
        coordinateSystem={d3CoordinateSystem}
        xAxis={currentXAxis}
        xAxisFacet={currentXFacet}
        yAxis={currentYAxis}
        yAxisFacet={currentYFacet}
        originPattern={originPattern}
        onCellClick={onCellClick}
        onZoomChange={onZoomChange}
        width={window.innerWidth}
        height={window.innerHeight}
      />
    </div>
  );
}

/** Render canvas mode view */
function CanvasModeView({
  nodes,
  sql,
  queryParams,
  onCellClick
}: {
  nodes: Node[];
  sql: string;
  queryParams: unknown[];
  onCellClick: (node: Node) => void;
}) {
  return (
    <div className="w-full h-full relative">
      <NodeCountIndicator
        count={nodes.length}
        mode="D3 Canvas"
        color="bg-green-500"
      />
      <D3Canvas
        sql={sql}
        queryParams={queryParams}
        onNodeClick={onCellClick}
        className="w-full h-full"
        enableZoom={true}
        enableBrush={false}
        renderMode="svg"
        maxNodes={1000}
        debounceMs={100}
      />
    </div>
  );
}

export function SuperGridView({
  sql = "SELECT * FROM nodes WHERE deleted_at IS NULL",
  queryParams = [],
  onNodeClick,
  renderMode = 'supergrid',
  enableSuperFeatures = true
}: SuperGridViewProps) {
  // State for Super* features
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [originPattern] = useState<OriginPattern>('anchor');
  const [activeView, setActiveView] = useState<'gallery' | 'list' | 'kanban' | 'grid' | 'supergrid'>('supergrid');
  const [showSuperCalc, setShowSuperCalc] = useState(false);
  const [showSuperDynamic, setShowSuperDynamic] = useState(false);
  const [showJanusDensity, setShowJanusDensity] = useState(false);

  // SuperDynamic axis state
  const [dynamicAxes, setDynamicAxes] = useState({
    x: 'category-folder',
    y: 'time-month',
    z: 'hierarchy-priority'
  });

  // Janus Density state
  const [densityConfig, setDensityConfig] = useState({
    extentMode: 'sparse' as 'sparse' | 'dense',
    valueMode: 'leaf' as 'leaf' | 'rolled',
    zoomLevel: 3,
    panOffset: { x: 0, y: 0 }
  });

  // Data and PAFV hooks
  const pafv = usePAFV();
  const { nodes: primaryNodes, loading: primaryLoading, error: primaryError } = useDataSource(renderMode, sql);
  const axisMappings = useAxisMappings(pafv.state);

  // Create coordinate system
  const d3CoordinateSystem = useMemo(() =>
    createD3CoordinateSystem(originPattern, 120, 60),
    [originPattern]
  );

  // Event handlers
  const handleFormulaExecute = useCallback((formula: string, result: unknown) => {
    contextLogger.metrics('SuperGridView: Formula executed', { formula, result });
  }, []);

  const handleAxisChange = useCallback((axis: 'x' | 'y' | 'z', value: string) => {
    setDynamicAxes(prev => ({ ...prev, [axis]: value }));
    if (axis === 'x' || axis === 'y') {
      const [axisType, facet] = value.split('-');
      contextLogger.state('SuperGridView: Would update PAFV mapping', { axis, axisType, facet });
    }
  }, []);

  const handleDensityChange = useCallback((event: DensityChangeEvent) => {
    const newDensity = {
      extentMode: (event.newState.extentMode || event.newState.extentDensity || 'sparse') as 'sparse' | 'dense',
      valueMode: (event.newState.valueMode || event.newState.valueDensity || 'leaf') as 'leaf' | 'rolled',
      zoomLevel: event.newState.zoomLevel || 3,
      panOffset: event.newState.panOffset || { x: 0, y: 0 }
    };
    setDensityConfig(newDensity);
  }, []);

  const handleCellClick = useCallback((node: Node) => {
    onNodeClick?.(node);
    contextLogger.data('SuperGridView: Cell clicked', { nodeName: node.name });
  }, [onNodeClick]);

  const handleZoomChange = useCallback((transform: ZoomTransform) => {
    setZoomLevel(transform.k);
  }, []);

  // Debug logging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      contextLogger.state('SuperGridView State', {
        renderMode,
        activeView,
        nodes: primaryNodes?.length || 0,
        superFeatures: {
          calc: showSuperCalc,
          dynamic: showSuperDynamic,
          density: showJanusDensity
        },
        axes: dynamicAxes,
        density: densityConfig,
        pafv: {
          x: `${axisMappings.currentXAxis}/${axisMappings.currentXFacet}`,
          y: `${axisMappings.currentYAxis}/${axisMappings.currentYFacet}`
        }
      });
    }
  }, [
    renderMode,
    activeView,
    primaryNodes?.length,
    showSuperCalc,
    showSuperDynamic,
    showJanusDensity,
    dynamicAxes,
    densityConfig,
    axisMappings.currentXAxis,
    axisMappings.currentXFacet,
    axisMappings.currentYAxis,
    axisMappings.currentYFacet
  ]);

  // Early returns for loading, error, and empty states
  if (primaryLoading) return <LoadingState />;
  if (primaryError) return <ErrorState error={primaryError} />;
  if (!primaryNodes || primaryNodes.length === 0) return <EmptyState />;

  // Render mode-specific views
  if (renderMode === 'legacy') {
    return <LegacyModeView
      nodes={primaryNodes}
      d3CoordinateSystem={d3CoordinateSystem}
      currentXAxis={axisMappings.currentXAxis}
      currentXFacet={axisMappings.currentXFacet}
      currentYAxis={axisMappings.currentYAxis}
      currentYFacet={axisMappings.currentYFacet}
      originPattern={originPattern}
      onCellClick={handleCellClick}
      onZoomChange={handleZoomChange}
    />;
  }

  if (renderMode === 'canvas') {
    return <CanvasModeView
      nodes={primaryNodes}
      sql={sql}
      queryParams={queryParams}
      onCellClick={handleCellClick}
    />;
  }

  // SuperGrid mode - Full Super* feature integration
  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* SuperCalc Formula Bar */}
      {enableSuperFeatures && showSuperCalc && (
        <div className="border-b border-gray-200">
          <SuperCalc
            onFormulaExecute={handleFormulaExecute}
            gridData={primaryNodes}
            pafvState={{
              xAxis: dynamicAxes.x,
              yAxis: dynamicAxes.y,
              zAxis: dynamicAxes.z
            }}
            className="m-2"
          />
        </div>
      )}

      {/* Control Panel */}
      {enableSuperFeatures && (
        <div className="bg-gray-50 border-b border-gray-200 p-3">
          <div className="flex items-center justify-between">
            {/* View Mode Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">View:</span>
              <select
                value={activeView}
                onChange={(e) => setActiveView(e.target.value as any)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="gallery">Gallery (0 axes)</option>
                <option value="list">List (1 axis)</option>
                <option value="kanban">Kanban (1 facet)</option>
                <option value="grid">2D Grid (2 axes)</option>
                <option value="supergrid">SuperGrid (n axes)</option>
              </select>
            </div>

            {/* Super* Feature Toggles */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSuperCalc(!showSuperCalc)}
                className={`px-3 py-1 text-xs rounded ${
                  showSuperCalc
                    ? 'bg-purple-100 text-purple-700 border border-purple-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-300'
                }`}
              >
                📊 SuperCalc
              </button>

              <button
                onClick={() => setShowSuperDynamic(!showSuperDynamic)}
                className={`px-3 py-1 text-xs rounded ${
                  showSuperDynamic
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-300'
                }`}
              >
                🎯 SuperDynamic
              </button>

              <button
                onClick={() => setShowJanusDensity(!showJanusDensity)}
                className={`px-3 py-1 text-xs rounded ${
                  showJanusDensity
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-300'
                }`}
              >
                🌊 Janus Density
              </button>

              <div className="text-xs text-gray-500">
                {primaryNodes?.length || 0} nodes
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* SuperDynamic Axis Control Panel */}
        {enableSuperFeatures && showSuperDynamic && (
          <div className="w-80 border-r border-gray-200 bg-gray-50 overflow-y-auto">
            <SuperDynamic
              xAxis={dynamicAxes.x}
              yAxis={dynamicAxes.y}
              zAxis={dynamicAxes.z}
              onAxisChange={handleAxisChange}
              availableAxes={AVAILABLE_AXES}
              className="m-3"
            />
          </div>
        )}

        {/* SuperGrid Main Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Janus Density Controls */}
          {enableSuperFeatures && showJanusDensity && (
            <div className="border-b border-gray-200 bg-white">
              <SuperDensity
                nodes={primaryNodes || []}
                onDensityChange={handleDensityChange}
                activeAxes={['category', 'time', 'hierarchy']}
                debug={process.env.NODE_ENV === 'development'}
              />
            </div>
          )}

          {/* SuperGrid Visualization */}
          <div className="flex-1 overflow-hidden">
            <SuperGrid
              sql={sql}
              params={queryParams}
              mode={activeView}
              enableSuperStack={true}
              enableDragDrop={showSuperDynamic}
              maxHeaderLevels={3}
              onCellClick={handleCellClick}
            />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-gray-50 border-t border-gray-200 px-3 py-2 text-xs text-gray-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span>Mode: {activeView}</span>
            <span>Axes: {dynamicAxes.x} × {dynamicAxes.y}</span>
            {enableSuperFeatures && showJanusDensity && (
              <span>Density: {densityConfig.extentMode}-{densityConfig.valueMode}</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>Zoom: {zoomLevel.toFixed(1)}x</span>
            <span>Rendered: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}