# UX Interaction Specification: Formulas / Marks / Audits Chip-Well Explorers

**Artifact:** `05-ux-interaction-spec.md`
**Work Area:** WA-5
**Milestone:** v15.0 — Formulas Explorer Architecture
**Status:** Authoritative

**Related documents:**
- `01-three-explorer-spec.md` (WA-1) — Explorer boundaries, chip type vocabulary, DSL lexicon
- `02-compilation-pipeline.md` (WA-2) — Compile path, CycleError type, clause mapping
- `03-formula-card-schema.md` (WA-3) — Promotion API: `promoteToCard`, `hydrateChips`, `validatePromotion`
- `06-chip-well-geometry.md` (WA-6) — Spatial contracts: drag states, drop-zone semantics, ChipWellOutputContract

---

## Preamble

This document specifies the complete interaction semantics for the Formulas, Marks, and Audits chip-well explorers. It layers on top of two prior specs:

- **Geometry contract** (`06-chip-well-geometry.md`) — specifies *where* things are: coordinate system, drag affordances, drop-zone hit regions, well layout, state machine.
- **Compilation pipeline** (`02-compilation-pipeline.md`) — specifies *what the pipeline produces*: SQL clause mapping, CycleError, bind-value protocol, post-query annotation algorithms.

This spec specifies *how the user experiences the flow*: when queries run, how results animate, which actions are undoable, how errors surface and resolve, how a chip arrangement becomes a saved Formula Card, and where the explorers live in the navigation hierarchy.

**All decisions in 188-CONTEXT.md (D-01 through D-19) are locked.** Each decision is reflected in the relevant section below.

---

## 1. Live Preview Behavior

*Satisfies UXIN-01.*

### §1.1 Trigger

Every chip drop, reorder, or remove in any chip well fires re-compilation **immediately**. There is no debounce. The triggered events are:

| Event | Source gesture | Trigger condition |
|-------|---------------|-------------------|
| `chip:drop` | Chip dropped onto a well from the library or another well | Type-compatible drop committed via `pointerup` |
| `chip:reorder` | Chip moved to a new position within the same well via keyboard arrow or pointer drag | Position in well changes |
| `chip:remove` | Chip removed via Delete/Backspace key or explicit remove action | Chip count in well decreases |

**Rationale (D-01):** sql.js in-memory queries execute in typically <50ms. Debounce adds perceived latency without a functional benefit. The Cryptex "continuous tactile interaction" principle requires that the user sees the consequence of every arrangement change as they make it.

### §1.2 Pipeline Path

The live preview follows this execution path on every trigger:

1. **Chip well publishes** the current arrangement as a `ChipWellOutputContract` (defined in `06-chip-well-geometry.md` §9 Seam 1). This is an ordered list of chip DSL fragments and type signatures per well category.
2. **`FormulasProvider.compile()`** consumes the `ChipWellOutputContract` and produces a `(sql_text, bind_values)` tuple per the algorithm in `02-compilation-pipeline.md`. For Marks and Audits wells, no SQL tuple is produced — those use post-query annotation passes (`annotateMarks()`, `annotateAudits()`).
3. **Worker bridge message** `supergrid:query` is dispatched with the compiled `(sql_text, bind_values)` payload. This is the same bridge channel used by the existing SuperGrid and other view explorers.
4. **sql.js** executes the query inside the Worker. The result set is returned to the main thread as a structured message.
5. **D3 data-join** on the preview panel applies the result set, triggering enter/exit/update transitions (§1.3).
6. For Marks/Audits, **post-query passes** run after the query result arrives: `annotateMarks()` produces `Map<rowId, string[]>` of CSS classes; `annotateAudits()` produces `Map<rowId, AuditAnnotation[]>`.

### §1.3 Result Animation

Preview updates use D3 keyed data-join transitions, consistent with the existing SuperGrid, TreeView, and NetworkView patterns (D-02):

- **Enter:** Rows entering the result set fade in (`opacity: 0 → 1`) and slide down (`transform: translateY(8px) → translateY(0)`). Duration: 200ms, ease-out.
- **Exit:** Rows leaving the result set fade out (`opacity: 1 → 0`). Duration: 200ms, ease-out.
- **Update:** Rows whose data changes (same key, new values) reposition with 200ms ease-out transition.
- **Key function:** The D3 key function uses the row's primary key (`id` column). This ensures stable identity across re-renders — the same row in successive result sets receives an update transition, not a remove+add pair.

