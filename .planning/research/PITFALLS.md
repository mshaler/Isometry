# Domain Pitfalls

**Domain:** Designer Workbench UI shell + explorer panels added to existing D3/TypeScript/SuperGrid data visualization app
**Researched:** 2026-03-08
**Overall confidence:** HIGH (pitfalls derived from direct codebase inspection of production code + verified web research on CSS Grid scoping, HTML5 DnD conflicts, D3 DOM re-parenting, and Markdown sanitization)

---

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: CSS Bleed from Workbench Styles into SuperGrid's CSS Grid Layout

**What goes wrong:** New CSS files (`workbench-shell.css`, `explorers.css`) introduce selectors that unintentionally match elements inside SuperGrid's CSS Grid container. SuperGrid uses `display: grid` with dynamically computed `grid-template-columns` and `grid-template-rows`, plus `position: sticky` on header cells, and `content-visibility: auto` on data cells. Any of the following CSS mistakes breaks SuperGrid:

1. **Bare `* { box-sizing: border-box }`** -- SuperGrid sets explicit widths on column headers and data cells via `style.cssText`. The spec warns: "SuperGrid relies on the current box model." Adding `border-box` changes how padding and border are computed, causing column widths to mismatch between SuperGridSizer's resize handles and actual cell widths. The column resize feature (`SuperGridSizer`) stores widths in `PAFVProvider.colWidths` and generates `grid-template-columns` strings -- if the box model changes, stored widths become incorrect and column resize drifts.

2. **Bare element selectors (`div`, `button`, `input`, `select`, `span`)** -- SuperGrid's filter dropdown (`.sg-filter-dropdown`) is built with raw `<input>`, `<button>`, `<label>`, and `<select>` elements styled entirely via inline `style.cssText`. Any global `input { ... }` or `button { ... }` rule in explorer CSS would override these inline styles only if using `!important`, but more subtly, rules like `button { margin: ... }` or `input { padding: ... }` could add unexpected spacing.

3. **`overflow` rules on ancestor elements** -- SuperGrid's sticky headers require `overflow: auto` on the root `.supergrid-view` element (set at line 514 in SuperGrid.ts). The spec mandates `.workbench-view-content` must have `overflow: hidden` with a defined height. If any explorer CSS rule sets `overflow: visible` or `overflow: scroll` on an ancestor, sticky positioning breaks entirely. The Polypane research confirms: "Sticky positioning doesn't work if any parent element has overflow: hidden" -- but the *right* parent must have `overflow: hidden` (the `.workbench-view-content` wrapper) while the SuperGrid root itself must have `overflow: auto`. Getting this layering wrong is the most common sticky-header failure.

4. **`flex` shorthand on `.workbench-view-content`** -- The spec says this element needs `flex: 1 1 auto`. If written as `flex: 1` (shorthand for `flex: 1 1 0`), the flex-basis is `0` instead of `auto`, which prevents the container from having a defined height. Without a defined height, SuperGrid's sticky headers have no scroll container to stick within, and they scroll away with the content.

**Why it happens:** CSS has no native module scoping. Class-based scoping requires discipline. The spec mandates all new selectors be scoped under `.workbench-shell`, but enforcement depends on code review -- nothing prevents an unscoped rule from landing.

**Consequences:** SuperGrid columns misalign, sticky headers float away, data cells overlap, column resize produces wrong widths, virtual scrolling spacer is miscalculated. These are subtle visual bugs that may not appear in unit tests (jsdom does not compute layout) and only manifest at runtime.

**Prevention:**
- All selectors in `workbench-shell.css` and `explorers.css` MUST be scoped under `.workbench-shell` or a more specific child class. Enforce with a Biome lint rule or manual grep: `grep -P '^\s*[a-z]+\s*\{' src/styles/workbench-shell.css src/styles/explorers.css` should return zero matches.
- If `box-sizing: border-box` is needed for explorer layout, scope it: `.workbench-panel-rail * { box-sizing: border-box }`. Never apply to `.workbench-view-content` or its children.
- CSS import order matters: `supergrid.css` before `workbench-shell.css` before `explorers.css`. Later rules win at equal specificity, so explorer CSS should never have higher specificity than SuperGrid's inline styles.
- Add a regression test: after Phase 1, render SuperGrid in the new mount point and verify column widths, sticky header positions, and virtual scrolling behavior match the pre-Phase-1 baseline.

**Detection:** Visual regression: render SuperGrid with 3+ column axes and 2+ row axes, verify sticky headers remain fixed during scroll, column resize produces correct widths, and hide-empty density mode does not collapse layout. Automated: grep for bare element selectors in new CSS files.

**Phase:** Phase 1 (Shell Scaffolding) -- must be verified as part of the Phase 1 gate: "Verify SuperGrid renders identically in new mount point."

---

### Pitfall 2: DOM Re-Rooting Breaks ViewManager Container Assumptions

**What goes wrong:** `ViewManager` currently receives `#app` as its container (line 49 of main.ts: `const container = document.getElementById('app')`). After WorkbenchShell, it will receive `.workbench-view-content` instead. This is not just a container swap -- multiple parts of the system use the same container reference for different purposes:

