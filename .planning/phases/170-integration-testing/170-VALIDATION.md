---
phase: 170
slug: integration-testing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 170 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x + playwright (WebKit) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `npx vitest run tests/superwidget/explorer-integration.test.ts` |
| **Full suite command** | `npx vitest run tests/superwidget/ && npx playwright test e2e/explorercanvas-smoke.spec.ts` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 170-01-01 | 01 | 1 | EINT-01 | cross-seam | `npx vitest run tests/superwidget/explorer-integration.test.ts -t "EINT-01"` | ❌ W0 | ⬜ pending |
| 170-01-02 | 01 | 1 | EINT-02 | cross-seam | `npx vitest run tests/superwidget/explorer-integration.test.ts -t "EINT-02"` | ❌ W0 | ⬜ pending |
| 170-01-03 | 01 | 1 | EINT-03 | cross-seam | `npx vitest run tests/superwidget/explorer-integration.test.ts -t "EINT-03"` | ❌ W0 | ⬜ pending |
| 170-02-01 | 02 | 2 | EINT-04 | e2e | `npx playwright test e2e/explorercanvas-smoke.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/superwidget/explorer-integration.test.ts` — new cross-seam test file for EINT-01..03
- [ ] `e2e/explorercanvas-smoke.spec.ts` — new Playwright smoke spec for EINT-04
- [ ] `e2e/fixtures/explorercanvas-harness.html` — dedicated harness (avoids breaking v13.0 harness)

*Existing infrastructure covers framework installation — Vitest and Playwright already configured.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
