# Project Research Summary

**Project:** v11.0 Navigation Bar Redesign (Isometry)
**Domain:** Dock-style navigation UX, minimap thumbnails, iOS onboarding splash
**Researched:** 2026-04-08
**Confidence:** HIGH

## Executive Summary

The v11.0 Navigation Bar Redesign replaces the existing 8-section SidebarNav with a dock-style DockNav that supports three collapse states (hidden / icon-only / icon+thumbnail), reorganizes navigation under a verb-based taxonomy (Integrate / Visualize / Analyze / Activate / Help), and introduces per-view minimap thumbnails as a live preview mechanism. Research confirms the entire feature set is achievable using platform APIs already within the iOS 17+ / Safari 17+ baseline — zero new npm packages are required. The most technically demanding capability (minimap thumbnails) demands a hybrid SVG-serialization + OffscreenCanvas approach with strict lazy-render semantics to stay within the 16ms frame budget on WKWebView.

The architectural path is lower-risk than expected. The PanelDrawer/PanelRegistry plugin system already manages explorer panels independently of SidebarNav, so explorer decoupling is largely pre-solved. DockNav mounts in the same `.workbench-sidebar` slot via `WorkbenchShell.getSidebarEl()` and must replicate the SidebarNav callback interface precisely — the `"sectionKey:itemKey"` composite key string is load-bearing for ShortcutRegistry and auto-cycle and must not change. The iOS Stories splash is a SwiftUI `fullScreenCover` overlay that presents over an already-warm WKWebView; WASM initialization must remain unconditional in `IsometryApp.task{}` regardless of splash state.

Three HIGH-risk pitfalls dominate: silent keyboard shortcut breakage if the SidebarNav method interface is not fully replicated in DockNav; frame budget violations from synchronous minimap rendering; and WASM warm-up delay if the Stories splash gates native initialization. All three are preventable with the correct phase ordering — extract shared key definitions first, write regression tests before the swap, keep WASM init unconditional, and render thumbnails lazily and asynchronously only.

## Key Findings

### Recommended Stack

No new npm dependencies are needed. All four capability areas map to existing platform APIs. CSS Flexbox handles dock layout with a `--dock-width` CSS custom property driving the 3-state width transitions. The CSS `grid-template-rows: 0fr → 1fr` trick animates `height: auto` correctly on Safari 16+ (within the iOS 17 target) — it replaces the existing `max-height: 0 → 500px` magic-number hack with zero JS changes. The minimap requires a hybrid approach: `XMLSerializer` + `URL.createObjectURL` for SVG-heavy views (Network, Timeline, Calendar) and a simplified D3 micro-render to `OffscreenCanvas` for HTML-based views (Grid, List, Kanban, SuperGrid). Both APIs are confirmed available in Safari 16.4+ / iOS 17+. The `html2canvas` and `html-to-image` libraries must not be used — both are unreliable on WKWebView mixed SVG+HTML content. The View Transitions API (`document.startViewTransition()`) is off-limits — it requires Safari 18+, and the app targets iOS 17 (Safari 17 engine). The iOS Stories splash uses SwiftUI `TabView.tabViewStyle(.page)` + `fullScreenCover` — built-in, hardware-accelerated, iOS 14+, no Lottie or carousel library needed.

**Core technologies:**
- CSS Flexbox + `--dock-width` custom property: dock layout and 3-state width transitions — no JS layout engine needed
- CSS `grid-template-rows: 0fr → 1fr`: animates `height: auto` for collapse states — replaces existing max-height hack, Safari 16+
- `XMLSerializer` / `URL.createObjectURL`: SVG thumbnail serialization for Network/Timeline/Calendar — Safari 16.4+, confirmed available
- `OffscreenCanvas` + D3 micro-render: async thumbnail generation for HTML-based views — off-main-thread, never blocks frame budget
- SwiftUI `TabView.tabViewStyle(.page)` + `fullScreenCover` + `@AppStorage`: iOS Stories splash — built-in, no Lottie
- `@floating-ui/dom` v1.7.5 (already installed): available for dock tooltip positioning if inline labels prove insufficient

