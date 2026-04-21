# Phase 145 Handoff: SuperWidget Substrate

**Target path on commit:** `.planning/milestones/v13.0-superwidget-substrate/145-00-HANDOFF.md`

**Supersedes:** n/a (new milestone)
**Depends on:** v12.0 Explorer Panel Polish (phases 155–161 complete)
**Companion docs:** `Isometry SuperWidget.md` (v1 concept), Designer Workbench Taxonomy (Excel/image)

---

## Executive Summary

Implement the SuperWidget four-slot substrate and its projection-switching mechanics. **Scope is the container primitive and the projection state machine only.** Canvas content implementations (specific Explorers, Views, Editors) are out of scope for this milestone and will land in subsequent milestones against the substrate this milestone ships.

This is deliberately a narrow, foundational milestone. The substrate is the invariant that every subsequent SuperWidget work depends on; shipping it in isolation with tight test coverage is how we avoid churn later.

---

## Architectural Premise

SuperWidget is to workbench chrome what SuperGrid is to data visualization: an invariant substrate with lawful projections. The substrate is a four-slot structural primitive. A projection is the triple `(canvasType, canvasBinding, zoneRole)` that determines what fills the slots at any moment.

### Design Origin

The SuperWidget emerges from the Designer Workbench Taxonomy — a 4 × 10 × 32 hierarchy:

| Theme | Explorers | Views/Panels |
|---|---|---|
| **Integrate** | Data | Import/Export, Catalog/CAS/Utilities, Properties/Provenance/Versions, Extensions |
| **Visualize** | Grids, Timelines, Maps, Charts, Graphs | 19 views (7 grids, 2 timelines, 1 map, 2 charts, 2 graphs) |
| **Analyze** | Filters, Formulas | 5 filter types + 4 formula types |
| **Activate** | Stories, Notebooks | Templates, Stories, Card Editor, Console, Preview |

The simplification: instead of scattered navigation and explorer panels, everything collapses into **one widget type instantiated per zone**. Navigation becomes spatial (vertical zones) rather than modal (sidebar switching).

### Four Zones, One Widget

| Zone | Primary Content | Default Explorer | Tab Bar |
|---|---|---|---|
| **Integrate** | Data Explorer panels | Data | All content tabs + ⚙️ config |
| **Visualize** | View switcher + bound Explorer sidecar | Context-dependent (Projection for SuperGrid, Alpha for List, etc.) | All content tabs + ⚙️ config |
| **Analyze** | Filters + Formulas | Filters & Formulas | All content tabs + ⚙️ config |
| **Activate** | Notebooks + Stories | Stories & Notebooks | All content tabs + ⚙️ config |

This milestone ships:

1. The four-slot DOM/CSS substrate, styled and reusable.
2. The projection state machine that governs slot content.
3. A projection-switching mechanism with testable transitions.
4. Stub Canvas implementations sufficient to prove the substrate works across all three Canvas Types.
5. Cross-seam tests for projection transitions.

This milestone does **not** ship:

- Real Explorer, View, or Editor Canvas implementations (stubs only).
- Zone layout (the outer Workbench shell).
- Widget composition (widgets-within-widgets).
- ViewZipper (lands with the first real View Canvas).
- Story serialization.
- CloudKit sync of workbench layouts.

---

## Resolved Design Questions

These were surfaced during spec review and resolved before implementation.

