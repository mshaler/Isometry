# Phase 146: DockNav Shell + SidebarNav Swap - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace SidebarNav with a dock-style DockNav component. DockNav renders a 48px-wide vertical icon strip organized by verb-noun taxonomy (Integrate, Visualize, Analyze, Activate, Help) with 48×48 Lucide SVG icons, click-to-activate navigation, active item icon color highlight, and full CSS token coverage across all 5 themes. SidebarNav.ts and sidebar-nav.css are deleted — clean break, not a wrapper.

</domain>

<decisions>
## Implementation Decisions

### Dock Layout & Sizing
- **D-01:** Dock renders at 48px width in icon-only mode — icon stacked above a small label. This is the only state Phase 146 implements.
- **D-02:** Phase 147 adds the 3-state collapse cycle (Hidden / Icon-only / Icon+Thumbnail) and the toggle button. Phase 146 does NOT implement collapse or the wider thumbnail state.

### Section Headers
- **D-03:** Section headers render as small muted text dividers between groups, styled like macOS Finder sidebar section headers. Visible but unobtrusive at 48px width.

### Active Item Indicator
- **D-04:** Active dock item uses `--accent` icon color. Inactive items use `--text-secondary`. No background fill or edge bar — icon color change only.

### SidebarNav Removal
- **D-05:** Delete SidebarNav.ts and sidebar-nav.css entirely. DockNav is a clean replacement, not a wrapper around the old component.
- **D-06:** WorkbenchShell mounts DockNav into the sidebar slot instead of SidebarNav. The `.workbench-sidebar` container width changes from 200px to 48px.

### Claude's Discretion
- DockNav internal class structure (single class vs helper functions)
- CSS file naming and organization for dock styles
- How to wire DockNav into main.ts (same SidebarNavConfig callback interface or new DockNavConfig)
- Whether to reuse SidebarNavConfig or define a leaner DockNavConfig interface
- Transition of Cmd+1-9 bindings — they must keep working (DOCK-06 regression tests from Phase 145 are the gate)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Navigation Data Model
- `src/ui/section-defs.ts` — DOCK_DEFS array (verb-noun taxonomy), DockSectionDef interface, SidebarItemDef interface, viewOrder array. Phase 146 consumes DOCK_DEFS directly.

### Current SidebarNav (being replaced)
- `src/ui/SidebarNav.ts` — mount/destroy lifecycle, setActiveItem() API, SidebarNavConfig callback interface, composite key pattern ("sectionKey:itemKey"). Understand the API surface before deleting.
- `src/styles/sidebar-nav.css` — Current sidebar styles (being deleted, not migrated)

### Shell Integration
- `src/ui/WorkbenchShell.ts` lines 55-114 — `.workbench-sidebar` container creation, getSidebarEl() accessor. Width changes from 200px to 48px.
- `src/main.ts` — SidebarNav instantiation, onActivateItem/onActivateSection callbacks, viewManager.switchTo() wiring

### Theme System
- `src/styles/design-tokens.css` — 5 themes: dark (default), light, system, nextstep, material. Dock must define tokens or use existing `--accent`, `--text-secondary`, `--bg-secondary`, `--border-subtle` tokens across all 5.

### Icon System
- `src/ui/icons.ts` — `iconSvg()` helper for rendering Lucide SVGs. Dock items reuse this.

### Regression Tests
- `tests/shortcuts/` — Cmd+1-9 keyboard shortcut regression tests from Phase 145. Must pass after swap.

### Requirements
- `.planning/REQUIREMENTS.md` — DOCK-01 (icon+label), DOCK-02 (active highlight), DOCK-03 (click-to-activate), DOCK-04 (verb-noun sections), A11Y-03 (5-theme coverage)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DOCK_DEFS` array in `section-defs.ts`: Complete verb-noun taxonomy data model ready to consume
- `iconSvg()` in `icons.ts`: Renders Lucide SVGs by name — dock items use this directly
- `SidebarNavConfig` interface: onActivateItem/onActivateSection callbacks — DockNav needs equivalent wiring
- Design tokens: `--accent`, `--text-secondary`, `--bg-secondary`, `--border-subtle` already defined across all 5 themes

### Established Patterns
- mount(container)/destroy() lifecycle pattern (SidebarNav, DataExplorerPanel, WorkbenchShell)
- setActiveItem(sectionKey, itemKey) for external sync of active state
- `"sectionKey:itemKey"` composite string convention (D-001, load-bearing)
- Event delegation pattern (established in v6.0 performance phase)

### Integration Points
- WorkbenchShell.getSidebarEl() returns the mount container — width must change from 200px to 48px
- main.ts creates SidebarNav with config callbacks — swap to DockNav creation with equivalent config
- ViewManager.switchTo() is the target of dock item activation
- CommandRegistry and ShortcutRegistry consume viewOrder — unchanged by this phase

</code_context>

<specifics>
## Specific Ideas

- Finder sidebar style for section headers — small muted text, not prominent
- Icon-only at 48px is the sole layout state; no collapse toggle or thumbnail until Phase 147

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 146-docknav-shell-sidebarnav-swap*
*Context gathered: 2026-04-09*
