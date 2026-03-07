# Project Research Summary

**Project:** Isometry v5 -- v4.4 UX Complete
**Domain:** Command palette, WCAG 2.1 AA accessibility, light/dark theming, enhanced empty states with sample data
**Researched:** 2026-03-07
**Confidence:** HIGH

## Executive Summary

v4.4 is a pure UX milestone that adds four user-facing capabilities to a mature, 48-phase, 27K+ LOC TypeScript + 7K Swift codebase. The existing architecture is well-prepared for these additions: the CSS design token system, ShortcutRegistry, ViewManager empty states, and NativeBridge all have explicit extension points that these features slot into. The recommended approach adds exactly ONE new runtime dependency (fuse.js, ~5kB gzipped for command palette fuzzy search) and ZERO new database schema changes, bridge message types, providers, or Worker handlers. All four features are main-thread UI concerns that do not touch the Worker, database schema, or core data flow.

The recommended build order is Theme first, then Accessibility, then Command Palette, then Sample Data. This ordering is driven by hard dependency chains: the WCAG contrast audit must verify both light and dark themes simultaneously (so theming must ship first), the command palette needs ARIA combobox patterns established by the accessibility phase, and sample data should showcase the polished final product. Research across all four areas converged on this same ordering despite each researcher working independently, which is a strong signal.

The dominant risk is the SVG accessibility gap. All five SVG-based views (List, Grid, Timeline, Network, Tree) plus SuperGrid have zero ARIA attributes today. The only existing ARIA usage in the entire codebase is `aria-live="polite"` on toasts. This makes the accessibility phase the largest and most complex body of work in the milestone. Additionally, hardcoded hex colors in `audit-colors.ts` and `NetworkView` will break under light theme -- these must be migrated to CSS custom property references as a prerequisite for shipping light mode. A secondary risk is CloudKit sync contamination: sample data must be guarded from the sync pipeline using a dedicated `__sample__` source value.

## Key Findings

### Recommended Stack

The existing stack is locked and sufficient. v4.4 needs one new dependency.

**Core technologies:**
- **fuse.js 7.1.0**: Client-side fuzzy search for command palette (~5kB gzipped) -- weighted multi-key search across heterogeneous item types (actions, views, shortcuts, settings). STACK.md recommends it; ARCHITECTURE.md suggests a simpler `includes()` scorer may suffice for ~60 static items. Recommendation: start with built-in scoring for static sources, use fuse.js as an upgrade if the simple approach feels inadequate. Either way, card search uses existing FTS5.
- **CSS `[data-theme]` attribute selector**: Theme switching mechanism -- mandatory because CSS `light-dark()` requires Safari 17.5+ and the project targets iOS 17.0+. All four research files converge on this approach.
- **Vanilla TypeScript + existing systems**: Command palette UI, accessibility manager, sample data loader, theme manager -- all built with existing patterns (HelpOverlay pattern for overlays, CustomEvent dispatch for integration, StateManager for persistence).

**Critical version constraint:** iOS 17.0+ minimum target means `light-dark()` CSS function is NOT usable. `[data-theme]` attribute approach is the only viable path. Both STACK.md and PITFALLS.md flag this independently.

### Expected Features

**Must have (table stakes):**
- Command palette with Cmd+K trigger, fuzzy search, keyboard navigation (arrows + Enter + Escape), action items, card search, shortcut hints
- Text contrast 4.5:1 and non-text contrast 3:1 (WCAG 1.4.3 / 1.4.11)
- Focus visible indicators on all interactive elements
- ARIA roles on SVG view roots and interactive card groups
- Light mode color scheme with full token mapping
- 3-way theme toggle (Light / Dark / System) persisted to StateManager
- "Try sample data" CTA in welcome panel with one-click load

**Should have (differentiators):**
- Recent commands section in palette
- Categorized result groups (Views, Actions, Cards, Settings)
- Contextual commands (show "Clear Filters" only when filters active)
- Reduced motion support (`prefers-reduced-motion`)
- Screen reader announcements for view switches and state changes
- Smooth 150ms theme transition
- Per-view sample data diversity (dates for calendar, connections for network)

**Defer (v2+):**
- Full ARIA grid pattern on SuperGrid (use `role="table"` initially -- FEATURES.md anti-feature)
- Screen reader data table alternatives for SVG views (high complexity)
- Roving tabindex on all SVG views (progressive enhancement)
- Custom keyboard shortcut remapping
- WCAG AAA compliance
- AI/LLM integration in command palette

### Architecture Approach

