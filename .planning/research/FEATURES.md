# Feature Landscape

**Domain:** UX Polish + QoL for a mature local-first data projection app
**Researched:** 2026-03-07
**Confidence:** HIGH -- patterns well-established from Notion, Airtable, Obsidian, Linear; current codebase state thoroughly audited to identify specific gaps.

---

## Context: What Already Exists vs. What Needs Polish

**Already built (assets to polish, not rebuild):**
- 9 D3 views with D3 data join rendering and key functions
- ViewManager with loading spinner (200ms delay), error banner (retry button), and basic empty state ("No cards match current filters")
- SuperGrid: help overlay (Cmd+/), context menu on headers, keyboard shortcuts (Cmd+F, Cmd+0, Escape, Cmd+Click)
- Mutation shortcuts: Cmd+Z undo, Cmd+Shift+Z redo (both JS keydown and macOS CommandGroup)
- Audit overlay: toggle button + Cmd+Shift+A keyboard shortcut
- macOS menu bar: File > Import File (Cmd+I), Edit > Undo/Redo
- Native toolbar: import menu (file + native sources), settings gear, sync status icon, sidebar toggle
- Design tokens: dark theme with CSS custom properties for colors, spacing, radius, transitions
- ImportToast: progress/finalizing/success/error states for file and native imports
- Recovery overlay: SwiftUI crash recovery with "Restoring... Your data is safe"
- KanbanView: per-column "No cards" empty state

**Gaps identified by codebase audit:**
- ViewManager's empty state is a single line of muted text ("No cards match current filters") -- no distinction between "database is empty" and "filters removed all results"
- No first-launch experience -- app boots to an empty List view with no guidance
- No onboarding or help beyond SuperGrid's shortcut overlay
- 6 of 9 views silently render nothing when empty (no message, no CTA)
- Keyboard shortcuts exist only for SuperGrid and mutations -- no view switching, no global navigation
- macOS menu bar has only Import and Undo/Redo -- missing View menu, Window menu items
- No global keyboard shortcut reference (SuperGrid has one, but other views do not)
- Design tokens are dark-only -- no light mode, no system preference tracking
- No typography scale tokens (font sizes are hardcoded per component)
- No focus indicators or keyboard navigation for accessibility
- Error states give no context about what to do next

---

## Table Stakes

Features users expect in a shipped data visualization/productivity app. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Contextual empty states (first-use vs. filtered-out)** | Notion, Airtable, and every modern data app distinguish between "you have no data yet -- import something" and "your filters removed all results -- clear filters." A single generic message fails both cases. | LOW | ViewManager needs to check total card count (unfiltered) vs. filtered count. If total=0, show first-use empty state with import CTA. If total>0 but filtered=0, show filter-removed message with "Clear filters" action. |
| **Per-view empty states** | Each of the 9 views should show a relevant empty state, not just the generic ViewManager one. KanbanView already does per-column "No cards" -- other views should follow. A network graph with zero nodes should say "Import data with connections to see a network" not just "No cards." | LOW | Each view's render() already receives empty arrays. Add view-specific messaging in each render path. |
| **First-launch welcome experience** | Users who open the app for the first time see a blank screen. Obsidian shows a "Create new vault" flow; Notion populates workspace with templates; Airtable starts with a sample base. Isometry should guide users to import data. | MEDIUM | Detect first launch (total card count = 0 AND no import_runs). Show a centered welcome panel with "Import File" and "Import from Mac" CTAs. No onboarding wizard -- a single panel is sufficient. |
| **Global keyboard shortcuts for view switching** | Cmd+1 through Cmd+9 for switching between the 9 views is universal in multi-view apps (Finder, Terminal, browsers, Notion). Currently, view switching requires mouse click on the sidebar or bottom sheet. | LOW | SwiftUI `.keyboardShortcut("1")` through `.keyboardShortcut("9")` on sidebar items. These route through the existing `switchView(to:)` mechanism. Needs both macOS Commands menu and web-side keydown handlers. |
| **View menu in macOS menu bar** | macOS apps universally have a View menu with entries for each view/panel. Isometry has File and Edit only. Missing View menu with all 9 views listed (with Cmd+1..9 shortcuts) breaks macOS conventions. | LOW | New `CommandGroup` in `IsometryCommands` with 9 view entries. Each posts a notification that ContentView handles via switchView(). |
| **Keyboard shortcut discoverability** | Users cannot discover shortcuts without reading code. Obsidian shows shortcuts next to command palette entries. Linear shows shortcut hints on hover. macOS menu items display shortcut keys automatically. | LOW | macOS menu items already display shortcuts (SwiftUI handles this). For the web runtime, extend the SuperGrid help overlay pattern to work globally (not just inside SuperGrid). A simple "?" button in the toolbar that opens a full shortcut reference. |
| **Error state improvement** | Current error banner shows raw error message + "Retry" button. No guidance on what to do if retry fails. Notion shows friendly error messages with suggested actions. | LOW | Categorize errors (network/sync, database, import parsing). Show user-friendly message + specific action for each category. Add "Learn more" link for import parse errors. |
| **Consistent toolbar across views** | Import button and settings gear are in the native toolbar. Audit toggle is a web-side floating button. Search (Cmd+F) only exists in SuperGrid. Filter UI is SuperGrid-only. Different views have different capabilities exposed inconsistently. | MEDIUM | Define which toolbar items apply globally (import, settings, audit, search) vs. per-view (SuperGrid-specific density, zoom, transpose). Ensure all global items are always visible. |
| **Build health: TypeScript strict mode** | Pre-existing TS2345 type errors in ETL test files block `tsc --noEmit`. The build:native script skips tsc entirely. TypeScript strict mode is a quality floor for a shipped product. | MEDIUM | Fix type errors in test files. Enable tsc --noEmit in CI pipeline. This is build health, not user-facing, but blocks CI readiness. |
| **Build health: provisioning profile** | Provisioning profile needs iCloud Documents entitlement regeneration. CloudKit capability also needs profile update (carried from v2.0). Blocks production App Store submission. | LOW (effort) / HIGH (impact) | Apple Developer Portal work. Not code changes. |
| **Build health: npm Run Script build phase** | Pre-existing Xcode build phase failure (package.json path mismatch). Swift compilation works but npm-based web bundle rebuild does not trigger automatically. | LOW | Fix the path in the Xcode Build Phase script to point to the correct package.json location. |

