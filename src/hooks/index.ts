// Database hooks
export { useSQLiteQuery, useNodes } from './database/useSQLiteQuery';
export { useFTS5Search } from './database/useFTS5Search';
export { useLiveQuery } from './database/useLiveQuery';
export { useLiveData } from './database/useLiveData';
export type { FTS5Result, FTS5SearchState } from './database/useFTS5Search';

// Visualization hooks
export { useD3, useResizeObserver } from './visualization/useD3';
// Removed: useD3Canvas, useD3Visualization - these import contexts creating circular deps
export { useD3Zoom } from './visualization/useD3Zoom';
export { useGridCoordinates } from './visualization/useGridCoordinates';
export { useCoordinates } from './visualization/useCoordinates';
export { useCardPosition } from './visualization/useCardPosition';
export { useMapMarkers } from './visualization/useMapMarkers';
export { useNodeTree } from './visualization/useNodeTree';
export type { UseCoordinatesResult, UseCoordinatesOptions } from './visualization/useCoordinates';

// UI hooks
export { useMarkdownEditor } from './ui/useMarkdownEditor';
export { useSlashCommands } from './ui/useSlashCommands';
export { useWebPreview } from './ui/useWebPreview';

// System hooks
export { useTerminal } from './system/useTerminal';
export { useConflictResolution } from './system/useConflictResolution';
export { useNotebookIntegration } from './system/useNotebookIntegration';

// Performance hooks
export { useD3Performance, useD3PerformanceWithMonitor } from './performance/useD3Performance';
// export { useRenderingOptimization } from './performance/useRenderingOptimization'; // Disabled - missing dependencies
export { useVirtualLiveQuery } from './performance/useVirtualLiveQuery';
// export { useVirtualizedGrid } from './performance/useVirtualizedGrid'; // Disabled - missing dependencies
export { useVirtualizedList } from './performance/useVirtualizedList';
export { useNotebookPerformance } from './performance/useNotebookPerformance';

// Performance types
// export type { OptimizationPlan } from './performance/useRenderingOptimization'; // Disabled - missing dependencies
export type { VirtualLiveQueryOptions } from './performance/useVirtualLiveQuery';
export type { PerformanceMetrics } from '../types/performance';
export type { PerformanceAlert, OptimizationSuggestion } from '../utils/performance/performance-monitor';
export type { AnalyticsMetrics } from '../utils/performance/performance-monitor';
export type { LiveDataPerformanceMetrics } from './database/useLiveData';

// Data hooks
export { useAllTags as useTagColors } from './data/useTagColors';
export { usePAFV } from './data/usePAFV';
// Removed: usePAFVLiveData - imports contexts creating circular deps
export { useFilteredNodes } from './data/useFilteredNodes';

// Database hooks (additional)
export { useDatabaseService } from './database/useDatabaseService';
export { useNetworkAwareSync } from './database/useNetworkAwareSync';

// UI hooks (additional)
export {
  useThemeClasses,
  useThemeValues,
  useButtonTheme,
  usePanelTheme,
  useInputTheme,
  useDropdownTheme,
  useCardTheme,
  useBadgeTheme,
  useTableTheme,
  useCanvasTheme,
  useTextTheme
} from './ui/useComponentTheme';
export { useURLState } from './ui/useURLState';
