import { useState, useEffect } from 'react';
import type { GSDProgressState, GSDSubTask, GSDPhase } from '../../types/gsd';

interface GSDProgressTrackerProps {
  progressState: GSDProgressState | null;
  onCancel?: () => void;
  onPause?: () => void;
  className?: string;
  compact?: boolean;
}

export function GSDProgressTracker({
  progressState,
  onCancel,
  onPause,
  className = '',
  compact = false,
}: GSDProgressTrackerProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Update elapsed time
  useEffect(() => {
    if (!progressState || progressState.phase === 'idle') {
      setElapsedTime(0);
      setIsVisible(false);
      return;
    }

    setIsVisible(true);
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - progressState.startTime.getTime()) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [progressState]);

  if (!isVisible || !progressState || progressState.phase === 'idle') {
    return null;
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds || seconds <= 0) return 'calculating...';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `~${mins}m ${secs}s remaining`;
    }
    return `~${secs}s remaining`;
  };

  const getPhaseColor = (phase: GSDPhase) => {
    switch (phase) {
      case 'planning': return 'blue';
      case 'executing': return 'green';
      case 'testing': return 'yellow';
      case 'committing': return 'purple';
      case 'debugging': return 'red';
      default: return 'gray';
    }
  };

  const getPhaseIcon = (phase: GSDPhase) => {
    switch (phase) {
      case 'planning': return '📋';
      case 'executing': return '⚡';
      case 'testing': return '🧪';
      case 'committing': return '💾';
      case 'debugging': return '🔍';
      default: return '⏳';
    }
  };

  const phaseColor = getPhaseColor(progressState.phase);
  const phaseIcon = getPhaseIcon(progressState.phase);

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-lg" role="img" aria-label={progressState.phase}>
          {phaseIcon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">
            {progressState.currentTask}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 bg-${phaseColor}-500`}
                style={{ width: `${progressState.progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 font-mono">
              {Math.round(progressState.progress)}%
            </span>
          </div>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-red-500 transition-colors"
            title="Cancel execution"
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border shadow-lg ${className}`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b bg-${phaseColor}-50`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl" role="img" aria-label={progressState.phase}>
              {phaseIcon}
            </span>
            <div>
              <h3 className="font-medium text-gray-900 capitalize">
                {progressState.phase} Phase
              </h3>
              <p className="text-sm text-gray-600">
                {progressState.currentTask}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onPause && (
              <button
                onClick={onPause}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
                title="Pause execution"
              >
                ⏸️ Pause
              </button>
            )}
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded-md hover:bg-red-50"
                title="Cancel execution"
              >
                🛑 Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Overall Progress
          </span>
          <span className="text-sm text-gray-600">
            {progressState.completedTasks} of {progressState.totalTasks} tasks completed
          </span>
        </div>
        <div className="relative">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 bg-${phaseColor}-500`}
              style={{ width: `${progressState.progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>{Math.round(progressState.progress)}%</span>
            <span className="font-mono">
              {formatTimeRemaining(progressState.estimatedTimeRemaining)}
            </span>
          </div>
        </div>
      </div>

      {/* Task Details */}
      <div className="max-h-64 overflow-y-auto">
        {progressState.subTasks.map((task, index) => (
          <TaskItem key={task.id} task={task} index={index} />
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t bg-gray-50">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Elapsed: {formatTime(elapsedTime)}</span>
          <span className="font-mono">
            Started: {progressState.startTime.toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}

interface TaskItemProps {
  task: GSDSubTask;
  index: number;
}

function TaskItem({ task, index }: TaskItemProps) {
  const getStatusIcon = (status: GSDSubTask['status']) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'in-progress': return '⚡';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'skipped': return '⏭️';
      default: return '❓';
    }
  };

  const getStatusColor = (status: GSDSubTask['status']) => {
    switch (status) {
      case 'pending': return 'text-gray-500';
      case 'in-progress': return 'text-blue-600';
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'skipped': return 'text-yellow-600';
      default: return 'text-gray-500';
    }
  };

  const formatDuration = (start?: Date, end?: Date) => {
    if (!start) return null;
    const endTime = end || new Date();
    const duration = Math.floor((endTime.getTime() - start.getTime()) / 1000);

    if (duration < 60) {
      return `${duration}s`;
    } else {
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      return `${mins}m ${secs}s`;
    }
  };

  return (
    <div className={`px-4 py-2 border-b last:border-b-0 ${task.status === 'in-progress' ? 'bg-blue-50' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-gray-400 font-mono w-6 text-center">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="text-sm" role="img" aria-label={task.status}>
            {getStatusIcon(task.status)}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${getStatusColor(task.status)} truncate`}>
              {task.name}
            </span>
            <span className="text-xs text-gray-500 font-mono ml-2">
              {formatDuration(task.startTime, task.endTime)}
            </span>
          </div>

          {task.output && (
            <div className="mt-1 text-xs text-gray-600 bg-gray-50 p-2 rounded font-mono">
              {task.output}
            </div>
          )}

          {task.error && (
            <div className="mt-1 text-xs text-red-600 bg-red-50 p-2 rounded font-mono">
              {task.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Animation for showing/hiding progress tracker
export function useProgressAnimation() {
  const [isAnimating, setIsAnimating] = useState(false);

  const showProgress = () => {
    setIsAnimating(true);
  };

  const hideProgress = () => {
    setTimeout(() => setIsAnimating(false), 500);
  };

  return { isAnimating, showProgress, hideProgress };
}