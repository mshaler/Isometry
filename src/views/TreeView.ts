// Isometry v5 — Phase 7 TreeView
// Collapsible hierarchy view using d3-hierarchy.
//
// Design:
//   - Implements IView: mount() once, render(cards) on each data update, destroy()
//   - Hierarchy derived from connections filtered by user-selectable treeLabel (default: 'contains')
//   - d3.stratify() builds initial hierarchy; d3.tree() computes top-down vertical layout
//   - Expand/collapse toggles _children stash WITHOUT re-stratifying — root object is preserved
//   - Orphan cards (no connections of treeLabel) rendered in a separate HTML div below tree
//   - Multi-root forests handled via synthetic '__forest_root__' node (invisible in DOM)
//   - D3 key function d => d.data.id is MANDATORY on every .data() call (VIEW-09)
//   - Click selects via SelectionProvider.toggle; shift-click calls addToSelection
//   - Zoom/pan via d3-zoom attached to SVG
//
// Requirements: REND-01, REND-05

import * as d3 from 'd3';
import { auditState } from '../audit/AuditState';
import type { CardDatum, IView, WorkerBridgeLike } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Horizontal spacing between sibling nodes (px) */
const NODE_WIDTH = 120;
/** Vertical distance between tree levels (px) */
const NODE_HEIGHT = 80;
/** Circle radius for tree nodes */
const NODE_RADIUS = 18;
/** SVG viewport size */
const SVG_WIDTH = 900;
const SVG_HEIGHT = 600;
/** Padding inside SVG for tree root position */
const TREE_ORIGIN_X = SVG_WIDTH / 2;
const TREE_ORIGIN_Y = NODE_RADIUS + 24;

// ---------------------------------------------------------------------------
// Color map by card_type
// ---------------------------------------------------------------------------

const CARD_TYPE_COLORS: Record<string, string> = {
	note: 'var(--source-markdown)',
	task: 'var(--source-csv)',
	event: 'var(--source-native-calendar)',
	resource: 'var(--source-native-reminders)',
	person: 'var(--danger)',
};

