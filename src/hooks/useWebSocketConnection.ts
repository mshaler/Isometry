/**
 * useWebSocketConnection
 *
 * React hook for WebSocket connection state management.
 * Provides reactive connection status, reconnect tracking, and connect/disconnect methods.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getClaudeCodeDispatcher,
  WebSocketClaudeCodeDispatcher,
  ConnectionStatus
} from '../services/claudeCodeWebSocketDispatcher';

export interface UseWebSocketConnectionResult {
  /** Current connection status */
  status: ConnectionStatus;
  /** Current reconnection attempt number (0 if not reconnecting) */
  reconnectAttempt: number;
  /** Maximum reconnection attempts configured */
  maxReconnectAttempts: number;
  /** Connect to the WebSocket server */
  connect: () => Promise<void>;
  /** Disconnect from the WebSocket server */
  disconnect: () => void;
  /** Convenience boolean for connected state */
  isConnected: boolean;
}

/**
 * Hook for managing WebSocket connection state
 *
 * @example
 * ```tsx
 * const { status, isConnected, connect, disconnect } = useWebSocketConnection();
 *
 * return (
 *   <div>
 *     Status: {status}
 *     {!isConnected && <button onClick={connect}>Connect</button>}
 *     {isConnected && <button onClick={disconnect}>Disconnect</button>}
 *   </div>
 * );
 * ```
 */
export function useWebSocketConnection(): UseWebSocketConnectionResult {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [dispatcher, setDispatcher] = useState<WebSocketClaudeCodeDispatcher | null>(null);
  const [maxReconnectAttempts, setMaxReconnectAttempts] = useState(10);

  // Initialize dispatcher and subscribe to status changes
  useEffect(() => {
    let mounted = true;
    let currentDispatcher: WebSocketClaudeCodeDispatcher | null = null;

    const initDispatcher = async () => {
      try {
        const d = await getClaudeCodeDispatcher();

        // Check if it's a WebSocketClaudeCodeDispatcher with our methods
        if (d && 'getConnectionStatus' in d) {
          currentDispatcher = d as WebSocketClaudeCodeDispatcher;

          if (mounted) {
            setDispatcher(currentDispatcher);

            // Get initial status
            const initialStatus = currentDispatcher.getConnectionStatus();
            setStatus(initialStatus);

            // Get max attempts
            if ('getMaxReconnectAttempts' in currentDispatcher) {
              setMaxReconnectAttempts(currentDispatcher.getMaxReconnectAttempts());
            }
          }
        }
      } catch {
        // Dispatcher not available, stay disconnected
        if (mounted) {
          setStatus('disconnected');
        }
      }
    };

    initDispatcher();

    return () => {
      mounted = false;
    };
  }, []);

  // Set up status change subscription via polling
  // (since the dispatcher uses callbacks, we poll to get status updates)
  useEffect(() => {
    if (!dispatcher) return;

    const pollInterval = setInterval(() => {
      const currentStatus = dispatcher.getConnectionStatus();
      setStatus(prevStatus => {
        if (prevStatus !== currentStatus) {
          return currentStatus;
        }
        return prevStatus;
      });

      // Update reconnect attempt count
      if ('getReconnectAttemptCount' in dispatcher) {
        const attemptCount = dispatcher.getReconnectAttemptCount();
        setReconnectAttempt(attemptCount);
      }
    }, 500); // Poll every 500ms

    return () => {
      clearInterval(pollInterval);
    };
  }, [dispatcher]);

  // Memoized connect function
  const connect = useCallback(async (): Promise<void> => {
    if (!dispatcher) {
      // Try to get dispatcher if not initialized
      const d = await getClaudeCodeDispatcher();
      if (d && 'connect' in d) {
        await (d as WebSocketClaudeCodeDispatcher).connect();
      }
      return;
    }

    await dispatcher.connect();
  }, [dispatcher]);

  // Memoized disconnect function
  const disconnect = useCallback((): void => {
    if (dispatcher && 'disconnect' in dispatcher) {
      dispatcher.disconnect();
    }
  }, [dispatcher]);

  // Convenience boolean
  const isConnected = useMemo(() => status === 'connected', [status]);

  return {
    status,
    reconnectAttempt,
    maxReconnectAttempts,
    connect,
    disconnect,
    isConnected
  };
}

export default useWebSocketConnection;
