import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronUp, ChevronDown, Maximize2, X } from 'lucide-react';

interface CollapsiblePaneContainerProps {
  children: React.ReactNode;
}

export function CollapsiblePaneContainer({ children }: CollapsiblePaneContainerProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { theme } = useTheme();

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div
      className={`flex flex-col border-t-2 transition-all duration-300 ${
        theme === 'NeXTSTEP'
          ? 'border-[#505050] bg-[#c0c0c0]'
          : 'border-gray-200 bg-white'
      } ${isCollapsed ? 'h-10' : 'h-96'}`}
    >
      {/* Header with collapse button */}
      <div
        className={`flex items-center justify-between h-10 px-3 cursor-pointer ${
          theme === 'NeXTSTEP'
            ? 'bg-[#b0b0b0] border-b-2 border-[#505050]'
            : 'bg-gray-100 border-b border-gray-200'
        }`}
        onClick={toggleCollapse}
      >
        <span
          className={`text-sm ${
            theme === 'NeXTSTEP' ? 'text-[#000000]' : 'text-gray-700'
          }`}
        >
          Workspace
        </span>
        <button
          className={`p-1 ${
            theme === 'NeXTSTEP'
              ? 'hover:bg-[#a0a0a0]'
              : 'hover:bg-gray-200 rounded'
          }`}
        >
          {isCollapsed ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </button>
      </div>

      {/* Content area */}
      {!isCollapsed && (
        <div className="flex-1 flex overflow-hidden">{children}</div>
      )}
    </div>
  );
}
