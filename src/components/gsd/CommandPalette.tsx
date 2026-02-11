/**
 * GSD Command Palette Component
 *
 * Provides GUI interface for GSD slash commands:
 * - Context-aware command suggestions
 * - Button-based command execution
 * - Keyboard shortcuts
 * - Command search and filtering
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Terminal,
  Search,
  Zap,
  PlayCircle,
  FileText,
  Code,
  HelpCircle,
  Download
} from 'lucide-react';
import { GSDPhase, GSDStatus } from '../../types/gsd';
import { GSDSlashCommandProcessor, SlashCommand } from '../../services/claude-code/gsdSlashCommands';

// Create a processor instance for command palette
const gsdSlashCommands = new GSDSlashCommandProcessor();

// Define the icon component type
type IconComponent = React.ComponentType<{ size?: number; className?: string }>;


interface CommandPaletteProps {
  phase?: GSDPhase;
  status?: GSDStatus;
  hasActiveSession?: boolean;
  onCommandExecute: (command: string, args?: string[]) => void;
  onShowInput?: (command: SlashCommand) => void;
  className?: string;
}

export function CommandPalette({
  phase,
  status,
  hasActiveSession = false,
  onCommandExecute,
  onShowInput,
  className
}: CommandPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isExpanded, setIsExpanded] = useState(false);

  // Get contextual command suggestions
  const commandsByCategory = useMemo(() => {
    return gsdSlashCommands.getCommandsByCategory({
      phase,
      status,
      hasActiveSession
    });
  }, [phase, status, hasActiveSession]);

  // Filter commands based on search query
  const filteredCommands = useMemo(() => {
    const allCommands = Object.values(commandsByCategory).flat();

    let commands = allCommands;

    // Filter by category
    if (selectedCategory !== 'all') {
      commands = commandsByCategory[selectedCategory] || [];
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      commands = commands.filter(cmd =>
        cmd.command.toLowerCase().includes(query) ||
        cmd.description.toLowerCase().includes(query)
      );
    }

    return commands;
  }, [commandsByCategory, selectedCategory, searchQuery]);

  // Categories for navigation
  const categories = useMemo(() => {
    const cats = Object.keys(commandsByCategory);
    return ['all', ...cats];
  }, [commandsByCategory]);

  // Handle command execution
  const handleCommandClick = useCallback((command: SlashCommand) => {
    if (command.requiresInput) {
      onShowInput?.(command);
    } else {
      onCommandExecute(command.command);
    }
  }, [onCommandExecute, onShowInput]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when command palette is visible
      if (!isExpanded) return;

      // Find command with matching shortcut
      const command = filteredCommands.find(cmd => {
        if (!cmd.shortcut) return false;

        const parts = cmd.shortcut.toLowerCase().split('+');
        const key = parts.pop();
        const hasCtrl = parts.includes('ctrl');
        const hasShift = parts.includes('shift');
        const hasAlt = parts.includes('alt');

        return (
          event.key.toLowerCase() === key &&
          event.ctrlKey === hasCtrl &&
          event.shiftKey === hasShift &&
          event.altKey === hasAlt
        );
      });

      if (command) {
        event.preventDefault();
        handleCommandClick(command);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, filteredCommands, handleCommandClick]);

  // Get icon component for command
  const getCommandIcon = useCallback((command: SlashCommand): IconComponent => {
    // Simple icon mapping based on command category
    switch (command.category) {
      case 'workflow':
        return PlayCircle as unknown as IconComponent;
      case 'phase':
        return FileText as unknown as IconComponent;
      case 'navigation':
        return Download as unknown as IconComponent;
      case 'utility':
        return Code as unknown as IconComponent;
      default:
        return Terminal as unknown as IconComponent;
    }
  }, []);

  // Get command button style based on category and danger level
  const getCommandButtonStyle = useCallback((command: SlashCommand) => {
    const baseStyle = "flex items-center gap-3 w-full p-3 rounded-lg border text-left transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed";

    if (command.dangerous) {
      return `${baseStyle} bg-red-900/20 border-red-600 text-red-200 hover:bg-red-900/30 hover:border-red-500`;
    }

    switch (command.category) {
      case 'workflow':
        return `${baseStyle} bg-blue-900/20 border-blue-600 text-blue-200 hover:bg-blue-900/30 hover:border-blue-500`;
      case 'phase':
        return `${baseStyle} bg-green-900/20 border-green-600 text-green-200 hover:bg-green-900/30 hover:border-green-500`;
      case 'navigation':
        return `${baseStyle} bg-purple-900/20 border-purple-600 text-purple-200 hover:bg-purple-900/30 hover:border-purple-500`;
      case 'control':
        return `${baseStyle} bg-orange-900/20 border-orange-600 text-orange-200 hover:bg-orange-900/30 hover:border-orange-500`;
      case 'utility':
        return `${baseStyle} bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700 hover:border-gray-500`;
      default:
        return `${baseStyle} bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700 hover:border-gray-500`;
    }
  }, []);

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`${className} flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors`}
        title="Open command palette"
      >
        <Zap size={16} />
        <span className="text-sm">Commands</span>
        <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">Ctrl+K</kbd>
      </button>
    );
  }

  return (
    <div className={`${className} bg-gray-900 border border-gray-700 rounded-lg overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-blue-400" />
          <h3 className="font-medium text-gray-200">GSD Commands</h3>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-gray-400 hover:text-gray-200 transition-colors"
          title="Close command palette"
        >
          ×
        </button>
      </div>

      {/* Search and Filters */}
      <div className="p-3 space-y-3 border-b border-gray-700">
        {/* Search Input */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search commands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Category:</span>
          <div className="flex gap-1">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {category === 'all' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Context Info */}
      {(phase || status) && (
        <div className="px-3 py-2 bg-gray-850 border-b border-gray-700">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            {phase && (
              <span>Phase: <span className="text-blue-400 font-medium">{phase}</span></span>
            )}
            {status && (
              <span>Status: <span className="text-green-400 font-medium">{status}</span></span>
            )}
            {hasActiveSession && (
              <span className="text-green-400">• Active Session</span>
            )}
          </div>
        </div>
      )}

      {/* Commands List */}
      <div className="max-h-96 overflow-y-auto">
        {filteredCommands.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            <HelpCircle size={24} className="mx-auto mb-2 opacity-50" />
            <p>No commands available</p>
            {searchQuery && (
              <p className="text-sm mt-1">Try a different search term</p>
            )}
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {filteredCommands.map(command => {
              const IconComponent = getCommandIcon(command);

              return (
                <button
                  key={command.command}
                  onClick={() => handleCommandClick(command)}
                  className={getCommandButtonStyle(command)}
                  title={command.description}
                >
                  {/* Icon */}
                  <IconComponent size={16} className="flex-shrink-0" />

                  {/* Command Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium font-mono">{command.command}</span>
                      {command.requiresInput && (
                        <span className="text-xs px-1 py-0.5 bg-gray-700 rounded">input required</span>
                      )}
                      {command.dangerous && (
                        <span className="text-xs px-1 py-0.5 bg-red-700 rounded">destructive</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 truncate">{command.description}</p>
                  </div>

                  {/* Shortcut */}
                  {command.shortcut && (
                    <kbd className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                      {command.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-gray-850 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {filteredCommands.length} command{filteredCommands.length !== 1 ? 's' : ''} available
          </span>
          <span>Press Esc to close</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Command Input Modal for commands that require additional input
 */
interface CommandInputModalProps {
  command: SlashCommand | null;
  isOpen: boolean;
  onSubmit: (command: string, input: string) => void;
  onClose: () => void;
}

export function CommandInputModal({
  command,
  isOpen,
  onSubmit,
  onClose
}: CommandInputModalProps) {
  const [input, setInput] = useState('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (command && input.trim()) {
      onSubmit(command.command, input.trim());
      setInput('');
      onClose();
    }
  }, [command, input, onSubmit, onClose]);

  useEffect(() => {
    if (isOpen) {
      setInput('');
    }
  }, [isOpen]);

  if (!isOpen || !command) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-medium text-gray-200 mb-2">
          {command.command}
        </h3>
        <p className="text-sm text-gray-400 mb-4">{command.description}</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Enter ${command.command === '/start' ? 'task description' : 'input'}...`}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-200 placeholder-gray-400 focus:outline-none focus:border-blue-500 mb-4"
            autoFocus
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Execute
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}