# Stack Research

**Domain:** Local-first polymorphic data projection platform (TypeScript/D3.js, WKWebView shell)
**Researched:** 2026-02-28
**Confidence:** HIGH — all library versions verified via npm registry; D3 module selection verified against d3js.org; Vite worker config verified via Vite 7 docs; Vitest web-worker support verified via npm

---

## Context: What Already Exists (Do Not Re-Research)

The v0.1 Data Foundation milestone is complete and validated:

| Technology | Version | Status |
|------------|---------|--------|
| TypeScript | 5.9.x (strict + extras) | Configured, 151 tests passing |
| sql.js | 1.14.0 (custom FTS5 WASM, 756KB) | Built, tested, FTS5 verified |
| Vite | 7.3.1 | Configured (`worker.format: 'es'`, WASM path resolved) |
| Vitest | 4.0.18 | Configured (`pool: 'forks'`, node environment) |
| vite-plugin-static-copy | 3.2.0 | Configured (WASM asset copying) |
| @types/sql.js | 1.4.9 | Installed |
| @vitest/coverage-v8 | 4.0.18 | Installed |

The vite.config.ts already has `worker.format: 'es'`, `optimizeDeps.exclude: ['sql.js']`, and `assetsInlineLimit: 0`. The tsconfig has the full strict mode configuration.

**This document covers only what must be ADDED for the v1.0 Web Runtime milestone.**

---

## Recommended Additions

### Core Libraries to Add

| Library | Version | Purpose | Why This Choice | Confidence |
|---------|---------|---------|-----------------|------------|
| `d3` (umbrella) | 7.9.0 | Data visualization, DOM data joins, force simulation, hierarchy, transitions | D3 v7.9.0 is current (no v8 exists). The `d3` umbrella package enables tree-shaking via named imports in Vite/Rollup. Nine views need selection, scale, hierarchy, force, transition, zoom, drag — sub-module imports cover exactly what's needed. | HIGH |
| `@types/d3` | 7.4.3 | TypeScript type definitions for D3 | The umbrella @types package re-exports all sub-module types. Last validated against D3 7.4.4. Sub-module types (d3-selection, d3-force, d3-hierarchy, d3-scale, d3-zoom) are stable and accurate for all nine views. | HIGH |

### Dev Libraries to Add

| Library | Version | Purpose | Why This Choice | Confidence |
|---------|---------|---------|-----------------|------------|
| `@vitest/web-worker` | 4.0.18 | Simulate Web Worker API in Vitest test environment | The only official Vitest package for Web Worker testing. Version matches the installed Vitest 4.0.18. Simulates `Worker` + `postMessage`/`onmessage` in a single thread — no browser needed. Required for testing WorkerBridge correlation ID logic. | HIGH |

---

## D3 Module Selection: What to Import

This project needs the following D3 sub-modules. Import named exports from `'d3'` (Vite tree-shakes correctly from the umbrella package):

### Sub-Modules Required Per View

| Sub-Module | Purpose | Views Using It |
|------------|---------|---------------|
| `d3-selection` | DOM selection and data join (`.data().join()`) | All nine views |
| `d3-transition` | Animated transitions between states and views | All nine views |
| `d3-scale` | scaleLinear, scaleBand, scaleOrdinal, scaleTime | All except network |
| `d3-axis` | Rendered axis for SuperGrid dimensional headers | SuperGrid, table, timeline, calendar |
| `d3-array` | extent, group, rollup, bin — data aggregation for SuperGrid | SuperGrid, kanban, calendar |
| `d3-time` | timeDay, timeMonth, timeYear for calendar/timeline | Calendar, timeline |
| `d3-time-format` | Date formatting for axis labels | Calendar, timeline, SuperGrid |
| `d3-hierarchy` | hierarchy(), tree(), cluster() for tree view | Tree view |
| `d3-force` | forceSimulation, forceLink, forceManyBody, forceCenter | Network view (run in Worker) |
| `d3-zoom` | Pinch-to-zoom, scroll zoom for network and SuperGrid | Network, SuperGrid |
| `d3-drag` | Drag behavior for kanban card reordering | Kanban view |
| `d3-shape` | arc(), line(), area() for potential decorative elements | Optional, network/tree |
| `d3-color` | Color manipulation for LATCH accent colors | Design system |
| `d3-interpolate` | Color and transform interpolation for transitions | All views (via d3-transition) |

### Import Pattern (Vite tree-shakes named exports correctly)

```typescript
// CORRECT: Named imports from umbrella — Vite/Rollup tree-shakes these
import {
  select, selectAll,
  type Selection
} from 'd3-selection';

import {
  forceSimulation, forceLink, forceManyBody, forceCenter,
  type Simulation, type SimulationNodeDatum
} from 'd3-force';

import {
  scaleBand, scaleLinear, scaleOrdinal, scaleTime
} from 'd3-scale';

import { hierarchy, tree } from 'd3-hierarchy';
import { zoom, type ZoomBehavior } from 'd3-zoom';
import { drag } from 'd3-drag';
import { axisBottom, axisLeft, axisTop } from 'd3-axis';
import { extent, group, rollup, bin } from 'd3-array';
import { timeDay, timeWeek, timeMonth, timeYear } from 'd3-time';
import { timeFormat, timeParse } from 'd3-time-format';
import { transition } from 'd3-transition';

// AVOID: Global namespace import (tree-shaking unreliable via umbrella)
import * as d3 from 'd3'; // 570KB+ — don't do this
```

### TypeScript Typing Pattern for Strict Mode

The existing tsconfig's strict mode requires explicit generic parameters on D3 selections. This is the mandatory pattern for all views:

```typescript
// Always type both element AND datum generic parameters
const svg = d3.select<SVGSVGElement, unknown>(container)
  .append('svg');

// Data join with explicit types — key function always required
const cards = svg.selectAll<SVGGElement, Card>('.card')
  .data<Card>(data, (d: Card) => d.id)   // Key function mandatory
  .join('g');

// Zoom behavior typed to element
svg.call(d3.zoom<SVGSVGElement, unknown>()
  .on('zoom', (event) => { /* transform */ }));
```

---

## Worker Bridge: Stack for Testing

The `WorkerBridge` is pure TypeScript with no external library dependencies — the protocol uses `postMessage`/`onmessage` directly. The only addition needed is for testing:

### Testing Workers with Vitest

`@vitest/web-worker` (v4.0.18) enables WorkerBridge unit tests without a real browser. It polyfills `Worker` in the Vitest node environment, simulating the structured clone algorithm for message passing:

```typescript
// In test file — must import before using Worker constructor
import '@vitest/web-worker';

// Then test WorkerBridge normally
const bridge = new WorkerBridge();
await bridge.init();
const result = await bridge.query('SELECT * FROM cards');
expect(result).toHaveLength(0);
```

**Configuration in vitest.config.ts:**
```typescript
export default defineConfig({
  test: {
    setupFiles: ['@vitest/web-worker'],  // OR per-file import
    environment: 'node',
    pool: 'forks',
  }
});
```

**Alternative approach:** Mock the WorkerBridge entirely for Provider and D3 view tests — don't test through the actual Worker for unit tests. Only use `@vitest/web-worker` for WorkerBridge integration tests that need real correlation ID matching. Provider tests should mock `workerBridge.query()` directly.

### tsconfig: Add WebWorker Lib

The current tsconfig has `"lib": ["ES2022", "DOM", "DOM.Iterable"]`. Worker-specific globals (`self`, `DedicatedWorkerGlobalScope`, `postMessage`) require adding `"WebWorker"`:

```json
{
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"]
  }
}
```

Without `"WebWorker"`, TypeScript does not recognize `self.onmessage` or `self.postMessage` inside worker files. This is a zero-cost tsconfig change.

---

## D3 Force Simulation: Run in Worker

The network view requires force-directed layout. Running force simulation on the main thread blocks the UI during layout convergence. The spec's architecture already places all computation in the Worker — force simulation belongs there too.

### Pattern: Simulation in Worker, Positions to Main Thread

```typescript
// In Web Worker (worker.ts)
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force';

function handleGraphLayout(payload: { nodes: GraphNode[]; links: GraphLink[] }) {
  const simulation = forceSimulation(payload.nodes)
    .force('link', forceLink(payload.links).id((d: any) => d.id))
    .force('charge', forceManyBody().strength(-300))
    .force('center', forceCenter(0, 0))
    .stop();

  // Run synchronously to convergence (no DOM, no requestAnimationFrame needed)
  const iterations = Math.ceil(
    Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())
  );
  simulation.tick(iterations);

  // Return stable positions only — not full node objects
  return payload.nodes.map(n => ({ id: n.id, x: n.x, y: n.y }));
}
```

```typescript
// In main thread (NetworkView.ts)
const positions = await workerBridge.send('graph:layout', { nodes, links });
// Now bind positions to D3 SVG elements — simulation already complete
svg.selectAll<SVGGElement, CardNode>('g.node')
  .data(positions, d => d.id)
  .attr('transform', d => `translate(${d.x}, ${d.y})`);
```

**Why this works:** `d3-force` has no DOM dependencies. It runs pure JavaScript in the Worker. `simulation.tick(n)` runs the simulation synchronously — no requestAnimationFrame. The Worker posts final `{id, x, y}` tuples (not full node objects), minimizing structured clone serialization overhead.

---

## MutationManager: No External Dependencies

The MutationManager (D-009 command log undo/redo) is pure TypeScript with no library dependencies. The design is:

```typescript
interface Command {
  id: string;                                    // crypto.randomUUID()
  type: 'insert' | 'update' | 'delete' | 'batch';
  table: 'cards' | 'connections';
  forward: { sql: string; params: unknown[] };
  inverse: { sql: string; params: unknown[] };
  timestamp: number;
}
```

No library is needed for the command stack — a plain array with push/pop/slice handles the bounded history. The `requestAnimationFrame`-batched notification pattern in the spec requires no library either (browser-native).

**Testing:** Standard Vitest with mocked `workerBridge` — no special setup.

---

## Provider System: No External Dependencies

All five providers (FilterProvider, PAFVProvider, SelectionProvider, DensityProvider, StateCoordinator) are pure TypeScript. No reactive framework is needed:

- State: plain TypeScript class fields
- Subscriptions: `Set<() => void>` with add/delete
- Batching: `setTimeout(16ms)` for StateCoordinator or `requestAnimationFrame`
- SQL compilation: string interpolation with validated allowlist

**Testing:** Standard Vitest with node environment. Provider tests that exercise SQL compilation are fast (no WASM needed) — compile filter state, assert `{ where, params }` output strings. SQL injection tests are plain string assertions.

---

## SuperGrid: No External Grid Library

SuperGrid is a D3-rendered component with nested dimensional headers, PAFV projection, and density controls. No external grid library (AG Grid, Handsontable, Tabulator) should be used — they own DOM structure and conflict with D3's data join ownership.

SuperGrid is built from:
- `d3-selection` for the nested header structure (`<g class="header-row">`)
- `d3-axis` for rendered axis ticks inside header cells
- `d3-scale` (scaleBand for column/row distribution)
- `d3-array` (`group()`, `rollup()` for data aggregation into cells)
- `d3-zoom` for pan/zoom on the grid canvas

No external library needed.

---

## Installation

```bash
# Runtime: D3.js (umbrella package — Vite tree-shakes named imports)
npm install d3

# TypeScript types for D3
npm install -D @types/d3

# Worker testing
npm install -D @vitest/web-worker
```

**Total additions:** 1 runtime package, 2 dev packages.

**No changes needed to:** Vite config (worker.format already 'es'), tsconfig (except adding "WebWorker" to lib), Vitest config (existing pool:forks + node env is correct).

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `d3` umbrella (tree-shaken) | Individual d3-* sub-packages | Same tree-shaking result with Vite. Umbrella is simpler to install and keeps versions in sync automatically. No reason to manage 12+ separate sub-packages. |
| `@vitest/web-worker` | Full browser test environment (`@playwright/test` or Vitest browser mode) | Browser mode is overkill for WorkerBridge unit testing. `@vitest/web-worker` simulates Worker in Node — fast, no browser install, same Vitest config. |
| `@vitest/web-worker` | Mocking `Worker` manually in tests | Manual mocking is error-prone for the correlation ID + Promise resolution pattern. `@vitest/web-worker` handles structured clone semantics correctly. |
| D3 force simulation in Worker | PIXI.js for GPU-accelerated graph rendering | PIXI.js adds ~1MB bundle for a single view. The <16ms render budget for 100 visible cards is achievable with SVG + off-thread simulation. PIXI.js is the right answer at 10K+ visible nodes — overkill for this scale. |
| D3 transitions (built-in) | GSAP / Anime.js | D3 v7's transition module integrates directly with the data join lifecycle (enter/update/exit). External animation libraries fight D3's DOM ownership. GSAP adds ~50KB for no benefit when D3 transitions handle all needed view-switching animations. |
| Plain TypeScript for Providers | MobX / Zustand | Architecture explicitly forbids parallel entity state (D-001 rationale, CLAUDE.md). MobX/Zustand would duplicate SQLite data in JS heap. Providers hold only UI state — a `Set<() => void>` subscription pattern is sufficient. |
| No grid library for SuperGrid | AG Grid / Handsontable | AG Grid owns its own DOM and cannot be driven by D3 data joins. SuperGrid's PAFV projection, density controls, and nested headers are custom enough that no grid library maps cleanly to the spec. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| React / Vue / Svelte | Stack is locked — framework abstractions fight D3's DOM ownership model. D3 data joins ARE the rendering lifecycle. | Vanilla TypeScript class-based view components |
| MobX / Zustand / Jotai / Redux | Architecture forbids parallel entity state. Two sources of truth (SQLite + JS store) will diverge. | Query sql.js directly via WorkerBridge; bind results to D3 data joins |
| GSAP / Framer Motion | External animation libraries conflict with D3 transition lifecycle. They fight over DOM attribute ownership. | `d3-transition` built into D3 |
| D3 v6 or below | Missing `.join()` API, worse TypeScript types, force simulation API differences. | D3 v7.9.0 |
| `d3@next` (v6.0.0-rc.4 shows as "next" tag on npm) | The "next" tag on npm points to a v6 release candidate — this is a historical artifact. D3 v7.9.0 is current stable. Do NOT install `d3@next`. | `d3@7` or `d3@latest` |
| AG Grid / Handsontable / Tabulator for SuperGrid | Grid libraries own their DOM — incompatible with D3 data join architecture. Density controls and PAFV projection require custom rendering. | Custom D3 SuperGrid implementation |
| Observable Plot | A D3-based higher abstraction layer. Hides the data join model that this architecture depends on for performance and state management. | D3 directly |
| `import * as d3 from 'd3'` | Imports full ~570KB D3 bundle. Use named imports for tree-shaking. | `import { select, scaleLinear } from 'd3-selection'` etc. |
| `pool: 'threads'` in Vitest | WASM state leaks between tests in the same thread. | `pool: 'forks'` (already configured) |
| `@vitest/browser` for Worker tests | Full browser test infrastructure is heavier than needed; `@vitest/web-worker` simulates Worker in Node. | `@vitest/web-worker` |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `d3@7.9.0` | `@types/d3@7.4.3` | Match major version. Types last validated against D3 7.4.4 — close enough, no breaking changes in 7.4.4 → 7.9.0 types. |
| `d3@7.9.0` | TypeScript 5.9.x strict | Requires explicit generic type parameters on selections. `@types/d3` works with `skipLibCheck: false`. |
| `@vitest/web-worker@4.0.18` | `vitest@4.0.18` | Must match Vitest major version exactly. |
| `d3-force@3.0.0` | Web Worker (no DOM) | d3-force has zero DOM dependencies — runs cleanly in Worker context. |
| `d3-hierarchy@3.1.2` | Web Worker (no DOM) | d3-hierarchy is pure computation — usable in Worker if needed for tree pre-computation. |
| `d3-selection@3.0.0` | Main thread only | d3-selection manipulates DOM — cannot run in Worker. Only use in main-thread view renderers. |
| TypeScript `lib: ["WebWorker"]` | `d3-force` in Worker | Adding WebWorker lib enables `self.onmessage`, `self.postMessage` in worker.ts without changing other tsconfig behavior. |

---

## Vite Config Changes Required

The existing `vite.config.ts` requires only one addition: if importing D3 from the umbrella package inside a Worker, ensure D3 is not accidentally excluded from optimization. The current config excludes only `sql.js`:

```typescript
// vite.config.ts — only sql.js needs to be excluded
optimizeDeps: {
  exclude: ['sql.js'],  // d3 does NOT need to be excluded
}
```

D3 v7 uses pure ESM and works correctly with Vite's default optimizer. No changes needed to the existing Vite config beyond the `tsconfig.json` `"WebWorker"` lib addition.

---

## tsconfig.json Changes Required

One addition to the existing `tsconfig.json`:

```json
{
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"]
  }
}
```

This enables `self`, `DedicatedWorkerGlobalScope`, `MessageEvent<T>`, and `postMessage` types inside `worker.ts`. The `DOM` lib remains for main-thread code. TypeScript resolves per-file which globals are available based on the merged lib — both are needed since the codebase contains both main-thread and worker-thread TypeScript files.

**Potential issue:** With both `DOM` and `WebWorker` libs, some types that exist in both (like `MessageEvent`) may produce overloaded signatures. This is manageable — TypeScript picks the more specific version. Flag as LOW risk.

---

## Sources

- npm registry — d3 7.9.0 latest, verified 2026-02-28: https://www.npmjs.com/package/d3
- npm registry — @types/d3 7.4.3 latest: https://www.npmjs.com/package/@types/d3
- npm registry — @vitest/web-worker 4.0.18: https://www.npmjs.com/package/@vitest/web-worker
- D3 getting started — current version, module listing: https://d3js.org/getting-started
- D3 force simulation off-thread — Observable example: https://observablehq.com/@d3/force-directed-web-worker
- D3 force — simulation.tick() API, no DOM required: https://d3js.org/d3-force/simulation
- D3 hierarchy — tree layout docs: https://d3js.org/d3-hierarchy/tree
- D3 transition — selection-like interface docs: https://d3js.org/d3-transition
- Vite web worker docs — constructor pattern recommended, format:es: https://vite.dev/guide/features#web-workers
- Vite worker options — format, rollupOptions: https://vite.dev/config/worker-options
- TypeScript lib types reference — WebWorker lib: https://www.typescriptlang.org/tsconfig#lib
- d3/d3 GitHub issue #1053 — d3-force confirmed no DOM dependencies: https://github.com/d3/d3/issues/1053

---

*Stack research for: Isometry v5 Web Runtime (Worker Bridge, Providers, Mutation Manager, nine D3 views, SuperGrid)*
*Researched: 2026-02-28*
