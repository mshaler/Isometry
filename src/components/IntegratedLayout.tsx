import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { LatchNavigator } from './navigator/LatchNavigator';
import { PafvNavigator } from './navigator/PafvNavigator';
// LatchGraphSliders temporarily hidden (Phase 105 milestone)
import { useSliderFilters, type SliderClassification } from './navigator/LatchGraphSliders';
import { SuperGrid } from '../d3/SuperGrid';
import { SuperGridCSS } from './supergrid/SuperGridCSS';
import { headerTreeToAxisConfig } from './supergrid/adapters/headerTreeAdapter';
import { useGridDataCells } from '@/hooks/useGridDataCells';
import { useHeaderDiscovery } from '@/hooks/useHeaderDiscovery';
import { useSQLite } from '@/db/SQLiteProvider';
import type { AxisConfig, DataCell as DataCellType } from './supergrid/types';
import { useDatabaseService, usePAFV } from '@/hooks';
import { mappingsToProjection } from '../types/grid';
import { useTheme } from '@/contexts/ThemeContext';
import { useSelection } from '@/state/SelectionContext';
import { contextLogger } from '../utils/logging/dev-logger';
import { usePropertyClassification } from '@/hooks/data/usePropertyClassification';
import { useAltoIndexImport } from '@/hooks/useAltoIndexImport';
import { NotebookLayout } from './notebook/NotebookLayout';

