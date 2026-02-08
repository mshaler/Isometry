/**
 * PAFVProjection interface for PAFV axis-to-plane mapping
 *
 * Extends existing AxisMapping from src/types/pafv.ts to support all LATCH dimensions
 * mapping to visual planes. This is the core of polymorphic data projection.
 */

import type { LATCHAxis, AxisMapping } from '@/types/pafv';

/**
 * Axis assignment for a single visual plane
 */
export interface PlaneAssignment {
  /** LATCH axis: Location, Alphabet, Time, Category, Hierarchy */
  axis: LATCHAxis;

  /** Specific facet within the axis (e.g., 'year' within Time, 'status' within Category) */
  facet: string;

  /** Optional aggregation function for grouped data */
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'first' | 'last';

  /** Data type hint for proper rendering */
  dataType?: 'string' | 'number' | 'date' | 'boolean';
}

/**
 * Complete PAFV projection configuration
 *
 * Maps LATCH axes to visual planes for polymorphic data projection.
 * Any axis can map to any plane, enabling view transitions through remapping.
 */
export interface PAFVProjection {
  /** X-axis (horizontal position) assignment */
  x: PlaneAssignment;

  /** Y-axis (vertical position) assignment */
  y: PlaneAssignment;

  /** Color encoding assignment (optional) */
  color?: PlaneAssignment;

  /** Size encoding assignment (optional) */
  size?: PlaneAssignment;

  /** Shape encoding assignment (optional) */
  shape?: PlaneAssignment;

  /** Z-axis/depth assignment for 3D views (optional) */
  z?: PlaneAssignment;

  /** Faceting assignment for small multiples (optional) */
  facet?: PlaneAssignment;
}

/**
 * Extended projection with hierarchy support
 *
 * For hierarchical views (Tree, Network) that need nested structure information
 */
export interface HierarchicalProjection extends PAFVProjection {
  /** Parent-child relationship assignment */
  hierarchy: {
    parent: PlaneAssignment;
    child: PlaneAssignment;
    depth: PlaneAssignment;
  };

  /** Edge/connection assignment for network views */
  edges?: {
    source: PlaneAssignment;
    target: PlaneAssignment;
    type: PlaneAssignment;
    weight: PlaneAssignment;
  };
}

/**
 * Temporal projection for timeline views
 *
 * Specialized projection for time-based visualizations
 */
export interface TemporalProjection extends PAFVProjection {
  /** Start time assignment */
  startTime: PlaneAssignment;

  /** End time assignment (for duration events) */
  endTime?: PlaneAssignment;

  /** Timeline grouping assignment */
  timeline: PlaneAssignment;

  /** Event type assignment */
  eventType?: PlaneAssignment;
}

/**
 * Geospatial projection for map views
 *
 * Specialized projection for location-based visualizations
 */
export interface GeospatialProjection extends PAFVProjection {
  /** Latitude assignment */
  latitude: PlaneAssignment;

  /** Longitude assignment */
  longitude: PlaneAssignment;

  /** Zoom level assignment */
  zoom?: PlaneAssignment;

  /** Region/boundary assignment */
  region?: PlaneAssignment;
}

/**
 * Default PAFV projections for common views
 */
export const DEFAULT_PROJECTIONS: Record<string, PAFVProjection> = {
  grid: {
    x: { axis: 'time', facet: 'created_at' },
    y: { axis: 'category', facet: 'status' },
    color: { axis: 'hierarchy', facet: 'priority' }
  },
  list: {
    x: { axis: 'alphabet', facet: 'name' },
    y: { axis: 'hierarchy', facet: 'sort_order' },
    color: { axis: 'category', facet: 'status' }
  },
  kanban: {
    x: { axis: 'category', facet: 'status' },
    y: { axis: 'hierarchy', facet: 'priority' },
    color: { axis: 'time', facet: 'due_at' }
  },
  timeline: {
    x: { axis: 'time', facet: 'created_at' },
    y: { axis: 'category', facet: 'status' },
    color: { axis: 'hierarchy', facet: 'priority' }
  }
};

/**
 * Projection transformation utilities
 */
export interface ProjectionTransform {
  /** Source projection */
  from: PAFVProjection;

  /** Target projection */
  to: PAFVProjection;

