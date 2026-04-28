# Phase 182: Three-Explorer Boundary Spec - Research

**Researched:** 2026-04-27
**Domain:** Architecture specification authoring — Formulas/Marks/Audits explorer decomposition
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: DSL Example Lexicon Depth**
Pattern catalog approach — one canonical example per chip sub-type (~15–20 examples). Covers: row-level calc, aggregate calc, window function, equality filter, range filter, compound filter, single sort, multi-sort, conditional encoding mark, anomaly audit, validation audit. Shows the shape without designing the grammar. Not an exhaustive corpus (that's WA-4's job).

**D-02: Regression Guard Verification Format**
Grep-able assertions for each of the 14 FE-RG guards plus FE-RG-15. Each guard gets a one-liner grep command or structural check a reviewer can run against the spec files. Matches the handoff's own "Verifiable checks" pattern. Example: `grep -r "GROUP BY" 01-three-explorer-spec.md` returns only prohibitions, never ownership claims.

**D-03: Anti-Feature Documentation**
Bullet + one-sentence rationale format for SPEC-05. Each anti-feature gets: the rejected behavior, a one-sentence "why not" rationale, and a cross-reference to the relevant FE-RG guard where applicable. No worked examples needed — the rationale is sufficient to prevent re-litigation.

**D-04: Cross-Category References**
Name the pattern, defer the mechanics. Phase 182 acknowledges that Calculations can reference Filters (e.g., "Filtered Totals") and states which explorer owns the cross-reference. The dependency resolution algorithm and compilation mechanics belong in WA-2 (Phase 184). This spec says "cross-category references exist and are resolved by the compilation pipeline" — it does not specify how.

### Claude's Discretion

- Spec document internal structure (heading order, section breaks) — follow the WA-1 artifact description from the handoff
- Exact count of examples in the lexicon appendix (15–20 range, use judgment on coverage)

### Deferred Ideas (OUT OF SCOPE)

None from the discussion session. All deferred items are captured in REQUIREMENTS.md under Future Requirements and Out of Scope sections.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SPEC-01 | Three-explorer boundary spec defines Formulas (data-layer), Marks (view-layer), Audits (semantic-flag) with one-sentence type signatures per chip well category | Handoff v2 §Architecture Decision, Decision 2 defines all three explorers and chip well categories. Type signatures are derivable from each well's compilation target. |
| SPEC-02 | Composition rules within and across categories documented (AND-composition for Filters, lexicographic for Sorts, DAG for Calculations) | Handoff v2 §Decision 4, "Within-category composition rules" subsection. All three rules are fully specified. |
| SPEC-03 | Explicit out-of-scope list per explorer (Formulas never owns GROUP BY, Marks never alters row membership, Audits never excludes) | Handoff v2 §Decision 3 (grouping), FE-RG-01, FE-RG-07, FE-RG-08. The three canonical anti-features are named there. |
| SPEC-04 | DSL example lexicon appendix with canonical examples for all downstream WAs to reference verbatim | Locked by D-01: 15–20 examples spanning all chip sub-types. Appendix A in handoff provides worked decomposition to use as model. |
| SPEC-05 | Anti-feature documentation (OR across filter chips, Marks filtering, FormulasProvider owning GROUP BY, inline cell editing) | Locked by D-03: bullet + one-sentence rationale format, cross-reference FE-RG guard. Source material in REQUIREMENTS.md Out of Scope table and handoff FE-RG guards. |
| SPEC-06 | Every example from original `Formulas Explorer discussion.md` placed unambiguously into one category | Source: discussion.md (5 examples in table, 4 chip category descriptions, 4 key questions). Handoff Appendix A already works one example. |
| GARD-01 | All 14 FE-RG guards from handoff document present in specs with verification checks | Locked by D-02: grep-able one-liner per guard. All 14 guards enumerated in handoff §Regression Guards. |
| GARD-02 | FE-RG-15 (DSL example lexicon consistency across WAs) documented and enforceable | FE-RG-15 is not in the handoff's numbered list (which ends at FE-RG-14) — it is referenced in the REQUIREMENTS.md GARD-02 description. Must be defined freshly in this spec as the 15th guard with a verification check. |
</phase_requirements>

---

## Summary

Phase 182 produces a single specification document (`01-three-explorer-spec.md`) in `.planning/milestones/v15.0-formulas-explorer/`. This is a pure writing task with no code. All source material exists: the canonical decomposition is fully articulated in `formulas-explorer-handoff-v2.md`, the examples to place are enumerated in `Formulas Explorer discussion.md`, and all locked decisions are recorded in CONTEXT.md.

