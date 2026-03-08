# Phase 50: Accessibility - Research

**Researched:** 2026-03-08
**Domain:** WCAG 2.1 AA accessibility -- screen readers, keyboard navigation, contrast, reduced motion
**Confidence:** HIGH

## Summary

Phase 50 adds WCAG 2.1 AA accessibility to Isometry's 9 views, toolbar, SuperGrid, and import/filter flows. The codebase already has partial accessibility infrastructure: `aria-live="polite"` on ActionToast and ImportToast, `:focus-visible` CSS rules for 15+ selectors, and CSS custom property design tokens that can be audited for contrast ratios. The main work is: (1) adding ARIA landmarks and SVG roles/labels, (2) implementing composite widget keyboard navigation (Tab into view, arrows within, Escape out), (3) auditing and fixing all color token pairs for WCAG AA contrast, (4) adding `prefers-reduced-motion` guards to all D3 transitions and CSS animations, and (5) making the command palette (A11Y-11, future Phase 51) follow WAI-ARIA combobox pattern.

The existing `ThemeProvider` pattern for `prefers-color-scheme` matchMedia detection directly maps to `prefers-reduced-motion` detection. The centralized `transitions.ts` file (morphTransition + crossfadeTransition) provides a single choke point for duration overrides. SuperGrid builds DOM via `document.createElement`, so ARIA table roles can be added at creation time without changing rendering architecture.

**Primary recommendation:** Layer accessibility onto existing code via ARIA attributes on existing elements and a centralized MotionProvider + Announcer service -- no architectural changes needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Summary-level announcements when landing on SVG views: "Network view, 42 cards" -- concise orientation, not verbose
- Individual SVG cards ARE reachable by screen readers (SVG `<title>` + role pattern) -- each card reads its title/source/date
- SuperGrid uses ARIA table/grid roles -- VoiceOver announces "Row 3, Column: Status, Value: In Progress" with full structural context
- Single persistent `aria-live="polite"` region for ALL announcements: view switches, filter changes, import completions -- messages queue, no overlap
- Existing ActionToast and ImportToast already have `aria-live="polite"` -- extend this pattern to a centralized announcer
- Tab into view container, then arrow keys navigate between cards -- Escape exits back to toolbar (composite widget pattern)
- Network view arrow keys use spatial nearest-neighbor logic -- NOT connection-based graph traversal
- Visual focus indicator: 2px solid accent-color ring (var(--accent), 2px offset) -- matches existing focus-visible CSS pattern
- Toolbar acts as grouped Tab stop with arrow key internal navigation: skip-link -> toolbar (arrows between buttons) -> view content -- minimal Tab presses to reach content
- Enter/Space activates focused elements throughout
- Fix existing design token values in-place so ALL colors pass WCAG 2.1 AA (4.5:1 text, 3:1 UI components) -- no separate high-contrast mode, accessible by default
- Source provenance pastels adjusted per-shade to pass 4.5:1 against their backgrounds while keeping hue family recognizable
- Automated contrast-ratio tests verify every token pair (text-on-bg, accent-on-bg, source-on-bg) -- prevents regression
- Audit overlay uses shape+color: + for new, ~ for modified, x for deleted -- never rely on color alone for differentiation
- All D3 transitions snap to 0ms when `prefers-reduced-motion: reduce` is active -- morphTransition, crossfadeTransition, and CSS transitions all instant
- Force-directed network simulation pre-computes to equilibrium (tick loop in Worker), then renders final positions in one frame -- no visible animation
- Detection: CSS `@media (prefers-reduced-motion: reduce)` for CSS transitions + JS `matchMedia('(prefers-reduced-motion: reduce)')` for D3 duration control -- complete coverage
- OS setting only -- no in-app "Reduce Motion" toggle

