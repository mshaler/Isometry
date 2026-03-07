# Domain Pitfalls

**Domain:** Command palette, WCAG 2.1 AA accessibility, light/dark theme, enhanced empty states with sample data -- added to existing D3/SVG + WKWebView data visualization app
**Researched:** 2026-03-07
**Overall confidence:** HIGH (pitfalls derived from direct codebase inspection of production code + verified web research on D3/SVG accessibility, WKWebView behavior, and CSS theming patterns)

---

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Hardcoded Hex Colors in SVG Rendering Break Theme Switching

**What goes wrong:** The app currently uses `var()` CSS custom properties for most SVG fills and strokes (CardRenderer, TreeView, ListView), but two critical paths use hardcoded hex values that will not respond to theme changes:

1. `audit-colors.ts` exports literal hex strings (`#4ade80`, `#fb923c`, `#f87171` + 9 source colors) consumed by `CardRenderer.renderSvgCard()` via `.attr('fill', AUDIT_COLORS[...])`. These SVG attribute fills are set by JavaScript and will remain dark-theme-optimized regardless of active theme.

2. `NetworkView` uses `d3.scaleOrdinal(d3.schemeCategory10)` for node fill colors -- a fixed D3 palette with no CSS token mapping. These colors are set as SVG fill attributes and are not theme-aware.

3. `CardRenderer` sets `font-size` as literal `'13px'`, `'11px'`, `'10px'` via `.attr()`. `ListView` uses `'10px'`. `TimelineView` uses `'12px'`. `NetworkView` uses `'9px'` and a constant-derived value. These are minor consistency issues rather than theme-breaking, but they bypass the typography token system.

**Why it happens:** SVG `fill` and `stroke` attributes historically required literal values. Modern browsers (Safari 16+, Chrome 100+) support `var()` in SVG presentation attributes, but the codebase was built conservatively with hex fallbacks. The `audit-colors.ts` file explicitly documents this dual-mapping as intentional: "They are intentionally duplicated because some SVG rendering paths set fill/stroke via D3 .attr() which historically required literal color values."

**Consequences:** Switching to light theme produces invisible or low-contrast audit stripes, source provenance indicators, and network graph nodes. The comment in audit-colors.ts says colors are "Muted pastel palette optimized for dark background (--bg-card: #1e1e2e)" -- these pastels on a white or light-gray background will have insufficient contrast. NetworkView becomes unreadable because `d3.schemeCategory10` includes colors like light cyan and light green that vanish on white.

**Prevention:**
- Replace `audit-colors.ts` hardcoded hex with `var(--audit-new)` etc. in all `.attr('fill', ...)` calls. Safari 16+ and iOS 16+ support `var()` in SVG attributes -- this covers the app's iOS 17+ / macOS 14+ minimum targets.
- Replace `d3.scaleOrdinal(d3.schemeCategory10)` in NetworkView with the same `CARD_TYPE_COLORS` pattern TreeView already uses: a record mapping card types to `var()` references (`var(--source-markdown)`, `var(--source-csv)`, etc.).
- Define both dark and light variants for every color token: audit indicators, source provenance, card type colors, accent, danger.
- Replace literal font-size attributes in SVG views with `var(--text-xs)` / `var(--text-sm)` / `var(--text-base)` for consistency.

**Detection:** After implementing theme switching, visually verify every SVG-based view (ListView, GridView, TimelineView, NetworkView, TreeView) plus SuperGrid in both themes. Automated: grep all `.attr('fill'` and `.attr('stroke'` calls for non-`var()` literal values.

**Phase:** Theme switching -- must be addressed as prerequisite to shipping light mode.

---

### Pitfall 2: D3-Generated SVG Has Zero Accessibility Semantics

**What goes wrong:** All 5 SVG-based views (ListView, GridView, TimelineView, NetworkView, TreeView) generate `<svg>` elements containing `<g>`, `<rect>`, `<circle>`, and `<text>` elements that have no ARIA roles, no `<title>` or `<desc>` elements, no `tabindex` attributes, and no keyboard navigation. VoiceOver will either skip these entirely or announce them as undifferentiated graphic groups.

Currently the only ARIA attributes in the entire codebase are `aria-live="polite"` on ActionToast and ImportToast. No SVG element has any accessibility annotation whatsoever.

Specific view analysis:
- **ListView**: SVG `<g class="card">` groups with rect, text children. No role, no label, no tabindex.
- **GridView**: Same pattern as ListView but in a grid layout.
- **TimelineView**: Same pattern but with time axis text elements.
- **NetworkView**: `<g class="node">` with circle + text, `<g class="edge">` with line + title. The `<title>` on edges provides a tooltip but is not connected to ARIA labeling.
- **TreeView**: `<g class="tree-node-group">` with circle + text, plus `<path>` link elements. Has collapsible nodes (expand/collapse via click) with no `aria-expanded` attribute.

