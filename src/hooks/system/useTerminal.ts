import { useRef, useEffect, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useTerminalContext } from '../../context/TerminalContext';
import { devLogger } from '../../utils/logging';

interface UseTerminalOptions {
  workingDirectory?: string;
  shell?: string;
  onCommand?: (command: string) => void;
  onNavigateHistory?: (direction: 'up' | 'down') => string | null;
  onOutput?: (output: string) => void;
  onCtrlR?: () => void;
  onSearchInput?: (char: string) => void;
  onExitSearch?: () => void;
  isSearchMode?: boolean;
}

interface UseTerminalReturn {
  createTerminal: (containerId: string) => Terminal | null;
  executeCommand: (command: string) => void;
  writeOutput: (output: string, isError?: boolean) => void;
  showPrompt: () => void;
  attachToProcess: () => void;
  dispose: () => void;
  resizeTerminal: (cols: number, _rows: number) => void;
  getCurrentWorkingDirectory: () => string;
  setWorkingDirectory: (path: string) => void;
  terminal: Terminal | null;
  isConnected: boolean;
  handleCopy: () => Promise<boolean>;
  handlePaste: () => Promise<string | null>;
}

/**
 * Terminal management hook using @xterm/xterm
 * Note: This is a browser-compatible implementation that simulates command execution
 * For production, this would need a backend service to handle real process execution
 */
