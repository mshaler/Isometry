# Requirements: Isometry v15.0 Formulas Explorer Architecture

**Defined:** 2026-04-27
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v15.0 Requirements

Requirements for this architecture-only milestone. Each maps to roadmap phases. All deliverables are specification documents — no code ships.

### Three-Explorer Specification (WA-1)

- [x] **SPEC-01**: Three-explorer boundary spec defines Formulas (data-layer), Marks (view-layer), Audits (semantic-flag) with one-sentence type signatures per chip well category
- [x] **SPEC-02**: Composition rules within and across categories documented (AND-composition for Filters, lexicographic for Sorts, DAG for Calculations)
- [x] **SPEC-03**: Explicit out-of-scope list per explorer (Formulas never owns GROUP BY, Marks never alters row membership, Audits never excludes)
- [x] **SPEC-04**: DSL example lexicon appendix with canonical examples for all downstream WAs to reference verbatim
- [x] **SPEC-05**: Anti-feature documentation (OR across filter chips, Marks filtering, FormulasProvider owning GROUP BY, inline cell editing)
- [x] **SPEC-06**: Every example from original `Formulas Explorer discussion.md` placed unambiguously into one category

### Compilation Pipeline (WA-2)

- [x] **COMP-01**: Fixed SQL clause order mapping (Calculations → SELECT, Filters → WHERE, Sorts → ORDER BY) with GROUP BY from view explorer
- [x] **COMP-02**: Calculations dependency graph algorithm specified with pseudocode (topological sort, cycle detection, CycleError type with participants)
- [x] **COMP-03**: Bind-value protocol: every DSL value produces parameter placeholder + bind value, never string concatenation
- [x] **COMP-04**: Calculation identifier allowlist step specified (column names validated against SchemaProvider, not just values)
- [x] **COMP-05**: Marks post-query annotation algorithm: predicates produce `Map<rowId, string[]>` CSS class assignments, never filter rows
- [x] **COMP-06**: Audits post-query annotation algorithm: predicates produce flag/badge annotations per row
- [x] **COMP-07**: Explain panel contract: compiled SQL shown with bind-value placeholders
- [x] **COMP-08**: 10 worked chip-arrangement-to-SQL examples with expected output verbatim

### Formula Card Schema (WA-3)

- [x] **CARD-01**: SQLite DDL for `formula_cards` table (id, canonical_id, title, dsl, sql, content, version, scope, type_signature, dependencies, provenance, performance_hint, visibility)
- [x] **CARD-02**: Type-signature validation algorithm with worked examples covering existing facet types + extensible for richer types
- [x] **CARD-03**: Versioning strategy (every save creates new version, canonical_id for version-independent references)
- [x] **CARD-04**: Chip↔Card promotion API signatures (function names, parameter types, return types)
- [x] **CARD-05**: Sync conflict resolution specified for 3 scenarios (concurrent edit, delete-while-editing, type-signature change)

### Golden-Test Corpus Plan (WA-4)

- [x] **TEST-01**: Fixture dataset definition (~50 nodes spanning all node_type values)
- [x] **TEST-02**: Initial corpus of ~30 test cases covering each category in isolation, combinations, and edge cases
- [x] **TEST-03**: Test runner architecture extending existing Vitest + realDb() infrastructure
- [x] **TEST-04**: Anti-patching policy statement consistent with v6.1 Test Harness

### UX Interaction Spec (WA-5)

- [x] **UXIN-01**: Live preview behavior (chip change → query re-run → result animate)
- [x] **UXIN-02**: Reversibility spec (chip arrangement undo/redo at arrangement level, distinct from Formula Card undo)
- [x] **UXIN-03**: Error state wireframes (type mismatch, dependency cycle, compilation error)
- [x] **UXIN-04**: Save-as-Formula promotion UI flow
- [x] **UXIN-05**: Explorer placement in navigation (single "Formulas" parent in Analyze ribbon, three sub-explorers)
- [x] **UXIN-06**: WKWebView constraint compliance (pointer events for chip drag, no :has() behavioral selectors, <dialog> for prompts)

### Chip-Well Geometry Contract (WA-6)

- [x] **GEOM-01**: All 12 template sections filled including §3 "N/A — operator surface" with rationale
- [x] **GEOM-02**: Coordinate system: wells vertically stacked, chips flow horizontally with wrap, fixed-height variable-width tokens
- [x] **GEOM-03**: Drag states specified (default, drag-source-active, drag-target-valid/invalid, drop-rejected, promotion-prompt)
- [x] **GEOM-04**: Pointer-event-based drag with keyboard equivalents and ARIA accessibility contract
- [x] **GEOM-05**: §9 Composition names seams to WA-2 (compilation pipeline) and WA-3 (Formula Card library) by interface
- [x] **GEOM-06**: Contract is reusable — no Formulas-specific language; per-explorer specifics live in WA-1

### Operator-Contract Template (WA-7)

- [x] **TMPL-01**: Fork geometry contract template into operator-contract variant with §2-§3 replaced by operator-surface section
- [x] **TMPL-02**: Template documented with usage guide and contrast to geometry contract template

