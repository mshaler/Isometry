# Isometry v5 Implementation Gate Review

## Gate Status
**Status:** `BLOCKED`  
**Reason:** Core contracts are still inconsistent across spec/modules, with security and implementation ambiguity that can cause regressions or rework.

---

## Blocking Issues (Must Resolve Before Build-Out)

### 1. Contradictory graph model: "edges are cards" vs "lightweight relations"
- **Impact:** Breaks schema, ETL mapping, graph query semantics, and UI behavior.
- **Required decision:** Pick one canonical model for v5 and update all modules.
- **Primary refs:**
  - [Isometry v5 SPEC.md:43](/Users/mshaler/Developer/Projects/Isometry/v5/Isometry%20v5%20SPEC.md:43)
  - [Isometry v5 SPEC.md:84](/Users/mshaler/Developer/Projects/Isometry/v5/Isometry%20v5%20SPEC.md:84)
  - [Cards.md:118](/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Cards.md:118)
  - [Cards.md:208](/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Cards.md:208)

### 2. WorkerBridge contracts are split/incompatible
- **Impact:** Provider/runtime integration cannot be implemented safely from docs alone.
- **Required decision:** Declare one canonical WorkerBridge protocol and deprecate the other doc.
- **Primary refs:**
  - [WorkerBridge.md:63](/Users/mshaler/Developer/Projects/Isometry/v5/Modules/WorkerBridge.md:63)
  - [Core/WorkerBridge.md:53](/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/WorkerBridge.md:53)
  - [Providers.md:1045](/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Providers.md:1045)

### 3. SQL safety boundary is not enforceable from current provider examples
- **Impact:** Potential SQL injection and invalid query generation.
- **Required decision:** Enforce allowlisted field registry + parameterized values only; disallow raw SQL fragments from UI/provider state.
- **Primary refs:**
  - [Providers.md:238](/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Providers.md:238)
  - [Providers.md:242](/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Providers.md:242)
  - [Providers.md:273](/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Providers.md:273)

### 4. Search/FTS contracts still drift across docs
- **Impact:** Wrong joins, broken search behavior, and dev confusion.
- **Required decision:** Pin one FTS contract (`rowid` join strategy + canonical field names), then reuse shared snippets everywhere.
- **Primary refs:**
  - [Cards.md:150](/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Cards.md:150)
  - [SearchExplorer.md:40](/Users/mshaler/Developer/Projects/Isometry/v5/Modules/SearchExplorer.md:40)
  - [Core/Contracts.md:380](/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/Contracts.md:380)

---

## Required Decisions (Before Next Spec Freeze)

1. **State tier policy:** confirm whether `SelectionProvider` is Tier 3 ephemeral or persisted globally.
2. **Canonical view enum:** resolve `Gallery/Charts` vs `Calendar/Table` drift and publish one source.
3. **Credential policy:** confirm Slack tokens are Keychain-only; define what metadata may be persisted in SQLite.
4. **Schema-on-read extras:** define where non-canonical source fields live (`card_properties` table or strict JSON policy).
5. **Undo/redo architecture:** choose command-log vs snapshot model for v5.

---

## Non-Blocking Improvements (Can Follow After Gate Pass)

1. **Formula execution placement:** Keep SQL-first aggregations in Worker; only run advanced formula logic where data transfer costs are controlled.
2. **Region density scope:** Treat per-region density overrides as Phase 2 unless a minimal implementation is needed for MVP.
3. **Mutation queueing:** Add only if measured race/reorder issues appear under stress tests.
4. **CloudKit sync trigger contract:** Specify exactly when JS marks DB dirty and when native shell checkpoints/pushes.

---

## Clarifying Questions to Close Immediately

1. Are edges modeled as lightweight `connections` only for v5?
2. Is `/Modules/Core/WorkerBridge.md` the single canonical protocol?
3. Is selection strictly within-session (no restart persistence)?
4. What is the final v5 view set and tier mapping?
5. Are OAuth tokens ever allowed in SQLite, or strictly Keychain-only?

---

## Go/No-Go Checklist

Release from `BLOCKED` only when all are true:
- [ ] One canonical contracts document exists and is referenced by all core modules.
- [ ] WorkerBridge protocol is singular and consistent with providers.
- [ ] SQL safety policy is explicit and testable.
- [ ] FTS contract is consistent across Cards/Search/Worker docs.
- [ ] State persistence tiers are consistent in spec and providers.
- [ ] Credential storage policy is explicit and aligned in ETL + native shell docs.
