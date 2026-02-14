/**
 * Grid Continuum Controller - Polymorphic Data Projection System
 *
 * Implements the Grid Continuum concept: same data, different PAFV axis allocations.
 * Gallery (0) → List (1) → Kanban (1 facet) → Grid (2) → SuperGrid (n)
 *
 * This is the core innovation of SuperGrid: view transitions are axis remappings,
 * not data changes. The SQL query result stays the same, but the spatial projection
 * changes based on which LATCH axes are allocated to which planes.
 */

import type { Node } from '@/types/node';
import type { LATCHAxis, AxisMapping, Plane } from '@/types/pafv';
import type { GridContinuumMode } from '@/types/view';

// Layout types for different projections
export type ProjectionLayout =
  | 'masonry'           // Gallery: position-only
  | 'vertical-hierarchy' // List: single axis vertical
  | 'column-groups'     // Kanban: facet-based columns
  | 'matrix'            // Grid: 2D row × column
  | 'nested-headers';   // SuperGrid: n-dimensional

// Cell represents a projected data container
export interface ProjectionCell {
  id: string;
  nodes: Node[];
  position: { x: number; y: number };
  size?: { width: number; height: number };
  rowKey?: string;
  columnKey?: string;
  depth?: number; // For SuperGrid z-axis
}

// Projection result from Grid Continuum Controller
export interface DataProjection {
  mode: GridContinuumMode;
  axisCount: number;
  mappings: AxisMapping[];
  layout: ProjectionLayout;
  cells: ProjectionCell[];
  rows?: string[];     // Row headers for grid/supergrid
  columns?: string[];  // Column headers for kanban/grid/supergrid
  layers?: string[];   // Z-axis layers for supergrid
}

// Transition event for mode changes
export interface ModeTransitionEvent {
  fromMode: GridContinuumMode;
  toMode: GridContinuumMode;
  preservedMappings: AxisMapping[];
  timestamp: number;
}

// Event handler for mode transitions
export type ModeTransitionHandler = (event: ModeTransitionEvent) => void;

/**
 * GridContinuumController - Core implementation of polymorphic data projection
 */
export class GridContinuumController {
  private currentMode: GridContinuumMode = 'gallery';
  private axisMappings: Map<Plane, AxisMapping> = new Map();
  private transitionHandlers: ModeTransitionHandler[] = [];

  // Available modes in order of axis complexity
  private readonly MODES: GridContinuumMode[] = [
    'gallery', 'list', 'kanban', 'grid', 'supergrid'
  ];

  /**
   * Get all available Grid Continuum modes
   */
  getAvailableModes(): GridContinuumMode[] {
    return [...this.MODES];
  }

  /**
   * Get current mode
   */
  getCurrentMode(): GridContinuumMode {
    return this.currentMode;
  }

  /**
   * Set Grid Continuum mode with transition event
   */
  setMode(mode: GridContinuumMode): void {
    if (mode === this.currentMode) return;

    const transitionEvent: ModeTransitionEvent = {
      fromMode: this.currentMode,
      toMode: mode,
      preservedMappings: Array.from(this.axisMappings.values()),
      timestamp: Date.now()
    };

    this.currentMode = mode;

    // Emit transition event
    this.transitionHandlers.forEach(handler => handler(transitionEvent));
  }

  /**
   * Set axis mapping for PAFV projection
   */
  setAxisMapping(plane: Plane, axis: LATCHAxis, facet: string): void {
    const mapping: AxisMapping = { plane, axis, facet };
    this.axisMappings.set(plane, mapping);
  }

  /**
   * Get axis mapping for a specific plane
   */
  getAxisMapping(plane: Plane): AxisMapping | undefined {
    return this.axisMappings.get(plane);
  }

  /**
   * Register mode transition event handler
   */
  onModeTransition(handler: ModeTransitionHandler): void {
    this.transitionHandlers.push(handler);
  }

  /**
   * Core method: Project nodes based on current mode and axis mappings
   */
  getProjection(nodes: Node[]): DataProjection {
    const activeMappings = this.getActiveMappings();

    switch (this.currentMode) {
      case 'gallery':
        return this.projectGallery(nodes, activeMappings);
      case 'list':
        return this.projectList(nodes, activeMappings);
      case 'kanban':
        return this.projectKanban(nodes, activeMappings);
      case 'grid':
        return this.projectGrid(nodes, activeMappings);
      case 'supergrid':
        return this.projectSuperGrid(nodes, activeMappings);
    }
  }

  /**
   * Get active axis mappings for current mode
   */
  private getActiveMappings(): AxisMapping[] {
    return Array.from(this.axisMappings.values());
  }

  /**
   * Gallery mode: 0 axes - position-only layout (masonry)
   */
  private projectGallery(nodes: Node[], _mappings: AxisMapping[]): DataProjection {
    return {
      mode: 'gallery',
      axisCount: 0,
      mappings: [],
      layout: 'masonry',
      cells: [{
        id: 'gallery-all',
        nodes: nodes,
        position: { x: 0, y: 0 }
      }]
    };
  }

  /**
   * List mode: 1 axis - vertical hierarchy
   */
  private projectList(nodes: Node[], mappings: AxisMapping[]): DataProjection {
    const yMapping = mappings.find(m => m.plane === 'y');

    if (!yMapping) {
      // Fallback to flat list
      return {
        mode: 'list',
        axisCount: 0,
        mappings: [],
        layout: 'vertical-hierarchy',
        cells: [{
          id: 'list-all',
          nodes: nodes,
          position: { x: 0, y: 0 }
        }]
      };
    }

    // Group nodes by Y axis values
    const groups = this.groupNodesByMapping(nodes, yMapping);
    const cells: ProjectionCell[] = [];

    Object.entries(groups).forEach(([key, nodeGroup], index) => {
      cells.push({
        id: `list-${key}`,
        nodes: nodeGroup,
        position: { x: 0, y: index * 100 }, // Vertical stacking
        rowKey: key
      });
    });

    return {
      mode: 'list',
      axisCount: 1,
      mappings: [yMapping],
      layout: 'vertical-hierarchy',
      cells,
      rows: Object.keys(groups)
    };
  }

