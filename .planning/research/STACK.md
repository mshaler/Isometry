# Technology Stack — v4.4 UX Complete

**Project:** Isometry v5
**Researched:** 2026-03-07
**Confidence:** HIGH -- all recommendations verified against official docs, browser compatibility, and existing codebase constraints

---

## Context: Locked Existing Stack (Do Not Re-Research)

These are validated and final. No changes permitted:

| Technology | Version | Status |
|------------|---------|--------|
| TypeScript | 5.9 (strict) | Locked |
| sql.js | 1.14 (custom FTS5 WASM 756KB) | Locked |
| D3.js | v7.9 | Locked |
| Vite | 7.3 | Locked |
| Vitest | 4.0 | Locked |
| Biome | 2.4.6 | Locked |
| Swift | iOS 17+ / macOS 14+ | Locked |
| SwiftUI | iOS 17 / macOS 14 | Locked |
| WKWebView + WKURLSchemeHandler | iOS 17 / macOS 14 | Locked |
| ETL deps | gray-matter, PapaParse, xlsx/SheetJS | Locked |
| Native deps | EventKit, SQLite3 C, SwiftProtobuf 1.28+, CKSyncEngine | Locked |

**This document covers ONLY what is needed for the four v4.4 features:**
1. Command Palette (Cmd+K) with fuzzy search
2. WCAG 2.1 AA Accessibility (VoiceOver, ARIA, contrast, Dynamic Type)
3. Light/Dark/System theme toggle
4. Enhanced empty states with sample data

---

## Conclusion Up Front

v4.4 requires **ONE new runtime dependency** (fuzzy search) and **ZERO new dev dependencies**. The accessibility audit, theming, and sample data are all achievable with the existing CSS custom property system, vanilla TypeScript, and the established ARIA patterns already partially in place (aria-live on toasts, :focus-visible styles).

1. **Command Palette: ONE new dependency (fuse.js 7.1.0).** The command palette needs fuzzy matching across cards (via FTS5), actions, views, and shortcuts. FTS5 handles card search (already built), but action/shortcut search needs client-side fuzzy matching over a small in-memory corpus (~50-100 items). Fuse.js is the correct choice: zero dependencies, ~5kB gzipped, mature API for weighted multi-key search, and 3.5M weekly npm downloads. The ShortcutRegistry already exposes `getAll()` for discoverable shortcuts -- the palette wraps it.

2. **WCAG 2.1 AA Accessibility: ZERO new dependencies.** All ARIA attributes, roles, landmark regions, and live regions are native HTML/SVG attributes added inline. VoiceOver support requires `role="img"` + `aria-label` on SVG view roots, `role="grid"` + `aria-rowcount`/`aria-colcount` on SuperGrid, and `role="dialog"` + focus trapping on the command palette. Contrast fixes are CSS token value changes. Dynamic Type is a CSS `-apple-system-body` font integration + Swift notification observer. No axe-core or testing library needed at runtime.

3. **Light/Dark/System Theme: ZERO new dependencies.** The existing design-tokens.css already defines all color tokens on `:root`. Theming adds a `[data-theme="light"]` selector block with light-mode token overrides, plus `@media (prefers-color-scheme: light)` for system-follows mode. The `data-theme` attribute approach (not CSS `light-dark()`) is mandatory because the project targets iOS 17.0+ and `light-dark()` only shipped in Safari 17.5 (iOS 17.5). The 3-way toggle (Light/Dark/System) persists via existing StateManager (Tier 2 `ui_state` table). SwiftUI side uses `preferredColorScheme()` driven by NativeBridge message.

4. **Enhanced Empty States + Sample Data: ZERO new dependencies.** Sample data is a hardcoded TypeScript module (~30 curated CanonicalCard objects with connections) injected through the existing SQLiteWriter pipeline. The existing `generate-fixtures.mjs` test script proves the card schema is well-understood for generating realistic data. No faker.js or seed library needed -- 30 hand-crafted cards covering all 5 card_types (note, task, event, person, bookmark) with varied folders, tags, statuses, dates, and connections.

**Total new dependencies: 1 (runtime, ~5kB gzipped).** Disciplined for a UX milestone.

