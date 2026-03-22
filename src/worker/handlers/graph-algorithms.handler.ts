// Isometry v9.0 — Phase 115 Algorithm Engine
// Graph Algorithm Handler
//
// Implements all 6 graph algorithms inside handleGraphCompute:
//   ALGO-01: Shortest Path (BFS single-source from sourceCardId)
//   ALGO-02: Betweenness Centrality (Brandes with sqrt(n) sampling for n>2000)
//   ALGO-03: Louvain Community Detection
//   ALGO-04: Local Clustering Coefficient
//   ALGO-05: Kruskal Minimum Spanning Tree (spanning forest for disconnected graphs)
//   ALGO-06: PageRank
//
// Design principles (per CONTEXT.md):
//   - All algorithm computations run inside the Worker; graphology Graph object never crosses postMessage
//   - Transactional batch write: all algorithms compute first, then one writeGraphMetrics() call
//   - If any algorithm throws, no partial writes (all-or-nothing)
//   - sanitizeAlgorithmResult() guards all results before DB write
//   - Louvain isolated nodes (degree 0) get community_id = null

import { UndirectedGraph } from 'graphology';
import betweennessCentrality from 'graphology-metrics/centrality/betweenness';
import pagerank from 'graphology-metrics/centrality/pagerank';
import louvain from 'graphology-communities-louvain';
import { singleSourceLength, bidirectional } from 'graphology-shortest-path/unweighted';

import type { Database } from '../../database/Database';
import {
	clearGraphMetrics,
	readAllGraphMetrics,
	readGraphMetrics,
	writeGraphMetrics,
} from '../../database/queries/graph-metrics';
import type { GraphMetricsRow } from '../../database/queries/graph-metrics';
import { sanitizeAlgorithmResult } from '../utils/sanitize';
import type { WorkerPayloads, WorkerResponses } from '../protocol';

// ---------------------------------------------------------------------------
// ALGO-01: Shortest Path
// ---------------------------------------------------------------------------

/**
 * Compute single-source shortest path distances from sourceCardId.
 * Returns a Map<cardId, depth> for all reachable nodes.
 * Unreachable nodes are absent from the map (caller uses null for them).
 *
 * Per CONTEXT.md:
 *   - sp_depth written for all reachable cards from source
 *   - pathCardIds: [] (target requires Phase 117)
 *   - reachable: true if source exists in graph
 */
function computeShortestPath(
	g: UndirectedGraph,
	sourceCardId: string | undefined,
): { depths: Map<string, number>; reachable: boolean; pathCardIds: string[] } {
	// Auto-select highest-degree node if no source given
	let source = sourceCardId;
	if (!source || !g.hasNode(source)) {
		if (!source && g.order > 0) {
			// Pick node with max degree
			let maxDegree = -1;
			let bestNode = '';
			g.forEachNode((node) => {
				const deg = g.degree(node);
				if (deg > maxDegree) {
					maxDegree = deg;
					bestNode = node;
				}
			});
			source = bestNode;
		} else {
			// sourceCardId provided but not in graph
			return { depths: new Map(), reachable: false, pathCardIds: [] };
		}
	}

	// singleSourceLength returns {nodeId: depth} for all reachable nodes
	const lengths = singleSourceLength(g, source);

	const depths = new Map<string, number>();
	for (const [nodeId, depth] of Object.entries(lengths)) {
		// Never store Infinity
		if (Number.isFinite(depth)) {
			depths.set(nodeId, depth);
		}
	}

	return { depths, reachable: true, pathCardIds: [] };
}

// ---------------------------------------------------------------------------
// ALGO-02: Betweenness Centrality
// ---------------------------------------------------------------------------

/**
 * Compute betweenness centrality for all nodes.
 * Auto-switches to sqrt(n)-pivot sampling when n > 2000 (O(n*m) blocked at 10K+).
 * Returns normalized scores in [0, 1].
 */
