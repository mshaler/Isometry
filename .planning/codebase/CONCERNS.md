# Concerns

## Technical Debt

### TD-01: GalleryView No D3 Data Join
- **File:** `src/views/GalleryView.ts`
- **Issue:** Pure HTML tile rendering — tiles rebuilt on every render() instead of using D3 data join
- **Impact:** Violates D-003 (mandatory D3 key function), less efficient updates
- **Carried since:** v1.0

### TD-02: Schema Loading Dynamic Import
- **File:** `src/database/Database.ts`
- **Issue:** Conditional dynamic import (`node:fs` vs `?raw`) for schema SQL loading
- **Impact:** Build complexity, potential bundler edge cases
- **Carried since:** v1.1

### TD-03: FeatureGate DEBUG Bypass
- **File:** `native/Isometry/FeatureGate.swift`
- **Issue:** `#if DEBUG return true` bypasses all tier gates in debug builds
- **Impact:** Cannot test tier-gated features during development — must test before release
- **Carried since:** v2.0

### TD-04: Provisioning Profile Regeneration
- **Issue:** Provisioning profile needs regeneration for CloudKit capability
- **Impact:** Blocks CloudKit deployment to real devices
- **Carried since:** v2.0

### TD-05: StoreKit 2 App Store Connect Setup
- **Issue:** StoreKit 2 products need App Store Connect configuration for production
- **Impact:** In-app purchases only work in sandbox/StoreKit testing mode
- **Carried since:** v2.0

### TD-06: Apple Notes Table Rendering
- **File:** `src/etl/parsers/AppleNotesParser.ts`
- **Issue:** Tables in Apple Notes render as `[Table]` placeholder — CRDT parsing deferred
- **Impact:** Users importing Apple Notes with tables see placeholder text

### TD-07: Missing SUMMARY.md Files
- **Issue:** Phases 34+35 missing SUMMARY.md files (merged parallel execution)
- **Impact:** Incomplete planning artifact history

## Known Bugs

### BUG-01: Schema Loading Timing Race
- **Issue:** Schema loading timing race on cold start
- **Impact:** Potential initialization ordering issue under specific conditions
- **Severity:** Low (not observed in production)

## Security Considerations

### SEC-01: WASM Path Validation
- **Issue:** WASM path validation gap
- **Risk:** Low — mitigated by locked build configuration
- **Mitigation:** Build config controls WASM source path

### SEC-02: XSS in Notebook Charts
- **Files:** `src/ui/NotebookExplorer.ts`, `src/ui/charts/ChartRenderer.ts`
- **Mitigation:** Two-pass DOMPurify + D3 mount for XSS-safe chart rendering
- **Status:** Mitigated ✓

## Performance Bottlenecks

Measured in Phase 74 (profile-first methodology):

| Bottleneck | Measured | Mitigation |
|-----------|----------|-----------|
| SQL GROUP BY (SuperGrid) | 24.9ms | 6 covering/expression indexes |
| ETL JSON/Markdown parse | 1.7s (large files) | batchSize=1000 (~49K cards/s) |
| CARD_IDS_LIMIT truncation | 50 per cell | Tooltip shows overflow count |
| WASM bundle | 756KB | Unavoidable — sql.js requirement |
| Base64 checkpoint save | 714ms at 20K cards | 100ms trailing debounce |

## Scaling Limits

| Component | Comfortable Limit | Stress Limit | Symptom |
|-----------|-------------------|-------------|---------|
| sql.js card count | 20,000 | 40,000+ | Query latency >100ms |
| WKWebView WASM heap | 20,000 cards | 40,000+ | Memory pressure warnings |
| D3 force simulation | 2,000 nodes | 5,000 | Frame drops, battery drain |
| SuperGrid virtual scroll | 10,000 rows | 50,000+ | Scroll jank |

## Fragile Areas

### FRAG-01: SuperGrid Header Span Computation
- **File:** `src/views/supergrid/SuperStackHeader.ts`
- **Issue:** Run-length spanning algorithm for CSS Grid headers — complex column span calculation
- **Risk:** Bugs in column reordering or axis changes

### FRAG-02: NativeBridge 6-Message Protocol
- **Files:** `src/native/NativeBridge.ts`, `native/Isometry/BridgeManager.swift`
- **Issue:** Tightly coupled message contract between JS and Swift
- **Risk:** Protocol changes require synchronized updates on both sides

### FRAG-03: TreeView _children Stash
- **File:** `src/views/TreeView.ts`
- **Issue:** Expand/collapse uses `_children` stash pattern (never re-stratify)
- **Risk:** Stale stash if underlying data changes while collapsed

### FRAG-04: ETL Dedup NULL Semantics
- **File:** `src/etl/DedupEngine.ts`
- **Issue:** SQLite UNIQUE ignores NULL `via_card_id` — connection dedup pre-checks existing
- **Risk:** Dedup logic must handle NULL semantics explicitly

### FRAG-05: __agg__ Prefix Convention (D-011)
- **Files:** `src/worker/handlers/supergrid.handler.ts`, `src/ui/CalcExplorer.ts`
- **Issue:** `__agg__{field}` naming convention prevents column name collisions in calc queries
- **Risk:** Any future supergrid:calc SQL must preserve this convention or data will silently break

## Test Coverage Gaps

| Area | Status |
|------|--------|
| Native SubscriptionManager / FeatureGate | No Swift tests |
| GalleryView D3 compliance | Untested (no D3 join to test) |
| Schema migration edge cases | Partially covered by seam tests |
| HistogramScrubber brush E2E | Not covered in Playwright specs |
| CloudKit SyncManager conflict resolution | Logic tested, no real CK tests |

## Browser/Platform Compatibility

- CSS `content-visibility: auto` requires Safari 18+ — iOS 17 users get JS windowing only
- Note-to-note link URL formats not verified against actual user data
