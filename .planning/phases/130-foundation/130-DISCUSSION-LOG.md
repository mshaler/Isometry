# Phase 130: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 130-foundation
**Areas discussed:** Key namespace format, Migration strategy, isSwitching guard behavior, Default dataset scoping

---

## Key Namespace Format

| Option | Description | Selected |
|--------|-------------|----------|
| Domain-first | `pafv:{datasetId}:rowAxes` — groups by domain, matches existing `notebook:{cardId}` pattern | ✓ |
| Dataset-first | `{datasetId}:pafv:rowAxes` — groups by dataset, easy to delete all keys for a dataset | |
| Flat with separator | `pafv.rowAxes.{datasetId}` — dot-separated, dataset as suffix | |

**User's choice:** Domain-first
**Notes:** Consistent with existing `notebook:{cardId}` precedent from v5.2

---

## Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Eager rename | On boot, detect flat keys and rename to active dataset namespace. Clean cutover. | ✓ |
| Lazy on-read | Fall back to flat key on miss, migrate on next write. Dual keys linger. | |
| Dual-write period | Write to both flat and namespaced keys for N sessions, then drop flat. | |

**User's choice:** Eager rename
**Notes:** Simple, one-time migration. Old keys removed after rename.

---

## isSwitching Guard Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Silently drop | `_isSwitching = true` during switchTo(). Notifications ignored. New view gets fresh data on mount. | ✓ |
| Queue and replay | Buffer notifications during switch, replay after mount. Guarantees no notification missed. | |
| Block writes | Prevent providers from notifying at all during switches. Tighter coupling. | |

**User's choice:** Silently drop
**Notes:** New view fetches fresh data on mount, so dropped notifications cause no data loss.

---

## Default Dataset Scoping

| Option | Description | Selected |
|--------|-------------|----------|
| Split: scoped + global | Provider state keys (pafv, filter, density, sort) namespaced. Global keys (theme, sidebar, tour) stay flat. | ✓ |
| Everything scoped | All keys get `{datasetId}` namespace including theme/sidebar. | |
| You decide | Claude picks the right split. | |

**User's choice:** Split: scoped + global
**Notes:** StateManager distinguishes scoped vs global providers at registration time.

---

## Claude's Discretion

- Which specific provider keys are scoped vs global
- Migration detection heuristic for flat vs already-namespaced keys
- `preset:` prefix rejection mechanism in StateManager.registerProvider()

## Deferred Ideas

None — discussion stayed within phase scope
