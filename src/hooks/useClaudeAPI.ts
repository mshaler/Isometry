import { useCallback, useRef, useState } from 'react';
import { Anthropic } from '@anthropic-ai/sdk';
import { CommandResponse } from '../types/shell';
import {
  shouldUseAPIProxy,
  getSecureAPIEndpoint,
  getSecurityHeaders,
  validateSecurityConfig
} from '../config/security';

interface ProcessEnv {
  ANTHROPIC_API_KEY?: string;
  [key: string]: string | undefined;
}

interface GlobalThis {
  process?: {
    env?: ProcessEnv;
  };
}

interface UseClaudeAPIOptions {
  maxTokens?: number;
  temperature?: number;
}

interface UseClaudeAPIReturn {
  executeClaudeCommand: (prompt: string) => Promise<CommandResponse>;
  formatClaudeResponse: (response: string) => string;
  validateAPIKey: () => boolean;
  isConfigured: boolean;
  configurationInstructions: string[];
}

/**
 * Hook for integrating with Claude API for AI-assisted development commands
 * Handles authentication, API calls, and response formatting for terminal display
 */
export function useClaudeAPI(options: UseClaudeAPIOptions = {}): UseClaudeAPIReturn {
  const anthropicRef = useRef<Anthropic | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  // Initialize Anthropic client with security configuration
  const initializeClient = useCallback(() => {
    // Validate security configuration first
    const securityValidation = validateSecurityConfig();
    if (!securityValidation.valid) {
      console.error('Security configuration invalid:', securityValidation.errors);
      setIsConfigured(false);
      return null;
    }

    // Check if we should use proxy (production) or direct API (development)
    if (shouldUseAPIProxy()) {
      console.log('🔒 Using secure API proxy for Claude requests');
      setIsConfigured(true);
      return { proxy: true }; // Proxy client placeholder
    }

    // Development fallback - direct API access
    console.warn('🔓 Using direct API access (development mode)');

    const viteKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    const nodeKey = (globalThis as GlobalThis).process?.env?.ANTHROPIC_API_KEY;
    const apiKey = viteKey || nodeKey;

    if (!apiKey) {
      setIsConfigured(false);
      return null;
    }

    if (!validateAPIKey()) {
      setIsConfigured(false);
      return null;
    }

    try {
      anthropicRef.current = new Anthropic({
        apiKey,
        // Only allow browser access in development
        dangerouslyAllowBrowser: true
      });
      setIsConfigured(true);
      return anthropicRef.current;
    } catch (error) {
      console.error('Failed to initialize Anthropic client:', error);
      setIsConfigured(false);
      return null;
    }
  }, []);

  const validateAPIKey = useCallback((): boolean => {
    const viteKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    const nodeKey = (globalThis as GlobalThis).process?.env?.ANTHROPIC_API_KEY;
    const apiKey = viteKey || nodeKey;

    if (!apiKey) {
      return false;
    }

    // Check if API key has valid format
    if (!apiKey.startsWith('sk-ant-')) {
      console.warn('API key does not match expected Anthropic format');
      return false;
    }

    return true;
  }, []);

  // Secure proxy execution for production API calls
  const executeViaProxy = useCallback(async (
    prompt: string,
    commandId: string,
    startTime: number
  ): Promise<CommandResponse> => {
    try {
      const endpoint = getSecureAPIEndpoint();
      const headers = getSecurityHeaders();

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...headers,
          'Authorization': `Bearer proxy`, // Proxy handles actual API key
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 8192,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      return {
        id: commandId,
        success: true,
        output: data.content?.[0]?.text || 'No response content',
        duration,
        type: 'claude'
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        id: commandId,
        success: false,
        output: '',
        error: `Proxy API call failed: ${errorMessage}`,
        duration,
        type: 'claude'
      };
    }
  }, []);

  const executeClaudeCommand = useCallback(async (prompt: string): Promise<CommandResponse> => {
    const startTime = Date.now();
    const commandId = `claude-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let client = anthropicRef.current;
    if (!client) {
      client = initializeClient();
    }

    if (!client) {
      return {
        id: commandId,
        success: false,
        output: '',
        error: 'Claude API not configured. Please set ANTHROPIC_API_KEY environment variable.',
        duration: Date.now() - startTime,
        type: 'claude'
      };
    }

    // Use secure proxy for API calls if configured
    if (shouldUseAPIProxy()) {
      return executeViaProxy(prompt, commandId, startTime);
    }

    try {
      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.content[0];
      const output = content.type === 'text' ? content.text : 'Received non-text response from Claude';

      return {
        id: commandId,
        success: true,
        output: formatClaudeResponse(output),
        duration: Date.now() - startTime,
        type: 'claude'
      };

    } catch (error) {
      return {
        id: commandId,
        success: false,
        output: '',
        error: handleAPIError(error),
        duration: Date.now() - startTime,
        type: 'claude'
      };
    }
  }, [options.maxTokens, options.temperature, initializeClient]);

  const formatClaudeResponse = useCallback((response: string): string => {
    // Format Claude's response for better terminal display
    let formatted = response;

    // Add clear AI response indicator
    formatted = `🤖 Claude:\n${formatted}`;

    // Add separator for clarity
    formatted = `${formatted}\n${'─'.repeat(50)}`;

    return formatted;
  }, []);

  const handleAPIError = (error: unknown): string => {
    if (error instanceof Error) {
      // Handle common API errors with user-friendly messages
      if (error.message.includes('rate_limit')) {
        return 'Rate limit exceeded. Please wait a moment before trying again.';
      }

      if (error.message.includes('authentication') || error.message.includes('401')) {
        return 'Authentication failed. Please check your ANTHROPIC_API_KEY.';
      }

      if (error.message.includes('network') || error.message.includes('timeout')) {
        return 'Network error. Please check your internet connection and try again.';
      }

      if (error.message.includes('invalid_request')) {
        return 'Invalid request format. Try rephrasing your command.';
      }

      return `Claude API error: ${error.message}`;
    }

    return 'An unexpected error occurred with the Claude API.';
  };

  const configurationInstructions = [
    '1. Get an API key from https://console.anthropic.com/account/keys',
    '2. Create a new key if you don\'t have one',
    '3. Set the environment variable:',
    '   export ANTHROPIC_API_KEY=sk-ant-your-key-here',
    '4. For Vite development:',
    '   export VITE_ANTHROPIC_API_KEY=sk-ant-your-key-here',
    '5. Restart your development server: npm run dev',
    '',
    '⚠️  Note: This implementation exposes the API key in the browser.',
    '   In production, route API calls through your backend server.'
  ];

  return {
    executeClaudeCommand,
    formatClaudeResponse,
    validateAPIKey,
    isConfigured,
    configurationInstructions
  };
}