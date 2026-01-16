import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export function NavigatorFooter() {
  const [activeTab, setActiveTab] = useState<'map' | 'slider'>('map');
  const [isExpanded, setIsExpanded] = useState(true);
  const { theme } = useTheme();

  // Boulder, Colorado coordinates
  const boulderLat = 40.0150;
  const boulderLon = -105.2705;
  const zoom = 13;
  
  // OpenStreetMap static map tile URL
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${boulderLon - 0.05},${boulderLat - 0.05},${boulderLon + 0.05},${boulderLat + 0.05}&layer=mapnik&marker=${boulderLat},${boulderLon}`;

  return (
    <div className={theme === 'NeXTSTEP'
      ? 'bg-[#b8b8b8] border-t-2 border-l-2 border-[#d8d8d8] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050] shadow-[inset_1px_1px_2px_rgba(255,255,255,0.6),inset_-1px_-1px_2px_rgba(0,0,0,0.2)]'
      : 'bg-white/80 backdrop-blur-xl border-t border-gray-200'
    }>
      {/* Tab Headers */}
      <div className={theme === 'NeXTSTEP' ? 'flex border-b-2 border-[#808080]' : 'flex border-b border-gray-200'}>
        {/* Collapse Toggle Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-8 h-8 flex items-center justify-center ${
            theme === 'NeXTSTEP'
              ? 'bg-[#d4d4d4] border-r border-[#808080] hover:bg-[#d8d8d8]'
              : 'bg-gray-100 border-r border-gray-200 hover:bg-gray-200 rounded-tl-lg'
          }`}
        >
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`px-4 h-8 text-sm ${
            theme === 'NeXTSTEP'
              ? `border-r border-[#808080] ${
                  activeTab === 'map'
                    ? 'bg-[#b8b8b8] text-black'
                    : 'bg-[#a0a0a0] text-[#404040] hover:bg-[#b0b0b0]'
                }`
              : `${
                  activeTab === 'map'
                    ? 'bg-white text-blue-500 border-b-2 border-blue-500'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`
          }`}
        >
          Location Map
        </button>
        <button
          onClick={() => setActiveTab('slider')}
          className={`px-4 h-8 text-sm ${
            theme === 'NeXTSTEP'
              ? activeTab === 'slider'
                ? 'bg-[#b8b8b8] text-black'
                : 'bg-[#a0a0a0] text-[#404040] hover:bg-[#b0b0b0]'
              : activeTab === 'slider'
                ? 'bg-white text-blue-500 border-b-2 border-blue-500'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          Time Slider
        </button>
      </div>

      {/* Tab Content */}
      {isExpanded && (
        <div className="p-4">
          {activeTab === 'map' && (
            <div className={`h-48 overflow-hidden ${
              theme === 'NeXTSTEP'
                ? 'border-t-2 border-l-2 border-[#606060] border-b-2 border-r-2 border-r-[#d0d0d0] border-b-[#d0d0d0] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3)]'
                : 'border border-gray-300 rounded-lg'
            }`}>
              <iframe
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                marginHeight={0}
                marginWidth={0}
                src={mapUrl}
                style={{ border: 0 }}
                title="Boulder, Colorado Map"
              />
            </div>
          )}
          {activeTab === 'slider' && (
            <div className={`h-48 p-4 flex flex-col justify-center gap-4 ${
              theme === 'NeXTSTEP'
                ? 'bg-[#a0a0a0] border-t-2 border-l-2 border-[#606060] border-b-2 border-r-2 border-r-[#d0d0d0] border-b-[#d0d0d0] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3)]'
                : 'bg-gray-50 border border-gray-300 rounded-lg'
            }`}>
              <div className={`text-sm text-center ${
                theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600'
              }`}>Time series data controls</div>
              <input
                type="range"
                className={`w-full ${
                  theme === 'Modern' ? 'accent-blue-500' : ''
                }`}
                min="0"
                max="100"
                defaultValue="50"
              />
              <div className={`flex justify-between text-xs ${
                theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600'
              }`}>
                <span>Start Date</span>
                <span>End Date</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}