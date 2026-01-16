import { useTheme } from '@/contexts/ThemeContext';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

export function Card() {
  const { theme } = useTheme();
  const [isTableExpanded, setIsTableExpanded] = useState(true);
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className={`w-[400px] relative ${
      theme === 'NeXTSTEP'
        ? 'bg-white border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)]'
        : 'bg-white border-2 border-gray-900 rounded-lg shadow-2xl'
    }`}>
      {/* Close Button */}
      <button
        onClick={() => setIsVisible(false)}
        className={`absolute -top-3 -left-3 w-8 h-8 flex items-center justify-center ${
          theme === 'NeXTSTEP'
            ? 'bg-black text-white hover:bg-gray-800 border-2 border-white'
            : 'bg-red-500 text-white hover:bg-red-600 rounded-full shadow-lg'
        }`}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Header Section */}
      <div className={`border-b-4 border-black p-4 ${
        theme === 'Modern' ? 'rounded-t-md' : ''
      }`}>
        <h1 className="text-2xl font-black uppercase tracking-tight mb-1">
          Card Title
        </h1>
        <p className="text-sm text-gray-600">
          Subtitle or description goes here
        </p>
      </div>

      {/* Properties Table */}
      <div className="border-b-4 border-black">
        {/* Table Header with Collapse Button */}
        <button
          onClick={() => setIsTableExpanded(!isTableExpanded)}
          className="w-full flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border-b-2 border-black"
        >
          {isTableExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          <span className="font-bold text-xs uppercase tracking-wide">
            Properties
          </span>
        </button>

        {/* Table Content */}
        {isTableExpanded && (
          <div className="border-collapse">
            {[
              { label: 'Property 1', value: 'Value 1' },
              { label: 'Property 2', value: 'Value 2' },
              { label: 'Property 3', value: 'Value 3' },
              { label: 'Property 4', value: 'Value 4' },
              { label: 'Property 5', value: 'Value 5' },
            ].map((prop, index) => (
              <div
                key={index}
                className={`flex border-b-2 border-black ${
                  index === 4 ? 'border-b-0' : ''
                }`}
              >
                <div className="flex-1 px-4 py-2 border-r-2 border-black bg-gray-50">
                  <span className="font-bold text-sm uppercase tracking-wide">
                    {prop.label}
                  </span>
                </div>
                <div className="flex-1 px-4 py-2 bg-white">
                  <span className="text-sm font-medium">
                    {prop.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Freeform Text Section */}
      <div className="p-4 min-h-[300px]">
        <div className="text-xs font-bold uppercase tracking-wide mb-2 border-b-2 border-black pb-1">
          Notes
        </div>
        <textarea
          className={`w-full h-[260px] p-2 text-sm resize-none focus:outline-none ${
            theme === 'NeXTSTEP'
              ? 'bg-white border-2 border-gray-300'
              : 'bg-gray-50 border border-gray-300 rounded'
          }`}
          placeholder="Enter notes here..."
        />
      </div>

      {/* Footer with metadata */}
      <div className={`border-t-4 border-black px-4 py-2 bg-gray-50 text-xs text-gray-500 ${
        theme === 'Modern' ? 'rounded-b-md' : ''
      }`}>
        <div className="flex justify-between">
          <span>Created: Jan 16, 2026</span>
          <span>ID: #001</span>
        </div>
      </div>
    </div>
  );
}