// View types

import type { Node } from './node';

export type ViewType = 'grid' | 'list' | 'kanban' | 'timeline' | 'calendar' | 'network' | 'tree';

export interface Dimensions {
  width: number;
  height: number;
}

export interface ViewState {
  app: string;
  view: ViewType;
  dataset: string;
}

export interface SelectionState {
  selectedIds: Set<string>;
  lastSelectedId: string | null;
  anchorId: string | null;
}

// D3 selection type (simplified for interface definition)
export type D3Container = d3.Selection<SVGGElement, unknown, null, undefined>;

export interface ViewRenderer {
  readonly type: ViewType;
  readonly name: string;
  
  setXAxis(facetId: string | null): void;
  setYAxis(facetId: string | null): void;
  
  render(
    container: D3Container,
    nodes: Node[],
    dimensions: Dimensions
  ): void;
  
  destroy(): void;
  
  onCardClick?(node: Node, event: MouseEvent): void;
  onCardHover?(node: Node | null): void;
}
