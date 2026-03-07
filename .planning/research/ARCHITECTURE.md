# Architecture Patterns: v4.4 UX Complete

**Domain:** Command palette, WCAG 2.1 AA accessibility, light/dark/system theme, enhanced empty states with sample data
**Researched:** 2026-03-07
**Confidence:** HIGH -- all four features integrate with existing architectural seams (ShortcutRegistry, CSS custom properties, ViewManager empty states, Worker Bridge); no new bridge message types, no new providers, no new persistence tiers needed

---

## Executive Summary

v4.4 adds four user-facing capabilities that share one architectural property: they are all **main-thread UI concerns** that do not touch the Worker, database schema, or Swift bridge protocol. The command palette is a new overlay component that queries existing registries (ShortcutRegistry, ViewManager, WorkerBridge FTS5). The accessibility layer adds ARIA attributes to existing D3 data joins and CSS. The theme system restructures design-tokens.css into a light/dark token map with a ThemeManager class that sets a `data-theme` attribute on `:root`. Enhanced empty states extend ViewManager's existing `_showWelcome()` with a "Try Sample Data" button that dispatches hardcoded CanonicalCard arrays through the existing ETL pipeline.

No new bridge message types. No new providers. No new Worker handlers. No changes to D3 data join ownership. The existing CSS custom property system was designed for exactly this kind of extension.

---

## 1. Command Palette (Cmd+K)

### 1.1 Component: CommandPalette

**New file:** `src/ui/CommandPalette.ts`
**New CSS:** `src/styles/command-palette.css`

The command palette is a full-screen overlay (same pattern as HelpOverlay) with a text input, filtered result list, and keyboard navigation. It follows the established Isometry UI pattern: imperative DOM construction, CSS class toggle for visibility, mount/destroy lifecycle.

**Architecture:**

```
CommandPalette
  |-- mount(container)        // Creates overlay DOM, registers Cmd+K via ShortcutRegistry
  |-- show() / hide()         // .is-visible class toggle (same as HelpOverlay)
  |-- destroy()               // Removes DOM, unregisters shortcut
  |
  |-- CommandSource[]          // Array of sources that provide searchable items
  |     |-- ActionsSource      // View switching, import, export, undo/redo
  |     |-- ShortcutsSource    // Reads from ShortcutRegistry.getAll()
  |     |-- CardsSource        // FTS5 search via WorkerBridge.send('search:cards')
  |     |-- SettingsSource     // Theme toggle, audit toggle, density
  |
  |-- FuzzyMatcher             // Client-side scoring for non-FTS sources
  |-- ResultRenderer           // D3-free DOM list with keyboard up/down/enter navigation
```

**Key design decisions:**

1. **No third-party fuzzy search library.** The command palette searches at most ~100 items (9 views + ~15 actions + ~15 shortcuts + ~20 settings = ~60 static items). For this scale, a simple `includes()` + prefix-boost scoring function is sufficient. FTS5 handles card search (already exists in Worker). Adding fuse.js (13KB) or fzf-for-js (6KB) for 60 items is unjustified bundle overhead.

2. **CommandSource interface** for extensibility without coupling. Each source implements `search(query: string): CommandItem[]` synchronously, except CardsSource which returns `Promise<CommandItem[]>` (Worker round-trip). The palette debounces card search at 200ms (matching SuperSearch pattern) while static sources respond instantly.

