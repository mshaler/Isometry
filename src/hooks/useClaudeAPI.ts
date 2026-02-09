import { useState, useCallback, useRef } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import { CommandResponse, CommandType } from '../types/shell';
import { getEnvironmentConfig } from '../utils/environmentSetup';
import { devLogger } from '../utils/dev-logger';

/**
 * Configuration for Claude API
 */
export interface ClaudeAPIState {
  isConfigured: boolean;
  isConnecting: boolean;
  isProcessing: boolean;
  lastError?: string;
  configurationError?: string;
  setupInstructions?: string[];
}

/**
 * Hook for managing Claude API integration
 * Handles authentication, command processing, and response formatting
 */
export function useClaudeAPI() {
  const [state, setState] = useState<ClaudeAPIState>(() => {
    const envConfig = getEnvironmentConfig();

    return {
      isConfigured: envConfig.isConfigured,
      isConnecting: false,
      isProcessing: false,
      configurationError: envConfig.isConfigured ? undefined : envConfig.configurationStatus,
      setupInstructions: envConfig.isConfigured ? undefined : undefined // We'll get them on demand
    };
  });

  const claudeClientRef = useRef<Anthropic | null>(null);
  const commandIdRef = useRef(0);

  /**
   * Initialize Claude client with current API key
   */
  const initializeClient = useCallback((): Anthropic | null => {
    const envConfig = getEnvironmentConfig();

    if (!envConfig.isConfigured) {
      setState(prev => ({
        ...prev,
        isConfigured: false,
        configurationError: envConfig.configurationStatus
      }));
      return null;
    }

    try {
      // Get API key from environment
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

      if (!apiKey) {
        throw new Error('API key not found in environment variables');
      }

      const client = new Anthropic({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true // Required for browser usage - security warning noted
      });

      claudeClientRef.current = client;

      setState(prev => ({
        ...prev,
        isConfigured: true,
        configurationError: undefined
      }));

      devLogger.debug('Claude client initialized', { keyPrefix: apiKey.substring(0, 7) + '...' });
      return client;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';

      setState(prev => ({
        ...prev,
        isConfigured: false,
        configurationError: errorMessage
      }));

      devLogger.error('Claude client initialization failed', { error: errorMessage });
      return null;
    }
  }, []);

  /**
   * Execute a Claude command with proper error handling
   */
  const executeClaudeCommand = useCallback(async (prompt: string): Promise<CommandResponse> => {
    const commandId = `claude_${++commandIdRef.current}`;
    const startTime = Date.now();

    setState(prev => ({ ...prev, isProcessing: true, lastError: undefined }));

    try {
      // Initialize client if needed
      let client = claudeClientRef.current;
      if (!client) {
        client = initializeClient();
        if (!client) {
          throw new Error('Failed to initialize Claude API client');
        }
      }

      devLogger.debug('Sending Claude command', { commandId, prompt: prompt.substring(0, 100) + '...' });

      // Send request to Claude API
      const response = await client.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4000,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const duration = Date.now() - startTime;
      const output = formatClaudeResponse(response);

      const commandResponse: CommandResponse = {
        id: commandId,
        success: true,
        output,
        duration,
        type: 'claude' as CommandType
      };

      setState(prev => ({ ...prev, isProcessing: false }));

      devLogger.debug('Claude command completed', { commandId, duration, outputLength: output.length });
      return commandResponse;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = handleAPIError(error);

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

      devLogger.error('Claude command failed', { commandId, error: errorMessage, duration });
      return commandResponse;
    }
  }, [initializeClient]);

  /**
   * Format Claude API response for terminal display
   */
  const formatClaudeResponse = useCallback((response: Anthropic.Messages.Message): string => {
    if (!response.content || response.content.length === 0) {
      return 'Claude returned an empty response.';
    }

    // Extract text content from response
    const textContent = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as any).text)
      .join('\n');

    if (!textContent.trim()) {
      return 'Claude returned a non-text response.';
    }

    // Add basic formatting for terminal display
    const formatted = `Claude AI Response:\n${'='.repeat(50)}\n\n${textContent}\n\n${'='.repeat(50)}`;

    return formatted;
  }, []);

  /**
   * Convert API errors to user-friendly messages
   */
  const handleAPIError = useCallback((error: unknown): string => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Rate limiting
      if (message.includes('rate') || message.includes('quota') || message.includes('limit')) {
        return 'Rate limit reached. Please wait a moment before trying again.\nTip: Try shorter prompts or wait for quota reset.';
      }

      // Authentication
      if (message.includes('auth') || message.includes('api key') || message.includes('unauthorized') || message.includes('401')) {
        return 'Authentication failed. Please check your API key configuration.\nRun the environment setup to reconfigure.';
      }

      // Network errors
      if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
        return 'Network error occurred. Please check your internet connection and try again.\nFallback: You can try using system commands instead.';
      }

      // Invalid requests
      if (message.includes('invalid') || message.includes('bad request') || message.includes('400')) {
        return 'Invalid request format. Try rephrasing your prompt.\nTip: Be specific about what you want Claude to help with.';
      }

      // Generic error with original message
      return `Claude API Error: ${error.message}\n\nTip: If this persists, check your API key and internet connection.`;
    }

    return 'Unknown error occurred while communicating with Claude API.\nPlease try again or use system commands instead.';
  }, []);

  /**
   * Validate current API key configuration
   */
  const validateCurrentAPIKey = useCallback((): boolean => {
    const envConfig = getEnvironmentConfig();
    const isValid = envConfig.isConfigured;

    setState(prev => ({
      ...prev,
      isConfigured: isValid,
      configurationError: isValid ? undefined : envConfig.configurationStatus
    }));

    return isValid;
  }, []);

  /**
   * Get setup instructions for API configuration
   */
  const getSetupInstructions = useCallback((): string[] => {
    const { setupEnvironmentInstructions } = require('../utils/environmentSetup');
    return setupEnvironmentInstructions();
  }, []);

  return {
    ...state,
    executeClaudeCommand,
    validateCurrentAPIKey,
    getSetupInstructions,
    initializeClient
  };
}