# Feature Landscape — v13.0 SuperWidget Substrate

**Domain:** Universal container primitive with projection state machine
**Researched:** 2026-04-21
**Scope:** Subsequent milestone — new SuperWidget substrate added to existing TypeScript/D3.js platform

---

## What Already Exists (Do Not Rebuild)

These features are shipped and locked. They define the seams this milestone must fit into.

| Existing Feature | Relevant Seam |
|-----------------|---------------|
| TypeScript class with `mount(container)` / `destroy()` lifecycle | SuperWidget must follow this pattern (WorkbenchShell, DataExplorerPanel, all 8 explorer panels) |
| PanelTypes: `PanelHook`, `PanelMeta`, `PanelFactory` | Canvas registry entry shape should mirror this established pattern |
| PanelManager mount-once + visibility layer | SuperWidget uses replace-on-switch, not show/hide — different contract, but must not regress existing panels |
| DockNav event delegation (single listener on `nav`) | SuperWidget tab bar should also use event delegation, not per-tab listeners |
| CollapsibleSection with `data-*` state attributes | Sidecar collapse chevron must use `data-*` attribute pattern, not `:has()` or `style.display = ''` |
| WorkbenchShell `workbench-slot-top` / `workbench-slot-bottom` | SuperWidget renders inside these slots — must not conflict with slot height constraints |
| AppDialog (`<dialog>`) for modal interactions | No `alert()` / `confirm()` — use `<dialog>` if any modal required in stubs |
| Biome 2.4.6 lint gate | Explicit `style.display` values only; no `style.display = ''` |
| `data-attribute-over-has` pattern (v6.1) | Behavioral queries use dataset attributes; `:has()` is CSS-only progressive enhancement |

---

## Table Stakes

Features that the projection state machine and substrate must have. Missing any of these means the primitive cannot be used as a foundation for v13.1+.

