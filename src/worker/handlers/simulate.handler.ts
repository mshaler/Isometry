// Isometry v5 — Phase 7 Force Simulation Handler
// Runs d3-force simulation to convergence in the Worker (off main thread).
//
// Design:
//   - Imports ONLY from d3-force (zero DOM dependencies — safe in Worker)
//   - Uses manual stop() + tick() loop — never the internal d3 timer
//   - Returns one position snapshot after convergence — no per-tick messages
//   - Respects fx/fy on input nodes (pinned positions are preserved)
//
// Requirements: VIEW-08

import { forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';
import type { NodePosition, SimulatePayload } from '../protocol';

/**
 * Run a force-directed graph simulation to convergence and return
 * the final stable node positions.
 *
 * Called by the Worker router for 'graph:simulate' requests.
 * The main thread receives ONLY this final snapshot — never per-tick positions.
 *
 * @param payload - Nodes (with optional previous positions), links, viewport size
 * @returns Stable positions for all nodes after simulation convergence
 */
export function handleGraphSimulate(payload: SimulatePayload): NodePosition[] {
	const { nodes, links, width, height } = payload;

	if (nodes.length === 0) return [];

	// Clone nodes to avoid mutating the input (d3-force mutates in-place)
	const simNodes = nodes.map((n) => ({
		...n,
		x: n.x ?? undefined,
		y: n.y ?? undefined,
		fx: n.fx ?? undefined,
		fy: n.fy ?? undefined,
	}));

	const simulation = forceSimulation(simNodes)
		.force('charge', forceManyBody().strength(-300))
		.force(
			'link',
			forceLink(links.map((l) => ({ ...l })))
				.id((d: any) => d.id)
				.distance(80),
		)
		.force('x', forceX(width / 2).strength(0.05))
		.force('y', forceY(height / 2).strength(0.05))
		.stop(); // CRITICAL: do NOT use internal timer

	// Run to convergence: ~300 iterations with default parameters
	const iterations = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
	for (let i = 0; i < iterations; i++) {
		simulation.tick();
	}

	// Extract stable positions
	return simNodes.map((n) => ({
		id: n.id,
		x: n.x ?? width / 2,
		y: n.y ?? height / 2,
		fx: n.fx != null ? n.fx : null,
		fy: n.fy != null ? n.fy : null,
	}));
}
