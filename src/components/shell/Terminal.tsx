import { useEffect, useRef, useState, useCallback } from 'react';
import { useTerminal } from '@/hooks';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { getClaudeCodeDispatcher, WebSocketClaudeCodeDispatcher } from '@/services/claude-code/claudeCodeWebSocketDispatcher';
import { devLogger } from '@/utils/logging';

interface TerminalProps {
  className?: string;
  onCommand?: (command: string) => void;
  initialDirectory?: string;
  shell?: string;
}

/**
 * Terminal component using @xterm/xterm with real PTY backend
 *
 * Features:
 * - Real shell execution via node-pty WebSocket
 * - Mode toggle: shell / claude-code
 * - Automatic reconnection with output replay
 * - Copy/paste support (Cmd+C/Cmd+V)
 */
export function Terminal({
  className = '',
  onCommand,
  initialDirectory,
  shell = '/bin/zsh'
}: TerminalProps) {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const [terminalId] = useState(() => `terminal-${Math.random().toString(36).substr(2, 9)}`);
  const [isReady, setIsReady] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  const {
    createTerminal,
    attachToProcess,
    dispose,
    resizeTerminal,
    getCurrentWorkingDirectory,
    terminal,
    isConnected,
    currentMode,
    switchMode
  } = useTerminal({
    workingDirectory: initialDirectory,
    shell,
    onCommand
  });

  /**
   * Handle reconnection with replay
   */
  const handleReconnect = useCallback(async () => {
    if (!sessionIdRef.current) return;

    setReconnecting(true);
    devLogger.debug('Attempting reconnection', { component: 'Terminal' });

    try {
      const dispatcher = await getClaudeCodeDispatcher();
      if (dispatcher instanceof WebSocketClaudeCodeDispatcher) {
        // Request replay of buffered output
        dispatcher.requestTerminalReplay(sessionIdRef.current);
      }
      setReconnecting(false);
    } catch (error) {
      devLogger.error('Reconnection failed', { component: 'Terminal', error });
      setReconnecting(false);
    }
  }, []);

  // Initialize terminal when container is ready
  useEffect(() => {
    if (!terminalContainerRef.current || isReady) return;

    terminalContainerRef.current.id = terminalId;

    const terminalInstance = createTerminal(terminalId);
    if (terminalInstance) {
      setIsReady(true);
      setTimeout(() => {
        attachToProcess();
      }, 100);
    }

    return () => {
      if (isReady) {
        dispose();
        setIsReady(false);
      }
    };
  }, [createTerminal, attachToProcess, dispose, terminalId, isReady]);

  // Handle resize on container size changes
  useEffect(() => {
    if (!isReady || !terminal) return;

    const handleResize = () => {
      resizeTerminal(0, 0); // Auto-fit
    };

    setTimeout(handleResize, 200);

    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalContainerRef.current) {
      resizeObserver.observe(terminalContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [isReady, terminal, resizeTerminal]);

  // Handle connection status changes
  useEffect(() => {
    if (!isConnected && isReady && !reconnecting) {
      // Lost connection, attempt reconnect
      handleReconnect();
    }
  }, [isConnected, isReady, reconnecting, handleReconnect]);

  /**
   * Handle mode toggle
   */
  const handleModeToggle = useCallback(() => {
    const newMode = currentMode === 'shell' ? 'claude-code' : 'shell';
    switchMode(newMode);
  }, [currentMode, switchMode]);

  return (
    <ErrorBoundary level="component" name="Terminal">
      <div className={`terminal-wrapper h-full flex flex-col ${className}`}>
        {/* Terminal Header */}
        <div className="terminal-header flex-shrink-0 h-8 bg-gray-800 flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <span className="text-white text-sm font-mono">
              Terminal - {getCurrentWorkingDirectory().replace('/Users/mshaler', '~')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode Toggle */}
            <button
              onClick={handleModeToggle}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                currentMode === 'claude-code'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
              }`}
              title={`Switch to ${currentMode === 'shell' ? 'Claude Code' : 'Shell'} mode`}
            >
              {currentMode === 'claude-code' ? '🤖 Claude' : '💻 Shell'}
            </button>

            {/* Connection Status */}
            <div className="text-gray-400 text-xs flex items-center gap-1">
              <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
                {isConnected ? '●' : '○'}
              </span>
              <span>
                {reconnecting ? 'Reconnecting...' : isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        {/* Terminal Content */}
        <div
          ref={terminalContainerRef}
          className="terminal-content flex-1 bg-gray-900 overflow-hidden"
          style={{
            minHeight: '200px',
            fontFamily: 'Monaco, Menlo, Consolas, monospace'
          }}
        />

        {/* Terminal Footer */}
        <div className="terminal-footer flex-shrink-0 h-6 bg-gray-700 flex items-center justify-between px-2 text-xs text-gray-300">
          <span>Shell: {shell}</span>
          <span>Mode: {currentMode}</span>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export { type TerminalProps };
export const TerminalUtils = {
  executeCommand: (terminalRef: React.RefObject<any>, cmd: string) => {
    if (terminalRef.current?.executeTerminalCommand) {
      terminalRef.current.executeTerminalCommand(cmd);
    }
  },
  writeOutput: (terminalRef: React.RefObject<any>, output: string, isError = false) => {
    if (terminalRef.current?.writeTerminalOutput) {
      terminalRef.current.writeTerminalOutput(output, isError);
    }
  }
};
