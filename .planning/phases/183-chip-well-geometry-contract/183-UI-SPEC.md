---
phase: 183
slug: chip-well-geometry-contract
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-27
---

# Phase 183 — UI Design Contract: Chip-Well Geometry Contract

> Visual and interaction contract for Phase 183. This phase produces a specification
> document (`06-chip-well-geometry.md`), not UI code. The UI-SPEC defines what visual
> and interaction contracts that document must capture — i.e., the design contract FOR
> a design contract. Executor and planner use this as the source of truth for what
> sections of the geometry document must fully specify.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none — pure CSS custom properties |
| Preset | not applicable |
| Component library | none (no React/shadcn; TypeScript + D3 + CSS tokens) |
| Icon library | none (SVG inline or text affordances only) |
| Font | `var(--font-sans)` — SF Pro / system-ui stack |

Source: `design-tokens.css` (project canonical). No shadcn, no Tailwind. The geometry
contract document must reference token names, not raw values, wherever visual
specifications appear.

---

## Spacing Scale

This phase uses the project's established spacing tokens. The geometry contract document
must specify spatial dimensions using these token names.

| Token | Value | Usage in chip-well context |
|-------|-------|----------------------------|
| `--space-xs` | 4px | Chip-to-chip gap within a well row; icon-to-label gap inside chip |
| `--space-sm` | 8px | Chip horizontal padding; well header bottom margin |
| `--space-md` | 12px | Well internal vertical padding; explorer panel section padding |
| `--space-lg` | 16px | Between-well vertical gap (stacked wells in panel) |
| `--space-xl` | 24px | Panel-level section break above/below chip-well region |

Exceptions:
- Chip vertical padding: 2px (sub-token, structural — matches established `.latch-explorers__chip` pattern, source: `latch-explorers.css` line 61)
- Keyboard focus ring: `outline: 2px solid var(--accent); outline-offset: -2px` — matches existing pattern (source: `latch-explorers.css` line 81)
- Touch/iPad drag grab target minimum: 44px (WCAG 2.5.5 minimum touch target for the chip area, not its rendered height)

---

## Typography

The geometry contract document must use these token names for any typographic specification.
Chip labels and well headers derive from the project's established scale.

| Role | Token | Rendered Size | Weight | Line Height | Usage |
|------|-------|---------------|--------|-------------|-------|
| Chip label | `--text-xs` | 10px | 400 (regular) | 1.4 | Text inside a chip token |
| Well category header | `--text-xs` | 10px | 600 (semibold) | 1.2 | Well section label (uppercase, 0.5px letter-spacing) |
| Well empty-state body | `--text-sm` | 11px | 400 (regular) | 1.5 | Message when well contains no chips |
| Promotion prompt heading | `--text-md` | 14px | 600 (semibold) | 1.2 | "Save as Formula" dialog title |

Source: `design-tokens.css` typography scale and `latch-explorers.css` established chip/header pattern.
Two weights only: 400 (regular) and 600 (semibold).

---

## Color

All color references in the geometry contract document must use token names, not hex values.
Theme variants are implicit — tokens resolve per `[data-theme]`.

| Role | Token | 60/30/10 | Usage in chip-well context |
|------|-------|----------|----------------------------|
| Dominant surface (60%) | `--bg-primary` | 60% | Explorer panel background behind chip wells |
| Secondary surface (30%) | `--bg-surface` | 30% | Default chip token background; well container background |
| Accent (10%) | `--accent` | 10% | Chip hover border; focus rings; drag-target-valid well border |
| Destructive | `--danger` | semantic only | drop-rejected state chip border; type-mismatch well indicator |

### Drag state color assignments (geometry contract §7)

These are the semantic descriptions the contract must capture. No raw CSS — only token references.

| State | Visual cue |
|-------|-----------|
| default | Chip: `--bg-surface` background, `--border-subtle` border, `--text-primary` label |
| drag-source-active | Chip being dragged: reduced opacity (0.6), `--bg-surface` background; source well: `--border-muted` border |
| drag-target-valid | Target well: `--accent-bg` background fill, `--accent-border` border, `--accent` label on header |
| drag-target-invalid | Target well: `--danger-bg` background fill, `--danger-border` border |
| drop-rejected | Chip snaps back to origin; no persistent visual change; brief `--danger` border flash (end-state only — no timing spec per D-02) |
| promotion-prompt | `<dialog>` overlay appears; chip in well shows `--accent-border` ring; rest of panel dims via `--overlay-bg` |