**No new animation system is introduced.** The existing D3 transition infrastructure is sufficient.

### §1.4 Loading State

If a query has not returned within **200ms** of dispatch (D-03):

1. A CSS shimmer overlay (`chip-well-preview--loading`) appears over the current result set. This overlay uses the established CSS shimmer pattern (pulsing background gradient, `animation: shimmer 1.2s infinite`).
2. The current result set remains visible but dimmed (`opacity: 0.5`). The user can still read the old results while the new query executes.
3. The overlay is removed when the new result set arrives, and the D3 transition (§1.3) runs immediately.

**Threshold:** 200ms from `supergrid:query` dispatch to result arrival. If the result arrives before 200ms, no shimmer appears and the transition runs directly.

### §1.5 Sequencing Diagram

```
User action (drop / reorder / remove)
  |
  v
[chip:drop | chip:reorder | chip:remove event]
  |
  v
ChipWellOutputContract published (current arrangement snapshot)
  |
  v
FormulasProvider.compile()
  |
  +---> [compile error?] --> Error attributed to chip (§3); partial compile continues
  |
  v
(sql_text, bind_values) tuple assembled
  |
  v
Worker bridge: postMessage({ type: 'supergrid:query', sql: sql_text, params: bind_values })
  |
  v
  +------> [< 200ms] --> result arrives; D3 transition runs; preview updates
  |
  +------> [>= 200ms] --> shimmer overlay shown (current results dimmed to 0.5)
                            |
                            v
                          result arrives; shimmer removed; D3 transition runs
```

For Marks/Audits chips, the sequencing continues after the SQL result arrives:

```
Result set arrives on main thread
  |
  v
annotateMarks(rows, marksChips)  --> Map<rowId, string[]>  (CSS classes applied to rows)
annotateAudits(rows, auditsChips) --> Map<rowId, AuditAnnotation[]>  (flag badges rendered)
  |
  v
Preview renders combined result (query rows + class annotations + audit badges)
```

---

## 2. Reversibility Model

*Satisfies UXIN-02.*

### §2.1 Scope: Per-well Undo Stack

Per-well undo stack: each chip well maintains its own independent undo stack. The wells and their stacks are:

| Explorer | Well category | Has own undo stack |
|----------|--------------|-------------------|
| Formulas | Calculations | Yes |
| Formulas | Filters | Yes |
| Formulas | Sorts | Yes |
| Marks | Conditional Encoding | Yes |
| Audits | Anomaly Rules | Yes |
| Audits | Validation Rules | Yes |

**Per-well undo** means Cmd+Z while focus is in the Filters well undoes the last Filters change — it does not affect the Calculations or Sorts stacks. This matches the arrangement-level undo language in the project roadmap (D-04).

### §2.2 Stack Entry Shape

Each undo stack entry is an `ArrangementSnapshot`:

```typescript
interface ArrangementSnapshot {
  wellId: string;       // Identifies which well this snapshot belongs to
  chips: ChipState[];   // Complete chip list for this well at this point in time
  timestamp: number;    // Unix ms timestamp — for debugging/logging only, not for display
}
```

Each snapshot captures the **complete chip list** for the well at that moment, not a diff. This makes undo and redo O(1) — restore the snapshot, re-run compile.

`ChipState` is the chip's DSL fragment, type signature, and any display metadata (label, id). It is the same shape as one entry in `ChipWellOutputContract`.

### §2.3 Stack Depth and Lifetime

- **Depth:** Unlimited. All arrangement snapshots are retained in memory for the duration of the session.
- **Not persisted:** The undo stack is session-only. Navigating away from the explorer clears all stacks. Reloading the app clears all stacks.
- **Memory cost:** Trivial. Chip arrangements are small objects (typically <1KB per snapshot, <<10KB even for deeply complex arrangements with many chips). No memory pressure threshold needed (D-05).

### §2.4 Undo Trigger