---

## Differentiators

Features that exceed baseline expectations. Not expected, but valued.

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| **Animated view transitions on keyboard switch** | When pressing Cmd+1..9, the crossfade/morph transition (already built) should activate. Gives the app a polished feel during rapid view switching. | LOW | Already implemented in ViewManager.switchTo(). Just needs to be triggered from keyboard shortcuts. |
| **Smart empty state CTAs per view** | Instead of generic "Import data," tailor the CTA to the view: Calendar view says "Import events with dates"; Network says "Import data with connections"; Kanban says "Import data with a status field." Educates users about what each view needs. | LOW | View-specific static strings. No dynamic logic needed. |
| **Command palette (Cmd+K)** | Obsidian and Linear popularized this pattern. A searchable overlay listing all available actions: switch views, import, export, toggle audit, clear filters, open settings. Faster than menus for power users. | HIGH | New web-side component. Needs action registry, fuzzy search, keyboard navigation. Significant scope for a polish milestone. |
| **Undo toast with action description** | Current undo/redo is silent -- user presses Cmd+Z and something changes with no feedback. Gmail, Notion, and Figma show a brief toast: "Undo: Moved card to Done" with an "Undo" button. ImportToast already provides the toast pattern. | MEDIUM | MutationManager already has inverse descriptions. Surface last mutation description in a toast after undo/redo. Extend ImportToast or create a generic toast system. |
| **Focus ring and keyboard navigation** | Tab-navigable cards and interactive elements with visible focus rings. Required for accessibility (WCAG 2.1 AA). Not expected in v1 of a personal data tool but elevates quality. | MEDIUM | CSS `:focus-visible` on interactive elements. Tab index management for D3-rendered cards. Complex for SVG views (list, grid, timeline) -- those may need `role="listitem"` and `aria-label`. |
| **Typography scale tokens** | Font sizes are currently hardcoded per component (13px, 11px, 14px, etc.). A semantic typography scale (--text-xs, --text-sm, --text-base, --text-lg) ensures consistency and makes future light mode/density changes trivial. | LOW | CSS custom properties added to design-tokens.css. Find-and-replace hardcoded font-size values. |
| **ETL end-to-end validation** | Import from all 9 sources, verify rendering in all 9 views, fix any breakage discovered. Not a feature but a quality gate that prevents regression. This is the "glass half full" of polish -- everything should work correctly together. | HIGH | Manual testing matrix: 9 sources x 9 views = 81 combinations. Not all are meaningful (Calendar data in Network view may not produce useful graphs). Focus on the ~20 high-value combinations. |
| **Density-aware empty states** | When SuperGrid's density is set to "hide empty" and all visible cells are filtered out, the empty state should explain why: "All rows hidden by density settings. Switch to 'Show All' to see data." | LOW | Check SuperDensityProvider state in the empty state path. |
| **Dark mode refinements** | The dark theme exists but has some inconsistencies: SuperGrid help overlay uses hardcoded rgba(0,0,0,...) colors instead of design tokens; audit legend styles may not match the main palette. A consistency pass. | LOW | Replace hardcoded colors in SuperGrid.ts inline styles with design token references. Audit all CSS for non-token color values. |

