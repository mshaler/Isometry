# Requirements: Isometry v9.1 Ship Prep

**Defined:** 2026-03-25
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v9.1 Requirements

Requirements for bug fixes, release readiness, and graph algorithm enhancements. Single-phase milestone with parallel execution tracks.

### Bug Fixes

- [x] **BUGF-01**: `SubscriptionManager.tierForProductID()` returns `.free` for unknown product identifiers (not `.pro`)
- [x] **BUGF-02**: NotebookExplorer "New Card" action inserts a card via MutationManager, selects it, and refreshes Recent Cards list

### Release Readiness

- [x] **SHIP-01**: FeatureGate enforces tier restrictions in Release builds (DEBUG bypass removed, integration tests confirm Free/Pro/Workbench gates)
- [x] **SHIP-02**: Provisioning profile regenerated with CloudKit entitlement for both iOS and macOS targets
- [x] **SHIP-03**: StoreKit 2 products configured in App Store Connect (or StoreKit Configuration file validated for TestFlight)
- [ ] **SHIP-04**: TestFlight build succeeds — archive, upload, and install on physical device

### Graph Algorithms Phase 2

- [x] **GALG-01**: Shortest path target node displays hop count badge showing path length
- [x] **GALG-02**: Single-source shortest path highlights all reachable nodes from source, colored by hop distance via d3 sequential scale
- [x] **GALG-03**: Edge betweenness centrality computed and encoded as edge stroke thickness in NetworkView
- [x] **GALG-04**: Weighted shortest path uses connection attribute (or uniform weight) for Dijkstra cost function

## Future Requirements

### Graph Algorithms Phase 3

- **GALG-05**: Community boundary edges highlighted with dashed stroke
- **GALG-06**: Algorithm result export to CSV/JSON via ExportOrchestrator
- **GALG-07**: Algorithm comparison mode (side-by-side PageRank vs centrality)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Step-by-step algorithm animation | Anti-feature — Worker architecture incompatible with step-by-step execution (carried from v9.0) |
| All-pairs shortest path matrix | O(N²) catastrophic at >100 nodes (carried from v9.0) |
| Custom algorithm selection (Leiden, Walktrap) | Louvain with resolution slider covers use case (carried from v9.0) |
| App Store submission | v9.1 targets TestFlight validation only — full submission requires App Store review prep |
| Automated UI testing on device | Simulator E2E sufficient for this milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUGF-01 | Phase 120 | Complete |
| BUGF-02 | Phase 120 | Complete |
| SHIP-01 | Phase 120 | Complete |
| SHIP-02 | Phase 120 | Complete |
| SHIP-03 | Phase 120 | Complete |
| SHIP-04 | Phase 120 | Pending |
| GALG-01 | Phase 120 | Complete |
| GALG-02 | Phase 120 | Complete |
| GALG-03 | Phase 120 | Complete |
| GALG-04 | Phase 120 | Complete |

**Coverage:**
- v9.1 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 — all mapped to Phase 120 (parallel plans)*
