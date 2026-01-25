import { useState } from 'react';
import { Terminal, Minimize2, Maximize2, Circle } from 'lucide-react';

interface ShellComponentProps {
  className?: string;
}

export function ShellComponent({ className }: ShellComponentProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [connectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');

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
      <div className="flex-1 p-3 font-mono text-sm">
        <div className="text-green-400 mb-2">
          Welcome to Isometry Notebook Shell
        </div>
        <div className="text-gray-500 mb-2">
          Type 'happy' to interact with Claude Code
        </div>
        <div className="text-gray-500 mb-4">
          Regular shell commands also supported
        </div>

        {/* Mock terminal session */}
        <div className="space-y-1">
          <div className="flex">
            <span className="text-blue-400 mr-2">$</span>
            <span className="text-gray-300">pwd</span>
          </div>
          <div className="text-gray-400 ml-4">/Users/mshaler/Developer/Projects/Isometry</div>

          <div className="flex mt-3">
            <span className="text-blue-400 mr-2">$</span>
            <span className="text-gray-300">ls -la</span>
          </div>
          <div className="text-gray-400 ml-4 space-y-0.5">
            <div>drwxr-xr-x  12 user  staff   384 Jan 25 13:27 src/</div>
            <div>drwxr-xr-x   8 user  staff   256 Jan 25 13:15 docs/</div>
            <div>-rw-r--r--   1 user  staff  1234 Jan 25 13:20 package.json</div>
          </div>

          {/* Current prompt */}
          <div className="flex mt-4">
            <span className="text-blue-400 mr-2">$</span>
            <span className="bg-gray-700 w-2 h-4 animate-pulse"></span>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="border-t border-gray-700 bg-gray-800 px-3 py-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="text-gray-400">Claude Code: {connectionStatus}</span>
            <span className="text-gray-400">Shell: bash</span>
          </div>
          <div className="text-gray-400">
            Ready for commands
          </div>
        </div>
      </div>
    </div>
  );
}