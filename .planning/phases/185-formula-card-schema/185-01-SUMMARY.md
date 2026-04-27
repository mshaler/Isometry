---
phase: 185-formula-card-schema
plan: "01"
subsystem: formulas-explorer
tags: [specification, formula-cards, sqlite-ddl, type-signatures, versioning, sync]
dependency_graph:
  requires:
    - 182-01 (01-three-explorer-spec.md — chip well categories and type signatures)
    - 183-01 (06-chip-well-geometry.md — ChipWellOutputContract, FormulaCardDragSourceContract)
    - 184-01 (02-compilation-pipeline.md — compilation output tuple shape, dependency graph)
  provides:
    - 03-formula-card-schema.md (formula_cards DDL, type-signature validation, versioning strategy, promotion API, sync conflict resolution)
  affects:
    - Phase 187 (golden-test corpus plan — needs schema and type definitions)
    - Phase 188 (UX interaction spec — needs promotion API signatures)
    - Implementation milestone (formula_cards Worker DDL integration, FormulaCardDragSourceContract)
tech_stack:
  added: []
  patterns:
    - DDL-as-constant export (FORMULA_CARDS_DDL following GRAPH_METRICS_DDL pattern)
    - Immutable version rows with canonical_id stable identity
    - Keep-both version fork for sync conflict resolution
    - JSON TEXT columns for structured fields (type_signature, dependencies, provenance)
key_files:
  created:
    - .planning/milestones/v15.0-formulas-explorer/03-formula-card-schema.md
  modified: []
decisions:
  - "D-01 honored: JSON TEXT columns for type_signature, dependencies, provenance — each version row is self-contained"
  - "D-02 honored: dsl (NOT NULL) and sql (nullable) as separate columns — enables draft state before first compilation"
  - "D-03 honored: keep-both strategy for all three sync scenarios — deliberate departure from last-writer-wins"
  - "D-04 honored: uniform strategy across all scenarios — no scenario-specific branching in sync logic"
  - "D-05 honored: promoteToCard/hydrateChips bidirectional pair with ChipWellOutputContract as the seam"
  - "D-06 honored: validatePromotion as separate pre-check function — runs without creating a version row"
  - "D-07 honored: visibility TEXT DEFAULT 'active' with CHECK ('active', 'archived', 'locked')"
  - "D-08 honored: locking is a visibility state — no separate column"
metrics:
  duration: "4 minutes (2026-04-27T22:28:11Z — 2026-04-27T22:32:38Z)"
  completed_date: "2026-04-27"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 0
---

# Phase 185 Plan 01: Formula Card Schema Specification Summary

## One-Liner

Complete `formula_cards` SQLite schema with 13-column DDL, type-signature validation algorithm with extensibility mechanism, immutable version rows with canonical_id stable identity, promoteToCard/hydrateChips/validatePromotion promotion API, and keep-both sync conflict resolution for three scenarios.

## What Was Built

Created `.planning/milestones/v15.0-formulas-explorer/03-formula-card-schema.md` — the authoritative schema spec for the Formula Card data model. This is a specification document (no code); it is the contract that Phase 187 (golden-test corpus) and Phase 188 (UX interaction spec) and the eventual implementation milestone will build against.

### Section 1 — SQLite DDL (CARD-01)

13-column `formula_cards` CREATE TABLE statement with:
- Identity: `id TEXT PRIMARY KEY` (version-specific UUID) + `canonical_id TEXT` (stable identity across versions)
- Content: `title TEXT NOT NULL`, `dsl TEXT NOT NULL`, `sql TEXT` (nullable for drafts, D-02), `content TEXT` (nullable)
- Versioning: `version INTEGER NOT NULL DEFAULT 1`
- Scope: `scope TEXT CHECK (scope IN ('dataset'))` — v1 only; future migration adds 'story', 'global'
- Structured JSON: `type_signature TEXT DEFAULT '{}'`, `dependencies TEXT DEFAULT '[]'`, `provenance TEXT DEFAULT '{}'` (D-01)
- Performance hint: `performance_hint TEXT CHECK (... IN ('O(1)', 'O(n)', 'O(n log n)', 'O(n^2)'))`
- Visibility: `visibility TEXT DEFAULT 'active' CHECK (... IN ('active', 'archived', 'locked'))` (D-07, D-08)
- Timestamps: `created_at`, `modified_at` with `strftime('%Y-%m-%dT%H:%M:%SZ', 'now')` defaults
- Lifecycle: `deleted_at TEXT` (soft delete)

