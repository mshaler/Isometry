# Time Series PAFV: Architecture Handoff
## SuperTime + Time Explorer — Design Decisions Before Implementation

*Isometry v6.x — Architect handoff to CC*
*Status: Pre-implementation — read this entire document before writing any code*

---

## Context

This document resolves the key architectural decisions governing time series projections in Isometry. It covers two related but distinct systems:

- **SuperTime** — a LATCH view that projects nodes onto a time axis (T → x-plane)
- **Time Explorer** — a filter navigation control for non-contiguous time range selection

These systems share a D3.js time layer but have fundamentally different jobs. Understanding the distinction is the prerequisite for all implementation work.

---

## The Core Distinction: Projection vs. Membership

This is the architectural insight that drives all decisions below.

**Projection** answers: *"Where does this node sit on the time axis?"*
This is SuperTime's job. It requires exactly one active T-axis facet per view — the facet that drives x-position. D3's `scaleTime` operates on this value.

**Membership** answers: *"Is this node currently in scope of the user's filter?"*
This is Time Explorer's job. It must reason across *all* of a node's time facets simultaneously. A node is in scope if any of its time attributes intersect the selected range(s).

These are separable concerns. Conflating them — for example, having Time Explorer only filter by the active projection facet — produces incorrect results. A task created in January, due in March, and completed in February should surface in a February selection regardless of which facet is currently driving x-position in SuperTime.

---

## Decision 1: Facet Role Flags

### The Problem

The existing `facets` table has `axis = 'T'` rows for `created_at`, `due_at`, `modified_at`, `event_start`, and `event_end`. Currently there is no way to distinguish which facets participate in projection (x-position) vs. which participate in membership (filter inclusion).

### The Decision

Add two boolean columns to the `facets` table:

```sql
ALTER TABLE facets ADD COLUMN projection_eligible INTEGER NOT NULL DEFAULT 1;
ALTER TABLE facets ADD COLUMN membership_eligible INTEGER NOT NULL DEFAULT 1;
```

Most T-axis facets are both. The flags allow future per-facet tuning without schema changes. For example, `created_at` might be membership-only for certain node types where creation time is noise rather than signal.

### Default Values for Existing T-Axis Facets

| facet id   | projection_eligible | membership_eligible | rationale |
|------------|--------------------|--------------------|-----------|
| created    | 1                  | 1                  | Both valid |
| modified   | 1                  | 1                  | Both valid |
| due        | 1                  | 1                  | Both valid |
| event_start| 1                  | 1                  | Both valid |
| event_end  | 0                  | 1                  | End point: membership yes, projection no |

`event_end` is excluded from projection because projecting a node to its end date while ignoring its start date produces misleading x-positions. It remains membership-eligible so events spanning a filter range are correctly included.

### Migration

This is a schema migration. Add it as `migrations/002_time_facet_roles.sql`. Do not modify the initial schema file.

```sql
-- migrations/002_time_facet_roles.sql
ALTER TABLE facets ADD COLUMN projection_eligible INTEGER NOT NULL DEFAULT 1;
ALTER TABLE facets ADD COLUMN membership_eligible INTEGER NOT NULL DEFAULT 1;

-- Correct event_end
UPDATE facets SET projection_eligible = 0 WHERE id = 'due' AND axis = 'T';
-- Note: due_at IS projection-eligible; only event_end is not.
UPDATE facets SET projection_eligible = 0 WHERE id = 'event_end';

INSERT INTO schema_migrations (version, description)
VALUES (2, 'Add projection_eligible and membership_eligible to facets');
```

---

## Decision 2: Active Projection Facet (SuperTime)

### The Problem

When a node has multiple T-axis facets with values (`created_at`, `due_at`, `modified_at`), SuperTime needs exactly one to determine the node's x-position. Which one, and how is it selected?

### The Decision

The active projection facet is a **per-view PAFV configuration**, stored as a setting, not hardcoded. The default is `due_at` when populated, falling back to `created_at`.

The view config object must carry:

```typescript
interface SuperTimeConfig {
  projectionFacetId: string;   // e.g. 'due' | 'created' | 'modified' | 'event_start'
  membershipFacetIds: string[]; // facets that participate in Time Explorer filtering
  granularity: 'd3TimeInterval'; // 'timeDay' | 'timeWeek' | 'timeMonth' | 'timeYear'
  // ... other PAFV config
}
```

`projectionFacetId` must reference a facet where `projection_eligible = 1`.

### Fallback Behavior

If a node has no value for the active `projectionFacetId`, it is rendered in a dedicated "undated" lane rather than hidden. Hiding undated nodes silently destroys data visibility. The undated lane is outside the D3 scale domain — render it as a separate visual band.

---

## Decision 3: Time Explorer Filter Semantics

### The Problem

Time Explorer supports non-contiguous range selection (multiple disjoint time windows). The filter must be applied correctly across all membership-eligible facets.

### The Decision

A node passes the Time Explorer filter if **any** of its membership-eligible facet values falls within **any** of the selected ranges. This is a union of interval intersections.

### SQL Pattern