All four features are main-thread UI overlays and CSS extensions that integrate with existing architectural seams. No new providers, no new bridge message types, no new Worker handlers. The theme system restructures `design-tokens.css` into dark/light/system blocks with a `ThemeManager` class that sets `data-theme` on `:root`. The command palette follows the HelpOverlay pattern (imperative DOM, CSS class toggle, mount/destroy lifecycle) with a `CommandSource` interface for pluggable search providers. Accessibility is applied INSIDE D3 data joins (not post-render), respecting D3 ownership of the DOM. Sample data flows through the real ETL pipeline (DedupEngine + SQLiteWriter) for full fidelity.

**Major new components:**
1. **ThemeManager** (`src/ui/ThemeManager.ts`) -- 3-way toggle, localStorage persistence, matchMedia system listener, `data-theme` attribute control
2. **CommandPalette** (`src/ui/CommandPalette.ts`) -- overlay with search input, keyboard navigation, CommandSource interface for extensible providers (Actions, Shortcuts, Cards, Settings)
3. **AccessibilityManager** (`src/accessibility/AccessibilityManager.ts`) -- skip nav link, `aria-live` announcements, focus management on view switch
4. **SampleDataLoader** (`src/data/SampleDataLoader.ts`) -- loads ~30-50 hand-crafted CanonicalCards through existing ETL pipeline

**Unchanged components:** WorkerBridge, Worker handlers, all Providers, StateCoordinator, MutationManager, QueryBuilder, database schema, ETL parsers. This is a low-risk surface.

### Critical Pitfalls

1. **Hardcoded hex colors in SVG break theme switching** -- `audit-colors.ts` exports literal hex strings consumed by CardRenderer `.attr('fill', ...)`, and NetworkView uses `d3.scaleOrdinal(d3.schemeCategory10)`. These will be invisible or low-contrast on light backgrounds. **Prevention:** Migrate ALL hex to `var()` CSS custom properties before shipping light mode. Safari 16+ supports `var()` in SVG attributes (within target).

2. **D3-generated SVG has zero accessibility semantics** -- All 5 SVG views have no ARIA roles, no tabindex, no keyboard navigation. Only existing ARIA in the codebase is `aria-live` on toasts. This is the largest single work item. **Prevention:** Add ARIA attributes inside D3 `.enter()` and merge selections, not post-render. Budget significant time; 5 views + SuperGrid each need full annotation.

3. **SuperGrid CSS Grid lacks data grid ARIA pattern** -- No `role="grid"`, no `aria-rowcount`/`aria-colcount`, no keyboard cell navigation. Virtual scrolling complicates screen reader row announcements because off-screen rows are removed from DOM. **Prevention:** Implement ARIA grid roles, update `aria-rowindex` on scroll, use `role="table"` as pragmatic starting point rather than full WAI-ARIA grid.

4. **WKWebView swallows dynamic accessibility updates** -- VoiceOver in WKWebView does not automatically re-scan the accessibility tree on DOM changes. VoiceOver cursor becomes stuck on phantom elements after view switches. **Prevention:** Post `UIAccessibility.post(notification: .layoutChanged)` from Swift after view switches via `native:action` bridge message.

5. **Sample data syncs to CloudKit and pollutes real data** -- MutationManager notifications trigger CKSyncEngine pending changes for every INSERT. **Prevention:** Use `source = '__sample__'` and either bypass MutationManager for sample insertion or guard the sync pipeline to filter sample-source mutations.

6. **Cmd+K conflicts with ShortcutRegistry input guard** -- ShortcutRegistry returns early when target is `INPUT`, but the palette's search input needs Escape/arrows/Enter. Competing modals (help overlay + palette) create focus chaos. **Prevention:** Palette uses its own keydown listener with `stopPropagation()`; add `suspend()`/`resume()` to ShortcutRegistry; implement modal manager for mutual exclusion.

## Implications for Roadmap

Based on combined research, the milestone should have 4 phases in strict dependency order:

### Phase 1: Theme System (Light / Dark / System)

**Rationale:** Theme restructures `design-tokens.css` -- the foundational CSS that all views reference. Every CSS written in later phases must be theme-aware from the start. The WCAG contrast audit (Phase 2) must verify both themes. This MUST come first.
**Delivers:** ThemeManager class, light-mode token definitions (~25-30 overrides), `[data-theme]` attribute controller, `@media (prefers-color-scheme)` system fallback, StateManager persistence, SwiftUI `preferredColorScheme()` sync via existing `native:action` bridge pattern, SVG color migration (audit-colors.ts + NetworkView hex-to-var).
**Addresses features:** Light/dark/system theme toggle (table stakes), theme-aware SVG fills (table stakes), native shell theme sync (table stakes)
**Avoids pitfalls:** #1 (hardcoded hex), #7 (prefers-color-scheme in WKWebView), #9 (contrast per theme), #10 (D3 .style() vs .attr())
**Estimated complexity:** Medium -- mostly CSS token work + one small TypeScript class + SVG color audit

