import { useCallback, useState, useRef } from 'react';
import { useTerminal } from './useTerminal';
import { useClaudeAPI } from './useClaudeAPI';
import { useProjectContext } from './useProjectContext';
import { parseCommand, isClaudeHelp, getClaudeHelpText } from '../utils/commandParsing';
import type { CommandResponse, CommandType } from '../types/shell';

export interface CommandHistoryItem {
  id: string;
  command: string;
  type: CommandType;
  response: CommandResponse;
  timestamp: Date;
  context?: {
    cardTitle?: string;
    projectName?: string;
  };
}

interface UseCommandRouterReturn {
  executeCommand: (input: string) => Promise<CommandResponse>;
  getCommandHistory: () => CommandHistoryItem[];
  clearHistory: () => void;
  isExecuting: boolean;
}

/**
 * Command router that dispatches to appropriate handlers (terminal vs Claude)
 */
export function useCommandRouter(): UseCommandRouterReturn {
  const terminal = useTerminal();
  const claudeAPI = useClaudeAPI();
  const projectContext = useProjectContext();

  const [isExecuting, setIsExecuting] = useState(false);
  const historyRef = useRef<CommandHistoryItem[]>([]);

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

        addToHistory(originalInput, 'claude', helpResponse);
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
      const historyItem: CommandHistoryItem = {
        id: commandId,
        command: originalInput,
        type: 'claude',
        response,
        timestamp: new Date(),
        context: {
          cardTitle: activeCard?.title,
          projectName: 'Isometry'
        }
      };

      historyRef.current.unshift(historyItem);

      // Limit history size
      if (historyRef.current.length > 100) {
        historyRef.current = historyRef.current.slice(0, 100);
      }

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

      addToHistory(originalInput, 'claude', errorResponse);
      return errorResponse;
    }
  }, [claudeAPI, projectContext]);

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

          addToHistory(originalInput, 'system', response);
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

      addToHistory(originalInput, 'system', errorResponse);
      return errorResponse;
    }
  }, []);

  const addToHistory = useCallback((command: string, type: CommandType, response: CommandResponse) => {
    const historyItem: CommandHistoryItem = {
      id: response.id,
      command,
      type,
      response,
      timestamp: new Date(),
      context: type === 'claude' ? {
        cardTitle: projectContext.getActiveCardContext()?.title,
        projectName: 'Isometry'
      } : undefined
    };

    historyRef.current.unshift(historyItem);

    // Limit history size
    if (historyRef.current.length > 100) {
      historyRef.current = historyRef.current.slice(0, 100);
    }
  }, [projectContext]);

  const getCommandHistory = useCallback((): CommandHistoryItem[] => {
    return [...historyRef.current];
  }, []);

  const clearHistory = useCallback(() => {
    historyRef.current = [];
  }, []);

  return {
    executeCommand,
    getCommandHistory,
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