import { useState, useEffect, useCallback, useRef } from 'react';
import { usePAFV, type Wells } from '../../contexts/PAFVContext';
import type { Chip } from '../../types/pafv';
import { useMockData } from '../data/useMockData';
import type { Node } from '../../types/node';
import * as d3 from 'd3';
import { createScaleSystem, extractFieldValue, type ScaleSystemConfig, type HierarchicalScale } from '../../utils/d3-visualization/d3Scales';

// ============================================================================
// Type Definitions
// ============================================================================

export interface Viewport {
  x: number;           // Left bound
  y: number;           // Top bound
  width: number;       // Visible width
  height: number;      // Visible height
  scale: number;       // Zoom level
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CellData {
  nodes: Node[];
  bounds: Rect;
  rowKey: string;
  colKey: string;
  rowPath: string[];
  colPath: string[];
  isEmpty: boolean;
}

export interface GroupedData {
  cells: Map<string, CellData>;
  rowKeys: string[];
  colKeys: string[];
  rowDomains: Map<string, unknown[]>;
  colDomains: Map<string, unknown[]>;
}

export interface D3ScaleSystem {
  x: HierarchicalScale;
  y: HierarchicalScale;
  color: d3.ScaleOrdinal<string, string>;
  size: d3.ScaleLinear<number, number>;
}

export interface RenderCommands {
  cells: CellDrawCommand[];
  headers: HeaderDrawCommand[];
}

export interface CellDrawCommand {
  type: 'cell';
  bounds: Rect;
  nodes: Node[];
  rowKey: string;
  colKey: string;
  style: CellStyle;
}

export interface HeaderDrawCommand {
  type: 'header';
  bounds: Rect;
  label: string;
  axis: 'x' | 'y';
  level: number;
}

export interface CellStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

export interface PerformanceMetrics {
  dataTransform: number;
  scaleGeneration: number;
  layoutCalculation: number;
  renderPrep: number;
  totalPipeline: number;
  memoryUsage: number;
  nodeCount: number;
  cellCount: number;
}

export interface D3CanvasState {
  rawData: Node[];
  groupedData: GroupedData;
  scaleSystem: D3ScaleSystem;
  viewport: Viewport;
  renderCommands: RenderCommands;
  performance: PerformanceMetrics;
  error: string | null;
  loading: boolean;
}

interface StateChanges {
  data: boolean;
  pafv: boolean;
  viewport: boolean;
}

// ============================================================================
// Field Mapping & Extraction
// ============================================================================

// Use extractFieldValue from d3Scales utility, but ensure string output for keys
const extractFieldValueAsString = (node: Node, chip: Chip): string => {
  const value = extractFieldValue(node, chip);
  return String(value);
};

const createCompositeKey = (node: Node, chips: Chip[]): string => {
  return chips.map(chip => extractFieldValueAsString(node, chip)).join('|');
};

// ============================================================================
// Performance Monitoring
// ============================================================================

class PerformanceMonitor {
  private startTimes: Map<string, number> = new Map();
  private durations: Map<string, number> = new Map();

  start(operation: string): void {
    this.startTimes.set(operation, performance.now());
  }

  end(operation: string): number {
    const startTime = this.startTimes.get(operation);
    if (!startTime) return 0;

    const duration = performance.now() - startTime;
    this.durations.set(operation, duration);
    return duration;
  }

  getDuration(operation: string): number {
    return this.durations.get(operation) || 0;
  }

  getMetrics(): Pick<PerformanceMetrics, 'dataTransform' | 'scaleGeneration' | 'layoutCalculation' | 'renderPrep'> {
    return {
      dataTransform: this.getDuration('dataTransform'),
      scaleGeneration: this.getDuration('scaleGeneration'),
      layoutCalculation: this.getDuration('layoutCalculation'),
      renderPrep: this.getDuration('renderPrep'),
    };
  }

