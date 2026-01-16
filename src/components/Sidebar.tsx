import { useState } from 'react';
import { ChevronDown, ChevronRight, Filter, FileText, X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useFilters } from '@/contexts/FilterContext';
import { useSQLiteQuery } from '@/hooks/useSQLiteQuery';

type TabType = 'filters' | 'templates';

interface FacetValue {
  value: string;
  count: number;
}

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<TabType>('filters');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['Analytics']));
  const [activeFilterPanel, setActiveFilterPanel] = useState<string | null>(null);
  const { theme } = useTheme();
  const { filters, addFilter, removeFilter, clearFilters } = useFilters();

  const filterSections = [
    { title: 'Analytics', items: ['Category', 'Status', 'Priority', 'Time'] },
    { title: 'Synthetics', items: ['Links', 'Paths', 'Vectors', 'Centrality', 'Similarity', 'Community'] },
    { title: 'Formulas', items: ['Active Filters', 'Algorithms', 'Audit View', 'Versions'] }
  ];

  const templateBuilders = ['Apps Builder', 'Views Builder', 'Buttons Builder', 'Charts Builder'];

  // Query distinct values for category facet
  const { data: categories } = useSQLiteQuery<FacetValue>(
    `SELECT category as value, COUNT(*) as count FROM cards WHERE category IS NOT NULL GROUP BY category ORDER BY count DESC`
  );

  // Query distinct values for status facet
  const { data: statuses } = useSQLiteQuery<FacetValue>(
    `SELECT status as value, COUNT(*) as count FROM cards WHERE status IS NOT NULL GROUP BY status ORDER BY count DESC`
  );

  const toggleSection = (title: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(title)) newExpanded.delete(title);
    else newExpanded.add(title);
    setExpandedSections(newExpanded);
  };

  const handleFilterItemClick = (item: string) => {
    if (['Category', 'Status', 'Priority', 'Time'].includes(item)) {
      setActiveFilterPanel(activeFilterPanel === item ? null : item);
    } else {
      console.log('Selected:', item);
    }
  };

  const handleFacetClick = (field: string, value: string) => {
    addFilter({ field, operator: '=', value });
    setActiveFilterPanel(null);
  };

  const renderFilterPanel = () => {
    if (!activeFilterPanel) return null;

    const panelContent = () => {
      switch (activeFilterPanel) {
        case 'Category':
          return (
            <div className="space-y-1">
              {categories?.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => handleFacetClick('category', cat.value)}
                  className={`w-full h-7 px-2 flex items-center justify-between text-sm ${
                    theme === 'NeXTSTEP'
                      ? 'bg-[#d4d4d4] hover:bg-black hover:text-white'
                      : 'bg-white hover:bg-blue-500 hover:text-white rounded'
                  }`}
                >
                  <span>{cat.value}</span>
                  <span className={`text-xs ${theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-400'}`}>
                    {cat.count}
                  </span>
                </button>
              ))}
              {(!categories || categories.length === 0) && (
                <div className="text-xs text-gray-400 p-2">No categories found</div>
              )}
            </div>
          );

        case 'Status':
          return (
            <div className="space-y-1">
              {statuses?.map((status) => (
                <button
                  key={status.value}
                  onClick={() => handleFacetClick('status', status.value)}
                  className={`w-full h-7 px-2 flex items-center justify-between text-sm ${
                    theme === 'NeXTSTEP'
                      ? 'bg-[#d4d4d4] hover:bg-black hover:text-white'
                      : 'bg-white hover:bg-blue-500 hover:text-white rounded'
                  }`}
                >
                  <span>{status.value}</span>
                  <span className={`text-xs ${theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-400'}`}>
                    {status.count}
                  </span>
                </button>
              ))}
              {(!statuses || statuses.length === 0) && (
                <div className="text-xs text-gray-400 p-2">No statuses found</div>
              )}
            </div>
          );

        case 'Priority':
          return (
            <div className="space-y-1">
              {[1, 2, 3, 4, 5].map((p) => (
                <button
                  key={p}
                  onClick={() => handleFacetClick('priority', p.toString())}
                  className={`w-full h-7 px-2 flex items-center text-sm ${
                    theme === 'NeXTSTEP'
                      ? 'bg-[#d4d4d4] hover:bg-black hover:text-white'
                      : 'bg-white hover:bg-blue-500 hover:text-white rounded'
                  }`}
                >
                  Priority {p} {'⭐'.repeat(6 - p)}
                </button>
              ))}
            </div>
          );

        case 'Time':
          return (
            <div className="space-y-1">
              {['Today', 'This Week', 'This Month', 'This Year', 'Overdue'].map((range) => (
                <button
                  key={range}
                  onClick={() => {
                    // TODO: Implement time range filter
                    console.log('Time filter:', range);
                    setActiveFilterPanel(null);
                  }}
                  className={`w-full h-7 px-2 text-left text-sm ${
                    theme === 'NeXTSTEP'
                      ? 'bg-[#d4d4d4] hover:bg-black hover:text-white'
                      : 'bg-white hover:bg-blue-500 hover:text-white rounded'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          );

        default:
          return null;
      }
    };

    return (
      <div className={`mt-2 p-2 ${
        theme === 'NeXTSTEP'
          ? 'bg-[#b8b8b8] border-2 border-[#707070]'
          : 'bg-gray-50 rounded-lg border border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium">{activeFilterPanel}</span>
          <button
            onClick={() => setActiveFilterPanel(null)}
            className={`p-0.5 ${
              theme === 'NeXTSTEP' ? 'hover:bg-[#a0a0a0]' : 'hover:bg-gray-200 rounded'
            }`}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        {panelContent()}
      </div>
    );
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

      {/* Active Filters Display */}
      {filters.length > 0 && activeTab === 'filters' && (
        <div className={`p-2 border-b ${
          theme === 'NeXTSTEP' ? 'border-[#808080] bg-[#b8b8b8]' : 'border-gray-200 bg-blue-50'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">Active Filters</span>
            <button
              onClick={clearFilters}
              className={`text-xs ${
                theme === 'NeXTSTEP' ? 'text-[#404040] hover:underline' : 'text-blue-500 hover:underline'
              }`}
            >
              Clear All
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {filters.map((filter, index) => (
              <span
                key={index}
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs ${
                  theme === 'NeXTSTEP'
                    ? 'bg-[#d4d4d4] border border-[#808080]'
                    : 'bg-blue-100 text-blue-700 rounded-full'
                }`}
              >
                {filter.field}: {String(filter.value)}
                <button
                  onClick={() => removeFilter(index)}
                  className="hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeTab === 'filters' && (
          <>
            {filterSections.map((section) => (
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
                        onClick={() => handleFilterItemClick(item)}
                        className={`w-full h-7 px-3 text-left text-sm ${
                          activeFilterPanel === item
                            ? theme === 'NeXTSTEP'
                              ? 'bg-black text-white'
                              : 'bg-blue-500 text-white rounded-md'
                            : theme === 'NeXTSTEP'
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
            {renderFilterPanel()}
          </>
        )}

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
