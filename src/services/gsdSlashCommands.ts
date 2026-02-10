/**
 * GSD Slash Commands DSL
 *
 * Implements the slash commands DSL for GSD workflows, providing both:
 * - Command suggestion/discovery system
 * - Command execution through GUI buttons
 * - Integration with Claude Code CLI
 */

import { GSDPhase, GSDStatus } from '../types/gsd';
import { getClaudeCodeDispatcher, GSDCommands } from './claudeCodeWebSocketDispatcher';

export interface SlashCommand {
  command: string;
  description: string;
  shortcut?: string;
  icon?: string;
  category: 'workflow' | 'phase' | 'navigation' | 'control' | 'utility';
  requiresInput?: boolean;
  availableInPhases?: GSDPhase[];
  availableInStatus?: GSDStatus[];
  dangerous?: boolean;
}

export interface SlashCommandExecution {
  command: SlashCommand;
  input?: string;
  executionId?: string;
}

export interface SlashCommandSuggestion {
  commands: SlashCommand[];
  context: {
    phase?: GSDPhase;
    status?: GSDStatus;
    hasActiveSession?: boolean;
  };
}

/**
 * Core GSD slash commands registry
 */
export const GSD_SLASH_COMMANDS: SlashCommand[] = [
  // Workflow Commands
  {
    command: '/start',
    description: 'Start a new GSD workflow session',
    shortcut: 'Ctrl+N',
    icon: 'PlayCircle',
    category: 'workflow',
    requiresInput: true,
    availableInStatus: ['waiting-input', 'complete', 'error']
  },
  {
    command: '/continue',
    description: 'Continue from current phase',
    shortcut: 'Ctrl+Enter',
    icon: 'Play',
    category: 'workflow',
    availableInStatus: ['paused', 'waiting-input']
  },
  {
    command: '/restart',
    description: 'Restart current phase',
    shortcut: 'Ctrl+R',
    icon: 'RefreshCw',
    category: 'workflow',
    availableInStatus: ['error', 'paused']
  },
  {
    command: '/abort',
    description: 'Abort current session',
    shortcut: 'Ctrl+C',
    icon: 'Square',
    category: 'control',
    dangerous: true,
    availableInStatus: ['executing', 'waiting-input']
  },

  // Phase Commands
  {
    command: '/spec',
    description: 'Jump to specification phase',
    icon: 'FileText',
    category: 'phase',
    availableInPhases: ['idle', 'spec', 'plan', 'implement', 'test', 'commit']
  },
  {
    command: '/plan',
    description: 'Jump to planning phase',
    icon: 'Layout',
    category: 'phase',
    availableInPhases: ['spec', 'plan', 'implement', 'test', 'commit']
  },
  {
    command: '/implement',
    description: 'Jump to implementation phase',
    icon: 'Code',
    category: 'phase',
    availableInPhases: ['plan', 'implement', 'test', 'commit']
  },
  {
    command: '/test',
    description: 'Jump to testing phase',
    icon: 'CheckCircle',
    category: 'phase',
    availableInPhases: ['implement', 'test', 'commit']
  },
  {
    command: '/commit',
    description: 'Jump to commit phase',
    icon: 'GitCommit',
    category: 'phase',
    availableInPhases: ['test', 'commit']
  },

  // Navigation Commands
  {
    command: '/status',
    description: 'Show current session status',
    icon: 'Info',
    category: 'navigation'
  },
  {
    command: '/history',
    description: 'Show session history',
    icon: 'History',
    category: 'navigation'
  },
  {
    command: '/logs',
    description: 'Show execution logs',
    icon: 'FileList',
    category: 'navigation'
  },
  {
    command: '/files',
    description: 'Show modified files',
    icon: 'Files',
    category: 'navigation'
  },

  // Utility Commands
  {
    command: '/help',
    description: 'Show available commands',
    shortcut: '?',
    icon: 'HelpCircle',
    category: 'utility'
  },
  {
    command: '/clear',
    description: 'Clear terminal output',
    icon: 'Trash2',
    category: 'utility'
  },
  {
    command: '/save',
    description: 'Save current session',
    shortcut: 'Ctrl+S',
    icon: 'Save',
    category: 'utility'
  },
  {
    command: '/export',
    description: 'Export session data',
    icon: 'Download',
    category: 'utility',
    requiresInput: true
  },

  // Control Commands
  {
    command: '/pause',
    description: 'Pause current execution',
    icon: 'Pause',
    category: 'control',
    availableInStatus: ['executing']
  },
  {
    command: '/resume',
    description: 'Resume paused execution',
    icon: 'Play',
    category: 'control',
    availableInStatus: ['paused']
  },
  {
    command: '/skip',
    description: 'Skip current step',
    icon: 'SkipForward',
    category: 'control',
    dangerous: true,
    availableInStatus: ['waiting-input', 'executing']
  }
];

