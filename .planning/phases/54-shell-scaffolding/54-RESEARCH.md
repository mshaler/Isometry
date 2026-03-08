# Phase 54: Shell Scaffolding - Research

**Researched:** 2026-03-07
**Domain:** DOM restructuring, CSS layout, component lifecycle, accessibility
**Confidence:** HIGH

## Summary

Phase 54 replaces the flat `#app → ViewManager` layout with a vertical panel stack shell (`WorkbenchShell → CommandBar → ViewTabBar → panel-rail → view-content`). The core risk is CSS bleed and flex layout breaking SuperGrid's sticky headers and scroll behavior. Every new module (WorkbenchShell, CollapsibleSection, CommandBar) follows the existing `mount/update/destroy` lifecycle pattern with constructor injection — no new patterns are introduced.

The codebase already has all the building blocks: design tokens for theming, ShortcutRegistry for keyboard shortcuts, CommandPalette for Cmd+K, ViewTabBar for view switching, and a well-established overlay pattern (HelpOverlay, CommandPalette, AuditOverlay). The primary technical challenge is the flex layout math — `.workbench-view-content` must have `min-height: 0` and `flex: 1` to let SuperGrid's internal `overflow: auto` container work with sticky headers.

**Primary recommendation:** Build WorkbenchShell as a thin DOM orchestrator that creates the flex-column layout, creates CommandBar and CollapsibleSection children, re-roots ViewManager into `.workbench-view-content`, and moves overlays/toasts to `document.body`. All CSS scoped under `.workbench-shell` using existing design tokens.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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
- CommandBar always sticky at top — outside the scrollable panel rail, first child of .workbench-shell
- App icon trigger opens existing CommandPalette (same as Cmd+K) — single entry point, reuses existing code
- Command input is a styled non-editable placeholder bar showing "Command palette..." with ⌘K hint — clicking opens CommandPalette overlay
- Settings trigger opens a dropdown menu with: Theme toggle (dark/light/system), Density selector, Help shortcut, About — reuses existing ThemeProvider/DensityProvider
- ViewTabBar kept as horizontal 9-view tab strip — all 9 views remain available
- ViewTabBar positioned below CommandBar, above panel rail — fixed, never scrolls
- Layout order: CommandBar → ViewTabBar → panel-rail → view-content
- Restyled ViewTabBar to match WorkbenchShell aesthetic — same spacing tokens, border treatment, background as CommandBar
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

