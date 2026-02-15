import Anthropic from '@anthropic-ai/sdk';
import { devLogger } from '@/utils/logging';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface StreamCallbacks {
  onText: (text: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
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
}

export const claudeService = new ClaudeService();
