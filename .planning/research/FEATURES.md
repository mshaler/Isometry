# Feature Landscape

**Domain:** Command palette, WCAG 2.1 AA accessibility, light/dark theming, and sample data for a D3.js/SVG-heavy local-first data projection app
**Researched:** 2026-03-07
**Confidence:** HIGH -- patterns well-established from Linear, Superhuman, Notion, VS Code; WCAG 2.1 AA is a formal spec; CSS theming patterns are stable and browser-supported.

---

## Table Stakes

Features users expect. Missing = product feels incomplete or inaccessible.

### Command Palette (Cmd+K)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Cmd+K global trigger | Every productivity app (Linear, Notion, VS Code, Superhuman) trains users to expect this | Low | ShortcutRegistry already handles Cmd+key; register `Cmd+K` the same way |
| Fuzzy text matching | Users misspell and abbreviate; exact match frustrates power users | Med | Use lightweight fuzzy library (fuse.js ~15KB, or microfuzz ~2KB) or simple substring+distance scorer. FTS5 already in Worker handles card search; command search is client-side over ~50 items |
| Keyboard navigation (arrow keys + Enter) | Command palettes are keyboard-first by definition; mouse is secondary | Med | Focused-item index state, arrow key handlers, Enter dispatch. Standard listbox ARIA pattern |
| Escape to close | Universal dismiss pattern | Low | Same pattern as HelpOverlay._escapeHandler |
| Action items (view switching, undo/redo, toggle audit, help) | Core purpose of a command palette -- surface existing actions without menu hunting | Low | Actions already registered in ShortcutRegistry.getAll(); wrap each as a palette command |
| Card search results | Users expect to find their data, not just actions | Med | FTS5 search:cards handler already exists in Worker; pipe query through bridge.send('search:cards') with debounce |
| Visual shortcut hints | Show `Cmd+1` next to "List view" so users learn to graduate from palette to direct shortcut | Low | ShortcutEntry already carries `shortcut` string; render as `<kbd>` in result rows |