### Deferred Ideas (OUT OF SCOPE)
- Resizable drag splitters between panels — future enhancement, not Phase 54
- Reducing ViewTabBar to SuperGrid-only — future milestone decision
- Rich summary badges in collapsed headers (axis names, filter state) — future phase when explorers have real content
- Inline search in CommandBar (replacing CommandPalette overlay) — future consideration
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SHEL-01 | WorkbenchShell creates vertical stack layout under #app with .workbench-shell flex-column container | Architecture pattern: flex-column host with 4 fixed zones (CommandBar, ViewTabBar, panel-rail, view-content). D3 Spec v2 §4.1.1 DOM hierarchy confirmed. |
| SHEL-02 | CollapsibleSection reusable primitive with expand/collapse animation, keyboard operation (Enter/Space), and aria-expanded | CSS max-height animation pattern with transition. ARIA disclosure pattern (aria-expanded on header button, Enter/Space toggles). localStorage persistence keyed by section ID. |
| SHEL-03 | CommandBar renders app icon trigger, command input (opens existing CommandPalette), and settings menu trigger | Thin component: app icon click dispatches palette.open(), command placeholder bar click does same. Settings trigger toggles a dropdown menu with theme/density/help/about items. |
| SHEL-04 | ViewManager re-rooted from #app to .workbench-view-content sub-element | ViewManager constructor already accepts `container: HTMLElement` — pass shell.getViewContentEl() instead of `#app`. No ViewManager code changes needed (confirmed by reading ViewManager.ts). |
| SHEL-05 | SuperGrid renders identically in new mount point — all existing SuperGrid tests pass without modification | Tests create own container divs (confirmed via grep). Key CSS guard: `.workbench-view-content` needs `min-height: 0` + `overflow: hidden` for SuperGrid sticky headers. |
| SHEL-06 | All new CSS selectors scoped under .workbench-shell — no bare element selectors, no global box-sizing resets | All new CSS in `src/styles/workbench.css` must use `.workbench-shell .class-name` or BEM pattern. No `*`, no `div`, no `body` selectors. |
| INTG-01 | Explorer modules follow mount/update/destroy lifecycle API pattern | All existing modules (HelpOverlay, CommandPalette, AuditOverlay, ViewTabBar) follow this pattern. New modules mirror it exactly. |
| INTG-02 | Provider references injected via constructor from WorkbenchShell (no singleton imports) | CommandBar receives ThemeProvider, DensityProvider, HelpOverlay refs via constructor. CollapsibleSection is stateless (no providers needed). WorkbenchShell itself receives providers from main.ts. |
| INTG-04 | ARIA roles on collapsible headers (aria-expanded), menus (role="menu"/role="menuitem") | CollapsibleSection header button: `aria-expanded="true/false"`, `aria-controls="section-body-id"`. Settings dropdown: `role="menu"` on container, `role="menuitem"` on items. |
| INTG-05 | Existing test suite (typecheck, lint, vitest) remains green throughout all phases | No test changes expected — tests use own container divs. CSS scoping prevents style bleed. TypeScript compilation unaffected (new files, no signature changes). |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9 (strict) | Type-safe DOM manipulation | Already in project |
| CSS Custom Properties | n/a | Design tokens for theming | Already in project via design-tokens.css |
| Vite | 7.3 | CSS import, HMR | Already in project |
| Vitest | 4.0 | Unit tests | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| localStorage | Web API | Collapse state persistence | CollapsibleSection remembers expanded/collapsed |
| CSS transitions | Web API | Smooth collapse/expand animation | max-height transition on section body |
| requestAnimationFrame | Web API | Focus management after DOM mutations | After mount, after toggle |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS max-height animation | JS height animation (element.animate) | CSS is simpler, no JS needed. max-height with a generous upper bound works for variable-height content when sections have predictable max sizes. |
| localStorage for collapse state | ui_state table via bridge | localStorage is appropriate for ephemeral UI state per CONTEXT.md. ui_state table is for Tier 2 provider persistence (overkill for panel collapse). |
| Custom dropdown | Existing CommandPalette | Settings dropdown is simple enough (5 items) to not warrant reusing the full combobox pattern. A lightweight `role="menu"` dropdown is more appropriate. |

**Installation:**
```bash
# No new dependencies needed — all capabilities exist in the current stack
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── ui/
│   ├── WorkbenchShell.ts        # Shell orchestrator (new)
│   ├── CollapsibleSection.ts    # Reusable collapse primitive (new)
│   ├── CommandBar.ts            # Command bar with triggers (new)
│   ├── ViewTabBar.ts            # Existing — mounted into shell
│   ├── ActionToast.ts           # Existing — moved to document.body
│   └── ImportToast.ts           # Existing — moved to document.body
├── styles/
│   └── workbench.css            # All shell CSS, scoped under .workbench-shell (new)
└── main.ts                      # Modified — creates WorkbenchShell, re-wires ViewManager
```

### Pattern 1: WorkbenchShell as Thin DOM Orchestrator
**What:** WorkbenchShell creates the DOM hierarchy, instantiates child components, and exposes `.getViewContentEl()` for ViewManager re-rooting. It does NOT manage business state — that stays in providers.
**When to use:** Always — WorkbenchShell is the shell layer, not a state manager.
**Example:**
```typescript
// Source: D3 Spec v2 §4.1.1
export class WorkbenchShell {
  private _el: HTMLElement;
  private _commandBar: CommandBar;
  private _viewContentEl: HTMLElement;
  private _panelRailEl: HTMLElement;
  private _sections: CollapsibleSection[] = [];

  constructor(root: HTMLElement, config: WorkbenchShellConfig) {
    // Create .workbench-shell flex-column container
    this._el = document.createElement('div');
    this._el.className = 'workbench-shell';
    root.appendChild(this._el);

    // Create zones: CommandBar → ViewTabBar → panel-rail → view-content
    this._commandBar = new CommandBar(config);
    this._commandBar.mount(this._el);

    // ViewTabBar mounts between CommandBar and panel-rail
    // (ViewTabBar constructor inserts before config.container)

    this._panelRailEl = document.createElement('div');
    this._panelRailEl.className = 'workbench-panel-rail';
    this._el.appendChild(this._panelRailEl);

    this._viewContentEl = document.createElement('div');
    this._viewContentEl.className = 'workbench-view-content';
    this._el.appendChild(this._viewContentEl);

    // Create 4 stub sections in panel rail
    this._createSections();
  }

  getViewContentEl(): HTMLElement {
    return this._viewContentEl;
  }

  destroy(): void { /* tear down children */ }
}
```

