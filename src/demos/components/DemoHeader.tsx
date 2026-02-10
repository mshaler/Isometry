/**
 * Demo header component with comprehensive controls
 */

import { ViewSwitcher } from '../../components/ViewSwitcher';
import { FilterChip } from './FilterChip';
import type { ViewType } from '../../types/views';
import type { LATCHFilter } from '../../services/query/LATCHFilterService';
import type { PerformanceMetrics, ProgressiveDisclosureState, JanusDensityState, ViewAxisMapping } from '../types';

interface DemoHeaderProps {
  selectedCardsCount: number;
  performanceMetrics: PerformanceMetrics;
  progressiveState: ProgressiveDisclosureState;
  axisMapping: ViewAxisMapping;
  isDragInProgress: boolean;
  janusState: JanusDensityState;
  zoomTransform: { x: number; y: number; k: number };
  activeFilters: LATCHFilter[];
  currentView: ViewType;
  onLevelTabChange: (tabIndex: number) => void;
  onZoomLevelChange: (level: number) => void;
  onAxisRepositioning: (newMapping: ViewAxisMapping) => void;
  onValueDensityChange: (mode: 'leaf' | 'collapsed') => void;
  onExtentDensityChange: (mode: 'sparse' | 'populated-only') => void;
  onCartographicZoom: (transform: { x: number; y: number; k: number }) => void;
  onFilterRemove: (filterId: string) => void;
  onClearAllFilters: () => void;
  onViewChange: (newView: ViewType) => void;
  trackFeatureUsage: (feature: string, data?: unknown) => void;
}

