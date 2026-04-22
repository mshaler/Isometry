# Feature Research

**Domain:** Tabbed document interface shell for a polymorphic data projection platform
**Researched:** 2026-04-21
**Confidence:** HIGH (patterns from VS Code, Figma, Notion, Excel/Sheets + direct source reads of existing SuperWidget/Projection primitives)

---

## Context

SuperWidget is already built: 4-slot CSS Grid (header/canvas/status/tabs), a pure Projection state machine with 5 transition functions, commitProjection rendering, and a canvas registry. Three CanvasComponent implementations (ExplorerCanvas, ViewCanvas, EditorCanvas) are production-ready. The Projection type already carries `activeTabId` and `enabledTabIds`. The current tabs slot holds placeholder buttons and a static gear icon. The task for v13.3 is to wire this substrate into a real shell that replaces WorkbenchShell as the primary app container.

---

## What Already Exists (Do Not Rebuild)

| Existing Feature | Relevant Seam for v13.3 |
|-----------------|------------------------|
| `switchTab(proj, tabId)` — guarded: no-op if tabId not in enabledTabIds or already active | Wire tab click events to `commitProjection(switchTab(proj, id))` |
| `toggleTabEnabled(proj, tabId)` — guard: never removes the active tab | Drive close-tab button; guard for last-tab prevention already in place |
| `setCanvas(proj, canvasId, canvasType)` — drive new canvas creation | Used for "create new tab" flow |
| `enabledTabIds: ReadonlyArray<string>` on Projection | Source of truth for which tabs are visible in the tab bar |
| `activeTabId` on Projection | Source of truth for the active tab indicator |
| `statusSlot.ts` — `renderStatusSlot` / `updateStatusSlot` (cards · connections · last-import) | Explorer canvas status content; ViewCanvas and EditorCanvas need their own per-canvas-type blocks |
| `ViewCanvas._updateStatus()` — view name + card count written into statusEl | Existing per-canvas status pattern to build on |
| `onSidecarChange` callback in ViewCanvasConfig | Already emits `explorerId | null` on every view switch; shell receiver must mount/destroy sidecar |
| `VIEW_SIDECAR_MAP` in ViewCanvas — only `supergrid` maps to `'explorer-1'` | Auto-show/hide logic already encoded; shell just needs to act on the callback |
| Top-slot/bottom-slot containers scaffolded in v11.1 | Physical container exists; sidecar mounts into it |
| StateManager Tier 2 persistence (ui_state table, key-value) | Pattern for persisting tabs: `sw:zone:{zoneRole}:tabs` → `{activeTabId, enabledTabIds}` |
| Three-tier persistence model (D-005) | Tab config is Tier 2 — device-local, cross-session; never Tier 1 (DB) or Tier 3 (ephemeral) |
| ShortcutRegistry + roving tabindex + Cmd+1-9 pattern from v4.2/v6.1 | Keyboard tab navigation follows the same roving tabindex composite-widget pattern |
| DockNav ARIA tablist keyboard navigation | Established ARIA tablist + roving tabindex pattern to replicate for tab bar |
| Pointer Events DnD (D-017) — no HTML5 drag on any surface | Any future tab drag-to-reorder must use pointer events, not HTML5 drag |

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Tab switching by click | Core navigational contract — a visible tab bar implies clickable tabs | LOW | Wire click events on tabs slot → `commitProjection(switchTab(proj, id))`; existing primitive does all the work |
| Active tab visual indicator | Users must know which tab is active without ambiguity | LOW | `data-tab-active` attribute already placed on placeholder buttons; CSS bottom-border or background change only |
| Close tab (X on hover) | VS Code, Figma, Chrome, every professional tool shows X on hover | MEDIUM | X appears on hover via CSS; click calls `commitProjection(toggleTabEnabled(proj, id))`; existing guard prevents closing active or last tab |
| Create new tab (+ button) | Users expect to open additional canvases | MEDIUM | "+" button in tabs slot; if zone has fixed canvas type (Explorer zone → always ExplorerCanvas), no picker needed — call `setCanvas` then `toggleTabEnabled` then `switchTab` |
| Tab persistence across sessions | Closing and reopening the app should restore open tabs | MEDIUM | Serialize `{activeTabId, enabledTabIds}` to `ui_state` table under `sw:zone:{zoneRole}:tabs`; restore at boot after canvas registration — same pattern as LATCH overrides (v5.3) |
| Keyboard tab navigation | Arrow keys navigate tabs; Cmd+number jumps to tab N | LOW | Roving tabindex on tabs slot; ArrowLeft/ArrowRight per established DockNav pattern; Cmd+1-9 reuses ShortcutRegistry |
| Tab overflow handling | More tabs than fit must still be reachable | MEDIUM | Scroll chevrons or overflow dropdown when tab count exceeds visible area; practical limit ~6-8 tabs before overflow matters |
| Explorer sidecar auto-show/hide | Context-sensitive panels are a table-stakes pattern in data tools (Figma properties panel, VS Code language features, Excel format pane) | LOW | `onSidecarChange` callback from ViewCanvas already fires with `explorerId | null`; shell mounts/destroys sidecar canvas in top-slot |
| Smooth sidecar transition | Abrupt show/hide is jarring in a data tool | LOW | CSS `max-height` + `opacity` transition (200ms ease) on top-slot container; consistent with CollapsibleSection patterns |
| Rich status bar — per canvas type | Every professional data tool shows relevant context in a footer: VS Code shows branch + language, Excel shows sum of selection, Figma shows layer info | LOW | ViewCanvas: view name + card count; EditorCanvas: selection count + save state; ExplorerCanvas: dataset name + last import |
| Status bar left/right content split | VS Code UX guidelines: left = workspace/canvas facts, right = system facts | LOW | Left: canvas-specific data (card count, view name); right: system info (sync status, last import time) |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Canvas-type-aware tab labels | Tabs show "SuperGrid", "Kanban", "Notebook" — not "Tab 1"; meaningful identity without user effort | LOW | `VIEW_DISPLAY_NAMES` already in ViewCanvas; ExplorerCanvas `TAB_DEFS` already has labels; derive from canvas registry entry or current view name via `onViewSwitch` |
| Filter summary in status bar | "3 filters active" makes filter state visible at a glance without opening the filter panel | MEDIUM | FilterProvider is accessible via coordinator; requires subscribing from within the status update path — cross-cutting concern, adds moderate complexity |
| Selection count in Editor status | "3 cards selected" mirrors spreadsheet selection feedback (Excel sum-of-selection); gives the editor context without switching to the view | LOW | SelectionProvider is already injected into EditorCanvas; `getSelectedIds().length` is a single read |
| Animated sidecar entrance/exit | Slides in/out smoothly rather than snapping — matches the Figma properties panel feel | LOW | CSS transition only; no JS animation needed; consistent with existing CollapsibleSection animation patterns in codebase |
| Canvas-type-derived labels without user friction | User never has to name a tab — the system names it from context; Explorer tabs get section names from TAB_DEFS, View tabs get the current view type | LOW | Zero implementation cost beyond wiring label updates on `onViewSwitch` |
| Multiple explorer sidecar slots (future) | Two sidecars simultaneously (Projections + LATCH Filters) for compound view configurations | HIGH | `defaultExplorerId` on CanvasRegistryEntry is singular today; would need a `defaultExplorerIds: string[]` upgrade; out of scope for v13.3 but the architecture must leave the door open by not hardcoding single-slot assumptions |

