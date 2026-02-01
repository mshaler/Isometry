import { useState, useEffect, useCallback, useRef } from 'react';
import { GSDCommandPalette, useGSDCommandPalette } from './GSDCommandPalette';
import { GSDProgressTracker } from './GSDProgressTracker';
import { GSDChoiceDialog, useGSDChoiceDialog, createGSDChoicePrompt } from './GSDChoiceDialog';
import { getGSDBackendClient } from '../../services/gsd/GSDBackendClient';
import type {
  GSDCommand,
  GSDSession,
  GSDProgressState,
  GSDChoice,
  GSDExecutionResult,
  GSDError,
} from '../../types/gsd';
import { useNotebook } from '../../contexts/NotebookContext';

interface EnhancedShellComponentProps {
  className?: string;
  onModeChange?: (mode: 'terminal' | 'gsd') => void;
}

type ShellMode = 'terminal' | 'gsd';

export function EnhancedShellComponent({
  className = '',
  onModeChange,
}: EnhancedShellComponentProps) {
  const [shellMode, setShellMode] = useState<ShellMode>('terminal');
  const [activeSession, setActiveSession] = useState<GSDSession | null>(null);
  const [progressState, setProgressState] = useState<GSDProgressState | null>(null);
  const [backendStatus, setBackendStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [terminalInput, setTerminalInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  const { activeCard } = useNotebook();
  const commandPalette = useGSDCommandPalette();
  const choiceDialog = useGSDChoiceDialog();
  const backendClient = useRef(getGSDBackendClient());
  const terminalRef = useRef<HTMLDivElement>(null);

  // Initialize backend connection
  useEffect(() => {
    const client = backendClient.current;

    const handleConnected = () => setBackendStatus('connected');
    const handleDisconnected = () => setBackendStatus('disconnected');
    const handleError = (error: Error) => {
      setBackendStatus('error');
      console.error('GSD Backend Error:', error);
    };

    client.on('connected', handleConnected);
    client.on('disconnected', handleDisconnected);
    client.on('error', handleError);

    // Auto-connect when switching to GSD mode
    if (shellMode === 'gsd' && backendStatus === 'disconnected') {
      setBackendStatus('connecting');
      client.connect().catch(handleError);
    }

    return () => {
      client.off('connected', handleConnected);
      client.off('disconnected', handleDisconnected);
      client.off('error', handleError);
    };
  }, [shellMode, backendStatus]);

  // Handle mode changes
  useEffect(() => {
    onModeChange?.(shellMode);
  }, [shellMode, onModeChange]);

  // Initialize GSD session when switching to GSD mode
  useEffect(() => {
    if (shellMode === 'gsd' && backendStatus === 'connected' && !activeSession) {
      initializeGSDSession();
    }
  }, [shellMode, backendStatus, activeSession]);

  const initializeGSDSession = async () => {
    try {
      const projectName = activeCard?.nodeId || 'Default Project';
      const session = await backendClient.current.startGSDSession(projectName);
      setActiveSession(session);
      addTerminalOutput(`🚀 Started GSD session: ${projectName}`);
    } catch (error) {
      addTerminalOutput(`❌ Failed to start GSD session: ${error}`);
    }
  };

  const addTerminalOutput = (message: string) => {
    setTerminalOutput(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    // Auto-scroll to bottom
    setTimeout(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    }, 50);
  };

  const handleModeToggle = () => {
    setShellMode(prev => prev === 'terminal' ? 'gsd' : 'terminal');
  };

  const handleCommandSelect = async (command: GSDCommand, input?: string) => {
    if (!activeSession || isExecuting) return;

    try {
      setIsExecuting(true);
      addTerminalOutput(`🎯 Executing: ${command.label}`);

      if (input) {
        addTerminalOutput(`📝 Input: ${input}`);
      }

      const stream = await backendClient.current.executeGSDCommand(
        activeSession.id,
        command,
        input,
        activeSession.context
      );

      // Set up stream handlers
      stream.onProgress = (progress: GSDProgressState) => {
        setProgressState(progress);
        addTerminalOutput(`⚡ ${progress.currentTask} (${Math.round(progress.progress)}%)`);
      };

      stream.onChoice = (prompt) => {
        addTerminalOutput(`❓ ${prompt.title}: ${prompt.message}`);
        choiceDialog.showChoices(prompt);
      };

      stream.onComplete = (result: GSDExecutionResult) => {
        setProgressState(null);
        setIsExecuting(false);
        addTerminalOutput(`✅ ${result.success ? 'Success' : 'Failed'}: ${result.output}`);

        if (result.filesChanged.length > 0) {
          addTerminalOutput(`📁 Files changed: ${result.filesChanged.join(', ')}`);
        }

        if (result.testsRun !== undefined) {
          addTerminalOutput(`🧪 Tests: ${result.testsPassed}/${result.testsRun} passed`);
        }

        if (result.commitHash) {
          addTerminalOutput(`💾 Committed: ${result.commitHash}`);
        }
      };

      stream.onError = (error: GSDError) => {
        setProgressState(null);
        setIsExecuting(false);
        addTerminalOutput(`❌ Error in ${error.phase}: ${error.message}`);

        if (error.suggestions) {
          error.suggestions.forEach(suggestion => {
            addTerminalOutput(`💡 Suggestion: ${suggestion}`);
          });
        }
      };

    } catch (error) {
      setIsExecuting(false);
      addTerminalOutput(`❌ Command failed: ${error}`);
    }
  };

  const handleChoiceSelect = async (choices: GSDChoice[]) => {
    if (!activeSession) return;

    try {
      await backendClient.current.submitChoice(activeSession.id, choices);
      choiceDialog.hideChoices();

      const choiceLabels = choices.map(c => c.label).join(', ');
      addTerminalOutput(`✅ Selected: ${choiceLabels}`);
    } catch (error) {
      addTerminalOutput(`❌ Choice submission failed: ${error}`);
    }
  };

  const handleTerminalSubmit = async () => {
    if (!terminalInput.trim()) return;

    const input = terminalInput.trim();
    setTerminalInput('');

    if (shellMode === 'terminal') {
      // Handle regular terminal commands
      addTerminalOutput(`$ ${input}`);
      addTerminalOutput('Command execution not implemented in this demo');
    } else if (shellMode === 'gsd') {
      // Handle GSD-specific commands
      if (input === '/help' || input === 'help') {
        showGSDHelp();
      } else if (input.startsWith('/')) {
        // Handle slash commands
        const matchingCommand = DEFAULT_GSD_COMMANDS.find(cmd =>
          cmd.slashCommand === input || cmd.slashCommand.startsWith(input)
        );
        if (matchingCommand) {
          handleCommandSelect(matchingCommand);
        } else {
          addTerminalOutput(`❌ Unknown command: ${input}`);
          addTerminalOutput(`💡 Press Cmd+K to see available commands`);
        }
      } else if (activeSession && isExecuting) {
        // Send as long-form input during execution
        try {
          await backendClient.current.submitLongFormInput(activeSession.id, input);
          addTerminalOutput(`📝 Sent: ${input}`);
        } catch (error) {
          addTerminalOutput(`❌ Input submission failed: ${error}`);
        }
      } else {
        addTerminalOutput(`💬 ${input}`);
        addTerminalOutput(`💡 Use slash commands or press Cmd+K for GSD actions`);
      }
    }
  };

  const showGSDHelp = () => {
    addTerminalOutput('🔧 GSD Mode Commands:');
    addTerminalOutput('  Cmd+K - Open command palette');
    addTerminalOutput('  /gsd:new-project - Start new project');
    addTerminalOutput('  /gsd:plan-phase - Plan implementation');
    addTerminalOutput('  /gsd:execute-plan - Execute with TDD');
    addTerminalOutput('  /gsd:debug - Debug issues');
    addTerminalOutput('  /gsd:test - Run tests');
    addTerminalOutput('  /gsd:commit - Commit changes');
    addTerminalOutput('  /help - Show this help');
    addTerminalOutput('');
    addTerminalOutput('🎯 Press Cmd+K to open the visual command palette');
  };

  const handleCancelExecution = async () => {
    if (activeSession && isExecuting) {
      try {
        await backendClient.current.cancelExecution(activeSession.id);
        setIsExecuting(false);
        setProgressState(null);
        addTerminalOutput('🛑 Execution cancelled');
      } catch (error) {
        addTerminalOutput(`❌ Cancel failed: ${error}`);
      }
    }
  };

  const getStatusIndicator = () => {
    if (shellMode === 'terminal') {
      return <span className="text-green-500">●</span>;
    }

    switch (backendStatus) {
      case 'connected': return <span className="text-green-500">●</span>;
      case 'connecting': return <span className="text-yellow-500">●</span>;
      case 'disconnected': return <span className="text-gray-500">●</span>;
      case 'error': return <span className="text-red-500">●</span>;
      default: return <span className="text-gray-500">●</span>;
    }
  };

  // Import default commands here to avoid circular dependency
  const DEFAULT_GSD_COMMANDS: GSDCommand[] = [
    {
      id: 'gsd:new-project',
      label: 'New Project',
      description: 'Start a new GSD project with research and planning',
      slashCommand: '/gsd:new-project',
      category: 'planning',
      icon: '📋',
      shortcut: 'Cmd+N',
      requiresInput: true,
    },
    {
      id: 'gsd:plan-phase',
      label: 'Plan Phase',
      description: 'Create detailed implementation plan for current phase',
      slashCommand: '/gsd:plan-phase',
      category: 'planning',
      icon: '🎯',
      requiresInput: true,
    },
    {
      id: 'gsd:execute-plan',
      label: 'Execute Plan',
      description: 'Execute the current phase plan with TDD',
      slashCommand: '/gsd:execute-plan',
      category: 'execution',
      icon: '⚡',
      dangerLevel: 'warning',
    },
  ];

  return (
    <div className={`flex flex-col h-full bg-black text-white font-mono ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-900">
        <div className="flex items-center gap-3">
          {getStatusIndicator()}
          <span className="text-sm font-medium">
            {shellMode === 'gsd' ? 'GSD Shell' : 'Terminal'}
          </span>
          {activeSession && (
            <span className="text-xs text-gray-400">
              {activeSession.projectName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {shellMode === 'gsd' && (
            <button
              onClick={() => commandPalette.toggle()}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={!activeSession}
            >
              Commands (Cmd+K)
            </button>
          )}
          <button
            onClick={handleModeToggle}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              shellMode === 'gsd'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-600 text-white hover:bg-gray-700'
            }`}
          >
            {shellMode === 'gsd' ? 'GSD' : 'TERM'}
          </button>
        </div>
      </div>

      {/* Progress Tracker */}
      {shellMode === 'gsd' && progressState && (
        <div className="p-3 border-b border-gray-700">
          <GSDProgressTracker
            progressState={progressState}
            onCancel={handleCancelExecution}
            compact={true}
          />
        </div>
      )}

      {/* Terminal Output */}
      <div
        ref={terminalRef}
        className="flex-1 p-3 overflow-y-auto text-sm leading-relaxed"
      >
        {shellMode === 'gsd' && terminalOutput.length === 0 && (
          <div className="text-gray-400">
            <div className="mb-4">
              🚀 <span className="text-green-400">GSD Mode Activated</span>
            </div>
            <div className="mb-2">Get Shit Done with AI-powered development workflow</div>
            <div className="mb-4">
              Press <kbd className="bg-gray-700 px-1 rounded">Cmd+K</kbd> to open command palette
            </div>
            <div className="text-xs">
              Available commands: /gsd:new-project, /gsd:plan-phase, /gsd:execute-plan, /help
            </div>
          </div>
        )}

        {terminalOutput.map((line, index) => (
          <div key={index} className="mb-1">
            {line}
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-gray-700 bg-gray-900">
        <div className="flex items-center gap-2">
          <span className="text-green-400">
            {shellMode === 'gsd' ? '🎯 GSD' : '$'}
          </span>
          <input
            type="text"
            value={terminalInput}
            onChange={(e) => setTerminalInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleTerminalSubmit();
              }
            }}
            placeholder={
              shellMode === 'gsd'
                ? isExecuting
                  ? "Send input to running command..."
                  : "Type command or press Cmd+K..."
                : "Type command..."
            }
            className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500"
            disabled={shellMode === 'gsd' && !activeSession}
          />
          {isExecuting && (
            <button
              onClick={handleCancelExecution}
              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Command Palette */}
      <GSDCommandPalette
        isOpen={commandPalette.isOpen}
        onClose={commandPalette.close}
        onCommandSelect={handleCommandSelect}
        isExecuting={isExecuting}
        availableCommands={DEFAULT_GSD_COMMANDS}
      />

      {/* Choice Dialog */}
      <GSDChoiceDialog
        prompt={choiceDialog.currentPrompt}
        onChoiceSelect={handleChoiceSelect}
        onCancel={choiceDialog.hideChoices}
      />
    </div>
  );
}