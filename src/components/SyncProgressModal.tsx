/**
 * SyncProgressModal
 *
 * Modal displaying Apple Notes direct sync progress.
 * Shows phases: extracting → writing → cleanup → complete
 * and a result summary with node/edge counts.
 *
 * Phase 117-04
 */

import { X, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import type { SyncProgress, SyncResult } from '../services/sync/AppleNotesSyncService';

// =============================================================================
// Types
// =============================================================================

interface SyncProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  progress: SyncProgress | null;
  result: SyncResult | null;
}

// =============================================================================
// Phase label mapping
// =============================================================================

const PHASE_LABELS: Record<SyncProgress['phase'], string> = {
  extracting: 'Extracting from Apple Notes',
  writing: 'Writing to database',
  cleanup: 'Finalizing',
  complete: 'Complete',
};

const PHASES: SyncProgress['phase'][] = ['extracting', 'writing', 'cleanup', 'complete'];

// =============================================================================
// Component
// =============================================================================

/**
 * SyncProgressModal
 *
 * Displays sync progress with phase indicators and a result summary.
 * Follows the same modal overlay pattern as ImportWizard.
 */
export function SyncProgressModal({ isOpen, onClose, progress, result }: SyncProgressModalProps) {
  if (!isOpen) return null;

  const currentPhaseIndex = progress ? PHASES.indexOf(progress.phase) : -1;
  const isComplete = result !== null;
  const hasError = result?.error != null;

  const progressPercent =
    progress?.phase === 'writing' && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Sync Apple Notes</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Phase list */}
          <div className="space-y-3">
            {PHASES.map((phase, index) => {
              const isDone = currentPhaseIndex > index || (isComplete && !hasError);
              const isActive = currentPhaseIndex === index && !isComplete;
              const isPending = currentPhaseIndex < index && !isComplete;

              return (
                <div key={phase} className="flex items-center gap-3">
                  {/* Phase indicator */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isDone
                        ? 'bg-green-500 text-white'
                        : isActive
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : isActive ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <span className="text-xs font-bold">{index + 1}</span>
                    )}
                  </div>

                  {/* Phase label + message */}
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm font-medium ${
                        isDone
                          ? 'text-green-700'
                          : isActive
                            ? 'text-blue-700'
                            : isPending
                              ? 'text-gray-400'
                              : 'text-gray-600'
                      }`}
                    >
                      {PHASE_LABELS[phase]}
                    </div>
                    {isActive && progress?.message && (
                      <div className="text-xs text-gray-500 truncate mt-0.5">{progress.message}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress bar (writing phase only) */}
          {progress?.phase === 'writing' && progressPercent !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>{progress.current} of {progress.total} nodes</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Result summary */}
          {result && !hasError && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 space-y-1">
              <div className="flex items-center gap-2 text-green-800 font-medium text-sm">
                <CheckCircle className="w-4 h-4" />
                Sync complete
              </div>
              <div className="text-sm text-green-700">
                {result.nodesWritten} note{result.nodesWritten !== 1 ? 's' : ''} written
                {result.edgesWritten > 0 && `, ${result.edgesWritten} edges`}
                {' '}in {Math.round(result.duration / 1000 * 10) / 10}s
              </div>
            </div>
          )}

          {/* Error summary */}
          {hasError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 space-y-1">
              <div className="flex items-center gap-2 text-red-800 font-medium text-sm">
                <AlertCircle className="w-4 h-4" />
                Sync failed
              </div>
              <div className="text-sm text-red-700 break-words">{result?.error}</div>
            </div>
          )}

          {/* Idle message (before sync starts) */}
          {!progress && !result && (
            <div className="text-sm text-gray-500 text-center py-2">
              Starting sync...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            {isComplete ? 'Done' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
