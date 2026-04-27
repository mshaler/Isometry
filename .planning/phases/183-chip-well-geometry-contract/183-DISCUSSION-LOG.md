# Phase 183: Chip-Well Geometry Contract - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 183-chip-well-geometry-contract
**Areas discussed:** Drag state visual spec depth, Keyboard & a11y contract scope, Overflow & degenerate cases, Composition seam granularity

---

## Drag State Visual Spec Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Semantic descriptions | Each state gets prose description of intent + visual cue type. No specific colors/opacities. Implementation picks from design tokens. | ✓ |
| CSS property-level treatments | Each state gets exact property changes (opacity, border, transform). More implementation-ready but couples to current tokens. | |
| Semantic + token references | Prose descriptions plus references to which design token categories apply. Middle ground. | |

**User's choice:** Semantic descriptions
**Notes:** Matches the template's "function not chrome" philosophy.

### Follow-up: Animation timing

| Option | Description | Selected |
|--------|-------------|----------|
| End-states only | Describes what each state looks like, not transition durations. Animation timing is implementation chrome. | ✓ |
| Include duration ranges | Add approximate ranges (150-300ms) for transitions affecting perceived responsiveness. | |

**User's choice:** End-states only
**Notes:** Consistent with semantic-only approach.

---

## Keyboard & A11y Contract Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Roles + key bindings + announcements | ARIA roles, key bindings, AND live-region announcement templates. Self-sufficient for WCAG 2.1 AA. | ✓ |
| Roles + key bindings only | ARIA roles and shortcuts defined. Announcements left to implementer. | |
| Full choreography script | Everything plus focus management sequence, multi-chip selection model, roving tabindex spec. | |

**User's choice:** Roles + key bindings + announcements
**Notes:** Success criteria require "no additional design work" for WCAG 2.1 AA implementation.

### Follow-up: Keyboard drag paradigm

| Option | Description | Selected |
|--------|-------------|----------|
| Grab mode | Focus chip → Enter/Space to grab → Arrow keys to reposition → Enter to drop / Escape to cancel. Standard ARIA Practices pattern. | ✓ |
| Cut/paste metaphor | Ctrl+X to cut, navigate, Ctrl+V to paste. More familiar but doesn't map naturally to reordering. | |
| Both with context switching | Grab mode for within-well, cut/paste for cross-well. Two patterns, each maps naturally. | |

**User's choice:** Grab mode
**Notes:** Standard ARIA Practices drag-and-drop pattern.

---

## Overflow & Degenerate Cases

### Chip limits

| Option | Description | Selected |
|--------|-------------|----------|
| Reflow only, no hard limit | Wells wrap chips to new rows. Scroll affordance when exceeding panel height. No artificial cap. | ✓ |
| Soft advisory limit with warning | No enforcement, but recommends a threshold (12-15 chips) for a collapse affordance. | |

**User's choice:** Reflow only, no hard limit
**Notes:** Practical limit is screen real estate, not a number.

### Touch/iPad drag

| Option | Description | Selected |
|--------|-------------|----------|
| Explicitly deferred | Contract states touch is out of scope; pointer events only. | |
| Include basic touch spec | Long-press to grab, drag to move, release to drop alongside pointer events. | ✓ |

**User's choice:** Include basic touch spec
**Notes:** Makes the contract complete for the iPad target.

### Drag abort behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Semantic only | Contract says chip returns to original position, no animation spec. | ✓ |
| Specify snap-back behavior | States chip returns with brief transition for spatial continuity. | |

**User's choice:** Semantic only
**Notes:** Consistent with end-states-only decision.

---

## Composition Seam Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Named interfaces + responsibilities | Interface name, what it publishes/consumes, which phase/WA owns implementation. No TS signatures. | ✓ |
| Named interfaces + TS-flavored shapes | Same plus TypeScript-flavored interface shapes. Head start but coupling between spec phases. | |
| Names only, minimal prose | Just name and one-liner. Maximum abstraction. | |

**User's choice:** Named interfaces + responsibilities
**Notes:** Clean boundary — Phases 184/185 own implementation detail.

---

## Claude's Discretion

- Internal document structure (heading order, section breaks)
- Exact wording of ARIA announcement templates
- Level of detail in §10 (Out of Scope)
- Number and selection of degenerate cases in §6

## Deferred Ideas

None — discussion stayed within phase scope.
