# Phase 155: CSS Namespace + Design Token Audit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 155-css-namespace-design-token-audit
**Areas discussed:** Namespace migration scope, Token fallback strategy, Hardcoded value threshold

---

## Namespace Migration Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Requirements as-written | Only touch what VCSS-03 and VCSS-04 name. If .nv-* doesn't appear in explorer CSS, mark as satisfied. | |
| Follow the selectors | If .nv-* or .dim-btn selectors are used by explorer TS, migrate them regardless of CSS file. | |
| Audit all explorers | Check all 8 explorer CSS files for non-namespaced selectors and migrate everything. | ✓ |

**User's choice:** Audit all explorers
**Notes:** User wants VCSS-01 to be bulletproof — check all 8, not just the 2 named in requirements.

---

## Token Fallback Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Strip fallbacks | Use var(--text-sm) with no fallback. Breakage visible immediately. | ✓ |
| Keep fallbacks | Keep var(--text-sm, 13px) pattern. Defensive against missing imports. | |
| Fallback to other tokens only | Allow token-to-token fallbacks, strip hardcoded px/hex fallbacks. | |

**User's choice:** Strip fallbacks
**Notes:** Tokens are canonical. Hiding their absence causes harder-to-debug theme bugs.

---

## Hardcoded Value Threshold

| Option | Description | Selected |
|--------|-------------|----------|
| Spacing + color only | Tokenize padding, margin, gap, font-size, and all color/background. Leave structural dimensions as plain values. | ✓ |
| Everything gets a token | Create tokens for every numeric value. Maximum consistency but adds ~10-15 niche tokens. | |
| Spacing + color + border-radius | Like option 1, plus tokenize border-radius values. | |

**User's choice:** Spacing + color only
**Notes:** Structural dimensions (input width, border-radius: 50%, opacity, flex ratios) aren't theme-sensitive — leave as plain values.

---

## Claude's Discretion

- Whether to add new tokens or map to nearest existing
- File organization (consolidate or keep per-file)
- Order of explorer migration

## Deferred Ideas

None — discussion stayed within phase scope