function computeBetweennessCentrality(g: UndirectedGraph): Record<string, number> {
	if (g.order === 0) return {};

	const n = g.order;

	if (n > 2000) {
		// Sampling-based approximate betweenness: k = sqrt(n) pivots
		const k = Math.ceil(Math.sqrt(n));
		const nodes = g.nodes();

		// Shuffle nodes (Fisher-Yates) and take first k as pivot sources
		// Use deterministic selection: every floor(n/k) interval
		const step = Math.max(1, Math.floor(n / k));
		const pivots: string[] = [];
		for (let i = 0; i < n && pivots.length < k; i += step) {
			pivots.push(nodes[i]!);
		}

		// Accumulate raw centrality scores from sampled pivots
		const scores: Record<string, number> = {};
		for (const node of nodes) {
			scores[node] = 0;
		}

		for (const pivot of pivots) {
			// BFS from pivot to get distances and paths
			const { sigma, dist, pred } = _brandesFromSource(g, pivot, nodes);
			// Accumulate pair dependencies
			const delta: Record<string, number> = {};
			for (const node of nodes) delta[node] = 0;

			// Process nodes in reverse BFS order (by decreasing distance from pivot)
			const stack = nodes.slice().sort((a, b) => (dist[b] ?? -1) - (dist[a] ?? -1));
			for (const w of stack) {
				for (const v of (pred[w] ?? [])) {
					const coeff = ((sigma[v] ?? 0) / (sigma[w] ?? 1)) * (1 + (delta[w] ?? 0));
					delta[v] = (delta[v] ?? 0) + coeff;
				}
				if (w !== pivot) {
					scores[w] = (scores[w] ?? 0) + (delta[w] ?? 0);
				}
			}
		}

		// Scale by n/k to approximate full betweenness, normalize to [0, 1]
		const scaleFactor = n / k;
		for (const node of nodes) {
			scores[node] = (scores[node] ?? 0) * scaleFactor;
		}
		return _normalizeCentrality(scores, nodes);
	}

	// Exact Brandes betweenness centrality (normalized)
	const raw = betweennessCentrality(g, { normalized: true });
	return raw;
}

/**
 * BFS-based Brandes computation from a single source.
 * Returns sigma (path counts), dist (distances), pred (predecessors).
 */
function _brandesFromSource(
	g: UndirectedGraph,
	source: string,
	nodes: string[],
): { sigma: Record<string, number>; dist: Record<string, number>; pred: Record<string, string[]> } {
	const sigma: Record<string, number> = {};
	const dist: Record<string, number> = {};
	const pred: Record<string, string[]> = {};

	for (const n of nodes) {
		sigma[n] = 0;
		dist[n] = -1;
		pred[n] = [];
	}
	sigma[source] = 1;
	dist[source] = 0;

	const queue: string[] = [source];
	let qi = 0;

	while (qi < queue.length) {
		const v = queue[qi++]!;
		g.forEachNeighbor(v, (w) => {
			if (dist[w] === -1) {
				queue.push(w);
				dist[w] = (dist[v] ?? 0) + 1;
			}
			if (dist[w] === (dist[v] ?? 0) + 1) {
				sigma[w] = (sigma[w] ?? 0) + (sigma[v] ?? 0);
				pred[w] = [...(pred[w] ?? []), v];
			}
		});
	}

	return { sigma, dist, pred };
}

/**
 * Normalize centrality scores to [0, 1] based on min/max.
 */
function _normalizeCentrality(scores: Record<string, number>, nodes: string[]): Record<string, number> {
	const values = nodes.map((n) => scores[n] ?? 0);
	const min = Math.min(...values);
	const max = Math.max(...values);
	const range = max - min;
	if (range === 0) return Object.fromEntries(nodes.map((n) => [n, 0]));
	return Object.fromEntries(nodes.map((n) => [n, ((scores[n] ?? 0) - min) / range]));
}

// ---------------------------------------------------------------------------
// ALGO-03: Louvain Community Detection
// ---------------------------------------------------------------------------

/**
 * Detect communities using the Louvain algorithm.
 * Isolated nodes (degree 0) get community_id = null.
 * Uses seeded RNG for determinism in tests.
 */