| # | Question | Decision | Rationale |
|---|---|---|---|
| 1 | Naming | **SuperWidget** | Consistent with SuperGrid/SuperStack/SuperCalc naming convention |
| 2 | Tab bar overflow | **Horizontal scroll with edge fade** | "No hidden state" principle — overflow-menu hides available tabs |
| 3 | Config gear behavior | **Inline panel** (displaces canvas temporarily) | Consistent with PropertiesExplorer pattern; no modal interruption |
| 4 | Zone theme label source | **Lookup from `zoneRole`** | Widget is self-contained for testing; no parent dependency |
| 5 | Validation error surface | **Console-only** this milestone | UI surfacing requires real content; deferred to future milestone |
| 6 | Config slot model | **Config is a child of TabBarSlot**, not a peer slot | Config is visually a tab (locked far-right via `grid-column: -1`) but logically distinct (`data-tab-role="config"`). Avoids fragility of CSS-merging two sibling slots. `enabledTabIds` governs content tabs; config gear is always present and outside that array. |
| 7 | Bound/Unbound definition | **View-only canvas split** | Bound = canvas slot split vertically: Explorer sidecar above, View below. Sidecar is collapsible but not removable while bound. Unbound = single surface. Explorer and Editor canvas types are always Unbound (validator rejects Bound on non-View). The bound Explorer is determined by the View's Canvas registry entry, not by user selection. |
| 8 | Status slot | **Always present**, zero-height when empty | Costs nothing structurally. Avoids substrate change if future zones need status. Exploratory territory — build it in to see where it leads. |

---

## Work Areas

Five work areas, gated and sequenced. Each begins with a red-first test.

### WA-1: Four-Slot Substrate

**Pre-conditions:**
- v12.0 Explorer Panel Polish complete (phases 155–161 green).
- Biome lint rule for explicit `style.display` values active.

**Deliverables:**

1. `src/superwidget/SuperWidget.ts` — the substrate component.
2. `src/superwidget/SuperWidget.css` — bundled, not `<link>`-loaded.
3. Four named slots exposed as TypeScript types:

```typescript
export interface SuperWidgetSlots {
  header: HeaderSlot;      // zone theme, collapse chevron, toolbar
  canvas: CanvasSlot;      // the primary working surface
  status: StatusSlot;      // always present, zero-height when empty
  tabs:   TabBarSlot;      // content tabs + config gear (data-tab-role="config")
}
```

4. Layout via CSS Grid (not flex). The invariant substrate deserves the invariant layout engine.
5. Config gear as a distinguished child of the tab bar:
   - `data-tab-role="config"` attribute for logical distinction.
   - `grid-column: -1` positions it locked to far-right.
   - Always visible, not governed by `enabledTabIds`.
   - Click opens inline config panel (displacing canvas temporarily).
6. Tab bar overflow: horizontal scroll with CSS edge fade (mask-image gradient) when tabs exceed container width.

**Red-first gate:** Write `SuperWidget.substrate.test.ts` asserting that a rendered SuperWidget has exactly four slot elements with the correct `data-slot` attributes, and that the config gear exists within the tabs slot with `data-tab-role="config"`. Test must fail before implementation.

**Success criteria (grep-able):**
- `grep -r "data-slot=\"header\"" src/superwidget` — one primary match in component, multiple in tests.
- `grep -r "data-slot=\"canvas\"" src/superwidget` — same pattern.
- `grep -r "data-slot=\"status\"" src/superwidget` — same.
- `grep -r "data-slot=\"tabs\"" src/superwidget` — same.
- `grep -rn "data-tab-role=\"config\"" src/superwidget` — present in component and tests.
- `grep -rn "display: grid" src/superwidget/SuperWidget.css` — at least one match on the root container.
- `grep -rn "grid-column.*-1" src/superwidget/SuperWidget.css` — config gear positioning.
- `grep -rn "style\.display = ''" src/superwidget` — zero matches.
- `grep -rn ":has(" src/superwidget` — zero matches.
- `grep -rn "<link" src/superwidget` — zero matches (CSS must be bundled).

**Regression guards:**
- All four slots render even when empty (empty slots occupy zero height but exist in the DOM).
- Slot order is fixed: header, canvas, status, tabs (with config-within-tabs).
- The config gear is locked to far-right of the tab bar via CSS Grid column assignment, not absolute positioning.
- Status slot is always present in the DOM; zero-height when empty via `min-height: 0` (not `display: none`).

**Out of scope for WA-1:**

