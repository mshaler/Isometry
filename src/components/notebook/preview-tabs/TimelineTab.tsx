/**
 * TimelineTab Component
 *
 * React component for rendering temporal timeline visualization.
 * Displays nodes on a time axis using LATCH Time facets with
 * facet selection, date range filtering, and zoom/pan controls.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { Clock, AlertCircle, Loader2, RotateCcw, Calendar, ZoomIn } from 'lucide-react';
import * as d3 from 'd3';
import { useTheme } from '../../../contexts/ThemeContext';
import { useSelection } from '../../../state/SelectionContext';
import { useTimeline, FACET_LABELS } from '../../../hooks/visualization/useTimeline';
import type { TemporalFacet } from '../../../hooks/visualization/useTimeline';
import { TimelineRenderer } from '../../../d3/visualizations/timeline';
import { createTimelineZoom, applyTimelineZoom } from '../../../d3/visualizations/timeline/zoom';
import type { TimelineCallbacks, TimelineConfig } from '../../../d3/visualizations/timeline/types';

// ============================================================================
// Component Types
// ============================================================================

export interface TimelineTabProps {
  /** Callback when an event is selected */
  onEventSelect?: (eventId: string) => void;
  /** Maximum events to display */
  maxEvents?: number;
  /** CSS class name */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function TimelineTab({
  onEventSelect,
  maxEvents = 500,
  className = '',
}: TimelineTabProps): JSX.Element {
  const { theme } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<TimelineRenderer | null>(null);
  const zoomRef = useRef<ReturnType<typeof createTimelineZoom> | null>(null);

  // Track dimensions for responsive sizing
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // SYNC-03: Selection synchronized across canvases
  // Clicking an event selects it everywhere
  // Events selected elsewhere are highlighted here
  const { selection, select, isSelected } = useSelection();

  // Get timeline data from hook (excluding local selection state which we now get from context)
  const {
    events,
    loading,
    error,
    facet,
    setFacet,
    dateRange,
    setDateRange,
    eventCount,
    refresh,
  } = useTimeline({ maxEvents });

  // SYNC-03: Selected event from shared context
  const selectedEventId = selection.lastSelectedId;

  // Date input state (strings for controlled inputs)
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');

  // Handle facet change
  const handleFacetChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFacet(e.target.value as TemporalFacet);
  }, [setFacet]);

  // Handle date range change
  const handleDateRangeChange = useCallback(() => {
    if (startDateInput && endDateInput) {
      const start = new Date(startDateInput);
      const end = new Date(endDateInput);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        setDateRange([start, end]);
      }
    }
  }, [startDateInput, endDateInput, setDateRange]);

  // Clear date range
  const handleClearDateRange = useCallback(() => {
    setDateRange(null);
    setStartDateInput('');
    setEndDateInput('');
  }, [setDateRange]);

  // Handle event click - SYNC-03: Update shared selection
  const handleEventClick = useCallback((eventId: string) => {
    const isCurrentlySelected = isSelected(eventId);

    // Always select (no toggle to clear - use clear action elsewhere if needed)
    if (!isCurrentlySelected) {
      select(eventId);
    }

    // Call external callback if provided
    if (onEventSelect && !isCurrentlySelected) {
      onEventSelect(eventId);
    }
  }, [isSelected, select, onEventSelect]);

  // Handle reset zoom
  const handleResetZoom = useCallback(() => {
    zoomRef.current?.resetZoom();
  }, []);

  // Resize observer for container dimensions
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height: height - 60 }); // Subtract toolbar height
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Initialize and update timeline
  useEffect(() => {
    if (!svgRef.current || loading || events.length === 0) return;

    // Get the SVG group element
    const svg = svgRef.current;
    let gElement = svg.querySelector<SVGGElement>('g.timeline-container');
    if (!gElement) {
      gElement = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gElement.setAttribute('class', 'timeline-container');
      svg.appendChild(gElement);
    }

    // Create configuration
    const config: Partial<TimelineConfig> = {
      width: dimensions.width,
      height: dimensions.height,
      margin: { top: 20, right: 30, bottom: 40, left: 100 },
      dateRange: dateRange ?? undefined,
    };

    // Create callbacks
    const callbacks: TimelineCallbacks = {
      onEventClick: handleEventClick,
      onEventHover: (_eventId) => {
        // Could add hover state here
      },
    };

    // Create or update renderer
    if (!rendererRef.current) {
      rendererRef.current = new TimelineRenderer();
    }

    // Clone events to avoid D3 mutating original data
    const eventsCopy = events.map(e => ({ ...e }));

    rendererRef.current.render(gElement, eventsCopy, config, callbacks);

    // Set up zoom
    const xScale = rendererRef.current.getXScale();
    if (xScale && svgRef.current) {
      const svgSelection = d3.select(svgRef.current);
      const gSelection = d3.select(gElement);
      const xAxisGroup = gSelection.select<SVGGElement>('g.x-axis');

      zoomRef.current = createTimelineZoom(
        svgSelection as d3.Selection<SVGSVGElement, unknown, null, undefined>,
        xScale,
        (_transform, newXScale) => {
          applyTimelineZoom(gSelection, newXScale, xAxisGroup);
        }
      );
    }

    // Cleanup on unmount
    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, [events, loading, dimensions, dateRange, handleEventClick]);

  // Get selected event info for overlay
  const selectedEvent = selectedEventId
    ? events.find(e => e.id === selectedEventId)
    : null;

  // Theme-aware colors
  const bgColor = theme === 'NeXTSTEP' ? 'bg-[#e8e8e8]' : 'bg-gray-50';
  const borderColor = theme === 'NeXTSTEP' ? 'border-[#707070]' : 'border-gray-200';
  const textColor = theme === 'NeXTSTEP' ? 'text-gray-800' : 'text-gray-700';
  const inputBg = theme === 'NeXTSTEP' ? 'bg-white border-[#707070]' : 'bg-white border-gray-300';

  // Loading state
  if (loading) {
    return (
      <div className={`h-full flex items-center justify-center ${bgColor} ${className}`}>
        <div className="text-center">
          <Loader2 size={48} className="mx-auto mb-3 text-blue-500 animate-spin" />
          <div className={`text-sm font-medium ${textColor}`}>Loading timeline data...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`h-full flex items-center justify-center ${bgColor} ${className}`}>
        <div className="text-center max-w-md p-4">
          <AlertCircle size={48} className="mx-auto mb-3 text-red-500" />
          <div className="text-sm font-medium text-red-600 mb-2">Error loading timeline</div>
          <div className="text-xs text-gray-500 mb-3">{error.message}</div>
          <button
            onClick={refresh}
            className={`px-3 py-1 text-sm ${theme === 'NeXTSTEP' ? 'bg-[#d4d4d4] hover:bg-[#c0c0c0] border border-[#707070]' : 'bg-blue-500 hover:bg-blue-600 text-white'} rounded transition-colors`}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (events.length === 0) {
    return (
      <div className={`h-full flex items-center justify-center ${bgColor} ${className}`}>
        <div className="text-center">
          <Clock size={48} className="mx-auto mb-3 text-gray-400" />
          <div className={`text-sm font-medium ${textColor} mb-1`}>No events with {FACET_LABELS[facet]} dates</div>
          <div className="text-xs text-gray-500 mb-4">
            Try selecting a different temporal facet or adjusting the date range
          </div>
          <select
            value={facet}
            onChange={handleFacetChange}
            className={`px-3 py-1 text-sm ${inputBg} border rounded focus:outline-none focus:ring-1 focus:ring-blue-500`}
          >
            <option value="created_at">Created</option>
            <option value="modified_at">Modified</option>
            <option value="due_at">Due</option>
          </select>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`h-full flex flex-col ${bgColor} ${className}`}>
      {/* Toolbar */}
      <div className={`flex items-center gap-3 p-2 border-b ${borderColor}`}>
        {/* Facet selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Facet:</label>
          <select
            value={facet}
            onChange={handleFacetChange}
            className={`px-2 py-1 text-xs ${inputBg} border rounded focus:outline-none focus:ring-1 focus:ring-blue-500`}
          >
            <option value="created_at">Created</option>
            <option value="modified_at">Modified</option>
            <option value="due_at">Due</option>
          </select>
        </div>

        <div className="w-px h-5 bg-gray-300" />

        {/* Date range filter */}
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-gray-400" />
          <input
            type="date"
            value={startDateInput}
            onChange={(e) => setStartDateInput(e.target.value)}
            onBlur={handleDateRangeChange}
            className={`px-2 py-1 text-xs ${inputBg} border rounded focus:outline-none focus:ring-1 focus:ring-blue-500`}
            title="Start date"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={endDateInput}
            onChange={(e) => setEndDateInput(e.target.value)}
            onBlur={handleDateRangeChange}
            className={`px-2 py-1 text-xs ${inputBg} border rounded focus:outline-none focus:ring-1 focus:ring-blue-500`}
            title="End date"
          />
          {dateRange && (
            <button
              onClick={handleClearDateRange}
              className="text-xs text-gray-500 hover:text-gray-700"
              title="Clear date range"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* Zoom controls */}
        <button
          onClick={handleResetZoom}
          className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-[#d4d4d4]' : 'bg-gray-200'} transition-colors`}
          title="Reset zoom"
        >
          <RotateCcw size={14} className="text-gray-600" />
        </button>

        <button
          onClick={refresh}
          className={`p-1 rounded hover:${theme === 'NeXTSTEP' ? 'bg-[#d4d4d4]' : 'bg-gray-200'} transition-colors`}
          title="Refresh"
        >
          <ZoomIn size={14} className="text-gray-600" />
        </button>
      </div>

      {/* Timeline Canvas */}
      <div className="flex-1 relative">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="w-full h-full"
          style={{ background: theme === 'NeXTSTEP' ? '#e8e8e8' : '#fafafa' }}
        >
          {/* Timeline content rendered by D3 */}
        </svg>

        {/* Selected Event Overlay */}
        {selectedEvent && (
          <div className={`absolute top-3 right-3 ${theme === 'NeXTSTEP' ? 'bg-white' : 'bg-white'} ${borderColor} border rounded-lg shadow-md p-3 max-w-xs`}>
            <div className="text-xs text-gray-500 mb-1">Selected Event</div>
            <div className={`font-medium ${textColor} truncate`} title={selectedEvent.label}>
              {selectedEvent.label}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              <span className="inline-flex items-center gap-1">
                {FACET_LABELS[facet]}: <span className="font-medium">
                  {d3.timeFormat('%b %d, %Y')(selectedEvent.timestamp)}
                </span>
              </span>
            </div>
            <div className="text-xs text-gray-500">
              <span className="inline-flex items-center gap-1">
                Folder: <span className="font-medium">{selectedEvent.track}</span>
              </span>
            </div>
          </div>
        )}

        {/* Stats Badge */}
        <div className={`absolute bottom-3 left-3 ${theme === 'NeXTSTEP' ? 'bg-[#d4d4d4]' : 'bg-gray-100'} ${borderColor} border rounded px-2 py-1`}>
          <span className="text-xs text-gray-600">
            {eventCount} events ({FACET_LABELS[facet]})
          </span>
        </div>
      </div>
    </div>
  );
}

