import { useState, useEffect, useCallback, useRef } from 'react';
import { getGSDBackendClient } from '../../services/gsd/GSDBackendClient';
import type {
  GSDSession,
  GSDCommand,
  GSDProgressState,
  GSDChoicePrompt,
  GSDExecutionResult,
  GSDError,
  GSDChoice,
  GSDUpdate,
} from '../../types/gsd';

interface UseGSDOptions {
  autoConnect?: boolean;
  projectName?: string;
  onSessionStart?: (session: GSDSession) => void;
  onExecutionComplete?: (result: GSDExecutionResult) => void;
  onError?: (error: GSDError) => void;
}

export function useGSD(options: UseGSDOptions = {}) {
  const {
    autoConnect = true,
    projectName = 'Default Project',
    onSessionStart,
    onExecutionComplete,
    onError,
  } = options;

  // Core state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<GSDSession | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [progressState, setProgressState] = useState<GSDProgressState | null>(null);
  const [currentChoice, setCurrentChoice] = useState<GSDChoicePrompt | null>(null);

  // Backend client reference
  const backendClient = useRef(getGSDBackendClient());
  const unsubscribeUpdates = useRef<(() => void) | null>(null);

  // Connection management
  const connect = useCallback(async () => {
    if (isConnected || isConnecting) return;

    setIsConnecting(true);
    setConnectionError(null);

    try {
      await backendClient.current.connect();
      setIsConnected(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      setConnectionError(errorMessage);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [isConnected, isConnecting]);

  const disconnect = useCallback(async () => {
    if (!isConnected) return;

    try {
      await backendClient.current.disconnect();
      setIsConnected(false);
      setActiveSession(null);
      setIsExecuting(false);
      setProgressState(null);
      setCurrentChoice(null);
      setConnectionError(null);
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }, [isConnected]);

  // Session management
  const startSession = useCallback(async (customProjectName?: string) => {
    if (!isConnected) {
      throw new Error('Not connected to backend');
    }

    if (activeSession) {
      await backendClient.current.endSession(activeSession.id);
    }

    const session = await backendClient.current.startGSDSession(
      customProjectName || projectName
    );

    setActiveSession(session);
    onSessionStart?.(session);

    return session;
  }, [isConnected, activeSession, projectName, onSessionStart]);

  const endSession = useCallback(async () => {
    if (!activeSession) return;

    await backendClient.current.endSession(activeSession.id);
    setActiveSession(null);
    setIsExecuting(false);
    setProgressState(null);
    setCurrentChoice(null);
  }, [activeSession]);

  // Command execution
  const executeCommand = useCallback(async (command: GSDCommand, input?: string) => {
    if (!activeSession) {
      throw new Error('No active session');
    }

    if (isExecuting) {
      throw new Error('Already executing a command');
    }

    setIsExecuting(true);
    setProgressState(null);
    setCurrentChoice(null);

    try {
      const stream = await backendClient.current.executeGSDCommand(
        activeSession.id,
        command,
        input,
        activeSession.context
      );

      // Set up stream handlers
      stream.onProgress = (progress: GSDProgressState) => {
        setProgressState(progress);
      };

      stream.onChoice = (prompt: GSDChoicePrompt) => {
        setCurrentChoice(prompt);
      };

      stream.onComplete = (result: GSDExecutionResult) => {
        setIsExecuting(false);
        setProgressState(null);
        setCurrentChoice(null);
        onExecutionComplete?.(result);
      };

      stream.onError = (error: GSDError) => {
        setIsExecuting(false);
        setProgressState(null);
        setCurrentChoice(null);
        onError?.(error);
      };

      return stream;
    } catch (error) {
      setIsExecuting(false);
      throw error;
    }
  }, [activeSession, isExecuting, onExecutionComplete, onError]);

  // Choice handling
  const submitChoice = useCallback(async (choices: GSDChoice[]) => {
    if (!activeSession || !currentChoice) return;

    try {
      await backendClient.current.submitChoice(activeSession.id, choices);
      setCurrentChoice(null);
    } catch (error) {
      console.error('Choice submission error:', error);
      throw error;
    }
  }, [activeSession, currentChoice]);

  const cancelChoice = useCallback(() => {
    setCurrentChoice(null);
  }, []);

  // Execution control
  const cancelExecution = useCallback(async () => {
    if (!activeSession || !isExecuting) return;

    try {
      await backendClient.current.cancelExecution(activeSession.id);
      setIsExecuting(false);
      setProgressState(null);
      setCurrentChoice(null);
    } catch (error) {
      console.error('Cancel execution error:', error);
      throw error;
    }
  }, [activeSession, isExecuting]);

  // Backend event listeners
  useEffect(() => {
    const client = backendClient.current;

    const handleConnected = () => {
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionError(null);
    };

    const handleDisconnected = () => {
      setIsConnected(false);
      setActiveSession(null);
      setIsExecuting(false);
      setProgressState(null);
      setCurrentChoice(null);
    };

    const handleError = (error: Error) => {
      setConnectionError(error.message);
      setIsConnecting(false);
    };

    const handleSessionStarted = (session: GSDSession) => {
      setActiveSession(session);
      onSessionStart?.(session);
    };

    const handleSessionEnded = () => {
      setActiveSession(null);
      setIsExecuting(false);
      setProgressState(null);
      setCurrentChoice(null);
    };

    // Subscribe to events
    client.on('connected', handleConnected);
    client.on('disconnected', handleDisconnected);
    client.on('error', handleError);
    client.on('sessionStarted', handleSessionStarted);
    client.on('sessionEnded', handleSessionEnded);

    // Subscribe to updates
    unsubscribeUpdates.current = client.subscribeToUpdates((update: GSDUpdate) => {
      switch (update.type) {
        case 'progress':
          setProgressState(update.data as GSDProgressState);
          break;
        case 'choice':
          setCurrentChoice(update.data as GSDChoicePrompt);
          break;
        case 'complete':
          setIsExecuting(false);
          setProgressState(null);
          setCurrentChoice(null);
          onExecutionComplete?.(update.data as GSDExecutionResult);
          break;
        case 'error':
          setIsExecuting(false);
          setProgressState(null);
          setCurrentChoice(null);
          onError?.(update.data as GSDError);
          break;
      }
    });

    return () => {
      client.off('connected', handleConnected);
      client.off('disconnected', handleDisconnected);
      client.off('error', handleError);
      client.off('sessionStarted', handleSessionStarted);
      client.off('sessionEnded', handleSessionEnded);

      if (unsubscribeUpdates.current) {
        unsubscribeUpdates.current();
      }
    };
  }, [onSessionStart, onExecutionComplete, onError]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && !isConnected && !isConnecting) {
      connect().catch(console.error);
    }
  }, [autoConnect, isConnected, isConnecting, connect]);

  // Auto-start session when connected
  useEffect(() => {
    if (isConnected && !activeSession && projectName) {
      startSession().catch(console.error);
    }
  }, [isConnected, activeSession, projectName, startSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeSession) {
        backendClient.current.endSession(activeSession.id).catch(console.error);
      }
      if (isConnected) {
        backendClient.current.disconnect().catch(console.error);
      }
    };
  }, []);

  return {
    // Connection state
    isConnected,
    isConnecting,
    connectionError,

    // Session state
    activeSession,
    isExecuting,
    progressState,
    currentChoice,

    // Actions
    connect,
    disconnect,
    startSession,
    endSession,
    executeCommand,
    submitChoice,
    cancelChoice,
    cancelExecution,

    // Computed state
    canExecute: isConnected && activeSession && !isExecuting,
    hasActiveChoice: currentChoice !== null,
    isIdle: !isExecuting && !currentChoice,
  };
}

