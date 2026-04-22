# Phase 177: Tab Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 177-tab-persistence
**Areas discussed:** SuperWidgetStateProvider shape, Boot sequencing

---

## SuperWidgetStateProvider Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Full PersistableProvider class | SuperWidgetStateProvider implementing PersistableProvider, registered with StateManager. Gets auto-persist, debounced writes, schema migration, corrupt-JSON isolation. | ✓ |
| Direct ui:set/ui:get | SuperWidget calls bridge.send directly. Simpler but bypasses StateManager — no debouncing, no auto-persist, no migration, divergent pattern. | |

**User's choice:** Full PersistableProvider class
**Notes:** On-pattern with existing Tier 2 providers. Tab state changes frequently (every switch) so debounced writes matter.

---

## Boot Sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| Delayed restore | Register provider early, skip during main sm.restore(). Targeted restore after canvas registration. Surgical — no boot reorder. | ✓ |
| Reorder main.ts boot | Move canvas registration before sm.restore(). Simpler conceptually but pulls a lot of wiring earlier in boot sequence. | |

**User's choice:** Delayed restore
**Notes:** More surgical — only changes tab persistence timing. StateManager already supports per-key persist(), per-key restore is a natural extension.

---

## Claude's Discretion

- Tab state JSON serialization shape
- Per-key restore mechanism (new StateManager method vs external)
- How SuperWidgetStateProvider receives tab change notifications
- resetToDefaults() behavior (single default tab vs empty)
- Migration logic for fresh sessions (PRST-04)

## Deferred Ideas

None — discussion stayed within phase scope.