1. **ViewManager.container is used for non-view UI overlays** -- `AuditOverlay.mount(container)` (line 142), `HelpOverlay.mount(container)` (line 339), `CommandPalette.mount(container)` (line 411), `ImportToast(container)` (line 429), `ActionToast(container)` (line 439) all mount to the same `container` reference. After re-rooting, these overlays would mount inside `.workbench-view-content` instead of at the top level, causing them to be clipped by `overflow: hidden`, positioned incorrectly within the flex layout, or destroyed when ViewManager calls `this.container.innerHTML = ''` during view switches (line 267).

2. **ViewManager.destroy() clears innerHTML** -- When ViewManager calls `this.container.innerHTML = ''`, it destroys everything inside the container. If overlays are mounted inside this container, they get wiped on every view switch. The crossfade transition path explicitly calls `container.innerHTML = ''` for clean-slate mounts.

3. **ViewTabBar mounts to the same container** -- `new ViewTabBar({ container, ... })` (line 183) appends the tab bar inside the same container. After the re-root, the tab bar would either need to mount elsewhere or be removed entirely (the spec does not include a tab bar in the Workbench layout).

4. **Container tabindex and role attributes** -- ViewManager sets `role="main"` and `tabindex="-1"` on the container (lines 52-54, 160-162). After the re-root, these ARIA attributes should be on the Workbench shell's view content area, not on `#app`. Double `role="main"` is an ARIA violation.

**Why it happens:** The original design used a flat DOM hierarchy where `#app` served as both the view host and the overlay mount point. The WorkbenchShell introduces a nested hierarchy where these concerns must be separated.

**Consequences:** Overlays invisible (clipped by overflow:hidden), overlays destroyed on view switch, duplicate ARIA landmarks, tab bar orphaned in wrong container, focus management breaks because container references point to wrong element.

**Prevention:**
- Split overlay mounting from view hosting. `WorkbenchShell.mount()` should expose two elements: `getViewContentEl()` (for ViewManager) and `getOverlayEl()` (for toasts, overlays, modals). The overlay element should be a sibling of `.workbench-shell` or positioned at the `#app` level.
- Update `main.ts` wiring:
  ```typescript
  const shell = new WorkbenchShell(document.getElementById('app')!);
  shell.mount();
  const viewHost = shell.getViewContentEl();     // for ViewManager
  const overlayHost = shell.getOverlayEl();       // for overlays, toasts, modals
  viewManager = new ViewManager({ container: viewHost, ... });
  auditOverlay.mount(overlayHost);
  helpOverlay.mount(overlayHost);
  commandPalette.mount(overlayHost);
  new ImportToast(overlayHost);
  new ActionToast(overlayHost);
  ```
- Move `role="main"` to `.workbench-view-content` (or keep on `#app` with shell as `role="application"`). Remove the duplicate.
- Remove or repurpose ViewTabBar -- the spec replaces it with explorer panel navigation.

**Detection:** After Phase 1, verify: open command palette (Cmd+K), verify it appears above the entire shell (not clipped). Trigger an import, verify ImportToast is visible. Switch views, verify overlays survive the switch. Check axe-core for duplicate landmark roles.

**Phase:** Phase 1 (Shell Scaffolding) -- the overlay separation must be designed before wiring `main.ts`.

---

### Pitfall 3: HTML5 DnD Event Collision Between SuperGrid and ProjectionExplorer

**What goes wrong:** The system will have two independent HTML5 DnD implementations active simultaneously:

1. **SuperGrid axis DnD** -- Uses a module-level `_dragPayload: AxisDragPayload | null` singleton (line 106 of SuperGrid.ts). dragstart sets it, drop reads and clears it. dataTransfer uses `text/x-supergrid-axis` as the MIME type. Drop zones are `.axis-drop-zone--col` and `.axis-drop-zone--row` on the SuperGrid root.

2. **ProjectionExplorer DnD** -- Will use a similar pattern per the spec: drag property chips between wells. The spec prescribes `data-drag-payload` dataset attributes and `data-drop-zone` dataset attributes.

The collision occurs because HTML5 DnD events bubble. When a user drags a ProjectionExplorer chip, the drag events bubble up through the DOM. If the cursor passes over the SuperGrid area (which sits as a sibling in the same shell), SuperGrid's drop zone `dragover` handler fires, checks `e.dataTransfer?.types.includes('text/x-supergrid-axis')`, and may add visual feedback (`.drag-over` class) even though the drag originated from ProjectionExplorer.

Worse: SuperGrid's `dragover` handler calls `e.preventDefault()` (line 3894-3895) when it detects a valid drag type. If ProjectionExplorer uses a different MIME type but the event still bubbles to SuperGrid's drop zones, the `e.preventDefault()` call may or may not interfere depending on which handler fires first.

The module-level `_dragPayload` singleton is another concern. If ProjectionExplorer adopts a similar singleton pattern, there would be two independent global variables. If either implementation fails to clear its singleton on dragend (e.g., due to an exception), stale payload data persists and contaminates the next drag operation.

