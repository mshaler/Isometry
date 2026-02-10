/**
 * GSDInterface Component
 *
 * Main GSD GUI interface that replaces the placeholder in the Shell gsd-gui tab.
 * Manages GSD session state, displays progress, and handles user interactions.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  PlayCircle,
  Square,
  RefreshCw,
  Settings,
  FolderOpen,
  AlertCircle,
  Sparkles,
  Terminal,
  Zap
} from 'lucide-react';
import { ExecutionProgress } from './ExecutionProgress';
import { ChoicePrompt } from './ChoicePrompt';
import { CommandPalette, CommandInputModal } from './CommandPalette';
import { QuickActions } from './QuickActions';
import { RichCommandBuilder, CommandTemplate, BuiltCommand } from './RichCommandBuilder';
import { ClaudeCodeTerminal } from './ClaudeCodeTerminal';
import { GSDService } from '../../services/gsdService';
import { GSDSessionState, GSDPhase, FileChange } from '../../types/gsd';
import { useSQLite } from '../../db/SQLiteProvider';
import { useGSDTerminalIntegration } from '../../hooks/useGSDTerminalIntegration';
import { getClaudeCodeDispatcher, GSDCommands } from '../../services/claudeCodeWebSocketDispatcher';
import { gsdSlashCommands, SlashCommand } from '../../services/gsdSlashCommands';
import { FileChangeEvent } from '../../services/claudeCodeServer';
import { devLogger } from '../../utils/logging';

interface GSDInterfaceProps {
  className?: string;
}

export function GSDInterface({ className }: GSDInterfaceProps) {
  const { db } = useSQLite();
  const [gsdService, setGsdService] = useState<GSDService | null>(null);
  const [sessionState, setSessionState] = useState<GSDSessionState | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandInputModal, setCommandInputModal] = useState<{ command: SlashCommand; isOpen: boolean }>({ command: null as any, isOpen: false });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'builder' | 'terminal'>('dashboard');
  const [savedTemplates, setSavedTemplates] = useState<CommandTemplate[]>([]);

  // Initialize GSD service when database is available
  useEffect(() => {
    if (db && !gsdService) {
      const service = new GSDService(db);
      service.initializeSchema().then(() => {
        setGsdService(service);
      }).catch(err => {
        setError(`Failed to initialize GSD: ${err.message}`);
      });
    }
  }, [db, gsdService]);

  // Set up terminal integration for real-time GSD updates
  useGSDTerminalIntegration({
    gsdService,
    sessionId: sessionState?.sessionId || null,
    enabled: !!sessionState && !!gsdService,
    onStateUpdate: (updatedState) => {
      setSessionState(updatedState);
    },
    onChoicePrompt: (choices) => {
      devLogger.debug('Choice prompt received', { component: 'GSDInterface', choices });
    },
    onError: (error) => {
      setError(error);
    }
  });

  // Mock data for development - shows what the interface looks like
  const mockSessionState: GSDSessionState = {
    sessionId: 'demo-session',
    projectPath: '/Users/mshaler/Developer/Projects/Isometry',
    startedAt: new Date(),
    phase: 'implement' as GSDPhase,
    status: 'executing',
    pendingChoices: [
      {
        id: 'choice-1',
        index: 0,
        text: 'Implement SuperGrid cell rendering with D3.js data binding'
      },
      {
        id: 'choice-2',
        index: 1,
        text: 'Set up LATCH filter navigation system'
      },
      {
        id: 'choice-3',
        index: 2,
        text: 'Build graph force simulation for network view'
      }
    ],
    pendingInputType: 'choice',
    phaseHistory: [
      {
        phase: 'spec' as GSDPhase,
        status: 'completed',
        startedAt: new Date(Date.now() - 300000), // 5 minutes ago
        completedAt: new Date(Date.now() - 240000), // 4 minutes ago
        duration: 60000
      },
      {
        phase: 'plan' as GSDPhase,
        status: 'completed',
        startedAt: new Date(Date.now() - 240000),
        completedAt: new Date(Date.now() - 120000),
        duration: 120000
      },
      {
        phase: 'implement' as GSDPhase,
        status: 'active',
        startedAt: new Date(Date.now() - 120000)
      }
    ],
    messageLog: [],
    fileChanges: [
      {
        path: 'src/components/SuperGrid.tsx',
        type: 'create',
        timestamp: new Date()
      },
      {
        path: 'src/hooks/useGridData.ts',
        type: 'modify',
        timestamp: new Date()
      }
    ],
    tokenUsage: {
      input: 8240,
      output: 12150,
      cost: 0.0847
    },
    executionTime: 180000, // 3 minutes
    isCollapsed: false,
    showDetails: false
  };

  const handleStartNewSession = async () => {
    if (!gsdService) return;

    setIsInitializing(true);
    setError(null);

    try {
      const sessionId = gsdService.createSession(
        '/Users/mshaler/Developer/Projects/Isometry',
        'GSD Workflow Session'
      );

      const newState = gsdService.getSessionState(sessionId);
      if (newState) {
        setSessionState(newState);

        // Start file monitoring for the session
        const dispatcher = await getClaudeCodeDispatcher();
        if ('startFileMonitoring' in dispatcher) {
          await (dispatcher as any).startFileMonitoring(
            sessionId,
            newState.projectPath,
            handleFileChange
          );
        }

        // Start the GSD workflow
        const command = GSDCommands.startWorkflow(
          'Implement GSD integration features',
          newState.projectPath
        );

        const execution = await dispatcher.executeAsync(command);
        setCurrentExecutionId(execution.id);

        // Listen for command output and parse it
        dispatcher.getExecution(execution.id);
      }
    } catch (err) {
      setError(`Failed to create session: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleChoiceSelect = useCallback(async (indices: number[]) => {
    if (!sessionState?.pendingChoices || !gsdService) return;

    try {
      // Send choice selection to Claude Code
      const selectedChoices = indices.map(i => sessionState.pendingChoices![i]);
      devLogger.debug('GSD Choice Selected', { component: 'GSDInterface', selectedChoices, indices });

      // For single choice, send the index
      if (indices.length === 1) {
        const command = GSDCommands.selectChoice(indices[0] + 1); // Claude expects 1-based
        const dispatcher = await getClaudeCodeDispatcher();
        const execution = await dispatcher.executeAsync(command);
        setCurrentExecutionId(execution.id);
      }

      // Clear pending choices and update status
      gsdService.updateSessionState(sessionState.sessionId, {
        pendingChoices: null,
        pendingInputType: null,
        status: 'executing'
      });

      // Refresh state
      const updatedState = gsdService.getSessionState(sessionState.sessionId);
      if (updatedState) {
        setSessionState(updatedState);
      }
    } catch (error) {
      setError(`Failed to send choice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [sessionState, gsdService]);

  const handleFreeformInput = useCallback(async () => {
    // For now, send a generic "help" message to trigger more detailed explanation
    devLogger.debug('Requesting freeform input from Claude', { component: 'GSDInterface' });

    if (sessionState && gsdService) {
      try {
        const command = GSDCommands.sendInput('Please explain the options in more detail');
        const dispatcher = await getClaudeCodeDispatcher();
        const execution = await dispatcher.executeAsync(command);
        setCurrentExecutionId(execution.id);

        // Update session to indicate we're waiting for Claude's response
        gsdService.updateSessionState(sessionState.sessionId, {
          status: 'executing'
        });
      } catch (error) {
        setError(`Failed to send input: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }, [sessionState, gsdService]);

  const handleAbort = useCallback(async () => {
    if (!gsdService || !sessionState) return;

    try {
      // Cancel current execution
      if (currentExecutionId) {
        const dispatcher = await getClaudeCodeDispatcher();
        await dispatcher.cancel(currentExecutionId);
        setCurrentExecutionId(null);
      }

      // Update session status
      gsdService.updateSessionState(sessionState.sessionId, {
        status: 'error'
      });

      // Add abort message
      gsdService.addMessage(sessionState.sessionId, {
        timestamp: new Date(),
        type: 'system',
        content: 'Session aborted by user',
        phase: sessionState.phase
      });

      devLogger.debug('GSD session aborted', { component: 'GSDInterface', sessionId: sessionState.sessionId });
    } catch (error) {
      setError(`Failed to abort session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [gsdService, sessionState, currentExecutionId]);

  const handleRestart = useCallback(async () => {
    if (!gsdService || !sessionState) return;

    try {
      // Create new session with same parameters
      const newSessionId = gsdService.createSession(
        sessionState.projectPath,
        'GSD Workflow Session (Restarted)'
      );

      const newState = gsdService.getSessionState(newSessionId);
      if (newState) {
        setSessionState(newState);
        setCurrentExecutionId(null);

        // Start fresh workflow
        const command = GSDCommands.startWorkflow(
          'Continue with GSD implementation',
          newState.projectPath
        );

        const dispatcher = await getClaudeCodeDispatcher();
        const execution = await dispatcher.executeAsync(command);
        setCurrentExecutionId(execution.id);
      }

      devLogger.debug('GSD session restarted', { component: 'GSDInterface', sessionId: newSessionId });
    } catch (error) {
      setError(`Failed to restart session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [gsdService, sessionState]);

  // Handle slash command execution
  const handleSlashCommand = useCallback(async (commandName: string, args: string[] = []) => {
    if (!gsdService) {
      setError('GSD service not initialized');
      return;
    }

    try {
      const execution = await gsdSlashCommands.executeCommand(
        commandName,
        args,
        {
          sessionId: sessionState?.sessionId,
          projectPath: sessionState?.projectPath || '/Users/mshaler/Developer/Projects/Isometry'
        }
      );

      if (execution.executionId) {
        setCurrentExecutionId(execution.executionId);
      }

      // Handle special commands that affect UI state
      if (commandName === '/start' && execution.executionId) {
        // Create new session if /start was successful
        const newSessionId = gsdService.createSession(
          sessionState?.projectPath || '/Users/mshaler/Developer/Projects/Isometry',
          args.join(' ') || 'GSD Workflow Session'
        );

        const newState = gsdService.getSessionState(newSessionId);
        if (newState) {
          setSessionState(newState);
        }
      }
    } catch (error) {
      setError(`Failed to execute ${commandName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [gsdService, sessionState]);

  // Handle command input modal
  const handleCommandWithInput = useCallback((command: SlashCommand) => {
    setCommandInputModal({ command, isOpen: true });
  }, []);

  const handleCommandInputSubmit = useCallback((commandName: string, input: string) => {
    const args = input.split(/\s+/).filter(Boolean);
    handleSlashCommand(commandName, args);
    setCommandInputModal({ command: null as any, isOpen: false });
  }, [handleSlashCommand]);

  const handleCommandInputClose = useCallback(() => {
    setCommandInputModal({ command: null as any, isOpen: false });
  }, []);

  // Rich Command Builder handlers
  const handleBuiltCommandExecute = useCallback(async (command: BuiltCommand) => {
    try {
      const claudeCommand = {
        command: 'claude',
        args: [command.finalCommand],
        workingDirectory: sessionState?.projectPath || '/Users/mshaler/Developer/Projects/Isometry'
      };

      const dispatcher = await getClaudeCodeDispatcher();
      const execution = await dispatcher.executeAsync(claudeCommand);
      setCurrentExecutionId(execution.id);

      devLogger.debug('Rich command executed', { component: 'GSDInterface', finalCommand: command.finalCommand, executionId: execution.id });
    } catch (error) {
      setError(`Failed to execute command: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [sessionState]);

  const handleSaveTemplate = useCallback((template: CommandTemplate) => {
    setSavedTemplates(prev => [...prev, template]);
    devLogger.debug('Template saved', { component: 'GSDInterface', templateName: template.name, template });
  }, []);

  // Claude Code Terminal handlers
  const handleTerminalCommandExecute = useCallback(async (command: string) => {
    try {
      const claudeCommand = {
        command: 'claude',
        args: [command],
        workingDirectory: sessionState?.projectPath || '/Users/mshaler/Developer/Projects/Isometry'
      };

      const dispatcher = await getClaudeCodeDispatcher();
      const execution = await dispatcher.executeAsync(claudeCommand);
      setCurrentExecutionId(execution.id);

      devLogger.debug('Terminal command executed', { component: 'GSDInterface', command, executionId: execution.id });
    } catch (error) {
      setError(`Failed to execute terminal command: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [sessionState]);

  const handleTerminalChoiceSelect = useCallback(async (choices: number[]) => {
    if (choices.length === 1) {
      try {
        const command = GSDCommands.selectChoice(choices[0]);
        const dispatcher = await getClaudeCodeDispatcher();
        const execution = await dispatcher.executeAsync(command);
        setCurrentExecutionId(execution.id);
        devLogger.debug('Terminal choice selected', { component: 'GSDInterface', choice: choices[0], executionId: execution.id });
      } catch (error) {
        setError(`Failed to send choice: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }, []);

  // Handle file changes from file monitoring
  const handleFileChange = useCallback((fileChange: FileChangeEvent) => {
    if (!gsdService || !sessionState) return;

    try {
      // Convert FileChangeEvent to GSD FileChange format
      const gsdFileChange: FileChange = {
        path: fileChange.path,
        type: fileChange.changeType,
        timestamp: new Date(fileChange.timestamp)
      };

      // Add file change to GSD service
      gsdService.addFileChange(sessionState.sessionId, gsdFileChange);

      // Update the session state to reflect the new file change
      const updatedState = gsdService.getSessionState(sessionState.sessionId);
      if (updatedState) {
        setSessionState(updatedState);
      }

      devLogger.inspect('File change detected and recorded', {
        component: 'GSDInterface',
        changeType: fileChange.changeType,
        path: fileChange.path,
        sessionId: sessionState.sessionId
      });
    } catch (error) {
      devLogger.error('Error handling file change', { component: 'GSDInterface', error, fileChangePath: fileChange.path });
      setError(`Failed to record file change: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [gsdService, sessionState]);

  // Keyboard shortcuts for command palette
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'k') {
        event.preventDefault();
        setShowCommandPalette(true);
      }
      if (event.key === 'Escape') {
        setShowCommandPalette(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Use mock data for now since we don't have Claude Code integration yet
  const displayState = sessionState || mockSessionState;

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center min-h-[400px]`}>
        <div className="text-center text-red-400 space-y-3">
          <AlertCircle size={48} className="mx-auto" />
          <h3 className="font-medium">GSD Initialization Error</h3>
          <p className="text-sm text-gray-400 max-w-md">{error}</p>
          <button
            onClick={() => setError(null)}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!gsdService && !error) {
    return (
      <div className={`${className} flex items-center justify-center min-h-[400px]`}>
        <div className="text-center text-gray-400 space-y-3">
          <RefreshCw size={48} className="mx-auto animate-spin" />
          <h3 className="font-medium">Initializing GSD</h3>
          <p className="text-sm">Setting up SQLite schema and services...</p>
        </div>
      </div>
    );
  }

  if (!sessionState && !mockSessionState) {
    return (
      <div className={`${className} flex flex-col items-center justify-center min-h-[400px] space-y-6`}>
        <div className="text-center space-y-3">
          <Sparkles size={64} className="mx-auto text-blue-400" />
          <h2 className="text-xl font-bold text-gray-200">GSD - Getting Shit Done</h2>
          <p className="text-gray-400 max-w-md">
            Visual interface for Claude Code workflows. Create a new session to get started with
            guided development workflows.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={handleStartNewSession}
            disabled={isInitializing}
            className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlayCircle size={20} />
            {isInitializing ? 'Starting Session...' : 'Start New GSD Session'}
          </button>

          <button className="flex items-center gap-3 px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors">
            <FolderOpen size={16} />
            Load Recent Session
          </button>

          <button className="flex items-center gap-3 px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors">
            <Settings size={16} />
            Configure Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} h-full flex flex-col space-y-4 p-4`}>
      {/* Session Header */}
      <div className="flex items-center justify-between bg-gray-800 rounded-lg p-3 border border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Sparkles size={20} className="text-blue-400" />
            <h2 className="font-medium text-gray-200">GSD Session</h2>
          </div>
          <span className="text-sm text-gray-400">•</span>
          <span className="text-sm text-gray-400">{displayState.projectPath.split('/').pop()}</span>
        </div>

        <div className="flex items-center space-x-2">
          {displayState.status === 'executing' && (
            <button
              onClick={handleAbort}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              <Square size={12} />
              Abort
            </button>
          )}

          {displayState.status !== 'executing' && (
            <button
              onClick={handleRestart}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              <RefreshCw size={12} />
              Restart
            </button>
          )}
        </div>
      </div>

      {/* Command Palette Overlay */}
      {showCommandPalette && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-start justify-center pt-20">
          <CommandPalette
            phase={displayState.phase}
            status={displayState.status}
            hasActiveSession={!!sessionState}
            onCommandExecute={handleSlashCommand}
            onShowInput={handleCommandWithInput}
            className="w-full max-w-2xl mx-4"
          />
        </div>
      )}

      {/* Command Input Modal */}
      <CommandInputModal
        command={commandInputModal.command}
        isOpen={commandInputModal.isOpen}
        onSubmit={handleCommandInputSubmit}
        onClose={handleCommandInputClose}
      />

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1 border border-gray-700">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'dashboard'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
          }`}
        >
          <Sparkles size={16} />
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('builder')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'builder'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
          }`}
        >
          <Zap size={16} />
          Command Builder
        </button>
        <button
          onClick={() => setActiveTab('terminal')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'terminal'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
          }`}
        >
          <Terminal size={16} />
          Enhanced Terminal
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'dashboard' && (
          <div className="h-full space-y-4">
            {/* Quick Actions */}
            <QuickActions
              phase={displayState.phase}
              status={displayState.status}
              hasActiveSession={!!sessionState}
              onCommandExecute={handleSlashCommand}
              onShowCommandPalette={() => setShowCommandPalette(true)}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4"
            />

            {/* Progress Section */}
            <ExecutionProgress
              currentPhase={displayState.phase}
              phaseHistory={displayState.phaseHistory}
              activeToolUse={displayState.status === 'executing' ? 'Writing SuperGrid component with D3.js data binding...' : null}
              fileChanges={{
                created: displayState.fileChanges.filter(f => f.type === 'create').length,
                modified: displayState.fileChanges.filter(f => f.type === 'modify').length,
                deleted: displayState.fileChanges.filter(f => f.type === 'delete').length
              }}
              tokenUsage={displayState.tokenUsage}
              status={displayState.status}
            />

            {/* Choice Prompt Section */}
            {displayState.pendingChoices && displayState.status === 'waiting-input' && (
              <ChoicePrompt
                choices={displayState.pendingChoices}
                multiSelect={false}
                onSelect={handleChoiceSelect}
                onFreeformInput={handleFreeformInput}
                disabled={displayState.status !== 'waiting-input'}
              />
            )}

            {/* Status Message */}
            {displayState.status === 'executing' && (
              <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-200">
                  <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse" />
                  <span className="font-medium">Claude is working...</span>
                </div>
                <p className="text-sm text-gray-300 mt-1">
                  Implementation in progress. This may take a few minutes.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'builder' && (
          <div className="h-full">
            <RichCommandBuilder
              onCommandExecute={handleBuiltCommandExecute}
              onSaveTemplate={handleSaveTemplate}
              savedTemplates={savedTemplates}
              className="h-full"
            />
          </div>
        )}

        {activeTab === 'terminal' && (
          <div className="h-full">
            <ClaudeCodeTerminal
              sessionId={sessionState?.sessionId}
              onChoiceSelect={handleTerminalChoiceSelect}
              onCommandExecute={handleTerminalCommandExecute}
              className="h-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}