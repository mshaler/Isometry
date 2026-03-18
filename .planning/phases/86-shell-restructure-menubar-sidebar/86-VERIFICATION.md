---
phase: 86-shell-restructure-menubar-sidebar
verified: 2026-03-18T00:30:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 86: Shell Restructure (Menubar + Sidebar) Verification Report

**Phase Goal:** Center "Isometry" wordmark in menubar, enlarge settings icon, remove ViewSwitcher from menubar. Restructure sidebar to 8 top-level sections with 3-state toggle (hidden/visible/collapsed), sub-items as leaf launchers with active state highlighting. GRAPH Explorers, Formula Explorer, and Interface Builder are navigation stubs with placeholder panels.
**Verified:** 2026-03-18T00:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Menubar shows centered "Isometry" wordmark text | VERIFIED | `CommandBar.ts` line 65-67: `wordmark.className = 'workbench-command-bar__wordmark'`, `wordmark.textContent = 'Isometry'`; CSS `flex: 1; text-align: center` |
| 2 | Command palette opens via diamond icon in left position | VERIFIED | `CommandBar.ts` line 55-61: `appIcon` button with `aria-label="Open command palette"`, `textContent = '\u25C6'`, click fires `onOpenPalette()` |
| 3 | Settings gear icon is visually larger (36x36px) | VERIFIED | `workbench.css` lines 309-323: `.workbench-command-bar__settings-trigger { width: 36px; height: 36px; font-size: var(--text-xl) }` |
| 4 | ViewSwitcher tab bar no longer appears in menubar area | VERIFIED | `main.ts`: no `ViewTabBar` import, no `viewTabBar` references, no `getTabBarSlot()` calls; `WorkbenchShell.ts` has no `_tabBarSlot` field or `getTabBarSlot()` method |
| 5 | Shell layout is two-column: sidebar placeholder + main content | VERIFIED | `WorkbenchShell.ts` lines 82-116: `.workbench-body` flex-row wrapper with `.workbench-sidebar` (200px) and `.workbench-main` (flex:1); CSS rules confirmed |
| 6 | Sidebar shows 8 top-level section headers with icons and labels | VERIFIED | `SidebarNav.ts` lines 44-143: `SECTION_DEFS` array with exactly 8 entries (data-explorer, properties, projection, visualization, latch, graph, formula, interface-builder) |
| 7 | Clicking a section header toggles between collapsed and visible states | VERIFIED | `SidebarNav.ts` `_toggleSection()` lines 411-429: cycles `data-state` between `'collapsed'` and `'visible'`, updates `aria-expanded` |
| 8 | Expanded sections show leaf items as clickable buttons | VERIFIED | `SidebarNav.ts` `_buildItem()` lines 345-387: `<button class="sidebar-item">` per item; CSS `max-height` transition on `.sidebar-section[data-state="visible"] .sidebar-section__items` |
| 9 | Clicking a leaf item highlights it with accent styling and activates corresponding panel/view | VERIFIED | `SidebarNav.ts` `_activateItem()` lines 443-459: adds `.sidebar-item--active`, sets `aria-current="page"`, calls `onActivateItem`; wired to `viewManager.switchTo()` in `main.ts` line 504 |
| 10 | GRAPH Explorers, Formula Explorer, and Interface Builder show stub panels when expanded | VERIFIED | `SidebarNav.ts` `_buildStub()` lines 389-405: creates `.collapsible-section__stub` with exact copy text; stubs appended inside items list for graph/formula/interface-builder sections |
| 11 | All sections default to collapsed state on mount | VERIFIED | `SidebarNav.ts` line 273: `section.setAttribute('data-state', 'collapsed')` in `_buildSection()` |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/ui/CommandBar.ts` | Restructured menubar with wordmark center, palette left, settings right | VERIFIED | 275 lines; contains `workbench-command-bar__wordmark` class and `'Isometry'` text; no `workbench-command-bar__input` instantiation |
| `src/styles/workbench.css` | Wordmark CSS, enlarged settings, two-column shell layout | VERIFIED | Contains `.workbench-command-bar__wordmark`, `.workbench-command-bar__settings-trigger` at 36px, `.workbench-body`, `.workbench-sidebar`, `.workbench-main` |
| `src/ui/WorkbenchShell.ts` | Two-column layout with sidebar container + main wrapper | VERIFIED | 213 lines; `.workbench-sidebar` creation with `this._sidebarEl = sidebar`; `getSidebarEl()` public method exposed |
| `src/ui/SidebarNav.ts` | 8-section sidebar navigation with 3-state toggle and leaf item activation | VERIFIED | 494 lines (above 150-line min); exports `SidebarNav` class and `SidebarNavConfig` interface |
| `src/styles/sidebar-nav.css` | Sidebar layout, section headers, leaf items, active states | VERIFIED | 167 lines; contains all required selectors including `.workbench-sidebar__nav`, `.sidebar-section`, `.sidebar-section__header`, `.sidebar-item`, `.sidebar-item--active` |
| `src/main.ts` | SidebarNav instantiation and ViewManager wiring | VERIFIED | Imports `SidebarNav`, instantiates with callbacks, calls `sidebarNav.mount(shell.getSidebarEl())`, `onViewSwitch` syncs sidebar via `setActiveItem()` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/ui/CommandBar.ts` | `src/styles/workbench.css` | CSS class `workbench-command-bar__wordmark` | WIRED | CommandBar creates element with this class; CSS defines it with `flex: 1; text-align: center` |
| `src/ui/WorkbenchShell.ts` | `src/styles/workbench.css` | CSS classes `workbench-sidebar`, `workbench-main` | WIRED | WorkbenchShell creates elements with both classes; CSS defines both with layout rules |
| `src/ui/SidebarNav.ts` | `src/styles/sidebar-nav.css` | CSS class references `sidebar-section`, `sidebar-item` | WIRED | SidebarNav imports `../styles/sidebar-nav.css` (line 15); uses `sidebar-section__header`, `sidebar-item--active` throughout |
| `src/main.ts` | `src/ui/SidebarNav.ts` | SidebarNav instantiation and mount | WIRED | `import { SidebarNav } from './ui/SidebarNav'` (line 47); `new SidebarNav({...})` (line 499); `sidebarNav.mount(shell.getSidebarEl())` (line 518) |
| `src/ui/SidebarNav.ts` | `src/ui/WorkbenchShell.ts` | mounts into `getSidebarEl()` | WIRED | `shell.getSidebarEl()` called in `main.ts` line 518; `getSidebarEl()` returns `this._sidebarEl` which is the `.workbench-sidebar` container |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MENU-01 | 86-01 | Center "Isometry" wordmark in menubar | SATISFIED | `CommandBar.ts`: static `<span class="workbench-command-bar__wordmark">Isometry</span>` with `flex: 1; text-align: center` CSS |
| MENU-02 | 86-01 | Command palette trigger remains in left zone (diamond icon) | SATISFIED | `CommandBar.ts`: `appIcon` button with `workbench-command-bar__app-icon` class, `\u25C6` (diamond), `aria-label="Open command palette"` |
| MENU-03 | 86-01 | Settings icon enlarged to 36x36px | SATISFIED | `workbench.css`: `.workbench-command-bar__settings-trigger { width: 36px; height: 36px; font-size: var(--text-xl) }` |
| MENU-04 | 86-01 | ViewSwitcher tab bar removed from menubar | SATISFIED | `main.ts`: no `ViewTabBar` import or instantiation; `WorkbenchShell.ts`: no `_tabBarSlot` or `getTabBarSlot()`; seam tests updated |
| SIDE-01 | 86-02 | 8 top-level section headers with icons and labels | SATISFIED | `SidebarNav.ts` `SECTION_DEFS`: exactly 8 entries with `key`, `label`, `icon`, `items` |
| SIDE-02 | 86-02 | 3-state toggle (hidden/collapsed/visible) | SATISFIED | `_setState()` sets `data-state` attribute; CSS drives visibility via `[data-state="hidden"] { display: none }` and max-height transition |
| SIDE-03 | 86-02 | Sub-items as leaf launchers with active state highlighting | SATISFIED | `.sidebar-item--active`: `background: var(--accent-bg)`, `color: var(--accent)`, `border-left-color: var(--accent)`, `font-weight: 600` |
| SIDE-04 | 86-02 | Visualization items activate corresponding views | SATISFIED | `main.ts` `onActivateItem`: `sectionKey === 'visualization'` branch calls `viewManager.switchTo(viewType, ...)` |
| SIDE-05 | 86-02 | GRAPH/Formula/Interface Builder are navigation stubs with placeholder panels | SATISFIED | `_buildStub()` creates `.collapsible-section__stub` with exact copy: "Graph analysis tools — coming soon.", "DSL formulas, SQL queries, and graph queries — coming soon.", "Formats, templates, and apps — coming soon." |

