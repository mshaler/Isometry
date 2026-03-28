# Phase 134: Guided Tour - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 134-guided-tour
**Areas discussed:** Tour step content, Dataset-aware copy, View-switch survival, Opt-in prompt UX

---

## Tour Step Content

### Step Count

| Option | Description | Selected |
|--------|-------------|----------|
| 5-7 steps (Recommended) | Covers essentials: SuperGrid, explorer panel, command palette, view switcher, notebook. Quick enough to not annoy. | :heavy_check_mark: |
| 8-12 steps | More comprehensive — density controls, LATCH histogram, calc footer. Risk: users bail. | |
| 3-4 steps | Ultra-minimal — just SuperGrid, command palette, view switcher. | |

**User's choice:** 5-7 steps
**Notes:** None

### Must-Have Tour Stops

| Option | Description | Selected |
|--------|-------------|----------|
| SuperGrid cells (Recommended) | Main data surface — explain PAFV rows/columns/cells | :heavy_check_mark: |
| View switcher in sidebar | Show multiple views exist and recommendation badge | :heavy_check_mark: |
| Command palette (Cmd+K) | Primary action surface — how to find everything | :heavy_check_mark: |
| Workbench explorer panel | One of the collapsible sections for configuration | |

**User's choice:** SuperGrid cells, Command palette, View switcher
**Notes:** Claude fills remaining 2-4 stops within the 5-7 budget

---

## Dataset-Aware Copy

| Option | Description | Selected |
|--------|-------------|----------|
| Active axis only (Recommended) | Template substitution with live PAFV axis names. Simple, satisfies success criteria #3. | :heavy_check_mark: |
| Per-source-type variants | Hand-written copy for each of 20 source types. Polished but 20x content. | |
| Generic copy only | Same text for all datasets. Misses the "aha" moment. | |

**User's choice:** Active axis only
**Notes:** None

---

## View-Switch Survival

### Tour vs View Switching

| Option | Description | Selected |
|--------|-------------|----------|
| Stay on current view (Recommended) | Tour only highlights elements in current view. Skip missing targets gracefully. | :heavy_check_mark: |
| Force view switches | Drive user through 2-3 views. Complex, higher spotlight drift risk. | |
| Offer optional detour | Default stays, optional "Want to see another view?" step. | |

**User's choice:** Stay on current view
**Notes:** None

### Mid-Tour View Switch

| Option | Description | Selected |
|--------|-------------|----------|
| Re-query and skip missing (Recommended) | After switchTo(), re-query selector. Reposition if found, advance if not. | :heavy_check_mark: |
| Pause and resume | Detect switch, show "Resume Tour" button. More explicit but adds UI. | |
| Cancel tour on switch | Treat view switch as dismissal. Simplest but frustrating. | |

**User's choice:** Re-query and skip missing
**Notes:** None

---

## Opt-In Prompt UX

### Prompt Style

| Option | Description | Selected |
|--------|-------------|----------|
| Toast with action button (Recommended) | Non-blocking toast: "New here? Take a quick tour — [Start Tour] [Dismiss]". Auto-dismiss ~8s. Uses ActionToast pattern. | :heavy_check_mark: |
| Popover near data | Tooltip anchored near SuperGrid. More contextual but needs floating-ui positioning. | |
| Welcome dialog | Modal dialog. Prominent but interrupts flow. Heavy for power-user tool. | |

**User's choice:** Toast with action button
**Notes:** None

### Prompt Frequency

| Option | Description | Selected |
|--------|-------------|----------|
| First import ever only (Recommended) | One-time prompt. Single ui_state flag. Least annoying. | :heavy_check_mark: |
| First import per dataset | Shows once per new dataset. More exposure but potentially annoying. | |

**User's choice:** First import ever only
**Notes:** None

---

## Claude's Discretion

- Exact 5-7 step selection and ordering beyond the 3 must-haves
- `data-tour-target` attribute naming convention
- driver.js configuration (popover style, animation, overlay opacity)
- Template syntax for axis substitution
- TourEngine class vs module design
- Command palette category for "Restart Tour"
- Re-query timing after view switch

## Deferred Ideas

None — discussion stayed within phase scope
