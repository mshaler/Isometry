import { useState, useEffect, useCallback, useMemo } from 'react';
import { Command } from 'cmdk';
import type { GSDCommand, GSDCommandCategory } from '../../types/gsd';
import { DEFAULT_GSD_COMMANDS } from '../../types/gsd';

interface GSDCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onCommandSelect: (command: GSDCommand, input?: string) => void;
  isExecuting: boolean;
  availableCommands?: GSDCommand[];
  className?: string;
}

export function GSDCommandPalette({
  isOpen,
  onClose,
  onCommandSelect,
  isExecuting,
  availableCommands = DEFAULT_GSD_COMMANDS,
  className = '',
}: GSDCommandPaletteProps) {
  const [searchValue, setSearchValue] = useState('');
  const [selectedCommand, setSelectedCommand] = useState<GSDCommand | null>(null);
  const [commandInput, setCommandInput] = useState('');
  const [showInputDialog, setShowInputDialog] = useState(false);

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setSearchValue('');
      setSelectedCommand(null);
      setCommandInput('');
      setShowInputDialog(false);
    }
  }, [isOpen]);

  // Group commands by category
  const commandsByCategory = useMemo(() => {
    const filtered = availableCommands.filter(cmd =>
      cmd.label.toLowerCase().includes(searchValue.toLowerCase()) ||
      cmd.description.toLowerCase().includes(searchValue.toLowerCase()) ||
      cmd.category.toLowerCase().includes(searchValue.toLowerCase())
    );

    const grouped = filtered.reduce((acc, cmd) => {
      if (!acc[cmd.category]) {
        acc[cmd.category] = [];
      }
      acc[cmd.category].push(cmd);
      return acc;
    }, {} as Record<GSDCommandCategory, GSDCommand[]>);

    return grouped;
  }, [availableCommands, searchValue]);

  const handleCommandSelect = useCallback((command: GSDCommand) => {
    if (isExecuting) return;

    if (command.requiresInput) {
      setSelectedCommand(command);
      setShowInputDialog(true);
    } else {
      onCommandSelect(command);
      onClose();
    }
  }, [isExecuting, onCommandSelect, onClose]);

  const handleInputSubmit = useCallback(() => {
    if (selectedCommand && commandInput.trim()) {
      onCommandSelect(selectedCommand, commandInput.trim());
      onClose();
    }
  }, [selectedCommand, commandInput, onCommandSelect, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showInputDialog) {
        setShowInputDialog(false);
        setSelectedCommand(null);
        setCommandInput('');
      } else {
        onClose();
      }
    }
  }, [showInputDialog, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black bg-opacity-50">
      <div
        className={`bg-white rounded-lg shadow-2xl border max-w-2xl w-full mx-4 max-h-[60vh] flex flex-col ${className}`}
        onKeyDown={handleKeyDown}
      >
        {!showInputDialog ? (
          <Command shouldFilter={false}>
            {/* Search Input */}
            <div className="border-b px-4 py-3">
              <Command.Input
                value={searchValue}
                onValueChange={setSearchValue}
                placeholder="Search GSD commands..."
                className="w-full text-lg bg-transparent border-none outline-none placeholder-gray-400"
                autoFocus
              />
            </div>

            {/* Command List */}
            <Command.List className="flex-1 overflow-y-auto p-2">
              {Object.entries(commandsByCategory).map(([category, commands]) => (
                <Command.Group key={category} heading={category}>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide px-2 py-2 mb-1">
                    {category}
                  </div>
                  {commands.map((command) => (
                    <Command.Item
                      key={command.id}
                      value={`${command.label} ${command.description} ${command.category}`}
                      onSelect={() => handleCommandSelect(command)}
                      disabled={isExecuting}
                      className={`
                        flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer mb-1
                        hover:bg-gray-100 aria-selected:bg-blue-50 aria-selected:border-blue-200
                        ${isExecuting ? 'opacity-50 cursor-not-allowed' : ''}
                        ${command.dangerLevel === 'danger' ? 'border-l-4 border-red-500' : ''}
                        ${command.dangerLevel === 'warning' ? 'border-l-4 border-yellow-500' : ''}
                      `}
                    >
                      {/* Command Icon */}
                      <span className="text-xl flex-shrink-0" role="img" aria-label={command.label}>
                        {command.icon}
                      </span>

                      {/* Command Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">
                            {command.label}
                          </span>
                          {command.requiresInput && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                              input required
                            </span>
                          )}
                          {command.dangerLevel && command.dangerLevel !== 'safe' && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              command.dangerLevel === 'danger'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {command.dangerLevel}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {command.description}
                        </p>
                        <code className="text-xs text-gray-400 font-mono">
                          {command.slashCommand}
                        </code>
                      </div>

                      {/* Keyboard Shortcut */}
                      {command.shortcut && (
                        <span className="text-xs text-gray-400 font-mono bg-gray-100 px-2 py-1 rounded">
                          {command.shortcut}
                        </span>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}

              {/* No Results */}
              <Command.Empty className="px-4 py-8 text-center text-gray-500">
                <div className="text-4xl mb-2">🔍</div>
                <div>No commands found for "{searchValue}"</div>
                <div className="text-sm text-gray-400 mt-1">
                  Try searching for: planning, execution, research, debug
                </div>
              </Command.Empty>
            </Command.List>

            {/* Footer */}
            <div className="border-t px-4 py-2 bg-gray-50 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>
                  {isExecuting ? 'Command executing...' : 'Press Enter to select • Esc to close'}
                </span>
                <span>
                  {Object.values(commandsByCategory).flat().length} commands available
                </span>
              </div>
            </div>
          </Command>
        ) : (
          /* Input Dialog for commands requiring additional input */
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl" role="img" aria-label={selectedCommand?.label}>
                {selectedCommand?.icon}
              </span>
              <div>
                <h3 className="font-medium text-gray-900">{selectedCommand?.label}</h3>
                <p className="text-sm text-gray-500">{selectedCommand?.description}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="command-input" className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Information Required
                </label>
                <textarea
                  id="command-input"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  placeholder="Enter details for this command..."
                  className="w-full p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={4}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleInputSubmit();
                    }
                  }}
                />
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => {
                    setShowInputDialog(false);
                    setSelectedCommand(null);
                    setCommandInput('');
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  Back
                </button>
                <div className="space-x-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleInputSubmit}
                    disabled={!commandInput.trim() || isExecuting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExecuting ? 'Executing...' : 'Execute Command'}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <div className="text-xs text-gray-500">
                <strong>Command:</strong> <code className="font-mono">{selectedCommand?.slashCommand}</code>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Press Cmd+Enter to execute • Esc to cancel
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Hook for keyboard shortcut
export function useGSDCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev),
  };
}