function computeLouvainCommunity(
	g: UndirectedGraph,
	resolution?: number,
): Map<string, number | null> {
	const result = new Map<string, number | null>();

	if (g.order === 0) return result;

	// Collect isolated nodes (degree 0) — Louvain handles them poorly
	const isolatedNodes = new Set<string>();
	g.forEachNode((node) => {
		if (g.degree(node) === 0) {
			isolatedNodes.add(node);
			result.set(node, null);
		}
	});

	// If all nodes are isolated, return early
	if (isolatedNodes.size === g.order) {
		return result;
	}

	// Build subgraph without isolated nodes for Louvain
	// (graphology-communities-louvain can handle isolated nodes but assigns them
	// singleton communities — we want null for isolated nodes per CONTEXT.md)
	const subgraph = new UndirectedGraph();
	g.forEachNode((node) => {
		if (!isolatedNodes.has(node)) {
			subgraph.addNode(node);
		}
	});
	g.forEachEdge((_, __, source, target) => {
		if (!isolatedNodes.has(source) && !isolatedNodes.has(target)) {
			subgraph.mergeEdge(source, target);
		}
	});

	if (subgraph.order === 0) return result;

	// Run Louvain with seeded RNG for reproducibility
	const communities = louvain(subgraph, {
		resolution: resolution ?? 1,
		rng: () => 0.5, // Seeded for determinism
	});

	for (const [node, communityId] of Object.entries(communities)) {
		result.set(node, communityId);
	}

	return result;
}

// ---------------------------------------------------------------------------
// ALGO-04: Local Clustering Coefficient
// ---------------------------------------------------------------------------

/**
 * Compute local clustering coefficient for all nodes.
 * Nodes with degree < 2 get clustering_coeff = 0 (no triangles possible).
 */
function computeClusteringCoefficient(g: UndirectedGraph): Record<string, number> {
	const result: Record<string, number> = {};

	g.forEachNode((node) => {
		const degree = g.degree(node);
		if (degree < 2) {
			result[node] = 0;
			return;
		}

		// Get neighbors
		const neighbors = g.neighbors(node);
		const neighborSet = new Set(neighbors);

		// Count triangles: edges between neighbors
		let triangleEdges = 0;
		for (const neighbor of neighbors) {
			g.forEachNeighbor(neighbor, (nn) => {
				if (neighborSet.has(nn) && nn !== node) {
					triangleEdges++;
				}
			});
		}

		// Each triangle edge is counted twice (once from each end)
		const actualTriangles = triangleEdges / 2;
		const possibleTriangles = (degree * (degree - 1)) / 2;
		result[node] = actualTriangles / possibleTriangles;
	});

	return result;
}

// ---------------------------------------------------------------------------
// ALGO-05: Kruskal Minimum Spanning Tree (spanning forest)
// ---------------------------------------------------------------------------

/**
 * Compute minimum spanning forest using Kruskal's algorithm with Union-Find.
 * Handles disconnected graphs — produces a spanning forest.
 *
 * Returns:
 *   - mstNodes: Set of node IDs whose incident edges are in the spanning tree
 *   - componentCount: number of connected components
 */
function computeMinimumSpanningTree(g: UndirectedGraph): {
	mstNodes: Set<string>;
	componentCount: number;
} {
	const nodes = g.nodes();
	const n = nodes.length;
	const mstNodes = new Set<string>();

	if (n === 0) return { mstNodes, componentCount: 0 };

	// Union-Find data structures
	const parent: Record<string, string> = {};
	const rank: Record<string, number> = {};

	for (const node of nodes) {
		parent[node] = node;
		rank[node] = 0;
	}

	function find(x: string): string {
		if (parent[x] !== x) {
			parent[x] = find(parent[x]!);
		}
		return parent[x]!;
	}

	function union(x: string, y: string): boolean {
		const px = find(x);
		const py = find(y);
		if (px === py) return false; // Already in same component

		if ((rank[px] ?? 0) < (rank[py] ?? 0)) {
			parent[px] = py;
		} else if ((rank[px] ?? 0) > (rank[py] ?? 0)) {
			parent[py] = px;
		} else {
			parent[py] = px;
			rank[px] = (rank[px] ?? 0) + 1;
		}
		return true;
	}

	// Collect all edges (undirected — use sorted pairs to avoid duplicates)
	const edges: Array<[string, string]> = [];
	g.forEachEdge((_, __, source, target) => {
		edges.push([source, target]);
	});

	// For unweighted graph, all edges have weight 1 — Kruskal degenerates to
	// BFS-like spanning forest. Process edges in order.
	let edgesInMst = 0;
	for (const [source, target] of edges) {
		if (union(source, target)) {
			mstNodes.add(source);
			mstNodes.add(target);
			edgesInMst++;
			if (edgesInMst === n - 1) break; // Spanning tree found (connected graph case)
		}
	}

	// Add isolated nodes to mstNodes (they are in the spanning forest but with no edges)
	for (const node of nodes) {
		if (g.degree(node) === 0) {
			mstNodes.add(node);
		}
	}

	// Count connected components using Union-Find
	const roots = new Set<string>();
	for (const node of nodes) {
		roots.add(find(node));
	}
	const componentCount = roots.size;

	return { mstNodes, componentCount };
}

