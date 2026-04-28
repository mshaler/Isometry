# Phase 185: Formula Card Schema - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 185-formula-card-schema
**Areas discussed:** Column Storage Shapes, Sync Conflict Strategy, Promotion API Granularity, Visibility & Locking

---

## Column Storage Shapes

### Q1: How should type_signature and dependencies be stored?

| Option | Description | Selected |
|--------|-------------|----------|
| All JSON text columns | type_signature, dependencies, and provenance as JSON TEXT columns. Matches existing patterns (tags is JSON array). Simpler DDL, no junction tables, easy to version since entire row is self-contained. | ✓ |
| Junction table for dependencies | Dependencies as a separate formula_card_deps(card_id, depends_on_id) table. Better for SQL-level cycle detection but adds migration complexity and complicates versioning. | |
| Structured columns for type_signature | Break type_signature into separate columns (input_types, output_type, arity). More queryable but less extensible for future richer types. | |

**User's choice:** All JSON text columns (Recommended)
**Notes:** None

### Q2: Should dsl and sql be stored as separate columns or a single compiled blob?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate columns | dsl TEXT (human-authored source) and sql TEXT (compiled output) as two independent columns. Allows re-compilation without losing original DSL. | ✓ |
| Single column with compilation metadata | Store only dsl, recompile to SQL on load. Saves storage but adds startup cost. | |

**User's choice:** Separate columns (Recommended)
**Notes:** None

---

## Sync Conflict Strategy

### Q3: How should concurrent edits to the same Formula Card resolve?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep-both (version fork) | Both versions retained as separate version rows under the same canonical_id. User sees conflicted versions and picks one. | ✓ |
| Last-writer-wins | Same as existing cards sync. Simpler but risks silently losing a formula edit. | |
| Merge fields independently | Per-field merge. Complex to implement correctly for semantically coupled dsl/sql. | |

**User's choice:** Keep-both (version fork) (Recommended)
**Notes:** None

### Q4: For delete-while-editing and type-signature-change conflicts, same keep-both approach or different?

| Option | Description | Selected |
|--------|-------------|----------|
| Uniform keep-both for all three | All three scenarios use version fork. Deleted card gets resurrection version. Consistent mental model. | ✓ |
| Keep-both for edits, tombstone wins for deletes | Concurrent edits fork, but delete wins over edit. Simpler delete semantics. | |
| You decide | Claude picks based on existing CKSyncEngine patterns. | |

**User's choice:** Uniform keep-both for all three
**Notes:** None

---

## Promotion API Granularity

### Q5: How many promotion functions and in what directions?

| Option | Description | Selected |
|--------|-------------|----------|
| Two functions: promote + hydrate | promoteToCard(chipArrangement) → FormulaCard and hydrateChips(card) → ChipWellOutputContract. Clean bidirectional pair. | ✓ |
| Three functions: promote + hydrate + update | Add updateCard() for saving changes to existing card. Distinguishes first save from version save. | |
| Single round-trip function | Serialize/deserialize pair on FormulaCard itself. | |

**User's choice:** Two functions: promote + hydrate (Recommended)
**Notes:** None

### Q6: Should the promotion API include a preview/validation step?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — validatePromotion() | Separate validation function checking type-signature compatibility before saving. Returns errors/warnings without creating a version. | ✓ |
| No — promote validates inline | promoteToCard() validates and either succeeds or throws. No separate validation step. | |
| You decide | Claude picks based on type-signature validation fit. | |

**User's choice:** Yes — validatePromotion() (Recommended)
**Notes:** None

---

## Visibility & Locking

### Q7: What should visibility mean at v1?

| Option | Description | Selected |
|--------|-------------|----------|
| Placeholder column, always 'active' | visibility TEXT DEFAULT 'active' with CHECK for active/archived/hidden. Only active and archived used at v1. | ✓ |
| Full enum now | Define all future values in CHECK constraint now. No runtime effect beyond active/archived. | |
| No visibility column | Remove entirely at v1. Add when collaboration ships. | |

**User's choice:** Placeholder column, always 'active' (Recommended)
**Notes:** None

### Q8: Should locked be a separate column or visibility state?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate is_locked column | is_locked INTEGER DEFAULT 0. Orthogonal to visibility. | |
| Visibility state | Locked is a visibility value. Simpler schema, fewer columns. | ✓ |
| You decide | Claude picks simplest approach for single-user v1. | |

**User's choice:** Visibility state (Recommended)
**Notes:** None

---

## Claude's Discretion

- Exact CHECK constraint values for scope column
- Default values and nullability for optional columns
- Index design for formula_cards table
- JSON schema shapes for type_signature and dependencies
- Pseudocode style for type-signature validation algorithm
- Worked example count beyond required facet_type coverage

## Deferred Ideas

None — discussion stayed within phase scope.
