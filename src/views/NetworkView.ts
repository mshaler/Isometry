// Isometry v5 — Phase 7 NetworkView
// Force-directed graph view with zoom/pan/drag/hover interactions.
//
// Design:
//   - Implements IView: mount() once, render() on each data update, destroy() before replacement
//   - Force simulation runs in Worker via bridge.send('graph:simulate') — main thread never simulates
//   - Main thread receives only stable {id, x, y}[] positions — never per-tick updates
//   - D3 key function `d => d.id` is MANDATORY on every .data() call (VIEW-09)
//   - Warm start: positionMap stores previous positions, passed to next simulate call
//   - Drag-to-pin sets fx/fy; hover dimming is immediate (no transition delay)
//
// Requirements: VIEW-08, REND-05

import * as d3 from 'd3';
import type { IView, CardDatum, WorkerBridgeLike } from './types';
import type { SimulatePayload, SimulateNode, SimulateLink, NodePosition } from '../worker/protocol';
import { SelectionProvider } from '../providers/SelectionProvider';
import { auditState } from '../audit/AuditState';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_RADIUS = 8;
const MAX_RADIUS = 28;
const DEFAULT_NODE_OPACITY = 1.0;
const DIM_NODE_OPACITY = 0.2;
const DEFAULT_EDGE_OPACITY = 0.4;
const DIM_EDGE_OPACITY = 0.1;
const NODE_LABEL_FONT_SIZE = 10;
const EDGE_STROKE = '#666666';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Node datum used for D3 data join + drag interaction */
interface NodeDatum {
  id: string;
  name: string;
  card_type: string;
  degree: number;
  x: number;
  y: number;
  fx: number | null;
  fy: number | null;
}

/** Edge datum used for D3 data join */
interface EdgeDatum {
  id: string;       // source + '-' + target
  source: string;
  target: string;
  label: string;
}

/** Config accepted by NetworkView constructor */
export interface NetworkViewConfig {
  bridge: WorkerBridgeLike;
  selectionProvider?: SelectionProvider;
}

// ---------------------------------------------------------------------------
// NetworkView
// ---------------------------------------------------------------------------

/**
 * Force-directed graph view.
 *
 * Renders cards as SVG circles with labels; connections as SVG lines.
 * Force simulation runs off-thread in the Worker.
 *
 * @implements IView
 */
export class NetworkView implements IView {
  private readonly bridge: WorkerBridgeLike;
  private selectionProvider: SelectionProvider | null;

  // DOM references (null until mounted)
  private container: HTMLElement | null = null;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private graphLayer: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private linksGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private nodesGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private zoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;

  // State
  private positionMap: Map<string, NodePosition> = new Map();
  private currentEdges: EdgeDatum[] = [];
  private destroyed = false;

  // Subscription cleanup
  private unsubscribeSelection: (() => void) | null = null;

  constructor(config: NetworkViewConfig) {
    this.bridge = config.bridge;
    this.selectionProvider = config.selectionProvider ?? null;
  }

  // ---------------------------------------------------------------------------
  // IView: mount
  // ---------------------------------------------------------------------------

