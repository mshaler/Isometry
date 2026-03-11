# Phase 69: Bug Fixes - Research

**Researched:** 2026-03-11
**Domain:** CSS SVG text inheritance + TypeScript null-safety audit
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Global SVG text CSS reset rule, NOT component-scoped -- prevents any future SVG from inheriting text styling artifacts
- Full SVG text reset covering `letter-spacing`, `text-transform`, and `word-spacing` in one rule -- SuperGrid headers use `text-transform: uppercase` which could also leak
- Reset rule lives in the main app stylesheet (top-level CSS entry point)
- Audit and consolidate all 6 existing `letter-spacing` declarations across CSS files (latch-explorers.css, projection-explorer.css, help-overlay.css, command-palette.css, audit.css, SuperGrid.ts inline) -- check for redundancy, consider design token consolidation
- Full audit of ALL non-SQL code paths that access `card.deleted_at` -- not just known crash paths
- Convention: `null deleted_at` = active card (matches existing SQL convention `deleted_at IS NULL`)
- No helper function or sentinel value -- TypeScript already types `deleted_at: string | null`; fix spots that aren't handling null correctly
- Key files to audit: NativeBridge.ts (sync merge), inverses.ts (undo/redo), exporters (CSV/JSON/Markdown), DedupEngine.ts, etl/types.ts, database/queries/helpers.ts
- Extend existing E2E specs (`filter-histogram.spec.ts`, `notebook-chart.spec.ts`) with SVG text assertions
- Assert BOTH computed CSS (`getComputedStyle(svgText).letterSpacing === 'normal'`) AND text content readability
- Integration round-trip test for null deleted_at: import card with null deleted_at, verify export produces correct output without crash
- Browser coverage for SVG fix: Claude's discretion based on BUGF-02 requirement (Safari/Chrome/Firefox verification required)

### Claude's Discretion
- Whether to run E2E SVG tests across all 3 Playwright browsers or Chromium-only (BUGF-02 says Safari/Chrome/Firefox but Claude judges CI tradeoff)
- Exact letter-spacing consolidation approach (design tokens vs keeping per-component declarations)
- Which specific non-SQL deleted_at paths need runtime guards vs are already safe

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUGF-01 | SVG text elements render without letter-spacing artifacts -- CSS `letter-spacing: normal` reset scoped to SVG text contexts prevents inheritance from HTML containers | CSS reset rule in `index.html` entry point; 6 letter-spacing sources identified and audited |
| BUGF-02 | All SVG-containing views (chart blocks, histogram scrubbers) verified free of letter-spacing regression across Safari/Chrome/Firefox | E2E test extension pattern with `getComputedStyle` verification; Chromium-only recommended (see Open Questions) |
| BUGF-03 | deleted_at field handled as optional (null-safe) across all non-SQL code paths -- no null dereference when accessing card.deleted_at | Full audit of 10 source files completed; 2 genuine bugs found, 8 paths already safe |
| BUGF-04 | Existing soft-delete filtering (`deleted_at IS NULL`) continues to work correctly for active card queries | All SQL paths use `deleted_at IS NULL` correctly; no changes needed to SQL filtering logic |
</phase_requirements>

## Summary

This phase addresses two independent bugs: (1) CSS `letter-spacing` inheritance leaking from HTML containers into SVG `<text>` elements rendered by D3 chart blocks and histogram scrubbers, and (2) `deleted_at` field accessed in non-SQL code paths without proper null handling.

For the SVG text bug, the fix is a global CSS reset rule (`svg text { letter-spacing: normal; text-transform: none; word-spacing: normal; }`) placed in the main `index.html` entry point, which already loads `design-tokens.css` as the first stylesheet. All 6 existing `letter-spacing` declarations across CSS files and 1 inline style in SuperGrid.ts are intentionally applied to HTML elements (section headers, labels, badges) and should NOT be removed -- the SVG reset prevents inheritance without touching the HTML styling.

