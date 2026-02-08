import { useState, useRef, useEffect } from 'react';
import { Terminal, Minimize2, Maximize2, Circle } from 'lucide-react';
import { useTerminal } from '@/hooks';
import { TerminalProvider } from '../../context/TerminalContext';

// TODO: Implement these hooks or replace with sql.js equivalents
const useCommandRouter = () => ({ route: () => {}, history: [] });
const useProjectContext = () => ({ project: null });
const useClaudeAPI = () => ({ send: () => Promise.resolve(''), isLoading: false });

interface ShellComponentProps {
  className?: string;
}

function ShellComponentInner({ className }: ShellComponentProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [claudeConnectionStatus, setClaudeConnectionStatus] = useState<
    'configured' | 'not-configured'
  >('not-configured');
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const { executeCommand: executeRouterCommand, navigateHistory, isExecuting } = useCommandRouter();
  const { getActiveCardContext } = useProjectContext();
  const { isConfigured: isClaudeConfigured } = useClaudeAPI();

  // Format output for terminal display
  const formatTerminalOutput = (output: string, type: 'system' | 'claude'): string => {
    if (type === 'claude') {
      // Claude output is already formatted by the API hook
      return output;
    }

    // System command output - return as-is
    return output;
  };

  // Handle command routing through terminal
  const handleTerminalCommand = async (command: string) => {
    try {
      // Execute command through router
      const response = await executeRouterCommand(command);

      // Display response using terminal output methods
      if (response.error) {
        writeOutput(response.error, true);
      } else if (response.output) {
        // Format output for terminal display
        const formattedOutput = formatTerminalOutput(response.output, response.type);
        writeOutput(formattedOutput, false);
      }

      // Show new prompt
      showPrompt();
    } catch (error) {
      writeOutput(`Error executing command: ${error}`, true);
      showPrompt();
    }
  };

  const {
    createTerminal,
    attachToProcess,
    dispose,
    resizeTerminal,
    isConnected,
    writeOutput,
    showPrompt
  } = useTerminal({
    onCommand: handleTerminalCommand,
    onNavigateHistory: navigateHistory
  });

  // Initialize terminal when component mounts
  useEffect(() => {
    if (!isMinimized && terminalContainerRef.current) {
      const containerId = 'terminal-container';
      terminalContainerRef.current.id = containerId;

      setConnectionStatus('connecting');

      const terminal = createTerminal(containerId);
      if (terminal) {
        // Attach to simulated process
        attachToProcess();
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('disconnected');
      }

      // Handle resize
      const handleResize = () => {
        resizeTerminal(0, 0); // Use fit addon
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isMinimized]);

  // Update connection status based on terminal state
  useEffect(() => {
    setConnectionStatus(isConnected ? 'connected' : 'disconnected');
  }, [isConnected]);

  // Update Claude connection status
  useEffect(() => {
    setClaudeConnectionStatus(isClaudeConfigured ? 'configured' : 'not-configured');
  }, [isClaudeConfigured]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);

  if (isMinimized) {
    return (
      <div className={`${className} bg-gray-900 border border-gray-700 rounded-lg`}>
        <div className="flex items-center justify-between p-2 bg-gray-800 rounded-t-lg border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-green-400" />
            <span className="font-medium text-sm text-gray-200">Shell</span>
          </div>
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1 rounded hover:bg-gray-700 transition-colors"
            title="Maximize"
          >
            <Maximize2 size={14} className="text-gray-400" />
          </button>
        </div>
      </div>
    );
  }

  const statusColors = {
    connected: 'text-green-400',
    connecting: 'text-yellow-400',
    disconnected: 'text-red-400'
  };

  return (
    <div className={`${className} bg-gray-900 border border-gray-700 rounded-lg flex flex-col min-w-[300px]`}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 bg-gray-800 rounded-t-lg border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-green-400" />
            <span className="font-medium text-sm text-gray-200">Shell</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle size={8} className={`fill-current ${statusColors[connectionStatus]}`} />
            <span className="text-xs text-gray-400 capitalize">{connectionStatus}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 rounded hover:bg-gray-700 transition-colors"
            title="Minimize"
          >
            <Minimize2 size={14} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Terminal Area */}
      <div className="flex-1 flex flex-col">
        <div
          ref={terminalContainerRef}
          className="flex-1 min-h-0"
          style={{ height: '300px' }} // Minimum height for terminal
        />
      </div>

      {/* Status Bar */}
      <div className="border-t border-gray-700 bg-gray-800 px-3 py-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span className="text-gray-400">Terminal:</span>
              <Circle size={6} className={`fill-current ${statusColors[connectionStatus]}`} />
              <span className={statusColors[connectionStatus]}>{connectionStatus}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-400">Claude:</span>
              <Circle
                size={6}
                className={`fill-current ${
                  claudeConnectionStatus === 'configured' ? 'text-green-400' : 'text-gray-500'
                }`}
              />
              <span className={claudeConnectionStatus === 'configured' ? 'text-green-400' : 'text-gray-500'}>
                {claudeConnectionStatus === 'configured' ? 'ready' : 'not configured'}
              </span>
            </div>
            {getActiveCardContext() && (
              <div className="flex items-center gap-1">
                <span className="text-gray-400">Context:</span>
                <span className="text-blue-400">{getActiveCardContext()?.title}</span>
              </div>
            )}
          </div>
          <div className="text-gray-400">
            {isExecuting ? (
              <span className="text-yellow-400">Executing...</span>
            ) : connectionStatus === 'connected' ? (
              'Ready for commands'
            ) : (
              'Initializing...'
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ShellComponent({ className }: ShellComponentProps) {
  return (
    <TerminalProvider>
      <ShellComponentInner className={className} />
    </TerminalProvider>
  );
}