**Must NOT add:** `html2canvas`, `html-to-image`, View Transitions API polyfill, Lottie, any carousel library, native SwiftUI dock component.

### Expected Features

Full feature detail in `.planning/research/FEATURES.md`.

**Must have (table stakes):**
- Icon + label per dock item — `iconSvg()` already exists
- Hover tooltip for icon-only mode — native `title` attribute
- Active state indicator — CSS class on button
- Click-to-activate — preserves existing callback contract
- Dock collapse/expand toggle with mode persistence — `data-dock-mode` + ui_state
- Keyboard accessibility preservation — roving tabindex already exists, must not regress
- Smooth CSS width transition between modes
- Live thumbnail reflecting current data state — highest complexity table-stakes item
- Loupe/magnifier overlay on thumbnail hover — viewport indicator

**Should have (differentiators):**
- PAFV axis summary label in thumbnail — unique to PAFV architecture, low complexity add
- Verb-to-noun taxonomy (Integrate / Visualize / Analyze / Activate / Help) — conceptual model reorganization
- Stub dock entries for Maps / Formulas / Stories — placeholder UI, low effort

**Defer (follow-up milestone):**
- Stories Explorer as full mini-app launcher — HIGH complexity, new concept requiring its own milestone
- iOS splash screen full implementation — depends on Stories concept definition (platform split unresolved)
- Main window UX changes — explicitly deferred per milestone scope

**Anti-features (must not build):**
- Hover-to-activate — fires during cursor transit, triggers expensive SQL+D3 rerender
- Animated dock magnification macOS-style — layout shift defeats thumbnail usefulness
- Drag-and-drop dock reordering — breaks verb-noun taxonomy model
- All 9 view thumbnails simultaneously — performance budget violation
- Real-time thumbnail streaming on every data mutation — doubles render load
- Native SwiftUI dock — creates two sources of truth for dock state

### Architecture Approach

DockNav is a drop-in swap for SidebarNav in the existing `.workbench-sidebar` slot. WorkbenchShell requires only swapping the component in `getSidebarEl()`. The PanelDrawer/PanelRegistry/CollapsibleSection plugin architecture requires no changes — new panels (StoriesExplorer, Maps stub, Formulas stub) register via `PanelRegistry` and appear in the icon strip automatically. The critical prerequisite is extracting `SECTION_DEFS` (shared section/item key string constants) from SidebarNav into `src/ui/section-defs.ts` before writing DockNav, so both components share canonical key strings during transition and ShortcutRegistry bindings remain intact.

**New components:**
1. `src/ui/section-defs.ts` — shared `"sectionKey:itemKey"` constant definitions, extracted from SidebarNav first
2. `src/ui/DockNav.ts` — dock-style navbar implementing identical SidebarNav callback interface (`setActiveItem`, `onActivateItem`, `startCycle`/`stopCycle`, `updateRecommendations`)
3. `src/ui/MinimapRenderer.ts` — lazy thumbnail generation on hover only, hybrid SVG-serialization + OffscreenCanvas, never subscribed to StateCoordinator
4. `StoriesExplorer` PanelHook + Maps/Formulas stubs — registered via PanelRegistry, no changes to PanelDrawer
5. SwiftUI `fullScreenCover` splash — iOS Stories entry point gated by `@AppStorage("hasSeenWelcome")`

**Components requiring zero changes:** PanelDrawer, PanelRegistry, CollapsibleSection, ViewManager, ShortcutRegistry (if key convention preserved), StateCoordinator.

### Critical Pitfalls

Full detail in `.planning/research/PITFALLS.md`.

1. **Keyboard shortcut silent breakage** — DockNav must implement identical method signatures as SidebarNav. Write ShortcutRegistry regression tests before the swap. The `"sectionKey:itemKey"` string convention must be preserved exactly or Cmd+1-9 breaks silently.

