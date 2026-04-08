# Phase 133: Named Layout Presets - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 133-named-layout-presets
**Areas discussed:** Built-in preset content, Preset picker UI, Save custom preset flow, Dataset-to-preset association

---

## Built-in Preset Content

### Axis configuration scope

| Option | Description | Selected |
|--------|-------------|----------|
| Panel state only | Built-ins define expanded/collapsed. No PAFV axis override. Keeps presets generic across datasets. | ✓ |
| Panel + axis suggestions | Each preset suggests LATCH axis families. Falls back gracefully if fields missing. | |
| Full axis specification | Each preset defines exact colAxes/rowAxes fields. Most specific but most brittle. | |

**User's choice:** Panel state only
**Notes:** None

### Panel arrangements

| Option | Description | Selected |
|--------|-------------|----------|
| You decide | Claude determines sensible panel arrangements based on each preset's purpose | ✓ |
| Let me specify | User defines which panels are expanded/collapsed for each preset | |

**User's choice:** You decide
**Notes:** None

### Mutability

| Option | Description | Selected |
|--------|-------------|----------|
| Immutable | Always available, never editable. Users create custom presets to customize. | ✓ |
| Editable with reset | Users can modify built-in presets with a 'Reset to default' option. | |

**User's choice:** Immutable
**Notes:** None

---

## Preset Picker UI

### Browse and apply method

| Option | Description | Selected |
|--------|-------------|----------|
| Command palette only | New 'Presets' category in Cmd+K palette. Reuses existing CommandRegistry. | ✓ |
| Dropdown in panel rail header | Small dropdown button at top of panel rail. | |
| Both palette + dropdown | Command palette for keyboard, dropdown for mouse. | |

**User's choice:** Command palette only
**Notes:** None

### Category placement

| Option | Description | Selected |
|--------|-------------|----------|
| New 'Presets' category | Distinct grouping header in palette results. Requires union type extension. | ✓ |
| Under 'Actions' | Presets appear as actions. No category change needed. | |

**User's choice:** New 'Presets' category
**Notes:** None

---

## Save Custom Preset Flow

### Save method

| Option | Description | Selected |
|--------|-------------|----------|
| Command palette action | 'Save Layout as Preset' from Cmd+K, types name in text prompt. Minimal new UI. | ✓ |
| Dedicated save dialog | Small modal dialog with name field and optional description. | |
| Right-click panel rail | Context menu with 'Save as Preset...' option. | |

**User's choice:** Command palette action
**Notes:** None

### Preset management

| Option | Description | Selected |
|--------|-------------|----------|
| Delete only | Delete via command palette. No rename — delete and re-save. | ✓ |
| Delete and rename | Both delete and rename via command palette actions. | |
| No management | Presets permanent once saved. | |

**User's choice:** Delete only
**Notes:** None

---

## Dataset-to-Preset Association

### Association method

| Option | Description | Selected |
|--------|-------------|----------|
| Auto on apply | Applying a preset remembers the association. Implicit. | ✓ |
| Explicit 'Pin preset' action | Separate command to pin. Applying does NOT auto-associate. | |
| Source type based | Use source type to suggest presets. All CSVs get same suggestion. | |

**User's choice:** Auto on apply
**Notes:** None

### Prompt style on dataset switch

| Option | Description | Selected |
|--------|-------------|----------|
| Toast with Apply button | Non-blocking toast with [Apply] button. Dismisses after ~5s. | ✓ |
| Auto-apply silently | Automatically apply on switch. No prompt. | |
| Dialog confirmation | Modal dialog asking to apply. | |

**User's choice:** Toast with Apply button
**Notes:** None

---

## Claude's Discretion

- Specific panel arrangements for the 4 built-in presets
- Storage key naming convention for custom presets
- LayoutPresetManager architecture (class vs module)
- CommandPalette text input reuse for preset naming
- Toast message wording and duration

## Deferred Ideas

None — discussion stayed within phase scope
