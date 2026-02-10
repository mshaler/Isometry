/**
 * Network Graph Interactions
 *
 * D3 drag, click, and hover behaviors for force-directed network graph.
 * Follows D3 v7 patterns with proper TypeScript typing.
 */

import * as d3 from 'd3';
import type { GraphNode, GraphLink } from './types';

// ============================================================================
// Drag Behavior
// ============================================================================

/**
 * Create drag behavior for network graph nodes
 * @param simulation - The D3 force simulation instance
 * @param onDragEnd - Optional callback when drag ends
 * @returns D3 drag behavior configured for force graph nodes
 */
export function createDragBehavior(
  simulation: d3.Simulation<GraphNode, GraphLink>,
  onDragEnd?: (nodeId: string) => void
): d3.DragBehavior<SVGCircleElement, GraphNode, GraphNode | d3.SubjectPosition> {
  function dragstarted(event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>, d: GraphNode) {
    // Only restart simulation if it's not active
    if (!event.active) {
      simulation.alphaTarget(0.3).restart();
    }
    // Fix position during drag
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>, d: GraphNode) {
    // Update fixed position to follow mouse
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>, d: GraphNode) {
    // Reduce simulation activity when drag ends
    if (!event.active) {
      simulation.alphaTarget(0);
    }
    // Release the node - let forces pull it back
    d.fx = null;
    d.fy = null;

    // Notify callback if provided
    if (onDragEnd) {
      onDragEnd(d.id);
    }
  }

  return d3.drag<SVGCircleElement, GraphNode>()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);
}

// ============================================================================
// Click Behavior
// ============================================================================

/**
 * Create click handler for node selection
 * @param onSelect - Callback when a node is selected
 * @returns Click event handler function
 */
export function createClickBehavior(
  onSelect: (nodeId: string) => void
): (event: MouseEvent, d: GraphNode) => void {
  return function handleClick(event: MouseEvent, d: GraphNode) {
    // Prevent default and stop propagation
    event.preventDefault();
    event.stopPropagation();

    // Call selection callback with node ID
    onSelect(d.id);
  };
}

// ============================================================================
// Hover Behavior
// ============================================================================

export interface HoverHandlers {
  onMouseEnter: (event: MouseEvent, d: GraphNode) => void;
  onMouseLeave: (event: MouseEvent, d: GraphNode) => void;
}

/**
 * Create hover handlers for node highlighting
 * @param onHover - Callback with node ID on enter, null on leave
 * @returns Object with mouseenter and mouseleave handlers
 */
export function createHoverBehavior(
  onHover: (nodeId: string | null) => void
): HoverHandlers {
  function onMouseEnter(_event: MouseEvent, d: GraphNode) {
    onHover(d.id);
  }

  function onMouseLeave(_event: MouseEvent, _d: GraphNode) {
    onHover(null);
  }

  return {
    onMouseEnter,
    onMouseLeave,
  };
}

// ============================================================================
// Selection Highlight
// ============================================================================

/**
 * Apply visual highlight to selected node
 * @param container - SVG group containing nodes
 * @param selectedId - ID of selected node, or null to clear selection
 */
export function applySelectionHighlight(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  selectedId: string | null
): void {
  // Update node circles
  container.selectAll<SVGCircleElement, GraphNode>('.network-node')
    .attr('stroke-width', d => d.id === selectedId ? 3 : 1.5)
    .attr('stroke', d => d.id === selectedId ? '#2563eb' : '#fff');

  // Optionally dim non-connected nodes/links
  if (selectedId) {
    container.selectAll<SVGLineElement, GraphLink>('.network-link')
      .attr('opacity', d => {
        const source = typeof d.source === 'string' ? d.source : d.source.id;
        const target = typeof d.target === 'string' ? d.target : d.target.id;
        return source === selectedId || target === selectedId ? 1 : 0.2;
      });
  } else {
    // Reset all links to default opacity
    container.selectAll<SVGLineElement, GraphLink>('.network-link')
      .attr('opacity', d => {
        // Use the default opacity from edge type styles
        return 0.8;
      });
  }
}

// ============================================================================
// Hover Highlight
// ============================================================================

/**
 * Apply visual highlight on hover
 * @param container - SVG group containing nodes
 * @param hoveredId - ID of hovered node, or null to clear
 */
export function applyHoverHighlight(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  hoveredId: string | null
): void {
  if (hoveredId) {
    // Highlight hovered node with scale transform
    container.selectAll<SVGCircleElement, GraphNode>('.network-node')
      .attr('r', d => d.id === hoveredId ? 10 : 8);

    // Show labels only for hovered node and connected nodes
    container.selectAll<SVGTextElement, GraphNode>('.network-label')
      .attr('font-weight', d => d.id === hoveredId ? 'bold' : 'normal');
  } else {
    // Reset to default size
    container.selectAll<SVGCircleElement, GraphNode>('.network-node')
      .attr('r', 8);

    container.selectAll<SVGTextElement, GraphNode>('.network-label')
      .attr('font-weight', 'normal');
  }
}
