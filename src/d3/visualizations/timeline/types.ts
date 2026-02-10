/**
 * Timeline Types
 *
 * Type definitions for D3 scaleTime-based timeline visualization.
 * Supports LATCH Time facets (created_at, modified_at, due_at).
 */

import * as d3 from 'd3';

// ============================================================================
// Event Interface
// ============================================================================

/**
 * Timeline event representing a node at a point in time
 */
export interface TimelineEvent {
  /** Unique event identifier (node ID) */
  id: string;
  /** Event timestamp */
  timestamp: Date;
  /** Display label (node name) */
  label: string;
  /** Track for Y-axis grouping (folder) */
  track: string;
  /** Optional color override */
  color?: string;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Timeline configuration options
 */
export interface TimelineConfig {
  /** SVG width in pixels */
  width: number;
  /** SVG height in pixels */
  height: number;
  /** Margins for axes */
  margin: { top: number; right: number; bottom: number; left: number };
  /** Optional date range filter [start, end] */
  dateRange?: [Date, Date];
}

/**
 * Default configuration values
 */
export const DEFAULT_TIMELINE_CONFIG: TimelineConfig = {
  width: 800,
  height: 600,
  margin: { top: 40, right: 40, bottom: 60, left: 120 },
};

// ============================================================================
// Callbacks
// ============================================================================

/**
 * Callback functions for timeline interactions
 */
export interface TimelineCallbacks {
  /** Called when an event is clicked */
  onEventClick?: (eventId: string) => void;
  /** Called when mouse enters/leaves an event */
  onEventHover?: (eventId: string | null) => void;
  /** Called when zoom transform changes */
  onZoom?: (transform: d3.ZoomTransform) => void;
}

// ============================================================================
// Renderer Result
// ============================================================================

/**
 * Result returned by createTimeline function
 */
export interface TimelineRenderResult {
  /** X-axis scale (time) */
  xScale: d3.ScaleTime<number, number>;
  /** Y-axis scale (tracks/folders) */
  yScale: d3.ScaleBand<string>;
  /** Update function for new events */
  update: (newEvents: TimelineEvent[]) => void;
  /** Cleanup function */
  destroy: () => void;
}

// ============================================================================
// Track Styling
// ============================================================================

/**
 * Track color palette for differentiation
 */
export const TRACK_COLORS = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f43f5e', // rose
  '#14b8a6', // teal
];

/**
 * Get color for a track based on its index
 */
export function getTrackColor(trackIndex: number): string {
  return TRACK_COLORS[trackIndex % TRACK_COLORS.length];
}
