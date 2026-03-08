# Technology Stack: v5.0 Designer Workbench

**Project:** Isometry v5.0 Designer Workbench
**Researched:** 2026-03-08
**Confidence:** HIGH -- all recommendations verified against npm registry, GitHub releases, official docs, and existing codebase patterns

---

## Context: Locked Existing Stack (Do Not Re-Research)

| Technology | Version | Status |
|------------|---------|--------|
| TypeScript | 5.9 (strict) | Locked |
| sql.js | 1.14 (custom FTS5 WASM 756KB) | Locked |
| D3.js | v7.9 | Locked |
| Vite | 7.3 | Locked |
| Vitest | 4.0 | Locked |
| Biome | 2.4.6 | Locked |
| fuse.js | 7.1.0 | Locked (added v4.4) |
| Swift | iOS 17+ / macOS 14+ | Locked |
| CSS design tokens | design-tokens.css | Locked |
| ShortcutRegistry / CommandPalette | v4.4 | Locked |

**This document covers ONLY new dependencies and patterns needed for v5.0 Designer Workbench features:**
1. Markdown rendering for NotebookExplorer preview
2. HTML sanitizer for XSS prevention on Markdown output
3. Collapsible section animation pattern
4. Resizable pane implementation for NotebookExplorer
5. CSS layout patterns for panel-heavy workbench shell

---

## Conclusion Up Front

v5.0 requires **TWO new runtime dependencies** (marked + dompurify) totaling ~55kB minified (~18kB gzipped), and **ZERO new dev dependencies**. The collapsible sections, resize handles, and panel layout are all achievable with existing CSS Flexbox + Pointer Events patterns already proven in the codebase (SuperGridSizer, KanbanView DnD).

1. **Markdown Rendering: marked 17.0.4.** The NotebookExplorer needs `textarea input -> Markdown parse -> HTML string`. marked is the correct choice: synchronous `marked.parse()` API, ESM with built-in TypeScript types, ~38kB minified (~12kB gzipped), zero dependencies, 20M+ weekly npm downloads. The synchronous API is critical -- the preview updates on every keystroke (debounced), and an async pipeline would add unnecessary complexity for a session-only textarea.

2. **HTML Sanitizer: dompurify 3.3.2.** The spec mandates `element.innerHTML = sanitize(marked(content))`. DOMPurify is the only battle-tested option: DOM-only (no WASM), ~17kB minified (~6kB gzipped), built-in TypeScript types, 3,800+ dependents. The browser Sanitizer API is NOT ready -- Safari has no implementation timeline (Chrome 146 and Firefox 148 shipped it, but Safari support is absent and the project targets Safari 17+/WKWebView).

3. **Collapsible Sections: CSS `max-height` transition + vanilla TypeScript.** No library needed. The CollapsibleSection primitive uses a measured content height with CSS `transition: max-height var(--transition-normal)` for smooth open/close. The `<details>`/`<summary>` HTML element was considered but rejected: `::details-content` animation requires Safari 18.4+ (project targets Safari 17+), and the existing D3 selection join pattern gives full control over header rendering (chevron rotation, count badges, keyboard handlers) without fighting native disclosure widget constraints.

4. **Resize Handle: Pointer Events + setPointerCapture.** No library needed. The NotebookExplorer horizontal resize bar reuses the exact pattern from `SuperGridSizer.ts`: pointerdown captures, pointermove tracks delta, pointerup releases. This is ~40 lines of TypeScript. A library (split.js ~4kB, allotment ~35kB) would add more code than the implementation.

5. **Panel Layout: CSS Flexbox column, NOT CSS Grid.** The workbench shell is a vertical `flex-direction: column` container. Each CollapsibleSection is a flex child. The Visual Explorer section uses `flex: 1 1 auto` to fill remaining space. CSS Grid is wrong here because the number of rows is dynamic (explorers collapse) and the Visual Explorer must absorb remaining space -- this is flexbox's native behavior.

**Total new dependencies: 2 runtime (~18kB gzipped combined). Zero dev dependencies.**

---

## Recommended Stack

### Core Framework (No Changes)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TypeScript | 5.9 (strict) | All new WorkbenchShell + explorer modules | Existing stack, strict mode enforced by CI |
| D3.js | v7.9 | Data joins for chip lists, property rows | `selection.join()` pattern proven across 9 views |
| CSS custom properties | N/A | All styling via design-tokens.css | Existing token system, scoped under `.workbench-shell` |
| Native HTML5 DnD | Browser built-in | ProjectionExplorer chip DnD | Same pattern as SuperGrid axis DnD (proven) |

