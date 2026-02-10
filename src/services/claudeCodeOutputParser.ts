/**
 * Claude Code Output Parser
 *
 * Parses Claude Code CLI output to extract structured information about:
 * - Choice prompts and options
 * - Phase transitions
 * - Tool use activities
 * - Progress indicators
 * - Error states and suggestions
 */

export interface ClaudeCodeChoice {
  index: number;
  text: string;
  shortcut?: string;
  category?: 'implementation' | 'planning' | 'testing' | 'documentation' | 'debugging';
}

export interface ClaudeCodePhaseTransition {
  fromPhase: string;
  toPhase: string;
  timestamp: Date;
  reason?: string;
}

export interface ClaudeCodeToolUse {
  toolName: string;
  action: string;
  target?: string;
  status: 'started' | 'in_progress' | 'completed' | 'error';
  timestamp: Date;
}

export interface ClaudeCodeProgress {
  currentStep: string;
  totalSteps?: number;
  completedSteps?: number;
  estimatedRemaining?: string;
}

export interface ClaudeCodeError {
  errorType: 'compilation' | 'runtime' | 'validation' | 'network' | 'permission' | 'unknown';
  message: string;
  file?: string;
  line?: number;
  suggestions: string[];
}

export interface ClaudeCodeParseResult {
  type: 'choice_prompt' | 'phase_transition' | 'tool_use' | 'progress' | 'error' | 'text' | 'completion';
  content: string;
  structured?: {
    choices?: ClaudeCodeChoice[];
    phaseTransition?: ClaudeCodePhaseTransition;
    toolUse?: ClaudeCodeToolUse;
    progress?: ClaudeCodeProgress;
    error?: ClaudeCodeError;
  };
  timestamp: Date;
}

/**
 * Claude Code output parser that understands the specific patterns
 * used by Claude Code CLI for different types of output
 */
export class ClaudeCodeOutputParser {
  private static readonly PATTERNS = {
    // Choice prompts: "1. Option text" or "1) Option text"
    CHOICE_OPTION: /^(\d+)[.)]\s+(.+)$/,
    CHOICE_PROMPT: /^(Please select|Choose|Select)\s+(an?\s+)?(option|choice)/i,

    // Phase transitions: "Starting [phase] phase..." or "Entering [phase]..."
    PHASE_START: /^(?:Starting|Entering|Beginning)\s+(\w+)\s+(?:phase|mode)/i,
    PHASE_COMPLETE: /^(?:Completed|Finished|Done with)\s+(\w+)\s+(?:phase|mode)/i,

    // Tool use: "Using [tool] to [action]..." or "[tool]: [action]"
    TOOL_USE_START: /^(?:Using|Running|Executing)\s+(\w+)\s+(?:to\s+)?(.+)/i,
    TOOL_USE_ACTION: /^(\w+):\s*(.+)$/,
    TOOL_USE_COMPLETE: /^(?:✓|✅|Done|Completed)[\s:]*(.+)/,

    // Progress indicators
    PROGRESS_STEP: /^(?:Step\s+)?(\d+)(?:\/(\d+))?\s*[-:]\s*(.+)/,
    PROGRESS_PERCENT: /(\d+)%\s+(?:complete|done)/i,

    // Errors and issues
    ERROR_PREFIX: /^(?:Error|Failed|✗|❌)[\s:]+(.+)/i,
    WARNING_PREFIX: /^(?:Warning|⚠️)[\s:]+(.+)/i,
    COMPILE_ERROR: /^(.+\.(?:ts|js|tsx|jsx)):(\d+):(\d+)\s*-\s*error\s*TS(\d+):\s*(.+)/,

    // Completion indicators
    COMPLETION: /^(?:All done|Completed successfully|✓ Complete)/i,

