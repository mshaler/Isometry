# Feature Research

**Domain:** Formula/Marks/Audit explorer architecture for a local-first polymorphic data projection platform
**Researched:** 2026-04-27
**Confidence:** HIGH (patterns from Tableau, Airtable, Notion Formulas 2.0, Excel, Quantrix + direct reads of handoff docs and project context)

---

## Context

This research targets v15.0 Formulas Explorer Architecture — an architecture-only milestone that produces specs (not code) for three peer explorers: Formulas (data-layer), Marks (view-layer), and Audits (semantic-flags). The chip-well geometry contract (WA-6) is a reusable spatial primitive. The downstream consumer of this research is the roadmap for v15.0 work areas WA-1 through WA-6.

What already exists in Isometry and must NOT be rebuilt:
- Chip-well DnD in Projections Explorer (4 wells: Available/X/Y/Z) using pointer events
- FilterProvider with 9 filter types compiled to SQL via allowlisted QueryBuilder
- SuperCalc aggregation (SQL DSL, GROUP BY via supergrid:calc Worker query)
- SuperAudit overlay (CSS-only change tracking, source provenance color coding)
- LATCH histogram scrubbers, category chips with GROUP BY COUNT badges
- StateManager Tier 2 persistence (ui_state table, key-value)
- MutationManager command-pattern undo/redo
- Three-tier persistence model (D-005)

---

## Feature Landscape

### Table Stakes — Formulas Explorer