2. **Minimap frame budget violation** — Synchronous DOM clone + scale at 96×48 can take 50-100ms, blowing the 16ms WKWebView frame budget. Render via `OffscreenCanvas` or `requestIdleCallback`, cache results, only re-render on view activation — never on data mutation, never all thumbnails simultaneously.

3. **WASM warm-up gated on Stories splash** — If `IsometryApp.task{}` waits for splash dismissal, the first SuperGrid render takes 3-5s instead of <1s. WASM init must remain unconditional. Splash is a SwiftUI overlay over an already-warm WKWebView.

4. **CSS layout breaks on sidebar column resize** — `workbench.css` has hardcoded pixel widths. Replace with `--dock-width` CSS custom property controlled by the 3-state collapse. Test all 5 themes × 3 dock states before merge.

5. **5-theme token coverage gap** — New dock tokens (e.g., `--dock-bg`, `--dock-icon-size`, `--dock-thumbnail-border`) must be declared in the base `:root` block with sensible defaults. Theme-specific overrides only where needed. Incomplete coverage causes silent fallback to wrong values in 4 of 5 themes.

6. **Explorer panel lifecycle leak** — `CollapsibleSection.destroy()` must be called on all existing panel instances before DockNav mounts. Use the `usePlugin` auto-destroy pattern from v8.3 as reference.

7. **Dual navigation ARIA landmark conflict** — Dock gets `role="tablist"` with `aria-label="Dock navigation"`. Ensure only one `role="navigation"` landmark exists in the document. Test with VoiceOver before merging.

## Implications for Roadmap

The dependency graph is clear and strongly constrains phase ordering. The SECTION_DEFS extraction is the critical gate — everything that follows depends on shared key constants existing before DockNav is written. MinimapRenderer depends on dock layout being stable and the thumbnail slot existing in the DOM. iOS Stories splash is fully independent of web-side work.

### Phase 1: SECTION_DEFS Extraction + Regression Baseline
**Rationale:** Load-bearing prerequisite with no user-visible change. ShortcutRegistry depends on the `"sectionKey:itemKey"` string convention. Extracting these constants to `section-defs.ts` before writing DockNav ensures both components share canonical strings during transition. Writing the keyboard shortcut regression test suite in this phase establishes a safety net for Phase 2.
**Delivers:** `src/ui/section-defs.ts`, ShortcutRegistry regression test suite covering Cmd+1-9, confirmed baseline for all existing keyboard navigation.
**Addresses:** Keyboard accessibility preservation (table stakes), test baseline.
**Avoids:** Pitfall #1 (silent keyboard shortcut breakage).

### Phase 2: DockNav Shell + SidebarNav Swap
**Rationale:** Highest-risk swap. Replaces SidebarNav in the `getSidebarEl()` slot with DockNav implementing the identical callback interface. Icon-only + label mode first (no thumbnails yet). Introduces `--dock-width` CSS custom property and verb-noun taxonomy restructuring. All 5 themes must receive full token coverage from day one.
**Delivers:** Functional dock navbar, icon + label display, active state indicator, click-to-activate, CSS width transition between modes, verb-noun section reorganization, `data-dock-mode` persistence.
**Uses:** CSS Flexbox, CSS custom properties, `@floating-ui/dom` if inline labels are insufficient.
**Implements:** DockNav, section-defs shared keys, `--dock-width` custom property.
**Avoids:** Pitfall #1 (interface match enforced by tests), Pitfall #3 (CSS custom property replaces hardcoded widths), Pitfall #4 (full theme token coverage from start), Pitfall #6 (destroy() lifecycle verified before swap).

### Phase 3: 3-State Collapse + Accessibility
**Rationale:** Collapse states depend on dock layout being stable. ARIA roles and roving tabindex must be validated before thumbnails add more DOM complexity. Sequencing accessibility work here ensures VoiceOver is clean before Phase 4 introduces more overlay DOM.
**Delivers:** Hidden / icon-only / icon+thumbnail 3-state CSS transitions (`grid-template-rows: 0fr → 1fr`), `data-dock-mode` persistence via ui_state, `role="tablist"` ARIA wiring with `aria-label="Dock navigation"`, VoiceOver regression pass.
**Uses:** CSS `grid-template-rows: 0fr → 1fr` animation — zero JS changes.
**Avoids:** Pitfall #7 (landmark conflict resolved here), WCAG 2.1 AA regression.