// ---------------------------------------------------------------------------
// ALGO-06: PageRank
// ---------------------------------------------------------------------------

/**
 * Compute PageRank scores for all nodes.
 * Uses alpha=0.85 (damping factor), maxIterations=100.
 * Scores sum to approximately 1.0.
 */
function computePageRank(g: UndirectedGraph, alpha?: number, iterations?: number): Record<string, number> {
	if (g.order === 0) return {};

	const raw = pagerank(g, {
		alpha: alpha ?? 0.85,
		maxIterations: iterations ?? 100,
		getEdgeWeight: null, // Unweighted
	});

	return raw;
}

// ---------------------------------------------------------------------------
// Connected Component Count (BFS)
// ---------------------------------------------------------------------------

/**
 * Count connected components in the graph using BFS.
 * O(n + m) time — runs before algorithms as part of handleGraphCompute.
 */
function countComponents(g: UndirectedGraph): number {
	if (g.order === 0) return 0;

	const visited = new Set<string>();
	let count = 0;

	g.forEachNode((startNode) => {
		if (visited.has(startNode)) return;
		count++;
		// BFS from startNode
		const queue: string[] = [startNode];
		visited.add(startNode);
		let qi = 0;
		while (qi < queue.length) {
			const node = queue[qi++]!;
			g.forEachNeighbor(node, (neighbor) => {
				if (!visited.has(neighbor)) {
					visited.add(neighbor);
					queue.push(neighbor);
				}
			});
		}
	});

	return count;
}

// ---------------------------------------------------------------------------
// handleGraphCompute
// ---------------------------------------------------------------------------

/**
 * Build a graphology UndirectedGraph from the connections table and execute
 * all requested algorithm computations.
 *
 * Phase 115: Full algorithm implementations for all 6 algorithms.
 * Transactional batch write: all algorithms compute first, then one writeGraphMetrics() call.
 * If any algorithm throws, no partial writes.
 *
 * @param db      - Database instance
 * @param payload - Algorithm selection, params, and render token
 * @returns       - Compute summary with componentCount, pathCardIds, reachable
 */