For the `deleted_at` null-safety bug, a full audit of all non-SQL code paths reveals that most paths already handle null correctly via `?? null` or `?? ''` coalescing. Two genuine issues were found: (1) `NetworkView.ts` and `TreeView.ts` query `deleted_at IS NULL` on the `connections` table, which does NOT have a `deleted_at` column -- this will cause a SQLite error; (2) `MarkdownExporter.ts` does not include `deleted_at` in its frontmatter output, which is correct behavior (omitting null fields) but should be documented as intentional.

**Primary recommendation:** Add a single global SVG text CSS reset rule, fix the two `deleted_at` SQL bugs in NetworkView/TreeView (remove the clause from connections queries), and add E2E assertions for SVG text rendering.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| D3.js | v7.9 | SVG chart rendering (bar, pie, line, scatter) + histogram scrubbers | Already in use -- creates the SVG text elements affected by this bug |
| Vitest | 4.0 | Unit test framework | Already in use for all TS tests |
| Playwright | (project version) | E2E browser testing | Already in use for 11 E2E specs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| css-tokens | (design-tokens.css) | CSS custom property system | Letter-spacing consolidation if design token path is chosen |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Global `svg text {}` reset | Per-component D3 `.style('letter-spacing', 'normal')` | Per-component is more surgical but requires touching every chart renderer (5 files) and is fragile for future SVG additions |
| CSS reset in index.html | CSS reset in design-tokens.css | design-tokens.css is the first stylesheet loaded, either location works; index.html is the true entry point |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure

No structural changes. All edits are in-place modifications:

```
index.html                         # Add SVG text reset stylesheet link or inline
src/styles/design-tokens.css       # OR add SVG text reset here (already first CSS loaded)
src/views/NetworkView.ts           # Fix connections query (remove deleted_at)
src/views/TreeView.ts              # Fix connections query (remove deleted_at)
e2e/notebook-chart.spec.ts         # Extend with SVG text computed style assertions
e2e/filter-histogram.spec.ts       # Extend with SVG text computed style assertions
```

### Pattern 1: Global SVG Text CSS Reset

**What:** A single CSS rule that resets inherited text properties on all SVG `<text>` elements.
**When to use:** Always -- prevents any future SVG text from inheriting styling from HTML containers.
**Example:**
```css
/* Reset inherited HTML text styling on SVG text elements.
 * SVG <text> inherits CSS properties from parent HTML containers,
 * which causes rendering artifacts (garbled letter spacing) in
 * Safari/WebKit and inconsistent rendering across browsers.
 * This reset is global to protect all current and future SVG text. */
svg text {
  letter-spacing: normal;
  text-transform: none;
  word-spacing: normal;
}
```
**Source:** MDN SVG letter-spacing documentation confirms SVG text inherits CSS `letter-spacing` from parent elements.

### Pattern 2: Null-Coalescing for Nullable Fields

**What:** TypeScript `?? null` or `?? ''` pattern for nullable `string | null` fields.
**When to use:** Whenever accessing `card.deleted_at` in non-SQL contexts (export, serialization, display).
**Example:**
```typescript
// Already used correctly in CSVExporter.ts:57
deleted_at: card.deleted_at ?? '',

// Already used correctly in helpers.ts:60
deleted_at: (row['deleted_at'] as string | null) ?? null,

// Already used correctly in NativeBridge.ts:644
deleted_at: (raw['deleted_at'] as string | null) ?? null,
```

### Anti-Patterns to Avoid
- **Removing letter-spacing from HTML elements:** The existing `letter-spacing` on section headers, badges, and labels is intentional design. The SVG reset prevents inheritance, it does not remove HTML styling.
- **Adding `deleted_at` to the connections table:** The connections table correctly omits `deleted_at` -- connections are deleted via CASCADE when their parent card is deleted. The bug is in the SQL queries that reference `deleted_at` on the connections table.
- **Per-component SVG text resets:** Adding `.style('letter-spacing', 'normal')` to each D3 chart renderer is fragile and misses future SVG additions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG text styling reset | Per-element D3 style calls | CSS `svg text {}` rule | One rule covers all current and future SVG text |
| Null-safety wrapper | Custom `safeDeletedAt()` helper | `?? null` / `?? ''` coalescing | TypeScript already types the field correctly; simple coalescing is idiomatic |