---

## Recommended Stack

### 1. Command Palette — Fuzzy Search

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| fuse.js | 7.1.0 | Client-side fuzzy search for command palette | Zero dependencies, ~5kB gzipped, weighted multi-key search across heterogeneous item types (actions, views, shortcuts), mature API, 3.5M weekly downloads, TypeScript types included |

**Why fuse.js over alternatives:**

| Criterion | fuse.js 7.1.0 | uFuzzy 1.x | Built-in (manual) |
|-----------|--------------|-------------|-------------------|
| Bundle size (min) | ~17kB | ~7.5kB | 0kB |
| Bundle size (gzip) | ~5kB | ~3kB | 0kB |
| Multi-key weighted search | Yes (built-in) | No (single string list) | Must implement |
| TypeScript types | Included | Included | N/A |
| npm weekly downloads | 3.5M | ~50K | N/A |
| API maturity | Stable since 2016, v7 rewrite 2024 | Stable since 2022 | N/A |
| Scoring customization | threshold, distance, location weights | Sort callback with stats | N/A |

**Decision: fuse.js.** The command palette searches across heterogeneous item types with different field weights:
- Cards: name (weight 1.0), content (weight 0.3), tags (weight 0.5) -- delegates to FTS5 for performance
- Actions: label (weight 1.0), category (weight 0.3)
- Views: name (weight 1.0)
- Shortcuts: description (weight 1.0), shortcut key display (weight 0.5)

Fuse.js handles this natively with `keys` and `weight` configuration. uFuzzy is designed for searching a flat string list, which would require flattening the heterogeneous items and losing per-field weight control. The 2kB gzip size difference is irrelevant against the existing 756kB WASM bundle.

**How fuse.js integrates with FTS5:** The command palette uses a hybrid search strategy:
- **Small corpus (actions, views, shortcuts):** fuse.js searches in-memory (~100 items)
- **Large corpus (cards):** FTS5 via existing WorkerBridge `db:query` (already built, SuperSearch uses it)
- **Merged results:** TypeScript merges and interleaves both result sets with category headers

**Confidence:** HIGH -- fuse.js is well-documented, stable API, no breaking changes between v7.0 and v7.1.

### 2. Command Palette — UI Shell

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vanilla TypeScript + CSS | existing | Palette DOM, keyboard navigation, focus trap | Follows existing codebase pattern (no component library); ShortcutRegistry already handles Cmd+K registration; help-overlay.css is a proven pattern for modal overlay |

**No command palette library needed.** The help overlay (Phase 44) already implements the exact UI pattern required:
- Fixed overlay with backdrop (`help-overlay.css`)
- Card panel with max-width/max-height
- Keyboard dismiss (Escape)
- CSS transition show/hide

The command palette extends this pattern with:
- Text input at top (auto-focused)
- Scrollable results list below
- Arrow key navigation within results
- Enter to execute selected action
- Category grouping (Cards, Views, Actions, Shortcuts)

This is ~200 lines of TypeScript + ~80 lines of CSS. A library would add more code than the implementation itself.

**Integration point: ShortcutRegistry.** Register `Cmd+K` via the existing `ShortcutRegistry.register()` method. The palette reads `ShortcutRegistry.getAll()` to populate the Shortcuts category. This is already designed for exactly this use case.

### 3. WCAG 2.1 AA Accessibility — No New Dependencies

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Native ARIA attributes | HTML5/WAI-ARIA 1.2 | Screen reader support | `role`, `aria-label`, `aria-live`, `aria-expanded`, `aria-selected` are native HTML attributes requiring zero runtime |
| CSS custom properties | existing | Contrast ratio compliance | Adjust existing design token values to meet 4.5:1 (text) and 3:1 (large text/UI components) ratios |
| `-apple-system-body` CSS font | Safari built-in | Dynamic Type scaling in WKWebView | Safari-specific system font keyword that automatically tracks iOS Dynamic Type settings |
| `UIContentSizeCategory.didChangeNotification` | UIKit | Swift observer for Dynamic Type changes | Triggers WKWebView reload when user changes text size in Settings |

**What the accessibility audit covers:**