- **macOS:** Cmd+Z
- **Windows/other:** Ctrl+Z
- **Scope:** Operates on the **focused well** only. If no well currently has keyboard focus, undo is a no-op. Well focus is tracked via the standard `:focus-within` pattern on the well container, using the `data-well-id` attribute to identify which stack to pop.
- **Stack behavior:** Pops the top `ArrangementSnapshot` from the focused well's stack. Restores the chip list to the popped snapshot. Pushes the current state onto the redo stack.

### §2.5 Redo Trigger

- **macOS:** Cmd+Shift+Z
- **Windows/other:** Ctrl+Shift+Z
- **Scope:** Same as undo — operates on focused well only.
- **Redo stack behavior:** Pops from the redo stack, pushes current state onto undo stack, restores the arrangement. **The redo stack is cleared when a new chip action occurs** — this is standard redo semantics. A new drop after an undo discards all redo-able states for that well.

### §2.6 Undo Fires Re-Preview

Reverting an arrangement snapshot via undo triggers the **same compile → D3 transition pipeline** as a new chip drop (§1). Every arrangement state — including historical states accessed via undo — gets a live preview. There is no "stale preview" state; every undo re-runs the query.

This is a consequence of D-06 and the immediate-trigger rule (§1.1): `chip:reorder` is fired when undo restores an arrangement, which triggers compile and preview just as any user-initiated reorder would.

### §2.7 Formula Card Save Is NOT Undoable

`promoteToCard()` (from `03-formula-card-schema.md` §4) is **NOT undoable**. Saving a chip arrangement as a Formula Card creates a permanent version row in the `formula_cards` table. This is an explicit write to persistent storage, not an in-session arrangement change.

**Design boundary statement:** The per-well undo stack governs chip *arrangements* — the live, transient configuration surface. Formula Card versioning (defined in `03-formula-card-schema.md` §3) governs saved card history. These are separate systems. There is no undo of a `promoteToCard()` call; users who want to revert to a prior card state use the versioning UI to reload a previous version (D-07).

This distinction is intentional, not a missing feature. It matches the "no commit until commit" principle: once the user explicitly commits by saving, that commit is permanent.

### §2.8 Boundary Table

| Action | Undoable? | Mechanism | Notes |
|--------|-----------|-----------|-------|
| Chip drop (from library or cross-well copy) | Yes | Per-well arrangement stack | Restores pre-drop chip list |
| Chip reorder (within well) | Yes | Per-well arrangement stack | Restores pre-reorder position |
| Chip remove (Delete/Backspace or remove button) | Yes | Per-well arrangement stack | Restores removed chip at its prior position |
| Chip rename / DSL edit | Yes | Per-well arrangement stack | DSL fragment is part of `ChipState`; editing is a new snapshot |
| Formula Card save (`promoteToCard`) | **NO** | Permanent version row | Explicit commit boundary — not part of arrangement stack |
| Navigation away from explorer | N/A | Clears all stacks | Not undoable; stacks discarded on navigation |

---

## 3. Error State Presentation

*Satisfies UXIN-03.*

### §3.1 Error Taxonomy

The compilation pipeline (`02-compilation-pipeline.md`) produces three categories of errors. Each category has a distinct visual treatment in the chip well.

| Error type | Source | Definition |
|-----------|--------|------------|
| **Type mismatch** | `validateTypeSignature()` in `03-formula-card-schema.md` §2 | The chip's output type is incompatible with the target well category, or an input column type does not match the declared signature. Detected at chip-drop time. |
| **Dependency cycle** | `compileDependencyGraph()` in `02-compilation-pipeline.md` §2 | Two or more Calculation chips form a circular reference. Detected by Kahn's topological sort — `CycleError.participants` carries the chip IDs. |
| **Compilation error** | `FormulasProvider.compile()` | DSL syntax error, invalid column reference that passed allowlist validation, or bind-value assembly failure. Detected at compile time (not drop time). |

### §3.2 Wireframe: Type Mismatch

A single chip is flagged when its type signature is incompatible with its well or a downstream chip.

**Visual treatment:**
- The chip receives `data-error="type-mismatch"` attribute.
- 2px solid border in `--color-error` (red) replaces the default `--border-subtle` border.
- A warning icon (⚠) is appended to the chip label, before any remove button. Icon size matches chip label font size.
- All other chips in the well render in their default state.

