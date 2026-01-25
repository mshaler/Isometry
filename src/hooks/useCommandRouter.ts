import { useCallback, useState } from 'react';
import { useClaudeAPI } from './useClaudeAPI';
import { useProjectContext } from './useProjectContext';
import { useCommandHistory } from './useCommandHistory';
import { parseCommand, isClaudeHelp, getClaudeHelpText } from '../utils/commandParsing';
import type { CommandResponse, CommandType, HistoryEntry } from '../types/shell';

interface UseCommandRouterReturn {
  executeCommand: (input: string) => Promise<CommandResponse>;
  getCommandHistory: () => HistoryEntry[];
  navigateHistory: (direction: 'up' | 'down') => string | null;
  searchHistory: (query: string) => void;
  clearHistory: () => void;
  isExecuting: boolean;
}

/**
 * Command router that dispatches to appropriate handlers (terminal vs Claude)
 */
export function useCommandRouter(): UseCommandRouterReturn {
  const claudeAPI = useClaudeAPI();
  const projectContext = useProjectContext();
  const history = useCommandHistory();

  const [isExecuting, setIsExecuting] = useState(false);

  const executeCommand = useCallback(async (input: string): Promise<CommandResponse> => {
    setIsExecuting(true);
    const startTime = Date.now();

    try {
      const parsed = parseCommand(input);

      if (parsed.type === 'claude') {
        return await executeClaudeCommand(parsed.prompt || '', input);
      } else {
        return await executeSystemCommand(parsed.command || '', input);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        id: `error-${Date.now()}`,
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        duration,
        type: 'system'
      };
    } finally {
      setIsExecuting(false);
    }
  }, []);

  const executeClaudeCommand = useCallback(async (prompt: string, originalInput: string): Promise<CommandResponse> => {
    const startTime = Date.now();
    const commandId = `claude-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Handle help commands
      if (isClaudeHelp(originalInput)) {
        const helpResponse: CommandResponse = {
          id: commandId,
          success: true,
          output: getClaudeHelpText(),
          duration: Date.now() - startTime,
          type: 'claude'
        };

        const historyEntry: HistoryEntry = {
          id: commandId,
          command: originalInput,
          type: 'claude',
          timestamp: new Date(),
          response: helpResponse,
          duration: Date.now() - startTime,
          cwd: '/Users/mshaler/Developer/Projects/Isometry',
          context: {
            cardTitle: projectContext.getActiveCardContext()?.title
          }
        };
        history.addHistoryEntry(historyEntry);
        return helpResponse;
      }

      // Get project context for the prompt
      const activeCard = projectContext.getActiveCardContext();
      let enhancedPrompt = prompt;

      // Add context based on prompt content and active card
      if (activeCard) {
        const contextType = shouldIncludeFullContext(prompt) ? 'full' : 'card';
        const context = projectContext.formatContextForClaude(contextType);

        enhancedPrompt = `${context}\n\n---\n\nUser question: ${prompt}`;
      } else if (shouldIncludeProjectContext(prompt)) {
        const context = projectContext.formatContextForClaude('project');
        enhancedPrompt = `${context}\n\n---\n\nUser question: ${prompt}`;
      }

      // Execute Claude command
      const response = await claudeAPI.executeClaudeCommand(enhancedPrompt);

      // Add to history with context info
      const historyEntry: HistoryEntry = {
        id: commandId,
        command: originalInput,
        type: 'claude',
        timestamp: new Date(),
        response,
        duration: Date.now() - startTime,
        cwd: '/Users/mshaler/Developer/Projects/Isometry', // TODO: Get from terminal context
        context: {
          cardId: activeCard?.title, // Using title as ID since nodeId doesn't exist on this type
          cardTitle: activeCard?.title
        }
      };

      history.addHistoryEntry(historyEntry);

      return response;

    } catch (error) {
      const errorResponse: CommandResponse = {
        id: commandId,
        success: false,
        output: '',
        error: handleCommandError(error, 'claude'),
        duration: Date.now() - startTime,
        type: 'claude'
      };

      const errorHistoryEntry: HistoryEntry = {
        id: commandId,
        command: originalInput,
        type: 'claude',
        timestamp: new Date(),
        response: errorResponse,
        duration: Date.now() - startTime,
        cwd: '/Users/mshaler/Developer/Projects/Isometry',
        context: {
          cardTitle: projectContext.getActiveCardContext()?.title
        }
      };
      history.addHistoryEntry(errorHistoryEntry);
      return errorResponse;
    }
  }, [claudeAPI, projectContext, history]);

  const executeSystemCommand = useCallback(async (command: string, originalInput: string): Promise<CommandResponse> => {
    const startTime = Date.now();
    const commandId = `system-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // For system commands, we'll simulate execution since this is a browser environment
      // In a real implementation, this would go through a backend service

      return new Promise((resolve) => {
        // Simulate async execution
        setTimeout(() => {
          let output = '';
          let success = true;
          let error: string | undefined;

          // Handle specific commands
          if (command === '') {
            // Empty command, just return success
          } else if (command === 'help') {
            output = `Available commands:
System commands: ls, pwd, cd, echo, clear, whoami, date
Claude commands: claude <question>, ai <question>, ask <question>

Type 'claude help' for AI command documentation.`;
          } else {
            // For now, just indicate that this is a simulated terminal
            output = `Simulated execution: ${command}
(Note: This is a browser-based terminal simulation)`;
          }

          const response: CommandResponse = {
            id: commandId,
            success,
            output,
            error,
            duration: Date.now() - startTime,
            type: 'system'
          };

          const historyEntry: HistoryEntry = {
            id: commandId,
            command: originalInput,
            type: 'system',
            timestamp: new Date(),
            response,
            duration: Date.now() - startTime,
            cwd: '/Users/mshaler/Developer/Projects/Isometry'
          };
          history.addHistoryEntry(historyEntry);
          resolve(response);
        }, 100); // Simulate some delay
      });

    } catch (error) {
      const errorResponse: CommandResponse = {
        id: commandId,
        success: false,
        output: '',
        error: handleCommandError(error, 'system'),
        duration: Date.now() - startTime,
        type: 'system'
      };

      const errorHistoryEntry: HistoryEntry = {
        id: commandId,
        command: originalInput,
        type: 'system',
        timestamp: new Date(),
        response: errorResponse,
        duration: Date.now() - startTime,
        cwd: '/Users/mshaler/Developer/Projects/Isometry'
      };
      history.addHistoryEntry(errorHistoryEntry);
      return errorResponse;
    }
  }, [history]);

  const getCommandHistory = useCallback((): HistoryEntry[] => {
    return history.getHistory();
  }, [history]);

  const navigateHistory = useCallback((direction: 'up' | 'down'): string | null => {
    return history.navigateHistory(direction);
  }, [history]);

  const searchHistory = useCallback((query: string) => {
    history.searchHistory(query);
  }, [history]);

  const clearHistory = useCallback(() => {
    history.clearHistory();
  }, [history]);

  return {
    executeCommand,
    getCommandHistory,
    navigateHistory,
    searchHistory,
    clearHistory,
    isExecuting
  };
}

