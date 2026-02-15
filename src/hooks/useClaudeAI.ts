import { useState, useCallback, useRef, useMemo } from 'react';
import { claudeService, type ChatMessage, buildSystemPrompt, type ProjectContext, type ToolResult } from '@/services/claude-ai';
import { useDatabaseService } from './database/useDatabaseService';
import { devLogger } from '@/utils/logging';

export interface ToolEvent {
  toolName: string;
  toolInput: Record<string, unknown>;
  result?: ToolResult;
  toolId?: string;
}

interface UseClaudeAIOptions {
  systemPrompt?: string;
  projectContext?: ProjectContext;
  includeArchitecture?: boolean;
  enableTools?: boolean;
}

export function useClaudeAI(options: UseClaudeAIOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const abortRef = useRef(false);

  const dbService = useDatabaseService();
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
    setToolEvents([]);

    // Prepare messages for API (exclude IDs and timestamps)
    const apiMessages = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content
    }));

    try {
      let fullResponse = '';

      const commonCallbacks = {
        onText: (text: string) => {
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
        onError: (err: Error) => {
          devLogger.error('Claude chat error', { component: 'useClaudeAI', error: err });
          setError(err.message);
          setIsLoading(false);
          setStreamingContent('');
        }
      };

      if (options.enableTools && dbService.db) {
        // Use tool-enabled endpoint
        await claudeService.sendMessageWithTools(
          apiMessages,
          {
            ...commonCallbacks,
            onToolUse: (event) => {
              setToolEvents(prev => [...prev, {
                toolName: event.toolName,
                toolInput: event.toolInput,
                toolId: event.toolId
              }]);
            },
            onToolResult: (toolId, result) => {
              setToolEvents(prev =>
                prev.map(e =>
                  e.toolId === toolId ? { ...e, result } : e
                )
              );
            }
          },
          effectiveSystemPrompt,
          dbService
        );
      } else {
        // Use standard streaming endpoint
        await claudeService.sendMessageStreaming(
          apiMessages,
          commonCallbacks,
          effectiveSystemPrompt
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setIsLoading(false);
      setStreamingContent('');
    }
  }, [messages, isLoading, effectiveSystemPrompt, options.enableTools, dbService]);

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
    toolEvents,
    sendMessage,
    clearMessages,
    stopGeneration
  };
}
