import { useState, useCallback, useRef, useEffect } from 'react';
import { CommandResponse, CommandType } from '../types/shell';
import { getEnvironmentConfig } from '../utils/environmentSetup';
import { devLogger } from '../utils/dev-logger';

/**
 * Configuration for Claude CLI
 */
export interface ClaudeState {
  isAvailable: boolean;
  isProcessing: boolean;
  lastError?: string;
  cliPath?: string;
  setupInstructions?: string[];
}

/**
 * Hook for managing Claude Code CLI integration
 * Handles CLI detection, command routing, and response formatting
 */
export function useClaude() {
  const [state, setState] = useState<ClaudeState>(() => {
    const envConfig = getEnvironmentConfig();

    return {
      isAvailable: envConfig.cliAvailable,
      isProcessing: false,
      cliPath: envConfig.cliPath,
      setupInstructions: envConfig.cliAvailable ? undefined : undefined // Get on demand
    };
  });

  const commandIdRef = useRef(0);

  // Sync state with environment config on mount (safely)
  useEffect(() => {
    const envConfig = getEnvironmentConfig();
    setState(prev => ({
      ...prev,
      isAvailable: envConfig.cliAvailable,
      cliPath: envConfig.cliPath
    }));
  }, []); // Empty deps - only run once on mount

  /**
   * Execute a Claude command using CLI with proper error handling
   */
  const executeClaudeCommand = useCallback(async (prompt: string): Promise<CommandResponse> => {
    const commandId = `claude_cli_${++commandIdRef.current}`;
    const startTime = Date.now();

    setState(prev => ({ ...prev, isProcessing: true, lastError: undefined }));

    try {
      // Check if Claude CLI is available
      const envConfig = getEnvironmentConfig();
      if (!envConfig.cliAvailable || !envConfig.cliPath) {
        throw new Error('Claude Code CLI not found. Please install Claude Code desktop application.');
      }

      devLogger.debug('Executing Claude CLI command', { commandId, prompt: prompt.substring(0, 100) + '...' });

      // In a real environment, we would use child_process to spawn the CLI
      // For now, we'll simulate the response since we're in a browser context
      const output = await simulateClaudeCliExecution(prompt, envConfig.cliPath);

      const duration = Date.now() - startTime;

      const commandResponse: CommandResponse = {
        id: commandId,
        success: true,
        output: formatClaudeResponse(output),
        duration,
        type: 'claude' as CommandType
      };

      setState(prev => ({ ...prev, isProcessing: false }));

      devLogger.debug('Claude CLI command completed', { commandId, duration, outputLength: output.length });
      return commandResponse;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = handleCLIError(error);

      const commandResponse: CommandResponse = {
        id: commandId,
        success: false,
        output: '',
        error: errorMessage,
        duration,
        type: 'claude' as CommandType
      };

      setState(prev => ({
        ...prev,
        isProcessing: false,
        lastError: errorMessage
      }));

      devLogger.error('Claude CLI command failed', { commandId, error: errorMessage, duration });
      return commandResponse;
    }
  }, []);

  /**
   * Simulate Claude CLI execution (browser context limitation)
   * In a real desktop app with Node.js backend, this would use child_process.spawn
   */
  const simulateClaudeCliExecution = useCallback(async (prompt: string, cliPath: string): Promise<string> => {
    // Simulate CLI command execution
    // In real implementation: exec(`${cliPath} --prompt "${prompt}"`)

    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000)); // Simulate processing time

    return `Claude Code CLI Response to: "${prompt.substring(0, 50)}..."

This is a simulated response from Claude Code CLI.
In a real desktop environment, this would be the actual CLI output.

CLI Path: ${cliPath}
Status: Available and operational

Suggested command routing:
- For code analysis: Use Claude Code with project context
- For file operations: Route to system terminal
- For AI assistance: Route to Claude Code CLI

Note: This simulation will be replaced with actual child_process execution
when running in a Node.js environment (Tauri/Electron).`;
  }, []);

  /**
   * Format Claude CLI response for terminal display
   */
  const formatClaudeResponse = useCallback((response: string): string => {
    // Add Claude CLI formatting for terminal display
    const formatted = `🤖 Claude Code CLI:\n${'='.repeat(60)}\n\n${response}\n\n${'='.repeat(60)}`;
    return formatted;
  }, []);

  /**
   * Convert CLI errors to user-friendly messages
   */
  const handleCLIError = useCallback((error: unknown): string => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // CLI not found
      if (message.includes('not found') || message.includes('command not found') || message.includes('enoent')) {
        return 'Claude Code CLI not found. Please install the Claude Code desktop application.\nVisit: https://claude.ai/code to download and install.';
      }

      // Permission errors
      if (message.includes('permission') || message.includes('eacces')) {
        return 'Permission denied accessing Claude Code CLI.\nTip: Check if Claude Code is properly installed and accessible.';
      }

      // Process errors
      if (message.includes('spawn') || message.includes('exit code')) {
        return 'Claude Code CLI execution failed.\nTip: Verify Claude Code is running and properly configured.';
      }

      // Generic error with original message
      return `Claude CLI Error: ${error.message}\n\nTip: Ensure Claude Code desktop application is installed and running.`;
    }

    return 'Unknown error occurred while executing Claude Code CLI.\nPlease check your Claude Code installation.';
  }, []);

  /**
   * Check if Claude CLI is currently available
   */
  const validateCLI = useCallback((): boolean => {
    const envConfig = getEnvironmentConfig();
    return envConfig.cliAvailable;
  }, []);

  /**
   * Get setup instructions for Claude CLI installation
   */
  const getSetupInstructions = useCallback((): string[] => {
    return [
      '1. Download Claude Code desktop application',
      '   Visit: https://claude.ai/code',
      '2. Install Claude Code following the setup wizard',
      '3. Ensure Claude Code CLI is in your PATH',
      '4. Verify installation by running: claude --version',
      '5. Restart this application to detect the CLI',
      '',
      '💡 Claude Code CLI provides:',
      '   - Project-aware AI assistance',
      '   - Code analysis and refactoring',
      '   - Context-aware suggestions',
      '   - Integration with local development environment'
    ];
  }, []);

  /**
   * Determine if a command should be routed to Claude vs system terminal
   */
  const shouldRouteToClaudeEngine = useCallback((command: string): boolean => {
    const claudeIndicators = [
      'claude', '@claude', 'ai', 'explain', 'analyze', 'suggest', 'help',
      'refactor', 'optimize', 'debug', 'review', 'implement'
    ];

    const commandLower = command.toLowerCase();
    return claudeIndicators.some(indicator => commandLower.includes(indicator));
  }, []);

  return {
    ...state,
    executeClaudeCommand,
    validateCLI,
    getSetupInstructions,
    shouldRouteToClaudeEngine,
    formatClaudeResponse
  };
}