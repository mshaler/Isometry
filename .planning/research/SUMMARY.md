# Project Research Summary

**Project:** Isometry v4.2 -- Polish + QoL
**Domain:** Build health fixes, UX polish (empty states, keyboard shortcuts, visual refinements), stability hardening, ETL end-to-end validation
**Researched:** 2026-03-07
**Confidence:** HIGH -- polish milestone on a mature codebase; all work modifies existing components with established patterns; no new architectural modules; all pitfalls derived from direct codebase inspection

## Executive Summary

Isometry v4.2 is a polish milestone for a 30K+ LOC local-first data projection app with 9 views, 9 import sources, and a dual TypeScript/Swift codebase. The guiding principle is **fix and refine, not add**. Research across stack, features, architecture, and pitfalls converges on a single conclusion: the codebase has accumulated build health debt (314 TypeScript strict mode errors, a broken Xcode build phase, missing CI, no linting) and UX gaps (generic empty states, no first-launch experience, fragmented keyboard shortcuts, inconsistent visual tokens) that, taken together, make the app feel unfinished despite shipping substantial functionality through v4.1. Only one new dev dependency is justified: Biome 2.x for unified linting/formatting. Everything else is achievable with existing tools and hand-written CSS/TypeScript.

The recommended approach is to fix the foundation first (TypeScript strict mode, Xcode build phase, CI pipeline with Biome) then layer UX improvements in dependency order: context-aware empty states with first-launch welcome, centralized keyboard shortcuts with a global help overlay, visual consistency via design token extension, and finally an ETL end-to-end validation pass across the 9-source x 9-view matrix. No new modules, no new abstractions, no new bridge message types. Two new internal components are needed: a lightweight ShortcutRegistry (~80 LOC) to centralize 4 independent keydown listener layers, and a HelpOverlay (~60 LOC) for shortcut discoverability.

The primary risks are concentrated in two areas. First, the TypeScript strict mode fix cascade: 314 errors across 26 files where "mechanical" TS4111 bracket-notation fixes are safe but TS2345/TS2322 type-narrowing fixes can introduce subtle runtime behavior changes if done carelessly. Mitigation: fix by error type in batches, run tests after each batch. Second, empty state DOM injection: the codebase has three inconsistent empty state patterns across ViewManager, NetworkView/TreeView, and KanbanView. Adding view-specific empty states inside view containers would corrupt D3 data joins. Mitigation: keep all empty state logic in ViewManager as the single source of truth, never inject DOM into view-managed subtrees.

## Key Findings

### Recommended Stack

v4.2 adds exactly one dependency: Biome 2.x (dev-only) for unified TypeScript/CSS/JSON linting and formatting. The existing locked stack (TypeScript 5.9, sql.js 1.14, D3.js v7.9, Vite 7.3, Vitest 4.0, Swift/SwiftUI/WKWebView) is unchanged. No keyboard shortcut library is needed (15 bindings is within hand-roll territory and the codebase already has 7 working keydown handlers). No illustration library is needed (9 inline SVGs at ~500 bytes each, themed via CSS custom properties). No accessibility testing library is needed yet (the app has 1 ARIA attribute total -- manual ARIA addition is higher value than automated scanning at this stage).

**Core technologies:**
- **Biome 2.x:** Unified linter + formatter -- replaces the ESLint + Prettier gap with a single Rust-based tool, 15x faster, near-zero config via `biome.json`
- **GitHub Actions CI:** Minimal workflow running `tsc --noEmit`, `biome check`, `vitest --run` on push/PR -- prevents the 314-error regression from recurring
- **ShortcutRegistry (internal):** Centralizes 4 independent keydown listener layers into a single `document.addEventListener` with shared input field guard and `getAll()` for help overlay rendering
- **Inline SVG + CSS:** Empty state illustrations using `currentColor` and design tokens, ~500 bytes per icon, no asset loading overhead

### Expected Features