### Phase 4: MinimapRenderer + Loupe
**Rationale:** Most technically complex piece. Must follow dock layout stabilization — the thumbnail slot must exist in the dock DOM before MinimapRenderer wires to it. Lazy-on-hover semantics are non-negotiable for frame budget compliance.
**Delivers:** `src/ui/MinimapRenderer.ts` with hybrid SVG-serialization (Network/Timeline/Calendar) + OffscreenCanvas (Grid/List/Kanban/SuperGrid) strategy, 96×48 cached snapshots per view type, loupe/magnifier overlay on thumbnail hover, `data-minimap-scroll-root` on explorer scroll containers.
**Addresses:** Live thumbnail table-stakes requirement, loupe differentiator.
**Avoids:** Pitfall #2 (async render via `requestIdleCallback`/`OffscreenCanvas`, cache aggressively, never subscribe to StateCoordinator, never render all simultaneously).

### Phase 5: New Panel Stubs + PanelRegistry Registrations
**Rationale:** Independent of thumbnail work. StoriesExplorer, Maps stub, and Formulas stub register as PanelHook entries — no changes to PanelDrawer or PanelRegistry internals. The PAFV axis summary label in thumbnail is a low-effort differentiator that can land here.
**Delivers:** Three new PanelHook registrations appearing in dock icon strip (StoriesExplorer, Maps stub, Formulas stub), PAFV axis summary label in thumbnail caption.
**Addresses:** Stub dock entries differentiator, Stories placeholder concept.
**Avoids:** Pitfall #6 (destroy() lifecycle on any panel migration verified).

### Phase 6: iOS Stories Splash
**Rationale:** Fully independent of web-side work — pure SwiftUI. Must be gated strictly on `@AppStorage("hasSeenWelcome")` with WASM warm-up remaining unconditional. Sequenced last because the StoriesExplorer concept definition (platform split: full-bleed view vs. panel) must be resolved before implementation scope can be written.
**Delivers:** SwiftUI `fullScreenCover` splash with `TabView.tabViewStyle(.page)` iOS Stories UX, permanently dismissed after first run.
**Uses:** SwiftUI native APIs only — no Lottie, no web carousel.
**Avoids:** Pitfall #5 (WASM warm-up unconditional in `IsometryApp.task{}`).

### Phase Ordering Rationale

- Phases 1 and 2 are strictly ordered by dependency: key extraction must precede DockNav construction.
- Phase 3 follows Phase 2: collapse states require a stable dock DOM structure; accessibility audit before more DOM complexity.
- Phase 4 follows Phase 3: the thumbnail slot in the dock DOM (created in Phase 3 for the icon+thumbnail state) must exist before MinimapRenderer wires to it.
- Phase 5 is largely independent and could overlap with Phase 4 if parallelized, but must follow Phase 2 so PanelRegistry registrations have a live dock to appear in.
- Phase 6 is fully independent of web-side work and can be parallelized with Phases 2-5 if native dev capacity allows, subject to StoriesExplorer concept resolution.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (MinimapRenderer):** The SVG-serialization vs. OffscreenCanvas branch logic should be prototyped on-device (WKWebView on iOS 17) to confirm OffscreenCanvas availability and render performance before committing to the hybrid strategy. The loupe overlay scroll-root detection (`data-minimap-scroll-root`) needs mapping to actual current DOM structure.
- **Phase 6 (iOS Stories Splash):** Whether Stories is a full-bleed view replacement (ViewManager) on iOS vs. a panel in PanelDrawer on macOS is unresolved — this is a product decision that must precede Phase 6 scope writing.

