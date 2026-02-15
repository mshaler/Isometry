/**
 * useGSDTaskToggle - React hook for toggling GSD task status
 *
 * Provides optimistic updates for task status changes with rollback on error.
 * Cycles through: pending -> in_progress -> complete -> pending
 */

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskStatus, ParsedPlanFile, GSDTask } from '../services/gsd';
import { devLogger } from '../utils/logging';

/**
 * WebSocket message for task status update
 */
interface GSDTaskUpdateMessage {
  type: 'update_gsd_task';
  sessionId: string;
  planPath: string;
  taskIndex: number;
  newStatus: TaskStatus;
}

/**
 * Options for useGSDTaskToggle hook
 */
export interface UseGSDTaskToggleOptions {
  /** WebSocket instance for sending updates */
  ws: WebSocket | null;
  /** Session ID for this client */
  sessionId: string;
  /** Path to the plan file */
  planPath: string;
}

/**
 * Variables for the mutation
 */
export interface TaskToggleVariables {
  taskIndex: number;
  currentStatus: TaskStatus;
}

/**
 * Result from useGSDTaskToggle hook
 */
export interface UseGSDTaskToggleResult {
  /** Toggle a task to its next status */
  toggleTask: (taskIndex: number, currentStatus: TaskStatus) => void;
  /** Whether a toggle is in progress */
  isToggling: boolean;
  /** Error from last toggle attempt */
  error: Error | null;
}

/**
 * Get the next status in the cycle
 * pending -> in_progress -> complete -> pending
 */
export function nextTaskStatus(current: TaskStatus): TaskStatus {
  switch (current) {
    case 'pending':
      return 'in_progress';
    case 'in_progress':
      return 'complete';
    case 'complete':
      return 'pending';
    default:
      return 'pending';
  }
}

/**
 * React hook for toggling GSD task status with optimistic updates
 *
 * @example
 * ```tsx
 * const { toggleTask, isToggling, error } = useGSDTaskToggle({
 *   ws,
 *   sessionId: 'session-123',
 *   planPath: '.planning/phases/87/87-04-PLAN.md'
 * });
 *
 * // Toggle task 0 from pending
 * toggleTask(0, 'pending');
 * ```
 */
export function useGSDTaskToggle(options: UseGSDTaskToggleOptions): UseGSDTaskToggleResult {
  const { ws, sessionId, planPath } = options;
  const queryClient = useQueryClient();

  const mutation = useMutation<
    void,
    Error,
    TaskToggleVariables,
    { previousPlan: ParsedPlanFile | undefined }
  >({
    mutationFn: async (variables: TaskToggleVariables) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not connected');
      }

      const newStatus = nextTaskStatus(variables.currentStatus);

      const message: GSDTaskUpdateMessage = {
        type: 'update_gsd_task',
        sessionId,
        planPath,
        taskIndex: variables.taskIndex,
        newStatus,
      };

      ws.send(JSON.stringify(message));

      devLogger.debug('GSD task toggle sent', {
        component: 'useGSDTaskToggle',
        planPath,
        taskIndex: variables.taskIndex,
        oldStatus: variables.currentStatus,
        newStatus,
      });
    },

    onMutate: async (variables: TaskToggleVariables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['gsd-plan', planPath] });

      // Snapshot previous value
      const previousPlan = queryClient.getQueryData<ParsedPlanFile>(['gsd-plan', planPath]);

      // Optimistically update the task status
      if (previousPlan) {
        const newStatus = nextTaskStatus(variables.currentStatus);
        const updatedTasks: GSDTask[] = previousPlan.tasks.map((task, index) =>
          index === variables.taskIndex ? { ...task, status: newStatus } : task
        );

        const updatedPlan: ParsedPlanFile = {
          ...previousPlan,
          tasks: updatedTasks,
        };

        queryClient.setQueryData(['gsd-plan', planPath], updatedPlan);

        devLogger.debug('GSD task optimistic update applied', {
          component: 'useGSDTaskToggle',
          taskIndex: variables.taskIndex,
          newStatus,
        });
      }

      // Return context with previous value for rollback
      return { previousPlan };
    },

    onError: (error, _variables, context) => {
      // Rollback to previous value on error
      if (context?.previousPlan) {
        queryClient.setQueryData(['gsd-plan', planPath], context.previousPlan);

        devLogger.debug('GSD task optimistic update rolled back', {
          component: 'useGSDTaskToggle',
          error: error.message,
        });
      }
    },

    onSettled: () => {
      // Invalidate to ensure we have the latest data
      void queryClient.invalidateQueries({ queryKey: ['gsd-plan', planPath] });
    },
  });

  const toggleTask = useCallback(
    (taskIndex: number, currentStatus: TaskStatus) => {
      mutation.mutate({ taskIndex, currentStatus });
    },
    [mutation]
  );

  return {
    toggleTask,
    isToggling: mutation.isPending,
    error: mutation.error,
  };
}
