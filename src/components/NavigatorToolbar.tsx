/**
 * NavigatorToolbar Component
 *
 * Top toolbar with Apps, Views, and Datasets dropdowns.
 * Extracted from Navigator.tsx for use in the redesigned IntegratedLayout.
 */

import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppState, type AppName, type ViewName, type DatasetName } from '@/contexts/AppStateContext';
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';

export function NavigatorToolbar() {
  const { activeApp, activeView, activeDataset, setActiveApp, setActiveView, setActiveDataset } = useAppState();
  const { theme } = useTheme();

  const isNeXTSTEP = theme === 'NeXTSTEP';

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
    { value: 'SuperGrid', label: 'SuperGrid' },
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
    <div className={`
      relative z-20 h-10 flex items-center px-3 gap-4
      ${isNeXTSTEP
        ? 'bg-[#b8b8b8] border-b-2 border-[#505050]'
        : 'bg-white/50 backdrop-blur-xl border-b border-gray-200'
      }
    `}>
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
  );
}
