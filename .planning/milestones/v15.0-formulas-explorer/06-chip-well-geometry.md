# Geometry Contract: `ChipWell`

*Status: Draft*
*Owner: Michael*
*Last updated: 2026-04-27*
*Related: `time-explorer-geometry.md` (cousin — contrast: Time Explorer IS PAFV-bound; chip wells are NOT), `01-three-explorer-spec.md` (consumer — defines per-explorer chip well categories)*

> **What this document is.** A specification of the *function* that produces the chip-well control surface's spatial arrangement — not a description of any one explorer's use of it. If this document is doing its job, a redesign of visual chrome should not invalidate it; only a change to drag semantics, reflow rules, or composition seams should.
>
> **What this document is not.** A screenshot in words. A component spec. A style guide. A Formulas-Explorer-specific document. Those live elsewhere (primitive contracts, `design-tokens.css`, Figma reference stills, `01-three-explorer-spec.md`).

---

## 1. Intent

The chip well is a layout primitive for typed configuration. It hosts draggable chip tokens organized into typed categories. Its geometry contract specifies spatial behavior — coordinate system, drag affordances, drop-zone semantics, reflow rules — independent of which explorer uses it or what the chips mean. Any explorer that needs a chip-well surface (Projections, Formulas, Marks, Audits, or future explorers) implements against this contract, not against an explorer-specific variant.

The chip well is not a data view. It is not PAFV-bound. It does not project data onto spatial planes or answer questions about temporal, categorical, or hierarchical membership. It produces typed configuration consumed by view explorers downstream; views own PAFV binding. This contract is therefore a geometry contract for a *control surface*, not for a *projection surface* — a meaningful distinction that §3 makes explicit.

---

## 2. Coordinate system

### Authority

The well container element owns layout. Chips are subordinate — they flow within the boundaries the container establishes and have no coordinate authority of their own.

### Units

The atomic unit is the **chip token**: variable width (content-sized label plus horizontal padding), fixed height 24px at `--size-card-mini`.

Token dimensions:
- **Chip vertical padding:** 2px (`chip-v-pad` — named codebase structural value from `.latch-explorers__chip`, `padding: 2px var(--space-sm)`; deliberately sub-token to keep compact chips visually tight while the well provides vertical rhythm via section padding)
- **Chip horizontal padding:** `--space-sm` (8px) each side
- **Chip-to-chip gap within a well row:** `--space-xs` (4px)
- **Well internal vertical padding (top and bottom):** `--space-md` (12px)
- **Between-well vertical gap (stacked wells in panel):** `--space-lg` (16px)
- **Panel section break above/below chip-well region:** `--space-xl` (24px)

Well header typography: `--text-xs` (10px), 600 weight, uppercase, 0.5px letter-spacing, `--space-sm` bottom margin.

Chip label typography: `--text-xs` (10px), 400 weight, line-height 1.4.

### Origin and axes

Top-left CSS coordinate convention. Positive-x is rightward; positive-y is downward.

**Inline axis (x):** Chips flow left-to-right within a well row. When horizontal space is exhausted, chips wrap to a new row within the same well. No horizontal scrolling — wrapping is the overflow strategy within a well.

**Block axis (y):** Wells stack top-to-bottom within the explorer panel. Each well occupies its full natural height (which grows with chip overflow rows). When wrapped chip content exceeds the panel height, the panel scrolls vertically.

---

## 3. PAFV binding

**N/A — operator surface.** Chip wells are not PAFV-bound. They produce typed configuration consumed by view explorers; views own PAFV binding. This section is intentionally marked N/A rather than left empty — the absence of PAFV binding is a deliberate architectural boundary, not an oversight. (FE-RG-13)

---

## 4. Data binding

### Input contract

An ordered list of chips per well. Each chip carries:
- A **type signature** — what kind of operator this chip represents (e.g., expression, predicate, ordering directive, class assignment, flag rule)
- A **DSL fragment** — the serialized form of the chip's operator

The list order is user-controlled and semantically meaningful. Order conveys priority or dependency depending on the well's semantic context (e.g., sort priority for ordering chips, dependency order for expression chips). The chip well does not reorder chips; that is always a user action.

### Output contract

Same shape as the input, mutated by user action (reorder, add, remove). Published via `ChipWellOutputContract` (named interface only — Phase 184 owns the concrete implementation). The output is the current chip list at any moment; it is read-only from the perspective of the compilation pipeline.

### Cardinality expectations