| WCAG 2.1 AA Criterion | Applies To | Implementation |
|------------------------|-----------|----------------|
| 1.1.1 Non-text Content | SVG views (list, grid, timeline, network, tree) | `role="img"` + `aria-label` on `<svg>` root describing current view content |
| 1.3.1 Info and Relationships | SuperGrid, command palette, help overlay | `role="grid"` + `aria-rowcount`/`aria-colcount` on SuperGrid; `role="dialog"` on palette; `role="listbox"` + `role="option"` on palette results |
| 1.4.3 Contrast (Minimum) | All text and UI elements | Audit all design token colors against both dark and light themes; minimum 4.5:1 for normal text, 3:1 for large text (>=18px or >=14px bold) |
| 1.4.4 Resize Text | All web content | `-apple-system-body` font + viewport-relative sizing where appropriate; text must remain readable at 200% zoom |
| 2.1.1 Keyboard | All interactive elements | Already partially done (ShortcutRegistry, :focus-visible); extend to command palette, theme toggle, all buttons |
| 2.4.3 Focus Order | Command palette, SuperGrid | `tabindex` management; focus trap in palette modal; logical tab order in toolbar |
| 2.4.7 Focus Visible | All focusable elements | Already implemented (views.css :focus-visible rules); extend to new palette elements |
| 3.2.1 On Focus | All views | No unexpected context changes on focus (already correct) |
| 4.1.2 Name, Role, Value | All interactive components | Ensure all buttons have accessible names; SuperGrid cells have data context |

**Contrast ratio methodology:** Use the existing design-tokens.css architecture. Each token gets checked with WebAIM contrast checker for both themes. Tokens that fail 4.5:1 get adjusted. The token system means one value change propagates everywhere -- no per-component fixes needed.

**Dynamic Type integration flow:**
1. CSS: Set `font: -apple-system-body` on `body` element (or derive font-size from it)
2. Swift: Observe `UIContentSizeCategory.didChangeNotification`
3. On change: Execute JavaScript in WKWebView to update a CSS custom property `--dynamic-type-scale` with the current multiplier
4. All `--text-*` tokens use `calc()` with the scale factor
5. Result: text scales with iOS Dynamic Type settings without full page reload

**Confidence:** HIGH -- ARIA attributes are well-documented standards; contrast checking is mechanical; Dynamic Type in WKWebView is documented by Apple and community (useyourloaf.com).

### 4. Light/Dark/System Theme — CSS Architecture

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| CSS `[data-theme]` attribute selector | CSS3 | Theme switching mechanism | Works on iOS 17.0+ (unlike `light-dark()` which requires Safari 17.5/iOS 17.5); JavaScript-controllable for 3-way toggle |
| CSS `@media (prefers-color-scheme)` | CSS3 | System theme detection | Detects OS light/dark preference; used as fallback when user selects "System" mode |
| `matchMedia('(prefers-color-scheme: dark)')` | Web API | JavaScript system theme listener | Reacts to OS theme changes in real-time for "System" mode |
| StateManager (existing) | Tier 2 | Theme preference persistence | Stores user choice (light/dark/system) in `ui_state` table; survives sessions |
| NativeBridge (existing) | v4.1 | Sync theme to SwiftUI | New message type `native:theme` tells SwiftUI shell to apply `.preferredColorScheme()` |

**Why NOT `light-dark()` CSS function:**
The project targets iOS 17.0+. The CSS `light-dark()` function shipped in Safari 17.5 (available on iOS 17.5+). Devices on iOS 17.0 through 17.4 would silently ignore `light-dark()` values, producing broken styling. The `[data-theme]` attribute approach works on every browser version the project supports.

**Theme architecture:**

```
User selects "Light" / "Dark" / "System" in settings
        |
        v
ThemeManager.setTheme(choice)
        |
        +-- Persists to StateManager (Tier 2 ui_state)
        +-- Sets document.documentElement.dataset.theme = resolved
        +-- Sends native:theme message to Swift shell
        |
        v (if "System")
matchMedia listener watches OS changes
        |
        v
document.documentElement.dataset.theme = 'light' | 'dark'
```

**CSS token architecture:**

