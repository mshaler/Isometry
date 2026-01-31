import React, { useState, useCallback, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Information about a detected conflict for UI display
 */
export interface ConflictInfo {
  nodeId: string;
  conflictType: 'field_conflict' | 'version_mismatch' | 'deletion_conflict' | 'type_change';
  detectedAt: Date;
  fields: string[];
}

/**
 * Individual field difference for side-by-side display
 */
export interface FieldDiff {
  fieldName: string;
  localValue: string | null;
  serverValue: string | null;
  conflicted: boolean;
  autoResolved: boolean;
  resolvedValue?: string;
}

/**
 * Conflict diff data for manual resolution
 */
export interface ConflictDiff {
  nodeId: string;
  fieldDiffs: FieldDiff[];
  conflictType: ConflictInfo['conflictType'];
  canAutoResolve: boolean;
}

/**
 * User's resolution decision
 */
export interface ResolutionDecision {
  strategy: 'manual_resolution' | 'field_level_merge' | 'keep_both_versions' | 'last_write_wins';
  selectedRecord?: 'local' | 'server';
  fieldChoices: Record<string, 'local' | 'server' | 'both' | string>; // field -> choice
  customMerge?: Record<string, any>;
}

/**
 * Props for ConflictResolutionModal
 */
interface ConflictResolutionModalProps {
  conflict: ConflictInfo | null;
  conflictDiff: ConflictDiff | null;
  isVisible: boolean;
  onResolve: (decision: ResolutionDecision) => Promise<void>;
  onCancel: () => void;
  isResolving?: boolean;
}

/**
 * Side-by-side diff interface for manual conflict resolution
 *
 * Provides git merge tool experience with visual conflict highlighting,
 * responsive design for desktop and mobile, and integration with theme system.
 */
export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  conflict,
  conflictDiff,
  isVisible,
  onResolve,
  onCancel,
  isResolving = false,
}) => {
  const { theme } = useTheme();

  // Resolution state
  const [fieldChoices, setFieldChoices] = useState<Record<string, string>>({});
  const [resolutionStrategy, setResolutionStrategy] = useState<ResolutionDecision['strategy']>('field_level_merge');
  const [showMergedPreview, setShowMergedPreview] = useState(false);

  // Reset state when conflict changes
  useEffect(() => {
    if (conflict && conflictDiff) {
      const initialChoices: Record<string, string> = {};

      // Pre-populate with auto-resolved values
      conflictDiff.fieldDiffs.forEach(diff => {
        if (diff.autoResolved && diff.resolvedValue) {
          initialChoices[diff.fieldName] = diff.resolvedValue;
        } else if (diff.conflicted) {
          // Default to server value for conflicted fields
          initialChoices[diff.fieldName] = 'server';
        }
      });

      setFieldChoices(initialChoices);
      setShowMergedPreview(false);

      // Use auto-resolution if possible
      setResolutionStrategy(conflictDiff.canAutoResolve ? 'field_level_merge' : 'manual_resolution');
    }
  }, [conflict?.nodeId, conflictDiff?.nodeId]); // Only depend on IDs to prevent object re-render loops

  // Handle field choice changes
  const handleFieldChoice = useCallback((fieldName: string, choice: string) => {
    setFieldChoices(prev => ({
      ...prev,
      [fieldName]: choice,
    }));
  }, []);

  // Handle resolution submission
  const handleResolve = useCallback(async () => {
    if (!conflict) return;

    const decision: ResolutionDecision = {
      strategy: resolutionStrategy,
      fieldChoices,
    };

    if (resolutionStrategy === 'last_write_wins') {
      // Determine which record is more recent
      decision.selectedRecord = 'server'; // Default - would be determined by timestamps
    }

    await onResolve(decision);
  }, [conflict, resolutionStrategy, fieldChoices, onResolve]);

  // Handle quick resolution options
  const handleQuickResolve = useCallback(async (option: 'keep_left' | 'keep_right' | 'auto_merge') => {
    if (!conflict || !conflictDiff) return;

    let strategy: ResolutionDecision['strategy'] = 'field_level_merge';
    let choices: Record<string, string> = {};

    switch (option) {
      case 'keep_left':
        strategy = 'manual_resolution';
        conflictDiff.fieldDiffs.forEach(diff => {
          choices[diff.fieldName] = 'server';
        });
        break;

      case 'keep_right':
        strategy = 'manual_resolution';
        conflictDiff.fieldDiffs.forEach(diff => {
          choices[diff.fieldName] = 'local';
        });
        break;

      case 'auto_merge':
        strategy = 'field_level_merge';
        // Use current field choices (already populated with auto-resolved values)
        choices = fieldChoices;
        break;
    }

    const decision: ResolutionDecision = {
      strategy,
      fieldChoices: choices,
    };

    await onResolve(decision);
  }, [conflict, conflictDiff, fieldChoices, onResolve]);

  if (!isVisible || !conflict || !conflictDiff) {
    return null;
  }

  const isNextstep = theme === 'nextstep';

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
      isNextstep
        ? 'bg-black bg-opacity-75'
        : 'bg-gray-900 bg-opacity-50 backdrop-blur-sm'
    }`}>
      <div className={`w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-lg shadow-xl ${
        isNextstep
          ? 'bg-gray-200 border-4 border-gray-800'
          : 'bg-white border border-gray-200'
      }`}>
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isNextstep
            ? 'bg-gray-800 text-white border-gray-600'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div>
            <h2 className="text-lg font-bold">Resolve Conflict</h2>
            <p className="text-sm opacity-75">
              {conflict.conflictType === 'field_conflict' && 'Field-level conflict detected'}
              {conflict.conflictType === 'version_mismatch' && 'Version mismatch between devices'}
              {conflict.conflictType === 'deletion_conflict' && 'Deletion conflict detected'}
              {conflict.conflictType === 'type_change' && 'Content type change detected'}
            </p>
          </div>

          {/* Quick Resolution Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => handleQuickResolve('keep_left')}
              disabled={isResolving}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                isNextstep
                  ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                  : 'bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50'
              }`}
            >
              Keep Server
            </button>

            <button
              onClick={() => handleQuickResolve('keep_right')}
              disabled={isResolving}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                isNextstep
                  ? 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'
                  : 'bg-green-500 text-white hover:bg-green-600 disabled:opacity-50'
              }`}
            >
              Keep Local
            </button>

            {conflictDiff.canAutoResolve && (
              <button
                onClick={() => handleQuickResolve('auto_merge')}
                disabled={isResolving}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  isNextstep
                    ? 'bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50'
                    : 'bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50'
                }`}
              >
                Auto Merge
              </button>
            )}
          </div>
        </div>

        {/* Side-by-Side Diff Interface */}
        <div className="flex-1 overflow-hidden">
          <div className="h-96 flex">
            {/* Left Panel: Server Version */}
            <div className="flex-1 border-r">
              <div className={`px-4 py-2 text-sm font-medium border-b ${
                isNextstep
                  ? 'bg-red-100 text-red-900 border-red-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}>
                Server Version
              </div>
              <div className="h-full overflow-y-auto p-4">
                {conflictDiff.fieldDiffs.map(diff => (
                  <div key={`server-${diff.fieldName}`} className="mb-4">
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      {diff.fieldName}
                    </div>
                    <div className={`p-2 rounded text-sm font-mono ${
                      diff.conflicted && !diff.autoResolved
                        ? (isNextstep ? 'bg-red-200' : 'bg-red-100')
                        : (isNextstep ? 'bg-gray-100' : 'bg-gray-50')
                    }`}>
                      {diff.serverValue || <span className="italic text-gray-400">empty</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Center Panel: Resolution Controls */}
            <div className="w-48 border-r">
              <div className={`px-4 py-2 text-sm font-medium border-b ${
                isNextstep
                  ? 'bg-blue-100 text-blue-900 border-blue-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                Resolution
              </div>
              <div className="h-full overflow-y-auto p-2">
                {conflictDiff.fieldDiffs.map(diff => (
                  <div key={`control-${diff.fieldName}`} className="mb-4">
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      {diff.fieldName}
                    </div>

                    {diff.autoResolved ? (
                      <div className={`p-2 rounded text-xs ${
                        isNextstep ? 'bg-green-200 text-green-800' : 'bg-green-100 text-green-700'
                      }`}>
                        Auto-merged
                      </div>
                    ) : diff.conflicted ? (
                      <div className="space-y-1">
                        {['server', 'local', 'both'].map(option => (
                          <label key={option} className="flex items-center text-xs">
                            <input
                              type="radio"
                              name={`field-${diff.fieldName}`}
                              value={option}
                              checked={fieldChoices[diff.fieldName] === option}
                              onChange={() => handleFieldChoice(diff.fieldName, option)}
                              className="mr-1"
                            />
                            {option === 'both' ? 'Merge' : option === 'server' ? 'Server' : 'Local'}
                          </label>
                        ))}

                        <input
                          type="text"
                          placeholder="Custom..."
                          value={
                            !['server', 'local', 'both'].includes(fieldChoices[diff.fieldName] || '')
                              ? fieldChoices[diff.fieldName] || ''
                              : ''
                          }
                          onChange={(e) => handleFieldChoice(diff.fieldName, e.target.value)}
                          className={`w-full px-1 py-1 text-xs rounded border ${
                            isNextstep
                              ? 'border-gray-400 bg-white'
                              : 'border-gray-300 bg-white'
                          }`}
                        />
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">No conflict</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right Panel: Local Version */}
            <div className="flex-1">
              <div className={`px-4 py-2 text-sm font-medium border-b ${
                isNextstep
                  ? 'bg-green-100 text-green-900 border-green-200'
                  : 'bg-green-50 text-green-700 border-green-200'
              }`}>
                Local Version
              </div>
              <div className="h-full overflow-y-auto p-4">
                {conflictDiff.fieldDiffs.map(diff => (
                  <div key={`local-${diff.fieldName}`} className="mb-4">
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      {diff.fieldName}
                    </div>
                    <div className={`p-2 rounded text-sm font-mono ${
                      diff.conflicted && !diff.autoResolved
                        ? (isNextstep ? 'bg-green-200' : 'bg-green-100')
                        : (isNextstep ? 'bg-gray-100' : 'bg-gray-50')
                    }`}>
                      {diff.localValue || <span className="italic text-gray-400">empty</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Action Buttons */}
        <div className={`p-4 border-t flex items-center justify-between ${
          isNextstep
            ? 'bg-gray-100 border-gray-300'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMergedPreview(!showMergedPreview)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                isNextstep
                  ? 'bg-gray-300 text-gray-800 hover:bg-gray-400'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {showMergedPreview ? 'Hide Preview' : 'Show Merged Preview'}
            </button>

            <span className="text-sm text-gray-500">
              {conflictDiff.fieldDiffs.filter(d => d.conflicted).length} conflicts to resolve
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              disabled={isResolving}
              className={`px-4 py-2 rounded transition-colors ${
                isNextstep
                  ? 'bg-gray-400 text-white hover:bg-gray-500 disabled:opacity-50'
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400 disabled:opacity-50'
              }`}
            >
              Cancel
            </button>

            <button
              onClick={handleResolve}
              disabled={isResolving}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                isNextstep
                  ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                  : 'bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50'
              }`}
            >
              {isResolving ? 'Resolving...' : 'Apply Resolution'}
            </button>
          </div>
        </div>

        {/* Merged Preview (collapsible) */}
        {showMergedPreview && (
          <div className={`border-t ${
            isNextstep ? 'bg-yellow-100 border-yellow-300' : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="p-4">
              <h3 className="text-sm font-medium mb-2">Merged Result Preview:</h3>
              <div className="max-h-32 overflow-y-auto">
                {conflictDiff.fieldDiffs.map(diff => {
                  const chosenValue = fieldChoices[diff.fieldName];
                  let displayValue = '';

                  if (chosenValue === 'server') displayValue = diff.serverValue || '';
                  else if (chosenValue === 'local') displayValue = diff.localValue || '';
                  else if (chosenValue === 'both') displayValue = `${diff.serverValue || ''} + ${diff.localValue || ''}`;
                  else if (diff.autoResolved) displayValue = diff.resolvedValue || '';
                  else displayValue = chosenValue || '';

                  return (
                    <div key={`preview-${diff.fieldName}`} className="mb-2">
                      <span className="text-xs font-medium text-gray-600">{diff.fieldName}: </span>
                      <span className="text-sm font-mono">{displayValue}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConflictResolutionModal;