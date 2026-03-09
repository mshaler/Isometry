# Technology Stack: v5.2 SuperCalc + Workbench Phase B

**Project:** Isometry v5.2 SuperCalc + Workbench Phase B
**Researched:** 2026-03-09
**Confidence:** HIGH -- no new dependencies needed; all features use existing stack

## Recommended Stack

### No New Dependencies

v5.2 requires zero new npm packages. Every feature is built on the existing stack:

| Technology | Version | Purpose | Why (v5.2 Specific) |
|------------|---------|---------|---------------------|
| TypeScript | 5.9 (strict) | All source code | Existing |
| sql.js | 1.14 (FTS5 WASM) | Aggregate queries for SuperCalc + chart data + histogram buckets | Existing -- SQL GROUP BY + aggregate functions handle all computation |
| D3.js | v7.9 | Footer row data join, chart block SVG, histogram bars, brush interaction, chip rendering | Existing -- d3.brushX() for histogram scrubbing is the only new D3 API surface |
| marked | latest | Notebook Markdown parsing + custom renderer for chart blocks | Existing -- marked.use() renderer extension for chart code blocks |
| DOMPurify | latest | XSS sanitization of notebook preview (with data-chart-* attribute extension) | Existing -- minor config change to allow data-chart-type/data-chart-field attrs |
| Vite | 7.3 | Dev server + build | Existing |
| Vitest | 4.0 | Unit + integration tests | Existing |
| Biome | 2.4.6 | Lint + format | Existing |

### New D3 API Surface

The only new D3 module used in v5.2 is `d3.brushX()` from `d3-brush` (already included in the d3 umbrella package). This provides the interactive drag-to-select range behavior for histogram scrubbers.

```typescript
// Already available via import * as d3 from 'd3'
const brush = d3.brushX()
    .extent([[0, 0], [width, height]])
    .on('end', handleBrushEnd);
```

### New marked API Surface

The `marked.use()` renderer extension API is used to intercept fenced code blocks with `chart` language tag. This is a documented, stable API.

```typescript
// Custom renderer for chart code blocks
marked.use({
    renderer: {
        code(code: string, language: string | undefined): string | false {
            if (language === 'chart') {
                const config = parseChartConfig(code);
                return `<div class="notebook-chart" data-chart-type="${config.type}" data-chart-field="${config.field}"></div>`;
            }
            return false; // Fall through to default renderer
        }
    }
});
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Chart library | D3.js (existing) | Chart.js, Recharts | Adding a 200KB+ dependency for mini-charts when D3 is already loaded |
| Rich text editor | Plain textarea + toolbar | Prosemirror, TipTap, CodeMirror | Massive bundle (~100-500KB) for a notebook sidebar; textarea + Markdown is sufficient |
| Histogram interaction | d3.brushX | Custom pointer events | d3.brushX handles drag state, snapping, and clear natively |
| Notebook persistence | ui_state table | New notebooks table | Avoids schema migration; ui_state already has handlers and checkpoint integration |
| Category chips | D3 data join buttons | Standalone web component | Follows existing LatchExplorers D3 pattern; no new rendering paradigm |

## Installation

```bash
# No new packages needed
# Existing dependencies handle everything:
npm install  # (no changes to package.json)
```

## SQL Aggregate Functions Used

SuperCalc footer rows and chart blocks use SQLite aggregate functions. These are built into sql.js and require no additional configuration:

| Function | SuperCalc | Charts | Histograms |
|----------|-----------|--------|------------|
| `COUNT(*)` | Yes | Yes | Yes |
| `SUM(field)` | Yes | No | No |
| `AVG(field)` | Yes | No | No |
| `MIN(field)` | Yes | No | No |
| `MAX(field)` | Yes | No | No |
| `GROUP_CONCAT` | No | No | No (already used by supergrid:query) |
| `strftime()` | No | No | Yes (bucket aggregation) |

## Sources

- Existing `package.json` dependencies (verified in codebase)
- D3 v7 API: d3.brushX() -- part of d3-brush, included in d3 umbrella
- marked renderer extension API -- documented in marked.use() configuration
- SQLite aggregate functions -- built into sql.js WASM build
