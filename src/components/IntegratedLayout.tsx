import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { NavigatorToolbar } from './NavigatorToolbar';
import { LatchNavigator } from './navigator/LatchNavigator';
import { PafvNavigator } from './navigator/PafvNavigator';
import { SuperGrid } from '../d3/SuperGrid';
import { useDatabaseService, usePAFV } from '@/hooks';
import { mappingsToProjection } from '../types/grid';
import { useTheme } from '@/contexts/ThemeContext';
import { LATCHFilterService } from '../services/query/LATCHFilterService';
import { contextLogger } from '../utils/logging/dev-logger';

/**
 * IntegratedLayout - Unified Navigator + SuperGrid layout
 *
 * Vertical stack layout matching Figma design:
 * ┌─────────────────────────────────────────────┐
 * │ Toolbar (Apps/Views/Datasets)               │
 * ├─────────────────────────────────────────────┤
 * │ LatchNavigator (6-column LATCH+GRAPH grid)  │
 * ├─────────────────────────────────────────────┤
 * │ PafvNavigator (5-well axis assignment)      │
 * ├─────────────────────────────────────────────┤
 * │ SuperGrid (D3 canvas) ← MAXIMIZED           │
 * ├─────────────────────────────────────────────┤
 * │ Command Bar                                 │
 * └─────────────────────────────────────────────┘
 *
 * Phase 58-02: Navigator redesign to match Figma specs
 */
export function IntegratedLayout() {
  const { theme } = useTheme();
  const { state: pafvState } = usePAFV();
  const databaseService = useDatabaseService();

  // SuperGrid refs and state
  const svgRef = useRef<SVGSVGElement>(null);
  const [superGrid, setSuperGrid] = useState<SuperGrid | null>(null);
  const [filterService] = useState(() => new LATCHFilterService());

  // Theme-aware colors
  const isNeXTSTEP = theme === 'NeXTSTEP';
  const bgColor = isNeXTSTEP ? 'bg-[#1E1E1E]' : 'bg-gray-50';
  const borderColor = isNeXTSTEP ? 'border-[#3A3A3A]' : 'border-gray-200';
  const textColor = isNeXTSTEP ? 'text-[#E0E0E0]' : 'text-gray-900';
  const mutedColor = isNeXTSTEP ? 'text-[#999]' : 'text-gray-500';
  const panelBg = isNeXTSTEP ? 'bg-[#252525]' : 'bg-white';

  // Initialize SuperGrid
  useEffect(() => {
    if (!svgRef.current || !databaseService) return;

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

    setSuperGrid(superGridRenderer);

    // Load initial data
    const filterCompilation = filterService.compileToSQL();
    superGridRenderer.query(filterCompilation);

    return () => {
      setSuperGrid(null);
    };
  }, [databaseService, filterService]);

  // Sync PAFV projection to SuperGrid
  useEffect(() => {
    if (!superGrid) return;

    const projection = mappingsToProjection(pafvState.mappings);
    superGrid.setProjection(projection);

    contextLogger.setup('IntegratedLayout: PAFV projection synced', {
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
  if (!databaseService?.isReady()) {
    return (
      <div className={`h-screen ${bgColor} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className={mutedColor}>Loading Integrated Layout...</p>
        </div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={`h-screen flex flex-col ${bgColor} ${textColor}`}>
        {/* Toolbar (Apps/Views/Datasets dropdowns) */}
        <NavigatorToolbar />

        {/* LatchNavigator (6-column LATCH+GRAPH property grid) */}
        <LatchNavigator />

        {/* PafvNavigator (5-well axis assignment with density) */}
        <PafvNavigator />

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

        {/* Command Bar */}
        <div className={`h-8 ${panelBg} border-t ${borderColor} flex items-center px-4 gap-2`}>
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
      </div>
    </DndProvider>
  );
}