**Key insight:** Both bugs have minimal, targeted fixes. The SVG bug is a single CSS rule. The deleted_at bug requires removing invalid SQL clauses from 2 files.

## Common Pitfalls

### Pitfall 1: connections Table Has No deleted_at Column

**What goes wrong:** `NetworkView.ts` line 252 and `TreeView.ts` line 441 both query `c.deleted_at IS NULL` or `deleted_at IS NULL` on the `connections` table. The `connections` table schema (confirmed in `schema.sql`) has NO `deleted_at` column. SQLite will raise "no such column: deleted_at" at runtime.
**Why it happens:** Copy-paste from cards query patterns into connection queries. The connections table uses CASCADE deletion (cards ON DELETE CASCADE), not soft-delete.
**How to avoid:** Remove the `deleted_at IS NULL` clause entirely from both connection queries. Connections are hard-deleted via CASCADE; there are no soft-deleted connections.
**Warning signs:** Any `deleted_at` reference in a SQL query that targets the `connections` table.

### Pitfall 2: SVG text Reset Breaking Intentional SVG Text Styling

**What goes wrong:** The global `svg text {}` reset could interfere if any SVG text elements intentionally use non-normal letter-spacing.
**Why it happens:** Over-broad CSS reset.
**How to avoid:** Audit all SVG text creation points. Currently, no SVG text in the codebase intentionally sets `letter-spacing`, `text-transform`, or `word-spacing`. D3 axis generators create `<text>` elements for tick labels and axis titles -- these should use normal spacing. Chart titles (`.notebook-chart-title`) are appended as SVG `<text>` elements and should also use normal spacing.
**Warning signs:** Garbled or collapsed text in SVG charts or axis labels after the fix.

### Pitfall 3: E2E getComputedStyle on SVG Text in Playwright

**What goes wrong:** `getComputedStyle()` on SVG `<text>` elements may return different values across browser engines. Safari returns `'normal'` as-is, Chrome may return `'0px'` for `letter-spacing: normal`.
**Why it happens:** Browser-specific computed style resolution for SVG elements.
**How to avoid:** Assert that the computed value is either `'normal'` or `'0px'` (both indicate the reset is active). Do NOT assert exact pixel values.
**Warning signs:** E2E test failures on one browser but not others.

### Pitfall 4: MarkdownExporter Omits deleted_at Intentionally

**What goes wrong:** Someone might think `MarkdownExporter.ts` has a bug because it doesn't include `deleted_at` in frontmatter.
**Why it happens:** The exporter uses `if (card.field)` truthiness checks, and `deleted_at` being `null` is intentionally omitted from export.
**How to avoid:** This is correct behavior -- exported cards should not carry soft-delete metadata. Only `CSVExporter` includes `deleted_at` (as empty string for null).

## Code Examples

### SVG Text CSS Reset (BUGF-01)

```css
/* Add to index.html as inline <style> or to design-tokens.css */
svg text {
  letter-spacing: normal;
  text-transform: none;
  word-spacing: normal;
}
```

### Fix NetworkView.ts Connection Query (BUGF-03)

```typescript
// BEFORE (buggy -- connections has no deleted_at column):
const sql = `
  SELECT DISTINCT c.id, c.source_id, c.target_id, c.label
  FROM connections c
  WHERE (c.source_id IN (${placeholders}) OR c.target_id IN (${placeholders}))
    AND c.deleted_at IS NULL
`;

// AFTER (fixed -- connections use CASCADE, no soft-delete):
const sql = `
  SELECT DISTINCT c.id, c.source_id, c.target_id, c.label
  FROM connections c
  WHERE (c.source_id IN (${placeholders}) OR c.target_id IN (${placeholders}))
`;
```

### Fix TreeView.ts Connection Query (BUGF-03)

```typescript
// BEFORE (buggy):
const sql = `
  SELECT source_id, target_id, label
  FROM connections
  WHERE (source_id IN (${placeholders}) OR target_id IN (${placeholders}))
    AND label IS NOT NULL
    AND deleted_at IS NULL