| Out-of-scope item | Lands in |
|---|---|
| Slot content rendering | WA-2 (projection state) |
| Tab interaction behavior | WA-3 (projection switching) |
| Canvas type variations | WA-4 (canvas stubs) |
| Cross-widget composition | Future milestone |

---

### WA-2: Projection State Machine

**Pre-conditions:**
- WA-1 green.

**Deliverables:**

1. `src/superwidget/projection.ts` — pure functions, no DOM.
2. The `Projection` type:

```typescript
export type CanvasType = 'Explorer' | 'View' | 'Editor';
export type CanvasBinding = 'Bound' | 'Unbound';
export type ZoneRole = 'Integrate' | 'Visualize' | 'Analyze' | 'Activate';

export interface Projection {
  canvasType: CanvasType;
  canvasBinding: CanvasBinding;
  zoneRole: ZoneRole;
  canvasId: string;          // which specific Explorer/View/Editor
  activeTabId: string | null;
  enabledTabIds: string[];
}
```

3. Binding semantics encoded in the type system:
   - `canvasBinding: 'Bound'` is valid **only** when `canvasType === 'View'`.
   - When Bound, the canvas slot splits vertically: Explorer sidecar above, View below.
   - The bound Explorer is **not** specified in the Projection — it is resolved at render time from the Canvas registry (the View declares its default Explorer pairing).
   - The sidecar is collapsible but not removable while the View is Bound.
   - Explorer and Editor canvas types are always Unbound.

4. Pure transition functions:
   - `switchTab(projection, tabId): Projection`
   - `setCanvas(projection, canvasId, canvasType): Projection`
   - `setBinding(projection, binding): Projection`
   - `toggleTabEnabled(projection, tabId): Projection`

5. A validator: `validateProjection(p): ValidationResult`. Invalid projections are caught before render. Validation rules include:
   - `activeTabId` must be in `enabledTabIds` (or null).
   - `canvasBinding: 'Bound'` rejected when `canvasType !== 'View'`.
   - `canvasId` must be a non-empty string.
   - `enabledTabIds` must be a non-empty array.

**Red-first gate:** Write `projection.test.ts` with table-driven cases for each transition function, including invalid inputs. Tests must fail before implementation.

**Success criteria (grep-able):**
- `grep -rn "export function switchTab" src/superwidget/projection.ts` — one match.
- `grep -rn "export function setCanvas" src/superwidget/projection.ts` — one match.
- `grep -rn "export function setBinding" src/superwidget/projection.ts` — one match.
- `grep -rn "export function toggleTabEnabled" src/superwidget/projection.ts` — one match.
- `grep -rn "export function validateProjection" src/superwidget/projection.ts` — one match.
- `grep -c "test\|it(" tests/superwidget/projection.test.ts` — at least 20 (table-driven coverage).

**Regression guards:**
- Transition functions are **pure**: same input, same output, no side effects. Enforced by the test suite asserting identical outputs across repeated calls.
- `validateProjection` returns `{valid: true}` or `{valid: false, reason: string}`. Never throws.
- Invalid projections never reach the DOM (see WA-3 for integration).
- `switchTab` on an invalid tabId returns the **original reference** (not a new object with same values). Reference equality is the contract.
- `setBinding('Bound')` on a non-View canvas returns the original projection unchanged.

**Anti-patching rule (explicit):** If a test asserts that `switchTab` on an invalid tabId returns the original projection unchanged, and the implementation returns a new object reference, fix the implementation to return the original reference. Do not weaken the assertion to `toEqual`. Reference equality is the contract.

**Out of scope for WA-2:**

| Out-of-scope item | Lands in |
|---|---|
| DOM integration of projection | WA-3 |
| Persistence / serialization | Future milestone (Story serialization) |
| Undo/redo of projection changes | Future milestone |
| Bound Explorer identity resolution | WA-4 (Canvas registry) |

---

### WA-3: Projection-Driven Rendering

**Pre-conditions:**
- WA-1 and WA-2 green.