---

## Anti-Features

Features to explicitly NOT build in this polish milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full onboarding wizard / multi-step tutorial** | This is a data projection tool for power users, not a consumer SaaS with churn metrics. A multi-step wizard is patronizing and will be skipped. Obsidian's approach (single welcome page, then get out of the way) is the right model. | Single-panel first-launch welcome with import CTAs. |
| **Light mode / theme switching** | Building a full light theme doubles the CSS surface area and requires testing every view in both modes. The app is dark-theme-by-design (data visualization apps like Grafana and Observable lean dark). Light mode is a future feature, not polish. | Ensure design tokens would support theming later (they already do via CSS custom properties in :root). |
| **Sample/demo data preloaded at first launch** | Pre-populating with fake data creates confusion ("where did these cards come from?") and requires cleanup. Unlike Notion templates, Isometry's value is in YOUR data, not sample data. | Show import CTAs instead. Let users bring their own data immediately. |
| **Command palette (full implementation)** | A proper command palette with fuzzy search, action registry, and plugin support is a significant feature, not polish. Linear's took months. | Add a keyboard shortcut reference overlay (like SuperGrid's help, but global) and leave the full command palette for a future milestone. |
| **In-app changelog / what's new modal** | Users don't read changelogs on local-first personal apps. This is a pattern for SaaS with update communication needs. | No changelog modal. |
| **Tooltip system** | Adding tooltips to every button and control is high effort for low value in a native app where toolbar items already have SF Symbol names. | Use `title` attributes on web-side buttons (already done for some). No custom tooltip component. |
| **Custom keyboard shortcut configuration** | Obsidian lets users remap every shortcut. This is a feature for apps with 100+ actions. Isometry has ~15 actions. Standard shortcuts (Cmd+1-9, Cmd+Z, Cmd+F) should not be remappable. | Use standard platform shortcuts. No configuration UI. |
| **Accessibility audit (WCAG AA compliance)** | Full accessibility compliance is a large effort (screen reader testing, ARIA roles, contrast ratios, reduced motion). Important but not a polish milestone. | Add focus-visible rings as a starting point. Defer full audit to a dedicated accessibility milestone. |

---

## Feature Dependencies

```
[First-Launch Welcome Panel]
    requires: Total card count check (bridge query or cached state)
    requires: Import CTA buttons wired to existing import flow
    consumed-by: ViewManager (shown when database has zero cards)

[Contextual Empty States]
    requires: Unfiltered card count (total) vs. filtered card count
    requires: View-specific messaging strings
    depends-on: ViewManager._showEmpty() refactor
    consumed-by: All 9 views

[Global Keyboard Shortcuts (Cmd+1-9)]
    requires: SwiftUI CommandGroup for View menu (macOS)
    requires: Web-side keydown handler for view switching
    requires: Coordination: macOS routes through NotificationCenter -> ContentView -> evaluateJavaScript
    depends-on: Existing viewFactory and viewManager.switchTo() (already wired)

[View Menu in macOS Menu Bar]
    requires: IsometryCommands struct extension
    requires: New NotificationCenter names for each view
    depends-on: ContentView.switchView(to:)

[Keyboard Shortcut Reference (Global Help)]
    requires: UI component (web-side overlay, similar to SuperGrid's help)
    requires: Keyboard shortcut data model listing all shortcuts
    requires: Toolbar button ("?" icon) to open it
    independent: Does not depend on any other polish feature

[Error State Improvement]
    requires: Error categorization logic in ViewManager._showError()
    requires: User-friendly message mapping
    independent: Pure UI improvement

[Build Health: TS Strict Mode]
    requires: Fix type errors in test files (ETL test assertions)
    requires: Update build:native to include tsc --noEmit
    independent: No runtime changes

[Build Health: Provisioning Profile]
    requires: Apple Developer Portal access
    blocked-by: Developer account holder action
    independent: No code changes

[Build Health: npm Build Phase]
    requires: Xcode project.pbxproj edit (fix path)
    independent: No runtime changes

[Typography Scale Tokens]
    requires: New CSS custom properties in design-tokens.css
    requires: Find/replace hardcoded font-size values across CSS files
    independent: Pure CSS refactor

[Dark Mode Consistency]
    requires: Audit of inline styles in SuperGrid.ts
    requires: Replace hardcoded rgba() with design token references
    independent: Pure CSS/style refactor

[ETL End-to-End Validation]
    requires: All 9 import sources available for testing
    requires: Manual testing across view matrix
    depends-on: Build health fixes (builds must succeed cleanly first)
```

