import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Maximize2, Minimize2, Send } from 'lucide-react';

interface ClaudePaneProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isPopout?: boolean;
}

export function ClaudePane({ isCollapsed, onToggleCollapse, isPopout }: ClaudePaneProps) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'ai' | 'code'>('ai');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: 'Hello! I\'m Claude. How can I help you today?' },
  ]);
  const [input, setInput] = useState('');

  const handleSendMessage = () => {
    if (!input.trim()) return;

    setMessages([...messages, { role: 'user', content: input }]);
    setInput('');

    // Simulate AI response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `I understand you said: "${input}". This is a mock response. In a real implementation, this would connect to Claude AI.`,
        },
      ]);
    }, 1000);
  };

  if (isCollapsed && !isPopout) {
    return null;
  }

  return (
    <div
      className={`flex flex-col border-r-2 ${
        theme === 'NeXTSTEP'
          ? 'border-[#505050] bg-[#c0c0c0]'
          : 'border-gray-200 bg-white'
      } ${isPopout ? 'w-full h-full' : 'w-1/3'}`}
    >
      {/* Header with tabs */}
      <div
        className={`flex flex-col ${
          theme === 'NeXTSTEP'
            ? 'bg-[#b0b0b0] border-b-2 border-[#505050]'
            : 'bg-gray-100 border-b border-gray-200'
        }`}
      >
        <div className="flex items-center justify-between h-10 px-3">
          <span
            className={`text-sm ${
              theme === 'NeXTSTEP' ? 'text-[#000000]' : 'text-gray-700'
            }`}
          >
            Claude
          </span>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className={`p-1 ${
                theme === 'NeXTSTEP'
                  ? 'hover:bg-[#a0a0a0]'
                  : 'hover:bg-gray-200 rounded'
              }`}
            >
              {isPopout ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-2 pb-2">
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-4 py-1.5 text-sm transition-colors ${
              theme === 'NeXTSTEP'
                ? activeTab === 'ai'
                  ? 'bg-[#ffffff] border-t-2 border-l-2 border-[#e8e8e8] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050] text-[#000000]'
                  : 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] text-[#000000] hover:bg-[#d8d8d8]'
                : activeTab === 'ai'
                ? 'bg-white border-b-2 border-blue-500 text-gray-900'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-t'
            }`}
          >
            Claude AI
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`px-4 py-1.5 text-sm transition-colors ${
              theme === 'NeXTSTEP'
                ? activeTab === 'code'
                  ? 'bg-[#ffffff] border-t-2 border-l-2 border-[#e8e8e8] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050] text-[#000000]'
                  : 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] text-[#000000] hover:bg-[#d8d8d8]'
                : activeTab === 'code'
                ? 'bg-white border-b-2 border-blue-500 text-gray-900'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-t'
            }`}
          >
            Claude Code
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'ai' ? (
          <>
            {/* Messages */}
            <div
              className={`flex-1 overflow-auto p-3 space-y-3 ${
                theme === 'NeXTSTEP'
                  ? 'bg-[#ffffff]'
                  : 'bg-white'
              }`}
            >
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                      theme === 'NeXTSTEP'
                        ? message.role === 'user'
                          ? 'bg-[#0000ff] text-[#ffffff]'
                          : 'bg-[#e8e8e8] text-[#000000]'
                        : message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-900'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div
              className={`border-t-2 p-3 ${
                theme === 'NeXTSTEP'
                  ? 'border-[#505050] bg-[#c0c0c0]'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask Claude..."
                  className={`flex-1 px-3 py-2 text-sm focus:outline-none ${
                    theme === 'NeXTSTEP'
                      ? 'bg-[#ffffff] border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8] text-[#000000] placeholder:text-[#808080]'
                      : 'bg-white border border-gray-300 rounded text-gray-900 placeholder:text-gray-400'
                  }`}
                />
                <button
                  onClick={handleSendMessage}
                  className={`px-3 py-2 ${
                    theme === 'NeXTSTEP'
                      ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] hover:bg-[#d8d8d8]'
                      : 'bg-blue-500 hover:bg-blue-600 text-white rounded'
                  }`}
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Code interface */}
            <div
              className={`flex-1 overflow-auto p-3 ${
                theme === 'NeXTSTEP'
                  ? 'bg-[#000000] text-[#00ff00]'
                  : 'bg-gray-900 text-green-400'
              }`}
            >
              <div className="font-mono text-sm space-y-2">
                <div>$ claude-code</div>
                <div className={theme === 'NeXTSTEP' ? 'text-[#ffffff]' : 'text-white'}>
                  Claude Code Interface
                </div>
                <div className={theme === 'NeXTSTEP' ? 'text-[#ffffff]' : 'text-white'}>
                  This would connect to Claude for code generation and analysis.
                </div>
                <div className="mt-4">
                  <span className={theme === 'NeXTSTEP' ? 'text-[#00ff00]' : 'text-green-400'}>
                    {'>'} _
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
