---
phase: 182
slug: three-explorer-boundary-spec
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 182 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 182-01-01 | 01 | 1 | SPEC-01 | manual | `grep -c "Formulas\|Marks\|Audits" .planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` | ❌ W0 | ⬜ pending |
| 182-01-02 | 01 | 1 | SPEC-02 | manual | `grep "out-of-scope" .planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` | ❌ W0 | ⬜ pending |
| 182-01-03 | 01 | 1 | SPEC-03 | manual | `grep "composition" .planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` | ❌ W0 | ⬜ pending |
| 182-01-04 | 01 | 1 | SPEC-04 | manual | `grep "AND\|lexicographic\|DAG" .planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` | ❌ W0 | ⬜ pending |
| 182-01-05 | 01 | 1 | SPEC-05 | manual | `grep "anti-feature\|never\|must not" .planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` | ❌ W0 | ⬜ pending |
| 182-01-06 | 01 | 1 | SPEC-06 | manual | `grep -c "example" .planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` | ❌ W0 | ⬜ pending |
| 182-01-07 | 01 | 1 | GARD-01 | manual | `grep -c "FE-RG-" .planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` | ❌ W0 | ⬜ pending |
| 182-01-08 | 01 | 1 | GARD-02 | manual | `grep "FE-RG-15" .planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.planning/milestones/v15.0-formulas-explorer/` directory exists and is writable

*Existing infrastructure covers all phase requirements — this is a spec-writing phase with manual verification via grep.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chip placement unambiguous | SPEC-01 | Requires human reading of placement table | Verify every chip category appears in exactly one explorer column |
| Composition rules complete | SPEC-03, SPEC-04 | Semantic completeness check | Verify AND/lexicographic/DAG rules cover all intra-well combinations |
| Out-of-scope lists correct | SPEC-02 | Domain knowledge required | Verify each explorer's anti-feature list matches handoff constraints |
| DSL examples sufficient | SPEC-06 | Sufficiency is subjective | Verify WA-2..WA-7 authors can reference examples without re-reading discussion.md |
| FE-RG-15 enforceable | GARD-02 | Policy definition requires review | Verify grep-based check is defined and targets WA-02..WA-06 files |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