**Must have (table stakes):**
- Contextual empty states: first-use ("Import data to get started" + CTA) vs. filtered-out ("No cards match current filters" + Clear Filters) -- every Notion/Airtable/Linear user expects this
- Per-view empty states: Network says "No connections found," Calendar says "No dated cards" -- 6 of 9 views currently render nothing when empty
- First-launch welcome panel: single centered panel with import CTAs, not a multi-step wizard
- Global keyboard shortcuts: Cmd+1-9 for view switching (universal in multi-view macOS apps), View menu in menu bar
- Keyboard shortcut discoverability: global help overlay (reuse SuperGrid's pattern), toolbar "?" button
- Build health: TypeScript strict mode (314 errors), Xcode npm build phase fix, provisioning profile regeneration, CI pipeline
- Error state improvement: categorized messages with specific recovery actions, not raw error strings

**Should have (differentiators):**
- Animated view transitions on keyboard switch (already built in ViewManager.switchTo(), just needs keyboard trigger)
- Typography scale tokens (semantic --text-xs through --text-lg, replacing hardcoded font sizes)
- Dark mode consistency pass (replace hardcoded rgba() in SuperGrid inline styles with design token references)
- Density-aware empty states (explain when SuperGrid density settings hide all rows)

**Defer (v2+):**
- Command palette (Cmd+K): HIGH complexity, significant scope, future milestone
- Light mode / theme switching: doubles CSS testing surface, not justified for dark-by-design data viz app
- Full WCAG AA accessibility audit: important but dedicated milestone, not polish scope
- Undo toast with action description: needs generic toast system, nice-to-have not table stakes
- Custom keyboard shortcut configuration: 15 actions is below the remapping threshold

### Architecture Approach

v4.2 modifies existing components within established boundaries. No new modules, no new abstractions, no new bridge message types. Empty states stay in ViewManager (already owns this concern) but become context-aware via a total card count query and filter state check. Keyboard shortcuts move from 4 independent `document.addEventListener('keydown')` handlers to a single ShortcutRegistry that centralizes registration, input field guards, and provides data for the help overlay. macOS Commands (SwiftUI `.keyboardShortcut()` modifiers) remain independent -- they fire via NotificationCenter before reaching WKWebView. Visual polish is purely additive CSS within the existing 5-file structure using design token extensions.

**Major components modified:**
1. **ViewManager** -- Context-aware `_showEmpty()` with first-launch / filtered / view-specific paths; one additional COUNT query cached per session
2. **ShortcutRegistry (new, ~80 LOC)** -- Single document keydown listener, `Map<string, ShortcutEntry>`, shared input field guard, `getAll()` for help overlay
3. **HelpOverlay (new, ~60 LOC)** -- Simple two-column shortcut reference, toggled by `?`, pure DOM like ImportToast
4. **IsometryCommands (Swift)** -- New View menu CommandGroup with Cmd+1-9 entries routing through NotificationCenter

**Components NOT modified:** StateCoordinator, all providers (PAFV, Filter, SuperPosition, SuperDensity), DedupEngine, CatalogWriter, WorkerBridge protocol, DatabaseManager, BridgeManager, SyncManager, AssetsSchemeHandler, SubscriptionManager.

### Critical Pitfalls

1. **Keyboard shortcut collision across 4 layers** -- The codebase has MutationManager shortcuts, AuditOverlay keydown, SuperGrid/SuperZoom handlers, and macOS Commands all binding independently. SuperZoom's Cmd+0 handler has NO input field guard (will reset zoom when user types in a filter input with Cmd held). Fix: centralize via ShortcutRegistry, fix SuperZoom guard immediately, never bind macOS-reserved combos (Cmd+H/Q/W/M/comma).

2. **Empty state DOM injection corrupts D3 data joins** -- ViewManager handles empty states outside view subtrees, but NetworkView and TreeView have redundant internal empty handling, GalleryView does innerHTML rebuild, and SuperGrid's render() is a no-op (data comes from superGridQuery). Adding per-view empty DOM inside containers will confuse D3 enter/update/exit cycles. Fix: keep ALL empty state logic in ViewManager, remove redundant handlers from NetworkView/TreeView, add SuperGrid empty detection in query result handler outside CSS Grid container.

3. **TypeScript strict mode fix cascade** -- 314 errors across 26 files where TS4111 bracket-notation fixes are mechanical (zero risk) but TS2345/TS2322 type-narrowing fixes require understanding each case. Existing `as any` casts in TreeView, NativeBridge, and ImportOrchestrator are structural (not sloppy). Fix: batch by error type (TS4111 first, then TS2345/TS2322), run full test suite after each batch, do NOT "fix" structural `as any` casts without understanding why they exist.

4. **ETL real-world data silent failures** -- JSON parser returns 0 cards with no error when input has an unrecognized wrapper key (expects `data`/`items`/`cards`/`records`). Users import a valid JSON file with a different structure and get zero cards silently. Fix: add explicit warning when no recognized key found, log actual top-level keys.

5. **Pre-existing test failures mask new regressions** -- 4 SuperGridSizer failures (80px vs 160px after v3.1 depth change) and 5 supergrid.handler failures (db.prepare mock missing) create noise. Fix: resolve pre-existing failures first to establish a clean zero-failure baseline before starting polish work.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Build Health
**Rationale:** Clean builds are prerequisite for CI and for trusting that subsequent changes don't break things. TS strict mode catches type errors that might be hiding bugs. Without this foundation, every subsequent phase operates on an unreliable base.
**Delivers:** Zero TypeScript strict mode errors, working `npm run build`, Biome linter/formatter with `biome.json` config, GitHub Actions CI pipeline (typecheck + lint + test), fixed Xcode npm Run Script build phase, provisioning profile regeneration documentation, pre-existing test failures resolved (clean zero-failure baseline)
**Addresses:** Build health (TypeScript strict mode, npm build phase, CI pipeline, provisioning profile) from FEATURES.md table stakes
**Avoids:** Pitfall 3 (TS strict mode cascade -- batch by error type), Pitfall 7 (pre-existing test failures masking regressions), Pitfall 8 (provisioning profile entitlement regeneration)

### Phase 2: Empty States + First Launch
**Rationale:** Highest user-facing impact of any polish work. Addresses the "I opened the app and saw nothing" problem that kills first impressions. Low complexity, high confidence, no dependencies on keyboard shortcuts or visual polish.
**Delivers:** Context-aware ViewManager._showEmpty() with first-launch / filtered / view-specific paths, per-view empty state messaging for all 9 views, first-launch welcome panel with import CTAs, inline SVG illustrations themed via design tokens, "Clear Filters" action button on filtered empty state
**Addresses:** Contextual empty states, per-view empty states, first-launch welcome (all table stakes from FEATURES.md)
**Avoids:** Pitfall 2 (empty state DOM injection corrupting D3 joins -- keep logic in ViewManager only), Pitfall 5 (view-specific empty state inconsistency -- standardize through ViewManager)

### Phase 3: Keyboard Shortcuts + View Menu
**Rationale:** Depends on understanding the full view list (same as empty states). Dual implementation (SwiftUI + web) is slightly more complex. Benefits power users who have already imported data.
**Delivers:** ShortcutRegistry centralizing all keyboard bindings, HelpOverlay for shortcut discoverability, Cmd+1-9 view switching (web + macOS Commands), View menu in macOS menu bar, Escape to clear selection/close overlays, SuperZoom input field guard fix, toolbar "?" button
**Addresses:** Global keyboard shortcuts, View menu, keyboard shortcut discoverability (all table stakes from FEATURES.md)
**Avoids:** Pitfall 1 (keyboard shortcut collision -- centralized registry with priority, fix SuperZoom guard), Pitfall 9 (native bridge side-effects -- macOS Commands route via existing NotificationCenter pattern)

### Phase 4: Visual Polish + Accessibility
**Rationale:** Purely additive CSS within existing file structure. Cannot break functionality. Natural pairing after structural work is complete. Makes the app look more professional across all 9 views.
**Delivers:** Typography scale tokens (--text-xs through --text-lg), extended design tokens (--font-mono, --shadow-card, --border-focus, --empty-state-icon), dark mode consistency pass (replace hardcoded rgba() with token references), ARIA attributes on interactive elements (sidebar tablist, toolbar labels, filter listbox, error alert), `:focus-visible` focus rings on interactive elements
**Addresses:** Typography scale tokens, dark mode consistency (differentiators from FEATURES.md), error state improvement (table stakes)
**Avoids:** Pitfall 6 (CSS specificity wars -- change design tokens not selectors, test at multiple zoom levels), Pitfall 10 (SuperGrid zoom interaction -- use calc() with --sg-zoom for zoom-dependent values), Pitfall 13 (accessibility regressions -- maintain WCAG contrast ratios)

### Phase 5: ETL Validation + Stability
**Rationale:** Testing pass that depends on everything else being in a working state. May uncover issues that need fixes from earlier phases. Also resolves known stability concerns (view render crash guards, parser error handling, pre-existing edge cases).
**Delivers:** ETL end-to-end validation across 9 sources x key views, JSON parser warning for unrecognized wrapper keys, null guards in view render() methods for malformed data, try/catch in ETL parser loops for unexpected input, regression tests for any fixes discovered
**Addresses:** ETL end-to-end validation (differentiator from FEATURES.md), error state improvement (table stakes), stability hardening
**Avoids:** Pitfall 4 (ETL real-world data edge cases -- real corpus testing, round-trip validation, explicit error messages for empty results), Pitfall 14 (GalleryView innerHTML rebuild -- CSS-only polish, no DOM state)

### Phase Ordering Rationale

- **Build health must come first** because clean builds, CI, and a zero-failure test baseline are prerequisites for reliable development in all subsequent phases. Fixing 314 TS errors after making changes in later phases would be significantly harder.
- **Empty states before keyboard shortcuts** because empty states are what new users see first (higher impact) and have no dependency on the ShortcutRegistry. Both modify ViewManager but in orthogonal ways.
- **Keyboard shortcuts before visual polish** because the ShortcutRegistry and HelpOverlay are new components that need their own testing, while visual polish is CSS-only with zero runtime risk.
- **Visual polish before ETL validation** because CSS token changes may affect how views render, and the validation pass should test against the final visual state.
- **ETL validation last** because it is a testing exercise that benefits from all prior fixes being in place. It may surface issues in any layer, and those fixes are easier to attribute when the baseline is clean.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Build Health):** Biome + Vite integration needs validation -- Biome runs standalone (CLI), not as a Vite plugin. Verify that Biome's import organization does not conflict with Vite's `?raw` and `?worker` import resolution. Also verify TS strict mode fixes in production files (NativeBridge.ts, SuperGrid.ts) don't change runtime behavior.
- **Phase 3 (Keyboard Shortcuts):** The dual web/native implementation for Cmd+1-9 needs careful design -- macOS Commands intercept before WKWebView in native mode, but web dev mode needs the JS handler. Verify no double-firing for shortcuts registered in both layers (Cmd+Z is currently dual-registered and works correctly due to interception order).

