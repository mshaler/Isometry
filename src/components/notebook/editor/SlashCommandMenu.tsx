import { forwardRef, useEffect, useImperativeHandle, useState, useCallback } from 'react';
import { Hash, Edit3, Code } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import type { SlashCommand } from './extensions';

export interface SlashCommandMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SlashCommandMenuProps {
  items: SlashCommand[];
  command: (item: SlashCommand) => void;
}

function getCommandIcon(category: SlashCommand['category']) {
  switch (category) {
    case 'isometry':
      return <Hash size={14} className="text-blue-500" />;
    case 'template':
      return <Edit3 size={14} className="text-green-500" />;
    case 'format':
      return <Code size={14} className="text-purple-500" />;
    default:
      return null;
  }
}

export const SlashCommandMenu = forwardRef<SlashCommandMenuRef, SlashCommandMenuProps>(
  ({ items, command }, ref) => {
    const { theme } = useTheme();
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selection when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = useCallback((index: number) => {
      const item = items[index];
      if (item) {
        command(item);
      }
    }, [items, command]);

    // Keyboard navigation
    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
          return true;
        }

        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev >= items.length - 1 ? 0 : prev + 1));
          return true;
        }

        if (event.key === 'Enter' || event.key === 'Tab') {
          selectItem(selectedIndex);
          return true;
        }

        return false;
      },
    }), [items.length, selectedIndex, selectItem]);

    if (items.length === 0) {
      return (
        <div
          className={`${
            theme === 'NeXTSTEP'
              ? 'bg-[#c0c0c0] border-[#707070] shadow-md'
              : 'bg-white border-gray-300 shadow-lg'
          } border rounded-lg min-w-[300px] p-4 text-center text-gray-500 text-sm`}
        >
          <div className="mb-1">No commands found</div>
          <div className="text-xs">Try typing "pafv", "latch", or "meeting"</div>
        </div>
      );
    }

    return (
      <div
        className={`${
          theme === 'NeXTSTEP'
            ? 'bg-[#c0c0c0] border-[#707070] shadow-md'
            : 'bg-white border-gray-300 shadow-lg'
        } border rounded-lg min-w-[300px] max-h-[300px] overflow-y-auto`}
      >
        <div className={`p-2 text-xs text-gray-500 border-b ${
          theme === 'NeXTSTEP' ? 'border-[#707070] bg-[#d4d4d4]' : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center gap-1">
            <span>Choose a command...</span>
          </div>
        </div>
        <div className="py-1">
          {items.map((item, index) => (
            <button
              key={item.id}
              onClick={() => selectItem(index)}
              className={`w-full text-left p-2 flex items-center gap-2 transition-colors ${
                index === selectedIndex
                  ? theme === 'NeXTSTEP' ? 'bg-[#0066cc] text-white' : 'bg-blue-500 text-white'
                  : theme === 'NeXTSTEP' ? 'hover:bg-[#b0b0b0]' : 'hover:bg-gray-100'
              }`}
            >
              <div className="flex-shrink-0">
                {getCommandIcon(item.category)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{item.label}</div>
                <div className={`text-xs ${
                  index === selectedIndex ? 'text-white/80' : 'text-gray-500'
                } truncate`}>
                  {item.description}
                </div>
              </div>
              {item.shortcut && (
                <div className={`text-xs px-1 rounded ${
                  index === selectedIndex
                    ? 'bg-white/20'
                    : theme === 'NeXTSTEP' ? 'bg-[#d4d4d4]' : 'bg-gray-200'
                }`}>
                  /{item.shortcut}
                </div>
              )}
            </button>
          ))}
        </div>
        <div className={`p-2 text-xs text-gray-500 border-t ${
          theme === 'NeXTSTEP' ? 'border-[#707070] bg-[#d4d4d4]' : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex justify-between">
            <span>Up/Down Navigate</span>
            <span>Enter Select / Escape Cancel</span>
          </div>
        </div>
      </div>
    );
  }
);

SlashCommandMenu.displayName = 'SlashCommandMenu';
