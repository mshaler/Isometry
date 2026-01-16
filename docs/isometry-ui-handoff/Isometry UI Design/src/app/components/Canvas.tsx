import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Card } from './Card';

export function Canvas() {
  const [activeTab, setActiveTab] = useState(0);
  const tabs = ['Tab 1', 'Tab 2', 'Tab 3'];
  const { theme } = useTheme();

  return (
    <div className={`flex-1 flex flex-col m-3 overflow-hidden ${
      theme === 'NeXTSTEP'
        ? 'bg-[#ffffff] border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)]'
        : 'bg-white rounded-lg shadow-lg border border-gray-200'
    }`}>
      {/* Main Canvas Area */}
      <div className="flex-1 flex items-center justify-center overflow-auto p-8">
        <Card />
      </div>

      {/* Sheet Tabs - Excel-style */}
      <div className={theme === 'NeXTSTEP'
        ? 'bg-[#c0c0c0] border-t-2 border-[#808080] flex items-end gap-0.5 px-2 pb-1 pt-2'
        : 'bg-gray-50 border-t border-gray-200 flex items-end gap-1 px-2 pb-1 pt-2'
      }>
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            className={theme === 'NeXTSTEP'
              ? `px-4 py-1.5 text-sm relative ${
                  activeTab === index
                    ? 'bg-[#ffffff] text-black border-t-2 border-l-2 border-r-2 border-[#808080] border-t-[#d8d8d8] border-l-[#d8d8d8] shadow-[inset_1px_1px_1px_rgba(255,255,255,0.8)]'
                    : 'bg-[#b0b0b0] text-[#404040] border-t-2 border-l-2 border-r-2 border-[#707070] border-t-[#c8c8c8] border-l-[#c8c8c8] hover:bg-[#b8b8b8]'
                }`
              : `px-4 py-1.5 text-sm rounded-t-lg transition-colors ${
                  activeTab === index
                    ? 'bg-white text-gray-900 border-t border-l border-r border-gray-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`
            }
            style={theme === 'NeXTSTEP' ? {
              borderTopLeftRadius: '4px',
              borderTopRightRadius: '4px',
            } : undefined}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}