# Isometry v5 Decision Log

**Purpose:** Track architectural and product decisions required to clear the v5 implementation gate.  
**Status legend:** `Proposed` | `Decided` | `Implemented` | `Verified` | `Deprecated`

---

## Decision Index

| ID | Topic | Status | Target Date |
|---|---|---|---|
| D-001 | Graph model (edges vs relations) | Proposed | 2026-03-03 |
| D-002 | Canonical WorkerBridge spec | Proposed | 2026-03-03 |
| D-003 | SQL safety boundary | Proposed | 2026-03-04 |
| D-004 | FTS contract (fields + rowid joins) | Proposed | 2026-03-04 |
| D-005 | State persistence tiers | Proposed | 2026-03-04 |
| D-006 | Final v5 view enum + tier mapping | Proposed | 2026-03-05 |
| D-007 | Credential storage policy | Proposed | 2026-03-05 |
| D-008 | Schema-on-read extra fields storage | Proposed | 2026-03-06 |
| D-009 | Undo/redo architecture | Proposed | 2026-03-07 |
| D-010 | CloudKit sync trigger contract | Proposed | 2026-03-07 |

---

## D-001: Graph model (edges vs relations)

- **Status:** Proposed
- **Question:** Are edges first-class cards, or lightweight relations in `connections`?
- **Decision:** Use lightweight relations for v5 (`connections` with `via_card_id` for richness).
- **Rationale:** Lower schema complexity for v5; preserves rich relationship context via bridge cards.
- **Impacted docs/files:**
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Isometry v5 SPEC.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Cards.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/GraphExplorer.md`
- **Acceptance criteria:**
  - SPEC and modules use one consistent model.
  - No doc states both “edges are cards” and “connections are not cards.”

## D-002: Canonical WorkerBridge spec

- **Status:** Proposed
- **Question:** Which spec is canonical: `Modules/WorkerBridge.md` or `Modules/Core/WorkerBridge.md`?
- **Decision:** `Modules/Core/WorkerBridge.md` is canonical; `Modules/WorkerBridge.md` is redirect/stub only.
- **Rationale:** Single source of truth for protocol + handlers + API contracts.
- **Impacted docs/files:**
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/WorkerBridge.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/WorkerBridge.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Providers.md`
- **Acceptance criteria:**
  - Message envelope/type definitions exist in one place.
  - Provider examples compile against canonical bridge API.

## D-003: SQL safety boundary

- **Status:** Proposed
- **Question:** How are dynamic filters/formulas prevented from injecting SQL?
- **Decision:** Enforce allowlisted columns/operators + parameterized values only; disallow raw SQL fragments from UI/provider state.
- **Rationale:** Removes injection and invalid SQL composition risk.
- **Impacted docs/files:**
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Providers.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/FormulaExplorer.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/Contracts.md`
- **Acceptance criteria:**
  - Field registry documented.
  - SQL compiler tests include malicious payload attempts.

## D-004: FTS contract (fields + rowid joins)

- **Status:** Proposed
- **Question:** What is the canonical FTS schema and join strategy?
- **Decision:** Use `cards_fts` with `rowid` joins (`cards.rowid = cards_fts.rowid`) and canonical fields aligned to `cards` (`name`, `content`, `tags`, `folder`).
- **Rationale:** Prevents type mismatch and drift across docs.
- **Impacted docs/files:**
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Cards.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/SearchExplorer.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/Contracts.md`
- **Acceptance criteria:**
  - One canonical SQL snippet referenced by all modules.
  - No `c.id = fts.rowid` joins remain.

## D-005: State persistence tiers

- **Status:** Proposed
- **Question:** Is `SelectionProvider` persisted across restarts?
- **Decision:** `SelectionProvider` is Tier 3 ephemeral (session-only), not persisted.
- **Rationale:** Selection is transient UI context.
- **Impacted docs/files:**
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Isometry v5 SPEC.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Providers.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/Providers.md`
- **Acceptance criteria:**
  - Tier tables are consistent across docs.
  - Persistence examples exclude selection restore.

## D-006: Final v5 view enum + tier mapping

- **Status:** Proposed
- **Question:** Final set and naming for views (`gallery/charts` vs `calendar/table`)?
- **Decision:** Adopt one canonical enum and explicit tier availability matrix.
- **Rationale:** Prevents runtime/view-state incompatibilities.
- **Impacted docs/files:**
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Isometry v5 SPEC.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Views.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Providers.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/NativeShell.md`
- **Acceptance criteria:**
  - All docs reference the same enum values.
  - Tier gating in NativeShell matches enum.

## D-007: Credential storage policy

- **Status:** Proposed
- **Question:** Can OAuth tokens ever be stored in SQLite?
- **Decision:** Tokens/secrets are Keychain-only; SQLite may store non-sensitive metadata only.
- **Rationale:** Reduce credential leakage risk.
- **Impacted docs/files:**
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/SlackETL.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/NativeShell.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/Contracts.md`
- **Acceptance criteria:**
  - ETL examples never write tokens to SQLite.
  - Native action contract includes credential retrieval path.

## D-008: Schema-on-read extra fields storage

- **Status:** Proposed
- **Question:** Where do non-canonical imported fields go?
- **Decision options:**
  - Option A: `card_properties(card_id, key, value, type)` table (recommended).
  - Option B: `cards.metadata_json` with indexing strategy.
- **Rationale:** Needed to preserve source fidelity while keeping canonical card schema stable.
- **Impacted docs/files:**
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/DataExplorer.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Cards.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/FormulaExplorer.md`
- **Acceptance criteria:**
  - Chosen model documented with examples.
  - Query patterns and indexing policy documented.

## D-009: Undo/redo architecture

- **Status:** Proposed
- **Question:** Command log vs snapshot model?
- **Decision options:**
  - Option A: Command log with inverse operations (recommended for v5).
  - Option B: Periodic snapshots + deltas.
- **Rationale:** Must support deterministic local-first behavior and low-latency undo.
- **Impacted docs/files:**
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Isometry v5 SPEC.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/NativeShell.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/WorkerBridge.md`
- **Acceptance criteria:**
  - Undo/redo sequence defined for card mutations, layout changes, and bulk ETL imports.
  - Conflict behavior with sync documented.

## D-010: CloudKit sync trigger contract

- **Status:** Proposed
- **Question:** What exact events trigger checkpoint/export/push?
- **Decision:** Define dirty-flag + debounce + lifecycle triggers (`background`, `explicit save`, periodic).
- **Rationale:** Avoid excessive sync churn while preserving data durability.
- **Impacted docs/files:**
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/NativeShell.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/WorkerBridge.md`
  - `/Users/mshaler/Developer/Projects/Isometry/v5/Isometry v5 SPEC.md`
- **Acceptance criteria:**
  - Contract specifies who sets/clears dirty state.
  - Trigger matrix documented with timing/debounce values.

---

## Review Cadence

- **Daily:** Update status for any touched decision.
- **At spec freeze:** All `D-00x` entries must be at least `Decided`.
- **Before implementation complete:** All implementation-linked entries must be `Implemented` + `Verified`.

---

## Change Log

- **2026-02-28:** Initial decision log created from implementation gate review items.
