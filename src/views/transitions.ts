// Isometry v5 — Phase 5 Transitions
// Morph and crossfade transition functions for view switching.
//
// Design:
//   - morphTransition: D3 SVG g.card position animation (400ms easeCubicOut, 15ms stagger)
//     - Used for List↔Grid transitions (both SVG, same LATCH family)
//     - Works via shared D3 data join key function (d => d.id) — same nodes, new positions
//   - crossfadeTransition: opacity in/out for container swap (300ms)
//     - Used for SVG↔HTML boundaries (e.g. List/Grid↔Kanban)
//     - Used for LATCH↔GRAPH family switches
//   - shouldUseMorph: detects when morph (vs crossfade) is appropriate
//
// Requirements: REND-03, REND-04

import * as d3 from 'd3';
import type { ViewType } from '../providers/types';
import type { CardDatum } from './types';

// ---------------------------------------------------------------------------
// View rendering type classification
// ---------------------------------------------------------------------------

/**
 * Views that render SVG-based cards (share SVG container for morph transitions).
 * Only these view types can participate in morphTransition.
 */
const SVG_VIEWS = new Set<ViewType>(['list', 'grid']);

/**
 * Views that render HTML-based cards (require crossfade on container swap).
 * HTML-based views cannot share DOM structure with SVG views.
 */
const HTML_VIEWS = new Set<ViewType>(['kanban']);

/**
 * Classify a ViewType into its view family.
 * 'network' and 'tree' are GRAPH; everything else is LATCH.
 * Matches PAFVProvider.getViewFamily().
 */
function getViewFamily(viewType: ViewType): 'latch' | 'graph' {
  return viewType === 'network' || viewType === 'tree' ? 'graph' : 'latch';
}

// ---------------------------------------------------------------------------
// shouldUseMorph
// ---------------------------------------------------------------------------

/**
 * Determine whether a morph transition should be used when switching views.
 *
 * Morph transition requirements:
 *   1. Both views must be SVG-based (g.card elements share the same SVG)
 *   2. Both views must be in the same ViewFamily (LATCH→LATCH)
 *
 * If either condition is false, use crossfadeTransition instead.
 *
 * Currently returns true only for: list↔grid
 * Future SVG-based views in Phase 6/7 may expand this set.
 *
 * @param fromType - The current (outgoing) view type
 * @param toType - The target (incoming) view type
 * @returns true if morph transition is appropriate; false for crossfade
 */
export function shouldUseMorph(fromType: ViewType, toType: ViewType): boolean {
  // Both must be SVG-based views
  if (!SVG_VIEWS.has(fromType) || !SVG_VIEWS.has(toType)) {
    return false;
  }

  // Both must be in the same view family (LATCH→LATCH for morphing)
  if (getViewFamily(fromType) !== getViewFamily(toType)) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// morphTransition
// ---------------------------------------------------------------------------

/**
 * Animate existing SVG g.card elements to new positions.
 *
 * How it works:
 *   - D3 data join with key `d => d.id` matches DOM g.card nodes to CardDatum items
 *   - Entering cards fade in at their destination position
 *   - Exiting cards fade out from their current position and are removed
 *   - Updating cards animate their transform to the new position
 *
 * The computePosition function computes the CSS transform string for each card
 * (e.g. "translate(0, 48)" for a list row, "translate(180, 120)" for a grid cell).
 *
 * IMPORTANT: This function operates on existing SVG elements — the caller must
 * ensure the SVG already contains (or will receive) g.card elements via D3 data join.
 * Views that use morphTransition call it from their render() method.
 *
 * @param svg - Root SVG element containing g.card elements
 * @param cards - New array of CardDatum to join
 * @param computePosition - Returns CSS transform string for a card at index i
 * @param options.duration - Transition duration in ms (default: 400)
 * @param options.stagger - Per-card delay offset in ms (default: 15)
 */
export function morphTransition(
  svg: SVGSVGElement,
  cards: CardDatum[],
  computePosition: (d: CardDatum, i: number) => string,
  options?: { duration?: number; stagger?: number }
): void {
  const duration = options?.duration ?? 400;
  const stagger = options?.stagger ?? 15;

  // D3 data join — key function `d => d.id` is MANDATORY (VIEW-09)
  const sel = d3
    .select(svg)
    .selectAll<SVGGElement, CardDatum>('g.card')
    .data(cards, (d: CardDatum) => d.id);

  // ENTER: new cards fade in at destination
  sel
    .enter()
    .append('g')
    .attr('class', 'card')
    .attr('opacity', 0)
    .attr('transform', computePosition)
    .transition()
    .duration(duration)
    .ease(d3.easeCubicOut)
    .delay((_, i) => i * stagger)
    .attr('opacity', 1);

  // EXIT: departing cards fade out and are removed
  sel
    .exit<CardDatum>()
    .transition()
    .duration(200)
    .attr('opacity', 0)
    .remove();

  // UPDATE: existing cards animate to new positions
  sel
    .transition()
    .duration(duration)
    .ease(d3.easeCubicOut)
    .delay((_, i) => i * stagger)
    .attr('transform', computePosition)
    .attr('opacity', 1);
}

// ---------------------------------------------------------------------------
// crossfadeTransition
// ---------------------------------------------------------------------------

/**
 * Crossfade between the current view container and a new one.
 *
 * Steps:
 *   1. Find existing .view-root child of container
 *   2. If exists: animate opacity 1→0, then remove (or use zero duration)
 *   3. Create a new div.view-root with opacity 0, append to container
 *   4. Call mountNewView() to populate the new container
 *   5. Animate new container opacity 0→1
 *
 * For SVG↔HTML and LATCH↔GRAPH transitions where morph is not possible.
 *
 * @param container - Parent element that contains .view-root children
 * @param mountNewView - Callback that populates the new .view-root
 * @param duration - Fade duration in ms (default: 300)
 */
export async function crossfadeTransition(
  container: HTMLElement,
  mountNewView: () => void,
  duration = 300
): Promise<void> {
  // Find existing .view-root
  const outgoing = container.querySelector<HTMLElement>('.view-root');

  // Step 1: fade out and remove existing .view-root
  if (outgoing !== null) {
    await new Promise<void>(resolve => {
      if (duration === 0) {
        outgoing.remove();
        resolve();
        return;
      }
      d3.select(outgoing)
        .transition()
        .duration(duration)
        .style('opacity', '0')
        .on('end', () => {
          outgoing.remove();
          resolve();
        });
    });
  }

  // Step 2: create new .view-root with opacity 0
  const incoming = document.createElement('div');
  incoming.className = 'view-root';
  incoming.style.opacity = '0';
  container.appendChild(incoming);

  // Step 3: mount new view content (into the container — view will find .view-root or container)
  mountNewView();

  // Step 4: fade in new .view-root
  if (duration === 0) {
    incoming.style.opacity = '1';
    return;
  }

  await new Promise<void>(resolve => {
    d3.select(incoming)
      .transition()
      .duration(duration)
      .style('opacity', '1')
      .on('end', () => resolve());
  });
}
