# Phase 162: Substrate Layout - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 162-substrate-layout
**Areas discussed:** CSS file strategy, Tab bar: new vs reuse, SuperWidget class API, DOM structure details

---

## CSS File Strategy

### Token & file location

| Option | Description | Selected |
|--------|-------------|----------|
| Single superwidget.css | Matches --sg-* in supergrid.css and --pv-* in pivot.css precedent. Tokens + layout rules + slot styling all in one file. | ✓ |
| Tokens in design-tokens.css | Add --sw-* tokens to global file, keep layout separate. Centralizes tokens but breaks co-location. | |
| CSS module | superwidget.module.css for scoped class names. More isolation but adds complexity. | |

**User's choice:** Single superwidget.css (Recommended)

### CSS scoping strategy

| Option | Description | Selected |
|--------|-------------|----------|
| data-slot attributes | Selectors like [data-slot="header"]. Consistent with data-attribute patterns across codebase. | ✓ |
| BEM-style classes | .sw-header, .sw-canvas etc. Simpler selectors but redundant naming layer. | |
| You decide | Claude picks based on codebase patterns. | |

**User's choice:** data-slot attributes (Recommended)

---

## Tab Bar: New vs Reuse

### Tab bar approach

| Option | Description | Selected |
|--------|-------------|----------|
| New tab bar in SuperWidget | SuperWidget owns its tab DOM directly. Keeps ViewTabBar independent. | ✓ |
| Extract shared TabBar base | Factor common tab rendering into shared base. More DRY but couples evolution paths. | |
| You decide | Claude picks based on complexity analysis. | |

**User's choice:** New tab bar in SuperWidget (Recommended)

### Edge fade visual

| Option | Description | Selected |
|--------|-------------|----------|
| Standard linear gradient fade | Both-edge mask-image linear gradient (transparent → black → transparent). | ✓ |
| Only fade the right edge | Left edge stays sharp, right edge fades. | |
| You decide | Claude picks best visual approach. | |

**User's choice:** Standard linear gradient fade

---

## SuperWidget Class API

### Slot accessors

| Option | Description | Selected |
|--------|-------------|----------|
| Public getters now | Expose headerEl, canvasEl, statusEl, tabsEl as read-only getters from day one. | ✓ |
| Internal only, add later | Keep slot elements private. Phase 164 adds getters when needed. | |
| You decide | Claude picks based on downstream phase needs. | |

**User's choice:** Public getters now (Recommended)

### Event emission

| Option | Description | Selected |
|--------|-------------|----------|
| No events in Phase 162 | Pure DOM skeleton + lifecycle. Events arrive with projection state in Phase 163/164. | ✓ |
| EventTarget base from day one | Extends EventTarget so Phase 163+ can dispatch immediately. | |
| You decide | Claude picks based on complexity. | |

**User's choice:** No events in Phase 162 (Recommended)

---

## DOM Structure Details

### Grid row order

| Option | Description | Selected |
|--------|-------------|----------|
| header / tabs / canvas / status | IDE-style layout. Tabs below header, canvas gets flex space, status at bottom. | ✓ |
| header / canvas / status / tabs | Canvas immediately below header. Tabs at bottom like terminal panel. | |
| tabs / header / canvas / status | Tabs on top like browser tabs. Header becomes toolbar below. | |

**User's choice:** header / tabs / canvas / status (Recommended)

### Config gear placement

| Option | Description | Selected |
|--------|-------------|----------|
| Child inside tabs slot | Last child with data-tab-role="config" and margin-left: auto. Matches roadmap spec. | ✓ |
| Separate grid column | Tabs and config gear as sibling grid items in nested grid. | |

**User's choice:** Child inside tabs slot (Recommended)

---

## Claude's Discretion

- Exact --sw-* token names and values
- Grid gap values and slot padding
- Config gear placeholder content
- Status slot min-height: 0 implementation detail

## Deferred Ideas

None — discussion stayed within phase scope.