### New Runtime Dependencies

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| marked | 17.0.4 | Markdown-to-HTML string conversion for NotebookExplorer preview pane | Synchronous `parse()` API, ESM with `.d.ts` types, zero dependencies, ~38kB min / ~12kB gzip, 20M+ weekly downloads, GFM support built-in |
| dompurify | 3.3.2 | XSS sanitization of marked HTML output before innerHTML injection | DOM-only sanitizer, ~17kB min / ~6kB gzip, built-in TypeScript types, 3,800+ npm dependents, security-audited by cure53 |

### New Modules (No Additional Dependencies)

| Module | File | Lines (est.) | Dependencies |
|--------|------|-------------|-------------|
| WorkbenchShell | `src/ui/WorkbenchShell.ts` | ~150 | Providers, StateCoordinator, explorer modules |
| CollapsibleSection | `src/ui/CollapsibleSection.ts` | ~80 | None (pure DOM) |
| CommandBar | `src/ui/CommandBar.ts` | ~100 | ShortcutRegistry, CommandPalette (existing) |
| PropertiesExplorer | `src/ui/PropertiesExplorer.ts` | ~200 | PAFVProvider, StateCoordinator |
| ProjectionExplorer | `src/ui/ProjectionExplorer.ts` | ~250 | PAFVProvider, DensityProvider, AuditState, StateCoordinator |
| LatchExplorers | `src/ui/LatchExplorers.ts` | ~150 | FilterProvider, StateCoordinator |
| NotebookExplorer | `src/ui/NotebookExplorer.ts` | ~180 | marked, dompurify (session-only state) |

### New CSS Files

| File | Purpose | Scoping |
|------|---------|---------|
| `src/styles/workbench-shell.css` | Shell layout, command bar, panel rail, view content | All selectors under `.workbench-shell` |
| `src/styles/explorers.css` | Explorer panels, collapsible sections, notebook panes, resize handle | All selectors under `.explorer-*` or `.collapsible-section*` |

---

## Detailed Technology Decisions

### 1. Markdown Rendering -- marked 17.0.4

**Why marked over alternatives:**

| Criterion | marked 17.0.4 | markdown-it 14.1.1 | micromark |
|-----------|---------------|--------------------|-----------|
| Unpacked size (npm) | 444kB | 768kB | ~120kB (core only) |
| Estimated min+gzip | ~12kB | ~35kB | ~6kB |
| Synchronous API | `marked.parse(md)` | `md.render(src)` | `micromark(md)` |
| TypeScript types | Built-in `.d.ts` | Needs `@types/markdown-it` | Built-in |
| GFM (tables, strikethrough) | Built-in | Plugin required | Plugin required |
| Plugin ecosystem | Extensions via `marked.use()` | Rich plugin system | AST-level plugins |
| Weekly downloads | 20M+ | 12M+ | 18M+ |
| API complexity | Minimal (1 function) | Moderate (renderer, plugins) | Low-level (AST tokens) |

**Decision: marked.** The NotebookExplorer v1 needs exactly one thing: `string -> HTML string`. marked's `marked.parse(markdown)` is the simplest possible API. markdown-it is nearly 2x the bundle for plugin flexibility that NotebookExplorer v1 does not need (no syntax highlighting, no custom blocks, no LaTeX). micromark is smaller but outputs raw HTML without GFM support unless you add plugins, which erases the size advantage.

**Usage pattern in NotebookExplorer:**

```typescript
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure once at module scope
marked.setOptions({
  gfm: true,        // GitHub Flavored Markdown (tables, strikethrough)
  breaks: true,     // Convert \n to <br> (matches textarea behavior)
});

// On textarea input (debounced ~300ms):
function renderPreview(markdown: string, previewEl: HTMLElement): void {
  const rawHtml = marked.parse(markdown) as string;
  previewEl.innerHTML = DOMPurify.sanitize(rawHtml);
}
```

**Confidence:** HIGH -- marked 17.0.4 verified on npm registry (published 2026-03-04), ESM entry confirmed (`lib/marked.esm.js`), TypeScript types confirmed (`lib/marked.d.ts`), synchronous API confirmed via GitHub README.

### 2. HTML Sanitizer -- DOMPurify 3.3.2

