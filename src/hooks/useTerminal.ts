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
  onCtrlR?: () => void;
  onSearchInput?: (char: string) => void;
  onExitSearch?: () => void;
  isSearchMode?: boolean;
}

/**
 * Hook for managing terminal state and command execution with real WebSocket integration
 */
export function useTerminal(options: UseTerminalOptions = {}) {
  const {
    onCommand,
    onNavigateHistory,
    onOutput,
    onCtrlR,
    onSearchInput,
    onExitSearch,
    isSearchMode
  } = options;
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
   * Handle copy: if text is selected, copy to clipboard; otherwise send SIGINT
   */
  const handleCopy = useCallback(async (terminal: Terminal): Promise<boolean> => {
    if (terminal.hasSelection()) {
      const selectedText = terminal.getSelection();
      try {
        await navigator.clipboard.writeText(selectedText);
        terminal.clearSelection();
        return true; // Copied, don't send SIGINT
      } catch (err) {
        console.warn('Failed to copy to clipboard:', err);
        return false;
      }
    }
    return false; // No selection, allow SIGINT
  }, []);

  /**
   * Handle paste: read from clipboard and write to terminal
   */
  const handlePaste = useCallback(async (terminal: Terminal): Promise<string | null> => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        // Write pasted text to terminal (filter out control characters)
        const safeText = text.replace(/[\x00-\x1f]/g, '');
        terminal.write(safeText);
        return safeText;
      }
    } catch (err) {
      console.warn('Failed to paste from clipboard:', err);
    }
    return null;
  }, []);

  /**
   * Set up terminal keyboard and interaction handlers
   */
  const setupTerminalInteractions = useCallback((terminal: Terminal) => {
    let currentLine = '';
    let cursorPosition = 0;

    // Set up keyboard event listener for Cmd+C and Cmd+V
    const container = terminal.element?.parentElement;
    if (container) {
      const handleKeydown = async (e: KeyboardEvent) => {
        // Cmd+C (copy) - metaKey for Mac, ctrlKey for Windows/Linux
        if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
          const copied = await handleCopy(terminal);
          if (copied) {
            e.preventDefault();
          }
          // If not copied (no selection), let the terminal handle Ctrl+C as SIGINT
        }

        // Cmd+V (paste) - metaKey for Mac, ctrlKey for Windows/Linux
        if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
          e.preventDefault();
          const pastedText = await handlePaste(terminal);
          if (pastedText) {
            currentLine = currentLine.slice(0, cursorPosition) + pastedText + currentLine.slice(cursorPosition);
            cursorPosition += pastedText.length;
            currentLineRef.current = currentLine;
            cursorPositionRef.current = cursorPosition;
          }
        }
      };

      container.addEventListener('keydown', handleKeydown);

      // Store cleanup reference
      const originalDispose = terminal.dispose.bind(terminal);
      terminal.dispose = () => {
        container.removeEventListener('keydown', handleKeydown);
        originalDispose();
      };
    }

    terminal.onData((data) => {
      // Handle Ctrl+R for reverse search
      if (data === '\x12') { // Ctrl+R
        onCtrlR?.();
        return;
      }

      // Handle Escape (exit search mode)
      if (data === '\x1b' && isSearchMode) {
        onExitSearch?.();
        return;
      }

      // In search mode, handle input differently
      if (isSearchMode) {
        if (data === '\r') { // Enter - accept current match
          onExitSearch?.();
          return;
        }
        if (data === '\u007F') { // Backspace in search mode
          onSearchInput?.('\x7F'); // Signal backspace
          return;
        }
        if (data.length === 1 && data.charCodeAt(0) >= 32) {
          onSearchInput?.(data);
          return;
        }
        return;
      }

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

        case '\x03': // Ctrl+C (when no selection - SIGINT)
          // If we reach here, no text was selected (copy handler didn't prevent default)
          terminal.writeln('^C');
          currentLine = '';
          cursorPosition = 0;
          writePrompt(terminal);
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
  }, [onCommand, onNavigateHistory, onCtrlR, onSearchInput, onExitSearch, isSearchMode, handleCopy, handlePaste]);

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
    dispose,
    handleCopy,
    handlePaste,
    terminalRef
  };
}