Phases with standard patterns (skip research-phase):
- **Phase 1 (SECTION_DEFS):** Pure extraction refactor with no behavioral change, well-understood.
- **Phase 2 (DockNav Shell):** CSS Flexbox dock pattern is well-documented; SidebarNav callback interface replication is mechanical.
- **Phase 3 (3-State Collapse):** CSS `grid-template-rows` animation and ARIA tablist pattern are both standard, well-documented.
- **Phase 5 (Panel Stubs):** PanelRegistry/PanelHook pattern is proven from v8.1 and v8.3.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All APIs (XMLSerializer, OffscreenCanvas, CSS grid-template-rows, SwiftUI page TabView) directly verified against Safari 16.4+ / iOS 17+ compatibility. View Transitions API exclusion is a hard version constraint. Zero new packages. |
| Features | HIGH | Dependency graph matches existing codebase architecture. Anti-features are grounded in specific performance and UX failure modes. Competitor analysis (macOS Dock, VS Code, Figma, Notion Mobile, iOS Shortcuts) validates taxonomy choices. |
| Architecture | HIGH | DockNav as drop-in swap confirmed by analysis of WorkbenchShell `getSidebarEl()` slot. PanelRegistry plugin pattern is proven across v8.1 and v8.3. SECTION_DEFS extraction path is unambiguous. |
| Pitfalls | HIGH | All 7 pitfalls derived from direct codebase analysis: ShortcutRegistry interface, `workbench.css` hardcoded widths, frame budget characteristics of WKWebView DOM serialization, WASM warm-up location in `IsometryApp.task{}`, `usePlugin` destroy pattern in v8.3. |

**Overall confidence:** HIGH

### Gaps to Address

- **MinimapRenderer render path validation:** The hybrid SVG-serialization vs. OffscreenCanvas strategy should be prototyped on a real device before Phase 4 implementation begins. Thumbnail render timing estimate (50-100ms) is inferred from general DOM serialization benchmarks, not measured directly on WKWebView.
- **StoriesExplorer platform split:** Whether Stories is a full-bleed view (iOS) vs. panel (macOS) is a product decision that is unresolved. This gap must be closed before Phase 6 scope is written.
- **Minimap update timing policy:** Whether thumbnails update only on view activation or in real-time (with debounce) is unresolved. Research recommends activation-only for frame budget safety, but this is a product preference. Affects MinimapRenderer debounce strategy.
- **Dock label display mode:** Inline labels below icons (CSS-only, simpler) vs. floating overlays (requires `@floating-ui/dom`) is unresolved. Inline should be the default assumption unless designs require otherwise.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `SidebarNav`, `WorkbenchShell`, `ShortcutRegistry`, `PanelDrawer`, `PanelRegistry`, `CollapsibleSection`, `workbench.css` — integration points and callback interface contracts
- Direct codebase analysis: `IsometryApp.task{}` WASM warm-up sequence — basis for Pitfall #5 prevention strategy
- Safari browser compatibility data: `XMLSerializer`, `OffscreenCanvas`, `CSS grid-template-rows` animation, `document.startViewTransition` — stack decisions
- SwiftUI documentation: `TabView.tabViewStyle(.page)`, `fullScreenCover`, `@AppStorage` — iOS Stories splash implementation

### Secondary (MEDIUM confidence)
- Competitor UX patterns: macOS Dock (icon+label model), VS Code Activity Bar (icon-only active state), Figma left panel (collapsible section headers), Notion Mobile (app launcher home grid), iOS Shortcuts (gallery of mini-apps)
- CSS `grid-template-rows: 0fr → 1fr` animation technique — community-documented `height: auto` animation workaround, Safari 16+ support confirmed
- v8.3 `usePlugin` auto-destroy pattern — reference for Pitfall #6 explorer panel lifecycle cleanup

### Tertiary (LOW confidence)
- Minimap thumbnail render timing (50-100ms per 96×48 DOM clone) — estimated from general DOM serialization benchmarks; not measured on WKWebView specifically; needs device validation during Phase 4 planning

---
*Research completed: 2026-04-08*
*Ready for roadmap: yes*
