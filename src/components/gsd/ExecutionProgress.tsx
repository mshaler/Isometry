/**
 * ExecutionProgress Component
 *
 * Displays GSD workflow phase progress with visual indicators:
 * - Phase progress bar (spec → plan → implement → test → commit)
 * - Current activity status line
 * - File change counters
 * - Token usage and cost tracking
 */

import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  FolderPlus,
  FileEdit,
  FileX,
  Coins,
  Timer
} from 'lucide-react';
import { ExecutionProgressProps, GSDPhase } from '../../types/gsd';

const PHASES: Array<{ key: GSDPhase; label: string; description: string }> = [
  { key: 'spec', label: 'Spec', description: 'Requirements analysis' },
  { key: 'plan', label: 'Plan', description: 'Implementation planning' },
  { key: 'implement', label: 'Implement', description: 'Code generation' },
  { key: 'test', label: 'Test', description: 'Testing and validation' },
  { key: 'commit', label: 'Commit', description: 'Version control' }
];

export function ExecutionProgress({
  currentPhase,
  phaseHistory,
  activeToolUse,
  fileChanges,
  tokenUsage,
  status
}: ExecutionProgressProps) {
  const getPhaseStatus = (phase: GSDPhase) => {
    const phaseEvent = phaseHistory.find(p => p.phase === phase);

    if (!phaseEvent) return 'pending';
    if (phaseEvent.status === 'error') return 'error';
    if (phaseEvent.status === 'completed') return 'completed';
    if (phase === currentPhase && status === 'executing') return 'active';
    return 'pending';
  };

  const getPhaseIcon = (phase: GSDPhase) => {
    const phaseStatus = getPhaseStatus(phase);

    switch (phaseStatus) {
      case 'completed':
        return <CheckCircle2 size={16} className="text-green-400" />;
      case 'active':
        return <Clock size={16} className="text-blue-400 animate-pulse" />;
      case 'error':
        return <AlertCircle size={16} className="text-red-400" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-gray-600" />;
    }
  };

  const getConnectorStyle = (index: number) => {
    const phase = PHASES[index];
    const nextPhase = PHASES[index + 1];

    if (!nextPhase) return '';

    const currentStatus = getPhaseStatus(phase.key);

    if (currentStatus === 'completed') {
      return 'border-green-400';
    } else if (currentStatus === 'active') {
      return 'border-blue-400';
    } else {
      return 'border-gray-600';
    }
  };

  const totalFiles = fileChanges.created + fileChanges.modified + fileChanges.deleted;
  const totalTokens = tokenUsage.input + tokenUsage.output;
  const estimatedCost = tokenUsage.cost || (totalTokens * 0.000006); // Rough estimate

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-4">
      {/* Phase Progress Bar */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-200 flex items-center gap-2">
          <Timer size={16} className="text-green-400" />
          Execution Progress
        </h3>

        <div className="flex items-center justify-between">
          {PHASES.map((phase, index) => (
            <React.Fragment key={phase.key}>
              {/* Phase Node */}
              <div className="flex flex-col items-center space-y-1">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300 ${
                    getPhaseStatus(phase.key) === 'completed'
                      ? 'bg-green-400 border-green-400'
                      : getPhaseStatus(phase.key) === 'active'
                      ? 'bg-blue-500 border-blue-400 shadow-lg shadow-blue-400/30'
                      : getPhaseStatus(phase.key) === 'error'
                      ? 'bg-red-500 border-red-400'
                      : 'bg-gray-800 border-gray-600'
                  }`}
                  title={phase.description}
                >
                  {getPhaseIcon(phase.key)}
                </div>
                <span className={`text-xs font-medium ${
                  getPhaseStatus(phase.key) === 'completed' ? 'text-green-400'
                  : getPhaseStatus(phase.key) === 'active' ? 'text-blue-400'
                  : getPhaseStatus(phase.key) === 'error' ? 'text-red-400'
                  : 'text-gray-500'
                }`}>
                  {phase.label}
                </span>
              </div>

              {/* Connector Line */}
              {index < PHASES.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 border-t-2 transition-colors duration-300 ${getConnectorStyle(index)}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Current Activity */}
      {activeToolUse && status === 'executing' && (
        <div className="bg-gray-800 rounded-md p-3 border border-gray-600">
          <div className="flex items-center gap-2 text-blue-400">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Active:</span>
            <span className="text-sm text-gray-300">{activeToolUse}</span>
          </div>
        </div>
      )}

      {/* Status for waiting input */}
      {status === 'waiting-input' && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-md p-3">
          <div className="flex items-center gap-2 text-yellow-400">
            <Clock size={16} />
            <span className="text-sm font-medium">Waiting for your input</span>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* File Changes */}
        <div className="bg-gray-800 rounded-md p-3">
          <h4 className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
            <FileText size={12} />
            File Changes
          </h4>
          <div className="space-y-1">
            {fileChanges.created > 0 && (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-green-400">
                  <FolderPlus size={10} />
                  Created
                </div>
                <span className="text-gray-300">{fileChanges.created}</span>
              </div>
            )}
            {fileChanges.modified > 0 && (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-blue-400">
                  <FileEdit size={10} />
                  Modified
                </div>
                <span className="text-gray-300">{fileChanges.modified}</span>
              </div>
            )}
            {fileChanges.deleted > 0 && (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-red-400">
                  <FileX size={10} />
                  Deleted
                </div>
                <span className="text-gray-300">{fileChanges.deleted}</span>
              </div>
            )}
            {totalFiles === 0 && (
              <div className="text-xs text-gray-500">No changes yet</div>
            )}
          </div>
        </div>

        {/* Token Usage */}
        <div className="bg-gray-800 rounded-md p-3">
          <h4 className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
            <Coins size={12} />
            Token Usage
          </h4>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Total</span>
              <span className="text-gray-300">{totalTokens.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Cost</span>
              <span className="text-green-400">${estimatedCost.toFixed(4)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Breakdown (if space allows) */}
      {status !== 'waiting-input' && (
        <details className="text-xs">
          <summary className="text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
            View Details
          </summary>
          <div className="mt-2 space-y-2 text-gray-500">
            <div>Input Tokens: {tokenUsage.input.toLocaleString()}</div>
            <div>Output Tokens: {tokenUsage.output.toLocaleString()}</div>
            <div>Phases Completed: {phaseHistory.filter(p => p.status === 'completed').length}</div>
          </div>
        </details>
      )}
    </div>
  );
}