**Why it happens:** D3's data join pattern (`.selectAll().data().join()`) focuses on visual rendering. Adding accessibility attributes requires explicit `.attr('role', ...)`, `.attr('aria-label', ...)`, `.attr('tabindex', ...)` calls that produce no visible change. Most D3 tutorials and examples omit accessibility entirely.

**Consequences:** Fails WCAG 2.1 AA Success Criteria 1.3.1 (Info and Relationships), 4.1.2 (Name, Role, Value), and 2.1.1 (Keyboard). The app is unusable for VoiceOver users across 5 of 9 views. This is the single largest accessibility gap in the codebase.

**Prevention:**
- Each SVG root needs `role="img"` or `role="group"` with `aria-label` describing the current view and data count (e.g., "List view showing 42 cards").
- Each interactive card `<g>` needs `role="listitem"` (or `role="img"` with descriptive label), `tabindex="0"` (roving -- only current-focus card gets 0), and `aria-label` with card name + type.
- NetworkView: each node needs `role="img"` with `aria-label` including name, type, and connection count. Each edge group needs `aria-label` describing the connection (the existing `<title>` element is not reliably announced by all screen readers).
- TreeView: needs `role="tree"` on container, `role="treeitem"` on nodes, `aria-expanded="true|false"` on collapsible nodes.
- Add `<title>` as first child element in each interactive `<g>` group for both tooltip and screen reader support.
- Use `aria-roledescription` to provide custom role descriptions where standard roles are insufficient (e.g., "data card" instead of "list item").

**Detection:** Run axe-core or Lighthouse accessibility audit against each view. VoiceOver manual testing on macOS with both Safari and WKWebView.

**Phase:** Accessibility -- this is the largest single work item in the entire milestone.

---

### Pitfall 3: SuperGrid CSS Grid Lacks Data Grid ARIA Pattern

**What goes wrong:** SuperGrid renders a complex CSS Grid with nested multi-level headers (via SuperStackHeader), data cells, filter dropdowns, sort indicators, context menus, lasso selection, and virtual scrolling. None of these have ARIA roles. A data grid of this complexity requires the full WAI-ARIA grid pattern: `role="grid"`, `role="row"`, `role="gridcell"`, `role="columnheader"`, `role="rowheader"`. It also needs arrow-key navigation (roving tabindex), `aria-sort` on sortable headers, `aria-selected` on selected cells, `aria-expanded` for collapsible headers, and `aria-colindex`/`aria-rowindex` for virtual scrolling context.

Additionally, SuperGrid sets nearly all styling via inline `style.cssText` in JavaScript (confirmed across 40+ lines in SuperGrid.ts). These inline styles have maximum CSS specificity and cannot be overridden by stylesheet rules, complicating both theming and any CSS-based accessibility adjustments.

**Why it happens:** The WAI-ARIA grid role is one of the most complex composite widget roles in the spec. It requires managing focus across a 2D grid with keyboard arrow keys, which conflicts with scroll behavior. Virtual scrolling (SuperGridVirtualizer with data windowing) adds complexity because screen readers need total row/column counts even when elements are not in DOM. The nested multi-level headers (SuperStackHeader with run-length spanning) require `aria-colspan` and grouped header announcements.

**Consequences:** Without the grid pattern, screen readers cannot navigate SuperGrid at all -- they read it as an undifferentiated sequence of divs or skip it entirely. SuperGrid is the primary data exploration surface, making this the single most impactful accessibility failure.

**Prevention:**
- Implement the full WAI-ARIA grid pattern: container `role="grid"`, rows `role="row"`, cells `role="gridcell"`, headers `role="columnheader"`/`role="rowheader"`.
- Add `aria-rowcount` and `aria-colcount` on the grid container reflecting total (not visible) counts for virtual scrolling. Update on scroll.
- Add `aria-rowindex` and `aria-colindex` on each visible cell reflecting position in full dataset.
- Implement roving tabindex for arrow-key cell navigation: only the focused cell has `tabindex="0"`, all others `tabindex="-1"`.
- Collapsible headers (aggregate/hide modes) need `aria-expanded="true|false"`.
- Sort indicators need `aria-sort="ascending|descending|none"` on column headers.
- Selected cells need `aria-selected="true"`.
- AG Grid's open-source accessibility implementation is a good reference for the data grid pattern.

**Detection:** Screen reader testing with VoiceOver in Safari. Verify arrow-key navigation moves between cells. Verify screen reader announces "Row 5, Column 3" positioning. Test with 10K+ rows to verify virtual scrolling ARIA attributes update correctly.

**Phase:** Accessibility -- may need its own dedicated sub-phase given the complexity.

---