// Feature flag: CSS Grid SuperGrid (Phase 106)
// Set to true to use new CSS Grid renderer, false for D3.js fallback
const USE_CSS_GRID_SUPERGRID = true;

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
  const { select, clear: clearSelection } = useSelection();
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

  // Dataset switcher state - default to 'notes' (the sample data table)
  const [activeDataset, setActiveDataset] = useState<string>('notes');

  // Layer highlight debug mode - highlights React (blue), D3.js (yellow), CSS (red)
  const [layerHighlightEnabled, setLayerHighlightEnabled] = useState(false);
  const activeNodeType = useMemo(
    () => ALTO_DATASETS.find(d => d.id === activeDataset)?.nodeType || 'notes',
    [activeDataset]
  );

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
  // NOTE: setFilterValue temporarily unused while LatchGraphSliders is hidden (Phase 105)
  const {
    filters: sliderFilters,
    buildWhereClause,
    resetFilters,
  } = useSliderFilters(currentData, sliderClassification);

  // Helper to look up facet info from classification
  const getFacetInfo = useCallback((facetId: string): {
    dataType: 'text' | 'select' | 'multi_select' | 'date' | 'number';
    sourceColumn: string;
  } => {
    if (!classification) return { dataType: 'text', sourceColumn: facetId };
    const allProperties = [
      ...classification.L,
      ...classification.A,
      ...classification.T,
      ...classification.C,
      ...classification.H,
    ];
    const property = allProperties.find(p => p.sourceColumn === facetId || p.id === facetId);

    // Get the actual sourceColumn from classification (e.g., 'modified_at' instead of 'modified')
    const sourceColumn = property?.sourceColumn || facetId;

    // Determine data type
    let dataType: 'text' | 'select' | 'multi_select' | 'date' | 'number' = 'text';
    if (property?.facetType === 'multi_select') dataType = 'multi_select';
    else if (property?.facetType === 'select') dataType = 'select';
    else if (property?.facetType === 'date') dataType = 'date';
    else if (property?.facetType === 'number') dataType = 'number';

    return { dataType, sourceColumn };
  }, [classification]);

  // Extract row and column facets from PAFV mappings
  // Coordinate system: X-Plane = Rows (left headers), Y-Plane = Columns (top headers)
  const rowFacets = useMemo(() => {
    return pafvState.mappings
      .filter(m => m.plane === 'x')
      .map(m => {
        const { dataType, sourceColumn } = getFacetInfo(m.facet);
        return {
          id: m.facet,
          name: m.facet,
          axis: m.axis as 'L' | 'A' | 'T' | 'C' | 'H',
          sourceColumn, // Use actual column from classification (e.g., 'modified_at' not 'modified')
          dataType,
          sortOrder: 'asc' as const,
          // Folder paths should expand into hierarchy levels (BairesDev/Operations → BairesDev, Operations)
          ...(sourceColumn === 'folder' ? { pathSeparator: '/' } : {}),
          // Date facets require timeFormat for SQL date grouping (default: year)
          ...(dataType === 'date' ? { timeFormat: '%Y' } : {}),
        };
      });
  }, [pafvState.mappings, getFacetInfo]);

  const colFacets = useMemo(() => {
    const facets: Array<{
      id: string;
      name: string;
      axis: 'L' | 'A' | 'T' | 'C' | 'H';
      sourceColumn: string;
      dataType: 'text' | 'select' | 'multi_select' | 'date' | 'number';
      sortOrder: 'asc' | 'desc' | 'custom';
      pathSeparator?: string;
      timeFormat?: string;
      options?: string[];
    }> = [];

    for (const m of pafvState.mappings.filter(m => m.plane === 'y')) {
      const { dataType, sourceColumn } = getFacetInfo(m.facet);

      // Date facets automatically expand to Year → Month hierarchy on columns
      if (dataType === 'date') {
        // Year level
        facets.push({
          id: `${m.facet}_year`,
          name: `${m.facet} (Year)`,
          axis: m.axis as 'L' | 'A' | 'T' | 'C' | 'H',
          sourceColumn,
          dataType,
          sortOrder: 'asc' as const, // Chronological: oldest years first (left to right)
          timeFormat: '%Y',
        });
        // Month level - use custom order for chronological sorting
        facets.push({
          id: `${m.facet}_month`,
          name: `${m.facet} (Month)`,
          axis: m.axis as 'L' | 'A' | 'T' | 'C' | 'H',
          sourceColumn,
          dataType,
          sortOrder: 'custom' as const,
          options: ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'],
          timeFormat: '%B',
        });
      } else {
        // Non-date facets pass through unchanged
        facets.push({
          id: m.facet,
          name: m.facet,
          axis: m.axis as 'L' | 'A' | 'T' | 'C' | 'H',
          sourceColumn,
          dataType,
          sortOrder: 'asc' as const,
          ...(sourceColumn === 'folder' ? { pathSeparator: '/' } : {}),
        });
      }
    }

    return facets;
  }, [pafvState.mappings, getFacetInfo]);

  // Get database reference for header discovery
  const { db, reset: resetDatabase } = useSQLite();

  // Header discovery for CSS Grid mode
  // Note: useHeaderDiscovery interface is (db, columnFacets, rowFacets, nodeType)
  const { rowTree, columnTree, isLoading: headersLoading } = useHeaderDiscovery(
    USE_CSS_GRID_SUPERGRID ? db : null,
    USE_CSS_GRID_SUPERGRID ? colFacets : [],
    USE_CSS_GRID_SUPERGRID ? rowFacets : [],
    USE_CSS_GRID_SUPERGRID ? activeNodeType : undefined
  );

  // Adapt HeaderTree to AxisConfig for SuperGridCSS
  const rowAxis: AxisConfig | null = useMemo(() => {
    if (!USE_CSS_GRID_SUPERGRID || !rowTree || rowFacets.length === 0) return null;
    return headerTreeToAxisConfig(rowTree);
  }, [rowTree, rowFacets]);

  const colAxis: AxisConfig | null = useMemo(() => {
    if (!USE_CSS_GRID_SUPERGRID || !columnTree || colFacets.length === 0) return null;
    return headerTreeToAxisConfig(columnTree);
  }, [columnTree, colFacets]);

  // Fetch data cells for CSS Grid mode
  const dataCells = useGridDataCells({
    rowFacets: USE_CSS_GRID_SUPERGRID ? rowFacets : [],
    colFacets: USE_CSS_GRID_SUPERGRID ? colFacets : [],
    whereClause: buildWhereClause().clause || undefined,
    parameters: buildWhereClause().params,
    nodeType: activeNodeType
  });

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
  // NOTE: LatchGraphSliders is temporarily hidden (Phase 105 milestone)
  // The callback would be: (filterId, value) => setFilterValue(filterId, value)

  const runImport = useCallback(async (clearExisting: boolean) => {
    if (!databaseService?.isReady()) return;
    setImportError(null);
    importStartedRef.current = true;
    try {
      // Full import - no limit. clearExisting purges all previous data first.
      const result = await importFromPublic({ clearExisting });
      setAltoImported(true);
      setLastImportedCount(result.imported);
      setDataRevision(prev => prev + 1);
      refreshClassification?.();
      // Log detailed import results including skip reasons
      contextLogger.debug('[IntegratedLayout] Alto-index import complete', {
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors.length,
        reconciliation: result.reconciliation,
      });
      // Also log to console for easy inspection
      console.log('[Import Complete]', {
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors.length,
        reconciliation: result.reconciliation,
        sampleErrors: result.errors.slice(0, 5),
      });

      // Verify database state after import - direct SQL count
      if (db) {
        const countResult = db.exec(`
          SELECT node_type, COUNT(*) as count
          FROM nodes
          WHERE source = 'alto-index'
          GROUP BY node_type
          ORDER BY count DESC
        `);
        const dbCounts: Record<string, number> = {};
        if (countResult[0]) {
          for (const row of countResult[0].values) {
            dbCounts[row[0] as string] = row[1] as number;
          }
        }
        const totalResult = db.exec(`SELECT COUNT(*) FROM nodes WHERE source = 'alto-index'`);
        const totalCount = totalResult[0]?.values[0]?.[0] as number || 0;

        console.log('[Database Verification]', {
          totalNodesInDB: totalCount,
          byNodeType: dbCounts,
          expectedFromImport: result.imported,
          matchesImport: totalCount === result.imported,
        });
      }
    } catch (err) {
      importStartedRef.current = false;
      const message = err instanceof Error ? err.message : 'Import failed';
      setImportError(message);
      contextLogger.warn('[IntegratedLayout] Alto-index import failed', { error: message });
    }
  }, [db, databaseService, importFromPublic]);

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

  // Cell click handler for SuperGridCSS - syncs selection to SelectionContext
  const handleCellClick = useCallback((
    cell: DataCellType | undefined,
    rowPath: string[],
    colPath: string[]
  ) => {
    if (!cell) {
      // Clicked empty cell - clear selection
      clearSelection();
      contextLogger.debug('[IntegratedLayout] Empty cell clicked, selection cleared');
      return;
    }

    // Extract node ID from rawValue
    const nodeData = cell.rawValue as { id: string } | undefined;
    if (!nodeData?.id) return;

    // Update global selection state
    select(nodeData.id);

    contextLogger.debug('[IntegratedLayout] Cell selected', {
      nodeId: nodeData.id,
      rowPath,
      colPath
    });
  }, [select, clearSelection]);

  const handleClearImportedData = useCallback(async () => {
    await clearData();
    setCurrentData([]);
    setAltoImported(false);
    setLastImportedCount(0);
    setImportError(null);
    setDataRevision(prev => prev + 1);
    importStartedRef.current = false;
  }, [clearData]);

  // Full database reset + fresh import (purge everything and start fresh)
  const handleFullResetAndImport = useCallback(async () => {
    setImportError(null);
    setCurrentData([]);
    setAltoImported(false);
    setLastImportedCount(0);
    importStartedRef.current = false;

    try {
      // Step 1: Reset database (clears IndexedDB and creates fresh schema)
      await resetDatabase();
      contextLogger.info('[IntegratedLayout] Database reset complete');

      // Step 2: Refresh property classification (schema changed)
      refreshClassification?.();

      // Step 3: Import all data fresh (no limit)
      const result = await importFromPublic({ clearExisting: true });
      setAltoImported(true);
      setLastImportedCount(result.imported);
      setDataRevision(prev => prev + 1);
      refreshClassification?.();

      contextLogger.info('[IntegratedLayout] Full reset and import complete', {
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors.length,
      });
      // Detailed console log for debugging import issues
      console.log('[Full Reset Import Complete]', {
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors.length,
        reconciliation: result.reconciliation,
        sampleErrors: result.errors.slice(0, 10),
      });

      // Verify database state after import - direct SQL count
      if (db) {
        const countResult = db.exec(`
          SELECT node_type, COUNT(*) as count
          FROM nodes
          WHERE source = 'alto-index'
          GROUP BY node_type
          ORDER BY count DESC
        `);
        const dbCounts: Record<string, number> = {};
        if (countResult[0]) {
          for (const row of countResult[0].values) {
            dbCounts[row[0] as string] = row[1] as number;
          }
        }
        const totalResult = db.exec(`SELECT COUNT(*) FROM nodes WHERE source = 'alto-index'`);
        const totalCount = totalResult[0]?.values[0]?.[0] as number || 0;

        console.log('[Database Verification]', {
          totalNodesInDB: totalCount,
          byNodeType: dbCounts,
          expectedFromImport: result.imported,
          matchesImport: totalCount === result.imported,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reset failed';
      setImportError(message);
      contextLogger.warn('[IntegratedLayout] Full reset failed', { error: message });
    }
  }, [db, resetDatabase, importFromPublic, refreshClassification]);

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
    if (USE_CSS_GRID_SUPERGRID) return; // Skip D3 initialization in CSS Grid mode

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

  // Reset slider filters only when dataset changes.
  useEffect(() => {
    resetFilters();
  }, [activeDataset, resetFilters]);

  // Track last query key to prevent redundant queries when buildWhereClause recreates but returns same result.
  // This breaks the cycle: currentData changes → buildWhereClause recreates → but query key is same → skip re-query.
  const lastQueryKeyRef = useRef<string>('');

  // Unified query orchestration: populate currentData and optionally update D3 SuperGrid.
  // In CSS Grid mode, we still need currentData for slider filter generation.
  useEffect(() => {
    // Database must be ready in both modes
    if (!databaseService?.isReady()) {
      return;
    }

    // In D3 mode, also require superGrid and svgRef
    if (!USE_CSS_GRID_SUPERGRID) {
      if (!superGrid || !svgRef.current) {
        return;
      }
      // CRITICAL: Ensure SuperGrid container points to current SVG element
      // React may have created a new SVG element, but SuperGrid's D3 selection
      // would still point to the old (now detached) element
      superGrid.updateContainer(svgRef.current);
    }

    const { clause: filterClause, params: filterParams } = buildWhereClause();
    let whereClause = `node_type = ? AND deleted_at IS NULL`;
    const parameters: (string | number)[] = [activeNodeType];
    if (filterClause) {
      whereClause += ` AND ${filterClause}`;
      parameters.push(...filterParams);
    }

    // Build a query key to detect duplicate queries
    const queryKey = `${activeDataset}|${whereClause}|${parameters.join(',')}|${dataRevision}`;
    if (queryKey === lastQueryKeyRef.current) {
      // Same query - skip to prevent infinite loop
      return;
    }
    lastQueryKeyRef.current = queryKey;

    // Load current data for slider filter generation + debug status.
    const dataResult = databaseService.query(
      `SELECT n.*,
          (
            SELECT COUNT(*)
            FROM edges e
            WHERE e.source_id = n.id OR e.target_id = n.id
          ) AS graph_degree
       FROM nodes n
       WHERE ${whereClause}
       LIMIT 5000`,
      parameters
    );
    setCurrentData(dataResult || []);

    // In D3 mode, also update SuperGrid
    if (!USE_CSS_GRID_SUPERGRID && superGrid) {
      superGrid.query({
        whereClause,
        parameters,
        activeFilters: [],
        isEmpty: false,
      });
    }

    contextLogger.setup('IntegratedLayout: Unified query executed', {
      mode: USE_CSS_GRID_SUPERGRID ? 'css-grid' : 'd3',
      dataset: activeDataset,
      nodeType: activeNodeType,
      filterClause,
      filterParams,
      rows: dataResult?.length ?? 0,
    });
  }, [superGrid, activeDataset, activeNodeType, buildWhereClause, databaseService, dataRevision]);

  // Sync PAFV projection to SuperGrid
  useEffect(() => {
    // Guard: only need superGrid - it already has container reference
    // svgRef.current may be null during React's render cycle even when SuperGrid exists
    if (!superGrid || !databaseService?.isReady()) return;

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
  }, [superGrid, pafvState.mappings, databaseService]);

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
        <div
          className={`h-8 ${panelBg} border-b ${borderColor} flex items-center px-4 gap-2`}
          data-renderer="react"
          style={layerHighlightEnabled ? { backgroundColor: 'rgba(147, 197, 253, 0.3)', outline: '2px solid rgba(59, 130, 246, 0.5)' } : undefined}
        >
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
        <div
          className={`${panelBg} border-b ${borderColor}`}
          data-renderer="react"
          style={layerHighlightEnabled ? { backgroundColor: 'rgba(147, 197, 253, 0.3)', outline: '2px solid rgba(59, 130, 246, 0.5)' } : undefined}
        >
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
              opacity: isNotebookExpanded ? 1 : 0,
              transition: 'max-height 300ms ease-in-out, opacity 150ms ease-in-out',
              willChange: isNotebookExpanded ? 'max-height, opacity' : 'auto',
              contain: 'layout',
            }}
            className="overflow-hidden"
          >
            <div
              className={`h-[28rem] w-full ${isNeXTSTEP ? 'bg-[#1A1A1A]' : 'bg-gray-50'}`}
              style={{
                // Prevent layout thrashing from content when collapsed
                visibility: isNotebookExpanded ? 'visible' : 'hidden',
                transitionDelay: isNotebookExpanded ? '0ms' : '300ms',
              }}
            >
              <NotebookLayout />
            </div>
          </div>
        </div>

        {/* Dataset Switcher */}
        <div
          className={`h-10 ${panelBg} border-b ${borderColor} flex items-center px-4 gap-1`}
          data-renderer="react"
          style={layerHighlightEnabled ? { backgroundColor: 'rgba(147, 197, 253, 0.3)', outline: '2px solid rgba(59, 130, 246, 0.5)' } : undefined}
        >
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
        <div
          className={`h-8 ${panelBg} border-b ${borderColor} flex items-center justify-between px-4 text-[11px]`}
          data-renderer="react"
          style={layerHighlightEnabled ? { backgroundColor: 'rgba(147, 197, 253, 0.3)', outline: '2px solid rgba(59, 130, 246, 0.5)' } : undefined}
        >
          <div className={`flex items-center gap-3 ${mutedColor}`}>
            <span>Dataset: {activeDataset}</span>
            <span>Rows: {currentData.length}</span>
            <span>Imported: {lastImportedCount}</span>
            <span>Sliders: {sliderFilters.length}</span>
            {importStatus === 'importing' && <span>Importing... {importProgress}%</span>}
            {(importError || importHookError) && <span className="text-red-500">Import failed</span>}
          </div>
          <div className="flex items-center gap-2">
            {/* Layer Highlight Toggle - visualize React/D3/CSS layers */}
            <button
              type="button"
              onClick={() => setLayerHighlightEnabled(prev => !prev)}
              className={`
                px-2 py-0.5 rounded border text-[10px] font-medium transition-colors
                ${layerHighlightEnabled
                  ? 'border-purple-500 bg-purple-100 text-purple-700'
                  : 'border-gray-300 text-gray-500 hover:bg-gray-100'
                }
              `}
              title="Toggle layer highlighting: React=blue, D3=yellow, CSS=red"
            >
              {layerHighlightEnabled ? '🎨 Layers ON' : '🎨 Layers'}
            </button>
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
            <button
              type="button"
              onClick={handleFullResetAndImport}
              className="px-2 py-0.5 rounded border border-red-300 text-red-700 hover:bg-red-50 font-medium"
            >
              Full Reset + Import
            </button>
          </div>
        </div>

        {/* LatchNavigator (6-column LATCH+GRAPH property grid) */}
        <div
          data-renderer="react"
          style={layerHighlightEnabled ? { backgroundColor: 'rgba(147, 197, 253, 0.3)', outline: '2px solid rgba(59, 130, 246, 0.5)' } : undefined}
        >
          <LatchNavigator
            enabledProperties={enabledProperties}
            onPropertyToggle={handlePropertyToggle}
            nodeType={activeNodeType}
          />
        </div>

        {/* PafvNavigator (5-well axis assignment with density) */}
        <div
          data-renderer="react"
          style={layerHighlightEnabled ? { backgroundColor: 'rgba(147, 197, 253, 0.3)', outline: '2px solid rgba(59, 130, 246, 0.5)' } : undefined}
        >
          <PafvNavigator enabledProperties={enabledProperties} nodeType={activeNodeType} />
        </div>

        {/* LATCH*GRAPH Sliders - HIDDEN for now (Phase 105 milestone) */}
        {/* TODO(Phase-105): Re-enable LatchGraphSliders with proper data-driven filtering
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
        */}

        {/* SuperGrid Canvas - MAXIMIZED with scroll */}
        <div
          className="flex-1 min-h-0 overflow-auto relative"
          style={{
            minHeight: '200px',
            ...(layerHighlightEnabled && USE_CSS_GRID_SUPERGRID
              ? { backgroundColor: 'rgba(252, 165, 165, 0.3)', outline: '2px solid rgba(239, 68, 68, 0.5)' }
              : {}),
          }}
          data-renderer={USE_CSS_GRID_SUPERGRID ? 'css' : 'd3'}
        >
          {USE_CSS_GRID_SUPERGRID && rowAxis && colAxis ? (
              <SuperGridCSS
                rowAxis={rowAxis}
                columnAxis={colAxis}
                data={dataCells}
                theme={isNeXTSTEP ? 'nextstep' : 'modern'}
                onCellClick={handleCellClick}
                onHeaderClick={(type, path) => {
                  contextLogger.debug('[IntegratedLayout] Header clicked', { type, path });
                }}
              />
          ) : (
              <svg
                ref={svgRef}
                style={{
                  minWidth: '100%',
                  minHeight: '100%',
                  display: 'block',
                  ...(layerHighlightEnabled
                    ? { backgroundColor: 'rgba(253, 224, 71, 0.3)', outline: '2px solid rgba(234, 179, 8, 0.5)' }
                    : {}),
                }}
              />
          )}

          {/* Overlay states */}
          {(importStatus === 'loading' || importStatus === 'importing' || (USE_CSS_GRID_SUPERGRID && headersLoading)) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/5">
              <div className={`${panelBg} border ${borderColor} rounded px-4 py-3 text-center shadow-sm`}>
                <p className={`text-sm ${textColor}`}>
                  {headersLoading && USE_CSS_GRID_SUPERGRID ? 'Discovering headers...' : 'Importing alto-index data...'}
                </p>
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