Three partial indexes (WHERE deleted_at IS NULL): `idx_fc_canonical`, `idx_fc_scope`, `idx_fc_visibility`.

FORMULA_CARDS_DDL TypeScript constant following the GRAPH_METRICS_DDL pattern from `src/database/queries/graph-metrics.ts`.

JSON column shapes documented normatively: type_signature (inputs array + output), dependencies (canonical_id array), provenance (author + created_at + derived_from).

### Section 2 — Type-Signature Validation Algorithm (CARD-02)

- Facet type → SignatureType mapping table: text, number (integer+real), date (all temporal), boolean (0/1 integer), select (text), multi_select (text)
- Type compatibility matrix: Filters/Marks/Audits wells require boolean output; Sorts well accepts any scalar; Calculations well accepts any type
- Validation timing: chip-drop time (not save time)
- 4-step pseudocode: (1) output type check via compatibility matrix, (2) input column validation via SchemaProvider, (3) dependency resolvability check, (4) performance hint warnings
- Extensibility mechanism: 4 steps to add a new type (extend SignatureType union, add matrix row, add input validation, add storage mapping) without modifying core algorithm structure
- 4 worked examples: numeric calculation (profit), boolean filter (priority > 3), text sort (name ASC), type mismatch rejection (text → Filters well)

### Section 3 — Versioning Strategy (CARD-03)

- Every save creates a new row — existing rows are never mutated
- canonical_id is the stable identity; id is the version-specific identity
- Version query pattern: `ORDER BY version DESC LIMIT 1` with `idx_fc_canonical` index
- All versions retained at v1 (locked decision)
- Rollback is a new forward save (version N+1 copying content from historical row) — historical rows never mutated
- Full version history query pattern provided

### Section 4 — Chip↔Card Promotion API (CARD-04)

Three function signatures with full TypeScript type definitions:
- `promoteToCard(arrangement: ChipWellOutputContract, metadata: { title, content? }): FormulaCard` — bottom-up path
- `hydrateChips(card: FormulaCard): ChipWellOutputContract` — top-down path
- `validatePromotion(arrangement: ChipWellOutputContract): ValidationResult` — pre-check before promoteToCard

Complete TypeScript interfaces: `FormulaCard`, `TypeSignature`, `SignatureType`, `Provenance`, `ValidationResult`, `ValidationError`, `ValidationWarning`.

Call flow documented for both bottom-up (chip arrangement → save) and top-down (library card → chip well) paths.

### Section 5 — Sync Conflict Resolution (CARD-05)

Keep-both (version fork) strategy — deliberate departure from last-writer-wins (`src/native/NativeBridge.ts` SyncMerger):
- **Scenario 1 (concurrent edit):** Both version N+1 rows retained under same canonical_id; user picks one → becomes version N+2
- **Scenario 2 (delete-while-editing):** Edit survives as resurrection version (deleted_at = NULL); user confirms keep or re-delete
- **Scenario 3 (type-signature change):** Both variants retained; resolution triggers downstream dependency re-validation

Uniform strategy rationale (D-04): no scenario-specific branching in sync logic. FormulaSyncMerger (separate from existing SyncMerger) justified by table comparing cards vs formula_cards sync concerns.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria met on first pass; no gaps found during Task 2 validation.

## Known Stubs

None — this is a specification document with no data sources to wire. All sections are complete.

## Self-Check: PASSED

File exists:
- `/Users/mshaler/Developer/Projects/Isometry/.planning/milestones/v15.0-formulas-explorer/03-formula-card-schema.md` ✓

Commits exist:
- `3889209d` — feat(185-01): write complete 03-formula-card-schema.md specification ✓
- `69673c35` — chore(185-01): validate spec completeness against CARD-01..05 and D-01..D-08 ✓