The primary challenge is organizational, not investigative. The spec must synthesize material from the handoff into a structured document matching the WA-1 description, place each original example unambiguously, append a lexicon of 15–20 canonical chip examples, enumerate 14+1 regression guards with grep-able verification checks, and document anti-features with one-sentence rationales. Nothing needs to be invented; everything needs to be faithfully transcribed and organized.

One gap exists: FE-RG-15 is referenced in REQUIREMENTS.md GARD-02 but not present in the handoff's numbered list (which ends at FE-RG-14). The spec author must define FE-RG-15 fresh — its content is implied ("DSL example lexicon consistency across WAs") and its verification check must be formulated.

**Primary recommendation:** Write `01-three-explorer-spec.md` by working through the WA-1 artifact description in the handoff section by section. Use Appendix A of the handoff as the model for the discussion.md example placement table. Define FE-RG-15 explicitly as the cross-WA DSL consistency guard.

---

## Standard Stack

This phase produces Markdown documents only. No library dependencies.

| Tool | Version | Purpose |
|------|---------|---------|
| Markdown (GFM) | — | Spec document format |
| grep | system | Verification check commands specified in spec |

**Installation:** None required.

---

## Architecture Patterns

### Spec Document Structure

The WA-1 artifact description in the handoff (`formulas-explorer-handoff-v2.md`, §Work Areas, WA-1) specifies what the document must contain. The recommended heading order follows that description:

```
01-three-explorer-spec.md
├── Preamble (purpose, relationship to handoff)
├── § Formulas Explorer (data-layer)
│   ├── Chip well categories (Calculations, Filters, Sorts) — each with type signature
│   ├── Compilation targets
│   ├── Composition rules
│   └── Out-of-scope list
├── § Marks Explorer (view-layer)
│   ├── Chip well categories (Conditional encoding) — type signature
│   ├── Compilation target (post-query CSS class annotation)
│   ├── Composition rules
│   └── Out-of-scope list
├── § Audits Explorer (semantic-flag layer)
│   ├── Chip well categories (Anomaly rules, Validation rules) — type signatures
│   ├── Compilation target (post-query flag annotation)
│   ├── Composition rules
│   └── Out-of-scope list
├── § Cross-Explorer Composition
│   ├── Fixed SQL clause order table
│   ├── Cross-category reference acknowledgment (D-04)
│   └── Anti-features (SPEC-05, D-03 format)
├── § Discussion.md Example Placement (SPEC-06)
│   └── Table: example → explorer/category + one-sentence rationale
├── Appendix A: DSL Example Lexicon (SPEC-04, D-01)
│   └── 15–20 canonical examples, one per chip sub-type
└── Appendix B: Regression Guards (GARD-01, GARD-02)
    └── Table: ID | Guard | Rationale | Verification check
```

### Type Signature Format

Each chip well category needs a one-sentence type signature. Derive these from what each well's compiler emits:

| Category | Type signature (one sentence) |
|----------|-------------------------------|
| Calculations | Accepts expressions that produce a typed value (numeric, text, date, boolean) from row columns or aggregations; compiles to the SQL `SELECT` clause. |
| Filters | Accepts predicates that return boolean over row columns; compiles to the SQL `WHERE` clause, composed by AND across chips. |
| Sorts | Accepts column references with direction (ASC/DESC); compiles to the SQL `ORDER BY` clause, ordered by chip position. |
| Conditional encoding (Marks) | Accepts boolean predicates over row columns; produces a `Map<rowId, string[]>` of CSS class assignments via post-query annotation; never modifies row membership. |
| Anomaly rules (Audits) | Accepts boolean predicates that identify statistically or semantically anomalous rows; produces flag annotations per row via post-query annotation; never excludes rows. |
| Validation rules (Audits) | Accepts boolean predicates that identify data-quality violations; produces warning annotations per row via post-query annotation; never excludes rows. |

### Discussion.md Example Placement Table

The `Formulas Explorer discussion.md` contains these items that SPEC-06 requires be placed:

