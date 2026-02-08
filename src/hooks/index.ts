// Database hooks
export { useSQLiteQuery, useNodes } from './database/useSQLiteQuery';
export { useFTS5Search } from './database/useFTS5Search';
export { useLiveQuery } from './database/useLiveQuery';
export type { FTS5Result, FTS5SearchState } from './database/useFTS5Search';

// Visualization hooks
export { useD3, useResizeObserver } from './visualization/useD3';
export { useD3Canvas } from './visualization/useD3Canvas';
export { useD3Visualization } from './visualization/useD3Visualization';
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

// Data hooks
export { useAllTags as useTagColors } from './data/useTagColors';
