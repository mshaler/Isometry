/**
 * Isometry D3.js Visualization Layer
 *
 * All visualization and interaction lives here.
 * Binds directly to sql.js query results with zero serialization.
 * Implements SuperGrid, Network, Kanban, Timeline renderers.
 *
 * Architecture: Bridge Elimination - D3.js queries sql.js directly in same memory space
 */

// Bridge Elimination Core: SuperGrid renderer with direct sql.js access
export { SuperGrid } from './SuperGrid';

// Legacy D3 utilities (pre-bridge elimination)
export * from './hooks';
export * from './D3View';
export * from './factory';
export * from './scales';
export * from './hooks/index';
export * from './components/cb-card';
export * from './components/cb-canvas';
export * from './components/D3ViewWrapper';

// Future exports for complete D3 renderer family (bridge elimination architecture)
// export { NetworkGraph } from './NetworkGraph';
// export { KanbanBoard } from './KanbanBoard';
// export { TimelineView } from './TimelineView';

/**
 * D3.js Patterns for Isometry (from CLAUDE.md)
 *
 * ALWAYS: key function in data binding
 * d3.selectAll(".card").data(cards, d => d.id)
 *
 * ALWAYS: .join() over manual enter/update/exit
 * selection.join(
 *   enter => enter.append("div").attr("class", "card"),
 *   update => update,
 *   exit => exit.remove()
 * );
 *
 * SINGLE DATA SOURCE: same cards, different projections
 * const cards = db.query("SELECT * FROM nodes WHERE deleted_at IS NULL");
 * d3.select("#grid").selectAll(".cell").data(cards, d => d.id).join("div");
 * d3.select("#kanban").selectAll(".card").data(cards, d => d.id).join("div");
 * d3.select("#graph").selectAll(".node").data(cards, d => d.id).join("circle");
 *
 * BRIDGE ELIMINATION CORE PRINCIPLE:
 * Direct sql.js → D3.js data flow with zero serialization overhead
 *
 * Before: Swift ↔ MessageBridge ↔ JavaScript (40KB overhead)
 * After:  sql.js → D3.js (same memory space, synchronous)
 */

// D3.js type exports for TypeScript compatibility
export type {
  Selection as D3Selection,
  ScaleOrdinal as D3ScaleOrdinal,
  BaseType as D3BaseType
} from 'd3';