```sql
-- $r1_start, $r1_end, $r2_start, $r2_end are the selected ranges
-- Add additional OR blocks for each additional range
WHERE (
  -- Range 1
  (created_at BETWEEN $r1_start AND $r1_end)
  OR (due_at    BETWEEN $r1_start AND $r1_end)
  OR (modified_at BETWEEN $r1_start AND $r1_end)
  OR (event_start BETWEEN $r1_start AND $r1_end)
  OR (event_end   BETWEEN $r1_start AND $r1_end)
)
OR (
  -- Range 2
  (created_at BETWEEN $r2_start AND $r2_end)
  OR (due_at    BETWEEN $r2_start AND $r2_end)
  OR (modified_at BETWEEN $r2_start AND $r2_end)
  OR (event_start BETWEEN $r2_start AND $r2_end)
  OR (event_end   BETWEEN $r2_start AND $r2_end)
)
AND nodes.deleted_at IS NULL
```

The TypeScript query builder must construct this dynamically from the active `membershipFacetIds` array and the current selection state. Do not hardcode facet names in the query builder — derive them from the facets table at runtime.

### Mode Flag (Future)

The current decision is ANY semantics (union). A future `membershipMode: 'any' | 'all'` flag on `SuperTimeConfig` can switch to ALL semantics (a node must have *all* of its populated membership facets within a selected range) without changing the query builder interface. Do not implement this now — stub the interface only.

---

## Decision 4: D3 Dependencies

### Approved Dependencies

These three packages are approved for addition. They are MIT licensed, tree-shakeable, and directly serve the PAFV T-axis mapping:

```
d3-time        — Calendar-aware intervals (timeDay, timeWeek, timeMonth, timeYear)
d3-time-format — Locale-aware display formatting
d3-scale       — scaleTime (maps T-axis values to x-plane pixel coordinates)
```

Install as named imports, not the full `d3` bundle:

```typescript
import { scaleTime } from 'd3-scale';
import { timeDay, timeWeek, timeMonth, timeYear } from 'd3-time';
import { timeFormat } from 'd3-time-format';
```

### Why These and Not Others

`d3-time`'s interval arithmetic handles DST transitions, month boundary arithmetic, and week-start conventions correctly. This is the class of bug that hand-rolled date math introduces. Use it.

`scaleTime` is the direct implementation of the T-axis → x-plane PAFV binding. It is not a convenience wrapper — it is the correct primitive for this job.

### d3-brush Decision (Deferred)

`d3-brush` is the natural primitive for Time Explorer's selection interaction but the standard brush is single-range. Non-contiguous selection requires either multiple brush instances or custom pointer-event-based selection.

**Do not implement Time Explorer interaction in this phase.** Build the filter query layer and the D3 time scale/axis rendering only. Time Explorer UX interaction is a separate work area that requires its own handoff, including a WKWebView pointer-event compatibility decision. Flag this boundary explicitly in your implementation.

---

## Decision 5: Undated Node Handling

Nodes without a value for the active projection facet must not be silently excluded from SuperTime. They must render in a clearly labeled "No Date" lane positioned outside the scale domain — either above or below the main timeline band. This is a product correctness requirement, not a nice-to-have.

The "No Date" lane participates in Time Explorer membership filtering via other facets. A node with no `due_at` but a `created_at` within the selected range is still in scope.

---

## Out of Scope for This Handoff

| Item | Reason |
|------|--------|
| Time Explorer pointer interaction | Requires separate WKWebView/brush decision |
| SuperTime → SuperGrid view transition animation | Phase 79 scope |
| Fiscal year / custom week-start configuration | Post-v1 |
| Edge timestamp projection | LATCH applies to edges too, but this is additive |
| `membershipMode: 'all'` implementation | Stub interface only |

---

## Success Criteria

CC's work is complete when:

1. `migrations/002_time_facet_roles.sql` exists and applies cleanly; `grep -c 'projection_eligible' isometry.db` (via `.schema`) returns non-zero.
2. `SuperTimeConfig` TypeScript interface is defined with `projectionFacetId`, `membershipFacetIds`, `granularity`.
3. `scaleTime` correctly maps node T-axis values to x-plane coordinates for all five projection-eligible facets.
4. The membership filter query builder dynamically constructs the multi-range, multi-facet SQL from `membershipFacetIds` — no hardcoded facet names.
5. Nodes with no projection facet value render in an "undated" lane, not hidden.
6. Vitest tests cover: scale mapping, fallback to undated lane, filter query construction for 1 range / 2 ranges / 3 ranges.
7. `grep -r 'import.*d3["\x27]' src/` returns nothing — only named sub-package imports are present.

---

## Anti-Patterns to Avoid

**Do not** filter Time Explorer by `projectionFacetId` only. This silently excludes nodes whose relevant time attribute differs from the active projection.

**Do not** hide undated nodes. Render them in the undated lane.

**Do not** import the full `d3` bundle. Named sub-package imports only.

**Do not** hardcode `created_at`, `due_at`, etc. in the query builder. Derive from the facets table.

**Do not** implement Time Explorer interaction (brush/pointer). The filter logic layer is in scope; the UX layer is not.

---

*Handoff author: Claude (architect)*
*Target executor: CC*
*Prerequisite phases: 78 complete, Phase 79 v6.1 Test Harness active*