### Pattern 2: CollapsibleSection with CSS Height Transition
**What:** Reusable component with header button (aria-expanded), animated body, localStorage persistence.
**When to use:** For each explorer panel in the panel rail.
**Example:**
```typescript
export class CollapsibleSection {
  private _headerEl: HTMLElement;
  private _bodyEl: HTMLElement;
  private _collapsed: boolean;
  private _storageKey: string;

  constructor(opts: {
    title: string;
    icon: string;
    storageKey: string;
    defaultCollapsed?: boolean;
    stubContent?: string;
  }) {
    this._storageKey = opts.storageKey;
    // Read persisted state from localStorage
    const stored = localStorage.getItem(`workbench:${opts.storageKey}`);
    this._collapsed = stored !== null
      ? stored === 'true'
      : (opts.defaultCollapsed ?? false);
  }

  mount(container: HTMLElement): void {
    // Header with chevron, title, optional count badge
    // Body with transition: max-height 200ms ease-out
    // aria-expanded on header button
    // Enter/Space keyboard handler
  }

  setCollapsed(v: boolean): void {
    this._collapsed = v;
    localStorage.setItem(`workbench:${this._storageKey}`, String(v));
    // Update aria-expanded, toggle body visibility
  }

  destroy(): void { /* remove DOM, clean up listeners */ }
}
```

### Pattern 3: Overlay Migration to document.body
**What:** Move CommandPalette, HelpOverlay, AuditOverlay, and toasts from `container` to `document.body`.
**When to use:** In main.ts — change the container argument for `mount()` and constructor calls.
**Example:**
```typescript
// Before (main.ts):
commandPalette.mount(container);    // container = #app
helpOverlay.mount(container);
const toast = new ImportToast(container);
const actionToast = new ActionToast(container);

// After (main.ts):
commandPalette.mount(document.body);
helpOverlay.mount(document.body);
const toast = new ImportToast(document.body);
const actionToast = new ActionToast(document.body);
```

### Pattern 4: Collapse-All Focus Mode Toggle
**What:** Cmd+\ (or similar) collapses all sections to maximize SuperGrid. Press again to restore previous state.
**When to use:** Registered once in main.ts via ShortcutRegistry.
**Example:**
```typescript
// Store pre-collapse state for restore
let savedCollapseState: Map<string, boolean> | null = null;

shortcuts.register('Cmd+\\', () => {
  if (savedCollapseState === null) {
    // Save current state, collapse all
    savedCollapseState = shell.getSectionStates();
    shell.collapseAll();
  } else {
    // Restore previous state
    shell.restoreSectionStates(savedCollapseState);
    savedCollapseState = null;
  }
}, { category: 'Navigation', description: 'Toggle focus mode' });
```

### Anti-Patterns to Avoid
- **Global CSS resets in workbench.css:** Never add `* { box-sizing: border-box }` or bare element selectors. All selectors must descend from `.workbench-shell`.
- **Importing providers inside WorkbenchShell/CollapsibleSection:** Constructor injection only (INTG-02). WorkbenchShell receives providers from main.ts, passes them to children.
- **Putting business logic in WorkbenchShell:** It is a DOM orchestrator. Theme cycling logic stays in ThemeProvider. View switching stays in ViewManager. WorkbenchShell just wires UI triggers to existing methods.
- **Animating height with `height: auto`:** CSS cannot transition to `height: auto`. Use `max-height` with a generous value (e.g., `500px`) or the `grid-template-rows: 0fr → 1fr` technique.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Theme switching | Custom toggle logic | `ThemeProvider.setTheme()` | Already handles `[data-theme]` attribute, FOWT prevention, matchMedia |
| Command palette trigger | Custom search UI in CommandBar | `CommandPalette.open()` | Full combobox with ARIA, fuzzy search, card search already built |
| Keyboard shortcuts | Custom keydown handler | `ShortcutRegistry.register()` | Input field guard, platform modifier detection, help overlay integration |
| View switching | Custom tab logic | `ViewManager.switchTo()` + `ViewTabBar` | Lifecycle management, transition animations, announcer already wired |
| Collapse state persistence | IndexedDB / bridge call | `localStorage.getItem/setItem` | Ephemeral UI state, instant sync, no async needed |

