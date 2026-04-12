# Phase 147: 3-State Collapse + Accessibility - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement a 3-state dock collapse cycle (Hidden / Icon-only / Icon+Thumbnail) with smooth CSS animation on the Hidden↔visible transition, persistent state via ui_state, and full keyboard/VoiceOver accessibility (roving tabindex, arrow key navigation, state-change announcements).

</domain>

<decisions>
## Implementation Decisions

### Collapse Toggle
- **D-01:** Toggle button pinned to the top of the dock, always visible — even when dock content is Hidden. Standard sidebar icon glyph (rectangle-with-sidebar).
- **D-02:** Static icon — the sidebar glyph does not change between states.
- **D-03:** Linear 3-state cycle on each click: Hidden → Icon-only → Icon+Thumbnail → Hidden.

### Animation
- **D-04:** Hidden↔visible transition uses `grid-template-rows: 0fr → 1fr` CSS animation for smooth content reveal/collapse. This is the only animated transition.
- **D-05:** Width changes between states are instant — CSS class swap, no `transition: width`. Avoids layout reflow jank during animation.

### Icon+Thumbnail State
- **D-06:** Icon+Thumbnail state renders at 160px width. Layout: icon + full label + 96×48 placeholder box where Phase 148 minimaps will render.
- **D-07:** Placeholder box is visible but empty — makes the thumbnail slot intentional before Phase 148 fills it.

### Persistence
- **D-08:** Collapse state persisted via ui_state table (same pattern as other UI state: notebook, latch overrides, etc.). Key convention: `dock:collapse-state`. Restored on app reload.

### Keyboard Navigation
- **D-09:** When dock is Hidden, only the toggle button is focusable. Dock items are removed from tab order entirely.
- **D-10:** Arrow keys (Up/Down) navigate between actionable dock items only — section headers are skipped.
- **D-11:** Roving tabindex pattern (established in ListView, CommandBar, PanelDrawer).

### VoiceOver
- **D-12:** State transitions announced via the existing `announcer` interface in DockNavConfig. Announcement text is state name only: "Hidden" / "Icon only" / "Icon and thumbnail".
- **D-13:** Item activation announcements continue to use `aria-current="page"` (already set in Phase 146).

### Claude's Discretion
- CSS class naming for the 3 states (e.g., `dock-nav--hidden`, `dock-nav--icon-only`, `dock-nav--icon-thumbnail`)
- Whether toggle button is a child of `.dock-nav` or a sibling element that persists outside it
- Exact animation duration and easing for the `grid-template-rows` transition
- How the 160px Icon+Thumbnail layout is structured (flexbox row, CSS grid, etc.)
- Where `tabindex="-1"` is applied/removed during state changes

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DockNav Component (Phase 146 output)
- `src/ui/DockNav.ts` — Current 186-line DockNav class with mount/destroy/setActiveItem lifecycle, event delegation click handler, `DockNavConfig.announcer` field (exists but unused), `_itemEls` Map for composite key lookup
- `src/styles/dock-nav.css` — Current 107-line stylesheet. 48px item width, `--accent` active color, `:focus-visible` outline. No collapse states yet.

### Navigation Data Model
- `src/ui/section-defs.ts` — DOCK_DEFS array, DockSectionDef interface, viewOrder array

### UI State Persistence Pattern
- `src/worker/handlers/ui-state.handler.ts` — Worker-side ui_state read/write handlers
- `src/providers/StateManager.ts` — Client-side ui_state persistence API (saveUiState/loadUiState)

### Accessibility Patterns (existing)
- `src/views/ListView.ts` line 125 — Roving tabindex pattern in toolbar
- `src/ui/CommandBar.ts` line 331 — Roving tabindex in command bar
- `src/ui/panels/PanelDrawer.ts` line 451 — Roving tabindex in panel drawer
- `src/views/ViewManager.ts` lines 106-267 — Announcer interface and usage pattern

### Shell Integration
- `src/ui/WorkbenchShell.ts` — `.workbench-sidebar` container. Width changes from 48px (icon-only) to 160px (thumbnail) to 0px (hidden) depending on state.

### Theme Tokens
- `src/styles/design-tokens.css` — `--transition-fast`, `--bg-surface`, `--border-subtle`, `--text-muted` used by dock

### Requirements
- `.planning/REQUIREMENTS.md` — CLPS-01 (3 collapse states), CLPS-02 (click to snap), CLPS-03 (smooth animation), CLPS-04 (persistence), A11Y-01 (ARIA tablist + landmark), A11Y-02 (roving tabindex), A11Y-04 (VoiceOver announcements)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DockNavConfig.announcer` interface: Already defined in DockNav.ts but not wired — Phase 147 activates it for state-change announcements
- `StateManager.saveUiState(key, value)` / `loadUiState(key)`: Established persistence pattern for UI preferences
- Roving tabindex implementations in ListView, CommandBar, PanelDrawer — follow the same pattern
- `iconSvg('sidebar', 20)` or equivalent Lucide icon for the toggle button

### Established Patterns
- `mount(container)` / `destroy()` lifecycle (DockNav, WorkbenchShell, all panels)
- Event delegation: single listener on container element (DockNav click handler)
- `ui_state` table key conventions: `notebook:{id}`, `latch:overrides`, `latch:disabled` — dock uses `dock:collapse-state`
- CSS class toggle for state changes (no inline styles)

### Integration Points
- WorkbenchShell `.workbench-sidebar` width must change per collapse state (0px / 48px / 160px)
- DockNav.mount() needs to read initial collapse state from ui_state on startup
- Toggle button click must persist new state to ui_state after cycling
- Main content panel width adjusts automatically (flexbox or grid takes remaining space)

</code_context>

<specifics>
## Specific Ideas

- Toggle icon is the standard sidebar glyph shown in user's reference image (rectangle-with-sidebar)
- 96x48 placeholder box in Icon+Thumbnail state — visible but empty, sized for Phase 148 minimaps
- No edge-hover or keyboard-shortcut-only reveal — toggle button is always visible

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 147-3-state-collapse-accessibility*
*Context gathered: 2026-04-11*