### Phase 2: WCAG 2.1 AA Accessibility

**Rationale:** Needs finalized color tokens from Phase 1 for contrast audit across both themes. Establishes ARIA patterns that Phase 3 (command palette) will follow. This is the largest and most complex phase.
**Delivers:** AccessibilityManager class, ARIA roles on all 9 views + SuperGrid, `aria-live` announcements, skip navigation, focus management on view switch, contrast ratio fixes (especially `--text-muted`), `tabindex` on SVG card groups, `role="dialog"` on overlays, focus traps, `prefers-reduced-motion` support, Dynamic Type CSS integration, keyboard enhancements.
**Addresses features:** All WCAG 2.1 AA table stakes -- contrast, focus visible, keyboard operability, ARIA roles, screen reader announcements
**Avoids pitfalls:** #2 (SVG zero ARIA), #3 (SuperGrid ARIA), #4 (WKWebView staleness), #11 (virtual scrolling screen reader), #15 (arrow keys vs scroll), #16 (px font sizes)
**Estimated complexity:** HIGH -- this is the largest phase. 5 SVG views + SuperGrid + 3 overlays all need ARIA annotation. Consider splitting into sub-phases: (a) contrast + tokens + reduced motion, (b) SVG view ARIA + keyboard, (c) SuperGrid ARIA + focus traps.

### Phase 3: Command Palette (Cmd+K)

**Rationale:** Depends on ShortcutRegistry (exists), ViewManager (exists), WorkerBridge FTS5 (exists). Benefits from theme-aware styles (Phase 1) and follows ARIA combobox patterns (Phase 2). The palette becomes the discoverability mechanism for theme switching, sample data, and all other actions.
**Delivers:** CommandPalette overlay with Cmd+K trigger, CommandSource interface (ActionsSource, ShortcutsSource, CardsSource, SettingsSource), fuzzy search over static items + FTS5 card search, keyboard navigation (arrows + Enter + Escape), focus trap, `role="combobox"` + `role="listbox"` ARIA pattern, modal manager (mutual exclusion with help overlay), ShortcutRegistry suspend/resume.
**Addresses features:** Command palette table stakes + differentiators (recent commands, categorized sections, contextual commands, shortcut hints)
**Avoids pitfalls:** #5 (Cmd+K ShortcutRegistry conflict), #8 (focus trap), #12 (competing modals)
**Estimated complexity:** Medium -- ~200 LOC TypeScript + ~80 LOC CSS following established HelpOverlay pattern

### Phase 4: Enhanced Empty States + Sample Data

**Rationale:** Simplest feature; benefits from all prior work. Sample data renders in the accessible, themed, command-palette-discoverable app. First impressions with sample data should showcase the polished product. Must address CloudKit sync contamination.
**Delivers:** SampleDataLoader class, ~30-50 hand-crafted CanonicalCards + connections covering all 5 card_types, "Load Sample Data" button in welcome panel, `source = '__sample__'` for identification and cleanup, "Clear Sample Data" action (accessible via command palette), sync pipeline guard.
**Addresses features:** Enhanced empty states table stakes + differentiators (per-view coverage, explore views guidance)
**Avoids pitfalls:** #6 (CloudKit sync contamination), #13 (source ID collision), #14 (empty state transitions)
**Estimated complexity:** Low -- extends ViewManager._showWelcome() + ~5KB fixture file + sync guard

### Phase Ordering Rationale

- **Theme before Accessibility** because the contrast audit must verify BOTH themes. Building accessibility on dark-only tokens means rework when light mode arrives.
- **Accessibility before Command Palette** because the palette needs `role="combobox"` + `role="listbox"` ARIA patterns and focus trap patterns that should be established project-wide first.
- **Command Palette before Sample Data** because "Clear Sample Data" should be discoverable via the palette. Also, the palette provides the discoverability mechanism for the theme toggle.
- **Sample Data last** because it is the simplest feature and benefits from showcasing the fully polished product.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Accessibility):** The SVG ARIA annotation across 5 views + SuperGrid + WKWebView dynamic update behavior needs careful per-view analysis. Consider `/gsd:research-phase` for the SuperGrid ARIA sub-task specifically, given the interaction between virtual scrolling, data windowing, and screen reader row announcements.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Theme):** Well-documented CSS custom property theming. `[data-theme]` attribute pattern is established. The SVG color migration is mechanical (grep + replace).
- **Phase 3 (Command Palette):** Well-documented combobox ARIA pattern. HelpOverlay provides exact code template. ShortcutRegistry integration is straightforward.
- **Phase 4 (Sample Data):** Existing ETL pipeline handles everything. The only design decision is the sample card corpus (hand-crafted fixtures).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations verified against official docs, browser compat tables, and existing codebase. The only new dependency (fuse.js) is a 3.5M weekly download, zero-dependency library. Minor disagreement between STACK.md (recommends fuse.js) and ARCHITECTURE.md (suggests built-in scorer) -- low risk either way. |
| Features | HIGH | Feature set drawn from established products (Linear, Superhuman, Notion, VS Code). WCAG 2.1 AA is a formal spec with mechanical compliance criteria. No ambiguity in what "done" means. |
| Architecture | HIGH | All four features integrate with existing architectural seams. No new providers, bridge types, or Worker handlers. ARCHITECTURE.md's component boundaries align perfectly with FEATURES.md's dependency graph. |
| Pitfalls | HIGH | Pitfalls derived from direct codebase inspection (file/line references provided) plus verified web research. The SVG hex color issue and CloudKit sync contamination are concrete, reproducible problems with clear prevention strategies. |

