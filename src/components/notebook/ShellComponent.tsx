import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal, Minimize2, Maximize2, Circle, Bot, Settings, Search } from 'lucide-react';
import { useTerminal, useCommandHistory } from '@/hooks';
import { TerminalProvider } from '../../context/TerminalContext';
import { GSDInterface } from '../gsd/GSDInterface';
import { useGSDTerminalIntegration } from '../../hooks/useGSDTerminalIntegration';
import { devLogger } from '../../utils/logging/dev-logger';
// import { getClaudeCodeDispatcher } from '../../services/claudeCodeWebSocketDispatcher';

// Simplified implementations for notebook environment
const useProjectContext = () => ({
  project: null,
  getActiveCardContext: () => ({ title: 'Mock Card' })
});
const useClaudeAPI = () => ({
  send: () => Promise.resolve(''),
  isLoading: false,
  isConfigured: false
});

interface ShellComponentProps {
  className?: string;
}

type ShellTab = 'claude-ai' | 'claude-code' | 'gsd-gui';

function ShellComponentInner({ className }: ShellComponentProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<ShellTab>('claude-code');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [claudeConnectionStatus, setClaudeConnectionStatus] = useState<
    'configured' | 'not-configured'
  >('not-configured');

  // Command history hook with reverse search
  const commandHistory = useCommandHistory();

  // Terminal output buffer for GSD integration
  const [terminalOutput, setTerminalOutput] = useState<string>('');

  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const { getActiveCardContext } = useProjectContext();
  const { isConfigured: isClaudeConfigured } = useClaudeAPI();

  // GSD integration - simplified for now (will be replaced with proper hook)
  const gsdService = null;

  // Handle terminal output for GSD integration
  const handleTerminalOutput = useCallback((output: string) => {
    setTerminalOutput(prev => prev + output + '\n');
  }, []);

  // GSD terminal integration
  const gsdTerminalIntegration = useGSDTerminalIntegration({
    gsdService,
    sessionId: null,
    enabled: activeTab === 'gsd-gui', // Only enable when GSD tab is active
    onStateUpdate: (state) => {
      devLogger.debug('GSD state updated', { component: 'ShellComponent', state });
    },
    onChoicePrompt: (choices) => {
      devLogger.debug('GSD choice prompt', { component: 'ShellComponent', choices });
    },
    onError: (error) => {
      devLogger.error('GSD terminal integration error', { component: 'ShellComponent', error });
    }
  });

  // Process terminal output through GSD integration
  useEffect(() => {
    if (terminalOutput && gsdTerminalIntegration.isMonitoring) {
      gsdTerminalIntegration.processTerminalOutput(terminalOutput);
    }
  }, [terminalOutput, gsdTerminalIntegration.isMonitoring, gsdTerminalIntegration.processTerminalOutput]);

  // Tab definitions
  const tabs: Array<{ id: ShellTab; icon: typeof Bot; label: string; description: string }> = [
    { id: 'claude-ai', icon: Bot, label: 'Claude AI', description: 'AI assistant with MCP' },
    { id: 'claude-code', icon: Terminal, label: 'Terminal', description: 'Command execution' },
    { id: 'gsd-gui', icon: Settings, label: 'GSD GUI', description: 'Getting Shit Done interface' }
  ];

  // Command history handlers using useCommandHistory hook
  const handleCommand = useCallback((command: string) => {
    if (command.trim()) {
      commandHistory.addEntry(command.trim());
      commandHistory.resetNavigation();
    }
  }, [commandHistory]);

  const handleNavigateHistory = useCallback((direction: 'up' | 'down'): string | null => {
    if (direction === 'up') {
      return commandHistory.navigateUp();
    } else {
      return commandHistory.navigateDown();
    }
  }, [commandHistory]);

  // Search mode handlers
  const handleCtrlR = useCallback(() => {
    commandHistory.enterSearchMode();
  }, [commandHistory]);

  const handleSearchInput = useCallback((char: string) => {
    if (char === '\x7F') {
      // Backspace in search mode
      commandHistory.removeSearchChar();
    } else {
      commandHistory.appendSearchChar(char);
    }
  }, [commandHistory]);

  const handleExitSearch = useCallback(() => {
    commandHistory.exitSearchMode();
  }, [commandHistory]);

  // Real-time GSD monitoring status indicator
  const gsdMonitoringStatus = gsdTerminalIntegration.isMonitoring ? 'monitoring' : 'inactive';

  // Get current tab info
  const currentTab = tabs.find(tab => tab.id === activeTab) || tabs[1]; // Default to claude-code

  const {
    createTerminal,
    attachToProcess,
    dispose,
    resizeTerminal,
    isConnected
  } = useTerminal({
    onCommand: handleCommand,
    onNavigateHistory: handleNavigateHistory,
    onOutput: handleTerminalOutput,
    onCtrlR: handleCtrlR,
    onSearchInput: handleSearchInput,
    onExitSearch: handleExitSearch,
    isSearchMode: commandHistory.isSearchMode,
  });

  // Initialize terminal when component mounts and claude-code tab is active
  useEffect(() => {
    if (!isMinimized && activeTab === 'claude-code' && terminalContainerRef.current) {
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
  }, [isMinimized, activeTab]);

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
    <div className={`${className} bg-gray-900 border border-gray-700 rounded-lg flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 bg-gray-800 rounded-t-lg border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <currentTab.icon size={16} className="text-green-400" />
            <span className="font-medium text-sm text-gray-200">{currentTab.label}</span>
          </div>
          <span className="text-xs text-gray-500">•</span>
          <span className="text-xs text-gray-400">{currentTab.description}</span>
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

      {/* Tab Bar */}
      <div className="border-b border-gray-700 flex bg-gray-850">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 text-sm border-r border-gray-700 transition-colors ${
                isActive
                  ? 'bg-gray-700 text-green-400 font-medium'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
              title={tab.description}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col">
        {activeTab === 'claude-code' ? (
          /* Terminal Tab - Direct command execution */
          <div
            ref={terminalContainerRef}
            className="flex-1 min-h-0"
            style={{ height: '300px' }} // Minimum height for terminal
          />
        ) : activeTab === 'claude-ai' ? (
          /* Claude AI Tab - MCP Assistant */
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Bot size={48} className="mx-auto mb-3 text-gray-600" />
              <div className="font-medium mb-1 text-gray-300">Claude AI Assistant</div>
              <div className="text-sm mb-3">AI-powered assistance with MCP integration</div>
              <div className="text-xs">Coming soon: Direct AI conversation interface</div>
            </div>
          </div>
        ) : (
          /* GSD GUI Tab - Getting Shit Done interface */
          <GSDInterface className="flex-1" />
        )}
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
            {activeTab === 'gsd-gui' && (
              <div className="flex items-center gap-1">
                <span className="text-gray-400">GSD:</span>
                <Circle
                  size={6}
                  className={`fill-current ${
                    gsdMonitoringStatus === 'monitoring' ? 'text-blue-400' : 'text-gray-500'
                  }`}
                />
                <span className={gsdMonitoringStatus === 'monitoring' ? 'text-blue-400' : 'text-gray-500'}>
                  {gsdMonitoringStatus === 'monitoring' ? 'monitoring' : 'inactive'}
                </span>
              </div>
            )}
            {getActiveCardContext() && (
              <div className="flex items-center gap-1">
                <span className="text-gray-400">Context:</span>
                <span className="text-blue-400">{getActiveCardContext()?.title}</span>
              </div>
            )}
          </div>
          <div className="text-gray-400">
            {activeTab === 'claude-code' ? (
              commandHistory.isSearchMode ? (
                <span className="flex items-center gap-2 text-yellow-400">
                  <Search size={12} />
                  <span>(reverse-i-search)`{commandHistory.searchQuery}`: {commandHistory.searchMatch || ''}</span>
                </span>
              ) : connectionStatus === 'connected' ? (
                'Ready for commands'
              ) : (
                'Initializing...'
              )
            ) : activeTab === 'claude-ai' ? (
              claudeConnectionStatus === 'configured' ? (
                <span className="text-green-400">AI Ready</span>
              ) : (
                'Configure AI settings'
              )
            ) : (
              'GSD Interface Ready'
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