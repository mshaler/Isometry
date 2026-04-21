---
phase: 165
slug: canvas-stubs-registry
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 165 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vite.config.ts` |
| **Quick run command** | `npx vitest run tests/superwidget/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/superwidget/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 165-01-01 | 01 | 1 | CANV-04 | unit | `npx vitest run tests/superwidget/registry.test.ts` | ❌ W0 | ⬜ pending |
| 165-01-02 | 01 | 1 | CANV-05 | unit | `npx vitest run tests/superwidget/registry.test.ts` | ❌ W0 | ⬜ pending |
| 165-01-03 | 01 | 1 | CANV-06 | static | `npx vitest run tests/superwidget/registry.test.ts` | ❌ W0 | ⬜ pending |
| 165-02-01 | 02 | 1 | CANV-01 | unit | `npx vitest run tests/superwidget/ExplorerCanvasStub.test.ts` | ❌ W0 | ⬜ pending |
| 165-02-02 | 02 | 1 | CANV-02 | unit | `npx vitest run tests/superwidget/ViewCanvasStub.test.ts` | ❌ W0 | ⬜ pending |
| 165-02-03 | 02 | 1 | CANV-03 | unit | `npx vitest run tests/superwidget/EditorCanvasStub.test.ts` | ❌ W0 | ⬜ pending |
| 165-02-04 | 02 | 1 | CANV-07 | static | `npx vitest run tests/superwidget/ExplorerCanvasStub.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/superwidget/ExplorerCanvasStub.test.ts` — covers CANV-01, CANV-07
- [ ] `tests/superwidget/ViewCanvasStub.test.ts` — covers CANV-02
- [ ] `tests/superwidget/EditorCanvasStub.test.ts` — covers CANV-03, CANV-07
- [ ] `tests/superwidget/registry.test.ts` — covers CANV-04, CANV-05, CANV-06
