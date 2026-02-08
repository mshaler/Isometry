import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Maximize2, Minimize2, RefreshCw } from 'lucide-react';

interface PreviewPaneProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isPopout?: boolean;
}

export function PreviewPane({ isCollapsed, onToggleCollapse, isPopout }: PreviewPaneProps) {
  const { theme } = useTheme();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (isCollapsed && !isPopout) {
    return null;
  }

  return (
    <div
      className={`flex flex-col ${
        theme === 'NeXTSTEP'
          ? 'bg-[#c0c0c0]'
          : 'bg-white'
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
          Preview
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            className={`p-1 ${
              theme === 'NeXTSTEP'
                ? 'hover:bg-[#a0a0a0]'
                : 'hover:bg-gray-200 rounded'
            }`}
            title="Refresh preview"
          >
            <RefreshCw className="size-4" />
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

      {/* Preview content */}
      <div
        key={refreshKey}
        className={`flex-1 overflow-auto p-4 ${
          theme === 'NeXTSTEP'
            ? 'bg-[#ffffff]'
            : 'bg-white'
        }`}
      >
        <div className="space-y-4">
          {/* Preview placeholder */}
          <div
            className={`p-4 rounded ${
              theme === 'NeXTSTEP'
                ? 'bg-[#e8e8e8] border-2 border-[#b0b0b0]'
                : 'bg-gray-50 border border-gray-200'
            }`}
          >
            <h3
              className={`mb-2 ${
                theme === 'NeXTSTEP' ? 'text-[#000000]' : 'text-gray-900'
              }`}
            >
              Live Preview
            </h3>
            <p
              className={`text-sm ${
                theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600'
              }`}
            >
              This preview window would display live updates of your content, code output, or rendered views.
            </p>
          </div>

          {/* Example rendered content */}
          <div
            className={`p-4 rounded ${
              theme === 'NeXTSTEP'
                ? 'border-2 border-[#b0b0b0]'
                : 'border border-gray-200'
            }`}
          >
            <h4
              className={`mb-3 ${
                theme === 'NeXTSTEP' ? 'text-[#000000]' : 'text-gray-900'
              }`}
            >
              Example Output
            </h4>

            <div className="space-y-3">
              <div
                className={`flex items-center gap-2 p-2 rounded ${
                  theme === 'NeXTSTEP'
                    ? 'bg-[#d4d4d4]'
                    : 'bg-blue-50'
                }`}
              >
                <div
                  className={`size-3 rounded-full ${
                    theme === 'NeXTSTEP' ? 'bg-[#00ff00]' : 'bg-green-500'
                  }`}
                />
                <span
                  className={`text-sm ${
                    theme === 'NeXTSTEP' ? 'text-[#000000]' : 'text-gray-700'
                  }`}
                >
                  Component rendered successfully
                </span>
              </div>

              <div
                className={`p-3 font-mono text-xs rounded ${
                  theme === 'NeXTSTEP'
                    ? 'bg-[#000000] text-[#00ff00]'
                    : 'bg-gray-900 text-green-400'
                }`}
              >
                <div>{'{'}</div>
                <div className="pl-4">"status": "ready",</div>
                <div className="pl-4">"message": "Preview active"</div>
                <div>{'}'}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`aspect-video rounded flex items-center justify-center ${
                      theme === 'NeXTSTEP'
                        ? 'bg-[#e8e8e8] text-[#808080]'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    <span className="text-xs">Item {i}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Info section */}
          <div
            className={`p-3 rounded text-xs ${
              theme === 'NeXTSTEP'
                ? 'bg-[#ffffcc] border-2 border-[#cccc66]'
                : 'bg-yellow-50 border border-yellow-200'
            }`}
          >
            <div
              className={`${
                theme === 'NeXTSTEP' ? 'text-[#000000]' : 'text-gray-900'
              }`}
            >
              <strong>Note:</strong> The preview updates in real-time as you make changes.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