### Pitfall 4: WKWebView Swallows Dynamic Accessibility Updates

**What goes wrong:** VoiceOver in WKWebView does not automatically re-scan the accessibility tree when the DOM changes via JavaScript (D3 data joins, view transitions, command palette open/close). Users may navigate to stale elements, find elements that no longer exist, or miss newly added elements entirely. This is particularly severe for D3 views where the entire SVG subtree is rebuilt on every `render()` call.

Apple Developer Forums confirm: "WKWebView does not seem to update its structure of the accessible elements inside the webView automatically when the DOM changes dynamically." The WebKit bug tracker has an open issue (#203798) about WKWebView not shifting accessibility focus for Catalyst apps, which uses the same WKWebView infrastructure.

**Why it happens:** WKWebView runs web content in a separate process. The accessibility tree is bridged across process boundaries, and updates to this bridge are not synchronous with DOM mutations. Standard Safari has tighter integration with the WebKit accessibility layer because it runs in-process.

**Consequences:** VoiceOver cursor becomes stuck on phantom elements, reads content from the previous view after a view switch, or fails to discover new content (like a command palette that just opened). `aria-live` regions may be delayed or dropped compared to Safari.

**Prevention:**
- After view switches and significant DOM updates, post an accessibility notification from Swift: `UIAccessibility.post(notification: .layoutChanged, argument: nil)`. Trigger via a new bridge message from JS (e.g., `native:action` with kind `accessibility-layout-changed`).
- For view transitions: send the notification after the D3 data join completes in the new view's `render()`.
- For command palette open/close: send the notification after the modal is shown/hidden.
- Use `aria-live="polite"` on a persistent status region that announces data changes (e.g., "42 cards in List view", "Command palette open"). This provides a fallback when layout notifications are delayed.
- Test with VoiceOver ON in the actual WKWebView context (native app), not just in Safari. The behavior differs significantly.

**Detection:** Manual VoiceOver testing in the running app. Switch between views and verify VoiceOver cursor tracks new content. Open/close command palette and verify focus moves correctly.

**Phase:** Accessibility -- requires coordinated JS + Swift work. Must be addressed for each interactive component, not just once globally.

---

### Pitfall 5: Command Palette Cmd+K Conflicts with ShortcutRegistry Architecture

**What goes wrong:** The command palette needs to capture ALL keystrokes while open (for its search input), but the existing ShortcutRegistry has an input field guard that returns early when `target.tagName === 'INPUT'`. This means while the palette's search input is focused, no registered shortcuts fire -- which is correct for most shortcuts. However, the command palette also needs to intercept Escape (close), arrow keys (navigate results), and Enter (execute action) -- events that the search input would normally consume.

Additionally, `Cmd+K` must toggle the palette (open if closed, close if open). The current ShortcutRegistry has no concept of shortcut state or conditional activation -- every registered shortcut fires unconditionally when matched.

Further complication: the help overlay (triggered by `?`) is also a fullscreen modal. If the help overlay is open and the user presses Cmd+K, both modals could be open simultaneously with competing focus traps.

**Why it happens:** ShortcutRegistry was designed for stateless, always-active shortcuts (Cmd+1-9, Cmd+Z, ?). A modal component like a command palette requires stateful shortcut management: some shortcuts active only when palette is open, others disabled while it is open.

**Consequences:** Without careful integration: (1) typing numbers in the search field with Cmd held triggers view switches; (2) Escape key may not close the palette if the ShortcutRegistry does not have Escape registered; (3) pressing `?` while search is focused might trigger the help overlay or type a literal `?` depending on timing; (4) two modals open simultaneously creates focus chaos.

**Prevention:**
- Command palette should register its own keydown listener on the palette element (capturing phase), calling `event.stopPropagation()` to prevent ShortcutRegistry's document-level listener from seeing keystrokes while the palette is open.
- Register `Cmd+K` in ShortcutRegistry as a toggle: handler checks if palette is visible and acts accordingly.
- The palette's internal keyboard handling (Escape, arrow keys, Enter) should be self-contained, not routed through ShortcutRegistry.
- Add a `suspend()` / `resume()` API to ShortcutRegistry so modal components can temporarily disable all global shortcuts. Suspend on palette open, resume on close.
- Implement a modal manager: only one modal at a time. Opening command palette closes help overlay. Opening help overlay closes command palette. Both respond to Escape.

**Detection:** Test: open palette, type text containing numbers with Cmd held, verify no view switches. Test: press `?` in search field, verify character types. Test: Cmd+K toggles. Test: open help overlay, then Cmd+K, verify help closes and palette opens.

**Phase:** Command palette -- design the keyboard interaction model before building the UI.

---

### Pitfall 6: Sample Data Syncs to CloudKit and Pollutes Real User Data

**What goes wrong:** If sample/demo data is inserted into the same `cards` and `connections` tables as real user data, the existing CloudKit sync pipeline (CKSyncEngine + SyncMerger + offline queue) will pick up these records and sync them to the user's iCloud account. Once synced, the data propagates to all devices and cannot be easily distinguished from real data. Deleting sample data locally still leaves CloudKit tombstones and may trigger delete-sync to other devices.

**Why it happens:** The sync pipeline watches for mutation events via MutationManager notifications. Any INSERT into `cards` triggers a `mutated` bridge message to Swift (with changeset containing `source: 'mutation'` and `updatedIds`), which queues a CKSyncEngine pending change. The pipeline has no concept of "local-only" or "sample" data -- every card mutation is a sync candidate.

Additionally, the NativeBridge `SyncMerger` function uses `INSERT OR REPLACE` for incoming records. If a CloudKit record with a sample-data ID arrives on another device, it will be inserted there too, spreading contamination even if the original device is cleaned up.

**Consequences:** User's real iCloud data is contaminated with sample cards across all devices. Deletion cascade: deleting sample data triggers sync, which deletes on other devices, which may be confusing. If sample data uses source identifiers that overlap with real sources, the DedupEngine's `idx_cards_source` unique index on `(source, source_id)` could cause collisions on re-import.

**Prevention:**
- Use a dedicated `source` value for sample data: `source = '__sample__'`. This value will never collide with real ETL sources (`apple_notes`, `markdown`, `csv`, `json`, `excel`, `html`, `native_reminders`, `native_calendar`, `native_notes`).
- Guard the sync pipeline: in the `mutated` bridge message handler on the Swift side (BridgeManager), check if the changeset only contains sample-source cards and skip CKSyncEngine queueing. Alternatively, add a `skipSync` flag to the mutated message protocol.
- Bypass MutationManager entirely for sample data insertion: use direct `db.run()` calls to avoid triggering undo stack, sync notifications, and audit state tracking. Sample data should not be undoable, syncable, or auditable.
- Provide a "Clear Sample Data" action: `DELETE FROM cards WHERE source = '__sample__'` followed by `DELETE FROM connections` for orphaned connections. This is a scoped deletion, not a full database wipe.
- Use UUID-based `source_id` values prefixed with `sample-` (e.g., `sample-001`, `sample-002`) for additional collision safety.

**Detection:** Insert sample data, wait for sync trigger, check that no CKSyncEngine pending changes are queued for sample records. Test "Clear Sample Data" removes all sample content without affecting real data. Verify no CloudKit dashboard entries for sample records.

**Phase:** Sample data / enhanced empty states -- requires sync pipeline awareness from the design stage.

---

## Moderate Pitfalls

### Pitfall 7: prefers-color-scheme in WKWebView Follows System, Not App Toggle

**What goes wrong:** In WKWebView, the CSS `@media (prefers-color-scheme: dark)` media query follows the system-level appearance, not an app-level toggle. If the user sets the app to "Light" but their system is in Dark Mode, `prefers-color-scheme` still reports `dark`. This breaks the 3-way toggle (Light / Dark / System) because CSS media queries cannot be overridden programmatically from JavaScript.

**Why it happens:** WKWebView inherits its appearance from the hosting view's trait collection. The `prefers-color-scheme` media query reflects `UITraitCollection.userInterfaceStyle`, which defaults to the system setting. While Swift can override `overrideUserInterfaceStyle` on the WKWebView's hosting view, this only affects the UIKit chrome -- the web content's `prefers-color-scheme` may still follow the system or behave inconsistently depending on iOS/macOS version.

**Prevention:**
- Do NOT use `@media (prefers-color-scheme: ...)` for theme switching in the CSS. Instead, use a `data-theme="light|dark"` attribute on the `<html>` element, controlled by JavaScript.
- All theme-variable definitions should use attribute selectors: `[data-theme="dark"] { --bg-primary: #1a1a2e; ... }` and `[data-theme="light"] { --bg-primary: #ffffff; ... }`. The existing `:root` token definitions become the `[data-theme="dark"]` block (since the app currently only has dark theme).
- For "System" mode: Swift reads `UITraitCollection.userInterfaceStyle`, sends it to JS via a bridge message (new `native:action` kind: `theme-changed` with value `light` or `dark`). JS sets the appropriate `data-theme` attribute. Swift also observes `traitCollectionDidChange` and pushes updates when the system theme changes.
- Add `<meta name="color-scheme" content="light dark">` to the HTML to opt into UA default styling for scroll bars and form controls.
- Store the user's 3-way preference (light/dark/system) in `StateManager` (Tier 2 persistence) so it survives sessions. On launch, the `LaunchPayload` can include the resolved theme.

**Detection:** Test: set system to Dark, set app toggle to Light, verify all CSS custom properties resolve to light-theme values. Test: set app to System, toggle system appearance, verify theme updates reactively without requiring app restart.

**Phase:** Theme switching.

### Pitfall 8: Focus Trap Required for Command Palette (WCAG 2.4.3)

**What goes wrong:** The command palette is a modal overlay. Without a focus trap, pressing Tab while the palette is open moves focus to elements behind the overlay (toolbar buttons, view elements, audit toggle). This is both a usability bug (user loses context) and a WCAG 2.4.3 (Focus Order) / WCAG 2.1.2 (No Keyboard Trap -- ironic name, but the requirement is that focus stays within modal content) failure.

**Why it happens:** The palette is implemented as a positioned `<div>` within the same DOM tree as the rest of the app. Browser tab order follows DOM order by default, not visual layering. The existing help overlay (`help-overlay.css`) has no focus trap either -- it relies on the user pressing Escape or clicking outside.

**Prevention:**
- Implement a focus trap: on palette open, record the previously focused element, move focus to the search input, and intercept Tab/Shift+Tab to cycle focus within the palette (search input, result items, close button).
- On palette close, restore focus to the previously focused element.
- Add `role="dialog"` and `aria-modal="true"` to the palette container. Alternatively, use `role="combobox"` on the search input with `aria-owns` pointing to a `role="listbox"` containing results (this is the more semantically correct pattern for a command palette).
- Set the `inert` attribute on the rest of the page (`#app` container) while the palette is open. Safari 15.5+ supports `inert`, which is within the iOS 17+ target.
- On Escape, close the palette and restore focus.
- Apply the same focus trap pattern to the help overlay retroactively.

**Detection:** Open palette, Tab through all elements, verify focus never escapes the palette. Close palette, verify focus returns to the element that was focused before opening.

**Phase:** Command palette -- implement before any visual or feature work.

### Pitfall 9: Color Contrast Ratios Must Be Independently Verified Per Theme

**What goes wrong:** Colors that pass WCAG AA contrast ratios on a dark background may fail on a light background, and vice versa. The existing dark-theme palette was designed with dark backgrounds in mind:

- `--text-primary: #e0e0e0` on `--bg-primary: #1a1a2e` = 11.3:1 ratio (passes AA) -- but `#e0e0e0` on `#ffffff` = 1.3:1 (fails)
- `--accent: #4a9eff` on `--bg-primary: #1a1a2e` = 5.7:1 (passes) -- but `#4a9eff` on `#ffffff` = 3.0:1 (fails AA 4.5:1 threshold for normal text)
- `--text-muted: #606070` on `--bg-primary: #1a1a2e` = 3.3:1 (passes 3:1 for non-text) -- but `#606070` on `#ffffff` = 5.2:1 (passes, actually better)
- All 9 source provenance colors and 3 audit colors are optimized for dark -- none have been verified against light backgrounds

**Why it happens:** Theme switching is often implemented by flipping background colors without re-verifying every foreground/background pair. The assumption "if it works in dark, just invert the backgrounds" is wrong because color contrast is non-linear.

**Consequences:** Fails WCAG 2.1 AA Success Criterion 1.4.3 (Contrast Minimum) in one or both themes. Particularly dangerous for the accent color used on interactive elements (buttons, links, active states).

**Prevention:**
- Define a complete parallel token set for light mode. Every color token needs a light-mode variant -- not just background swaps.
- Use a contrast checker (WebAIM) to verify every foreground/background pair in both themes: text-primary on bg-primary, text-secondary on bg-card, accent on bg-surface, muted text on bg-primary, etc.
- Audit overlay colors and source provenance colors need darker/more saturated variants for light mode. The current pastels will wash out.
- Non-text UI components (borders, icons, focus rings) need 3:1 contrast minimum per WCAG 1.4.11 (Non-text Contrast).
- Consider using `oklch()` or `hsl()` for token definitions to make systematic lightness adjustments between themes easier than per-token hex picking.

**Detection:** Automated contrast ratio testing for all token pairs in both themes. Manual review of all 9 views + SuperGrid in light mode.

**Phase:** Theme switching -- contrast verification must be part of acceptance criteria for every view.

### Pitfall 10: D3 `.style()` vs `.attr()` Specificity Trap in Theme Switching

**What goes wrong:** D3 provides both `.attr()` and `.style()` for setting visual properties. `.attr('fill', ...)` sets SVG presentation attributes, which can be overridden by CSS stylesheets. `.style('fill', ...)` creates inline CSS (`style="fill: #xxx"`), which has the highest specificity and cannot be overridden by CSS custom property redefinition in stylesheets.

If any view uses `.style('fill', ...)` for color properties, those elements will not respond to theme changes.

**Why it happens:** Both `.attr()` and `.style()` produce identical visual results during initial rendering. Developers may use them interchangeably without realizing the specificity implications.

**Consequences:** Some elements will silently ignore theme changes. The issue is invisible during development and only surfaces during theme-switching testing.

**Prevention:**
- Audit confirms the current codebase uses `.attr('fill', ...)` consistently for color properties -- `.style()` is only used for `opacity` and `transform`, which is correct.
- Establish this as a code review rule: "No `.style()` for `fill`, `stroke`, or `color` properties in D3 code. Use `.attr()` to allow CSS override."
- SuperGrid sets many styles via `style.cssText` for HTML elements (not SVG), which is the correct pattern for CSS Grid layout. These inline styles use `var()` references (e.g., `var(--text-sm)`, `var(--border-muted)`) which will update correctly when token values change. This is fine.
- The risk is if new code during the v4.4 milestone introduces `.style('fill', '#hex')` in SVG views. Enforce during review.

**Detection:** `grep '\.style.*fill\|\.style.*stroke\|\.style.*color' src/views/` should match only opacity/transform uses, not color values.

**Phase:** Theme switching -- verify as precondition, enforce as ongoing rule.

### Pitfall 11: Virtual Scrolling Breaks Screen Reader Row Announcements

**What goes wrong:** SuperGridVirtualizer uses data windowing to filter rows before D3 data join. Off-screen rows are not in the DOM. Screen readers that use `aria-rowcount` and `aria-rowindex` to announce position ("Row 5 of 500") will work only if these attributes are set and updated on every scroll. If the attributes are absent or stale, the screen reader announces wrong positions or loses track of the user's location.

The CSS `content-visibility: auto` progressive enhancement in `supergrid.css` is actually an advantage here: elements with `content-visibility: auto` exist in the accessibility tree even when paint is skipped. But the data windowing approach (which removes rows from the data join entirely) removes them from the DOM and accessibility tree.

**Why it happens:** The Virtualizer was designed for visual performance (60fps at 10K+), not accessibility. The data windowing approach is correct for D3 data join ownership but creates a gap in the accessibility tree for non-visible rows.

**Prevention:**
- Set `aria-rowcount` on the grid container to reflect the total (unfiltered) row count. Update when filters change.
- Set `aria-rowindex` on each visible row to reflect its actual position in the full dataset (not its DOM index). Update on scroll.
- Add `aria-colcount` and `aria-colindex` similarly for columns.
- Consider an `aria-live="polite"` status region that announces scroll position changes (e.g., "Showing rows 50-80 of 500") with debouncing to avoid excessive announcements during fast scrolling.
- The `content-visibility: auto` path (used for browsers that support it) naturally preserves accessibility tree entries -- document this as the preferred rendering path for accessibility.

**Detection:** Screen reader testing: scroll through a 1K+ row dataset in SuperGrid, verify position announcements ("Row 50 of 1000, Column 3 of 8") remain accurate.

**Phase:** Accessibility -- coordinate with existing Virtualizer implementation.

---

## Minor Pitfalls

### Pitfall 12: Help Overlay and Command Palette Are Competing Modals

**What goes wrong:** Both the help overlay (triggered by `?`) and the command palette (triggered by `Cmd+K`) are fullscreen modal overlays positioned with `z-index: 1000`. If both can be open simultaneously, they will stack and create visual chaos. If one opens while the other is open, focus management breaks -- which modal owns focus?

**Prevention:** Implement a modal manager: only one modal at a time. Opening the command palette should close the help overlay. Opening the help overlay should close the command palette. Both respond to Escape. The audit legend panel (`z-index: 1001`) is not a true modal and can remain open alongside either.

**Phase:** Command palette.

### Pitfall 13: Sample Data Source IDs May Collide with Real Imports

**What goes wrong:** The schema has a unique index `idx_cards_source ON cards(source, source_id) WHERE source IS NOT NULL AND source_id IS NOT NULL`. If sample data uses `source_id` values that could match real imported data (e.g., sequential integers, common filenames, or UUIDs that happen to collide), re-importing real data after loading sample data triggers the DedupEngine's update path instead of insert.

**Prevention:** Use the distinctive `source` value `__sample__` (which will never match any real ETL source type). Use `source_id` values prefixed with `sample-` (e.g., `sample-note-001`, `sample-task-002`) for additional safety. The unique index is scoped to `(source, source_id)` pairs, so even if `source_id` values happen to match across sources, different `source` values prevent collision.

**Phase:** Sample data / enhanced empty states.

### Pitfall 14: Empty State Transitions When Sample Data is Loaded/Cleared

**What goes wrong:** The current empty state system shows a welcome panel when card count is 0 and a filtered-empty state when filters return 0 results. Adding "Load Sample Data" as a CTA in the welcome panel means the panel must disappear immediately after sample data loads. If the loading is async and the empty state checks card count synchronously, the user sees a flash of the empty state after clicking the button.

Similarly, "Clear Sample Data" should transition smoothly back to the empty state without a full-page flash.

**Prevention:**
- Use an optimistic UI pattern: hide the empty state panel immediately on button click (before data insertion completes).
- The existing StateCoordinator notification system (rAF-batched) handles the re-render, but ensure the empty state check runs AFTER the re-render, not as a stale closure.
- "Load Sample Data" should disable itself after one click to prevent double-loading.
- "Clear Sample Data" CTA should appear in a discoverable location (command palette, settings) -- not only in the empty state (which is invisible when data exists).

**Phase:** Enhanced empty states.

### Pitfall 15: Keyboard Navigation in SVG Views Conflicts with Browser Scroll

**What goes wrong:** Adding `tabindex="0"` to SVG `<g>` elements for keyboard navigation means Tab cycles through all cards. In a list of 500 cards, Tab navigation becomes useless (500 presses to reach the end). Arrow keys (the correct pattern for list/grid navigation) conflict with browser scroll behavior on the SVG container.

**Prevention:**
- Use roving tabindex: only the focused card has `tabindex="0"`. Others have `tabindex="-1"`. Arrow keys move focus to adjacent cards (Up/Down for lists, Up/Down/Left/Right for grids).
- Prevent default on arrow keys within the SVG container to stop scroll interference.
- For NetworkView (spatial layout), arrow-key navigation should move to the nearest neighbor in the pressed direction, not DOM order. This requires maintaining a spatial index of node positions.
- For TreeView, use standard tree keyboard patterns: Left collapses, Right expands, Up/Down move between visible nodes.

**Phase:** Accessibility.

### Pitfall 16: Font Size Tokens Use Fixed px, Not Relative Units

**What goes wrong:** The design token typography scale uses fixed pixel values (`--text-xs: 10px` through `--text-xl: 18px`). WCAG 2.1 AA SC 1.4.4 (Resize Text) requires text can be resized up to 200% without loss of content or functionality. Fixed `px` values do not respond to user font size preferences on iOS (Dynamic Type) or browser zoom level.

**Why it happens:** The app runs in WKWebView where Dynamic Type does not automatically apply to web content. The `px` values were chosen for precise layout control in the data visualization context.

**Prevention:**
- The existing SuperZoom zoom controls partially address this for SuperGrid (0.5x-2.0x zoom). For other views, ensure that WKWebView zoom (pinch-to-zoom on iOS, Cmd+/Cmd- on macOS) works without layout breakage.
- Do NOT convert to `rem` units -- WKWebView's root font-size may vary unpredictably. Instead, document zoom-based text scaling as the WCAG 1.4.4 compliance mechanism.
- Consider forwarding iOS Dynamic Type scaling factor from Swift to JS via bridge, then multiplying all `--text-*` token values by that factor. This is an enhancement, not a strict AA requirement.
- Test that all views remain usable at 200% zoom in WKWebView.

**Phase:** Accessibility -- document and test, not necessarily rebuild the token system.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Command Palette | Keyboard conflict with ShortcutRegistry (#5) | Design keyboard model first; add suspend/resume to registry |
| Command Palette | Focus trap missing (#8) | Implement focus trap before any visual work |
| Command Palette | Competing modals with help overlay (#12) | Add modal manager, only one overlay at a time |
| Command Palette | ARIA pattern for combobox (#8) | Use role="combobox" + role="listbox" for results |
| WCAG Accessibility | SVG views have zero ARIA (#2) | Budget significant time; 5 SVG views each need full annotation |
| WCAG Accessibility | SuperGrid ARIA grid pattern (#3) | Most complex single task; consider dedicated sub-phase |
| WCAG Accessibility | WKWebView dynamic content staleness (#4) | Requires Swift bridge notification on every DOM update |
| WCAG Accessibility | Virtual scrolling screen reader (#11) | aria-rowcount/aria-rowindex on every scroll event |
| WCAG Accessibility | Arrow key navigation vs scroll (#15) | Roving tabindex pattern per view |
| WCAG Accessibility | Fixed px font sizes (#16) | Document zoom as compliance mechanism; test at 200% |
| Theme Switching | Hardcoded hex in SVG renders (#1) | Prerequisite: migrate ALL hex to var() before light mode |
| Theme Switching | prefers-color-scheme in WKWebView (#7) | Use data-theme attribute, not media query |
| Theme Switching | Contrast ratios per theme (#9) | Independent verification for EVERY token pair in both themes |
| Theme Switching | D3 .style() vs .attr() specificity (#10) | Audit before shipping; enforce as code review rule |
| Sample Data | CloudKit sync contamination (#6) | Guard sync pipeline with source='__sample__' filter |
| Sample Data | Source ID collision (#13) | Use dedicated __sample__ source + prefixed IDs |
| Enhanced Empty States | Transition flash on load/clear (#14) | Optimistic UI hide on click; debounce re-render |
| Enhanced Empty States | Clear Sample Data discoverability (#14) | Surface in command palette and/or settings, not just empty state |

---

## Sources

### Codebase Inspection (HIGH confidence)

- `src/audit/audit-colors.ts` -- hardcoded hex values with documented CSS token mapping (lines 4-14, 27-45)
- `src/views/CardRenderer.ts` -- SVG card rendering with `.attr('fill', AUDIT_COLORS[...])` hardcoded colors (lines 148-149, 166-167)
- `src/views/NetworkView.ts` -- `d3.scaleOrdinal(d3.schemeCategory10)` non-theme-aware palette (line 284)
- `src/views/TreeView.ts` -- `CARD_TYPE_COLORS` using `var()` references (lines 42-48) -- correct pattern to follow
- `src/views/ListView.ts` -- SVG view with zero ARIA attributes, literal font-size (line 172)
- `src/views/SuperGrid.ts` -- 40+ inline `style.cssText` assignments, no ARIA roles on grid elements
- `src/shortcuts/ShortcutRegistry.ts` -- input field guard pattern (lines 58-63), no suspend/resume API
- `src/styles/design-tokens.css` -- dark-only token definitions on `:root` (all 106 lines)
- `src/styles/help-overlay.css` -- `z-index: 1000`, no focus trap
- `src/styles/audit.css` -- `.audit-mode` CSS scoping pattern
- `src/native/NativeBridge.ts` -- SyncMerger and mutated bridge message (lines 204-230)
- `src/database/schema.sql` -- `idx_cards_source` unique index on `(source, source_id)` (lines 64-66)
- `src/ui/ActionToast.ts` -- only existing ARIA usage: `aria-live="polite"` (line 25)

### Web Research (MEDIUM confidence)

- [SVG Accessibility/ARIA roles for charts - W3C Wiki](https://www.w3.org/wiki/SVG_Accessibility/ARIA_roles_for_charts)
- [Accessible D3 data visualization intro - Sarah Fossheim](https://fossheim.io/writing/posts/accessible-dataviz-d3-intro/)
- [VoiceOver and WKWebView - Apple Developer Forums](https://developer.apple.com/forums/thread/655069)
- [WKWebView accessibility focus bug - WebKit #203798](https://bugs.webkit.org/show_bug.cgi?id=203798)
- [ARIA Grids & Data Tables - Accesify](https://www.accesify.io/blog/aria-grids-data-tables-accessibility/)
- [AG Grid Accessibility Implementation](https://www.ag-grid.com/javascript-data-grid/accessibility/)
- [Command Palette shortcut conflicts - WordPress Gutenberg #51737](https://github.com/WordPress/gutenberg/issues/51737)
- [Cmd+K conflicts with browser shortcuts - GitHub Discussion](https://github.com/orgs/community/discussions/24057)
- [Command Palettes for the Web - Rob Dodson](https://robdodson.me/posts/command-palettes/)
- [Supporting Dark Mode in WKWebView - Use Your Loaf](https://useyourloaf.com/blog/supporting-dark-mode-in-wkwebview/)
- [Dark Mode Support in WebKit](https://webkit.org/blog/8840/dark-mode-support-in-webkit/)
- [CSS Variables Guide: Design Tokens & Theming 2025](https://www.frontendtools.tech/blog/css-variables-guide-design-tokens-theming-2025)
- [Setting and Persisting Color Scheme Preferences - Smashing Magazine](https://www.smashingmagazine.com/2024/03/setting-persisting-color-scheme-preferences-css-javascript/)
- [Implementing Accessible SVG Elements - A11Y Collective](https://www.a11y-collective.com/blog/svg-accessibility/)
- [Creating Accessible SVGs - Deque](https://www.deque.com/blog/creating-accessible-svgs/)
- [Keyboard Trap accessibility guide - A11Y Collective](https://www.a11y-collective.com/blog/keyboard-trap/)
- [Focus Management for modals/tabs/menus - 2025 guide](https://blog.greeden.me/en/2025/11/10/complete-guide-to-accessibility-for-keyboard-interaction-focus-management-order-visibility-roving-tabindex-shortcuts-and-patterns-for-modals-tabs-menus/)
- [CloudKit Designing Best Practices - Apple Developer](https://developer.apple.com/icloud/cloudkit/designing/)
- [WCAG Color Contrast Guide 2025 - AllAccessible](https://www.allaccessible.org/blog/color-contrast-accessibility-wcag-guide-2025)
- [D3.js .attr vs .style specificity](https://medium.com/@eesur/d3-attr-css-style-36f01966db88)
