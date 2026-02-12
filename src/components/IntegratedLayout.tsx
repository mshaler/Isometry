import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { LatchNavigator } from './navigator/LatchNavigator';
import { PafvNavigator } from './navigator/PafvNavigator';
import { LatchGraphSliders, useSliderFilters, type SliderClassification } from './navigator/LatchGraphSliders';
import { SuperGrid } from '../d3/SuperGrid';
import { useDatabaseService, usePAFV } from '@/hooks';
import { mappingsToProjection } from '../types/grid';
import { useTheme } from '@/contexts/ThemeContext';
import { contextLogger } from '../utils/logging/dev-logger';
import { usePropertyClassification } from '@/hooks/data/usePropertyClassification';
import { useAltoIndexImport } from '@/hooks/useAltoIndexImport';

/**
 * Alto-index dataset definitions for the dataset switcher
 * nodeType matches the node_type field from alto-index import
 */
const ALTO_DATASETS = [
  { id: 'notes', label: 'Notes', icon: '📝', nodeType: 'notes' },
  { id: 'contacts', label: 'Contacts', icon: '👤', nodeType: 'contacts' },
  { id: 'safari', label: 'Safari', icon: '🧭', nodeType: 'safari-history' },
  { id: 'calendars', label: 'Calendars', icon: '📅', nodeType: 'calendar' },
  { id: 'reminders', label: 'Reminders', icon: '✅', nodeType: 'reminders' },
  { id: 'messages', label: 'Messages', icon: '💬', nodeType: 'messages' },
] as const;

/**
 * IntegratedLayout - Unified Navigator + SuperGrid layout
 *
 * Layout (revised):
 * ┌─────────────────────────────────────────────┐
 * │ Command Bar (top)                           │
 * ├─────────────────────────────────────────────┤
 * │ Dataset Switcher (Notes|Contacts|Safari...) │
 * ├─────────────────────────────────────────────┤
 * │ LatchNavigator (6-column LATCH+GRAPH grid)  │
 * ├─────────────────────────────────────────────┤
 * │ PafvNavigator (5-well axis assignment)      │
 * ├─────────────────────────────────────────────┤
 * │ SuperGrid (D3 canvas) ← MAXIMIZED           │
 * └─────────────────────────────────────────────┘
 */
