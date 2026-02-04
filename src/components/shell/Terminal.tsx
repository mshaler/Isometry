import { useEffect, useRef, useState } from 'react';
import { useTerminal } from '../../hooks/useTerminal';
// import { useTerminalContext } from '../../context/TerminalContext';
import { ErrorBoundary } from '../ui/ErrorBoundary';

interface TerminalProps {
  className?: string;
  onCommand?: (command: string) => void;
  initialDirectory?: string;
  shell?: string;
}

/**
 * Terminal component using @xterm/xterm for command execution
 * Integrates with TerminalContext for shared state management
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

  const {
    createTerminal,
    executeCommand,
    writeOutput,
    attachToProcess,
    dispose,
    resizeTerminal,
    getCurrentWorkingDirectory,
    terminal,
    isConnected
  } = useTerminal({
    workingDirectory: initialDirectory,
    shell,
    onCommand,
    onNavigateHistory: (direction) => {
      // TODO: Implement command history
      console.log('Navigate history:', direction);
      return null;
    }
  });

  // Initialize terminal when container is ready
  useEffect(() => {
    if (!terminalContainerRef.current || isReady) return;

    // Set the container ID for terminal creation
    terminalContainerRef.current.id = terminalId;

    const terminalInstance = createTerminal(terminalId);
    if (terminalInstance) {
      setIsReady(true);
      // Auto-attach to process after creation
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
      // Auto-fit terminal to container
      resizeTerminal(0, 0);
    };

    // Initial resize
    setTimeout(handleResize, 200);

    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalContainerRef.current) {
      resizeObserver.observe(terminalContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [isReady, terminal, resizeTerminal]);


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
          <div className="text-gray-400 text-xs">
            {isConnected ? '●' : '○'} {isConnected ? 'Connected' : 'Disconnected'}
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

        {/* Terminal Footer (optional) */}
        <div className="terminal-footer flex-shrink-0 h-6 bg-gray-700 flex items-center justify-between px-2 text-xs text-gray-300">
          <span>Shell: {shell}</span>
          <span>CWD: {getCurrentWorkingDirectory()}</span>
        </div>
      </div>
    </ErrorBoundary>
  );
}

// Export utilities for external command execution
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