  /**
   * Kanban mode: 1 facet - column grouping
   */
  private projectKanban(nodes: Node[], mappings: AxisMapping[]): DataProjection {
    const xMapping = mappings.find(m => m.plane === 'x');

    if (!xMapping) {
      // Fallback to single column
      return {
        mode: 'kanban',
        axisCount: 0,
        mappings: [],
        layout: 'column-groups',
        cells: [{
          id: 'kanban-default',
          nodes: nodes,
          position: { x: 0, y: 0 },
          columnKey: 'default'
        }],
        columns: ['default']
      };
    }

    // Group nodes by X axis (columns)
    const groups = this.groupNodesByMapping(nodes, xMapping);
    const cells: ProjectionCell[] = [];
    const columns = Object.keys(groups);

    Object.entries(groups).forEach(([key, nodeGroup], index) => {
      cells.push({
        id: `kanban-${key}`,
        nodes: nodeGroup,
        position: { x: index * 200, y: 0 }, // Horizontal columns
        columnKey: key
      });
    });

    return {
      mode: 'kanban',
      axisCount: 1,
      mappings: [xMapping],
      layout: 'column-groups',
      cells,
      columns
    };
  }

  /**
   * Grid mode: 2 axes - matrix rows × columns
   */
  private projectGrid(nodes: Node[], mappings: AxisMapping[]): DataProjection {
    const xMapping = mappings.find(m => m.plane === 'x');
    const yMapping = mappings.find(m => m.plane === 'y');

    if (!xMapping || !yMapping) {
      // Fallback to single cell
      return {
        mode: 'grid',
        axisCount: mappings.length,
        mappings,
        layout: 'matrix',
        cells: [{
          id: 'grid-default',
          nodes: nodes,
          position: { x: 0, y: 0 }
        }]
      };
    }

    // Create 2D matrix projection
    const xGroups = this.groupNodesByMapping(nodes, xMapping);
    const yGroups = this.groupNodesByMapping(nodes, yMapping);
    const cells: ProjectionCell[] = [];

    const columns = Object.keys(xGroups);
    const rows = Object.keys(yGroups);

    // Create cell for each row × column intersection
    rows.forEach((rowKey, rowIndex) => {
      columns.forEach((colKey, colIndex) => {
        const cellNodes = nodes.filter(node =>
          this.getNodeValue(node, yMapping) === rowKey &&
          this.getNodeValue(node, xMapping) === colKey
        );

        if (cellNodes.length > 0) {
          cells.push({
            id: `grid-${rowKey}-${colKey}`,
            nodes: cellNodes,
            position: { x: colIndex * 150, y: rowIndex * 100 },
            rowKey,
            columnKey: colKey
          });
        }
      });
    });

    return {
      mode: 'grid',
      axisCount: 2,
      mappings: [xMapping, yMapping],
      layout: 'matrix',
      cells,
      rows,
      columns
    };
  }

  /**
   * SuperGrid mode: n axes - nested PAFV headers with z-axis depth
   */
  private projectSuperGrid(nodes: Node[], mappings: AxisMapping[]): DataProjection {
    // For now, start with grid projection and add z-axis support
    const baseProjection = this.projectGrid(nodes, mappings);

    // Add z-axis mapping if available
    const zMapping = mappings.find(m => m.plane === 'color' || m.plane === 'size');
    if (zMapping) {
      const zGroups = this.groupNodesByMapping(nodes, zMapping);
      baseProjection.layers = Object.keys(zGroups);
    }

    return {
      ...baseProjection,
      mode: 'supergrid',
      axisCount: mappings.length,
      layout: 'nested-headers'
    };
  }

  /**
   * Group nodes by a specific axis mapping
   */
  private groupNodesByMapping(nodes: Node[], mapping: AxisMapping): Record<string, Node[]> {
    const groups: Record<string, Node[]> = {};

    nodes.forEach(node => {
      const value = this.getNodeValue(node, mapping);
      if (!groups[value]) {
        groups[value] = [];
      }
      groups[value].push(node);
    });

    return groups;
  }

  /**
   * Extract node value for a given axis mapping
   */
  private getNodeValue(node: Node, mapping: AxisMapping): string {
    switch (mapping.axis) {
      case 'time': {
        const date = new Date(node.createdAt);
        if (mapping.facet === 'year') return date.getFullYear().toString();
        if (mapping.facet === 'month') return date.toLocaleDateString('en-US', { month: 'long' });
        return date.getFullYear().toString();
      }
      case 'category':
        if (mapping.facet === 'status') return node.status || 'Unknown';
        if (mapping.facet === 'folder') return node.folder || 'Unknown';
        return node.folder || 'Unknown';
      case 'hierarchy':
        if (mapping.facet === 'priority') {
          const p = node.priority || 0;
          if (p >= 3) return 'High';
          if (p >= 2) return 'Medium';
          if (p >= 1) return 'Low';
          return 'None';
        }
        return 'None';
      case 'alphabet':
        return node.name?.charAt(0)?.toUpperCase() || 'A';
      case 'location':
        return node.locationName || 'Unknown';
      default:
        return 'Unknown';
    }
  }
}

