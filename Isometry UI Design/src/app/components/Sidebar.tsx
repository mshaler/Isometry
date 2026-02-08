import { useState } from 'react';
import { ChevronDown, ChevronRight, Filter, FileText } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

type TabType = 'filters' | 'templates';

interface SidebarSection {
  title: string;
  items: string[];
}

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<TabType>('filters');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['Analytics', 'Synthetics', 'Formulas'])
  );
  const { theme } = useTheme();

  const filterSections: SidebarSection[] = [
    {
      title: 'Analytics',
      items: ['Location', 'Alphanumeric', 'Time', 'Category', 'Hierarchy']
    },
    {
      title: 'Synthetics',
      items: ['Links', 'Paths', 'Vectors', 'Centrality', 'Similarity', 'Community']
    },
    {
      title: 'Formulas',
      items: [
        'Active Filters Navigator',
        'Formulas Navigator',
        'Algorithms Navigator',
        'Audit View Navigator',
        'Versions Navigator'
      ]
    }
  ];

  const templateBuilders = [
    'Apps Builder',
    'Views Builder',
    'Buttons Builder',
    'Thumbnails Builder',
    'Charts Builder',
    'Slides Builder',
    'Rich Data Types Builder'
  ];

  const toggleSection = (sectionTitle: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionTitle)) {
      newExpanded.delete(sectionTitle);
    } else {
      newExpanded.add(sectionTitle);
    }
    setExpandedSections(newExpanded);
  };

  const handleItemClick = (item: string) => {
    console.log('Selected item:', item);
  };

  const handleBuilderClick = (builder: string) => {
    console.log('Selected builder:', builder);
  };

  return (
    <div className={`w-64 h-full flex flex-col ${
      theme === 'NeXTSTEP'
        ? 'bg-[#c0c0c0] border-t-2 border-l-2 border-[#e8e8e8] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050] shadow-[inset_2px_2px_3px_rgba(255,255,255,0.7),inset_-2px_-2px_3px_rgba(0,0,0,0.3)]'
        : 'bg-white/80 backdrop-blur-xl border-r border-gray-200'
    }`}>
      {/* Tabs */}
      <div className={theme === 'NeXTSTEP' ? 'flex border-b-2 border-[#808080]' : 'flex border-b border-gray-200'}>
        <button
          onClick={() => setActiveTab('filters')}
          className={`flex-1 h-9 flex items-center justify-center gap-2 transition-all ${
            theme === 'NeXTSTEP'
              ? activeTab === 'filters'
                ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-0 border-r-2 border-r-[#707070] shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8)]'
                : 'bg-[#b0b0b0] border-t-2 border-l-2 border-[#d0d0d0] border-b-2 border-r-2 border-b-[#606060] border-r-[#606060] shadow-[1px_1px_2px_rgba(0,0,0,0.3)]'
              : activeTab === 'filters'
                ? 'bg-white text-blue-500 border-b-2 border-blue-500'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span className="text-sm">Filters</span>
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex-1 h-9 flex items-center justify-center gap-2 transition-all ${
            theme === 'NeXTSTEP'
              ? activeTab === 'templates'
                ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-0 border-r-2 border-r-[#707070] shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8)]'
                : 'bg-[#b0b0b0] border-t-2 border-l-2 border-[#d0d0d0] border-b-2 border-r-2 border-b-[#606060] border-r-[#606060] shadow-[1px_1px_2px_rgba(0,0,0,0.3)]'
              : activeTab === 'templates'
                ? 'bg-white text-blue-500 border-b-2 border-blue-500'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span className="text-sm">Templates</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeTab === 'filters' && (
          <div className="space-y-1">
            {filterSections.map((section) => (
              <div key={section.title} className="mb-1">
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

                {/* Section Items */}
                {expandedSections.has(section.title) && (
                  <div className="mt-1 ml-2 space-y-0.5">
                    {section.items.map((item) => (
                      <button
                        key={item}
                        onClick={() => handleItemClick(item)}
                        className={`w-full h-7 px-3 text-left text-sm transition-colors ${
                          theme === 'NeXTSTEP'
                            ? 'bg-[#d4d4d4] border border-[#a0a0a0] hover:bg-[#000000] hover:text-white'
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
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="space-y-2">
            {templateBuilders.map((builder) => (
              <button
                key={builder}
                onClick={() => handleBuilderClick(builder)}
                className={`w-full h-8 px-2 flex items-center gap-2 transition-all ${
                  theme === 'NeXTSTEP'
                    ? 'bg-[#a8a8a8] border-t-2 border-l-2 border-[#c8c8c8] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050] shadow-[1px_1px_2px_rgba(0,0,0,0.3)] hover:bg-[#b0b0b0] active:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3)]'
                    : 'bg-gray-100 hover:bg-gray-200 rounded-lg'
                }`}
              >
                <span className="font-medium text-sm">{builder}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}