**Deliverables:**

1. `SuperWidget` accepts a `projection: Projection` prop.
2. Projection changes trigger re-render of the affected slots only.
3. Slot re-render is **slot-scoped**: changing `activeTabId` re-renders the canvas slot but not the header, status, or tabs slots (the tabs slot updates its "active" visual state without re-rendering its children).
4. Projection changes are committed via a single `commitProjection(newProjection)` entry point. Validation runs here; invalid projections are rejected with a console warning and no DOM change.

**Red-first gate:** Write `SuperWidget.projection.test.ts` asserting:
- Initial projection renders the correct canvas stub.
- `commitProjection` with a valid new projection re-renders the canvas slot.
- `commitProjection` with an invalid projection leaves the DOM unchanged.
- Re-renders do not leak state from the prior canvas (stub canvases expose a `data-render-count` attribute; switching canvas type must reset it to 1, not increment).

Tests must fail before implementation.

**Success criteria (grep-able):**
- `grep -rn "commitProjection" src/superwidget/SuperWidget.ts` — one exported function or method.
- `grep -rn "data-render-count" src/superwidget` — present in stubs (WA-4) and referenced in tests.

**Regression guards:**
- Slot isolation: `grep -rn "querySelector.*data-slot" src/superwidget/SuperWidget.ts` — slot re-renders scope queries to their slot only.
- No full-widget re-render on tab switch (verified by render-count assertions in tests).

**Anti-patching rule (explicit):** If the slot isolation test fails because a tab switch is causing a header re-render, identify and fix the offending re-render path. Do not relax the test to allow incidental re-renders.

**Out of scope for WA-3:**

| Out-of-scope item | Lands in |
|---|---|
| Real canvas content | WA-4 (still stubs) |
| Animated transitions | Future milestone |
| Keyboard navigation between tabs | Future milestone |

---

### WA-4: Canvas Type Stubs

**Pre-conditions:**
- WA-1, WA-2, WA-3 green.

**Deliverables:**

Three stub Canvas implementations — one per Canvas Type — sufficient to prove the substrate accepts all three. These are not real implementations; they exist to validate the projection-to-rendering path across all variants.

1. `src/superwidget/canvas/ExplorerCanvasStub.ts`
   - Renders a `<div data-canvas-type="Explorer">` with the `canvasId` as text.
   - Exposes `data-render-count` incrementing on each mount.
   - Unbound only.

2. `src/superwidget/canvas/ViewCanvasStub.ts`
   - Renders a `<div data-canvas-type="View">` with the `canvasId` as text.
   - Supports both Bound and Unbound variants.
   - When Bound: renders a sidecar stub element (`data-sidecar="true"`) above the view content, representing the Explorer pairing. The sidecar is collapsible via a chevron toggle.
   - The bound Explorer identity is resolved from the Canvas registry entry for this View (not from the Projection).

3. `src/superwidget/canvas/EditorCanvasStub.ts`
   - Renders a `<div data-canvas-type="Editor">` with the `canvasId` as text.
   - Unbound only.

4. A Canvas registry — `src/superwidget/canvas/registry.ts` — maps `canvasId` strings to Canvas components. The registry is the seam at which real Canvases plug in during future milestones. Registry entries for View canvases include a `defaultExplorerId` field declaring the bound Explorer pairing:

```typescript
export interface CanvasRegistryEntry {
  canvasType: CanvasType;
  component: CanvasComponent;
  defaultExplorerId?: string;  // View canvases only — the Explorer shown when Bound
}
```

**Red-first gate:** Write `CanvasStubs.test.ts` asserting each stub renders with correct `data-canvas-type`, correct `canvasId` text, correct binding behavior, and that the View stub's Bound mode renders a sidecar element. Tests must fail before implementation.