**Why DOMPurify and not the browser Sanitizer API:**

| Criterion | DOMPurify 3.3.2 | Browser Sanitizer API |
|-----------|-----------------|----------------------|
| Safari 17+ support | YES (uses native DOM APIs) | NO -- Safari has no implementation; only "positive position" with no timeline |
| Chrome support | YES (polyfill-free) | Chrome 146+ only (Feb 2026) |
| Firefox support | YES (polyfill-free) | Firefox 148+ only (Feb 2026) |
| WKWebView compat | YES (uses window.document) | Unknown -- not tested in WKWebView context |
| Security track record | Audited by cure53 (library authors are pentesters) | New API, no production track record |
| Configuration | Rich: ALLOWED_TAGS, ALLOWED_ATTR, hooks | Basic: allowElements, blockElements |

**Decision: DOMPurify.** The Sanitizer API is too new and lacks Safari support entirely. Since Isometry targets iOS 17+ (Safari 17+), DOMPurify is the only viable option. The spec explicitly states "Use an existing or minimal sanitizer dependency; do not roll a custom one" (D3-UI-IMPLEMENTATION-SPEC-V2.md, section 5.1).

**Configuration for NotebookExplorer:**

```typescript
import DOMPurify from 'dompurify';

// Restrictive config -- no scripts, no forms, no iframes
const SANITIZE_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'ul', 'ol', 'li',
    'strong', 'em', 'del', 'code', 'pre',
    'blockquote',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
  ALLOW_DATA_ATTR: false,
};

previewEl.innerHTML = DOMPurify.sanitize(rawHtml, SANITIZE_CONFIG);
```

**Vitest compatibility:** DOMPurify requires a DOM environment. The project uses `environment: 'node'` globally but applies `// @vitest-environment jsdom` per-file for DOM-dependent tests (ErrorBanner, ImportToast, HelpOverlay, etc. -- 31 test files use this pattern). DOMPurify works with jsdom 28+ (project already uses jsdom 28.1.0). **Critical: do NOT use happy-dom** -- DOMPurify's maintainers explicitly warn that happy-dom has known XSS bypasses.

**Confidence:** HIGH -- dompurify 3.3.2 verified on npm registry, TypeScript types confirmed (`dist/purify.cjs.d.ts`), jsdom compatibility confirmed by DOMPurify README.

### 3. Collapsible Section Animation -- CSS max-height Transition

**Why NOT `<details>`/`<summary>` native elements:**

| Criterion | `<details>` native | CSS max-height + TypeScript |
|-----------|--------------------|-----------------------------|
| Safari 17 animation support | NO -- `::details-content` requires Safari 18.4+ | YES -- max-height transition works everywhere |
| Custom header rendering | Limited -- `<summary>` content restrictions | Full control -- D3 selection, chevron SVG, count badges, keyboard handlers |
| Programmatic open/close | `open` attribute toggle (no animation without `::details-content`) | `setCollapsed(boolean)` with animated transition |
| ARIA semantics | Built-in `aria-expanded` | Manual `aria-expanded` on header button (trivial) |
| Nested content control | Fixed slot model | Full DOM ownership |

**Decision: CSS max-height transition.** The `<details>` element would work without animation -- just a jump cut on Safari 17. The max-height approach gives smooth animation on all target browsers and full control over the header layout (title + count badge + chevron + keyboard handler).

**Implementation pattern:**

```typescript
// CollapsibleSection.ts
private _toggle(): void {
  this._collapsed = !this._collapsed;
  this._headerEl.setAttribute('aria-expanded', String(!this._collapsed));

  if (this._collapsed) {
    // Collapse: set max-height to current scrollHeight, then on next frame to 0
    this._bodyEl.style.maxHeight = `${this._bodyEl.scrollHeight}px`;
    requestAnimationFrame(() => {
      this._bodyEl.style.maxHeight = '0';
    });
  } else {
    // Expand: set max-height to scrollHeight, then clear on transitionend
    this._bodyEl.style.maxHeight = `${this._bodyEl.scrollHeight}px`;
    this._bodyEl.addEventListener('transitionend', () => {
      this._bodyEl.style.maxHeight = '';  // Allow natural sizing
    }, { once: true });
  }
}
```

