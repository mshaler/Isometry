# Roadmap Fixes

**Issue Source:** Isometry v5 Roadmap Review
**Date:** 2026-02-28

---

## Finding 1 (High): Execution Model Contradiction

**Problem:** The roadmap says three conflicting things:
1. "Build follows a strict dependency graph"
2. "Phase 6 can run in parallel after Phase 3"
3. Progress section states "1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7"

**Resolution:** Dependency-driven execution is authoritative. Numeric order is the *default* when no parallelization is used, but the dependency graph permits parallelization.

**Clarifying Policy:**

```markdown
## Execution Policy

**Primary rule:** Dependency-driven execution. A phase can start when all its dependencies are complete.

**Dependency graph:**
- Phase 2 requires Phase 1
- Phase 3 requires Phase 2
- Phase 4 requires Phase 3
- Phase 5 requires Phase 4
- Phase 6 requires Phase 3 (NOT Phase 4 or 5)
- Phase 7 requires Phases 1-6

**Parallelization:**
- Phases 4 and 6 MAY execute in parallel after Phase 3 completes
- Phase 5 cannot start until Phase 4 completes (views require Providers)
- If not parallelizing, execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

**Progress tracking:**
- Track phase status, not execution sequence
- A phase is "In Progress" when its dependencies are complete and work has started
- A phase is "Complete" when all its requirements pass
```

**Action:** Update Progress section to remove "Execution Order" statement and replace with dependency-driven status tracking.

---

## Finding 2 (Medium): Requirement Count Mismatch

**Problem:** Roadmap says 78 requirements, REQUIREMENTS.md summary said 67.

**Resolution:** The corrected REQUIREMENTS.md (REQUIREMENTS-v5-CORRECTED.md) now shows:
- Web Runtime v1: 57 requirements (Phases 1-6)
- Native App v1: 10 additional requirements (Phase 7)
- Total: 67 requirements

The roadmap count of 78 appears to include some requirements that were consolidated or incorrectly counted. Let me reconcile:

**Roadmap enumeration analysis:**
- DB: 6
- CARD: 6
- CONN: 5
- SRCH: 7 (4 in Phase 2, 3 in Phase 5)
- PERF: 5 (4 in Phase 2, 1 in Phase 5)
- WKBR: 7 (4 in Phase 3, 3 in Phase 4)
- SAFE: 6
- PROV: 7
- VIEW: 13
- ETL: 6
- NSAFE: 10

Total: 6+6+5+7+5+7+6+7+13+6+10 = **78**

**REQUIREMENTS.md enumeration:**
Same categories, same counts = **78** (after I added SRCH-05..07 to Phase 5 and split WKBR across phases)

Wait — the corrected requirements I created earlier has 67. Let me recount that version:
- DB: 6
- SAFE: 6
- CARD: 6
- CONN: 5
- SRCH: 7
- PROV: 7
- WKBR: 7
- VIEW: 13
- ETL: 6
- PERF: 5
- NSAFE: 10

Total: 6+6+6+5+7+7+7+13+6+5+10 = **78**

**The counts match.** The "67" in the original REQUIREMENTS.md summary was a typo. Both documents agree on 78 requirements.

**Action:** Verify REQUIREMENTS-v5-CORRECTED.md coverage section shows 78, not 67.

---

## Finding 3 (Medium): Delete Lifecycle Under-Specified

**Problem:** Soft delete and hard delete semantics are unclear:
- When is hard delete allowed?
- Who triggers it?
- How does it interact with undo?

**Resolution:** Define explicit delete lifecycle:

