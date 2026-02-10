import { forwardRef, useEffect, useImperativeHandle, useState, useCallback } from 'react';
import { FileText, Clock } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import type { CardSuggestion } from '@/utils/editor/backlinks';

export interface WikiLinkMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface WikiLinkMenuProps {
  items: CardSuggestion[];
  command: (item: CardSuggestion) => void;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export const WikiLinkMenu = forwardRef<WikiLinkMenuRef, WikiLinkMenuProps>(
  ({ items, command }, ref) => {
    const { theme } = useTheme();
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = useCallback((index: number) => {
      const item = items[index];
      if (item) {
        command(item);
      }
    }, [items, command]);

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
        <div className={`z-50 ${
          theme === 'NeXTSTEP'
            ? 'bg-[#c0c0c0] border-[#707070] shadow-md'
            : 'bg-white border-gray-300 shadow-lg'
        } border rounded-lg min-w-[280px] p-4 text-center text-gray-500 text-sm`}>
          <FileText size={24} className="mx-auto mb-2 text-gray-400" />
          <div className="mb-1">No cards found</div>
          <div className="text-xs">Type to search for cards</div>
        </div>
      );
    }

    return (
      <div className={`z-50 ${
        theme === 'NeXTSTEP'
          ? 'bg-[#c0c0c0] border-[#707070] shadow-md'
          : 'bg-white border-gray-300 shadow-lg'
      } border rounded-lg min-w-[280px] max-h-[250px] overflow-y-auto`}>
        <div className={`p-2 text-xs text-gray-500 border-b ${
          theme === 'NeXTSTEP' ? 'border-[#707070] bg-[#d4d4d4]' : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center gap-1">
            <span>Link to card...</span>
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
              <FileText
                size={14}
                className={index === selectedIndex ? 'text-white' : 'text-gray-500'}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{item.name}</div>
                <div className={`text-xs flex items-center gap-1 ${
                  index === selectedIndex ? 'text-white/70' : 'text-gray-400'
                }`}>
                  <Clock size={10} />
                  <span>{formatRelativeTime(item.modifiedAt)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className={`p-2 text-xs text-gray-500 border-t ${
          theme === 'NeXTSTEP' ? 'border-[#707070] bg-[#d4d4d4]' : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex justify-between">
            <span>Arrow keys: Navigate</span>
            <span>Enter: Link | Esc: Cancel</span>
          </div>
        </div>
      </div>
    );
  }
);

WikiLinkMenu.displayName = 'WikiLinkMenu';
