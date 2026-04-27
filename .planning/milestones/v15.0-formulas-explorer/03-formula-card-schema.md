# Formula Card Schema and Lifecycle

**Artifact:** `03-formula-card-schema.md`
**Work Area:** WA-3
**Milestone:** v15.0 — Formulas Explorer Architecture
**Source:** `.planning/formulas-explorer-handoff-v2.md` (canonical; §WA-3 lines 207–227 is primary guidance)
**Status:** Authoritative
**Related:**
- `01-three-explorer-spec.md` (WA-1) — Defines chip well categories and type signatures per explorer; formula cards store those type signatures
- `02-compilation-pipeline.md` (WA-2) — Defines chip arrangement → SQL compilation; the promotion API bridges this pipeline and saved cards
- `06-chip-well-geometry.md` (WA-6) — Defines ChipWellOutputContract and FormulaCardDragSourceContract; §4 (data binding) and §9 (composition) are the key sections for this spec

**Phase:** 185 | **Plan:** 01

---

## Preamble

This document formalizes two decisions from `.planning/formulas-explorer-handoff-v2.md`:

- **Decision 5** (Formula Card properties): the 13-column `formula_cards` table schema, including scope, type signature, dependencies, provenance, performance hint, and visibility
- **Decision 6** (Chip↔Card promotion path): the bidirectional `promoteToCard` / `hydrateChips` pair, plus the `validatePromotion` pre-check

All storage shape decisions are locked per `.planning/phases/185-formula-card-schema/185-CONTEXT.md` (D-01 through D-08). Every design choice below traces to one of those decisions. Where a decision is referenced inline, the CONTEXT.md entry is the authoritative reasoning; this document captures the outcome for implementation.

**Requirements satisfied by this document:** CARD-01 (DDL), CARD-02 (type-signature validation), CARD-03 (versioning), CARD-04 (promotion API), CARD-05 (sync conflict resolution).

---

## Section 1 — SQLite DDL (CARD-01)

### 1.1 CREATE TABLE

```sql
CREATE TABLE IF NOT EXISTS formula_cards (
  -- Identity (versioned)
  --   id:           Version-specific UUID. Each save creates a new row with a unique id.
  --                 Never mutated after insert.
  --   canonical_id: Stable identity across all version rows for this formula.
  --                 Every row for the same logical card shares the same canonical_id.
  --                 Used in dependencies arrays and cross-version references (D-01, CARD-03).
  id           TEXT PRIMARY KEY NOT NULL,
  canonical_id TEXT NOT NULL,

  -- Content
  --   title:   Human-readable display name. Required — every card must be named.
  --   dsl:     Human-authored source expression (NOT NULL — every card must have a source).
  --   sql:     Compiled output from the compilation pipeline (Phase 184 WA-2).
  --            Nullable: a card may be saved in draft state before first compilation.
  --   content: Rich-text implementation notes, optional user commentary (nullable).
  title   TEXT NOT NULL,
  dsl     TEXT NOT NULL,
  sql     TEXT,
  content TEXT,

  -- Versioning
  --   version: Monotonically increasing integer per canonical_id.
  --            Version 1 = first save. Each subsequent save increments by 1.
  --            See §3 for the full versioning strategy.
  version INTEGER NOT NULL DEFAULT 1,

  -- Scope
  --   scope: Determines which contexts a formula card is available in.
  --          Only 'dataset' at v1 (locked decision; see STATE.md §Accumulated Context).
  --          Future migration will extend CHECK to ('dataset', 'story', 'global').
  scope TEXT NOT NULL DEFAULT 'dataset'
    CHECK (scope IN ('dataset')),

  -- Type signature (JSON TEXT per D-01)
  --   Structured JSON matching the TypeSignature shape in §1.4.
  --   Specifies input column types expected and the output type produced.
  --   Validated at chip-drop time (not at save time). See §2 for the validation algorithm.
  type_signature TEXT NOT NULL DEFAULT '{}',

  -- Dependencies (JSON TEXT array of canonical_ids per D-01)
  --   List of canonical_ids of other Formula Cards this card references.
  --   Uses canonical_id (not version-specific id) so dependencies survive version changes.
  --   Drives topological sort and impact analysis in the compilation pipeline (WA-2).
  dependencies TEXT NOT NULL DEFAULT '[]',

  -- Provenance (JSON TEXT per D-01)
  --   Author, lineage, creation timestamp.
  --   Cheap to add now; multi-user-relevant later.
  provenance TEXT NOT NULL DEFAULT '{}',

  -- Performance hint
  --   Optional classifier for compilation pipeline and UI warnings.
  --   NULL = unknown or not yet characterized.
  performance_hint TEXT
    CHECK (performance_hint IS NULL OR performance_hint IN ('O(1)', 'O(n)', 'O(n log n)', 'O(n^2)')),

  -- Visibility (per D-07, D-08)
  --   'active':   Normal state; card is visible and editable.
  --   'archived': Soft-hidden; not shown in the active library but not deleted.
  --   'locked':   Read-only; card cannot be edited by the current session.
  --               Locking is a visibility state, not a separate column (D-08).
  --   Only 'active' and 'archived' are used by the runtime at v1.
  --   'locked' is structurally present for single-user read-only semantics.
  visibility TEXT NOT NULL DEFAULT 'active'
    CHECK (visibility IN ('active', 'archived', 'locked')),

  -- Timestamps (ISO 8601, UTC)
  --   created_at: Set on insert, never updated. Version-creation timestamp.
  --   modified_at: Set on insert; updated on any field change within the same version row.
  --                In practice, rows are immutable after insert (new save = new row),
  --                so modified_at and created_at are typically equal.
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  modified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

  -- Lifecycle
  --   Soft delete: set deleted_at to mark a version as deleted.
  --   Partial indexes (WHERE deleted_at IS NULL) exclude deleted rows from active queries.
  deleted_at TEXT
);
```