### Cross-well drag copy/move distinction

- Copy (default): chip appears in both source and target wells
- Move (modifier key): chip disappears from source, appears in target
- Neither introduces a unique color; the distinction is indicated by chip count change

Accent reserved specifically for: drag-target-valid well border, chip hover border, focus rings, promotion-prompt chip ring, and "Save as Formula" CTA button. Never applied to default chip background or text.

---

## Copywriting Contract

The geometry contract document must include these exact copy strings in §7 (States) and §8 (Interaction contracts). These are the canonical values — downstream phases reference this UI-SPEC.

| Element | Copy |
|---------|------|
| Well empty-state heading | "Drop chips here" |
| Well empty-state body | "Drag a chip from another well or the Formula Card library to add it." |
| Drag-source-active announcement (live region) | "Grabbed [chip label]. Use arrow keys to reorder, Enter to drop, Escape to cancel." |
| Drag-reorder announcement | "Moved [chip label] to position [N] of [total] in [well category name]." |
| Drop-on-valid-well announcement | "[chip label] added to [well category name]." |
| Drop-rejected announcement | "[chip label] cannot be dropped here. Returned to [source well name]." |
| Promotion-prompt heading | "Save as Formula" |
| Promotion-prompt body | "Create a reusable Formula Card from this chip arrangement." |
| Promotion-prompt primary CTA | "Save Formula" |
| Promotion-prompt cancel | "Cancel" |
| Keyboard grab mode instruction (tooltip/aria-description) | "Press Enter or Space to grab. Arrow keys to reorder. Enter to drop. Escape to cancel." |
| Type-mismatch well tooltip | "This well does not accept [chip type] chips." |

Primary CTA for this phase's deliverable: "Save Formula" (save-as-formula promotion flow, per GEOM-03, WA-6).

Destructive actions: none in this phase. Remove-chip is a non-destructive operation (recoverable via undo at the arrangement level per UXIN-02 — undo spec lives in Phase 188, not here).

---

## Interaction Contract Obligations

The geometry contract document (§8) must fully specify the following interaction dimensions.
This section tells the executor what completeness means for that section.

### Pointer-event drag (mandatory — WKWebView constraint)

The document must use pointer events exclusively. No HTML5 Drag and Drop API (`draggable`, `dragstart`, `drop`). Established pattern: `pointerdown` → `pointermove` → `pointerup` sequence on chip elements. This is a hard constraint from WKWebView (source: UXIN-06, CONTEXT.md D-06, established codebase pattern).

Each gesture row in §8 must specify:
- Gesture: pointer sequence (pointerdown / pointermove / pointerup)
- Target: chip token, well container, or cross-well drop zone
- Effect: state transition (from §7)
- Entry condition: what must be true before the gesture is valid
- Commit/abort: what ends the gesture and in which direction

### Touch/iPad drag (in scope per D-06)

Separate gesture table rows for touch equivalents:
- Long-press (500ms `pointerdown` hold) to grab a chip
- `pointermove` to drag
- `pointerup` to drop or abort

Same pointer-event path — just differentiated entry condition (touch vs. mouse input type).

### Keyboard contract (mandatory for WCAG 2.1 AA — D-03, D-04)

| Key | Context | Effect |
|-----|---------|--------|
| Tab | Explorer panel | Move focus to next chip in reading order (left-to-right, well-by-well) |
| Shift+Tab | Explorer panel | Move focus to previous chip |
| Arrow Right / Left | Chip focused | Move focus to next/previous chip within the same well |
| Arrow Down / Up | Chip focused | Move focus to chip in next/previous well (nearest by column position) |
| Enter or Space | Chip focused (normal mode) | Enter grab mode |
| Arrow Right / Left | Grab mode | Reorder chip within well (announces position) |
| Enter | Grab mode | Drop chip at current position |
| Escape | Grab mode | Abort — chip returns to original position |
| Delete or Backspace | Chip focused (normal mode) | Remove chip from well (with live-region announcement) |

### ARIA contract (mandatory for WCAG 2.1 AA — D-03)

