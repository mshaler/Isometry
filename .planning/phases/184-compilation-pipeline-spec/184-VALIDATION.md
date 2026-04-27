---
phase: 184
slug: compilation-pipeline-spec
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 184 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual review (spec-only phase — no code deliverables) |
| **Config file** | none — no automated tests for spec documents |
| **Quick run command** | `grep -c "##" .planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md` |
| **Full suite command** | `cat .planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md \| wc -l` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run quick run command (verify sections exist)
- **After every plan wave:** Verify all 6 success criteria sections present
- **Before `/gsd:verify-work`:** Full content review against REQUIREMENTS.md
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 184-01-01 | 01 | 1 | COMP-01 | grep | `grep "SELECT\|WHERE\|ORDER BY" 02-compilation-pipeline.md` | ❌ W0 | ⬜ pending |
| 184-01-02 | 01 | 1 | COMP-02 | grep | `grep -c "topological\|CycleError" 02-compilation-pipeline.md` | ❌ W0 | ⬜ pending |
| 184-01-03 | 01 | 1 | COMP-03 | grep | `grep "bind.value\|placeholder\|string concatenation" 02-compilation-pipeline.md` | ❌ W0 | ⬜ pending |
| 184-01-04 | 01 | 1 | COMP-05 | grep | `grep "Map<rowId" 02-compilation-pipeline.md` | ❌ W0 | ⬜ pending |
| 184-01-05 | 01 | 1 | COMP-06 | grep | `grep "AuditAnnotation\|flag\|badge" 02-compilation-pipeline.md` | ❌ W0 | ⬜ pending |
| 184-01-06 | 01 | 1 | COMP-07 | grep | `grep "explain\|sql_text" 02-compilation-pipeline.md` | ❌ W0 | ⬜ pending |
| 184-01-07 | 01 | 1 | COMP-08 | grep | `grep -c "Example [0-9]" 02-compilation-pipeline.md` | ❌ W0 | ⬜ pending |
| 184-01-08 | 01 | 1 | GARD-03,GARD-04 | grep | `grep "FE-RG-16\|FE-RG-17" 02-compilation-pipeline.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. This is a spec-only phase — verification is content-based grep checks against the output document.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pseudocode correctness | COMP-02, COMP-04 | Algorithm logic requires human review | Read dependency graph pseudocode; verify Kahn's algorithm terminates and CycleError includes participants |
| Worked example SQL correctness | COMP-08 | SQL must be semantically valid for sql.js | Review all 10 examples against sqlite3 syntax |
| Annotation prohibition | COMP-05, COMP-06 | Semantic constraint requires human verification | Confirm spec explicitly states "MUST NOT filter rows" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
