/**
 * Enhanced Shell Component V2 - Database Backed
 *
 * Updated shell component that uses SQLite database integration
 * Provides seamless terminal/GSD mode switching with data persistence
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { GSDCommandPalette, useGSDCommandPalette } from './GSDCommandPalette';
import { GSDProgressTracker } from './GSDProgressTracker';
import { GSDChoiceDialog, useGSDChoiceDialog, createGSDChoicePrompt } from './GSDChoiceDialog';
import { useGSDv2, useGSDCommandsv2, useGSDChoicesv2 } from '../../hooks/gsd/useGSDv2';
import { useGSDSchemaInitialization } from '../../hooks/gsd/useGSDDatabase';
import type {
  GSDCommand,
  GSDSession,
  GSDProgressState,
  GSDChoice,
  GSDExecutionResult,
  GSDError,
} from '../../types/gsd';
import { useNotebook } from '../../contexts/NotebookContext';

interface EnhancedShellComponentV2Props {
  className?: string;
  onModeChange?: (mode: 'terminal' | 'gsd') => void;
}

type ShellMode = 'terminal' | 'gsd';
type GSDStatus = 'initializing' | 'ready' | 'connecting' | 'connected' | 'error' | 'offline';

export function EnhancedShellComponentV2({
  className = '',
  onModeChange,
}: EnhancedShellComponentV2Props) {
  const [shellMode, setShellMode] = useState<ShellMode>('terminal');
  const [gsdStatus, setGSDStatus] = useState<GSDStatus>('initializing');
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    'Isometry Enhanced Shell v2.0',
    'Type "help" for commands or press Cmd+K for GSD mode',
    '',
  ]);
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const { activeCard } = useNotebook();
  const commandPalette = useGSDCommandPalette();
  const choiceDialog = useGSDChoiceDialog();
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Database and GSD integration
  const { initializeSchema } = useGSDSchemaInitialization();
  const gsd = useGSDv2({
    autoConnect: false, // Manual control for better UX
    projectName: activeCard?.nodeId || 'Shell Project',
    onSessionStart: (session) => {
      addTerminalOutput(`🚀 Started GSD session: ${session.projectName}`);
      setGSDStatus('connected');
    },
    onExecutionComplete: (result) => {
      const message = result.success
        ? `✅ Command completed: ${result.data?.message || 'Success'}`
        : `❌ Command failed: ${result.error || 'Unknown error'}`;
      addTerminalOutput(message);
    },
    onError: (error) => {
      addTerminalOutput(`❌ GSD Error: ${error.message}`);
      setGSDStatus('error');
    },
  });

  const gsdCommands = useGSDCommandsv2();

  // Initialize GSD schema when component mounts
  useEffect(() => {
    const initialize = async () => {
      try {
        setGSDStatus('initializing');
        await initializeSchema();
        setGSDStatus('ready');
        addTerminalOutput('📊 GSD database initialized');
      } catch (error) {
        setGSDStatus('error');
        addTerminalOutput(`❌ Database initialization failed: ${error}`);
      }
    };

    initialize();
  }, [initializeSchema]);

  // Handle mode changes
  useEffect(() => {
    onModeChange?.(shellMode);
  }, [shellMode, onModeChange]);

  // Auto-connect to GSD when switching modes
  useEffect(() => {
    if (shellMode === 'gsd' && gsdStatus === 'ready' && !gsd.isConnected) {
      setGSDStatus('connecting');
      gsd.connect()
        .then(() => {
          setGSDStatus('connected');
          addTerminalOutput('🔗 Connected to GSD backend');
        })
        .catch((error) => {
          setGSDStatus('error');
          addTerminalOutput(`❌ Connection failed: ${error.message}`);
        });
    }
  }, [shellMode, gsdStatus, gsd.isConnected, gsd.connect]);

  const addTerminalOutput = useCallback((message: string) => {
    setTerminalOutput(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    // Auto-scroll to bottom
    setTimeout(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  const clearTerminal = useCallback(() => {
    setTerminalOutput([
      'Isometry Enhanced Shell v2.0',
      'Type "help" for commands or press Cmd+K for GSD mode',
      '',
    ]);
  }, []);

  // Terminal command handling
  const executeTerminalCommand = useCallback(async (command: string) => {
    if (!command.trim()) return;

    addTerminalOutput(`$ ${command}`);
    setTerminalHistory(prev => [command, ...prev.slice(0, 99)]); // Keep last 100 commands
    setHistoryIndex(-1);

    const args = command.trim().split(' ');
    const cmd = args[0].toLowerCase();

    switch (cmd) {
      case 'help':
        addTerminalOutput('Available commands:');
        addTerminalOutput('  help              - Show this help message');
        addTerminalOutput('  clear             - Clear terminal output');
        addTerminalOutput('  gsd               - Switch to GSD mode');
        addTerminalOutput('  gsd:status        - Show GSD connection status');
        addTerminalOutput('  gsd:history       - Show recent GSD sessions');
        addTerminalOutput('  gsd:templates     - List available templates');
        addTerminalOutput('  echo <text>       - Echo text to output');
        addTerminalOutput('  date              - Show current date/time');
        addTerminalOutput('');
        addTerminalOutput('Press Cmd+K to open GSD command palette');
        break;

      case 'clear':
        clearTerminal();
        break;

      case 'gsd':
        if (args[1] === 'status') {
          addTerminalOutput(`GSD Status: ${gsdStatus}`);
          addTerminalOutput(`Database: ${gsd.hasDatabaseConnection ? 'Connected' : 'Disconnected'}`);
          addTerminalOutput(`Backend: ${gsd.isConnected ? 'Connected' : 'Disconnected'}`);
          if (gsd.activeSession) {
            addTerminalOutput(`Active Session: ${gsd.activeSession.projectName}`);
          }
        } else if (args[1] === 'history') {
          try {
            const sessions = await gsd.getSessionHistory();
            if (sessions.length === 0) {
              addTerminalOutput('No recent GSD sessions found');
            } else {
              addTerminalOutput('Recent GSD sessions:');
              sessions.slice(0, 5).forEach((session, i) => {
                const date = session.metadata?.created?.toLocaleDateString() || 'Unknown';
                addTerminalOutput(`  ${i + 1}. ${session.projectName} (${date})`);
              });
            }
          } catch (error) {
            addTerminalOutput(`Error fetching history: ${error}`);
          }
        } else if (args[1] === 'templates') {
          try {
            const templates = await gsdCommands.getTemplates();
            if (templates.length === 0) {
              addTerminalOutput('No GSD templates found');
            } else {
              addTerminalOutput('Available GSD templates:');
              templates.forEach((template, i) => {
                addTerminalOutput(`  ${i + 1}. ${template.template_name} (${template.category})`);
              });
            }
          } catch (error) {
            addTerminalOutput(`Error fetching templates: ${error}`);
          }
        } else {
          setShellMode('gsd');
          addTerminalOutput('Switching to GSD mode...');
        }
        break;

      case 'echo':
        addTerminalOutput(args.slice(1).join(' '));
        break;

      case 'date':
        addTerminalOutput(new Date().toString());
        break;

      case 'exit':
        if (shellMode === 'gsd') {
          setShellMode('terminal');
          addTerminalOutput('Switched back to terminal mode');
        } else {
          addTerminalOutput('Cannot exit from terminal mode');
        }
        break;

      default:
        if (command.startsWith('/gsd:')) {
          // Handle GSD slash commands
          try {
            if (gsd.canExecute) {
              const stream = await gsdCommands.executeSlashCommand(command);
              addTerminalOutput(`Executing: ${command}`);
            } else {
              addTerminalOutput('GSD not ready. Use "gsd" to connect first.');
            }
          } catch (error) {
            addTerminalOutput(`Command failed: ${error}`);
          }
        } else {
          addTerminalOutput(`Command not found: ${cmd}`);
          addTerminalOutput('Type "help" for available commands');
        }
        break;
    }
  }, [gsdStatus, gsd, gsdCommands, shellMode, addTerminalOutput, clearTerminal]);

  // Handle terminal input
  const handleTerminalSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    await executeTerminalCommand(terminalInput);
    setTerminalInput('');
  }, [terminalInput, executeTerminalCommand]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < terminalHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setTerminalInput(terminalHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setTerminalInput(terminalHistory[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setTerminalInput('');
      }
    }
  }, [historyIndex, terminalHistory]);

  // GSD command execution
  const executeGSDCommand = useCallback(async (command: GSDCommand, input?: string) => {
    try {
      addTerminalOutput(`🚀 Executing: ${command.label}`);
      const stream = await gsd.executeCommand(command, input);
      return stream;
    } catch (error) {
      addTerminalOutput(`❌ Execution failed: ${error}`);
      throw error;
    }
  }, [gsd.executeCommand, addTerminalOutput]);

  // Render mode indicator
  const renderModeIndicator = () => {
    const getStatusColor = () => {
      switch (gsdStatus) {
        case 'connected': return 'text-green-500';
        case 'connecting': case 'initializing': return 'text-yellow-500';
        case 'error': return 'text-red-500';
        default: return 'text-gray-500';
      }
    };

    const getStatusIcon = () => {
      switch (gsdStatus) {
        case 'connected': return '🟢';
        case 'connecting': case 'initializing': return '🟡';
        case 'error': return '🔴';
        default: return '⚪';
      }
    };

    return (
      <div className="flex items-center justify-between bg-gray-900 text-white px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono">
            {shellMode === 'gsd' ? 'GSD' : 'TERM'}
          </span>
          <button
            onClick={() => setShellMode(shellMode === 'gsd' ? 'terminal' : 'gsd')}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
          >
            {shellMode === 'gsd' ? 'Terminal' : 'GSD'}
          </button>
        </div>
        <div className={`flex items-center gap-1 ${getStatusColor()}`}>
          <span>{getStatusIcon()}</span>
          <span className="capitalize">{gsdStatus}</span>
        </div>
      </div>
    );
  };

  // Render terminal view
  const renderTerminal = () => (
    <div className="flex flex-col h-full bg-black text-green-400 font-mono text-sm">
      {renderModeIndicator()}
      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-3 space-y-1"
      >
        {terminalOutput.map((line, index) => (
          <div key={index} className="whitespace-pre-wrap break-words">
            {line}
          </div>
        ))}
      </div>
      <form onSubmit={handleTerminalSubmit} className="border-t border-gray-800 p-2">
        <div className="flex items-center">
          <span className="text-green-400 mr-2">$</span>
          <input
            ref={inputRef}
            type="text"
            value={terminalInput}
            onChange={(e) => setTerminalInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-green-400 outline-none"
            placeholder="Enter command..."
            autoFocus
          />
        </div>
      </form>
    </div>
  );

  // Render GSD view
  const renderGSD = () => (
    <div className="flex flex-col h-full bg-gray-50">
      {renderModeIndicator()}
      <div className="flex-1 flex flex-col">
        {gsd.isExecuting && gsd.progressState && (
          <div className="border-b border-gray-200 p-4">
            <GSDProgressTracker
              phase={gsd.progressState.currentPhase}
              progress={gsd.progressState.totalProgress}
              message={gsd.progressState.message}
              startTime={gsd.progressState.startTime}
              estimatedTimeRemaining={gsd.progressState.estimatedTimeRemaining}
            />
          </div>
        )}

        <div className="flex-1 p-4">
          {gsd.activeSession ? (
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 shadow-sm border">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Active Session: {gsd.activeSession.projectName}
                </h3>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>Status: <span className="capitalize">{gsd.activeSession.status}</span></div>
                  <div>Started: {gsd.activeSession.metadata?.created?.toLocaleString()}</div>
                  {gsd.activeSession.metadata && (
                    <div>Phases: {gsd.activeSession.metadata.currentPhase}/{gsd.activeSession.metadata.totalPhases}</div>
                  )}
                </div>
              </div>

              {gsd.executionHistory.length > 0 && (
                <div className="bg-white rounded-lg p-4 shadow-sm border">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Execution History</h4>
                  <div className="space-y-2 text-xs">
                    {gsd.executionHistory.slice(-5).map((result, index) => (
                      <div key={index} className={`flex items-center gap-2 ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                        <span>{result.success ? '✅' : '❌'}</span>
                        <span>{result.data?.message || result.error || 'Unknown result'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-center text-gray-500 text-sm">
                Press <kbd className="px-2 py-1 bg-gray-200 rounded text-xs">Cmd+K</kbd> to open command palette
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <div className="text-4xl mb-4">🚀</div>
                <div className="text-lg font-medium mb-2">No Active Session</div>
                <div className="text-sm">
                  {gsd.isConnected ?
                    'Press Cmd+K to start a new GSD session' :
                    'Connecting to GSD backend...'
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`h-full ${className}`}>
      {shellMode === 'terminal' ? renderTerminal() : renderGSD()}

      {/* GSD Command Palette */}
      <GSDCommandPalette
        isOpen={commandPalette.isOpen}
        onClose={commandPalette.close}
        onCommandSelect={executeGSDCommand}
        isExecuting={gsd.isExecuting}
      />

      {/* GSD Choice Dialog */}
      {gsd.currentChoice && (
        <GSDChoiceDialog
          prompt={gsd.currentChoice}
          onChoiceSelect={(choice) => gsd.submitChoice(choice)}
          onCancel={() => gsd.cancelChoice()}
        />
      )}
    </div>
  );
}