**Key insight:** Phase 54 introduces zero new capabilities — it restructures existing DOM and wires existing components into a new layout. Every button click in the shell ultimately calls an existing provider method or opens an existing overlay.

## Common Pitfalls

### Pitfall 1: SuperGrid Sticky Headers Break in Flex Child
**What goes wrong:** SuperGrid's sticky `position: sticky` headers stop working when the scroll container's height isn't explicitly constrained.
**Why it happens:** In a flex layout, a child with `flex: 1` can grow unbounded unless `min-height: 0` is set. Without this, the flex child expands to content height instead of constraining to available space, and `overflow: auto` never activates.
**How to avoid:** Set `.workbench-view-content { flex: 1 1 auto; min-height: 0; overflow: hidden; }`. SuperGrid creates its own inner scroll container (`overflow: auto; height: 100%`).
**Warning signs:** SuperGrid appears but doesn't scroll. Sticky headers scroll with content instead of sticking.

### Pitfall 2: CSS max-height Transition With Unknown Content Height
**What goes wrong:** `max-height: 0 → max-height: auto` doesn't animate because CSS can't transition to `auto`.
**Why it happens:** CSS transitions require numeric start and end values.
**How to avoid:** Two options: (1) Use `max-height: 500px` (generous fixed value) — transition duration scales proportionally but works. (2) Use `grid-template-rows: 0fr → 1fr` on a wrapper div — modern and precise. Option 1 is simpler for this use case since stub content is short.
**Warning signs:** Sections snap open/closed instantly with no animation.

### Pitfall 3: CSS Bleed From .workbench-shell Into Existing Views
**What goes wrong:** New CSS rules unintentionally affect SuperGrid cells, overlays, or other views.
**Why it happens:** Bare selectors like `button {}` or `div {}` in workbench.css.
**How to avoid:** Every selector in workbench.css must start with `.workbench-shell` or `.workbench-` prefix. Verify with DevTools after implementation — inspect SuperGrid cells and confirm zero unexpected styles.
**Warning signs:** SuperGrid text sizes change. Button styles look different. Border colors shift.