export function IntegratedLayout() {
  const { theme } = useTheme();
  const { state: pafvState, clearFacetFromAllPlanes } = usePAFV();
  const databaseService = useDatabaseService();
  const { classification, refresh: refreshClassification } = usePropertyClassification();

  // Alto-index import hook
  const {
    importFromPublic,
    status: importStatus,
    progress: importProgress,
  } = useAltoIndexImport();

  // Current data for slider filter generation
  const [currentData, setCurrentData] = useState<Array<Record<string, unknown>>>([]);

  // Convert PropertyClassification to SliderClassification format
  const sliderClassification: SliderClassification | null = useMemo(() => {
    if (!classification) return null;
    return {
      T: classification.T.map(p => ({ sourceColumn: p.sourceColumn, name: p.name })),
      H: classification.H.map(p => ({ sourceColumn: p.sourceColumn, name: p.name })),
    };
  }, [classification]);

  // Slider filters hook
  const {
    filters: sliderFilters,
    setFilterValue,
    buildWhereClause,
    resetFilters,
  } = useSliderFilters(currentData, sliderClassification);


  // SuperGrid refs and state
  const svgRef = useRef<SVGSVGElement>(null);
  const [superGrid, setSuperGrid] = useState<SuperGrid | null>(null);
  const superGridRef = useRef<SuperGrid | null>(null); // Stable ref to avoid losing grid during re-renders
  const [altoImported, setAltoImported] = useState(false);
  const importStartedRef = useRef(false);

  // Cleanup SuperGrid on unmount
  useEffect(() => {
    return () => {
      if (superGridRef.current) {
        superGridRef.current.destroy();
        superGridRef.current = null;
      }
    };
  }, []);

  // Dataset switcher state - default to 'notes' (the sample data table)
  const [activeDataset, setActiveDataset] = useState<string>('notes');

  // Shared state: enabled properties synced between LatchNavigator and PafvNavigator
  // Initialize with ALL properties enabled by default
  const [enabledProperties, setEnabledProperties] = useState<Set<string>>(() => new Set());

  // Initialize enabled properties when classification loads
  useEffect(() => {
    if (!classification) return;
    // Enable all LATCH properties by default
    const allPropertyIds = [
      ...classification.L,
      ...classification.A,
      ...classification.T,
      ...classification.C,
      ...classification.H,
    ].map(p => p.id);
    setEnabledProperties(new Set(allPropertyIds));
  }, [classification]);

  // Handle property toggle from LatchNavigator
  const handlePropertyToggle = useCallback((propertyId: string, enabled: boolean) => {
    // Update enabled state
    setEnabledProperties(prev => {
      const next = new Set(prev);
      if (enabled) {
        next.add(propertyId);
      } else {
        next.delete(propertyId);
      }
      return next;
    });

    // When disabling, also remove from any assigned planes
    // Uses atomic clearFacetFromAllPlanes to avoid stale closure issues
    if (!enabled && classification) {
      const allProperties = [
        ...classification.L,
        ...classification.A,
        ...classification.T,
        ...classification.C,
        ...classification.H,
      ];
      const property = allProperties.find(p => p.id === propertyId);
      if (property) {
        // Atomic removal from ALL planes (x, y, z) in single state update
        clearFacetFromAllPlanes(property.sourceColumn);
      }
    }
  }, [classification, clearFacetFromAllPlanes]);

  // Handle dataset switch
  const handleDatasetSwitch = useCallback((datasetId: string) => {
    setActiveDataset(datasetId);

    // Refresh property classification for new dataset
    // (properties may differ between tables)
    refreshClassification?.();

    contextLogger.setup('IntegratedLayout: Dataset switched', {
      dataset: datasetId,
    });
  }, [refreshClassification]);

  // Handle slider filter change - re-query SuperGrid with filter constraints
  const handleSliderFilterChange = useCallback((filterId: string, value: [number, number]) => {
    setFilterValue(filterId, value);
  }, [setFilterValue]);

  // Theme-aware colors
  const isNeXTSTEP = theme === 'NeXTSTEP';
  const bgColor = isNeXTSTEP ? 'bg-[#1E1E1E]' : 'bg-gray-50';
  const borderColor = isNeXTSTEP ? 'border-[#3A3A3A]' : 'border-gray-200';
  const textColor = isNeXTSTEP ? 'text-[#E0E0E0]' : 'text-gray-900';
  const mutedColor = isNeXTSTEP ? 'text-[#999]' : 'text-gray-500';
  const panelBg = isNeXTSTEP ? 'bg-[#252525]' : 'bg-white';
  const activeBtnBg = isNeXTSTEP ? 'bg-[#4A90D9]' : 'bg-blue-500';
  const inactiveBtnBg = isNeXTSTEP ? 'bg-[#3A3A3A]' : 'bg-gray-200';
  const activeBtnText = 'text-white';
  const inactiveBtnText = isNeXTSTEP ? 'text-[#999]' : 'text-gray-600';

  // Initialize SuperGrid
  useEffect(() => {
    // CRITICAL: Must check isReady() to ensure we don't create SuperGrid with loading stub
    // The loading stub has a broken database that returns empty results
    if (!svgRef.current || !databaseService?.isReady()) return;

    // Check if existing SuperGrid's container is still in the document
    // React StrictMode unmounts/remounts, creating new DOM elements
    // The old D3 selection would point to a detached SVG
    if (superGridRef.current) {
      const existingContainer = superGridRef.current.getContainer?.()?.node?.();
      const containerInDocument = existingContainer && document.body.contains(existingContainer);

      if (containerInDocument) {
        setSuperGrid(superGridRef.current);
        return;
      } else {
        // Container is detached - destroy old SuperGrid and create new one
        superGridRef.current.destroy();
        superGridRef.current = null;
      }
    }

    contextLogger.debug('[IntegratedLayout] Creating SuperGrid instance');
    const svgSelection = d3.select(svgRef.current) as unknown as d3.Selection<SVGElement, unknown, null, undefined>;
    const superGridRenderer = new SuperGrid(
      svgSelection,
      databaseService,
      {
        columnsPerRow: 4,
        enableHeaders: true,
        enableSelection: true,
        enableKeyboardNavigation: true,
        enableColumnResizing: true
      }
    );

    superGridRef.current = superGridRenderer;
    setSuperGrid(superGridRenderer);

    return () => {
      // Only cleanup on actual unmount, not on re-renders
      // The ref keeps the instance alive
    };
  }, [databaseService]);

  // Import alto-index data on mount (after database is ready)
  useEffect(() => {
    // Prevent multiple imports using ref (avoids re-render race conditions)
    if (importStartedRef.current) return;
    // Wait for database to be ready before importing
    if (!databaseService?.isReady()) return;
    if (altoImported) return;

    // Mark as started immediately to prevent re-entry
    importStartedRef.current = true;

    // Import with stratified sampling across all data types (500 per type minimum)
    importFromPublic({ clearExisting: true, limit: 5000 })
      .then((result) => {
        setAltoImported(true);
        contextLogger.debug('[IntegratedLayout] Alto-index import complete', {
          imported: result.imported,
          skipped: result.skipped,
          errors: result.errors.length,
        });

      })
      .catch((err) => {
        importStartedRef.current = false; // Allow retry on error
        contextLogger.warn('[IntegratedLayout] Alto-index import failed', { error: err.message });
      });
  }, [databaseService, altoImported, importFromPublic]);

  // Load data when SuperGrid initializes or dataset changes
  useEffect(() => {
    if (!superGrid || !altoImported || !svgRef.current || !databaseService?.isReady()) {
      return;
    }

    // CRITICAL: Ensure SuperGrid container points to current SVG element
    // React may have created a new SVG element, but SuperGrid's D3 selection
    // would still point to the old (now detached) element
    superGrid.updateContainer(svgRef.current);

    // Find the dataset configuration
    const dataset = ALTO_DATASETS.find(d => d.id === activeDataset);
    const nodeType = dataset?.nodeType || 'notes';

    contextLogger.debug('[IntegratedLayout] Loading dataset', { activeDataset, nodeType });

    // Reset slider filters when dataset changes
    resetFilters();

    // Load current data for slider filter generation
    // Note: Using string interpolation because execute() doesn't bind params (see operations.ts)
    const dataResult = databaseService.query(
      `SELECT * FROM nodes WHERE node_type = '${nodeType}' AND deleted_at IS NULL LIMIT 5000`,
      []
    );
    setCurrentData(dataResult || []);

    // Query the nodes table filtered by node_type (alto-index data)
    superGrid.query({
      whereClause: `node_type = ? AND deleted_at IS NULL`,
      parameters: [nodeType],
      activeFilters: [],
      isEmpty: false,
    });

    contextLogger.setup('IntegratedLayout: Dataset loaded', {
      dataset: activeDataset,
      nodeType,
    });
  }, [superGrid, activeDataset, altoImported, databaseService, resetFilters]);

  // Re-query SuperGrid when slider filters change
  useEffect(() => {
    if (!superGrid || !svgRef.current || !altoImported) return;

    const dataset = ALTO_DATASETS.find(d => d.id === activeDataset);
    const nodeType = dataset?.nodeType || 'notes';

    // Build the combined WHERE clause
    const { clause: filterClause, params: filterParams } = buildWhereClause();

    let whereClause = `node_type = ? AND deleted_at IS NULL`;
    const parameters: (string | number)[] = [nodeType];

    if (filterClause) {
      whereClause += ` AND ${filterClause}`;
      parameters.push(...filterParams);
    }

    superGrid.query({
      whereClause,
      parameters,
      activeFilters: [],
      isEmpty: false,
    });

    contextLogger.debug('[IntegratedLayout] Slider filters applied', {
      filterClause,
      filterParams,
    });
  }, [superGrid, activeDataset, altoImported, buildWhereClause]);

  // Sync PAFV projection to SuperGrid
  useEffect(() => {
    // Guard: only need superGrid - it already has container reference
    // svgRef.current may be null during React's render cycle even when SuperGrid exists
    if (!superGrid) return;

    // Update container if ref is available (handles React StrictMode remounts)
    if (svgRef.current) {
      superGrid.updateContainer(svgRef.current);
    }

    const projection = mappingsToProjection(pafvState.mappings);
    superGrid.setProjection(projection);

    contextLogger.debug('[IntegratedLayout] PAFV projection synced', {
      mappings: pafvState.mappings.length,
      xAxis: projection.xAxis?.facet || 'none',
      yAxis: projection.yAxis?.facet || 'none',
    });
  }, [superGrid, pafvState.mappings]);

  // Sync density level to SuperGrid
  useEffect(() => {
    if (!superGrid) return;

    superGrid.setDensityLevel(pafvState.densityLevel);

    contextLogger.setup('IntegratedLayout: Density level synced', {
      densityLevel: pafvState.densityLevel,
    });
  }, [superGrid, pafvState.densityLevel]);

  // Sync color encoding to SuperGrid
  useEffect(() => {
    if (!superGrid) return;

    superGrid.setColorEncoding(pafvState.colorEncoding);

    contextLogger.setup('IntegratedLayout: Color encoding synced', {
      property: pafvState.colorEncoding?.property || 'none',
      type: pafvState.colorEncoding?.type || 'none',
    });
  }, [superGrid, pafvState.colorEncoding]);

  // Sync size encoding to SuperGrid
  useEffect(() => {
    if (!superGrid) return;

    superGrid.setSizeEncoding(pafvState.sizeEncoding);

    contextLogger.setup('IntegratedLayout: Size encoding synced', {
      property: pafvState.sizeEncoding?.property || 'none',
      type: pafvState.sizeEncoding?.type || 'none',
    });
  }, [superGrid, pafvState.sizeEncoding]);

  // Loading state
  if (!databaseService?.isReady() || importStatus === 'loading' || importStatus === 'importing') {
    const loadingMessage = importStatus === 'importing'
      ? `Importing alto-index data... ${importProgress}%`
      : importStatus === 'loading'
        ? 'Loading alto-index data...'
        : 'Loading Integrated Layout...';

    return (
      <div className={`h-screen ${bgColor} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className={mutedColor}>{loadingMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={`h-screen flex flex-col ${bgColor} ${textColor}`}>
        {/* Command Bar (top) */}
        <div className={`h-8 ${panelBg} border-b ${borderColor} flex items-center px-4 gap-2`}>
          <span className={`text-xs font-mono ${mutedColor}`}>⌘</span>
          <input
            type="text"
            placeholder="Command palette..."
            className={`
              flex-1 ${isNeXTSTEP ? 'bg-[#2D2D2D]' : 'bg-gray-100'}
              text-xs ${textColor} px-2 py-0.5
              border ${borderColor} rounded
              outline-none focus:border-[#4A90D9]
            `}
          />
          <span className={`text-[10px] ${mutedColor}`}>
            L{pafvState.densityLevel} | {pafvState.mappings.length} axes
          </span>
        </div>

        {/* Dataset Switcher */}
        <div className={`h-10 ${panelBg} border-b ${borderColor} flex items-center px-4 gap-1`}>
          {ALTO_DATASETS.map((dataset) => (
            <button
              key={dataset.id}
              onClick={() => handleDatasetSwitch(dataset.id)}
              className={`
                px-3 py-1 rounded text-xs font-medium transition-colors
                ${activeDataset === dataset.id
                  ? `${activeBtnBg} ${activeBtnText}`
                  : `${inactiveBtnBg} ${inactiveBtnText} hover:opacity-80`
                }
              `}
            >
              <span className="mr-1">{dataset.icon}</span>
              {dataset.label}
            </button>
          ))}
        </div>

        {/* LatchNavigator (6-column LATCH+GRAPH property grid) */}
        <LatchNavigator
          enabledProperties={enabledProperties}
          onPropertyToggle={handlePropertyToggle}
        />

        {/* PafvNavigator (5-well axis assignment with density) */}
        <PafvNavigator enabledProperties={enabledProperties} />

        {/* LATCH*GRAPH Sliders for filtering/tuning */}
        <LatchGraphSliders
          filters={sliderFilters}
          onFilterChange={handleSliderFilterChange}
        />

        {/* SuperGrid Canvas - MAXIMIZED with scroll */}
        <div className="flex-1 min-h-0 overflow-auto relative" style={{ minHeight: '200px' }}>
          <svg
            ref={svgRef}
            style={{ minWidth: '100%', minHeight: '100%', display: 'block' }}
          />

          {/* Empty state overlay */}
          {pafvState.mappings.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`text-center ${mutedColor}`}>
                <p className="text-lg mb-2">No axes assigned</p>
                <p className="text-sm">Drag properties to X or Y planes above</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </DndProvider>
  );
}
