import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { useD3 } from '@/hooks';
import { useTheme } from '../../contexts/ThemeContext';
// import type { VisualizationConfig } from '../../utils/d3Parsers';
import type { D3ChartTheme } from '../../types/d3';
import {
  renderBarChart,
  renderLineChart,
  renderScatterPlot,
  renderHistogram,
  renderPieChart,
  renderAreaChart,
  renderNetworkGraph,
  renderDefaultVisualization,
  renderErrorVisualization,
  type ChartRendererParams
} from './renderers';

interface D3VisualizationRendererProps {
  content?: string;
  width?: number;
  height?: number;
  className?: string;
  onDataPointsChange?: (count: number) => void;
}

export function D3VisualizationRenderer({
  content,
  width = 600,
  height = 400,
  className = '',
  onDataPointsChange
}: D3VisualizationRendererProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  // Simple local state to replace useD3Visualization hook to avoid circular dependency
  const [data, setData] = useState<any[]>([]);
  const [vizType, setVizType] = useState<string>('bar-chart');
  const [config, setConfig] = useState<any>({ type: 'bar-chart' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canVisualize, setCanVisualize] = useState(false);

  // Simple content parsing function
  const updateVisualization = useCallback((content: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Basic CSV/TSV parsing for demo purposes
      if (content.includes('\t') || content.includes(',')) {
        const lines = content.trim().split('\n');
        if (lines.length > 1) {
          const delimiter = content.includes('\t') ? '\t' : ',';
          const headers = lines[0].split(delimiter);
          const parsedData = lines.slice(1).map(line => {
            const values = line.split(delimiter);
            const row: any = {};
            headers.forEach((header, i) => {
              row[header.trim()] = isNaN(Number(values[i])) ? values[i]?.trim() : Number(values[i]);
            });
            return row;
          });

          setData(parsedData);
          setVizType('bar-chart');
          setConfig({ type: 'bar-chart' });
          setCanVisualize(parsedData.length > 0);
        } else {
          setCanVisualize(false);
        }
      } else {
        setCanVisualize(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse visualization data');
      setCanVisualize(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Track data points count
  useEffect(() => {
    if (data && onDataPointsChange) {
      onDataPointsChange(data.length);
    }
  }, [data, onDataPointsChange]);

  // Update visualization when content changes
  useEffect(() => {
    if (content) {
      updateVisualization(content);
    }
  }, [content, updateVisualization]);

  // Theme-based colors
  const colors: D3ChartTheme = useMemo(() => {
    if (theme === 'NeXTSTEP') {
      return {
        primary: '#4a5568',
        secondary: '#718096',
        accent: '#3182ce',
        background: '#c0c0c0',
        text: '#404040',
        border: '#707070',
        grid: '#a0a0a0'
      };
    } else {
      return {
        primary: '#3b82f6',
        secondary: '#6b7280',
        accent: '#10b981',
        background: 'white',
        text: '#1f2937',
        border: '#e5e7eb',
        grid: '#f3f4f6'
      };
    }
  }, [theme]);

  // Rendering function
  const renderVisualization = useCallback((selection: d3.Selection<SVGSVGElement, unknown, null, undefined>) => {
    if (!canVisualize || !data || !config) return;

    const margin = { top: 40, right: 40, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    selection.selectAll('*').remove();

    const svg = selection
      .attr('width', width)
      .attr('height', height)
      .style('background', colors.background);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const renderParams: ChartRendererParams = {
      g,
      data,
      config: config as any,
      dimensions: { innerWidth, innerHeight },
      colors
    };

    try {
      switch (vizType as any) {
        case 'bar-chart':
        case 'bar':
          renderBarChart(renderParams);
          break;
        case 'line-chart':
        case 'line':
          renderLineChart(renderParams);
          break;
        case 'scatter-plot':
        case 'scatter':
          renderScatterPlot(renderParams);
          break;
        case 'histogram':
          renderHistogram(renderParams);
          break;
        case 'pie-chart':
        case 'pie':
          renderPieChart(renderParams);
          break;
        case 'area-chart':
        case 'area':
          renderAreaChart(renderParams);
          break;
        case 'network-graph':
          renderNetworkGraph(renderParams);
          break;
        default:
          renderDefaultVisualization(g, { innerWidth, innerHeight }, colors);
      }
    } catch (renderError) {
      console.error('D3 rendering error:', renderError);
      renderErrorVisualization(g, renderError instanceof Error ? renderError.message : 'Rendering failed', { innerWidth, innerHeight }, colors);
    }

    // Add transition animations
    svg.selectAll('*')
      .style('opacity', 0)
      .transition()
      .duration(300)
      .style('opacity', 1);

  }, [canVisualize, data, vizType, config, width, height, colors]);

  // Use the existing useD3 hook for SVG management
  const svgRef = useD3(renderVisualization, [renderVisualization]);

  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <div
          className={`text-sm ${
            theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-500'
          }`}
        >
          Parsing visualization...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <div className="text-center">
          <div className="text-red-500 text-sm font-medium mb-1">
            Visualization Error
          </div>
          <div
            className={`text-xs ${
              theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-400'
            }`}
          >
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!canVisualize) {
    return (
      <div
        className={`flex items-center justify-center border-2 border-dashed ${
          theme === 'NeXTSTEP'
            ? 'border-[#808080] bg-[#d0d0d0]'
            : 'border-gray-300 bg-gray-50'
        } ${className}`}
        style={{ width, height }}
      >
        <div className="text-center">
          <div
            className={`text-sm mb-2 ${
              theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-700'
            }`}
          >
            No Data to Visualize
          </div>
          <div
            className={`text-xs ${
              theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-400'
            }`}
          >
            Add data or check your visualization syntax
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}