### Claude's Discretion
- Exact ARIA landmark structure (which elements get role="main", role="navigation", etc.)
- Skip-to-content link positioning and styling (visually hidden until focused)
- How to handle keyboard focus when view switches (auto-focus first card? announce and wait?)
- Whether TreeView expand/collapse should use Enter or arrow-right/left convention
- CSS utility class naming for screen-reader-only text (.sr-only vs .visually-hidden)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| A11Y-01 | All text meets WCAG 2.1 AA contrast ratio (4.5:1 normal, 3:1 large) in both themes | Contrast calculation formula, token audit approach, automated test pattern |
| A11Y-02 | All non-text UI elements (borders, icons, focus indicators) meet 3:1 contrast ratio | Same contrast formula, applied to border/icon token pairs |
| A11Y-03 | All SVG view roots have role="img" with descriptive aria-label (view name + card count) | SVG accessibility patterns, role="img" + aria-label best practice |
| A11Y-04 | SuperGrid uses role="table" with aria-rowcount/aria-colcount for screen reader structure | ARIA table pattern applied to CSS Grid DOM structure |
| A11Y-05 | Toolbar, sidebar, and main content have ARIA landmark roles | Standard landmark pattern (role="navigation", role="main") |
| A11Y-06 | Skip-to-content link allows keyboard users to bypass toolbar | .sr-only CSS class, first-child anchor pattern |
| A11Y-07 | aria-live="polite" region announces view switches, filter changes, import completion | Centralized Announcer class extending existing toast pattern |
| A11Y-08 | :focus-visible indicators on all interactive elements including SVG nodes and toolbar buttons | Extend existing CSS rules, add SVG circle/rect outline |
| A11Y-09 | Tree nodes expand/collapse via Enter/Space keyboard, Network nodes selectable via Tab+Enter | Composite widget pattern with arrow key navigation |
| A11Y-10 | prefers-reduced-motion disables D3 transitions, SVG morphs, and crossfade animations | MotionProvider with matchMedia, centralized duration override |
| A11Y-11 | Command palette follows WAI-ARIA combobox pattern with aria-expanded, aria-activedescendant | WAI-ARIA combobox pattern -- NOTE: command palette is Phase 51, this requirement prepares the ARIA contract |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (no new libraries) | -- | All accessibility is native HTML/ARIA/CSS | WCAG compliance uses platform primitives, not libraries |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| WCAG contrast formula (inline) | Calculate relative luminance + contrast ratio | Automated test assertions for token pairs |
| `window.matchMedia` | Detect `prefers-reduced-motion: reduce` | JS-side animation disable |
| CSS `@media (prefers-reduced-motion: reduce)` | CSS-side animation disable | Spinner, theme transitions, help overlay fade |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled contrast calc | `color-contrast()` CSS function | CSS Color Level 5 -- not yet in Safari; hand-roll is fine for tests |
| axe-core for automated a11y testing | Manual + unit tests | axe-core is 200KB+ runtime; unit tests with WCAG formula are lighter and sufficient for token pair validation |

**Installation:**
```bash
# No new packages needed -- all native APIs
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  accessibility/
    Announcer.ts          # Centralized aria-live announcer
    MotionProvider.ts     # prefers-reduced-motion detection + subscribe
    contrast.ts           # WCAG contrast ratio calculation (for tests)
    index.ts              # barrel export
  styles/
    design-tokens.css     # MODIFIED: contrast-adjusted token values
    views.css             # MODIFIED: extended focus-visible, skip-link, sr-only
    accessibility.css     # NEW: reduced-motion overrides, sr-only, skip-link
tests/
  accessibility/
    contrast.test.ts      # Token pair contrast ratio assertions
    announcer.test.ts     # Announcer message queueing
    motion.test.ts        # MotionProvider matchMedia mock tests
```

