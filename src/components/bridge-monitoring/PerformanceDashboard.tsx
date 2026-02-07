/**
 * Bridge Performance Dashboard
 *
 * Real-time visualization of bridge optimization metrics with D3 charts.
 * Displays bridge latency, compression ratios, failure rates, and system health.
 * Includes alert notifications and integration with Isometry UI theme system.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { PerformanceMonitor, BridgeMetrics, BridgeAlert } from '../../utils/bridge-optimization/performance-monitor';

interface PerformanceDashboardProps {
  monitor: PerformanceMonitor;
  refreshInterval?: number; // Dashboard update interval (ms, default: 1000)
  showDebugInfo?: boolean;   // Show debug metrics
  className?: string;
}

interface ChartDimensions {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
}

/**
 * Real-time Bridge Performance Dashboard
 */
export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  monitor,
  refreshInterval = 1000,
  showDebugInfo = false,
  className = ''
}) => {
  const [metrics, setMetrics] = useState<BridgeMetrics | null>(null);
  const [alerts, setAlerts] = useState<BridgeAlert[]>([]);
  const [trends, setTrends] = useState<{
    latencyTrend: number[];
    compressionTrend: number[];
    failureRateTrend: number[];
    timestamps: number[];
  } | null>(null);

  // Chart refs
  const latencyChartRef = useRef<SVGSVGElement>(null);
  const compressionChartRef = useRef<SVGSVGElement>(null);
  const healthChartRef = useRef<SVGSVGElement>(null);

  // Update metrics from monitor
  const updateMetrics = useCallback(() => {
    try {
      const currentMetrics = monitor.getMetrics();
      const currentAlerts = monitor.getAlerts();
      const currentTrends = monitor.getTrends(60000); // Last 1 minute

      setMetrics(currentMetrics);
      setAlerts(currentAlerts);
      setTrends(currentTrends);
    } catch (error) {
      console.error('[PerformanceDashboard] Failed to update metrics:', error);
    }
  }, [monitor]);

  // Setup update interval
  useEffect(() => {
    updateMetrics(); // Initial update
    const interval = setInterval(updateMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [updateMetrics, refreshInterval]);

  // Render latency trend chart
  useEffect(() => {
    if (!trends || !latencyChartRef.current) return;

    const svg = d3.select(latencyChartRef.current);
    svg.selectAll('*').remove();

    const dimensions: ChartDimensions = {
      width: 400,
      height: 120,
      margin: { top: 10, right: 10, bottom: 20, left: 40 }
    };

    const innerWidth = dimensions.width - dimensions.margin.left - dimensions.margin.right;
    const innerHeight = dimensions.height - dimensions.margin.top - dimensions.margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${dimensions.margin.left}, ${dimensions.margin.top})`);

    if (trends.latencyTrend.length === 0) {
      g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('class', 'text-neutral-500')
        .text('No latency data');
      return;
    }

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, trends.latencyTrend.length - 1])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, Math.max(d3.max(trends.latencyTrend) || 20, 20)])
      .range([innerHeight, 0]);

    // Line generator
    const line = d3.line<number>()
      .x((_, i) => xScale(i))
      .y(d => yScale(d))
      .curve(d3.curveCardinal);

    // Draw line
    g.append('path')
      .datum(trends.latencyTrend)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Draw target line (16ms)
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', yScale(16))
      .attr('y2', yScale(16))
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '5,5');

    // Y-axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4).tickFormat(d => `${d}ms`))
      .attr('class', 'text-xs text-neutral-600');

  }, [trends]);

  // Render compression ratio chart
  useEffect(() => {
    if (!trends || !compressionChartRef.current) return;

    const svg = d3.select(compressionChartRef.current);
    svg.selectAll('*').remove();

    const dimensions: ChartDimensions = {
      width: 400,
      height: 120,
      margin: { top: 10, right: 10, bottom: 20, left: 40 }
    };

    const innerWidth = dimensions.width - dimensions.margin.left - dimensions.margin.right;
    const innerHeight = dimensions.height - dimensions.margin.top - dimensions.margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${dimensions.margin.left}, ${dimensions.margin.top})`);

    if (trends.compressionTrend.length === 0) {
      g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('class', 'text-neutral-500')
        .text('No compression data');
      return;
    }

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, trends.compressionTrend.length - 1])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, Math.max(d3.max(trends.compressionTrend) || 100, 100)])
      .range([innerHeight, 0]);

    // Area generator
    const area = d3.area<number>()
      .x((_, i) => xScale(i))
      .y0(innerHeight)
      .y1(d => yScale(d))
      .curve(d3.curveCardinal);

    // Draw area
    g.append('path')
      .datum(trends.compressionTrend)
      .attr('fill', 'url(#compressionGradient)')
      .attr('d', area);

    // Define gradient
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'compressionGradient')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', 0)
      .attr('y2', 1);

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#10b981')
      .attr('stop-opacity', 0.8);

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#10b981')
      .attr('stop-opacity', 0.1);

    // Y-axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4).tickFormat(d => `${d}%`))
      .attr('class', 'text-xs text-neutral-600');

  }, [trends]);

  // Render health score gauge
  useEffect(() => {
    if (!metrics || !healthChartRef.current) return;

    const svg = d3.select(healthChartRef.current);
    svg.selectAll('*').remove();

    const size = 120;
    const radius = size / 2 - 10;
    const centerX = size / 2;
    const centerY = size / 2;

    const g = svg.append('g')
      .attr('transform', `translate(${centerX}, ${centerY})`);

    // Background arc
    const backgroundArc = d3.arc()
      .innerRadius(radius - 10)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)
      .endAngle(Math.PI / 2);

    g.append('path')
      .attr('d', backgroundArc({} as any))
      .attr('fill', '#f3f4f6');

    // Health score arc
    const healthScore = metrics.health.overallScore;
    const scoreAngle = -Math.PI / 2 + (Math.PI * (healthScore / 100));

    const scoreArc = d3.arc()
      .innerRadius(radius - 10)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)
      .endAngle(scoreAngle);

    // Color based on health score
    let color = '#10b981'; // Green
    if (healthScore < 50) color = '#ef4444'; // Red
    else if (healthScore < 75) color = '#f59e0b'; // Yellow

    g.append('path')
      .attr('d', scoreArc({} as any))
      .attr('fill', color);

    // Health score text
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.3em')
      .attr('class', 'text-2xl font-bold')
      .attr('fill', color)
      .text(healthScore);

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.5em')
      .attr('class', 'text-xs text-neutral-600')
      .text('Health Score');

  }, [metrics]);

  // Alert acknowledgment handler
  const handleAcknowledgeAlert = (alertId: string) => {
    monitor.acknowledgeAlert(alertId);
    updateMetrics(); // Refresh to show acknowledged state
  };

  if (!metrics) {
    return (
      <div className={`p-4 bg-white rounded-lg shadow ${className}`}>
        <div className="text-center text-neutral-500">Loading performance metrics...</div>
      </div>
    );
  }

  const getAlertBadgeColor = (severity: BridgeAlert['severity']) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const formatLatency = (ms: number) => `${ms.toFixed(1)}ms`;
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className={`p-6 bg-white rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-neutral-800">Bridge Performance</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              metrics.health.overallScore >= 75 ? 'bg-green-500' :
              metrics.health.overallScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
            <span className="text-sm text-neutral-600">
              {metrics.health.overallScore >= 75 ? 'Healthy' :
               metrics.health.overallScore >= 50 ? 'Degraded' : 'Critical'}
            </span>
          </div>
          <button
            onClick={() => monitor.clearAcknowledgedAlerts()}
            className="text-xs text-neutral-500 hover:text-neutral-700"
          >
            Clear Alerts
          </button>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Latency Metric */}
        <div className="bg-neutral-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-neutral-600">Bridge Latency</h3>
          <div className="mt-2">
            <div className={`text-2xl font-bold ${
              metrics.batchLatency.current <= 12 ? 'text-green-600' :
              metrics.batchLatency.current <= 16 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {formatLatency(metrics.batchLatency.current)}
            </div>
            <div className="text-xs text-neutral-500">
              Avg: {formatLatency(metrics.batchLatency.average)} |
              P95: {formatLatency(metrics.batchLatency.p95)}
            </div>
          </div>
        </div>

        {/* Compression Metric */}
        <div className="bg-neutral-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-neutral-600">Compression</h3>
          <div className="mt-2">
            <div className={`text-2xl font-bold ${
              metrics.serialization.compressionRatio >= 40 ? 'text-green-600' :
              metrics.serialization.compressionRatio >= 30 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {formatPercentage(metrics.serialization.compressionRatio)}
            </div>
            <div className="text-xs text-neutral-500">
              {formatBytes(metrics.serialization.payloadSizeAfter)} /
              {formatBytes(metrics.serialization.payloadSizeBefore)}
            </div>
          </div>
        </div>

        {/* Reliability Metric */}
        <div className="bg-neutral-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-neutral-600">Reliability</h3>
          <div className="mt-2">
            <div className={`text-2xl font-bold ${
              metrics.reliability.failureRate <= 1 ? 'text-green-600' :
              metrics.reliability.failureRate <= 5 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {formatPercentage(metrics.reliability.successRate)}
            </div>
            <div className="text-xs text-neutral-500">
              State: {metrics.reliability.state} |
              Failures: {formatPercentage(metrics.reliability.failureRate)}
            </div>
          </div>
        </div>

        {/* Queue Metric */}
        <div className="bg-neutral-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-neutral-600">Message Queue</h3>
          <div className="mt-2">
            <div className="text-2xl font-bold text-neutral-700">
              {metrics.batchEfficiency.queueSize}
            </div>
            <div className="text-xs text-neutral-500">
              {formatPercentage(
                metrics.batchEfficiency.queueSize / metrics.batchEfficiency.maxQueueSize * 100
              )} capacity |
              Rate: {metrics.batchEfficiency.batchRate.toFixed(1)}/s
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Latency Trend Chart */}
        <div className="bg-neutral-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-neutral-600 mb-3">Latency Trend</h3>
          <svg
            ref={latencyChartRef}
            width={400}
            height={120}
            className="w-full"
          />
          <div className="text-xs text-neutral-500 mt-2">
            Target: &lt; 16ms for 60fps | Current: {formatLatency(metrics.batchLatency.current)}
          </div>
        </div>

        {/* Compression Trend Chart */}
        <div className="bg-neutral-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-neutral-600 mb-3">Compression Efficiency</h3>
          <svg
            ref={compressionChartRef}
            width={400}
            height={120}
            className="w-full"
          />
          <div className="text-xs text-neutral-500 mt-2">
            Target: 40-60% reduction | Current: {formatPercentage(metrics.serialization.compressionRatio)}
          </div>
        </div>

        {/* Health Score Gauge */}
        <div className="bg-neutral-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-neutral-600 mb-3">System Health</h3>
          <div className="flex justify-center">
            <svg
              ref={healthChartRef}
              width={120}
              height={120}
            />
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-neutral-800 mb-3">Active Alerts</h3>
          <div className="space-y-2">
            {alerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border ${getAlertBadgeColor(alert.severity)} ${
                  alert.acknowledged ? 'opacity-60' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium">{alert.title}</div>
                    <div className="text-sm mt-1">{alert.message}</div>
                    <div className="text-xs mt-2 text-neutral-500">
                      {new Date(alert.timestamp).toLocaleTimeString()} | {alert.category}
                    </div>
                  </div>
                  {!alert.acknowledged && (
                    <button
                      onClick={() => handleAcknowledgeAlert(alert.id)}
                      className="ml-2 text-xs bg-white bg-opacity-50 hover:bg-opacity-75 px-2 py-1 rounded"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            ))}
            {alerts.length > 5 && (
              <div className="text-sm text-neutral-500 text-center">
                +{alerts.length - 5} more alerts
              </div>
            )}
          </div>
        </div>
      )}

      {/* Debug Info Section */}
      {showDebugInfo && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-neutral-800 mb-3">Debug Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <h4 className="font-medium mb-2">Batch Efficiency</h4>
              <div className="space-y-1 text-neutral-600">
                <div>Messages/batch: {metrics.batchEfficiency.messagesPerBatch.toFixed(1)}</div>
                <div>Batch rate: {metrics.batchEfficiency.batchRate.toFixed(2)}/s</div>
                <div>Queue utilization: {formatPercentage(
                  metrics.batchEfficiency.queueSize / metrics.batchEfficiency.maxQueueSize * 100
                )}</div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Pagination</h4>
              <div className="space-y-1 text-neutral-600">
                <div>Pages processed: {metrics.pagination.pageCount}</div>
                <div>Records/page: {metrics.pagination.recordsPerPage.toFixed(1)}</div>
                <div>Page response time: {formatLatency(metrics.pagination.pageResponseTime)}</div>
                <div>Cache hit rate: {formatPercentage(metrics.pagination.cursorCacheHitRate)}</div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Serialization</h4>
              <div className="space-y-1 text-neutral-600">
                <div>Serialization time: {formatLatency(metrics.serialization.serializationTime)}</div>
                <div>Avg payload before: {formatBytes(metrics.serialization.payloadSizeBefore)}</div>
                <div>Avg payload after: {formatBytes(metrics.serialization.payloadSizeAfter)}</div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Circuit Breaker</h4>
              <div className="space-y-1 text-neutral-600">
                <div>State transitions: {metrics.reliability.stateTransitions}</div>
                <div>Last failure: {metrics.reliability.lastFailureTime ?
                  new Date(metrics.reliability.lastFailureTime).toLocaleTimeString() : 'None'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-neutral-500 text-center mt-6">
        Last updated: {new Date(metrics.health.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default PerformanceDashboard;