import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
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
import { NotebookLayout } from './notebook/NotebookLayout';

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
  const { state: pafvState, clearFacetFromAllPlanes, resetToDefaults } = usePAFV();
  const databaseService = useDatabaseService();
  const { classification, refresh: refreshClassification } = usePropertyClassification();

  // Alto-index import hook
  const {
    importFromPublic,
    status: importStatus,
    progress: importProgress,
    error: importHookError,
    clearData,
  } = useAltoIndexImport();

  // Current data for slider filter generation
  const [currentData, setCurrentData] = useState<Array<Record<string, unknown>>>([]);

  // Convert PropertyClassification to SliderClassification format
  const sliderClassification: SliderClassification | null = useMemo(() => {
    if (!classification) return null;
    return {
      L: classification.L.map(p => ({ sourceColumn: p.sourceColumn, name: p.name })),
      A: classification.A.map(p => ({ sourceColumn: p.sourceColumn, name: p.name })),
      T: classification.T.map(p => ({ sourceColumn: p.sourceColumn, name: p.name })),
      C: classification.C.map(p => ({ sourceColumn: p.sourceColumn, name: p.name })),
      H: classification.H.map(p => ({ sourceColumn: p.sourceColumn, name: p.name })),
      GRAPH: classification.GRAPH.map(p => ({ sourceColumn: p.sourceColumn, name: p.name })),
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
  const [importError, setImportError] = useState<string | null>(null);
  const [lastImportedCount, setLastImportedCount] = useState(0);
  const [dataRevision, setDataRevision] = useState(0);
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

  // Phase 80-01: Notebook panel expand/collapse state with localStorage persistence
  const [isNotebookExpanded, setIsNotebookExpanded] = useState(() => {
    try {
      return localStorage.getItem('notebook_expanded') === 'true';
    } catch {
      return false; // Collapsed by default
    }
  });

  // Persist notebook panel state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('notebook_expanded', isNotebookExpanded.toString());
    } catch (err) {
      console.warn('Failed to persist notebook expanded state', err);
    }
  }, [isNotebookExpanded]);

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

  const runImport = useCallback(async (clearExisting: boolean) => {
    if (!databaseService?.isReady()) return;
    setImportError(null);
    importStartedRef.current = true;
    try {
      const result = await importFromPublic({ clearExisting, limit: 5000 });
      setAltoImported(true);
      setLastImportedCount(result.imported);
      setDataRevision(prev => prev + 1);
      refreshClassification?.();
      contextLogger.debug('[IntegratedLayout] Alto-index import complete', {
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors.length,
      });
    } catch (err) {
      importStartedRef.current = false;
      const message = err instanceof Error ? err.message : 'Import failed';
      setImportError(message);
      contextLogger.warn('[IntegratedLayout] Alto-index import failed', { error: message });
    }
  }, [databaseService, importFromPublic]);

  const handleRetryImport = useCallback(() => {
    runImport(true);
  }, [runImport]);

  const handleReloadDataset = useCallback(() => {
    setAltoImported(true);
    setImportError(null);
    resetFilters();
    setDataRevision(prev => prev + 1);
    contextLogger.debug('[IntegratedLayout] Dataset reload requested', { dataset: activeDataset });
  }, [activeDataset, resetFilters]);

  const handleResetLayout = useCallback(() => {
    resetToDefaults();
    resetFilters();
    contextLogger.debug('[IntegratedLayout] Layout and filters reset');
  }, [resetToDefaults, resetFilters]);

  const handleClearImportedData = useCallback(async () => {
    await clearData();
    setCurrentData([]);
    setAltoImported(false);
    setLastImportedCount(0);
    setImportError(null);
    setDataRevision(prev => prev + 1);
    importStartedRef.current = false;
  }, [clearData]);

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

    runImport(true);
  }, [databaseService, altoImported, runImport]);

  // Load data when SuperGrid initializes or dataset changes
  useEffect(() => {
    if (!superGrid || !svgRef.current || !databaseService?.isReady()) {
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
    const dataResult = databaseService.query(
      `SELECT n.*,
          (
            SELECT COUNT(*)
            FROM edges e
            WHERE e.source_id = n.id OR e.target_id = n.id
          ) AS graph_degree
       FROM nodes n
       WHERE n.node_type = ? AND n.deleted_at IS NULL
       LIMIT 5000`,
      [nodeType]
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
  }, [superGrid, activeDataset, databaseService, resetFilters, dataRevision]);

  // Re-query SuperGrid when slider filters change
  useEffect(() => {
    if (!superGrid || !svgRef.current || !databaseService?.isReady()) return;

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
  }, [superGrid, activeDataset, buildWhereClause, databaseService, dataRevision]);

  // Sync PAFV projection to SuperGrid
  useEffect(() => {
    // Guard: only need superGrid - it already has container reference
    // svgRef.current may be null during React's render cycle even when SuperGrid exists
    if (!superGrid || !databaseService?.isReady()) return;

    // Update container if ref is available (handles React StrictMode remounts)
    if (svgRef.current) {
      superGrid.updateContainer(svgRef.current);
    }

    const dataset = ALTO_DATASETS.find(d => d.id === activeDataset);
    const nodeType = dataset?.nodeType || 'notes';
    const { clause: filterClause, params: filterParams } = buildWhereClause();
    let whereClause = `node_type = ? AND deleted_at IS NULL`;
    const parameters: (string | number)[] = [nodeType];
    if (filterClause) {
      whereClause += ` AND ${filterClause}`;
      parameters.push(...filterParams);
    }

    // Re-query before applying projection to avoid stale/filtered-out in-memory cards.
    superGrid.query({
      whereClause,
      parameters,
      activeFilters: [],
      isEmpty: false,
    });

    const projection = mappingsToProjection(pafvState.mappings);
    superGrid.setProjection(projection);

    contextLogger.debug('[IntegratedLayout] PAFV projection synced', {
      mappings: pafvState.mappings.length,
      xAxis: projection.xAxis?.facet || 'none',
      yAxis: projection.yAxis?.facet || 'none',
    });
  }, [superGrid, pafvState.mappings, databaseService, activeDataset, buildWhereClause]);

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
  if (!databaseService?.isReady()) {
    const loadingMessage = 'Loading Integrated Layout...';

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

        {/* Phase 80-01: Collapsible Notebook Panel */}
        <div className={`${panelBg} border-b ${borderColor}`}>
          {/* Collapsed Header - always visible */}
          <button
            type="button"
            onClick={() => setIsNotebookExpanded(prev => !prev)}
            className={`
              w-full h-8 px-4 flex items-center justify-between
              hover:bg-opacity-80 transition-colors
              ${isNeXTSTEP ? 'hover:bg-[#2D2D2D]' : 'hover:bg-gray-100'}
            `}
            aria-expanded={isNotebookExpanded}
            aria-controls="notebook-panel"
          >
            <div className="flex items-center gap-2">
              <BookOpen className={`w-4 h-4 ${mutedColor}`} />
              <span className={`text-xs font-medium ${textColor}`}>Notebook</span>
              <span className={`text-[10px] ${mutedColor}`}>
                {isNotebookExpanded ? 'Expanded' : 'Capture / Shell / Preview'}
              </span>
            </div>
            {isNotebookExpanded ? (
              <ChevronUp className={`w-4 h-4 ${mutedColor}`} />
            ) : (
              <ChevronDown className={`w-4 h-4 ${mutedColor}`} />
            )}
          </button>

          {/* Expandable Content Area */}
          <div
            id="notebook-panel"
            style={{
              maxHeight: isNotebookExpanded ? '28rem' : '0',
              transition: 'max-height 300ms ease-in-out',
            }}
            className="overflow-hidden"
          >
            <div className={`h-[28rem] ${isNeXTSTEP ? 'bg-[#1A1A1A]' : 'bg-gray-50'}`}>
              <NotebookLayout />
            </div>
          </div>
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

        {/* Status + Actions */}
        <div className={`h-8 ${panelBg} border-b ${borderColor} flex items-center justify-between px-4 text-[11px]`}>
          <div className={`flex items-center gap-3 ${mutedColor}`}>
            <span>Dataset: {activeDataset}</span>
            <span>Rows: {currentData.length}</span>
            <span>Imported: {lastImportedCount}</span>
            <span>Sliders: {sliderFilters.length}</span>
            {importStatus === 'importing' && <span>Importing... {importProgress}%</span>}
            {(importError || importHookError) && <span className="text-red-500">Import failed</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReloadDataset}
              className="px-2 py-0.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Reload Dataset
            </button>
            <button
              type="button"
              onClick={handleResetLayout}
              className="px-2 py-0.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Reset Layout
            </button>
            <button
              type="button"
              onClick={handleRetryImport}
              className="px-2 py-0.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              Re-import
            </button>
            <button
              type="button"
              onClick={handleClearImportedData}
              className="px-2 py-0.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Clear Imported
            </button>
          </div>
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
          emptyStateMessage={
            importStatus === 'importing'
              ? 'Analyzing imported data to build slider controls...'
              : 'No time/hierarchy ranges available yet. Try another dataset or re-import.'
          }
          onResetFilters={resetFilters}
        />

        {/* SuperGrid Canvas - MAXIMIZED with scroll */}
        <div className="flex-1 min-h-0 overflow-auto relative" style={{ minHeight: '200px' }}>
          <svg
            ref={svgRef}
            style={{ minWidth: '100%', minHeight: '100%', display: 'block' }}
          />

          {/* Overlay states */}
          {(importStatus === 'loading' || importStatus === 'importing') && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/5">
              <div className={`${panelBg} border ${borderColor} rounded px-4 py-3 text-center shadow-sm`}>
                <p className={`text-sm ${textColor}`}>Importing alto-index data...</p>
                <p className={`text-xs ${mutedColor}`}>{importProgress}% complete</p>
              </div>
            </div>
          )}

          {(importError || importHookError) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`${panelBg} border ${borderColor} rounded px-4 py-3 text-center shadow-sm max-w-md`}>
                <p className="text-sm text-red-500 mb-1">Import failed</p>
                <p className={`text-xs ${mutedColor} mb-3`}>
                  {importError || importHookError || 'Unable to load alto-index data.'}
                </p>
                <button
                  type="button"
                  onClick={handleRetryImport}
                  className="px-3 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 text-xs"
                >
                  Retry Import
                </button>
              </div>
            </div>
          )}

          {currentData.length === 0 && importStatus !== 'importing' && !importError && !importHookError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`${panelBg} border ${borderColor} rounded px-4 py-3 text-center shadow-sm`}>
                <p className={`text-sm ${textColor} mb-1`}>No cards in this dataset</p>
                <p className={`text-xs ${mutedColor} mb-3`}>Switch datasets or run a fresh import.</p>
                <button
                  type="button"
                  onClick={handleRetryImport}
                  className="px-3 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 text-xs"
                >
                  Import Data
                </button>
              </div>
            </div>
          )}

          {pafvState.mappings.length === 0 && currentData.length > 0 && (
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