```css
.collapsible-section__body {
  overflow: hidden;
  transition: max-height var(--transition-normal) ease-out;
}

.collapsible-section__header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  cursor: pointer;
  user-select: none;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-subtle);
}

.collapsible-section__chevron {
  transition: transform var(--transition-fast);
}

.collapsible-section--collapsed .collapsible-section__chevron {
  transform: rotate(-90deg);
}
```

**Confidence:** HIGH -- CSS max-height transition is universally supported; existing codebase already uses CSS transitions (theme 200ms, FLIP 200ms, SuperGrid density transitions).

### 4. Resize Handle -- Pointer Events (Existing Pattern)

**Why NOT a library:**

| Criterion | Pointer Events (custom) | split.js | allotment |
|-----------|------------------------|----------|-----------|
| Bundle size | 0kB (built-in API) | ~4kB min | ~35kB min |
| TypeScript types | N/A (Web API) | `@types/split.js` needed | React-only |
| Touch support | Built-in via Pointer Events | Separate touch handling | React dependency |
| Lines of code | ~40 | N/A | N/A |

**Decision: Pointer Events.** The SuperGridSizer (`src/views/supergrid/SuperGridSizer.ts`) already implements the exact drag pattern: `pointerdown -> setPointerCapture -> pointermove (track delta) -> pointerup (release)`. The NotebookExplorer resize handle is simpler (single horizontal divider, no Shift+drag). Bringing in split.js for 40 lines of code adds a dependency that must be tracked, versioned, and audited.

**Implementation pattern (mirrors SuperGridSizer):**

```typescript
private _initResize(handleEl: HTMLElement): void {
  let startX = 0;
  let startLeftWidth = 0;

  handleEl.addEventListener('pointerdown', (e: PointerEvent) => {
    e.preventDefault();
    handleEl.setPointerCapture(e.pointerId);
    startX = e.clientX;
    startLeftWidth = this._textareaPane.getBoundingClientRect().width;
    handleEl.classList.add('resizing');
  });

  handleEl.addEventListener('pointermove', (e: PointerEvent) => {
    if (!handleEl.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - startX;
    const containerW = this._container.getBoundingClientRect().width;
    const newWidth = Math.max(120, Math.min(startLeftWidth + dx, containerW - 120));
    this._textareaPane.style.width = `${newWidth}px`;
  });

  handleEl.addEventListener('pointerup', (e: PointerEvent) => {
    handleEl.releasePointerCapture(e.pointerId);
    handleEl.classList.remove('resizing');
  });
}
```

```css
.notebook-resize-handle {
  width: 6px;
  cursor: col-resize;
  background: var(--border-subtle);
  flex-shrink: 0;
  transition: background var(--transition-fast);
}

.notebook-resize-handle:hover,
.notebook-resize-handle.resizing {
  background: var(--accent);
}
```

**Confidence:** HIGH -- Pointer Events API universally supported; pattern proven in SuperGridSizer.ts with passing tests.

### 5. Panel Layout -- CSS Flexbox Column

**Why Flexbox over CSS Grid:**

| Criterion | Flexbox column | CSS Grid |
|-----------|----------------|----------|
| Dynamic row count | Native -- collapsed sections shrink, flex reflows | Requires `grid-template-rows` recalculation on toggle |
| Fill-remaining space | `flex: 1 1 auto` on Visual Explorer | `1fr` works but all rows must be declared in template |
| Overflow scrolling | `overflow-y: auto` on panel rail | Same, but grid items need `min-height: 0` explicitly |
| Existing codebase pattern | Flexbox used for toolbar, toast layouts | Grid used for SuperGrid data cells (different context) |

**Decision: Flexbox.** The workbench shell is a simple vertical stack where one section (Visual Explorer) fills remaining space. CSS Grid is the right tool for SuperGrid's 2D cell matrix but overkill for a 1D panel stack with dynamic row count.

**Layout structure:**

```css
.workbench-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.workbench-command-bar {
  flex: 0 0 auto;   /* Fixed height */
}

.workbench-panel-rail {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;   /* Size to content */
  overflow-y: auto;  /* Scrolls if panels exceed viewport */
  min-height: 0;     /* Prevents flex child overflow */
}

.workbench-view-content {
  flex: 1 1 auto;   /* Visual Explorer fills remaining space */
  overflow: hidden;  /* SuperGrid manages its own scroll */
  min-height: 200px; /* Minimum visible area for SuperGrid */
}
```

**Critical constraint from spec:** `.workbench-view-content` must have `overflow: hidden` and a defined height (via flex). SuperGrid's sticky headers depend on the container NOT scrolling -- SuperGrid owns its own CSS Grid scroll context.