| Regime | Chip count | Rendering strategy |
|--------|------------|--------------------|
| Empty | 0 | Empty state (see §7) |
| Sparse | 1–5 | Single well, typical single configuration pass |
| Typical | 5–20 | Multi-category active configuration; wrapping expected |
| Dense | 20+ | Heavy configuration; multiple wrap rows; panel scrolls vertically |

No virtualization needed — chip wells are control surfaces with bounded cardinality. The practical limit is screen real estate, not an artificial number (D-05).

### Aggregate handling

Not applicable. Chip wells are control surfaces; they have no aggregate output and do not display computed values. Aggregates are produced downstream by the compilation pipeline (Phase 184).

---

## 5. Invariants

- **Chip order within a well is user-controlled and semantically meaningful.** The system never silently reorders chips.
- **Chips never silently change category.** A chip only moves between wells as an explicit user drag (copy or move). No background reclassification occurs.
- **Drop-zone hit testing is deterministic.** Given the same pointer position and well layout, the same drop target is identified. There are no ambiguous hit regions.
- **Cross-well drag copies by default.** A chip dragged from one well to another is copied; the modifier key (platform-standard: Alt/Option) triggers a move instead. A drop is never rejected if the type signatures are compatible. (STATE.md locked decision)
- **A chip's visual representation is independent of which explorer hosts the well.** The geometry contract is generic (FE-RG-14). Per-explorer chip styling is implementation detail, not geometry.
- **Empty wells are valid and render an empty state.** They do not collapse, hide, or disappear when all chips are removed. The well container is always present.

---

## 6. Degenerate and edge cases

| Case | Expected behavior |
|------|-------------------|
| Empty well (0 chips) | Empty state: heading "Drop chips here", body "Drag a chip from another well or the Formula Card library to add it." (exact copy per §7 and UI-SPEC Copywriting Contract) |
| Single chip | Well renders normally with one chip token; no special layout adjustments |
| Many chips (overflow) | Chips wrap to additional rows within the well; no hard chip limit (D-05); if wrapped content exceeds panel height, panel scrolls vertically |
| Type-incompatible drop | Well enters drag-target-invalid state (§7); chip returns to source on pointerup; live-region announces: "[chip label] cannot be dropped here. Returned to [source well name]." |
| Drag abort mid-flight | Chip returns to original position; no persistent visual change (D-07); no animation timing specification (D-02) |
| Cross-explorer drag | Same rules as cross-well drag: copy by default, modifier for move, never reject if type signatures match |
| Touch drag abort (finger lift outside any well) | Same as pointer abort — chip returns to origin |
| Well with long chip labels | Chip width grows with content up to a max-width constraint (implementation-defined); overflowing text truncates with ellipsis |

---

## 7. States

All 6 states use semantic descriptions of visual intent and pointer event behavior. No CSS properties or animation timing (D-01, D-02). Token names are from `design-tokens.css`.

### State definitions

**1. default**
Chip: `--bg-surface` background, `--border-subtle` border, `--text-primary` label. Well: neutral background. All pointer events active.

**2. drag-source-active**
Chip being dragged: reduced opacity (0.6), `--bg-surface` background. Source well: `--border-muted` border. The drag chip follows the pointer. Other wells evaluate drop compatibility as the pointer moves over them.

**3. drag-target-valid**
Target well (where pointer is over, type-compatible): `--accent-bg` background fill, `--accent-border` border, `--accent` label on well header. A drop indicator shows the insertion point. `pointerup` commits the drop.

**4. drag-target-invalid**
Target well (where pointer is over, type-incompatible): `--danger-bg` background fill, `--danger-border` border. `pointerup` rejects the drop. Live-region announces rejection.

**5. drop-rejected**
Chip snaps back to origin. No persistent visual change. Brief `--danger` border flash on the chip (end-state only — no timing specification per D-02). Live-region announces: "[chip label] cannot be dropped here. Returned to [source well name]."

**6. promotion-prompt**
`<dialog>` overlay appears with:
- Heading: "Save as Formula" (`aria-labelledby` pointing to heading)
- Body: "Create a reusable Formula Card from this chip arrangement."
- Primary CTA: "Save Formula"
- Cancel: "Cancel"

Chip in well shows `--accent-border` ring. Rest of panel dims via `--overlay-bg`.

### State machine

```mermaid
stateDiagram-v2
    [*] --> default
    default --> drag-source-active: pointerdown on chip (mouse) or long-press 500ms (touch)
    drag-source-active --> drag-target-valid: pointermove over compatible well
    drag-source-active --> drag-target-invalid: pointermove over incompatible well
    drag-source-active --> default: pointerup outside any well (abort) or Escape
    drag-target-valid --> default: pointerup (commit drop)
    drag-target-invalid --> drop-rejected: pointerup (reject)
    drop-rejected --> default: chip returns to origin
    default --> promotion-prompt: user triggers "Save as Formula"
    promotion-prompt --> default: dialog confirm or cancel
```

