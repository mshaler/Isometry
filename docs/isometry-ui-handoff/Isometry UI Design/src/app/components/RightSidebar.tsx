import { useState } from 'react';
import { ChevronDown, ChevronRight, Palette, Settings as SettingsIcon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

type TabType = 'formats' | 'settings';

interface FormatSection {
  title: string;
  content: (theme: 'NeXTSTEP' | 'Modern') => React.ReactNode;
}

export function RightSidebar() {
  const [activeTab, setActiveTab] = useState<TabType>('formats');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['View', 'Cell', 'Text', 'Arrange'])
  );
  const { theme } = useTheme();

  const toggleSection = (sectionTitle: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionTitle)) {
      newExpanded.delete(sectionTitle);
    } else {
      newExpanded.add(sectionTitle);
    }
    setExpandedSections(newExpanded);
  };

  const settingsSections = [
    'General',
    'ETL Datasets',
    'Toolbars',
    'Formats',
    'Edit',
    'Views',
    'Calculation',
    'Error Checking',
    'Autocomplete',
    'Security'
  ];

  const inputClass = (currentTheme: 'NeXTSTEP' | 'Modern') =>
    currentTheme === 'NeXTSTEP'
      ? 'w-full h-7 px-2 bg-[#ffffff] border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.2)] text-sm'
      : 'w-full h-7 px-2 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  const buttonClass = (currentTheme: 'NeXTSTEP' | 'Modern') =>
    currentTheme === 'NeXTSTEP'
      ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] hover:bg-[#d8d8d8] active:border-t-[#707070] active:border-l-[#707070] active:border-b-[#ffffff] active:border-r-[#ffffff]'
      : 'bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-md border border-gray-300';

  const formatSections: FormatSection[] = [
    {
      title: 'View',
      content: (currentTheme) => (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className={`w-4 h-4 ${currentTheme === 'Modern' ? 'rounded accent-blue-500' : ''}`} />
            Show Grid
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className={`w-4 h-4 ${currentTheme === 'Modern' ? 'rounded accent-blue-500' : ''}`} />
            Show Headers
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className={`w-4 h-4 ${currentTheme === 'Modern' ? 'rounded accent-blue-500' : ''}`} />
            Show Formulas
          </label>
        </div>
      )
    },
    {
      title: 'Cell',
      content: (currentTheme) => (
        <div className="space-y-2">
          <div>
            <label className={`text-xs block mb-1 ${currentTheme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600 font-medium'}`}>Data Format</label>
            <select className={inputClass(currentTheme)}>
              <option>Automatic</option>
              <option>Number</option>
              <option>Currency</option>
              <option>Percentage</option>
              <option>Date & Time</option>
              <option>Duration</option>
              <option>Text</option>
            </select>
          </div>
          <div>
            <label className={`text-xs block mb-1 ${currentTheme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600 font-medium'}`}>Background</label>
            <input
              type="color"
              defaultValue="#ffffff"
              className={currentTheme === 'NeXTSTEP'
                ? 'w-full h-7 bg-[#ffffff] border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8]'
                : 'w-full h-7 bg-white border border-gray-300 rounded-md'
              }
            />
          </div>
        </div>
      )
    },
    {
      title: 'Text',
      content: (currentTheme) => (
        <div className="space-y-2">
          <div>
            <label className={`text-xs block mb-1 ${currentTheme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600 font-medium'}`}>Font Family</label>
            <select className={inputClass(currentTheme)}>
              <option>Helvetica</option>
              <option>Times</option>
              <option>Courier</option>
              <option>Geneva</option>
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={`text-xs block mb-1 ${currentTheme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600 font-medium'}`}>Size</label>
              <input
                type="number"
                defaultValue="12"
                className={inputClass(currentTheme)}
              />
            </div>
            <div className="flex-1">
              <label className={`text-xs block mb-1 ${currentTheme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600 font-medium'}`}>Color</label>
              <input
                type="color"
                defaultValue="#000000"
                className={currentTheme === 'NeXTSTEP'
                  ? 'w-full h-7 bg-[#ffffff] border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8]'
                  : 'w-full h-7 bg-white border border-gray-300 rounded-md'
                }
              />
            </div>
          </div>
          <div className="flex gap-1">
            <button className={`flex-1 h-7 text-sm ${buttonClass(currentTheme)}`}>
              <strong>B</strong>
            </button>
            <button className={`flex-1 h-7 text-sm ${buttonClass(currentTheme)}`}>
              <em>I</em>
            </button>
            <button className={`flex-1 h-7 text-sm ${buttonClass(currentTheme)}`}>
              <u>U</u>
            </button>
          </div>
        </div>
      )
    },
    {
      title: 'Arrange',
      content: (currentTheme) => (
        <div className="space-y-2">
          <div>
            <label className={`text-xs block mb-1 ${currentTheme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600 font-medium'}`}>Alignment</label>
            <div className="flex gap-1">
              <button className={`flex-1 h-7 text-xs ${buttonClass(currentTheme)}`}>
                Left
              </button>
              <button className={`flex-1 h-7 text-xs ${buttonClass(currentTheme)}`}>
                Center
              </button>
              <button className={`flex-1 h-7 text-xs ${buttonClass(currentTheme)}`}>
                Right
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={`text-xs block mb-1 ${currentTheme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600 font-medium'}`}>Width</label>
              <input
                type="number"
                defaultValue="100"
                className={inputClass(currentTheme)}
              />
            </div>
            <div className="flex-1">
              <label className={`text-xs block mb-1 ${currentTheme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600 font-medium'}`}>Height</label>
              <input
                type="number"
                defaultValue="24"
                className={inputClass(currentTheme)}
              />
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Conditional Formatting…',
      content: (currentTheme) => (
        <div className="space-y-2">
          <button className={`w-full h-8 px-2 text-sm ${
            currentTheme === 'NeXTSTEP'
              ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] shadow-[2px_2px_3px_rgba(0,0,0,0.4)] hover:bg-[#d8d8d8] active:border-t-[#707070] active:border-l-[#707070] active:border-b-[#ffffff] active:border-r-[#ffffff] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]'
              : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-md'
          }`}>
            Add Rule
          </button>
          <p className={`text-xs text-center ${currentTheme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-500'}`}>No rules defined</p>
        </div>
      )
    }
  ];

  return (
    <div className={`w-64 h-full flex flex-col ${
      theme === 'NeXTSTEP'
        ? 'bg-[#c0c0c0] border-t-2 border-l-2 border-[#e8e8e8] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050] shadow-[inset_2px_2px_3px_rgba(255,255,255,0.7),inset_-2px_-2px_3px_rgba(0,0,0,0.3)]'
        : 'bg-white/80 backdrop-blur-xl border-l border-gray-200'
    }`}>
      {/* Tabs */}
      <div className={theme === 'NeXTSTEP' ? 'flex border-b-2 border-[#808080]' : 'flex border-b border-gray-200'}>
        <button
          onClick={() => setActiveTab('formats')}
          className={`flex-1 h-9 flex items-center justify-center gap-2 transition-all ${
            theme === 'NeXTSTEP'
              ? activeTab === 'formats'
                ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-0 border-r-2 border-r-[#707070] shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8)]'
                : 'bg-[#b0b0b0] border-t-2 border-l-2 border-[#d0d0d0] border-b-2 border-r-2 border-b-[#606060] border-r-[#606060] shadow-[1px_1px_2px_rgba(0,0,0,0.3)]'
              : activeTab === 'formats'
                ? 'bg-white text-blue-500 border-b-2 border-blue-500'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span className="text-sm">Formats</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 h-9 flex items-center justify-center gap-2 transition-all ${
            theme === 'NeXTSTEP'
              ? activeTab === 'settings'
                ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-0 border-r-2 border-r-[#707070] shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8)]'
                : 'bg-[#b0b0b0] border-t-2 border-l-2 border-[#d0d0d0] border-b-2 border-r-2 border-b-[#606060] border-r-[#606060] shadow-[1px_1px_2px_rgba(0,0,0,0.3)]'
              : activeTab === 'settings'
                ? 'bg-white text-blue-500 border-b-2 border-blue-500'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span className="text-sm">Settings</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeTab === 'formats' && (
          <div className="space-y-1">
            {formatSections.map((section) => (
              <div key={section.title} className="mb-2">
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.title)}
                  className={`w-full h-8 px-2 flex items-center gap-2 transition-all ${
                    theme === 'NeXTSTEP'
                      ? 'bg-[#a8a8a8] border-t-2 border-l-2 border-[#c8c8c8] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050] shadow-[1px_1px_2px_rgba(0,0,0,0.3)] hover:bg-[#b0b0b0] active:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3)]'
                      : 'bg-gray-100 hover:bg-gray-200 rounded-lg'
                  }`}
                >
                  {expandedSections.has(section.title) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <span className="font-medium text-sm">{section.title}</span>
                </button>

                {/* Section Content */}
                {expandedSections.has(section.title) && (
                  <div className={`mt-2 px-2 py-3 ${
                    theme === 'NeXTSTEP'
                      ? 'bg-[#d4d4d4] border border-[#a0a0a0]'
                      : 'bg-white border border-gray-200 rounded-lg'
                  }`}>
                    {section.content(theme)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-1">
            {settingsSections.map((section) => (
              <div key={section} className="mb-2">
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section)}
                  className={`w-full h-8 px-2 flex items-center gap-2 transition-all ${
                    theme === 'NeXTSTEP'
                      ? 'bg-[#a8a8a8] border-t-2 border-l-2 border-[#c8c8c8] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050] shadow-[1px_1px_2px_rgba(0,0,0,0.3)] hover:bg-[#b0b0b0] active:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3)]'
                      : 'bg-gray-100 hover:bg-gray-200 rounded-lg'
                  }`}
                >
                  {expandedSections.has(section) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <span className="font-medium text-sm">{section}</span>
                </button>

                {/* Section Content */}
                {expandedSections.has(section) && (
                  <div className={`mt-2 px-2 py-3 ${
                    theme === 'NeXTSTEP'
                      ? 'bg-[#d4d4d4] border border-[#a0a0a0]'
                      : 'bg-white border border-gray-200 rounded-lg'
                  }`}>
                    <p className={`text-xs text-center ${theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-500'}`}>Coming soon...</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
