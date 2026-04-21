# Phase 167: ExplorerCanvas Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 167-explorercanvas-core
**Areas discussed:** Section re-use strategy, Callback wiring, Sidebar coexistence

---

## Section Re-use Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Mount whole DataExplorerPanel | Create a DataExplorerPanel instance, call mount() into canvas slot. All 4 sections appear as-is. No refactoring. | ✓ |
| Extract section builders | Refactor _build*Section() methods into standalone exported functions. DataExplorerPanel becomes thin wrapper. | |
| Re-parent existing DOM | Move already-mounted sidebar DOM node into SuperWidget canvas slot. | |

**User's choice:** Mount whole DataExplorerPanel inside canvas slot
**Notes:** Simplest approach — zero refactoring. Aligns with EXCV-04 requirement to re-use existing builders. Phase 168 can hide/show sections for tabs later.

---

## Callback Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Widen factory signature | Add config bag to CanvasRegistryEntry.create() for passing callbacks. Changes v13.0 contract. | |
| Closure capture | Register ExplorerCanvas in main.ts where callbacks close over bridge/worker/UI scope. Factory signature unchanged. | ✓ |
| Event bus / pub-sub | ExplorerCanvas fires custom DOM events, main.ts listens. No direct callback dependency. | |

**User's choice:** Closure capture at registration time
**Notes:** Lightest touch. Existing registerAllStubs() already uses closures. Real registration happens in main.ts where all 7 callbacks are available.

---

## Sidebar Coexistence

| Option | Description | Selected |
|--------|-------------|----------|
| Replace sidebar instance | Remove sidebar DataExplorerPanel. SuperWidget canvas is the only host. | ✓ |
| Two independent instances | Keep sidebar + add SuperWidget instance. Both wire to same bridge callbacks. | |
| Migrate on mount | Destroy sidebar instance when SuperWidget mounts; re-mount on destroy. One at a time. | |

**User's choice:** Replace — remove sidebar DataExplorerPanel entirely
**Notes:** SuperWidget canvas slot becomes sole home. Avoids duplicate UI. Means SuperWidget must be visible for users to access import/export/catalog.

---

## Claude's Discretion

- ExplorerCanvas internal class structure
- Sidebar DataExplorerPanel cleanup in main.ts
- Whether registerAllStubs() is replaced or supplemented

## Deferred Ideas

None — discussion stayed within phase scope.
