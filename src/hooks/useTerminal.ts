import { useState, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { getClaudeCodeDispatcher } from '../services/claudeCodeWebSocketDispatcher';

export interface TerminalCommand {
  id: string;
  command: string;
  output: string;
  timestamp: Date;
  exitCode?: number;
  isComplete: boolean;
}

export interface TerminalState {
  commands: TerminalCommand[];
  currentDirectory: string;
  isConnected: boolean;
  isProcessing: boolean;
}

export interface UseTerminalOptions {
  onCommand?: (command: string) => void;
  onNavigateHistory?: (direction: 'up' | 'down') => string | null;
  onOutput?: (output: string) => void;
}

/**
 * Hook for managing terminal state and command execution with real WebSocket integration
 */
export function useTerminal(options: UseTerminalOptions = {}) {
  const { onCommand, onNavigateHistory, onOutput } = options;
  const [state, setState] = useState<TerminalState>({
    commands: [],
    currentDirectory: '/Users/mshaler/Developer/Projects/Isometry',
    isConnected: false,
    isProcessing: false
  });

  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const commandIdRef = useRef(0);
  const currentLineRef = useRef<string>('');
  const cursorPositionRef = useRef<number>(0);

  /**
   * Create a new terminal instance
   */
  const createTerminal = useCallback((containerId: string) => {
    if (terminalRef.current) {
      terminalRef.current.dispose();
    }

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1a1a',
        foreground: '#ffffff',
        cursor: '#ffffff',
        selectionBackground: '#4a5568'
      },
      rows: 24,
      cols: 80
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const container = document.getElementById(containerId);
    if (container) {
      terminal.open(container);
      fitAddon.fit();

      // Set up terminal interactions
      setupTerminalInteractions(terminal);

      setState(prev => ({ ...prev, isConnected: true }));

      // Write initial prompt
      writePrompt(terminal);

      return terminal;
    }

    return null;
  }, []);

  /**
   * Set up terminal keyboard and interaction handlers
   */
  const setupTerminalInteractions = useCallback((terminal: Terminal) => {
    let currentLine = '';
    let cursorPosition = 0;

    terminal.onData((data) => {
      switch (data) {
        case '\r': // Enter
          if (currentLine.trim()) {
            terminal.writeln('');
            executeCommand(currentLine.trim());
            onCommand?.(currentLine.trim());
            currentLine = '';
            cursorPosition = 0;
          } else {
            terminal.writeln('');
            writePrompt(terminal);
          }
          break;

        case '\u007F': // Backspace
          if (cursorPosition > 0) {
            currentLine = currentLine.slice(0, cursorPosition - 1) + currentLine.slice(cursorPosition);
            cursorPosition--;
            terminal.write('\b \b');
          }
          break;

        case '\u001b[A': // Arrow Up
          if (onNavigateHistory) {
            const historyCommand = onNavigateHistory('up');
            if (historyCommand !== null) {
              // Clear current line
              terminal.write('\r\x1b[K');
              writePrompt(terminal);
              // Write history command
              terminal.write(historyCommand);
              currentLine = historyCommand;
              cursorPosition = historyCommand.length;
            }
          }
          break;

        case '\u001b[B': // Arrow Down
          if (onNavigateHistory) {
            const historyCommand = onNavigateHistory('down');
            if (historyCommand !== null) {
              // Clear current line
              terminal.write('\r\x1b[K');
              writePrompt(terminal);
              // Write history command
              terminal.write(historyCommand);
              currentLine = historyCommand;
              cursorPosition = historyCommand.length;
            }
          }
          break;

        default:
          // Handle regular character input
          if (data.length === 1 && data.charCodeAt(0) >= 32) {
            currentLine = currentLine.slice(0, cursorPosition) + data + currentLine.slice(cursorPosition);
            cursorPosition++;
            terminal.write(data);
          }
          break;
      }

      currentLineRef.current = currentLine;
      cursorPositionRef.current = cursorPosition;
    });
  }, [onCommand, onNavigateHistory]);

  /**
   * Execute a command via WebSocket dispatcher
   */
  const executeCommand = useCallback(async (commandText: string) => {
    const commandId = `cmd_${++commandIdRef.current}`;

    // Add command to history
    const newCommand: TerminalCommand = {
      id: commandId,
      command: commandText,
      output: '',
      timestamp: new Date(),
      isComplete: false
    };

    setState(prev => ({
      ...prev,
      commands: [...prev.commands, newCommand],
      isProcessing: true
    }));

    try {
      const dispatcher = await getClaudeCodeDispatcher();
      const [cmd, ...args] = commandText.trim().split(' ');

      // Execute command via WebSocket
      const result = await dispatcher.execute({
        command: cmd,
        args: args,
        workingDirectory: state.currentDirectory
      });

      // Write output to terminal
      if (terminalRef.current) {
        terminalRef.current.writeln(result);
        writePrompt(terminalRef.current);
      }

      // Update command state
      setState(prev => ({
        ...prev,
        commands: prev.commands.map(cmd =>
          cmd.id === commandId
            ? {
                ...cmd,
                output: result,
                exitCode: 0,
                isComplete: true
              }
            : cmd
        ),
        isProcessing: false
      }));

      // Notify about output for GSD integration
      onOutput?.(result);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Command execution failed';

      if (terminalRef.current) {
        terminalRef.current.writeln(`Error: ${errorMessage}`);
        writePrompt(terminalRef.current);
      }

      setState(prev => ({
        ...prev,
        commands: prev.commands.map(cmd =>
          cmd.id === commandId
            ? {
                ...cmd,
                output: `Error: ${errorMessage}`,
                exitCode: 1,
                isComplete: true
              }
            : cmd
        ),
        isProcessing: false
      }));

      onOutput?.(errorMessage);
    }

    return commandId;
  }, [state.currentDirectory, onOutput]);

  /**
   * Write shell prompt to terminal
   */
  const writePrompt = useCallback((terminal: Terminal) => {
    const prompt = `$ `;
    terminal.write(prompt);
  }, []);

  /**
   * Attach to a process (simplified simulation for now)
   */
  const attachToProcess = useCallback(() => {
    if (terminalRef.current) {
      setState(prev => ({ ...prev, isConnected: true }));
    }
  }, []);

  /**
   * Resize terminal to fit container
   */
  const resizeTerminal = useCallback((_cols: number, _rows: number) => {
    if (fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  }, []);

  /**
   * Dispose of terminal resources
   */
  const dispose = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.dispose();
      terminalRef.current = null;
    }
    if (fitAddonRef.current) {
      fitAddonRef.current = null;
    }
    setState(prev => ({ ...prev, isConnected: false }));
  }, []);

  const clearHistory = useCallback(() => {
    setState(prev => ({
      ...prev,
      commands: []
    }));
  }, []);

  const getLastCommand = useCallback(() => {
    return state.commands[state.commands.length - 1];
  }, [state.commands]);

  return {
    ...state,
    executeCommand,
    clearHistory,
    getLastCommand,
    createTerminal,
    attachToProcess,
    resizeTerminal,
    dispose
  };
}