### Reflow rules

Chip wells are embedded within explorer panels. The panel width determines chip wrapping. No breakpoint-specific behavior — the wrapping model handles all widths. Wells do not collapse or reflow into a different arrangement at narrow widths.

### Empty state

Well container renders with `--bg-surface` background, centered text block:
- Heading: "Drop chips here" (`--text-sm`, 600 weight)
- Body: "Drag a chip from another well or the Formula Card library to add it." (`--text-sm`, 400 weight)

---

## 8. Interaction contracts

### Pointer-event drag (mouse)

The chip well uses pointer events exclusively. No HTML5 Drag and Drop API (`draggable`, `dragstart`, `drop`) — hard constraint from WKWebView (UXIN-06, D-06).

| Gesture | Target | Effect | Entry condition | Commit/abort |
|---------|--------|--------|-----------------|--------------|
| `pointerdown` + `pointermove` | chip token | Enter drag-source-active; chip follows pointer | Chip exists in well; pointer is mouse type | `pointerup` on valid well = commit (copy or move per modifier key); `pointerup` outside all wells = abort; Escape = abort |
| `pointermove` during drag | well container | Well evaluates: drag-target-valid or drag-target-invalid based on type signature compatibility | Drag in progress | — (evaluation only, no commit) |
| `pointerup` on valid well | well drop zone | Chip added to target well at insertion point; copy by default, move with modifier key (Alt/Option) | drag-target-valid state active | Commit |
| `pointerup` on invalid well | well drop zone | drop-rejected state; chip returns to source | drag-target-invalid state active | Abort |
| `pointerup` outside any well | canvas | Drag aborted; chip returns to original position | Drag in progress | Abort |

### Touch/iPad drag

Touch drag follows the same pointer-event path. Differentiated by entry condition (touch vs. mouse input type) and by the long-press grab initiation.

| Gesture | Target | Effect | Entry condition | Commit/abort |
|---------|--------|--------|-----------------|--------------|
| Long-press (500ms `pointerdown` hold) + `pointermove` | chip token | Enter drag-source-active; chip follows finger | Chip exists in well; pointer is touch type; 44px minimum touch target (WCAG 2.5.5) | Same commit/abort rules as mouse drag |
| `pointermove` during drag | well container | Same evaluation as mouse drag | Touch drag in progress | — |
| `pointerup` (finger lift) on valid well | well drop zone | Same as mouse commit | drag-target-valid state active | Commit |
| `pointerup` (finger lift) outside any well | canvas | Drag aborted; chip returns to origin | Touch drag in progress | Abort |

### Keyboard contract

Keyboard access is mandatory for WCAG 2.1 AA (D-03, D-04). The grab mode pattern is the standard ARIA Practices approach for keyboard drag-and-drop.

| Key | Context | Effect |
|-----|---------|--------|
| Tab | Explorer panel | Move focus to next chip in reading order (left-to-right, well-by-well) |
| Shift+Tab | Explorer panel | Move focus to previous chip |
| Arrow Right / Left | Chip focused (normal mode) | Move focus to next/previous chip within same well |
| Arrow Down / Up | Chip focused (normal mode) | Move focus to chip in next/previous well (nearest by column position) |
| Enter or Space | Chip focused (normal mode) | Enter grab mode; live-region announces: "Grabbed [chip label]. Use arrow keys to reorder, Enter to drop, Escape to cancel." |
| Arrow Right / Left | Grab mode | Reorder chip within well; live-region announces: "Moved [chip label] to position [N] of [total] in [well category name]." |
| Enter | Grab mode | Drop chip at current position; live-region announces: "[chip label] added to [well category name]." |
| Escape | Grab mode | Abort — chip returns to original position |
| Delete or Backspace | Chip focused (normal mode) | Remove chip from well (with live-region announcement) |

Keyboard focus ring: `outline: 2px solid var(--accent); outline-offset: -2px` (established codebase pattern, source: `latch-explorers.css`).

Keyboard grab mode instruction (tooltip/`aria-description` on each chip): "Press Enter or Space to grab. Arrow keys to reorder. Enter to drop. Escape to cancel."

### ARIA contract

