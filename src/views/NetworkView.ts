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

import '../styles/network-view.css';

import * as d3 from 'd3';
import { auditState } from '../audit/AuditState';
import type { SelectionProvider } from '../providers/SelectionProvider';
import type { NodePosition, SimulateLink, SimulateNode, SimulatePayload } from '../worker/protocol';
import type { CardDatum, IView, WorkerBridgeLike } from './types';

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
const EDGE_STROKE = 'var(--text-muted)';

// ---------------------------------------------------------------------------
// Algorithm encoding types (Phase 117)
// ---------------------------------------------------------------------------

/** Per-node metric data fetched from graph:metrics-read after algorithm compute */
type NodeMetrics = {
	centrality: number | null;
	pagerank: number | null;
	community_id: number | null;
	clustering_coeff: number | null;
	sp_depth: number | null;
	in_spanning_tree: number | null;
};

/** Parameters for applyAlgorithmEncoding */
export interface AlgorithmEncodingParams {
	algorithm: string;
	pathCardIds?: string[];
	mstEdges?: Array<[string, string]>;
	reachable?: boolean;
	edgeBetweenness?: Record<string, number>; // Phase 120 GALG-03: edgeKey -> betweenness score
	spDepths?: Record<string, number>; // Phase 120 GALG-02: cardId -> hop distance from source
}

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
	id: string; // source + '-' + target
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

	// Legend panel (Phase 117-02)
	private _legendEl: HTMLDivElement | null = null;

	// Pick mode state (Phase 117-02)
	private _pickModeActive = false;
	private _onNodePickClick: ((cardId: string, cardName: string) => void) | null = null;

	// Algorithm encoding state (Phase 117)
	private _algorithmActive = false;
	private _metricsMap: Map<string, NodeMetrics> = new Map();
	private _activeAlgorithm: string | null = null;
	private _lastNumericAlgorithm: string | null = null;
	private _pathCardIds: string[] = [];
	private _mstEdges: Array<[string, string]> = [];
	private _sourceCardId: string | null = null;
	private _targetCardId: string | null = null;

	// Phase 120 — edge betweenness and hop distance maps
	private _edgeBetweennessMap: Record<string, number> = {};
	private _spDepths: Record<string, number> = {};

	// Phase 118 — hover tooltip element (HTML overlay)
	private _tooltipEl: HTMLDivElement | null = null;

	// Saved scales for reset (populated during render)
	private _lastDegreeScale: d3.ScalePower<number, number, never> | null = null;
	private _lastColorScale: d3.ScaleOrdinal<string, string, never> | null = null;

	// Subscription cleanup
	private unsubscribeSelection: (() => void) | null = null;

	// Keyboard navigation state (A11Y-08 composite widget)
	private _focusedNodeId: string | null = null;
	private _currentNodeDatums: NodeDatum[] = [];
	private _onKeydown: ((e: KeyboardEvent) => void) | null = null;

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
			.attr('height', '100%')
			.attr('role', 'img')
			.attr('aria-label', 'Network view, 0 cards')
			.attr('tabindex', '0');

		// Create inner group for zoom transform
		this.graphLayer = this.svg.append<SVGGElement>('g').attr('class', 'graph-layer');

		// Links group (rendered first — behind nodes)
		this.linksGroup = this.graphLayer.append<SVGGElement>('g').attr('class', 'links');

		// Nodes group (rendered second — in front of links)
		this.nodesGroup = this.graphLayer.append<SVGGElement>('g').attr('class', 'nodes');

		// Legend panel (HTML overlay, not SVG) — positioned absolute over container
		this._legendEl = document.createElement('div');
		this._legendEl.className = 'nv-legend';
		this._legendEl.setAttribute('role', 'region');
		this._legendEl.setAttribute('aria-label', 'Graph encoding legend');
		this.container.style.position = 'relative'; // ensure positioned parent
		this.container.appendChild(this._legendEl);

		// Phase 118: tooltip element (HTML overlay over SVG container)
		this._tooltipEl = document.createElement('div');
		this._tooltipEl.className = 'nv-tooltip';
		this._tooltipEl.setAttribute('data-testid', 'nv-tooltip');
		this._tooltipEl.style.display = 'none';
		this._tooltipEl.style.position = 'absolute';
		this._tooltipEl.style.pointerEvents = 'none';
		this.container.appendChild(this._tooltipEl);

		// Set up d3-zoom
		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
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

		// --- Keyboard navigation with spatial nearest-neighbor (A11Y-08) ---
		const svgNode = this.svg.node()!;
		this._onKeydown = (e: KeyboardEvent) => {
			const nodes = this._currentNodeDatums;
			if (nodes.length === 0) return;

			switch (e.key) {
				case 'ArrowRight':
				case 'ArrowLeft':
				case 'ArrowDown':
				case 'ArrowUp': {
					e.preventDefault();
					const nearest = this._findSpatialNearest(e.key);
					if (nearest) {
						this._focusedNodeId = nearest.id;
						this._updateNodeFocusVisual();
					}
					break;
				}
				case 'Home':
					e.preventDefault();
					if (nodes.length > 0) {
						this._focusedNodeId = nodes[0]!.id;
						this._updateNodeFocusVisual();
					}
					break;
				case 'End':
					e.preventDefault();
					if (nodes.length > 0) {
						this._focusedNodeId = nodes[nodes.length - 1]!.id;
						this._updateNodeFocusVisual();
					}
					break;
				case 'Escape':
					e.preventDefault();
					document.querySelector<HTMLElement>('[role="navigation"]')?.focus();
					break;
				case 'Enter':
				case ' ':
					e.preventDefault();
					if (this._focusedNodeId && this.selectionProvider) {
						this.selectionProvider.toggle(this._focusedNodeId);
					}
					break;
			}
		};
		svgNode.addEventListener('keydown', this._onKeydown);
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

		// Update ARIA label for screen readers (A11Y-03)
		this.svg.attr('aria-label', `Network view, ${cards.length} cards`);

		if (cards.length === 0) {
			this._clearGraph();
			return;
		}

		// Build card lookup
		const cardMap = new Map<string, CardDatum>(cards.map((c) => [c.id, c]));
		const cardIds = cards.map((c) => c.id);

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
      `;
			// params: cardIds twice (for source_id IN and target_id IN)
			const params = [...cardIds, ...cardIds];
			const result = (await this.bridge.send('db:exec', { sql, params })) as unknown;

			// db:exec for SELECT returns rows, check shape
			const resultAny = result as { rows?: Array<Record<string, unknown>>; changes?: number } | null;
			const rows: Array<Record<string, unknown>> = resultAny?.rows ?? [];
			edges = rows.map((row) => ({
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
		edges = edges.filter((e) => cardMap.has(e.source) && cardMap.has(e.target));

		// Compute degree for each card
		const degreeMap = new Map<string, number>(cardIds.map((id) => [id, 0]));
		for (const edge of edges) {
			degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1);
			degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1);
		}

		// Build SimulateNode[] with warm-start positions
		// Use explicit conditional to satisfy exactOptionalPropertyTypes
		const simNodes: SimulateNode[] = cards.map((c) => {
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
		const simLinks: SimulateLink[] = edges.map((e) => ({
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
		const degreeScale = d3.scaleSqrt().domain([0, maxDegree]).range([MIN_RADIUS, MAX_RADIUS]);
		// Save for algorithm encoding reset (Phase 117)
		this._lastDegreeScale = degreeScale;

		// Use CSS custom property references for source colors so they adapt to theme.
		// This replaces d3.schemeCategory10 (a fixed palette) with theme-aware tokens
		// matching the approach used in TreeView.ts (CARD_TYPE_COLORS pattern).
		const sourceTokenColors = [
			'var(--source-apple-notes)',
			'var(--source-markdown)',
			'var(--source-csv)',
			'var(--source-json)',
			'var(--source-excel)',
			'var(--source-html)',
			'var(--source-native-reminders)',
			'var(--source-native-calendar)',
			'var(--source-native-notes)',
		];
		const colorScale = d3.scaleOrdinal<string>(sourceTokenColors);
		// Save for algorithm encoding reset (Phase 117)
		this._lastColorScale = colorScale;

		// Build NodeDatum array from cards + positions
		const nodeDatums: NodeDatum[] = cards.map((c) => {
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

		// Store node datums for keyboard navigation (A11Y-08)
		this._currentNodeDatums = nodeDatums;
		// If no node is focused yet, default to first
		if (this._focusedNodeId === null && nodeDatums.length > 0) {
			this._focusedNodeId = nodeDatums[0]!.id;
		}

		// Capture this for closures
		const self = this;

		// Render edges (lines) — D3 data join with key function
		this.linksGroup
			.selectAll<SVGGElement, EdgeDatum>('g.edge')
			.data(edges, (d) => d.id)
			.join(
				(enter) => {
					const g = enter.append<SVGGElement>('g').attr('class', 'edge');
					g.append<SVGLineElement>('line')
						.attr('stroke', EDGE_STROKE)
						.attr('stroke-opacity', DEFAULT_EDGE_OPACITY)
						.attr('x1', (d) => self.positionMap.get(d.source)?.x ?? 0)
						.attr('y1', (d) => self.positionMap.get(d.source)?.y ?? 0)
						.attr('x2', (d) => self.positionMap.get(d.target)?.x ?? 0)
						.attr('y2', (d) => self.positionMap.get(d.target)?.y ?? 0);
					// Edge label (hidden by default — SVG title for tooltip)
					g.append<SVGTitleElement>('title').text((d) => d.label || `${d.source} → ${d.target}`);
					// Mouse events for edge hover label
					g.on('mouseenter', function (_, d) {
						d3.select(this).select('line').attr('stroke-opacity', 0.9);
						// Show inline text label near edge midpoint
						const srcPos = self.positionMap.get(d.source);
						const tgtPos = self.positionMap.get(d.target);
						if (srcPos && tgtPos) {
							d3.select(this)
								.append<SVGTextElement>('text')
								.attr('class', 'edge-label')
								.attr('x', (srcPos.x + tgtPos.x) / 2)
								.attr('y', (srcPos.y + tgtPos.y) / 2)
								.attr('text-anchor', 'middle')
								.attr('font-size', '9px')
								.attr('fill', 'var(--bg-card)')
								.text(d.label || '');
						}
					}).on('mouseleave', function () {
						d3.select(this).select('line').attr('stroke-opacity', DEFAULT_EDGE_OPACITY);
						d3.select(this).select('text.edge-label').remove();
					});
					return g;
				},
				(update) => {
					update
						.select('line')
						.attr('x1', (d) => self.positionMap.get(d.source)?.x ?? 0)
						.attr('y1', (d) => self.positionMap.get(d.source)?.y ?? 0)
						.attr('x2', (d) => self.positionMap.get(d.target)?.x ?? 0)
						.attr('y2', (d) => self.positionMap.get(d.target)?.y ?? 0);
					return update;
				},
				(exit) => exit.remove(),
			);

		// Drag behavior for nodes
		const drag = d3
			.drag<SVGCircleElement, NodeDatum>()
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
			.data(nodeDatums, (d) => d.id)
			.join(
				(enter) => {
					const g = enter.append<SVGGElement>('g').attr('class', 'node');

					// Circle — sized by degree
					g.append<SVGCircleElement>('circle')
						.attr('r', (d) => degreeScale(d.degree) as number)
						.attr('cx', (d) => d.x)
						.attr('cy', (d) => d.y)
						.attr('fill', (d) => colorScale(d.card_type) as string)
						.attr('stroke', 'none')
						.attr('stroke-width', 0)
						.call(drag as d3.DragBehavior<SVGCircleElement, NodeDatum, unknown>);

					// Label (below circle)
					g.append<SVGTextElement>('text')
						.attr('x', (d) => d.x)
						.attr('y', (d) => d.y + (degreeScale(d.degree) as number) + NODE_LABEL_FONT_SIZE + 2)
						.attr('text-anchor', 'middle')
						.attr('font-size', `${NODE_LABEL_FONT_SIZE}px`)
						.attr('fill', 'var(--text-primary)')
						.text((d) => d.name);

					// Hover dimming events (immediate — no transition delay per CONTEXT.md)
					g.on('mouseenter', (event: MouseEvent, d) => {
						self._applyHoverDim(d.id);
						// Phase 118: show tooltip with algorithm metrics
						const m = self._metricsMap.get(d.id);
						if (
							m &&
							(m.pagerank !== null || m.centrality !== null || m.community_id !== null || m.clustering_coeff !== null)
						) {
							self._showTooltip(event, d, m);
						}
					});
					g.on('mouseleave', () => {
						self._clearHoverDim();
						self._hideTooltip();
					});

					// Click-to-select / pick-mode events
					g.on('click', (event: MouseEvent, d) => {
						if (self._pickModeActive && self._onNodePickClick) {
							// Pick mode: route click to AlgorithmExplorer picker
							self._onNodePickClick(d.id, d.name);
							return;
						}
						if (!self.selectionProvider) return;
						if (event.shiftKey || event.metaKey || event.ctrlKey) {
							// Shift/Cmd/Ctrl+click: toggle in multi-select
							self.selectionProvider.toggle(d.id);
						} else {
							// Standard click: exclusive select (keeps notebook visible)
							self.selectionProvider.select(d.id);
						}
					});

					return g;
				},
				(update) => {
					// Update positions from new simulation result
					update
						.select('circle')
						.attr('cx', (d) => d.x)
						.attr('cy', (d) => d.y)
						.attr('r', (d) => degreeScale(d.degree) as number);
					update
						.select<SVGTextElement>('text')
						.attr('x', (d) => d.x)
						.attr('y', (d) => d.y + (degreeScale(d.degree) as number) + NODE_LABEL_FONT_SIZE + 2)
						.text((d) => d.name);
					return update;
				},
				(exit) => exit.remove(),
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
	// Phase 117: Algorithm Encoding Public API
	// ---------------------------------------------------------------------------

	/**
	 * Apply algorithm-driven visual encoding to the graph.
	 * Called from AlgorithmExplorer after a successful graph:compute.
	 *
	 * Fetches graph_metrics for all visible nodes and applies:
	 *   - Community fill via d3.schemeCategory10
	 *   - Metric-driven node sizing (centrality/pagerank/clustering)
	 *   - Path edge highlighting (shortest path)
	 *   - MST edge highlighting (spanning tree)
	 */
	async applyAlgorithmEncoding(params: AlgorithmEncodingParams): Promise<void> {
		if (this.destroyed) return;

		this._algorithmActive = true;
		this._activeAlgorithm = params.algorithm;
		this._pathCardIds = params.pathCardIds ?? [];
		this._mstEdges = params.mstEdges ?? [];
		this._edgeBetweennessMap = params.edgeBetweenness ?? {};
		this._spDepths = params.spDepths ?? {};

		// Phase 118: track last-computed numeric algorithm for cumulative size encoding
		const numericAlgorithms = ['centrality', 'pagerank', 'clustering'];
		if (numericAlgorithms.includes(params.algorithm)) {
			this._lastNumericAlgorithm = params.algorithm;
		}

		// Fetch fresh metrics from graph_metrics table
		try {
			const metrics = (await this.bridge.send('graph:metrics-read', {})) as Array<{
				card_id: string;
				centrality: number | null;
				pagerank: number | null;
				community_id: number | null;
				clustering_coeff: number | null;
				sp_depth: number | null;
				in_spanning_tree: number | null;
			}>;
			this._metricsMap.clear();
			for (const row of metrics) {
				this._metricsMap.set(row.card_id, {
					centrality: row.centrality,
					pagerank: row.pagerank,
					community_id: row.community_id,
					clustering_coeff: row.clustering_coeff,
					sp_depth: row.sp_depth,
					in_spanning_tree: row.in_spanning_tree,
				});
			}
		} catch {
			// If metrics fetch fails, proceed without metrics
		}

		this._reapplyEncoding();
		this._updateLegend();
	}

	/**
	 * Reset all algorithm encoding and restore default degree-sized, source-colored graph.
	 */
	resetEncoding(): void {
		this._algorithmActive = false;
		this._activeAlgorithm = null;
		this._lastNumericAlgorithm = null;
		this._metricsMap.clear();
		this._pathCardIds = [];
		this._mstEdges = [];
		this._edgeBetweennessMap = {};
		this._spDepths = {};

		// Remove picked-node rings and badges before clearing IDs
		this.setPickedNodes(null, null);
		this._sourceCardId = null;
		this._targetCardId = null;

		// Remove hop badges
		this.nodesGroup?.selectAll('.nv-hop-badge').remove();

		// Restore default node fills
		this.nodesGroup?.selectAll<SVGGElement, NodeDatum>('g.node').select('circle').attr('fill', null);

		if (!this.nodesGroup || !this.linksGroup) return;

		// Restore default edge styles
		this.linksGroup
			.selectAll<SVGGElement, EdgeDatum>('g.edge')
			.select('line')
			.attr('stroke', EDGE_STROKE)
			.attr('stroke-width', null)
			.attr('stroke-opacity', DEFAULT_EDGE_OPACITY);

		// Restore default node styles using saved scales
		// Note: we set opacity directly (no transition) to ensure immediate reset,
		// then use transition only for r/fill/y (visual smoothness).
		this.nodesGroup
			.selectAll<SVGGElement, NodeDatum>('g.node')
			.select('circle')
			.attr('opacity', DEFAULT_NODE_OPACITY)
			.attr('stroke', 'none')
			.attr('stroke-width', 0);

		if (this._lastDegreeScale && this._lastColorScale) {
			const degreeScale = this._lastDegreeScale;
			const colorScale = this._lastColorScale;
			this.nodesGroup
				.selectAll<SVGGElement, NodeDatum>('g.node')
				.select('circle')
				.transition()
				.duration(300)
				.attr('r', (d: NodeDatum) => degreeScale(d.degree) as number)
				.attr('fill', (d: NodeDatum) => colorScale(d.card_type) as string);
			this.nodesGroup
				.selectAll<SVGGElement, NodeDatum>('g.node')
				.select<SVGTextElement>('text')
				.transition()
				.duration(300)
				.attr('y', (d: NodeDatum) => d.y + (this._lastDegreeScale!(d.degree) as number) + NODE_LABEL_FONT_SIZE + 2);
		}

		this._updateLegend();
	}

	/**
	 * Register a callback invoked when a node is clicked in pick mode (Phase 117-02).
	 * Used by main.ts to wire back to AlgorithmExplorer.nodeClicked.
	 */
	setPickClickCallback(cb: (cardId: string, cardName: string) => void): void {
		this._onNodePickClick = cb;
	}

	/**
	 * Activate or deactivate pick mode (Phase 117-02).
	 * In pick mode, node clicks are routed to _onNodePickClick instead of SelectionProvider.
	 */
	setPickMode(active: boolean): void {
		this._pickModeActive = active;
	}

	/**
	 * Update the legend panel content based on current algorithm state.
	 * Called after applyAlgorithmEncoding and resetEncoding.
	 */
	private _updateLegend(): void {
		if (!this._legendEl) return;

		// Clear content
		this._legendEl.textContent = '';

		if (!this._algorithmActive || !this._activeAlgorithm) {
			this._legendEl.classList.remove('nv-legend--visible');
			return;
		}

		this._legendEl.classList.add('nv-legend--visible');

		// Algorithm display names
		const algoNames: Record<string, string> = {
			community: 'Community',
			centrality: 'Centrality',
			pagerank: 'PageRank',
			clustering: 'Clustering Coeff.',
			spanning_tree: 'Spanning Tree',
			shortest_path: 'Shortest Path',
		};

		// Phase 118: combined legend — community color section + numeric size section
		const hasCommunityData = Array.from(this._metricsMap.values()).some((m) => m.community_id !== null);
		const hasNumericData = this._lastNumericAlgorithm !== null;
		let sectionsRendered = 0;

		// --- Color section: community swatches ---
		if (hasCommunityData) {
			const section = document.createElement('div');
			section.className = 'nv-legend__section';

			const heading = document.createElement('p');
			heading.className = 'nv-legend__heading';
			heading.textContent = 'Color \u2014 Community';
			section.appendChild(heading);

			const communityIds = new Set<number>();
			for (const m of this._metricsMap.values()) {
				if (m.community_id !== null) communityIds.add(m.community_id % 10);
			}
			if (communityIds.size > 10) {
				const manyEl = document.createElement('span');
				manyEl.textContent = '10+ communities';
				section.appendChild(manyEl);
			} else {
				const sortedIds = Array.from(communityIds)
					.sort((a, b) => a - b)
					.slice(0, 10);
				for (let i = 0; i < sortedIds.length; i++) {
					const idx = sortedIds[i]!;
					const row = document.createElement('div');
					row.className = 'nv-legend__swatch-row';
					const swatch = document.createElement('span');
					swatch.className = 'nv-legend__swatch';
					swatch.style.background = d3.schemeCategory10[idx % 10]!;
					const label = document.createElement('span');
					label.textContent = `Community ${idx}`;
					row.appendChild(swatch);
					row.appendChild(label);
					section.appendChild(row);
				}
			}

			this._legendEl.appendChild(section);
			sectionsRendered++;
		}

		// --- Size section: numeric metric scale ---
		if (hasNumericData) {
			// Divider between sections if both present
			if (sectionsRendered > 0) {
				const divider = document.createElement('hr');
				divider.className = 'nv-legend__divider';
				this._legendEl.appendChild(divider);
			}

			const section = document.createElement('div');
			section.className = 'nv-legend__section';

			const heading = document.createElement('p');
			heading.className = 'nv-legend__heading';
			heading.textContent = `Size \u2014 ${algoNames[this._lastNumericAlgorithm!] ?? this._lastNumericAlgorithm}`;
			section.appendChild(heading);

			const scaleLabel = document.createElement('span');
			scaleLabel.textContent = 'Size: small \u2192 large';
			section.appendChild(scaleLabel);
			const scaleBar = document.createElement('div');
			scaleBar.className = 'nv-legend__scale-bar';
			section.appendChild(scaleBar);

			this._legendEl.appendChild(section);
			sectionsRendered++;
		}

		// --- Shortest path stroke preview (unchanged) ---
		if (this._activeAlgorithm === 'shortest_path') {
			if (sectionsRendered === 0) {
				const heading = document.createElement('p');
				heading.className = 'nv-legend__heading';
				heading.textContent = algoNames[this._activeAlgorithm] ?? this._activeAlgorithm;
				this._legendEl.appendChild(heading);
			}
			const preview = document.createElement('div');
			preview.className = 'nv-legend__stroke-preview';
			const line = document.createElement('hr');
			line.className = 'nv-legend__stroke-line';
			line.style.borderTop = '3.5px solid var(--accent)';
			const label = document.createElement('span');
			label.textContent = 'Shortest path';
			preview.appendChild(line);
			preview.appendChild(label);
			this._legendEl.appendChild(preview);
			sectionsRendered++;
		}

		// --- Spanning tree stroke preview (unchanged) ---
		if (this._activeAlgorithm === 'spanning_tree') {
			if (sectionsRendered === 0) {
				const heading = document.createElement('p');
				heading.className = 'nv-legend__heading';
				heading.textContent = algoNames[this._activeAlgorithm] ?? this._activeAlgorithm;
				this._legendEl.appendChild(heading);
			}
			const preview = document.createElement('div');
			preview.className = 'nv-legend__stroke-preview';
			const line = document.createElement('hr');
			line.className = 'nv-legend__stroke-line';
			line.style.borderTop = '2.5px solid var(--latch-time)';
			const label = document.createElement('span');
			label.textContent = 'Spanning tree edge';
			preview.appendChild(line);
			preview.appendChild(label);
			this._legendEl.appendChild(preview);
			sectionsRendered++;
		}

		// GALG-02: Distance from source legend (when shortest_path active with depths)
		if (this._activeAlgorithm === 'shortest_path' && Object.keys(this._spDepths).length > 0) {
			if (sectionsRendered > 0) {
				const divider = document.createElement('hr');
				divider.className = 'nv-legend__divider';
				this._legendEl.appendChild(divider);
			}

			const section = document.createElement('div');
			section.className = 'nv-legend__section';

			const heading = document.createElement('p');
			heading.className = 'nv-legend__heading';
			heading.textContent = 'Distance from source';
			section.appendChild(heading);

			const scaleBar = document.createElement('div');
			scaleBar.className = 'nv-legend__scale-bar nv-legend__scale-bar--warm';
			section.appendChild(scaleBar);

			const labelRow = document.createElement('div');
			labelRow.className = 'nv-legend__label-row';
			const nearLabel = document.createElement('span');
			nearLabel.textContent = 'Near';
			nearLabel.style.fontSize = 'var(--text-xs)';
			nearLabel.style.color = 'var(--text-secondary)';
			const farLabel = document.createElement('span');
			farLabel.textContent = 'Far';
			farLabel.style.fontSize = 'var(--text-xs)';
			farLabel.style.color = 'var(--text-secondary)';
			labelRow.appendChild(nearLabel);
			labelRow.appendChild(farLabel);
			section.appendChild(labelRow);

			this._legendEl.appendChild(section);
			sectionsRendered++;
		}

		// GALG-03: Edge betweenness legend
		if (Object.keys(this._edgeBetweennessMap).length > 0) {
			if (sectionsRendered > 0) {
				const divider = document.createElement('hr');
				divider.className = 'nv-legend__divider';
				this._legendEl.appendChild(divider);
			}

			const section = document.createElement('div');
			section.className = 'nv-legend__section';

			const heading = document.createElement('p');
			heading.className = 'nv-legend__heading';
			heading.textContent = 'Edge betweenness';
			section.appendChild(heading);

			const preview = document.createElement('div');
			preview.className = 'nv-legend__stroke-preview';

			const minLine = document.createElement('hr');
			minLine.className = 'nv-legend__stroke-line';
			minLine.style.borderTop = '1px solid var(--text-secondary)';
			const minLabel = document.createElement('span');
			minLabel.textContent = 'Low';

			const maxLine = document.createElement('hr');
			maxLine.className = 'nv-legend__stroke-line';
			maxLine.style.borderTop = '6px solid var(--text-secondary)';
			const maxLabel = document.createElement('span');
			maxLabel.textContent = 'High';

			preview.appendChild(minLine);
			preview.appendChild(minLabel);
			preview.appendChild(maxLine);
			preview.appendChild(maxLabel);
			section.appendChild(preview);

			this._legendEl.appendChild(section);
			sectionsRendered++;
		}

		// If no sections were rendered (e.g. community without numeric), show a generic heading
		if (sectionsRendered === 0) {
			const heading = document.createElement('p');
			heading.className = 'nv-legend__heading';
			heading.textContent = algoNames[this._activeAlgorithm] ?? this._activeAlgorithm;
			this._legendEl.appendChild(heading);
		}
	}

	/**
	 * Set source and target nodes for shortest path ring highlights.
	 * Source node gets accent ring; target node gets danger ring.
	 */
	setPickedNodes(sourceId: string | null, targetId: string | null): void {
		this._sourceCardId = sourceId;
		this._targetCardId = targetId;

		if (!this.nodesGroup) return;

		// Remove all existing picked-node rings and badges, restore circle strokes
		this.nodesGroup.selectAll<SVGGElement, NodeDatum>('g.node').each(function () {
			const g = d3.select(this);
			if (g.select('.nv-source-badge, .nv-target-badge').size() > 0) {
				// This node had a ring — remove the ring stroke from its circle
				g.select('circle').attr('stroke', 'none').attr('stroke-width', 0);
			}
		});
		this.nodesGroup.selectAll('.nv-source-badge, .nv-target-badge').remove();

		const applyRing = (cardId: string, color: string, label: string, badgeClass: string, ariaLabel: string) => {
			if (!this.nodesGroup) return;
			const nodeG = this.nodesGroup
				.selectAll<SVGGElement, NodeDatum>('g.node')
				.filter((d: NodeDatum) => d.id === cardId);

			nodeG.select('circle').attr('stroke', color).attr('stroke-width', 2.5);

			// Add S/T badge at top-right of node
			nodeG.each(function (d: NodeDatum) {
				const r = parseFloat(d3.select(this).select('circle').attr('r') || '8');
				const bx = d.x + r * 0.7;
				const by = d.y - r * 0.7;

				const badge = d3.select(this).append('g').attr('class', badgeClass).attr('aria-label', ariaLabel);
				badge.append('circle').attr('cx', bx).attr('cy', by).attr('r', 8).attr('fill', color);
				badge
					.append('text')
					.attr('x', bx)
					.attr('y', by + 4)
					.attr('text-anchor', 'middle')
					.attr('font-size', '9px')
					.attr('fill', 'white')
					.attr('font-weight', 'bold')
					.text(label);
			});
		};

		if (sourceId) applyRing(sourceId, 'var(--accent)', 'S', 'nv-source-badge', 'Source node');
		if (targetId) applyRing(targetId, 'var(--danger)', 'T', 'nv-target-badge', 'Target node');
	}

	/**
	 * Reapply the current algorithm encoding to existing D3 elements.
	 * Called after applyAlgorithmEncoding and when encoding needs refresh.
	 */
	private _reapplyEncoding(): void {
		if (!this._algorithmActive || !this.nodesGroup || !this.linksGroup) return;

		const algorithm = this._activeAlgorithm ?? '';

		// --- Determine active metric for node sizing ---
		const metricValues: Array<{ id: string; value: number }> = [];

		// Phase 118: use _lastNumericAlgorithm for cumulative size encoding
		const sizeAlgorithm = this._lastNumericAlgorithm ?? algorithm;
		const getMetricForAlgorithm = (id: string): number | null => {
			const m = this._metricsMap.get(id);
			if (!m) return null;
			switch (sizeAlgorithm) {
				case 'centrality':
					return m.centrality;
				case 'pagerank':
					return m.pagerank;
				case 'clustering':
					return m.clustering_coeff;
				default:
					// community, spanning_tree, shortest_path: prefer centrality, fall back to null
					return m.centrality;
			}
		};

		this.nodesGroup.selectAll<SVGGElement, NodeDatum>('g.node').each((d: NodeDatum) => {
			const v = getMetricForAlgorithm(d.id);
			if (v !== null) metricValues.push({ id: d.id, value: v });
		});

		// Build metric scale if we have values
		let metricScale: d3.ScalePower<number, number, never> | null = null;
		if (metricValues.length > 0) {
			const minV = Math.min(...metricValues.map((v) => v.value));
			const maxV = Math.max(...metricValues.map((v) => v.value));
			const range = maxV - minV;
			if (range > 0) {
				metricScale = d3.scaleSqrt().domain([minV, maxV]).range([MIN_RADIUS, MAX_RADIUS]);
			}
		}

		// --- Community fill scale ---
		const hasCommunityData = Array.from(this._metricsMap.values()).some((m) => m.community_id !== null);
		const communityColorScale = hasCommunityData ? d3.scaleOrdinal<number, string>(d3.schemeCategory10) : null;
		this.nodesGroup
			.selectAll<SVGGElement, NodeDatum>('g.node')
			.select('circle')
			.transition()
			.duration(300)
			.attr('r', (d: NodeDatum) => {
				if (metricScale) {
					const v = getMetricForAlgorithm(d.id);
					if (v !== null) return metricScale(v) as number;
				}
				// Fall back to degree scale
				if (this._lastDegreeScale) return this._lastDegreeScale(d.degree) as number;
				return MIN_RADIUS;
			})
			.attr('fill', (d: NodeDatum) => {
				if (communityColorScale) {
					const m = this._metricsMap.get(d.id);
					if (m?.community_id !== null && m?.community_id !== undefined) {
						return communityColorScale(m.community_id % 10) as string;
					}
				}
				// Fall back to source color scale
				if (this._lastColorScale) return this._lastColorScale(d.card_type) as string;
				return 'var(--text-muted)';
			});

		// Update text label y-positions to match new radii
		this.nodesGroup
			.selectAll<SVGGElement, NodeDatum>('g.node')
			.select<SVGTextElement>('text')
			.transition()
			.duration(300)
			.attr('y', (d: NodeDatum) => {
				let r = MIN_RADIUS;
				if (metricScale) {
					const v = getMetricForAlgorithm(d.id);
					if (v !== null) r = metricScale(v) as number;
				} else if (this._lastDegreeScale) {
					r = this._lastDegreeScale(d.degree) as number;
				}
				return d.y + r + NODE_LABEL_FONT_SIZE + 2;
			});

		// --- Build edge sets for highlighting ---
		const pathEdgeSet = new Set<string>();
		for (let i = 0; i < this._pathCardIds.length - 1; i++) {
			const a = this._pathCardIds[i]!;
			const b = this._pathCardIds[i + 1]!;
			pathEdgeSet.add(`${a}-${b}`);
			pathEdgeSet.add(`${b}-${a}`);
		}

		const mstEdgeSet = new Set<string>();
		for (const [a, b] of this._mstEdges) {
			mstEdgeSet.add(`${a}-${b}`);
			mstEdgeSet.add(`${b}-${a}`);
		}

		const hasPathHighlight = pathEdgeSet.size > 0;
		const hasMstHighlight = mstEdgeSet.size > 0;

		if (hasPathHighlight || hasMstHighlight) {
			// Apply edge encoding
			this.linksGroup
				.selectAll<SVGGElement, EdgeDatum>('g.edge')
				.select('line')
				.attr('stroke', (d: EdgeDatum) => {
					const edgeKey = `${d.source}-${d.target}`;
					if (pathEdgeSet.has(edgeKey)) return 'var(--accent)';
					if (mstEdgeSet.has(edgeKey)) return 'var(--latch-time)';
					return EDGE_STROKE;
				})
				.attr('stroke-width', (d: EdgeDatum) => {
					const edgeKey = `${d.source}-${d.target}`;
					if (pathEdgeSet.has(edgeKey)) return 3.5;
					if (mstEdgeSet.has(edgeKey)) return 2.5;
					return null;
				})
				.attr('stroke-opacity', (d: EdgeDatum) => {
					const edgeKey = `${d.source}-${d.target}`;
					if (pathEdgeSet.has(edgeKey)) return 1.0;
					if (mstEdgeSet.has(edgeKey)) return 1.0;
					return DIM_EDGE_OPACITY;
				});

			// Dim non-path nodes when path highlighting is active
			if (hasPathHighlight) {
				const pathNodeSet = new Set(this._pathCardIds);
				this.nodesGroup
					.selectAll<SVGGElement, NodeDatum>('g.node')
					.select('circle')
					.attr('opacity', (d: NodeDatum) => (pathNodeSet.has(d.id) ? DEFAULT_NODE_OPACITY : DIM_NODE_OPACITY));

				// Apply source/target rings
				this.setPickedNodes(this._pathCardIds[0] ?? null, this._pathCardIds[this._pathCardIds.length - 1] ?? null);
			}
		} else {
			// No edge highlighting — restore default edge styles
			this.linksGroup
				.selectAll<SVGGElement, EdgeDatum>('g.edge')
				.select('line')
				.attr('stroke', EDGE_STROKE)
				.attr('stroke-width', null)
				.attr('stroke-opacity', DEFAULT_EDGE_OPACITY);
		}

		// GALG-03: Edge betweenness stroke thickness (1px–6px)
		if (Object.keys(this._edgeBetweennessMap).length > 0) {
			const betweennessValues = Object.values(this._edgeBetweennessMap);
			const maxBetweenness = Math.max(...betweennessValues);
			const thicknessScale = d3
				.scaleLinear()
				.domain([0, maxBetweenness > 0 ? maxBetweenness : 1])
				.range([1, 6])
				.clamp(true);

			this.linksGroup
				.selectAll<SVGGElement, EdgeDatum>('g.edge')
				.select('line')
				.attr('stroke-width', (d: EdgeDatum) => {
					// Don't override path/MST-highlighted edges
					const edgeKey = `${d.source}-${d.target}`;
					if (pathEdgeSet.has(edgeKey) || mstEdgeSet.has(edgeKey)) return null;
					const score = this._edgeBetweennessMap[edgeKey] ?? this._edgeBetweennessMap[`${d.target}-${d.source}`] ?? 0;
					return thicknessScale(score);
				});
		}

		// GALG-02: Distance coloring for single-source shortest path
		if (this._activeAlgorithm === 'shortest_path' && Object.keys(this._spDepths).length > 0) {
			const depthValues = Object.values(this._spDepths);
			const maxHop = Math.max(...depthValues);
			const colorScale =
				maxHop > 0 ? d3.scaleSequential(d3.interpolateWarm).domain([0, maxHop]) : (_: number) => d3.interpolateWarm(0);

			this.nodesGroup
				.selectAll<SVGGElement, NodeDatum>('g.node')
				.select('circle')
				.attr('fill', (d: NodeDatum) => {
					const depth = this._spDepths[d.id];
					if (depth !== undefined) {
						return colorScale(depth) as string;
					}
					return null; // Unreachable nodes retain default fill
				});
		}

		// GALG-01: Hop count badge on shortest path target node
		// Remove any existing badges first
		this.nodesGroup.selectAll('.nv-hop-badge').remove();

		if (hasPathHighlight && this._pathCardIds.length >= 2) {
			const targetId = this._pathCardIds[this._pathCardIds.length - 1]!;
			const hopCount = this._pathCardIds.length - 1;

			this.nodesGroup.selectAll<SVGGElement, NodeDatum>('g.node').each(function (d: NodeDatum) {
				if (d.id === targetId) {
					const nodeRadius = parseFloat(d3.select(this).select('circle').attr('r') || '6');
					const badgeG = d3
						.select(this)
						.append('g')
						.attr('class', 'nv-hop-badge')
						.attr('aria-label', `${hopCount} hops`);

					badgeG
						.append('circle')
						.attr('cx', d.x + nodeRadius * 0.6)
						.attr('cy', d.y - nodeRadius * 0.6)
						.attr('r', 8)
						.attr('fill', 'var(--accent)')
						.attr('stroke', 'var(--bg-primary)')
						.attr('stroke-width', 1.5);

					badgeG
						.append('text')
						.attr('x', d.x + nodeRadius * 0.6)
						.attr('y', d.y - nodeRadius * 0.6)
						.attr('text-anchor', 'middle')
						.attr('dominant-baseline', 'central')
						.attr('fill', '#ffffff')
						.attr('font-size', '10px')
						.attr('font-weight', '600')
						.text(String(hopCount));
				}
			});
		}
	}

	// ---------------------------------------------------------------------------
	// Phase 118: Tooltip helpers
	// ---------------------------------------------------------------------------

	private _showTooltip(event: MouseEvent, d: NodeDatum, m: NodeMetrics): void {
		if (!this._tooltipEl || !this.container) return;
		this._tooltipEl.textContent = '';

		// Card name header
		const header = document.createElement('div');
		header.style.fontWeight = '600';
		header.style.fontSize = 'var(--text-sm, 11px)';
		header.style.marginBottom = '4px';
		header.textContent = d.name ?? d.id;
		this._tooltipEl.appendChild(header);

		// Metric rows in fixed order: PageRank, Centrality, Community, Clustering
		const metrics: [string, number | null, boolean][] = [
			['PageRank', m.pagerank, false],
			['Centrality', m.centrality, false],
			['Community', m.community_id, true],
			['Clustering', m.clustering_coeff, false],
		];
		for (const [label, value, isInteger] of metrics) {
			if (value === null) continue;
			const row = document.createElement('div');
			row.style.fontSize = 'var(--text-xs, 10px)';
			row.textContent = `${label}: ${isInteger ? String(value) : value.toFixed(3)}`;
			this._tooltipEl.appendChild(row);
		}

		// Position near the cursor, offset slightly
		const rect = this.container.getBoundingClientRect();
		this._tooltipEl.style.left = `${event.clientX - rect.left + 10}px`;
		this._tooltipEl.style.top = `${event.clientY - rect.top - 10}px`;
		this._tooltipEl.style.display = 'block';
	}

	private _hideTooltip(): void {
		if (this._tooltipEl) this._tooltipEl.style.display = 'none';
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

		// Remove keyboard listener (A11Y-08)
		if (this.svg && this._onKeydown) {
			this.svg.node()?.removeEventListener('keydown', this._onKeydown);
			this._onKeydown = null;
		}
		this._focusedNodeId = null;
		this._currentNodeDatums = [];

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

		// Clear algorithm encoding state (Phase 117)
		this._algorithmActive = false;
		this._metricsMap.clear();
		this._activeAlgorithm = null;
		this._lastNumericAlgorithm = null;
		this._pathCardIds = [];
		this._mstEdges = [];
		this._edgeBetweennessMap = {};
		this._spDepths = {};
		this._sourceCardId = null;
		this._targetCardId = null;
		this._lastDegreeScale = null;
		this._lastColorScale = null;

		// Remove legend panel (Phase 117-02)
		if (this._legendEl) {
			this._legendEl.remove();
			this._legendEl = null;
		}

		// Remove tooltip (Phase 118)
		if (this._tooltipEl) {
			this._tooltipEl.remove();
			this._tooltipEl = null;
		}

		// Clear pick mode state (Phase 117-02)
		this._pickModeActive = false;
		this._onNodePickClick = null;
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
			this.nodesGroup
				.selectAll<SVGGElement, NodeDatum>('g.node')
				.select('circle')
				.attr('opacity', (d: NodeDatum) => (connected.has(d.id) ? DEFAULT_NODE_OPACITY : DIM_NODE_OPACITY));
		}

		// Dim non-connected edges
		if (this.linksGroup) {
			this.linksGroup
				.selectAll<SVGGElement, EdgeDatum>('g.edge')
				.select('line')
				.attr('stroke-opacity', (d: EdgeDatum) =>
					d.source === hoveredId || d.target === hoveredId ? DEFAULT_EDGE_OPACITY : DIM_EDGE_OPACITY,
				);
		}
	}

	/** Restore all nodes and edges to default opacity */
	private _clearHoverDim(): void {
		if (this.nodesGroup) {
			this.nodesGroup
				.selectAll<SVGGElement, NodeDatum>('g.node')
				.select('circle')
				.attr('opacity', DEFAULT_NODE_OPACITY);
		}

		if (this.linksGroup) {
			this.linksGroup
				.selectAll<SVGGElement, EdgeDatum>('g.edge')
				.select('line')
				.attr('stroke-opacity', DEFAULT_EDGE_OPACITY);
		}
	}

	/**
	 * Find the spatially nearest node in the arrow direction (A11Y-08).
	 * Uses Euclidean distance filtered by the arrow key's half-plane.
	 */
	private _findSpatialNearest(key: string): NodeDatum | null {
		const current = this._currentNodeDatums.find((n) => n.id === this._focusedNodeId);
		if (!current) {
			// If no current focus, pick first node
			return this._currentNodeDatums[0] ?? null;
		}

		let bestDist = Infinity;
		let bestNode: NodeDatum | null = null;

		for (const node of this._currentNodeDatums) {
			if (node.id === current.id) continue;
			const dx = node.x - current.x;
			const dy = node.y - current.y;

			// Only consider nodes in the arrow direction's half-plane
			let inDirection = false;
			switch (key) {
				case 'ArrowRight':
					inDirection = dx > 0;
					break;
				case 'ArrowLeft':
					inDirection = dx < 0;
					break;
				case 'ArrowDown':
					inDirection = dy > 0;
					break;
				case 'ArrowUp':
					inDirection = dy < 0;
					break;
			}
			if (!inDirection) continue;

			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < bestDist) {
				bestDist = dist;
				bestNode = node;
			}
		}

		return bestNode;
	}

	/** Update visual focus ring on the focused network node (A11Y-08). */
	private _updateNodeFocusVisual(): void {
		if (!this.nodesGroup) return;
		this.nodesGroup.selectAll<SVGGElement, NodeDatum>('g.node').classed('card--focused', false);
		if (this._focusedNodeId) {
			this.nodesGroup
				.selectAll<SVGGElement, NodeDatum>('g.node')
				.filter((d) => d.id === this._focusedNodeId)
				.classed('card--focused', true);
		}
	}

	/** Update visual highlights based on current SelectionProvider state */
	private _updateSelectionHighlights(): void {
		if (!this.selectionProvider || !this.nodesGroup) return;
		const selected = new Set(this.selectionProvider.getSelectedIds());

		this.nodesGroup
			.selectAll<SVGGElement, NodeDatum>('g.node')
			.select('circle')
			.attr('stroke', (d: NodeDatum) => (selected.has(d.id) ? 'var(--text-primary)' : 'none'))
			.attr('stroke-width', (d: NodeDatum) => (selected.has(d.id) ? 3 : 0));
	}
}