**Why it happens:** HTML5 DnD has no built-in scoping mechanism. Events bubble through the entire DOM tree. The module singleton pattern (necessary because `dataTransfer.getData()` is blocked during dragover) creates implicit global state. Two independent implementations in the same page share this global event space.

**Consequences:** Visual pollution (SuperGrid shows drop zones during Projection drags), stale drag payloads causing wrong axis assignments, `preventDefault()` interference blocking valid drops, and hard-to-reproduce bugs that depend on cursor position during drag.

**Prevention:**
- **Use distinct MIME types**: SuperGrid already uses `text/x-supergrid-axis`. ProjectionExplorer should use `text/x-projection-chip`. Each handler checks its specific MIME type and returns early (no `preventDefault()`) if the type does not match.
- **Guard `_dragPayload` scope**: ProjectionExplorer MUST NOT reuse SuperGrid's module-level `_dragPayload`. It should have its own module-level singleton with a different name and type (`_projectionDragPayload: ProjectionDragPayload | null`).
- **Stop propagation at the source**: ProjectionExplorer's dragstart handler should call `e.stopPropagation()` to prevent the event from reaching SuperGrid's drop zone listeners. SuperGrid already does this (line 3507). This prevents cross-module event leakage.
- **dragend cleanup is mandatory**: Both implementations must clear their singleton in `dragend`, even if `drop` was never fired (drag cancelled). SuperGrid already clears `_dragPayload` in the `drop` handler (line 3941) but relies on dragend for visual cleanup only. ProjectionExplorer must clear on both `drop` and `dragend`.
- **Test with overlapping geometries**: Write integration tests where a ProjectionExplorer chip is dragged across the SuperGrid area. Verify no SuperGrid drop zone visual feedback appears and no axis state changes.

**Detection:** Manual: drag a projection chip, hover over SuperGrid area, verify no drop zone highlighting. Automated: test that SuperGrid's `_dragPayload` remains null during a ProjectionExplorer drag sequence.

**Phase:** Phase 2 (Properties + Projection Explorers) -- the DnD contract must be designed and tested before implementing Projection wells.

---

### Pitfall 4: Explorer Modules Creating Parallel State Outside Providers

**What goes wrong:** The spec's State Coordinator Call-Site Contract (Section 6) is the single most important architectural constraint for explorer modules. Every explorer control change must follow: (1) update provider, (2) call `stateCoordinator.scheduleUpdate()`. The spec explicitly warns: "Violations (direct query triggers, ad-hoc `grid.render()` calls) are the primary architectural failure mode to prevent."

The temptation to violate this contract appears in several concrete scenarios:

1. **PropertiesExplorer maintaining its own property list** -- The module needs to display available properties with toggle states and display names. If it maintains a local `Map<string, { enabled: boolean, displayName: string }>` and syncs it to the provider on change, the local map IS parallel state. Any desync between the local map and PAFVProvider means the UI shows one thing while SuperGrid renders another.

2. **ProjectionExplorer maintaining well contents locally** -- The 4 wells (available, x, y, z) need to display which properties are assigned where. If the module stores well contents in local arrays and pushes to PAFVProvider on drop, the local arrays can desync from the provider if an external source (e.g., command palette action, keyboard shortcut, another module) modifies the provider directly.

3. **NotebookExplorer session state** -- The spec says "Session-only in v1. Content lives in component state only." This is correctly local state (not provider state). But if a future phase wants notebook content to influence queries or filters, the session-only design becomes a migration liability.

