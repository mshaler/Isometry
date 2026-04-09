# Pitfalls Research — v11.0 Navigation Bar Redesign

## Summary

7 critical pitfalls identified from direct codebase analysis. All are preventable with correct phase ordering and targeted testing.

## Pitfall 1: Keyboard Shortcut Wiring Breaks on SidebarNav Replacement

**Risk:** HIGH | **Phase:** DockNav swap
**Problem:** ShortcutRegistry depends on SidebarNav's concrete class methods. Replacing SidebarNav with DockNav without matching the method interface breaks Cmd+1-9 view switching silently.
**Prevention:** DockNav must implement identical method signatures (`setActiveItem`, `onActivateItem`, `startCycle`/`stopCycle`). Extract shared interface type before building DockNav. TDD: write keyboard shortcut regression tests before swap.

## Pitfall 2: Minimap Thumbnails Block WKWebView Frame Budget

**Risk:** HIGH | **Phase:** MinimapRenderer
**Problem:** Rendering minimap thumbnails synchronously (DOM clone + scale) blocks the main thread. At 96×48 with D3 SVG content, a single thumbnail render can take 50-100ms — blowing the 16ms frame budget.
**Prevention:** Render thumbnails asynchronously via `OffscreenCanvas` or `requestIdleCallback`. Cache results — only re-render on view activation, not on every data change. Never render all thumbnails simultaneously.

## Pitfall 3: CSS Layout Breaks When 200px Sidebar Column Removed

**Risk:** MEDIUM | **Phase:** DockNav swap
**Problem:** `workbench.css` has hardcoded pixel values for the sidebar column width. Changing from 200px to 56px (icon-only) or variable width breaks the CSS Grid layout for the main panel.
**Prevention:** Replace hardcoded sidebar width with CSS custom property (`--dock-width`). The 3-state collapse controls this single token. Test all 5 themes × 3 dock states.

## Pitfall 4: 5-Theme System Breaks with Incomplete Token Coverage

**Risk:** MEDIUM | **Phase:** DockNav CSS
**Problem:** New dock CSS tokens (e.g., `--dock-bg`, `--dock-icon-size`, `--dock-thumbnail-border`) added to only one theme block (e.g., dark) while the other 4 themes inherit incorrect fallbacks.
**Prevention:** Add all new CSS custom properties to the base `:root` block with sensible defaults. Theme-specific overrides only where needed. Run visual check across all 5 themes before merging.

## Pitfall 5: iOS Stories Splash Delays WASM Warm-Up

**Risk:** HIGH | **Phase:** iOS Stories splash
**Problem:** If `IsometryApp.task{}` is gated on splash dismissal, the WASM warm-up (currently fires before `ContentView.onAppear`) is delayed. First SuperGrid render after splash takes 3-5 seconds instead of <1s.
**Prevention:** Keep WASM warm-up in `IsometryApp.task{}` unconditionally. Stories splash is a SwiftUI overlay (`fullScreenCover`) that dismisses to reveal an already-warmed WKWebView. Never gate WASM init on UI state.

## Pitfall 6: Explorer Panels Orphaned During Migration

**Risk:** MEDIUM | **Phase:** Explorer decoupling
**Problem:** If PanelDrawer panels are destroyed and recreated during the sidebar→dock migration, `CollapsibleSection.destroy()` may not be called, leaking event listeners and D3 selections.
**Prevention:** Verify `destroy()` is called on all existing panel instances before DockNav mounts. Add test assertions for listener cleanup. Use the existing `usePlugin` auto-destroy pattern from v8.3 as reference.

## Pitfall 7: WCAG 2.1 AA — Dual Navigation Landmark Conflict

**Risk:** MEDIUM | **Phase:** DockNav accessibility
**Problem:** The dock is a `role="tablist"` navigation pattern. If both the dock and the existing command palette/menu have `role="navigation"` ARIA landmarks, screen readers get confused with two competing nav landmarks.
**Prevention:** Dock gets `role="tablist"` with `aria-label="Dock navigation"`. Ensure only one `role="navigation"` landmark exists. Existing roving tabindex pattern applies within the dock. Test with VoiceOver before merging.

## Phase Risk Summary

| Phase | Pitfalls | Risk Level |
|-------|----------|-----------|
| DockNav swap | #1, #3 | HIGH — keyboard shortcuts + layout |
| DockNav CSS | #4 | MEDIUM — theme coverage |
| MinimapRenderer | #2 | HIGH — frame budget |
| Explorer decoupling | #6 | MEDIUM — lifecycle cleanup |
| iOS Stories splash | #5 | HIGH — WASM warm-up timing |
| Accessibility | #7 | MEDIUM — landmark conflict |