export function useTerminal(options: UseTerminalOptions = {}): UseTerminalReturn {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const isConnectedRef = useRef(false);

  // Use terminal context for shared working directory state
  const terminalContext = useTerminalContext();

  // Initialize working directory from options or use context default
  useEffect(() => {
    if (options.workingDirectory) {
      terminalContext.setWorkingDirectory(options.workingDirectory);
    }
  }, [options.workingDirectory, terminalContext.setWorkingDirectory]);

  // Local reference to working directory (updated via context)
  const currentDirRef = terminalContext.currentWorkingDirectory;

  /**
   * Handle copy: if text is selected, copy to clipboard; otherwise return false (allow SIGINT)
   */
  const handleCopy = useCallback(async (): Promise<boolean> => {
    const terminal = terminalRef.current;
    if (!terminal) return false;

    if (terminal.hasSelection()) {
      const selectedText = terminal.getSelection();
      try {
        await navigator.clipboard.writeText(selectedText);
        terminal.clearSelection();
        return true; // Copied, don't send SIGINT
      } catch (err) {
        devLogger.warn('Failed to copy to clipboard', { component: 'useTerminal', error: err });
        return false;
      }
    }
    return false; // No selection, allow SIGINT
  }, []);

  /**
   * Handle paste: read from clipboard and write to terminal
   */
  const handlePaste = useCallback(async (): Promise<string | null> => {
    const terminal = terminalRef.current;
    if (!terminal) return null;

    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        // Filter out control characters for safety
        const safeText = text.replace(/[\x00-\x1f]/g, '');
        terminal.write(safeText);
        return safeText;
      }
    } catch (err) {
      devLogger.warn('Failed to paste from clipboard', { component: 'useTerminal', error: err });
    }
    return null;
  }, []);

  const createTerminal = useCallback((containerId: string) => {
    if (terminalRef.current) {
      return terminalRef.current;
    }

    const container = document.getElementById(containerId);
    if (!container) {
      devLogger.error(`Terminal container element not found`, { component: 'useTerminal', containerId });
      return null;
    }

    // Create terminal with dark theme configuration
    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'Monaco, Menlo, Consolas, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      theme: {
        background: '#111827', // gray-900
        foreground: '#f3f4f6', // gray-100
        cursor: '#10b981', // green-500
        selectionBackground: '#374151', // gray-700
        black: '#111827',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f3f4f6',
        brightBlack: '#6b7280',
        brightRed: '#fca5a5',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff'
      },
      allowTransparency: false,
      convertEol: true,
      scrollback: 1000
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    // Store references
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    containerRef.current = container;

    // Open terminal in container
    terminal.open(container);

    // Initial fit
    setTimeout(() => {
      fitAddon.fit();
    }, 0);

    return terminal;
  }, []);

  const writeOutput = useCallback((output: string, isError = false) => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    if (isError) {
      terminal.write(`\x1b[31m${output}\x1b[0m\r\n`);
    } else {
      terminal.write(`${output}\r\n`);
    }

    // Notify output callback for external processing (e.g., GSD integration)
    if (options.onOutput) {
      options.onOutput(output);
    }
  }, [options.onOutput]);

  const showPrompt = useCallback(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const promptPath = currentDirRef.current.replace('/Users/mshaler', '~');
    terminal.write(`\x1b[32mmshaler@Isometry\x1b[0m:\x1b[34m${promptPath}\x1b[0m$ `);
  }, [currentDirRef]);

  const executeCommand = useCallback((command: string) => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    // If we have a custom command handler, use it
    if (options.onCommand) {
      options.onCommand(command);
      return;
    }

    // Write the command to terminal
    terminal.write(`\r\n$ ${command}\r\n`);

    // Simple command simulation (fallback for when no router is provided)
    setTimeout(() => {
      if (command.trim() === '') {
        showPrompt();
        return;
      }

      const cmd = command.trim();

      if (cmd === 'pwd') {
        writeOutput(currentDirRef.current);
      } else if (cmd === 'ls' || cmd === 'ls -la') {
        writeOutput('drwxr-xr-x  12 user  staff   384 Jan 25 13:27 src/');
        writeOutput('drwxr-xr-x   8 user  staff   256 Jan 25 13:15 docs/');
        writeOutput('-rw-r--r--   1 user  staff  1234 Jan 25 13:20 package.json');
        writeOutput('-rw-r--r--   1 user  staff  2048 Jan 25 13:20 package-lock.json');
        writeOutput('drwxr-xr-x   6 user  staff   192 Jan 25 13:15 node_modules/');
        writeOutput('-rw-r--r--   1 user  staff  1500 Jan 25 13:20 vite.config.ts');
        writeOutput('-rw-r--r--   1 user  staff   800 Jan 25 13:20 tsconfig.json');
      } else if (cmd.startsWith('echo ')) {
        const text = cmd.substring(5).replace(/"/g, '');
        writeOutput(text);
      } else if (cmd === 'clear' || cmd === 'cls') {
        terminal.clear();
      } else if (cmd.startsWith('cd ')) {
        const path = cmd.substring(3).trim();
        if (path === '..' || path === '../') {
          const pathParts = currentDirRef.current.split('/');
          pathParts.pop();
          const newPath = pathParts.join('/') || '/';
          terminalContext.setWorkingDirectory(newPath);
        } else if (path === '~') {
          terminalContext.setWorkingDirectory('/Users/mshaler');
        } else {
          // For demo, just update the path
          const newPath = path.startsWith('/') ? path : `${currentDirRef.current}/${path}`;
          terminalContext.setWorkingDirectory(newPath);
        }
        // No output for cd command
      } else if (cmd === 'whoami') {
        writeOutput('mshaler');
      } else if (cmd === 'date') {
        writeOutput(new Date().toLocaleString());
      } else if (cmd.startsWith('claude') || cmd.startsWith('ai ') || cmd.startsWith('ask ')) {
        writeOutput('🤖 Command router not configured. Commands will be handled locally.', true);
      } else {
        writeOutput(`zsh: command not found: ${cmd}`, true);
      }

      showPrompt();
    }, 100);
  }, [options.onCommand, writeOutput, showPrompt, terminalContext]);

  const attachToProcess = useCallback(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    // Simulate process attachment
    isConnectedRef.current = true;

    // Show initial welcome message
    terminal.write('\x1b[32mWelcome to Isometry Notebook Shell\x1b[0m\r\n');
    terminal.write('Terminal emulator ready. Type \'claude help\' for AI commands.\r\n\r\n');

    // Show initial prompt
    showPrompt();

    // Handle keyboard input
    let currentLine = '';

    // Set up keyboard event listener for Cmd+C and Cmd+V
    const container = terminal.element?.parentElement;
    if (container) {
      const handleKeydown = async (e: KeyboardEvent) => {
        // Cmd+C (copy) - metaKey for Mac, ctrlKey for Windows/Linux
        if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
          const copied = await handleCopy();
          if (copied) {
            e.preventDefault();
          }
          // If not copied (no selection), let the terminal handle Ctrl+C as SIGINT
        }

        // Cmd+V (paste) - metaKey for Mac, ctrlKey for Windows/Linux
        if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
          e.preventDefault();
          const pastedText = await handlePaste();
          if (pastedText) {
            currentLine += pastedText;
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
        options.onCtrlR?.();
        return;
      }

      // Handle Escape (exit search mode)
      if (data === '\x1b' && options.isSearchMode) {
        options.onExitSearch?.();
        return;
      }

      // In search mode, handle input differently
      if (options.isSearchMode) {
        if (data === '\r') { // Enter - accept current match
          options.onExitSearch?.();
          return;
        }
        if (data === '\u007f') { // Backspace in search mode
          options.onSearchInput?.('\x7F'); // Signal backspace
          return;
        }
        if (data.length === 1 && data.charCodeAt(0) >= 32) {
          options.onSearchInput?.(data);
          return;
        }
        return;
      }

      if (data === '\r') { // Enter
        executeCommand(currentLine);
        currentLine = '';
        return;
      }

      if (data === '\u007f') { // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          terminal.write('\b \b');
        }
        return;
      }

      if (data === '\u0003') { // Ctrl+C (when no selection - SIGINT)
        terminal.write('^C\r\n');
        showPrompt();
        currentLine = '';
        return;
      }

      if (data === '\u001b[A' || data === '\u001b[B') { // Arrow keys
        if (options.onNavigateHistory) {
          const historyCommand = options.onNavigateHistory(data === '\u001b[A' ? 'up' : 'down');
          if (historyCommand !== null) {
            terminal.write('\r\x1b[K');
            showPrompt();
            currentLine = historyCommand;
            terminal.write(historyCommand);
          }
        }
        return;
      }

      const code = data.charCodeAt(0);
      if (code >= 32 && code <= 126) { // Printable characters
        currentLine += data;
        terminal.write(data);
      }
    });
  }, [executeCommand, showPrompt, options.onNavigateHistory, options.onCtrlR, options.onSearchInput, options.onExitSearch, options.isSearchMode, handleCopy, handlePaste]);

  const resizeTerminal = useCallback((cols: number, rows: number) => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;

    if (terminal && fitAddon) {
      if (cols && rows) {
        terminal.resize(cols, rows);
      } else {
        fitAddon.fit();
      }
    }
  }, []);

  const getCurrentWorkingDirectory = useCallback(() => {
    return terminalContext.getWorkingDirectory();
  }, [terminalContext.getWorkingDirectory]);

  const setWorkingDirectory = useCallback((path: string) => {
    terminalContext.setWorkingDirectory(path);
  }, [terminalContext.setWorkingDirectory]);

  const dispose = useCallback(() => {
    const terminal = terminalRef.current;
    if (terminal) {
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      containerRef.current = null;
      isConnectedRef.current = false;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);

  return {
    createTerminal,
    executeCommand,
    writeOutput,
    showPrompt,
    attachToProcess,
    dispose,
    resizeTerminal,
    getCurrentWorkingDirectory,
    setWorkingDirectory,
    terminal: terminalRef.current,
    isConnected: isConnectedRef.current,
    handleCopy,
    handlePaste
  };
}