| Element | ARIA role | Key attributes |
|---------|-----------|----------------|
| Well container | `role="listbox"` | `aria-label="[well category name] chips"`, `aria-multiselectable="false"` |
| Chip token | `role="option"` | `aria-posinset="[N]"`, `aria-setsize="[total]"` |
| Promotion-prompt dialog | `<dialog>` element | `aria-labelledby` pointing to heading |
| Drag operation live region | `role="status"` | `aria-live="polite"`, `aria-atomic="true"` |
| Well in drag-target-valid state | well container | `aria-dropeffect="copy"` or `"move"` per drag mode |
| Chip being dragged | chip element | `aria-grabbed="true"` |

Note: `aria-grabbed` is deprecated in ARIA 1.1 but retained here for WKWebView/VoiceOver compatibility. Implementers should note this deprecation and monitor for removal in future ARIA specs.

Type-mismatch well tooltip: "This well does not accept [chip type] chips."

---

## 9. Composition

Chip wells are embedded within explorer panels as a control surface. They compose with the broader application at exactly two named seams. Per D-08: named interfaces with responsibilities; no TypeScript signatures.

### Seam 1 — Compilation pipeline

- **Interface name:** `ChipWellOutputContract`
- **Publishes:** Ordered list of chip DSL fragments per well category, with type signatures for each chip
- **Consumes:** Nothing (read-only — the compilation pipeline reads chip well state; it does not write to it)
- **Owner:** Phase 184 (WA-2) owns the concrete implementation
- **Direction:** Chip well is upstream (data source); compilation pipeline is downstream (consumer)

### Seam 2 — Formula Card library

- **Interface name:** `FormulaCardDragSourceContract`
- **Publishes:** A chip token (DSL fragment + type signature) that can be dropped into a well
- **Consumes:** Nothing (drag source only — the Formula Card library initiates drag; the chip well receives it)
- **Owner:** Phase 185 (WA-3) owns the concrete implementation
- **Direction:** Formula Card library is upstream (drag source); chip well is downstream (drop target)

These interface names are load-bearing references. Phases 184 and 185 own the concrete implementations. No TypeScript signatures appear in this document.

### Additional coordination concerns

**Explorer panels:** Chip wells are embedded within explorer panels. The panel provides the container; the chip well owns its internal layout. Panel registration (PanelMeta pattern) is an implementation concern, not a geometry concern.

**Cross-well drag:** Governed by the copy-by-default invariant (§5). When a chip is dragged between wells (within the same explorer or across explorers), the geometry contract governs the spatial behavior; the receiving explorer's type-validation rules (defined in `01-three-explorer-spec.md`, not here) govern acceptance.

---

## 10. Out of scope

- **Visual styling:** theme tokens, specific colors/gradients, corner radii, shadow treatments — see `design-tokens.css` and active theme
- **DSL grammar:** token-level syntax, parser, AST — see dedicated DSL design milestone
- **Compiled SQL:** the output of the compilation pipeline — see Phase 184 (WA-2)
- **Per-explorer chip-type-validity rules:** which chip types each explorer's wells accept — see `01-three-explorer-spec.md` (WA-1) and per-explorer implementation specs
- **Component-level props and internal state:** implementation concerns, not geometry
- **Marks output geometry:** how Marks class assignments interact with card geometry — deferred to `marks-output-geometry.md` in Marks implementation milestone
- **Audit overlay geometry:** where audit flags appear in card geometry — deferred to `audit-overlay-geometry.md` in Audits implementation milestone
- **Animation timing and easing curves:** per D-02, this contract specifies end-states only; animation timing is implementation chrome
- **Persistence of chip arrangements across sessions:** see state persistence spec

---

## 11. Open questions

- [ ] Cross-explorer drag semantics: when a chip is dragged from one explorer's well to a different explorer's well, does the type-validation logic live in the source explorer, the target explorer, or a shared validation layer? — owner: Michael, target: before chip-well UI implementation
- [ ] Multi-select gestures: should shift-click select a range of chips for bulk drag/reorder/delete? If so, what are the ARIA implications? — owner: Michael, target: before chip-well UI implementation
- [ ] Maximum chip label width before truncation: content-sized vs. fixed max-width constraint? — owner: Michael, target: before chip-well UI implementation

---

## 12. Reference

### Visual calibration

No Figma stills available yet. When created, link canonical states: typical chip well with 3-5 chips, empty well, overflow/wrapped well, drag-in-progress.

### Related contracts

- `time-explorer-geometry.md` — relationship: cousin (contrasts — Time Explorer is PAFV-bound; chip wells are not)
- Future per-explorer contracts — relationship: consumers (each explorer's implementation spec will reference this geometry contract for chip-well spatial behavior)

### Changelog

| Date | Change | Rationale |
|------|--------|-----------|
| 2026-04-27 | Initial draft from WA-6 | Phase 183 — chip-well geometry contract |