/**
 * Slash command processor and suggestion engine
 */
export class GSDSlashCommandProcessor {
  private commands: Map<string, SlashCommand>;

  constructor(commands: SlashCommand[] = GSD_SLASH_COMMANDS) {
    this.commands = new Map(commands.map(cmd => [cmd.command, cmd]));
  }

  /**
   * Get command suggestions based on current context
   */
  getSuggestions(context: {
    phase?: GSDPhase;
    status?: GSDStatus;
    hasActiveSession?: boolean;
  }): SlashCommandSuggestion {
    const availableCommands = Array.from(this.commands.values()).filter(cmd => {
      // Filter by phase availability
      if (cmd.availableInPhases && context.phase) {
        if (!cmd.availableInPhases.includes(context.phase)) {
          return false;
        }
      }

      // Filter by status availability
      if (cmd.availableInStatus && context.status) {
        if (!cmd.availableInStatus.includes(context.status)) {
          return false;
        }
      }

      // Some commands require an active session
      if ((cmd.command === '/continue' || cmd.command === '/pause' || cmd.command === '/resume') && !context.hasActiveSession) {
        return false;
      }

      return true;
    });

    return {
      commands: availableCommands,
      context
    };
  }

  /**
   * Get commands by category for organized display
   */
  getCommandsByCategory(context: {
    phase?: GSDPhase;
    status?: GSDStatus;
    hasActiveSession?: boolean;
  }): Record<string, SlashCommand[]> {
    const suggestions = this.getSuggestions(context);
    const categorized: Record<string, SlashCommand[]> = {};

    for (const command of suggestions.commands) {
      if (!categorized[command.category]) {
        categorized[command.category] = [];
      }
      categorized[command.category].push(command);
    }

    return categorized;
  }

  /**
   * Parse a slash command string
   */
  parseCommand(input: string): { command: SlashCommand; args: string[] } | null {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) {
      return null;
    }

    const parts = trimmed.split(/\s+/);
    const commandName = parts[0];
    const args = parts.slice(1);

    const command = this.commands.get(commandName);
    if (!command) {
      return null;
    }