| Item in discussion.md | Explorer / Category | Rationale |
|-----------------------|---------------------|-----------|
| Calculations well: "Totals" | Formulas / Calculations | Aggregation expression; compiles to SELECT with GROUP BY from view explorer |
| Calculations well: "Subtotals" | Formulas / Calculations | Aggregation with intermediate group level; same as Totals |
| Calculations well: "Filtered Totals" | Formulas / Calculations (cross-category ref, D-04) | Aggregation referencing a Filter; ownership in Formulas, resolution by compilation pipeline |
| Filters well: "Company = MSFT" | Formulas / Filters | Equality predicate; compiles to WHERE clause |
| Sorts well: "Company Ascending" | Formulas / Sorts | Column reference with ASC direction; compiles to ORDER BY |
| Formats: "Banded rows with parameterized D3.js palettes" | Theme config (not any explorer) | Static theme rule; no predicate; lives in theme CSS |
| Audits: "Calculated values" | Formulas / Calculations (with overlay rendering hint) | Data-layer derived value; rendering hint is a view concern, not Audits |
| Original framing of Formats category | Marks Explorer / Conditional encoding (for conditional rules) + Theme config (for palettes/typography) | Split confirmed by handoff Decision 2 table |
| "Highlight rows where priority > 3" (Appendix A example) | Marks / Conditional encoding | Predicate → CSS class; consequence is rendering, not filtering |
| "Flag rows where balance ≠ sum_of_transactions" (Appendix A example) | Audits / Validation rules | Data-quality predicate; surfaces as badge, does not exclude |
| "Color-code by region using D3 ordinal palette" (Appendix A example) | Marks / Conditional encoding | Predicate per region value → class; theme defines palette |
| "Show subtotals per region in a totals row" (Appendix A example) | Formulas / Calculations + view explorer grouping | SUM(revenue) in Formulas; GROUP BY region from SuperGrid |

### Regression Guard Table (GARD-01 + GARD-02)

All 14 existing FE-RG guards from the handoff plus the new FE-RG-15:

| ID | Guard (abbreviated) | Verification check |
|----|--------------------|--------------------|
| FE-RG-01 | Formulas never owns GROUP BY | `grep -n "GROUP BY" 01-three-explorer-spec.md` returns only prohibitions |
| FE-RG-02 | DSL→SQL compiler produces (sql_text, [bind_values]) tuples; no string concatenation | `grep -n "concat\|interpolat\|f-string\|\+ sql" 01-three-explorer-spec.md` returns only prohibitions |
| FE-RG-03 | Filters compose AND only; OR lives inside a single chip's DSL | `grep -n "OR" 01-three-explorer-spec.md` appears only in "inside a chip" context, never as cross-chip rule |
| FE-RG-04 | Sorts compose lexicographically by chip order | Section on Sorts composition names chip order explicitly |
| FE-RG-05 | Calculations form a dependency DAG; cycles are compile-time errors | Calculations section references DAG and cycle error; does not specify algorithm (WA-2) |
| FE-RG-06 | Formula Card has no intrinsic category; role determined by chip well | Card discussion names both exploration and curation paths without assigning a fixed category |
| FE-RG-07 | Marks produce CSS classes via post-query annotation; never alter result set membership | Marks out-of-scope list explicitly names "altering row membership" |
| FE-RG-08 | Audits produce flag annotations; never alter result set membership | Audits out-of-scope list explicitly names "excluding rows" |
| FE-RG-09 | Theme palette/typography/banding live in theme config, NOT in Marks | Anti-features section names this with rationale |
| FE-RG-10 | Chip↔Card promotion is explicit user action, never automatic | Cross-explorer section acknowledges promotion exists; defers to WA-3/WA-5 for UI |
| FE-RG-11 | Formulas Explorer is NOT the A in LATCH | Preamble or intro explicitly refutes LATCH-letter framing |
| FE-RG-12 | Test corpus assertions are immutable (anti-patching rule) | Referenced in spec as policy; enforcement lives in WA-4 |
| FE-RG-13 | chip-well-geometry.md §3 must say "N/A — operator surface" explicitly | Noted in spec as a requirement on WA-6; not a guard on this spec file itself |
| FE-RG-14 | Per-explorer specifics do NOT live in chip-well-geometry.md | Noted in spec as a requirement on WA-6; this spec is the correct home |
| FE-RG-15 | DSL example lexicon in 01-three-explorer-spec.md is the single canonical reference; downstream WAs (02–06) must reference it verbatim, never paraphrase or re-derive | `grep -rn "for example\|e\.g\.,\|such as" .planning/milestones/v15.0-formulas-explorer/0[2-6]-*.md` should return cross-references to the lexicon appendix, not independent examples |

### Anti-Feature Table (SPEC-05, D-03 format)