### Dependency Notes

- **Build health features are blocking.** TS strict mode and npm build phase fixes should come first because they establish a clean build baseline for subsequent work.
- **First-launch and empty states are independent of each other** but share the ViewManager pathway. Implement contextual empty states first (lower risk), then layer the first-launch welcome on top.
- **Keyboard shortcuts require dual implementation:** SwiftUI side for macOS menu bar and web side for keydown handlers. The macOS side is simpler (CommandGroup) and can ship first; web side handles the case where the WKWebView has focus.
- **ETL validation is a testing pass, not a code feature.** It depends on everything else being in a working state first.
- **Typography scale and dark mode consistency are CSS-only** and can be done at any point without risk to functionality.

---

## MVP Recommendation

### Prioritize (in dependency order)

1. **Build health fixes** (TS strict, npm build phase, provisioning profile) -- Quality floor. Blocks CI. No user-facing impact but prevents regression. Low complexity, high ROI.

2. **Contextual empty states** (first-use vs. filtered-out, per-view messaging) -- The single highest-impact UX improvement. Turns a confusing blank screen into guidance. Every Notion/Airtable/Linear user expects this. Low complexity.

3. **First-launch welcome panel** -- Extends contextual empty states for the zero-data case. Single panel with import CTAs. Not a wizard. Addresses "I opened the app and nothing happened."

4. **Global keyboard shortcuts (Cmd+1-9) + View menu** -- Table stakes for macOS. Low complexity, leverages existing switchView() mechanism. Paired because the View menu is where shortcuts appear.

5. **Keyboard shortcut reference overlay** -- Reuse SuperGrid's help overlay pattern at the global level. Shows all shortcuts (view switching, undo/redo, search, audit toggle). Low complexity.

6. **Dark mode consistency + typography scale tokens** -- CSS-only cleanup. No risk. Improves visual coherence across all 9 views.

7. **ETL end-to-end validation** -- Testing pass across source/view matrix. Fix any breakage discovered. This is the "is everything actually working?" gate.

### Defer

- **Command palette (Cmd+K)**: HIGH complexity, significant scope. Future milestone.
- **Undo toast with action description**: MEDIUM complexity, needs generic toast system. Nice-to-have, not table stakes.
- **Focus rings / keyboard navigation**: Accessibility improvement, not polish. Dedicate a milestone.
- **Light mode**: Doubles CSS testing surface. Not justified for dark-by-design data viz app.
- **Smart per-view CTAs** (Calendar says "import events with dates"): Nice but low priority vs. generic per-view empty states.

---

## Phase Ordering Rationale

**Build health must come first** because:
1. Clean builds are prerequisite for CI and for trusting that subsequent changes don't break things
2. TS strict mode catches type errors that might be hiding bugs
3. Provisioning profile fix unblocks production App Store submission

**Empty states and first-launch should come second** because:
1. Highest user-facing impact of any polish work
2. Addresses the "I opened the app and saw nothing" problem that kills first impressions
3. Low complexity, high confidence

**Keyboard shortcuts and View menu should come third** because:
1. Depends on understanding the full view list (same as empty states)
2. Dual implementation (SwiftUI + web) is slightly more complex
3. Benefits power users who have already imported data

**Visual consistency (CSS cleanup) should come fourth** because:
1. CSS-only, zero-risk changes
2. Makes the app look more professional across all views
3. Natural pairing with the above work

**ETL validation should come last** because:
1. It's a testing pass, not a feature
2. Benefits from all prior fixes being in place
3. May uncover issues that need fixes from earlier phases

---

## Sources

