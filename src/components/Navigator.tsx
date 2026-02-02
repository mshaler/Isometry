import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { PAFVNavigator } from './PAFVNavigator';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppState, type AppName, type ViewName, type DatasetName } from '@/contexts/AppStateContext';
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';

export function Navigator() {
  const { activeApp, activeView, activeDataset, setActiveApp, setActiveView, setActiveDataset } = useAppState();
  const [isExpanded, setIsExpanded] = useState(true);
  const { theme } = useTheme();

  // TODO: Replace with SQLite queries
  const appOptions: DropdownOption<AppName>[] = useMemo(() => [
    { value: 'Demo', label: 'Demo' },
    { value: 'Inbox', label: 'Inbox' },
    { value: 'Projects', label: 'Projects' },
    { value: 'LinkedIn', label: 'LinkedIn' },
    { value: 'MTGs', label: 'MTGs' },
    { value: 'ReadWatch', label: 'ReadWatch' },
  ], []);

  const viewOptions: DropdownOption<ViewName>[] = useMemo(() => [
    { value: 'List', label: 'List' },
    { value: 'Gallery', label: 'Gallery' },
    { value: 'Timeline', label: 'Timeline' },
    { value: 'Calendar', label: 'Calendar' },
    { value: 'Tree', label: 'Tree' },
    { value: 'Kanban', label: 'Kanban' },
    { value: 'Grid', label: 'Grid' },
    { value: 'Charts', label: 'Charts' },
    { value: 'Graphs', label: 'Graphs' },
  ], []);

  const datasetOptions: DropdownOption<DatasetName>[] = useMemo(() => [
    { value: 'ETL', label: 'ETL' },
    { value: 'CAS', label: 'CAS' },
    { value: 'Catalog', label: 'Catalog' },
    { value: 'Taxonomy', label: 'Taxonomy' },
    { value: 'Notes', label: 'Notes' },
    { value: 'Projects', label: 'Projects' },
    { value: 'Contacts', label: 'Contacts' },
    { value: 'Messages', label: 'Messages' },
  ], []);

  return (
    <>
      {/* Navigator row needs relative + z-20 so dropdown menus appear above PAFVNavigator */}
      <div className={`relative z-20 h-12 flex items-center px-3 gap-4 ${
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

        <Dropdown
          label="Apps"
          value={activeApp}
          options={appOptions}
          onSelect={setActiveApp}
        />
        <Dropdown
          label="Views"
          value={activeView}
          options={viewOptions}
          onSelect={setActiveView}
        />
        <Dropdown
          label="Datasets"
          value={activeDataset}
          options={datasetOptions}
          onSelect={setActiveDataset}
        />
      </div>

      {/* PAFVNavigator at z-10, below Navigator dropdowns (z-20) */}
      {/* TODO: Re-enable PAFVNavigator once PAFV context compatibility is fixed */}
      {/* {isExpanded && (
        <div className="relative z-10">
          <PAFVNavigator />
        </div>
      )} */}
    </>
  );
}
