# Phase 51: Command Palette - Research

**Researched:** 2026-03-08
**Domain:** UI overlay / fuzzy search / WAI-ARIA combobox
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Top-center positioning (~20% from top), Spotlight/VS Code style
- Narrow width (~480px max), matching the existing overlay scale
- Fade + slide-down animation (~150ms), drops in from slightly above
- Semi-transparent dim backdrop reusing existing `--overlay-bg` token
- Follows mount/destroy lifecycle pattern established by HelpOverlay
- Fuzzy matching for actions/views/settings (e.g., "lv" matches "List View")
- Card search uses existing FTS5 via WorkerBridge.searchCards() with debounce (~200ms)
- Actions appear instantly (client-side fuzzy), cards appear async below in their own "Cards" section
- Empty query (palette just opened): show last 5 recent commands at top, then curated popular actions
- ~8 visible results before scrolling; results scroll within the palette card
- Category display order: Recents > Views > Actions > Cards > Settings
- Recent commands persisted in localStorage (last 5 command IDs), reset-safe, no cross-device sync
- Contextual commands use provider-queried visibility predicates (e.g., FilterProvider gates "Clear Filters")
- Contextual commands only appear when relevant -- hidden, not disabled
- Additional palette-invocable actions (import, filter, data management, audit toggle) at Claude's discretion
- Card search result selected: switch to card's best view (List by default), highlight/scroll to card, palette closes
- Action/setting selected: execute immediately, palette closes
- Always close palette after any execution -- simple mental model, re-open with Cmd+K
- Result row layout: category icon (left) + label (center-left) + keyboard shortcut hint (right-aligned, `<kbd>` style matching HelpOverlay)
- Arrow-key selection wraps around (bottom to top, top to bottom)
- Full WAI-ARIA combobox pattern per combobox-contract.ts (role="combobox", aria-activedescendant, aria-expanded)

### Claude's Discretion
- Specific fuzzy matching algorithm/library choice
- Category icon set and styling
- Debounce timing exact value
- Card "best view" selection logic
- Which additional actions beyond ShortcutRegistry entries to include
- Loading/spinner state for async card search
- Reduced-motion handling for animation

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CMDK-01 | User can open command palette via Cmd+K from any state | ShortcutRegistry.register('Cmd+K', ...) wiring in main.ts; palette mount/destroy lifecycle pattern from HelpOverlay |
| CMDK-02 | Fuzzy search matches across views, actions, shortcuts, and settings | Fuse.js (or built-in scorer) for client-side fuzzy matching; CommandRegistry as unified command source |
| CMDK-03 | Card search results appear via existing FTS5 Worker handler with debounced input | WorkerBridge.searchCards(query, limit) returns SearchResult[]; debounce ~200ms on input events |
| CMDK-04 | Keyboard navigation: arrow keys move selection, Enter executes, Escape closes | WAI-ARIA combobox contract from combobox-contract.ts; ArrowDown/ArrowUp with wrap-around, Enter execute, Escape close |
| CMDK-05 | Results grouped by category (Views, Actions, Cards, Settings) with visual headers | Category headers rendered as non-interactive group labels; category order: Recents > Views > Actions > Cards > Settings |
| CMDK-06 | Each result shows keyboard shortcut hint where applicable | ShortcutRegistry.getAll() provides shortcut strings; `<kbd>` styling from help-overlay.css |
| CMDK-07 | Recent commands section shows last 5 invoked commands at top before search results | localStorage persistence of command IDs; shown on empty query state |
| CMDK-08 | Contextual commands appear only when relevant | Visibility predicates query provider state (e.g., FilterProvider filters/axisFilters/searchQuery) |
</phase_requirements>

## Summary

Phase 51 implements a Cmd+K command palette -- a unified search overlay that surfaces all app actions, views, card search results, and settings in a single keyboard-driven interface. The architecture is straightforward: a **CommandRegistry** provides a flat list of all executable commands with metadata (label, category, shortcut, visibility predicate, handler), a **CommandPalette** UI component renders the overlay with fuzzy-filtered results, and the existing **ShortcutRegistry** triggers open/close via Cmd+K.

