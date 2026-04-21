# Phase 145 Handoff: Revision Note

**Target:** `.planning/milestones/v13.0-superwidget-substrate/145-00-HANDOFF.md`
**Revision:** 145-00-HANDOFF r2
**Scope:** Three targeted adjustments before WA-1 starts. No structural changes to work areas or test strategy.

---

## Summary

The handoff as written is ready to execute. This revision resolves one substantive concern (status slot lacks a concrete first tenant) and requests confirmation on two conventions (component framework, test-path layout, phase numbering).

---

## Adjustment 1 — Status slot: name a first tenant

**Current state (Resolved Design Question #8):** Status slot is always present, zero-height when empty, "exploratory territory — build it in to see where it leads."

**Concern:** An invariant-substrate slot justified by "exploratory" reasoning sets a precedent that speculative structure is fine. If no zone uses status through v13.1 → v13.3, it's dead DOM. If a real status need lands later, the shape imagined in v13.0 may not fit.

**Revision:** Name Integrate zone ingestion counts as the first tenant. Status slot exists in v13.0 with a known consumer in v13.1.

### Changes to 145-00-HANDOFF.md

**In the Resolved Design Questions table, replace row 8:**

| # | Question | Decision | Rationale |
|---|---|---|---|
| 8 | Status slot | **Always present**, zero-height when empty | First tenant is Integrate zone ingestion counts (landing in v13.1 Data Explorer Canvas). Slot is invariant substrate because it has a known consumer, not because it might have one. Other zones may adopt it (selection counts in Visualize, result-set counts in Analyze) as they implement. |

**In the Decision Log at the bottom, replace the status row:**

| Decision | Choice | Rationale |
|---|---|---|
| Status slot always present | Zero-height when empty; first tenant is Integrate ingestion counts in v13.1 | Known consumer justifies substrate inclusion |

**Add to WA-1 Regression guards (after the existing status slot guard):**

- Status slot exposes a stable DOM contract for future consumers: a `data-slot="status"` element whose children are replaced by the active Canvas (or left empty). No consumer in v13.0; Integrate zone's Data Explorer Canvas is the first in v13.1.

**Add to WA-4 stub notes:** `ExplorerCanvasStub` does not populate status in v13.0. Real Data Explorer Canvas in v13.1 will emit ingestion count text into the status slot; the stub leaves it empty to preserve the zero-height invariant.

**No test additions required for v13.0.** Status slot remains empty across all WA-4 stubs and WA-5 integration tests. The slot's contract is structural (exists in DOM, zero-height when empty), not behavioral (which is v13.1's concern).

---

## Adjustment 2 — Confirm before WA-1 starts

Two codebase conventions the handoff leaves implicit. Please confirm with a one-line answer before WA-1 so there's no guess-and-revise cycle.

### 2a. Component framework convention

The handoff specifies `src/superwidget/SuperWidget.ts` but doesn't pin *what kind* of component. The codebase has no React. Candidates:

- Plain TypeScript class with explicit `render()` / `mount(el)` / `unmount()` lifecycle
- Custom element (`extends HTMLElement`)
- Function returning a DOM node, with a separate projection-commit handler
- Other pattern already established in `src/`

Whichever matches existing SuperGrid / Explorer panel implementations is the right answer. Please confirm the pattern and name it in WA-1's Pre-conditions.

### 2b. Test-path convention

The handoff mixes colocated unit tests (`src/superwidget/projection.test.ts`) with a separate integration tests directory (`tests/superwidget/SuperWidget.integration.test.ts`). If the codebase convention is uniform (all tests colocated, or all tests under `tests/`), both locations should match it.

Please confirm and adjust all five grep-based success criteria in WA-1 through WA-5 to point at the correct path. The grep checks are the gate; wrong paths produce false-green results.

---

## Adjustment 3 — Phase numbering confirmation (not a change request)

The handoff footer reads:

> *Phase numbering: continues from v10.2 Phase 144*
> *Milestone versioning: v13.0 (follows v12.0 Explorer Panel Polish)*

This means the project now runs two parallel numbering schemes: sequential phase numbers (144, 145, ...) and versioned milestone groupings (v12.0, v13.0, v13.1, ...). If this is the established go-forward convention, no change is needed here — just confirmation so future handoffs align from the start and memory can be updated accordingly.

Specific questions:

1. Are subsequent Canvas milestones numbered as v13.1 / v13.2 / ... with their own phase numbers (146, 147, ...)? Or does the phase counter pause during a version group and resume between?
2. Is v12.0 → v13.0 the correct ordering (implying no v12.x sub-milestones remain), or is v13.0 opening while v12.x is still in flight?

Answers shape how I name and number subsequent handoffs (v13.1 Data Explorer, v13.2 SuperGrid View, etc.).

---

## What does not change

For the avoidance of doubt, the following parts of 145-00-HANDOFF r1 are **unchanged** and proceed as written:

- Four-slot substrate (header, canvas, status, tabs-with-config-child)
- Projection type and transition function signatures
- Resolved Design Questions 1–7
- All five work areas, their red-first gates, and their anti-patching rules
- Permanent regression guards (no `style.display = ''`, no orphan `<link>`, no `:has()` behavioral, no `alert`/`confirm`)
- Success criteria for milestone v13.0 (five numbered items)
- What This Unblocks (v13.1 through v13.6 Canvas milestones)

The four-slot decision in particular (config as tab child, not peer slot) stands — the adjustment above does not reopen it.

---

## Execution gate

WA-1 may start once:

1. Adjustment 1 is applied to the handoff text (status slot rationale + regression guard).
2. Adjustment 2 is answered (framework pattern + test path convention) and the relevant sections/grep checks are updated.
3. Adjustment 3 is confirmed (phase numbering convention) — no handoff edit required unless the convention differs from what's already written.

All three are one-sitting adjustments. No architectural revisit.

---

*Revision authored: 2026-04-21*
*Supersedes clarification needs only; base handoff r1 otherwise intact.*
