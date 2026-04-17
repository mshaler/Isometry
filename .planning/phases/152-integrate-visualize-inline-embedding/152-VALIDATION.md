---
phase: 152
slug: integrate-visualize-inline-embedding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 152 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 152-01-01 | 01 | 1 | INTG-01 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 152-01-02 | 01 | 1 | INTG-02 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 152-02-01 | 02 | 2 | VIZ-01 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 152-02-02 | 02 | 2 | VIZ-02 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 152-02-03 | 02 | 2 | VIZ-03 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Existing vitest infrastructure covers all phase requirements
- [ ] Test stubs for INTG-01/02 (Data+Properties toggle) and VIZ-01/02/03 (Projections auto-visibility)

*Existing infrastructure covers all phase requirements — vitest + jsdom already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual layout of stacked explorers in top slot | INTG-01 | CSS flex layout visual correctness | Open app, click Data icon, verify Data Explorer + Properties Explorer stack vertically above view |
| Projections auto-show on SuperGrid switch | VIZ-01 | View switch animation + visual rendering | Switch to SuperGrid view, verify Projections Explorer appears above grid |
| Projections auto-hide on non-SuperGrid switch | VIZ-02 | View switch visual state | Switch to Timeline/Chart/Graph view, verify Projections Explorer is not visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
