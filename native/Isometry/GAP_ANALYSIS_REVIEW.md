# Gap Analysis Review: Architecture Mismatch Assessment

*Prepared for Claude AI review — response to `NATIVE_SHELL_GAP_ANALYSIS.md`*
*Date: 2026-03-04*

---

## Executive Summary

The `NATIVE_SHELL_GAP_ANALYSIS.md` document recommends building a full SQLite query layer in Swift (CRUD, FTS5, graph traversal, CloudKit record sync, facet API). **These recommendations target an architecture that does not match the shipped v2.0 Native Shell.**

The v2.0 codebase implements a **web-runtime shell** where sql.js in a WKWebView owns all data operations. Swift handles only platform concerns (checkpoint persistence, iCloud file sync, StoreKit, window management). The gap analysis appears to have been written against the `CLAUDE.md` implementation plan — which describes a standalone Swift Package with native SQLite — rather than against the actual shipped code.

**Before any items in the gap analysis are implemented, a fundamental architecture question must be resolved:** Is Isometry migrating from sql.js to native SQLite, or staying with the web-runtime model?

---

## Evidence: What the Shipped v2.0 Code Actually Does

### The Swift Layer (What Exists)

| Component | Role | Queries SQLite? |
|-----------|------|-----------------|
| `DatabaseManager` (actor) | Checkpoint persistence — load/save entire `.db` as opaque bytes | **No** |
| `BridgeManager` (@MainActor) | 5-message Swift↔JS bridge (`native:ready`, `checkpoint`, `mutated`, `native:action`, `native:sync`) | **No** |
| `AssetsSchemeHandler` | Serves bundled web assets via `app://` custom URL scheme | **No** |
| `SubscriptionManager` | StoreKit 2 subscription tiers (Free/Pro/Workbench) | **No** |
| `FeatureGate` | Tier-based feature enforcement | **No** |
| `ContentView` / `IsometryApp` | SwiftUI shell with sidebar, file import, lifecycle hooks | **No** |

**No Swift code opens, queries, or writes to the SQLite database.** The `.db` file is treated as an opaque binary checkpoint. All SQL execution happens in the sql.js Worker inside WKWebView.

### The JavaScript Layer (What Handles Data)

| Concern | Implementation | Location |
|---------|---------------|----------|
| Card CRUD | sql.js `INSERT`/`UPDATE`/`DELETE` | Worker |
| FTS5 search | sql.js `cards_fts` virtual table | Worker |
| Graph traversal | Recursive CTEs via `connectedCards()`, `shortestPath()` | `graph.ts` in Worker |
| Graph algorithms | PageRank, Louvain, centrality | Worker |
| PAFV projection | Axis-to-plane mapping, facet selection | `PAFVProvider` in main thread |
| State persistence | `ui_state` table via sql.js | Worker |

### The Bridge Protocol

The 5-message bridge was designed so that **Swift never needs to understand the database contents**:

1. **`native:ready`** → Swift sends `LaunchPayload` (platform, tier, viewport, safe area insets)
2. **`checkpoint`** → JS sends entire database as base64 bytes → Swift saves to disk atomically
3. **`mutated`** → JS signals dirty flag → Swift marks checkpoint as stale
4. **`native:action`** → JS requests platform operations (file import/export/sync) with FeatureGate checks
5. **`native:sync`** → Swift sends CloudKit notifications to JS

This is a **whole-database checkpoint model**, not a record-level sync model.

---

## Item-by-Item Analysis

### 🔴 Item 1 — "Edges Are Not First-Class Cards"

**Recommendation:** Add `edges_fts`, edge CRUD, and edge sync to Swift.

**Problems identified:**

1. **Contradicts locked architecture decision D-001.** The canonical spec states:
   > *"Connections are lightweight, not cards (via_card_id pattern for richness)"*

   The schema uses `cards` and `connections` as intentionally separate tables. Rich relationships are modeled through `via_card_id` pointing to a mediating card, not by promoting connections to card status. The gap analysis claim that *"Edges are Cards too"* reverses D-001.

2. **Uses wrong table names.** The schema defines `cards` and `connections`. The gap analysis uses `nodes` and `edges` throughout — terminology from the `CLAUDE.md` implementation plan, not from the shipped schema (`src/database/schema.sql`).

3. **Builds a parallel query layer.** Adding `saveEdge()`, `getEdge()`, `search()` to Swift means two runtimes (Swift SQLite3 + sql.js WASM) would execute queries against the same schema. This is the duplication anti-pattern that `Providers.md` explicitly warns against:
   > *"sql.js IS the reactive store. Don't duplicate entity data in JavaScript objects."*

4. **Assumes record-level CloudKit sync.** Item 1c proposes pushing individual Edge records to CloudKit with `CKModifyRecordsOperation`. The shipped v2.0 uses whole-database checkpoint sync via iCloud Documents with `NSFileCoordinator`. These are fundamentally different sync models.

**Assessment:** If the project is migrating to native SQLite (abandoning sql.js), Item 1 becomes a valid roadmap item but needs to use the correct table names (`connections`, not `edges`) and must not reverse D-001 without explicit architectural review. If staying with sql.js, Item 1 should not be implemented.

