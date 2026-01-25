import { useState } from 'react';
import { Monitor, Minimize2, Maximize2, RotateCcw, Maximize, ArrowLeft, ArrowRight } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface PreviewComponentProps {
  className?: string;
}

export function PreviewComponent({ className }: PreviewComponentProps) {
  const { theme } = useTheme();
  const [isMinimized, setIsMinimized] = useState(false);
  const [previewType] = useState<'d3-visualization' | 'web-page' | 'document'>('d3-visualization');

  if (isMinimized) {
    return (
      <div className={`${className} ${theme === 'NeXTSTEP' ? 'bg-[#c0c0c0] border-[#707070]' : 'bg-white border-gray-300'} border rounded-lg`}>
        <div className={`flex items-center justify-between p-2 ${theme === 'NeXTSTEP' ? 'bg-[#d4d4d4]' : 'bg-gray-100'} rounded-t-lg border-b`}>
          <div className="flex items-center gap-2">
            <Monitor size={16} className="text-gray-600" />
            <span className="font-medium text-sm">Preview</span>
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
          <Monitor size={16} className="text-gray-600" />
          <span className="font-medium text-sm">Preview</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-200'} transition-colors`}
            title="Refresh"
          >
            <RotateCcw size={14} className="text-gray-600" />
          </button>
          <button
            className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-200'} transition-colors`}
            title="Fullscreen"
          >
            <Maximize size={14} className="text-gray-600" />
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-[#b0b0b0]' : 'bg-gray-200'} transition-colors`}
            title="Minimize"
          >
            <Minimize2 size={14} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Address Bar */}
      <div className={`flex items-center gap-2 p-2 border-b ${theme === 'NeXTSTEP' ? 'border-[#707070] bg-white' : 'border-gray-200 bg-gray-50'}`}>
        <button className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-gray-200' : 'bg-gray-200'} transition-colors`} title="Back">
          <ArrowLeft size={12} className="text-gray-600" />
        </button>
        <button className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-gray-200' : 'bg-gray-200'} transition-colors`} title="Forward">
          <ArrowRight size={12} className="text-gray-600" />
        </button>
        <div className={`flex-1 px-2 py-1 text-xs ${theme === 'NeXTSTEP' ? 'bg-white border border-[#707070]' : 'bg-white border border-gray-300'} rounded`}>
          <span className="text-gray-500">
            {previewType === 'd3-visualization' ? 'visualization://current-data' :
             previewType === 'web-page' ? 'https://example.com' :
             'document://notebook-export.pdf'}
          </span>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-4">
        {previewType === 'd3-visualization' ? (
          <div className={`h-full ${theme === 'NeXTSTEP' ? 'bg-white border-[#707070]' : 'bg-gray-50 border-gray-200'} border rounded flex items-center justify-center`}>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg opacity-70"></div>
              <div className="text-sm font-medium text-gray-700">D3 Visualization</div>
              <div className="text-xs text-gray-500 mt-1">
                Live preview of current data
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Charts, graphs, and interactive visualizations will appear here as you edit data in the capture component.
              </div>
            </div>
          </div>
        ) : previewType === 'web-page' ? (
          <div className={`h-full ${theme === 'NeXTSTEP' ? 'bg-white border-[#707070]' : 'bg-gray-50 border-gray-200'} border rounded flex items-center justify-center`}>
            <div className="text-center">
              <div className="text-sm font-medium text-gray-700 mb-2">Web Browser</div>
              <div className="text-xs text-gray-500">
                Web pages, documentation, and external content will be displayed here.
              </div>
            </div>
          </div>
        ) : (
          <div className={`h-full ${theme === 'NeXTSTEP' ? 'bg-white border-[#707070]' : 'bg-gray-50 border-gray-200'} border rounded flex items-center justify-center`}>
            <div className="text-center">
              <div className="text-sm font-medium text-gray-700 mb-2">Document Preview</div>
              <div className="text-xs text-gray-500">
                PDFs, exports, and documents will be displayed here.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className={`border-t px-3 py-1 ${theme === 'NeXTSTEP' ? 'border-[#707070] bg-[#d4d4d4]' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-center justify-between text-xs">
          <div className="text-gray-600">
            Preview: {previewType.replace('-', ' ').split(' ').map(word =>
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ')}
          </div>
          <div className="text-gray-500">
            Ready
          </div>
        </div>
      </div>
    </div>
  );
}