**Tooltip (on chip hover or focus):**
```
Type mismatch: expected {expected}, got {actual}
[Undo]
```
Where `{expected}` is the type the well requires (e.g., `boolean`) and `{actual}` is the type the chip produces (e.g., `text`). The `[Undo]` text is an action link that calls `well.undo()` (§3.8).

**Example:** A chip producing `UPPER(company_name) AS display_name` (output type `text`) dropped onto the Filters well (requires `boolean`) results in `data-error="type-mismatch"` on that chip, with tooltip: "Type mismatch: expected boolean, got text".

### §3.3 Wireframe: Dependency Cycle

**ALL chips listed in `CycleError.participants`** (from `02-compilation-pipeline.md` §2) are flagged simultaneously.

**Visual treatment:**
- Every participating chip receives `data-error="cycle"` attribute.
- 2px solid border in `--color-error` (red).
- A circular-arrow icon (↻) is appended to each participating chip's label.
- Non-participating chips in the same well render in their default state.

**Tooltip (on any participating chip hover or focus):**
```
Dependency cycle: {chip-A-label} ↔ {chip-B-label} [↔ {chip-C-label} ...]
To fix: remove one of the cyclic dependencies
[Undo]
```
All participating chips show the **same tooltip** — the user does not have to hover each chip to understand the cycle. The `[Undo]` link triggers `well.undo()` for the focused well, which typically breaks the cycle by reverting the chip arrangement to the state before the cycle-forming drop or edit.

**References CycleError:** The `CycleError.participants` array (defined in `02-compilation-pipeline.md` §2) provides the chip IDs that receive the `data-error="cycle"` attribute. The chip-well UI must map chip IDs to chip DOM elements to apply the error attribute.

### §3.4 Wireframe: Compilation Error

A single chip is flagged when its DSL produces a compile-time error that is not a type mismatch.

**Visual treatment:**
- The chip receives `data-error="compile"` attribute.
- 2px solid border in `--color-error` (red).
- An X icon is appended to the chip label (distinct from the ⚠ used for type mismatch and ↻ for cycles).
- All other chips in the well render in their default state.

**Tooltip (on hover or focus):**
```
{error.message}
[Undo]
```
Where `{error.message}` is the raw message from the compiler (e.g., "Unknown column: revenue_q4", "Invalid syntax near 'WHEN'"). The `[Undo]` link triggers `well.undo()`.

### §3.5 Partial Results Behavior

When one or more chips are in error state, **valid chips compile and execute normally**. Erroring chips are excluded from the query (D-10). The preview shows the result of the valid chips only.

An indicator bar appears between the chip wells and the result preview:

```
⚠ Showing partial results — {N} chip(s) excluded due to errors
```

Where `{N}` is the count of chips with a `data-error` attribute. This bar uses the same color token as chip error borders (`--color-error`) with reduced opacity for the background.

**The indicator disappears** when all chips are error-free (all `data-error` attributes are absent).

**Rationale (D-10):** Showing partial results keeps the preview useful while the user fixes errors. The alternative — showing nothing on any error — would make the error-resolution loop harder (user cannot see the effect of valid chips).

### §3.6 Error Clearing

Errors clear **automatically** when the causing condition is resolved. No explicit "dismiss" action is needed.

| Error type | Clearing condition |
|-----------|-------------------|
| Type mismatch | Chip is removed from the well, or the chip's DSL is edited to produce a compatible output type |
| Dependency cycle | Cycle is broken (e.g., one of the participating chips is removed, reordered, or edited to remove the circular reference) |
| Compilation error | The chip's DSL is corrected to produce valid output |

The `data-error` attribute is removed from the chip element when the error clears. The partial results indicator disappears when no `data-error` attributes remain.

### §3.7 Multiple Simultaneous Errors

Multiple chips can be in error state simultaneously. Each chip shows its own error independently:

- A chip with a type mismatch shows `data-error="type-mismatch"` and its tooltip.
- A cycle involving chips A and B shows `data-error="cycle"` on both A and B.
- A chip with a compilation error shows `data-error="compile"` and its tooltip.
- If a chip would qualify for multiple errors (rare), the most specific error takes precedence: cycle > type-mismatch > compile.

**No global error banner.** Errors are always spatially co-located with the causing chip. This follows the D-08 decision: the error location IS the diagnostic — the user does not need to read a banner and then locate the chip. The chip announces itself (D-08).