The project already has all the building blocks: `combobox-contract.ts` defines the exact ARIA attributes, `HelpOverlay` demonstrates the overlay lifecycle pattern, `ShortcutRegistry.getAll()` provides shortcut metadata, `WorkerBridge.searchCards()` provides FTS5 card search, and the CSS design token system provides all visual tokens. The main engineering work is (1) building the CommandRegistry that aggregates commands from all sources, (2) implementing fuzzy matching for instant client-side filtering, (3) wiring async card search with debounce, and (4) building the DOM with proper ARIA combobox attributes.

**Primary recommendation:** Build a simple CommandRegistry class that holds all commands as a flat array, use a lightweight built-in fuzzy scorer (substring + character-sequence matching) first before reaching for fuse.js, and structure the CommandPalette class after the HelpOverlay mount/destroy pattern with combobox-contract.ts ARIA attributes applied.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9 (strict) | Implementation language | Project standard |
| Vitest | 4.0 | Test framework | Project standard |
| CSS Custom Properties | N/A | All visual styling via design tokens | Project standard -- no hardcoded colors/sizes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fuse.js | 7.1.0 | Fuzzy search library | Only if built-in scorer proves insufficient for edge cases like "lv" matching "List View" |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fuse.js | Built-in fuzzy scorer | Fuse.js is ~5kB gzipped, handles weighted multi-key search and diacritics. A built-in scorer (substring match + consecutive character bonus) is simpler and zero-dependency but less sophisticated. **Recommendation:** Start with built-in scorer; it handles the ~30-item command list well. Upgrade to fuse.js only if matching quality is unsatisfactory. |
| localStorage for recents | StateManager (ui_state table) | localStorage is simpler, reset-safe, and doesn't require WorkerBridge round-trip for a non-critical 5-item list. User decision locks localStorage. |

**Installation (if fuse.js needed):**
```bash
npm install fuse.js
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── palette/                    # New module for command palette
│   ├── CommandRegistry.ts      # Command aggregation + fuzzy search
│   ├── CommandPalette.ts       # UI component (mount/destroy lifecycle)
│   ├── fuzzy.ts                # Fuzzy matching scorer (built-in)
│   └── index.ts                # Public exports
├── styles/
│   └── command-palette.css     # Palette styles (design tokens only)
tests/
├── palette/
│   ├── CommandRegistry.test.ts # Registry + fuzzy matching tests
│   └── CommandPalette.test.ts  # UI component tests (DOM stubs)
```

### Pattern 1: CommandRegistry (Command Aggregation)
**What:** A registry that holds all executable commands as a flat array. Each command has an ID, label, category, optional shortcut string, optional visibility predicate, and an execute handler. Commands are registered during bootstrap from multiple sources.
**When to use:** Always -- this is the single source of truth for what the palette can do.
**Example:**
```typescript
interface PaletteCommand {
  id: string;                              // Unique, e.g. 'view:list', 'action:clear-filters'
  label: string;                           // Display text, e.g. 'List View'
  category: 'Views' | 'Actions' | 'Cards' | 'Settings';
  shortcut?: string;                       // e.g. 'Cmd+1' -- displayed as <kbd>
  icon?: string;                           // Category icon character or class
  visible?: () => boolean;                 // Contextual visibility predicate
  execute: () => void;                     // What happens on selection
}

class CommandRegistry {
  private commands: PaletteCommand[] = [];

  register(cmd: PaletteCommand): void { ... }
  registerAll(cmds: PaletteCommand[]): void { ... }

  /** Returns commands matching query, filtered by visibility predicates. */
  search(query: string): PaletteCommand[] { ... }

  /** Returns all visible commands (for empty-query state). */
  getVisible(): PaletteCommand[] { ... }

  /** Get command by ID (for recents lookup). */
  getById(id: string): PaletteCommand | undefined { ... }
}
```