---

### 🔴 Item 2 — ConflictResolution Enum "Compiler Bug"

**Recommendation:** Fix associated values on `ConflictResolution.needsUserInput`.

**Problem identified:** `ConflictResolver`, `ConflictResolution`, and `Node` do not exist in the codebase. There are no Swift files containing these types. There is no compiler error because there is no code.

**Assessment:** This item references phantom code. If a `ConflictResolver` is built in a future phase, the associated-value signature should be correct from the start, but there is nothing to fix today.

---

### 🟡 Item 3 — Add `subgraph()` Method

**Recommendation:** Add `SubgraphPayload` struct and `subgraph(startingAt:maxDepth:)` to `IsometryDatabase`.

**Problem identified:** `IsometryDatabase` does not exist. Graph traversal is already implemented in `graph.ts` (`connectedCards()` and `shortestPath()`) running in the sql.js Worker. The D3 network view consumes this data directly from the Worker without crossing the bridge.

**Assessment:** Duplicates existing JavaScript functionality. Only relevant if migrating to native SQLite.

---

### 🟡 Item 4 — Add `getAllFacets()` API

**Recommendation:** Add a `Facet` struct and `getAllFacets()` method to read a `facets` table.

**Problems identified:**

1. **No `facets` table exists.** Architecture decision D-008 specifies schema-on-read: *"No extra EAV tables in v5."* The `cards` table columns ARE the facets. PAFV axis mapping is handled by `PAFVProvider` in JavaScript.

2. **`IsometryDatabase` does not exist** to add the method to.

**Assessment:** Based on a misunderstanding of the PAFV model. The facets are not stored in a separate table — they are implicit in the cards schema and resolved at the JS layer.

---

### 🔵 Item 5 — Remove `nodeImportance()`

**Recommendation:** Delete `nodeImportance()` from `IsometryDatabase`.

**Problem identified:** `nodeImportance()` does not exist. `IsometryDatabase` does not exist. There is nothing to delete.

**Assessment:** Correct in principle (graph algorithms belong in JS/D3), but moot. Useful as defensive guidance for a future implementer.

---

### 🔵 Item 6 — Do Not Implement `clustering_candidates`

**Recommendation:** Do not wire up the Jaccard similarity query as a Swift method.

**Problem identified:** No action was needed and none was taken. Correct guidance.

**Assessment:** Agree. Community detection belongs in the JS Worker.

---

## Root Cause Analysis

The gap analysis appears to have been generated by comparing `CLAUDE.md` (which describes a standalone Swift Package architecture with `IsometryDatabase`, `Node`, `Edge`, `ConflictResolver`, `CloudKitSyncManager`) against the canonical architecture specs (`CLAUDE-v5.md`, `Contracts.md`).

The problem is that **`CLAUDE.md` describes an architecture that was never built.** The v2.0 Native Shell took a different approach:

| Aspect | CLAUDE.md Plan | v2.0 Shipped Reality |
|--------|---------------|---------------------|
| Database engine | Native SQLite3 via Swift actor | sql.js WASM in WKWebView |
| Query execution | Swift methods on `IsometryDatabase` | JavaScript in Worker thread |
| Data models | `Node`, `Edge` Swift structs | `cards`, `connections` in sql.js |
| Sync model | Record-level CloudKit push/pull | Whole-database checkpoint via iCloud Documents |
| Graph algorithms | Some in Swift, some in JS | All in JS Worker |
| FTS5 search | Swift `search()` method | JS Worker queries `cards_fts` |

The gap analysis found real discrepancies — but between two *documents*, not between code and spec. The actual code is consistent with the actual architecture.

---

## Decision Required

Before acting on any recommendation in the gap analysis, resolve this question:

### Is Isometry migrating from sql.js to native SQLite?

**If YES (future native-first rewrite):**
- The gap analysis becomes a valid **v3.0 roadmap**, not a v2.0 fix list
- Terminology must be corrected (`cards`/`connections`, not `nodes`/`edges`)
- D-001 must be explicitly reviewed if edges-as-cards is desired
- The checkpoint bridge protocol must be replaced with a query-level bridge
- This is a fundamental architecture change, not a gap fix

**If NO (staying with sql.js web runtime):**
- All 🔴 and 🟡 items should be **rejected** as architecturally contradictory
- The 🔵 items are valid defensive guidance
- `CLAUDE.md` should be updated to reflect the actual v2.0 architecture to prevent future confusion
- The gap analysis document should be archived with a note explaining why it was not actioned

---

## Recommendation

Update `CLAUDE.md` to match the shipped v2.0 architecture. The current `CLAUDE.md` describes a standalone Swift Package with native SQLite — an architecture that was superseded by the web-runtime shell model. This mismatch is what caused the gap analysis to identify "gaps" that are actually intentional design boundaries.

The shipped v2.0 code is **architecturally consistent** with `CLAUDE-v5.md`, `Contracts.md`, and `WorkerBridge.md`. No critical fixes are required.
