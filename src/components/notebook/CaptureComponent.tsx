import { useState } from 'react';
import { Edit3, Minimize2, Maximize2, ChevronDown, ChevronRight } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface CaptureComponentProps {
  className?: string;
}

export function CaptureComponent({ className }: CaptureComponentProps) {
  const { theme } = useTheme();
  const [isMinimized, setIsMinimized] = useState(false);
  const [propertiesExpanded, setPropertiesExpanded] = useState(false);

  if (isMinimized) {
    return (
      <div className={`${className} ${theme === 'NeXTSTEP' ? 'bg-[#c0c0c0] border-[#707070]' : 'bg-white border-gray-300'} border rounded-lg`}>
        <div className={`flex items-center justify-between p-2 ${theme === 'NeXTSTEP' ? 'bg-[#d4d4d4]' : 'bg-gray-100'} rounded-t-lg border-b`}>
          <div className="flex items-center gap-2">
            <Edit3 size={16} className="text-gray-600" />
            <span className="font-medium text-sm">Capture</span>
          </div>
          <button
            onClick={() => setIsMinimized(false)}
            className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-200'} transition-colors`}
            title="Maximize"
          >
            <Maximize2 size={14} className="text-gray-600" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} ${theme === 'NeXTSTEP' ? 'bg-[#c0c0c0] border-[#707070]' : 'bg-white border-gray-300'} border rounded-lg flex flex-col min-w-[300px]`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-2 ${theme === 'NeXTSTEP' ? 'bg-[#d4d4d4]' : 'bg-gray-100'} rounded-t-lg border-b`}>
        <div className="flex items-center gap-2">
          <Edit3 size={16} className="text-gray-600" />
          <span className="font-medium text-sm">Capture</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-200'} transition-colors`}
            title="Minimize"
          >
            <Minimize2 size={14} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Editor Area */}
        <div className="flex-1 p-4">
          <div className={`h-full ${theme === 'NeXTSTEP' ? 'bg-white border-[#707070]' : 'bg-gray-50 border-gray-200'} border rounded font-mono text-sm p-3`}>
            <div className="text-gray-500 mb-2"># Untitled Note</div>
            <div className="text-gray-400">
              Start typing your markdown content here...
              <br /><br />
              Use **bold**, *italic*, and other markdown syntax.
              <br /><br />
              Slash commands coming soon!
            </div>
          </div>
        </div>

        {/* Properties Panel */}
        <div className={`border-t ${theme === 'NeXTSTEP' ? 'border-[#707070] bg-[#d4d4d4]' : 'border-gray-200 bg-gray-50'}`}>
          <button
            onClick={() => setPropertiesExpanded(!propertiesExpanded)}
            className={`w-full flex items-center justify-between p-2 hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-100'} transition-colors`}
          >
            <span className="text-sm font-medium">Properties</span>
            {propertiesExpanded ? (
              <ChevronDown size={14} className="text-gray-600" />
            ) : (
              <ChevronRight size={14} className="text-gray-600" />
            )}
          </button>

          {propertiesExpanded && (
            <div className="p-3 space-y-2">
              <div>
                <label className="text-xs text-gray-600 block mb-1">Tags</label>
                <input
                  type="text"
                  placeholder="Add tags..."
                  className={`w-full text-xs p-1 border rounded ${theme === 'NeXTSTEP' ? 'border-[#707070] bg-white' : 'border-gray-300 bg-white'}`}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 block mb-1">Status</label>
                <select className={`w-full text-xs p-1 border rounded ${theme === 'NeXTSTEP' ? 'border-[#707070] bg-white' : 'border-gray-300 bg-white'}`}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}