```css
/* Current: dark-only tokens on :root */
:root {
  --bg-primary: #1a1a2e;
  --text-primary: #e0e0e0;
  /* ... 40+ tokens */
}

/* NEW: light theme overrides */
[data-theme="light"] {
  --bg-primary: #ffffff;
  --text-primary: #1a1a2e;
  /* ... override only the tokens that change */
}

/* System mode: OS-driven fallback (for initial paint before JS) */
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    --bg-primary: #ffffff;
    --text-primary: #1a1a2e;
  }
}
```

The `:root:not([data-theme="dark"])` selector ensures that if a user explicitly chose dark mode, the OS light preference does not override it.

**SwiftUI integration:**
The Swift shell needs to match the web theme for native UI elements (sidebar, toolbar, status bar):

```swift
// In ContentView:
.preferredColorScheme(themeManager.colorScheme)
// Where colorScheme is .light, .dark, or nil (system)
```

This is driven by a `native:theme` bridge message from the web runtime.

**Tokens to define for light theme (~40 overrides):**
The existing design-tokens.css has these token categories that need light variants:
- Background colors (4 tokens): `--bg-primary`, `--bg-secondary`, `--bg-card`, `--bg-surface`
- Text colors (3 tokens): `--text-primary`, `--text-secondary`, `--text-muted`
- Accent colors (3 tokens): `--accent`, `--accent-hover`, `--danger` -- these likely stay the same or get minor adjustments for contrast
- Derived colors (13 tokens): opacity-based variants -- these mostly work automatically if base colors are correct
- Audit colors (3 tokens): may need brightness adjustments for light backgrounds
- Source provenance colors (9 tokens): may need saturation adjustments for light backgrounds

Estimated: ~25-30 token overrides (not all 40+ need changing).

**Confidence:** HIGH -- `data-theme` attribute theming is the established pattern for apps with user-controlled toggles; `prefers-color-scheme` has universal browser support; StateManager persistence is proven.

### 5. Enhanced Empty States — Sample Data Generator

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vanilla TypeScript module | existing | Hardcoded sample data corpus | ~30 curated CanonicalCard objects + ~15 connections, hand-crafted for visual variety across all 9 views |
| SQLiteWriter (existing) | v1.1 | Insert sample cards into database | Same pipeline as real ETL imports; dedup-safe via `source: 'sample_data'` + `source_id` |
| ImportOrchestrator (existing) | v1.1 | Progress reporting for sample load | Reuses ImportToast UI for the "loading sample data" experience |

**Why hand-crafted over generated:**
The existing `generate-fixtures.mjs` creates 110+ random cards per source for testing. Sample data for user exploration has different requirements:
- Cards need **meaningful, recognizable names** (not "Note 001")
- Content must **demonstrate view capabilities** (dates for calendar/timeline, statuses for kanban, folders for tree, connections for network)
- Coverage must include **all 5 card_types** (note, task, event, person, bookmark) so every view shows interesting data
- Tags, folders, and statuses need to be **thematically coherent** (e.g., a "Product Launch" project with related tasks, events, and people)

~30 cards with ~15 connections is the sweet spot: enough to populate every view meaningfully, small enough to load instantly, curated enough to showcase the product.

**Sample data module structure:**
```typescript
// src/sample/sample-data.ts
export const SAMPLE_CARDS: CanonicalCard[] = [
  // 8 notes (various folders, tags)
  // 8 tasks (todo/in_progress/done/blocked statuses)
  // 6 events (with dates for calendar + timeline)
  // 4 persons (for network connections)
  // 4 bookmarks (with URLs)
];

export const SAMPLE_CONNECTIONS: CanonicalConnection[] = [
  // 15 connections: contains, related_to, attendee-of
];
```

**Integration with existing empty state:**
The welcome panel (`ViewManager._showWelcome()`) currently shows "Import File" and "Import from Mac" buttons. A third button "Try Sample Data" triggers:
1. Load sample-data.ts module
2. Run through SQLiteWriter (existing pipeline)
3. Coordinator triggers re-render
4. All 9 views populate with meaningful data

The sample data uses `source: 'sample_data'` so it can be cleared later without affecting real imports.