### §3.8 Recovery Actions

Every error tooltip includes an `[Undo]` action link. Clicking it calls `well.undo()` on the focused well, which reverts the arrangement snapshot to the state before the error-causing action.

```
// Pseudocode for [Undo] link handler
tooltipUndoLink.addEventListener('click', () => {
  const wellId = chip.closest('[data-well-id]').dataset.wellId;
  WellUndoStacks.get(wellId).undo(); // pops stack, restores arrangement, fires compile
});
```

**Additional recovery for cycle errors:** The cycle tooltip also names the participating chips: "To fix: remove one of the cyclic dependencies". This tells the user which chips to address without requiring them to understand Kahn's algorithm.

**Additional recovery for type mismatch:** When the error type includes expected/actual type information, the tooltip gives the user the type they need to produce: "Type mismatch: expected boolean, got text". This tells them what to change in their DSL.

---

## 4. Save-as-Formula Promotion UI Flow

*Satisfies UXIN-04.*

### §4.1 Trigger

A **"Save as Formula"** button is present in the chip-well toolbar for each explorer panel. The button:

- Is **always visible** when at least one chip is in any well of that explorer (D-11).
- Is a standard `<button>` element with `data-action="promote"`.
- Uses label text "Save as Formula" (not an icon-only button — label is required for accessibility and clarity).
- Renders in the toolbar row immediately above the first chip well in the panel. Position within the toolbar row: right-aligned.

**Rationale (D-11):** The button is always visible (not appearing only when the user hovers) to reinforce the "no commit until commit" principle. The user knows the commit action is available without having to discover it.

### §4.2 Pre-validation

On "Save as Formula" click, the system calls `validatePromotion(currentArrangement)` (from `03-formula-card-schema.md` §4.2) **before** opening the dialog.

```
onClick("Save as Formula"):
  result = validatePromotion(chipWell.getOutputContract())

  if result.valid === false:
    // Do NOT open the dialog
    button.setAttribute('aria-describedby', errorTooltipId)
    errorTooltip.textContent = "Cannot save: " + result.errors[0].message
    errorTooltip.show()
    return

  // All validation passed — open the dialog
  promotionDialog.showModal()
```

**Pre-validation failures block the dialog from opening.** The inline error appears as an `aria-describedby` tooltip on the button, not a separate banner. Example error messages:

- "Cannot save: all chips are in error state" (when every chip has a `data-error` attribute)
- "Cannot save: no chips in any well" (empty arrangement)
- "Cannot save: dependency cycle must be resolved first"

**Warnings do not block the dialog.** If `result.warnings` is non-empty but `result.valid === true`, the dialog opens and warnings are shown in the dialog footer (not blocking).

### §4.3 Dialog Specification

The promotion dialog is a `<dialog>` element (D-14, D-19 — no `alert()` or `confirm()` in WKWebView).

```html
<dialog class="formula-promotion-dialog" aria-labelledby="fpd-title">
  <h2 id="fpd-title">Save as Formula</h2>

  <form method="dialog">
    <!-- Field 1: Name (required) -->
    <label for="fpd-name">Name <span aria-hidden="true">*</span></label>
    <input
      type="text"
      id="fpd-name"
      name="title"
      required
      maxlength="100"
      placeholder="e.g., Revenue Growth Filter"
      autofocus
    />

    <!-- Field 2: Description (optional) -->
    <label for="fpd-desc">Description</label>
    <textarea
      id="fpd-desc"
      name="description"
      maxlength="500"
      placeholder="What does this formula do?"
    ></textarea>

    <!-- Hidden defaults (not shown to user; set programmatically) -->
    <!-- visibility = 'active' -->
    <!-- scope = 'dataset' -->

    <div class="fpd-actions">
      <button type="button" class="btn-secondary" data-action="cancel">Cancel</button>
      <button type="submit" class="btn-primary" id="fpd-save" disabled>Save</button>
    </div>
  </form>
</dialog>
```

**Field details:**

| Field | Type | Required? | Max length | Placeholder | Notes |
|-------|------|----------|------------|-------------|-------|
| Name | `<input type="text">` | Yes | 100 chars | "e.g., Revenue Growth Filter" | Auto-focused on dialog open; Save button disabled until this has content |
| Description | `<textarea>` | No | 500 chars | "What does this formula do?" | Optional; can be left blank |