3. **Register Cmd+K through ShortcutRegistry** (not a separate keydown listener). This ensures the input field guard, platform-aware Cmd detection, and help overlay listing all work automatically. Escape closes the palette (same pattern as HelpOverlay's contextual Escape handler).

4. **Result execution via callback map.** Each CommandItem carries an `execute()` closure. View switches call `viewManager.switchTo()`. Actions call the relevant function. Card selection navigates to the card's current view. No new architectural plumbing needed.

### 1.2 Integration Points

| Existing Component | How Palette Integrates | Modified? |
|-------------------|----------------------|-----------|
| ShortcutRegistry | `shortcuts.register('Cmd+K', ...)` in main.ts | No (uses existing API) |
| ShortcutRegistry.getAll() | ShortcutsSource reads registered shortcuts | No (uses existing API) |
| ViewManager.switchTo() | ActionsSource executes view switching | No (uses existing API) |
| WorkerBridge.send('search:cards') | CardsSource performs FTS5 search | No (uses existing API) |
| HelpOverlay | Palette presence hides help overlay (mutual exclusion) | Minor: add `isVisible()` check |
| MutationManager | ActionsSource provides undo/redo commands | No (uses existing API) |
| FilterProvider | ActionsSource provides "Clear Filters" command | No (uses existing API) |
| AuditState | SettingsSource provides "Toggle Audit Mode" | No (uses existing API) |

**New wiring in main.ts:**

```typescript
// After HelpOverlay mount, before ImportToast setup
const commandPalette = new CommandPalette({
  shortcuts,      // ShortcutRegistry for Cmd+K registration + shortcuts source
  viewManager,    // For view switching commands
  viewFactory,    // For view factory lookup
  bridge,         // For FTS5 card search
  filter,         // For "Clear Filters" action
  mutationManager,// For undo/redo actions
  auditState,     // For audit toggle
  helpOverlay,    // For mutual exclusion
});
commandPalette.mount(container);
```

### 1.3 Keyboard Navigation

The palette manages its own keydown listener (active only while palette is visible) for:
- **Up/Down arrows**: Move highlight through results
- **Enter**: Execute highlighted item
- **Escape**: Close palette
- **Tab**: No-op (prevents focus escaping the palette -- accessibility trap)

This listener is separate from ShortcutRegistry because it only activates when the palette input has focus (ShortcutRegistry guards against input fields). The palette's input element is where typing happens, so ShortcutRegistry's input guard correctly ignores keystrokes while the palette is open.

### 1.4 Accessibility

The command palette follows the WAI-ARIA combobox pattern:
- Input: `role="combobox"`, `aria-expanded="true"`, `aria-controls="palette-results"`, `aria-activedescendant`
- Results list: `role="listbox"`, `id="palette-results"`
- Each result: `role="option"`, `id="palette-item-{n}"`, `aria-selected`

---

## 2. WCAG 2.1 AA Accessibility Layer

### 2.1 Scope

WCAG 2.1 AA compliance requires addressing four principles across the existing 9 views, SuperGrid, overlays, and native shell:

| Principle | Key Criteria | Current State | Work Needed |
|-----------|-------------|---------------|-------------|
| Perceivable | 1.1.1 Non-text content, 1.3.1 Info/relationships, 1.4.3 Contrast (4.5:1), 1.4.11 Non-text contrast (3:1) | Dark theme designed with contrast in mind but not audited; SVG views lack ARIA | Audit + fix contrast ratios, add SVG ARIA, add alt text |
| Operable | 2.1.1 Keyboard, 2.4.3 Focus order, 2.4.7 Focus visible | :focus-visible exists on buttons/cells; SVG elements not focusable; no skip links | Add tabindex to SVG cards, skip navigation, focus management on view switch |
| Understandable | 3.1.1 Language, 3.2.1 On focus, 3.3.1 Error identification | `<html lang="en">` exists; ErrorBanner has categorized messages | Minor: ensure all form controls have labels |
| Robust | 4.1.2 Name/role/value | Buttons have text; no ARIA roles on complex widgets (SuperGrid, overlays) | Add ARIA landmarks, grid role to SuperGrid, dialog role to overlays |

### 2.2 Architecture: Where ARIA Lives

**Critical principle: ARIA attributes are set IN the D3 data join, not after it.** D3 owns the DOM. Any post-render DOM manipulation violates data join ownership (architectural decision D-006 lineage). This means:

**SVG views (List, Grid, Timeline, Network, Tree):**
Each view's `render()` method already creates `<g>` groups via D3 `.enter().append('g')`. ARIA attributes go in the same enter/update callbacks:

```typescript
// ListView example — in render() enter callback
groups.enter()
  .append('g')
  .attr('class', 'card')
  .attr('role', 'listitem')          // NEW
  .attr('tabindex', '0')             // NEW
  .attr('aria-label', d => d.name)   // NEW
```

The SVG container `<svg>` gets:
- `role="list"` (for ListView) or `role="img"` (for NetworkView/TreeView)
- `<title>` and `<desc>` child elements
- `aria-label` describing the current view

**HTML views (Kanban, Calendar, Gallery):**
Same pattern -- ARIA attributes in the DOM construction code:
- Kanban columns: `role="group"`, `aria-label` with column name
- Cards: `role="listitem"` within `role="list"` columns
- Gallery tiles: `role="gridcell"` within `role="grid"` container

**SuperGrid:**
The existing CSS Grid layout maps naturally to ARIA grid roles:
- Container: `role="grid"`, `aria-label="SuperGrid data projection"`
- Column headers: `role="columnheader"`, `aria-sort` when sorted
- Row headers: `role="rowheader"`
- Data cells: `role="gridcell"`, `aria-label` with cell content summary
- Corner cell: `role="presentation"` (decorative)

**Overlays (HelpOverlay, CommandPalette, AuditLegend):**
- `role="dialog"`, `aria-modal="true"`, `aria-label`
- Focus trap: tab cycling within the overlay when open
- Return focus to trigger element on close

### 2.3 New Component: AccessibilityManager

**New file:** `src/accessibility/AccessibilityManager.ts`

A lightweight utility (not a provider -- no state to coordinate) that:

1. **Manages skip navigation link** -- hidden link at top of `#app` that skips to main content area on Tab
2. **Announces view switches** -- creates an `aria-live="polite"` region that announces "Switched to List view" etc.
3. **Manages focus on view switch** -- after ViewManager.switchTo() completes, moves focus to the new view's container

```typescript
export class AccessibilityManager {
  private liveRegion: HTMLElement;
  private skipLink: HTMLAnchorElement;

  mount(container: HTMLElement): void { ... }
  announce(message: string): void { ... }  // Updates aria-live region
  focusView(container: HTMLElement): void { ... }  // Focus management
  destroy(): void { ... }
}
```

**Wired in main.ts** after ViewManager creation. ViewManager gets an optional `onViewSwitched` callback that AccessibilityManager uses to announce and focus.

### 2.4 Color Contrast Audit

The existing design tokens need contrast ratio verification. Key concerns:

| Token Pair | Current | WCAG AA Requirement | Action |
|-----------|---------|---------------------|--------|
| --text-primary (#e0e0e0) on --bg-primary (#1a1a2e) | ~11.5:1 | 4.5:1 (normal text) | PASS |
| --text-secondary (#a0a0b0) on --bg-primary (#1a1a2e) | ~5.8:1 | 4.5:1 (normal text) | PASS |
| --text-muted (#606070) on --bg-primary (#1a1a2e) | ~2.8:1 | 4.5:1 (normal text) | FAIL -- needs adjustment |
| --accent (#4a9eff) on --bg-card (#1e1e2e) | ~5.9:1 | 4.5:1 (normal text) | PASS |
| --text-muted on --bg-surface (#252540) | ~2.5:1 | 4.5:1 (normal text) | FAIL -- needs adjustment |

**`--text-muted` is the primary WCAG failure.** It is used for card type badges, empty state messages, and legend labels. Options:
- Lighten `--text-muted` from `#606070` to `#808090` (~4.5:1 on dark backgrounds)
- This applies to both dark and light themes (addressed in theme section below)

The light theme color palette must be designed with AA contrast from the start (see Section 3).

### 2.5 Keyboard Navigation Enhancements

| Area | Current | Enhancement |
|------|---------|-------------|
| SVG card focus | No tabindex on SVG groups | Add `tabindex="0"` to card `<g>` elements, Enter activates |
| SuperGrid cell focus | Cells have `:focus-visible` CSS but no tabindex | Add `tabindex="0"` to `.data-cell` elements, arrow key navigation within grid |
| View switch | Focus stays on previous location | After switchTo(), focus moves to new view container |
| Overlays | Escape closes HelpOverlay | Add focus trap (Tab cycling) to all overlays |
| Skip nav | None | Hidden link at top: "Skip to content" jumps to `#app` |

### 2.6 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

This goes in `design-tokens.css` and respects D3 transitions (which use `.duration()` -- the CSS override does not affect those). D3 transitions need a separate check:

```typescript
// In transitions.ts or a new utility
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
```

Views call this before applying D3 `.transition().duration()`.

---

## 3. Theme System (Light / Dark / System)

### 3.1 Architecture: data-theme Attribute + CSS Custom Properties

The existing CSS custom property system in `design-tokens.css` was designed for exactly this use case. The architecture:

```
ThemeManager (new)
  |-- getTheme(): 'light' | 'dark' | 'system'
  |-- setTheme(theme): void
  |-- getEffectiveTheme(): 'light' | 'dark'  // Resolves 'system'
  |-- subscribe(cb): () => void
  |
  |-- Reads: localStorage ('isometry-theme')
  |-- Writes: document.documentElement.dataset.theme = 'light' | 'dark'
  |-- Listens: matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ...)
```

**CSS structure (restructured design-tokens.css):**

```css
/* Dark theme (default -- existing values) */
:root,
:root[data-theme="dark"] {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --bg-card: #1e1e2e;
  --bg-surface: #252540;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0b0;
  --text-muted: #808090;  /* RAISED from #606070 for WCAG AA */
  --accent: #4a9eff;
  --accent-hover: #6ab0ff;
  --danger: #ff4a4a;
  /* ... all derived tokens ... */
}

/* Light theme */
:root[data-theme="light"] {
  --bg-primary: #f5f5f7;
  --bg-secondary: #e8e8ec;
  --bg-card: #ffffff;
  --bg-surface: #f0f0f4;
  --text-primary: #1a1a2e;
  --text-secondary: #555566;
  --text-muted: #777788;  /* WCAG AA on light backgrounds */
  --accent: #0066cc;
  --accent-hover: #0055aa;
  --danger: #cc3333;
  /* ... all derived tokens with light-appropriate opacity ... */
}

/* System theme: use prefers-color-scheme */
@media (prefers-color-scheme: light) {
  :root[data-theme="system"] {
    /* Same values as [data-theme="light"] */
  }
}
@media (prefers-color-scheme: dark) {
  :root[data-theme="system"] {
    /* Same values as [data-theme="dark"] */
  }
}
```

### 3.2 Why NOT light-dark() Function

The CSS `light-dark()` function (available since Safari 17.5) would be cleaner syntactically but has two problems for Isometry:

1. **Three-way toggle requires JS anyway.** `light-dark()` responds to `color-scheme` property, which follows system preference. To support a user override (light when system is dark), you still need to set `color-scheme: light` on `:root` from JavaScript. The `data-theme` attribute approach is more explicit and debuggable.

2. **SVG fill/stroke values.** D3 views set `fill` and `stroke` attributes on SVG elements. Some use CSS custom properties (`var(--text-primary)`), some use inline values. The `data-theme` approach works for both CSS selectors and JavaScript reads of `getComputedStyle()`.

### 3.3 ThemeManager Component

**New file:** `src/ui/ThemeManager.ts`

```typescript
export type ThemePreference = 'light' | 'dark' | 'system';
export type EffectiveTheme = 'light' | 'dark';

export class ThemeManager {
  private preference: ThemePreference;
  private subscribers = new Set<() => void>();
  private mediaQuery: MediaQueryList;

  constructor() {
    this.preference = (localStorage.getItem('isometry-theme') as ThemePreference) ?? 'dark';
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQuery.addEventListener('change', this.onSystemChange);
    this.apply();
  }

  getTheme(): ThemePreference { return this.preference; }

  setTheme(theme: ThemePreference): void {
    this.preference = theme;
    localStorage.setItem('isometry-theme', theme);
    this.apply();
    this.notify();
  }

  getEffectiveTheme(): EffectiveTheme {
    if (this.preference === 'system') {
      return this.mediaQuery.matches ? 'dark' : 'light';
    }
    return this.preference;
  }

  subscribe(cb: () => void): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  destroy(): void {
    this.mediaQuery.removeEventListener('change', this.onSystemChange);
  }

  private apply(): void {
    const effective = this.preference === 'system' ? 'system' : this.preference;
    document.documentElement.dataset['theme'] = effective;
  }

  private onSystemChange = (): void => {
    if (this.preference === 'system') this.notify();
  };

  private notify(): void {
    for (const cb of this.subscribers) cb();
  }
}
```

### 3.4 Integration Points

| Existing Component | Theme Integration | Modified? |
|-------------------|-------------------|-----------|
| design-tokens.css | Restructured into dark/light/system blocks | YES -- core change |
| SVG views (fill/stroke) | Views using `var(--token)` in CSS: automatic. Views setting inline colors in JS: must use `getComputedStyle()` or CSS class | YES -- audit needed |
| audit-colors.ts | Hardcoded hex values already documented as tech debt; must use CSS custom properties | YES -- resolve tech debt |
| help-overlay.css | Uses `var(--bg-card)`, `var(--text-primary)` etc. -- automatic | No |
| supergrid.css | Uses CSS custom properties -- automatic | No |
| CommandPalette (new) | Built with CSS custom properties from start | N/A (new) |
| SettingsView.swift | Add "Appearance" section with Light/Dark/System picker | YES -- new section |
| BridgeManager | Send theme preference in LaunchPayload (optional extension) | Minor |
| index.html | Add `<meta name="color-scheme" content="dark light">` | YES |

### 3.5 SVG Color Audit

SVG views set colors in two ways:

1. **CSS classes** (`.card`, `.card-name`) -- these reference `var(--token)` and theme automatically
2. **Inline D3 `.attr('fill', ...)` / `.attr('stroke', ...)`** -- these need updating

Files that set inline SVG colors and need theme-awareness:

| File | What Sets Colors | Fix |
|------|-----------------|-----|
| CardRenderer.ts | `fill` on text, rect, badges | Change to CSS classes or `var()` via `.style()` |
| NetworkView.ts | `stroke` on links, `fill` on nodes | Use `.style('fill', 'var(--text-primary)')` |
| TreeView.ts | `stroke` on paths, `fill` on node circles | Use `.style()` with CSS custom properties |
| TimelineView.ts | `fill` on timeline bars | Use CSS classes |
| audit-colors.ts | Hardcoded hex for audit stripes in SVG | Replace with `var(--audit-new)` etc. |

**D3 `.style()` vs `.attr()`:** For theme-reactive colors, use `.style('fill', 'var(--text-primary)')` instead of `.attr('fill', '#e0e0e0')`. CSS custom properties work in SVG `style` attributes but NOT in SVG presentation attributes (`fill="var(--x)"` is invalid SVG). Using `.style()` ensures the browser resolves the variable.

### 3.6 Native Shell Theme Bridge

The native shell needs to know the effective theme for:
1. **SwiftUI navigation bar tint** -- match web content
2. **WKWebView background** -- prevent white flash on load

Two approaches:

**Option A: CSS-only (recommended).** WKWebView inherits the system appearance. Set `overrideUserInterfaceStyle` on iOS to match the user's web preference:
- When user selects "Light" in web settings, Swift sets `.light`
- When user selects "Dark", Swift sets `.dark`
- When "System", Swift uses default (no override)

The theme preference flows: JS `localStorage` -> on change, post `native:action` with `kind: "setTheme"` -> Swift reads and applies. This reuses the existing `native:action` bridge message type -- no new message type needed.

**Option B: LaunchPayload extension.** Add `theme` field to LaunchPayload so Swift can send the persisted preference on launch. But `localStorage` persists in WKWebView across launches, so JS already has the preference. Option A is sufficient.

### 3.7 Transition Behavior

Theme switches apply instantly (no animation). CSS custom property changes propagate through the cascade automatically. D3 elements using `.style('fill', 'var(...)')` update on the next paint. No explicit re-render needed.

For the theme toggle itself (in settings or command palette), a 150ms `transition: background-color, color, border-color` on `body` provides a smooth feel without layout thrash.

---

## 4. Enhanced Empty States + Sample Data

### 4.1 Architecture: Static Fixtures, Not Generated Data

Sample data should be **hardcoded fixture arrays**, not runtime-generated. Rationale:

1. **Bundle size.** faker.js is 400KB+ minified. Isometry ships in a WKWebView where every KB counts (756KB WASM already). Hardcoded fixtures: ~5KB.
2. **Determinism.** Sample data should look the same every time -- "Welcome to Isometry" is a controlled experience, not a test harness.
3. **TDD.** Hardcoded fixtures are trivially testable. Generated data requires seed management.
4. **Diversity showcase.** Hand-crafted cards demonstrate all 9 import sources, multiple card types, connections, tags, folders, dates -- showing Isometry's full capability. Random data cannot do this.

### 4.2 Component: SampleDataProvider

**New file:** `src/data/sample-data.ts`

Contains a `SAMPLE_CARDS: CanonicalCard[]` array (~50 cards) and `SAMPLE_CONNECTIONS` covering:
- Multiple `card_type` values (note, task, event, person, project)
- Multiple `source` values (to show audit provenance colors)
- Tags, folders, statuses, priorities, due dates
- Connections with `via_card_id` for rich relationship demo
- Dates spanning past 30 days (relative to import time)

**New file:** `src/data/SampleDataLoader.ts`

```typescript
export class SampleDataLoader {
  constructor(private bridge: WorkerBridgeLike) {}

  async load(): Promise<void> {
    // Use the existing ETL import path -- WorkerBridge.importNative()
    // treats sample data as a "virtual" native import
    const cards = buildSampleCards();  // Adjusts dates relative to now
    await this.bridge.importNative('sample' as SourceType, cards);
  }
}
```

### 4.3 Integration: ViewManager Empty State

The existing `ViewManager._showWelcome()` creates a welcome panel with "Import File" and "Import from Mac" buttons. Enhancement:

```
Existing welcome panel:
  "Welcome to Isometry"
  "Import your data to get started"
  [Import File]  [Import from Mac]

Enhanced welcome panel:
  "Welcome to Isometry"
  "Import your data to get started"
  [Import File]  [Import from Mac]

  ---- or ----

  "Explore with sample data"
  [Load Sample Data]
```

The "Load Sample Data" button dispatches a `CustomEvent('isometry:load-sample-data')`. main.ts wires this to `SampleDataLoader.load()`. After loading, `coordinator.scheduleUpdate()` triggers a view re-render -- the empty state disappears because the query now returns cards.

### 4.4 Integration Points

| Existing Component | Sample Data Integration | Modified? |
|-------------------|------------------------|-----------|
| ViewManager._showWelcome() | Add "Load Sample Data" button + divider | YES -- extends existing method |
| WorkerBridge.importNative() | Receives sample cards through existing path | No |
| DedupEngine | Deduplicates sample cards like any import | No |
| SQLiteWriter | Writes sample cards in 100-card batches | No |
| ImportToast | Shows progress during sample data load | No |
| AuditState | Marks sample cards as "new" (session tracking) | No |
| StateCoordinator | Triggers re-render after import | No |

**Key decision: sample data flows through the real ETL pipeline.** This means:
- DedupEngine prevents double-loading if user clicks twice
- ImportToast shows progress feedback
- AuditState tracks sample cards as "new" imports
- ExportOrchestrator can export sample data
- CloudKit sync uploads sample cards to other devices

This is better than a special "inject directly into SQLite" path because it validates the entire import flow and gives users real data they can export, sync, and interact with.

---

## 5. Component Boundary Summary

### 5.1 New Components

| Component | File | Type | Responsibility |
|-----------|------|------|---------------|
| CommandPalette | `src/ui/CommandPalette.ts` | UI overlay | Fuzzy search + execute across views, actions, cards, shortcuts, settings |
| CommandSource (interface) | `src/ui/CommandPalette.ts` | Interface | Contract for searchable item providers |
| ActionsSource | `src/ui/command-sources/ActionsSource.ts` | CommandSource | View switching, import, export, undo/redo |
| ShortcutsSource | `src/ui/command-sources/ShortcutsSource.ts` | CommandSource | Reads ShortcutRegistry |
| CardsSource | `src/ui/command-sources/CardsSource.ts` | CommandSource | FTS5 via WorkerBridge |
| SettingsSource | `src/ui/command-sources/SettingsSource.ts` | CommandSource | Theme, audit, density toggles |
| ThemeManager | `src/ui/ThemeManager.ts` | UI state | 3-way theme toggle, localStorage persistence, system change listener |
| AccessibilityManager | `src/accessibility/AccessibilityManager.ts` | Utility | Skip nav, aria-live announcements, focus management |
| SampleDataLoader | `src/data/SampleDataLoader.ts` | Data | Loads hardcoded sample cards through ETL pipeline |
| sample-data.ts | `src/data/sample-data.ts` | Fixture | ~50 CanonicalCard[] + connections |

### 5.2 Modified Components

| Component | File | What Changes | Why |
|-----------|------|-------------|-----|
| design-tokens.css | `src/styles/design-tokens.css` | Split into dark/light/system token blocks | Theme system |
| views.css | `src/styles/views.css` | Add reduced-motion media query, adjust --text-muted | Accessibility |
| ViewManager | `src/views/ViewManager.ts` | Add "Load Sample Data" to welcome panel, optional onViewSwitched callback | Sample data, accessibility |
| ListView | `src/views/ListView.ts` | Add ARIA roles (role="list", role="listitem", tabindex, aria-label) to D3 data join | Accessibility |
| GridView | `src/views/GridView.ts` | Same ARIA pattern as ListView | Accessibility |
| KanbanView | `src/views/KanbanView.ts` | Add ARIA roles to columns and cards | Accessibility |
| CalendarView | `src/views/CalendarView.ts` | Add ARIA roles, aria-label for date cells | Accessibility |
| TimelineView | `src/views/TimelineView.ts` | Add ARIA roles, use CSS custom properties for fill | Accessibility + Theme |
| GalleryView | `src/views/GalleryView.ts` | Add ARIA grid roles to tiles | Accessibility |
| NetworkView | `src/views/NetworkView.ts` | Add ARIA img role to SVG, desc element, use var() for fills | Accessibility + Theme |
| TreeView | `src/views/TreeView.ts` | Add ARIA tree roles, use var() for fills | Accessibility + Theme |
| SuperGrid | `src/views/SuperGrid.ts` | Add ARIA grid/columnheader/rowheader/gridcell roles | Accessibility |
| CardRenderer.ts | `src/views/CardRenderer.ts` | Replace inline hex fills with CSS custom property references | Theme |
| audit-colors.ts | `src/audit/audit-colors.ts` | Replace hardcoded hex with CSS custom property reads | Theme (resolves tech debt) |
| HelpOverlay | `src/shortcuts/HelpOverlay.ts` | Add role="dialog", aria-modal, focus trap | Accessibility |
| AuditOverlay | `src/audit/AuditOverlay.ts` | Migrate Shift+A to ShortcutRegistry (consistency) | Accessibility/cleanup |
| main.ts | `src/main.ts` | Wire CommandPalette, ThemeManager, AccessibilityManager, SampleDataLoader | All features |
| index.html | `index.html` | Add color-scheme meta, skip nav target | Theme + Accessibility |
| SettingsView.swift | `native/.../SettingsView.swift` | Add Appearance section with Light/Dark/System picker | Theme |
| ContentView.swift | `native/.../ContentView.swift` | Forward theme preference from native settings to JS | Theme |

### 5.3 Unchanged Components

These components are NOT modified despite touching related concerns:

| Component | Why Unchanged |
|-----------|--------------|
| WorkerBridge | No new message types; FTS5 search already exists |
| Worker handlers | No new handlers needed; sample data uses existing import path |
| Providers (Filter, PAFV, Selection, Density, SuperDensity, SuperPosition) | No new provider state; theme is UI-only |
| StateCoordinator | No new provider registrations |
| MutationManager | Undo/redo exposed through CommandPalette but no API changes |
| QueryBuilder | No query changes |
| Database schema | No schema changes |
| BridgeManager.swift | No new bridge message types (theme uses native:action) |
| DatabaseManager.swift | No persistence changes |
| ETL parsers | Sample data bypasses parsing (pre-formed CanonicalCards) |

---

## 6. Data Flow Diagrams

### 6.1 Command Palette Search Flow

```
User types "list" in palette input
  |
  v
CommandPalette.onInput()
  |-- ActionsSource.search("list")     -> [{name: "Switch to List", execute: () => viewManager.switchTo('list', ...)}]
  |-- ShortcutsSource.search("list")   -> [{name: "Cmd+1: List view", execute: () => shortcuts.get('Cmd+1').handler()}]
  |-- CardsSource.search("list")       -> debounce 200ms -> bridge.send('search:cards', {query: "list"}) -> [{name: "Shopping List", ...}]
  |-- SettingsSource.search("list")    -> []
  |
  v
Merge results, score, rank, render top 10
  |
  v
User presses Enter on "Switch to List"
  |
  v
execute() -> viewManager.switchTo('list', viewFactory['list'])
  |
  v
CommandPalette.hide()
```

### 6.2 Theme Switch Flow

```
User selects "Light" in Settings (native or command palette)
  |
  v
ThemeManager.setTheme('light')
  |-- localStorage.setItem('isometry-theme', 'light')
  |-- document.documentElement.dataset.theme = 'light'
  |-- notify subscribers
  |
  v
CSS cascade resolves all var(--token) references to light values
  |
  v
All DOM elements update on next paint (no JS re-render needed)
  |
  v
SVG elements using .style('fill', 'var(--text-primary)') update automatically
  |
  v
If native: native:action { kind: 'setTheme', theme: 'light' }
  |-- Swift: overrideUserInterfaceStyle = .light
```

### 6.3 Sample Data Load Flow

```
User clicks "Load Sample Data" in welcome panel
  |
  v
CustomEvent('isometry:load-sample-data')
  |
  v
main.ts handler -> SampleDataLoader.load()
  |
  v
buildSampleCards()  // Adjusts dates relative to Date.now()
  |
  v
bridge.importNative('sample', cards)
  |
  v
Worker: etl:import-native handler
  |-- DedupEngine (source='sample', source_id per card)
  |-- SQLiteWriter (100-card batch)
  |-- FTS5 rebuild
  |
  v
ImportToast.showProgress(...)
  |
  v
bridge.importNative returns ImportResult
  |
  v
auditState.addImportResult(result, 'sample')
  |
  v
coordinator.scheduleUpdate()
  |
  v
ViewManager._fetchAndRender() -> cards.length > 0 -> currentView.render(cards)
```

---

## 7. Suggested Build Order

The four features have specific dependency ordering:

### Phase 1: Theme System (foundation)
**Rationale:** Theme system restructures design-tokens.css. All subsequent ARIA work, command palette styling, and empty state styling should be built on the final token structure. Doing theme first means every new CSS written in later phases is already theme-aware.

### Phase 2: Accessibility Layer
**Rationale:** ARIA roles, focus management, and contrast fixes need the finalized color tokens from Phase 1. Accessibility is also a prerequisite for the command palette's ARIA combobox pattern -- better to establish the accessibility patterns first so the palette follows them.

### Phase 3: Command Palette
**Rationale:** Depends on ShortcutRegistry (exists), ViewManager (exists), WorkerBridge (exists). The palette also needs the theme-aware styles from Phase 1 and follows the ARIA patterns established in Phase 2. It provides the mechanism for theme switching from the keyboard (SettingsSource), creating a virtuous cycle.

### Phase 4: Enhanced Empty States + Sample Data
**Rationale:** The simplest feature -- extends ViewManager._showWelcome() with one new button and a ~5KB fixture file. Should come last because it benefits from all prior work: the sample data renders in the accessible, theme-aware, command-palette-discoverable app. It is the final polish that makes the first-launch experience complete.

---

## 8. Anti-Patterns to Avoid

### Anti-Pattern 1: Provider for Theme State
**What:** Creating a ThemeProvider registered with StateCoordinator
**Why bad:** Theme changes do NOT require database re-queries. CSS custom property updates propagate through the cascade automatically. Registering with StateCoordinator would trigger unnecessary Worker round-trips on every theme switch.
**Instead:** ThemeManager is standalone. It sets `data-theme` on `:root` and notifies its own subscribers. Views do not re-render on theme change -- CSS handles it.

### Anti-Pattern 2: Post-render ARIA Injection
**What:** Using MutationObserver or setTimeout to add ARIA attributes after D3 renders
**Why bad:** Violates D3 data join ownership. Race conditions with D3's enter/update/exit. Attributes may be lost on re-render.
**Instead:** All ARIA attributes set inside D3's `.enter()` and merge (update) selections, alongside existing attributes like `class`, `transform`, etc.

### Anti-Pattern 3: New Bridge Message Type for Theme
**What:** Adding a "native:theme" message type
**Why bad:** The bridge protocol has 6 message types by design. Theme is a `native:action` with `kind: "setTheme"` -- the extensible action pattern already handles this.
**Instead:** Use `native:action` with `{ kind: "setTheme", theme: "light" }`.

### Anti-Pattern 4: Faker.js for Sample Data
**What:** Using faker.js or similar library to generate sample data at runtime
**Why bad:** 400KB+ bundle size for a feature used once per user (first launch). Non-deterministic -- cannot screenshot for App Store. Cannot test reliably without seeds.
**Instead:** Hand-crafted ~50 card fixture array in a static .ts file (~5KB).

### Anti-Pattern 5: Separate Accessibility CSS File per View
**What:** Creating NetworkView-a11y.css, TreeView-a11y.css, etc.
**Why bad:** Scatters accessibility concerns across many files. Makes audit harder.
**Instead:** Single `accessibility.css` file for cross-cutting concerns (skip nav, focus indicators, reduced motion). View-specific ARIA goes in the view's TypeScript (inside D3 data join).

### Anti-Pattern 6: Command Palette as React/Web Component
**What:** Using a library like ninja-keys or command-pal (Web Components)
**Why bad:** Isometry is pure TypeScript + D3. Adding Web Components or Lit introduces a second rendering paradigm. The palette is ~200 lines of DOM construction -- the same pattern as HelpOverlay, ActionToast, ImportToast.
**Instead:** Build CommandPalette.ts following the established HelpOverlay pattern.

---

## 9. Scalability Considerations

| Concern | Current Scale | At Scale | Approach |
|---------|--------------|----------|----------|
| Command palette items | ~60 static + FTS5 search | ~60 static + 10K cards | FTS5 handles card search (already proven at 10K+). Static items are always <100. |
| Theme CSS | 2 theme blocks (~100 custom properties each) | Same | CSS custom properties are O(1) lookup. No performance concern. |
| ARIA attributes | 9 views x up to 500 cards | 10K cards with virtual scrolling | Virtual scrolling already limits DOM to visible rows. ARIA attributes on ~100 visible elements only. |
| Sample data | 50 cards + connections | Fixed | Sample data is a one-time operation. If user wants more, they import real data. |

---

## Sources

### Command Palette
- [command-pal: Hackable command palette for the web](https://benwinding.github.io/command-pal/docs/)
- [Awesome command palette implementations](https://github.com/stefanjudis/awesome-command-palette)
- [Fuse.js fuzzy search](https://www.fusejs.io/)
- [fzf-for-js](https://github.com/ajitid/fzf-for-js)

### WCAG 2.1 AA
- [WCAG 2.1 Specification](https://www.w3.org/TR/WCAG21/)
- [Accessible D3.js data visualizations](https://fossheim.io/writing/posts/accessible-dataviz-d3-intro/)
- [D3 bar chart accessibility](https://www.a11ywithlindsey.com/blog/accessibility-d3-bar-charts/)
- [SVG ARIA roles for charts (W3C)](https://www.w3.org/wiki/SVG_Accessibility/ARIA_roles_for_charts)
- [Accessible SVG and ARIA (data.europa.eu)](https://data.europa.eu/apps/data-visualisation-guide/accessible-svg-and-aria)
- [Apple WWDC19: Supporting Dark Mode in Web Content](https://developer.apple.com/videos/play/wwdc2019/511/)

### Theme System
- [CSS light-dark() function (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/light-dark)
- [prefers-color-scheme (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
- [color-scheme CSS property (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme)
- [Theming with CSS in 2025](https://mamutlove.com/en/blog/theming-with-css-in-2025/)
- [Safari 17.5 light-dark() support](https://webkit.org/blog/15383/webkit-features-in-safari-17-5/)
- [Supporting Dark Mode in WKWebView](https://useyourloaf.com/blog/supporting-dark-mode-in-wkwebview/)

### Sample Data
- [Faker.js](https://fakerjs.dev/) (evaluated and rejected for bundle size)