**Selector scoping rule (spec section 7.2):** All selectors in new CSS files must be scoped under `.workbench-shell` or a child class. No bare element selectors. This prevents bleed into SuperGrid's CSS Grid layout.

**box-sizing guard (spec section 7.2):** Do NOT add `* { box-sizing: border-box }`. If needed, scope to `.workbench-shell *`.

**Confidence:** HIGH -- Flexbox column layout universally supported; spec explicitly prescribes this DOM hierarchy (section 4.1.1).

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Markdown parser | marked 17.0.4 | markdown-it 14.1.1 | 768kB unpacked vs 444kB; plugin system adds complexity v1 does not need; GFM requires separate plugin |
| Markdown parser | marked 17.0.4 | micromark | Smaller core but GFM requires additional packages; lower-level AST API adds integration code |
| Markdown parser | marked 17.0.4 | showdown | 540kB unpacked; fewer weekly downloads; last major release less recent |
| Markdown parser | marked 17.0.4 | Custom regex (~50 LOC) | Fragile for GFM tables/strikethrough; edge cases in link/image parsing; not worth reinventing |
| HTML sanitizer | dompurify 3.3.2 | Browser Sanitizer API | Safari has no implementation; project targets Safari 17+/WKWebView |
| HTML sanitizer | dompurify 3.3.2 | sanitize-html | 4x larger bundle (~67kB min); designed for server-side Node.js; requires htmlparser2 |
| HTML sanitizer | dompurify 3.3.2 | Custom regex sanitizer | Spec forbids: "do not roll a custom one" (section 5.1); known XSS bypass vectors |
| Collapsible animation | CSS max-height | `<details>`/`<summary>` | `::details-content` animation requires Safari 18.4+; limited header customization |
| Collapsible animation | CSS max-height | WAAPI (Web Animations API) | Possible but more complex; max-height transition is simpler for disclosure panels |
| Resize handle | Pointer Events | split.js (~4kB) | Dependency for ~40 lines of code; project has the pattern in SuperGridSizer already |
| Resize handle | Pointer Events | CSS `resize: horizontal` | Only works with `overflow: auto/scroll`; no min/max control; poor UX |
| Panel layout | Flexbox column | CSS Grid | Grid requires explicit row template; flexbox handles dynamic collapse natively |
| UI framework | Plain TypeScript + D3/DOM | React/Preact for explorers | Locked constraint; two rendering paradigms in one app is architectural debt |
| DnD library | Native HTML5 DnD | dnd-kit, Sortable.js | SuperGrid DnD is native HTML5; consistency over library features |
| State management | Existing providers | MobX, Zustand, Signals | Locked constraint: D3 data join IS state management |

---

## What NOT to Add (Avoid Bloat)

| Temptation | Why Avoid | Existing Alternative |
|-----------|-----------|---------------------|
| react-markdown | React dependency -- project constraint forbids React | marked + DOMPurify for raw HTML string |
| split.js / allotment | 4-35kB for a 40-line Pointer Events implementation | SuperGridSizer pattern |
| highlight.js / prism.js | ~30-200kB for code syntax highlighting | Deferred to Phase B polish; not in v1 scope |
| turndown (HTML-to-Markdown) | Reverse conversion not needed | Textarea IS the source of truth |
| prosemirror / tiptap | Rich text editor framework | v1 is textarea only per spec (no contenteditable) |
| @shoelace-style/shoelace | Web component library with panels | CollapsibleSection is ~80 lines; a library is massive overhead |
| anime.js / motion | CSS transitions handle all animation needs | `transition: max-height var(--transition-normal)` |
| happy-dom (test env) | DOMPurify warns: "happy-dom has known XSS bypasses" | jsdom 28+ (already installed) |
| Any React/Vue/Svelte library | Project constraint: no framework | Vanilla TypeScript + DOM APIs |

---

## Installation

```bash
# TWO new runtime dependencies
npm install marked@^17.0.4 dompurify@^3.3.2

# No new dev dependencies -- both ship TypeScript types
# jsdom 28.1.0 already installed (DOMPurify test compat)
```

**Resulting dependency count:**
- Runtime: 6 -> 8 (d3, gray-matter, papaparse, sql.js, xlsx, fuse.js, **marked**, **dompurify**)
- Dev: unchanged at 11

