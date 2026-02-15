/**
 * GSD Conflict Modal - UI for resolving concurrent file edit conflicts
 *
 * Displays when Claude Code modifies a PLAN.md file while the user has
 * unsaved UI changes, allowing the user to choose which version to keep.
 */

import { AlertTriangle, FileText, Monitor, X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import type {
  ConflictData,
  ConflictResolution,
} from '@/services/gsd/gsdConflictResolver';

interface GSDConflictModalProps {
  conflict: ConflictData | null;
  onResolve: (resolution: ConflictResolution) => void;
  isOpen: boolean;
}

/**
 * Status colors for task status display
 */
const STATUS_COLORS: Record<string, string> = {
  pending: 'text-gray-500',
  in_progress: 'text-blue-500',
  complete: 'text-green-500',
};

/**
 * Modal for GSD file conflict resolution
 *
 * Shows:
 * - Plan path
 * - List of conflicting tasks with file vs UI values
 * - Warning for structural changes (task count changed)
 * - Three resolution buttons: Cancel, Keep File Version, Keep My Changes
 */
export function GSDConflictModal({
  conflict,
  onResolve,
  isOpen,
}: GSDConflictModalProps) {
  const { theme } = useTheme();

  if (!isOpen || !conflict) return null;

  const taskDiffs = conflict.diffs.filter((d) => d.taskIndex >= 0);
  const hasStructuralChanges = conflict.diffs.some((d) => d.taskIndex < 0);

  const isNextstep = theme === 'NeXTSTEP';
  const bgClass = isNextstep ? 'bg-[#c0c0c0]' : 'bg-white';
  const borderClass = isNextstep ? 'border-[#707070]' : 'border-gray-300';
  const headerBgClass = isNextstep ? 'bg-[#d4d4d4]' : 'bg-gray-100';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => onResolve('cancel')}
    >
      <div
        className={`${bgClass} ${borderClass} border rounded-lg shadow-xl w-[500px] max-h-[80vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`${headerBgClass} px-4 py-3 rounded-t-lg border-b ${borderClass} flex items-center gap-2`}
        >
          <AlertTriangle className="w-5 h-5 text-yellow-600" />
          <h2 className="text-lg font-medium flex-1">Conflict Detected</h2>
          <button
            onClick={() => onResolve('cancel')}
            className={`p-1 rounded ${isNextstep ? 'hover:bg-[#b0b0b0]' : 'hover:bg-gray-200'}`}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Description */}
        <div className="px-4 py-3 border-b border-gray-200">
          <p className="text-sm text-gray-600">
            The plan file was modified externally while you had unsaved changes.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            <span className="font-medium">File:</span> {conflict.planPath}
          </p>
        </div>

        {/* Diff List */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700">
            Conflicting Changes ({taskDiffs.length})
          </div>
          <ul className="divide-y divide-gray-100">
            {taskDiffs.map((diff) => (
              <li key={diff.taskIndex} className="px-4 py-3">
                <div className="text-sm font-medium text-gray-900 mb-1">
                  {diff.taskName}
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3 text-gray-400" />
                    File:{' '}
                    <span className={STATUS_COLORS[diff.fileValue] || 'text-gray-500'}>
                      {diff.fileValue}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Monitor className="w-3 h-3 text-gray-400" />
                    UI:{' '}
                    <span className={STATUS_COLORS[diff.uiValue] || 'text-gray-500'}>
                      {diff.uiValue}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Structural Changes Warning */}
        {hasStructuralChanges && (
          <div className="mx-4 my-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <strong>Warning:</strong> The plan structure has changed (tasks were
            added or removed). Keeping your UI version may overwrite these
            changes.
          </div>
        )}

        {/* Footer */}
        <div
          className={`px-4 py-3 border-t ${borderClass} flex justify-end gap-2`}
        >
          <button
            onClick={() => onResolve('cancel')}
            className={`px-4 py-2 text-sm rounded flex items-center gap-2 ${
              isNextstep
                ? 'bg-[#e0e0e0] hover:bg-[#d0d0d0] border border-[#707070]'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            onClick={() => onResolve('keep_file')}
            className={`px-4 py-2 text-sm rounded flex items-center gap-2 ${
              isNextstep
                ? 'bg-[#a0a0ff] hover:bg-[#9090ef] border border-[#707070]'
                : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            Keep File Version
          </button>
          <button
            onClick={() => onResolve('keep_ui')}
            className={`px-4 py-2 text-sm rounded text-white flex items-center gap-2 ${
              isNextstep
                ? 'bg-[#0066cc] hover:bg-[#0055aa]'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            <Monitor className="w-4 h-4" />
            Keep My Changes
          </button>
        </div>
      </div>
    </div>
  );
}
