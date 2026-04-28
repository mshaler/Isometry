# Phase 186: Operator-Contract Template - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 186-operator-contract-template
**Areas discussed:** Template structure, Usage guide format, File placement

---

## Template Structure

### Q1: How should §2 (Coordinate system) and §3 (PAFV binding) be handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Single §2-3 replacement | Replace both with one "Operator Surface" section describing input/output contracts, operator semantics, what makes it non-geometric | ✓ |
| Keep §2, replace only §3 | Keep Coordinate system since even operator surfaces have layout, replace only PAFV binding with Operator Semantics | |
| Rewrite both separately | Replace §2 with "Control Surface Layout" and §3 with "Operator Semantics" — two distinct new sections | |

**User's choice:** Single §2-3 replacement (Recommended)
**Notes:** Matches the handoff's "with §2-§3 replaced by an operator-surface section" language.

### Q2: How much operator-specific rewriting for the remaining 10 sections?

| Option | Description | Selected |
|--------|-------------|----------|
| Guidance prompts only | Keep section structure, rewrite italicized guidance prompts to be operator-aware | ✓ |
| Minimal — verbatim carry-over | Copy sections 1 and 4-12 unchanged, authors translate mentally | |
| Deep rewrite per section | Rewrite each section's guidance, examples, and tables to be fully operator-native | |

**User's choice:** Guidance prompts only (Recommended)
**Notes:** Preserves template consistency while actively guiding operator thinking.

---

## Usage Guide Format

### Q3: Where should the usage guide live?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline header in template | §0 "When to use this template" at top of operator-contract-template.md with cross-link to geometry variant | ✓ |
| Separate standalone doc | A contract-template-guide.md covering both templates with comparison table and decision tree | |
| In both templates' headers | Both templates get a short "When to use" paragraph pointing at each other | |

**User's choice:** Inline header in template (Recommended)
**Notes:** Self-contained — author sees guidance immediately when reading the template.

### Q4: Which contrast pair for the concrete distinguishing example?

| Option | Description | Selected |
|--------|-------------|----------|
| Time Explorer vs. Chip Well | Real artifacts with completed contracts; Time Explorer is PAFV-bound, Chip Well is operator surface | ✓ |
| SuperGrid vs. Formulas Explorer | Broader scope but Formulas Explorer doesn't have a completed contract yet | |
| Hypothetical future pair | Generic but less grounded in real artifacts | |

**User's choice:** Time Explorer vs. Chip Well (Recommended)
**Notes:** Both have completed contracts the reader can inspect.

---

## File Placement

### Q5: Where should the operator-contract template file live?

| Option | Description | Selected |
|--------|-------------|----------|
| Sibling in .planning/ | .planning/operator-contract-template.md alongside geometry-contract-template.md | ✓ |
| Templates subfolder | .planning/templates/ (would require moving geometry template too) | |
| Milestone output only | .planning/milestones/v15.0-formulas-explorer/ (too buried for a reusable asset) | |

**User's choice:** Sibling in .planning/ (Recommended)
**Notes:** Same directory, consistent naming, immediately discoverable.

---

## Claude's Discretion

- Exact wording of operator-surface guidance prompts in each section
- Whether to add a brief cross-link from the geometry template back to the operator variant
- Level of detail in the Time Explorer vs. Chip Well contrast example

## Deferred Ideas

None — discussion stayed within phase scope.