### Pattern 1: Centralized Announcer
**What:** Single `aria-live="polite"` region that all components use for screen reader announcements
**When to use:** View switches, filter changes, import completions, sort changes
**Example:**
```typescript
// Source: WAI-ARIA live regions best practice
export class Announcer {
  private el: HTMLDivElement;
  private queue: string[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'sr-only';
    this.el.setAttribute('aria-live', 'polite');
    this.el.setAttribute('aria-atomic', 'true');
    container.appendChild(this.el);
  }

  announce(message: string): void {
    // Clear previous, set new (aria-atomic ensures full re-read)
    this.el.textContent = '';
    // RAF delay ensures DOM mutation is detected by screen readers
    requestAnimationFrame(() => {
      this.el.textContent = message;
    });
  }

  destroy(): void {
    this.el.remove();
  }
}
```

### Pattern 2: MotionProvider (mirrors ThemeProvider)
**What:** Detects `prefers-reduced-motion: reduce` via matchMedia, exposes `prefersReducedMotion` boolean, notifies subscribers on change
**When to use:** All D3 transitions, CSS animations, force simulation
**Example:**
```typescript
// Source: W3C SCR40 technique + existing ThemeProvider pattern
export class MotionProvider {
  private _reducedMotion: boolean;
  private _subscribers: Set<() => void> = new Set();
  private _mediaQuery: MediaQueryList;
  private _onChange: () => void;

  constructor() {
    this._mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this._reducedMotion = this._mediaQuery.matches;
    this._onChange = () => {
      this._reducedMotion = this._mediaQuery.matches;
      for (const cb of this._subscribers) cb();
    };
    this._mediaQuery.addEventListener('change', this._onChange);
  }

  get prefersReducedMotion(): boolean {
    return this._reducedMotion;
  }

  subscribe(cb: () => void): () => void {
    this._subscribers.add(cb);
    return () => this._subscribers.delete(cb);
  }

  destroy(): void {
    this._mediaQuery.removeEventListener('change', this._onChange);
  }
}
```

### Pattern 3: Composite Widget Keyboard Navigation
**What:** Tab stops the view container, arrow keys navigate between items, Escape exits to toolbar
**When to use:** All 9 views -- SVG card navigation, SuperGrid cell navigation
**Example:**
```typescript
// Source: WAI-ARIA composite widget pattern
// View container gets tabindex="0" and role
// Arrow key handler uses spatial nearest-neighbor for NetworkView
// or index-based for ListView/GridView
container.setAttribute('tabindex', '0');
container.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    // Return focus to toolbar
    toolbar.focus();
    return;
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
    const next = findNextFocusable(currentIndex, e.key, items);
    setFocusedItem(next);
  }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    activateItem(currentIndex);
  }
});
```

### Pattern 4: SVG Accessibility via title + role
**What:** SVG root gets `role="img"` + `aria-label`; individual cards get `<title>` child elements
**When to use:** All SVG-based views (list, grid, timeline, network, tree)
**Example:**
```typescript
// Source: MDN ARIA img role + Deque accessible SVGs guide
svg.attr('role', 'img')
   .attr('aria-label', `Network view, ${cards.length} cards`);

// Per-card title for screen reader access
g.selectAll('title')
  .data([d])
  .join('title')
  .text(d => `${d.name}, ${d.card_type}, ${d.source ?? 'unknown source'}`);
```

### Pattern 5: Skip-to-Content Link
**What:** Visually hidden anchor as first focusable element, becomes visible on focus
**When to use:** First element in `<body>`, targets `#main-content`
**Example:**
```html
<a href="#main-content" class="sr-only sr-only--focusable">Skip to content</a>
```
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.sr-only--focusable:focus {
  position: fixed;
  top: var(--space-sm);
  left: var(--space-sm);
  width: auto;
  height: auto;
  padding: var(--space-xs) var(--space-sm);
  margin: 0;
  overflow: visible;
  clip: auto;
  white-space: normal;
  background: var(--bg-card);
  color: var(--accent);
  border: 2px solid var(--accent);
  border-radius: var(--radius-sm);
  z-index: 10000;
  font-size: var(--text-md);
}
```

### Pattern 6: ARIA Table on SuperGrid
**What:** CSS Grid DOM gets `role="table"`, rows get `role="row"`, cells get `role="cell"` or `role="columnheader"`/`role="rowheader"`
**When to use:** SuperGrid's `_renderCells()` method
**Example:**
```typescript
// Source: WAI-ARIA table pattern
// On grid container:
grid.setAttribute('role', 'table');
grid.setAttribute('aria-rowcount', String(leafRowCells.length));
grid.setAttribute('aria-colcount', String(leafColKeys.length));

