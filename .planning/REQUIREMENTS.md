# Requirements: Isometry v8.3

**Defined:** 2026-03-22
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v1 Requirements

Requirements for v8.3 Plugin E2E Test Suite. Each maps to roadmap phases.

### Test Infrastructure

- [ ] **INFR-01**: Shared `makePluginHarness()` factory creates fresh FeatureCatalog + PluginRegistry + shared state objects per test
- [ ] **INFR-02**: `usePlugin()` auto-destroy wrapper calls plugin.destroy() in afterEach to prevent listener accumulation
- [ ] **INFR-03**: `mockContainerDimensions()` helper sets clientHeight/scrollTop/getBoundingClientRect for jsdom layout tests
- [ ] **INFR-04**: Shared `e2e/helpers/harness.ts` extracts waitForHarnessReady, togglePlugin, enablePlugin, disablePlugin from existing inline helpers
- [ ] **INFR-05**: HarnessShell entry point (`?harness=1` or equivalent) verified/added in src/main.ts for Playwright access

### Individual Plugin Lifecycle

- [ ] **LIFE-01**: All 27 plugins tested through transformData hook via registry.runTransformData()
- [ ] **LIFE-02**: All 27 plugins tested through transformLayout hook via registry.runTransformLayout()
- [ ] **LIFE-03**: All 27 plugins tested through afterRender hook via registry.runAfterRender()
- [ ] **LIFE-04**: All 27 plugins tested through destroy lifecycle (event listener cleanup verified)
- [ ] **LIFE-05**: SuperScroll tested above and below VIRTUALIZATION_THRESHOLD (100 rows)

### Cross-Plugin Interactions

- [ ] **XPLG-01**: Full-matrix smoke test: all 27 plugins enabled via registerCatalog(), pipeline runs without crash
- [ ] **XPLG-02**: Pairwise tests for 7 identified coupling pairs through registry pipeline (not manual hook chaining)
- [ ] **XPLG-03**: Triple combo tests for sort+filter+density and search+select+scroll interaction groups
- [ ] **XPLG-04**: Shared-state isolation verified: no state leakage between tests (ZoomState, SelectionState, etc.)
- [ ] **XPLG-05**: Pipeline ordering assertions: Map insertion order matches expected plugin execution sequence

### Playwright E2E

- [ ] **E2E-01**: 10 per-category specs verifying HarnessShell sidebar toggle → DOM output for each plugin category
- [ ] **E2E-02**: 5 multi-plugin visual interaction specs (combined categories enabled simultaneously)
- [ ] **E2E-03**: Screenshot regression baselines captured for key plugin states
- [ ] **E2E-04**: D3 transition settling handled via expect.poll() (no waitForTimeout)
- [ ] **E2E-05**: CI integration: Playwright tests added to GitHub Actions pipeline

## v2 Requirements

### Data Source Progression

- **DATA-01**: Alto Index JSON data source adapter for HarnessShell
- **DATA-02**: Full sql.js data source adapter wiring PivotGrid to existing Worker Bridge

## Out of Scope

| Feature | Reason |
|---------|--------|
| Production integration of pivot grid into main app | v8.x is harness-only development |
| Visual regression with Percy/Chromatic | Self-hosted screenshots sufficient for this project scale |
| Performance benchmarking of plugins | Covered by v6.0 CI bench job |
| New plugin implementations | v8.1 completed all 27 — this milestone tests them |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFR-01 | — | Pending |
| INFR-02 | — | Pending |
| INFR-03 | — | Pending |
| INFR-04 | — | Pending |
| INFR-05 | — | Pending |
| LIFE-01 | — | Pending |
| LIFE-02 | — | Pending |
| LIFE-03 | — | Pending |
| LIFE-04 | — | Pending |
| LIFE-05 | — | Pending |
| XPLG-01 | — | Pending |
| XPLG-02 | — | Pending |
| XPLG-03 | — | Pending |
| XPLG-04 | — | Pending |
| XPLG-05 | — | Pending |
| E2E-01 | — | Pending |
| E2E-02 | — | Pending |
| E2E-03 | — | Pending |
| E2E-04 | — | Pending |
| E2E-05 | — | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 0
- Unmapped: 20 ⚠️

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 after initial definition*