### Empty State UX
- [Empty state UX examples and design rules (Eleken)](https://www.eleken.co/blog-posts/empty-state-ux) -- Three types (informational, action-oriented, celebratory), real-world examples from Notion and Slack, pitfalls to avoid
- [Empty States -- The Most Overlooked Aspect of UX (Toptal)](https://www.toptal.com/designers/ux/empty-state-ux-design) -- First-use vs. user-cleared vs. error states, CTA best practices
- [Carbon Design System: Empty States Pattern](https://carbondesignsystem.com/patterns/empty-states-pattern/) -- Structured pattern with headline, description, icon, and single CTA
- [The Role of Empty States in User Onboarding (Smashing Magazine)](https://www.smashingmagazine.com/2017/02/user-onboarding-empty-states-mobile-apps/) -- Empty states as onboarding opportunity, not failure state
- [Empty State UI Design: Best practices (Mockplus)](https://www.mockplus.com/blog/post/empty-state-ui-design) -- 25 examples with analysis, one CTA rule

### Keyboard Shortcuts & Command Palette
- [Command Palette UX Patterns (Alicja Suska)](https://medium.com/design-bootcamp/command-palette-ux-patterns-1-d6b6e68f30c1) -- Cmd+K patterns, discoverability challenges
- [The UX of Keyboard Shortcuts (Medium)](https://medium.com/design-bootcamp/the-art-of-keyboard-shortcuts-designing-for-speed-and-efficiency-9afd717fc7ed) -- Shortcut discoverability via menus, contextual tips
- [Command Palette Interfaces (Philip C Davis)](https://philipcdavis.com/writing/command-palette-interfaces) -- Design analysis of Notion, Linear, Figma palettes
- [Command K Bars (Maggie Appleton)](https://maggieappleton.com/command-bar) -- History and evolution of Cmd+K pattern
- [Obsidian Command Palette (Obsidian Rocks)](https://obsidian.rocks/for-beginners-and-pros-alike-the-command-palette-in-obsidian/) -- Command pinning, shortcut display next to commands
- [Linear shortcuts (shortcuts.design)](https://shortcuts.design/tools/toolspage-linear/) -- Complete shortcut inventory for reference

### macOS Keyboard Shortcuts (SwiftUI)
- [Keyboard Shortcuts in SwiftUI (Sarunw)](https://sarunw.com/posts/swiftui-keyboard-shortcuts/) -- .keyboardShortcut() modifier, default Command key
- [KeyboardShortcut (Apple Developer)](https://developer.apple.com/documentation/swiftui/keyboardshortcut) -- Official API reference
- [Customizing the macOS menu bar in SwiftUI (Daniel Saidi)](https://danielsaidi.com/blog/2023/11/22/customizing-the-macos-menu-bar-in-swiftui) -- CommandGroup, menu item organization
- [Commands in SwiftUI (Swift with Majid)](https://swiftwithmajid.com/2020/11/24/commands-in-swiftui/) -- CommandMenu, CommandGroup patterns

### Error Recovery & Graceful Degradation
- [Error Recovery & Graceful Degradation (AI UX Design Guide)](https://www.aiuxdesign.guide/patterns/error-recovery) -- Plain language, user reassurance, 2-3 recovery options
- [Graceful Degradation in UX (Smashing Magazine)](https://www.smashingmagazine.com/2024/12/importance-graceful-degradation-accessible-interface-design/) -- Maintain basic functionality when parts fail

### Design Tokens & Visual Consistency
- [Mastering Typography in Design Systems (UX Collective)](https://uxdesign.cc/mastering-typography-in-design-systems-with-semantic-tokens-and-responsive-scaling-6ccd598d9f21) -- Semantic tokens, responsive scaling
- [Design Tokens Complete Guide (design.dev)](https://design.dev/guides/design-systems/) -- Token hierarchy, theme switching via scoped sets
- [Color Consistency in Design Systems (UXPin)](https://www.uxpin.com/studio/blog/color-consistency-design-systems/) -- Avoiding hardcoded colors

### Toast Notifications
- [Toast Notifications Best Practices (LogRocket)](https://blog.logrocket.com/ux-design/toast-notifications/) -- When to use toasts vs. inline messages, undo action pattern
- [Carbon Design System: Notification Pattern](https://carbondesignsystem.com/patterns/notification-pattern/) -- Actionable toasts with single tertiary button

### Onboarding
- [Onboarding UI Patterns (UserOnBoarding)](https://useronboarding.academy/post/onboarding-ui) -- Welcome modals, blank slate, checklists, tooltips
- [How to Design Onboarding Screens (UserPilot)](https://userpilot.com/blog/onboarding-screen/) -- Progressive disclosure, first key action focus

---

*Feature research for: Isometry v4.2 Polish + QoL -- empty states, keyboard shortcuts, build health, UX consistency, ETL validation*
*Researched: 2026-03-07*
