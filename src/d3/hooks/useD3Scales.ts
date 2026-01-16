/**
 * useD3Scales Hook
 *
 * Creates and memoizes D3 scales from data and PAFV axis configuration.
 * Integrates with LATCH scale factories.
 */

import { useMemo } from 'react';
import * as d3 from 'd3';
import type { CardValue, D3LATCHAxis } from '@/types/lpg';
import { createLATCHScale, type LATCHScale, type ScaleOptions } from '../scales';

// ============================================
// Types
// ============================================

export interface UseD3ScalesOptions {
  /** X-axis LATCH type */
  xAxis: D3LATCHAxis;
  /** Y-axis LATCH type */
  yAxis: D3LATCHAxis;
  /** Inner width for X scale range */
  innerWidth: number;
  /** Inner height for Y scale range */
  innerHeight: number;
  /** Scale options */
  scaleOptions?: ScaleOptions;
}

export interface D3Scales {
  /** X-axis scale */
  xScale: LATCHScale;
  /** Y-axis scale */
  yScale: LATCHScale;
  /** Get x position for a card */
  getX: (card: CardValue) => number;
  /** Get y position for a card */
  getY: (card: CardValue) => number;
  /** Get bandwidth (for band scales) */
  xBandwidth: () => number;
  yBandwidth: () => number;
}

// ============================================
// Hook Implementation
// ============================================

export function useD3Scales(data: CardValue[], options: UseD3ScalesOptions): D3Scales {
  const { xAxis, yAxis, innerWidth, innerHeight, scaleOptions = {} } = options;

  return useMemo(() => {
    // Create LATCH scales
    const xScale = createLATCHScale(xAxis, data, [0, innerWidth], scaleOptions);
    const yScale = createLATCHScale(yAxis, data, [0, innerHeight], scaleOptions);

    // Position helpers with fallback
    const getX = (card: CardValue): number => xScale.getPosition(card) ?? 0;
    const getY = (card: CardValue): number => yScale.getPosition(card) ?? 0;

    // Bandwidth helpers (returns 0 for continuous scales)
    const xBandwidth = () => xScale.bandwidth?.() ?? 0;
    const yBandwidth = () => yScale.bandwidth?.() ?? 0;

    return { xScale, yScale, getX, getY, xBandwidth, yBandwidth };
  }, [data, xAxis, yAxis, innerWidth, innerHeight, scaleOptions]);
}

// ============================================
// Additional Scale Hooks
// ============================================

/**
 * Create a simple linear scale from data extent.
 */
export function useLinearScale(
  data: number[],
  range: [number, number],
  nice = true
): d3.ScaleLinear<number, number> {
  return useMemo(() => {
    const extent = d3.extent(data) as [number, number];
    const scale = d3.scaleLinear().domain(extent || [0, 1]).range(range);
    if (nice) scale.nice();
    return scale;
  }, [data, range, nice]);
}

/**
 * Create a band scale from string values.
 */
export function useBandScale(
  domain: string[],
  range: [number, number],
  padding = 0.1
): d3.ScaleBand<string> {
  return useMemo(
    () => d3.scaleBand<string>().domain(domain).range(range).padding(padding),
    [domain, range, padding]
  );
}

/**
 * Create a time scale from date extent.
 */
export function useTimeScale(
  data: Date[],
  range: [number, number],
  nice = true
): d3.ScaleTime<number, number> {
  return useMemo(() => {
    const extent = d3.extent(data) as [Date, Date];
    const scale = d3.scaleTime().domain(extent || [new Date(), new Date()]).range(range);
    if (nice) scale.nice();
    return scale;
  }, [data, range, nice]);
}

/**
 * Create an ordinal color scale.
 */
export function useColorScale(
  domain: string[],
  colors?: string[]
): d3.ScaleOrdinal<string, string> {
  return useMemo(
    () =>
      d3
        .scaleOrdinal<string>()
        .domain(domain)
        .range(colors || d3.schemeTableau10),
    [domain, colors]
  );
}

export default useD3Scales;
