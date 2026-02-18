# Roadmap: Isometry

## Milestones

- ✅ **v7.0 Polymorphic Views & Apple Notes Sync** — Phases 110-117 (shipped 2026-02-17)
- ✅ **v6.8 CSS Primitives** — Phases 107-109 (shipped 2026-02-16)
- ✅ **v6.7 CSS Grid Integration** — Phase 106 (shipped 2026-02-16)
- ✅ **v6.6 CSS Grid SuperGrid** — Phase 105 (shipped 2026-02-15)
- ✅ **v6.5 Console Cleanup** — Phase 103 (shipped 2026-02-15)
- ✅ **v6.4 Hardcoded Values Cleanup** — Phases 100-102 (shipped 2026-02-15)
- ✅ **v6.3 SuperStack SQL Integration** — Phase 99 (shipped 2026-02-15)
- ✅ **v6.2 Capture Writing Surface** — Phases 94-98 (shipped 2026-02-14)
- ✅ **v6.1 SuperStack Enhancement** — Phases 89-93 (shipped 2026-02-14)
- 📋 **v6.0 Interactive Shell** — Phases 85-88 (deferred)
- ✅ **v5.x Foundation** — Phases 43-84 (shipped 2026-02-13)
- ✅ **v4.x SuperGrid** — Phases 34-42, 56-65 (shipped 2026-02-12)
- ✅ **v3.1 Live Database Integration** — Phases 18-27 (shipped 2026-02-01)

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 110 | v7.0 | 2/2 | ✅ Complete | 2026-02-17 |
| 111 | v7.0 | 3/3 | ✅ Complete | 2026-02-17 |
| 112 | v7.0 | 3/3 | ✅ Complete | 2026-02-17 |
| 113 | v7.0 | 2/2 | ✅ Complete | 2026-02-17 |
| 114 | v7.0 | 3/3 | ✅ Complete | 2026-02-17 |
| 115 | v7.0 | 3/3 | ✅ Complete | 2026-02-17 |
| 116 | v7.0 | 3/3 | ✅ Complete | 2026-02-17 |
| 117 | v7.0 | 4/4 | ✅ Complete | 2026-02-17 |

## Archived Milestones

<details>
<summary>✅ v7.0 Polymorphic Views & Apple Notes Sync (Phases 110-117) — SHIPPED 2026-02-17</summary>

**Goal:** Enable full Grid Continuum (Gallery/List/Kanban) with CSS primitives, complete Three-Canvas notebook integration, and replace alto-index.json with direct Apple Notes SQLite sync.

**Tracks:**
- Track A: View Continuum Integration (Phases 110-111)
- Track B: Technical Debt Sprint (Phase 112)
- Track C: Network/Timeline Polish (Phases 113-114)
- Track D: Three-Canvas Notebook (Phases 115-116)
- Track E: Apple Notes Direct Sync (Phase 117)

**Phases:**
- [x] Phase 110: View Continuum Foundation (2/2 plans)
- [x] Phase 111: View Continuum Integration (3/3 plans)
- [x] Phase 112: Technical Debt Sprint (3/3 plans)
- [x] Phase 113: Network Graph Integration (2/2 plans)
- [x] Phase 114: Timeline Preview Integration (3/3 plans)
- [x] Phase 115: Three-Canvas Layout (3/3 plans)
- [x] Phase 116: State & Polish (3/3 plans)
- [x] Phase 117: Apple Notes SQLite Sync (4/4 plans)

**Key Deliverables:**
- Full Grid Continuum (Gallery/List/Kanban) with TanStack Virtual
- ForceSimulationManager with lifecycle control
- Resizable Three-Canvas via react-resizable-panels v3
- Per-tab scroll/zoom persistence
- Direct Apple Notes SQLite sync (NoteStore.sqlite → sql.js)

**Archive:** `.planning/milestones/v7.0-ROADMAP.md`, `.planning/milestones/v7.0-REQUIREMENTS.md`

</details>

<details>
<summary>✅ v6.8 CSS Primitives (Phases 107-109) — SHIPPED 2026-02-16</summary>

Three-tier CSS architecture (tokens → primitives → chrome) with design tokens, layout primitives for all view types, and chrome components.

</details>

<details>
<summary>✅ v6.x Earlier Milestones — SHIPPED 2026-02-14 to 2026-02-16</summary>

See `.planning/milestones/` for archived roadmaps and requirements.

</details>

## Next Milestone

**v7.1 — Planning Phase**

Start with `/gsd:new-milestone` to:
1. Define focus areas (Interactive Shell? CloudKit sync? Performance?)
2. Generate research questions
3. Create requirements
4. Build roadmap

---
*Last updated: 2026-02-17 — v7.0 shipped*