### Pattern 2: Mount/Destroy Lifecycle (from HelpOverlay)
**What:** CommandPalette follows the exact same lifecycle pattern as HelpOverlay: constructor takes dependencies, `mount(container)` creates DOM and registers listeners, `destroy()` cleans up everything.
**When to use:** Always -- project standard for overlay components.
**Example:**
```typescript
class CommandPalette {
  private overlayEl: HTMLElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private listboxEl: HTMLElement | null = null;

  constructor(
    registry: CommandRegistry,
    shortcuts: ShortcutRegistry,
    bridge: WorkerBridgeLike,  // For card search
  ) { ... }

  mount(container: HTMLElement): void {
    // 1. Create overlay DOM (backdrop + card + input + listbox)
    // 2. Apply COMBOBOX_ATTRS from combobox-contract.ts
    // 3. Register 'Cmd+K' via ShortcutRegistry
    // 4. Attach keydown listener for ArrowDown/ArrowUp/Enter/Escape
    // 5. Attach input listener with debounce for card search
  }

  open(): void { ... }   // Show overlay, focus input, populate results
  close(): void { ... }  // Hide overlay, clear input, return focus
  destroy(): void { ... } // Remove DOM, unregister shortcuts, remove listeners
}
```

### Pattern 3: Dual-Path Search (Sync Commands + Async Cards)
**What:** When user types in the palette, two search paths execute in parallel: (1) synchronous fuzzy match against the CommandRegistry's ~30 static commands for instant results, and (2) debounced async FTS5 search via WorkerBridge.searchCards() for card results that appear in the "Cards" category.
**When to use:** Every keystroke in the palette input.
**Example:**
```typescript
// On input change:
private onInput(query: string): void {
  // 1. Immediate: fuzzy-filter static commands
  const commands = this.registry.search(query);
  this.renderResults(commands, this.pendingCards);

  // 2. Debounced: async card search
  clearTimeout(this.cardSearchTimer);
  if (query.length >= 2) {
    this.cardSearchTimer = setTimeout(async () => {
      const results = await this.bridge.searchCards(query, 5);
      this.pendingCards = results.map(r => ({
        id: `card:${r.card.id}`,
        label: r.card.name,
        category: 'Cards' as const,
        execute: () => this.navigateToCard(r.card),
      }));
      this.renderResults(this.registry.search(query), this.pendingCards);
    }, 200);
  } else {
    this.pendingCards = [];
  }
}
```

### Pattern 4: WAI-ARIA Combobox (from combobox-contract.ts)
**What:** The palette input and listbox follow the WAI-ARIA 1.2 combobox pattern. The contract is already defined in `src/accessibility/combobox-contract.ts` with exact attribute values.
**When to use:** When building the palette DOM structure.
**Key attributes:**
- Input: `role="combobox"`, `aria-expanded`, `aria-controls="palette-listbox"`, `aria-autocomplete="list"`, `aria-activedescendant`
- Listbox: `role="listbox"`, `id="palette-listbox"`
- Each option: `role="option"`, `id="palette-option-{index}"`, `aria-selected`
- Category headers: `role="presentation"` (not selectable, skip in keyboard navigation)

### Pattern 5: Recent Commands (localStorage)
**What:** Last 5 executed command IDs stored in localStorage under a fixed key. On palette open with empty query, recent commands are shown first.
**When to use:** On command execution and palette open.
**Example:**
```typescript
const RECENTS_KEY = 'isometry:palette-recents';
const MAX_RECENTS = 5;

function pushRecent(commandId: string): void {
  const recents = getRecents().filter(id => id !== commandId);
  recents.unshift(commandId);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)));
}

function getRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
```

### Pattern 6: Contextual Command Visibility
**What:** Commands with a `visible` predicate are only shown when the predicate returns `true`. Predicates query live provider state.
**When to use:** For commands like "Clear Filters" that only make sense in certain states.
**Example:**
```typescript
// Registration in main.ts:
registry.register({
  id: 'action:clear-filters',
  label: 'Clear Filters',
  category: 'Actions',
  visible: () => filter.getFilters().length > 0
             || filter._searchQuery !== null  // Needs public accessor
             || filter._axisFilters.size > 0, // Needs public accessor
  execute: () => {
    filter.clearFilters();
    coordinator.scheduleUpdate();
  },
});
```

**Important:** FilterProvider currently lacks a public `hasActiveFilters()` method. The palette will need either:
- A new `hasActiveFilters(): boolean` method on FilterProvider (recommended -- clean API)
- Or access to internal state via the existing `getFilters()` + `compile()` methods (checking if compiled WHERE has more than just `deleted_at IS NULL`)