**Bundle size impact:**
- marked: ~38kB minified, ~12kB gzipped
- dompurify: ~17kB minified, ~6kB gzipped
- Combined: ~55kB minified, ~18kB gzipped
- For context: sql.js WASM is 756kB; xlsx/SheetJS is ~1MB (dynamic import)
- These two libraries add ~2.4% to the current total bundle

---

## Integration Points with Existing Systems

### Vite Build Integration
Both `marked` and `dompurify` are ESM-compatible. Vite 7.3's esbuild pre-bundling handles them automatically (same as d3, fuse.js). No Vite config changes needed. Both libraries are tree-shakable.

### Vitest Test Integration
NotebookExplorer tests use `// @vitest-environment jsdom` per-file directive (existing pattern -- 31 test files already use this). DOMPurify works with jsdom 28+. marked works in any environment (pure string output).

### CSS Design Token Integration
All new CSS references existing tokens only. Token mapping (Figma Make to Isometry) defined in spec section 7.1. No new tokens needed.

### Existing DnD Pattern Reuse
ProjectionExplorer uses the same `dragstart`/`dragover`/`drop` native event pattern and `data-drag-payload` dataset attribute convention as KanbanView and SuperGrid column reorder (spec section 5.3.1).

### StateCoordinator Integration
All explorer modules follow: update provider -> `stateCoordinator.scheduleUpdate()` (spec section 6). No new state patterns. Provider references passed via constructor injection.

### CSS Import Order (spec section 7.2)

```
design-tokens.css       (first -- variables)
accessibility.css
views.css
supergrid.css
workbench-shell.css     (after existing, before explorers)
explorers.css           (last)
```

No changes to existing CSS files. New files are additive only.

---

## Browser / Platform Compatibility

| Feature | Safari 17.0+ | Safari 18.0+ | Safari 18.4+ |
|---------|-------------|-------------|--------------|
| `marked.parse()` (pure JS) | YES | YES | YES |
| `DOMPurify.sanitize()` (DOM APIs) | YES | YES | YES |
| CSS `max-height` transition | YES | YES | YES |
| CSS Flexbox column | YES | YES | YES |
| Pointer Events + setPointerCapture | YES | YES | YES |
| `::details-content` (animated details) | NO | NO | YES |
| Browser Sanitizer API | NO | NO | NO |

All recommended technologies work on all target browsers. No progressive enhancement fallbacks needed.

---

## Sources

### Markdown Rendering
- [marked npm](https://www.npmjs.com/package/marked) -- v17.0.4, 20M+ weekly downloads, 444kB unpacked
- [marked GitHub releases](https://github.com/markedjs/marked/releases) -- v17.0.4 (2026-03-04, ReDoS fix)
- [marked GitHub](https://github.com/markedjs/marked) -- ESM entry (`lib/marked.esm.js`), TypeScript types (`lib/marked.d.ts`)
- [npm trends: markdown-it vs marked vs micromark](https://npmtrends.com/markdown-it-vs-marked-vs-micromark-vs-showdown) -- download comparison

### HTML Sanitization
- [DOMPurify npm](https://www.npmjs.com/package/dompurify) -- v3.3.2, 3,800+ dependents
- [DOMPurify GitHub](https://github.com/cure53/DOMPurify) -- jsdom compat documented, happy-dom warning
- [Sanitizer API Can I Use](https://caniuse.com/mdn-api_sanitizer) -- Safari: no implementation
- [Sanitizer API Chrome status](https://chromestatus.com/feature/5786893650231296) -- Chrome 146+
- [DOMPurify official site](https://dompurify.com/) -- cure53 security audit

### Collapsible Sections
- [MDN: details element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details)
- [WebKit: Safari 18.4 features](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/) -- `::details-content` added
- [Can I Use: ::details-content](https://caniuse.com/mdn-css_selectors_details-content) -- browser support

### Resize Handle
- [MDN: Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- Existing codebase: `src/views/supergrid/SuperGridSizer.ts` -- proven Pointer Events drag pattern

### Panel Layout
- [CSS-Tricks: Flexbox guide](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
- [Every Layout: Sidebar](https://every-layout.dev/layouts/sidebar/)
- [D3-UI-IMPLEMENTATION-SPEC-V2.md](docs/D3-UI-IMPLEMENTATION-SPEC-V2.md) -- DOM hierarchy (section 4.1.1), CSS rules (section 7.2)