| Element | ARIA role | Key attributes |
|---------|-----------|----------------|
| Well container | `role="listbox"` | `aria-label="[well category name] chips"`, `aria-multiselectable="false"` |
| Chip token | `role="option"` | `aria-selected="false"` (chips are not selected, they are ordered items — use `aria-setsize` + `aria-posinset` instead) |
| Chip token (in well with ordered semantics) | `role="option"` with `aria-posinset="[N]"` | `aria-setsize="[total]"` |
| Promotion-prompt dialog | `<dialog>` element | `aria-labelledby` pointing to heading |
| Drag operation live region | `role="status"` | `aria-live="polite"`, `aria-atomic="true"` |
| Well in drag-target-valid state | well container | `aria-dropeffect="copy"` or `"move"` per drag mode |
| Chip being dragged | chip element | `aria-grabbed="true"` (deprecated but retained for broad SR compatibility) |

Note: `aria-grabbed` is deprecated in ARIA 1.1 but retained here for WKWebView/VoiceOver compatibility. The contract document must note this explicitly.

---

## Composition Seam Contract (§9 obligations)

The geometry contract §9 must name exactly two seams by interface name. The geometry contract must NOT contain TypeScript-flavored signatures (per D-08 — named interfaces with responsibilities only).

| Seam | Interface name | What it publishes | What it consumes | Owner |
|------|----------------|-------------------|------------------|-------|
| Compilation pipeline | `ChipWellOutputContract` | Ordered list of chip DSL fragments per well category, with type signatures | Nothing (read-only) | Phase 184 (WA-2) |
| Formula Card library | `FormulaCardDragSourceContract` | A chip token (DSL fragment + type signature) that can be dropped into a well | Nothing (drag source only) | Phase 185 (WA-3) |

The geometry contract must state: "These interface names are load-bearing references. Phases 184 and 185 own the concrete implementations. No TypeScript signatures appear in this document."

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | n/a | not applicable — no component library; pure CSS tokens |

This phase produces a markdown specification document. No component registry is involved.

---

## Document Structure Contract

The geometry contract document `06-chip-well-geometry.md` must fill all 12 sections of
`.planning/geometry-contract-template.md`. This UI-SPEC defines the minimum content
obligation for each section:

| Section | Minimum content obligation | Source decision |
|---------|---------------------------|-----------------|
| §1 Intent | 2 paragraphs: what the chip well is (layout primitive for typed configuration) and what it is not (not a data view, not PAFV-bound) | WA-6 §1, CONTEXT.md domain |
| §2 Coordinate system | Authority (well container), units (chip token: variable width, fixed height 24px at `--size-card-mini`), origin (top-left CSS), axes (wrapping horizontal flow within well, vertical stack of wells) | GEOM-02, WA-6 §2, D-05 |
| §3 PAFV binding | Explicit N/A with rationale: "Chip wells are not PAFV-bound. They produce typed configuration consumed by view explorers; views own PAFV binding." | GEOM-01, WA-6 §3, FE-RG-13 |
| §4 Data binding | Input: ordered list of chips per well (type signature + DSL fragment). Output: same shape mutated by user action, published via ChipWellOutputContract | WA-6 §4 |
| §5 Invariants | At minimum: chip order is user-controlled and meaningful; chips never silently change category; drop-zone hit testing is deterministic; cross-well drag copies by default | WA-6 §5, STATE.md cross-well drag rule |
| §6 Degenerate cases | At minimum: empty well, single chip, overflow/many chips, type-incompatible drop, drag abort mid-flight, cross-explorer drag | WA-6 §6, D-05, D-06, D-07 |
| §7 States | All 6 states with visual treatment and pointer event behavior: default, drag-source-active, drag-target-valid, drag-target-invalid, drop-rejected, promotion-prompt | GEOM-03, D-01, D-02 |
| §8 Interaction contracts | Pointer-event drag table (mouse + touch), keyboard contract table, ARIA contract table — all as specified in this UI-SPEC | GEOM-04, D-03, D-04, D-06, UXIN-06 |
| §9 Composition | Two seam entries: ChipWellOutputContract (→ WA-2) and FormulaCardDragSourceContract (← WA-3), by interface name only | GEOM-05, D-08 |
| §10 Out of scope | At minimum: visual styling/theme, DSL grammar, compiled SQL, per-explorer chip-type-validity rules, marks-output-geometry, audit-overlay-geometry | WA-6 §10, REQUIREMENTS.md Out of Scope |
| §11 Open questions | Cross-explorer drag semantics (Formulas chip dragged to Audits: copy, move, or reject?); multi-select gestures (shift-click); any unresolved items | WA-6 §11 |
| §12 Reference | Figma stills when available (none yet); related contracts: `time-explorer-geometry.md` (cousin), future per-explorer contracts (consumers) | WA-6 §12 |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