// On header cells:
headerEl.setAttribute('role', 'columnheader');
headerEl.setAttribute('aria-colindex', String(colIdx + 1));

// On data cells:
cellEl.setAttribute('role', 'cell');
cellEl.setAttribute('aria-rowindex', String(rowIdx + 1));
cellEl.setAttribute('aria-colindex', String(colIdx + 1));

// On row header cells:
rowHeaderEl.setAttribute('role', 'rowheader');
```

### Anti-Patterns to Avoid
- **aria-live on every toast:** Don't create multiple live regions -- one centralized Announcer prevents announcement conflicts
- **tabindex on every SVG element:** Don't add tabindex to individual cards -- use composite widget pattern (one tabindex="0" on container, manage focus internally via aria-activedescendant or visual indicator)
- **role="grid" on SuperGrid:** Don't use role="grid" -- it implies full cell-level keyboard navigation which is extremely complex with virtual scrolling. role="table" is correct per REQUIREMENTS.md Out of Scope
- **Disabling animations via CSS only:** CSS `@media (prefers-reduced-motion)` cannot control D3 `.transition().duration()` calls -- MUST also have JS detection
- **Color-only differentiation:** Never use color as the sole indicator -- audit overlay already decided on shape+color (+ ~ x)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Contrast ratio calculation | Full color manipulation library | 15-line WCAG formula (sRGB linearization + luminance + ratio) | Formula is simple, stable, and well-specified by W3C |
| Screen reader testing | Custom AT bridge | Manual VoiceOver testing + automated ARIA attribute assertions | VoiceOver behavior in WKWebView differs from Safari -- must test manually |
| Focus trap for modals | Custom focus cycling | CSS + tabindex + keydown handler | Existing help overlay already works; skip-link + Escape pattern is sufficient |
| Reduced motion detection | Polling or manual toggle | `matchMedia('(prefers-reduced-motion: reduce)')` with `change` event | Native API, already pattern-proven in ThemeProvider |

**Key insight:** Accessibility is about correct semantic markup and proper ARIA attributes, not additional libraries. The W3C patterns are well-specified and the codebase already follows them partially.

## Common Pitfalls

### Pitfall 1: aria-live Region Timing
**What goes wrong:** Screen reader doesn't announce content because textContent was set synchronously without a clearing step
**Why it happens:** `aria-live` regions only announce changes. If you set the same text twice, the second set is not announced. If you set text without first clearing, fast sequential updates merge.
**How to avoid:** Clear textContent to empty string, then set new text in the next animation frame (`requestAnimationFrame`). The Announcer pattern above handles this.
**Warning signs:** VoiceOver reads only the first announcement, subsequent ones are silent.

### Pitfall 2: SVG role="img" Black Box Effect
**What goes wrong:** Screen reader treats entire SVG as one image, individual cards are inaccessible
**Why it happens:** `role="img"` on SVG root tells assistive tech to treat it as a single graphic. Children are not individually navigable.
**How to avoid:** Use `role="img"` + `aria-label` on SVG root for the summary announcement. For individual card access, add `<title>` elements to `<g>` groups AND make the SVG root focusable. The composite widget keyboard pattern handles individual card navigation separately from the role="img" summary.
**Warning signs:** VoiceOver reads "Network view, 42 cards" but Tab does not reach individual cards.

### Pitfall 3: Focus Loss on View Switch
**What goes wrong:** After switching views (Cmd+1-9), keyboard focus lands on `<body>` instead of the new view
**Why it happens:** ViewManager destroys old DOM and creates new DOM. The previously-focused element is removed.
**How to avoid:** After `switchTo()` completes, move focus to the new view's container element. The Announcer should also announce the new view ("Switched to Network view, 42 cards").
**Warning signs:** After Cmd+2, user must Tab through all toolbar buttons again to reach grid content.

### Pitfall 4: WKWebView VoiceOver Differences
**What goes wrong:** ARIA attributes that work in Safari don't work in WKWebView
**Why it happens:** WKWebView has a different VoiceOver integration path. Some ARIA features behave differently (known blocker in STATE.md).
**How to avoid:** Manual testing in both Safari (web) and WKWebView (native app). Focus on testing role="table", aria-live, and focus management specifically in the native shell.
**Warning signs:** Accessibility works in `npm run dev` but fails in Xcode simulator.

### Pitfall 5: Contrast Ratio Calculation with CSS Variables
**What goes wrong:** Automated tests can't extract computed color values from CSS custom properties at test time
**Why it happens:** Vitest runs in jsdom/happy-dom without a real browser. CSS custom properties don't compute.
**How to avoid:** Test against raw hex/rgba values defined in design-tokens.css, not computed styles. Parse the CSS file statically to extract token values, then apply the WCAG contrast formula.
**Warning signs:** `getComputedStyle().getPropertyValue('--text-primary')` returns empty string in tests.

### Pitfall 6: Reduced Motion Not Covering All Animation Paths
**What goes wrong:** Some animations still play with reduced motion enabled
**Why it happens:** D3 transitions are set in multiple places (morphTransition, crossfadeTransition, ListView render enter transition, NetworkView). CSS animations include spinner, theme transitions, help-overlay fade.
**How to avoid:** Audit ALL animation paths systematically. CSS side: `@media (prefers-reduced-motion: reduce)` with `transition: none !important; animation: none !important;`. JS side: MotionProvider checked at every `.duration()` call site.
**Warning signs:** Spinner still spins, or view crossfade still animates, with reduced motion enabled.

## Code Examples

Verified patterns from the existing codebase and official sources:

### WCAG Contrast Ratio Calculation
```typescript
// Source: W3C WCAG 2.1 relative luminance formula
// https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html