### 1.2 Indexes

Following the partial-index pattern from `src/database/schema.sql` (WHERE deleted_at IS NULL scopes indexes to non-deleted rows only):

```sql
-- Version lookup by stable identity: resolve canonical_id to its latest version row.
CREATE INDEX IF NOT EXISTS idx_fc_canonical
    ON formula_cards(canonical_id)
    WHERE deleted_at IS NULL;

-- Dataset-scoped queries: retrieve all active formula cards for a given dataset.
-- Supports the v1 scope='dataset' invariant; extend when other scope values are added.
CREATE INDEX IF NOT EXISTS idx_fc_scope
    ON formula_cards(scope)
    WHERE deleted_at IS NULL;

-- Visibility filter: retrieve active or archived cards.
-- 'locked' is also covered; the runtime queries by visibility frequently.
CREATE INDEX IF NOT EXISTS idx_fc_visibility
    ON formula_cards(visibility)
    WHERE deleted_at IS NULL;
```

### 1.3 DDL-as-Constant Export

Following the `GRAPH_METRICS_DDL` pattern from `src/database/queries/graph-metrics.ts`, the DDL is exported as a TypeScript constant for use in the Worker `initialize` handler:

```typescript
/**
 * DDL for the formula_cards table and its indexes.
 *
 * Run at Worker init time alongside cards/connections/FTS5
 * (CREATE TABLE IF NOT EXISTS is safe to run on every init).
 *
 * Requirements: CARD-01
 */
export const FORMULA_CARDS_DDL = `
CREATE TABLE IF NOT EXISTS formula_cards (
  id           TEXT PRIMARY KEY NOT NULL,
  canonical_id TEXT NOT NULL,
  title        TEXT NOT NULL,
  dsl          TEXT NOT NULL,
  sql          TEXT,
  content      TEXT,
  version      INTEGER NOT NULL DEFAULT 1,
  scope        TEXT NOT NULL DEFAULT 'dataset'
    CHECK (scope IN ('dataset')),
  type_signature TEXT NOT NULL DEFAULT '{}',
  dependencies   TEXT NOT NULL DEFAULT '[]',
  provenance     TEXT NOT NULL DEFAULT '{}',
  performance_hint TEXT
    CHECK (performance_hint IS NULL OR performance_hint IN ('O(1)', 'O(n)', 'O(n log n)', 'O(n^2)')),
  visibility TEXT NOT NULL DEFAULT 'active'
    CHECK (visibility IN ('active', 'archived', 'locked')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  modified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_fc_canonical
    ON formula_cards(canonical_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fc_scope
    ON formula_cards(scope) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fc_visibility
    ON formula_cards(visibility) WHERE deleted_at IS NULL;
`.trim();
```

### 1.4 JSON Column Shapes

All structured fields use JSON TEXT columns (D-01). The shapes below are normative.

#### type_signature JSON shape (CARD-02)

```json
{
  "inputs": [
    { "name": "column_name", "type": "text | number | date | boolean" }
  ],
  "output": { "type": "text | number | date | boolean" }
}
```

Example for `revenue - cost AS profit`:
```json
{
  "inputs": [
    { "name": "revenue", "type": "number" },
    { "name": "cost",    "type": "number" }
  ],
  "output": { "type": "number" }
}
```

The `type` values are the `SignatureType` union defined in §4. Extensibility for richer types (arrays, JSON objects, geo shapes) is handled by adding new values to that union without changing the JSON structure shape (see §2, Extensibility mechanism).

#### dependencies JSON shape (CARD-03)

```json
["canonical_id_1", "canonical_id_2"]
```

An ordered array of `canonical_id` strings. Each entry identifies another Formula Card that this card depends on. References use `canonical_id` — not `id` — so dependencies survive version changes to the referenced card (D-01, CARD-03).

Empty array `[]` is the default (no dependencies). The compilation pipeline (WA-2) reads this array to build the topological sort DAG; cycles are compile-time errors per FE-RG-05.

#### provenance JSON shape

```json
{
  "author": "string (user identifier, single-user at v1)",
  "created_at": "ISO 8601 timestamp",
  "derived_from": "canonical_id | null (forking lineage — non-null when card was forked from another card)"
}
```

Example for a new card with no forking lineage:
```json
{
  "author": "local",
  "created_at": "2026-04-27T22:00:00Z",
  "derived_from": null
}
```

At v1 `author` is always `"local"` (single-user). When multi-user collaboration is added, this field carries the user identifier. `derived_from` records the canonical_id of the source card when this card was created by forking — enables lineage queries without a separate table.

---

## Section 2 — Type-Signature Validation Algorithm (CARD-02)

### 2.1 Existing Facet Types Mapped to Signature Types

The existing schema uses the following column types and storage patterns. Each maps to one `SignatureType` value in the type_signature validation system:

| Existing facet type | Storage pattern | SignatureType |
|---------------------|-----------------|---------------|
| text (plain string) | `TEXT` column | `'text'` |
| number (integer)    | `INTEGER` column | `'number'` |
| number (real)       | `REAL` column | `'number'` |
| date (all temporal) | `TEXT` ISO 8601 column (`created_at`, `due_at`, `event_start`, etc.) | `'date'` |
| boolean (0/1)       | `INTEGER` column with 0/1 values | `'boolean'` |
| select (enum)       | `TEXT` column with `CHECK` constraint or tag membership | `'text'` |
| multi_select (array) | `TEXT` JSON array column (`tags` pattern) | `'text'` |

Notes:
- `number` covers both INTEGER and REAL columns because the type system operates at the SQL expression level, not the storage affinity level.
- `select` and `multi_select` are `'text'` at the signature level. Per-column validation (checking against the allowlist) is handled by Step 2 of the algorithm.
- `boolean` maps to `'boolean'`; at the SQLite level it is stored as INTEGER 0/1.

### 2.2 Type Compatibility Matrix

This matrix governs which chip output types are accepted by which chip well categories. It is the primary input to Step 1 of the validation algorithm.

| Chip output type | Filters well | Sorts well | Calculations well | Marks/Conditional Encoding well | Audits/Anomaly well | Audits/Validation well |
|-----------------|:----------:|:--------:|:---------------:|:-----------------------------:|:-----------------:|:--------------------:|
| `'boolean'`     | ✓          | ✓        | ✓               | ✓                             | ✓                 | ✓                   |
| `'number'`      | —          | ✓        | ✓               | —                             | —                 | —                   |
| `'text'`        | —          | ✓        | ✓               | —                             | —                 | —                   |
| `'date'`        | —          | ✓        | ✓               | —                             | —                 | —                   |

Legend: ✓ = accepted, — = rejected (type mismatch).

**Reading the matrix:**
- Filters, Marks/Conditional Encoding, Audits/Anomaly, and Audits/Validation wells require `boolean` output (they are all predicate wells).
- Sorts wells accept any scalar output (`boolean`, `number`, `text`, `date`) because SQL `ORDER BY` accepts any expression.
- Calculations wells accept any output type (they are general expressions).

### 2.3 Validation Timing

Validation runs at **chip-drop time** — when a chip is dragged from the Formula Card library (or another well) and dropped onto a target well. It does not run at save time.

The rationale: a chip arrangement may be intentionally incomplete during authoring (draft state). Running validation only at drop time gives the user immediate feedback without blocking the save path. The explain panel (WA-5) surfaces validation state; the chip well enters `drag-target-invalid` state (§7 of `06-chip-well-geometry.md`) when validation fails.

### 2.4 Validation Algorithm Pseudocode

```
function validateTypeSignature(
  chipSignature: TypeSignature,
  wellCategory: WellCategory
): ValidationResult {

  errors   = []
  warnings = []

  // Step 1: Check output type compatibility with well category.
  //
  //   Consult the type compatibility matrix (§2.2) to determine whether
  //   chipSignature.output.type is accepted by wellCategory.
  //
  //   wellCategory values and their output type requirements:
  //     - 'filters'             → requires output.type == 'boolean'
  //     - 'sorts'               → accepts any scalar type (boolean, number, text, date)
  //     - 'calculations'        → accepts any type
  //     - 'conditional_encoding'→ requires output.type == 'boolean'
  //     - 'anomaly_rules'       → requires output.type == 'boolean'
  //     - 'validation_rules'    → requires output.type == 'boolean'
  //
  if not matrix[wellCategory].accepts(chipSignature.output.type) {
    errors.push({
      kind: 'type_mismatch',
      message: `${wellCategory} well requires ${requiredType} output; chip produces ${chipSignature.output.type}`
    })
    // Short-circuit: if output type is wrong, no value in checking inputs.
    return { valid: false, errors, warnings }
  }

  // Step 2: Check each input column exists and has the declared type.
  //
  //   For each input in chipSignature.inputs:
  //     a) Validate column name against SchemaProvider allowlist (COMP-04, FE-RG-17).
  //        Unknown columns are an error (column may have been deleted or renamed).
  //     b) Validate the column's actual type (from SchemaProvider) matches the
  //        declared input type in the signature.
  //        Type coercions (e.g., INTEGER column used as boolean) are allowed when
  //        the mapping in §2.1 covers the coercion.
  //
  for each input in chipSignature.inputs {
    column = SchemaProvider.getColumn(input.name)

    if column == null {
      errors.push({
        kind: 'unknown_column',
        message: `Input column '${input.name}' does not exist in the current schema`
      })
    } else if not typeCompatible(column.storageType, input.type) {
      errors.push({
        kind: 'type_mismatch',
        message: `Column '${input.name}' is ${column.storageType} but signature declares ${input.type}`
      })
    }
  }

  // Step 3: Check declared dependencies are resolvable.
  //
  //   For each canonical_id in the formula card's dependencies array:
  //     Verify the referenced card exists (not deleted) and its type_signature
  //     is compatible with how this card uses it.
  //     Cycles (card A depends on card B which depends on card A) are errors.
  //
  for each canonical_id in card.dependencies {
    dep = FormulaCardStore.getLatestVersion(canonical_id)

    if dep == null or dep.deleted_at != null {
      errors.push({
        kind: 'missing_dependency',
        message: `Dependency formula card '${canonical_id}' does not exist or has been deleted`
      })
    }
  }

  // Cycle detection: the compilation pipeline (WA-2) runs Kahn's algorithm
  // on the full DAG. validateTypeSignature delegates cycle detection to it.
  // If a cycle is detected by the pipeline, the error is:
  //   { kind: 'cycle', message: 'Dependency cycle detected: [canonical_id_A] → [canonical_id_B] → ...', chipId: ... }

  // Step 4: Performance hint warnings.
  //
  //   If chipSignature carries a performance_hint of 'O(n^2)' or worse,
  //   add a warning so the UI can surface it before the user commits.
  //
  if card.performance_hint == 'O(n^2)' {
    warnings.push({
      kind: 'performance',
      message: `This formula has O(n²) complexity. Consider restructuring if applied to large datasets.`
    })
  }

  valid = errors.length == 0
  return { valid, errors, warnings }
}
```

### 2.5 Extensibility Mechanism

The type system is designed to accommodate richer types (arrays, JSON objects, geographic shapes) without modifying the core algorithm structure. To add a new type:

1. **Add the new type string to `SignatureType`:** Extend the union in §4's type definitions:
   ```typescript
   type SignatureType = 'text' | 'number' | 'date' | 'boolean' | 'array' | 'json' | 'geo_shape';
   ```

2. **Add a row to the type compatibility matrix (§2.2):** Define which well categories accept the new type as output. For example, `'geo_shape'` might be accepted only by Calculations wells (not by predicate wells).

3. **Add input-type validation logic for the new type in Step 2:** For example, `geo_shape` inputs may require two columns (latitude + longitude with REAL storage type) rather than a single column. The validation logic for the new type is added to the Step 2 block.

4. **Add the storage type mapping to §2.1:** Document which existing SQLite column pattern maps to the new SignatureType.

The core algorithm structure (4 steps: output check → input check → dependency check → warnings) is unchanged. New types slot into the existing structure.

### 2.6 Worked Examples

#### Example 1: Numeric Calculation — revenue minus cost

**Expression:** `revenue - cost AS profit`

**Type signature:**
```json
{
  "inputs": [
    { "name": "revenue", "type": "number" },
    { "name": "cost",    "type": "number" }
  ],
  "output": { "type": "number" }
}
```

**Validation against Calculations well:**
- Step 1: output.type = `'number'`; matrix row for Calculations accepts all types → pass
- Step 2: `revenue` column exists, REAL storage → compatible with `'number'`; `cost` column exists, REAL storage → compatible with `'number'` → pass
- Step 3: no dependencies → skip
- Result: `{ valid: true, errors: [], warnings: [] }`

#### Example 2: Boolean Filter — priority greater than 3

**Expression:** `priority > 3`

**Type signature:**
```json
{
  "inputs": [
    { "name": "priority", "type": "number" }
  ],
  "output": { "type": "boolean" }
}
```

**Validation against Filters well:**
- Step 1: output.type = `'boolean'`; Filters well requires `'boolean'` → pass
- Step 2: `priority` column exists, INTEGER storage → compatible with `'number'` → pass
- Step 3: no dependencies → skip
- Result: `{ valid: true, errors: [], warnings: [] }`

**Validation against Marks/Conditional Encoding well:**
- Step 1: output.type = `'boolean'`; Conditional Encoding well requires `'boolean'` → pass
- Step 2: same as above → pass
- Result: `{ valid: true, errors: [], warnings: [] }`

**Validation against Audits/Anomaly Rules well:**
- Step 1: output.type = `'boolean'`; Anomaly Rules well requires `'boolean'` → pass
- Result: `{ valid: true, errors: [], warnings: [] }`

This chip can be dropped into Filters, Marks, or Audits wells — the same primitive serves different roles depending on which well receives it (FE-RG-06).

#### Example 3: Text Sort — name ascending

**Expression:** `name ASC`

**Type signature:**
```json
{
  "inputs": [
    { "name": "name", "type": "text" }
  ],
  "output": { "type": "text" }
}
```

**Validation against Sorts well:**
- Step 1: output.type = `'text'`; Sorts well accepts any scalar type → pass
- Step 2: `name` column exists, TEXT storage → compatible with `'text'` → pass
- Result: `{ valid: true, errors: [], warnings: [] }`

#### Example 4: Type mismatch — text output dropped into Filters well

**Expression:** `UPPER(company_name) AS display_name`

**Type signature:**
```json
{
  "inputs": [
    { "name": "company_name", "type": "text" }
  ],
  "output": { "type": "text" }
}
```

**Validation against Filters well:**
- Step 1: output.type = `'text'`; Filters well requires `'boolean'` → **FAIL**
- Short-circuit: return immediately with error
- Result:
  ```json
  {
    "valid": false,
    "errors": [
      {
        "kind": "type_mismatch",
        "message": "filters well requires boolean output; chip produces text"
      }
    ],
    "warnings": []
  }
  ```

The chip well enters `drag-target-invalid` state. The chip is rejected and returns to its source.

---

## Section 3 — Versioning Strategy (CARD-03)

### 3.1 Immutable Version Rows

Every save creates a **new row** in `formula_cards`. The existing row is never mutated. This means:

- `id` — A new UUID is generated for each save. This is the version-specific identity.
- `canonical_id` — Unchanged across all versions. This is the stable identity.
- `version` — Incremented by 1 for each new save. The first save produces `version = 1`.

**canonical_id is the stable identity** for cross-version references. Every dependency array, every chip-well's reference to its saved source card, and every CloudKit record key uses `canonical_id`. This ensures that updating a formula card (creating version N+1) does not break the references held by other cards or by chip wells.

`id` is the version-specific identity. It uniquely identifies one snapshot of the card at one point in time.

### 3.2 Version Query Patterns

**Latest version of a card:**
```sql
SELECT *
FROM formula_cards
WHERE canonical_id = ?
  AND deleted_at IS NULL
ORDER BY version DESC
LIMIT 1;
```

This is the primary query for loading a card into a chip well or the Formula Card editor. The `idx_fc_canonical` index (§1.2) optimizes this query.

**Full version history for a card:**
```sql
SELECT id, version, title, created_at
FROM formula_cards
WHERE canonical_id = ?
ORDER BY version ASC;
```

Returns the complete version timeline including soft-deleted versions. Used for the version history UI panel (if shown) and for rollback operations.

**All active cards for a dataset:**
```sql
SELECT DISTINCT ON (canonical_id) *
FROM formula_cards
WHERE scope = 'dataset'
  AND visibility = 'active'
  AND deleted_at IS NULL
ORDER BY canonical_id, version DESC;
```

Note: SQLite does not support `DISTINCT ON`. The equivalent is a correlated subquery or window function:
```sql
SELECT f.*
FROM formula_cards f
WHERE f.deleted_at IS NULL
  AND f.scope = 'dataset'
  AND f.visibility = 'active'
  AND f.version = (
    SELECT MAX(f2.version)
    FROM formula_cards f2
    WHERE f2.canonical_id = f.canonical_id
      AND f2.deleted_at IS NULL
  );
```

### 3.3 All Versions Retained

At v1, all version rows are retained. There is no coalescing or pruning policy. This is a locked decision (STATE.md §Accumulated Context). If storage cost becomes significant after user research, a pruning policy can be added in a later migration without schema changes — the `deleted_at` column supports soft-pruning and the `version` column allows targeted hard-deletion of old versions.

### 3.4 Rollback

To revert a card to a previous version:

1. Query the target historical version: `SELECT * FROM formula_cards WHERE id = ?`
2. Create a new version row (version N+1) that copies the content fields (`dsl`, `sql`, `content`, `type_signature`, `dependencies`) from the target historical row.
3. The historical row is **never mutated**. Rollback is a new forward save, not a backward mutation.

This preserves the full version history and makes rollback itself versioned (it is visible in the version timeline as "version N+1, reverted to version M").

---

## Section 4 — Chip↔Card Promotion API (CARD-04)

### 4.1 TypeScript Type Definitions

```typescript
/**
 * A saved Formula Card — maps 1:1 to a row in formula_cards.
 *
 * All fields correspond to DDL columns in §1.1.
 * Requirements: CARD-01, CARD-04
 */
interface FormulaCard {
  id:               string;           // Version-specific UUID (PRIMARY KEY)
  canonical_id:     string;           // Stable identity across all versions
  title:            string;
  dsl:              string;           // Human-authored source expression (always present)
  sql:              string | null;    // Compiled output — null for drafts (D-02)
  content:          string | null;    // Rich-text notes (optional)
  version:          number;           // Monotonically increasing integer per canonical_id
  scope:            'dataset';        // v1 only — see §1.1
  type_signature:   TypeSignature;    // Parsed from JSON TEXT column
  dependencies:     string[];         // Parsed from JSON TEXT array column (canonical_ids)
  provenance:       Provenance;       // Parsed from JSON TEXT column
  performance_hint: 'O(1)' | 'O(n)' | 'O(n log n)' | 'O(n^2)' | null;
  visibility:       'active' | 'archived' | 'locked';
  created_at:       string;           // ISO 8601 UTC
  modified_at:      string;           // ISO 8601 UTC
  deleted_at:       string | null;    // null = live; non-null = soft-deleted
}

/**
 * The type signature of a formula chip or saved card.
 * Validated at chip-drop time (§2). Extensible via the mechanism in §2.5.
 */
interface TypeSignature {
  inputs: Array<{ name: string; type: SignatureType }>;
  output: { type: SignatureType };
}

/**
 * Scalar type values for type_signature validation.
 *
 * Extensibility: add new types here to support richer column types.
 * Adding a value here requires: (1) a row in the compatibility matrix §2.2,
 * (2) validation logic in §2.4 Step 2, (3) a storage mapping in §2.1.
 */
type SignatureType = 'text' | 'number' | 'date' | 'boolean';

/**
 * Provenance metadata — matches the provenance JSON shape in §1.4.
 */
interface Provenance {
  author:       string;       // User identifier (always 'local' at v1)
  created_at:   string;       // ISO 8601 UTC — when version 1 of this card was created
  derived_from: string | null;// canonical_id of source card if forked; null otherwise
}

/**
 * Result of validatePromotion or validateTypeSignature.
 * valid === true means the chip arrangement can be safely promoted.
 * valid === false means at least one error must be resolved before promotion.
 */
interface ValidationResult {
  valid:    boolean;
  errors:   ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * A blocking validation failure.
 * chipId is present when the error can be attributed to a specific chip in the well.
 */
interface ValidationError {
  kind:    'type_mismatch' | 'unknown_column' | 'missing_dependency' | 'cycle';
  message: string;
  chipId?: string;  // Optional: which chip caused the error
}

/**
 * A non-blocking validation concern.
 * Promotion proceeds despite warnings; the UI may surface them for user awareness.
 */
interface ValidationWarning {
  kind:    'performance' | 'deprecation';
  message: string;
}
```

### 4.2 Promotion Function Signatures

```typescript
/**
 * Promote a chip arrangement to a saved Formula Card (bottom-up path).
 *
 * Creates a new card with version 1 under a fresh canonical_id.
 * The user must have explicitly triggered "Save as Formula" before calling this
 * (FE-RG-10 — promotion is an explicit user action, never automatic).
 *
 * Precondition: validatePromotion(arrangement) returns { valid: true }.
 *   Callers should call validatePromotion first and surface any errors
 *   before calling promoteToCard.
 *
 * Postcondition: A new row exists in formula_cards with version = 1,
 *   a fresh canonical_id (UUID), and scope = 'dataset'.
 *   The returned FormulaCard reflects the persisted row.
 *
 * @param arrangement - Current chip well state (ChipWellOutputContract from §9
 *                      of 06-chip-well-geometry.md). Contains the ordered list
 *                      of chip DSL fragments and type signatures per well category.
 * @param metadata    - User-provided metadata. title is required; content is optional.
 * @returns           The newly created FormulaCard (version 1).
 *
 * Requirements: CARD-04 (D-05, D-06)
 */
function promoteToCard(
  arrangement: ChipWellOutputContract,
  metadata: { title: string; content?: string }
): FormulaCard;

/**
 * Hydrate chip wells from a saved Formula Card (top-down path).
 *
 * Reads the card's DSL and type_signature to reconstruct the chip arrangement.
 * Does not modify any database row — read-only operation.
 *
 * Callers should use the latest version of a card (via the version query in §3.2),
 * but any version can be hydrated (e.g., during rollback preview).
 *
 * @param card    - The FormulaCard to hydrate from (any version — typically latest).
 * @returns       ChipWellOutputContract suitable for populating chip wells.
 *                The arrangement reflects the card's chip categories and DSL fragments.
 *
 * Requirements: CARD-04 (D-05)
 */
function hydrateChips(card: FormulaCard): ChipWellOutputContract;

/**
 * Validate a chip arrangement before promotion.
 *
 * Runs type-signature validation (§2) against the full arrangement without
 * creating any database row. Call this before promoteToCard to surface
 * errors and warnings to the user.
 *
 * Validation is also run at chip-drop time (§2.3), so by the time the user
 * triggers "Save as Formula", most issues will already have been surfaced.
 * validatePromotion is the final gate before the write path.
 *
 * @param arrangement - Current chip well state (ChipWellOutputContract).
 * @returns           ValidationResult. If valid === false, do not call promoteToCard.
 *
 * Requirements: CARD-04 (D-06), CARD-02
 */
function validatePromotion(
  arrangement: ChipWellOutputContract
): ValidationResult;
```

### 4.3 Call Flow

The typical bottom-up promotion call flow is:

```
1. User arranges chips in the chip well
2. Type-signature validation runs at each chip-drop (validateTypeSignature per §2)
3. User triggers "Save as Formula" (FE-RG-10)
4. UI calls validatePromotion(arrangement) → checks all chips together
5.   If ValidationResult.valid === false → show errors in chip well, block save
6.   If ValidationResult.valid === true (possibly with warnings) → show save dialog
7. User confirms title (and optionally content) in save dialog
8. UI calls promoteToCard(arrangement, { title, content })
9. New FormulaCard version 1 is persisted
10. Chip well shows the chip as a saved card reference (name pill)
```

The top-down path (loading a saved card into a chip well):

```
1. User drags a saved FormulaCard from the library into a chip well
2. Type-signature validation runs at drop time (validateTypeSignature)
3. If valid: UI calls hydrateChips(card) → reconstructs ChipWellOutputContract
4. Chip well is populated with the card's chips
```

---

## Section 5 — Sync Conflict Resolution (CARD-05)

### 5.1 Strategy: Keep-Both (Version Fork)

Formula Cards use a **keep-both (version fork)** strategy for all sync conflict scenarios (D-03, D-04). This is a deliberate departure from the **last-writer-wins** strategy used for `cards` and `connections` (see `src/native/NativeBridge.ts` `SyncMerger` using `INSERT OR REPLACE`).

**Rationale for the departure:** Formula cards are structured, versioned, and high-value. Silently overwriting a formula with a conflicting version could invalidate downstream dependencies and break chip wells across an entire dataset. The keep-both strategy surfaces the conflict to the user, who can resolve it with full context. The cost is a small amount of conflict-resolution UX; the benefit is no silent data loss.

**Uniform strategy across all three scenarios (D-04):** The sync engine treats all formula_card conflicts identically — it always forks. There is no scenario-specific branching. The user resolution path is always the same: the Formulas Explorer shows conflicted versions; the user picks one; the chosen version becomes the new latest (a new version row, version N+1).

### 5.2 Scenario 1 — Concurrent Edit

**Setup:** Device A saves version N+1 of `canonical_id = X`. Before Device A's version syncs, Device B independently saves a different version N+1 of the same canonical_id X (e.g., they started from the same version N and both saved).

**Detection:** CKSyncEngine receives two records for the same canonical_id with the same version number but different content (different `id` values, different DSL or title).

**Resolution:**
1. Both version N+1 rows are retained. They have different `id` values (unique per row) but the same `canonical_id` and the same `version` number.
2. A `conflict_marker` field in the `provenance` JSON (or a dedicated column in a future migration) flags both rows as conflicted forks.
3. The Formulas Explorer detects that `canonical_id = X` has two rows at the same version number and surfaces a conflict UI to the user.
4. The user picks one version as canonical (or manually merges the DSL in a card editor).
5. The chosen version is saved as a new version row: version N+2. This becomes the new latest.
6. The non-chosen version row is soft-deleted (`deleted_at` set) or retained in the version history as a fork (implementation decision; this spec does not prescribe).

### 5.3 Scenario 2 — Delete-While-Editing

**Setup:** Device A soft-deletes `canonical_id = X` (sets `deleted_at` on the latest version). Before the delete syncs, Device B saves a new version of `canonical_id = X` (a version N+1 that Device B created while Device A was deleting).

**Detection:** CKSyncEngine receives both the soft-delete record and the new version record for the same canonical_id.

**Resolution:**
1. The edit from Device B **survives** as a "resurrection" version row. The new version N+1 row has `deleted_at = NULL`.
2. The deleted row from Device A also exists in the version history with `deleted_at` set.
3. The net result: `canonical_id = X` has an active latest version (the edit from Device B), not a deleted state.
4. The user sees a notification: "A formula you deleted was edited on another device and has been restored." The user can confirm the restoration (keeping the edit) or re-delete (which creates a new soft-delete version N+2).

**Rationale:** Edits are assumed to carry more intent than deletes in a collaborative context. The "resurrection" behavior prevents silent data loss when one device deletes while another is actively editing. The user retains full control to re-delete after reviewing the resurrected version.

### 5.4 Scenario 3 — Type-Signature Change

**Setup:** Device A changes the `type_signature` of `canonical_id = X` (e.g., adds an input column, changing from one input to two inputs). Device B simultaneously saves a version of `canonical_id = X` with the original type_signature (unaware of Device A's change).

**Detection:** CKSyncEngine receives two version N+1 rows for the same canonical_id with different `type_signature` JSON values.

**Resolution:**
1. Both type-signature variants are retained as separate version rows (same fork mechanism as Scenario 1).
2. The Formulas Explorer surfaces the type-signature conflict: "This formula has conflicting type signatures on two devices."
3. The user picks which type-signature is canonical. The chosen variant becomes version N+2.
4. After resolution, **downstream dependencies referencing `canonical_id = X` are validated** against the resolved type_signature. Chips in wells that were valid under the old signature may now produce `ValidationError { kind: 'type_mismatch' }` and need to be removed or updated.

**Critical detail:** Type-signature changes can invalidate chips already placed in wells by the user. The conflict resolution UI must surface which chip wells (if any) are affected by the resolved signature before the user commits to a choice. This is an implementation concern for the conflict resolution UI (WA-5); this spec identifies the invariant.

### 5.5 Sync Implementation Notes

The sync handler for `formula_cards` in `src/native/NativeBridge.ts` (or a companion module) will need to diverge from the `SyncMerger.merge()` path used for `cards` and `connections`. Key differences:

| Concern | cards/connections (current) | formula_cards (new) |
|---------|-----------------------------|---------------------|
| Conflict strategy | INSERT OR REPLACE (last-writer-wins) | Fork: keep both, surface to user |
| Identity key for dedup | `id` (single stable key) | `canonical_id` + `version` (composite) |
| Delete handling | Hard replace | Resurrection check before honoring delete |
| Post-merge action | None | Validate downstream deps against resolved signature |

These differences justify a separate sync handler (e.g., `FormulaSyncMerger`) rather than extending the existing `SyncMerger`.

---

## Appendix — Regression Guards

The following regression guards from `.planning/formulas-explorer-handoff-v2.md` are directly relevant to this spec. Implementation of any feature that touches `formula_cards` must not violate these invariants.

| Guard ID | Invariant | Spec section |
|----------|-----------|-------------|
| FE-RG-06 | A Formula Card has no intrinsic category. Its role is determined by which chip well receives it. | §4 (no `category` field on FormulaCard) |
| FE-RG-10 | Chip↔Card promotion is explicit user action ("Save as Formula"), never automatic. | §4.3 (step 3 requires user trigger) |
| FE-RG-15 | DSL examples reference Appendix A of `01-three-explorer-spec.md` as the canonical example lexicon. | §2.6 worked examples above use real Isometry column names from that lexicon |

---

*Version 1.0 — Phase 185, Plan 01*