**Hidden defaults (set programmatically, not shown to user):**
- `visibility = 'active'` (default per `03-formula-card-schema.md` §1.1)
- `scope = 'dataset'` (v1 only scope per locked decision)

**Save button state:** The Save button (`id="fpd-save"`) is **disabled** until the Name field contains at least one non-whitespace character. This is enforced via:
```javascript
nameInput.addEventListener('input', () => {
  saveBtn.disabled = nameInput.value.trim().length === 0;
});
```

### §4.4 Confirm Flow

On "Save" click (or form submit):

1. Collect form values: `title = nameInput.value.trim()`, `description = descTextarea.value.trim() || undefined`.
2. Call `promoteToCard(currentArrangement, { title, content: description })` (from `03-formula-card-schema.md` §4.2).
3. On success:
   - Close the dialog: `promotionDialog.close()`.
   - Show success toast: "Formula saved" (using the existing toast pattern from the codebase).
   - Chips remain in wells as-is (D-13). The arrangement is now both the live preview AND a saved Formula Card.
4. On error: see §4.7.

**Chips are not locked or cleared after save.** The user can continue editing. The next "Save as Formula" action creates a new version row (per `03-formula-card-schema.md` §3 — every save = new row, new version number). The arrangement is never "locked" after saving.

### §4.5 Cancel Flow

On "Cancel" button click, Escape key, or backdrop click:

1. Close dialog: `promotionDialog.close()`.
2. No state change. Chips remain as-is. No undo entry is created (cancellation is not an undoable action).

**Escape key handling:** The `<dialog>` element handles Escape natively (closes the dialog with `close` event). The cancel handler listens to `dialog.addEventListener('close', ...)` and takes no action on cancel.

**Backdrop click:** If the user clicks outside the dialog's content area while it is open, the dialog closes with the same cancel semantics. This is implemented via:
```javascript
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close(); // backdrop click
});
```

### §4.6 Post-Save Editing

After saving, the user can continue editing the chip arrangement freely. The explorer panel does not change its state. The "Save as Formula" button remains available.

If the user makes additional changes and clicks "Save as Formula" again:
- A fresh dialog opens.
- On confirm, `promoteToCard()` is called again.
- A **new version row** is created in `formula_cards` with `version = N+1` under the same `canonical_id`.
- Both versions are retained (per §3.3 of `03-formula-card-schema.md` — all versions retained at v1).

The user can accumulate as many versions as they want. The Formula Card library shows only the latest version by default; the version history is accessible from the card's detail view.

### §4.7 Error During Save

If `promoteToCard()` throws (e.g., SQLite constraint violation, Worker error):

1. The dialog **stays open**.
2. An error message appears in the dialog footer, above the action buttons:
   ```html
   <p class="fpd-error" role="alert">Save failed: {error.message}</p>
   ```
3. The user can retry (click "Save" again) or cancel.
4. The error message is cleared when the user modifies the Name or Description field (indicating they are retrying).

---

## 5. Explorer Placement in Navigation

*Satisfies UXIN-05.*

### §5.1 Location

The Formulas explorer group lives in the **Analyze** dock section. The dock entry is already pre-wired in the codebase:

```typescript
// From src/ui/section-defs.ts line 162
{ key: 'formula', label: 'Formulas', icon: 'code' }
```

This is a **single parent item** in the Analyze section. Clicking it opens the explorer panel that contains the three sub-explorer tabs.

### §5.2 Sub-Explorer Hierarchy

The Formulas parent item opens a panel with three sub-explorer tabs:

| Tab | Sub-explorer | Chip wells | Operation kind |
|-----|-------------|-----------|----------------|
| 1 | **Formulas** | Calculations, Filters, Sorts | Data-layer operations — transforms the query |
| 2 | **Marks** | Conditional Encoding | View-layer CSS class assignments — annotates rows with classes |
| 3 | **Audits** | Anomaly Rules, Validation Rules | Semantic flags — surfaces rows that need attention |

The sub-explorer boundaries are defined in `01-three-explorer-spec.md`. This spec only specifies their placement in the navigation hierarchy.