Phases with standard patterns (skip research-phase):
- **Phase 2 (Empty States):** Well-documented UX pattern (Notion, Airtable, Carbon Design System). The codebase already has ViewManager._showEmpty() -- this is an enhancement, not a new system.
- **Phase 4 (Visual Polish):** Pure CSS custom property extension. Established pattern from existing design-tokens.css (77 tokens). ARIA attributes are standard HTML.
- **Phase 5 (ETL Validation):** Testing exercise using existing Vitest infrastructure. No new patterns, just coverage expansion.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | One new dev dependency (Biome), locked existing stack unchanged. Biome 2.x is stable (v2.4.6 published 2026-03-06). No version compatibility concerns. |
| Features | HIGH | All features are well-understood UX patterns (empty states, keyboard shortcuts, design tokens) with clear precedents from Notion, Airtable, Obsidian, Linear. Feature scope is deliberately constrained. |
| Architecture | HIGH | All work modifies existing components within established patterns. No new modules, no new bridge messages, no new providers. ShortcutRegistry and HelpOverlay are trivial additions (~140 LOC total). |
| Pitfalls | HIGH | All 14 pitfalls derived from direct codebase inspection with specific line numbers and file references. No speculation. The keyboard shortcut collision (4 independent layers) and empty state DOM corruption (3 inconsistent patterns) are verifiable by reading the source. |

