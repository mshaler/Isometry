import { useState } from 'react';
import { ChevronDown, ChevronRight, Filter, FileText } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

type TabType = 'filters' | 'templates';

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<TabType>('filters');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['Analytics', 'Synthetics']));
  const { theme } = useTheme();

  const filterSections = [
    { title: 'Analytics', items: ['Location', 'Alphanumeric', 'Time', 'Category', 'Hierarchy'] },
    { title: 'Synthetics', items: ['Links', 'Paths', 'Vectors', 'Centrality', 'Similarity', 'Community'] },
    { title: 'Formulas', items: ['Active Filters', 'Formulas', 'Algorithms', 'Audit View', 'Versions'] }
  ];

  const templateBuilders = ['Apps Builder', 'Views Builder', 'Buttons Builder', 'Charts Builder'];

  const toggleSection = (title: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(title)) newExpanded.delete(title);
    else newExpanded.add(title);
    setExpandedSections(newExpanded);
  };

  return (
    <div className={`w-64 h-full flex flex-col ${
      theme === 'NeXTSTEP'
        ? 'bg-[#c0c0c0] border-r-2 border-[#505050]'
        : 'bg-white/80 backdrop-blur-xl border-r border-gray-200'
    }`}>
      {/* Tabs */}
      <div className={theme === 'NeXTSTEP' ? 'flex border-b-2 border-[#808080]' : 'flex border-b border-gray-200'}>
        <button
          onClick={() => setActiveTab('filters')}
          className={`flex-1 h-9 flex items-center justify-center gap-2 ${
            theme === 'NeXTSTEP'
              ? activeTab === 'filters' ? 'bg-[#d4d4d4]' : 'bg-[#b0b0b0]'
              : activeTab === 'filters' ? 'bg-white text-blue-500 border-b-2 border-blue-500' : 'bg-gray-50 text-gray-600'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span className="text-sm">Filters</span>
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex-1 h-9 flex items-center justify-center gap-2 ${
            theme === 'NeXTSTEP'
              ? activeTab === 'templates' ? 'bg-[#d4d4d4]' : 'bg-[#b0b0b0]'
              : activeTab === 'templates' ? 'bg-white text-blue-500 border-b-2 border-blue-500' : 'bg-gray-50 text-gray-600'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span className="text-sm">Templates</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeTab === 'filters' && filterSections.map((section) => (
          <div key={section.title} className="mb-1">
            <button
              onClick={() => toggleSection(section.title)}
              className={`w-full h-8 px-2 flex items-center gap-2 ${
                theme === 'NeXTSTEP'
                  ? 'bg-[#a8a8a8] border-t-2 border-l-2 border-[#c8c8c8] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050]'
                  : 'bg-gray-100 hover:bg-gray-200 rounded-lg'
              }`}
            >
              {expandedSections.has(section.title) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span className="font-medium text-sm">{section.title}</span>
            </button>
            {expandedSections.has(section.title) && (
              <div className="mt-1 ml-2 space-y-0.5">
                {section.items.map((item) => (
                  <button
                    key={item}
                    onClick={() => console.log('Selected:', item)}
                    className={`w-full h-7 px-3 text-left text-sm ${
                      theme === 'NeXTSTEP'
                        ? 'bg-[#d4d4d4] border border-[#a0a0a0] hover:bg-black hover:text-white'
                        : 'bg-white hover:bg-blue-500 hover:text-white rounded-md border border-gray-200'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {activeTab === 'templates' && templateBuilders.map((builder) => (
          <button
            key={builder}
            className={`w-full h-8 px-2 mb-2 flex items-center text-sm ${
              theme === 'NeXTSTEP'
                ? 'bg-[#a8a8a8] border-t-2 border-l-2 border-[#c8c8c8] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050]'
                : 'bg-gray-100 hover:bg-gray-200 rounded-lg'
            }`}
          >
            {builder}
          </button>
        ))}
      </div>
    </div>
  );
}
