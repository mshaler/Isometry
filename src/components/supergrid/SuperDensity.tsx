/**
 * SuperDensity - Janus Density Model Implementation
 *
 * Enhanced SuperDensity component integrating with the unified SuperDensitySparsity
 * aggregation control system. Provides the complete 4-level Janus density model
 * with SQL-based aggregation, D3.js visualization, and lossless data integrity.
 *
 * Section 2.5 of SuperGrid specification: Complete implementation of the
 * SuperDensitySparsity unified aggregation control system.
 *
 * Janus Model Quadrants (Pan × Zoom Independence):
 * ┌─────────────────┬─────────────────┐
 * │ Sparse + Leaf   │ Dense + Leaf    │
 * │ (Full Calendar) │ (Packed Days)   │
 * ├─────────────────┼─────────────────┤
 * │ Sparse + Rolled │ Dense + Rolled  │
 * │ (Quarter View)  │ (Year Summary)  │
 * └─────────────────┴─────────────────┘
 *
 * Enhanced Features:
 * - 4-level density hierarchy with SQL aggregation
 * - Real-time performance monitoring (< 100ms target)
 * - Lossless aggregation with data integrity preservation
 * - Cross-density accuracy validation
 * - Region mixing for sparse + dense columns coexistence
 * - D3.js visualization with smooth transitions
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePAFV } from '@/hooks';
import { useDatabase } from '@/db/DatabaseContext';
import { SuperDensityService } from '@/services/SuperDensityService';
import { LATCHFilterService } from '@/services/LATCHFilterService';
import { SuperDensityRenderer } from '@/d3/SuperDensityRenderer';
import { JanusDensityControls } from '@/components/JanusDensityControls';
import { superGridLogger } from '@/utils/logging/dev-logger';
import type { LATCHAxis } from '@/types/pafv';
import type { Node } from '@/types/node';
import type {
  JanusDensityState,
  DensityLevel,
  DensityChangeEvent,
  DensityAggregationResult,
  DensityPerformanceMetrics
} from '@/types/supergrid';
import { DEFAULT_JANUS_DENSITY } from '@/types/supergrid';

export interface SuperDensityProps {
  /** Current nodes being displayed */
  nodes: Node[];
  /** Available LATCH axes for granularity control */
  activeAxes: LATCHAxis[];
  /** Container dimensions */
  width?: number;
  height?: number;
  /** Enable debug mode */
  debug?: boolean;
  /** Enable advanced controls */
  showAdvancedControls?: boolean;
  /** Callback when density changes */
  onDensityChange?: (event: DensityChangeEvent) => void;
  /** Callback when aggregation completes */
  onAggregationComplete?: (result: DensityAggregationResult) => void;
}

/**
 * SuperDensity: Complete Janus Model implementation with unified aggregation
 */