4. **LatchExplorers caching filter values** -- If the LATCH explorer reads current filter state on mount and caches it locally, then an external filter change (e.g., SuperGrid's SuperFilter dropdown, Clear Filters button) updates the provider but the explorer UI still shows the stale cached state.

**Why it happens:** Each explorer module is an "isolated module with mount/destroy/update API" (spec Section 5). The isolation creates pressure to maintain local state for rendering performance -- re-reading the provider on every render feels wasteful. But the providers are the single source of truth, and local caches create consistency bugs.

**Consequences:** UI shows wrong state (toggle says enabled, but property is not in the query). User actions in one module do not reflect in another. Undo/redo (which operates through MutationManager/providers) produces inconsistent state between explorers and views.

**Prevention:**
- **Explorers are views, not models**: Explorer modules read provider state and render it. They do not own or cache business state. Use `provider.subscribe()` to receive change notifications and re-render from provider state each time.
- **Constructor injection**: Explorers receive provider references via constructor (spec Section 6, last paragraph). They never import singletons or construct providers.
- **No local boolean/map mirrors**: Instead of `this._enabledProperties: Map<string, boolean>`, read `PAFVProvider.getAvailableProperties()` on each render/update. Use D3's `selection.join()` pattern to efficiently update the DOM from provider state without full rebuilds.
- **Bidirectional flow test**: For each explorer module, write a test that modifies the provider externally (simulating another module or SuperGrid action) and verifies the explorer UI updates to reflect the change.
- **NotebookExplorer is the exception**: Session-only content is correctly local. But document this explicitly: "NotebookExplorer owns its content. All other explorers are pure views into provider state."

**Detection:** Code review: grep for `private _.*: Map<` and `private _.*: Set<` in explorer modules. Any local collection that mirrors provider state is a red flag. Test: modify provider state directly, then verify explorer UI reflects the change without calling any explorer update method.

**Phase:** Phase 2 (Properties + Projection Explorers) -- establish the pattern with the first two modules; all subsequent explorers follow the same pattern.

---

### Pitfall 5: Markdown Preview innerHTML Injection (XSS)

**What goes wrong:** The spec prescribes for NotebookExplorer: "sanitized HTML preview rendered via `element.innerHTML = sanitize(marked(content))`." This two-step pipeline (Markdown-to-HTML, then sanitize) has known attack vectors:

1. **Markdown parser outputs HTML that bypasses sanitizer** -- The `marked` library supports raw HTML in Markdown by default. An attacker (or careless user pasting content) can write Markdown containing `<img src=x onerror=alert(1)>` or `<a href="javascript:alert(1)">`. The `marked` parser passes this HTML through to the output. The sanitizer must then catch it.

2. **Mutation XSS (mXSS)** -- DOMPurify versions through 3.1.0 had bypass vulnerabilities where deeply nested HTML caused browser node-flattening that transformed sanitized content into executable JavaScript after insertion. The 2025 research from Cure53 documents ongoing mXSS vectors.

3. **Order of operations matters** -- Sanitizing BEFORE Markdown parsing is wrong (Markdown syntax gets sanitized away). Sanitizing AFTER is correct but requires the sanitizer to handle the full output of the Markdown parser, including any unusual HTML the parser generates.

4. **`javascript:` URL scheme in links** -- Markdown `[click me](javascript:alert(1))` produces `<a href="javascript:alert(1)">`. Some sanitizers strip `javascript:` URLs by default, others do not.

5. **WKWebView context amplifies risk** -- In the native app context, JavaScript execution has access to `window.webkit.messageHandlers.nativeBridge` which can post messages to Swift. A successful XSS could trigger native actions (file import, checkpoint save, sync operations).

**Why it happens:** Markdown is a mixed-content format that allows raw HTML. The spec correctly calls for sanitization, but the choice of sanitizer and its configuration determines whether it actually prevents XSS.

**Consequences:** Arbitrary JavaScript execution in the WKWebView context. In the worst case, malicious Markdown content could trigger native bridge messages (checkpoint save with corrupted data, import from arbitrary URLs, sync manipulation). In the moderate case, session data exfiltration or UI manipulation.

**Prevention:**
- **Use DOMPurify 3.2+ (latest stable)** -- Post-mXSS-fix versions. Pin the exact version in package.json, do not use `^` range.
- **Configure DOMPurify strictly**: `DOMPurify.sanitize(html, { ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'code', 'pre', 'blockquote', 'br', 'hr', 'img'], ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'], ALLOW_DATA_ATTR: false, ADD_TAGS: [], ADD_ATTR: [] })`. Explicitly allowlist, do not rely on defaults.
- **Block `javascript:` URLs explicitly**: Add `FORBID_ATTR: ['onerror', 'onload', 'onclick']` and use DOMPurify's `ALLOWED_URI_REGEXP` to only permit `https?://` and `mailto:` protocols.
- **Configure `marked` to disable raw HTML**: `marked.setOptions({ sanitize: false })` (sanitize in marked is deprecated) and rely entirely on DOMPurify for HTML sanitization. Better: use `marked` with `{ headerIds: false, mangle: false }` to reduce attack surface.
- **Do NOT roll a custom sanitizer** -- The spec explicitly says "Use an existing or minimal sanitizer dependency; do not roll a custom one."
- **Content Security Policy**: Add `<meta http-equiv="Content-Security-Policy" content="script-src 'none'">` on the notebook preview iframe (if using an iframe) or rely on the app's existing CSP. Note: the WKWebView app:// scheme may not enforce CSP consistently.
- **Test with known XSS payloads**: Use the OWASP XSS cheat sheet as a test fixture. Include payloads in unit tests that verify sanitized output contains no executable JavaScript.

**Detection:** Unit tests with XSS payload fixtures. Automated: parse known-malicious Markdown strings, sanitize, verify output contains no `<script>`, `javascript:`, `onerror=`, `onload=`, or `onclick=` attributes. Manual: paste OWASP test cases into the textarea and verify the preview does not execute JavaScript.

**Phase:** Phase 4 (Notebook Explorer) -- sanitizer library and configuration must be chosen and tested before implementing the preview pane.

---

## Moderate Pitfalls

### Pitfall 6: Collapsible Panel Animations Triggering SuperGrid Layout Recalculation

**What goes wrong:** When explorer panels collapse or expand, the `.workbench-view-content` element's height changes (it has `flex: 1 1 auto` to take remaining space). This height change forces SuperGrid to recalculate its CSS Grid layout, re-run the virtualizer's `getVisibleRange()`, and potentially trigger a Worker re-query if the visible row count changes.

The problem compounds when multiple panels collapse/expand in rapid succession (e.g., user double-clicks multiple panel headers). Each height change triggers:
1. Browser reflow of the flex container
2. SuperGrid's `.supergrid-view` element resizes
3. CSS `content-visibility: auto` on data cells re-evaluates visibility
4. SuperGridVirtualizer recalculates visible rows
5. If visible row count changed, a new Worker query fires

This is a cascade of layout thrashing: read layout (getVisibleRange) then write (re-render cells) then read (new getBoundingClientRect for lasso cache) then write (update sticky header positions).

**Why it happens:** CSS flex containers propagate size changes to all flex children. SuperGrid's root element is a flex child. Any change in the panel rail's total height changes the available height for the view content area.

**Consequences:** Janky animation (frame drops during panel toggle), unnecessary Worker round-trips, and potential visual flicker as SuperGrid re-renders during the animation.

**Prevention:**
- **Do NOT animate height directly** -- Use `max-height` animation (from `999px` to `0`) or CSS `transform: scaleY()` for collapse/expand. `transform` is compositor-only and does not trigger layout on siblings.
- **Better: use CSS `overflow: hidden` + `height: 0` with `transition: height 200ms ease-out`** -- This is the standard pattern for collapsible panels. The key is that the animation should be on the panel content, not on the flex container itself.
- **Debounce the SuperGrid resize response** -- Add a resize observer debounce (100ms) on `.workbench-view-content`. Only re-query the Worker after the collapse animation completes, not on every frame.
- **`will-change: height` on collapsible panels** -- Hints the browser to promote the element to its own compositor layer, reducing reflow impact on siblings.
- **rAF coalescing saves us partially** -- The existing `_pendingQueryRaf` in SuperGrid already coalesces multiple provider change notifications into a single Worker request. But a resize-triggered re-query bypasses this coalescing because it does not go through StateCoordinator.

**Detection:** Performance test: toggle 4 panels rapidly, measure frame rate in the SuperGrid area. Should maintain 60fps. Verify no more than 1 Worker query fires per panel toggle sequence.

**Phase:** Phase 1 (Shell Scaffolding) -- CollapsibleSection animation strategy must be decided before implementation.

---

### Pitfall 7: ViewManager `container.innerHTML = ''` Destroying Panel Rail Content

**What goes wrong:** ViewManager's crossfade transition path calls `this.container.innerHTML = ''` (line 267) during view switches. After the re-root, `this.container` is `.workbench-view-content`. The `innerHTML = ''` call destroys everything inside this element, which is correct (only view content lives there). However, there are subtle edge cases:

1. **Loading spinner** -- `_showLoading()` calls `this.container.prepend(loading)` (line 439). If the loading spinner is prepended to `.workbench-view-content` and a view switch happens while loading, the spinner is orphaned (prepended before `innerHTML = ''` removes it, but the reference `this.loadingEl` is not cleared).

2. **Error banner** -- `_showError()` appends to `this.container` (line 457). Same issue: if an error banner is visible when a view switch triggers `innerHTML = ''`, the error banner DOM is destroyed but any event listeners on the retry button become zombie references.

3. **Empty state panels** -- `_showWelcome()` and `_showFilteredEmpty()` append to `this.container`. These are correctly destroyed by `innerHTML = ''`, but the welcome panel's button click handlers hold closures over `this.onImportFile` and `this.onImportNative`. If these closures reference destroyed DOM, click handlers on stale elements could throw.

These issues exist today but are latent because the container is `#app` and overlays are mounted as children. After re-rooting, the separation between view content and overlays makes these lifecycle issues more visible.

**Why it happens:** `innerHTML = ''` is a brute-force DOM clear. It does not invoke any cleanup logic on child elements. D3 selections, event listeners, and component references that point to destroyed DOM become stale.

**Consequences:** Memory leaks (stale event listener closures), zombie DOM references (loadingEl pointing to destroyed element), and potential TypeError exceptions if methods are called on destroyed elements.

**Prevention:**
- **ViewManager._teardownCurrentView() already handles most cases** -- It unsubscribes coordinator, cancels timers, and calls `view.destroy()`. The `innerHTML = ''` call should be preceded by `_clearErrorAndEmpty()` (which removes `.view-error-banner` and `.view-empty` elements by selector) and `_hideLoading()` (which removes the loading spinner by reference).
- **Verify the cleanup order**: `_teardownCurrentView()` then `_clearErrorAndEmpty()` then `_hideLoading()` then `innerHTML = ''`. Currently, `_clearErrorAndEmpty()` is called inside `_fetchAndRender()`, not in the switchTo path before `innerHTML = ''`.
- **After re-root, add a guard**: Before `innerHTML = ''`, check that no child elements outside ViewManager's ownership exist in the container. Since `.workbench-view-content` should only contain view-managed content, this is mostly a safety assertion.

**Detection:** Test: trigger a view switch while a loading spinner is visible. Verify no stale loadingEl reference. Trigger a view switch while an error banner is showing. Verify no zombie event listeners.

**Phase:** Phase 1 (Shell Scaffolding) -- ViewManager's cleanup order must be reviewed when changing the container reference.

---

### Pitfall 8: Explorer Property Catalog Divergence from PAFVProvider Schema

**What goes wrong:** PropertiesExplorer displays LATCH-grouped properties with toggle checkboxes. The property list must be derived from `PAFVProvider.getAvailableProperties()` or equivalent (spec Section 5.2). If the explorer hardcodes property names or LATCH groupings that do not match the actual database schema (`cards` table columns), users see properties that do not exist or miss properties that do exist.

The current `cards` schema has specific LATCH-mappable columns:
- **L (Location):** `folder` (nullable)
- **A (Alphabet):** `name` (required)
- **T (Time):** `created_at`, `modified_at`, `due_at`
- **C (Category):** `card_type`, `status`, `priority`, `source`
- **H (Hierarchy):** via `connections` table (not a card column)

If PropertiesExplorer shows a property like "tags" (which is an FTS5 column but not directly queryable as a group-by axis), users will try to assign it to an axis well and get SQL errors or empty results. Similarly, `body_text` is in the FTS index but is not a valid PAFV axis.

**Why it happens:** The property catalog is conceptually broader than the PAFV-queryable columns. Not all card columns are valid GROUP BY targets. FTS-indexed fields are search targets, not axis targets. The explorer must distinguish between "properties that exist" and "properties that can be assigned to axes."

**Consequences:** SQL errors when non-axis-eligible properties are used in GROUP BY queries. Empty results when FTS-only fields are assigned to axes. User confusion when properties appear in the explorer but produce no useful output.

**Prevention:**
- **PAFVProvider already has an allowlist** -- The `QueryBuilder` uses allowlisted fields for SQL safety. PropertiesExplorer must use the same allowlist as its data source, not an independent property catalog.
- **LATCH grouping must be data-driven** -- Define a `PropertyDescriptor` type that includes `field: string`, `displayName: string`, `latchAxis: 'L'|'A'|'T'|'C'|'H'`, and `isAxisEligible: boolean`. Derive this from the existing allowlist, not from a separate configuration.
- **Filter non-axis properties** -- Properties like `id`, `body_text`, `tags`, `sort_order` should be excluded from the explorer or shown as non-draggable (visible for reference only, not assignable to wells).

**Detection:** Test: assign every property from PropertiesExplorer to each well (x, y, z). Verify no SQL errors, no empty results for populated data, no uncaught exceptions.

**Phase:** Phase 2 (Properties + Projection Explorers) -- property catalog design is the first task.

---

### Pitfall 9: Test Regression from DOM Hierarchy Change

**What goes wrong:** Existing tests create a bare `document.createElement('div')` container and pass it directly to ViewManager, SuperGrid, and other components (confirmed across ViewManager.test.ts, SuperGrid.test.ts, and 30+ test files). After the re-root:

1. **ViewManager tests** -- Currently pass a plain `<div>` as `container`. After the re-root, ViewManager receives `.workbench-view-content` in production. The tests should continue to work (ViewManager does not know or care what class its container has), BUT if any production code starts querying ancestors (e.g., `container.closest('.workbench-shell')`) for layout decisions, tests with bare `<div>` containers will fail.

2. **SuperGrid tests** -- SuperGrid mounts into whatever container is passed. After the re-root, the container is `.workbench-view-content` which has `overflow: hidden` and a defined height from flex layout. In jsdom, none of these CSS properties compute correctly (jsdom does not implement CSS layout). This is fine for current tests, but any new tests that depend on scroll behavior or sticky positioning will be unreliable.

3. **Overlay tests** -- Tests for AuditOverlay, HelpOverlay, CommandPalette, ImportToast, and ActionToast mount to a container element. After the re-root, overlays should mount to the overlay host, not the view content host. Existing tests are unaffected (they use their own mock containers), but new integration tests must use the correct hierarchy.

4. **ViewTabBar tests** -- The ViewTabBar is mounted to the same container as ViewManager. After the re-root, the ViewTabBar may be removed entirely (replaced by explorer navigation). Any tests asserting ViewTabBar presence in the container will fail.

**Why it happens:** The re-root changes the production DOM hierarchy but not the test DOM hierarchy. Tests use mock containers that do not replicate the full shell structure. This is normally fine for unit tests but can cause integration test failures.

**Consequences:** False confidence if tests pass but production layout is broken (tests cannot detect CSS layout issues in jsdom). False failures if production code adds ancestor queries that tests do not replicate.

**Prevention:**
- **Do NOT require test containers to replicate the shell structure** -- Keep ViewManager and SuperGrid tests with bare `<div>` containers. These are unit tests that test component behavior, not layout.
- **Add a dedicated integration test** -- Create `tests/ui/WorkbenchShell.test.ts` that builds the full shell hierarchy and verifies: ViewManager receives `.workbench-view-content`, overlays receive the overlay host, SuperGrid renders inside the shell.
- **Update ViewManager.test.ts mount path assertion** -- The test at line 228 checks `container.innerHTML` for stale content removal. This remains valid after the re-root.
- **Do not add `container.closest()` or `container.parentElement` queries in production code** -- Components should be container-agnostic. They receive a container element and mount into it. They do not navigate upward.
- **Remove or update ViewTabBar tests** -- If the tab bar is removed from the Workbench layout, its tests should be removed or moved to a legacy section.

**Detection:** Run the full test suite after Phase 1 changes. All existing tests should pass without modification. If any test fails, the re-root introduced an unwanted coupling.

**Phase:** Phase 1 (Shell Scaffolding) -- the spec's Phase 1 gate explicitly requires: "All existing SuperGrid tests remain green."

---

## Minor Pitfalls

### Pitfall 10: CollapsibleSection State Not Persisting Across Sessions

**What goes wrong:** If CollapsibleSection collapse state is stored only in the component instance (runtime memory), users must re-expand their preferred panel layout on every page load. This is a quality-of-life issue, not a functional bug, but it makes the Workbench feel like it forgets the user's preferences.

**Prevention:** Store collapse state in the existing `StateManager` (Tier 2 persistence) using a key like `workbench:panel:${panelId}:collapsed`. Read on mount, write on toggle. The existing pattern (PAFVProvider serializes to StateManager) provides the template.

**Phase:** Phase 1 (Shell Scaffolding) -- or defer to a polish phase if Phase 1 is already scope-heavy.

---

### Pitfall 11: Zoom Rail Slider Interfering with SuperGrid's SuperZoom

**What goes wrong:** The Visual Explorer includes a "left vertical rail slider for zoom/pan affordance" (spec Section 5.4) that maps to `SuperPositionProvider.zoomLevel`. SuperGrid already has SuperZoom, which reads and writes `zoomLevel` on the same provider. If the rail slider and SuperZoom both write to `zoomLevel` without coordinating, race conditions occur: user drags the slider while SuperZoom is processing a Ctrl+scroll event, producing oscillating zoom levels.

**Prevention:**
- The rail slider should be the ONLY external zoom control. It reads from and writes to `SuperPositionProvider.zoomLevel`.
- SuperZoom's Ctrl+scroll handler should also write to `SuperPositionProvider.zoomLevel` (it already does).
- Both write to the same provider property, so the last write wins. This is acceptable as long as writes are synchronous (no debouncing that could cause read-old-value-write-stale-value patterns).
- The rail slider should subscribe to `SuperPositionProvider` changes and update its thumb position when zoom changes from other sources (SuperZoom scroll events). This prevents the slider from showing a stale zoom level.

**Phase:** Phase 3 (Visual Explorer) -- coordinate slider wiring with existing SuperZoom.

---

### Pitfall 12: Event Listener Leaks on Explorer Mount/Destroy Cycles

**What goes wrong:** Explorer modules have mount/destroy lifecycle. If a user navigates between views or collapses/expands panels frequently, explorers may be destroyed and recreated. Each mount cycle that adds `document.addEventListener()` or `window.addEventListener()` without corresponding removal in `destroy()` creates a listener leak. Over time, leaked listeners accumulate, causing duplicated event handling, memory growth, and progressively slower event dispatch.

The existing codebase has this exact pattern solved: `SuperGrid.destroy()` removes its coordinator subscription, density subscription, selection subscription, and escape key handler. `HelpOverlay.destroy()` removes its keyboard listener. The pattern is established but must be replicated for each new explorer module.

**Prevention:**
- **Every `addEventListener` in `mount()` must have a matching `removeEventListener` in `destroy()`** -- Store bound handlers as instance properties (e.g., `this._boundKeyHandler`) so the same function reference is used for both add and remove.
- **Use the unsubscribe pattern for provider subscriptions** -- Store the return value of `provider.subscribe()` and call it in `destroy()`.
- **Write a lifecycle test for each explorer** -- Mount, destroy, mount again. Verify no duplicate event handlers fire. Check that subscriber counts on providers return to pre-mount levels after destroy.

**Phase:** Phase 2 and beyond -- apply to every explorer module.

---

### Pitfall 13: CommandBar Input Conflicting with ShortcutRegistry

**What goes wrong:** The CommandBar includes a "command input" element. When this input is focused, typing characters should fill the input, not trigger keyboard shortcuts. The existing ShortcutRegistry has an input field guard (returns early when `target.tagName === 'INPUT'`), which should handle this. However, shortcuts that use modifier keys (Cmd+1-9 for view switching) will still fire when the CommandBar input is focused and the user types Cmd+1, because the input field guard only skips non-modified key presses.

This is the same class of problem as Pitfall 5 from the previous PITFALLS.md (Command Palette Cmd+K conflicts), but for the CommandBar input which is always visible on screen, not modal.

**Prevention:**
- The CommandBar input should call `e.stopPropagation()` on `keydown` for all modifier key combinations to prevent ShortcutRegistry from intercepting them.
- Alternatively, the CommandBar input click should open the CommandPalette (which already has a focus trap and shortcut suspension mechanism from Phase 51).
- If the CommandBar input is purely a click target that opens the palette (placeholder text "Command palette..."), it does not need keyboard event handling at all -- clicking it opens the real palette.

**Phase:** Phase 1 (Shell Scaffolding) -- clarify whether CommandBar input is a real input or a palette trigger button.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: Shell Scaffolding | CSS bleed into SuperGrid (#1) | Scope all selectors; test SuperGrid rendering in new mount point |
| Phase 1: Shell Scaffolding | DOM re-rooting breaks overlays (#2) | Separate overlay host from view host; update main.ts wiring |
| Phase 1: Shell Scaffolding | innerHTML destroys orphaned UI (#7) | Review ViewManager cleanup order; clear transient states before innerHTML |
| Phase 1: Shell Scaffolding | Panel animation causes layout thrashing (#6) | Use CSS transform or debounced resize observer |
| Phase 1: Shell Scaffolding | Test regression from hierarchy change (#9) | Run full suite; add WorkbenchShell integration test |
| Phase 1: Shell Scaffolding | CommandBar input shortcut conflict (#13) | Make input a palette trigger button, not a real input |
| Phase 2: Properties + Projection | DnD event collision (#3) | Distinct MIME types; separate singletons; stopPropagation |
| Phase 2: Properties + Projection | Parallel state in explorers (#4) | Explorers read from providers; no local mirrors |
| Phase 2: Properties + Projection | Property catalog divergence (#8) | Use PAFVProvider's allowlist as sole data source |
| Phase 2: Properties + Projection | Listener leaks on mount/destroy (#12) | Lifecycle tests; removeEventListener in destroy() |
| Phase 3: Visual Explorer | Zoom slider racing with SuperZoom (#11) | Both write to same provider property; slider subscribes to changes |
| Phase 4: Notebook Explorer | XSS via Markdown preview (#5) | DOMPurify 3.2+ with strict allowlist; test with OWASP payloads |

---

## Sources

### Codebase Inspection (HIGH confidence)

- `src/main.ts` -- composition root showing container usage for ViewManager, overlays, toasts (lines 49, 131, 142, 183, 339, 411, 429, 439)
- `src/views/ViewManager.ts` -- container.innerHTML clearing (lines 267, 308), loading/error/empty mounting (lines 439, 457, 554, 596), tabindex/role attributes (lines 52-54, 160)
- `src/views/SuperGrid.ts` -- module-level `_dragPayload` singleton (line 106), `overflow: auto` on root (line 514), drop zone wiring (lines 3892-3984), MIME type `text/x-supergrid-axis` (lines 3501, 3652, 3894)
- `src/styles/supergrid.css` -- `content-visibility: auto` on `.data-cell` (line 5), sticky header exclusion (lines 9-11)
- `src/styles/views.css` -- `.drag-over` class (line 267), bare element selectors like `button:focus-visible` (lines 275-293)
- `tests/views/ViewManager.test.ts` -- bare `<div>` container setup (line 154), innerHTML assertion (line 231)
- `tests/views/SuperGrid.test.ts` -- bare `<div>` container, mock providers (lines 70-88)
- `docs/D3-UI-IMPLEMENTATION-SPEC-V2.md` -- DOM hierarchy spec (Section 4.1.1), CSS scoping rules (Section 7.2), DnD contract (Section 5.3.1), State Coordinator contract (Section 6)

### Web Research (MEDIUM confidence)

- [Getting stuck: all the ways position:sticky can fail - Polypane](https://polypane.app/blog/getting-stuck-all-the-ways-position-sticky-can-fail/) -- overflow:hidden breaks sticky positioning
- [Common Pitfalls with HTML5 Drag 'n' Drop API - Medium](https://medium.com/@reiberdatschi/common-pitfalls-with-html5-drag-n-drop-api-9f011a09ee6c) -- DnD event bubbling and MIME type conflicts
- [XSS in Markdown - HackTricks](https://book.hacktricks.wiki/en/pentesting-web/xss-cross-site-scripting/xss-in-markdown.html) -- Markdown XSS vector catalog
- [When Purification Fails: Exploiting DOMPurify's Leftovers (2025)](https://shaheen.beaconred.net/research/2025/05/28/when-purification-fails.html) -- DOMPurify bypass research
- [Exploring the DOMPurify library: Bypasses and Fixes](https://mizu.re/post/exploring-the-dompurify-library-bypasses-and-fixes) -- mXSS via namespace confusion
- [DOMPurify GitHub](https://github.com/cure53/DOMPurify) -- latest release notes and security advisories
- [Avoid large, complex layouts and layout thrashing - web.dev](https://web.dev/avoid-large-complex-layouts-and-layout-thrashing/) -- layout thrashing prevention patterns
- [What forces layout/reflow - Paul Irish](https://gist.github.com/paulirish/5d52fb081b3570c81e3a) -- comprehensive reflow trigger list
- [Sticky Headers and Full-Height Elements - Smashing Magazine](https://www.smashingmagazine.com/2024/09/sticky-headers-full-height-elements-tricky-combination/) -- sticky header + flex layout interactions
- [How Selections Work - Mike Bostock](https://bost.ocks.org/mike/selection/) -- D3 selection grouping and parent node binding
