---
phase: 174
slug: tab-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 174 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/superwidget/ --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/superwidget/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TABS-01..10 | unit+integration | `npx vitest run tests/superwidget/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/superwidget/tab-management.test.ts` — stubs for TABS-01..10
- [ ] jsdom environment annotation: `// @vitest-environment jsdom`

*Existing infrastructure covers test framework — only new test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag reorder visual feedback | TABS-06 | Insertion line + dimming requires visual inspection | Drag tab, verify insertion line appears between targets |
| Overflow chevron scroll | TABS-05 | Scroll behavior requires browser viewport | Create 10+ tabs, verify chevrons appear and scroll |
| Keyboard focus ring | TABS-07 | Focus visibility requires visual inspection | Tab into tab bar, verify focus ring on active tab |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