`;

// AFTER (fixed):
const sql = `
  SELECT source_id, target_id, label
  FROM connections
  WHERE (source_id IN (${placeholders}) OR target_id IN (${placeholders}))
    AND label IS NOT NULL
`;
```

### E2E SVG Text Assertion Pattern

```typescript
// Assert SVG text has letter-spacing reset
const letterSpacing = await page.evaluate(() => {
  const svgText = document.querySelector('svg text');
  if (!svgText) return null;
  const style = window.getComputedStyle(svgText);
  return style.letterSpacing;
});
// Both 'normal' and '0px' indicate the reset is working
expect(letterSpacing === 'normal' || letterSpacing === '0px').toBe(true);
```

## Detailed Audit Results

### letter-spacing Declarations (6 locations)

All 6 existing `letter-spacing` declarations are on HTML elements (not SVG). They are intentional design choices and should NOT be modified:

| File | Line | Value | Selector | Purpose |
|------|------|-------|----------|---------|
| `latch-explorers.css` | 46 | `0.5px` | `.latch-field-label` | LATCH section header |
| `projection-explorer.css` | 46 | `0.5px` | `.projection-explorer__well-label` | Projection well label |
| `help-overlay.css` | 72 | `0.05em` | `.help-overlay__category` | Help overlay category |
| `command-palette.css` | 73 | `0.05em` | `.command-palette__category` | Command palette category |
| `audit.css` | 262 | `0.5px` | `.audit-legend-label` | Audit legend label |
| `SuperGrid.ts` | 2852 | `0.05em` | inline on `.sg-help-category` | Help overlay category (inline) |

**Consolidation recommendation:** The values cluster into two groups: `0.5px` (3 uses) and `0.05em` (3 uses). These could be consolidated into design tokens (`--letter-spacing-wide: 0.5px` and `--letter-spacing-subtle: 0.05em`), but this is purely cosmetic and discretionary. The SVG bug fix does not depend on consolidation.

### deleted_at Non-SQL Code Path Audit (10 files)

| File | Line(s) | Access Pattern | Status | Action |
|------|---------|----------------|--------|--------|
| `NativeBridge.ts` | 468 | `fields['deleted_at'] ?? null` | SAFE | Already null-coalesced |
| `NativeBridge.ts` | 537 | `{ deleted_at: new Date().toISOString() }` | SAFE | Sets to ISO string (not null access) |
| `NativeBridge.ts` | 542 | `{ deleted_at: null }` | SAFE | Explicit null (undelete) |
| `NativeBridge.ts` | 644 | `(raw['deleted_at'] as string | null) ?? null` | SAFE | Already null-coalesced |
| `inverses.ts` | 89 | `card.deleted_at` | SAFE | Passed as SQL param (null is valid) |
| `inverses.ts` | 134 | `null // deleted_at` | SAFE | Explicit null for new cards |
| `CSVExporter.ts` | 57 | `card.deleted_at ?? ''` | SAFE | Already null-coalesced |
| `JSONExporter.ts` | 42-44 | `...card` (spread) | SAFE | Spread preserves null |
| `MarkdownExporter.ts` | -- | Not accessed | SAFE | Intentionally omits null fields |
| `DedupEngine.ts` | 56 | SQL only: `deleted_at IS NULL` | SAFE | SQL path, not TS access |
| `helpers.ts` | 60 | `(row['deleted_at'] as string | null) ?? null` | SAFE | Already null-coalesced |
| `etl/types.ts` | 87 | Type definition: `deleted_at: string | null` | SAFE | Type is correctly nullable |
| **NetworkView.ts** | **252** | **`c.deleted_at IS NULL` on connections** | **BUG** | **Remove clause -- connections has no deleted_at** |
| **TreeView.ts** | **441** | **`deleted_at IS NULL` on connections** | **BUG** | **Remove clause -- connections has no deleted_at** |

### SVG Text Creation Points (7 files)

