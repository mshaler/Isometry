/**
 * GSD Services - File synchronization for Get Shit Done workflow
 */

// File Watcher
export { GSDFileWatcher, type GSDFileChangeEvent } from './gsdFileWatcher';

// Types
export type {
  GSDTask,
  MustHaveArtifact,
  MustHaveKeyLink,
  MustHaves,
  ParsedPlanFile,
  PlanFrontmatter,
  TaskStatus,
  TaskType,
} from './gsdTypes';

// File parsing
export {
  extractTasks,
  normalizeTaskStatus,
  parseGSDPlanContent,
  parseGSDPlanFile,
} from './gsdFileParser';

// File writing
export { updateTaskStatus, writeGSDPlanFile } from './gsdFileWriter';

// Sync service
export {
  GSDFileSyncService,
  type GSDSyncMessage,
  type GSDSyncResponse,
} from './gsdFileSyncService';

// Conflict resolution
export {
  applyResolution,
  detectConflict,
  formatConflictSummary,
  type ConflictData,
  type ConflictResolution,
  type TaskDiff,
} from './gsdConflictResolver';