### Anti-Features (Commonly Requested, Often Problematic)

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Unlimited tab count (no cap) | "More is more" mental model; power users want many open views | Overflow degrades discoverability; hidden tabs have high interaction cost (Mozilla research: carousel-style overflow increases access time significantly); in Isometry the practical max is 9 view types + editor + explorer = conceptual cap already exists | Cap visible area at 6-8 tabs; use tab overflow chevron or dropdown for remainder; DockNav already serves as the persistent navigation, so tabs are for active working context |
| Tab drag-to-detach (floating window) | VS Code supports detaching editors to separate windows | WKWebView does not support window detachment without a new WKWebView instance; bridge protocol would need duplication | Drag-to-reorder within the single tab bar satisfies spatial organization without architectural cost |
| Tab rename (user-assigned label) | Notion and Excel allow renaming sheets | Requires a label store separate from canvas identity; complicates serialization and display; canvas-type-derived labels are already meaningful in Isometry's domain | Canvas-type-derived labels are meaningful enough for v13.3; rename is a valid backlog item but not blocking shell replacement |
| Pinned tabs (lock position, no close) | Browser pattern; helps preserve important tabs | Isometry tabs are canvas slots, not documents; DockNav already provides the "always accessible" function — tab pinning would duplicate that | Use DockNav for persistent navigation; tab bar is for active working context only |
| Tab color coding | Notion/Excel allow color per tab | Adds visual noise without semantic information in a tool where tab identity comes from canvas type; color is already reserved semantically for audit overlay | Tab identity via icon + label (canvas type) is sufficient; reserve color for audit and filter states |
| Animated "auto-save" indicator in status bar | Notion's spinning dot pattern is familiar | Isometry's save model is a debounced checkpoint (30s autosave + on-mutate), not per-keystroke; spinning animation would be misleading and adds complexity for minimal user value | Show CKSyncEngine sync status (already published via SyncStatusPublisher) — that reflects cross-device state, which is genuinely user-relevant |
| Infinite status bar slots | VS Code's extension model leads to slot accumulation | Cognitive overload; VS Code's own guidelines recommend restraint; cluttered status bar makes each item register less | 3-5 fixed slots per canvas type, strictly enforced; left = canvas data facts, right = system facts; no extension/plugin injection for v13.3 |

