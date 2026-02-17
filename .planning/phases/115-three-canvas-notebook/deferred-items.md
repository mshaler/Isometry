# Phase 115: Deferred Items

**Phase:** 115-three-canvas-notebook
**Created:** 2026-02-17

## Deferred Requirements

The following requirements from `115-REQUIREMENTS.md` are **out of scope** for Phase 115 plans (01-02) and are deferred to Phase 116 or later.

### REQ-115-03: Capture -> Shell Data Flow (P1)
**Reason:** Focus Phase 115 on foundational layout (resizing) and core selection sync. Slash command data flow requires additional cross-canvas event infrastructure.
**Deferred To:** Phase 116 (planned for cross-canvas communication)

### REQ-115-04: Shell -> Preview Data Flow (P1)
**Reason:** Requires event-based communication layer between Shell and Preview. Phase 115 establishes selection sync pattern first; Shell->Preview flow builds on this.
**Deferred To:** Phase 116

### REQ-115-05: Capture Slash Commands (P1)
**Reason:** Slash command completeness (/save-card, /template, /link) requires sql.js integration work beyond selection sync scope.
**Deferred To:** Phase 116 or 117

### REQ-115-06: Preview Tab Completeness (P2)
**Reason:** Preview tabs (SuperGrid, Network, Timeline) were enhanced in Phases 113-114. Full verification and polish deferred to avoid scope creep in Phase 115 layout work.
**Deferred To:** Phase 117 (integration polish phase)

## What Phase 115 Covers

- **REQ-115-01:** Resizable Canvas Panels (115-01-PLAN.md)
- **REQ-115-02:** Cross-Canvas Selection Sync (115-02-PLAN.md)

These two P0 requirements establish the foundational UX for the three-canvas notebook. Deferred P1/P2 items build on this foundation.
