# Technical Concerns

**Analysis Date:** 2026-01-21

## Critical Blockers (🔴)

### 1. DSL Parser is Stub Implementation
**Files:** `src/dsl/parser.ts`

**Issue:** Parser only handles simple `field:value` patterns.

```typescript
// Current (line 30-38) - only matches field:value
const match = trimmed.match(/^(\w+):(.+)$/);
```

**Problems:**
- Cannot handle boolean operators (AND, OR, NOT)
- Cannot parse complex expressions or nested groups
- No comparison operators (>, <, >=, <=)
- TODO at line 13-14: "Generate parser from PEG.js grammar" never completed

**Impact:** DSL queries in CommandBar non-functional
**Fix:** Run `npx pegjs src/dsl/grammar/IsometryDSL.pegjs` and integrate

---

### 2. Missing Data Flow Pipeline
**Gap:** No complete path from SQLite → React State → D3 Visualization

**Current State:**
- `useSQLiteQuery` hook exists but isolated
- Filter state changes don't trigger query re-execution
- CommandBar accepts DSL but changes have no effect
- Views don't implement layout algorithms

**Impact:** Visualization system disconnected

---

### 3. Filter State Not Connected
**Files:** `src/contexts/FilterContext.tsx`, `src/filters/compiler.ts`

**Issue:** Filter UI changes don't recompile or re-execute queries

- FilterContext exists but useSQLiteQuery doesn't subscribe
- `compileFilters()` produces SQL but never called
- Sidebar marks edge filters unavailable with TODO

**Impact:** Filtering is UI theater with no functional effect

---

## High Priority Issues (🟡)

### 4. Database Schema Fragmentation
**React:** `src/db/schema.sql`
**Native:** `native/Sources/Isometry/Resources/schema.sql`

- Schema defined in two places
- React has `cards` table, Native has `nodes` table
- No automated schema sync mechanism
- Breaking changes silently corrupt data

---

### 5. AutoComplete Hardcoded
**File:** `src/dsl/autocomplete.ts` (line 9)

```typescript
/** Available schema fields - TODO: Load from SQLite */
const SCHEMA_FIELDS = [
  { name: 'status', ... },
  // ... hardcoded list
];
```

- Suggestions never update if schema changes
- May suggest non-existent fields

---

### 6. CloudKit Conflict Resolution Risk
**File:** `native/Sources/Isometry/Sync/CloudKitSyncManager.swift`

```swift
private var conflictStrategy: ConflictResolutionStrategy = .latestWins
```

- "Latest wins" may overwrite local work unexpectedly
- User deletes note, server version reappears
- No merge/3-way resolution by default
- Manual resolution queue requires UI that doesn't exist

**Recommendation:** Default to `.serverWins` or `.manualResolution`

---

### 7. CDN Dependency (React)
**File:** `src/db/init.ts` (line 29)

```typescript
script.src = 'https://sql.js.org/dist/sql-wasm.js';
```

- External CDN with no fallback
- No integrity checking
- WASM loaded from internet without verification

---

### 8. Auto-Import Without User Consent
**File:** `native/Sources/Isometry/App/IsometryApp.swift`

- Imports alto-index Notes on first launch without confirmation
- No progress indicator during import
- 6,891 notes = potential UI freeze
- No memory constraints check

---

## Technical Debt (🟢)

### 9. View System Not Implemented
**Files:** `src/components/views/`

All 8 view types defined but not wired:
- GridView, ListView, KanbanView
- TimelineView, CalendarView, ChartsView
- NetworkView, TreeView

---

### 10. PAFV State Not Connected
**File:** `src/state/PAFVContext.tsx`

- Users can drag facets in PAFVNavigator
- Axis assignments don't affect rendering
- No computation transforms PAFV → D3 scales

---

### 11. LocationFilter Never Implemented
**Files:** `src/types/filter.ts`, `src/components/NavigatorFooter.tsx`

- Type definition exists, no implementation
- SpatiaLite support missing
- Map rendering marked as v3.1 feature

---

### 12. No Pagination in Native Queries
**File:** `native/Sources/Isometry/Database/IsometryDatabase.swift`

```swift
let nodes = try Node.filter(...).fetchAll(db)  // Entire table
```

- Large datasets load entirely into memory
- 10,000+ notes = hundreds of MB
- Risk of memory pressure on iOS

---

### 13. FilterContext Not Debounced
**File:** `src/contexts/FilterContext.tsx`

- Every keystroke triggers new query
- No debouncing logic
- Could overwhelm database on large datasets

---

### 14. Sync Version Update Not Atomic
**File:** `native/Sources/Isometry/Sync/CloudKitSyncManager.swift`

```swift
try await localDatabase.updateNode(resolvedNode)  // First update
var updatedNode = resolvedNode
updatedNode.syncVersion += 1
try await localDatabase.updateNode(updatedNode)   // Second update!
```

- Two separate writes for conflict resolution
- If first succeeds, second fails: inconsistent state

---

## Missing Features

### 15. No Empty State Handling
- No message when no nodes match filter
- No feedback when database is empty
- Loading states inconsistent

### 16. No Undo/Redo
- User deletes node, no recovery option
- Native has versioning but no undo UI

### 17. No Keyboard Shortcuts
- Hotkey system not implemented
- No accessibility considerations

---

## Safe to Modify

1. **Filter compiler logic** - Isolated, parameterized queries
2. **Schema files** - Keep both React/Native in sync
3. **View implementations** - Add without affecting existing
4. **Error handling** - Improve without breaking changes

## Risky to Modify

1. **CloudKit sync manager** - Conflict resolution affects data integrity
2. **DSL parser** - Careful integration to avoid breaking CommandBar
3. **Database initialization** - Changes affect both platforms
4. **Node model properties** - Sync version tracking depends on exact fields

## Do Not Modify Without Plan

1. **sql.js CDN URL** - Changing breaks app entirely
2. **Database schema** - Must migrate both platforms atomically
3. **IndexedDB storage key** - Breaks existing user data
4. **CloudKit container ID** - Loses all synced data

---

## Implementation Priority

| Phase | Days | Focus |
|-------|------|-------|
| **0** | 1-2 | Generate DSL parser from PEG.js grammar |
| **1** | 3-7 | Wire FilterContext → useSQLiteQuery → D3 |
| **2** | 8-10 | Implement Grid and List views |
| **3** | 11-14 | Connect PAFV state to rendering |
| **4** | 15+ | CloudKit testing, error boundaries |

---

## Summary

| Category | Count |
|----------|-------|
| Critical Blockers | 3 |
| High Priority Issues | 5 |
| Technical Debt | 6 |
| Missing Features | 3 |
| **Total** | **17** |

The architecture is sound but integration work is substantial. Focus first on completing the data pipeline (Phase 1) before expanding features.

---

*Concerns analysis: 2026-01-21*
*Update when issues resolved or discovered*
