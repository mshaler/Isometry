/**
 * GSD Quick Actions Component
 *
 * Provides immediate access to the most common GSD slash commands as buttons.
 * Displays context-aware actions based on current session state.
 */

import { useMemo, useCallback } from 'react';
import {
  PlayCircle,
  Square,
  RefreshCw,
  Pause,
  Play,
  FileText,
  Layout,
  Code,
  CheckCircle,
  GitCommit,
  Zap
} from 'lucide-react';
import { gsdSlashCommands, SlashCommand } from '../../services/gsdSlashCommands';
import { GSDPhase, GSDStatus } from '../../types/gsd';

interface QuickActionsProps {
  phase?: GSDPhase;
  status?: GSDStatus;
  hasActiveSession?: boolean;
  onCommandExecute: (command: string, args?: string[]) => void;
  onShowCommandPalette?: () => void;
  className?: string;
}

const QUICK_ACTION_COMMANDS = [
  '/start',
  '/continue',
  '/abort',
  '/restart',
  '/pause',
  '/resume',
  '/spec',
  '/plan',
  '/implement',
  '/test',
  '/commit'
];

const COMMAND_ICONS: Record<string, any> = {
  '/start': PlayCircle,
  '/continue': Play,
  '/abort': Square,
  '/restart': RefreshCw,
  '/pause': Pause,
  '/resume': Play,
  '/spec': FileText,
  '/plan': Layout,
  '/implement': Code,
  '/test': CheckCircle,
  '/commit': GitCommit
};

export function QuickActions({
  phase,
  status,
  hasActiveSession = false,
  onCommandExecute,
  onShowCommandPalette,
  className
}: QuickActionsProps) {
  // Get available commands for current context
  const availableCommands = useMemo(() => {
    const suggestions = gsdSlashCommands.getSuggestions({
      phase,
      status,
      hasActiveSession
    });

    // Filter to only quick action commands and sort by priority
    return QUICK_ACTION_COMMANDS
      .map(cmdName => suggestions.commands.find(cmd => cmd.command === cmdName))
      .filter((cmd): cmd is SlashCommand => cmd !== undefined);
  }, [phase, status, hasActiveSession]);

  // Group commands by type for better layout
  const commandGroups = useMemo(() => {
    const workflow = availableCommands.filter(cmd => cmd.category === 'workflow' || cmd.category === 'control');
    const phases = availableCommands.filter(cmd => cmd.category === 'phase');

    return { workflow, phases };
  }, [availableCommands]);

  const handleCommandClick = useCallback((command: SlashCommand) => {
    if (command.requiresInput) {
      // For commands that require input, we'll need to show an input dialog
      // For now, just trigger the command and let the parent handle it
      onCommandExecute(command.command);
    } else {
      onCommandExecute(command.command);
    }
  }, [onCommandExecute]);

  const getButtonStyle = useCallback((command: SlashCommand) => {
    const baseStyle = "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100";

    if (command.dangerous) {
      return `${baseStyle} bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/25`;
    }

    switch (command.category) {
      case 'workflow':
        return `${baseStyle} bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25`;
      case 'phase':
        return `${baseStyle} bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/25`;
      case 'control':
        return `${baseStyle} bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/25`;
      default:
        return `${baseStyle} bg-gray-600 hover:bg-gray-700 text-white shadow-lg shadow-gray-600/25`;
    }
  }, []);

  if (availableCommands.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center p-4`}>
        <div className="text-center text-gray-500">
          <Zap size={24} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No quick actions available</p>
          <p className="text-xs mt-1">Start a session to see commands</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} space-y-4`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-200">Quick Actions</h4>
        {onShowCommandPalette && (
          <button
            onClick={onShowCommandPalette}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
            title="Show all commands"
          >
            View All
          </button>
        )}
      </div>

      {/* Workflow Actions */}
      {commandGroups.workflow.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Workflow
          </h5>
          <div className="flex flex-wrap gap-2">
            {commandGroups.workflow.map(command => {
              const IconComponent = COMMAND_ICONS[command.command] || PlayCircle;

              return (
                <button
                  key={command.command}
                  onClick={() => handleCommandClick(command)}
                  className={getButtonStyle(command)}
                  title={command.description}
                >
                  <IconComponent size={16} />
                  <span className="hidden sm:inline">
                    {command.command.slice(1)} {/* Remove the / */}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Phase Actions */}
      {commandGroups.phases.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Phases
          </h5>
          <div className="flex flex-wrap gap-2">
            {commandGroups.phases.map(command => {
              const IconComponent = COMMAND_ICONS[command.command] || FileText;

              return (
                <button
                  key={command.command}
                  onClick={() => handleCommandClick(command)}
                  className={getButtonStyle(command)}
                  title={command.description}
                >
                  <IconComponent size={16} />
                  <span className="hidden sm:inline capitalize">
                    {command.command.slice(1)} {/* Remove the / */}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Current Context Info */}
      {(phase || status) && (
        <div className="pt-2 border-t border-gray-700">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {phase && (
              <span>
                Phase: <span className="text-green-400 font-medium capitalize">{phase}</span>
              </span>
            )}
            {status && (
              <span>
                Status: <span className="text-blue-400 font-medium capitalize">{status.replace('-', ' ')}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}