export function SuperDensity({
  nodes,
  activeAxes,
  width = 800,
  height = 600,
  debug = false,
  showAdvancedControls = true,
  onDensityChange,
  onAggregationComplete
}: SuperDensityProps) {
  // State management
  const [densityState, setDensityState] = useState<JanusDensityState>(DEFAULT_JANUS_DENSITY);
  const [aggregationResult, setAggregationResult] = useState<DensityAggregationResult | null>(null);
  const [performanceHistory, setPerformanceHistory] = useState<DensityPerformanceMetrics[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Refs for service instances
  const densityServiceRef = useRef<SuperDensityService | null>(null);
  const rendererRef = useRef<SuperDensityRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const filterServiceRef = useRef<LATCHFilterService>(new LATCHFilterService());

  // Database and PAFV context
  const { execute } = useDatabase();
  const { state: _pafvState } = usePAFV();

  // Initialize SuperDensity service
  useEffect(() => {
    if (!densityServiceRef.current) {
      densityServiceRef.current = new SuperDensityService(
        { execute: execute as <T = Record<string, unknown>>(sql: string, params?: unknown[]) => T[] },
        filterServiceRef.current,
        {
          performanceTarget: 100,
          trackPerformance: true,
          enableAggregationCache: true,
          enableDebugLogging: debug
        }
      );

      // Subscribe to density changes
      const unsubscribe = densityServiceRef.current.onDensityChange(handleDensityChangeEvent);
      return () => unsubscribe();
    }
  }, [execute, debug]);

  // Initialize D3 renderer
  useEffect(() => {
    if (containerRef.current && !rendererRef.current) {
      rendererRef.current = new SuperDensityRenderer(
        containerRef.current,
        densityState,
        {
          width,
          height,
          enableDebugLogging: debug,
          showPerformanceMetrics: true
        }
      );
    }

    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, [densityState, width, height, debug]);

  // Handle density change events from service
  const handleDensityChangeEvent = useCallback((event: DensityChangeEvent) => {
    setDensityState(event.newState);
    setPerformanceHistory(prev => [...prev.slice(-9), event.metrics]);

    // Update renderer state
    if (rendererRef.current) {
      rendererRef.current.updateDensityState(event.newState);
    }

    // Notify parent component
    if (onDensityChange) {
      onDensityChange(event);
    }

    if (debug) {
      superGridLogger.debug('Density changed:', {
        level: event.changedLevel,
        performanceMs: event.metrics.totalTime,
        withinTarget: event.metrics.withinPerformanceTarget
      });
    }
  }, [onDensityChange, debug]);

  // Handle density level changes from controls
  const handleDensityLevelChange = useCallback(async (level: DensityLevel, value: unknown) => {
    if (!densityServiceRef.current) return;

    setIsProcessing(true);
    try {
      await densityServiceRef.current.setDensity(level, value);
    } catch (error) {
      console.error('[SuperDensity] Failed to set density:', error);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Generate and render aggregated data
  const generateAggregatedData = useCallback(async () => {
    if (!densityServiceRef.current || !rendererRef.current) return;

    setIsProcessing(true);
    try {
      // Generate aggregated data based on current density state
      const result = await densityServiceRef.current.generateAggregatedData();
      setAggregationResult(result);

      // Render using D3 renderer
      await rendererRef.current.render(result);

      // Notify parent component
      if (onAggregationComplete) {
        onAggregationComplete(result);
      }

      if (debug) {
        superGridLogger.debug('Aggregation completed:', {
          sourceRows: result.metadata.sourceRowCount,
          aggregatedRows: result.metadata.aggregatedRowCount,
          compressionRatio: result.metadata.compressionRatio,
          performanceMs: result.timing.totalTime
        });
      }
    } catch (error) {
      console.error('[SuperDensity] Aggregation failed:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [onAggregationComplete, debug]);

  // Regenerate data when nodes or density state changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      generateAggregatedData();
    }, 100); // Debounce rapid changes

    return () => clearTimeout(timeoutId);
  }, [generateAggregatedData, nodes.length, densityState]);

  // Calculate data statistics
  const dataStats = React.useMemo(() => {
    if (!aggregationResult) {
      return {
        totalRows: nodes.length,
        populatedCells: nodes.length,
        compressionRatio: 1
      };
    }

    return {
      totalRows: aggregationResult.metadata.sourceRowCount,
      populatedCells: aggregationResult.metadata.aggregatedRowCount,
      compressionRatio: aggregationResult.metadata.compressionRatio
    };
  }, [aggregationResult, nodes.length]);

  return (
    <div className="superdensity">
      {/* Main container with side-by-side layout */}
      <div className="flex gap-6">
        {/* Controls Panel */}
        <div className="w-80 flex-shrink-0">
          <JanusDensityControls
            densityState={densityState}
            onDensityChange={handleDensityLevelChange}
            performanceMetrics={performanceHistory}
            availableAxes={activeAxes.map(axis => axis.toUpperCase())}
            dataStats={dataStats}
            debugMode={debug}
            showAdvancedControls={showAdvancedControls}
          />
        </div>

        {/* Visualization Container */}
        <div className="flex-1">
          <div className="space-y-4">
            {/* Status Header */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                <span className="text-sm font-medium">
                  {isProcessing ? 'Processing...' : 'Ready'}
                </span>
                {aggregationResult && (
                  <span className="text-xs text-muted-foreground">
                    {aggregationResult.data.length} cells • {aggregationResult.timing.totalTime.toFixed(1)}ms
                  </span>
                )}
              </div>
              {aggregationResult?.timing.withinPerformanceTarget === false && (
                <div className="text-xs text-orange-600">
                  ⚠ Performance target exceeded
                </div>
              )}
            </div>

            {/* D3 Visualization Container */}
            <div
              ref={containerRef}
              className="border rounded-lg bg-white"
              style={{ width, height }}
            />

            {/* Aggregation Summary */}
            {aggregationResult && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <div className="text-sm font-medium mb-2">Aggregation Summary</div>
                <div className="grid grid-cols-4 gap-4 text-xs">
                  <div>
                    <div className="font-medium">Source Rows</div>
                    <div className="text-muted-foreground">{aggregationResult.metadata.sourceRowCount.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="font-medium">Aggregated</div>
                    <div className="text-muted-foreground">{aggregationResult.metadata.aggregatedRowCount.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="font-medium">Compression</div>
                    <div className="text-muted-foreground">{(aggregationResult.metadata.compressionRatio * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="font-medium">Accuracy</div>
                    <div className="text-muted-foreground">{aggregationResult.metadata.accuracyPreserved ? '✓ Preserved' : '⚠ Degraded'}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Debug Information */}
      {debug && aggregationResult && (
        <div className="mt-6 p-4 border rounded-lg bg-muted/50">
          <details className="text-xs">
            <summary className="cursor-pointer font-medium mb-2">Debug: Full Aggregation Result</summary>
            <pre className="overflow-auto max-h-64">
              {JSON.stringify({
                densityState,
                aggregationMetadata: aggregationResult.metadata,
                performanceTiming: aggregationResult.timing,
                executedQuery: aggregationResult.executedQuery.substring(0, 200) + '...',
                sampleData: aggregationResult.data.slice(0, 3)
              }, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}