export function DemoHeader({
  selectedCardsCount,
  performanceMetrics,
  progressiveState,
  axisMapping,
  isDragInProgress,
  janusState,
  zoomTransform,
  activeFilters,
  currentView,
  onLevelTabChange,
  onZoomLevelChange,
  onAxisRepositioning,
  onValueDensityChange,
  onExtentDensityChange,
  onCartographicZoom,
  onFilterRemove,
  onClearAllFilters,
  onViewChange,
  trackFeatureUsage
}: DemoHeaderProps) {
  return (
    <div className="flex-none bg-white border-b border-gray-200">
      {/* Main Title and Status */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SuperGrid Integration Demo</h1>
            <p className="text-sm text-gray-600 mt-1">
              Complete feature showcase: SuperStack + SuperDynamic + SuperZoom + Janus Density
            </p>
            {selectedCardsCount > 0 && (
              <p className="text-sm text-blue-600 font-medium mt-1">
                {selectedCardsCount} card{selectedCardsCount > 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* Performance indicator */}
          <div className="text-right">
            <div className="text-sm text-gray-500">Performance</div>
            <div className="text-lg font-mono text-green-600">
              {performanceMetrics.averageFrameRate}fps
            </div>
            <div className="text-xs text-gray-400">
              {performanceMetrics.lastRenderTime.toFixed(1)}ms
            </div>
          </div>
        </div>
      </div>

      {/* Feature Control Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-4">
        {/* SuperStack Controls */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 border-b border-blue-200 pb-1">
            SuperStack (Progressive Disclosure)
          </h3>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">Level:</span>
              <div className="flex border border-gray-300 rounded overflow-hidden">
                {[0, 1, 2, 3].map(level => (
                  <button
                    key={level}
                    onClick={() => onLevelTabChange(level)}
                    className={`px-2 py-1 text-xs ${
                      progressiveState.activeLevelTab === level
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    L{level}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">Zoom:</span>
              <input
                type="range"
                min="0"
                max="3"
                value={progressiveState.zoomLevel}
                onChange={(e) => onZoomLevelChange(parseInt(e.target.value))}
                className="flex-1 h-2"
              />
              <span className="text-xs text-blue-600">{progressiveState.zoomLevel}</span>
            </div>
            {progressiveState.isTransitioning && (
              <div className="text-xs text-orange-500">Transitioning...</div>
            )}
          </div>
        </div>

        {/* SuperDynamic Controls */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 border-b border-green-200 pb-1">
            SuperDynamic (Axis Repositioning)
          </h3>
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-gray-500">X:</span>
              <span className="ml-1 text-gray-700">{axisMapping.xAxis?.label}</span>
            </div>
            <div>
              <span className="text-gray-500">Y:</span>
              <span className="ml-1 text-gray-700">{axisMapping.yAxis?.label}</span>
            </div>
            <div>
              <span className="text-gray-500">Z:</span>
              <span className="ml-1 text-gray-700">{axisMapping.zAxis?.label}</span>
            </div>
            {isDragInProgress && (
              <div className="text-xs text-orange-500">Reflow in progress...</div>
            )}
            <button
              onClick={() => onAxisRepositioning({
                xAxis: axisMapping.yAxis!,
                yAxis: axisMapping.xAxis!,
                zAxis: axisMapping.zAxis
              })}
              className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
            >
              Transpose X↔Y
            </button>
          </div>
        </div>

        {/* Janus Density Controls */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 border-b border-purple-200 pb-1">
            Janus Density (Pan × Zoom)
          </h3>
          <div className="space-y-2">
            <div>
              <div className="text-xs text-gray-500 mb-1">Value Density (Zoom):</div>
              <div className="flex border border-gray-300 rounded overflow-hidden">
                <button
                  onClick={() => onValueDensityChange('leaf')}
                  className={`px-2 py-1 text-xs flex-1 ${
                    janusState.valueDensity === 'leaf'
                      ? 'bg-purple-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Leaf
                </button>
                <button
                  onClick={() => onValueDensityChange('collapsed')}
                  className={`px-2 py-1 text-xs flex-1 border-l ${
                    janusState.valueDensity === 'collapsed'
                      ? 'bg-purple-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Collapsed
                </button>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Extent Density (Pan):</div>
              <div className="flex border border-gray-300 rounded overflow-hidden">
                <button
                  onClick={() => onExtentDensityChange('populated-only')}
                  className={`px-2 py-1 text-xs flex-1 ${
                    janusState.extentDensity === 'populated-only'
                      ? 'bg-purple-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Dense
                </button>
                <button
                  onClick={() => onExtentDensityChange('sparse')}
                  className={`px-2 py-1 text-xs flex-1 border-l ${
                    janusState.extentDensity === 'sparse'
                      ? 'bg-purple-500 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Sparse
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SuperZoom Controls */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 border-b border-orange-200 pb-1">
            SuperZoom (Cartographic)
          </h3>
          <div className="space-y-2">
            <div className="text-xs">
              <div className="text-gray-500">Transform:</div>
              <div className="font-mono text-gray-700">
                x:{zoomTransform.x.toFixed(0)} y:{zoomTransform.y.toFixed(0)} k:{zoomTransform.k.toFixed(2)}
              </div>
            </div>
            <div className="flex space-x-1">
              <button
                onClick={() => onCartographicZoom({ ...zoomTransform, k: Math.min(10, zoomTransform.k * 1.5) })}
                className="flex-1 text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
              >
                Zoom In
              </button>
              <button
                onClick={() => onCartographicZoom({ ...zoomTransform, k: Math.max(0.1, zoomTransform.k / 1.5) })}
                className="flex-1 text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
              >
                Zoom Out
              </button>
            </div>
            <button
              onClick={() => onCartographicZoom({ x: 0, y: 0, k: 1 })}
              className="w-full text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
            >
              Reset View
            </button>
          </div>
        </div>
      </div>

      {/* Active Filters and Quick Actions */}
      <div className="px-4 pb-4">
        {activeFilters.length > 0 && (
          <div className="flex items-center space-x-2 mb-3">
            <span className="text-sm text-gray-500">Active filters:</span>
            <div className="flex flex-wrap gap-2">
              {activeFilters.map(filter => (
                <FilterChip
                  key={filter.id}
                  filter={filter}
                  onRemove={() => onFilterRemove(filter.id)}
                />
              ))}
            </div>
            {activeFilters.length > 1 && (
              <button
                onClick={onClearAllFilters}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          {/* View Switcher */}
          <ViewSwitcher
            currentView={currentView}
            onViewChange={async (newView) => {
              trackFeatureUsage('view-switch', { from: currentView, to: newView });
              onViewChange(newView);
            }}
          />

          {/* Feature Usage Stats */}
          <div className="text-xs text-gray-500">
            <span className="mr-4">
              Interactions: {performanceMetrics.userInteractions.length}
            </span>
            <span>
              Top feature: {
                Object.entries(performanceMetrics.featureUsageCount)
                  .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None'
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}