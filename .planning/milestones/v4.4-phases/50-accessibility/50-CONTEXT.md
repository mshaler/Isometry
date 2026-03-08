# Phase 50: Accessibility - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Users who rely on screen readers, keyboard navigation, or adjusted display settings can operate the full application — every view, every interaction, every state change is perceivable and operable. This phase makes the existing 9 views, toolbar, SuperGrid, and import/filter flows accessible. No new features are added.

</domain>

<decisions>
## Implementation Decisions

### Screen Reader Announcements
- Summary-level announcements when landing on SVG views: "Network view, 42 cards" — concise orientation, not verbose
- Individual SVG cards ARE reachable by screen readers (SVG `<title>` + role pattern) — each card reads its title/source/date
- SuperGrid uses ARIA table/grid roles — VoiceOver announces "Row 3, Column: Status, Value: In Progress" with full structural context
- Single persistent `aria-live="polite"` region for ALL announcements: view switches, filter changes, import completions — messages queue, no overlap
- Existing ActionToast and ImportToast already have `aria-live="polite"` — extend this pattern to a centralized announcer

### Keyboard Navigation
- Tab into view container, then arrow keys navigate between cards — Escape exits back to toolbar (composite widget pattern)
- Network view arrow keys use spatial nearest-neighbor logic — NOT connection-based graph traversal
- Visual focus indicator: 2px solid accent-color ring (var(--accent), 2px offset) — matches existing focus-visible CSS pattern
- Toolbar acts as grouped Tab stop with arrow key internal navigation: skip-link → toolbar (arrows between buttons) → view content — minimal Tab presses to reach content
- Enter/Space activates focused elements throughout

### Contrast & Color Tokens
- Fix existing design token values in-place so ALL colors pass WCAG 2.1 AA (4.5:1 text, 3:1 UI components) — no separate high-contrast mode, accessible by default
- Source provenance pastels (Apple Notes yellow, Markdown purple, CSV green, etc.) adjusted per-shade to pass 4.5:1 against their backgrounds while keeping hue family recognizable
- Automated contrast-ratio tests verify every token pair (text-on-bg, accent-on-bg, source-on-bg) — prevents regression
- Audit overlay (new/modified/deleted) uses shape+color: + for new, ~ for modified, × for deleted — never rely on color alone for differentiation

### Reduced Motion
- All D3 transitions snap to 0ms when `prefers-reduced-motion: reduce` is active — morphTransition, crossfadeTransition, and CSS transitions all instant
- Force-directed network simulation pre-computes to equilibrium (tick loop in Worker), then renders final positions in one frame — no visible animation
- Detection: CSS `@media (prefers-reduced-motion: reduce)` for CSS transitions + JS `matchMedia('(prefers-reduced-motion: reduce)')` for D3 duration control — complete coverage
- OS setting only — no in-app "Reduce Motion" toggle

### Claude's Discretion
- Exact ARIA landmark structure (which elements get role="main", role="navigation", etc.)
- Skip-to-content link positioning and styling (visually hidden until focused)
- How to handle keyboard focus when view switches (auto-focus first card? announce and wait?)
- Whether TreeView expand/collapse should use Enter or arrow-right/left convention
- CSS utility class naming for screen-reader-only text (.sr-only vs .visually-hidden)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ActionToast` / `ImportToast`: Already have `aria-live="polite"` — pattern for centralized announcer
- `ShortcutRegistry`: Single keydown listener with input field guard — extend for arrow-key navigation within views
- `focus-visible` CSS: Outlines defined for buttons, tabs, cards, data-cells, gallery tiles — extend to SVG focus indicators
- `ThemeProvider`: matchMedia pattern for `prefers-color-scheme` — reuse for `prefers-reduced-motion` detection
- Design tokens CSS: `--accent` color already used for focus rings — consistent focus styling

### Established Patterns
- D3 data join on all SVG views (list, grid, timeline, network, tree) — can add ARIA attrs via `.attr()` chain
- `morphTransition` (400ms) and `crossfadeTransition` (300ms) in `transitions.ts` — centralized place to add reduced-motion guard
- `ViewManager.switchTo()` manages view lifecycle — single integration point for announcing view changes
- SuperGrid builds DOM via `document.createElement` — can add ARIA table roles at creation time

### Integration Points
- `ViewManager` → announce view switches via aria-live region
- `StateCoordinator` subscriptions → announce filter/sort changes
- `transitions.ts` → reduced-motion duration override
- `design-tokens.css` → contrast-adjusted token values
- `CardRenderer.ts` → SVG `<title>` elements and ARIA attributes per card
- Force simulation Worker → pre-compute mode for reduced motion
- `main.ts` → skip-to-content link injection, landmark roles

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard WCAG 2.1 AA approaches. Key references:
- Composite widget pattern (Tab → container, arrows within, Escape out) for SVG views
- ARIA grid pattern for SuperGrid structural navigation
- matchMedia dual detection (CSS + JS) for comprehensive reduced-motion support

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 50-accessibility*
*Context gathered: 2026-03-07*
