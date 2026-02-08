// @ts-nocheck
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNotebook } from '../../contexts/NotebookContext';
import { parseChartData, detectVisualizationType, extractVisualizationConfig } from '../../utils/d3Parsers';
import type { ParsedData, VisualizationConfig, VisualizationDirective } from '../../utils/d3Parsers';
import { debounce } from '../../utils/debounce';

// Define a proper data interface for D3 visualizations
interface D3DataItem {
  [key: string]: string | number | Date | boolean | null | undefined;
}

export interface D3VisualizationState {
  data: D3DataItem[];
  vizType: VisualizationConfig['type'];
  config: VisualizationConfig;
  directive: VisualizationDirective | null;
  isLoading: boolean;
  error: string | null;
  parsedData: ParsedData | null;
}

export interface UseD3VisualizationReturn extends D3VisualizationState {
  forceRefresh: () => void;
  updateVisualization: (content: string) => void;
  canVisualize: boolean;
}

/**
 * Hook for managing D3 visualizations with live data updates from notebook content
 */
export function useD3Visualization(): UseD3VisualizationReturn {
  const { activeCard } = useNotebook();

  const [state, setState] = useState<D3VisualizationState>({
    data: [],
    vizType: 'unknown',
    config: {
      type: 'unknown',
      axes: {},
      encoding: { xType: 'categorical', yType: 'continuous' },
      suggestions: [],
      confidence: 0
    },
    directive: null,
    isLoading: false,
    error: null,
    parsedData: null
  });

  // Debounced content processing to avoid excessive re-parsing
  const debouncedProcessContent = useMemo(
    () => debounce((...args: unknown[]) => {
      processContent(args[0] as string);
    }, 200),
    []
  );

  // Process content and extract visualization data
  const processContent = useCallback((content: string) => {
    if (!content?.trim()) {
      setState(prev => ({
        ...prev,
        data: [],
        vizType: 'unknown',
        isLoading: false,
        error: null,
        parsedData: null
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Parse data from content
      const parsedData = parseChartData(content);

      if (!parsedData || parsedData.length === 0) {
        setState(prev => ({
          ...prev,
          data: [],
          vizType: 'unknown',
          isLoading: false,
          error: 'No valid data found',
          parsedData: parsedData || [],
          config: prev.config,
          directive: null
        }));
        return;
      }

      // Extract explicit visualization directive
      const directive = extractVisualizationConfig(content);

      // Detect optimal visualization type
      const detectedConfig = detectVisualizationType(parsedData);

      // Use directive type if provided, otherwise use detected
      const finalConfig = directive ? {
        ...detectedConfig,
        type: directive.type,
        axes: {
          ...detectedConfig.axes,
          x: directive.x || detectedConfig.axes?.x,
          y: directive.y || detectedConfig.axes?.y,
          color: directive.color || detectedConfig.axes?.color,
          size: directive.size || detectedConfig.axes?.size
        }
      } : detectedConfig;

      setState(prev => ({
        ...prev,
        data: parsedData as unknown as D3DataItem[],
        vizType: finalConfig.type as any,
        config: finalConfig,
        directive,
        isLoading: false,
        error: null,
        parsedData
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        data: [],
        vizType: 'unknown',
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to process content',
        parsedData: null
      }));
    }
  }, []);

  // Update visualization with new content
  const updateVisualization = useCallback((content: string) => {
    debouncedProcessContent(content);
  }, [debouncedProcessContent]);

  // Force refresh current content
  const forceRefresh = useCallback(() => {
    if (activeCard?.markdownContent) {
      processContent(activeCard.markdownContent);
    }
  }, [activeCard, processContent]);

  // Monitor active card changes
  useEffect(() => {
    if (activeCard?.markdownContent) {
      updateVisualization(activeCard.markdownContent);
    } else {
      setState(prev => ({
        ...prev,
        data: [],
        vizType: 'unknown',
        isLoading: false,
        error: null,
        parsedData: null
      }));
    }
  }, [activeCard?.markdownContent, updateVisualization]);

  // Cleanup function
  useEffect(() => {
    return () => {
      // Clean up any pending debounced calls
      debouncedProcessContent.cancel?.();
    };
  }, [debouncedProcessContent]);

  // Determine if we can visualize the current data
  const canVisualize = useMemo(() => {
    return state.data.length > 0 &&
           state.vizType !== 'unknown' &&
           (state.config.confidence ?? 0) > 0.3 &&
           !state.isLoading &&
           !state.error;
  }, [state.data, state.vizType, state.config.confidence, state.isLoading, state.error]);

  return {
    data: state.data,
    vizType: state.vizType,
    config: state.config,
    directive: state.directive,
    isLoading: state.isLoading,
    error: state.error,
    parsedData: state.parsedData,
    forceRefresh,
    updateVisualization,
    canVisualize
  };
}

/**
 * Enhanced version with performance monitoring
 */
export function useD3VisualizationWithPerformance(): UseD3VisualizationReturn & {
  performanceMetrics: {
    parseTime: number;
    renderTime: number;
    dataPoints: number;
    memoryUsage?: number;
  };
} {
  const baseHook = useD3Visualization();
  const [performanceMetrics, setPerformanceMetrics] = useState({
    parseTime: 0,
    renderTime: 0,
    dataPoints: 0,
    memoryUsage: undefined as number | undefined
  });

  // Wrap the base hook with performance monitoring
  const enhancedUpdateVisualization = useCallback((content: string) => {
    const startTime = performance.now();

    baseHook.updateVisualization(content);

    const parseTime = performance.now() - startTime;
    const dataPoints = baseHook.data.length;

    setPerformanceMetrics(prev => ({
      ...prev,
      parseTime,
      dataPoints,
      memoryUsage: (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize
    }));

    // Warn if parsing is slow
    if (parseTime > 100) {
      console.warn(`D3 visualization parsing took ${parseTime.toFixed(2)}ms for ${dataPoints} data points`);
    }

  }, [baseHook]);

  return {
    ...baseHook,
    updateVisualization: enhancedUpdateVisualization,
    performanceMetrics
  };
}