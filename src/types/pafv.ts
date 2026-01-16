// PAFV types

export type LATCHAxis = 'L' | 'A' | 'T' | 'C' | 'H';
export type FacetType = 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'location';

export interface Facet {
  id: string;
  name: string;
  facetType: FacetType;
  axis: LATCHAxis;
  sourceColumn: string;
  options: string[] | null;
  icon: string | null;
  color: string | null;
  enabled: boolean;
  sortOrder: number;
}

export interface PAFVState {
  xAxis: string | null;
  yAxis: string | null;
  zAxis: string | null;
  available: string[];
}

export const DEFAULT_PAFV: PAFVState = {
  xAxis: 'folder',
  yAxis: 'modified',
  zAxis: null,
  available: ['tags', 'priority', 'created', 'name', 'location'],
};