    // File operations
    FILE_CREATED: /^(?:Created|Writing|Wrote):\s*(.+)/i,
    FILE_MODIFIED: /^(?:Modified|Updated|Editing):\s*(.+)/i,
    FILE_DELETED: /^(?:Deleted|Removed):\s*(.+)/i
  };

  /**
   * Parse a line of Claude Code output
   */
  parseLine(line: string): ClaudeCodeParseResult {
    const trimmed = line.trim();
    const timestamp = new Date();

    // Skip empty lines
    if (!trimmed) {
      return {
        type: 'text',
        content: line,
        timestamp
      };
    }

    // Check for choice prompts
    const choiceMatch = ClaudeCodeOutputParser.PATTERNS.CHOICE_OPTION.exec(trimmed);
    if (choiceMatch) {
      const [, indexStr, text] = choiceMatch;
      const choice: ClaudeCodeChoice = {
        index: parseInt(indexStr, 10),
        text: text.trim(),
        category: this.categorizeChoice(text)
      };

      return {
        type: 'choice_prompt',
        content: line,
        structured: { choices: [choice] },
        timestamp
      };
    }

    // Check for choice prompt headers
    if (ClaudeCodeOutputParser.PATTERNS.CHOICE_PROMPT.test(trimmed)) {
      return {
        type: 'choice_prompt',
        content: line,
        structured: { choices: [] },
        timestamp
      };
    }

    // Check for phase transitions
    const phaseStartMatch = ClaudeCodeOutputParser.PATTERNS.PHASE_START.exec(trimmed);
    if (phaseStartMatch) {
      const [, phase] = phaseStartMatch;
      return {
        type: 'phase_transition',
        content: line,
        structured: {
          phaseTransition: {
            fromPhase: 'unknown',
            toPhase: phase.toLowerCase(),
            timestamp,
            reason: 'Automatic progression'
          }
        },
        timestamp
      };
    }

    const phaseCompleteMatch = ClaudeCodeOutputParser.PATTERNS.PHASE_COMPLETE.exec(trimmed);
    if (phaseCompleteMatch) {
      const [, phase] = phaseCompleteMatch;
      return {
        type: 'phase_transition',
        content: line,
        structured: {
          phaseTransition: {
            fromPhase: phase.toLowerCase(),
            toPhase: 'complete',
            timestamp,
            reason: 'Phase completed successfully'
          }
        },
        timestamp
      };
    }

    // Check for tool use
    const toolUseMatch = ClaudeCodeOutputParser.PATTERNS.TOOL_USE_START.exec(trimmed);
    if (toolUseMatch) {
      const [, tool, action] = toolUseMatch;
      return {
        type: 'tool_use',
        content: line,
        structured: {
          toolUse: {
            toolName: tool,
            action: action.trim(),
            status: 'started',
            timestamp
          }
        },
        timestamp
      };
    }

    const toolActionMatch = ClaudeCodeOutputParser.PATTERNS.TOOL_USE_ACTION.exec(trimmed);
    if (toolActionMatch) {
      const [, tool, action] = toolActionMatch;
      return {
        type: 'tool_use',
        content: line,
        structured: {
          toolUse: {
            toolName: tool,
            action: action.trim(),
            status: 'in_progress',
            timestamp
          }
        },
        timestamp
      };
    }

    // Check for progress indicators
    const progressMatch = ClaudeCodeOutputParser.PATTERNS.PROGRESS_STEP.exec(trimmed);
    if (progressMatch) {
      const [, current, total, step] = progressMatch;
      return {
        type: 'progress',
        content: line,
        structured: {
          progress: {
            currentStep: step.trim(),
            completedSteps: parseInt(current, 10),
            totalSteps: total ? parseInt(total, 10) : undefined
          }
        },
        timestamp
      };
    }

    const percentMatch = ClaudeCodeOutputParser.PATTERNS.PROGRESS_PERCENT.exec(trimmed);
    if (percentMatch) {
      const [, percent] = percentMatch;
      return {
        type: 'progress',
        content: line,
        structured: {
          progress: {
            currentStep: `${percent}% complete`,
            completedSteps: parseInt(percent, 10),
            totalSteps: 100
          }
        },
        timestamp
      };
    }

    // Check for errors
    const errorMatch = ClaudeCodeOutputParser.PATTERNS.ERROR_PREFIX.exec(trimmed);
    if (errorMatch) {
      const [, message] = errorMatch;
      return {
        type: 'error',
        content: line,
        structured: {
          error: {
            errorType: this.categorizeError(message),
            message: message.trim(),
            suggestions: this.extractSuggestions(message)
          }
        },
        timestamp
      };
    }

    const compileErrorMatch = ClaudeCodeOutputParser.PATTERNS.COMPILE_ERROR.exec(trimmed);
    if (compileErrorMatch) {
      const [, file, lineStr, , , message] = compileErrorMatch;
      return {
        type: 'error',
        content: line,
        structured: {
          error: {
            errorType: 'compilation',
            message: message.trim(),
            file: file,
            line: parseInt(lineStr, 10),
            suggestions: this.extractSuggestions(message)
          }
        },
        timestamp
      };
    }

    // Check for completion
    if (ClaudeCodeOutputParser.PATTERNS.COMPLETION.test(trimmed)) {
      return {
        type: 'completion',
        content: line,
        timestamp
      };
    }

    // Default to text
    return {
      type: 'text',
      content: line,
      timestamp
    };
  }

  /**
   * Parse multiple lines of output (e.g., from a command execution)
   */
  parseOutput(output: string): ClaudeCodeParseResult[] {
    return output.split('\n').map(line => this.parseLine(line));
  }

  /**
   * Extract choices from multiple parsed lines
   */
  extractChoices(parseResults: ClaudeCodeParseResult[]): ClaudeCodeChoice[] {
    const choices: ClaudeCodeChoice[] = [];

    for (const result of parseResults) {
      if (result.type === 'choice_prompt' && result.structured?.choices) {
        choices.push(...result.structured.choices);
      }
    }

    return choices.sort((a, b) => a.index - b.index);
  }

  /**
   * Get the current phase from parsed output
   */
  getCurrentPhase(parseResults: ClaudeCodeParseResult[]): string | null {
    // Find the most recent phase transition
    for (let i = parseResults.length - 1; i >= 0; i--) {
      const result = parseResults[i];
      if (result.type === 'phase_transition' && result.structured?.phaseTransition) {
        return result.structured.phaseTransition.toPhase;
      }
    }

    return null;
  }

  /**
   * Get current tool activity
   */
  getCurrentToolUse(parseResults: ClaudeCodeParseResult[]): ClaudeCodeToolUse | null {
    // Find the most recent tool use that's still active
    for (let i = parseResults.length - 1; i >= 0; i--) {
      const result = parseResults[i];
      if (result.type === 'tool_use' && result.structured?.toolUse) {
        const toolUse = result.structured.toolUse;
        if (toolUse.status === 'started' || toolUse.status === 'in_progress') {
          return toolUse;
        }
      }
    }

    return null;
  }

  /**
   * Check if output indicates an error state
   */
  hasErrors(parseResults: ClaudeCodeParseResult[]): boolean {
    return parseResults.some(result => result.type === 'error');
  }

  /**
   * Get all errors from parsed output
   */
  getErrors(parseResults: ClaudeCodeParseResult[]): ClaudeCodeError[] {
    return parseResults
      .filter(result => result.type === 'error' && result.structured?.error)
      .map(result => result.structured!.error!);
  }

  /**
   * Categorize a choice based on its text content
   */
  private categorizeChoice(text: string): ClaudeCodeChoice['category'] {
    const lower = text.toLowerCase();

    if (lower.includes('implement') || lower.includes('code') || lower.includes('write')) {
      return 'implementation';
    }
    if (lower.includes('test') || lower.includes('verify') || lower.includes('check')) {
      return 'testing';
    }
    if (lower.includes('plan') || lower.includes('design') || lower.includes('spec')) {
      return 'planning';
    }
    if (lower.includes('document') || lower.includes('readme') || lower.includes('comment')) {
      return 'documentation';
    }
    if (lower.includes('debug') || lower.includes('fix') || lower.includes('investigate')) {
      return 'debugging';
    }

    return undefined;
  }

  /**
   * Categorize an error based on its message
   */
  private categorizeError(message: string): ClaudeCodeError['errorType'] {
    const lower = message.toLowerCase();

    if (lower.includes('compile') || lower.includes('typescript') || lower.includes('syntax')) {
      return 'compilation';
    }
    if (lower.includes('runtime') || lower.includes('execution') || lower.includes('crash')) {
      return 'runtime';
    }
    if (lower.includes('permission') || lower.includes('access') || lower.includes('forbidden')) {
      return 'permission';
    }
    if (lower.includes('network') || lower.includes('connection') || lower.includes('timeout')) {
      return 'network';
    }
    if (lower.includes('validation') || lower.includes('invalid') || lower.includes('schema')) {
      return 'validation';
    }

    return 'unknown';
  }

  /**
   * Extract potential suggestions from error messages
   */
  private extractSuggestions(message: string): string[] {
    const suggestions: string[] = [];

    // Common TypeScript suggestions
    if (message.includes('Cannot find module')) {
      suggestions.push('Check if the module is installed with npm/yarn');
      suggestions.push('Verify the import path is correct');
      suggestions.push('Add the module to package.json dependencies');
    }

    if (message.includes('Property') && message.includes('does not exist')) {
      suggestions.push('Check the object type definition');
      suggestions.push('Verify the property name spelling');
      suggestions.push('Add the property to the interface');
    }

    if (message.includes('Type') && message.includes('is not assignable')) {
      suggestions.push('Check the types match the expected interface');
      suggestions.push('Add type assertions if necessary');
      suggestions.push('Update the type definitions');
    }

    // Generic suggestions if no specific ones found
    if (suggestions.length === 0) {
      suggestions.push('Check the documentation for this feature');
      suggestions.push('Review the error message for specific guidance');
      suggestions.push('Consider breaking the problem into smaller steps');
    }

    return suggestions;
  }
}