---

## Feature Dependencies

```
Tab switching (click → commitProjection)
    └──requires──> Projection.enabledTabIds populated at boot
                       └──requires──> Tab session persistence (StateManager restore)

Tab close (X button)
    └──requires──> Tab switching (must be able to switch before closing active tab)
    └──uses──> toggleTabEnabled() — guard for active-tab and last-tab already in primitive

Create new tab
    └──requires──> Canvas registry entry exists for new canvasId
    └──produces──> Sequential: setCanvas → toggleTabEnabled → switchTab (3 commitProjection calls)

Tab overflow handling
    └──requires──> Tab create (tabs must exceed visible area before overflow matters)
    └──conflicts──> Tab drag-to-reorder (both compete for pointer events along tab bar edges)

Explorer sidecar auto-show/hide
    └──requires──> onSidecarChange callback wired in ViewCanvasConfig (already exists)
    └──requires──> Top-slot container in shell (scaffolded in v11.1)
    └──enhances──> Animated transition (CSS only, no extra dependency)

Status bar — per-canvas content
    └──requires──> Canvas mounts into statusEl (pattern from ViewCanvas DOM traversal)
    └──requires──> Each canvas type writes its own content block into statusEl slot

Filter summary in status bar
    └──enhances──> Status bar — per-canvas content
    └──requires──> FilterProvider subscription from within the canvas status update path

Selection count in Editor status
    └──enhances──> Status bar — per-canvas content
    └──requires──> SelectionProvider subscription in EditorCanvas (provider already injected)

Tab persistence
    └──requires──> StateManager Tier 2 persistence (established pattern)
    └──restore must happen after──> Canvas registry is populated (same constraint as LATCH overrides in v5.3)

Keyboard tab navigation
    └──requires──> Tab switching (must have tabs to navigate)
    └──uses──> Roving tabindex pattern (already established in DockNav and CommandBar)
    └──uses──> ShortcutRegistry (Cmd+1-9 already exists for view switching — must not collide)

Tab drag-to-reorder
    └──requires──> Tab create + Tab close (needs at least 2 tabs to reorder)
    └──requires──> Pointer Events DnD (D-017; must NOT use HTML5 drag)
    └──conflicts──> Tab overflow chevrons (same pointer event space)
    └──deferred for v13.3
```

### Dependency Notes