  /** Animation duration for transition */
  duration: number;

  /** Easing function for transition */
  easing: string;

  /** Whether to preserve selection during transition */
  preserveSelection: boolean;
}

/**
 * Utility functions for PAFV projection manipulation
 */
export const PAFVProjectionUtils = {
  /**
   * Check if two projections are equivalent
   */
  areEqual(a: PAFVProjection, b: PAFVProjection): boolean {
    return (
      this.planeAssignmentsEqual(a.x, b.x) &&
      this.planeAssignmentsEqual(a.y, b.y) &&
      this.planeAssignmentsEqual(a.color, b.color) &&
      this.planeAssignmentsEqual(a.size, b.size) &&
      this.planeAssignmentsEqual(a.shape, b.shape) &&
      this.planeAssignmentsEqual(a.z, b.z)
    );
  },

  /**
   * Check if two plane assignments are equal
   */
  planeAssignmentsEqual(a?: PlaneAssignment, b?: PlaneAssignment): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.axis === b.axis && a.facet === b.facet && a.aggregation === b.aggregation;
  },

  /**
   * Create a projection transform between two projections
   */
  createTransform(from: PAFVProjection, to: PAFVProjection, duration = 300): ProjectionTransform {
    return {
      from,
      to,
      duration,
      easing: 'ease-in-out',
      preserveSelection: true
    };
  },

  /**
   * Validate a PAFV projection
   */
  isValid(projection: PAFVProjection): boolean {
    return (
      projection.x && this.isValidPlaneAssignment(projection.x) &&
      projection.y && this.isValidPlaneAssignment(projection.y)
    );
  },

  /**
   * Validate a plane assignment
   */
  isValidPlaneAssignment(assignment: PlaneAssignment): boolean {
    return (
      assignment &&
      typeof assignment.axis === 'string' &&
      typeof assignment.facet === 'string' &&
      ['location', 'alphabet', 'time', 'category', 'hierarchy'].includes(assignment.axis)
    );
  },

  /**
   * Convert legacy AxisMapping to PAFVProjection
   */
  fromAxisMappings(mappings: AxisMapping[]): PAFVProjection {
    const projection: PAFVProjection = {
      x: { axis: 'time', facet: 'created_at' },
      y: { axis: 'category', facet: 'status' }
    };

    mappings.forEach(mapping => {
      const assignment: PlaneAssignment = {
        axis: mapping.axis,
        facet: mapping.facet
      };

      switch (mapping.plane) {
        case 'x':
          projection.x = assignment;
          break;
        case 'y':
          projection.y = assignment;
          break;
        case 'color':
          projection.color = assignment;
          break;
        case 'size':
          projection.size = assignment;
          break;
        case 'shape':
          projection.shape = assignment;
          break;
      }
    });

    return projection;
  },

  /**
   * Convert PAFVProjection to legacy AxisMapping array
   */
  toAxisMappings(projection: PAFVProjection): AxisMapping[] {
    const mappings: AxisMapping[] = [];

    if (projection.x) {
      mappings.push({ plane: 'x', axis: projection.x.axis, facet: projection.x.facet });
    }
    if (projection.y) {
      mappings.push({ plane: 'y', axis: projection.y.axis, facet: projection.y.facet });
    }
    if (projection.color) {
      mappings.push({ plane: 'color', axis: projection.color.axis, facet: projection.color.facet });
    }
    if (projection.size) {
      mappings.push({ plane: 'size', axis: projection.size.axis, facet: projection.size.facet });
    }
    if (projection.shape) {
      mappings.push({ plane: 'shape', axis: projection.shape.axis, facet: projection.shape.facet });
    }

    return mappings;
  }
};

/**
 * Type guards for PAFV projection types
 */
export const isPAFVProjection = (obj: any): obj is PAFVProjection => {
  return obj &&
    obj.x && PAFVProjectionUtils.isValidPlaneAssignment(obj.x) &&
    obj.y && PAFVProjectionUtils.isValidPlaneAssignment(obj.y);
};

export const isPlaneAssignment = (obj: any): obj is PlaneAssignment => {
  return obj &&
    typeof obj.axis === 'string' &&
    typeof obj.facet === 'string' &&
    ['location', 'alphabet', 'time', 'category', 'hierarchy'].includes(obj.axis);
};