### Anti-Patterns to Avoid
- **Don't use a separate keydown listener for Cmd+K:** Register through ShortcutRegistry like all other shortcuts. This ensures the input field guard works correctly and prevents conflicts.
- **Don't bypass the input field guard for palette input:** The palette's input field must be excluded from ShortcutRegistry's input guard. When the palette is open and input is focused, only the palette's own keydown handler should fire (for ArrowDown/Up/Enter/Escape). ShortcutRegistry already guards INPUT elements, so Cmd+K won't re-trigger from inside the palette.
- **Don't re-query FTS5 on every keystroke:** Debounce card search. Static command fuzzy match is fine on every keystroke (it's synchronous over ~30 items).
- **Don't use innerHTML for result rendering:** Build DOM elements programmatically (project standard). Sanitize search result snippets from FTS5 if displayed.
- **Don't hardcode colors, font sizes, or spacing:** Use design tokens exclusively. All values come from CSS custom properties.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Combobox ARIA attributes | Custom attribute management | `COMBOBOX_ATTRS` from `combobox-contract.ts` | Contract already validated, Phase 50 established it specifically for Phase 51 |
| Overlay backdrop + positioning | Custom overlay from scratch | Replicate `help-overlay.css` pattern | Token usage, z-index, pointer-events, transition all established |
| `<kbd>` shortcut styling | Custom keyboard hint styles | Reuse `kbd.help-overlay__key` class or extract shared class | Same visual language already shipped |
| View switching | Custom navigation logic | `viewManager.switchTo(viewType, () => viewFactory[viewType]())` | Exact pattern from main.ts line ~279 |
| Theme inheritance | Manual theme application | CSS custom properties cascade from `[data-theme]` | Palette inherits theme automatically |
| Screen reader announcements | Custom aria-live management | `Announcer.announce()` from accessibility module | Already wired to document.body |

**Key insight:** The command palette is almost entirely a composition of existing patterns and infrastructure. The only genuinely new code is the fuzzy scorer and the command registry data structure.

## Common Pitfalls

### Pitfall 1: ShortcutRegistry Input Guard Conflict
**What goes wrong:** When the palette is open and the user types in the input field, Cmd+K fires again (closing and re-opening the palette) or other shortcuts interfere.
**Why it happens:** ShortcutRegistry guards INPUT/TEXTAREA/contentEditable elements and skips them. This is actually the desired behavior -- Cmd+K should NOT fire from the palette input. But the palette needs its own Escape handler.
**How to avoid:** ShortcutRegistry's input guard already handles this correctly. The palette's input element will naturally be excluded. For Escape, attach a separate keydown listener on the palette's input element (not document-level via ShortcutRegistry), similar to HelpOverlay's Escape handler pattern.
**Warning signs:** Cmd+K toggles the palette on/off rapidly, or typing "k" in the search input triggers Cmd+K.

### Pitfall 2: aria-activedescendant Stale References
**What goes wrong:** After results re-render (new fuzzy match set), `aria-activedescendant` points to an element ID that no longer exists in the DOM.
**Why it happens:** Results are rebuilt on every input change. If the previously selected option index is now out of bounds, the reference is stale.
**How to avoid:** Reset `aria-activedescendant` to empty string (or first result ID) on every result re-render. Track selection by index, not by element reference.
**Warning signs:** Screen reader announces nothing or wrong item after typing.

### Pitfall 3: Card Search Race Conditions
**What goes wrong:** User types "ap" (debounce fires search for "ap"), then quickly types "ple" making it "apple". The "ap" search result arrives after "apple" results, overwriting with stale data.
**Why it happens:** Debounced async calls can resolve out of order.
**How to avoid:** Track a search generation counter. Increment on each debounce trigger. When results arrive, discard if the generation doesn't match the current one. Alternatively, cancel the previous search by checking the current input value when results arrive.
**Warning signs:** Results flicker or show results for an earlier query.

### Pitfall 4: Memory Leaks on Repeated Open/Close
**What goes wrong:** Each open/close cycle accumulates event listeners or DOM nodes.
**Why it happens:** Not cleaning up listeners on close, or re-creating DOM on every open instead of toggling visibility.
**How to avoid:** Create the DOM once in `mount()`. Toggle visibility with CSS class (`is-visible`). Only rebuild the results list content on each open/input change. Remove listeners in `destroy()` only.
**Warning signs:** Performance degrades after many open/close cycles.