    return { command, args };
  }

  /**
   * Execute a slash command
   */
  async executeCommand(
    commandName: string,
    args: string[] = [],
    context?: {
      sessionId?: string;
      projectPath?: string;
    }
  ): Promise<SlashCommandExecution> {
    const command = this.commands.get(commandName);
    if (!command) {
      throw new Error(`Unknown command: ${commandName}`);
    }

    const input = args.join(' ');

    // Handle different command types
    switch (commandName) {
      case '/start':
        return this.executeStartCommand(command, input, context);
      case '/continue':
        return this.executeContinueCommand(command);
      case '/restart':
        return this.executeRestartCommand(command);
      case '/abort':
        return this.executeAbortCommand(command);
      case '/spec':
      case '/plan':
      case '/implement':
      case '/test':
      case '/commit':
        return this.executePhaseCommand(command, commandName.slice(1) as GSDPhase, context);
      case '/pause':
        return this.executePauseCommand(command);
      case '/resume':
        return this.executeResumeCommand(command);
      case '/help':
        return this.executeHelpCommand(command);
      default:
        return this.executeGenericCommand(command, input);
    }
  }

  /**
   * Execute /start command
   */
  private async executeStartCommand(
    command: SlashCommand,
    input: string,
    context?: { projectPath?: string }
  ): Promise<SlashCommandExecution> {
    if (!input.trim()) {
      throw new Error('/start command requires a task description');
    }

    const claudeCommand = GSDCommands.startWorkflow(input, context?.projectPath);
    const dispatcher = await getClaudeCodeDispatcher();
    const execution = await dispatcher.executeAsync(claudeCommand);

    return {
      command,
      input,
      executionId: execution.id
    };
  }

  /**
   * Execute /continue command
   */
  private async executeContinueCommand(
    command: SlashCommand
  ): Promise<SlashCommandExecution> {
    const claudeCommand = GSDCommands.sendInput('continue');
    const dispatcher = await getClaudeCodeDispatcher();
    const execution = await dispatcher.executeAsync(claudeCommand);

    return {
      command,
      executionId: execution.id
    };
  }

  /**
   * Execute /restart command
   */
  private async executeRestartCommand(
    command: SlashCommand
  ): Promise<SlashCommandExecution> {
    const claudeCommand = GSDCommands.sendInput('restart from current phase');
    const dispatcher = await getClaudeCodeDispatcher();
    const execution = await dispatcher.executeAsync(claudeCommand);

    return {
      command,
      executionId: execution.id
    };
  }

  /**
   * Execute /abort command
   */
  private async executeAbortCommand(
    command: SlashCommand
  ): Promise<SlashCommandExecution> {
    const claudeCommand = GSDCommands.cancel();
    const dispatcher = await getClaudeCodeDispatcher();
    const execution = await dispatcher.executeAsync(claudeCommand);

    return {
      command,
      executionId: execution.id
    };
  }

  /**
   * Execute phase commands (/spec, /plan, etc.)
   */
  private async executePhaseCommand(
    command: SlashCommand,
    phase: GSDPhase,
    context?: { sessionId?: string }
  ): Promise<SlashCommandExecution> {
    const claudeCommand = GSDCommands.executePhase(phase as any, context?.sessionId);
    const dispatcher = await getClaudeCodeDispatcher();
    const execution = await dispatcher.executeAsync(claudeCommand);

    return {
      command,
      executionId: execution.id
    };
  }

  /**
   * Execute /pause command
   */
  private async executePauseCommand(
    command: SlashCommand
  ): Promise<SlashCommandExecution> {
    // In real implementation, this would pause the current Claude Code execution
    console.log('Pausing current execution...');
    return { command };
  }

  /**
   * Execute /resume command
   */
  private async executeResumeCommand(
    command: SlashCommand
  ): Promise<SlashCommandExecution> {
    // In real implementation, this would resume the paused execution
    console.log('Resuming execution...');
    return { command };
  }

  /**
   * Execute /help command
   */
  private async executeHelpCommand(
    command: SlashCommand
  ): Promise<SlashCommandExecution> {
    const suggestions = this.getSuggestions({});

    console.log('Available GSD commands:');
    for (const cmd of suggestions.commands) {
      console.log(`  ${cmd.command} - ${cmd.description}`);
      if (cmd.shortcut) {
        console.log(`    Shortcut: ${cmd.shortcut}`);
      }
    }

    return { command };
  }

  /**
   * Execute generic commands (status, history, etc.)
   */
  private async executeGenericCommand(
    command: SlashCommand,
    input: string
  ): Promise<SlashCommandExecution> {
    // Most utility commands just send the command name to Claude Code
    const claudeCommand = GSDCommands.sendInput(command.command + (input ? ` ${input}` : ''));
    const dispatcher = await getClaudeCodeDispatcher();
    const execution = await dispatcher.executeAsync(claudeCommand);

    return {
      command,
      input,
      executionId: execution.id
    };
  }
}

/**
 * Default slash command processor instance
 */
export const gsdSlashCommands = new GSDSlashCommandProcessor();

/**
 * Utility functions for working with slash commands
 */
export const SlashCommandUtils = {
  /**
   * Check if a string is a slash command
   */
  isSlashCommand(input: string): boolean {
    return input.trim().startsWith('/');
  },

  /**
   * Get command suggestions as autocomplete options
   */
  getAutocompleteOptions(
    input: string,
    context: { phase?: GSDPhase; status?: GSDStatus; hasActiveSession?: boolean }
  ): SlashCommand[] {
    const suggestions = gsdSlashCommands.getSuggestions(context);

    if (!input.startsWith('/')) {
      return [];
    }

    const query = input.toLowerCase();
    return suggestions.commands.filter(cmd =>
      cmd.command.toLowerCase().startsWith(query) ||
      cmd.description.toLowerCase().includes(query.slice(1))
    );
  },

  /**
   * Format command for display
   */
  formatCommand(command: SlashCommand, includeShortcut = true): string {
    let formatted = `${command.command} - ${command.description}`;
    if (includeShortcut && command.shortcut) {
      formatted += ` (${command.shortcut})`;
    }
    return formatted;
  },

  /**
   * Get command icon name (for use with lucide-react)
   */
  getCommandIcon(command: SlashCommand): string {
    return command.icon || 'Terminal';
  }
};