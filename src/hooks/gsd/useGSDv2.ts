/**
 * GSD Hook v2 - Database Backed
 *
 * Enhanced GSD hook that integrates with SQLite database
 * Replaces simulation with real data persistence
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { GSDBackendClientV2 } from '../../services/gsd/GSDBackendClientV2';
import { useGSDDatabase } from './useGSDDatabase';
import type {
  GSDSession,
  GSDCommand,
  GSDProgressState,
  GSDChoicePrompt,
  GSDExecutionResult,
  GSDError,
  GSDChoice,
  GSDUpdate,
  GSDExecutionStream,
} from '../../types/gsd';

interface UseGSDv2Options {
  autoConnect?: boolean;
  projectName?: string;
  onSessionStart?: (session: GSDSession) => void;
  onExecutionComplete?: (result: GSDExecutionResult) => void;
  onError?: (error: GSDError) => void;
}

export function useGSDv2(options: UseGSDv2Options = {}) {
  const {
    autoConnect = true,
    projectName = 'Default Project',
    onSessionStart,
    onExecutionComplete,
    onError,
  } = options;

  // Database integration
  const gsdDatabase = useGSDDatabase();

  // Core state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<GSDSession | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [progressState, setProgressState] = useState<GSDProgressState | null>(null);
  const [currentChoice, setCurrentChoice] = useState<GSDChoicePrompt | null>(null);
  const [executionHistory, setExecutionHistory] = useState<GSDExecutionResult[]>([]);

  // Backend client reference - using database-backed version
  const backendClient = useRef<GSDBackendClientV2 | null>(null);

  // Initialize backend client with database
  useEffect(() => {
    if (gsdDatabase) {
      backendClient.current = new GSDBackendClientV2(gsdDatabase, {
        databaseEnabled: true,
        realtimeSync: true,
      });
    }
  }, [gsdDatabase]);

  // Connection management
  const connect = useCallback(async () => {
    if (!backendClient.current) {
      throw new Error('Backend client not initialized');
    }

    if (isConnected || isConnecting) return;

    setIsConnecting(true);
    setConnectionError(null);

    try {
      await backendClient.current.connect();
      setIsConnected(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      setConnectionError(errorMessage);
      console.error('GSD connection error:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [isConnected, isConnecting]);

  const disconnect = useCallback(async () => {
    if (!backendClient.current || !isConnected) return;

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
    if (!backendClient.current) {
      throw new Error('Backend client not available');
    }

    if (!isConnected) {
      throw new Error('Not connected to backend');
    }

    try {
      const session = await backendClient.current.startGSDSession(
        customProjectName || projectName
      );

      setActiveSession(session);
      setExecutionHistory([]);
      onSessionStart?.(session);

      return session;
    } catch (error) {
      console.error('Session start error:', error);
      throw error;
    }
  }, [isConnected, projectName, onSessionStart]);

  const endSession = useCallback(async () => {
    if (!activeSession || !backendClient.current) return;

    try {
      // Archive the session in database
      await backendClient.current.archiveSession(activeSession.id);
      setActiveSession(null);
      setIsExecuting(false);
      setProgressState(null);
      setCurrentChoice(null);
      setExecutionHistory([]);
    } catch (error) {
      console.error('Session end error:', error);
    }
  }, [activeSession]);

  // Command execution with database persistence
  const executeCommand = useCallback(async (command: GSDCommand, input?: string) => {
    if (!activeSession || !backendClient.current) {
      throw new Error('No active session');
    }

    if (isExecuting) {
      throw new Error('Already executing a command');
    }

    setIsExecuting(true);
    setProgressState(null);
    setCurrentChoice(null);

    try {
      const stream = await backendClient.current.executeCommand(activeSession.id, command);

      // Set up progress tracking
      stream.onUpdate((update: GSDUpdate) => {
        if (update.type === 'progress') {
          setProgressState({
            currentPhase: update.phase?.name || 'Processing',
            phaseProgress: update.progress,
            totalProgress: update.progress,
            message: update.message || 'Executing command...',
            startTime: stream.startTime,
            estimatedTimeRemaining: undefined,
          });
        }
      });

      // Set up completion handling
      stream.onComplete((result: GSDExecutionResult) => {
        setIsExecuting(false);
        setProgressState(null);
        setCurrentChoice(null);
        setExecutionHistory(prev => [...prev, result]);
        onExecutionComplete?.(result);
      });

      // Set up error handling
      stream.onError((error: GSDError) => {
        setIsExecuting(false);
        setProgressState(null);
        setCurrentChoice(null);
        onError?.(error);
      });

      return stream;
    } catch (error) {
      setIsExecuting(false);
      console.error('Command execution error:', error);
      throw error;
    }
  }, [activeSession, isExecuting, onExecutionComplete, onError]);

  // Choice handling with database persistence
  const presentChoice = useCallback(async (prompt: GSDChoicePrompt): Promise<string> => {
    if (!activeSession || !backendClient.current) {
      throw new Error('No active session');
    }

    setCurrentChoice(prompt);

    try {
      const choice = await backendClient.current.presentChoice(activeSession.id, prompt);
      setCurrentChoice(null);
      return choice;
    } catch (error) {
      setCurrentChoice(null);
      throw error;
    }
  }, [activeSession]);

  const submitChoice = useCallback(async (choice: string) => {
    if (!activeSession || !currentChoice || !backendClient.current) return;

    try {
      await backendClient.current.submitChoice(activeSession.id, choice);
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
      // Cancel would be handled by the execution stream
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
    if (!client) return;

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
      onError?.({
        type: 'connection',
        message: error.message,
        code: 'CONNECTION_ERROR',
        timestamp: new Date(),
      });
    };

    const handleSessionStarted = (session: GSDSession) => {
      setActiveSession(session);
      onSessionStart?.(session);
    };

    const handleChoiceRequired = ({ prompt, resolve }: any) => {
      setCurrentChoice(prompt);

      // Store the resolver for when user makes choice
      const choiceResolver = (choice: string) => {
        resolve(choice);
        setCurrentChoice(null);
      };

      // Attach resolver to prompt for UI to use
      (prompt as any)._resolve = choiceResolver;
    };

    // Subscribe to events
    client.on('connected', handleConnected);
    client.on('disconnected', handleDisconnected);
    client.on('error', handleError);
    client.on('sessionStarted', handleSessionStarted);
    client.on('choiceRequired', handleChoiceRequired);

    return () => {
      client.off('connected', handleConnected);
      client.off('disconnected', handleDisconnected);
      client.off('error', handleError);
      client.off('sessionStarted', handleSessionStarted);
      client.off('choiceRequired', handleChoiceRequired);
    };
  }, [onSessionStart, onError]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && backendClient.current && !isConnected && !isConnecting) {
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
      if (activeSession && backendClient.current) {
        backendClient.current.archiveSession(activeSession.id).catch(console.error);
      }
      if (isConnected && backendClient.current) {
        backendClient.current.disconnect().catch(console.error);
      }
    };
  }, []);

  // Database queries for session data
  const getSessionHistory = useCallback(async () => {
    if (!backendClient.current) return [];
    return backendClient.current.getSessionHistory();
  }, []);

  const getProjectSessions = useCallback(async (projectId: string) => {
    if (!backendClient.current) return [];
    return backendClient.current.getProjectSessions(projectId);
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
    executionHistory,

    // Actions
    connect,
    disconnect,
    startSession,
    endSession,
    executeCommand,
    presentChoice,
    submitChoice,
    cancelChoice,
    cancelExecution,

    // Database queries
    getSessionHistory,
    getProjectSessions,

    // Computed state
    canExecute: isConnected && activeSession && !isExecuting,
    hasActiveChoice: currentChoice !== null,
    isIdle: !isExecuting && !currentChoice,
    hasDatabaseConnection: gsdDatabase !== null,
  };
}

// Enhanced command hook with database integration
export function useGSDCommandsv2() {
  const gsd = useGSDv2();
  const { getTemplates: getTemplatesFromDb } = useGSDDatabase() || {};

  const getAvailableCommands = useCallback(() => {
    // Return the standard GSD commands with database integration
    return [
      {
        id: 'new-project',
        label: 'New Project',
        description: 'Initialize a new GSD project with database persistence',
        slashCommand: '/gsd:new-project',
        category: 'planning' as const,
        icon: '🆕',
        requiresInput: true,
        dangerLevel: 'safe' as const,
      },
      {
        id: 'plan-phase',
        label: 'Plan Phase',
        description: 'Break down and plan project phases with database tracking',
        slashCommand: '/gsd:plan-phase',
        category: 'planning' as const,
        icon: '📋',
        requiresInput: false,
        dangerLevel: 'safe' as const,
      },
      {
        id: 'execute-plan',
        label: 'Execute Plan',
        description: 'Execute planned phases with progress persistence',
        slashCommand: '/gsd:execute-plan',
        category: 'execution' as const,
        icon: '⚡',
        requiresInput: false,
        dangerLevel: 'warning' as const,
      },
      {
        id: 'load-template',
        label: 'Load Template',
        description: 'Load a project template from database',
        slashCommand: '/gsd:load-template',
        category: 'planning' as const,
        icon: '📂',
        requiresInput: false,
        dangerLevel: 'safe' as const,
      },
      {
        id: 'save-template',
        label: 'Save Template',
        description: 'Save current session as reusable template',
        slashCommand: '/gsd:save-template',
        category: 'planning' as const,
        icon: '💾',
        requiresInput: true,
        dangerLevel: 'safe' as const,
      },
    ];
  }, []);

  const executeById = useCallback(async (commandId: string, input?: string) => {
    const commands = getAvailableCommands();
    const command = commands.find(c => c.id === commandId);

    if (!command) {
      throw new Error(`Command not found: ${commandId}`);
    }

    return gsd.executeCommand(command, input);
  }, [gsd, getAvailableCommands]);

  const executeSlashCommand = useCallback(async (slashCommand: string, input?: string) => {
    const commands = getAvailableCommands();
    const command = commands.find(c => c.slashCommand === slashCommand);

    if (!command) {
      throw new Error(`Slash command not found: ${slashCommand}`);
    }

    return gsd.executeCommand(command, input);
  }, [gsd, getAvailableCommands]);

  const getTemplates = useCallback(async (category?: string) => {
    if (!getTemplatesFromDb) return [];
    return getTemplatesFromDb(category);
  }, [getTemplatesFromDb]);

  return {
    ...gsd,
    executeById,
    executeSlashCommand,
    getAvailableCommands,
    getTemplates,
  };
}

// Enhanced choice hook with database persistence
export function useGSDChoicesv2() {
  const gsd = useGSDv2();

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

  const submitChoiceWithReasoning = useCallback(async (
    choice: string,
    reasoning?: string
  ) => {
    // This would be enhanced to store reasoning in database
    await gsd.submitChoice(choice);
  }, [gsd]);

  return {
    ...gsd,
    createChoice,
    createYesNoChoice,
    createContinueModifyAbortChoice,
    submitChoiceWithReasoning,
  };
}

// Analytics and insights hook
export function useGSDAnalytics() {
  const { getProductivityMetrics } = useGSDDatabase() || {};

  const getMetrics = useCallback(async (days = 30) => {
    if (!getProductivityMetrics) {
      return {
        avg_session_duration_hours: 0,
        avg_phases_per_session: 0,
        phase_completion_rate: 0,
        decision_speed_avg_minutes: 0,
        most_used_templates: [],
        productivity_trend: [],
      };
    }
    return getProductivityMetrics(days);
  }, [getProductivityMetrics]);

  return {
    getMetrics,
  };
}