**Confidence:** HIGH -- the CanonicalCard schema is thoroughly validated across 11 milestones; SQLiteWriter handles insertion; no external dependency needed.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Fuzzy search | fuse.js 7.1.0 | uFuzzy (@leeoniya/ufuzzy) | uFuzzy is designed for single-string-list search; lacks native multi-key weighted search needed for heterogeneous command palette items |
| Fuzzy search | fuse.js 7.1.0 | Built-in (manual implementation) | Fuzzy matching with scoring, threshold control, and result ranking is non-trivial (~300+ LOC); fuse.js provides this at 5kB with battle-tested edge cases |
| Fuzzy search | fuse.js 7.1.0 | FTS5 for everything | FTS5 is great for cards (already used) but overkill for 100-item in-memory lists of actions/shortcuts; also FTS5 does exact/prefix matching, not fuzzy |
| Theme mechanism | `[data-theme]` attribute | CSS `light-dark()` function | `light-dark()` requires Safari 17.5+; project targets iOS 17.0+; devices on iOS 17.0-17.4 would have broken styling |
| Theme mechanism | `[data-theme]` attribute | Separate CSS files per theme | Increases bundle size; causes FOUC on theme switch; harder to maintain than token overrides in single file |
| Command palette UI | Vanilla TypeScript | ninja-keys Web Component | 27kB+ bundle for a component that duplicates existing help-overlay pattern; Web Component shadow DOM complicates design token inheritance |
| Command palette UI | Vanilla TypeScript | cmdk / react-cmdk | React dependency -- project explicitly forbids React (Constraint: "no React, no Redux, no framework") |
| Accessibility testing | Manual audit + WebAIM checker | axe-core runtime | axe-core is ~500kB; useful for automated CI checks but not needed at runtime; can add as dev dependency later if CI accessibility gates are desired |
| Sample data | Hand-crafted module | faker.js / @faker-js/faker | ~850kB bundle for generating random data; sample data is a fixed 30-card corpus that never changes -- a generator library is absurd overhead |
| Dynamic Type | `-apple-system-body` CSS font | JavaScript font-size polling | Apple's system font keyword is the documented approach for WKWebView; polling is fragile and unnecessary |

---

## What NOT to Add (Avoid Bloat)

| Temptation | Why Avoid | Existing Alternative |
|-----------|-----------|---------------------|
| axe-core (accessibility testing) | ~500kB runtime; useful for CI but not for shipping code | Manual WCAG audit checklist; WebAIM contrast checker; VoiceOver testing |
| @faker-js/faker (sample data) | ~850kB for generating 30 static cards | Hand-crafted TypeScript module; the fixture generator script proves the schema |
| color.js / chroma.js (contrast calculation) | Overkill for one-time token audit | WebAIM contrast checker (web tool); manual hex math in build script if needed |
| focus-trap (npm package) | 8kB for a pattern that is ~30 lines of TypeScript | Manual focus trap: query focusable elements, keydown Tab/Shift+Tab handler |
| hotkeys-js / mousetrap | ShortcutRegistry already exists and handles all key combinations | ShortcutRegistry.register('Cmd+K', ...) |
| postcss-dark-mode / postcss-color-scheme | PostCSS plugins for theme generation | Manual CSS token overrides -- 25-30 lines in `[data-theme="light"]` block |
| Any React/Vue/Svelte library | Project constraint: no framework | Vanilla TypeScript + DOM APIs |

---

## Installation

```bash
# ONE new runtime dependency
npm install fuse.js@^7.1.0

# No new dev dependencies needed
```

**Resulting dependency count:**
- Runtime: 5 -> 6 (d3, gray-matter, papaparse, sql.js, xlsx, **fuse.js**)
- Dev: unchanged at 11

---

## Integration Points with Existing Systems

### ShortcutRegistry Integration
The command palette registers `Cmd+K` via ShortcutRegistry. The palette reads `getAll()` to populate shortcut suggestions. ShortcutRegistry already has the exact API surface needed -- no modifications required.

### CSS Design Token Integration
The theme system extends design-tokens.css with a `[data-theme="light"]` block. All existing views automatically inherit the light theme because they already reference CSS custom properties (zero hardcoded inline colors as of v4.2). The audit overlay (audit-colors.ts) retains hardcoded hex values (documented technical debt) and will need a ThemeManager-aware mapping.

