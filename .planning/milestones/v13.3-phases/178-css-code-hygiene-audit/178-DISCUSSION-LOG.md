# Phase 178: CSS & Code Hygiene Audit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 178-css-code-hygiene-audit
**Areas discussed:** Audit scope & severity, Fix-vs-document boundary, Token extraction policy, Verification approach

---

## Audit Scope & Severity

### Hardcoded px values

| Option | Description | Selected |
|--------|-------------|----------|
| Token-worthy only | Extract repeated structural values to tokens. Leave one-off layout specifics as-is. | |
| Catalog all, fix critical | Document every value, only tokenize top ~20 most repeated. | |
| Aggressive tokenization | Near-zero hardcoded px. Even one-off values get semantic tokens. | ✓ |

**User's choice:** Aggressive tokenization
**Notes:** None

### Overflow:hidden handling

| Option | Description | Selected |
|--------|-------------|----------|
| Audit each, fix band-aids | Review all 50. Keep legitimate ones, replace band-aids with proper layout fixes. | |
| Document only | Catalog as intentional vs band-aid but don't change. | |
| Fix all band-aids + add comments | Fix band-aids AND add `/* intentional: [reason] */` to remaining. | ✓ |

**User's choice:** Fix all band-aids + add comments
**Notes:** None

---

## Fix-vs-Document Boundary

### TS workarounds

| Option | Description | Selected |
|--------|-------------|----------|
| Fix all 3 | Clean up ViewTabBar hack, clarify bind-param comment, address focus-visible TODO. | ✓ |
| Fix code, keep TODO | Fix ViewTabBar and bind-param. Leave focus-visible TODO (KBNV-01). | |
| Catalog only | Document all 3 but don't change TS code. | |

**User's choice:** Fix all 3
**Notes:** None

### TS scope

| Option | Description | Selected |
|--------|-------------|----------|
| CSS + annotated TS workarounds only | Fix 3 known TS issues, no broader TS lint pass. | ✓ |
| Include light TS hygiene | Also scan for unused exports, dead code, inconsistent naming. | |
| CSS only, zero TS changes | Strictly CSS files. | |

**User's choice:** CSS + annotated TS workarounds only
**Notes:** None

---

## Token Extraction Policy

### Token organization

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing file | Add to design-tokens.css. Single source of truth. | |
| Split by category | Separate files per token type. | |
| You decide | Claude picks based on existing structure. | ✓ |

**User's choice:** You decide (Claude's discretion)
**Notes:** None

### Token naming convention

| Option | Description | Selected |
|--------|-------------|----------|
| --spacing-{scale} pattern | Numeric scale matching Tailwind conventions. | |
| --{component}-{property} pattern | Semantic names per component. | |
| You decide | Claude picks convention fitting existing patterns. | ✓ |

**User's choice:** You decide (Claude's discretion)
**Notes:** None

---

## Verification Approach

### Visual verification

| Option | Description | Selected |
|--------|-------------|----------|
| Existing E2E + manual spot-check | Run 15 Playwright specs + manual check key views. | ✓ |
| Add screenshot assertions | Playwright screenshot comparison tests. | |
| Trust existing tests only | Run tests, if pass, ship. | |

**User's choice:** Existing E2E + manual spot-check
**Notes:** None

### Deliverable format

| Option | Description | Selected |
|--------|-------------|----------|
| Fixes + summary in CONTEXT.md | Ship fixes, document in commits and CONTEXT.md. | ✓ |
| Findings report first, then fixes | Create FINDINGS.md catalog before fixing. | |
| Fixes + HYGIENE-REPORT.md | Ship fixes AND produce summary report. | |

**User's choice:** Fixes + summary in CONTEXT.md
**Notes:** None

---

## Claude's Discretion

- Token naming convention and file organization
- Judgment on overflow:hidden band-aid vs. intentional classification
- Priority ordering of CSS files

## Deferred Ideas

None — discussion stayed within phase scope.
