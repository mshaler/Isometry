# Phase 51: Command Palette - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Universal Cmd+K overlay for discovering and executing any action -- view switching, card search, settings toggling, and commands -- with fuzzy matching, category grouping, recents, and contextual items. No new capabilities beyond what's already in the app; this is a unified entry point to existing features.

</domain>

<decisions>
## Implementation Decisions

### Visual design & layout
- Top-center positioning (~20% from top), Spotlight/VS Code style
- Narrow width (~480px max), matching the existing overlay scale
- Fade + slide-down animation (~150ms), drops in from slightly above
- Semi-transparent dim backdrop reusing existing `--overlay-bg` token
- Follows mount/destroy lifecycle pattern established by HelpOverlay

### Search & matching behavior
- Fuzzy matching for actions/views/settings (e.g., "lv" matches "List View")
- Card search uses existing FTS5 via WorkerBridge.searchCards() with debounce (~200ms)
- Actions appear instantly (client-side fuzzy), cards appear async below in their own "Cards" section
- Empty query (palette just opened): show last 5 recent commands at top, then curated popular actions
- ~8 visible results before scrolling; results scroll within the palette card

### Command registry & categories
- Category display order: Recents > Views > Actions > Cards > Settings
- Recent commands persisted in localStorage (last 5 command IDs), reset-safe, no cross-device sync
- Contextual commands use provider-queried visibility predicates (e.g., FilterProvider.hasActiveFilters() gates "Clear Filters")
- Contextual commands only appear when relevant -- hidden, not disabled
- Additional palette-invocable actions (import, filter, data management, audit toggle) at Claude's discretion

### Result interaction & execution
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

</decisions>

<specifics>
## Specific Ideas

- Spotlight/VS Code feel: top-center drop-down, narrow, focused
- Keyboard shortcut hints in results should use same `<kbd>` styling as HelpOverlay (bg-surface, border-subtle, monospace)
- Recents reward repeat usage -- the palette gets more useful over time
- "Clear Filters" is the canonical example of a contextual command

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ShortcutRegistry` (src/shortcuts/ShortcutRegistry.ts): `getAll()` returns all shortcuts with category + description -- ready-made command source for Views, Editing, Settings, Help categories
- `HelpOverlay` (src/shortcuts/HelpOverlay.ts): mount/destroy lifecycle, overlay DOM pattern, Escape handler, `<kbd>` styling -- reference implementation for palette overlay
- `combobox-contract.ts` (src/accessibility/combobox-contract.ts): WAI-ARIA combobox roles/attributes pre-defined for Phase 51 (COMBOBOX_ATTRS.input, .listbox, .option, .keyboard)
- `WorkerBridge.searchCards()`: FTS5 search with BM25 ranking, accepts query + limit, returns SearchResult[] with snippets
- `help-overlay.css`: Design token usage pattern (--overlay-bg, --bg-card, --radius-lg, --overlay-shadow-heavy, --text-primary/secondary, --space-* scale)
- `ActionToast` / `ImportToast`: Toast UI components for post-action feedback

### Established Patterns
- Overlay z-index: 1000 (HelpOverlay), with fixed positioning and `is-visible` class toggle
- CSS design tokens: all colors, spacing, typography via custom properties (never hardcoded)
- ShortcutRegistry single keydown listener with input field guard -- palette input must be excluded from this guard
- ViewManager.switchTo(viewType, factory) for programmatic view switching
- motionProvider for reduced-motion preferences (prefers-reduced-motion query)

### Integration Points
- `main.ts` line ~249: ShortcutRegistry instantiation -- Cmd+K registration goes here
- `main.ts` line ~279: viewOrder array + viewManager.switchTo() -- palette reuses this for view switching
- `FilterProvider` (src/providers): hasActiveFilters() or similar for contextual command visibility
- `StateCoordinator`: coordinates provider state, palette may need to query current view type
- `ThemeProvider`: palette inherits theme automatically via CSS custom properties

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 51-command-palette*
*Context gathered: 2026-03-07*
