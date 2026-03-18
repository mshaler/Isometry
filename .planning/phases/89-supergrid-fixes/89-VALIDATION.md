---
phase: 89
slug: supergrid-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 89 — Validation Strategy

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
| 89-01-01 | 01 | 1 | SGFX-02 | unit | `npx vitest run tests/seams/ui/SuperGridRowResize.test.ts` | ❌ W0 | ⬜ pending |
| 89-02-01 | 02 | 1 | SGFX-01 | unit | `npx vitest run tests/seams/ui/PropertyDepth.test.ts` | ❌ W0 | ⬜ pending |
| 89-03-01 | 03 | 1 | SGFX-03 | unit | `npx vitest run tests/seams/ui/CommandBarSubtitle.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/seams/ui/SuperGridRowResize.test.ts` — stubs for SGFX-02 (row header resize)
- [ ] `tests/seams/ui/PropertyDepth.test.ts` — stubs for SGFX-01 (property depth control)
- [ ] `tests/seams/ui/CommandBarSubtitle.test.ts` — stubs for SGFX-03 (dataset name subtitle)

*Existing vitest infrastructure covers all framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Row header drag resize visual | SGFX-02 | Pointer Events visual feedback | Drag row header divider, verify cursor and width change |
| Depth dropdown re-render | SGFX-01 | Visual card re-render at different depths | Select depth level, verify grid columns update |
| Loading state transition | SGFX-03 | Timing-dependent UI state | Load dataset via Cmd-K, verify "Loading…" → name transition |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
