import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppState, type AppName, type ViewName, type DatasetName } from '@/contexts/AppStateContext';
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';
import { usePAFV } from '@/state/PAFVContext';
import type { LATCHAxis, Plane } from '@/types/pafv';

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
      {isExpanded && (
        <div className="relative z-10">
          <SimplePAFVNavigator />
        </div>
      )}
    </>
  );
}

// Simple PAFV Navigator that works with current PAFVContext
function SimplePAFVNavigator() {
  const { theme } = useTheme();
  const { state, setMapping, removeMapping, setViewMode } = usePAFV();

  const availableAxes: LATCHAxis[] = ['location', 'alphabet', 'time', 'category', 'hierarchy'];
  const availablePlanes: Plane[] = ['x', 'y', 'color'];

  const handleAxisToPlane = (axis: LATCHAxis, plane: Plane) => {
    // Remove any existing mapping for this plane first
    const existingMapping = state.mappings.find(m => m.plane === plane);
    if (existingMapping) {
      removeMapping(plane);
    }

    // Add new mapping
    setMapping({ axis, plane, facet: axis.toLowerCase() });
  };

  const handleRemoveMapping = (plane: Plane) => {
    removeMapping(plane);
  };

  const getCurrentMapping = (plane: Plane) => {
    return state.mappings.find(m => m.plane === plane);
  };

  return (
    <div className={`${
      theme === 'NeXTSTEP'
        ? 'bg-[#b8b8b8] border-b-2 border-[#505050]'
        : 'bg-white/50 backdrop-blur-xl border-b border-gray-200'
    }`}>
      <div className="p-3">
        {/* View Mode Controls */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs font-medium">View Mode:</span>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1 text-xs rounded ${
              state.viewMode === 'grid'
                ? 'bg-blue-500 text-white'
                : theme === 'NeXTSTEP'
                  ? 'bg-[#d4d4d4] border border-[#707070]'
                  : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 text-xs rounded ${
              state.viewMode === 'list'
                ? 'bg-blue-500 text-white'
                : theme === 'NeXTSTEP'
                  ? 'bg-[#d4d4d4] border border-[#707070]'
                  : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            List
          </button>
        </div>

        {/* PAFV Axis Assignment */}
        <div className="grid grid-cols-3 gap-4">
          {availablePlanes.map(plane => {
            const mapping = getCurrentMapping(plane);
            return (
              <div key={plane} className="space-y-2">
                <div className="text-xs font-medium capitalize">{plane}-Axis</div>
                <div className={`min-h-[100px] p-2 rounded border ${
                  theme === 'NeXTSTEP'
                    ? 'bg-[#a0a0a0] border-[#606060]'
                    : 'bg-gray-50 border-gray-300'
                }`}>
                  {mapping ? (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{mapping.axis.charAt(0).toUpperCase() + mapping.axis.slice(1)}</span>
                      <button
                        onClick={() => handleRemoveMapping(plane)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">Drop axis here</div>
                  )}
                </div>

                {/* Available axes to assign */}
                <div className="space-y-1">
                  {availableAxes.map(axis => (
                    <button
                      key={axis}
                      onClick={() => handleAxisToPlane(axis, plane)}
                      className={`w-full text-left px-2 py-1 text-xs rounded ${
                        mapping?.axis === axis
                          ? 'bg-blue-100 text-blue-800'
                          : theme === 'NeXTSTEP'
                            ? 'bg-[#d4d4d4] hover:bg-[#c0c0c0] border border-[#707070]'
                            : 'bg-white hover:bg-gray-100 border border-gray-300'
                      }`}
                    >
                      {axis.charAt(0).toUpperCase() + axis.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Current State Display */}
        <div className="mt-3 pt-3 border-t border-gray-300">
          <div className="text-xs text-gray-600">
            Current mappings: {state.mappings.length > 0
              ? state.mappings.map(m => `${m.plane}:${m.axis}`).join(', ')
              : 'None'
            }
          </div>
        </div>
      </div>
    </div>
  );
}