| Feature | Why Expected | Complexity | Existing Dependency |
|---------|--------------|------------|---------------------|
| **Four named slots with `data-slot` attributes** (header, canvas, status, tabs) | Every downstream Canvas implementation targets a named slot. Without stable slot identity, v13.1+ milestone handoffs have no contract. | LOW | None — new |
| **CSS Grid substrate layout** | The handoff specifies CSS Grid as the layout engine (not flex) to match SuperGrid's use of CSS Grid for invariant layout. Flex would require grid-area replacement in every future Canvas. | LOW | `--sg-*`, `--pv-*` token patterns to follow |
| **Projection type as a pure TypeScript interface** (`canvasType`, `canvasBinding`, `zoneRole`, `canvasId`, `activeTabId`, `enabledTabIds`) | Pure types are the data contract between the state machine and the renderer. Without this, cross-seam tests cannot assert projection correctness. | LOW | None — new |
| **Four pure transition functions** (`switchTab`, `setCanvas`, `setBinding`, `toggleTabEnabled`) | Pure functions are the only testable pattern for a state machine without a framework. Reference equality on no-op transitions is the discriminating contract. | LOW | None — new |
| **`validateProjection` returning `{valid: boolean, reason?: string}` (never throws)** | Invalid projections must be caught before render. A throwing validator cannot be used safely in a single `commitProjection` entry point. | LOW | AppDialog pattern (never use `alert`) |
| **`commitProjection` as the single DOM-mutation entry point** | Single entry point means the validator always runs before render. Without this, callers can bypass validation and produce broken DOM state. | LOW | None — new |
| **Slot-scoped re-renders** (changing `activeTabId` re-renders canvas slot only, not header/status/tabs) | Without slot isolation, every tab switch causes a full-widget re-render. At the substrate level this is a correctness issue, not a performance one — tests must assert it. | MEDIUM | `data-render-count` stub attribute pattern (from WA-3 spec) |
| **Status slot always present in DOM, zero-height when empty** | The invariant `data-slot="status"` element is the contract that v13.1 Data Explorer Canvas targets for ingestion counts. `display: none` breaks the contract. | LOW | `min-height: 0` CSS pattern |
| **Config gear as distinguished child of tab bar** (`data-tab-role="config"`, `grid-column: -1`, always visible) | Config is visually a tab, logically distinct. Sibling-slot approach requires fragile CSS merging. This decision is locked in the handoff. | LOW | `--pv-*` token pattern |
| **Tab bar horizontal scroll with CSS edge fade** (`mask-image` gradient) | "No hidden state" principle: overflow-menu hides available tabs. Edge fade preserves discoverability without overflow-menu complexity. | LOW | None — new CSS pattern |
| **Canvas registry with `canvasId → CanvasRegistryEntry` map** | The registry is the seam at which stub Canvases are replaced by real ones in v13.1+. Without a registry, future milestones must modify the substrate. | LOW | PanelRegistry pattern (v12.0) |
| **Three Canvas Type stubs** (ExplorerCanvasStub, ViewCanvasStub, EditorCanvasStub) with `data-canvas-type` and `data-render-count` | Stubs prove the substrate accepts all three Canvas Types. `data-render-count` enables slot-isolation assertions. Without stubs, cross-seam tests cannot run. | LOW | `// STUB` comment convention (v8.0 precedent) |
| **Bound/Unbound semantics enforced** (Bound valid only when `canvasType === 'View'`) | If Explorer or Editor canvas can be Bound, sidecar logic must handle undefined Explorer pairing. The type system + validator enforce the constraint before it reaches render. | LOW | `validateProjection` (same deliverable) |
| **ViewCanvasStub sidecar**: collapsible `data-sidecar="true"` above view content when Bound | The sidecar is the v13.1 Projection Explorer pairing. The stub must render it in Bound mode so the integration test matrix can verify the layout. | LOW | CollapsibleSection chevron pattern |
| **`defaultExplorerId` in Canvas registry entry for View canvases** | The bound Explorer is resolved at render time from the registry, not stored in Projection. Without `defaultExplorerId`, the Bound/Unbound split has no lookup path. | LOW | PanelMeta.dependencies pattern |
| **Cross-seam integration test matrix** (7 transitions: tab switch, Canvas change, Bound→Unbound, View→Editor, invalid commit, disabled tabId, rapid commits) | These are the acceptance criteria for the entire milestone. If any row fails, the substrate is not safe for downstream Canvas work. | MEDIUM | `realDb()` + jsdom pattern (v6.1) |
| **Playwright WebKit smoke for integration matrix** | WKWebView is a WebKit-based host. CSS Grid features, `mask-image`, and pointer events all need WebKit verification. | MEDIUM | Existing Playwright + CI setup |

---

## Differentiators

Features that would improve the substrate but are not required for v13.1+ unblocking. None of these should be built in v13.0 — they are captured here to prevent scope creep.

| Feature | Value Proposition | Complexity | Why Defer |
|---------|-------------------|------------|-----------|
| **Animated tab transitions** (crossfade on canvas switch) | Reduces perceived load time for heavy Canvas implementations | MEDIUM | Requires real Canvas to benchmark; stub switch is instant |
| **Keyboard navigation between tabs** (Arrow key within tab bar, roving tabindex) | Accessibility improvement for power users | MEDIUM | Real Canvases will expose focus management needs; premature before content exists |
| **Projection undo/redo** (MutationManager command pattern) | Lets users navigate projection history | HIGH | Requires Story serialization (v13.6); no persistence model yet |
| **Slot height resize handles** (drag-to-resize canvas vs status vs tabs proportions) | User control over layout density | HIGH | Interaction model undefined; risk of conflicting with workbench slot height constraints |
| **Tab drag-to-reorder** within the tab bar | Power user layout customization | MEDIUM | Not in handoff scope; adds reorder state to Projection type which is not yet designed |
| **Projection persistence to `ui_state`** (survive reload) | Restore last-used Canvas on launch | LOW | Deferred to Story serialization milestone (v13.6) per handoff |
| **Accessibility audit of tab bar** (WAI-ARIA `role="tablist"` / `role="tab"` / `aria-selected`) | WCAG compliance | LOW | Deferred — needs real canvas content to validate with screen reader |
| **Widget composition** (widgets-within-widgets for Notebook) | Enables nested zone layouts | HIGH | Own milestone (v13.4); requires two-level Bound recursion semantics |
| **CloudKit sync of workbench layouts** | Cross-device layout persistence | HIGH | Deferred (v13.6); no sync model for Projection state yet |