### Regression Guards

- [x] **GARD-01**: All 14 FE-RG guards from handoff document present in specs with verification checks
- [x] **GARD-02**: FE-RG-15 (DSL example lexicon consistency across WAs) documented and enforceable
- [x] **GARD-03**: FE-RG-16 (Marks annotation return type `Map<rowId, string[]>`) documented as structural guard
- [x] **GARD-04**: FE-RG-17 (Calculation identifier allowlist against SchemaProvider) documented as structural guard

## Future Requirements

Deferred to downstream implementation milestones. Tracked but not in current roadmap.

### DSL Design Milestone

- **DSL-01**: Token-level grammar specification (lexer, parser, AST)
- **DSL-02**: DSL editor with syntax highlighting and auto-complete
- **DSL-03**: DSL-to-SQL compiler implementation

### Chip-Well UI Milestone

- **CWUI-01**: ChipWell reusable component implementation
- **CWUI-02**: FormulasExplorerPanel replacing FormulasPanelStub
- **CWUI-03**: MarksExplorerPanel implementation
- **CWUI-04**: AuditsExplorerPanel implementation
- **CWUI-05**: QueryBuilder extension for FormulasProvider injection

### Deferred Geometry Contracts

- **MGEO-01**: marks-output-geometry.md (how Marks class assignments interact with card geometry)
- **AGEO-01**: audit-overlay-geometry.md (where audit flags appear in card geometry)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Implementation code for any explorer | Architecture-only milestone; code lives in downstream milestones |
| DSL grammar (token-level syntax) | Dedicated DSL design milestone after this one |
| Performance benchmarking of the compiler | Premature; first establish correctness via golden-test corpus |
| Multi-user collaboration on Formula Cards | Single-user model sufficient through bootstrap and App Store launch |
| AI-assisted formula authoring (NL → DSL) | Future; Title field anticipates but does not require |
| Sort/Name Explorer wearing the LATCH-A hat | Possibly future; not required by this milestone |
| Pandoc-style formula ingestion from Excel/Quantrix | Out of scope; CLI-tier concern |
| Replacing or modifying existing facets table | Facets remain as defined; formula_cards is a new table |
| Geometry contracts for Formulas/Marks/Audits as wholes | Operator surfaces, not geometric; see Contract Boundaries in handoff |
| marks-output-geometry.md | Deferred to Marks implementation milestone |
| audit-overlay-geometry.md | Deferred to Audits implementation milestone |
| OR-composition across filter chips | Composition must be commutative and idempotent at chip level (FE-RG-03) |
| Marks altering result set membership | Marks are view-layer; if they affect membership they are Filters (FE-RG-07) |
| Formulas Explorer owning GROUP BY | Grouping comes from view explorers; same calc produces different SQL per context (FE-RG-01) |
| Inline cell formula editing | Cards have rich content; formulas live in chip wells (FE-RG-06) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SPEC-01 | Phase 182 | Complete |
| SPEC-02 | Phase 182 | Complete |
| SPEC-03 | Phase 182 | Complete |
| SPEC-04 | Phase 182 | Complete |
| SPEC-05 | Phase 182 | Complete |
| SPEC-06 | Phase 182 | Complete |
| COMP-01 | Phase 184 | Complete |
| COMP-02 | Phase 184 | Complete |
| COMP-03 | Phase 184 | Complete |
| COMP-04 | Phase 184 | Complete |
| COMP-05 | Phase 184 | Complete |
| COMP-06 | Phase 184 | Complete |
| COMP-07 | Phase 184 | Complete |
| COMP-08 | Phase 184 | Complete |
| CARD-01 | Phase 185 | Complete |
| CARD-02 | Phase 185 | Complete |
| CARD-03 | Phase 185 | Complete |
| CARD-04 | Phase 185 | Complete |
| CARD-05 | Phase 185 | Complete |
| TEST-01 | Phase 187 | Complete |
| TEST-02 | Phase 187 | Complete |
| TEST-03 | Phase 187 | Complete |
| TEST-04 | Phase 187 | Complete |
| UXIN-01 | Phase 188 | Complete |
| UXIN-02 | Phase 188 | Complete |
| UXIN-03 | Phase 188 | Complete |
| UXIN-04 | Phase 188 | Complete |
| UXIN-05 | Phase 188 | Complete |
| UXIN-06 | Phase 188 | Complete |
| GEOM-01 | Phase 183 | Complete |
| GEOM-02 | Phase 183 | Complete |
| GEOM-03 | Phase 183 | Complete |
| GEOM-04 | Phase 183 | Complete |
| GEOM-05 | Phase 183 | Complete |
| GEOM-06 | Phase 183 | Complete |
| TMPL-01 | Phase 186 | Complete |
| TMPL-02 | Phase 186 | Complete |
| GARD-01 | Phase 182 | Complete |
| GARD-02 | Phase 182 | Complete |
| GARD-03 | Phase 184 | Complete |
| GARD-04 | Phase 184 | Complete |

**Coverage:**
- v15.0 requirements: 41 total
- Mapped to phases: 41
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-27*
*Last updated: 2026-04-27 after roadmap creation*
