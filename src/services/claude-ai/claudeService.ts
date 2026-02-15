import Anthropic from '@anthropic-ai/sdk';
import { devLogger } from '@/utils/logging';
import { tools, executeTool, type ToolResult } from './tools';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ToolUseEvent {
  type: 'tool_use';
  toolName: string;
  toolInput: Record<string, unknown>;
  toolId: string;
}

/**
 * Database query interface - matches useDatabaseService return
 */
interface QueryExecutor {
  query: (sql: string, params?: unknown[]) => Record<string, unknown>[];
}

export interface StreamCallbacks {
  onText: (text: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
  onToolUse?: (event: ToolUseEvent) => void;
  onToolResult?: (toolId: string, result: ToolResult) => void;
}

/**
 * Claude AI Service - handles Anthropic API communication
 *
 * Note: API key should be set via ANTHROPIC_API_KEY environment variable
 * or passed explicitly. For browser usage, requests should proxy through
 * a backend to protect the API key.
 */
class ClaudeService {
  private client: Anthropic | null = null;
  private model = 'claude-sonnet-4-20250514';

  constructor() {
    // Initialize client lazily when API key is available
  }

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not configured. Set VITE_ANTHROPIC_API_KEY in .env');
      }
      this.client = new Anthropic({
        apiKey,
        dangerouslyAllowBrowser: true // Enable browser usage (dev only)
      });
    }
    return this.client;
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!import.meta.env.VITE_ANTHROPIC_API_KEY;
  }

  /**
   * Send a message and stream the response
   */
  async sendMessageStreaming(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    callbacks: StreamCallbacks,
    systemPrompt?: string
  ): Promise<void> {
    try {
      const client = this.getClient();

      const stream = await client.messages.stream({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt || 'You are a helpful AI assistant integrated into Isometry, a knowledge management application.',
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        }))
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          callbacks.onText(event.delta.text);
        }
      }

      callbacks.onComplete();
    } catch (error) {
      devLogger.error('Claude API error', { component: 'ClaudeService', error });
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Send a message and wait for complete response
   */
  async sendMessage(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt?: string
  ): Promise<string> {
    const client = this.getClient();

    const response = await client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt || 'You are a helpful AI assistant integrated into Isometry, a knowledge management application.',
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    });

    const textContent = response.content.find(c => c.type === 'text');
    return textContent?.text || '';
  }

  /**
   * Send a message with tool support
   * Handles tool use requests and executes them against the database
   */
  async sendMessageWithTools(
    messages: Array<{ role: 'user' | 'assistant'; content: string | Anthropic.Messages.ContentBlockParam[] }>,
    callbacks: StreamCallbacks,
    systemPrompt?: string,
    db?: QueryExecutor
  ): Promise<void> {
    try {
      const client = this.getClient();

      // Initial request with tools
      let response = await client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt || 'You are a helpful AI assistant integrated into Isometry.',
        tools: tools as Anthropic.Messages.Tool[],
        messages: messages.map(m => ({
          role: m.role,
          content: m.content as string
        }))
      });

      // Process response, handling tool use loop
      while (response.stop_reason === 'tool_use') {
        // Find tool use blocks
        const toolUseBlocks = response.content.filter(
          block => block.type === 'tool_use'
        );

        // Execute tools and collect results
        const toolResults: Array<{
          type: 'tool_result';
          tool_use_id: string;
          content: string;
        }> = [];

        for (const block of toolUseBlocks) {
          if (block.type === 'tool_use') {
            const toolUseBlock = block as Anthropic.Messages.ToolUseBlock;

            callbacks.onToolUse?.({
              type: 'tool_use',
              toolName: toolUseBlock.name,
              toolInput: toolUseBlock.input as Record<string, unknown>,
              toolId: toolUseBlock.id
            });

            // Execute tool if db is available
            let result: ToolResult;
            if (db) {
              result = await executeTool(
                toolUseBlock.name,
                toolUseBlock.input as Record<string, unknown>,
                db
              );
            } else {
              result = {
                success: false,
                error: 'Database not available for tool execution'
              };
            }

            callbacks.onToolResult?.(toolUseBlock.id, result);

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUseBlock.id,
              content: JSON.stringify(result)
            });
          }
        }

        // Extract any text content from the response
        for (const block of response.content) {
          if (block.type === 'text') {
            callbacks.onText(block.text);
          }
        }

        // Continue conversation with tool results
        const newMessages: Anthropic.Messages.MessageParam[] = [
          ...messages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content as string
          })),
          { role: 'assistant' as const, content: response.content },
          { role: 'user' as const, content: toolResults }
        ];

        response = await client.messages.create({
          model: this.model,
          max_tokens: 4096,
          system: systemPrompt || 'You are a helpful AI assistant integrated into Isometry.',
          tools: tools as Anthropic.Messages.Tool[],
          messages: newMessages
        });
      }

      // Final text response
      for (const block of response.content) {
        if (block.type === 'text') {
          callbacks.onText(block.text);
        }
      }

      callbacks.onComplete();
    } catch (error) {
      devLogger.error('Claude API error with tools', { component: 'ClaudeService', error });
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

export const claudeService = new ClaudeService();