  /**
   * Mount the network view into the given container.
   * Creates SVG with graph-layer group, links sub-group, nodes sub-group, and zoom behavior.
   * Called once by ViewManager before the first render.
   */
  mount(container: HTMLElement): void {
    this.container = container;
    this.destroyed = false;

    // Create SVG
    this.svg = d3
      .select<HTMLElement, unknown>(container)
      .append<SVGSVGElement>('svg')
      .attr('class', 'network-view')
      .attr('width', '100%')
      .attr('height', '100%');

    // Create inner group for zoom transform
    this.graphLayer = this.svg
      .append<SVGGElement>('g')
      .attr('class', 'graph-layer');

    // Links group (rendered first — behind nodes)
    this.linksGroup = this.graphLayer
      .append<SVGGElement>('g')
      .attr('class', 'links');

    // Nodes group (rendered second — in front of links)
    this.nodesGroup = this.graphLayer
      .append<SVGGElement>('g')
      .attr('class', 'nodes');

    // Set up d3-zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        if (this.graphLayer) {
          this.graphLayer.attr('transform', event.transform.toString());
        }
      });

    this.svg.call(zoom);
    this.zoom = zoom;

    // Subscribe to selection changes to update highlights
    if (this.selectionProvider) {
      this.unsubscribeSelection = this.selectionProvider.subscribe(() => {
        this._updateSelectionHighlights();
      });
    }
  }

  // ---------------------------------------------------------------------------
  // IView: render
  // ---------------------------------------------------------------------------

  /**
   * Render cards as a force-directed graph.
   *
   * Workflow:
   *   1. If empty — clear SVG content and return
   *   2. Fetch connections via db:exec
   *   3. Build SimulatePayload with warm-start positions from positionMap
   *   4. Send graph:simulate to Worker, await stable NodePosition[]
   *   5. Update positionMap, render nodes + edges via D3 data join with key d => d.id
   *
   * @param cards - Array of CardDatum to render. Empty array = show empty state.
   */
  async render(cards: CardDatum[]): Promise<void> {
    if (this.destroyed) return;
    if (!this.svg || !this.nodesGroup || !this.linksGroup) return;

    if (cards.length === 0) {
      this._clearGraph();
      return;
    }

    // Build card lookup
    const cardMap = new Map<string, CardDatum>(cards.map(c => [c.id, c]));
    const cardIds = cards.map(c => c.id);

    // Fetch connections between visible cards
    let edges: EdgeDatum[] = [];
    try {
      // Build parameterized IN clause
      const placeholders = cardIds.map(() => '?').join(', ');
      const sql = `
        SELECT DISTINCT
          c.id,
          c.source_id,
          c.target_id,
          c.label
        FROM connections c
        WHERE (c.source_id IN (${placeholders}) OR c.target_id IN (${placeholders}))
          AND c.deleted_at IS NULL
      `;
      // params: cardIds twice (for source_id IN and target_id IN)
      const params = [...cardIds, ...cardIds];
      const result = (await this.bridge.send('db:exec', { sql, params })) as unknown;

      // db:exec for SELECT returns rows, check shape
      const resultAny = result as { rows?: Array<Record<string, unknown>>; changes?: number } | null;
      const rows: Array<Record<string, unknown>> = resultAny?.rows ?? [];
      edges = rows.map(row => ({
        id: String(row['id'] ?? `${row['source_id']}-${row['target_id']}`),
        source: String(row['source_id'] ?? ''),
        target: String(row['target_id'] ?? ''),
        label: String(row['label'] ?? ''),
      }));
    } catch {
      // If connection fetch fails, render without edges
      edges = [];
    }

    // Filter edges to only those between visible cards
    edges = edges.filter(e => cardMap.has(e.source) && cardMap.has(e.target));

    // Compute degree for each card
    const degreeMap = new Map<string, number>(cardIds.map(id => [id, 0]));
    for (const edge of edges) {
      degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1);
      degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1);
    }

    // Build SimulateNode[] with warm-start positions
    // Use explicit conditional to satisfy exactOptionalPropertyTypes
    const simNodes: SimulateNode[] = cards.map(c => {
      const prev = this.positionMap.get(c.id);
      const node: SimulateNode = {
        id: c.id,
        degree: degreeMap.get(c.id) ?? 0,
        fx: prev?.fx ?? null,
        fy: prev?.fy ?? null,
      };
      if (prev !== undefined) {
        node.x = prev.x;
        node.y = prev.y;
      }
      return node;
    });

    // Build SimulateLink[]
    const simLinks: SimulateLink[] = edges.map(e => ({
      source: e.source,
      target: e.target,
    }));

    // Get viewport size
    const width = this.container?.clientWidth || 800;
    const height = this.container?.clientHeight || 600;

    // Send simulation to Worker
    const payload: SimulatePayload = {
      nodes: simNodes,
      links: simLinks,
      width,
      height,
    };

    let positions: NodePosition[] = [];
    try {
      positions = (await this.bridge.send('graph:simulate', payload)) as NodePosition[];
    } catch {
      // If simulation fails, use default positions
      positions = cards.map((c, i) => ({
        id: c.id,
        x: width / 2 + (i - cards.length / 2) * 100,
        y: height / 2,
        fx: null,
        fy: null,
      }));
    }

    // Update positionMap with stable positions
    for (const pos of positions) {
      this.positionMap.set(pos.id, pos);
    }

    // Store edges for hover dimming
    this.currentEdges = edges;

    // Build degree scale
    const maxDegree = Math.max(1, ...Array.from(degreeMap.values()));
    const degreeScale = d3.scaleSqrt()
      .domain([0, maxDegree])
      .range([MIN_RADIUS, MAX_RADIUS]);

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // Build NodeDatum array from cards + positions
    const nodeDatums: NodeDatum[] = cards.map(c => {
      const pos = this.positionMap.get(c.id);
      return {
        id: c.id,
        name: c.name,
        card_type: c.card_type,
        degree: degreeMap.get(c.id) ?? 0,
        x: pos?.x ?? width / 2,
        y: pos?.y ?? height / 2,
        fx: pos?.fx ?? null,
        fy: pos?.fy ?? null,
      };
    });

    // Capture this for closures
    const self = this;

    // Render edges (lines) — D3 data join with key function
    this.linksGroup
      .selectAll<SVGGElement, EdgeDatum>('g.edge')
      .data(edges, d => d.id)
      .join(
        enter => {
          const g = enter.append<SVGGElement>('g').attr('class', 'edge');
          g.append<SVGLineElement>('line')
            .attr('stroke', EDGE_STROKE)
            .attr('stroke-opacity', DEFAULT_EDGE_OPACITY)
            .attr('x1', d => self.positionMap.get(d.source)?.x ?? 0)
            .attr('y1', d => self.positionMap.get(d.source)?.y ?? 0)
            .attr('x2', d => self.positionMap.get(d.target)?.x ?? 0)
            .attr('y2', d => self.positionMap.get(d.target)?.y ?? 0);
          // Edge label (hidden by default — SVG title for tooltip)
          g.append<SVGTitleElement>('title').text(d => d.label || `${d.source} → ${d.target}`);
          // Mouse events for edge hover label
          g.on('mouseenter', function (_, d) {
            d3.select(this).select('line').attr('stroke-opacity', 0.9);
            // Show inline text label near edge midpoint
            const srcPos = self.positionMap.get(d.source);
            const tgtPos = self.positionMap.get(d.target);
            if (srcPos && tgtPos) {
              d3.select(this).append<SVGTextElement>('text')
                .attr('class', 'edge-label')
                .attr('x', (srcPos.x + tgtPos.x) / 2)
                .attr('y', (srcPos.y + tgtPos.y) / 2)
                .attr('text-anchor', 'middle')
                .attr('font-size', '9px')
                .attr('fill', '#333')
                .text(d.label || '');
            }
          })
          .on('mouseleave', function () {
            d3.select(this).select('line').attr('stroke-opacity', DEFAULT_EDGE_OPACITY);
            d3.select(this).select('text.edge-label').remove();
          });
          return g;
        },
        update => {
          update.select('line')
            .attr('x1', d => self.positionMap.get(d.source)?.x ?? 0)
            .attr('y1', d => self.positionMap.get(d.source)?.y ?? 0)
            .attr('x2', d => self.positionMap.get(d.target)?.x ?? 0)
            .attr('y2', d => self.positionMap.get(d.target)?.y ?? 0);
          return update;
        },
        exit => exit.remove()
      );

    // Drag behavior for nodes
    const drag = d3.drag<SVGCircleElement, NodeDatum>()
      .on('start', (event) => {
        // Prevent zoom from activating during drag
        event.sourceEvent?.stopPropagation?.();
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
        d.x = event.x;
        d.y = event.y;
        // Update circle visual position immediately for responsive drag
        d3.select<SVGCircleElement, NodeDatum>(event.sourceEvent?.target as SVGCircleElement)
          .attr('cx', d.x)
          .attr('cy', d.y);
        // Update label position immediately
        const circleEl = event.sourceEvent?.target as SVGCircleElement | null;
        if (circleEl?.parentElement) {
          const r = degreeScale(d.degree) as number;
          d3.select<Element, NodeDatum>(circleEl.parentElement)
            .select('text')
            .attr('x', d.x)
            .attr('y', d.y + r + NODE_LABEL_FONT_SIZE + 2);
        }
        // Update connected edge endpoints immediately
        self._updateEdgesForNode(d.id, d.x, d.y);
      })
      .on('end', (_, d) => {
        // Node stays pinned (fx/fy remain set)
        if (d.fx !== null && d.fy !== null) {
          self.positionMap.set(d.id, {
            id: d.id,
            x: d.fx,
            y: d.fy,
            fx: d.fx,
            fy: d.fy,
          });
        }
      });

    // Render nodes (circles + labels) — D3 data join with key function d => d.id
    this.nodesGroup
      .selectAll<SVGGElement, NodeDatum>('g.node')
      .data(nodeDatums, d => d.id)
      .join(
        enter => {
          const g = enter.append<SVGGElement>('g').attr('class', 'node');

          // Circle — sized by degree
          g.append<SVGCircleElement>('circle')
            .attr('r', d => degreeScale(d.degree) as number)
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr('fill', d => colorScale(d.card_type) as string)
            .attr('stroke', 'none')
            .attr('stroke-width', 0)
            .call(drag as d3.DragBehavior<SVGCircleElement, NodeDatum, unknown>);

          // Label (below circle)
          g.append<SVGTextElement>('text')
            .attr('x', d => d.x)
            .attr('y', d => d.y + (degreeScale(d.degree) as number) + NODE_LABEL_FONT_SIZE + 2)
            .attr('text-anchor', 'middle')
            .attr('font-size', `${NODE_LABEL_FONT_SIZE}px`)
            .attr('fill', 'var(--text-primary, #333)')
            .text(d => d.name);

          // Hover dimming events (immediate — no transition delay per CONTEXT.md)
          g.on('mouseenter', (_, d) => {
            self._applyHoverDim(d.id);
          });
          g.on('mouseleave', () => {
            self._clearHoverDim();
          });

          // Click-to-select events
          g.on('click', (event: MouseEvent, d) => {
            if (!self.selectionProvider) return;
            if (event.shiftKey) {
              // Shift+click: add to selection (multi-select)
              self.selectionProvider.toggle(d.id);
            } else {
              // Standard click: toggle selection
              self.selectionProvider.toggle(d.id);
            }
          });

          return g;
        },
        update => {
          // Update positions from new simulation result
          update.select('circle')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr('r', d => degreeScale(d.degree) as number);
          update.select<SVGTextElement>('text')
            .attr('x', d => d.x)
            .attr('y', d => d.y + (degreeScale(d.degree) as number) + NODE_LABEL_FONT_SIZE + 2)
            .text(d => d.name);
          return update;
        },
        exit => exit.remove()
      )
      // Phase 37 — Audit data attributes on node <g> elements
      // CSS rules (.audit-mode g.node[data-audit] circle) handle visual styling
      .each(function (d) {
        const g = this as SVGGElement;
        const status = auditState.getChangeStatus(d.id);
        if (status) {
          g.setAttribute('data-audit', status);
        } else {
          g.removeAttribute('data-audit');
        }
        const card = cardMap.get(d.id);
        if (card?.source) {
          g.setAttribute('data-source', card.source);
        } else {
          g.removeAttribute('data-source');
        }
      });
  }

  // ---------------------------------------------------------------------------
  // IView: destroy
  // ---------------------------------------------------------------------------

  /**
   * Tear down the view — remove event listeners, remove DOM elements, clear state.
   * Called by ViewManager before mounting the next view.
   */
  destroy(): void {
    this.destroyed = true;

    // Unsubscribe from SelectionProvider
    if (this.unsubscribeSelection) {
      this.unsubscribeSelection();
      this.unsubscribeSelection = null;
    }

    // Remove SVG (and all D3 event listeners attached to it)
    if (this.svg) {
      this.svg.on('zoom', null);
      this.svg.remove();
      this.svg = null;
    }

    // Clear state
    this.positionMap.clear();
    this.currentEdges = [];
    this.graphLayer = null;
    this.linksGroup = null;
    this.nodesGroup = null;
    this.zoom = null;
    this.container = null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Clear all SVG content (empty state) */
  private _clearGraph(): void {
    if (this.linksGroup) this.linksGroup.selectAll('*').remove();
    if (this.nodesGroup) this.nodesGroup.selectAll('*').remove();
  }

  /**
   * Update edge line endpoints when a node is dragged.
   * Immediate DOM update for responsive drag feel.
   * (Exposed as public for testability from drag handler closure)
   */
  _updateEdgesForNode(nodeId: string, x: number, y: number): void {
    if (!this.linksGroup) return;
    this.linksGroup.selectAll<SVGGElement, EdgeDatum>('g.edge').each(function (d) {
      const line = d3.select(this).select<SVGLineElement>('line');
      if (d.source === nodeId) {
        line.attr('x1', x).attr('y1', y);
      }
      if (d.target === nodeId) {
        line.attr('x2', x).attr('y2', y);
      }
    });
  }

  /**
   * Apply hover dimming — dim all non-connected nodes and edges.
   * Immediate (no transition delay per CONTEXT.md).
   */
  private _applyHoverDim(hoveredId: string): void {
    // Find connected node IDs
    const connected = new Set<string>([hoveredId]);
    for (const edge of this.currentEdges) {
      if (edge.source === hoveredId) connected.add(edge.target);
      if (edge.target === hoveredId) connected.add(edge.source);
    }

    // Dim non-connected nodes
    if (this.nodesGroup) {
      this.nodesGroup.selectAll<SVGGElement, NodeDatum>('g.node')
        .select('circle')
        .attr('opacity', (d: NodeDatum) => connected.has(d.id) ? DEFAULT_NODE_OPACITY : DIM_NODE_OPACITY);
    }

    // Dim non-connected edges
    if (this.linksGroup) {
      this.linksGroup.selectAll<SVGGElement, EdgeDatum>('g.edge')
        .select('line')
        .attr('stroke-opacity', (d: EdgeDatum) =>
          (d.source === hoveredId || d.target === hoveredId)
            ? DEFAULT_EDGE_OPACITY
            : DIM_EDGE_OPACITY
        );
    }
  }

  /** Restore all nodes and edges to default opacity */
  private _clearHoverDim(): void {
    if (this.nodesGroup) {
      this.nodesGroup.selectAll<SVGGElement, NodeDatum>('g.node')
        .select('circle')
        .attr('opacity', DEFAULT_NODE_OPACITY);
    }

    if (this.linksGroup) {
      this.linksGroup.selectAll<SVGGElement, EdgeDatum>('g.edge')
        .select('line')
        .attr('stroke-opacity', DEFAULT_EDGE_OPACITY);
    }
  }

  /** Update visual highlights based on current SelectionProvider state */
  private _updateSelectionHighlights(): void {
    if (!this.selectionProvider || !this.nodesGroup) return;
    const selected = new Set(this.selectionProvider.getSelectedIds());

    this.nodesGroup.selectAll<SVGGElement, NodeDatum>('g.node')
      .select('circle')
      .attr('stroke', (d: NodeDatum) => selected.has(d.id) ? '#ffffff' : 'none')
      .attr('stroke-width', (d: NodeDatum) => selected.has(d.id) ? 3 : 0);
  }
}
