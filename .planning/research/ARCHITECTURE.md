# Architecture Research — v11.0 Navigation Bar Redesign

## Summary

DockNav is a drop-in swap for SidebarNav. The panel plugin architecture (PanelDrawer/PanelRegistry/CollapsibleSection) already supports new panels without changes. Explorer "decoupling" is largely achieved — explorers already live in PanelDrawer as plugins, not inside SidebarNav.

## Key Integration Points

### SidebarNav Callback Interface (Must Replicate in DockNav)

SidebarNav exposes these methods that callers depend on:
- `onActivateItem` / `onActivateSection` — event handlers
- `setActiveItem` — programmatic selection
- `startCycle` / `stopCycle` / `isCycling` — auto-cycle for view transitions
- `updateRecommendations` — recommendation badge updates

**ShortcutRegistry and auto-cycle depend on these with zero caller changes needed.**

### Load-Bearing Key Convention

The `"sectionKey:itemKey"` composite key threads through:
- SidebarNav internal state
- ShortcutRegistry bindings (Cmd+1-9)
- Auto-cycle logic

**DockNav must preserve this string convention or keyboard shortcuts break silently.**

### PanelDrawer/PanelRegistry — Zero Changes Needed

The PanelHook interface (factory pattern, enable/disable lifecycle) already supports all new panels:
- StoriesExplorer, Maps stub, Formulas stub register via PanelRegistry
- They appear in the icon strip automatically

## Component Map

| Existing Component | Change Required | Notes |
|-------------------|----------------|-------|
| WorkbenchShell | Swap SidebarNav → DockNav in `getSidebarEl()` slot | Same DOM region |
| SidebarNav | REPLACED by DockNav | Preserved as reference until verified |
| PanelDrawer | None | Already manages explorer panels |
| PanelRegistry | None | New panels register here |
| CollapsibleSection | None | Panel content container |
| ViewManager | None | View switching unchanged |
| ShortcutRegistry | None | If sectionKey:itemKey convention preserved |
| StateCoordinator | None | No new subscriptions needed |

## New Components

| Component | Purpose | Dependencies |
|-----------|---------|-------------|
| `src/ui/section-defs.ts` | Shared section/item key definitions | Extract from SidebarNav first |
| `src/ui/DockNav.ts` | Dock-style navbar with 3-state collapse | section-defs, CSS tokens |
| `src/ui/MinimapRenderer.ts` | Lazy thumbnail generation (on-hover) | D3, XMLSerializer/OffscreenCanvas |
| `StoriesExplorer` | Stories panel (PanelHook) | PanelRegistry |
| Maps/Formulas stubs | Placeholder PanelHook entries | PanelRegistry |

## Critical Design Decisions

1. **MinimapRenderer must be lazy (on-hover), never subscribed to StateCoordinator.** Thumbnail is a snapshot at hover time — live subscriptions for hidden content are wasteful.

2. **SECTION_DEFS extraction is the critical first step.** Extract before writing DockNav so both old and new components share key strings during transition.

3. **DockNav mounts in same `.workbench-sidebar` slot.** WorkbenchShell exposes `getSidebarEl()` — the slot is agnostic to what mounts there.

## Suggested Build Order

1. **Extract SECTION_DEFS** — shared section/item key definitions from SidebarNav
2. **DockNav Shell** — icon-only buttons + text tooltips, swap for SidebarNav, CSS width 200px→56px
3. **Verb→Noun Taxonomy** — reorganize section definitions to Integrate/Visualize/Analyze/Activate/Help
4. **3-State Collapse** — Hidden/Icon/Icon+Thumbnail with CSS grid-template-rows animation
5. **New Panel Registrations** — StoriesExplorer (PanelHook), Maps stub, Formulas stub
6. **MinimapRenderer** — Static 96×48 SVG thumbnails per panel type, wired to DockNav hover
7. **MinimapLoupe** — `data-minimap-scroll-root` on explorer scroll containers, loupe overlay
8. **iOS Stories Splash** — SwiftUI entry point gated by @AppStorage

## Open Questions

1. Minimap content: schematic/abstract representation vs D3 data-scaled thumbnail? (Schematic simpler, no data-staleness)
2. StoriesExplorer on iOS: full-bleed view replacement (ViewManager) or panel in PanelDrawer? Milestone says splash screen → may need full-bleed on iOS, panel on macOS