**Success criteria (grep-able):**
- `grep -rn "data-canvas-type=\"Explorer\"" src/superwidget/canvas` — one match in stub, referenced in tests.
- `grep -rn "data-canvas-type=\"View\"" src/superwidget/canvas` — same.
- `grep -rn "data-canvas-type=\"Editor\"" src/superwidget/canvas` — same.
- `grep -rn "data-sidecar" src/superwidget/canvas` — present in ViewCanvasStub.
- `grep -rn "defaultExplorerId" src/superwidget/canvas/registry.ts` — present in type and at least one entry.
- `grep -rn "export const canvasRegistry" src/superwidget/canvas/registry.ts` — one match.

**Regression guards:**
- Stubs are labeled as stubs in filename and in a top-of-file comment: `// STUB — replaced by real canvas in milestone v13.1+`.
- The registry's type signature prevents registering an object that isn't a Canvas component.
- View stubs with `defaultExplorerId` in the registry render the sidecar when Bound; stubs without it render Unbound regardless of `canvasBinding`.

**Out of scope for WA-4:**

| Out-of-scope item | Lands in |
|---|---|
| Real Data Explorer Canvas | v13.1 |
| Real SuperGrid View Canvas | v13.2 |
| Real Card Editor Canvas | v13.3 |
| Bound Explorer sidecar real content | v13.1+ (when real Explorers land) |

---

### WA-5: Cross-Seam Integration Tests

**Pre-conditions:**
- WA-1 through WA-4 green.

**Deliverables:**

Cross-seam integration tests for projection transitions. These are distinct from the unit tests in WA-2 and WA-3; they exercise the full path from projection commit to rendered DOM across all three Canvas Types and both binding variants.

1. `tests/superwidget/SuperWidget.integration.test.ts`.

2. Minimum test matrix:

| Starting Projection | Transition | Expected Result |
|---|---|---|
| Explorer/Unbound/Integrate | switchTab to new Explorer tab | Canvas slot re-renders with new `canvasId`, other slots stable |
| Explorer/Unbound/Integrate | setCanvas to View/Bound/Visualize | Canvas slot re-renders as View with sidecar; header zone theme updates |
| View/Bound/Visualize | setBinding to Unbound | Sidecar disappears; canvas remains |
| View/Bound/Visualize | setCanvas to Editor/Unbound/Activate | Canvas re-renders as Editor; zone theme updates |
| Editor/Unbound/Activate | commit invalid projection (Bound on Editor) | No DOM change; warning logged |
| Any | switchTab to disabled tabId | No DOM change; original projection reference preserved |
| Explorer/Unbound/Integrate | rapid commit of 10 projections | Final DOM state matches 10th projection only; no intermediate leak |

3. Assertions use jsdom for DOM verification; Vitest for state assertions. Playwright WebKit smoke test for the full integration matrix runs in CI.

**Red-first gate:** Write the test file with all matrix rows as pending tests. Fill in one, confirm it fails against the WA-4 state, then implement whatever wiring is needed. Repeat for each row.

**Success criteria (grep-able):**
- `grep -c "test\|it(" tests/superwidget/SuperWidget.integration.test.ts` — at least 7 (one per matrix row).
- Playwright WebKit smoke passes on CI.

**Regression guards:**
- No test in the matrix uses mocks for the projection state machine or the Canvas registry. The whole point of cross-seam tests is that they exercise the real seam.
- The rapid-commit test asserts final state only; it does not rely on internal render counts, which would be implementation-coupled.

**Anti-patching rule (explicit):** If an integration test fails because a Canvas stub's `data-render-count` is wrong, stop and explain the root cause before changing anything. Common failure modes to investigate: (a) slot re-render leaking state, (b) registry returning stale Canvas reference, (c) projection equality check too loose. Do not change the test's `data-render-count` expectation to match observed behavior.

**Out of scope for WA-5:**

| Out-of-scope item | Lands in |
|---|---|
| Performance benchmarks | Future milestone (v6.0 Performance was the precedent; SuperWidget perf lands after real Canvases) |
| Accessibility audit | Future milestone (needs real content) |
| Visual regression tests | Future milestone |