No orphaned requirements detected. All 9 requirement IDs (MENU-01..04, SIDE-01..05) are claimed in plans and verified in code.

---

### Anti-Patterns Found

No blockers or warnings found.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/ui/WorkbenchShell.ts` | 57 | Stale JSDoc comment references "tab-bar-slot" (removed feature) | Info | Documentation drift only; no functional impact |

---

### Human Verification Required

#### 1. Menubar Visual Layout

**Test:** Open the app in a browser/WKWebView, observe the menubar.
**Expected:** Diamond icon (left), centered "Isometry" wordmark (middle, non-clickable), enlarged gear icon (right, ~36px). No tab bar visible below.
**Why human:** CSS `flex: 1` centering and visual proportions require visual inspection.

#### 2. Sidebar Section Toggle Animation

**Test:** Click any section header in the sidebar.
**Expected:** Items list expands with a smooth 200ms max-height transition. Chevron rotates 90 degrees. Clicking again collapses with reverse animation.
**Why human:** CSS transition behavior requires visual/temporal verification.

#### 3. Stub Panel Rendering

**Test:** Expand "GRAPH Explorers", "Formula Explorer", and "Interface Builder" in the sidebar.
**Expected:** Each shows item buttons AND a stub panel at the bottom with the "coming soon" message in dimmed text.
**Why human:** Requires visual confirmation that stub panels render correctly within the expanded section.

#### 4. Sidebar Active State Sync

**Test:** Press Cmd+1 through Cmd+9 to switch views.
**Expected:** "Visualization Explorer" section auto-expands (if collapsed) and the matching leaf item gets accent-colored left border and highlighted text. Previous active item deactivates.
**Why human:** Requires confirming the `onViewSwitch` -> `setActiveItem` -> `_setState('visible')` chain produces visible UI feedback.

---

### Gaps Summary

No gaps. All automated checks passed. Phase 86 goal is fully achieved in the codebase.

Key facts confirmed:
- `CommandBar.ts` has been restructured to 3-zone layout with no command input pill
- `WorkbenchShell.ts` has two-column layout with `getSidebarEl()` returning the 200px sidebar container
- `SidebarNav.ts` is 494 lines with all 8 SECTION_DEFS, 3-state toggle, roving tabindex, stub panels using existing CSS classes
- `sidebar-nav.css` is 167 lines with all required selectors and design token variables
- `main.ts` wires `SidebarNav` with `onActivateItem` (view switching) and `onViewSwitch` (sidebar sync)
- All 4 task commits are present and verified in git history
- 52 UI seam tests pass; 0 src/ TypeScript errors
- Pre-existing test TypeScript errors in `tests/seams/etl/etl-fts.test.ts`, `tests/seams/ui/calc-explorer.test.ts`, and `tests/views/GalleryView.test.ts` are unrelated to Phase 86 (documented in 86-01-SUMMARY.md)

---

_Verified: 2026-03-18T00:30:00Z_
_Verifier: Claude (gsd-verifier)_
