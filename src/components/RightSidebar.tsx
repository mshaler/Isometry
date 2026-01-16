import { useState } from 'react';
import { ChevronDown, ChevronRight, Palette, Settings as SettingsIcon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

type TabType = 'formats' | 'settings';

export function RightSidebar() {
  const [activeTab, setActiveTab] = useState<TabType>('formats');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['View', 'Cell', 'Text']));
  const { theme } = useTheme();

  const formatSections = ['View', 'Cell', 'Text', 'Arrange', 'Conditional Formatting…'];
  const settingsSections = ['General', 'ETL Datasets', 'Toolbars', 'Formats', 'Views', 'Security'];

  const toggleSection = (title: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(title)) newExpanded.delete(title);
    else newExpanded.add(title);
    setExpandedSections(newExpanded);
  };

  const inputClass = theme === 'NeXTSTEP'
    ? 'w-full h-7 px-2 bg-white border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8] text-sm'
    : 'w-full h-7 px-2 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className={`w-64 h-full flex flex-col ${
      theme === 'NeXTSTEP'
        ? 'bg-[#c0c0c0] border-l-2 border-[#e8e8e8]'
        : 'bg-white/80 backdrop-blur-xl border-l border-gray-200'
    }`}>
      {/* Tabs */}
      <div className={theme === 'NeXTSTEP' ? 'flex border-b-2 border-[#808080]' : 'flex border-b border-gray-200'}>
        <button
          onClick={() => setActiveTab('formats')}
          className={`flex-1 h-9 flex items-center justify-center gap-2 ${
            theme === 'NeXTSTEP'
              ? activeTab === 'formats' ? 'bg-[#d4d4d4]' : 'bg-[#b0b0b0]'
              : activeTab === 'formats' ? 'bg-white text-blue-500 border-b-2 border-blue-500' : 'bg-gray-50 text-gray-600'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span className="text-sm">Formats</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 h-9 flex items-center justify-center gap-2 ${
            theme === 'NeXTSTEP'
              ? activeTab === 'settings' ? 'bg-[#d4d4d4]' : 'bg-[#b0b0b0]'
              : activeTab === 'settings' ? 'bg-white text-blue-500 border-b-2 border-blue-500' : 'bg-gray-50 text-gray-600'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span className="text-sm">Settings</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {(activeTab === 'formats' ? formatSections : settingsSections).map((section) => (
          <div key={section} className="mb-2">
            <button
              onClick={() => toggleSection(section)}
              className={`w-full h-8 px-2 flex items-center gap-2 ${
                theme === 'NeXTSTEP'
                  ? 'bg-[#a8a8a8] border-t-2 border-l-2 border-[#c8c8c8] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050]'
                  : 'bg-gray-100 hover:bg-gray-200 rounded-lg'
              }`}
            >
              {expandedSections.has(section) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span className="font-medium text-sm">{section}</span>
            </button>
            {expandedSections.has(section) && (
              <div className={`mt-2 px-2 py-3 ${
                theme === 'NeXTSTEP' ? 'bg-[#d4d4d4] border border-[#a0a0a0]' : 'bg-white border border-gray-200 rounded-lg'
              }`}>
                {activeTab === 'formats' && section === 'Text' && (
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs block mb-1">Font Family</label>
                      <select className={inputClass}>
                        <option>Helvetica</option>
                        <option>Times</option>
                        <option>Courier</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs block mb-1">Size</label>
                        <input type="number" defaultValue="12" className={inputClass} />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs block mb-1">Color</label>
                        <input type="color" defaultValue="#000000" className={inputClass} />
                      </div>
                    </div>
                  </div>
                )}
                {(activeTab === 'settings' || (activeTab === 'formats' && section !== 'Text')) && (
                  <p className="text-xs text-center text-gray-500">Coming soon...</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