These are the files that create SVG `<text>` elements that will benefit from the CSS reset:

| File | Element Created | Purpose |
|------|----------------|---------|
| `BarChart.ts` | `text.notebook-chart-title`, axis tick `<text>` | Chart title, X/Y axis labels |
| `PieChart.ts` | `text.notebook-chart-title` | Chart title |
| `LineChart.ts` | `text.notebook-chart-title`, axis tick `<text>` | Chart title, X/Y axis labels |
| `ScatterChart.ts` | `text.notebook-chart-title`, `text.axis-label`, axis tick `<text>` | Chart title, axis labels, ticks |
| `HistogramScrubber.ts` | X-axis tick `<text>` via `d3.axisBottom()` | Bin labels |
| `NetworkView.ts` | Node label `<text>` | Card name labels |
| `TreeView.ts` | Node label `<text>` | Hierarchy labels |

D3 axis generators (`d3.axisBottom()`, `d3.axisLeft()`) automatically create `<text>` elements for tick labels. These inherit CSS properties from their parent containers.

## Open Questions

1. **E2E Browser Coverage for BUGF-02**
   - What we know: BUGF-02 requires verification across Safari/Chrome/Firefox. Playwright supports all three via `--project` flag.
   - What's unclear: Whether the CI environment has WebKit/Firefox browsers installed. Playwright requires `npx playwright install` for each browser engine.
   - Recommendation: Run SVG text assertions in Chromium only for CI speed. The CSS reset is standards-compliant and browser-agnostic -- `letter-spacing: normal` is universally supported. The bug is about inheritance, not about browser-specific rendering, so fixing the CSS is sufficient across all engines. Document that manual verification was done in Safari (the most affected browser) during development.

2. **NetworkView/TreeView `deleted_at IS NULL` on connections**
   - What we know: SQLite raises "no such column" for `deleted_at` on the `connections` table. This query should fail at runtime.
   - What's unclear: Whether these queries are currently failing silently (Worker might catch the error), or whether they work due to some aliasing. The `db:exec` handler in the Worker catches errors and returns empty results, so the app may be silently dropping all connection data in Network and Tree views.
   - Recommendation: Fix both queries by removing the `deleted_at IS NULL` clause. Add a unit test to verify connections are returned correctly. This is a higher-severity bug than originally scoped -- it may be breaking Network and Tree view edge rendering.

3. **Letter-spacing Design Token Consolidation**
   - What we know: 6 declarations use two value families (0.5px and 0.05em). Both serve the same purpose (section header emphasis).
   - What's unclear: Whether consolidating into design tokens provides value proportional to the change surface area.
   - Recommendation: Keep per-component declarations for now. A design token like `--letter-spacing-label` adds indirection without clear benefit when there are only 6 uses. The SVG reset is the critical fix.

## Sources

### Primary (HIGH confidence)
- **Codebase audit:** `index.html`, `schema.sql`, all 6 CSS files with `letter-spacing`, all chart renderers, `HistogramScrubber.ts`, `NativeBridge.ts`, `inverses.ts`, `DedupEngine.ts`, all 3 exporters, `helpers.ts`, `types.ts`, `NetworkView.ts`, `TreeView.ts`
- **Schema verification:** `src/database/schema.sql` confirms `connections` table has no `deleted_at` column (lines 71-95)

### Secondary (MEDIUM confidence)
- [MDN SVG letter-spacing](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/letter-spacing) -- SVG text inherits CSS letter-spacing from parent elements
- Prior project research: `.planning/research/STACK.md`, `.planning/research/PITFALLS.md`, `.planning/research/FEATURES.md`

### Tertiary (LOW confidence)
- [Cross-browser SVG letter-spacing alternatives](https://codepen.io/aamarks/pen/JdxGxW) -- documents the inheritance issue (single source, CodePen)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, CSS-only fix + 2-line SQL fixes
- Architecture: HIGH -- global CSS reset is the standard pattern for SVG text inheritance issues
- Pitfalls: HIGH -- full codebase audit completed with line-level verification

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable -- CSS and SQL fixes are evergreen)