### StateManager Integration
Theme preference (`light` | `dark` | `system`) persists via the existing `ui_state` table at Tier 2. The StateManager API already supports arbitrary key-value persistence -- no schema changes needed.

### NativeBridge Integration
A new `native:theme` message type extends the existing bridge protocol. The Swift shell applies `.preferredColorScheme()` to match the web theme. This follows the established `native:action` pattern (kind discriminator for extensibility).

### ViewManager Integration
The "Try Sample Data" button extends `ViewManager._showWelcome()` alongside existing "Import File" and "Import from Mac" CTAs. Sample data flows through the same SQLiteWriter pipeline as real imports.

### FTS5 Integration (Command Palette Card Search)
Card search in the command palette reuses the existing FTS5 query path (`db:query` via WorkerBridge). The SuperSearch debounce pattern (300ms) applies here too. No new Worker handler needed -- just a different SQL query.

---

## Browser / Platform Compatibility Notes

| Feature | Safari 17.0 (iOS 17.0) | Safari 17.5 (iOS 17.5) | Safari 18+ (iOS 18+) |
|---------|------------------------|------------------------|----------------------|
| `[data-theme]` selector | Yes | Yes | Yes |
| `@media (prefers-color-scheme)` | Yes | Yes | Yes |
| CSS `light-dark()` function | NO | Yes | Yes |
| `matchMedia` API | Yes | Yes | Yes |
| `:focus-visible` | Yes | Yes | Yes |
| `aria-*` attributes | Yes | Yes | Yes |
| `content-visibility: auto` | NO | NO | Yes |
| `-apple-system-body` font | Yes | Yes | Yes |

Key constraint: iOS 17.0+ support requires `[data-theme]` attribute approach for theming. The `light-dark()` CSS function is NOT usable as the primary mechanism.

---

## Sources

### Fuzzy Search
- [Fuse.js Official Documentation](https://www.fusejs.io/) -- API reference, scoring explanation
- [Fuse.js GitHub](https://github.com/krisk/Fuse) -- v7.1.0 released 2025-02-03, 19.8K stars
- [uFuzzy GitHub](https://github.com/leeoniya/uFuzzy) -- alternative evaluated, ~7.5kB min
- [npm: fuse.js](https://www.npmjs.com/package/fuse.js) -- 3.5M weekly downloads

### Accessibility
- [WCAG 2.1 Understanding Contrast (Minimum)](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) -- 4.5:1 ratio requirement
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) -- tool for verifying token contrast ratios
- [Creating Accessible D3.js Data Visualizations](https://fossheim.io/writing/posts/apple-dataviz-a11y-tutorial/) -- SVG role="img" + aria-label pattern
- [Accessible SVGs at Fizz Studio](https://fizz.studio/blog/reliable-valid-svg-accessibility/) -- SVG ARIA best practices
- [WAI-ARIA 1.2 Specification](https://www.w3.org/TR/wai-aria-1.2/) -- role/state/property reference
- [Using Dynamic Type with Web Views](https://useyourloaf.com/blog/using-dynamic-type-with-web-views/) -- `-apple-system-body` font + notification observer

### Theming
- [MDN: prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-color-scheme) -- media query reference
- [MDN: light-dark() function](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/light-dark) -- browser compat (Safari 17.5+)
- [WebKit Features in Safari 17.5](https://webkit.org/blog/15383/webkit-features-in-safari-17-5/) -- confirms light-dark() added in Safari 17.5, available on iOS 17.5+
- [Smashing Magazine: Setting and Persisting Color Scheme Preferences](https://www.smashingmagazine.com/2024/03/setting-persisting-color-scheme-preferences-css-javascript/) -- data-theme + prefers-color-scheme pattern
- [MDN: color-scheme CSS property](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme) -- color-scheme: light dark declaration

### Command Palette Design
- [Superhuman: How to Build a Remarkable Command Palette](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/) -- UX design principles
- [awesome-command-palette](https://github.com/stefanjudis/awesome-command-palette) -- landscape survey
