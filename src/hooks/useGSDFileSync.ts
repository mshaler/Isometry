/**
 * useGSDFileSync - React hook for GSD file sync via WebSocket
 *
 * Subscribes to GSD file changes via WebSocket and invalidates React Query cache.
 * Provides file watching state and plan data request capabilities.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { GSDFileChangeEvent, ParsedPlanFile } from '../services/gsd';
import { devLogger } from '../utils/logging';

/**
 * WebSocket message types for GSD operations
 */
interface GSDWatchStartMessage {
  type: 'start_gsd_watch';
  sessionId: string;
}

interface GSDWatchStopMessage {
  type: 'stop_gsd_watch';
  sessionId: string;
}

interface GSDPlanRequest {
  type: 'request_gsd_plan';
  sessionId: string;
  planPath: string;
}

interface GSDWatchStartedMessage {
  type: 'gsd_watch_started';
  sessionId: string;
}

interface GSDPlanDataMessage {
  type: 'gsd_plan_data';
  sessionId: string;
  planPath: string;
  data: ParsedPlanFile;
}

type GSDOutboundMessage = GSDWatchStartMessage | GSDWatchStopMessage | GSDPlanRequest;
type GSDInboundMessage = GSDWatchStartedMessage | GSDFileChangeEvent | GSDPlanDataMessage;

/**
 * Options for useGSDFileSync hook
 */
export interface UseGSDFileSyncOptions {
  /** WebSocket URL (defaults to ws://localhost:3001) */
  wsUrl?: string;
  /** Session ID for identifying this client */
  sessionId: string;
  /** Whether file watching is enabled */
  enabled?: boolean;
}

/**
 * State returned by useGSDFileSync hook
 */
export interface UseGSDFileSyncState {
  /** Whether WebSocket is connected */
  isConnected: boolean;
  /** Whether file watcher is active on server */
  isWatching: boolean;
  /** Last file update event */
  lastUpdate: GSDFileChangeEvent | null;
}

/**
 * Result from useGSDFileSync hook
 */
export interface UseGSDFileSyncResult extends UseGSDFileSyncState {
  /** WebSocket instance for sending messages */
  ws: WebSocket | null;
  /** Request parsed plan data from server */
  requestPlan: (planPath: string) => Promise<ParsedPlanFile | null>;
}

/**
 * Type guard to check if message is a GSD inbound message
 */
function isGSDMessage(data: unknown): data is GSDInboundMessage {
  if (typeof data !== 'object' || data === null) return false;
  const msg = data as Record<string, unknown>;
  return (
    msg.type === 'gsd_watch_started' ||
    msg.type === 'gsd_file_update' ||
    msg.type === 'gsd_plan_data'
  );
}

/**
 * React hook for GSD file synchronization via WebSocket
 *
 * Connects to WebSocket, starts file watching, and invalidates queries on file changes.
 *
 * @example
 * ```tsx
 * const { isConnected, isWatching, requestPlan } = useGSDFileSync({
 *   sessionId: 'session-123',
 *   enabled: true
 * });
 * ```
 */
export function useGSDFileSync(options: UseGSDFileSyncOptions): UseGSDFileSyncResult {
  const { wsUrl = 'ws://localhost:3001', sessionId, enabled = true } = options;

  const queryClient = useQueryClient();

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<GSDFileChangeEvent | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Refs for callbacks and pending requests
  const pendingPlanRequests = useRef<Map<string, {
    resolve: (data: ParsedPlanFile | null) => void;
    reject: (error: Error) => void;
  }>>(new Map());

  // Handle incoming WebSocket messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);

        if (!isGSDMessage(data)) return;

        switch (data.type) {
          case 'gsd_watch_started':
            if (data.sessionId === sessionId) {
              setIsWatching(true);
              devLogger.debug('GSD file watch started', {
                component: 'useGSDFileSync',
                sessionId,
              });
            }
            break;

          case 'gsd_file_update':
            if (data.sessionId === sessionId) {
              setLastUpdate(data);
              // Invalidate queries related to GSD data
              void queryClient.invalidateQueries({ queryKey: ['gsd'] });
              void queryClient.invalidateQueries({ queryKey: ['gsd-plan', data.filePath] });
              devLogger.debug('GSD file update received', {
                component: 'useGSDFileSync',
                filePath: data.filePath,
                changeType: data.changeType,
              });
            }
            break;

          case 'gsd_plan_data':
            if (data.sessionId === sessionId) {
              // Update query cache with new plan data
              queryClient.setQueryData(['gsd-plan', data.planPath], data.data);

              // Resolve pending request if any
              const pending = pendingPlanRequests.current.get(data.planPath);
              if (pending) {
                pending.resolve(data.data);
                pendingPlanRequests.current.delete(data.planPath);
              }

              devLogger.debug('GSD plan data received', {
                component: 'useGSDFileSync',
                planPath: data.planPath,
                taskCount: data.data.tasks.length,
              });
            }
            break;
        }
      } catch (error) {
        devLogger.error('Failed to parse GSD WebSocket message', {
          component: 'useGSDFileSync',
          error,
        });
      }
    },
    [sessionId, queryClient]
  );

  // Connect to WebSocket
  useEffect(() => {
    if (!enabled) return;

    const socket = new WebSocket(wsUrl);

    socket.addEventListener('open', () => {
      setIsConnected(true);
      setWs(socket);

      // Send start watch message
      const message: GSDOutboundMessage = {
        type: 'start_gsd_watch',
        sessionId,
      };
      socket.send(JSON.stringify(message));

      devLogger.debug('GSD WebSocket connected', {
        component: 'useGSDFileSync',
        wsUrl,
        sessionId,
      });
    });

    socket.addEventListener('message', handleMessage);

    socket.addEventListener('close', () => {
      setIsConnected(false);
      setIsWatching(false);
      setWs(null);

      devLogger.debug('GSD WebSocket disconnected', {
        component: 'useGSDFileSync',
        sessionId,
      });
    });

    socket.addEventListener('error', (error) => {
      devLogger.error('GSD WebSocket error', {
        component: 'useGSDFileSync',
        error,
      });
    });

    // Cleanup on unmount
    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        // Send stop watch message before closing
        const message: GSDOutboundMessage = {
          type: 'stop_gsd_watch',
          sessionId,
        };
        socket.send(JSON.stringify(message));
      }
      socket.close();
      setIsConnected(false);
      setIsWatching(false);
      setWs(null);

      // Reject any pending requests
      pendingPlanRequests.current.forEach((pending) => {
        pending.reject(new Error('WebSocket disconnected'));
      });
      pendingPlanRequests.current.clear();
    };
  }, [enabled, wsUrl, sessionId, handleMessage]);

  // Request plan data from server
  const requestPlan = useCallback(
    (planPath: string): Promise<ParsedPlanFile | null> => {
      return new Promise((resolve, reject) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket not connected'));
          return;
        }

        // Store pending request
        pendingPlanRequests.current.set(planPath, { resolve, reject });

        // Send request
        const message: GSDOutboundMessage = {
          type: 'request_gsd_plan',
          sessionId,
          planPath,
        };
        ws.send(JSON.stringify(message));

        // Timeout after 10 seconds
        setTimeout(() => {
          const pending = pendingPlanRequests.current.get(planPath);
          if (pending) {
            pending.reject(new Error('Request timed out'));
            pendingPlanRequests.current.delete(planPath);
          }
        }, 10000);
      });
    },
    [ws, sessionId]
  );

  return {
    isConnected,
    isWatching,
    lastUpdate,
    ws,
    requestPlan,
  };
}