---

## Anti-Features

Features that must explicitly not be built, with reasoning and the correct alternative.

| Anti-Feature | Why Not | What to Do Instead |
|--------------|---------|-------------------|
| **`style.display = ''` to show/hide slots** | Biome lint rule active; the pattern is banned codebase-wide since v6.1 | Use explicit `style.display = 'block'` or `data-*` attribute with CSS `[data-visible]` selector |
| **`:has()` as behavioral selector** in SuperWidget CSS | `data-attribute-over-has` pattern (v6.1); `:has()` is not reliable for behavioral queries cross-browser | Use `data-*` attributes on parent elements; `:has()` only for CSS progressive enhancement with comment |
| **`alert()` / `confirm()` in stubs** | AppDialog pattern (v6.1) prohibits these globally | Use `<dialog>` element or console.warn for validation errors (console-only per handoff design question 5) |
| **`<link>` tag for SuperWidget CSS** | Bundled CSS is the codebase convention; `<link>` creates load-order dependency | `import '../superwidget/SuperWidget.css'` at top of SuperWidget.ts |
| **Inline config panel as a separate sibling slot** | Would require fragile CSS merging between tabs slot and config-panel slot; resolved in design question 6 | Config gear is `data-tab-role="config"` child of tab bar; click displaces canvas (inline, not sibling slot) |
| **Overflow menu for tab bar overflow** | Hides available tabs ("no hidden state" principle from handoff design question 2) | Horizontal scroll + CSS `mask-image` edge fade |
| **`display: none` on status slot when empty** | Breaks the stable DOM contract for v13.1 Data Explorer Canvas (ingestion counts will target `data-slot="status"`) | `min-height: 0` with zero-height; element always in DOM |
| **Storing bound Explorer identity in Projection** | Projection type would grow unboundedly as Views multiply; Explorer pairing is a View concern not a Projection concern | `defaultExplorerId` field on Canvas registry entry; resolved at render time |
| **Per-tab event listeners** on tab bar buttons | Per-listener pattern costs 5000+ allocations at scale (v6.0 precedent with grid cells) | Event delegation: single listener on tabs slot container, dispatch by `dataset.tabId` |
| **DOM virtualization of canvas slots** | Slots are structural (4 fixed slots, not a list); virtualization is for row/column data lists | CSS Grid with `min-height: 0` handles slot presence without virtualization |
| **Real Explorer/View/Editor Canvas implementations in v13.0** | Scope discipline — stubs prove the substrate; real content lands in v13.1+ milestones | Three stub files with `// STUB — replaced in milestone v13.1+` header comment |
| **Zone layout shell (outer Workbench container)** | The outer shell determines how multiple SuperWidgets compose spatially — that is v13.5 scope | SuperWidget is self-contained; zone role is a configuration property, not a layout concern |
| **ViewZipper in v13.0** | ViewZipper requires a real View Canvas to be meaningful; stub View Canvas has no cycle to drive | Deferred to v13.2 (Real SuperGrid View Canvas) |
| **Framework dependencies** (React, Vue, Lit) | Project constraint: pure TypeScript + D3/DOM, zero framework runtime | TypeScript class with `mount(container)` / `destroy()` per established pattern |

---

## Feature Dependencies

