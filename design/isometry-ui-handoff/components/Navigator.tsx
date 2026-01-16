import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { PAFVNavigator } from './PAFVNavigator';
import { useTheme } from '@/contexts/ThemeContext';

export function Navigator() {
  const [activeApp, setActiveApp] = useState('Demo');
  const [activeView, setActiveView] = useState('List');
  const [activeDataset, setActiveDataset] = useState('ETL');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const { theme } = useTheme();

  // TODO: Replace with SQLite queries
  const apps = ['Demo', 'Inbox', 'Projects', 'LinkedIn', 'MTGs', 'ReadWatch'];
  const views = ['List', 'Gallery', 'Timeline', 'Calendar', 'Tree', 'Kanban', 'Grid', 'Charts', 'Graphs'];
  const datasets = ['ETL', 'CAS', 'Catalog', 'Taxonomy', 'Notes', 'Projects', 'Contacts', 'Messages'];

  const Dropdown = ({ label, value, options, onSelect, dropdownKey }: any) => (
    <div className="relative">
      <div className="flex items-center gap-1">
        <span className={`text-xs whitespace-nowrap ${theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600 font-medium'}`}>
          {label}:
        </span>
        <button
          onClick={() => setOpenDropdown(openDropdown === dropdownKey ? null : dropdownKey)}
          className={`h-7 px-3 flex items-center gap-2 text-sm min-w-[120px] justify-between ${
            theme === 'NeXTSTEP'
              ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070]'
              : 'bg-white hover:bg-gray-50 rounded-lg border border-gray-300'
          }`}
        >
          <span>{value}</span>
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
      {openDropdown === dropdownKey && (
        <div className={`absolute top-full left-[40px] mt-1 w-[140px] z-50 ${
          theme === 'NeXTSTEP'
            ? 'bg-[#d4d4d4] border-2 border-black shadow-lg'
            : 'bg-white/95 backdrop-blur-xl rounded-lg border border-gray-200 shadow-2xl'
        }`}>
          {options.map((opt: string) => (
            <button
              key={opt}
              onClick={() => { onSelect(opt); setOpenDropdown(null); }}
              className={`w-full h-7 px-3 text-left text-sm ${
                theme === 'NeXTSTEP'
                  ? `hover:bg-black hover:text-white ${value === opt ? 'bg-black text-white' : ''}`
                  : `hover:bg-blue-500 hover:text-white ${value === opt ? 'bg-blue-500 text-white' : ''}`
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className={`h-12 flex items-center px-3 gap-4 ${
        theme === 'NeXTSTEP'
          ? 'bg-[#b8b8b8] border-b-2 border-[#505050]'
          : 'bg-white/50 backdrop-blur-xl border-b border-gray-200'
      }`}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`h-7 w-7 flex items-center justify-center ${
            theme === 'NeXTSTEP'
              ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070]'
              : 'bg-gray-100 hover:bg-gray-200 rounded-lg'
          }`}
        >
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        <Dropdown label="Apps" value={activeApp} options={apps} onSelect={setActiveApp} dropdownKey="apps" />
        <Dropdown label="Views" value={activeView} options={views} onSelect={setActiveView} dropdownKey="views" />
        <Dropdown label="Datasets" value={activeDataset} options={datasets} onSelect={setActiveDataset} dropdownKey="datasets" />
      </div>
      
      {isExpanded && <PAFVNavigator />}
    </>
  );
}