### Pitfall 5: Focus Management on Open/Close
**What goes wrong:** After closing the palette, focus is lost (goes to document.body) or stays inside the removed overlay.
**Why it happens:** No explicit focus restoration after close.
**How to avoid:** Capture `document.activeElement` when opening the palette. On close, restore focus to that element. Use `requestAnimationFrame` before `focus()` call to ensure DOM has settled (project pattern from ViewManager).
**Warning signs:** After closing palette, keyboard shortcuts stop working because focus is on a non-interactive element.

### Pitfall 6: Reduced Motion Not Respected
**What goes wrong:** Palette slide-down animation plays even when user has prefers-reduced-motion enabled.
**Why it happens:** CSS transition not gated on the reduced-motion media query.
**How to avoid:** Use the existing `--transition-fast` token for animation duration. Add a `@media (prefers-reduced-motion: reduce)` rule that sets the transition duration to `0.01ms` (project convention from Phase 50 -- not 0ms because some browsers ignore it).
**Warning signs:** Palette animates in for users with motion sensitivity.

## Code Examples

### Fuzzy Matching Scorer (Built-in)
```typescript
// Source: Project-internal pattern (no external dependency)

/**
 * Simple fuzzy match: checks if all characters of the query appear
 * in order within the target string. Returns a score (higher = better match)
 * or null if no match.
 *
 * Scoring:
 *   - Consecutive character matches get bonus points
 *   - Matches at word boundaries (after space/hyphen) get bonus
 *   - Shorter targets score higher (exact matches rewarded)
 */
export function fuzzyMatch(query: string, target: string): number | null {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Substring match shortcut (highest quality match)
  if (t.includes(q)) {
    return 1000 - t.length + (t.indexOf(q) === 0 ? 100 : 0);
  }

  // Character-by-character fuzzy match
  let qi = 0;
  let score = 0;
  let consecutive = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      consecutive++;
      score += consecutive * 2; // Consecutive bonus
      // Word boundary bonus
      if (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-') {
        score += 10;
      }
    } else {
      consecutive = 0;
    }
  }

  return qi === q.length ? score : null; // null = no match
}
```

### Debounce Utility
```typescript
// Source: Standard pattern, project-internal

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: unknown[]) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => { if (timer !== null) clearTimeout(timer); };
  return debounced as T & { cancel: () => void };
}
```

### Palette DOM Structure
```html
<!-- Generated by CommandPalette.mount() -->
<div class="command-palette">                     <!-- Backdrop overlay -->
  <div class="command-palette__card">             <!-- Content card -->
    <input
      class="command-palette__input"
      type="text"
      placeholder="Type a command or search..."
      role="combobox"
      aria-expanded="true"
      aria-controls="palette-listbox"
      aria-autocomplete="list"
      aria-activedescendant=""
    />
    <div
      class="command-palette__results"
      role="listbox"
      id="palette-listbox"
    >
      <!-- Category group: Views -->
      <div class="command-palette__category" role="presentation">Views</div>
      <div class="command-palette__option" role="option" id="palette-option-0" aria-selected="true">
        <span class="command-palette__icon"><!-- icon --></span>
        <span class="command-palette__label">List View</span>
        <kbd class="command-palette__kbd">Cmd+1</kbd>
      </div>
      <!-- ... more options ... -->
    </div>
  </div>
</div>
```