### WCAG 2.1 AA Accessibility

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Text contrast 4.5:1 (normal), 3:1 (large) | WCAG SC 1.4.3 -- legal/ethical baseline for text readability | Med | Current dark theme tokens need audit: --text-secondary (#a0a0b0) on --bg-primary (#1a1a2e) = ~5.5:1 (OK), but --text-muted (#606070) on --bg-primary = ~2.9:1 (FAIL). Must fix all muted text |
| Non-text contrast 3:1 | WCAG SC 1.4.11 -- SVG chart elements (nodes, edges, bars, grid lines) must contrast 3:1 with neighbors | Med | NetworkView edges use --text-muted which may fail. SuperGrid cell borders, sort badges, filter dropdowns all need audit |
| Focus visible indicators | WCAG SC 2.4.7 -- keyboard users must see where focus is at all times | Med | :focus-visible already in views.css; needs extension to SVG interactive elements (nodes, cards in list/grid), toolbar buttons, sort dropdowns, filter dropdowns |
| Keyboard operability | WCAG SC 2.1.1 -- all mouse actions must be keyboard-achievable | High | SVG views (Network drag, Tree expand, Kanban DnD, SuperGrid lasso) need keyboard equivalents. This is the single hardest accessibility requirement |
| ARIA roles on SVG views | Screen readers must understand SVG structure | Med | Add role="img" + aria-label on SVG root elements, role="list"/role="listitem" on card groups, aria-live regions for dynamic content updates |
| Skip navigation / landmark regions | WCAG SC 2.4.1 -- bypass blocks of repeated content | Low | Add role="main" on #app container, role="navigation" on toolbar, skip-to-content link |
| Screen reader announcements for state changes | View switches, filter application, import completion should announce to AT | Med | Use aria-live="polite" region; announce "Switched to List view", "3 cards match filter", etc. |

### Light/Dark/System Theme

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Dark mode (current default) | Already shipped | None | Current state |
| Light mode color scheme | Users working in bright environments or with vision preferences need light mode | Med | Requires mapping all ~40 CSS custom properties to light equivalents. design-tokens.css currently defines dark-only values |
| System preference detection | prefers-color-scheme media query -- users expect app to follow OS setting | Low | `@media (prefers-color-scheme: light)` or CSS `light-dark()` function (baseline since May 2024) |
| 3-way toggle (Light/Dark/System) | Users want manual override independent of OS | Med | data-theme attribute on `<html>` + JS toggle logic. "System" = remove attribute and let media query decide. Persist choice in StateManager (Tier 2) |
| SVG element theming | D3 views use hardcoded colors in some places (node fills, edge strokes, labels) | Med | All inline color must flow through CSS custom properties or inherit from tokens. NetworkView already uses `var(--text-muted)` for edges -- good pattern to extend |
| Native shell theme sync | WKWebView must reflect SwiftUI colorScheme | Med | Swift sends theme preference via bridge message or sets `overrideUserInterfaceStyle` on WKWebView. CSS `prefers-color-scheme` inside WKWebView follows the host app's appearance |

### Enhanced Empty States with Sample Data

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| "Try with sample data" CTA in welcome panel | Users need to see value before committing to import their own data | Med | Generate ~20-30 CanonicalCards covering multiple card_types, statuses, folders, dates, priorities, and connections. Feed through existing DedupEngine + SQLiteWriter pipeline |
| One-click sample data load | Must be frictionless -- single button, no configuration | Low | CustomEvent dispatch (same pattern as isometry:import-file), Worker processes CanonicalCard[] directly |
| Sample data clearly labeled | Users must distinguish sample from real data to avoid confusion | Low | Use distinct source type (e.g., 'sample') in source field; audit overlay can highlight with --source-sample color token |
| Sample data removable | Users must be able to clear sample data without losing their own imports | Med | DELETE FROM cards WHERE source = 'sample'; DELETE FROM connections WHERE from_card_id or to_card_id references deleted cards. Wrap in MutationManager for undo |

---

## Differentiators

Features that set the product apart. Not expected, but valued by power users.

### Command Palette

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Recent commands section | Superhuman pattern: "Recently used" at top accelerates repeat actions | Low | Track last 5-10 invoked commands in session memory (Tier 3 ephemeral). Show before search results |
| Categorized sections | Group results: "Views", "Actions", "Cards", "Settings" with visual headers | Low | ShortcutEntry already has `category` field; extend to palette command interface |
| Inline filter/sort actions | "Filter by status: Active" or "Sort by: Priority" directly from palette | Med | Compose FilterProvider.addFilter() and PAFVProvider sort calls as palette commands |
| Contextual commands | Show "Clear Filters" only when filters active; "Toggle Audit" only when data imported | Low | Each command gets an `isAvailable()` predicate; palette filters unavailable commands out |
| Animated entrance/exit | 150ms scale+fade transition matching existing overlay patterns | Low | CSS transition on transform+opacity, same as HelpOverlay |

### WCAG 2.1 AA Accessibility

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Screen reader data table for SVG views | Hidden `<table>` alternative for each SVG view so VoiceOver can read cards as rows | High | Render parallel `<table>` with sr-only class; update on each render(). ListView/GridView card data maps naturally to table rows |
| roving tabindex on SVG card groups | Tab into SVG, then arrow keys move between cards -- standard WAI-ARIA grid pattern | High | Each g.card gets tabindex, arrow keys move focus. Complex for NetworkView (2D) and TreeView (hierarchical) |
| Reduced motion support | prefers-reduced-motion media query disables D3 transitions, SVG morphs, crossfades | Low | Already have --transition-fast/normal/slow tokens; wrap in `@media (prefers-reduced-motion: reduce)` to set all to 0ms |
| High contrast mode support | forced-colors media query for Windows High Contrast | Low | Ensure SVG strokes and fills use `currentColor` or `CanvasText`/`LinkText` system colors under forced-colors |

### Light/Dark/System Theme

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| CSS `light-dark()` function usage | Modern CSS approach (baseline May 2024) -- single token definition with both values | Low | `--bg-primary: light-dark(#f5f5f7, #1a1a2e)` eliminates duplicate `:root` / `[data-theme="dark"]` blocks. Requires `color-scheme: light dark` on `:root` |
| Smooth theme transition | 200ms transition on background-color and color prevents jarring flash on toggle | Low | `* { transition: background-color 200ms, color 200ms }` scoped to theme switch event |
| Theme-aware SVG fills | D3 node fills, edge strokes, and labels automatically adapt | Med | Reference CSS custom properties in D3 `.attr('fill', 'var(--node-fill)')`. Already partially done (NetworkView EDGE_STROKE uses var) |

### Enhanced Empty States

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-view sample data variants | NetworkView sample shows connected graph; CalendarView sample shows dated events; TreeView shows hierarchy | Med | Curate sample CanonicalCards with appropriate fields for each view. Connections needed for network/tree |
| Animated sample data appearance | Cards appear with staggered enter animation when sample loads | Low | D3 enter() already has opacity fade-in; natural side effect of render() |
| "Explore views" guided flow | After sample data loads, prompt user to try different views | Low | Show subtle banner: "Sample data loaded -- try switching views with Cmd+1-9" |

---

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full onboarding wizard / multi-step tutorial | Power user tool; wizards add friction and feel patronizing. Already rejected in v4.2 scope | Single welcome panel with clear CTAs (import file, import native, try sample data) |
| Interactive walkthrough / coach marks | Adds UI complexity, requires state machine, users dismiss immediately | Command palette surfaces discoverability naturally; ? help overlay covers shortcuts |
| Custom keyboard shortcut remapping | ~15 actions total, all using standard platform conventions (Cmd+Z, Cmd+1-9, Cmd+K). Remapping adds settings complexity for negligible gain | Keep standard shortcuts. Already rejected in v4.2 scope |
| Command palette with AI/LLM integration | Massive scope creep, requires backend, adds latency, privacy concerns for local-first app | Fuzzy text search over a static command list is fast and sufficient |
| Floating action button (FAB) as palette trigger | Mobile pattern that clashes with desktop-first D3 canvas. Blocks SVG interaction areas | Cmd+K only. Mobile: consider a toolbar icon if needed later |
| Auto-playing demo/tutorial video | Large asset, forces passive consumption, most users skip | Interactive sample data lets users explore at their own pace |
| WCAG AAA compliance | AAA requirements (7:1 contrast, no images of text, extended audio descriptions) are aspirational, not legally required, and would constrain the visual design significantly | Target AA consistently. Note where AAA is achieved as bonus |
| Full ARIA grid pattern on SuperGrid | SuperGrid's CSS Grid layout with virtual scrolling, lasso selection, and zoom makes true ARIA grid (role="grid" with aria-colindex/rowindex) extremely complex and brittle | Use role="table" with aria-rowcount/aria-colcount for structure; provide keyboard navigation within the grid as a progressive enhancement |
| Tooltip system for every icon | Added in v4.2 out-of-scope. SF Symbols + title attributes are sufficient for the icon set | Continue using title attributes and aria-labels |
| Multiple concurrent themes / per-view theming | Complexity explosion -- CSS custom properties inherit globally | Single theme applies everywhere. One toggle, one state |

---

## Feature Dependencies

```
ShortcutRegistry (existing) --> Command Palette (reads getAll(), registers Cmd+K)
   |
   v
Command Palette --> Card Search (reuses search:cards Worker handler)
   |
   v
Command Palette --> View Switching (reuses viewManager.switchTo + viewFactory)

CSS Design Tokens (existing) --> Light Theme (add light-mode values to every token)
   |
   v
Light Theme --> Theme Toggle (3-way JS controller + StateManager persistence)
   |
   v
Theme Toggle --> Native Shell Sync (Swift bridge message or overrideUserInterfaceStyle)

CSS Design Tokens --> WCAG Contrast Audit (verify all token pairs meet ratios)
   |
   v
Focus Visible (existing :focus-visible) --> Full Keyboard Nav (extend to SVG elements)
   |
   v
ARIA Roles --> Screen Reader Announcements (aria-live regions)

Empty States (existing) --> Sample Data (add "Try sample data" CTA)
   |
   v
Sample Data Generator --> DedupEngine + SQLiteWriter (existing ETL pipeline)
   |
   v
Sample Data --> Source Label ('sample') for cleanup identification
```

**Critical dependency chain:**
1. Light theme tokens MUST be defined before contrast audit (audit must verify both themes)
2. Command palette MUST exist before it can be the discovery mechanism for new features
3. Sample data generator MUST produce cards with dates, statuses, folders, and connections to demonstrate all 9 views

---

## MVP Recommendation

**Phase 1: Command Palette** -- Foundation for discoverability
1. CommandPalette class with Cmd+K trigger via ShortcutRegistry
2. Fuzzy search over actions (view switches, undo/redo, toggle audit, help)
3. Card search results via FTS5 bridge
4. Keyboard navigation (arrow keys + Enter + Escape)
5. Recent commands section
6. Visual shortcut hints (`<kbd>` tags)

**Phase 2: Light/Dark/System Theme** -- Visual foundation for accessibility audit
1. Define light-mode values for all ~40 design tokens
2. `data-theme` attribute controller with 3-way toggle
3. Persist preference in StateManager (Tier 2)
4. CSS `light-dark()` for cleaner token definitions
5. Native shell theme sync via WKWebView appearance
6. SVG element theming (ensure all D3 views reference tokens)

**Phase 3: WCAG 2.1 AA Accessibility** -- Requires both themes to audit
1. Color contrast audit across both light and dark themes (fix failures)
2. Focus visible indicators on all interactive elements including SVG
3. ARIA roles on SVG view roots, card groups, toolbar regions
4. aria-live announcements for state changes
5. Skip navigation landmark regions
6. prefers-reduced-motion support
7. Keyboard operability for SVG interactions (progressive enhancement)

**Phase 4: Enhanced Empty States + Sample Data** -- Benefits from palette + themes
1. Sample data generator producing ~25 CanonicalCards + connections
2. "Try sample data" CTA in welcome panel
3. Source type 'sample' for identification and cleanup
4. "Clear sample data" action (accessible via command palette)
5. Per-view sample data coverage (dates for calendar, connections for network)

**Defer:**
- Screen reader data table alternatives for SVG views (high complexity, low initial user impact; revisit after shipping basic ARIA)
- Full roving tabindex on all SVG views (progressive enhancement after keyboard navigation basics)
- SuperGrid ARIA grid pattern (use role="table" initially)

---

## Phase Ordering Rationale

1. **Command Palette first** because it becomes the discoverability mechanism for everything else -- theme toggle, sample data, accessibility features can all be surfaced through the palette
2. **Theming second** because the WCAG contrast audit must verify both light and dark themes simultaneously; building light mode first avoids rework
3. **Accessibility third** because it needs stable themes to audit, and benefits from the command palette being navigable for keyboard-only testing
4. **Sample data last** because it depends on the app being accessible and themed -- first impressions with sample data should showcase the polished product

---

## Sources

### Command Palette
- [Superhuman: How to Build a Remarkable Command Palette](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/)
- [kbar: fast, portable, extensible cmd+k interface](https://github.com/timc1/kbar)
- [Command Palette UX Patterns (Medium)](https://medium.com/design-bootcamp/command-palette-ux-patterns-1-d6b6e68f30c1)
- [Fuse.js: Lightweight fuzzy search](https://www.fusejs.io/)
- [microfuzz: Tiny fuzzy search library](https://github.com/Nozbe/microfuzz)

### WCAG 2.1 AA Accessibility
- [Accessible D3 Data Visualizations (Fossheim)](https://fossheim.io/writing/posts/accessible-dataviz-d3-intro/)
- [Accessibility in D3 Bar Charts (a11y with Lindsey)](https://www.a11ywithlindsey.com/blog/accessibility-d3-bar-charts/)
- [W3C: SVG ARIA Roles for Charts](https://www.w3.org/wiki/SVG_Accessibility/ARIA_roles_for_charts)
- [Using ARIA to Enhance SVG Accessibility (TPGi)](https://www.tpgi.com/using-aria-enhance-svg-accessibility/)
- [WCAG SC 1.4.3 Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [WCAG SC 1.4.11 Non-Text Contrast](https://dequeuniversity.com/resources/wcag2.1/1.4.11-non-text-contrast)
- [WebAIM Contrast and Color Accessibility](https://webaim.org/articles/contrast/)
- [Sara Soueidan: Designing Accessible Focus Indicators](https://www.sarasoueidan.com/blog/focus-indicators/)
- [Smashing Magazine: Accessibility Standards for Chart Design](https://www.smashingmagazine.com/2024/02/accessibility-standards-empower-better-chart-visual-design/)

### Light/Dark/System Theme
- [MDN: CSS light-dark() function](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/light-dark)
- [CSS-Tricks: Come to the light-dark() Side](https://css-tricks.com/come-to-the-light-dark-side/)
- [web.dev: CSS color-scheme-dependent colors](https://web.dev/articles/light-dark)
- [MDN: prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
- [Supporting Dark Mode in WKWebView](https://useyourloaf.com/blog/supporting-dark-mode-in-wkwebview/)
- [WWDC19: Supporting Dark Mode in Web Content](https://developer.apple.com/videos/play/wwdc2019/511/)

### Sample Data / Empty States
- [Userpilot: Empty State in SaaS Applications](https://userpilot.com/blog/empty-state-saas/)
- [SaaS Onboarding Best Practices 2025 (Flowjam)](https://www.flowjam.com/blog/saas-onboarding-best-practices-2025-guide-checklist)
- [SaaS Onboarding Flow: Best Practices 2026 (DesignRevision)](https://designrevision.com/blog/saas-onboarding-best-practices)