```markdown
## Delete Lifecycle

### Soft Delete (User-Facing)
- **Trigger:** User deletes a card via UI (Delete key, context menu, etc.)
- **Effect:** `deleted_at` timestamp set; card excluded from normal queries
- **Reversible:** Yes, via undelete (CARD-06) or undo (WKBR-07)
- **Connections:** Soft-deleted cards retain their connections (hidden but intact)
- **Retention:** Soft-deleted cards remain indefinitely until hard deleted

### Hard Delete (System/Maintenance)
- **Trigger:** 
  - Explicit "Empty Trash" action by user
  - Automated cleanup after retention period (v2 feature, not in v1)
  - ETL re-import with `replace` mode (replaces entire source dataset)
- **Effect:** Row removed from `cards` table; `ON DELETE CASCADE` removes connections
- **Reversible:** No — not in undo stack, not recoverable
- **Undo interaction:** Hard delete clears any pending undo entries for that card

### Cascade Behavior
- Soft delete: Connections preserved (can be restored with card)
- Hard delete: `ON DELETE CASCADE` removes all connections where card is source or target
- `via_card_id` reference: Set to NULL on hard delete (does not cascade-delete the connection)

### v1 Scope
- Soft delete: Full support (CARD-04, CARD-06)
- Hard delete: Available via direct SQL or debug tools only
- "Empty Trash" UI: v2 feature
- Retention-based cleanup: v2 feature
```

**Action:** Add "Delete Lifecycle" section to ROADMAP.md or a referenced CONTRACTS.md.

---

## Finding 4 (Low): Planning Detail Front-Loaded

**Problem:** Phase 1 has detailed plans; Phases 2-7 are TBD.

**Resolution:** This is intentional — planning happens one phase ahead. As Phase 1 executes, Phase 2 plans are written. This prevents wasted planning effort if earlier phases reveal changes.

However, adding skeleton structure for Phases 2-4 is reasonable to improve predictability.

**Action:** Add skeleton plan structure to Phases 2-4:

```markdown
### Phase 2: CRUD + Query Layer
**Plans**: 5 estimated (3 waves)
- [ ] 02-01-PLAN.md -- Card CRUD TDD (Wave 1)
- [ ] 02-02-PLAN.md -- Connection CRUD TDD (Wave 1)
- [ ] 02-03-PLAN.md -- FTS5 Search TDD (Wave 2)
- [ ] 02-04-PLAN.md -- Graph traversal queries TDD (Wave 2)
- [ ] 02-05-PLAN.md -- Performance benchmarks + prepared statement patterns (Wave 3)

### Phase 3: Worker Bridge
**Plans**: 3 estimated (2 waves)
- [ ] 03-01-PLAN.md -- Worker setup + message protocol (Wave 1)
- [ ] 03-02-PLAN.md -- Database operation handlers (Wave 1)
- [ ] 03-03-PLAN.md -- Error propagation + serialization profiling (Wave 2)

### Phase 4: Providers + Mutation Safety
**Plans**: 4 estimated (2 waves)
- [ ] 04-01-PLAN.md -- FilterProvider + SQL safety TDD (Wave 1)
- [ ] 04-02-PLAN.md -- AxisProvider + DensityProvider + ViewProvider (Wave 1)
- [ ] 04-03-PLAN.md -- SelectionProvider + tier persistence (Wave 2)
- [ ] 04-04-PLAN.md -- MutationManager + undo/redo (Wave 2)
```

---

## Answers to Open Questions

> 1. Should roadmap execution be dependency-driven or numeric-driven?

**Dependency-driven.** Numeric order is the default sequence when not parallelizing, but the dependency graph is authoritative.

> 2. Is hard delete exposed to end users, or only to maintenance workflows?

**Maintenance only for v1.** Users can soft delete and undelete. Hard delete is available via debug tools or direct SQL. "Empty Trash" UI is a v2 feature.

> 3. Should requirement-count normalization happen immediately?

**Yes.** The count is 78 in both documents — the "67" was a summary typo. Corrected REQUIREMENTS.md should say 78.

---

## Summary of Required Changes

| Finding | Severity | Action | Owner |
|---------|----------|--------|-------|
| Execution model | High | Add "Execution Policy" section clarifying dependency-driven model | Architect |
| Requirement count | Medium | Verify both docs say 78; fix any "67" references | Architect |
| Delete lifecycle | Medium | Add "Delete Lifecycle" section defining soft/hard delete semantics | Architect |
| Planning detail | Low | Add skeleton plan structure for Phases 2-4 | Architect |

---

*Fixes documented: 2026-02-28*
*Source: Isometry v5 Roadmap Review*