**Overall confidence:** HIGH

### Gaps to Address

- **Biome interaction with Vite special imports:** Biome may flag or rewrite `?raw` and `?worker` import suffixes. Test `biome check --write` on full codebase and review changes before committing. Address during Phase 1.
- **SuperGrid empty state path:** SuperGrid's `render()` is a no-op (data comes from `superGridQuery()`). ViewManager's empty state path is unreachable for SuperGrid. The empty state detection must happen in the query result handler, outside the CSS Grid container. Needs design during Phase 2 planning.
- **Provisioning profile regeneration:** Requires Apple Developer Portal access by the account holder. Cannot be automated or validated in CI. Must include ALL capabilities simultaneously (iCloud Documents, CloudKit, Push Notifications, StoreKit 2). Document exact steps and verify on physical device.
- **Pre-existing test failure root causes:** The 4 SuperGridSizer failures (80px vs 160px) and 5 supergrid.handler failures (db.prepare mock missing) need investigation before Phase 1. They may be simple expected-value updates or may indicate deeper issues.
- **GalleryView technical debt:** GalleryView uses pure HTML (no D3 data join) with innerHTML rebuild on every render. Visual polish is safe (CSS-only), but any interactive enhancement (selection, expand/collapse) is blocked until GalleryView is refactored. Out of scope for v4.2 but should be flagged for a future milestone.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all source files referenced in ARCHITECTURE.md and PITFALLS.md (line-level analysis of ViewManager.ts, shortcuts.ts, AuditOverlay.ts, SuperGrid.ts, SuperZoom.ts, NativeBridge.ts, IsometryApp.swift, all parsers)
- `npx tsc --noEmit` output: 314 errors categorized by type and file
- `npx vitest --run` output: pre-existing test failures identified
- [Biome official documentation](https://biomejs.dev/) -- v2 features, configuration, installation
- [WCAG 2.1 ARIA practices](https://www.w3.org/WAI/ARIA/apg/) -- Grid, tab, listbox, dialog patterns
- [KeyboardShortcut Apple Developer docs](https://developer.apple.com/documentation/swiftui/keyboardshortcut) -- SwiftUI keyboard shortcut API

### Secondary (MEDIUM confidence)
- [Empty state UX patterns (Eleken, Toptal, Carbon Design System, Smashing Magazine)](https://www.eleken.co/blog-posts/empty-state-ux) -- Three types, CTA best practices, onboarding patterns
- [Command Palette UX Patterns](https://medium.com/design-bootcamp/command-palette-ux-patterns-1-d6b6e68f30c1) -- Cmd+K discoverability (evaluated and deferred)
- [SwiftUI Commands patterns (Daniel Saidi, Swift with Majid)](https://danielsaidi.com/blog/2023/11/22/customizing-the-macos-menu-bar-in-swiftui) -- CommandGroup, menu item organization
- [Typography in Design Systems (UX Collective)](https://uxdesign.cc/mastering-typography-in-design-systems-with-semantic-tokens-and-responsive-scaling-6ccd598d9f21) -- Semantic tokens, responsive scaling

### Tertiary (LOW confidence)
- None. All findings are well-supported by primary and secondary sources. The polish scope avoids novel technical territory.

---
*Research completed: 2026-03-07*
*Ready for roadmap: yes*
