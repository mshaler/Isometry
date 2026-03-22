# Requirements: Isometry v8.3

**Defined:** 2026-03-22
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v1 Requirements

Requirements for v8.3 Plugin E2E Test Suite. Each maps to roadmap phases.

### Test Infrastructure

- [x] **INFR-01**: Shared `makePluginHarness()` factory creates fresh FeatureCatalog + PluginRegistry + shared state objects per test
- [x] **INFR-02**: `usePlugin()` auto-destroy wrapper calls plugin.destroy() in afterEach to prevent listener accumulation
- [x] **INFR-03**: `mockContainerDimensions()` helper sets clientHeight/scrollTop/getBoundingClientRect for jsdom layout tests
- [x] **INFR-04**: Shared `e2e/helpers/harness.ts` extracts waitForHarnessReady, togglePlugin, enablePlugin, disablePlugin from existing inline helpers
- [x] **INFR-05**: HarnessShell entry point (`?harness=1` or equivalent) verified/added in src/main.ts for Playwright access

### Individual Plugin Lifecycle

- [x] **LIFE-01**: All 27 plugins tested through transformData hook via registry.runTransformData()
- [x] **LIFE-02**: All 27 plugins tested through transformLayout hook via registry.runTransformLayout()
- [x] **LIFE-03**: All 27 plugins tested through afterRender hook via registry.runAfterRender()
- [x] **LIFE-04**: All 27 plugins tested through destroy lifecycle (event listener cleanup verified)
- [x] **LIFE-05**: SuperScroll tested above and below VIRTUALIZATION_THRESHOLD (100 rows)

### Cross-Plugin Interactions

- [x] **XPLG-01**: Full-matrix smoke test: all 27 plugins enabled via registerCatalog(), pipeline runs without crash
- [x] **XPLG-02**: Pairwise tests for 7 identified coupling pairs through registry pipeline (not manual hook chaining)
- [x] **XPLG-03**: Triple combo tests for sort+filter+density and search+select+scroll interaction groups
- [x] **XPLG-04**: Shared-state isolation verified: no state leakage between tests (ZoomState, SelectionState, etc.)
- [x] **XPLG-05**: Pipeline ordering assertions: Map insertion order matches expected plugin execution sequence

### Playwright E2E

- [x] **E2E-01**: 10 per-category specs verifying HarnessShell sidebar toggle → DOM output for each plugin category
- [ ] **E2E-02**: 5 multi-plugin visual interaction specs (combined categories enabled simultaneously)
- [ ] **E2E-03**: Screenshot regression baselines captured for key plugin states
- [x] **E2E-04**: D3 transition settling handled via expect.poll() (no waitForTimeout)
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
| INFR-01 | Phase 104 | Complete |
| INFR-02 | Phase 104 | Complete |
| INFR-03 | Phase 104 | Complete |
| INFR-04 | Phase 104 | Complete |
| INFR-05 | Phase 104 | Complete |
| LIFE-01 | Phase 105 | Complete |
| LIFE-02 | Phase 105 | Complete |
| LIFE-03 | Phase 105 | Complete |
| LIFE-04 | Phase 105 | Complete |
| LIFE-05 | Phase 105 | Complete |
| XPLG-01 | Phase 106 | Complete |
| XPLG-02 | Phase 106 | Complete |
| XPLG-03 | Phase 106 | Complete |
| XPLG-04 | Phase 106 | Complete |
| XPLG-05 | Phase 106 | Complete |
| E2E-01 | Phase 107 | Complete |
| E2E-02 | Phase 107 | Pending |
| E2E-03 | Phase 107 | Pending |
| E2E-04 | Phase 107 | Complete |
| E2E-05 | Phase 107 | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 — traceability populated after roadmap creation*