- **Tab persistence key convention:** `sw:zone:{zoneRole}:tabs` → JSON `{activeTabId: string, enabledTabIds: string[]}`. Restore after canvas registry is populated, before first commitProjection. This mirrors how LATCH overrides (`latch:overrides`, `latch:disabled`) restore after `setLatchSchemaProvider` — the same boot-sequencing concern (v5.3, D-015).
- **Tab close guard is already in the primitive:** `toggleTabEnabled()` refuses to remove `activeTabId`. The shell must still handle the "last tab" case by disabling the close button when `enabledTabIds.length === 1`.
- **Sidecar architecture:** `onSidecarChange` emits `explorerId | null`. The shell receiving this callback must: (1) if `explorerId` is non-null, look up the canvas factory for that ID and mount it into the top-slot; (2) if null, destroy the current sidecar. The sidecar is a full CanvasComponent — its lifecycle is identical to any other canvas. The transition is CSS only.
- **Status bar content ownership:** Each canvas type owns its status slot content. It writes a `.sw-{type}-status-bar` div into the statusEl. On canvas destroy, the old div is removed with `_wrapperEl.remove()` and a fresh statusEl will receive the next canvas's content. No explicit cleanup required beyond canvas destroy.
- **Cmd+number collision:** Cmd+1-9 currently switches views (view types 1-9). If v13.3 also uses Cmd+number for tab switching, there is a collision. Resolution: tab switching uses Cmd+Shift+number or limits to Cmd+1-3 (since max useful tabs is small). Document this as a decision in implementation.

---

## MVP Definition

### Launch With (v13.3 — this milestone)

- [ ] Tab switching by click — click events on tabs slot → `commitProjection(switchTab(proj, id))`
- [ ] Active tab visual indicator — CSS on `data-tab-active`; no JS work
- [ ] Close tab (X on hover) — CSS hover + click → `commitProjection(toggleTabEnabled(proj, id))`; disable X when `enabledTabIds.length === 1`
- [ ] Create new tab (+ button) — fixed canvas type per zone (no picker for v13.3); sequential setCanvas → toggleTabEnabled → switchTab
- [ ] Tab session persistence — serialize to `ui_state` as `sw:zone:{zoneRole}:tabs`; restore at boot after registry hydration
- [ ] Keyboard tab navigation — roving tabindex on tabs slot; ArrowLeft/ArrowRight; Cmd+number (collision-safe shortcut TBD)
- [ ] Explorer sidecar auto-show/hide with CSS transition — wire `onSidecarChange` callback into top-slot mount/destroy; 200ms ease transition
- [ ] Status bar — ViewCanvas: view name + card count; EditorCanvas: selection count + save state indicator; ExplorerCanvas: dataset name + last import time
- [ ] Status bar left/right content split — data facts left, system facts right

### Add After Validation (v13.x)

- [ ] Filter summary in status bar — trigger: user feedback that filter state is invisible; medium complexity (FilterProvider subscription from status path)
- [ ] Tab overflow handling — trigger: user has more than 6 active tabs; low priority until tab creation is validated in use
- [ ] Selection count in Editor status — small addition once EditorCanvas status slot is confirmed stable

### Future Consideration (v14+)

- [ ] Tab drag-to-reorder — high implementation complexity (pointer DnD on tab bar, collision with overflow); low immediate value
- [ ] Multiple sidecar slots — requires `defaultExplorerIds: string[]` upgrade to registry; niche need for v13.3
- [ ] Tab rename — requires label store; low priority given canvas-type-derived labels are already meaningful
- [ ] Tab groups / named workspaces — product decision required before implementation

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Tab switching by click | HIGH | LOW | P1 |
| Active tab visual indicator | HIGH | LOW | P1 |
| Tab session persistence | HIGH | LOW | P1 |
| Explorer sidecar auto-show/hide with CSS transition | HIGH | LOW | P1 |
| Close tab (X on hover) | HIGH | MEDIUM | P1 |
| Create new tab (+ button) | MEDIUM | MEDIUM | P1 |
| Keyboard tab navigation | MEDIUM | LOW | P1 |
| Status bar — view name + card count (ViewCanvas) | HIGH | LOW | P1 |
| Status bar — selection count + save state (EditorCanvas) | MEDIUM | LOW | P1 |
| Status bar — dataset + last import (ExplorerCanvas) | MEDIUM | LOW | P1 |
| Status bar left/right content split | MEDIUM | LOW | P1 |
| Filter summary in status bar | MEDIUM | MEDIUM | P2 |
| Tab overflow handling | LOW | MEDIUM | P2 |
| Tab drag-to-reorder | LOW | HIGH | P3 |
| Multiple sidecar slots | LOW | HIGH | P3 |
| Tab rename | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for milestone completion (WorkbenchShell replacement)
- P2: Add after v13.3 lands and is validated
- P3: Future consideration