---

## Permanent Regression Guards

All work areas must maintain these:

1. **No `style.display = ''` anywhere in `src/superwidget/`.** Use explicit values or `data-*` state attributes. Biome lint rule enforces this.
2. **No orphan CSS `<link>` tags.** SuperWidget CSS is bundled.
3. **No `:has()` behavioral selectors.** Use `data-*` attributes for behavioral queries. Visual-only `:has()` may be acceptable but must be flagged in a comment (per data-attribute-over-has pattern from v6.1).
4. **No `alert` or `confirm`.** Use `<dialog>` for any modal interaction (per AppDialog pattern from v6.1).

Grep checks before merge:

- `grep -rn "style\.display = ''" src/superwidget` → must be zero.
- `grep -rn "<link" src/superwidget` → must be zero.
- `grep -rn ":has(" src/superwidget/*.css` → must be zero or comment-justified.
- `grep -rn "alert(\|confirm(" src/superwidget` → must be zero.

---

## Success Definition for Milestone v13.0

The milestone is complete when **all** of the following hold:

1. All five work areas green (unit + integration tests).
2. All grep-based success criteria pass.
3. All permanent regression guards green in `src/superwidget/`.
4. Playwright WebKit smoke tests pass for the integration test matrix.
5. No Canvas stubs have been replaced with real implementations (scope discipline).
6. `src/superwidget/README.md` documents: the four slots, the Projection type, the commit entry point, the Canvas registry with `defaultExplorerId`, and the stub-to-real replacement process for future milestones.

---

## What This Unblocks

Subsequent milestones land Canvas implementations one at a time against a stable substrate:

- **v13.1:** Real Data Explorer Canvas (Integrate zone default) + real Projection Explorer sidecar.
- **v13.2:** Real SuperGrid View Canvas + ViewZipper (Visualize zone default).
- **v13.3:** Real Card Editor Canvas (Activate zone building block).
- **v13.4:** Widget composition (widgets-within-widgets for Notebook case).
- **v13.5:** Zone layout shell (the Workbench outer container).
- **v13.6:** Story serialization (layouts as persisted nodes).

Each of these is its own handoff, scoped narrowly, against the substrate this milestone ships.

---

## Decision Log

| Decision | Choice | Rationale |
|---|---|---|
| Substrate first, Canvas content later | Yes | Invariant must land before variants; prevents churn |
| CSS Grid for substrate layout | Yes | The invariant substrate deserves the invariant layout engine (matches SuperGrid's use of CSS Grid) |
| Pure transition functions in projection.ts | Yes | Testability; no DOM coupling at the state-machine level |
| Three Canvas Types (Explorer/View/Editor) | Three | Corresponds to configure/see/edit verbs on Cards |
| Canvas registry as the plug-in seam | Yes | Future milestones replace stubs without touching substrate |
| Four slots (not five) | Config is a tab child | Config gear is visually a tab, logically distinct — sibling slot would require fragile CSS merging |
| Bound = View-only canvas split | View declares its Explorer pairing | Keeps Projection type clean; binding semantics enforced by validator + registry |
| Status slot always present | Zero-height when empty | Exploratory — costs nothing, avoids substrate change if future zones need it |
| No composition in this milestone | Deferred | Composition requires two-level bound recursion semantics; better as own milestone |
| No ViewZipper in this milestone | Deferred | ViewZipper requires real View Canvas to be meaningful |
| Horizontal scroll for tab overflow | Edge fade mask-image | "No hidden state" — overflow-menu hides available tabs |
| Inline panel for config gear | Displaces canvas temporarily | Consistent with PropertiesExplorer pattern; no modal interruption |
| Zone theme via lookup | Widget self-contained | Renders correctly in isolation for tests without parent dependency |

---

*Authored: 2026-04-21*
*Phase numbering: continues from v10.2 Phase 144*
*Milestone versioning: v13.0 (follows v12.0 Explorer Panel Polish)*