// Hook for managing GSD commands
export function useGSDCommands() {
  const gsd = useGSD();

  const executeById = useCallback(async (commandId: string, input?: string) => {
    // In a real implementation, this would look up the command by ID
    // For now, we'll simulate with a basic command
    const mockCommand: GSDCommand = {
      id: commandId,
      label: 'Mock Command',
      description: 'Simulated command execution',
      slashCommand: `/${commandId}`,
      category: 'execution',
      icon: '⚡',
    };

    return gsd.executeCommand(mockCommand, input);
  }, [gsd]);

  const executeSlashCommand = useCallback(async (slashCommand: string, input?: string) => {
    // Parse slash command to create GSD command
    const mockCommand: GSDCommand = {
      id: slashCommand.replace('/', ''),
      label: slashCommand.replace('/', '').replace('-', ' '),
      description: `Execute ${slashCommand}`,
      slashCommand,
      category: 'execution',
      icon: '⚡',
    };

    return gsd.executeCommand(mockCommand, input);
  }, [gsd]);

  return {
    ...gsd,
    executeById,
    executeSlashCommand,
  };
}

// Hook for managing GSD choice dialogs
export function useGSDChoices() {
  const gsd = useGSD();

  const createChoice = useCallback((
    label: string,
    action: GSDChoice['action'] = 'continue',
    description?: string,
    shortcut?: string
  ): Omit<GSDChoice, 'id'> => ({
    label,
    description,
    action,
    shortcut,
  }), []);

  const createYesNoChoice = useCallback(() => [
    createChoice('Yes', 'continue', 'Proceed with this action', 'y'),
    createChoice('No', 'abort', 'Cancel this action', 'n'),
  ], [createChoice]);

  const createContinueModifyAbortChoice = useCallback(() => [
    createChoice('Continue', 'continue', 'Proceed as planned', 'c'),
    createChoice('Modify', 'modify', 'Adjust the approach', 'm'),
    createChoice('Abort', 'abort', 'Cancel this operation', 'a'),
  ], [createChoice]);

  return {
    ...gsd,
    createChoice,
    createYesNoChoice,
    createContinueModifyAbortChoice,
  };
}