/**
 * Singleton parser instance
 */
export const claudeCodeOutputParser = new ClaudeCodeOutputParser();

/**
 * Utility functions for working with parsed output
 */
export const ClaudeCodeParserUtils = {
  /**
   * Format a choice for display
   */
  formatChoice(choice: ClaudeCodeChoice): string {
    const categoryIcon = choice.category ? this.getCategoryIcon(choice.category) : '';
    return `${choice.index}. ${categoryIcon} ${choice.text}`;
  },

  /**
   * Get icon for choice category
   */
  getCategoryIcon(category: ClaudeCodeChoice['category']): string {
    const icons = {
      implementation: '💻',
      planning: '📋',
      testing: '🧪',
      documentation: '📚',
      debugging: '🐛'
    };
    return icons[category!] || '🔧';
  },

  /**
   * Format tool use for display
   */
  formatToolUse(toolUse: ClaudeCodeToolUse): string {
    const statusIcon = {
      started: '🔄',
      in_progress: '⚙️',
      completed: '✅',
      error: '❌'
    }[toolUse.status];

    return `${statusIcon} ${toolUse.toolName}: ${toolUse.action}`;
  },

  /**
   * Format error for display
   */
  formatError(error: ClaudeCodeError): string {
    const typeIcon = {
      compilation: '🔨',
      runtime: '⚡',
      validation: '📝',
      network: '🌐',
      permission: '🔒',
      unknown: '❓'
    }[error.errorType];

    let formatted = `${typeIcon} ${error.message}`;

    if (error.file && error.line) {
      formatted += ` (${error.file}:${error.line})`;
    }

    return formatted;
  },

  /**
   * Check if parsed results indicate Claude is waiting for input
   */
  isWaitingForInput(parseResults: ClaudeCodeParseResult[]): boolean {
    const hasChoices = parseResults.some(r => r.type === 'choice_prompt' && r.structured?.choices?.length);
    const lastResult = parseResults[parseResults.length - 1];

    return hasChoices && (
      !lastResult ||
      lastResult.type === 'choice_prompt' ||
      lastResult.content.includes('select') ||
      lastResult.content.includes('choose')
    );
  }
};