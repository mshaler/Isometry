import * as d3 from 'd3';
import type { SimulationNodeDatum, SimulationLinkDatum, D3ForceSimulation } from '../../../types/d3';
import type { ChartRendererParams } from './types';

export function renderNetworkGraph({
  g,
  data,
  config,
  dimensions,
  colors
}: ChartRendererParams): void {
  // Simple network visualization for node-link data
  const { innerWidth, innerHeight } = dimensions;
  const { x: sourceField = 'source', y: targetField = 'target' } = config.axes;

  // Create nodes and links
  const nodeIds = new Set<string>();
  data.forEach(d => {
    nodeIds.add(d[sourceField] as string);
    nodeIds.add(d[targetField] as string);
  });

  interface NetworkSimulationNode extends SimulationNodeDatum {
    id: string;
  }

  interface NetworkSimulationLink extends SimulationLinkDatum<NetworkSimulationNode> {
    source: string | NetworkSimulationNode;
    target: string | NetworkSimulationNode;
  }

  const nodes: NetworkSimulationNode[] = Array.from(nodeIds).map(id => ({ id, x: 0, y: 0 }));
  const links: NetworkSimulationLink[] = data.map(d => ({
    source: d[sourceField] as string,
    target: d[targetField] as string
  }));

  const simulation: D3ForceSimulation<NetworkSimulationNode> = d3.forceSimulation(nodes)
    .force('link', d3.forceLink<NetworkSimulationNode, NetworkSimulationLink>(links).id((d: NetworkSimulationNode) => d.id))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(innerWidth / 2, innerHeight / 2));

  // Links
  const link = g.selectAll('.link')
    .data(links)
    .enter().append('line')
    .attr('class', 'link')
    .style('stroke', colors.secondary)
    .style('stroke-width', 2);

  // Nodes
  const node = g.selectAll('.node')
    .data(nodes)
    .enter().append('circle')
    .attr('class', 'node')
    .attr('r', 8)
    .style('fill', colors.primary)
    .style('stroke', colors.background)
    .style('stroke-width', 2);

  // Update positions
  simulation.on('tick', () => {
    link
      .attr('x1', (d: NetworkSimulationLink) => (d.source as NetworkSimulationNode).x || 0)
      .attr('y1', (d: NetworkSimulationLink) => (d.source as NetworkSimulationNode).y || 0)
      .attr('x2', (d: NetworkSimulationLink) => (d.target as NetworkSimulationNode).x || 0)
      .attr('y2', (d: NetworkSimulationLink) => (d.target as NetworkSimulationNode).y || 0);

    node
      .attr('cx', (d: NetworkSimulationNode) => d.x || 0)
      .attr('cy', (d: NetworkSimulationNode) => d.y || 0);
  });

  // Stop simulation after a while to save CPU
  setTimeout(() => simulation.stop(), 3000);
}