  getMemoryUsage(): number {
    const memory = (performance as { memory?: { usedJSHeapSize: number } }).memory;
    return memory ? memory.usedJSHeapSize / 1024 / 1024 : 0; // MB
  }
}

// ============================================================================
// Data Pipeline Stages
// ============================================================================

// Stage 1: Data source (handled by useMockData)

// Stage 2: PAFV Transform
const transformPAFVData = (nodes: Node[], wells: Wells): GroupedData => {
  const rowChips = wells.rows.length > 0 ? wells.rows : [{ id: 'folder', label: 'Folder', hasCheckbox: false }];
  const colChips = wells.columns.length > 0 ? wells.columns : [{ id: 'year', label: 'Year', hasCheckbox: false }];

  const cells = new Map<string, CellData>();
  const rowKeys = new Set<string>();
  const colKeys = new Set<string>();

  // Group nodes by row and column combinations
  nodes.forEach(node => {
    const rowKey = createCompositeKey(node, rowChips);
    const colKey = createCompositeKey(node, colChips);
    const cellKey = `${colKey}||${rowKey}`;

    rowKeys.add(rowKey);
    colKeys.add(colKey);

    if (!cells.has(cellKey)) {
      cells.set(cellKey, {
        nodes: [],
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        rowKey,
        colKey,
        rowPath: rowKey.split('|'),
        colPath: colKey.split('|'),
        isEmpty: true
      });
    }

    const cell = cells.get(cellKey)!;
    cell.nodes.push(node);
    cell.isEmpty = false;
  });

  // Create domain maps for scale generation
  const rowDomains = new Map<string, unknown[]>();
  const colDomains = new Map<string, unknown[]>();

  rowChips.forEach((chip: Chip, index: number) => {
    const values = Array.from(rowKeys).map(key => key.split('|')[index]);
    rowDomains.set(chip.id, Array.from(new Set(values)).sort());
  });

  colChips.forEach((chip: Chip, index: number) => {
    const values = Array.from(colKeys).map(key => key.split('|')[index]);
    colDomains.set(chip.id, Array.from(new Set(values)).sort());
  });

  return {
    cells,
    rowKeys: Array.from(rowKeys).sort(),
    colKeys: Array.from(colKeys).sort(),
    rowDomains,
    colDomains
  };
};

// Stage 3: Scale Generation
const generateScales = (
  _groupedData: GroupedData,
  viewport: Viewport,
  rowChips: Chip[],
  colChips: Chip[],
  nodes: Node[]
): D3ScaleSystem => {
  const systemConfig: ScaleSystemConfig = {
    width: viewport.width,
    height: viewport.height,
    padding: {
      top: 60,    // Space for column headers
      right: 20,
      bottom: 20,
      left: 120   // Space for row headers
    },
    headerHeights: {
      column: 30,
      row: 100
    }
  };

  return createScaleSystem(rowChips, colChips, nodes, systemConfig);
};

// Stage 4: Layout Calculation
const calculateLayout = (groupedData: GroupedData, scaleSystem: D3ScaleSystem): GroupedData => {
  const updatedCells = new Map(groupedData.cells);

  updatedCells.forEach((cell) => {
    const x = scaleSystem.x.composite(cell.colKey) || 0;
    const y = scaleSystem.y.composite(cell.rowKey) || 0;
    const width = scaleSystem.x.composite.bandwidth();
    const height = scaleSystem.y.composite.bandwidth();

    cell.bounds = { x, y, width, height };
  });

  return {
    ...groupedData,
    cells: updatedCells
  };
};

// Stage 5: Render Preparation
const prepareRenderCommands = (groupedData: GroupedData): RenderCommands => {
  const cells: CellDrawCommand[] = [];

  groupedData.cells.forEach((cell) => {
    const nodeCount = cell.nodes.length;
    const style: CellStyle = {
      fill: nodeCount === 0 ? '#f9f9f9' : '#e3f2fd',
      stroke: '#ccc',
      strokeWidth: 1,
      opacity: nodeCount === 0 ? 0.3 : Math.min(1, 0.3 + (nodeCount / 5))
    };

    cells.push({
      type: 'cell',
      bounds: cell.bounds,
      nodes: cell.nodes,
      rowKey: cell.rowKey,
      colKey: cell.colKey,
      style
    });
  });

  // Headers will be implemented in Task 3
  const headers: HeaderDrawCommand[] = [];

  return { cells, headers };
};

// ============================================================================
// Main Hook
// ============================================================================

export function useD3Canvas(_containerRef?: React.RefObject<HTMLElement>): {
  canvasState: D3CanvasState;
  performance: PerformanceMetrics;
  error: string | null;
  updateViewport: (viewport: Partial<Viewport>) => void;
  nativeRenderingCapable: boolean;
} {
  const { data: nodes, loading, error: dataError } = useMockData();
  const { wells } = usePAFV();
  const monitorRef = useRef(new PerformanceMonitor());

  // Native rendering capability state
  const [nativeRenderingCapable, setNativeRenderingCapable] = useState(false);

  // Check for native rendering capability
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any)._isometryBridge?.d3canvas) {
      setNativeRenderingCapable(true);
    }

    // Listen for bridge ready event
    const handleBridgeReady = () => {
      setNativeRenderingCapable(!!(window as any)._isometryBridge?.d3canvas);
    };

    window.addEventListener('isometry-bridge-ready', handleBridgeReady);
    return () => window.removeEventListener('isometry-bridge-ready', handleBridgeReady);
  }, []);

  // Canvas state
  const [canvasState, setCanvasState] = useState<D3CanvasState>(() => ({
    rawData: [],
    groupedData: {
      cells: new Map(),
      rowKeys: [],
      colKeys: [],
      rowDomains: new Map(),
      colDomains: new Map()
    },
    scaleSystem: {
      x: {
        levels: [],
        composite: d3.scaleBand(),
        totalHeight: 0,
        totalWidth: 0
      },
      y: {
        levels: [],
        composite: d3.scaleBand(),
        totalHeight: 0,
        totalWidth: 0
      },
      color: d3.scaleOrdinal(),
      size: d3.scaleLinear()
    },
    viewport: {
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      scale: 1
    },
    renderCommands: { cells: [], headers: [] },
    performance: {
      dataTransform: 0,
      scaleGeneration: 0,
      layoutCalculation: 0,
      renderPrep: 0,
      totalPipeline: 0,
      memoryUsage: 0,
      nodeCount: 0,
      cellCount: 0
    },
    error: null,
    loading: false
  }));

  // Previous state for change detection
  const prevStateRef = useRef({ nodes: [] as Node[], wells: wells });

  // Detect changes
  const detectChanges = useCallback((newNodes: Node[], newWells: Wells): StateChanges => {
    const prev = prevStateRef.current;
    return {
      data: prev.nodes !== newNodes,
      pafv: JSON.stringify(prev.wells) !== JSON.stringify(newWells),
      viewport: false // Will be handled separately
    };
  }, []);

  // Update viewport
  const updateViewport = useCallback((newViewport: Partial<Viewport>) => {
    setCanvasState(prev => ({
      ...prev,
      viewport: { ...prev.viewport, ...newViewport }
    }));
  }, []);

  // Process data through pipeline
  const processDataPipeline = useCallback((
    inputNodes: Node[],
    inputWells: Wells,
    viewport: Viewport
  ): D3CanvasState => {
    const monitor = monitorRef.current;

    monitor.start('totalPipeline');

    try {
      // Stage 2: PAFV Transform
      monitor.start('dataTransform');
      const groupedData = transformPAFVData(inputNodes, inputWells);
      monitor.end('dataTransform');

      // Stage 3: Scale Generation
      monitor.start('scaleGeneration');
      const rowChips = inputWells.rows.length > 0 ? inputWells.rows : [{ id: 'folder', label: 'Folder', hasCheckbox: false }];
      const colChips = inputWells.columns.length > 0 ? inputWells.columns : [{ id: 'year', label: 'Year', hasCheckbox: false }];
      const scaleSystem = generateScales(groupedData, viewport, rowChips, colChips, inputNodes);
      monitor.end('scaleGeneration');

      // Stage 4: Layout Calculation
      monitor.start('layoutCalculation');
      const positionedData = calculateLayout(groupedData, scaleSystem);
      monitor.end('layoutCalculation');

      // Stage 5: Render Preparation
      monitor.start('renderPrep');
      const renderCommands = prepareRenderCommands(positionedData);
      monitor.end('renderPrep');

      monitor.end('totalPipeline');

      const baseMetrics = monitor.getMetrics();
      const performanceMetrics: PerformanceMetrics = {
        dataTransform: baseMetrics.dataTransform,
        scaleGeneration: baseMetrics.scaleGeneration,
        layoutCalculation: baseMetrics.layoutCalculation,
        renderPrep: baseMetrics.renderPrep,
        memoryUsage: monitor.getMemoryUsage(),
        nodeCount: inputNodes.length,
        cellCount: positionedData.cells.size,
        totalPipeline: monitor.getDuration('totalPipeline')
      };

      return {
        rawData: inputNodes,
        groupedData: positionedData,
        scaleSystem,
        viewport,
        renderCommands,
        performance: performanceMetrics,
        error: null,
        loading: false
      };

    } catch (error) {
      console.error('D3 Canvas pipeline error:', error);
      monitor.end('totalPipeline');

      return {
        rawData: inputNodes,
        groupedData: {
          cells: new Map(),
          rowKeys: [],
          colKeys: [],
          rowDomains: new Map(),
          colDomains: new Map()
        },
        scaleSystem: {
          x: {
            levels: [],
            composite: d3.scaleBand(),
            totalHeight: 0,
            totalWidth: 0
          },
          y: {
            levels: [],
            composite: d3.scaleBand(),
            totalHeight: 0,
            totalWidth: 0
          },
          color: d3.scaleOrdinal(),
          size: d3.scaleLinear()
        },
        viewport,
        renderCommands: { cells: [], headers: [] },
        performance: {
          dataTransform: monitor.getDuration('dataTransform'),
          scaleGeneration: monitor.getDuration('scaleGeneration'),
          layoutCalculation: monitor.getDuration('layoutCalculation'),
          renderPrep: monitor.getDuration('renderPrep'),
          memoryUsage: monitor.getMemoryUsage(),
          nodeCount: inputNodes.length,
          cellCount: 0,
          totalPipeline: monitor.getDuration('totalPipeline')
        },
        error: error instanceof Error ? error.message : 'Unknown pipeline error',
        loading: false
      };
    }
  }, []);

  // Main effect - process data when inputs change
  useEffect(() => {
    if (loading || !nodes) {
      setCanvasState(prev => ({ ...prev, loading: true, error: null }));
      return;
    }

    if (dataError) {
      setCanvasState(prev => ({ ...prev, error: dataError.message, loading: false }));
      return;
    }

    const changes = detectChanges(nodes, wells);

    if (changes.data || changes.pafv || canvasState.rawData.length === 0) {
      // Full pipeline reprocessing needed
      const newState = processDataPipeline(nodes, wells, canvasState.viewport);
      setCanvasState(newState);

      // Update previous state reference
      prevStateRef.current = { nodes, wells };
    }
  }, [
    nodes, wells, loading, dataError, canvasState.viewport,
    processDataPipeline, detectChanges, canvasState.rawData.length
  ]);

  // Viewport change effect
  useEffect(() => {
    if (canvasState.rawData.length > 0) {
      const newState = processDataPipeline(canvasState.rawData, wells, canvasState.viewport);
      setCanvasState(newState);
    }
  }, [canvasState.viewport.width, canvasState.viewport.height]);

  // Development logging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && canvasState.performance.totalPipeline > 0) {
      console.warn('D3 Canvas Pipeline Performance:', {
        total: `${canvasState.performance.totalPipeline.toFixed(2)}ms`,
        stages: {
          transform: `${canvasState.performance.dataTransform.toFixed(2)}ms`,
          scales: `${canvasState.performance.scaleGeneration.toFixed(2)}ms`,
          layout: `${canvasState.performance.layoutCalculation.toFixed(2)}ms`,
          render: `${canvasState.performance.renderPrep.toFixed(2)}ms`
        },
        data: {
          nodes: canvasState.performance.nodeCount,
          cells: canvasState.performance.cellCount,
          memory: `${canvasState.performance.memoryUsage.toFixed(1)}MB`
        }
      });
    }
  }, [canvasState.performance]);

  return {
    canvasState,
    performance: canvasState.performance,
    error: canvasState.error || dataError?.message || null,
    updateViewport,
    nativeRenderingCapable
  };
}