### Pitfall 4: ViewTabBar insertBefore Logic Breaks With New DOM
**What goes wrong:** ViewTabBar currently inserts itself before `container.parentElement` (config.container is the #app div). After the DOM restructure, `container` is `.workbench-view-content` whose parent is `.workbench-shell`, so `insertBefore` would put ViewTabBar in the wrong position.
**Why it happens:** ViewTabBar uses `config.container.parentElement?.insertBefore(this._el, config.container)` which relies on the container being a direct child of the app root.
**How to avoid:** WorkbenchShell should explicitly mount ViewTabBar into a dedicated slot between CommandBar and panel-rail, rather than relying on ViewTabBar's `insertBefore` logic. Either modify ViewTabBar to accept a direct mount target, or WorkbenchShell creates a `.workbench-tab-bar-slot` element and appends ViewTabBar's nav element there.
**Warning signs:** ViewTabBar renders inside the view content area or inside the panel rail instead of between CommandBar and panel rail.

### Pitfall 5: Overlay z-index Conflicts After Body Migration
**What goes wrong:** Overlays moved to `document.body` may stack incorrectly relative to each other or relative to the shell.
**Why it happens:** Existing overlays use `z-index: 1001` (CommandPalette) and similar values. When all overlays are siblings on `document.body`, stacking order depends on source order and z-index values.
**How to avoid:** Establish a z-index scale: shell = auto (no z-index), overlays = 1000+, toasts = 1100. Verify that CommandPalette (z-index: 1001) renders above HelpOverlay and AuditOverlay.
**Warning signs:** Toast hidden behind CommandPalette. HelpOverlay obscures CommandPalette when both open.

### Pitfall 6: Panel Rail Consuming All Viewport Height
**What goes wrong:** If all 4 sections are expanded and content grows, the panel rail pushes view-content off screen.
**Why it happens:** Panel rail has `overflow-y: auto` but no max-height constraint.
**How to avoid:** Set `max-height: 40vh` on `.workbench-panel-rail`. Combined with `.workbench-view-content { flex: 1; min-height: 0 }`, SuperGrid always gets remaining space (at least 60% minus CommandBar/ViewTabBar height).
**Warning signs:** SuperGrid area shrinks to near-zero height. Panel rail dominates the viewport.

## Code Examples

Verified patterns from the existing codebase:

### Mount/Destroy Lifecycle (HelpOverlay pattern)
```typescript
// Source: src/shortcuts/HelpOverlay.ts
export class HelpOverlay {
  private _overlayEl: HTMLElement | null = null;

  mount(container: HTMLElement): void {
    const overlay = document.createElement('div');
    overlay.className = 'help-overlay';
    // ... build DOM ...
    container.appendChild(overlay);
    this._overlayEl = overlay;
  }

  destroy(): void {
    if (this._overlayEl) {
      this._overlayEl.remove();
      this._overlayEl = null;
    }
  }
}
```

### Constructor Injection (ViewManager pattern)
```typescript
// Source: src/views/ViewManager.ts
export interface ViewManagerConfig {
  container: HTMLElement;
  coordinator: StateCoordinator;
  queryBuilder: QueryBuilder;
  bridge: WorkerBridgeLike;
  pafv: PAFVProviderLike;
  filter: FilterProviderLike;
  announcer?: Announcer;
}

export class ViewManager {
  constructor(config: ViewManagerConfig) {
    this.container = config.container;
    // ...
  }
}
```

### CSS Scoped Under Component Class
```css
/* Source: src/styles/view-tab-bar.css */
.view-tab-bar {
  display: flex;
  gap: 2px;
  padding: var(--space-xs) var(--space-sm);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
}

.view-tab {
  padding: var(--space-xs) var(--space-sm);
  background: transparent;
  color: var(--text-secondary);
  border: none;
  /* ... */
}
```

### ARIA Disclosure Pattern
```typescript
// Pattern for CollapsibleSection header button
const headerBtn = document.createElement('button');
headerBtn.setAttribute('aria-expanded', String(!this._collapsed));
headerBtn.setAttribute('aria-controls', `section-${this._storageKey}-body`);
headerBtn.addEventListener('click', () => this.toggle());
headerBtn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    this.toggle();
  }
});

const body = document.createElement('div');
body.id = `section-${this._storageKey}-body`;
body.setAttribute('role', 'region');
body.setAttribute('aria-labelledby', headerBtn.id);
```

### ShortcutRegistry Registration
```typescript
// Source: src/main.ts
shortcuts.register('Cmd+K', () => {
  if (commandPalette.isVisible()) {
    commandPalette.close();
  } else {
    if (helpOverlay.isVisible()) helpOverlay.hide();
    commandPalette.open();
  }
}, { category: 'Help', description: 'Command palette' });
```

### Design Token Usage
```css
/* Source: src/styles/design-tokens.css — always use these, never hardcode */
/* Colors: var(--bg-primary), var(--bg-surface), var(--text-primary), var(--accent) */
/* Spacing: var(--space-xs) through var(--space-xl) */
/* Radius: var(--radius-sm), var(--radius-md), var(--radius-lg) */
/* Typography: var(--text-xs) through var(--text-xl) */
/* Transitions: var(--transition-fast), var(--transition-normal) */
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `#app` as direct ViewManager host | `.workbench-view-content` sub-element | Phase 54 (this phase) | ViewManager mount point changes from `getElementById('app')` to `shell.getViewContentEl()` |
| Overlays mount to `#app` container | Overlays mount to `document.body` | Phase 54 (this phase) | Prevents overlay clipping inside `.workbench-shell` flex layout |
| ViewTabBar uses `insertBefore` hack | ViewTabBar mounted explicitly into shell slot | Phase 54 (this phase) | More predictable DOM positioning |

**Deprecated/outdated:**
- None — this phase introduces new patterns, doesn't deprecate old ones.

## Open Questions

1. **Settings dropdown dismiss behavior**
   - What we know: Click outside should close the dropdown. Escape should close it.
   - What's unclear: Should clicking a menu item (e.g., "Toggle theme") close the dropdown immediately, or keep it open for rapid multi-action use?
   - Recommendation: Close on click (VS Code pattern) — settings are quick single actions, not multi-select.

2. **ViewTabBar constructor change**
   - What we know: ViewTabBar currently uses `config.container.parentElement?.insertBefore()` which won't work in the new DOM hierarchy.
   - What's unclear: Should ViewTabBar constructor be modified to accept a direct mount target, or should WorkbenchShell handle ViewTabBar's DOM insertion?
   - Recommendation: Add an optional `mountTarget` to ViewTabBar config. If provided, append to it directly instead of using `insertBefore`. WorkbenchShell creates a slot div and passes it as `mountTarget`.

3. **AuditOverlay container change**
   - What we know: AuditOverlay's `mount(container)` uses `container` for both the toggle button and `.audit-mode` class. Currently `container = #app`.
   - What's unclear: After moving to `document.body`, the `.audit-mode` class needs to be on a visible ancestor. Should it stay on `#app` or move to `.workbench-shell`?
   - Recommendation: AuditOverlay toggle button mounts to `document.body` but toggles `.audit-mode` on the original `#app` element (passed separately). This preserves existing audit CSS without changes.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHEL-01 | WorkbenchShell creates .workbench-shell flex-column under root | unit | `npx vitest run tests/ui/WorkbenchShell.test.ts -x` | Wave 0 |
| SHEL-02 | CollapsibleSection expand/collapse with keyboard + aria | unit | `npx vitest run tests/ui/CollapsibleSection.test.ts -x` | Wave 0 |
| SHEL-03 | CommandBar renders app icon, command input, settings trigger | unit | `npx vitest run tests/ui/CommandBar.test.ts -x` | Wave 0 |
| SHEL-04 | ViewManager re-rooted to .workbench-view-content | unit | `npx vitest run tests/views/ViewManager.test.ts -x` | Existing (may need 1 assertion added) |
| SHEL-05 | SuperGrid tests pass without modification | unit | `npx vitest run tests/views/SuperGrid.test.ts -x` | Existing (must pass unchanged) |
| SHEL-06 | CSS scoped — no bare element selectors | manual | Visual inspection of workbench.css + DevTools | Manual only |
| INTG-01 | mount/update/destroy lifecycle on new modules | unit | `npx vitest run tests/ui/WorkbenchShell.test.ts tests/ui/CollapsibleSection.test.ts tests/ui/CommandBar.test.ts -x` | Wave 0 |
| INTG-02 | Constructor injection, no singleton imports | static | `npx tsc --noEmit` (type errors if imports are wrong) | Existing |
| INTG-04 | ARIA roles on collapsible headers and menus | unit | `npx vitest run tests/ui/CollapsibleSection.test.ts -x` | Wave 0 |
| INTG-05 | Existing test suite green | integration | `npx vitest run` | Existing |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/ui/ tests/views/SuperGrid.test.ts -x`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/ui/WorkbenchShell.test.ts` — covers SHEL-01, SHEL-04, INTG-01
- [ ] `tests/ui/CollapsibleSection.test.ts` — covers SHEL-02, INTG-04
- [ ] `tests/ui/CommandBar.test.ts` — covers SHEL-03, INTG-01

*(All three test files need `@vitest-environment jsdom` directive since they test DOM manipulation)*

## Sources

### Primary (HIGH confidence)
- `src/main.ts` — Current bootstrap and wiring (read directly)
- `src/views/ViewManager.ts` — Container injection pattern, constructor config (read directly)
- `src/views/SuperGrid.ts` — Mount/scroll/sticky header behavior (read directly)
- `src/ui/ViewTabBar.ts` — insertBefore DOM positioning pattern (read directly)
- `src/shortcuts/HelpOverlay.ts` — mount/destroy lifecycle reference (read directly)
- `src/palette/CommandPalette.ts` — Overlay pattern, ARIA combobox (read directly)
- `src/shortcuts/ShortcutRegistry.ts` — Keyboard shortcut registration API (read directly)
- `src/styles/design-tokens.css` — Full token system (read directly)
- `src/styles/views.css` — View layout, empty states, focus-visible (read directly)
- `src/styles/view-tab-bar.css` — Tab bar styling (read directly)
- `src/styles/command-palette.css` — Overlay z-index, positioning (read directly)
- `docs/D3-UI-IMPLEMENTATION-SPEC-v2.md` — Authoritative DOM hierarchy (read directly)
- `tests/views/SuperGrid.test.ts` — Test container setup pattern (read directly)

### Secondary (MEDIUM confidence)
- WAI-ARIA Authoring Practices — Disclosure (show/hide) pattern for collapsible sections
- CSS Tricks — max-height transition technique for unknown height content

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all patterns exist in codebase
- Architecture: HIGH — D3 Spec v2 provides authoritative DOM hierarchy, existing code confirms ViewManager re-rooting is trivial
- Pitfalls: HIGH — sticky header flex layout issue well-understood, CSS scoping requirements clear from existing codebase patterns

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable — no external dependency version concerns)
