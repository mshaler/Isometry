/**
 * TimelineRenderer
 *
 * D3 timeline renderer using scaleTime for X-axis (time) and
 * scaleBand for Y-axis (tracks/folders). Renders events as circles
 * on their track lanes with hover/click interactions.
 */

import * as d3 from 'd3';
import type {
  TimelineEvent,
  TimelineConfig,
  TimelineCallbacks,
  TimelineRenderResult,
} from './types';
import { DEFAULT_TIMELINE_CONFIG, getTrackColor } from './types';

// ============================================================================
// Constants
// ============================================================================

const EVENT_RADIUS = 6;
const EVENT_HOVER_RADIUS = 8;
const FALLBACK_DAYS = 30; // Default domain if no valid events

// ============================================================================
// Timeline Factory
// ============================================================================

/**
 * Create a timeline visualization in the given container
 */
export function createTimeline(
  container: SVGGElement,
  events: TimelineEvent[],
  config: Partial<TimelineConfig>,
  callbacks: TimelineCallbacks = {}
): TimelineRenderResult {
  // Merge config with defaults
  const cfg: TimelineConfig = { ...DEFAULT_TIMELINE_CONFIG, ...config };
  const { width, height, margin } = cfg;

  // Calculate inner dimensions
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Get D3 selection of container
  const g = d3.select(container);

  // Clear previous content
  g.selectAll('*').remove();

  // Create main group with margin transform
  const mainGroup = g
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Filter out events with invalid timestamps
  const validEvents = events.filter(e => {
    const time = e.timestamp?.getTime();
    return time && !isNaN(time);
  });

  // Extract unique tracks
  const tracks = [...new Set(validEvents.map(e => e.track))].sort();

  // Create track to color mapping
  const trackColorMap = new Map<string, string>();
  tracks.forEach((track, i) => {
    trackColorMap.set(track, getTrackColor(i));
  });

  // Determine X-axis domain (time)
  let timeDomain: [Date, Date];
  if (cfg.dateRange) {
    // Use configured date range
    timeDomain = cfg.dateRange;
  } else if (validEvents.length > 0) {
    // Compute from data with padding
    const extent = d3.extent(validEvents, e => e.timestamp) as [Date, Date];
    const timeSpan = extent[1].getTime() - extent[0].getTime();
    const padding = Math.max(timeSpan * 0.05, 24 * 60 * 60 * 1000); // 5% or 1 day min
    timeDomain = [
      new Date(extent[0].getTime() - padding),
      new Date(extent[1].getTime() + padding),
    ];
  } else {
    // Fallback: last 30 days
    const now = new Date();
    timeDomain = [
      new Date(now.getTime() - FALLBACK_DAYS * 24 * 60 * 60 * 1000),
      now,
    ];
  }

  // Create scales
  const xScale = d3.scaleTime().domain(timeDomain).range([0, innerWidth]);

  const yScale = d3
    .scaleBand<string>()
    .domain(tracks.length > 0 ? tracks : ['(no data)'])
    .range([0, innerHeight])
    .padding(0.2);

  // Create X-axis
  const xAxis = d3
    .axisBottom(xScale)
    .ticks(Math.max(3, Math.floor(innerWidth / 100)))
    .tickFormat(d => d3.timeFormat('%b %d')(d as Date));

  const xAxisGroup = mainGroup
    .append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(xAxis);

  // Style axis
  xAxisGroup.selectAll('text').attr('fill', '#6b7280').attr('font-size', '11px');
  xAxisGroup.selectAll('line, path').attr('stroke', '#d1d5db');

  // Create Y-axis
  const yAxis = d3.axisLeft(yScale);

  const yAxisGroup = mainGroup.append('g').attr('class', 'y-axis').call(yAxis);

  // Style axis
  yAxisGroup.selectAll('text').attr('fill', '#6b7280').attr('font-size', '11px');
  yAxisGroup.selectAll('line, path').attr('stroke', '#d1d5db');

  // Create events group
  const eventsGroup = mainGroup.append('g').attr('class', 'events');

  // Create tooltip element
  const tooltip = d3
    .select('body')
    .append('div')
    .attr('class', 'timeline-tooltip')
    .style('position', 'absolute')
    .style('visibility', 'hidden')
    .style('background-color', 'rgba(17, 24, 39, 0.9)')
    .style('color', 'white')
    .style('padding', '6px 10px')
    .style('border-radius', '4px')
    .style('font-size', '12px')
    .style('pointer-events', 'none')
    .style('z-index', '1000')
    .style('max-width', '200px')
    .style('white-space', 'nowrap')
    .style('overflow', 'hidden')
    .style('text-overflow', 'ellipsis');

  // Render events function
  function renderEvents(evts: TimelineEvent[]) {
    const validEvts = evts.filter(e => {
      const time = e.timestamp?.getTime();
      return time && !isNaN(time);
    });

    const circles = eventsGroup
      .selectAll<SVGCircleElement, TimelineEvent>('circle.event')
      .data(validEvts, d => d.id);

    circles.join(
      enter =>
        enter
          .append('circle')
          .attr('class', 'event')
          .attr('cx', d => xScale(d.timestamp))
          .attr('cy', d => (yScale(d.track) ?? 0) + yScale.bandwidth() / 2)
          .attr('r', 0)
          .attr('fill', d => d.color ?? trackColorMap.get(d.track) ?? '#6366f1')
          .attr('stroke', 'white')
          .attr('stroke-width', 1.5)
          .attr('cursor', 'pointer')
          .on('mouseenter', function (_event, d) {
            d3.select(this)
              .transition()
              .duration(150)
              .attr('r', EVENT_HOVER_RADIUS);

            tooltip
              .style('visibility', 'visible')
              .html(
                `<strong>${d.label}</strong><br/>${d3.timeFormat('%b %d, %Y %H:%M')(d.timestamp)}`
              );

            callbacks.onEventHover?.(d.id);
          })
          .on('mousemove', function (event) {
            tooltip
              .style('top', event.pageY - 10 + 'px')
              .style('left', event.pageX + 10 + 'px');
          })
          .on('mouseleave', function () {
            d3.select(this).transition().duration(150).attr('r', EVENT_RADIUS);

            tooltip.style('visibility', 'hidden');
            callbacks.onEventHover?.(null);
          })
          .on('click', function (_event, d) {
            callbacks.onEventClick?.(d.id);
          })
          .call(enter =>
            enter.transition().duration(300).attr('r', EVENT_RADIUS)
          ),
      update =>
        update.call(update =>
          update
            .transition()
            .duration(300)
            .attr('cx', d => xScale(d.timestamp))
            .attr('cy', d => (yScale(d.track) ?? 0) + yScale.bandwidth() / 2)
            .attr('fill', d => d.color ?? trackColorMap.get(d.track) ?? '#6366f1')
        ),
      exit =>
        exit.call(exit =>
          exit.transition().duration(200).attr('r', 0).remove()
        )
    );
  }

  // Initial render
  renderEvents(validEvents);

  // Update function for new data
  function update(newEvents: TimelineEvent[]) {
    renderEvents(newEvents);
  }

  // Cleanup function
  function destroy() {
    tooltip.remove();
    g.selectAll('*').remove();
  }

  return {
    xScale,
    yScale,
    update,
    destroy,
  };
}

// ============================================================================
// TimelineRenderer Class (alternative OOP interface)
// ============================================================================

export class TimelineRenderer {
  private result: TimelineRenderResult | null = null;

  /**
   * Render timeline into container
   */
  render(
    container: SVGGElement,
    events: TimelineEvent[],
    config: Partial<TimelineConfig> = {},
    callbacks: TimelineCallbacks = {}
  ): void {
    // Cleanup previous render
    this.destroy();

    // Create new timeline
    this.result = createTimeline(container, events, config, callbacks);
  }

  /**
   * Update with new events
   */
  update(events: TimelineEvent[]): void {
    this.result?.update(events);
  }

  /**
   * Get current X scale (for zoom)
   */
  getXScale(): d3.ScaleTime<number, number> | null {
    return this.result?.xScale ?? null;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.result?.destroy();
    this.result = null;
  }
}

export default TimelineRenderer;