/** Parse hex color (#RRGGBB or #RGB) to [r, g, b] in 0-255 range */
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return [
      parseInt(h[0]! + h[0]!, 16),
      parseInt(h[1]! + h[1]!, 16),
      parseInt(h[2]! + h[2]!, 16),
    ];
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** sRGB channel to linear (gamma-corrected) value */
function linearize(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Relative luminance per WCAG 2.1 */
function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Contrast ratio between two colors (always >= 1) */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
```

### Reduced Motion CSS Override
```css
/* Source: W3C SCR40 technique + MDN prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  /* Kill all CSS transitions and animations */
  *, *::before, *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }

  /* Spinner: no rotation */
  .spinner {
    animation: none;
    border-top-color: var(--accent);
    opacity: 0.7;
  }
}
```

### D3 Duration Override with MotionProvider
```typescript
// Source: existing transitions.ts pattern + MotionProvider
// In morphTransition:
export function morphTransition(
  svg: SVGSVGElement,
  cards: CardDatum[],
  computePosition: (d: CardDatum, i: number) => string,
  options?: { duration?: number; stagger?: number },
): void {
  // Check reduced motion BEFORE setting duration
  const reducedMotion = motionProvider.prefersReducedMotion;
  const duration = reducedMotion ? 0 : (options?.duration ?? 400);
  const stagger = reducedMotion ? 0 : (options?.stagger ?? 15);
  // ... rest of function uses these values
}
```

### ARIA Landmark Structure
```typescript
// Source: WAI-ARIA landmark roles best practice
// In main.ts bootstrap:

