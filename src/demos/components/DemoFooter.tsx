/**
 * Demo footer with feature status indicators
 */

import type { PerformanceMetrics, ProgressiveDisclosureState, JanusDensityState } from '../types';
import type { SuperGrid } from '../../d3/SuperGrid';

interface DemoFooterProps {
  superGrid: SuperGrid | null;
  progressiveState: ProgressiveDisclosureState;
  isDragInProgress: boolean;
  janusState: JanusDensityState;
  zoomTransform: { x: number; y: number; k: number };
  performanceMetrics: PerformanceMetrics;
}

export function DemoFooter({
  superGrid,
  progressiveState,
  isDragInProgress,
  janusState,
  zoomTransform,
  performanceMetrics
}: DemoFooterProps) {
  return (
    <div className="flex-none bg-gray-100 border-t border-gray-200 p-2">
      <div className="flex items-center justify-between text-xs text-gray-600">
        <div className="flex space-x-4">
          <span>🚀 SuperGrid Core: {superGrid ? 'Ready' : 'Loading'}</span>
          <span>📚 SuperStack: {progressiveState.isTransitioning ? 'Transitioning' : 'Ready'}</span>
          <span>🔄 SuperDynamic: {isDragInProgress ? 'Reflowing' : 'Ready'}</span>
          <span>🎛️ Janus: {janusState.valueDensity}/{janusState.extentDensity}</span>
          <span>🔍 SuperZoom: {zoomTransform.k.toFixed(2)}x</span>
        </div>
        <div>
          <span className="font-medium">Performance Target: 60fps</span>
          <span className={`ml-2 ${performanceMetrics.averageFrameRate >= 60 ? 'text-green-600' : 'text-yellow-600'}`}>
            Current: {performanceMetrics.averageFrameRate}fps
          </span>
        </div>
      </div>
    </div>
  );
}