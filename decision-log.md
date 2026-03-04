# Isometry v5 Decision Log

**Purpose:** Track architectural and product decisions required to clear the v5 implementation gate.  
**Status legend:** `Proposed` | `Decided` | `Implemented` | `Verified` | `Deprecated`

---

## Decision Index

| ID | Topic | Status | Target Date |
|---|---|---|---|
| D-001 | Graph model (edges vs relations) | Decided | 2026-03-03 |
| D-002 | Canonical WorkerBridge spec | Decided | 2026-03-03 |
| D-003 | SQL safety boundary | Decided | 2026-03-04 |
| D-004 | FTS contract (fields + rowid joins) | Decided | 2026-03-04 |
| D-005 | State persistence tiers | Decided | 2026-03-04 |
| D-006 | Final v5 view enum + tier mapping | Decided | 2026-03-05 |
| D-007 | Credential storage policy | Decided | 2026-03-05 |
| D-008 | Schema-on-read extra fields storage | Decided | 2026-03-06 |
| D-009 | Undo/redo architecture | Decided | 2026-03-07 |
| D-010 | Sync trigger contract | Decided | 2026-03-07 |
| D-011 | Native SQLite migration (Phase 7) retired | Decided | 2026-03-04 |

---

## D-001: Graph model (edges vs relations)

- **Status:** Decided
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

- **Status:** Decided
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

- **Status:** Decided
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

- **Status:** Decided
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

- **Status:** Decided
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

- **Status:** Decided
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

- **Status:** Decided
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

- **Status:** Decided
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

- **Status:** Decided
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

## D-010: Sync trigger contract

- **Status:** Decided
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

## D-011: Native SQLite migration (Phase 7) retired

- **Status:** Decided
- **Decided:** 2026-03-04
- **Question:** Should Isometry migrate from the sql.js web runtime to a native Swift SQLite actor (the original Phase 7 plan)?
- **Decision:** No. Phase 7 is retired. The sql.js web runtime + WKWebView checkpoint shell is the permanent two-layer architecture, not a transitional state.
- **Rationale:**
  - **Performance is not a bottleneck.** sql.js with WAL mode, FTS5/BM25, an off-main-thread Worker, and a tuned page cache is sufficient at Isometry's target scale. The PAFV projection model is computationally cheap by design — axis remapping, not data transformation. Any future bottleneck will be in D3 rendering, not SQLite queries.
  - **The checkpoint sync model is correct, not a workaround.** Whole-database iCloud ubiquity container sync is more appropriate for a local-first tool than record-level CloudKit push/pull. It syncs a fully consistent database state atomically, eliminates record-level conflict surface area, and matches the mental model of "my database, on all my devices."
  - **The shell boundary is clean and complete.** The WKWebView shell does exactly what it should: deliver the runtime to the platform, persist the database opaquely, and expose the handful of capabilities only Swift can provide. It does not need to grow.
  - **Phase 7 would require a full rewrite for no user-visible benefit.** The native SQLite path would mean reimplementing the schema, FTS5, graph CTEs, and migration system in Swift; building a query-level bridge to replace the checkpoint bridge; maintaining two schema sources of truth during transition; porting or abandoning JS ETL adapters; and losing the portability of the JS runtime permanently.
  - **The three-way architecture review validated the current model.** Multi-session review by Claude Code, Claude AI, and Codex/Gemini confirmed the v2.0 architecture is internally consistent and correctly scoped. The original Phase 7 plan was written before the web runtime was proven and before D-001–D-010 were locked.
- **What this means for implementation:**
  - Remove all "transitional" language from shell documentation. The shell is done.
  - `SQLITE-MIGRATION-PLAN-v2.md` and the original root `CLAUDE.md` (the Swift Package plan) are archived reference material, not active specs.
  - The native shell `CLAUDE.md` (`native/Isometry/CLAUDE.md`) is the authoritative shell guide.
  - If platform features genuinely requiring native SQLite access emerge in the future (background processing, app extensions, widget kit), that need will drive a scoped, justified decision — not a speculative pre-build.
- **Superseded document:** `SQLITE-MIGRATION-PLAN-v2.md` (describes the retired architecture)
- **No impacted files require code changes.** The v2.0 implementation already reflects this decision.

---

## Review Cadence

- **Daily:** Update status for any touched decision.
- **At spec freeze:** All `D-00x` entries must be at least `Decided`.
- **Before implementation complete:** All implementation-linked entries must be `Implemented` + `Verified`.

---

## Change Log

- **2026-02-28:** Initial decision log created from implementation gate review items.
- **2026-03-04:** D-011 added — Phase 7 native SQLite migration retired following multi-session architecture review.