**Default tab:** The "Formulas" sub-explorer tab is selected by default when the panel opens. The last-active tab is remembered within a session (standard tab panel behavior).

### §5.3 Navigation Diagram

```
Sidebar dock
  └── L (Latch) section
  |     └── [existing Latch explorers]
  |
  └── A (Analyze) section
  |     └── [existing Analyze explorers — CalcExplorer, HistogramExplorer, etc.]
  |     └── Formulas (parent dock item — key: 'formula', icon: 'code')
  |           └── Panel opens with three tabs:
  |                 ├── [Formulas] — Calculations / Filters / Sorts chip wells
  |                 ├── [Marks]    — Conditional Encoding chip well
  |                 └── [Audits]   — Anomaly Rules / Validation Rules chip wells
  |
  └── T (Time) section
  |     └── [existing Time explorers]
  |
  └── C (Categorize) section
  |     └── [existing Category explorers]
  |
  └── H (Hierarchy) section
        └── [existing Hierarchy explorers]
```

### §5.4 Orthogonality Statement

The Formulas Explorer is **NOT** the "A" (Analyze) in the LATCH taxonomy. It is an **orthogonal operator surface** that produces configuration consumed by views (D-16, FE-RG-11).

Clarification of the distinction:
- **LATCH "Analyze"** governs how data is *taxonomically arranged* — by numeric attribute, in linear sequence, etc. The Analyze section of the dock contains explorers that help users navigate data categories and relationships.
- **Formulas Explorer** governs how data is *computationally transformed* — derived columns, filters, sorts, marks, and audit flags. It is an operator surface, not a taxonomy surface.