// Skip-to-content link (first child of body)
const skipLink = document.createElement('a');
skipLink.href = '#main-content';
skipLink.className = 'sr-only sr-only--focusable';
skipLink.textContent = 'Skip to content';
document.body.insertBefore(skipLink, document.body.firstChild);

// Toolbar as navigation landmark
toolbar.setAttribute('role', 'navigation');
toolbar.setAttribute('aria-label', 'View toolbar');

// Main content area
container.setAttribute('role', 'main');
container.id = 'main-content';
```

### WAI-ARIA Combobox for Command Palette (A11Y-11 prep)
```typescript
// Source: W3C WAI-ARIA APG Combobox Pattern
// https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
// Phase 51 will implement; Phase 50 establishes the contract

// Input element:
input.setAttribute('role', 'combobox');
input.setAttribute('aria-expanded', 'false');
input.setAttribute('aria-controls', 'palette-listbox');
input.setAttribute('aria-autocomplete', 'list');
input.setAttribute('aria-activedescendant', ''); // updated on arrow key nav

// Popup listbox:
listbox.setAttribute('role', 'listbox');
listbox.id = 'palette-listbox';

// Each option:
option.setAttribute('role', 'option');
option.id = `palette-option-${index}`;
// Keyboard: Down/Up to navigate, Enter to select, Escape to close
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `role="application"` on SPAs | ARIA landmarks (navigation, main, complementary) | ARIA 1.1+ (2017) | Don't use role="application" -- it disables screen reader browse mode |
| aria-live="assertive" for all announcements | aria-live="polite" with queue management | WAI-ARIA best practice | Polite queues; assertive interrupts -- polite is correct for non-urgent |
| `tabindex="0"` on every interactive SVG child | Composite widget pattern (one tab stop, arrow keys within) | ARIA APG guidance | Massive reduction in Tab presses; better UX for keyboard users |
| Color-only status indicators | Shape+color dual encoding | WCAG 1.4.1 (2008) | Isometry already uses + ~ x shapes -- just needs formal implementation |
| `outline: none` for aesthetics | `:focus-visible` for keyboard-only focus rings | CSS Selectors Level 4 | Already implemented in views.css -- just needs extension to SVG elements |
| Separate "high contrast mode" toggle | Accessible-by-default token values | Current best practice | Fix token values in-place; no separate mode needed |

**Deprecated/outdated:**
- `aria-relevant` on live regions: rarely needed; default "additions text" covers most cases
- `accesskey` attribute: conflicts with browser/AT shortcuts; use documented keyboard shortcuts instead
- ARIA 1.0 combobox pattern (role on container wrapping both input and listbox): replaced by ARIA 1.2 pattern (role directly on input)

## Discretion Recommendations

### ARIA Landmark Structure
**Recommendation:** Use this structure:
- `<a class="sr-only sr-only--focusable">` -- skip-to-content link (first in body)
- `role="navigation" aria-label="View toolbar"` -- on toolbar container
- `role="main" id="main-content"` -- on `#app` container
- No `role="complementary"` needed (no sidebar in current UI)

### Skip-to-Content Link
**Recommendation:** `.sr-only` class (matches Bootstrap/Tailwind convention, shorter than `.visually-hidden`). Positioned fixed, visible on focus with accent border.

### Focus on View Switch
**Recommendation:** After `ViewManager.switchTo()` completes, call `container.focus()` to move focus to the main content area. The Announcer should announce "Switched to {view name}, {count} cards". Do NOT auto-focus the first card -- let the user choose when to enter the view content with Tab or arrow keys.

### TreeView Expand/Collapse Convention
**Recommendation:** Use arrow-right to expand and arrow-left to collapse (matches macOS Finder, Windows Explorer, and WAI-ARIA TreeView APG pattern). Enter/Space should activate (select) the node, not toggle expand.

