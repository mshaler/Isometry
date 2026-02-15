import { useState, useCallback, useRef, useMemo } from 'react';
import { claudeService, type ChatMessage, buildSystemPrompt, type ProjectContext } from '@/services/claude-ai';
import { devLogger } from '@/utils/logging';

interface UseClaudeAIOptions {
  systemPrompt?: string;
  projectContext?: ProjectContext;
  includeArchitecture?: boolean;
}

export function useClaudeAI(options: UseClaudeAIOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const abortRef = useRef(false);

  const isConfigured = claudeService.isConfigured();

  // Build system prompt with project context
  const effectiveSystemPrompt = useMemo(() => {
    // If explicit system prompt provided, use it
    if (options.systemPrompt) {
      return options.systemPrompt;
    }

    // If project context provided or architecture flag set, build rich prompt
    if (options.projectContext || options.includeArchitecture !== false) {
      return buildSystemPrompt(options.projectContext);
    }

    // Default minimal prompt
    return undefined;
  }, [options.systemPrompt, options.projectContext, options.includeArchitecture]);

  /**
   * Generate unique message ID
   */
  const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  /**
   * Send a message to Claude
   */
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    setError(null);
    abortRef.current = false;

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setStreamingContent('');

    // Prepare messages for API (exclude IDs and timestamps)
    const apiMessages = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content
    }));

    try {
      let fullResponse = '';

      await claudeService.sendMessageStreaming(
        apiMessages,
        {
          onText: (text) => {
            if (abortRef.current) return;
            fullResponse += text;
            setStreamingContent(fullResponse);
          },
          onComplete: () => {
            if (abortRef.current) return;

            const assistantMessage: ChatMessage = {
              id: generateId(),
              role: 'assistant',
              content: fullResponse,
              timestamp: new Date()
            };

            setMessages(prev => [...prev, assistantMessage]);
            setStreamingContent('');
            setIsLoading(false);
          },
          onError: (err) => {
            devLogger.error('Claude chat error', { component: 'useClaudeAI', error: err });
            setError(err.message);
            setIsLoading(false);
            setStreamingContent('');
          }
        },
        effectiveSystemPrompt
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setIsLoading(false);
      setStreamingContent('');
    }
  }, [messages, isLoading, effectiveSystemPrompt]);

  /**
   * Clear chat history
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamingContent('');
    setError(null);
  }, []);

  /**
   * Stop current generation
   */
  const stopGeneration = useCallback(() => {
    abortRef.current = true;
    setIsLoading(false);

    // If there's partial content, save it as a message
    if (streamingContent) {
      const partialMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: streamingContent + '\n\n[Generation stopped]',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, partialMessage]);
      setStreamingContent('');
    }
  }, [streamingContent]);

  return {
    messages,
    isLoading,
    error,
    streamingContent,
    isConfigured,
    sendMessage,
    clearMessages,
    stopGeneration
  };
}
