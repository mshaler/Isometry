import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, MapPin, SortAsc, Clock, Tag, GitBranch, Network } from 'lucide-react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppState, type AppName, type ViewName, type DatasetName } from '@/contexts/AppStateContext';
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';
import { usePAFV } from '@/state/PAFVContext';
import { AccordionSection } from '@/components/ui/AccordionSection';
import { usePropertyClassification } from '@/hooks/data/usePropertyClassification';
import { DraggableFacet } from '@/components/navigator/DraggableFacet';
import { PlaneDropZone } from '@/components/navigator/PlaneDropZone';
import { TransposeButton } from '@/components/navigator/TransposeButton';
import { EncodingDropdown } from '@/components/navigator/EncodingDropdown';
import type { PropertyBucket, ClassifiedProperty } from '@/services/property-classifier';
import type { Plane, AxisMapping } from '@/types/pafv';

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

// ============================================================================
// Constants
// ============================================================================

/**
 * Configuration for LATCH+GRAPH bucket rendering.
 * Maps bucket keys to display labels and icons.
 */
const BUCKET_CONFIG: Array<{
  key: PropertyBucket;
  label: string;
  icon: React.ReactNode;
}> = [
  { key: 'L', label: 'Location', icon: <MapPin className="w-4 h-4" /> },
  { key: 'A', label: 'Alphabet', icon: <SortAsc className="w-4 h-4" /> },
  { key: 'T', label: 'Time', icon: <Clock className="w-4 h-4" /> },
  { key: 'C', label: 'Category', icon: <Tag className="w-4 h-4" /> },
  { key: 'H', label: 'Hierarchy', icon: <GitBranch className="w-4 h-4" /> },
  { key: 'GRAPH', label: 'Graph', icon: <Network className="w-4 h-4" /> },
];

/**
 * Get all properties from classification (excluding GRAPH)
 */
function getAllProperties(
  classification: Record<PropertyBucket, ClassifiedProperty[]> | null
): ClassifiedProperty[] {
  if (!classification) return [];

  // Combine all LATCH buckets (not GRAPH)
  return [
    ...classification.L,
    ...classification.A,
    ...classification.T,
    ...classification.C,
    ...classification.H,
  ];
}

// ============================================================================
// SimplePAFVNavigator Component
// ============================================================================

/**
 * PAFV Navigator with dynamic LATCH+GRAPH classification.
 * Renders accordion sections for each property bucket with drag-and-drop facet assignment.
 */
function SimplePAFVNavigator() {
  const { theme } = useTheme();
  const { state, setViewMode, setColorEncoding, setSizeEncoding } = usePAFV();
  const { classification, isLoading, error } = usePropertyClassification();

  const getCurrentMapping = (plane: Plane): AxisMapping | null => {
    return state.mappings.find((m: AxisMapping) => m.plane === plane) ?? null;
  };

  // Container styling
  const containerStyles = `${
    theme === 'NeXTSTEP'
      ? 'bg-[#b8b8b8] border-b-2 border-[#505050]'
      : 'bg-white/50 backdrop-blur-xl border-b border-gray-200'
  }`;

  // Loading state
  if (isLoading) {
    return (
      <div className={containerStyles}>
        <div className="p-3 text-xs text-gray-500">Loading properties...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={containerStyles}>
        <div className="p-3 text-xs text-red-500">Error: {error}</div>
      </div>
    );
  }

  // No classification data
  if (!classification) {
    return null;
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={containerStyles}>
        <div className="p-3">
          {/* View Mode Controls */}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs font-medium">View Mode:</span>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 text-xs rounded transition-colors duration-150 ${
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
              className={`px-3 py-1 text-xs rounded transition-colors duration-150 ${
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

          {/* Two-column layout: Buckets left, Planes right */}
          <div className="flex gap-4">
            {/* Left: LATCH+GRAPH Buckets */}
            <div className="flex-1 space-y-1">
              {BUCKET_CONFIG.map((bucket) => {
                const properties = classification[bucket.key];
                const isEmpty = properties.length === 0;
                const isGraph = bucket.key === 'GRAPH';

                return (
                  <AccordionSection
                    key={bucket.key}
                    title={bucket.label}
                    icon={bucket.icon}
                    badge={<span className="text-xs text-gray-500">{properties.length}</span>}
                    defaultExpanded={bucket.key === 'T' || bucket.key === 'C'}
                  >
                    {isEmpty ? (
                      <div className="text-xs text-gray-400 italic">No enabled facets</div>
                    ) : (
                      <div className="space-y-1">
                        {properties.map((property) => (
                          <DraggableFacet
                            key={property.id}
                            property={property}
                            disabled={isGraph}
                          />
                        ))}
                      </div>
                    )}
                    {isGraph && (
                      <div className="mt-2 text-xs text-gray-400 italic">
                        Graph axis mapping coming soon
                      </div>
                    )}
                  </AccordionSection>
                );
              })}
            </div>

            {/* Right: Plane Drop Zones with Transpose Button */}
            <div className="w-48 space-y-2">
              {/* X-Plane (Columns) */}
              <PlaneDropZone
                plane="x"
                currentMapping={getCurrentMapping('x')}
              />

              {/* Transpose Button (between X and Y) */}
              <div className="flex justify-center">
                <TransposeButton />
              </div>

              {/* Y-Plane (Rows) */}
              <PlaneDropZone
                plane="y"
                currentMapping={getCurrentMapping('y')}
              />

              {/* Encoding Controls */}
              <div className={`pt-2 mt-2 space-y-2 border-t ${
                theme === 'NeXTSTEP' ? 'border-[#909090]' : 'border-gray-300'
              }`}>
                {/* Color Encoding */}
                <EncodingDropdown
                  label="Color"
                  value={state.colorEncoding}
                  availableProperties={getAllProperties(classification)}
                  onChange={setColorEncoding}
                  encodingType="color"
                />

                {/* Size Encoding */}
                <EncodingDropdown
                  label="Size"
                  value={state.sizeEncoding}
                  availableProperties={getAllProperties(classification)}
                  onChange={setSizeEncoding}
                  encodingType="size"
                />
              </div>
            </div>
          </div>

          {/* Current State Display */}
          <div className="mt-3 pt-3 border-t border-gray-300">
            <div className="text-xs text-gray-600">
              Current mappings: {state.mappings.length > 0
                ? state.mappings.map((m: AxisMapping) => `${m.plane}:${m.axis}`).join(', ')
                : 'None'
              }
            </div>
          </div>
        </div>
      </div>
    </DndProvider>
  );
}
