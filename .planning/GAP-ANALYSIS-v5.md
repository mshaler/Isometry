# Gap Analysis: Isometry v5 Web Runtime

**Date:** February 28, 2026
**Status:** Phase 2 Complete (Database Layer) | Phase 3 Not Started (UI Layer)

---

## 1. Executive Summary
The current codebase provides a robust, spec-compliant **Database Layer** built on sql.js (SQLite WASM) with custom FTS5 support. It successfully implements the LATCH/GRAPH data model and recursive graph queries. However, the **Web Runtime (UI Layer)** is entirely absent. No D3.js rendering, projection logic, or state management has been implemented yet.

---

## 2. Implementation Status vs. v5 Specification

### 2.1 Database Layer (Implemented ✅)
| Feature | Status | Specification Alignment |
| --- | --- | --- |
| **Canonical Schema** | ✅ Complete | Follows `Contracts.md` and `Cards.md` exactly. |
| **FTS5 Integration** | ✅ Complete | Custom WASM build with Porter/Unicode61 tokenization. |
| **Soft Delete** | ✅ Complete | `deleted_at` pattern with partial indexes. |
| **Graph Queries** | ✅ Complete | Recursive CTEs for traversal and shortest path. |
| **WASM Compat** | ✅ Complete | `wasm-compat.ts` handles MIME types and path resolution. |

### 2.2 Projection Engine (Missing ❌)
| Feature | Status | Notes |
| --- | --- | --- |
| **PAFV SQL Generator** | ❌ Missing | No logic to generate parameterized SQL for stacked headers. |
| **Header Hierarchy** | ❌ Missing | D3 hierarchy layout for nested LATCH dimensions is not started. |
| **Cell Coordinates** | ❌ Missing | Mapping SQL results to x, y, z screen coordinates. |

### 2.3 UI & Rendering (Missing ❌)
| Feature | Status | Notes |
| --- | --- | --- |
| **D3.js Rendering** | ❌ Missing | No D3.js code present in `src/`. |
| **Card Components** | ❌ Missing | No 1x/2x/5x/10x card templates or D3 `.join()` handlers. |
| **View Transitions** | ❌ Missing | Polymorphic view switching logic is absent. |
| **Explorers** | ❌ Missing | All 13 modular components (Time, Map, Search, etc.) are unbuilt. |

### 2.4 State Management (Missing ❌)
| Feature | Status | Notes |
| --- | --- | --- |
| **Observable Store** | ❌ Missing | Interaction state (drag, selection, viewport) is not implemented. |
| **UI State Sync** | ❌ Missing | Persistence of layout metadata to `ui_state` table is not wired up. |

---

## 3. Architectural & Implementation Feedback

### 3.1 Strengths
1. **Single Source of Truth:** The implementation strictly adheres to the principle that "SQLite is the system of record."
2. **Graph Efficiency:** Using recursive CTEs inside SQLite avoids the "bridge bottleneck" of pulling large graph segments into JS.
3. **Type Safety:** The use of TypeScript (strict mode) with well-defined interfaces in `types.ts` provides excellent stability.

### 3.2 Recommendations
1. **PAF-V Engine Priority:** The next critical path is the **PAFV Projection Engine**. Without it, the "Schema-on-Read" and "Any axis to any plane" principles cannot be demonstrated.
2. **Web Worker Strategy:** The `Database.ts` currently runs on the main thread. As D3.js rendering starts, SQL execution should move to a **Web Worker** to prevent UI stutter during complex projections.
3. **D3 Data Join Pattern:** Ensure that D3 implementation strictly follows the `.join()` pattern for state management, as specified in the "What We Are Explicitly Not Using" section of the spec (No React/Redux).
4. **FTS Snippets:** The search implementation is excellent; consider adding a "Highlight" component in the UI that safely renders the `<mark>` tags from FTS5 snippets.

---

## 4. Immediate Gap Closure Plan

1. **Phase 3.1: PAFV Engine Foundation**
   - Implement `ProjectionEngine.ts` to transform PAFV config into SQL queries.
   - Implement `HeaderLayout.ts` using `d3-hierarchy` to calculate nested axis offsets.

2. **Phase 3.2: D3 Web Runtime Scaffolding**
   - Create `src/view/App.ts` to initialize the main D3 container.
   - Implement the **List View** as the first functional "tangible" projection.

3. **Phase 3.3: Observable Layout Store**
   - Create `src/store/LayoutStore.ts` using the "simple observable" pattern.
   - Wire drag-and-drop events to the store.

---

## 5. Risk Assessment
- **Context Limit / Crash:** The large size of the v5 specification and modules can cause CLI timeouts or crashes if not handled incrementally. 
- **WASM Performance:** On mobile devices (iOS), complex recursive CTEs might hit execution time limits in WKWebView. Benchmarking on target hardware is recommended after Phase 3.1.