---

## Reference App Comparison

| Feature | VS Code | Figma | Excel/Sheets | Notion | Isometry v13.3 Approach |
|---------|---------|-------|--------------|--------|------------------------|
| Tab bar position | Top of editor area | Top of window | Bottom of document | Inline page list | Top: existing tabs slot in SuperWidget CSS Grid |
| Close mechanism | X always visible on active tab; X on hover for inactive tabs | X on hover; favicon shows when pinned | Right-click → Delete + confirmation | Click X on page tab | X on hover (CSS only); guard: last-tab and active-tab protection via `toggleTabEnabled()` |
| Tab creation | Cmd+N, drag to new group | New file (+) button | (+) button bottom-left | + New page in sidebar | (+) button in tabs slot; fixed canvas type per zone in v13.3 |
| Overflow strategy | Scroll chevrons; tab history dropdown | Overflow dropdown top-right corner | Scroll arrows bottom-left | Scrollable sidebar | Scroll chevrons on tabs slot; practical max ~6-8 |
| Active tab indicator | Blue bottom border + bold label | Blue underline + raised bg | White tab raised above bar | Bold text + filled background | `data-tab-active` → CSS bottom border or background |
| Status bar content (left) | Branch name, errors/warnings, sync status | Selection info, layer count | Cell address, sum of selection | Word count | View name + card count (ViewCanvas); dataset name (ExplorerCanvas); active card (EditorCanvas) |
| Status bar content (right) | Language mode, indent, encoding | Zoom level, live collaboration | Zoom, sheet count | Last edited, comment count | Sync status (CKSyncEngine via SyncStatusPublisher); last import time |
| Context-sensitive side panel | Activity Bar toggles side panel; language-specific panels auto-populate | Properties panel auto-fills based on selection type | Format pane context-sensitive to selection | Properties sidebar per block type | `VIEW_SIDECAR_MAP` drives auto-show for supergrid; `onSidecarChange(null)` drives hide; CSS transition on top-slot container |
| Session restore | `.code-workspace` JSON stores open tabs | Cloud-backed; tabs restore on re-open | Workbook file contains sheet list | Database-backed | `ui_state` table: `sw:zone:{role}:tabs` → `{activeTabId, enabledTabIds}`; Tier 2 StateManager |

---

## Sources

- VS Code UX Guidelines — Status Bar: https://code.visualstudio.com/api/ux-guidelines/status-bar
- VS Code User Interface docs (tab groups, overflow, reorder): https://code.visualstudio.com/docs/getstarted/userinterface
- Figma Desktop App Guide (pinned tabs, overflow, X on hover): https://help.figma.com/hc/en-us/articles/5601429983767
- Google Sheets tab management: https://www.spreadsheetclass.com/insert-delete-rename-organize-tabs-in-google-sheets/
- Mozilla Tab Overflow UX Design wiki: https://wiki.mozilla.org/Tabbed_Browsing/User_Interface_Design/Tab_Overflow
- NN/g Tabs Used Right: https://www.nngroup.com/articles/tabs-used-right/
- LogRocket Tabbed Navigation Best Practices: https://blog.logrocket.com/ux-design/tabs-ux-best-practices/
- Existing SuperWidget source: `src/superwidget/SuperWidget.ts`, `projection.ts`, `registry.ts`, `statusSlot.ts`, `ViewCanvas.ts`, `ExplorerCanvas.ts`
- Project context: `.planning/PROJECT.md` (v13.3 milestone definition, v11.1 inline embedding, D-005 three-tier persistence, D-017 pointer events, ShortcutRegistry Cmd+1-9 v4.2)

---
*Feature research for: SuperWidget Shell — tab management, explorer sidecar polish, rich status slots (v13.3)*
*Researched: 2026-04-21*
