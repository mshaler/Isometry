# Roadmap: Isometry

## Milestones

- ✅ **v0.1 Data Foundation** - Phases 1-2 (shipped 2026-02-28)
- ✅ **v0.5 Providers + Views** - Phases 4-6 (shipped 2026-02-28)
- ✅ **v1.0 Web Runtime** - Phases 3, 7 (shipped 2026-03-01)
- ✅ **v1.1 ETL Importers** - Phases 8-10 (shipped 2026-03-02)
- ✅ **v2.0 Native Shell** - Phases 11-14 (shipped 2026-03-03)
- ✅ **v3.0 SuperGrid Complete** - Phases 15-27 (shipped 2026-03-05)
- ✅ **v3.1 SuperStack** - Phases 28-32 (shipped 2026-03-06)
- ✅ **v4.0 Native ETL** - Phases 33-36 (shipped 2026-03-06)
- ✅ **v4.1 Sync + Audit** - Phases 37-41 (shipped 2026-03-07)
- ✅ **v4.2 Polish + QoL** - Phases 42-47 (shipped 2026-03-07)
- ✅ **v4.3 Review Fixes** - Phase 48 (shipped 2026-03-07)
- ✅ **v4.4 UX Complete** - Phases 49-52 (shipped 2026-03-08)
- ✅ **v5.0 Designer Workbench** - Phases 54-57 (shipped 2026-03-08)
- ✅ **v5.1 SuperGrid Spreadsheet UX** - Phases 58-61 (shipped 2026-03-08)
- ✅ **v5.2 SuperCalc + Workbench Phase B** - Phases 62-68 (shipped 2026-03-10)
- ✅ **v5.3 Dynamic Schema** - Phases 69-73 (shipped 2026-03-11)
- ✅ **v6.0 Performance** - Phases 74-78 (shipped 2026-03-13)
- ✅ **v6.1 Test Harness** - Phases 79-84 (shipped 2026-03-17)
- ✅ **v7.0 Design Workbench** - Phases 85-90 (shipped 2026-03-18)
- ✅ **v7.1 Notebook Card Editor** - Phases 91-94 (shipped 2026-03-19)
- ✅ **v7.2 Alto Index + DnD Migration** - Phases 95-96 (shipped 2026-03-21)
- ✅ **v8.0 SuperGrid Redesign** - Phases 97-100 (shipped 2026-03-21)
- ✅ **v8.1 Plugin Registry Complete** - Phases 101-102 (shipped 2026-03-22)
- ✅ **v8.2 SuperCalc v2** - Phase 103 (shipped 2026-03-22)
- ✅ **v8.3 Plugin E2E Test Suite** - Phases 104-107 (shipped 2026-03-22)
- ✅ **v8.4 Consolidate View Navigation** - Phase 108 (shipped 2026-03-22)
- ✅ **v10.1 Time Hierarchies** - Phases 136-139 (shipped 2026-04-08)
- ✅ **v10.2 SuperGrid Plugin Pipeline** - Phases 140-144 (shipped 2026-04-08)
- ✅ **v11.0 Navigation Bar Redesign** - Phases 145-149 (shipped 2026-04-16, Phase 150 deferred)
- ✅ **v11.1 Dock/Explorer Inline Embedding** - Phases 151-154 (shipped 2026-04-17)
- ✅ **v12.0 Explorer Panel Polish** - Phases 155-161 (shipped 2026-04-18)
- ✅ **v13.0 SuperWidget Substrate** - Phases 162-166 (shipped 2026-04-21)
- ✅ **v13.1 Data Explorer Canvas** - Phases 167-170 (shipped 2026-04-21)
- ✅ **v13.2 View + Editor Canvases** - Phases 171-173 (shipped 2026-04-22)
- ✅ **v13.3 SuperWidget Shell** - Phases 174-178 (shipped 2026-04-22)
- ✅ **v14.0 Horizontal Ribbon Navigation** - Phases 179-181 (shipped 2026-04-23)
- [ ] **v15.0 Formulas Explorer Architecture** - Phases 182-188

## Phases

<details>
<summary>Phases 1-181 -- archived milestones (see .planning/milestones/)</summary>

All phases 1-181 are archived in `.planning/milestones/` under their respective milestone directories.

</details>

### v15.0 Formulas Explorer Architecture

- [x] **Phase 182: Three-Explorer Boundary Spec** - Define the fundamental three-way split (Formulas/Marks/Audits) with type signatures, composition rules, and regression guards (completed 2026-04-27)
- [x] **Phase 183: Chip-Well Geometry Contract** - Specify the reusable spatial primitive for chip wells, drag states, and accessibility contract (completed 2026-04-27)
- [x] **Phase 184: Compilation Pipeline Spec** - Define the chip-arrangement-to-SQL compilation pipeline, dependency resolution, and annotation algorithms (completed 2026-04-27)
- [x] **Phase 185: Formula Card Schema** - Define the SQLite DDL, versioning strategy, type-signature validation, and sync conflict resolution for formula_cards (completed 2026-04-27)
- [x] **Phase 186: Operator-Contract Template** - Fork the geometry contract template into an operator-surface variant with usage guide (completed 2026-04-28)
- [x] **Phase 187: Golden-Test Corpus Plan** - Define the fixture dataset, test case corpus, test runner architecture, and anti-patching policy (completed 2026-04-28)
- [ ] **Phase 188: UX Interaction Spec** - Specify live preview behavior, reversibility, error states, promotion UI, navigator placement, and WKWebView constraints