Each entry: rejected behavior | one-sentence rationale | FE-RG cross-reference.

| Anti-feature | Rationale | Guard |
|-------------|-----------|-------|
| OR-composition across filter chips | Composition is commutative and idempotent at chip level; OR semantics require a single chip's DSL | FE-RG-03 |
| Marks altering result set row membership | Marks are view-layer; any chip that excludes rows is a Filter | FE-RG-07 |
| Audits excluding rows from result set | Audits surface attention; excluding rows is Filter behavior | FE-RG-08 |
| FormulasProvider owning GROUP BY | Grouping comes from view explorers; same calc chip produces different SQL per view context | FE-RG-01 |
| Inline cell formula editing | Cards have rich content with DSL/SQL/notes; formulas live in chip wells, not cell-edit affordances | FE-RG-06 |
| Automatic chip-to-card promotion | Prevents accidental library accumulation; promotion is always explicit ("Save as Formula") | FE-RG-10 |
| Theme palette/typography in Marks | Predicates must work across themes without rewriting; Marks decide class, theme decides appearance | FE-RG-09 |
| Formulas Explorer as the A in LATCH | LATCH letters are organizational axes; Formulas is an orthogonal operator surface | FE-RG-11 |

---

## Don't Hand-Roll

This phase produces a Markdown document. There are no custom solutions to avoid building.

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Verification checks | Custom test scripts | Grep one-liners (D-02 locked this format) |
| Lexicon examples | Full grammar specification | Shape-only DSL fragments (D-01: grammar is WA-4's job) |

---

## Common Pitfalls

### Pitfall 1: Defining FE-RG-15 Too Narrowly
**What goes wrong:** Writing FE-RG-15 as "the lexicon must exist" rather than "downstream WAs must reference the lexicon verbatim." The former is trivially satisfied by writing the appendix; the latter is the enforceable policy GARD-02 requires.
**Why it happens:** GARD-02 says "documented and enforceable." The enforcement is what makes it a policy, not just an aspiration.
**How to avoid:** FE-RG-15's verification check must be a grep that runs against the other WA files, not this file.

### Pitfall 2: Placing "Calculated Values" in Audits
**What goes wrong:** The original discussion.md Audits column contains "Calculated values." This could be misread as "Audits owns calculations."
**Why it happens:** The original hypothesis bundled them; the handoff decomposition explicitly moves them.
**How to avoid:** Handoff Decision 2 table row: "Audits (calc'd values) → Formulas Explorer (Calculations with overlay rendering hint)." Place it in Formulas with a note about the rendering hint as a view concern.

### Pitfall 3: Specifying the Dependency Resolution Algorithm
**What goes wrong:** The spec defines how the dependency DAG is topologically sorted or how cycles are surfaced in the UI.
**Why it happens:** D-04 only names D-04 explicitly for cross-category references, but the same principle applies to the within-Calculations DAG algorithm — it belongs to WA-2 (Phase 184).
**How to avoid:** Calculations section says "dependencies form a DAG; cycles are compile-time errors" and cross-references WA-2 for the algorithm. No pseudocode here.

### Pitfall 4: Over-specifying the DSL Syntax in Lexicon Examples
**What goes wrong:** Lexicon examples in Appendix A use a specific token syntax (e.g., backtick identifiers, specific operator symbols) that constrains the grammar WA-4 will design.
**Why it happens:** Natural to write concrete examples.
**How to avoid:** D-01 says "shows the shape without designing the grammar." Use natural-language-adjacent notation that communicates intent without committing to lexer tokens. State explicitly in the appendix header that the notation is illustrative, not normative.

### Pitfall 5: Missing the Discussion.md "Key Questions" as Examples
**What goes wrong:** The example placement table (SPEC-06) covers the wireframe table rows in discussion.md but misses the 4 key questions, which also contain examples (e.g., "sorts only apply within a given grouping, not globally" implies a placement).
**Why it happens:** The wireframe table is visually prominent; the questions below it are prose.
**How to avoid:** Read all four key questions as additional placement candidates. Key question 3 (SuperSort / GROUP BY) confirms the Formulas/Calculations + view-explorer grouping split.

### Pitfall 6: Deliverable Directory Not Created
**What goes wrong:** The spec is written but `.planning/milestones/v15.0-formulas-explorer/` does not yet exist (it was empty when checked).
**Why it happens:** STATE.md TODOs section notes this: "Create `.planning/milestones/v15.0-formulas-explorer/` directory structure before Phase 182 execution."
**How to avoid:** Wave 0 task must mkdir the directory before writing the spec file.

---

## Code Examples

No code ships in this phase. All "examples" are DSL lexicon fragments.

### Lexicon Coverage Map (for Appendix A)

D-01 specifies these sub-types. The plan should ensure at least one example per row:

| Sub-type | Description | Count target |
|----------|-------------|-------------|
| Row-level calc | `revenue - cost AS profit` shape | 1–2 |
| Aggregate calc | `SUM(quantity)` shape | 1–2 |
| Window function | `RANK() OVER (PARTITION BY region ORDER BY revenue DESC)` shape | 1–2 |
| Equality filter | `Company = 'MSFT'` shape | 1 |
| Range filter | `priority > 3` shape | 1 |
| Compound filter | `Company = 'MSFT' AND priority > 3` (single chip, single DSL) | 1 |
| Single sort | `Company ASC` shape | 1 |
| Multi-sort | Two sort chips: `region ASC` then `revenue DESC` | 1 |
| Conditional encoding mark | `WHERE priority > 3 → class 'urgent'` shape | 1–2 |
| Anomaly audit | `WHERE z_score > 2` shape | 1 |
| Validation audit | `WHERE due_date IS NULL AND status = 'in_progress'` shape | 1 |

Target total: 12–16 examples. Use judgment to reach 15–20 if additional sub-types warrant coverage (e.g., cross-category reference like "Filtered Totals").

---

## Validation Architecture

`config.json` does not set `workflow.nyquist_validation`, so it defaults to enabled. However, Phase 182 ships no code — the deliverable is a single Markdown specification document. There are no automated tests to run.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| SPEC-01 through SPEC-06 | Spec document exists with all required sections | Manual review | `test -f .planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` | Human reviewer confirms coverage |
| GARD-01 | 14 FE-RG guards present with verification checks | Grep | See guard table in spec Appendix B | Each guard's own check is the test |
| GARD-02 | FE-RG-15 defined and enforceable | Manual | Verify check can be run as a grep | No implementation files exist yet to run against |

**Wave 0 Gaps:** None — no test framework needed for a spec-only phase.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 182 is a pure documentation/specification task with no external tool dependencies. The only tool used is the filesystem (Write to create `.md` files).

---

## Sources

### Primary (HIGH confidence)
- `.planning/formulas-explorer-handoff-v2.md` — Complete three-explorer decomposition, all 14 FE-RG guards, WA-1 artifact description, worked examples, composition rules, anti-features. This is the canonical source for all spec content.
- `.planning/Formulas Explorer discussion.md` — Original hypothesis with wireframe table and 4 key questions. All items requiring placement per SPEC-06.
- `.planning/REQUIREMENTS.md` — SPEC-01..06, GARD-01..02 acceptance criteria. Out of Scope table. Traceability to Phase 182.
- `.planning/phases/182-three-explorer-boundary-spec/182-CONTEXT.md` — Locked decisions D-01..D-04.
- `.planning/STATE.md` — Resolved open questions (navigation pattern, Marks v1 scope, type system breadth, cross-well drag semantics).

### Secondary (MEDIUM confidence)
- `src/ui/panels/FormulasPanelStub.ts` — Current stub confirms panel registration pattern (PanelMeta, PanelFactory, PanelHook) that the spec should reference as integration seam context.
- `src/ui/panels/PanelTypes.ts` — PanelMeta, PanelHook, PanelFactory interfaces. Confirms `id`, `name`, `icon`, `description`, `dependencies`, `defaultEnabled` as the registration contract.
- `.planning/geometry-contract-template.md` — 12-section structure confirms what §3 "N/A — operator surface" means (FE-RG-13 context).
- `.planning/config.json` — `nyquist_validation` absent (defaults to enabled); `commit_docs: true`.

---

## Metadata

**Confidence breakdown:**
- Spec content: HIGH — all source material is fully present in handoff v2; nothing needs to be researched or invented
- Example placement (SPEC-06): HIGH — handoff Appendix A covers the main wireframe table; discussion.md prose is brief and straightforward to classify
- FE-RG-15 definition: MEDIUM — content is implied by GARD-02 description but the exact guard text and verification check must be authored freshly
- Anti-feature documentation (SPEC-05): HIGH — REQUIREMENTS.md Out of Scope table + FE-RG guard rationales provide all content

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (stable domain — all source material is project-internal, no external dependencies)
