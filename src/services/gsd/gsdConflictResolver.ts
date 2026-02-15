/**
 * GSD Conflict Resolver - Detects and resolves concurrent file edits
 *
 * When Claude Code modifies a PLAN.md file while the user has unsaved UI changes,
 * this module detects the conflict and provides resolution options.
 */

import type { ParsedPlanFile, TaskStatus } from './gsdTypes';

/**
 * Represents a single task difference between file and UI versions
 */
export interface TaskDiff {
  taskIndex: number;
  taskName: string;
  field: 'status';
  fileValue: TaskStatus;
  uiValue: TaskStatus;
}

/**
 * Complete conflict data including both versions and their differences
 */
export interface ConflictData {
  planPath: string;
  fileVersion: ParsedPlanFile;
  uiVersion: ParsedPlanFile;
  timestamp: Date;
  diffs: TaskDiff[];
}

/**
 * User's choice for resolving the conflict
 */
export type ConflictResolution = 'keep_file' | 'keep_ui' | 'cancel';

/**
 * Detect conflicts between file state and UI state
 *
 * A conflict exists when:
 * 1. File has changed since last sync (detected by file watcher)
 * 2. UI has unsaved changes (task statuses differ from last synced state)
 * 3. The changes affect the same tasks
 *
 * @param fileVersion - The current file state from disk
 * @param uiVersion - The current UI state (user's pending changes)
 * @returns ConflictData if differences exist, null if versions match
 */
export function detectConflict(
  fileVersion: ParsedPlanFile,
  uiVersion: ParsedPlanFile
): ConflictData | null {
  const diffs: TaskDiff[] = [];

  // Compare task statuses
  const minLength = Math.min(fileVersion.tasks.length, uiVersion.tasks.length);

  for (let i = 0; i < minLength; i++) {
    const fileTask = fileVersion.tasks[i];
    const uiTask = uiVersion.tasks[i];

    if (fileTask.status !== uiTask.status) {
      diffs.push({
        taskIndex: i,
        taskName: fileTask.name,
        field: 'status',
        fileValue: fileTask.status,
        uiValue: uiTask.status,
      });
    }
  }

  // If task count changed, that's also a conflict
  // This is a significant structural change that needs user attention
  if (fileVersion.tasks.length !== uiVersion.tasks.length) {
    // Add a synthetic diff for task count change
    return {
      planPath: fileVersion.filePath,
      fileVersion,
      uiVersion,
      timestamp: new Date(),
      diffs: [
        ...diffs,
        {
          taskIndex: -1,
          taskName: '(task count changed)',
          field: 'status',
          fileValue: `${fileVersion.tasks.length} tasks` as unknown as TaskStatus,
          uiValue: `${uiVersion.tasks.length} tasks` as unknown as TaskStatus,
        },
      ],
    };
  }

  if (diffs.length === 0) {
    return null; // No conflict
  }

  return {
    planPath: fileVersion.filePath,
    fileVersion,
    uiVersion,
    timestamp: new Date(),
    diffs,
  };
}

/**
 * Apply conflict resolution
 *
 * @param conflict - The conflict data
 * @param resolution - User's resolution choice
 * @returns The ParsedPlanFile to use based on resolution choice, or null for cancel
 */
export function applyResolution(
  conflict: ConflictData,
  resolution: ConflictResolution
): ParsedPlanFile | null {
  switch (resolution) {
    case 'keep_file':
      // Use file version - UI will update to match
      return conflict.fileVersion;
    case 'keep_ui':
      // Use UI version - need to write back to file
      return conflict.uiVersion;
    case 'cancel':
      // User cancelled - keep current state, don't do anything
      return null;
    default:
      return null;
  }
}

/**
 * Format conflict for human-readable display
 *
 * @param conflict - The conflict data to format
 * @returns A formatted string describing the conflict
 */
export function formatConflictSummary(conflict: ConflictData): string {
  const taskDiffs = conflict.diffs.filter((d) => d.taskIndex >= 0);
  const structuralDiffs = conflict.diffs.filter((d) => d.taskIndex < 0);

  let summary = '';

  if (structuralDiffs.length > 0) {
    summary += 'Plan structure changed (tasks added/removed)\n\n';
  }

  if (taskDiffs.length > 0) {
    summary += `${taskDiffs.length} task(s) have different statuses:\n`;
    for (const diff of taskDiffs) {
      summary += `  - ${diff.taskName}: File="${diff.fileValue}" vs UI="${diff.uiValue}"\n`;
    }
  }

  return summary;
}