## Phase Details

### Phase 182: Three-Explorer Boundary Spec
**Goal**: The three explorers (Formulas, Marks, Audits) have unambiguous boundaries — every chip type from the original discussion document is placed in exactly one explorer, composition rules are defined, and the first set of regression guards is established
**Depends on**: Nothing (first phase)
**Requirements**: SPEC-01, SPEC-02, SPEC-03, SPEC-04, SPEC-05, SPEC-06, GARD-01, GARD-02
**Success Criteria** (what must be TRUE):
  1. A reader can look up any chip category from `Formulas Explorer discussion.md` and find it placed unambiguously in one of Formulas, Marks, or Audits with a one-sentence rationale
  2. The composition rules document tells a reader exactly how multiple chips within a well combine (AND for filters, lexicographic for sorts, DAG for calculations) with no ambiguous cases
  3. Each explorer has a documented out-of-scope list that explicitly names the operations it must never perform (Formulas never owns GROUP BY, Marks never alters row membership, Audits never excludes rows)
  4. The DSL example lexicon appendix contains canonical examples sufficient for authors of WA-2 through WA-7 to reference without re-reading the full discussion document
  5. All 14 FE-RG guards from the handoff document are present in the spec with verification checks, and FE-RG-15 (cross-WA DSL consistency) is documented as an enforceable policy
**Plans:** 1/1 plans complete
Plans:
- [x] 182-01-PLAN.md — Write three-explorer boundary spec with type signatures, composition rules, example placement, DSL lexicon, and regression guards

### Phase 183: Chip-Well Geometry Contract
**Goal**: A standalone, Formulas-agnostic geometry contract document defines the chip-well spatial primitive so that any future explorer can reuse it without inheriting Formulas-specific concepts
**Depends on**: Phase 182
**Requirements**: GEOM-01, GEOM-02, GEOM-03, GEOM-04, GEOM-05, GEOM-06
**Success Criteria** (what must be TRUE):
  1. All 12 template sections are filled, including the mandatory N/A rationale for the operator-surface section
  2. A reader can determine from the coordinate system spec how chips flow (horizontal with wrap within wells, wells stacked vertically) and what units govern token dimensions (fixed height, variable width)
  3. Every drag state (default, drag-source-active, drag-target-valid, drag-target-invalid, drop-rejected, promotion-prompt) has a defined visual treatment and pointer event behavior
  4. The keyboard equivalents and ARIA roles for all drag operations are documented so the contract can be implemented to WCAG 2.1 AA without additional design work
  5. The composition seams section names the interfaces to WA-2 (compilation pipeline) and WA-3 (Formula Card library) by interface name only, with no concrete implementation references
**Plans**: 1 plan
Plans:
- [x] 183-01-PLAN.md — Write complete chip-well geometry contract (all 12 template sections)

### Phase 184: Compilation Pipeline Spec
**Goal**: The complete algorithm from chip arrangement to executed SQL (including bind-value protocol, dependency resolution, and post-query annotation for Marks and Audits) is specified with worked examples and structural regression guards
**Depends on**: Phase 182
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07, COMP-08, GARD-03, GARD-04
**Success Criteria** (what must be TRUE):
  1. The fixed SQL clause order mapping is documented: Calculations map to SELECT, Filters map to WHERE, Sorts map to ORDER BY, and GROUP BY is explicitly owned by the view explorer, not the formula compiler
  2. The dependency graph algorithm for calculations includes pseudocode for topological sort and cycle detection, with the CycleError type and its participants field defined
  3. The bind-value protocol spec states that every DSL value must produce a parameter placeholder and a bind value, and never use string concatenation — this is documented as a structural guard (FE-RG-17)
  4. The Marks post-query annotation algorithm produces `Map<rowId, string[]>` CSS class assignments and the Audits annotation produces flag/badge metadata, with both algorithms explicitly prohibited from filtering the result set
  5. The explain panel contract specifies the exact format of compiled SQL shown to users, including how bind-value placeholders are rendered
  6. Ten worked examples cover the full range from single-chip arrangements to multi-chip combinations, and each example shows the expected SQL output verbatim
**Plans:** 1/1 plans complete
Plans:
- [x] 184-01-PLAN.md — Write compilation pipeline spec with clause mapping, dependency graph, annotation algorithms, explain panel, 10 worked examples, and regression guards