/**
 * Determine if the prompt should include full project context
 */
function shouldIncludeFullContext(prompt: string): boolean {
  const fullContextKeywords = [
    'project', 'structure', 'architecture', 'database', 'schema',
    'files', 'components', 'overview', 'explain the codebase'
  ];

  const lowerPrompt = prompt.toLowerCase();
  return fullContextKeywords.some(keyword => lowerPrompt.includes(keyword));
}

/**
 * Determine if the prompt should include basic project context
 */
function shouldIncludeProjectContext(prompt: string): boolean {
  const projectKeywords = [
    'code', 'implement', 'function', 'component', 'bug', 'error',
    'help', 'how to', 'what is', 'explain', 'debug'
  ];

  const lowerPrompt = prompt.toLowerCase();
  return projectKeywords.some(keyword => lowerPrompt.includes(keyword));
}

/**
 * Handle command execution errors with user-friendly messages
 */
function handleCommandError(error: unknown, type: CommandType): string {
  if (error instanceof Error) {
    // Network or API errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return type === 'claude'
        ? 'Network error: Unable to reach Claude API. Please check your internet connection.'
        : 'Network error: Unable to execute system command.';
    }

    // Authentication errors
    if (error.message.includes('auth') || error.message.includes('401')) {
      return type === 'claude'
        ? 'Authentication error: Please check your Claude API key configuration.'
        : 'Permission error: Insufficient permissions to execute command.';
    }

    return error.message;
  }

  return type === 'claude'
    ? 'An unexpected error occurred with Claude API.'
    : 'An unexpected error occurred executing the command.';
}