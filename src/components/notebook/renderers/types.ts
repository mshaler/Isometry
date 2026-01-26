import type {
  D3GroupSelection,
  ChartDatum,
  D3ChartTheme
} from '../../../types/d3';
import type { VisualizationConfig } from '../../../utils/d3Parsers';

export interface RenderDimensions {
  innerWidth: number;
  innerHeight: number;
}

export interface ChartRendererParams {
  g: D3GroupSelection;
  data: ChartDatum[];
  config: VisualizationConfig;
  dimensions: RenderDimensions;
  colors: D3ChartTheme;
}

export type ChartRenderer = (params: ChartRendererParams) => void;