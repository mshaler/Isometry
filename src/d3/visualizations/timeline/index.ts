/**
 * Timeline Visualization Module
 *
 * D3-based timeline visualization for LATCH Time facets.
 */

export { createTimeline, TimelineRenderer } from './TimelineRenderer';
export { createTimelineZoom, applyTimelineZoom } from './zoom';
export type {
  TimelineEvent,
  TimelineConfig,
  TimelineCallbacks,
  TimelineRenderResult,
} from './types';
export {
  DEFAULT_TIMELINE_CONFIG,
  TRACK_COLORS,
  getTrackColor,
} from './types';
