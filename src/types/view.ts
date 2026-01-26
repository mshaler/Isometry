// View types

import type { Node } from './node';

export type ViewType = 'grid' | 'list' | 'kanban' | 'timeline' | 'calendar' | 'network' | 'tree';
export type RenderMode = 'react' | 'd3';

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

// Transition animation configuration
export interface TransitionConfig {
  duration: number;
  easing: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
  stagger?: number;
}

// View transition state preservation
export interface ViewTransitionState {
  scrollPosition?: { x: number; y: number };
  selection?: SelectionState;
  zoom?: { scale: number; translate: [number, number] };
  filters?: Record<string, unknown>;
  axisConfiguration?: { x: string | null; y: string | null };
}

// D3 selection type (simplified for interface definition)
export type D3Container = d3.Selection<SVGGElement, unknown, null, undefined>;

// Base ViewRenderer interface - supports both React and D3 modes
export interface ViewRenderer {
  readonly type: ViewType;
  readonly name: string;
  readonly renderMode: RenderMode;

  // Axis configuration for PAFV integration
  setXAxis(facetId: string | null): void;
  setYAxis(facetId: string | null): void;

  // React component rendering (for React mode)
  renderComponent?(
    props: ViewComponentProps
  ): React.ReactElement;

  // D3 rendering (for D3 mode)
  render?(
    container: D3Container,
    nodes: Node[],
    dimensions: Dimensions
  ): void;

  // Lifecycle methods
  initialize?(container: HTMLElement | D3Container): void;
  destroy(): void;

  // State management for transitions
  saveState(): ViewTransitionState;
  loadState(state: ViewTransitionState): void;

  // Transition methods for smooth view switching
  transitionFrom?(
    previousView: ViewRenderer,
    config?: TransitionConfig
  ): Promise<void>;

  transitionTo?(
    nextView: ViewRenderer,
    config?: TransitionConfig
  ): Promise<void>;

  // Event handlers
  onCardClick?(node: Node, event: MouseEvent): void;
  onCardHover?(node: Node | null): void;
  onResize?(dimensions: Dimensions): void;

  // Performance optimization hooks
  shouldUpdate?(
    previousNodes: Node[],
    nextNodes: Node[],
    previousDimensions: Dimensions,
    nextDimensions: Dimensions
  ): boolean;
}

// Props interface for React-based view components
export interface ViewComponentProps {
  data: Node[];
  dimensions: Dimensions;
  onNodeClick?: (node: Node) => void;
  transitionState?: ViewTransitionState;
}
