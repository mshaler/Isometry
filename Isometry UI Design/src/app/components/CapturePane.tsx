import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Maximize2, Minimize2 } from 'lucide-react';

interface CapturePaneProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isPopout?: boolean;
}

export function CapturePane({ isCollapsed, onToggleCollapse, isPopout }: CapturePaneProps) {
  const { theme } = useTheme();
  const [content, setContent] = useState('# Capture\n\nStart writing...\n\n- Use `/` for commands\n- Supports Markdown');
  const [showPreview, setShowPreview] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const slashCommands = [
    { label: 'Heading 1', value: '# ' },
    { label: 'Heading 2', value: '## ' },
    { label: 'Heading 3', value: '### ' },
    { label: 'Bold', value: '**text**' },
    { label: 'Italic', value: '*text*' },
    { label: 'Code Block', value: '```\ncode\n```' },
    { label: 'Bullet List', value: '- ' },
    { label: 'Numbered List', value: '1. ' },
    { label: 'Quote', value: '> ' },
    { label: 'Link', value: '[text](url)' },
  ];

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '/' && textareaRef.current) {
        const cursorPosition = textareaRef.current.selectionStart;
        const rect = textareaRef.current.getBoundingClientRect();
        setSlashMenuPosition({
          top: rect.top + 20,
          left: rect.left + 20,
        });
        setShowSlashMenu(true);
      }
      if (e.key === 'Escape') {
        setShowSlashMenu(false);
      }
    };

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener('keydown', handleKeyPress as any);
      return () => textarea.removeEventListener('keydown', handleKeyPress as any);
    }
  }, []);

  const handleSlashCommand = (command: typeof slashCommands[0]) => {
    if (textareaRef.current) {
      const cursorPosition = textareaRef.current.selectionStart;
      const beforeCursor = content.substring(0, cursorPosition - 1); // Remove the /
      const afterCursor = content.substring(cursorPosition);
      setContent(beforeCursor + command.value + afterCursor);
      setShowSlashMenu(false);
      textareaRef.current.focus();
    }
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
      {/* Header */}
      <div
        className={`flex items-center justify-between h-10 px-3 ${
          theme === 'NeXTSTEP'
            ? 'bg-[#b0b0b0] border-b-2 border-[#505050]'
            : 'bg-gray-100 border-b border-gray-200'
        }`}
      >
        <span
          className={`text-sm ${
            theme === 'NeXTSTEP' ? 'text-[#000000]' : 'text-gray-700'
          }`}
        >
          Capture
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`px-2 py-1 text-xs ${
              theme === 'NeXTSTEP'
                ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] hover:bg-[#d8d8d8]'
                : 'bg-gray-200 hover:bg-gray-300 rounded'
            }`}
          >
            {showPreview ? 'Edit' : 'Preview'}
          </button>
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {!showPreview ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={`w-full h-full p-3 resize-none focus:outline-none font-mono text-sm ${
              theme === 'NeXTSTEP'
                ? 'bg-[#ffffff] text-[#000000]'
                : 'bg-white text-gray-900'
            }`}
            placeholder="Start typing... Use / for commands"
          />
        ) : (
          <div
            className={`w-full h-full p-3 overflow-auto prose prose-sm max-w-none ${
              theme === 'NeXTSTEP'
                ? 'bg-[#ffffff] text-[#000000]'
                : 'bg-white text-gray-900'
            }`}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        )}

        {/* Slash command menu */}
        {showSlashMenu && (
          <div
            className={`absolute z-50 w-64 max-h-64 overflow-auto shadow-lg ${
              theme === 'NeXTSTEP'
                ? 'bg-[#ffffff] border-2 border-[#000000]'
                : 'bg-white border border-gray-200 rounded-lg'
            }`}
            style={{
              top: '50px',
              left: '20px',
            }}
          >
            {slashCommands.map((command, index) => (
              <div
                key={index}
                onClick={() => handleSlashCommand(command)}
                className={`px-3 py-2 cursor-pointer ${
                  theme === 'NeXTSTEP'
                    ? 'hover:bg-[#0000ff] hover:text-[#ffffff]'
                    : 'hover:bg-blue-50'
                }`}
              >
                <div className="text-sm">{command.label}</div>
                <div
                  className={`text-xs ${
                    theme === 'NeXTSTEP' ? 'opacity-70' : 'text-gray-500'
                  }`}
                >
                  {command.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
