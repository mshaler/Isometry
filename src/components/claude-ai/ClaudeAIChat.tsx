import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { Send, Square, Trash2, AlertCircle, Bot, User } from 'lucide-react';
import { useClaudeAI } from '@/hooks';
import { cn } from '@/lib/utils';

interface ClaudeAIChatProps {
  className?: string;
  systemPrompt?: string;
}

/**
 * ClaudeAIChat - Chat interface for Claude AI assistant
 *
 * Features:
 * - Message input with Enter to send
 * - Streaming response display
 * - Message history with user/assistant distinction
 * - Stop generation button
 * - Clear chat button
 */
export function ClaudeAIChat({ className, systemPrompt }: ClaudeAIChatProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isLoading,
    error,
    streamingContent,
    isConfigured,
    sendMessage,
    clearMessages,
    stopGeneration
  } = useClaudeAI({ systemPrompt });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(() => {
    if (input.trim() && !isLoading) {
      sendMessage(input);
      setInput('');
    }
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Not configured state
  if (!isConfigured) {
    return (
      <div className={cn('flex flex-col h-full bg-gray-900', className)}>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <AlertCircle size={48} className="mx-auto mb-4 text-yellow-500" />
            <h3 className="text-lg font-medium text-gray-200 mb-2">API Key Required</h3>
            <p className="text-sm text-gray-400 mb-4">
              To use Claude AI, add your Anthropic API key to the environment:
            </p>
            <code className="block bg-gray-800 p-3 rounded text-xs text-green-400 font-mono">
              VITE_ANTHROPIC_API_KEY=sk-ant-...
            </code>
            <p className="text-xs text-gray-500 mt-4">
              Add this to your .env file and restart the dev server.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full bg-gray-900', className)}>
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !streamingContent && (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Bot size={48} className="mx-auto mb-3 text-gray-600" />
              <p className="text-sm">Start a conversation with Claude</p>
              <p className="text-xs mt-1 text-gray-600">
                Type a message below and press Enter
              </p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex gap-3',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-white" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[80%] rounded-lg px-4 py-2 text-sm',
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-200'
              )}
            >
              <pre className="whitespace-pre-wrap font-sans">{message.content}</pre>
            </div>
            {message.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                <User size={16} className="text-gray-300" />
              </div>
            )}
          </div>
        ))}

        {/* Streaming response */}
        {streamingContent && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0 animate-pulse">
              <Bot size={16} className="text-white" />
            </div>
            <div className="max-w-[80%] rounded-lg px-4 py-2 text-sm bg-gray-800 text-gray-200">
              <pre className="whitespace-pre-wrap font-sans">{streamingContent}</pre>
              <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-700 p-3">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={isLoading}
            rows={1}
            className={cn(
              'flex-1 resize-none bg-gray-800 border border-gray-700 rounded-lg px-3 py-2',
              'text-sm text-gray-200 placeholder-gray-500',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />

          <div className="flex flex-col gap-1">
            {isLoading ? (
              <button
                onClick={stopGeneration}
                className="p-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
                title="Stop generation"
              >
                <Square size={18} className="text-white" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  input.trim()
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                )}
                title="Send message"
              >
                <Send size={18} />
              </button>
            )}

            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                title="Clear chat"
              >
                <Trash2 size={18} className="text-gray-400" />
              </button>
            )}
          </div>
        </div>

        <div className="text-xs text-gray-500 mt-2 flex items-center justify-between">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <span>{messages.length} messages</span>
        </div>
      </div>
    </div>
  );
}