export function handleGraphCompute(
	db: Database,
	payload: WorkerPayloads['graph:compute'],
): WorkerResponses['graph:compute'] {
	const start = performance.now();

	// Read all non-deleted card IDs
	const cardResult = db.exec('SELECT id FROM cards WHERE deleted_at IS NULL');
	const nodeRows = cardResult[0]?.values ?? [];

	// Read all connections
	const edgeResult = db.exec('SELECT source_id, target_id FROM connections');
	const edgeRows = edgeResult[0]?.values ?? [];

	// Build UndirectedGraph
	const g = new UndirectedGraph();

	for (const row of nodeRows) {
		const cardId = row[0] as string;
		g.addNode(cardId);
	}

	for (const row of edgeRows) {
		const sourceId = row[0] as string;
		const targetId = row[1] as string;
		// mergeEdge handles parallel edges silently (deduplicates to unique pairs)
		g.mergeEdge(sourceId, targetId);
	}

	// Compute component count (always, for all invocations)
	const componentCount = countComponents(g);

	const algorithmsToRun = payload.algorithms;
	const algorithmsComputed: string[] = [];
	let pathCardIds: string[] = [];
	let reachable: boolean | undefined;

	// If no algorithms requested, skip computation and write
	if (algorithmsToRun.length === 0) {
		const durationMs = Math.round(performance.now() - start);
		return {
			cardCount: g.order,
			edgeCount: g.size,
			algorithmsComputed: [],
			durationMs,
			renderToken: payload.renderToken,
			componentCount,
		};
	}

	// Initialize metric rows — one per card
	const allCardIds = g.nodes();
	const metricMap = new Map<string, GraphMetricsRow>();
	for (const cardId of allCardIds) {
		metricMap.set(cardId, {
			card_id: cardId,
			centrality: null,
			pagerank: null,
			community_id: null,
			clustering_coeff: null,
			sp_depth: null,
			in_spanning_tree: null,
		});
	}

	// Execute each requested algorithm — all or nothing (no partial writes on error)
	for (const algorithm of algorithmsToRun) {
		switch (algorithm) {
			case 'pagerank': {
				const scores = computePageRank(g, payload.params?.pagerank?.alpha, payload.params?.pagerank?.iterations);
				for (const [cardId, score] of Object.entries(scores)) {
					const row = metricMap.get(cardId);
					if (row) row.pagerank = score;
				}
				algorithmsComputed.push('pagerank');
				break;
			}

			case 'centrality': {
				const scores = computeBetweennessCentrality(g);
				for (const [cardId, score] of Object.entries(scores)) {
					const row = metricMap.get(cardId);
					if (row) row.centrality = score;
				}
				algorithmsComputed.push('centrality');
				break;
			}

			case 'community': {
				const communities = computeLouvainCommunity(g, payload.params?.community?.resolution);
				for (const [cardId, communityId] of communities.entries()) {
					const row = metricMap.get(cardId);
					if (row) row.community_id = communityId;
				}
				algorithmsComputed.push('community');
				break;
			}

			case 'clustering': {
				const coefficients = computeClusteringCoefficient(g);
				for (const [cardId, coeff] of Object.entries(coefficients)) {
					const row = metricMap.get(cardId);
					if (row) row.clustering_coeff = coeff;
				}
				algorithmsComputed.push('clustering');
				break;
			}

			case 'spanning_tree': {
				const { mstNodes } = computeMinimumSpanningTree(g);
				for (const [cardId, row] of metricMap.entries()) {
					row.in_spanning_tree = mstNodes.has(cardId) ? 1 : 0;
				}
				algorithmsComputed.push('spanning_tree');
				break;
			}

			case 'shortest_path': {
				const sourceCardId = payload.params?.shortest_path?.sourceCardId;
				const { depths, reachable: isReachable, pathCardIds: path } = computeShortestPath(g, sourceCardId);
				reachable = isReachable;
				pathCardIds = path;
				for (const [cardId, row] of metricMap.entries()) {
					const depth = depths.get(cardId);
					row.sp_depth = depth !== undefined ? depth : null;
				}
				algorithmsComputed.push('shortest_path');
				break;
			}
		}
	}

	// Sanitize and batch write (single transactional write)
	const rows = Array.from(metricMap.values()).map((row) => {
		const sanitized = sanitizeAlgorithmResult(row as unknown as Record<string, unknown>);
		return sanitized as unknown as GraphMetricsRow;
	});

	writeGraphMetrics(db, rows);

	const durationMs = Math.round(performance.now() - start);

	const response: WorkerResponses['graph:compute'] = {
		cardCount: g.order,
		edgeCount: g.size,
		algorithmsComputed,
		durationMs,
		renderToken: payload.renderToken,
		componentCount,
	};

	if (pathCardIds.length > 0) {
		response.pathCardIds = pathCardIds;
	}
	if (reachable !== undefined) {
		response.reachable = reachable;
	}

	return response;
}

// ---------------------------------------------------------------------------
// handleGraphMetricsRead
// ---------------------------------------------------------------------------

/**
 * Read graph metrics rows from graph_metrics table.
 *
 * If cardIds is provided and non-empty, returns only those rows.
 * If cardIds is undefined or empty, returns all rows.
 *
 * @param db      - Database instance
 * @param payload - Optional card ID filter
 * @returns       - Array of metric rows
 */
export function handleGraphMetricsRead(
	db: Database,
	payload: WorkerPayloads['graph:metrics-read'],
): WorkerResponses['graph:metrics-read'] {
	if (payload.cardIds !== undefined) {
		// readGraphMetrics handles empty array (returns []) per its own early-exit guard
		return readGraphMetrics(db, payload.cardIds);
	}
	return readAllGraphMetrics(db);
}

// ---------------------------------------------------------------------------
// handleGraphMetricsClear
// ---------------------------------------------------------------------------

/**
 * Delete all rows from the graph_metrics table.
 *
 * Called when the user explicitly triggers a metrics clear, or when
 * the graph structure changes enough to invalidate all metrics.
 *
 * @param db - Database instance
 * @returns  - Success indicator
 */
export function handleGraphMetricsClear(db: Database): WorkerResponses['graph:metrics-clear'] {
	clearGraphMetrics(db);
	return { success: true };
}