### Integration in main.ts
```typescript
// Source: Pattern from main.ts line ~249 (ShortcutRegistry) and ~305 (HelpOverlay)

// After ShortcutRegistry and HelpOverlay creation:
import { CommandRegistry, CommandPalette } from './palette';

// Create command registry and populate from multiple sources
const commandRegistry = new CommandRegistry();

// 1. Register view-switching commands from viewOrder
viewOrder.forEach((viewType, index) => {
  const displayName = viewType.charAt(0).toUpperCase() + viewType.slice(1);
  commandRegistry.register({
    id: `view:${viewType}`,
    label: `${displayName} View`,
    category: 'Views',
    shortcut: `Cmd+${index + 1}`,
    execute: () => void viewManager.switchTo(viewType, () => viewFactory[viewType]()),
  });
});

// 2. Register action commands
commandRegistry.register({
  id: 'action:clear-filters',
  label: 'Clear Filters',
  category: 'Actions',
  visible: () => filter.hasActiveFilters(), // New method on FilterProvider
  execute: () => { filter.clearFilters(); coordinator.scheduleUpdate(); },
});

// 3. Register settings commands
commandRegistry.register({
  id: 'setting:cycle-theme',
  label: 'Cycle Theme (Dark/Light/System)',
  category: 'Settings',
  shortcut: 'Cmd+Shift+T',
  execute: () => { /* theme cycling logic */ },
});

// 4. Mount command palette
const palette = new CommandPalette(commandRegistry, shortcuts, bridge);
palette.mount(container);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom fuzzy implementations | Established libraries (fuse.js, uFuzzy, FlexSearch) | 2020+ | Well-tested edge cases; but for ~30 items, built-in is sufficient |
| Modal dialogs for commands | Cmd+K palettes (VS Code, Figma, Raycast, Linear) | 2019+ | Users expect this UX pattern; Spotlight/VS Code is the mental model |
| Separate menu + shortcut systems | Unified command registries | 2020+ | Single source of truth for all executable actions |
| Custom ARIA on each component | Shared ARIA contracts | WAI-ARIA APG | combobox-contract.ts is this project's version of a shared contract |

**Deprecated/outdated:**
- `role="application"` on overlays: Not needed; `role="combobox"` on input + `role="listbox"` on results is the correct pattern
- `aria-owns` for combobox: Replaced by `aria-controls` in ARIA 1.2

## Open Questions

1. **FilterProvider.hasActiveFilters() method**
   - What we know: FilterProvider has `_filters`, `_searchQuery`, and `_axisFilters` as internal state. No public method to check if any filters are active.
   - What's unclear: Should this be a new method on FilterProvider, or should the palette check `getFilters().length > 0` + `compile()` heuristics?
   - Recommendation: Add `hasActiveFilters(): boolean` to FilterProvider -- clean public API, single check point. Return `this._filters.length > 0 || this._searchQuery !== null || this._axisFilters.size > 0`.

2. **Card "best view" selection logic**
   - What we know: When user selects a card from search results, the palette should switch to the best view for that card and highlight it.
   - What's unclear: What constitutes "best view"? User decision says "List by default."
   - Recommendation: Always switch to List view. List view is the simplest for finding a single card. A future enhancement could consider card metadata (e.g., cards with connections prefer NetworkView).

3. **Card highlight/scroll after navigation**
   - What we know: After switching to a card's view, we need to highlight and scroll to that card.
   - What's unclear: The current ViewManager/ListView don't have a "scroll to card" API.
   - Recommendation: For v1 of the palette, switch to List view. Highlighting and scroll-to-card can be deferred or implemented as a follow-up within this phase. The palette's primary value is action execution; card navigation is secondary.

4. **Palette z-index vs HelpOverlay z-index**
   - What we know: HelpOverlay uses z-index: 1000. Both are fixed-position overlays.
   - What's unclear: Can both be open simultaneously?
   - Recommendation: Use z-index: 1001 for the command palette (above HelpOverlay). Close HelpOverlay when palette opens (call `helpOverlay.hide()` from palette open handler, or just let them stack -- palette on top).

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/shortcuts/ShortcutRegistry.ts`, `src/shortcuts/HelpOverlay.ts`, `src/accessibility/combobox-contract.ts`, `src/main.ts`, `src/providers/FilterProvider.ts`, `src/worker/WorkerBridge.ts`, `src/styles/help-overlay.css`, `src/styles/design-tokens.css`
- WAI-ARIA APG Combobox Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/

### Secondary (MEDIUM confidence)
- fuse.js GitHub: https://github.com/krisk/Fuse -- v7.1.0, Apache-2.0, 20k stars, last release Feb 2025
- fuse.js official site: https://www.fusejs.io/ -- API options, basic usage examples

### Tertiary (LOW confidence)
- Fuse.js bundle size: estimated ~5kB gzipped based on project STATE.md decision note (not independently verified via bundlephobia)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All infrastructure exists in the codebase; no new dependencies required for core implementation
- Architecture: HIGH - Follows established project patterns (HelpOverlay lifecycle, combobox-contract, design tokens, ShortcutRegistry)
- Pitfalls: HIGH - Common combobox/palette pitfalls well-documented in WAI-ARIA APG and observed in codebase patterns

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable domain -- no rapidly evolving dependencies)
