import { useRef, useEffect, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

interface UseTerminalOptions {
  workingDirectory?: string;
  shell?: string;
}

interface UseTerminalReturn {
  createTerminal: (containerId: string) => Terminal | null;
  executeCommand: (command: string) => void;
  attachToProcess: () => void;
  dispose: () => void;
  resizeTerminal: (cols: number, rows: number) => void;
  terminal: Terminal | null;
  isConnected: boolean;
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

  // Simulated file system state for demo purposes
  const workingDir = options.workingDirectory || '/Users/mshaler/Developer/Projects/Isometry';
  const currentDirRef = useRef(workingDir);

  const createTerminal = useCallback((containerId: string) => {
    if (terminalRef.current) {
      return terminalRef.current;
    }

    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Terminal container element with id "${containerId}" not found`);
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

  const executeCommand = useCallback((command: string) => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    // Write the command to terminal
    terminal.write(`\r\n$ ${command}\r\n`);

    // Simple command simulation
    setTimeout(() => {
      if (command.trim() === '') {
        return;
      }

      const cmd = command.trim();

      if (cmd === 'pwd') {
        terminal.write(`${currentDirRef.current}\r\n`);
      } else if (cmd === 'ls' || cmd === 'ls -la') {
        terminal.write('drwxr-xr-x  12 user  staff   384 Jan 25 13:27 src/\r\n');
        terminal.write('drwxr-xr-x   8 user  staff   256 Jan 25 13:15 docs/\r\n');
        terminal.write('-rw-r--r--   1 user  staff  1234 Jan 25 13:20 package.json\r\n');
        terminal.write('-rw-r--r--   1 user  staff  2048 Jan 25 13:20 package-lock.json\r\n');
        terminal.write('drwxr-xr-x   6 user  staff   192 Jan 25 13:15 node_modules/\r\n');
        terminal.write('-rw-r--r--   1 user  staff  1500 Jan 25 13:20 vite.config.ts\r\n');
        terminal.write('-rw-r--r--   1 user  staff   800 Jan 25 13:20 tsconfig.json\r\n');
      } else if (cmd.startsWith('echo ')) {
        const text = cmd.substring(5).replace(/"/g, '');
        terminal.write(`${text}\r\n`);
      } else if (cmd === 'clear' || cmd === 'cls') {
        terminal.clear();
      } else if (cmd.startsWith('cd ')) {
        const path = cmd.substring(3).trim();
        if (path === '..' || path === '../') {
          const pathParts = currentDirRef.current.split('/');
          pathParts.pop();
          currentDirRef.current = pathParts.join('/') || '/';
        } else if (path === '~') {
          currentDirRef.current = '/Users/mshaler';
        } else {
          // For demo, just update the path
          currentDirRef.current = path.startsWith('/') ? path : `${currentDirRef.current}/${path}`;
        }
        // No output for cd command
      } else if (cmd === 'whoami') {
        terminal.write('mshaler\r\n');
      } else if (cmd === 'date') {
        terminal.write(`${new Date().toLocaleString()}\r\n`);
      } else if (cmd.startsWith('happy')) {
        terminal.write('🎉 Claude Code integration will be available in the next phase!\r\n');
        terminal.write('For now, enjoy this functional terminal interface.\r\n');
      } else {
        terminal.write(`zsh: command not found: ${cmd}\r\n`);
      }

      // Show new prompt
      const promptPath = currentDirRef.current.replace('/Users/mshaler', '~');
      terminal.write(`\x1b[32mmshaler@Isometry\x1b[0m:\x1b[34m${promptPath}\x1b[0m$ `);
    }, 100);
  }, []);

  const attachToProcess = useCallback(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    // Simulate process attachment
    isConnectedRef.current = true;

    // Show initial welcome message
    terminal.write('\x1b[32mWelcome to Isometry Notebook Shell\x1b[0m\r\n');
    terminal.write('Terminal emulator ready. Type commands or \'happy\' for Claude Code info.\r\n\r\n');

    // Show initial prompt
    const promptPath = currentDirRef.current.replace('/Users/mshaler', '~');
    terminal.write(`\x1b[32mmshaler@Isometry\x1b[0m:\x1b[34m${promptPath}\x1b[0m$ `);

    // Handle keyboard input
    let currentLine = '';

    terminal.onData((data) => {
      const code = data.charCodeAt(0);

      if (code === 13) { // Enter
        executeCommand(currentLine);
        currentLine = '';
      } else if (code === 127) { // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          terminal.write('\b \b');
        }
      } else if (code >= 32 && code <= 126) { // Printable characters
        currentLine += data;
        terminal.write(data);
      } else if (code === 3) { // Ctrl+C
        terminal.write('^C\r\n');
        const promptPath = currentDirRef.current.replace('/Users/mshaler', '~');
        terminal.write(`\x1b[32mmshaler@Isometry\x1b[0m:\x1b[34m${promptPath}\x1b[0m$ `);
        currentLine = '';
      }
    });
  }, [executeCommand]);

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
    attachToProcess,
    dispose,
    resizeTerminal,
    terminal: terminalRef.current,
    isConnected: isConnectedRef.current
  };
}