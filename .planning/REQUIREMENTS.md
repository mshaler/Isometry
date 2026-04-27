# Requirements: Isometry v15.0 Formulas Explorer Architecture

**Defined:** 2026-04-27
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v15.0 Requirements

Requirements for this architecture-only milestone. Each maps to roadmap phases. All deliverables are specification documents — no code ships.

### Three-Explorer Specification (WA-1)

- [ ] **SPEC-01**: Three-explorer boundary spec defines Formulas (data-layer), Marks (view-layer), Audits (semantic-flag) with one-sentence type signatures per chip well category
- [ ] **SPEC-02**: Composition rules within and across categories documented (AND-composition for Filters, lexicographic for Sorts, DAG for Calculations)
- [ ] **SPEC-03**: Explicit out-of-scope list per explorer (Formulas never owns GROUP BY, Marks never alters row membership, Audits never excludes)
- [ ] **SPEC-04**: DSL example lexicon appendix with canonical examples for all downstream WAs to reference verbatim
- [ ] **SPEC-05**: Anti-feature documentation (OR across filter chips, Marks filtering, FormulasProvider owning GROUP BY, inline cell editing)
- [ ] **SPEC-06**: Every example from original `Formulas Explorer discussion.md` placed unambiguously into one category

### Compilation Pipeline (WA-2)

- [ ] **COMP-01**: Fixed SQL clause order mapping (Calculations → SELECT, Filters → WHERE, Sorts → ORDER BY) with GROUP BY from view explorer
- [ ] **COMP-02**: Calculations dependency graph algorithm specified with pseudocode (topological sort, cycle detection, CycleError type with participants)
- [ ] **COMP-03**: Bind-value protocol: every DSL value produces parameter placeholder + bind value, never string concatenation
- [ ] **COMP-04**: Calculation identifier allowlist step specified (column names validated against SchemaProvider, not just values)
- [ ] **COMP-05**: Marks post-query annotation algorithm: predicates produce `Map<rowId, string[]>` CSS class assignments, never filter rows
- [ ] **COMP-06**: Audits post-query annotation algorithm: predicates produce flag/badge annotations per row
- [ ] **COMP-07**: Explain panel contract: compiled SQL shown with bind-value placeholders
- [ ] **COMP-08**: 10 worked chip-arrangement-to-SQL examples with expected output verbatim

### Formula Card Schema (WA-3)

- [ ] **CARD-01**: SQLite DDL for `formula_cards` table (id, canonical_id, title, dsl, sql, content, version, scope, type_signature, dependencies, provenance, performance_hint, visibility)
- [ ] **CARD-02**: Type-signature validation algorithm with worked examples covering existing facet types + extensible for richer types
- [ ] **CARD-03**: Versioning strategy (every save creates new version, canonical_id for version-independent references)
- [ ] **CARD-04**: Chip↔Card promotion API signatures (function names, parameter types, return types)
- [ ] **CARD-05**: Sync conflict resolution specified for 3 scenarios (concurrent edit, delete-while-editing, type-signature change)

### Golden-Test Corpus Plan (WA-4)

- [ ] **TEST-01**: Fixture dataset definition (~50 nodes spanning all node_type values)
- [ ] **TEST-02**: Initial corpus of ~30 test cases covering each category in isolation, combinations, and edge cases
- [ ] **TEST-03**: Test runner architecture extending existing Vitest + realDb() infrastructure
- [ ] **TEST-04**: Anti-patching policy statement consistent with v6.1 Test Harness

### UX Interaction Spec (WA-5)

- [ ] **UXIN-01**: Live preview behavior (chip change → query re-run → result animate)
- [ ] **UXIN-02**: Reversibility spec (chip arrangement undo/redo at arrangement level, distinct from Formula Card undo)
- [ ] **UXIN-03**: Error state wireframes (type mismatch, dependency cycle, compilation error)
- [ ] **UXIN-04**: Save-as-Formula promotion UI flow
- [ ] **UXIN-05**: Explorer placement in navigation (single "Formulas" parent in Analyze ribbon, three sub-explorers)
- [ ] **UXIN-06**: WKWebView constraint compliance (pointer events for chip drag, no :has() behavioral selectors, <dialog> for prompts)

### Chip-Well Geometry Contract (WA-6)

- [ ] **GEOM-01**: All 12 template sections filled including §3 "N/A — operator surface" with rationale
- [ ] **GEOM-02**: Coordinate system: wells vertically stacked, chips flow horizontally with wrap, fixed-height variable-width tokens
- [ ] **GEOM-03**: Drag states specified (default, drag-source-active, drag-target-valid/invalid, drop-rejected, promotion-prompt)
- [ ] **GEOM-04**: Pointer-event-based drag with keyboard equivalents and ARIA accessibility contract
- [ ] **GEOM-05**: §9 Composition names seams to WA-2 (compilation pipeline) and WA-3 (Formula Card library) by interface
- [ ] **GEOM-06**: Contract is reusable — no Formulas-specific language; per-explorer specifics live in WA-1

### Operator-Contract Template (WA-7)

- [ ] **TMPL-01**: Fork geometry contract template into operator-contract variant with §2-§3 replaced by operator-surface section
- [ ] **TMPL-02**: Template documented with usage guide and contrast to geometry contract template

### Regression Guards

- [ ] **GARD-01**: All 14 FE-RG guards from handoff document present in specs with verification checks
- [ ] **GARD-02**: FE-RG-15 (DSL example lexicon consistency across WAs) documented and enforceable
- [ ] **GARD-03**: FE-RG-16 (Marks annotation return type `Map<rowId, string[]>`) documented as structural guard
- [ ] **GARD-04**: FE-RG-17 (Calculation identifier allowlist against SchemaProvider) documented as structural guard

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
| SPEC-01 | — | Pending |
| SPEC-02 | — | Pending |
| SPEC-03 | — | Pending |
| SPEC-04 | — | Pending |
| SPEC-05 | — | Pending |
| SPEC-06 | — | Pending |
| COMP-01 | — | Pending |
| COMP-02 | — | Pending |
| COMP-03 | — | Pending |
| COMP-04 | — | Pending |
| COMP-05 | — | Pending |
| COMP-06 | — | Pending |
| COMP-07 | — | Pending |
| COMP-08 | — | Pending |
| CARD-01 | — | Pending |
| CARD-02 | — | Pending |
| CARD-03 | — | Pending |
| CARD-04 | — | Pending |
| CARD-05 | — | Pending |
| TEST-01 | — | Pending |
| TEST-02 | — | Pending |
| TEST-03 | — | Pending |
| TEST-04 | — | Pending |
| UXIN-01 | — | Pending |
| UXIN-02 | — | Pending |
| UXIN-03 | — | Pending |
| UXIN-04 | — | Pending |
| UXIN-05 | — | Pending |
| UXIN-06 | — | Pending |
| GEOM-01 | — | Pending |
| GEOM-02 | — | Pending |
| GEOM-03 | — | Pending |
| GEOM-04 | — | Pending |
| GEOM-05 | — | Pending |
| GEOM-06 | — | Pending |
| TMPL-01 | — | Pending |
| TMPL-02 | — | Pending |
| GARD-01 | — | Pending |
| GARD-02 | — | Pending |
| GARD-03 | — | Pending |
| GARD-04 | — | Pending |

**Coverage:**
- v15.0 requirements: 41 total
- Mapped to phases: 0
- Unmapped: 41 ⚠️

---
*Requirements defined: 2026-04-27*
*Last updated: 2026-04-27 after initial definition*
