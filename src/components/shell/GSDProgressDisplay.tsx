/**
 * GSDProgressDisplay - Phase and task progress UI component
 *
 * Displays GSD plan progress with task list, progress bar, and click-to-toggle status.
 * Uses useGSDFileSync for WebSocket file watching and useGSDTaskToggle for mutations.
 */

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Circle, Clock, CheckCircle, Wifi, WifiOff, AlertCircle, Loader2 } from 'lucide-react';
import { useGSDFileSync, useGSDTaskToggle, nextTaskStatus } from '../../hooks';
import type { TaskStatus, ParsedPlanFile } from '../../services/gsd';

/**
 * Props for GSDProgressDisplay component
 */
export interface GSDProgressDisplayProps {
  /** Session ID for WebSocket connection */
  sessionId: string;
  /** Path to the plan file (relative to project root) */
  planPath: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get icon for task status
 */
function TaskStatusIcon({ status }: { status: TaskStatus }): React.ReactElement {
  switch (status) {
    case 'pending':
      return <Circle className="w-4 h-4 text-gray-400" aria-hidden="true" />;
    case 'in_progress':
      return <Clock className="w-4 h-4 text-blue-500" aria-hidden="true" />;
    case 'complete':
      return <CheckCircle className="w-4 h-4 text-green-500" aria-hidden="true" />;
    default:
      return <Circle className="w-4 h-4 text-gray-400" aria-hidden="true" />;
  }
}

/**
 * Get accessible label for task status
 */
function getStatusLabel(status: TaskStatus): string {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'in_progress':
      return 'in progress';
    case 'complete':
      return 'complete';
    default:
      return 'unknown';
  }
}

/**
 * GSD Progress Display Component
 *
 * Displays plan progress with:
 * - Connection status indicator
 * - Progress bar (completed/total)
 * - Task list with click-to-toggle status
 *
 * @example
 * ```tsx
 * <GSDProgressDisplay
 *   sessionId="session-123"
 *   planPath=".planning/phases/87/87-04-PLAN.md"
 * />
 * ```
 */
export function GSDProgressDisplay({
  sessionId,
  planPath,
  className = '',
}: GSDProgressDisplayProps): React.ReactElement {
  // File sync hook for WebSocket connection
  const {
    isConnected,
    isWatching,
    ws,
    requestPlan,
  } = useGSDFileSync({
    sessionId,
    enabled: true,
  });

  // Task toggle hook for mutations
  const { toggleTask, isToggling } = useGSDTaskToggle({
    ws,
    sessionId,
    planPath,
  });

  // Query for plan data
  const {
    data: planData,
    isLoading,
    error,
  } = useQuery<ParsedPlanFile | null>({
    queryKey: ['gsd-plan', planPath],
    queryFn: async () => {
      if (!isConnected) return null;
      return requestPlan(planPath);
    },
    enabled: isConnected && isWatching,
    staleTime: 30000, // 30 seconds
  });

  // Calculate progress
  const { completed, total, percentage } = useMemo(() => {
    if (!planData?.tasks) {
      return { completed: 0, total: 0, percentage: 0 };
    }
    const tasks = planData.tasks;
    const completedCount = tasks.filter((t) => t.status === 'complete').length;
    const totalCount = tasks.length;
    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    return { completed: completedCount, total: totalCount, percentage: pct };
  }, [planData?.tasks]);

  // Handle task click
  const handleTaskClick = (taskIndex: number, currentStatus: TaskStatus): void => {
    toggleTask(taskIndex, currentStatus);
  };

  // Handle keyboard activation
  const handleTaskKeyDown = (
    event: React.KeyboardEvent,
    taskIndex: number,
    currentStatus: TaskStatus
  ): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleTask(taskIndex, currentStatus);
    }
  };

  // Render disconnected state
  if (!isConnected) {
    return (
      <div className={`p-4 border rounded-lg bg-gray-50 ${className}`}>
        <div className="flex items-center gap-2 text-gray-500">
          <WifiOff className="w-5 h-5" aria-hidden="true" />
          <span>Disconnected from file sync</span>
        </div>
        <p className="mt-2 text-sm text-gray-400">
          Waiting for WebSocket connection...
        </p>
      </div>
    );
  }

  // Render loading state
  if (isLoading) {
    return (
      <div className={`p-4 border rounded-lg ${className}`}>
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          <span>Loading plan data...</span>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`p-4 border rounded-lg bg-red-50 ${className}`}>
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" aria-hidden="true" />
          <span>Error loading plan</span>
        </div>
        <p className="mt-2 text-sm text-red-500">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    );
  }

  // Render no data state
  if (!planData) {
    return (
      <div className={`p-4 border rounded-lg bg-gray-50 ${className}`}>
        <div className="flex items-center gap-2 text-gray-500">
          <AlertCircle className="w-5 h-5" aria-hidden="true" />
          <span>No plan data available</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 border rounded-lg ${className}`}>
      {/* Header with connection status */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">
          Phase {planData.frontmatter.phase} - Plan {planData.frontmatter.plan}
        </h3>
        <div
          className="flex items-center gap-1.5 text-xs"
          title={isWatching ? 'Live sync active' : 'Sync paused'}
        >
          {isWatching ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-green-500" aria-hidden="true" />
              <span className="text-green-600">Live</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
              <span className="text-gray-500">Paused</span>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-600">Progress</span>
          <span className="text-gray-900 font-medium">
            {completed}/{total} ({percentage}%)
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${percentage}%` }}
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${percentage}% complete`}
          />
        </div>
      </div>

      {/* Task list */}
      <ul className="space-y-2" role="list" aria-label="Tasks">
        {planData.tasks.map((task, index) => (
          <li key={index}>
            <div
              role="button"
              tabIndex={0}
              className={`
                flex items-center gap-3 p-2 rounded cursor-pointer
                hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500
                ${isToggling ? 'opacity-50 pointer-events-none' : ''}
              `}
              onClick={() => handleTaskClick(index, task.status)}
              onKeyDown={(e) => handleTaskKeyDown(e, index, task.status)}
              aria-label={`${task.name}, ${getStatusLabel(task.status)}. Click to change to ${getStatusLabel(nextTaskStatus(task.status))}`}
            >
              <TaskStatusIcon status={task.status} />
              <span
                className={`flex-1 text-sm ${
                  task.status === 'complete' ? 'text-gray-500 line-through' : 'text-gray-900'
                }`}
              >
                {task.name}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default GSDProgressDisplay;
