import { useState, useMemo, useEffect } from 'react';
import { Filter, FileText, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useFilters } from '../../contexts/FilterContext';
import { useSQLiteQuery } from '../../hooks/database/useSQLiteQuery';
import { TabPanel, type Tab } from '../ui/TabPanel';
import { AccordionSection } from '../ui/AccordionSection';

type TabType = 'filters' | 'templates';

interface FacetValue {
  value: string;
  count: number;
}

interface ColumnInfo {
  name: string;
}

interface DateRangeInfo {
  min_date: string;
  max_date: string;
  has_created: number;
  has_due: number;
}

interface SidebarProps {
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ isCollapsed = false, onCollapsedChange }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>('filters');
  const [activeFilterPanel, setActiveFilterPanel] = useState<string | null>(null);
  const { theme } = useTheme();
  const { filters, addFilter, removeFilter, clearFilters } = useFilters();

  // Handle keyboard shortcuts for sidebar collapse
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
        event.preventDefault();
        onCollapsedChange?.(!isCollapsed);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCollapsed, onCollapsedChange]);

  const templateBuilders = ['Apps Builder', 'Views Builder', 'Buttons Builder', 'Charts Builder'];

  // Query table schema to discover available columns from nodes table
  const { data: columns } = useSQLiteQuery<ColumnInfo>(
    `PRAGMA table_info(nodes)`,
    [],
    // Fallback data for demo - nodes table schema
    [
      { name: 'id' },
      { name: 'name' },
      { name: 'node_type' },
      { name: 'folder' },
      { name: 'tags' },
      { name: 'priority' },
      { name: 'created_at' },
      { name: 'modified_at' },
      { name: 'content' }
    ]
  );

  // Full LATCH filter list - always show all, dim unavailable ones
  const LATCH_FILTERS = ['Location', 'Alphabet', 'Time', 'Category', 'Hierarchy'];

  // Determine which filterable columns exist in the schema
  const availableFilters = useMemo(() => {
    if (!columns || !Array.isArray(columns)) return new Set<string>();

    const columnNames = new Set(columns.map(c => c.name));
    const available = new Set<string>();

    // Map LATCH axes to available columns in nodes table
    if (columnNames.has('location_name') || columnNames.has('latitude') || columnNames.has('longitude')) available.add('Location');
    if (columnNames.has('name')) available.add('Alphabet');
    if (columnNames.has('created_at') || columnNames.has('modified_at') || columnNames.has('due_at')) available.add('Time');
    if (columnNames.has('node_type') || columnNames.has('folder') || columnNames.has('tags') || columnNames.has('priority')) available.add('Category');
    if (columnNames.has('folder') || columnNames.has('parent_id')) available.add('Hierarchy');

    return available;
  }, [columns]);

  // Build filter sections - show all LATCH filters, mark availability
  const filterSections = useMemo(() => {
    return [
      {
        title: 'Analytics',
        items: LATCH_FILTERS.map(filter => ({
          name: filter,
          available: availableFilters.has(filter)
        }))
      },
      {
        title: 'Synthetics',
        items: ['Links', 'Paths', 'Vectors', 'Centrality', 'Similarity', 'Community'].map(item => ({
          name: item,
          available: false // TODO: Check for edges table
        }))
      },
      {
        title: 'Formulas',
        items: ['Active Filters', 'Algorithms', 'Audit View', 'Versions'].map(item => ({
          name: item,
          available: true // These are always available
        }))
      }
    ];
  }, [availableFilters]);

  // Check if Category filter is available (has category-related columns)
  const hasCategoryFilter = availableFilters.has('Category');
  const hasTimeFilter = availableFilters.has('Time');

  // Query distinct values for category facet (uses 'folder' as proxy since our schema uses folder)
  const { data: categories } = useSQLiteQuery<FacetValue>(
    hasCategoryFilter
      ? `SELECT folder as value, COUNT(*) as count FROM cards WHERE folder IS NOT NULL AND folder != '' GROUP BY folder ORDER BY count DESC`
      : `SELECT NULL as value, 0 as count WHERE 0`,
    [],
    // Fallback data for demo
    [
      { value: 'Development', count: 1 },
      { value: 'Documentation', count: 1 },
      { value: 'Meetings', count: 1 },
      { value: 'Projects', count: 2 },
      { value: 'Research', count: 1 }
    ]
  );

  // Query distinct values for status facet
  const { data: statuses } = useSQLiteQuery<FacetValue>(
    hasCategoryFilter
      ? `SELECT status as value, COUNT(*) as count FROM cards WHERE status IS NOT NULL AND status != '' GROUP BY status ORDER BY count DESC`
      : `SELECT NULL as value, 0 as count WHERE 0`,
    [],
    // Fallback data for demo
    [
      { value: 'active', count: 2 },
      { value: 'completed', count: 2 },
      { value: 'draft', count: 1 },
      { value: 'pending', count: 1 }
    ]
  );

  // Query distinct values for priority facet
  const { data: priorities } = useSQLiteQuery<FacetValue>(
    hasCategoryFilter
      ? `SELECT CAST(priority as TEXT) as value, COUNT(*) as count FROM cards WHERE priority IS NOT NULL GROUP BY priority ORDER BY priority ASC`
      : `SELECT NULL as value, 0 as count WHERE 0`,
    [],
    // Fallback data for demo
    [
      { value: '1', count: 2 },
      { value: '2', count: 2 },
      { value: '3', count: 2 }
    ]
  );

  // Query distinct values for tags facet
  const { data: tags } = useSQLiteQuery<FacetValue>(
    hasCategoryFilter
      ? `SELECT tags as value, COUNT(*) as count FROM cards WHERE tags IS NOT NULL AND tags != '' GROUP BY tags ORDER BY count DESC`
      : `SELECT NULL as value, 0 as count WHERE 0`,
    [],
    // Fallback data for demo
    [
      { value: 'urgent', count: 2 },
      { value: 'important', count: 3 },
      { value: 'project', count: 2 },
      { value: 'review', count: 1 }
    ]
  );

  // Query date range info for time filters
  const { data: dateRange } = useSQLiteQuery<DateRangeInfo>(
    hasTimeFilter
      ? `SELECT
          MIN(COALESCE(createdAt, created, due)) as min_date,
          MAX(COALESCE(createdAt, created, due)) as max_date,
          SUM(CASE WHEN createdAt IS NOT NULL OR created IS NOT NULL THEN 1 ELSE 0 END) as has_created,
          SUM(CASE WHEN due IS NOT NULL THEN 1 ELSE 0 END) as has_due
         FROM cards`
      : `SELECT NULL as min_date, NULL as max_date, 0 as has_created, 0 as has_due WHERE 0`,
    [],
    // Fallback data for demo
    [{
      min_date: '2024-01-01',
      max_date: '2024-12-31',
      has_created: 6,
      has_due: 3
    }]
  );

  const handleFilterItemClick = (item: string, _isAvailable: boolean) => {
    if (_isAvailable) {
      setActiveFilterPanel(activeFilterPanel === item ? null : item);
    }
    // Unavailable items are dimmed and not clickable
  };

  const handleFacetClick = (field: string, _value: string) => {
    addFilter({ field, operator: '=', value: _value });
    setActiveFilterPanel(null);
  };

  const renderFacetList = (
    data: FacetValue[] | null | undefined,
    field: string,
    emptyMessage: string
  ) => {
    if (!data || data.length === 0) {
      return <div className="text-xs text-gray-400 p-2">{emptyMessage}</div>;
    }

    return (
      <div className="space-y-1">
        {data.filter(item => item.value).map((item) => (
          <button
            key={item.value}
            onClick={() => handleFacetClick(field, item.value)}
            className={`w-full h-7 px-2 flex items-center justify-between text-sm ${
              theme === 'NeXTSTEP'
                ? 'bg-[#d4d4d4] hover:bg-black hover:text-white'
                : 'bg-white hover:bg-blue-500 hover:text-white rounded'
            }`}
          >
            <span>{item.value}</span>
            <span className={`text-xs ${theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-400'}`}>
              {item.count}
            </span>
          </button>
        ))}
      </div>
    );
  };

  const renderFilterPanel = () => {
    if (!activeFilterPanel) return null;

    const panelContent = () => {
      switch (activeFilterPanel) {
        case 'Category':
          return renderFacetList(categories, 'category', 'No categories in data');

        case 'Status':
          return renderFacetList(statuses, 'status', 'No statuses in data');

        case 'Priority':
          return renderFacetList(priorities, 'priority', 'No priorities in data');

        case 'Tags':
          return renderFacetList(tags, 'tags', 'No tags in data');

        case 'Time': {
          // Only show time filters if we have date data
          if (!dateRange || dateRange.length === 0 || (!dateRange[0]?.has_created && !dateRange[0]?.has_due)) {
            return <div className="text-xs text-gray-400 p-2">No date fields in data</div>;
          }

          const timeRanges: Array<{ label: string; start: string; end: string; field?: string }> = [];
          const now = new Date();
          const today = now.toISOString().split('T')[0]!;

          // Calculate date boundaries
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
          const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().split('T')[0]!;
          const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split('T')[0]!

          timeRanges.push({ label: 'Today', start: today, end: today });
          timeRanges.push({ label: 'This Week', start: weekAgo, end: today });
          timeRanges.push({ label: 'This Month', start: monthAgo, end: today });
          timeRanges.push({ label: 'This Year', start: yearAgo, end: today });

          if (dateRange[0]?.has_due) {
            timeRanges.push({ label: 'Overdue', start: '1900-01-01', end: today, field: 'due' });
          }

          return (
            <div className="space-y-1">
              {timeRanges.map((range) => (
                <button
                  key={range.label}
                  onClick={() => {
                    // Add time range filter
                    const dateField = range.field || (dateRange[0]?.has_created ? 'created' : 'due');
                    addFilter({
                      field: dateField,
                      operator: range.label === 'Overdue' ? '<' : '>=',
                      value: range.label === 'Overdue' ? today : range.start
                    });
                    setActiveFilterPanel(null);
                  }}
                  className={`w-full h-7 px-2 text-left text-sm ${
                    theme === 'NeXTSTEP'
                      ? 'bg-[#d4d4d4] hover:bg-black hover:text-white'
                      : 'bg-white hover:bg-blue-500 hover:text-white rounded'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          );
        }

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

  // Render active filters display
  const renderActiveFilters = () => {
    if (filters.length === 0) return null;

    return (
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
              {filter.field} {filter.operator} {String(filter.value)}
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
    );
  };

  // Render filter item button with availability state
  const renderFilterItem = (item: { name: string; available: boolean }) => (
    <button
      key={item.name}
      onClick={() => handleFilterItemClick(item.name, item.available)}
      disabled={!item.available}
      className={`w-full h-7 px-3 text-left text-sm transition-opacity ${
        !item.available
          ? theme === 'NeXTSTEP'
            ? 'bg-[#d4d4d4] border border-[#a0a0a0] opacity-40 cursor-not-allowed text-[#808080]'
            : 'bg-gray-100 border border-gray-200 opacity-40 cursor-not-allowed text-gray-400 rounded-md'
          : activeFilterPanel === item.name
            ? theme === 'NeXTSTEP'
              ? 'bg-black text-white'
              : 'bg-blue-500 text-white rounded-md'
            : theme === 'NeXTSTEP'
              ? 'bg-[#d4d4d4] border border-[#a0a0a0] hover:bg-black hover:text-white'
              : 'bg-white hover:bg-blue-500 hover:text-white rounded-md border border-gray-200'
      }`}
    >
      {item.name}
    </button>
  );

  // Render filters tab content
  const renderFiltersContent = () => (
    <div className="p-2">
      {renderActiveFilters()}
      {filterSections.map((section) => (
        <AccordionSection
          key={section.title}
          title={section.title}
          defaultExpanded={section.title === 'Analytics'}
          className="mb-1"
        >
          <div className="mt-1 ml-2 space-y-0.5">
            {section.items.map(renderFilterItem)}
          </div>
        </AccordionSection>
      ))}
      {renderFilterPanel()}
    </div>
  );

  // Render templates tab content
  const renderTemplatesContent = () => (
    <div className="p-2">
      {templateBuilders.map((builder) => (
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
  );

  // Define tabs for TabPanel
  const tabs: Tab[] = [
    {
      id: 'filters',
      label: 'Filters',
      icon: <Filter className="w-4 h-4" />,
      content: renderFiltersContent(),
    },
    {
      id: 'templates',
      label: 'Templates',
      icon: <FileText className="w-4 h-4" />,
      content: renderTemplatesContent(),
    },
  ];

  // Collapsed view
  if (isCollapsed) {
    return (
      <div className={`w-12 h-full flex flex-col items-center py-2 ${
        theme === 'NeXTSTEP'
          ? 'bg-[#c0c0c0] border-r-2 border-[#505050]'
          : 'bg-white/80 backdrop-blur-xl border-r border-gray-200'
      }`}>
        {/* Expand button */}
        <button
          onClick={() => onCollapsedChange?.(false)}
          className={`w-8 h-8 flex items-center justify-center mb-2 ${
            theme === 'NeXTSTEP'
              ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] hover:bg-[#c8c8c8]'
              : 'bg-gray-100 hover:bg-gray-200 rounded-lg'
          }`}
          title="Expand sidebar (Cmd+B)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Collapsed tab icons */}
        <div className="flex flex-col gap-1">
          <button
            onClick={() => {
              setActiveTab('filters');
              onCollapsedChange?.(false);
            }}
            className={`w-8 h-8 flex items-center justify-center ${
              activeTab === 'filters'
                ? theme === 'NeXTSTEP'
                  ? 'bg-black text-white'
                  : 'bg-blue-500 text-white rounded'
                : theme === 'NeXTSTEP'
                  ? 'bg-[#d4d4d4] hover:bg-[#c8c8c8] border-t border-l border-[#ffffff] border-b border-r border-[#707070]'
                  : 'bg-gray-100 hover:bg-gray-200 rounded'
            }`}
            title="Filters"
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setActiveTab('templates');
              onCollapsedChange?.(false);
            }}
            className={`w-8 h-8 flex items-center justify-center ${
              activeTab === 'templates'
                ? theme === 'NeXTSTEP'
                  ? 'bg-black text-white'
                  : 'bg-blue-500 text-white rounded'
                : theme === 'NeXTSTEP'
                  ? 'bg-[#d4d4d4] hover:bg-[#c8c8c8] border-t border-l border-[#ffffff] border-b border-r border-[#707070]'
                  : 'bg-gray-100 hover:bg-gray-200 rounded'
            }`}
            title="Templates"
          >
            <FileText className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Expanded view
  return (
    <div className={`w-64 h-full flex flex-col ${
      theme === 'NeXTSTEP'
        ? 'bg-[#c0c0c0] border-r-2 border-[#505050]'
        : 'bg-white/80 backdrop-blur-xl border-r border-gray-200'
    }`}>
      {/* Sidebar header with collapse button */}
      <div className={`h-12 flex items-center justify-between px-3 border-b ${
        theme === 'NeXTSTEP' ? 'border-[#808080]' : 'border-gray-200'
      }`}>
        <span className={`font-medium ${
          theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-700'
        }`}>
          Sidebar
        </span>
        <button
          onClick={() => onCollapsedChange?.(true)}
          className={`w-6 h-6 flex items-center justify-center ${
            theme === 'NeXTSTEP'
              ? 'hover:bg-[#a0a0a0] rounded'
              : 'hover:bg-gray-200 rounded'
          }`}
          title="Collapse sidebar (Cmd+B)"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
      </div>

      <TabPanel
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as TabType)}
        className="flex-1 flex flex-col"
      />
    </div>
  );
}