**Overall confidence:** HIGH

### Gaps to Address

- **WKWebView accessibility testing gap:** PITFALLS.md flags that VoiceOver behavior in WKWebView differs from Safari. No automated testing path exists -- manual VoiceOver testing in the running native app is required. Consider making VoiceOver pass-through testing a per-view acceptance criterion.
- **Light theme color palette not yet defined:** STACK.md and ARCHITECTURE.md both propose example light-mode token values, but neither has verified them against all 9 source provenance colors and 3 audit indicator colors. The actual hex values need to be defined and contrast-checked during Phase 1 implementation.
- **Fuzzy search library decision:** STACK.md recommends fuse.js; ARCHITECTURE.md recommends no library. Resolve during Phase 3 planning -- start with built-in scoring, add fuse.js only if needed.
- **SuperGrid ARIA scope:** Both FEATURES.md and PITFALLS.md flag this as the single most complex accessibility task. Consider `role="table"` as the pragmatic Phase 2 target, with full `role="grid"` deferred to a future phase if VoiceOver testing reveals insufficiency.
- **Dynamic Type scaling factor:** STACK.md describes a CSS approach using `-apple-system-body` font; ARCHITECTURE.md does not detail it; PITFALLS.md flags fixed px as a concern. The bridge-forwarded scaling factor approach needs validation during Phase 2.

## Sources

### Primary (HIGH confidence -- official docs + codebase inspection)
- [WCAG 2.1 Specification](https://www.w3.org/TR/WCAG21/) -- accessibility criteria
- [WAI-ARIA 1.2 Specification](https://www.w3.org/TR/wai-aria-1.2/) -- role/state/property reference
- [Fuse.js Official Documentation](https://www.fusejs.io/) -- fuzzy search API
- [MDN: prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme) -- media query
- [MDN: CSS light-dark() function](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/light-dark) -- browser compat (Safari 17.5+)
- [Safari 17.5 Features (WebKit Blog)](https://webkit.org/blog/15383/webkit-features-in-safari-17-5/) -- confirms light-dark() Safari 17.5+ requirement
- [Using Dynamic Type with Web Views (Use Your Loaf)](https://useyourloaf.com/blog/using-dynamic-type-with-web-views/) -- WKWebView font scaling
- Direct codebase inspection: audit-colors.ts, CardRenderer.ts, NetworkView.ts, ShortcutRegistry.ts, design-tokens.css, SuperGrid.ts, NativeBridge.ts

### Secondary (MEDIUM confidence -- community guides + verified patterns)
- [Accessible D3 Data Visualizations (Fossheim)](https://fossheim.io/writing/posts/accessible-dataviz-d3-intro/) -- SVG ARIA patterns
- [SVG ARIA Roles for Charts (W3C Wiki)](https://www.w3.org/wiki/SVG_Accessibility/ARIA_roles_for_charts) -- chart accessibility
- [Smashing Magazine: Color Scheme Preferences](https://www.smashingmagazine.com/2024/03/setting-persisting-color-scheme-preferences-css-javascript/) -- data-theme pattern
- [Superhuman: Command Palette UX](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/) -- palette design
- [AG Grid Accessibility](https://www.ag-grid.com/javascript-data-grid/accessibility/) -- data grid ARIA reference
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) -- contrast verification tool
- [Apple Developer Forums: WKWebView VoiceOver](https://developer.apple.com/forums/thread/655069) -- WKWebView accessibility limitations

### Tertiary (LOW confidence -- needs validation during implementation)
- [WebKit Bug #203798](https://bugs.webkit.org/show_bug.cgi?id=203798) -- WKWebView accessibility focus bug (open issue, behavior may vary by OS version)
- [D3.js .attr vs .style specificity](https://medium.com/@eesur/d3-attr-css-style-36f01966db88) -- SVG attribute vs inline style behavior

---
*Research completed: 2026-03-07*
*Ready for roadmap: yes*