### Phase 185: Formula Card Schema
**Goal**: The `formula_cards` SQLite table is fully specified with DDL, type-signature validation algorithm, versioning strategy, promotion API signatures, and sync conflict resolution for all three conflict scenarios
**Depends on**: Phase 182
**Requirements**: CARD-01, CARD-02, CARD-03, CARD-04, CARD-05
**Success Criteria** (what must be TRUE):
  1. The SQLite DDL for `formula_cards` is complete with all 13 columns (id, canonical_id, title, dsl, sql, content, version, scope, type_signature, dependencies, provenance, performance_hint, visibility) and their types, constraints, and defaults
  2. The type-signature validation algorithm covers all existing facet types and the extensibility mechanism is explicit — a reader can understand how to add array, JSON, or geo-shape types without modifying the core algorithm
  3. The versioning strategy document states that every save creates a new version row and that canonical_id is the stable identity used for cross-version references
  4. The chip-to-card promotion API signatures (function names, parameter types, return types) are defined so an implementer can write the function stubs without making design decisions
  5. All three sync conflict scenarios (concurrent edit, delete-while-editing, type-signature change) have documented resolution strategies with explicit outcomes
**Plans**: 1 plan
Plans:
- [x] 185-01-PLAN.md — Write formula card schema spec (DDL, type-signature validation, versioning, promotion API, sync conflict resolution)

### Phase 186: Operator-Contract Template
**Goal**: A new operator-contract template variant exists as a standalone document, forked from the geometry contract template, covering operator surfaces rather than spatial layout, with a usage guide that distinguishes the two templates
**Depends on**: Phase 182
**Requirements**: TMPL-01, TMPL-02
**Success Criteria** (what must be TRUE):
  1. The operator-contract template file exists with its operator-surface section replacing the geometry-specific sections of the parent template, and all other sections are present and filled with operator-context guidance
  2. The usage guide explains when to reach for the operator-contract template versus the geometry contract template, with a concrete example distinguishing the two
**Plans:** 1/1 plans complete
Plans:
- [x] 186-01-PLAN.md — Write operator-contract template (fork geometry template, operator-surface section, usage guide)

### Phase 187: Golden-Test Corpus Plan
**Goal**: The golden-test corpus plan defines a fixture dataset, a 30+ case test corpus covering isolation and combination scenarios, a Vitest-based test runner architecture, and an anti-patching policy — so that implementation can start TDD without design decisions outstanding
**Depends on**: Phase 182, Phase 184, Phase 185
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. The fixture dataset definition specifies approximately 50 nodes spanning all node_type values, with enough variety to exercise every test case in the corpus
  2. The test corpus contains at least 30 test cases with each category (Formulas, Marks, Audits) covered in isolation, in valid combinations with each other, and in edge cases (cycles, type mismatches, empty inputs)
  3. The test runner architecture document explains how the corpus extends the existing Vitest + realDb() infrastructure, including where test files live and how fixtures are loaded
  4. The anti-patching policy statement is consistent with the v6.1 rule: if a test fails, fix the spec or the implementation, never weaken the test assertion
**Plans**: 1 plan
Plans:
- [x] 187-01-PLAN.md — Write golden-test corpus plan (fixture dataset, 30+ test cases, runner architecture, anti-patching policy)

### Phase 188: UX Interaction Spec
**Goal**: The complete UX interaction spec covers live preview behavior, reversibility, error states, save-as-formula promotion flow, explorer placement in the ribbon, and all WKWebView constraints — so that the implementation milestone can begin UI work without open design questions
**Depends on**: Phase 182, Phase 183, Phase 184, Phase 185
**Requirements**: UXIN-01, UXIN-02, UXIN-03, UXIN-04, UXIN-05, UXIN-06
**Success Criteria** (what must be TRUE):
  1. The live preview spec defines the exact trigger (chip change), the query re-run path, and how the result animates into view — so an implementer can build it without asking about timing or sequencing
  2. The reversibility spec distinguishes chip-arrangement undo/redo (arrangement-level, in-memory) from Formula Card save undo (not supported at card level) and states this distinction explicitly
  3. Error state wireframes exist for type mismatch, dependency cycle, and compilation error — each wireframe shows where the error appears and what recovery action is offered
  4. The save-as-formula promotion UI flow is specified step-by-step, including the dialog contents, required fields, and what happens on confirm vs cancel
  5. The explorer placement spec names the single "Formulas" parent in the Analyze ribbon section and its three sub-explorers, with the navigation hierarchy shown
  6. All WKWebView constraint compliance requirements are documented: pointer events for chip drag (no HTML5 DnD), no :has() behavioral selectors, <dialog> for all prompts
**Plans**: 1 plan
Plans:
- [ ] 188-01-PLAN.md — TBD

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 182. Three-Explorer Boundary Spec | 1/1 | Complete    | 2026-04-27 |
| 183. Chip-Well Geometry Contract | 1/1 | Complete    | 2026-04-27 |
| 184. Compilation Pipeline Spec | 1/1 | Complete    | 2026-04-27 |
| 185. Formula Card Schema | 1/1 | Complete    | 2026-04-27 |
| 186. Operator-Contract Template | 1/1 | Complete    | 2026-04-28 |
| 187. Golden-Test Corpus Plan | 1/1 | Complete    | 2026-04-28 |
| 188. UX Interaction Spec | 0/TBD | Not started | - |