### CSS Utility Class Naming
**Recommendation:** `.sr-only` as the base class. `.sr-only--focusable` modifier for skip link. This follows the BEM-like convention already used in the codebase (e.g., `.view-empty-panel`, `.import-toast-status`).

## Design Token Contrast Audit Approach

### Dark Theme Token Pairs to Verify
| Foreground Token | Background Token | Requirement | Min Ratio |
|-----------------|-----------------|-------------|-----------|
| `--text-primary` (#e0e0e0) | `--bg-primary` (#1a1a2e) | Text | 4.5:1 |
| `--text-secondary` (#a0a0b0) | `--bg-primary` (#1a1a2e) | Text | 4.5:1 |
| `--text-muted` (#606070) | `--bg-primary` (#1a1a2e) | Text | 4.5:1 |
| `--text-primary` (#e0e0e0) | `--bg-card` (#1e1e2e) | Text | 4.5:1 |
| `--text-secondary` (#a0a0b0) | `--bg-card` (#1e1e2e) | Text | 4.5:1 |
| `--accent` (#4a9eff) | `--bg-primary` (#1a1a2e) | UI component | 3:1 |
| `--accent` (#4a9eff) | `--bg-card` (#1e1e2e) | UI component | 3:1 |
| `--danger` (#ff4a4a) | `--bg-primary` (#1a1a2e) | UI component | 3:1 |
| `--source-*` (9 colors) | `--bg-primary` (#1a1a2e) | Text labels | 4.5:1 |
| `--source-*` (9 colors) | `--bg-card` (#1e1e2e) | Text labels | 4.5:1 |
| `--audit-new/modified/deleted` | `--bg-card` (#1e1e2e) | UI component | 3:1 |

### Light Theme Token Pairs to Verify
| Foreground Token | Background Token | Requirement | Min Ratio |
|-----------------|-----------------|-------------|-----------|
| `--text-primary` (#1a1a2e) | `--bg-primary` (#ffffff) | Text | 4.5:1 |
| `--text-secondary` (#5a5a6e) | `--bg-primary` (#ffffff) | Text | 4.5:1 |
| `--text-muted` (#9a9aaa) | `--bg-primary` (#ffffff) | Text | 4.5:1 |
| `--accent` (#2563eb) | `--bg-primary` (#ffffff) | UI component | 3:1 |
| `--source-*` (9 colors) | `--bg-primary` (#ffffff) | Text labels | 4.5:1 |
| `--source-*` (9 colors) | `--bg-card` (#ffffff) | Text labels | 4.5:1 |
| `--audit-new/modified/deleted` | `--bg-card` (#ffffff) | UI component | 3:1 |

**Strategy:** Parse `design-tokens.css` statically, extract all hex values per theme block, run contrastRatio() on every documented pair, assert >= 4.5 for text and >= 3.0 for UI. Adjust failing token values to meet thresholds while keeping hue family intact.

## Integration Points (Codebase-Specific)

### Where Announcer Wires In
- `ViewManager.switchTo()` -- announce view name + card count after render completes
- `StateCoordinator.scheduleUpdate()` result callback -- announce filter changes ("Filtered to 25 cards")
- `ImportToast.showSuccess()` -- already has aria-live, but centralized Announcer provides consistent channel
- `MutationManager.undo()/redo()` -- ActionToast already handles this via aria-live

### Where MotionProvider Wires In
- `transitions.ts: morphTransition()` -- check `prefersReducedMotion` before setting duration
- `transitions.ts: crossfadeTransition()` -- check before setting duration
- `ListView.render()` enter transition -- `.transition().duration(200)` -> conditional
- `NetworkView.render()` -- force simulation already pre-computes; just suppress any remaining enter transitions
- CSS side: `@media (prefers-reduced-motion: reduce)` in `accessibility.css` catches theme transition, spinner, help overlay fade

### Where ARIA Roles Wire In
- `index.html` -- add `lang="en"` (already present), skip-link
- `main.ts` -- add landmark roles on `#app`, toolbar container
- `ListView.mount()` / `GridView.mount()` / `TimelineView.mount()` / `NetworkView.mount()` / `TreeView.mount()` -- SVG gets `role="img"` + `aria-label`
- `SuperGrid._renderCells()` -- grid container gets `role="table"`, headers get `role="columnheader"`/`role="rowheader"`, cells get `role="cell"`
- `CardRenderer.renderSvgCard()` -- add `<title>` child to each `<g>` with card name/type/source

### Where Keyboard Navigation Wires In
- `ShortcutRegistry` -- NOT used for arrow key navigation (it guards against input fields); view-level keyboard handlers are separate
- Each view's `mount()` -- add `tabindex="0"` to view container, register keydown handler
- `ViewManager.switchTo()` -- after render, focus the container

## Open Questions

1. **SuperGrid Virtual Scrolling + ARIA**
   - What we know: SuperGrid virtualizes rows. `aria-rowcount` declares total row count. Only visible rows have DOM.
   - What's unclear: VoiceOver behavior when `aria-rowindex` values are non-contiguous (due to windowing). Some screen readers handle this; others may not.
   - Recommendation: Set `aria-rowcount` on table container and `aria-rowindex` on each visible row. Test in VoiceOver. Accept as best-effort since the Out of Scope section explicitly excludes full ARIA grid pattern.

2. **A11Y-11 Scope Boundary**
   - What we know: A11Y-11 requires command palette to follow WAI-ARIA combobox pattern. But the command palette itself is Phase 51 (CMDK-01..CMDK-08).
   - What's unclear: Should Phase 50 implement a placeholder combobox, or just document the pattern for Phase 51?
   - Recommendation: Phase 50 should document the combobox ARIA contract in the Announcer module or a shared constants file. Phase 51 implements it. A11Y-11 is satisfied when the Phase 51 command palette uses the correct ARIA attributes.

3. **Source Provenance Color Adjustment Magnitude**
   - What we know: Some source pastels (e.g., `--source-apple-notes: #fbbf24` yellow) may already pass 4.5:1 against dark backgrounds but fail on light.
   - What's unclear: How much hue shift is acceptable while "keeping hue family recognizable"?
   - Recommendation: Keep hue (H in HSL) constant, adjust saturation and lightness only. If a color fails even at maximum reasonable adjustment, darken for light theme and lighten for dark theme (per-theme values already exist).

## Sources

### Primary (HIGH confidence)
- W3C WCAG 2.1 Understanding Contrast Minimum -- https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
- W3C WAI-ARIA APG Combobox Pattern -- https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
- W3C SCR40 Technique (prefers-reduced-motion in JS) -- https://www.w3.org/WAI/WCAG21/Techniques/client-side-script/SCR40
- MDN ARIA img role -- https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/img_role
- MDN prefers-reduced-motion -- https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- Existing codebase: design-tokens.css, views.css, transitions.ts, ThemeProvider.ts, ActionToast.ts, ImportToast.ts

### Secondary (MEDIUM confidence)
- Deque: Creating Accessible SVGs -- https://www.deque.com/blog/creating-accessible-svgs/
- web.dev: prefers-reduced-motion -- https://web.dev/articles/prefers-reduced-motion
- CSS-Tricks: Accessible SVGs -- https://css-tricks.com/accessible-svgs/

### Tertiary (LOW confidence)
- None -- all findings verified against W3C specifications

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all native platform APIs with W3C specifications
- Architecture: HIGH -- patterns directly mirror existing ThemeProvider/ActionToast code; integration points identified in source
- Pitfalls: HIGH -- based on W3C documentation, MDN references, and known codebase constraints (WKWebView VoiceOver differences documented in STATE.md)
- Contrast calculation: HIGH -- W3C formula is mathematical, deterministic, and well-specified

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (WCAG 2.1 is stable; no breaking changes expected)