function colorForType(card_type: string): string {
	return CARD_TYPE_COLORS[card_type] ?? 'var(--text-muted)';
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Internal node data used by d3.stratify/d3.tree */
interface TreeNodeData {
	id: string;
	parentId: string | null;
	name: string;
	card_type: string;
}

/** Connection row returned by the Worker bridge */
interface ConnectionRow {
	source_id: string;
	target_id: string;
	label: string;
}

/** Minimal SelectionProvider interface for injection */
export interface SelectionProviderLike {
	toggle(id: string): void;
	addToSelection(id: string): void;
	getSelected(): ReadonlySet<string>;
	subscribe(cb: () => void): () => void;
}

/** TreeView construction options */
export interface TreeViewOptions {
	/** WorkerBridge for querying connections */
	bridge: WorkerBridgeLike;
	/** Connection label that defines the hierarchy. Default: 'contains' */
	treeLabel?: string;
	/** Optional SelectionProvider for click-to-select */
	selectionProvider?: SelectionProviderLike;
}

// ---------------------------------------------------------------------------
// Extended HierarchyNode with _children stash for collapse support
// ---------------------------------------------------------------------------

type CollapsibleNode = d3.HierarchyNode<TreeNodeData> & {
	_children?: d3.HierarchyNode<TreeNodeData>[];
};

// ---------------------------------------------------------------------------
// TreeView implementation
// ---------------------------------------------------------------------------

/**
 * Collapsible tree hierarchy view using d3-hierarchy.
 *
 * Renders cards in a top-down vertical tree layout derived from connections
 * filtered by a user-selectable label. Orphan cards appear in a flat list below.
 *
 * @implements IView
 */
export class TreeView implements IView {
	// Injected dependencies
	private readonly bridge: WorkerBridgeLike;
	private readonly treeLabel: string;
	private readonly selectionProvider: SelectionProviderLike | null;

	// DOM elements
	private container: HTMLElement | null = null;
	private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
	private treeLayer: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
	private linksGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
	private nodesGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
	private orphanContainer: HTMLDivElement | null = null;

	// State
	private root: CollapsibleNode | null = null;
	private orphans: CardDatum[] = [];
	private selectionUnsubscribe: (() => void) | null = null;
	private _cardMap: Map<string, CardDatum> = new Map();

	// Layout function (created once, reused)
	private treeLayout: d3.TreeLayout<TreeNodeData> | null = null;

	constructor(options: TreeViewOptions) {
		this.bridge = options.bridge;
		this.treeLabel = options.treeLabel ?? 'contains';
		this.selectionProvider = options.selectionProvider ?? null;
	}

	// ---------------------------------------------------------------------------
	// IView: mount
	// ---------------------------------------------------------------------------

	/**
	 * Mount the view into the given container.
	 * Creates SVG with zoom-enabled g.tree-layer and div.orphan-list below.
	 */
	mount(container: HTMLElement): void {
		this.container = container;

		// Create SVG canvas
		this.svg = d3
			.select<HTMLElement, unknown>(container)
			.append('svg')
			.attr('class', 'tree-view')
			.attr('width', '100%')
			.attr('height', SVG_HEIGHT) as d3.Selection<SVGSVGElement, unknown, null, undefined>;

		// Apply d3-zoom for pan/zoom
		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.1, 4])
			.on('zoom', (event) => {
				if (this.treeLayer) {
					this.treeLayer.attr('transform', event.transform.toString());
				}
			});

		this.svg.call(zoom);

		// Inner group for tree (zoom-transformed)
		this.treeLayer = this.svg
			.append('g')
			.attr('class', 'tree-layer')
			.attr('transform', `translate(${TREE_ORIGIN_X}, ${TREE_ORIGIN_Y})`) as d3.Selection<
			SVGGElement,
			unknown,
			null,
			undefined
		>;

		// Sub-groups: links below nodes
		this.linksGroup = this.treeLayer.append('g').attr('class', 'tree-links') as d3.Selection<
			SVGGElement,
			unknown,
			null,
			undefined
		>;
		this.nodesGroup = this.treeLayer.append('g').attr('class', 'tree-nodes') as d3.Selection<
			SVGGElement,
			unknown,
			null,
			undefined
		>;

		// Orphan list container (HTML div below SVG)
		this.orphanContainer = document.createElement('div');
		this.orphanContainer.className = 'orphan-list';
		container.appendChild(this.orphanContainer);

		// Create tree layout (top-down vertical, reused across renders)
		this.treeLayout = d3
			.tree<TreeNodeData>()
			.nodeSize([NODE_WIDTH, NODE_HEIGHT])
			.separation((a, b) => (a.parent === b.parent ? 1 : 1.5));

		// Subscribe to selection changes for visual updates
		if (this.selectionProvider) {
			this.selectionUnsubscribe = this.selectionProvider.subscribe(() => {
				this._updateSelectionVisuals();
			});
		}
	}

	// ---------------------------------------------------------------------------
	// IView: render
	// ---------------------------------------------------------------------------

	/**
	 * Render cards by fetching connections, building hierarchy, and running D3 data join.
	 *
	 * Re-uses existing root hierarchy if the card set is unchanged — preserves collapse state.
	 */
	async render(cards: CardDatum[]): Promise<void> {
		if (!this.svg || !this.nodesGroup || !this.linksGroup || !this.orphanContainer) return;

		// Empty state: clear and return
		if (cards.length === 0) {
			this._clearTree();
			this._renderOrphans([]);
			return;
		}

		// Fetch connections from worker bridge
		const cardIds = cards.map((c) => c.id);
		const connections = await this._fetchConnections(cardIds);

		// Filter connections by treeLabel
		const treeConnections = connections.filter((c) => c.label === this.treeLabel);

		// Build parent mapping
		const childToParent = new Map<string, string>(); // child_id → parent_id
		const allSources = new Set<string>();
		const allTargets = new Set<string>();

		for (const conn of treeConnections) {
			childToParent.set(conn.target_id, conn.source_id);
			allSources.add(conn.source_id);
			allTargets.add(conn.target_id);
		}

		// Classify cards:
		//   - In hierarchy: appear as source OR target in treeConnections
		//   - Orphan: appear in neither source nor target
		const cardMap = new Map<string, CardDatum>(cards.map((c) => [c.id, c]));
		this._cardMap = cardMap;
		const hierarchyIds = new Set([...allSources, ...allTargets]);
		const orphanCards = cards.filter((c) => !hierarchyIds.has(c.id));
		this.orphans = orphanCards;

		// Build TreeNodeData array for stratify
		const treeCardIds = cards.filter((c) => hierarchyIds.has(c.id)).map((c) => c.id);
		const currentCardSet = new Set(treeCardIds);

		// Determine if we need to re-stratify
		// Re-stratify if: no existing root, or the set of tree node IDs changed
		const existingNodeIds = this.root
			? new Set(
					this.root
						.descendants()
						.map((n) => n.data.id)
						.filter((id) => id !== '__forest_root__'),
				)
			: null;

		const needsStratify =
			!this.root ||
			!existingNodeIds ||
			existingNodeIds.size !== currentCardSet.size ||
			[...currentCardSet].some((id) => !existingNodeIds.has(id));

		if (needsStratify) {
			this.root = this._buildHierarchy(treeCardIds, childToParent, cardMap);
		}

		if (this.root) {
			// Run layout
			this.treeLayout!(this.root);
			// Render
			this._updateTreeRender();
		}

		// Render orphans
		this._renderOrphans(orphanCards);
	}

	// ---------------------------------------------------------------------------
	// IView: destroy
	// ---------------------------------------------------------------------------

	/**
	 * Tear down the view — remove SVG and orphan list, clear all state.
	 */
	destroy(): void {
		// Unsubscribe from SelectionProvider
		if (this.selectionUnsubscribe) {
			this.selectionUnsubscribe();
			this.selectionUnsubscribe = null;
		}

		if (this.svg) {
			this.svg.remove();
			this.svg = null;
		}

		if (this.orphanContainer?.parentNode) {
			this.orphanContainer.parentNode.removeChild(this.orphanContainer);
		}
		this.orphanContainer = null;

		// Clear state
		this.root = null;
		this.orphans = [];
		this._cardMap.clear();
		this.treeLayer = null;
		this.linksGroup = null;
		this.nodesGroup = null;
		this.container = null;
		this.treeLayout = null;
	}

	// ---------------------------------------------------------------------------
	// Private: fetch connections
	// ---------------------------------------------------------------------------

	private async _fetchConnections(cardIds: string[]): Promise<ConnectionRow[]> {
		if (cardIds.length === 0) return [];

		// Parameterized IN clause — never interpolate user values
		const placeholders = cardIds.map(() => '?').join(', ');
		const sql = `
      SELECT source_id, target_id, label
      FROM connections
      WHERE (source_id IN (${placeholders}) OR target_id IN (${placeholders}))
        AND label IS NOT NULL
        AND deleted_at IS NULL
    `;

		const result = await this.bridge.send('query', {
			sql,
			params: [...cardIds, ...cardIds],
		});

		return (result as ConnectionRow[]) ?? [];
	}

	// ---------------------------------------------------------------------------
	// Private: build hierarchy
	// ---------------------------------------------------------------------------

	private _buildHierarchy(
		treeCardIds: string[],
		childToParent: Map<string, string>,
		cardMap: Map<string, CardDatum>,
	): CollapsibleNode | null {
		if (treeCardIds.length === 0) return null;

		// Identify root cards (appear in hierarchy but NOT as a child of anything)
		const roots = treeCardIds.filter((id) => !childToParent.has(id));
		const needsSyntheticRoot = roots.length > 1;

		// Build TreeNodeData array
		const nodes: TreeNodeData[] = [];

		if (needsSyntheticRoot) {
			// Inject synthetic invisible root
			nodes.push({ id: '__forest_root__', parentId: null, name: '', card_type: '' });
		}

		for (const id of treeCardIds) {
			const card = cardMap.get(id);
			if (!card) continue;

			let parentId: string | null = childToParent.get(id) ?? null;

			if (needsSyntheticRoot && parentId === null) {
				// Root nodes become children of synthetic root
				parentId = '__forest_root__';
			}

			nodes.push({
				id,
				parentId,
				name: card.name,
				card_type: card.card_type,
			});
		}

		if (nodes.length === 0) return null;

		// Build hierarchy using d3.stratify
		const stratify = d3
			.stratify<TreeNodeData>()
			.id((d) => d.id)
			.parentId((d) => d.parentId);

		try {
			const hierarchy = stratify(nodes) as CollapsibleNode;
			return hierarchy;
		} catch {
			// Stratify can fail on malformed data — return null and show all as orphans
			return null;
		}
	}

	// ---------------------------------------------------------------------------
	// Private: full tree re-render (D3 data join)
	// ---------------------------------------------------------------------------

	private _updateTreeRender(): void {
		if (!this.root || !this.nodesGroup || !this.linksGroup) return;

		const selection = this.selectionProvider?.getSelected() ?? new Set<string>();

		// Gather visible descendants (excluding synthetic root)
		const visibleNodes = this.root.descendants().filter((n) => n.data.id !== '__forest_root__');

		// Gather visible links (exclude links to/from synthetic root)
		const visibleLinks = this.root
			.links()
			.filter((l) => l.source.data.id !== '__forest_root__' && l.target.data.id !== '__forest_root__');

		// ---------------------------------------------------------------------------
		// Links data join — key by "parentId-childId"
		// ---------------------------------------------------------------------------

		const linkPathGenerator = d3
			.linkVertical<d3.HierarchyLink<TreeNodeData>, d3.HierarchyNode<TreeNodeData>>()
			.x((d) => d.x ?? 0)
			.y((d) => d.y ?? 0);

		this.linksGroup
			.selectAll<SVGPathElement, d3.HierarchyLink<TreeNodeData>>('path.tree-link')
			.data(visibleLinks, (d) => `${d.source.data.id}-${d.target.data.id}`)
			.join(
				(enter) =>
					enter
						.append('path')
						.attr('class', 'tree-link')
						.attr('fill', 'none')
						.attr('stroke', 'var(--border-subtle)')
						.attr('stroke-width', 1.5)
						.attr('d', linkPathGenerator as unknown as (d: d3.HierarchyLink<TreeNodeData>) => string),
				(update) => update.attr('d', linkPathGenerator as unknown as (d: d3.HierarchyLink<TreeNodeData>) => string),
				(exit) => exit.remove(),
			);

		// ---------------------------------------------------------------------------
		// Nodes data join — key by d.data.id (VIEW-09 compliant)
		// ---------------------------------------------------------------------------

		const nodeGroups = this.nodesGroup
			.selectAll<SVGGElement, CollapsibleNode>('g.tree-node-group')
			.data(visibleNodes as CollapsibleNode[], (d) => d.data.id)
			.join(
				(enter) => {
					const g = enter
						.append('g')
						.attr('class', 'tree-node-group')
						.attr('data-id', (d) => d.data.id)
						.attr('transform', (d) => `translate(${d.x ?? 0}, ${d.y ?? 0})`)
						.style('cursor', 'pointer');

					// Circle
					g.append('circle')
						.attr('class', 'tree-node')
						.attr('r', NODE_RADIUS)
						.attr('fill', (d) => colorForType(d.data.card_type))
						.attr('stroke', 'var(--text-primary)')
						.attr('stroke-width', 2);

					// Label below circle
					g.append('text')
						.attr('class', 'tree-label')
						.attr('text-anchor', 'middle')
						.attr('dy', NODE_RADIUS + 14)
						.attr('font-size', 11)
						.attr('fill', 'var(--text-secondary)')
						.text((d) => d.data.name);

					// Attach click handler
					g.on('click', (event: MouseEvent, d: CollapsibleNode) => {
						event.stopPropagation();
						if (event.shiftKey) {
							// Shift-click: multi-select only, no collapse
							this.selectionProvider?.addToSelection(d.data.id);
						} else {
							// Primary click: toggle collapse + select
							this._toggleNode(d);
							this.selectionProvider?.toggle(d.data.id);
						}
					});

					return g;
				},
				(update) => {
					update.attr('transform', (d) => `translate(${d.x ?? 0}, ${d.y ?? 0})`);
					return update;
				},
				(exit) => exit.remove(),
			);

		// Update collapse visual indicator
		nodeGroups
			.attr('data-collapsed', (d) => ((d as CollapsibleNode)._children ? 'true' : null))
			.select('circle.tree-node')
			.attr('fill', (d) => colorForType(d.data.card_type))
			.attr('stroke', (d) => (selection.has(d.data.id) ? 'var(--selection-outline)' : 'var(--text-primary)'))
			.attr('stroke-width', (d) => (selection.has(d.data.id) ? 3 : 2))
			.attr('fill-opacity', (d) => ((d as CollapsibleNode)._children ? 1 : d.children ? 0.7 : 1));

		// Update selection attribute
		nodeGroups.attr('data-selected', (d) => (selection.has(d.data.id) ? 'true' : null));

		// Phase 37 — Audit data attributes on tree node <g> elements
		// CSS rules (.audit-mode g.tree-node-group[data-audit] circle) handle visual styling
		nodeGroups.attr('data-audit', (d) => auditState.getChangeStatus(d.data.id));
		nodeGroups.attr('data-source', (d) => this._cardMap.get(d.data.id)?.source ?? null);
	}

	// ---------------------------------------------------------------------------
	// Private: toggle collapse
	// ---------------------------------------------------------------------------

	private _toggleNode(node: CollapsibleNode): void {
		if (node.children) {
			// Collapse: stash children, clear node.children
			node._children = node.children;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(node as any).children = undefined;
		} else if (node._children) {
			// Expand: restore children, clear stash
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(node as any).children = node._children;
			delete node._children;
		}

		// Re-run layout on existing root — do NOT re-stratify
		if (this.root && this.treeLayout) {
			this.treeLayout(this.root);
		}
		this._updateTreeRender();
	}

	// ---------------------------------------------------------------------------
	// Private: update selection visuals only
	// ---------------------------------------------------------------------------

	private _updateSelectionVisuals(): void {
		if (!this.nodesGroup) return;
		const selection = this.selectionProvider?.getSelected() ?? new Set<string>();

		this.nodesGroup
			.selectAll<SVGGElement, CollapsibleNode>('g.tree-node-group')
			.attr('data-selected', (d) => (selection.has(d.data.id) ? 'true' : null))
			.select('circle.tree-node')
			.attr('stroke', (d) => (selection.has(d.data.id) ? 'var(--selection-outline)' : 'var(--text-primary)'))
			.attr('stroke-width', (d) => (selection.has(d.data.id) ? 3 : 2));
	}

	// ---------------------------------------------------------------------------
	// Private: clear tree
	// ---------------------------------------------------------------------------

	private _clearTree(): void {
		if (this.linksGroup) {
			this.linksGroup.selectAll('path.tree-link').remove();
		}
		if (this.nodesGroup) {
			this.nodesGroup.selectAll('g.tree-node-group').remove();
		}
		this.root = null;
	}

	// ---------------------------------------------------------------------------
	// Private: render orphan list
	// ---------------------------------------------------------------------------

	private _renderOrphans(orphanCards: CardDatum[]): void {
		if (!this.orphanContainer) return;

		this.orphanContainer.innerHTML = '';

		if (orphanCards.length === 0) return;

		// Section header
		const header = document.createElement('div');
		header.className = 'orphan-header';
		header.textContent = 'Unconnected cards';
		header.style.cssText =
			'font-size:var(--text-sm);font-weight:600;color:var(--text-muted);padding:8px 12px 4px;border-top:1px solid var(--border-muted);margin-top:8px;';
		this.orphanContainer.appendChild(header);

		for (const card of orphanCards) {
			const item = document.createElement('div');
			item.className = 'orphan-item';
			item.setAttribute('data-id', card.id);
			item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 12px;font-size:var(--text-sm);color:var(--text-secondary);';

			const icon = document.createElement('span');
			icon.className = 'orphan-icon';
			icon.textContent = card.card_type.slice(0, 1).toUpperCase();
			icon.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;font-size:var(--text-xs);font-weight:700;background:${colorForType(card.card_type)};color:var(--text-primary);`;

			const label = document.createElement('span');
			label.className = 'orphan-name';
			label.textContent = card.name;

			item.appendChild(icon);
			item.appendChild(label);
			this.orphanContainer.appendChild(item);
		}
	}
}