The Formulas parent item sits in the Analyze dock section as a practical navigation choice (it is an "analytical" operation in the user's mental model), not because it implements the LATCH "A" function. Implementers must not conflate these two usages of "Analyze."

### §5.5 Coexistence

The Formulas, Marks, and Audits explorers **coexist** with all existing Analyze-section explorers (CalcExplorer, HistogramExplorer, and any others). They do not replace, subsume, or conflict with those explorers.

The Formulas group is an **additive** addition to the dock. Existing explorer panel registrations are unchanged. The `FormulasPanelStub.ts` stub (`src/ui/panels/FormulasPanelStub.ts`) is the implementation entry point — it replaces the "Coming soon" panel with the fully implemented chip-well panel.

---

## 6. WKWebView Constraint Compliance

*Satisfies UXIN-06.*

### §6.1 Constraint Checklist

All chip-well implementation code must comply with the following WKWebView constraints. The violation detector in each row is a grep pattern that, if it returns matches in chip-well source files, indicates a constraint violation.

| # | Constraint | Rationale | Implementation Rule | Violation Detector |
|---|-----------|-----------|--------------------|--------------------|
| 1 | Use pointer events for chip drag — no HTML5 DnD API | `dragstart`/`dragend`/`draggable` API drops silently fail or behave inconsistently in WKWebView. HTML5 Drag and Drop is unreliable in web views on iOS/macOS. (D-17) | Use `pointerdown` / `pointermove` / `pointerup` event sequence. Manual hit-testing via `elementFromPoint()`. `setPointerCapture()` for reliable tracking. `touch-action: none` on chip elements. | `grep -r "dragstart\|dragend\|draggable" src/ --include="*.ts" --include="*.css"` — any match in chip-well code is a violation |
| 2 | No `:has()` behavioral selectors | Safari versions bundled with WKWebView have inconsistent support for `:has()` used to respond to JS-triggered state changes (e.g., `:has([data-error])`). (D-18) | Use `data-*` attribute patterns instead. JS applies `data-error`, `data-drag-state`, `data-well-focused` etc. directly to elements. CSS selects on `[data-error]`, `[data-drag-state="dragging"]`, etc. | `grep -n ":has(" src/ui/chip-well*.css src/ui/formulas*.css` — any match that targets chip-well behavioral state is a violation |
| 3 | `<dialog>` element for all modal interactions | `alert()`, `confirm()`, and `prompt()` are blocked or silently no-op in WKWebView. (D-14, D-19) | All modal interactions use `<dialog>` element with `showModal()` to open and `close()` to close. This applies to the promotion dialog (§4.3) and any future chip-well modals. | `grep -n "alert(\|confirm(\|prompt(" src/ui/panels/FormulasPanel*.ts src/ui/chip-well*.ts` — any match is a violation |

### §6.2 Pointer Event Protocol

The following sequence governs chip drag within WKWebView-hosted HTML. This protocol is mandatory; deviating from it risks silent drop failures on iOS/macOS.

**Chip drag sequence:**

```
1. pointerdown on chip element
   - Call chip.setPointerCapture(event.pointerId)
     (ensures pointermove/pointerup are always delivered to chip even if pointer leaves element)
   - Record start position: startX = event.clientX, startY = event.clientY
   - Set data-drag-state="dragging" on chip element
   - Set touch-action: none on chip element (prevents scroll interference during drag)

2. pointermove (received because pointer capture is active)
   - Compute offset from start position
   - Update chip ghost position via transform: translate({deltaX}px, {deltaY}px)
     (translate chip visually without removing it from the DOM)
   - Hit-test drop zones:
       dropTarget = document.elementFromPoint(event.clientX, event.clientY)
       well = dropTarget.closest('[data-well-id]')
     If well found: evaluate type compatibility → apply drag-target-valid or drag-target-invalid state
     If no well found: clear drop target state

3. pointerup (received because pointer capture is active)
   - Release pointer capture: chip.releasePointerCapture(event.pointerId)
   - Determine drop target (same elementFromPoint logic as pointermove)
   - If drop target is a valid well:
       Dispatch chip:drop or chip:reorder event
       Commit drop: add chip to target well at insertion point
   - If no valid drop target:
       Return chip to original position (no persistent visual change)
   - Clear data-drag-state from chip element
   - Remove touch-action: none override
```

**Touch-action requirement:** The `touch-action: none` CSS property must be applied to the chip element **at the start of drag** (step 1) and removed **at the end of drag** (step 3). Applying it globally to all chips at all times would prevent normal touch scrolling on the panel.

**Ghost chip:** The dragging chip should follow the pointer via `transform: translate()` on the chip element itself (or a clone appended to the document body). Using `position: fixed` on a clone is acceptable; using `position: absolute` within the well container is not (it may affect the well's reflow and confuse `elementFromPoint` hit testing).

### §6.3 Cross-Reference to Geometry Contract

The spatial aspects of drag — hit regions, drop zone dimensions, visual feedback during drag (drag-target-valid/invalid states), and the state machine transitions — are defined in `06-chip-well-geometry.md` §5 (Invariants), §7 (States), and §8 (Interaction contracts).

This section (§6 of this spec) specifies only the **event-level protocol** for WKWebView compliance. The geometry contract owns all spatial rules. When a question arises about "where does the drop indicator appear?" or "how big is the drop target hit region?", the answer is in `06-chip-well-geometry.md`, not here.

---

## Appendix A: Design Principles Reference

The four Cryptex / Dream Orb principles from `.planning/formulas-explorer-handoff-v2.md` Appendix B drove all interaction decisions in this spec:

1. **Continuous tactile interaction** → Every chip change fires immediate re-compilation and re-preview, with no debounce (§1.1). The user experiences the query as a live instrument, not a form that requires submission.

2. **Reversibility** → Every chip arrangement is undoable via a per-well stack that does not distinguish between "I dropped the wrong chip" and "I deleted a chip by accident" — all arrangement changes are reversible (§2). The undo granularity is the chip-well arrangement, matching the interaction granularity.

3. **No commit until commit** → Ad hoc chip arrangements run as ephemeral live previews. Promotion to a saved Formula Card is the explicit and deliberate commit boundary (§4). Nothing is written to storage until the user explicitly confirms in the "Save as Formula" dialog.

4. **Combination reveals insight** → When some chips produce errors, valid chips still execute and the preview shows partial results (§3.5). The user sees the effect of working chips while fixing the broken ones. Shutting down the preview on any error would violate this principle.

For the full design philosophy that inspired these principles, see `.planning/formulas-explorer-handoff-v2.md` Appendix B.

---

*End of `05-ux-interaction-spec.md`*
*Version 1.0 — Phase 188, Plan 01*
*Canonical source: `.planning/phases/188-ux-interaction-spec/188-CONTEXT.md`*
