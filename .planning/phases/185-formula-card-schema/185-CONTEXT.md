# Phase 185: Formula Card Schema - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Define the complete `formula_cards` SQLite table specification as `03-formula-card-schema.md`. Covers: DDL with all 13 columns and constraints, type-signature validation algorithm with extensibility mechanism, versioning strategy (every save = new version row, canonical_id = stable identity), chip↔card promotion API signatures, and sync conflict resolution for three scenarios. Deliverable is a spec document, no code. All outputs land in `.planning/milestones/v15.0-formulas-explorer/`.

</domain>

<decisions>
## Implementation Decisions

### Column Storage Shapes
- **D-01:** All structured fields (type_signature, dependencies, provenance) stored as JSON TEXT columns. Matches existing pattern (cards.tags is JSON array). No junction tables. Entire row is self-contained — simplifies versioning since each version row carries its full state.
- **D-02:** `dsl` and `sql` stored as separate TEXT columns. DSL is the human-authored source; SQL is the compiled output. Allows re-compilation without losing the original DSL and enables explain panel to show compiled SQL directly.

### Sync Conflict Strategy
- **D-03:** Keep-both (version fork) for all three sync conflict scenarios:
  - **Concurrent edit:** Both versions retained as separate version rows under the same canonical_id. User sees conflicted versions and picks one.
  - **Delete-while-editing:** Deleted card gets a "resurrection" version — the edit survives as a new version row. User resolves by confirming delete or keeping the edit.
  - **Type-signature change:** Both type-signature variants retained as version rows. User resolves which signature is canonical.
- **D-04:** Uniform strategy across all three scenarios — consistent mental model, no scenario-specific branching in the sync logic.

### Promotion API
- **D-05:** Two core functions forming a bidirectional pair:
  - `promoteToCard(chipArrangement: ChipWellOutputContract) → FormulaCard` — chip→card save (creates new card with version 1)
  - `hydrateChips(card: FormulaCard) → ChipWellOutputContract` — card→chip load (populates wells from saved card)
- **D-06:** Separate `validatePromotion(chipArrangement: ChipWellOutputContract) → ValidationResult` pre-check function. Runs type-signature validation before saving. Returns errors/warnings without creating a version row. Aligns with CARD-02 (type-signature validation algorithm).

### Visibility & Locking
- **D-07:** `visibility TEXT DEFAULT 'active'` with CHECK constraint for ('active', 'archived', 'locked'). At v1, only 'active' and 'archived' are used by the runtime. 'locked' means read-only (protect formulas from accidental edits) — a single-user concept. Future collaboration values (shared, private) will extend the CHECK constraint via migration.
- **D-08:** Locking is a visibility state, not a separate column. A locked card has `visibility = 'locked'`. Simpler schema, fewer columns. Orthogonal concerns (if needed later) can be added via new columns at that time.

### Carried Forward (Locked)
- Every save creates a new version row; canonical_id is stable identity for cross-version references (STATE.md, ROADMAP SC-3)
- Retain all versions, no coalescing/pruning at v1 (STATE.md)
- Dataset-scoped at v1; story-scoped and global deferred (STATE.md)
- Type signatures extensible for richer types (arrays, JSON, geo shapes) from day one (STATE.md)
- ChipWellOutputContract is the seam interface consumed by promotion (Phase 183, GEOM-05)
- Compilation pipeline produces `(sql, params)` tuples following FilterProvider.compile() pattern (Phase 184, D-05)
- Cross-well drag: copy by default, modifier key for move, never reject (STATE.md)

### Claude's Discretion
- Exact CHECK constraint values for `scope` column (dataset/story/global — dataset-only at v1)
- Default values and nullability for optional columns (performance_hint, provenance, content)
- Index design for the formula_cards table (covering indexes, version lookup patterns)
- Exact JSON schema shapes for type_signature and dependencies columns
- Pseudocode style for type-signature validation algorithm
- Number and selection of worked examples for type-signature validation beyond the required facet_type coverage

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture Source
- `.planning/formulas-explorer-handoff-v2.md` §WA-3 (lines 207-227) — Primary guidance for this phase. Specifies the 13-column list, type-signature validation, versioning strategy, promotion API, visibility rules, and sync interactions.

### Three-Explorer Boundary Spec (Phase 182 output)
- `.planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` — Defines chip well categories and type signatures per explorer. Formula cards store these type signatures.

### Compilation Pipeline Spec (Phase 184 output)
- `.planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md` — Defines how chip arrangements compile to SQL. The promotion API bridges between this pipeline and saved cards.

### Chip-Well Geometry Contract (Phase 183 output)
- `.planning/milestones/v15.0-formulas-explorer/06-chip-well-geometry.md` — Defines ChipWellOutputContract seam interface. §4 (data binding) and §9 (composition) are the key sections for the promotion API.

### Existing Schema (codebase)
- `src/database/schema.sql` — Current cards/connections/FTS5 DDL. Pattern reference for column types, constraints, indexes, and naming conventions.
- `src/database/queries/graph-metrics.ts` — DDL constant export pattern (`GRAPH_METRICS_DDL`). The formula_cards DDL should follow this pattern.

### Existing Sync Model (codebase)
- `src/native/NativeBridge.ts` — CKSyncEngine sync patterns, last-writer-wins conflict resolution on cards. The keep-both fork strategy for formula_cards is a deliberate departure from this pattern.

### Requirements
- `.planning/REQUIREMENTS.md` — Requirements CARD-01 through CARD-05 define acceptance criteria for this phase.

### Prior Decisions
- `.planning/STATE.md` §Accumulated Context — Contains locked decisions on versioning, scope, type extensibility, and cross-well drag from the questioning session.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/database/schema.sql` — DDL pattern: TEXT PRIMARY KEY, CHECK constraints, DEFAULT expressions, partial indexes with WHERE deleted_at IS NULL
- `src/database/queries/graph-metrics.ts` — DDL-as-constant pattern: `export const GRAPH_METRICS_DDL = \`CREATE TABLE IF NOT EXISTS...\``
- `src/worker/worker.ts` — Table creation in worker initialize handler with `CREATE TABLE IF NOT EXISTS` idempotency

### Established Patterns
- JSON arrays in TEXT columns (cards.tags pattern)
- ISO 8601 timestamps via `strftime('%Y-%m-%dT%H:%M:%SZ', 'now')` defaults
- TEXT PRIMARY KEY with application-generated UUIDs
- Soft delete via `deleted_at TEXT` column
- Partial indexes scoped to `WHERE deleted_at IS NULL`
- CloudKit sync via CKSyncEngine actor with JSONEncoder state serialization
- SyncMerger: incoming records merged via INSERT OR REPLACE

### Integration Points
- Worker bridge — formula_cards DDL would be run in worker initialize handler alongside existing schema
- CKSyncEngine — formula_cards would register as a new record type for CloudKit sync
- SchemaProvider — would need to recognize formula_cards for any cross-table queries
- FormulasPanelStub.ts — current stub panel that will eventually host the Formulas Explorer UI

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond what the handoff document WA-3 section and resolved open questions provide. The handoff is the canonical source — the schema spec formalizes it with the decided storage shapes, sync strategy, and API granularity.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 185-formula-card-schema*
*Context gathered: 2026-04-27*
