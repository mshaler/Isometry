# Phase 54: Shell Scaffolding - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the flat `#app` layout with a new vertical panel stack shell (WorkbenchShell, CollapsibleSection, CommandBar) and re-root ViewManager from `#app` to `.workbench-view-content` — with zero visual or behavioral regression to existing functionality. Explorer panel content is stub-only; actual explorer modules (Properties, Projection, etc.) are built in Phases 55-57.

</domain>

<decisions>
## Implementation Decisions

### Panel Rail Behavior
- Full-width vertical stack layout (not sidebar) — `#app > .workbench-shell` is a flex column
- All 4 placeholder sections created: Notebook, Properties, Projection, LATCH — matching D3 Spec v2 DOM hierarchy
- Each section gets minimal stub content (e.g., icon + "Properties explorer coming soon") — not empty containers
- All sections expanded by default on first load — maximum discoverability for new UI
- Smooth height animation on collapse/expand (~200ms ease-out CSS transition)
- Chevron indicator (▸/▾) for expand/collapse — matches TreeView and macOS conventions
- Count badge in collapsed headers (e.g., "Properties (12)") — lightweight, consistent
- Panel rail scrolls independently (overflow-y: auto) — separate from SuperGrid scroll
- Panel rail capped at max 40% viewport height — SuperGrid always gets at least 60%
- Collapse state persisted to localStorage — survives page refreshes
- Collapse-all keyboard shortcut (e.g., Cmd+\) for focus mode — restores previous state on toggle back
- SuperGrid view content area (.workbench-view-content) is NOT collapsible — always visible, flex: 1

### CommandBar Composition
- Always sticky at top — outside the scrollable panel rail, first child of .workbench-shell
- App icon trigger opens existing CommandPalette (same as Cmd+K) — single entry point, reuses existing code
- Command input is a styled non-editable placeholder bar showing "Command palette..." with ⌘K hint — clicking opens CommandPalette overlay
- Settings trigger opens a dropdown menu with: Theme toggle (dark/light/system), Density selector, Help shortcut, About — reuses existing ThemeProvider/DensityProvider

### ViewTabBar Position and Styling
- Kept as a horizontal 9-view tab strip — all 9 views remain available
- Positioned below CommandBar, above panel rail — fixed, never scrolls
- Layout order: CommandBar → ViewTabBar → panel-rail → view-content
- Restyled to match WorkbenchShell aesthetic — same spacing tokens, border treatment, background as CommandBar
- View count stays at 9 — reducing to SuperGrid-only is a future milestone decision

### Re-rooting Strategy
- Big-bang swap — ViewManager already accepts container via mount(container), no feature flag needed
- WorkbenchShell receives #app, creates .workbench-shell as child, passes .workbench-view-content to ViewManager
- index.html stays unchanged — WorkbenchShell creates all DOM dynamically inside #app
- Tests create their own container divs — they don't rely on #app ID, so no test changes expected
- Overlays (CommandPalette, HelpOverlay, AuditOverlay) move to document.body — above the shell via z-index stacking
- Toasts (ErrorBanner, ActionToast, ImportToast) move to document.body — always visible regardless of shell scroll

### Claude's Discretion
- Exact transition timing curve for collapse/expand animation
- Settings dropdown menu styling and positioning
- Stub content icons and copy for placeholder explorer sections
- Collapse-all shortcut key choice (Cmd+\ suggested but flexible)
- z-index values for overlays vs shell layering
- Exact max-height value for panel rail (40% is the target, exact CSS may vary)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/palette/CommandPalette.ts`: Full WAI-ARIA combobox with mount/destroy lifecycle — CommandBar triggers this on click
- `src/palette/CommandRegistry.ts`: Command registration system — settings dropdown actions can register here
- `src/shortcuts/ShortcutRegistry.ts`: Single keydown listener with input field guard and Cmd modifier cross-platform — collapse-all shortcut registers here
- `src/shortcuts/HelpOverlay.ts`: Overlay with mount/destroy pattern — reference for overlay mounting to body
- `src/ui/ViewTabBar.ts`: 9-view horizontal tab strip with role="tablist" accessibility — stays, gets restyled
- `src/providers/ThemeProvider.ts`: Dark/light/system theme management — settings dropdown reuses this
- `src/providers/DensityProvider.ts`: Density control — settings dropdown reuses this
- `src/styles/design-tokens.css`: Full CSS custom property system (colors, spacing, typography) for both themes

### Established Patterns
- **mount/destroy lifecycle**: All views and overlays follow `mount(container) / destroy()` — new modules (WorkbenchShell, CollapsibleSection, CommandBar) must match
- **Constructor injection**: Views receive providers via constructor, not singleton imports (INTG-02)
- **CSS scoping**: All new CSS must scope under `.workbench-shell` — no bare element selectors (SHEL-06)
- **ARIA roles**: Existing tablist, combobox, live-region patterns — CollapsibleSection needs aria-expanded, Enter/Space keyboard operation (INTG-04)
- **Design tokens**: All colors/spacing use CSS custom properties from design-tokens.css — no hardcoded values

### Integration Points
- `src/main.ts` line 49: `document.getElementById('app')` — WorkbenchShell takes over this element
- `src/main.ts` line 142+: Overlays mount to container — change to document.body
- `src/views/ViewManager.ts`: `mount(container)` already accepts any HTMLElement — pass .workbench-view-content
- `src/ui/ViewTabBar.ts`: Currently constructed inline in main.ts — needs to mount into WorkbenchShell layout
- `index.html`: `<div id="app">` stays unchanged — WorkbenchShell creates children dynamically

</code_context>

<specifics>
## Specific Ideas

- Stub content should give visual weight — an icon and a short "coming soon" message per section, not bare empty panels
- Collapse-all shortcut should feel like a "focus mode" toggle — collapse all explorers to maximize SuperGrid, press again to restore all to their previous state (not just expand all)
- CommandBar should feel minimal and purposeful — not cluttered, not too many triggers
- Settings dropdown is lightweight — just a handful of quick actions, not a full settings page

</specifics>

<deferred>
## Deferred Ideas

- Resizable drag splitters between panels — future enhancement, not Phase 54
- Reducing ViewTabBar to SuperGrid-only — future milestone decision
- Rich summary badges in collapsed headers (axis names, filter state) — future phase when explorers have real content
- Inline search in CommandBar (replacing CommandPalette overlay) — future consideration

</deferred>

---

*Phase: 54-shell-scaffolding*
*Context gathered: 2026-03-07*
