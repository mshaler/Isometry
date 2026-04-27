# Phase 182: Three-Explorer Boundary Spec - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 182-three-explorer-boundary-spec
**Areas discussed:** DSL lexicon depth, Guard verification format, Anti-feature documentation, Cross-category references

---

## DSL Lexicon Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Pattern catalog | One canonical example per chip sub-type (~15–20 examples). Shows shape without designing grammar. | ✓ |
| Minimal — reuse handoff | Reference handoff Appendix A, add only 3–5 new edge case examples. | |
| Exhaustive seed corpus | 30+ examples covering every facet_type × chip category. Overlaps with WA-4. | |

**User's choice:** Pattern catalog (Recommended)
**Notes:** Sufficient for WA-2 through WA-7 authors to reference without premature grammar work.

---

## Guard Verification Format

| Option | Description | Selected |
|--------|-------------|----------|
| Grep-able assertions | One-liner grep/structural check per guard. Matches handoff's verification pattern. | ✓ |
| Checklist items | ☐ checkbox with human-readable verification sentence. Not automatable. | |
| Test-case stubs | Pseudocode test skeleton per guard. Overlaps with WA-4. | |

**User's choice:** Grep-able assertions (Recommended)
**Notes:** Consistent with the handoff document's own "Verifiable checks" section.

---

## Anti-Feature Documentation

| Option | Description | Selected |
|--------|-------------|----------|
| Bullet + one-sentence rationale | Rejected behavior + why not + FE-RG cross-ref. Concise, scannable. | ✓ |
| Worked rejection examples | Short scenario per anti-feature showing what goes wrong. 2–3 sentences each. | |
| Just a list | Bare bullets, no rationale. Assumes handoff context. | |

**User's choice:** Bullet + one-sentence rationale (Recommended)
**Notes:** Links to relevant FE-RG guard where applicable. Prevents re-litigation without heavy prose.

---

## Cross-Category References

| Option | Description | Selected |
|--------|-------------|----------|
| Name the pattern, defer mechanics | Acknowledge cross-refs exist, assign ownership. Algorithm details in WA-2. | ✓ |
| Define semantics here | Full cross-category rules, dependency resolution, error cases. | |
| Silent — let WA-2 discover it | Don't mention. Risks re-litigation. | |

**User's choice:** Name the pattern, defer mechanics (Recommended)
**Notes:** Phase 182 says "cross-category references exist and are resolved by the compilation pipeline" — WA-2 specifies how.

---

## Claude's Discretion

- Spec document internal structure (heading order, section breaks)
- Exact example count within the 15–20 range

## Deferred Ideas

None — discussion stayed within phase scope.