```
WA-1 (Four-slot substrate CSS Grid DOM) 
  → WA-2 (Projection state machine: pure types + transition functions + validator)
  → WA-3 (Projection-driven rendering: commitProjection + slot-scoped re-render)
  → WA-4 (Canvas stubs: 3 stubs + Canvas registry with defaultExplorerId)
  → WA-5 (Cross-seam integration tests: 7-row matrix + Playwright WebKit smoke)

Projection type (WA-2) → Canvas registry CanvasRegistryEntry.canvasType (WA-4)
validateProjection (WA-2) → commitProjection validation gate (WA-3)
data-render-count on stubs (WA-4) → slot-isolation test assertions (WA-3, WA-5)
data-sidecar on ViewCanvasStub (WA-4) → Bound/Unbound integration test row (WA-5)
defaultExplorerId in registry (WA-4) → sidecar resolution path tested in WA-5
```

**Existing codebase dependencies this milestone must not break:**

- WorkbenchShell `getTopSlotEl()` / `getBottomSlotEl()` — SuperWidget mounts inside these; must not alter their height contracts
- PanelManager mount-once model — SuperWidget uses replace-on-switch for canvas; these are different patterns in different DOM regions
- DockNav `onActivateItem` callback — the trigger that eventually drives SuperWidget zone switching (wired in v13.5, not v13.0)
- CSS custom property namespaces `--sg-*` (SuperGrid), `--pv-*` (PivotTable) — SuperWidget should use `--sw-*` to avoid token collision

---

## MVP Scope for v13.0

Build exactly these, in this order, in WA sequence:

1. **Four-slot CSS Grid DOM** with `data-slot` attributes, config gear as tab child, status slot zero-height invariant, tab overflow scroll + edge fade
2. **Projection type + pure transition functions + validator** (no DOM coupling)
3. **`commitProjection` with validation gate + slot-scoped re-render**
4. **Three Canvas stubs + Canvas registry** (ExplorerCanvasStub, ViewCanvasStub with sidecar, EditorCanvasStub; `canvasRegistry` map with `defaultExplorerId`)
5. **Cross-seam integration tests** (7 matrix rows + Playwright WebKit smoke)

Defer everything in the Differentiators section. None of it is needed to unblock v13.1.

---

## Complexity Notes for Phase Planning

| Item | Complexity | Rationale |
|------|------------|-----------|
| CSS Grid four-slot layout | LOW | Standard CSS Grid with named areas; no dynamic layout |
| Tab overflow scroll + edge fade | LOW | `overflow-x: auto` + `mask-image` linear gradient; no JS needed |
| Config gear `grid-column: -1` | LOW | Single CSS property |
| Pure transition functions | LOW | Plain TypeScript; no DOM, no async |
| `validateProjection` | LOW | Simple predicate logic |
| `commitProjection` + slot re-render | MEDIUM | Requires scoped querySelector + lifecycle teardown for replaced canvas |
| Slot isolation verification | MEDIUM | `data-render-count` stub attribute must increment correctly; subtle if canvas teardown is incomplete |
| ViewCanvasStub sidecar + collapsible chevron | LOW | Single `data-sidecar` div with chevron toggle; no real content |
| Canvas registry type safety | LOW | TypeScript interface + Map |
| Integration test matrix | MEDIUM | 7 rows × DOM assertions; rapid-commit row requires careful ordering |
| Playwright WebKit smoke | MEDIUM | Existing CI setup; new test file targets `tests/superwidget/` |

---

## Sources

All findings are HIGH confidence — derived from:
- `162-00-HANDOFF.md` (handoff spec, authoritative for this milestone)
- `PROJECT.md` (codebase constraints, locked decisions D-001 through D-020)
- Existing component conventions: WorkbenchShell, DockNav, PanelManager, PanelTypes, CollapsibleSection
- Established codebase patterns: v6.0 event delegation, v6.1 data-attribute-over-has, v5.0 mount/destroy lifecycle, v8.0 PluginRegistry/FeatureCatalog
- Design decisions locked in HANDOFF: config-as-tab-child, horizontal scroll overflow, inline config panel, status-always-present, Bound=View-only

No WebSearch was available. Findings are based entirely on codebase context and first-principles analysis of the widget substrate domain. No external sources required — the handoff document has pre-resolved all design questions.