Features users expect from any formula/expression system in a data tool. Missing these makes the product feel unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Typed chip wells — Calculations / Filters / Sorts | Tableau, Airtable, Excel all organize formulas by clause type; mixing types is a footgun (Quantrix's eclipse conditions) | MEDIUM | Three wells with type guards at drop-time. FilterProvider already handles filter-type chips; Sorts extend that pattern. Calculations are new. |
| AND-composition for Filter chips | Users expect multiple filters to narrow, not widen, the result set. Every major tool (Excel, Airtable, Notion) defaults to AND. | LOW | Already validated in FilterProvider. Document explicitly. Cross-chip OR lives inside a single chip's DSL expression — this is the table-stakes rule. |
| Lexicographic sort priority (chip order = ORDER BY priority) | Tableau's Rows/Columns shelf ordering, Excel's multi-level sort: first chip = primary, second = tiebreaker. Users learn this pattern cross-tool. | LOW | Chip order in the Sorts well maps directly to ORDER BY clause position. Reordering chips = reordering priority. |
| Live preview — chip changes trigger query re-run | Tableau's shelf: any change re-renders; Notion Formulas 2.0 live preview; Excel conditional formatting shows result immediately | MEDIUM | Wires into existing StateCoordinator subscription. Every chip mutation triggers supergrid:query. The existing rAF coalescing (4 calls → 1 request) handles rapid drag sequences. |
| Compiled SQL explain panel | Tableau's "view underlying data", Quantrix's dependency inspector, Excel's formula bar — power users expect to see what the tool computed. Brenda's primary diagnostic surface. | MEDIUM | Read-only SQL panel adjacent to chip wells. Shows produced SQL with bind-value placeholders (never raw values). Toggle show/hide. |
| Type-signature validation at drop time | Notion Formulas 2.0 shows "Show Types" — inline type checking. Airtable field types gate which formula functions are legal. | MEDIUM | At chip-drop time, not execution time. Wrong-type drop highlights the well red; chip bounces back. Uses existing AxisField/FilterField type patterns extended to FormulaCard type_signature. |
| Compile-time dependency cycle detection | Quantrix calls these "eclipse conditions" — two formulas overwriting the same value. Its Dependency Inspector is the standard reference. Airtable's formula field also reports circular reference errors. | MEDIUM | DAG topological sort on Calculations well. Cycles surface as chip-level error badges (not silent failure). Pseudocode in WA-2. |
| Undo/redo for chip arrangement changes | Cmd+Z undoing a column resize or filter chip drop is expected in any professional tool. | LOW | Chip arrangement changes hook into MutationManager command-pattern. Undo restores prior chip order and triggers re-query. Consistent with KanbanView drag undo. |
| Error state visualization on chips | Notion's formula error highlighting, Excel's #REF! / #NAME? error cells, Airtable's formula error display in the field. | LOW | Error chips show red border + tooltip. Compilation errors are per-chip, not global. Each chip has an `error` state in its datum. |
| Cross-view filter persistence | LATCH Filters already persist across view switches (FilterProvider is a Tier 2 provider). Formulas Explorer filter chips must do the same. | LOW | FilterProvider already handles this. Formula-Explorer filter chips compile into the same FilterProvider API calls. No new persistence logic. |

### Table Stakes — Marks Explorer

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Predicate → CSS class assignment (conditional encoding) | Tableau's Color mark shelf, Excel conditional formatting rules manager, Airtable's conditional row coloring — the "highlight rows that match a condition" pattern is universal. | MEDIUM | v1: predicate chip produces a CSS class name. Post-query annotation per row. Marks never filter — they only annotate. FE-RG-07 is the load-bearing invariant. |
| Post-query annotation (never filters result set) | Tableau marks do not remove rows from the view; Excel CF does not remove rows from the sheet. Marks = "all rows present, some highlighted." | LOW | Structural rule, not feature. Enforced by the compilation pipeline. Marks produce `(rowId, className)` tuples, not WHERE clauses. |
| Theme-decoupled class semantics | Excel: "Red fill, dark red text" embedded in the rule. Tableau: field mapped to color palette. Isometry target: predicate decides which class; the active CSS theme decides what that class looks like. | LOW | `.urgent`, `.flagged`, `.overdue` class names are stable predicates; `[data-theme="nextstep"] .urgent` can differ from `[data-theme="material3"] .urgent`. This is the table-stakes correctness guarantee — predicates work across themes without rewriting. |
| Rule ordering with priority | Excel Rules Manager shows rules top-to-bottom where the first matching rule wins (Stop If True). Tableau: marks layer by order of the shelf. | LOW | Chip order in the Marks well = class assignment priority. If multiple predicates match a row, all matching classes are applied (additive, not first-wins). Document explicitly in WA-1. |

### Table Stakes — Audits Explorer

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Anomaly flag annotation (not exclusion) | Data quality tools (Ataccama, Soda, Anomalo) universally surface flags as badges/warnings that coexist with the data row, not filter it out. Users need to see bad rows to fix them. | MEDIUM | Audits produce `(rowId, flagType, message)` tuples, never WHERE clauses. Consistent with SuperAudit overlay (existing CSS audit tracking). FE-RG-08 is the load-bearing invariant. |
| Validation rule annotation | Airtable's data validation flags (community pattern: formula field as error indicator), Excel Data Validation (marks invalid cells). Expected for any data-quality workflow. | MEDIUM | Second chip category in Audits Explorer. Same post-query annotation structure as anomaly rules, different flag type. Message surfaces in card tooltip or badge. |
| Non-interference with result set | Audit flags coexist with filters. A row that is anomalous but passes all filters appears in the result set with a flag badge. A row that fails a filter is absent regardless of audit state. | LOW | Structural guarantee from compilation pipeline (WA-2). Not a feature to implement but a contract to enforce. |

### Table Stakes — Chip-Well Geometry (WA-6)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Pointer-event drag for chip DnD | WKWebView intercepts HTML5 dragstart (proven in v7.2 DnD migration). ALL drag surfaces in Isometry now use pointer events. Users expect drag to work. | MEDIUM | Extends existing pointer-event DnD patterns from ProjectionExplorer and KanbanView. Ghost chip + elementsFromPoint hit-testing per D-017. |
| Drop-zone type enforcement (accept/reject per well) | Tableau's shelf type system rejects wrong mark types (cannot drop a measure on Rows when Columns expects a dimension). | LOW | Well-level type predicate. At pointermove, candidate drop zones light green/red based on type compatibility. On pointerup on rejected zone, chip animates back to source. |
| Keyboard equivalent for chip reorder | Accessibility requirement. Roving tabindex is the established Isometry pattern (CommandBar ArrowDown/Up, ViewTabBar ArrowLeft/Right). | MEDIUM | Tab to chip, ArrowLeft/ArrowRight to reorder within well, ArrowUp/ArrowDown to move between wells, Enter to edit, Delete to remove. ARIA live region announces position changes. |
| Copy-by-default cross-well drag | Tableau: dragging a field to a different shelf copies it (same field can appear on both Rows and Columns). Excel: Ctrl+drag copies a cell. Users expect copy-not-move for cross-context reuse. | LOW | Default: copy chip to target well, source chip remains. Modifier key (Option/Alt) for move. Cross-explorer drag follows same rule (chip from Filters to Audits → copy by default). FE-RG-08 open question resolved: copy, not reject. |
| Empty-well degenerate state | All tools have a clear "drag here" affordance when a shelf/well is empty (Tableau's greyed "Drop field here", Excel's "Click to add rule"). | LOW | Empty well renders a dashed placeholder with text cue. CSS-only state via `:empty` pseudo-class or `data-well-empty` attribute per D-data-attribute-over-has pattern. |
| Drag abort animation | If drag is released outside a valid drop zone, chip animates back to origin (CSS transition to original position). Expected from all native DnD implementations. | LOW | On pointerup with no valid target, animate chip position back to `getBoundingClientRect()` of source slot. 200ms ease-out, consistent with existing FLIP animation (v3.1). |

### Differentiators

Features that set Isometry apart from Tableau, Airtable, Notion in this domain.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Promotion lifecycle: ad hoc chip → named Formula Card | Tableau has no "save this shelf as a reusable formula" concept — formulas live in worksheets. Airtable formula fields are per-database. Isometry can offer a named, version-controlled, dataset-scoped formula library. | HIGH | Bottom-up: arrange chips experimentally, "Save as Formula" lifts the arrangement into a named Formula Card. Top-down: drag a saved card into a well. FE-RG-10: explicit user action only, never automatic. The distinction between ad hoc chips (show fragment) and saved cards (show name pill) is the key UX signal. |
| Formula Card with type signature validated at drop time (not execution time) | Tableau validates at execution (VizQL query fails). Notion Formulas 2.0 type-checks in the editor but not before you commit. Isometry can validate at the drop gesture, before the formula touches data. | HIGH | Type signatures specify expected input column types and output type. Wrong-type drop: chip highlights red, bounces back. No query is issued for type-invalid arrangements. |
| Grouping-agnostic Calculations (same chip, different SQL per view) | Tableau's calculated fields are view-specific — a FIXED LOD expression must be rewritten per worksheet. Isometry Formulas Explorer does not own GROUP BY; the active view explorer does. The same Calculation chip produces correct SQL in SuperGrid (with PAFV GROUP BY) or List view (no GROUP BY). | MEDIUM | FE-RG-01 is the load-bearing invariant. This is the PAFV insight applied to formulas. Document thoroughly in WA-2 compilation pipeline spec. |
| Dependency DAG visualization for Calculation cycles | Quantrix's Dependency Inspector is professional-grade but embedded in a $3K/year product. Isometry can surface cycle detection at chip-drop time with inline visual indicators. | MEDIUM | Cycles shown as chip-level red arrow between dependent chips in the well. Error message names the cycle participants. No query issued when cycle exists. |
| SQL explain panel with bind-value transparency | Excel's formula bar shows the raw formula. Tableau's "view data" shows the result, not the query. Isometry can show the compiled SQL with placeholder markers for bind values — the power-user diagnostic no other consumer tool offers. | LOW | Read-only `<pre>` block below the chip wells. Toggleable. Shows SQL with `?` placeholders and a bind-values sidebar. Brenda's bug-report surface. |
| Cross-explorer chip copy (Filters → Audits → Marks) | No comparable tool allows the same predicate primitive to serve as a filter, an audit rule, or a mark condition. Same DSL, three execution contexts. | LOW | Copy-by-default cross-well drag works across explorer panels. FE-RG-06: Formula Card has no intrinsic category. Role determined by which well receives it. |
| Anti-patching golden-test corpus | Quantrix relies on user test cases. Notion has no formula correctness guarantee surface. Isometry can ship a frozen corpus of (chip_arrangement, expected_sql, expected_result_set) triples that are immutable by policy. Bug fixes add cases; they never weaken existing assertions. | MEDIUM | 30+ test cases in WA-4. Extends the anti-patching rule from v6.1 Test Harness to the formula domain. CI gate. |
| Version retention for Formula Cards | All saves create a new version. Rollback at any time. No comparable consumer data tool (Airtable, Notion) versions formula definitions. | LOW | Schema decision. Every upsert to `formula_cards` increments version counter. Old versions retained. No pruning at v1. |

### Anti-Features

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| OR-composition across Filter chips | "I want cards where Company = MSFT OR Company = AAPL" — natural user ask | Implicit OR across chips destroys idempotency. Order matters, chip count matters, composability becomes unpredictable. Quantrix's eclipse conditions originate from implicit composition rules. | Single chip whose DSL contains `Company IN ('MSFT', 'AAPL')`. The well gets AND; each chip gets an OR expression if needed. Document this explicitly in WA-2 and explain it in the explain panel. |
| Marks producing filtered result sets | "I only want to see highlighted rows" — natural ask after applying a Mark | Blurs the Marks/Filters boundary. If Marks filter, they are Filters with extra steps — and now every predicate must declare its execution layer at runtime instead of at design time. | Marks highlight; Filters exclude. If user wants to see only urgent rows, they add a Filter chip. The Mark and the Filter are independent and composable. Document FE-RG-07 prominently in WA-1. |
| Formulas Explorer owning GROUP BY | Users accustomed to Excel pivot tables expect to set grouping in the formula area | Violates the PAFV contract. SuperGrid owns grouping via PAFVProvider. If Formulas owned GROUP BY, the same Calculation chip could not work across views. This was explicitly rejected in the handoff (FE-RG-01). | SuperGrid's Projection Explorer owns grouping. Calculation chips produce aggregations that consume the active grouping. Document with the worked example: `SUM(revenue)` chips produces `SELECT SUM(revenue)` and the view's GROUP BY is injected by PAFVProvider, not by the chip. |
| Natural-language formula input (AI-assisted) | "Write a formula in plain English" — compelling product vision | Requires an AI/NLP layer that adds external network dependency to a local-first product. The formula engine must be correct-by-construction first. AI assistance has high surface area for hallucinated SQL. | Defer to a future milestone. The Title field on Formula Cards anticipates it but does not implement it. The DSL grammar (WA-2) must be specced and stable before AI targeting it. |
| Pandoc-style formula import from Excel / Quantrix | Power users want to migrate existing formula libraries | Requires reverse-engineering proprietary formula grammars (Excel's INDIRECT, Quantrix's natural-language references). High complexity, low frequency. | Export/import of Isometry's own Formula Card DSL via JSON. Migration from other tools is a CLI-tier concern if ever needed. |
| Uncategorized "catch-all" formula well | Simpler to start — one well, user organizes mentally | Destroys the compilation pipeline's clause ordering guarantee. If chips are uncategorized, the compiler must guess whether `Company = MSFT` is a filter or a mark condition. Quantrix's formula composition issues trace to this pattern. | Typed wells are non-negotiable. The three-category structure (Calculations / Filters / Sorts) is load-bearing for deterministic compilation. |
| Inline formula editing directly in cell (spreadsheet-style) | Excel/Sheets: click cell, type formula in formula bar | Isometry cards have rich content; double-click opens card detail. In-grid cell editing was explicitly deferred (PROJECT.md Out of Scope). Formula editing via chip-well DSL editor, not inline cell entry. | Formula Chip editor opens as an inline popover on chip click, not in the grid cell. Consistent with existing design. |
| Real-time collaborative formula editing | Multiple users editing the same chip simultaneously | Single-user model is the launch target. CloudKit sync is last-writer-wins for Formula Cards, not operational transform. Collaborative editing requires OT/CRDT infrastructure that does not exist. | Version retention ensures rollback. CloudKit conflict resolution for formula_cards: keep-both with version branching (safe — formulas are named, version-keyed). |
| Theme-embedded predicate color values | "Make urgent rows red" embedded in the Marks predicate | Predicate color values couple the formula to one theme. Changing from NeXTSTEP to Material 3 would require rewriting all predicates. | Predicate produces a class name (`.urgent`). Theme CSS decides what `.urgent` looks like per `[data-theme]`. Document FE-RG-09 in WA-1. |

---

## Feature Dependencies

```
Three-Explorer Specification (WA-1)
    └──required by──> Compilation Pipeline Spec (WA-2)
    └──required by──> UX Interaction Spec (WA-5)
    └──required by──> Chip-Well Geometry Contract (WA-6)

Compilation Pipeline Spec (WA-2)
    └──required by──> Golden-Test Corpus Plan (WA-4)
    └──required by──> UX Interaction Spec (WA-5, explain panel section)
    └──depends on──> FilterProvider existing API (filter chips compile via existing query path)
    └──depends on──> PAFVProvider GROUP BY injection (Calculations never own GROUP BY)

Formula Card Schema + Lifecycle (WA-3)
    └──required by──> UX Interaction Spec (WA-5, promotion flow section)
    └──depends on──> WA-1 (need to know card roles before spec'ing promotion)
    └──depends on──> CloudKit sync model from SQLITE-MIGRATION-PLAN-v2.md

Golden-Test Corpus Plan (WA-4)
    └──requires──> WA-1 complete (categories defined)
    └──requires──> WA-2 complete (compilation pipeline specced)
    └──depends on──> realDb() factory + makeProviders() from v6.1 Test Harness
    └──depends on──> anti-patching rule (identical to v6.1 policy, just extended)

UX Interaction Spec (WA-5)
    └──requires──> WA-1, WA-2, WA-3, WA-6 complete
    └──depends on──> pointer-event DnD utilities (D-017, validated in v7.2)
    └──depends on──> AppDialog (<dialog>) for Save-as-Formula flow

Chip-Well Geometry Contract (WA-6)
    └──requires──> WA-1 (to know which chip categories each well accepts)
    └──pattern from──> time-explorer-geometry.md (structural reference, but chip wells are NOT PAFV-bound)
    └──consumed by──> WA-5 (UX layers interaction semantics on top of geometry)
    └──consumed by──> ProjectionExplorer (same chip-well primitive, retroactively)

Live preview (query re-run on chip mutation)
    └──requires──> StateCoordinator subscription pattern (established in v3.0)
    └──requires──> rAF coalescing (4-call → 1-request, validated in v3.0)

Type-signature validation at drop time
    └──requires──> Formula Card schema with type_signature field (WA-3)
    └──requires──> SchemaProvider column type data (validated in v5.3)

Dependency cycle detection
    └──requires──> Calculations chip well (WA-1)
    └──requires──> compilation pipeline DAG algorithm (WA-2)

Chip↔Card promotion
    └──requires──> Formula Card schema (WA-3)
    └──requires──> chip-well state serialization (WA-6 §4)
    └──depends on──> MutationManager for addFormulaCard undo safety (pattern from v7.1)

Post-query Marks annotation
    └──requires──> compilation pipeline Marks pass (WA-2)
    └──conflicts with──> FilterProvider (Marks predicates must NOT enter WHERE clause)
    └──reads──> same result-set row data that drives D3 data join

Post-query Audits annotation
    └──requires──> compilation pipeline Audits pass (WA-2)
    └──independent of──> FilterProvider (audit flags coexist with filter exclusions)
    └──related to──> SuperAudit overlay (existing CSS overlay; Audits Explorer extends this concept)
```

### Dependency Notes

- **WA-1 is the foundational document.** WA-2 through WA-6 all depend on the category definitions it establishes. Start WA-1 before any other work area.
- **WA-6 (chip-well geometry) and WA-3 (formula card schema) can proceed in parallel after WA-1 completes.** WA-6 is generic infrastructure; WA-3 is data-model spec. Neither blocks the other.
- **WA-4 (golden tests) and WA-5 (UX) must wait for WA-2.** The test corpus requires the compilation pipeline to be specced (to hand-write expected SQL). The UX spec requires the explain panel contract from WA-2.
- **WA-5 is the final assembly.** It consumes all other work areas. Schedule it last.
- **FilterProvider is a consumer AND a producer boundary.** Formula-Explorer filter chips compile into the same FilterProvider mutation calls. This is a seam to document in WA-2 — Formulas Explorer does not replace FilterProvider; it adds a higher-level chip-arrangement surface that translates to FilterProvider calls.
- **Marks post-query annotation is a new execution path.** Existing SuperAudit is CSS-only (toggles classes on existing DOM nodes). Marks annotation requires a per-row class assignment based on predicate evaluation after query, before D3 data join render. This needs a new pass in the query result processing pipeline.

---

## MVP Definition for v15.0 (Architecture Milestone)

This is an architecture-only milestone. "MVP" here means the minimum set of specifications that unlock downstream implementation milestones.

### Ship With (v15.0 — this architecture milestone)

- [ ] WA-1: Three-Explorer Specification — explorer boundaries, chip well categories, compilation targets, out-of-scope lists
- [ ] WA-2: Compilation Pipeline Specification — SQL clause mapping, dependency DAG algorithm, bind-value protocol, Marks/Audits post-query annotation algorithm, explain-panel contract
- [ ] WA-3: Formula Card Schema and Lifecycle — SQLite DDL, type-signature validation algorithm, versioning strategy, promotion API signatures, sync conflict resolution for 3 scenarios
- [ ] WA-4: Golden-Test Corpus Plan — fixture dataset SQL, initial ~30 test case corpus with hand-written expected SQL, runner architecture pointing to v6.1 infrastructure, anti-patching policy statement
- [ ] WA-5: UX Interaction Spec — wireframes (text-described), WKWebView constraints confirmed, explain panel placement, Save-as-Formula flow, error states
- [ ] WA-6: Chip-Well Geometry Contract — all 12 template sections, explicit "N/A — operator surface" in §3, reusable (no Formulas-Explorer-specific language)

### Unlocked After v15.0

- [ ] DSL grammar milestone — token-level syntax, parser, type checker
- [ ] Chip-well UI implementation milestone — pointer DnD, well rendering, chip tokens, type validation UI
- [ ] Formulas Explorer implementation — Calculations/Filters/Sorts compilation, FilterProvider integration
- [ ] Marks Explorer implementation — post-query class assignment, theme coupling
- [ ] Audits Explorer implementation — anomaly/validation flagging, badge/overlay geometry

### Future Consideration (v2+)

- [ ] AI-assisted formula authoring (natural language → DSL) — requires stable DSL grammar first
- [ ] Multi-user formula collaboration — requires OT/CRDT infrastructure
- [ ] Cross-source formula import from Excel/Quantrix — CLI-tier concern
- [ ] Operator-contract template fork — create when third operator-surface explorer appears (two instances insufficient signal)

---

## Feature Prioritization Matrix

| Feature | User Value | Spec Cost | Priority |
|---------|------------|-----------|----------|
| WA-1: Three-Explorer boundary spec | HIGH | LOW | P1 — foundational, all others depend on it |
| WA-2: Compilation pipeline spec | HIGH | MEDIUM | P1 — required by WA-4, WA-5 |
| WA-6: Chip-well geometry contract | HIGH | MEDIUM | P1 — required by WA-5; reusable primitive |
| WA-3: Formula Card schema | HIGH | MEDIUM | P1 — required by WA-5; unlocks implementation |
| WA-4: Golden-test corpus plan | MEDIUM | MEDIUM | P1 — quality gate; establishes anti-patching rule |
| WA-5: UX interaction spec | HIGH | HIGH | P1 — final assembly; depends on all others |
| Typed chip wells (Calculations/Filters/Sorts) | HIGH | LOW | P1 — table stakes, in WA-1 |
| Bind-value SQL injection prevention | HIGH | LOW | P1 — structural rule in WA-2, non-negotiable |
| Dependency DAG + cycle detection | MEDIUM | MEDIUM | P1 — Quantrix lesson; safety guarantee |
| Post-query Marks annotation | HIGH | MEDIUM | P1 — core Marks Explorer contract |
| Post-query Audits annotation | HIGH | MEDIUM | P1 — core Audits Explorer contract |
| Explain panel spec | MEDIUM | LOW | P2 — power-user feature, low spec cost |
| Formula Card versioning | MEDIUM | LOW | P2 — schema decision, cheap to add |
| Chip↔Card promotion lifecycle | HIGH | MEDIUM | P2 — differentiator; depends on WA-3 |
| Cross-explorer chip copy | MEDIUM | LOW | P2 — follows from WA-6 geometry |
| Operator-contract template fork | LOW | MEDIUM | P3 — premature; defer until third operator surface |

---

## Comparable Product Analysis

| Feature Domain | Tableau | Notion Formulas 2.0 | Airtable | Excel | Isometry Approach |
|---------------|---------|---------------------|----------|-------|-------------------|
| Formula organization | Shelves per mark channel (Rows, Columns, Color, Size, Shape, Label, Tooltip) | Single formula field per column | Single formula field per column | Formula bar per cell; Rules Manager for conditional formatting | Three typed chip wells (Calculations / Filters / Sorts) per Formulas Explorer; Marks Explorer as peer |
| Type checking | At VizQL query execution (runtime error) | In editor with "Show Types" (parse-time) | At field creation (field-type-aware) | At cell commit (#NAME?, #REF! displayed) | At chip-drop gesture (before query); type_signature on Formula Card |
| Composition rule for filter-type predicates | Fields on Filter shelf compose by AND; OR requires a set action or FIXED LOD | Formulas are per-row; no multi-filter composition | View filters compose by AND; field filters compose by AND | Rules Manager: rules ordered, first-match wins | Chips in Filters well compose by AND; OR lives inside single chip DSL |
| Grouping ownership | Worksheet owns dimension/measure placement; calculated fields adapt | N/A | Grouped views own grouping | Pivot table owns grouping; conditional formatting is independent | PAFVProvider / view explorer owns GROUP BY; Formulas Explorer never owns it (FE-RG-01) |
| Conditional formatting | Color mark shelf; calculated field with IF/THEN produces discrete color | No conditional formatting; formula fields compute values that can color-code via views | Formula column used as indicator; conditional coloring via Interface Designer | Conditional Formatting Rules Manager (top-down priority, Stop If True) | Marks Explorer: predicate → CSS class; theme decides class appearance; chip order = application priority |
| Audit/validation flagging | No dedicated audit surface; data quality via filters or calculated fields | No audit surface | Formula field as error indicator (community workaround); no native audit UI | Data Validation marks invalid cells; no persistent annotation layer | Audits Explorer: two chip wells (anomaly + validation); post-query flag annotation; flags coexist with result set (never exclude) |
| Saved formula reuse | Calculated fields in workbook; no cross-workbook library | Formula per column in database; no reuse | Formula per field; no cross-base reuse | Named Ranges, LAMBDA functions (Excel 365) as reusable formulas | Formula Card: named, versioned, dataset-scoped; drag to any compatible chip well; type-signature validated at drop |
| Explain / transparency | "View Underlying Data" shows result set; VizQL query not exposed | Live Preview panel shows current value or errors | No compilation transparency | Formula bar shows raw formula; Trace Precedents shows dependency arrows | Explain panel: compiled SQL with bind-value placeholders; power-user diagnostic; always visible alongside chip wells |
| SQL injection safety | Tableau's VizQL is a proprietary layer; no user-facing SQL | Formula language compiled to internal representation | Formula language compiled; no raw SQL | Formula language; no raw SQL | DSL→SQL compiler produces `(sql_text, [bind_values])` tuples exclusively; string concatenation of user input into SQL is a bug by definition (FE-RG-02) |

---

## Sources

- Tableau Marks shelf and conditional formatting: https://www.tableau.com/drive/conditional-formatting
- Tableau Practical Guide (Marks Cards, encoding, LOD): https://www.oreilly.com/library/view/practical-tableau/9781491977309/ch10.html
- Notion Formulas 2.0 type system and live preview: https://www.notion.com/help/guides/new-formulas-whats-changed
- Notion formula syntax and type checking: https://www.notion.com/help/formula-syntax
- Airtable formula field overview: https://support.airtable.com/docs/formula-field-overview
- Airtable enterprise audit logs: https://support.airtable.com/docs/accessing-enterprise-audit-logs-in-airtable
- Excel Conditional Formatting Rules Manager: https://www.w3schools.com/excel/excel_cf_manage_rules.php
- Quantrix formula composition and eclipse conditions: https://quantrix.com/help/modeler/About_Quantrix_Formulas.htm
- Quantrix Dependency Inspector: https://quantrix.com/help/modeler/Using_Dependency_Inspector.htm
- OWASP SQL Injection Prevention (bind-value parameterization): https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- Data anomaly detection and validation rule UX patterns: https://www.ataccama.com/platform/data-quality
- Chip UI design patterns (Mobbin): https://mobbin.com/glossary/chip
- Drag-and-drop UX best practices: https://www.pencilandpaper.io/articles/ux-pattern-drag-and-drop
- Project context: `.planning/PROJECT.md` (v15.0 milestone definition, FE-RG-01 through FE-RG-14, D-003 SQL safety, D-017 pointer events)
- Architecture handoff: `.planning/formulas-explorer-handoff-v2.md` (decomposition decisions, WA-1 through WA-6, regression guards)
- Original hypothesis: `.planning/Formulas Explorer discussion.md` (chip well wireframe, original five categories)

---
*Feature research for: v15.0 Formulas Explorer Architecture — three-explorer decomposition (Formulas/Marks/Audits), compilation pipeline, chip-well geometry, Formula Card lifecycle*
*Researched: 2026-04-27*
