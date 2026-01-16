import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { PAFVNavigator } from './PAFVNavigator';
import { useTheme } from '@/contexts/ThemeContext';

export function Navigator() {
  const [activeApp, setActiveApp] = useState('Demo');
  const [activeView, setActiveView] = useState('List');
  const [activeDataset, setActiveDataset] = useState('ETL');
  const [activeGraph, setActiveGraph] = useState('Mermaid');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const { theme } = useTheme();

  const apps = [
    'Demo',
    'Inbox',
    'Projects',
    'LinkedIn',
    'MTGs',
    'ReadWatch'
  ];

  const views = [
    'List',
    'Gallery',
    'Timeline',
    'Calendar',
    'Tree',
    'Kanban',
    'List Grid',
    'Card Grid',
    'SuperGrid',
    'SuperGrid 3D',
    'Charts',
    'Graphs'
  ];

  const datasets = [
    'ETL',
    'CAS',
    'Catalog',
    'Taxonomy',
    'Notes',
    'Projects',
    'Contacts',
    'Messages',
    'Mail',
    'Slack',
    'Web',
    'Photos',
    'Health'
  ];

  const graphs = [
    'Mermaid',
    'Visualization',
    'Graph'
  ];

  const toggleDropdown = (dropdown: string) => {
    setOpenDropdown(openDropdown === dropdown ? null : dropdown);
  };

  const handleAppClick = (app: string) => {
    setActiveApp(app);
    setOpenDropdown(null);
  };

  const handleViewClick = (view: string) => {
    setActiveView(view);
    setOpenDropdown(null);
  };

  const handleDatasetClick = (dataset: string) => {
    setActiveDataset(dataset);
    setOpenDropdown(null);
  };

  const handleGraphClick = (graph: string) => {
    setActiveGraph(graph);
    setOpenDropdown(null);
  };

  return (
    <>
      <div className={`h-12 flex items-center px-3 gap-4 ${
        theme === 'NeXTSTEP'
          ? 'bg-[#b8b8b8] border-t-2 border-l-2 border-[#d8d8d8] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050] shadow-[inset_1px_1px_2px_rgba(255,255,255,0.6),inset_-1px_-1px_2px_rgba(0,0,0,0.2)]'
          : 'bg-white/50 backdrop-blur-xl border-b border-gray-200'
      }`}>
        {/* Collapse Toggle Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`h-7 w-7 flex items-center justify-center transition-all ${
            theme === 'NeXTSTEP'
              ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] shadow-[2px_2px_3px_rgba(0,0,0,0.4)] hover:bg-[#d8d8d8] active:border-t-[#707070] active:border-l-[#707070] active:border-b-[#ffffff] active:border-r-[#ffffff] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]'
              : 'bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg'
          }`}
        >
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {/* Apps Navigator */}
        <div className="relative">
          <div className="flex items-center gap-1">
            <span className={`text-xs whitespace-nowrap ${
              theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600 font-medium'
            }`}>Apps:</span>
            <button
              onClick={() => toggleDropdown('apps')}
              className={`h-7 px-3 flex items-center gap-2 text-sm min-w-[120px] justify-between transition-all ${
                theme === 'NeXTSTEP'
                  ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] shadow-[2px_2px_3px_rgba(0,0,0,0.4)] hover:bg-[#d8d8d8] active:border-t-[#707070] active:border-l-[#707070] active:border-b-[#ffffff] active:border-r-[#ffffff] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]'
                  : 'bg-white hover:bg-gray-50 rounded-lg border border-gray-300 shadow-sm'
              }`}
            >
              <span>{activeApp}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          {openDropdown === 'apps' && (
            <div className={`absolute top-full left-[40px] mt-1 w-[120px] z-50 ${
              theme === 'NeXTSTEP'
                ? 'bg-[#d4d4d4] border-2 border-[#000000] shadow-[4px_4px_8px_rgba(0,0,0,0.5)]'
                : 'bg-white/95 backdrop-blur-xl rounded-lg border border-gray-200 shadow-2xl'
            }`}>
              {apps.map((app) => (
                <button
                  key={app}
                  onClick={() => handleAppClick(app)}
                  className={`w-full h-7 px-3 text-left text-sm transition-colors ${
                    theme === 'NeXTSTEP'
                      ? `hover:bg-[#000000] hover:text-white ${activeApp === app ? 'bg-[#000000] text-white' : ''}`
                      : `hover:bg-blue-500 hover:text-white first:rounded-t-lg last:rounded-b-lg ${activeApp === app ? 'bg-blue-500 text-white' : ''}`
                  }`}
                >
                  {app}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Views Navigator */}
        <div className="relative">
          <div className="flex items-center gap-1">
            <span className={`text-xs whitespace-nowrap ${
              theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600 font-medium'
            }`}>Views:</span>
            <button
              onClick={() => toggleDropdown('views')}
              className={`h-7 px-3 flex items-center gap-2 text-sm min-w-[120px] justify-between transition-all ${
                theme === 'NeXTSTEP'
                  ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] shadow-[2px_2px_3px_rgba(0,0,0,0.4)] hover:bg-[#d8d8d8] active:border-t-[#707070] active:border-l-[#707070] active:border-b-[#ffffff] active:border-r-[#ffffff] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]'
                  : 'bg-white hover:bg-gray-50 rounded-lg border border-gray-300 shadow-sm'
              }`}
            >
              <span>{activeView}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          {openDropdown === 'views' && (
            <div className={`absolute top-full left-[50px] mt-1 w-[140px] max-h-[300px] overflow-y-auto z-50 ${
              theme === 'NeXTSTEP'
                ? 'bg-[#d4d4d4] border-2 border-[#000000] shadow-[4px_4px_8px_rgba(0,0,0,0.5)]'
                : 'bg-white/95 backdrop-blur-xl rounded-lg border border-gray-200 shadow-2xl'
            }`}>
              {views.map((view) => (
                <button
                  key={view}
                  onClick={() => handleViewClick(view)}
                  className={`w-full h-7 px-3 text-left text-sm transition-colors ${
                    theme === 'NeXTSTEP'
                      ? `hover:bg-[#000000] hover:text-white ${activeView === view ? 'bg-[#000000] text-white' : ''}`
                      : `hover:bg-blue-500 hover:text-white first:rounded-t-lg last:rounded-b-lg ${activeView === view ? 'bg-blue-500 text-white' : ''}`
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Datasets Navigator */}
        <div className="relative">
          <div className="flex items-center gap-1">
            <span className={`text-xs whitespace-nowrap ${
              theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600 font-medium'
            }`}>Datasets:</span>
            <button
              onClick={() => toggleDropdown('datasets')}
              className={`h-7 px-3 flex items-center gap-2 text-sm min-w-[120px] justify-between transition-all ${
                theme === 'NeXTSTEP'
                  ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] shadow-[2px_2px_3px_rgba(0,0,0,0.4)] hover:bg-[#d8d8d8] active:border-t-[#707070] active:border-l-[#707070] active:border-b-[#ffffff] active:border-r-[#ffffff] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]'
                  : 'bg-white hover:bg-gray-50 rounded-lg border border-gray-300 shadow-sm'
              }`}
            >
              <span>{activeDataset}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          {openDropdown === 'datasets' && (
            <div className={`absolute top-full left-[70px] mt-1 w-[140px] max-h-[300px] overflow-y-auto z-50 ${
              theme === 'NeXTSTEP'
                ? 'bg-[#d4d4d4] border-2 border-[#000000] shadow-[4px_4px_8px_rgba(0,0,0,0.5)]'
                : 'bg-white/95 backdrop-blur-xl rounded-lg border border-gray-200 shadow-2xl'
            }`}>
              {datasets.map((dataset) => (
                <button
                  key={dataset}
                  onClick={() => handleDatasetClick(dataset)}
                  className={`w-full h-7 px-3 text-left text-sm transition-colors ${
                    theme === 'NeXTSTEP'
                      ? `hover:bg-[#000000] hover:text-white ${activeDataset === dataset ? 'bg-[#000000] text-white' : ''}`
                      : `hover:bg-blue-500 hover:text-white first:rounded-t-lg last:rounded-b-lg ${activeDataset === dataset ? 'bg-blue-500 text-white' : ''}`
                  }`}
                >
                  {dataset}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Graphs Navigator */}
        <div className="relative">
          <div className="flex items-center gap-1">
            <span className={`text-xs whitespace-nowrap ${
              theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600 font-medium'
            }`}>Graphs:</span>
            <button
              onClick={() => toggleDropdown('graphs')}
              className={`h-7 px-3 flex items-center gap-2 text-sm min-w-[120px] justify-between transition-all ${
                theme === 'NeXTSTEP'
                  ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] shadow-[2px_2px_3px_rgba(0,0,0,0.4)] hover:bg-[#d8d8d8] active:border-t-[#707070] active:border-l-[#707070] active:border-b-[#ffffff] active:border-r-[#ffffff] active:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.5)]'
                  : 'bg-white hover:bg-gray-50 rounded-lg border border-gray-300 shadow-sm'
              }`}
            >
              <span>{activeGraph}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          {openDropdown === 'graphs' && (
            <div className={`absolute top-full left-[60px] mt-1 w-[140px] max-h-[300px] overflow-y-auto z-50 ${
              theme === 'NeXTSTEP'
                ? 'bg-[#d4d4d4] border-2 border-[#000000] shadow-[4px_4px_8px_rgba(0,0,0,0.5)]'
                : 'bg-white/95 backdrop-blur-xl rounded-lg border border-gray-200 shadow-2xl'
            }`}>
              {graphs.map((graph) => (
                <button
                  key={graph}
                  onClick={() => handleGraphClick(graph)}
                  className={`w-full h-7 px-3 text-left text-sm transition-colors ${
                    theme === 'NeXTSTEP'
                      ? `hover:bg-[#000000] hover:text-white ${activeGraph === graph ? 'bg-[#000000] text-white' : ''}`
                      : `hover:bg-blue-500 hover:text-white first:rounded-t-lg last:rounded-b-lg ${activeGraph === graph ? 'bg-blue-500 text-white' : ''}`
                  }`}
                >
                  {graph}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* PAFV Navigator */}
      {isExpanded && <PAFVNavigator />}
    </>
  );
}
